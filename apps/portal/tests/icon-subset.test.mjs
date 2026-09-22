import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const read = path => readFileSync(join(root, path), 'utf8');

// A name missing from the subset renders as its literal text, which screenshots have caught only by chance.
test('every literal icon name used by the portal is in the committed font subset', () => {
  const { icons } = JSON.parse(read('src/icon-subset.json'));
  const used = new Set();
  for (const file of readdirSync(join(root, 'src'))) {
    if (!/\.(html|ts)$/.test(file) || file.endsWith('.stories.ts')) continue;
    for (const [, name] of read(`src/${file}`).matchAll(/<mat-icon[^>]*>\s*([a-z0-9_]+)\s*<\/mat-icon>/g)) used.add(name);
  }
  for (const file of readdirSync(join(root, 'config'))) {
    for (const [, name] of read(`config/${file}`).matchAll(/"icon":\s*"([a-z0-9_]+)"/g)) used.add(name);
  }
  const missing = [...used].filter(name => !icons.includes(name));
  assert.deepEqual(missing, [], 'Run python3 tools/subset-icons.py to rebuild src/material-symbols-rounded-subset.ttf');
});
