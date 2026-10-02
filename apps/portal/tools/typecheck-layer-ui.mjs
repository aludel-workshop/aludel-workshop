// T03-DESIGN: type-checks one layer's own views at an exact commit against the host SDK, with Angular's template checks
// (ngc, the portal's app settings). The frame build compiles views but exits 0 with type errors in them (checked
// 2026-09-30), so run this for every template commit you pin. Usage: node tools/typecheck-layer-ui.mjs <repo> <commit>
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [repo, commit] = process.argv.slice(2);
if (!repo || !/^[0-9a-f]{7,40}$/.test(commit || '')) throw new Error('Usage: typecheck-layer-ui <repo> <commit>');
const portal = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
// The package sits at the repository root, or under .aludel/ in a repository that belongs to something else (T03-CODE).
const root = ['', '.aludel/'].find(prefix => { try { git('cat-file', '-e', `${commit}:${prefix}layer.json`); return true; } catch { return false; } }) ?? '';
const manifest = JSON.parse(git('show', `${commit}:${root}layer.json`).toString());
const files = (manifest.ui?.files || []).filter(path => /^ui\/[a-z][a-z0-9-]*\.ts$/.test(path));
if (!files.length) { console.log('No views to check.'); process.exit(0); }
// Staged beside the portal (git-ignored, like the frame build), so the host SDK's paths resolve as they do in a build.
const scratch = mkdtempSync(join(portal, '.layer-ui-src-tc-'));
try {
  mkdirSync(join(scratch, 'ui'));
  for (const path of files) writeFileSync(join(scratch, path), git('show', `${commit}:${root}${path}`));
  writeFileSync(join(scratch, 'tsconfig.json'), JSON.stringify({ extends: join(portal, 'tsconfig.app.json'),
    compilerOptions: { noEmit: true, rootDir: portal }, files: files.map(path => join(scratch, path)), include: [] }));
  const result = spawnSync(process.execPath, [join(portal, 'node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js'), '-p', join(scratch, 'tsconfig.json'), '--noEmit'],
    { cwd: portal, encoding: 'utf8' });
  if (result.status !== 0) { console.error(`${result.stdout}${result.stderr}`.trim()); process.exitCode = 1; }
  else console.log(`${manifest.key} views at ${commit.slice(0, 7)}: ${files.length} files type-check against the host SDK.`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
