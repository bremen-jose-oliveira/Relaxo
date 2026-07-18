#!/usr/bin/env node
/**
 * Apply pending Supabase SQL migrations (numbered supabase/NNNN_*.sql).
 *
 *   npm run db:supabase:status       # check live API schema (no DB password)
 *   npm run db:supabase              # apply pending via Postgres (needs password)
 *   npm run db:supabase -- --fresh   # NEW project: schema.sql + stamp migrations
 *
 * Prefer SQL Editor if you don’t have SUPABASE_DB_PASSWORD.
 */
import { join } from 'node:path';
import {
  SUPABASE_DIR,
  applySqlFile,
  appliedMigrationIds,
  ensureMigrationsTable,
  listNumberedMigrations,
  markMigrationApplied,
  withPostgres,
} from './supabase-lib.mjs';

const args = new Set(process.argv.slice(2));
const wantFresh = args.has('--fresh');

if (args.has('--status')) {
  console.error('Use: npm run db:supabase:status  (checks via API, no DB password)');
  process.exit(1);
}

async function main() {
  const migrations = listNumberedMigrations();

  await withPostgres(async (sql) => {
    await ensureMigrationsTable(sql);

    if (wantFresh) {
      console.log('Fresh install: applying schema.sql…');
      await applySqlFile(sql, join(SUPABASE_DIR, 'schema.sql'), 'schema.sql');
      await markMigrationApplied(sql, 'schema');
      for (const m of migrations) {
        await markMigrationApplied(sql, m.id);
        console.log(`  stamped ${m.filename} (included in schema.sql)`);
      }
      console.log('\nDone. Cloud schema is ready.');
      return;
    }

    const applied = await appliedMigrationIds(sql);
    const pending = migrations.filter((m) => !applied.has(m.id));
    if (pending.length === 0) {
      console.log('No pending Supabase migrations.');
      return;
    }

    console.log(`Applying ${pending.length} migration(s)…`);
    for (const m of pending) {
      await applySqlFile(sql, m.path, m.filename);
      await markMigrationApplied(sql, m.id);
      console.log(`  ✓ ${m.filename}`);
    }
    console.log('\nDone.');
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
