// LAT-T01 local package proof. Configured templates are cloned into private project data;
// only exact, validated commits supply declarations and Knowledge. Repository scripts never run here.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAdapters, validateFacets, validateRefers } from './bindings.mjs';
import { flatten, validateInformation } from './information.mjs';

const portal = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidate = resolve(portal, '../..');
const keyPattern = /^[a-z][a-z0-9_]{2,31}$/;
const enabled = () => process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1' || process.env.MACHINE_PAGES_TEMPLATE_ENABLED === '1';
// LAYER-BASE-01: one base layer repository; templates are its branches, each pinned to a commit here. Built-in layers
// name their template; a layer added later chooses one. Every installed instance is a fork of its template.
const catalog = () => JSON.parse(readFileSync(join(portal, 'config/layer-templates.json'), 'utf8'));
export const layerTemplates = () => enabled() ? Object.keys(catalog().templates) : [];
const configured = (key, template = null) => {
  if (!enabled()) return null;
  if (!keyPattern.test(key)) throw new Error('Invalid layer package key.');
  const config = catalog();
  const name = template || config.builtIn[key];
  const pin = name && config.templates[name];
  if (!pin) return null;
  if (!/^[0-9a-f]{40}$/.test(pin.commit) || typeof config.repo !== 'string') throw new Error('Layer template pin is invalid.');
  return { template: name, branch: pin.branch, commit: pin.commit, repo: resolve(candidate, config.repo) };
};
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 }).trimEnd();
const projectRoot = (projectId,instanceId) => join(resolve(process.env.MACHINE_DATA_DIR || join(portal, '.data')), 'layer-repos', createHash('sha256').update(projectId).digest('hex').slice(0, 20), instanceId);
const content = (repo, commit, path, root = '') => {
  if (typeof path !== 'string' || !/^(?:knowledge|ui)\/[a-z][a-z0-9-]*\.(?:md|ts|scss)$/.test(path)) throw new Error(`Invalid layer package path: ${path}`);
  return execFileSync('git', ['-C', repo, 'show', `${commit}:${root}${path}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
};
// T03-CODE (G-CODE): a repository holds its layer package at the root, or under `.aludel/` when the repository belongs to
// something else (the app, for Code). Every path a manifest names is relative to that package root.
export const packageRoots = ['', '.aludel/'];
export function packageRootAt(repo, commit) {
  for (const root of packageRoots) {
    try { execFileSync('git', ['-C', repo, 'cat-file', '-e', `${commit}:${root}layer.json`], { stdio: 'ignore' }); return root; } catch { /* not here */ }
  }
  throw new Error('Layer package has no layer.json.');
}
// A file the package names, read at its commit from under the package root.
export const packageFile = (pkg, path, options = {}) => execFileSync('git', ['-C', pkg.repo, 'show', `${pkg.commit}:${pkg.root || ''}${path}`], { encoding: 'utf8', maxBuffer: 1024 * 1024, ...options });
export function initLayerPackages(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_package_bindings (
    project_id TEXT NOT NULL REFERENCES projects(id), layer_key TEXT NOT NULL, layer_instance_id TEXT,
    repository_path TEXT NOT NULL, accepted_commit TEXT NOT NULL, installed_at TEXT NOT NULL,
    PRIMARY KEY(project_id,layer_key)
  )`);
  const columns = new Set(db.prepare('PRAGMA table_info(layer_package_bindings)').all().map(row => row.name));
  if (!columns.has('layer_instance_id')) db.exec('ALTER TABLE layer_package_bindings ADD COLUMN layer_instance_id TEXT');
  // LAYER-BASE-01: the template branch and commit an instance was forked from, for later template updates.
  for (const column of ['template', 'template_commit']) if (!columns.has(column)) db.exec(`ALTER TABLE layer_package_bindings ADD COLUMN ${column} TEXT`);
  // T03-CODE: when a file layer's install seed ran, so it runs once per instance.
  if (!columns.has('seeded_at')) db.exec('ALTER TABLE layer_package_bindings ADD COLUMN seeded_at TEXT');
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='layer_instances'").get()) return;
  db.exec(`UPDATE layer_package_bindings SET layer_instance_id = (
    SELECT instance_id FROM layer_instances WHERE layer_instances.project_id = layer_package_bindings.project_id
      AND layer_instances.layer_key = layer_package_bindings.layer_key
  ) WHERE layer_instance_id IS NULL`);
  const invalid = db.prepare(`SELECT 1 FROM layer_package_bindings b LEFT JOIN layer_instances i
    ON i.project_id=b.project_id AND i.instance_id=b.layer_instance_id AND i.layer_key=b.layer_key
    WHERE i.instance_id IS NULL LIMIT 1`).get();
  if (invalid) throw new Error('Layer package binding has no matching instance; reconcile before startup.');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_layer_package_instance ON layer_package_bindings(project_id,layer_instance_id)');
}
function instanceId(db, projectId, key) {
  const row = db.prepare('SELECT instance_id FROM layer_instances WHERE project_id=? AND layer_key=?').get(projectId,key);
  if (!row?.instance_id) throw new Error('Layer package requires an installed instance.');
  return row.instance_id;
}
function binding(db, projectId, key) {
  initLayerPackages(db);
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='layer_instances'").get()) return null;
  const rowId = db.prepare('SELECT instance_id FROM layer_instances WHERE project_id=? AND layer_key=?').get(projectId,key);
  if (!rowId) return null;
  const row = db.prepare('SELECT repository_path AS repo, accepted_commit AS acceptedCommit FROM layer_package_bindings WHERE project_id=? AND layer_instance_id=? AND layer_key=?').get(projectId,rowId.instance_id,key);
  return row ? { repo: row.repo, commit: row.acceptedCommit } : null;
}
// T03-G2 (DEC-059): a manifest's repository-mode outputs: exact paths under outputs/, the kinds they hold and the pure
// indexer that splits them into Library entries. Null when it declares none.
export const outputPath = /^outputs\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\.(?:json|md|ya?ml)$/;
// T03-CODE (G-CODE): `files.repository` names the repository's own files, outside the package root, that are this layer's
// output (Code's is the codebase). Globs relative to the repository root: `*` within a folder, `**` across folders.
const repositoryGlob = /^(?:\*\*|[A-Za-z0-9_.*-]+)(?:\/(?:\*\*|[A-Za-z0-9_.*-]+))*\/?$/;
export function fileOutputs(manifest) {
  const files = manifest?.files;
  if (files === undefined) return null;
  if (!files || !Array.isArray(files.paths) || files.paths.length > 20 || !files.paths.every(path => typeof path === 'string' && outputPath.test(path))
      || !files.paths.length && !files.repository
      || new Set(files.paths).size !== files.paths.length || !Array.isArray(files.kinds) || !files.kinds.length || !files.kinds.every(kind => manifest.outputs.includes(kind))
      || typeof files.indexer !== 'string' || !/^server\/[a-z][a-z0-9-]*\.mjs$/.test(files.indexer)
      || files.repository !== undefined && (!Array.isArray(files.repository) || !files.repository.length || files.repository.length > 20
        || !files.repository.every(glob => typeof glob === 'string' && repositoryGlob.test(glob) && !glob.split('/').includes('..')))
      // `units`: globs of source files the host parses into code units for the indexer (G-CODE host index library).
      || files.units !== undefined && (!files.repository || !Array.isArray(files.units) || !files.units.length || files.units.length > 20
        || !files.units.every(glob => typeof glob === 'string' && repositoryGlob.test(glob) && !glob.split('/').includes('..')))
      // `seeds`: host events the indexer's seed(event, context) answers with starting files (T03-CODE: Code's starter docs).
      || files.seeds !== undefined && (!Array.isArray(files.seeds) || !files.seeds.every(event => event === 'install'))) throw new Error('Invalid layer file outputs.');
  return { paths: files.paths, kinds: files.kinds, indexer: files.indexer, repository: files.repository || [], units: files.units || [], seeds: files.seeds || [] };
}
const globPattern = glob => new RegExp(`^${glob.replace(/\/$/, '/**').split('/').map(part => part === '**' ? '\u0000' : part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('/')
  .replace(/\u0000\//g, '(?:.*/)?').replace(/\/\u0000/g, '(?:/.*)?').replace(/\u0000/g, '.*')}$`);
export const matchesGlob = (glob, path) => globPattern(glob).test(path);
// The package's own files a run may change, relative to its root, and the ones review marks because they run on the host
// or define what the layer may do.
const ownWritable = [/^knowledge\/[a-z0-9][a-z0-9-]*\.md$/, /^docs\/[a-z0-9][a-z0-9-]*\.md$/, /^(?:README|AGENTS)\.md$/, /^fixtures\/[a-z0-9][a-z0-9-]*\.(?:md|json)$/,
  /^api\/[a-z0-9][a-z0-9-]*\.json$/, /^outputs\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\.(?:json|md|ya?ml)$/, /^server\/[a-z0-9][a-z0-9-]*\.mjs$/, /^ui\/[a-z0-9][a-z0-9-]*\.(?:ts|scss)$/, /^tests\/[a-z0-9][a-z0-9-]*\.test\.mjs$/, /^layer\.json$/, /^\.gitignore$/];
export const ownWritablePatterns = ['knowledge/*.md', 'docs/*.md', 'README.md', 'AGENTS.md', 'fixtures/*.md|json', 'api/*.json', 'outputs/**/*.json|md|yaml', 'server/*.mjs', 'ui/*.ts|scss', 'tests/*.test.mjs', 'layer.json', '.gitignore'];
const ownAuthority = path => /^(?:server|ui|api|tests)\//.test(path) || path === 'layer.json';
// Never a layer's output, whatever a manifest says: environment files (secrets), Git's own files, and CI workflows.
const neverWritable = path => path.split('/').some(part => /^\.env(?:\..*)?$/.test(part)) || /^\.git(?:\/|$)/.test(path) || /^\.github\/workflows\//.test(path);
// Which repository paths belong to the package, which a run may change, and which review marks.
export function repositoryPaths(pkg) {
  const root = pkg.root || '';
  const own = path => !root ? path : path.startsWith(root) ? path.slice(root.length) : null;
  const outside = root ? fileOutputs(pkg.manifest)?.repository || [] : [];
  const writable = path => {
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.split('/').includes('..') || neverWritable(path)) return false;
    const inside = own(path);
    return inside !== null ? ownWritable.some(pattern => pattern.test(inside)) : outside.some(glob => matchesGlob(glob, path));
  };
  const authority = path => { const inside = own(path); return inside !== null && ownAuthority(inside); };
  const patterns = [...ownWritablePatterns.map(pattern => root + pattern), ...outside.map(glob => `${glob} (not ${root}, .env*, .github/workflows/)`)];
  return { root, own, writable, authority, patterns };
}
// Why a layer that lives in the project's repository isn't installed yet (an uncommitted change, say), for its views to show.
const waiting = new Map();
export const layerInstallWaiting = (projectId, key) => waiting.get(`${projectId}:${key}`) || null;
// Commits are immutable, so a validated package at one is kept.
const packages = new Map();
// The editor tabs a layer's contents can be edited in: its own, plus the host adapter's (a Markdown layer's Files).
export const editorTabs = manifest => [...(manifest.tabs || []).map(tab => tab.key), ...(manifest.editorAdapter === 'markdown-editor' ? ['files'] : [])];
export function packageAt(repo, commit, key) {
  const cacheKey = `${repo}@${commit}#${key}`;
  if (!packages.has(cacheKey)) { const value = readPackage(repo, commit, key); packages.set(cacheKey, value); return value; }
  return packages.get(cacheKey);
}
function readPackage(repo, commit, key) {
  if (!/^[0-9a-f]{40}$/.test(commit) || git(repo, 'rev-parse', '--verify', `${commit}^{commit}`) !== commit) throw new Error('Layer package commit is unavailable.');
  const root = packageRootAt(repo, commit);
  const manifest = JSON.parse(git(repo, 'show', `${commit}:${root}layer.json`));
  const tabs = manifest.tabs;
  // A base layer may start with no outputs and no tabs of its own; the host still provides Tasks, Knowledge and Manage.
  if (manifest.schemaVersion !== 1 || manifest.hostSdkVersion !== 1 || manifest.key !== key || typeof manifest.name !== 'string' || !manifest.name.trim()
      || typeof manifest.path !== 'string' || !/^\/[a-z][a-z0-9-]*$/.test(manifest.path)
      || !['knowledge_records','code_projection','runtime_projection'].includes(manifest.authority)
      || typeof manifest.outputProvider !== 'string' || typeof manifest.editorAdapter !== 'string'
      || !Array.isArray(manifest.outputs) || !manifest.outputs.every(kind => typeof kind === 'string' && /^[a-z][a-z0-9_]*$/.test(kind))
      || !Array.isArray(tabs) || new Set(tabs.map(tab => tab.key)).size !== tabs.length
      || !tabs.every(tab => /^[a-z][a-z0-9-]*$/.test(tab.key) && typeof tab.label === 'string' && tab.label.trim().length > 0 && tab.label.length <= 40)
      || !manifest.knowledge || !Array.isArray(manifest.knowledge.documents)) throw new Error('Invalid layer package manifest.');
  // DEC-057: a package may opt into layer-scoped Work; the host adapter registry still bounds its change kinds.
  if (manifest.work !== undefined && (manifest.work?.scope !== 'layer' || manifest.work.changes !== undefined &&
      (!Array.isArray(manifest.work.changes) || !manifest.work.changes.every(kind => manifest.outputs.includes(kind))))) throw new Error('Invalid layer Work scope.');
  // PAGES-API-01: the layer's API document and handler module; the host loads and reviews them separately.
  if (manifest.api !== undefined && !['spec', 'handler'].every(field => typeof manifest.api?.[field] === 'string' && /^(?:api|server)\/[a-z][a-z0-9-]*\.(?:json|mjs)$/.test(manifest.api[field])))
    throw new Error('Invalid layer API declaration.');
  // T03-DESIGN-SEED: host events the handler's seed(event, context) answers.
  if (manifest.api?.seeds !== undefined && (!Array.isArray(manifest.api.seeds) || !manifest.api.seeds.every(event => ['install', 'look'].includes(event))))
    throw new Error('Invalid layer seed events.');
  fileOutputs(manifest);
  // LAYER-BINDINGS-01: the facets the layer maintains and the binding roles each supports.
  validateFacets(manifest);
  validateAdapters(manifest);
  validateRefers(manifest);
  // LAYER-KNOWLEDGE-01: the layer's information as a spec; each part's doc must be in the package.
  for (const node of flatten(validateInformation(manifest, { tabs: editorTabs(manifest) }))) if (node.doc) content(repo, commit, node.doc, root);
  // T03-CODE: a template whose repository is the project's own (Code's is the app's codebase) installs into it under .aludel/.
  if (manifest.install !== undefined && (manifest.install !== 'project-repository' || !fileOutputs(manifest)?.repository.length)) throw new Error('Invalid layer install target.');
  if (manifest.hostCalls !== undefined && (!Array.isArray(manifest.hostCalls) || manifest.hostCalls.length > 20 || !manifest.hostCalls.every(name => typeof name === 'string' && /^[a-z][A-Za-z0-9]{1,40}$/.test(name))))
    throw new Error('Invalid layer host calls.');
  const charter = content(repo, commit, manifest.knowledge.charter, root);
  if (charter.length > 20000) throw new Error('Layer charter is too large.');
  // Pure server contracts are declared and pinned here, but never executed by package loading.
  const changes = manifest.server?.semanticChanges || {};
  if (Object.keys(changes).some(name => !/^[a-z][a-zA-Z0-9]*$/.test(name))) throw new Error('Invalid layer semantic change key.');
  for (const declaration of Object.values(changes)) {
    if (declaration?.schemaVersion !== 1 || declaration.mode !== 'pure-candidate' ||
        typeof declaration.entry !== 'string' || !/^server\/[a-z][a-z0-9-]*\.mjs$/.test(declaration.entry))
      throw new Error('Invalid layer semantic change source.');
    const source = git(repo, 'show', `${commit}:${root}${declaration.entry}`);
    if (!source || source.length > 40000) throw new Error('Layer semantic change source is unavailable or too large.');
  }
  return { manifest, charter, repo, commit, root };
}
// Forks the layer's template into this instance's own repository. Its `main` starts at the template commit; an install
// commit makes the manifest this instance's (key, name, path) when they differ. `main` is what the host builds and serves.
export function ensureLayerPackage(db, projectId, key, { template = null, name = null, path = null, charter = null } = {}) {
  const pin = configured(key, template);
  if (!pin) return null;
  const existing = binding(db, projectId, key);
  if (existing) return packageAt(existing.repo, existing.commit, key);
  // A layer that lives in the project's repository waits for that repository, and is installed into it (one commit on main).
  if (JSON.parse(git(pin.repo, 'show', `${pin.commit}:layer.json`)).install === 'project-repository') {
    let workspace = null;
    try { workspace = db.prepare('SELECT workspace_path AS path FROM project_setup WHERE project_id = ?').get(projectId)?.path; } catch { /* no project setup here: no repository yet */ }
    if (!workspace || !existsSync(join(workspace, '.git'))) return null;
    try { const installed = installLayerPackageInto(db, projectId, key, workspace, { template: pin.template, name, path }); waiting.delete(`${projectId}:${key}`); return installed; }
    catch (error) { if (error.status === 409) { waiting.set(`${projectId}:${key}`, error.message); return null; } throw error; }
  }
  const id = instanceId(db, projectId, key);
  const target = projectRoot(projectId,id);
  if (existsSync(target)) {
    // A failed outer SQLite transaction can leave the exact clean template clone while rolling back its binding.
    // Rebind only that known source/pin; any changed or unknown repository still needs explicit reconciliation.
    let recoverable = false;
    try { recoverable = git(target, 'rev-parse', 'refs/heads/main') === pin.commit &&
      git(target, 'config', '--get', 'remote.template.url') === pin.repo && !git(target, 'status', '--porcelain'); } catch { /* unknown repository */ }
    if (!recoverable) throw new Error('Unbound layer repository exists; reconcile it before installing.');
    const pkg = packageAt(target, pin.commit, key);
    db.prepare('INSERT INTO layer_package_bindings(project_id,layer_key,layer_instance_id,repository_path,accepted_commit,installed_at,template,template_commit) VALUES (?,?,?,?,?,?,?,?)')
      .run(projectId,key,id,target,pin.commit,new Date().toISOString(),pin.template,pin.commit);
    return { ...pkg, repo: target };
  }
  mkdirSync(dirname(target), { recursive: true });
  const staging = mkdtempSync(join(dirname(target), `.${key}-`));
  try {
    rmSync(staging, { recursive: true, force: true });
    execFileSync('git', ['clone', '--quiet', '--no-hardlinks', '--local', '--origin', 'template', pin.repo, staging], { stdio: 'pipe' });
    if (git(staging, 'rev-parse', '--verify', `${pin.commit}^{commit}`) !== pin.commit) throw new Error('Layer pin is absent from the template repository.');
    execFileSync('git', ['-C', staging, 'checkout', '--quiet', '-B', 'main', pin.commit], { stdio: 'pipe' });
    const manifest = JSON.parse(git(staging, 'show', `${pin.commit}:layer.json`));
    const own = { ...manifest, key, name: name || manifest.name, path: path || (manifest.key === key ? manifest.path : `/${key.replace(/_/g, '-')}`) };
    // An existing layer brings its own charter into its new repository.
    const ownCharter = typeof charter === 'string' && charter.trim() && charter !== git(staging, 'show', `${pin.commit}:${manifest.knowledge.charter}`) ? charter : null;
    if (own.key !== manifest.key || own.name !== manifest.name || own.path !== manifest.path || ownCharter) {
      writeFileSync(join(staging, 'layer.json'), JSON.stringify(own, null, 2) + '\n');
      if (ownCharter) writeFileSync(join(staging, manifest.knowledge.charter), ownCharter.endsWith('\n') ? ownCharter : ownCharter + '\n');
      execFileSync('git', ['-C', staging, 'commit', '--quiet', '-am', `Install ${own.name} as ${key} from the ${pin.template} template`],
        { stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'Aludel', GIT_AUTHOR_EMAIL: 'aludel@aludel.invalid', GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' } });
    }
    const head = git(staging, 'rev-parse', 'HEAD');
    const pkg = packageAt(staging, head, key);
    renameSync(staging, target);
    db.prepare('INSERT INTO layer_package_bindings(project_id,layer_key,layer_instance_id,repository_path,accepted_commit,installed_at,template,template_commit) VALUES (?,?,?,?,?,?,?,?)')
      .run(projectId,key,id,target,head,new Date().toISOString(),pin.template,pin.commit);
    return { ...pkg, repo: target };
  } catch (error) { rmSync(staging, { recursive: true, force: true }); throw error; }
}
// T03-CODE (G-CODE): installs a layer into a repository that already exists and belongs to something else (Code's is the
// app). The template's package is copied under `.aludel/` as one commit on `main`; the template's history is kept as a ref
// (`refs/aludel/template`), not as the repository's history. A working tree with uncommitted changes is refused rather than
// committing someone else's edits. A repository that already holds this layer's package is bound as it is.
const installRoot = '.aludel/';
export function installLayerPackageInto(db, projectId, key, repo, { template = null, name = null, path = null, author = 'Aludel', replace = false } = {}) {
  const pin = configured(key, template);
  if (!pin) throw Object.assign(new Error('Layer templates are not enabled for this layer.'), { status: 409 });
  const id = instanceId(db, projectId, key);
  const existing = db.prepare('SELECT repository_path AS repo FROM layer_package_bindings WHERE project_id = ? AND layer_key = ?').get(projectId, key);
  if (existing && existing.repo !== repo && !replace) throw Object.assign(new Error('This layer already has a repository. Adopt it into the new one explicitly.'), { status: 409 });
  const run = (args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options }).trimEnd();
  let head;
  try { head = run(['rev-parse', '--verify', 'refs/heads/main^{commit}']); } catch { throw Object.assign(new Error('The repository has no main branch with a commit yet.'), { status: 409 }); }
  let branch = null;
  try { branch = run(['symbolic-ref', '--quiet', 'HEAD']); } catch { /* detached */ }
  if (branch !== 'refs/heads/main') throw Object.assign(new Error('Check out main in the repository first.'), { status: 409 });
  if (run(['status', '--porcelain', '--untracked-files=all'])) throw Object.assign(new Error('The repository has uncommitted changes. Commit or discard them first; Aludel won\'t commit someone else\'s work.'), { status: 409 });
  let commit = head;
  let present = null;
  for (const root of packageRoots) { try { run(['cat-file', '-e', `${head}:${root}layer.json`]); present = root; break; } catch { /* not here */ } }
  if (present === '') throw Object.assign(new Error('This repository is a layer repository; install it as one rather than into it.'), { status: 409 });
  if (present === null) {
    // Bring the template commit in, then build the install commit with a scratch index: the app's tree plus the package.
    run(['fetch', '--quiet', '--no-tags', pin.repo, `+${pin.commit}:refs/aludel/template`]);
    if (run(['rev-parse', 'refs/aludel/template']) !== pin.commit) throw new Error('Layer pin is absent from the template repository.');
    const manifest = JSON.parse(run(['show', `${pin.commit}:layer.json`]));
    const own = { ...manifest, key, name: name || manifest.name, path: path || (manifest.key === key ? manifest.path : `/${key.replace(/_/g, '-')}`) };
    const scratch = mkdtempSync(join(repo, '.git', 'aludel-install-'));
    const env = { ...process.env, GIT_INDEX_FILE: join(scratch, 'index'), GIT_AUTHOR_NAME: String(author).slice(0, 80), GIT_AUTHOR_EMAIL: 'person@aludel.invalid', GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' };
    try {
      run(['read-tree', head], { env });
      run(['read-tree', `--prefix=${installRoot}`, pin.commit], { env });
      const blob = run(['hash-object', '-w', '--stdin'], { input: JSON.stringify(own, null, 2) + '\n' });
      run(['update-index', '--cacheinfo', `100644,${blob},${installRoot}layer.json`], { env });
      const tree = run(['write-tree'], { env });
      commit = run(['commit-tree', tree, '-p', head, '-m', `Add the ${own.name} layer in ${installRoot} from the ${pin.template} template\n\nAludel-Template: ${pin.template} ${pin.commit}`], { env });
    } finally { rmSync(scratch, { recursive: true, force: true }); }
    packageAt(repo, commit, key);
    run(['merge', '--ff-only', '--quiet', commit]);
  }
  const pkg = packageAt(repo, commit, key);
  db.prepare(`INSERT INTO layer_package_bindings(project_id,layer_key,layer_instance_id,repository_path,accepted_commit,installed_at,template,template_commit) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(project_id,layer_key) DO UPDATE SET layer_instance_id = excluded.layer_instance_id, repository_path = excluded.repository_path, accepted_commit = excluded.accepted_commit,
      installed_at = excluded.installed_at, template = excluded.template, template_commit = excluded.template_commit`)
    .run(projectId, key, id, repo, commit, new Date().toISOString(), pin.template, pin.commit);
  return { ...pkg, installed: present === null };
}
// Built-in layers that live in the project's repository install once that repository exists (after the first build, say).
export function ensureProjectRepositoryLayers(db, projectId) {
  if (!enabled()) return [];
  const config = catalog(), installed = [];
  for (const [key, template] of Object.entries(config.builtIn)) {
    const pin = config.templates[template];
    let manifest;
    try { manifest = JSON.parse(git(resolve(candidate, config.repo), 'show', `${pin.commit}:layer.json`)); } catch { continue; }
    if (manifest.install !== 'project-repository' || !db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, key)) continue;
    const pkg = ensureLayerPackage(db, projectId, key);
    if (!pkg) continue;
    db.prepare('UPDATE layer_definitions SET output_tabs_json = ?, package_commit = ? WHERE project_id = ? AND layer_key = ? AND built_in = 1 AND package_commit IS NULL')
      .run(JSON.stringify(pkg.manifest.tabs), pkg.commit, projectId, key);
    installed.push(key);
  }
  return installed;
}
// The host features an installed layer's views may use. Forks pinned before templates declared `hostCalls` keep what their
// template's views already relied on, keyed by the template they were forked from, until a template update reaches them.
const hostCallsBefore = { pages: ['pageChanges', 'skeleton'], vision: ['documents'] };
export function layerHostCalls(db, projectId, key) {
  let pkg;
  try { pkg = layerPackageForProject(db, projectId, key); } catch { return []; }
  if (!pkg) return [];
  if (Array.isArray(pkg.manifest.hostCalls)) return pkg.manifest.hostCalls;
  const template = db.prepare('SELECT template FROM layer_package_bindings WHERE project_id = ? AND layer_key = ?').get(projectId, key)?.template;
  return hostCallsBefore[template] || [];
}
export function layerPackageForProject(db, projectId, key) {
  const installed = binding(db, projectId, key);
  return installed ? packageAt(installed.repo, installed.commit, key) : null;
}
export function pagesPackageForProject(db, projectId) { return layerPackageForProject(db,projectId,'pages'); }
export function pagesPackageDocuments(db, projectId) {
  const pkg = pagesPackageForProject(db, projectId);
  if (!pkg) return null;
  const mapping = { 'map-output':['outputs','map'], 'page-output':['outputs','page'], 'flow-output':['outputs','flow'], 'page-method':['methods','page-method'], 'flow-method':['methods','flow-method'] };
  return pkg.manifest.knowledge.documents.map(path => {
    const name = /^knowledge\/([a-z][a-z0-9-]*)\.md$/.exec(path)?.[1];
    const entry = mapping[name];
    if (!entry) throw new Error('Unsupported Pages Knowledge document.');
    const markdown = content(pkg.repo, pkg.commit, path, pkg.root).trim();
    const title = /^# (.+)$/m.exec(markdown)?.[1];
    if (!title || markdown.length > 8000) throw new Error('Invalid Pages Knowledge document.');
    return [entry[0],entry[1],title,markdown];
  });
}

// Immutable, task-facing layer source. Keep content small and pinned; it cannot grant effects.
export function layerPackageTaskContext(db, projectId, key) {
  const pkg = layerPackageForProject(db, projectId, key);
  if (!pkg) return null;
  const documents = pkg.manifest.knowledge.documents.map(path => {
    const markdown = content(pkg.repo, pkg.commit, path, pkg.root);
    if (markdown.length > 8000) throw new Error('Layer task document is too large.');
    return { path, markdown };
  });
  const paths = repositoryPaths(pkg);
  return { key, instanceId: instanceId(db, projectId, key), commit: pkg.commit, root: paths.root, writable: paths.patterns, charter: pkg.charter, documents };
}
