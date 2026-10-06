#!/usr/bin/env node
// Runs only the server test files a change can affect, for the inner development loop. The full suite with templates on
// (`npm run test:server:templates`) stays the gate at handoff.
//
// A test file is affected when it changed, or when it reaches a changed file through what it references. Modules count
// static and dynamic imports and `new URL('…', import.meta.url)` (config they read); a path merely named in a module is
// data, not a dependency. Tests also count any path literal, such as '../server/server.mjs' (a portal started as a child
// process) or '../config' (a directory: everything in it). Paths resolve against the referencing file's folder and
// against apps/portal, where spawned processes run. A file that changed outside apps/portal (other than
// docs) can't be traced, so the script says to run the full suite.
//
//   node tools/test-affected.mjs [--base <ref> | --files a,b] [--list] [--standard] [--concurrency <n>]
//     --base      compare with this ref (default: the merge base with origin/main); uncommitted and untracked files count
//     --list      print the selection and why, without running it
//     --files     suppose only these files (relative to apps/portal) changed, instead of reading git
//     --standard  run with layer templates off (default: on, as the launcher runs)
//     --concurrency  run at most n test files at once (default: Node's, one per CPU); lower it where memory is short
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const portal = resolve(dirname(new URL(import.meta.url).pathname), '..');
const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: portal, encoding: 'utf8' }).trim();
const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1]; };
const git = (...parts) => execFileSync('git', parts, { cwd: top, encoding: 'utf8' }).trim();

let base = option('--base');
if (!base) { try { base = git('merge-base', 'HEAD', 'origin/main'); } catch { base = 'HEAD'; } }
const supposed = option('--files');
const changed = new Set(supposed ? supposed.split(',').filter(Boolean).map(path => resolve(portal, path)) : [
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n')
].filter(Boolean).map(path => join(top, path)));
if (supposed) base = 'the named files';

const portalPrefix = portal + '/';
const outside = [...changed].filter(path => !path.startsWith(portalPrefix) && !/^docs\/|\.md$/.test(relative(top, path)));
const inside = [...changed].filter(path => path.startsWith(portalPrefix));

// Every source file the tests can reach: modules, tests, tools and config. The UI (src/) is checked by browser journeys.
const skip = new Set(['node_modules', 'dist', 'test-results', '.angular', 'src']);
const files = [];
(function walk(folder) {
  for (const name of readdirSync(folder)) {
    if (skip.has(name) || name.startsWith('.')) continue;
    const path = join(folder, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(mjs|js|json)$/.test(name)) files.push(path);
  }
})(portal);

// Edges: file → the files it references.
const path = '((?:\\.{1,2}\\/|server\\/|tools\\/|config\\/|tests\\/)[\\w./@-]*)';
const moduleRefs = new RegExp(`(?:from\\s*|import\\s*\\(\\s*|new URL\\(\\s*)['"\`]${path}['"\`]`, 'g');
const testRefs = new RegExp(`['"\`]${path}['"\`]`, 'g');
const resolveAll = (file, literal) => {
  const out = new Set();
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(literal)) {
    for (const from of [dirname(file), portal]) {
      const target = resolve(from, spec.replace(/\/$/, ''));
      if (!target.startsWith(portalPrefix) || !existsSync(target)) continue;
      if (statSync(target).isDirectory()) { for (const each of files) if (each.startsWith(target + '/')) out.add(each); }
      else out.add(target);
    }
  }
  out.delete(file);
  return out;
};
const refs = new Map();
for (const file of files.filter(path => /\.(mjs|js)$/.test(path))) refs.set(file, resolveAll(file, /\/tests\/[^/]+\.mjs$/.test(file) ? testRefs : moduleRefs));

// Walk back from the changed files: every file that reaches one, with the next step towards it (for the reason shown).
const users = new Map();
for (const [file, out] of refs) for (const target of out) {
  if (!users.has(target)) users.set(target, []);
  users.get(target).push(file);
}
const toward = new Map([...changed].map(file => [file, null]));
const queue = [...changed];
while (queue.length) {
  const file = queue.shift();
  for (const user of users.get(file) || []) if (!toward.has(user)) { toward.set(user, file); queue.push(user); }
}
const chainOf = file => { const chain = [file]; while (toward.get(chain.at(-1))) chain.push(toward.get(chain.at(-1))); return chain; };
const tests = files.filter(path => /\/tests\/[^/]+\.test\.mjs$/.test(path)).sort();
const selected = tests.filter(test => toward.has(test)).map(test => [test, chainOf(test)]);

const show = path => relative(portal, path);
if (outside.length) console.log(`Changed outside apps/portal, not traced (run the full suite before handoff):\n  ${outside.map(path => relative(top, path)).join('\n  ')}`);
if (inside.some(path => path.startsWith(join(portal, 'src') + '/'))) console.log('The UI (src/) changed: run the affected browser journeys too.');
console.log(`${selected.length} of ${tests.length} test files affected since ${/^[0-9a-f]{40}$/.test(base) ? base.slice(0, 12) : base}:`);
for (const [test, chain] of selected) console.log(`  ${show(test)}${chain.length > 1 ? `  ← ${chain.slice(1).map(show).join(' ← ')}` : ' (changed)'}`);
if (args.includes('--list') || !selected.length) process.exit(0);

const env = { ...process.env, ...(args.includes('--standard') ? {} : { MACHINE_LAYER_TEMPLATES_ENABLED: '1' }) };
const concurrency = option('--concurrency');
if (concurrency !== null && !/^[1-9]\d*$/.test(concurrency)) { console.error('--concurrency takes a whole number.'); process.exit(2); }
const run = spawnSync(process.execPath, ['--import', './tests/isolate-data.mjs', '--test', '--test-timeout=300000', ...(concurrency ? [`--test-concurrency=${concurrency}`] : []), ...selected.map(([test]) => show(test))], { cwd: portal, env, stdio: 'inherit' });
process.exit(run.status ?? 1);
