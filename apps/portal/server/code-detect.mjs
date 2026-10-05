// EX-02A C2: where a connected repository keeps its code. Nothing about the layout is assumed: folders with an app
// manifest are candidates, the root always is, and the person chooses. Each candidate says what Code would read there
// (its conventional source folders, or the whole folder when it has none) and how many files that is against Code's limit.
// A repository that already has .aludel/ says where its code is itself.
import { execFileSync } from 'node:child_process';
import { listSources, maxSourceFiles, treeAt } from './source-units.mjs';

const manifests = ['package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml', 'Gemfile', 'composer.json', 'pom.xml', 'build.gradle', 'deno.json'];
const kinds = { 'package.json': 'Node', 'deno.json': 'Deno', 'pyproject.toml': 'Python', 'requirements.txt': 'Python', 'go.mod': 'Go', 'Cargo.toml': 'Rust', Gemfile: 'Ruby', 'composer.json': 'PHP', 'pom.xml': 'Java', 'build.gradle': 'Java' };
const sourceDirs = ['src', 'server', 'app', 'lib', 'api', 'tests', 'test'];
const skipped = /(^|\/)(node_modules|vendor|dist|build|\.git|\.aludel)(\/|$)/;

const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const parent = path => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const inside = (folder, path) => !folder || path.startsWith(folder + '/');

// The globs Code would read for a folder: its conventional source folders, or everything under it.
export function folderGlobs(tree, folder) {
  const prefix = folder ? folder + '/' : '';
  const present = sourceDirs.filter(dir => tree.some(entry => entry.path.startsWith(`${prefix}${dir}/`)));
  return present.length ? present.map(dir => `${prefix}${dir}/**`) : [`${prefix}**`];
}

// What Code would read for a set of globs, against its limit.
export function countReads(tree, globs) {
  const reads = listSources(tree, globs).length;
  return { reads, limit: maxSourceFiles, over: reads > maxSourceFiles };
}

function framework(repo, commit, folder) {
  try {
    const pkg = JSON.parse(git(repo, ['show', `${commit}:${folder ? folder + '/' : ''}package.json`]));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [dep, label] of [['@angular/core', 'Angular'], ['next', 'Next.js'], ['react', 'React'], ['vue', 'Vue'], ['svelte', 'Svelte'], ['express', 'Express'], ['vite', 'Vite']]) if (deps?.[dep]) return label;
  } catch { /* not a Node app, or no readable package.json */ }
  return null;
}

export function detectCodeFolders(repo, commit) {
  const tree = treeAt(repo, commit);
  const blobs = tree.filter(entry => entry.type === 'blob');
  let existing = null;
  try {
    const manifest = JSON.parse(git(repo, ['show', `${commit}:.aludel/layer.json`]));
    existing = { units: Array.isArray(manifest.files?.units) ? manifest.files.units : [] };
  } catch { /* no .aludel/ yet */ }
  const found = new Map([['', new Set()]]);
  for (const entry of blobs) {
    const name = entry.path.split('/').pop();
    if (!manifests.includes(name) || skipped.test(entry.path)) continue;
    const folder = parent(entry.path);
    if (!found.has(folder)) found.set(folder, new Set());
    found.get(folder).add(name);
  }
  const folders = [...found].map(([path, names]) => {
    const files = blobs.filter(entry => inside(path, entry.path)).length;
    const dirs = sourceDirs.filter(dir => blobs.some(entry => entry.path.startsWith(`${path ? path + '/' : ''}${dir}/`)));
    const globs = folderGlobs(blobs, path);
    const stack = [...new Set([...names].map(name => kinds[name]))].filter(Boolean);
    const fw = names.has('package.json') ? framework(repo, commit, path) : null;
    return { path, root: !path, manifests: [...names].sort(), stack: fw ? [...stack, fw] : stack, files, dirs, globs, ...countReads(blobs, globs) };
  }).sort((a, b) => (a.root ? -1 : b.root ? 1 : a.path.localeCompare(b.path)));
  // Suggest the folder with an app manifest whose source Code would read most of, within the limit; the root when no
  // folder has one. A suggestion only: the person picks.
  const withApps = folders.filter(folder => folder.manifests.length && folder.reads && !folder.over);
  const best = withApps.sort((a, b) => b.reads - a.reads || a.path.split('/').length - b.path.split('/').length)[0] || folders.find(folder => folder.root);
  return {
    files: blobs.length, existing,
    // Code reads TypeScript and JavaScript today; a repository of other languages shows that rather than an empty Code.
    readsLanguages: 'TypeScript and JavaScript',
    folders: folders.map(folder => ({ ...folder, suggested: !existing && folder === best }))
  };
}
