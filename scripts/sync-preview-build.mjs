#!/usr/bin/env node
/**
 * Writes assets/latest-preview-build.json from the latest finished preview builds.
 * Run after `eas build` so Profile → Install latest build opens the QR-style install link.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../assets/latest-preview-build.json');

function fetchLatest(platform) {
  try {
    const raw = execFileSync(
      'npx',
      [
        'eas',
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
      { encoding: 'utf8', cwd: join(__dirname, '..') }
    );
    const builds = JSON.parse(raw);
    const build = builds[0];
    if (!build?.id) return null;
    return {
      buildId: build.id,
      artifactUrl: build.artifacts?.buildUrl ?? build.artifacts?.applicationArchiveUrl ?? null,
    };
  } catch {
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
