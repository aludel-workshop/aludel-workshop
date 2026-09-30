// Local LAT-T01 proof: compile the Pages UI from an exact layer repository commit.
// Repository content is input data; this script never executes repo scripts or follows paths from it.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const portal = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidate = resolve(portal, '../..');
const pin = JSON.parse(readFileSync(join(portal, 'config/layer-template-pins.json'), 'utf8')).pages;
if (!pin || !/^[0-9a-f]{40}$/.test(pin.commit) || typeof pin.repo !== 'string') throw new Error('Pages needs a pinned local repository commit.');
const repo = resolve(candidate, pin.repo);
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trimEnd();
if (git('rev-parse', '--verify', `${pin.commit}^{commit}`) !== pin.commit) throw new Error('Pages template commit is not available.');
const file = path => {
  if (typeof path !== 'string' || !/^ui\/[a-z][a-z0-9-]*\.(?:ts|scss)$/.test(path)) throw new Error(`Invalid Pages UI path: ${path}`);
  return execFileSync('git', ['-C', repo, 'show', `${pin.commit}:${path}`], { maxBuffer: 8 * 1024 * 1024 });
};
const manifest = JSON.parse(git('show', `${pin.commit}:layer.json`));
if (manifest.schemaVersion !== 1 || manifest.key !== 'pages' || manifest.ui?.entry !== 'ui/pages.ts' || !Array.isArray(manifest.ui.files)) throw new Error('Invalid Pages template manifest.');
const files = [...new Set(manifest.ui.files)];
if (files.length !== manifest.ui.files.length || !files.includes(manifest.ui.entry) || !files.includes('ui/pages.scss')) throw new Error('Incomplete Pages UI manifest.');
const target = join(portal, 'src/installed/pages');
const parent = dirname(target);
mkdirSync(parent, { recursive: true });
const staged = mkdtempSync(join(parent, '.pages-'));
try {
  for (const path of files) writeFileSync(join(staged, path.slice(3)), file(path));
  writeFileSync(join(staged, 'source.json'), JSON.stringify({ key: 'pages', commit: pin.commit, repo: pin.repo, tabs: manifest.tabs }, null, 2) + '\n');
  rmSync(target, { recursive: true, force: true });
  renameSync(staged, target);
} catch (error) { rmSync(staged, { recursive: true, force: true }); throw error; }
console.log(`Pages UI pinned at ${pin.commit.slice(0, 12)} from ${repo}`);
