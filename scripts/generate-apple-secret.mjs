#!/usr/bin/env node
/**
 * Generate Apple Sign In "Secret Key" JWT for Supabase Auth.
 *
 * Usage:
 *   node scripts/generate-apple-secret.mjs \
 *     --team-id=XXXXXXXXXX \
 *     --key-id=YYYYYYYYYY \
 *     --client-id=com.joseoliv.relaxo.auth \
 *     --p8=/absolute/path/to/AuthKey_XXXXXX.p8
 *
 * Then paste the printed JWT into:
 *   Supabase → Authentication → Providers → Apple → Secret Key
 *
 * Notes:
 * - client-id = Services ID for web OAuth (e.g. com.joseoliv.relaxo.auth)
 *   OR your App bundle id if that's what Supabase Client IDs use for native.
 * - JWT expires in ~180 days; regenerate before then for web OAuth.
 * - Keep the .p8 file offline — never commit it (already gitignored via *.p8).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importPKCS8, SignJWT } from 'jose';

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

function usageAndExit(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(`Usage:
  node scripts/generate-apple-secret.mjs \\
    --team-id=YOUR_TEAM_ID \\
    --key-id=YOUR_KEY_ID \\
    --client-id=YOUR_SERVICES_ID_OR_BUNDLE_ID \\
    --p8=/path/to/AuthKey_XXXXXX.p8
`);
  process.exit(1);
}

const teamId = arg('team-id') || process.env.APPLE_TEAM_ID || '';
const keyId = arg('key-id') || process.env.APPLE_KEY_ID || '';
const clientId = arg('client-id') || process.env.APPLE_CLIENT_ID || '';
const p8Path = arg('p8') || process.env.APPLE_P8_PATH || '';

if (!teamId) usageAndExit('Missing --team-id');
if (!keyId) usageAndExit('Missing --key-id');
if (!clientId) usageAndExit('Missing --client-id');
if (!p8Path) usageAndExit('Missing --p8');

const absoluteP8 = resolve(p8Path);
let pem;
try {
  pem = readFileSync(absoluteP8, 'utf8');
} catch (err) {
  const why = err instanceof Error ? err.message : String(err);
  usageAndExit(
    `Cannot read .p8 file at ${absoluteP8}\n  (${why})\n\n` +
      `If the file is in Downloads, copy it into the project first:\n` +
      `  cp ~/Downloads/YourAuthKey.p8 ./AuthKey.p8\n` +
      `  npm run generate:apple-secret -- ... --p8=./AuthKey.p8`
  );
}

if (!/BEGIN PRIVATE KEY/.test(pem)) {
  usageAndExit('File does not look like an Apple AuthKey .p8 (missing BEGIN PRIVATE KEY)');
}

const privateKey = await importPKCS8(pem, 'ES256');
const now = Math.floor(Date.now() / 1000);
// Apple allows max ~6 months; use 150 days for safety margin
const exp = now + 150 * 24 * 60 * 60;

const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', kid: keyId })
  .setIssuer(teamId)
  .setIssuedAt(now)
  .setExpirationTime(exp)
  .setAudience('https://appleid.apple.com')
  .setSubject(clientId)
  .sign(privateKey);

console.log('\n=== Paste this into Supabase Apple → Secret Key ===\n');
console.log(jwt);
console.log(`\nExpires: ${new Date(exp * 1000).toISOString()}`);
console.log('(Regenerate before this date if you use web/OAuth Apple sign-in.)\n');
