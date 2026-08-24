#!/usr/bin/env node
/**
 * Check whether the live Supabase project has what Relaxo sync needs.
 * Uses EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY only
 * (no database password).
 *
 *   node scripts/supabase-status.mjs
 *   # or: npm run db:supabase:status
 */
import { loadDotEnv } from './supabase-lib.mjs';

loadDotEnv();

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

if (!url || !key) {
  console.error(
    'Need EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env'
  );
  process.exit(1);
}

/**
 * Every cloud table the app reads/writes (or needs for preview installs).
 * `select` lists columns that must exist — PostgREST fails if any are missing.
 *
 * @type {{ name: string; select: string; hint: string; optional?: boolean }[]}
 */
const TABLES = [
  {
    name: 'profiles',
    select: 'id,display_name',
    hint: 'schema.sql',
  },
  {
    name: 'households',
    select: 'id,invite_code,name,created_by',
    hint: 'schema.sql',
  },
  {
    name: 'household_members',
    select: 'household_id,user_id,role',
    hint: 'schema.sql',
  },
  {
    name: 'babies',
    select:
      'id,household_id,name,birth_date,nap_goal,track_feeding_duration,easily_overstimulated,high_need,updated_at,deleted_at',
    hint: 'schema.sql',
  },
  {
    name: 'sleep_events',
    select:
      'id,household_id,baby_id,type,start_time,end_time,extension,onset_method,settle_minutes,settle_quality,settle_aid,sleep_place,wake_manner,wake_mood,updated_at,deleted_at',
    hint:
      'schema.sql (or 0011 + 0021_sleep_context.sql + 0023_sleep_settle.sql)',
  },
  {
    name: 'sleep_pauses',
    select:
      'id,household_id,sleep_event_id,start_time,end_time,updated_at,deleted_at',
    hint: 'schema.sql',
  },
  {
    name: 'feeding_events',
    select:
      'id,household_id,baby_id,feed_type,start_time,end_time,side,amount,unit,notes,updated_at,deleted_at',
    hint: 'schema.sql',
  },
  {
    name: 'diaper_events',
    select:
      'id,household_id,baby_id,diaper_type,time,notes,updated_at,deleted_at',
    hint: 'schema.sql',
  },
  {
    name: 'bath_events',
    select: 'id,household_id,baby_id,time,notes,updated_at,deleted_at',
    hint: 'schema.sql',
  },
  {
    name: 'wake_events',
    select:
      'id,household_id,baby_id,time,end_time,wake_type,notes,updated_at,deleted_at',
    hint: 'schema.sql',
  },
  {
    name: 'daily_chores',
    select:
      'id,household_id,baby_id,title,sort_order,created_at,recurrence,reminder_minutes,updated_at,deleted_at',
    hint: 'schema.sql + 0012_task_reminders.sql (reminder_minutes)',
  },
  {
    name: 'daily_chore_completions',
    select:
      'id,household_id,chore_id,date_key,completed_at,updated_at,deleted_at',
    hint: 'schema.sql (or 0016_sync_prerequisites.sql)',
  },
  {
    name: 'day_context_tags',
    select:
      'id,household_id,baby_id,date_key,tag,updated_at,deleted_at',
    hint:
      'schema.sql (or 0011_sleep_insights.sql) + 0024_day_context_tags_partial_unique.sql',
  },
  {
    name: 'latest_preview_build',
    select:
      'id,ios_build_id,ios_artifact_url,android_build_id,android_artifact_url,synced_at',
    hint: 'schema.sql (or 0017_latest_preview_build.sql)',
    optional: true,
  },
];

async function rest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

