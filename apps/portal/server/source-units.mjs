// T03-CODE (G-CODE): the host's index library. It knows source code, not layers: given a repository's files at a commit
// it returns code units (top-level functions, classes, components, consts, routes, HTTP handlers, SQL tables and tests),
// their references and what is reachable from the entry files and tests. A layer that asks for units in its manifest
// (`files.units`, globs) gets them in its pure indexer as `entries(files, { units })`. Parsing needs the TypeScript parser,
// which a pure indexer cannot import; that is why the host does it.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, posix } from 'node:path';
import { extractUnits } from './code-units.mjs';
import { matchesGlob } from './layer-package.mjs';

const fileLimit = 256 * 1024, maxFiles = 2000;
const sourceFile = path => /\.(ts|mjs|js)$/.test(path) && !path.endsWith('.d.ts') && !path.split('/').some(part => ['node_modules', 'dist', '.data', '.git'].includes(part));
export const defaultEntries = ['src/main.ts', 'server/server.mjs'];
const isTestFile = path => /(^|\/)tests?\/|\.(test|spec)\.[cm]?[jt]s$/.test(path);
const declarationKinds = new Set(['function', 'class', 'component', 'const']);

// Units from source text: `{ path: text }` in, units with stable keys (`path#symbol`, numbered when repeated) out.
export function indexSources(sources, { entries = defaultEntries } = {}) {
  const files = Object.keys(sources).sort();
  const parsed = new Map(files.map(path => [path, extractUnits(path, sources[path])]));
  const all = [];
  for (const [path, { units }] of parsed) {
    const seen = new Map();
    for (const unit of units) {
      const count = (seen.get(unit.symbol) || 0) + 1; seen.set(unit.symbol, count);
      unit.key = `${path}#${unit.symbol}${count > 1 ? ` (${count})` : ''}`; unit.path = path;
      all.push(unit);
    }
  }
  const resolve = (from, specifier) => {
    const base = posix.join(dirname(from).split('\\').join('/'), specifier);
    return [base, `${base}.ts`, `${base}.mjs`, `${base}.js`, `${base}/index.ts`, base.replace(/\.js$/, '.ts')].find(candidate => parsed.has(candidate)) || null;
  };
  const topLevel = (path, name) => parsed.get(path)?.units.find(unit => unit.parent === null && unit.name === name && declarationKinds.has(unit.kind)) || null;
  const tables = new Map(all.filter(unit => unit.kind === 'table').map(unit => [unit.table.toLowerCase(), unit]));
  const target = (path, name) => {
    const local = topLevel(path, name);
    if (local) return local;
    const imported = parsed.get(path).imports.get(name);
    const file = imported && resolve(path, imported.from);
    return file ? topLevel(file, imported.name) : null;
  };
  const edges = unit => {
    const out = new Set();
    for (const name of unit.refs) { const found = target(unit.path, name); if (found && found !== unit) out.add(found); }
    for (const name of unit.sql) { const found = tables.get(name.toLowerCase()); if (found && found !== unit) out.add(found); }
    for (const child of parsed.get(unit.path).units.filter(item => item.parent !== null && parsed.get(unit.path).units[item.parent] === unit)) out.add(child);
    return [...out];
  };
  for (const unit of all) unit.calls = edges(unit);
  // Roots: file-level code of entry files (and what it references), file-level non-declarations there, and every test.
  const roots = new Set();
  for (const path of files) {
    if (!entries.includes(path) && !isTestFile(path)) continue;
    const { units, residual } = parsed.get(path);
    for (const unit of units) if (unit.parent === null && (!declarationKinds.has(unit.kind) || unit.kind === 'test')) roots.add(unit);
    for (const unit of units) if (unit.kind === 'test') roots.add(unit);
    for (const name of residual.names) { const found = target(path, name); if (found) roots.add(found); }
  }
  const reachable = new Set();
  const queue = [...roots];
  while (queue.length) { const unit = queue.pop(); if (reachable.has(unit)) continue; reachable.add(unit); queue.push(...unit.calls); }
  return all.map(unit => ({ key: unit.key, path: unit.path, symbol: unit.symbol, kind: unit.kind, hash: unit.hash, line: unit.startLine, end: unit.endLine, reachable: reachable.has(unit), calls: unit.calls.map(item => item.key) }));
}

// The source files a set of globs selects at one commit, read from Git (not the working tree), within the size limit.
// `.env` files never match: they are never source.
// The tracked files at a commit, with their blob, size and path.
export function treeAt(repo, commit) {
  return execFileSync('git', ['-C', repo, 'ls-tree', '-r', '-z', '--long', commit], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0').filter(Boolean).map(line => { const [meta, path] = line.split('\t'); const [, type, object, size] = meta.split(/\s+/); return { type, object, size: Number(size), path }; });
}
// The tree entries that are source a set of globs selects (without the size limit check): what Code would read.
export function listSources(tree, globs, { exclude = null } = {}) {
  return tree.filter(entry => entry.type === 'blob' && entry.size <= fileLimit && sourceFile(entry.path) && !/(^|\/)\.env/.test(entry.path)
    && (!exclude || !entry.path.startsWith(exclude)) && globs.some(glob => matchesGlob(glob, entry.path)));
}
export const maxSourceFiles = maxFiles;
export function sourcesAt(repo, commit, globs, { exclude = null } = {}) {
  const listed = listSources(treeAt(repo, commit), globs, { exclude });
  if (listed.length > maxFiles) throw Object.assign(new Error(`More than ${maxFiles} source files match; narrow the layer's units globs.`), { status: 413 });
  if (!listed.length) return {};
  // One `cat-file --batch` for every blob.
  const out = execFileSync('git', ['-C', repo, 'cat-file', '--batch'], { input: listed.map(entry => entry.object).join('\n') + '\n', maxBuffer: 256 * 1024 * 1024 });
  const sources = {};
  let at = 0;
  for (const entry of listed) {
    const header = out.indexOf(0x0a, at);
    const size = Number(out.subarray(at, header).toString('utf8').split(' ')[2]);
    sources[entry.path] = out.subarray(header + 1, header + 1 + size).toString('utf8');
    at = header + 1 + size + 1;
  }
  return sources;
}

// Units at a commit, cached by commit (commits never change). `idOf(key)` gives each unit its stable ID.
const cache = new Map();
export function unitsAt(repo, commit, globs, { idOf = key => `cu-${createHash('sha256').update(key).digest('hex').slice(0, 12)}`, exclude = null, entries } = {}) {
  const cacheKey = `${repo}@${commit}#${globs.join(',')}#${exclude || ''}`;
  if (!cache.has(cacheKey)) cache.set(cacheKey, indexSources(sourcesAt(repo, commit, globs, { exclude }), { entries }));
  return cache.get(cacheKey).map(unit => ({ id: idOf(unit.key), ...unit }));
}
