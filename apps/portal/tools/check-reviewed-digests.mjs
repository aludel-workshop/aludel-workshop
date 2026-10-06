#!/usr/bin/env node
// W-33 #5: Aludel's close-out check (its project check in Settings › Repositories). Every layer template the portal pins
// (config/layer-templates.json) must run only reviewed code: each pinned template's API handler, and every file the host
// lists by digest (config/layer-reviewed-sources.json) that the pin contains, must have its exact bytes listed there.
// Runs from the repository's top, with the templates' repository beside it as a git clone (as close-out's sealed check
// workspace has it, and as an item container does): node apps/portal/tools/check-reviewed-digests.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const top = process.cwd();
const catalog = JSON.parse(readFileSync(resolve(top, 'apps/portal/config/layer-templates.json'), 'utf8'));
const reviewed = JSON.parse(readFileSync(resolve(top, 'apps/portal/config/layer-reviewed-sources.json'), 'utf8'));
const templates = resolve(top, catalog.repo);
const show = (commit, path) => { try { return execFileSync('git', ['-C', templates, 'show', `${commit}:${path}`], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 }); } catch { return null; } };
const problems = [];
let checked = 0;
for (const [name, { branch, commit }] of Object.entries(catalog.templates)) {
  const manifestBytes = show(commit, 'layer.json');
  if (!manifestBytes) { problems.push(`${name}: ${catalog.repo} has no layer.json at ${commit.slice(0, 12)} (${branch})`); continue; }
  const handler = JSON.parse(manifestBytes.toString('utf8')).api?.handler || null;
  const paths = new Set([...Object.keys(reviewed), ...(handler ? [handler] : [])]);
  for (const path of paths) {
    const bytes = show(commit, path);
    if (!bytes) { if (path === handler) problems.push(`${name}: its handler ${path} isn't at ${commit.slice(0, 12)}`); continue; }
    const digest = createHash('sha256').update(bytes).digest('hex');
    checked++;
    if (!reviewed[path]?.includes(digest)) problems.push(`${name} (${branch} at ${commit.slice(0, 12)}): ${path} ${digest} isn't listed in config/layer-reviewed-sources.json`);
  }
}
if (problems.length) { process.stderr.write(problems.join('\n') + '\n'); process.exit(1); }
process.stdout.write(`Every reviewed source the ${Object.keys(catalog.templates).length} pinned templates run is listed (${checked} files).\n`);
