#!/usr/bin/env node
/**
 * Writes assets/latest-preview-build.json from the latest finished preview builds,
 * and upserts the same pointer into Supabase so installed apps don't keep opening
 * a stale buildId baked into an old JS bundle.
 *
 * Run after every `eas build` (preview).
 *
 * Publish order (first that works wins):
 *   1. SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY  (REST — recommended)
 *   2. SUPABASE_DB_PASSWORD + SUPABASE_DB_REGION         (pooler, password unencoded)
 *   3. SUPABASE_DB_URL                                   (full postgres URI)
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadDotEnv, withPostgres } from './supabase-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../assets/latest-preview-build.json');

loadDotEnv();

function fetchLatest(platform) {
  try {
    // Use eas-cli explicitly — `npx eas` resolves to an unrelated package (eas@0.1.0).
    const raw = execFileSync(
      'npx',
      [
        'eas-cli',
        'build:list',
        '--platform',
        platform,
        '--profile',
        'preview',
        '--status',
        'finished',
        '--limit',
        '1',
        '--json',
        '--non-interactive',
      ],
      {
        encoding: 'utf8',
        cwd: join(__dirname, '..'),
        // upgrade banners go to stderr; keep stdout JSON-clean when possible
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    // eas-cli may print upgrade banners before the JSON array
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start < 0 || end < start) {
      console.warn(`[sync:preview-build] No JSON builds list for ${platform}`);
      return null;
    }
    const builds = JSON.parse(raw.slice(start, end + 1));
    const build = builds[0];
    if (!build?.id) return null;
    return {
      buildId: build.id,
      artifactUrl: build.artifacts?.buildUrl ?? build.artifacts?.applicationArchiveUrl ?? null,
    };
  } catch (err) {
    console.warn(
      `[sync:preview-build] Failed to fetch ${platform} builds:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

const payload = {
  ios: fetchLatest('ios'),
  android: fetchLatest('android'),
  syncedAt: new Date().toISOString(),
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log('Wrote', outPath);
console.log(JSON.stringify(payload, null, 2));

const row = {
  id: 'preview',
  ios_build_id: payload.ios?.buildId ?? null,
  ios_artifact_url: payload.ios?.artifactUrl ?? null,
  android_build_id: payload.android?.buildId ?? null,
  android_artifact_url: payload.android?.artifactUrl ?? null,
  synced_at: payload.syncedAt,
};

async function publishViaServiceRole() {
  const apiUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '';

  if (!apiUrl || !serviceKey) {
    return { ok: false, skipped: true, reason: 'no service role key' };
  }

  const res = await fetch(`${apiUrl}/rest/v1/latest_preview_build?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      skipped: false,
      reason: `REST ${res.status}: ${text.slice(0, 240)}`,
    };
  }
  return { ok: true };
}

async function publishViaPostgres() {
  await withPostgres(async (sql) => {
    await sql.unsafe(`
      create table if not exists public.latest_preview_build (
        id text primary key default 'preview',
        ios_build_id text,
        ios_artifact_url text,
        android_build_id text,
        android_artifact_url text,
        synced_at timestamptz not null default now()
      );
      alter table public.latest_preview_build enable row level security;
      drop policy if exists "latest_preview_build_select" on public.latest_preview_build;
      create policy "latest_preview_build_select" on public.latest_preview_build
        for select using (true);
    `);
    await sql`
      insert into public.latest_preview_build (
        id, ios_build_id, ios_artifact_url, android_build_id, android_artifact_url, synced_at
      ) values (
        ${row.id},
        ${row.ios_build_id},
        ${row.ios_artifact_url},
        ${row.android_build_id},
        ${row.android_artifact_url},
        ${row.synced_at}
      )
      on conflict (id) do update set
        ios_build_id = excluded.ios_build_id,
        ios_artifact_url = excluded.ios_artifact_url,
        android_build_id = excluded.android_build_id,
        android_artifact_url = excluded.android_artifact_url,
        synced_at = excluded.synced_at
    `;
    await sql.unsafe(`notify pgrst, 'reload schema'`);
  });
}

async function publishToSupabase() {
  const viaRest = await publishViaServiceRole();
  if (viaRest.ok) {
    console.log('Published latest_preview_build to Supabase (service role REST)');
    return;
  }
  if (!viaRest.skipped) {
    console.warn('Service role publish failed:', viaRest.reason);
  }

  try {
    await publishViaPostgres();
    console.log('Published latest_preview_build to Supabase (Postgres)');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      'Supabase publish failed (app will fall back to bundled JSON until this works):',
      msg
    );
    console.warn(
      '\nEasiest fix — add the service role key to .env (no DB password needed):\n' +
        '  Supabase → Project Settings → API → service_role (secret)\n' +
        '  SUPABASE_SERVICE_ROLE_KEY=eyJ...\n\n' +
        'Or use pooler + plain password (not the db.* direct host):\n' +
        '  SUPABASE_DB_PASSWORD=your_db_password\n' +
        '  SUPABASE_DB_REGION=eu-central-1\n' +
        '  # remove SUPABASE_DB_URL if it points at db.<ref>.supabase.co\n'
    );
  }
}

await publishToSupabase();
