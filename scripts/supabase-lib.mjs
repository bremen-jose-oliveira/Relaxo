/**
 * Shared helpers for Supabase SQL migration scripts.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
export const SUPABASE_DIR = join(ROOT, 'supabase');

const MIGRATION_RE = /^(\d{4})_.+\.sql$/i;

export function loadDotEnv() {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Project ref from EXPO_PUBLIC_SUPABASE_URL
 * e.g. https://abcd.supabase.co → abcd
 */
export function projectRefFromApiUrl(apiUrl) {
  try {
    const host = new URL(apiUrl).hostname; // abcd.supabase.co
    const ref = host.split('.')[0];
    return ref && ref !== 'supabase' ? ref : null;
  } catch {
    return null;
  }
}

/**
 * Postgres URI for `npm run db:supabase` / `db:supabase:fresh`.
 *
 * EXPO_PUBLIC_SUPABASE_URL is HTTPS (app API) — not enough alone.
 * Prefer Session pooler (IPv4); `db.<ref>.supabase.co` often ENOTFOUND.
 *
 * Options (first match wins):
 *   1. SUPABASE_DB_URL=postgresql://…   (paste Session URI from Dashboard → Connect)
 *   2. EXPO_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD + SUPABASE_DB_REGION
 *      (or SUPABASE_POOLER_HOST=aws-0-eu-central-1.pooler.supabase.com)
 */
export function getDatabaseUrl() {
  loadDotEnv();

  const explicit =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL;

  if (explicit) {
    if (/^https?:\/\//i.test(explicit)) {
      throw new Error(
        'SUPABASE_DB_URL must be postgresql://…, not the https:// app URL.\n\n' +
          'Supabase → Project Settings → Database → Connect → Session mode → copy URI.'
      );
    }
    if (!/^postgres(ql)?:\/\//i.test(explicit)) {
      throw new Error(
        'SUPABASE_DB_URL must start with postgresql:// (got something else).'
      );
    }
    return explicit;
  }

  const apiUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  const region = process.env.SUPABASE_DB_REGION?.trim();
  const poolerHost =
    process.env.SUPABASE_POOLER_HOST?.trim() ||
    (region ? `aws-0-${region}.pooler.supabase.com` : null);

  if (apiUrl && password && poolerHost) {
    const ref = projectRefFromApiUrl(apiUrl);
    if (!ref) {
      throw new Error(
        `Could not read project ref from EXPO_PUBLIC_SUPABASE_URL (${apiUrl}).`
      );
    }
    const enc = encodeURIComponent(password);
    // Session mode pooler: user is postgres.<ref>, port 5432 (not 6543 transaction).
    return `postgresql://postgres.${ref}:${enc}@${poolerHost}:5432/postgres`;
  }

  throw new Error(
    'Missing Postgres credentials for npm run db:supabase.\n\n' +
      'Option A — paste Session URI (easiest):\n' +
      '  Supabase → Database → Connect → Session mode → URI\n' +
      '  SUPABASE_DB_URL=postgresql://postgres.<ref>:…@aws-0-….pooler.supabase.com:5432/postgres\n\n' +
      'Option B — build from password + region:\n' +
      '  SUPABASE_DB_PASSWORD=<database password>\n' +
      '  SUPABASE_DB_REGION=eu-central-1   # from Connect host: aws-0-<region>.pooler…\n' +
      '  (keeps EXPO_PUBLIC_SUPABASE_URL as-is)\n\n' +
      'Schema check without DB login: npm run db:supabase:status'
  );
}

export function listNumberedMigrations() {
  return readdirSync(SUPABASE_DIR)
    .filter((name) => MIGRATION_RE.test(name))
    .sort((a, b) => {
      const na = Number(a.slice(0, 4));
      const nb = Number(b.slice(0, 4));
      return na - nb || a.localeCompare(b);
    })
    .map((filename) => ({
      id: filename.replace(/\.sql$/i, ''),
      filename,
      path: join(SUPABASE_DIR, filename),
    }));
}

export function nextMigrationNumber() {
  const migrations = listNumberedMigrations();
  if (migrations.length === 0) return 1;
  const max = Math.max(
    ...migrations.map((m) => Number(m.filename.slice(0, 4)))
  );
  return max + 1;
}

export function slugifyMigrationName(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'change';
}

export function readSqlFile(path) {
  return readFileSync(path, 'utf8');
}

export async function withPostgres(fn) {
  const postgres = (await import('postgres')).default;
  let sql;
  try {
    sql = postgres(getDatabaseUrl(), {
      max: 1,
      prepare: false,
      connect_timeout: 15,
      idle_timeout: 20,
    });
  } catch (err) {
    throw enrichDbError(err);
  }
  try {
    return await fn(sql);
  } catch (err) {
    throw enrichDbError(err);
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}

function enrichDbError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/ENOTFOUND|getaddrinfo|ECONNREFUSED/i.test(msg)) {
    return new Error(
      `${msg}\n\n` +
        'That Postgres host is unreachable from your Mac (common with db.<ref>.supabase.co).\n' +
        'Fix: Supabase → Database → Connect → Session mode → copy URI into SUPABASE_DB_URL.\n' +
        'Or skip CLI migrations — use SQL Editor + npm run db:supabase:status.'
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

export async function ensureMigrationsTable(sql) {
  await sql.unsafe(`
    create table if not exists public.relaxo_schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

export async function appliedMigrationIds(sql) {
  const rows = await sql`
    select id from public.relaxo_schema_migrations order by id
  `;
  return new Set(rows.map((r) => r.id));
}

export async function markMigrationApplied(sql, id) {
  await sql`
    insert into public.relaxo_schema_migrations (id)
    values (${id})
    on conflict (id) do nothing
  `;
}

export async function applySqlFile(sql, filePath, label) {
  const body = readSqlFile(filePath).trim();
  if (!body) {
    console.log(`  skip empty ${label}`);
    return;
  }
  console.log(`  → ${label}`);
  await sql.unsafe(body);
}
