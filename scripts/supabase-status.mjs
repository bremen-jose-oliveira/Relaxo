#!/usr/bin/env node
/**
 * Check whether the live Supabase project has what Relaxo sync needs.
 * Uses EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY only
 * (no database password).
 *
 *   npm run db:supabase:status
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

/** @type {{ name: string; select: string; hint: string }[]} */
const TABLES = [
  { name: 'households', select: 'id,invite_code,name', hint: 'schema.sql' },
  { name: 'household_members', select: 'household_id,user_id', hint: 'schema.sql' },
  { name: 'babies', select: 'id,household_id,name,birth_date', hint: 'schema.sql' },
  {
    name: 'sleep_events',
    select: 'id,household_id,type,start_time,extension',
    hint: 'schema.sql + 0011_sleep_insights.sql (extension column)',
  },
  { name: 'sleep_pauses', select: 'id,household_id,sleep_event_id', hint: 'schema.sql' },
  { name: 'feeding_events', select: 'id,household_id,feed_type', hint: 'schema.sql' },
  { name: 'diaper_events', select: 'id,household_id,diaper_type', hint: 'schema.sql' },
  { name: 'bath_events', select: 'id,household_id,time', hint: 'schema.sql' },
  { name: 'wake_events', select: 'id,household_id,wake_type', hint: 'schema.sql' },
  {
    name: 'daily_chores',
    select: 'id,household_id,title,reminder_minutes',
    hint: 'schema.sql + 0012_task_reminders.sql (reminder_minutes)',
  },
  {
    name: 'day_context_tags',
    select: 'id,household_id,date_key,tag',
    hint: '0011_sleep_insights.sql',
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
    // Table/columns exist; anon key just can't read rows — fine for schema check.
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
      hint: 'Run 0014_join_household_by_invite.sql in SQL Editor',
    };
  }
  // Function exists: may return null (no household), or raise Not authenticated, etc.
  if (ok || status === 200 || /Not authenticated|Invalid invite|null/i.test(message) || json === null) {
    return { ok: true, detail: 'function exists' };
  }
  // 400 with our raise exception also means function exists
  if (status >= 400 && status < 500 && !/Could not find/i.test(message)) {
    return { ok: true, detail: `function exists (${message})` };
  }
  return { ok: false, detail: message, hint: '0014_join_household_by_invite.sql' };
}

async function main() {
  console.log(`Relaxo Supabase status\n  ${url}\n`);

  let failed = 0;

  for (const table of TABLES) {
    const result = await checkTable(table);
    if (result.ok) {
      console.log(`  ✓ ${table.name}  ${result.detail}`);
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
  if (failed === 0) {
    console.log('All sync prerequisites look OK.');
  } else {
    console.log(
      `${failed} issue(s). Fix in Supabase → SQL Editor (no DB password needed), then re-run this.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