function classifyTableError(message) {
  const msg = message || '';
  if (/Could not find the table/i.test(msg)) return 'missing_table';
  if (/Could not find the ['"]?\w+['"]? column/i.test(msg)) return 'missing_column';
  if (/JWT|not authenticated|permission|RLS|row-level/i.test(msg)) return 'ok_rls';
  return 'error';
}

async function checkTable(table) {
  const { ok, status, json, text } = await rest(
    `${table.name}?select=${encodeURIComponent(table.select)}&limit=0`
  );
  if (ok || status === 200 || status === 206) {
    return { ok: true, detail: 'reachable' };
  }
  const message = json?.message || json?.error || text || `HTTP ${status}`;
  const kind = classifyTableError(message);
  if (kind === 'ok_rls') {
    return { ok: true, detail: 'exists (RLS blocks anon read)' };
  }
  return { ok: false, kind, detail: message, hint: table.hint };
}

async function checkJoinRpc() {
  const { ok, status, json, text } = await rest('rpc/join_household_by_invite', {
    method: 'POST',
    body: { p_code: 'STATUSCHECK' },
  });
  const message = json?.message || json?.error || text || `HTTP ${status}`;

  if (/Could not find the function|PGRST202/i.test(message)) {
    return {
      ok: false,
      detail: message,
      hint: 'Run schema.sql or 0014_join_household_by_invite.sql in SQL Editor',
    };
  }
  if (
    ok ||
    status === 200 ||
    /Not authenticated|Invalid invite|null/i.test(message) ||
    json === null
  ) {
    return { ok: true, detail: 'function exists' };
  }
  if (status >= 400 && status < 500 && !/Could not find/i.test(message)) {
    return { ok: true, detail: `function exists (${message})` };
  }
  return { ok: false, detail: message, hint: '0014_join_household_by_invite.sql' };
}

async function main() {
  console.log(`Relaxo Supabase status\n  ${url}\n`);

  let failed = 0;
  let optionalFailed = 0;

  for (const table of TABLES) {
    const result = await checkTable(table);
    if (result.ok) {
      console.log(`  ✓ ${table.name}  ${result.detail}`);
    } else if (table.optional) {
      optionalFailed += 1;
      console.log(`  ~ ${table.name} (optional)`);
      console.log(`      ${result.detail}`);
      if (result.hint) console.log(`      → ${result.hint}`);
    } else {
      failed += 1;
      console.log(`  ✗ ${table.name}`);
      console.log(`      ${result.detail}`);
      if (result.hint) console.log(`      → ${result.hint}`);
    }
  }

  const rpc = await checkJoinRpc();
  if (rpc.ok) {
    console.log(`  ✓ join_household_by_invite()  ${rpc.detail}`);
  } else {
    failed += 1;
    console.log(`  ✗ join_household_by_invite()`);
    console.log(`      ${rpc.detail}`);
    if (rpc.hint) console.log(`      → ${rpc.hint}`);
  }

  console.log('');
  console.log(
    'Note: Realtime publication (0022 / schema.sql) cannot be verified via REST.'
  );
  console.log(
    'If partner phones do not update live, run supabase/0022_realtime_household.sql.'
  );
  console.log('');

  if (failed === 0) {
    const suffix =
      optionalFailed > 0
        ? ` (${optionalFailed} optional item(s) missing — preview install pointer).`
        : '';
    console.log(`All required sync tables/columns look OK.${suffix}`);
  } else {
    console.log(
      `${failed} required issue(s). Fix in Supabase → SQL Editor:\n` +
        `  • New project: paste supabase/schema.sql\n` +
        `  • Existing project: run pending supabase/NNNN_*.sql in order\n` +
        `Then re-run: node scripts/supabase-status.mjs`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && err.cause ? ` (${err.cause})` : '';
  console.error(`${msg}${cause}`);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(msg + cause)) {
    console.error(
      '\nCould not reach Supabase. Check network/VPN, then confirm EXPO_PUBLIC_SUPABASE_URL in .env.'
    );
  }
  if (/Invalid API key/i.test(msg)) {
    console.error(
      '\nAPI key rejected. In .env, use EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY without a trailing #.'
    );
  }
  process.exit(1);
});
