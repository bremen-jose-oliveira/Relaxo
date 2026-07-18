#!/usr/bin/env node
/**
 * Create the next numbered Supabase migration when the cloud schema changes.
 *
 *   npm run db:supabase:new -- add_foo_column
 *
 * Then:
 *   1. Edit the new supabase/NNNN_….sql (incremental ALTER / CREATE)
 *   2. Mirror the same change into supabase/schema.sql (for fresh installs)
 *   3. npm run db:supabase
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SUPABASE_DIR,
  nextMigrationNumber,
  slugifyMigrationName,
} from './supabase-lib.mjs';

const rawName = process.argv.slice(2).join(' ').trim();
if (!rawName || rawName.startsWith('-')) {
  console.error('Usage: npm run db:supabase:new -- <short_name>');
  console.error('Example: npm run db:supabase:new -- add_partner_notes');
  process.exit(1);
}

const n = String(nextMigrationNumber()).padStart(4, '0');
const slug = slugifyMigrationName(rawName);
const filename = `${n}_${slug}.sql`;
const path = join(SUPABASE_DIR, filename);

const template = `-- ${filename}
-- Incremental cloud schema change. After editing:
--   1. Mirror the same change into schema.sql (new projects)
--   2. npm run db:supabase

begin;

-- TODO: write idempotent SQL (IF NOT EXISTS / DROP … IF EXISTS where possible)

commit;
`;

writeFileSync(path, template, 'utf8');

console.log(`Created ${path}`);
console.log(`
Next steps:
  1. Put your ALTER/CREATE SQL in that file (keep it idempotent if you can)
  2. Update supabase/schema.sql so a fresh install matches
  3. Apply:  npm run db:supabase
  4. Status: npm run db:supabase -- --status
`);
