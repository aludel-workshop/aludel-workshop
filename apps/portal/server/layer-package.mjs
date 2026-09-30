// LAT-T01 local package proof. Configured templates are cloned into private project data;
// only exact, validated commits supply declarations and Knowledge. Repository scripts never run here.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const portal = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidate = resolve(portal, '../..');
const keyPattern = /^[a-z][a-z0-9_]{2,31}$/;
const enabled = () => process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1' || process.env.MACHINE_PAGES_TEMPLATE_ENABLED === '1';
const configured = key => {
  if (!enabled()) return null;
  if (!keyPattern.test(key)) throw new Error('Invalid layer package key.');
  const pin = JSON.parse(readFileSync(join(portal, 'config/layer-template-pins.json'), 'utf8'))[key];
  if (!pin) return null;
  if (!/^[0-9a-f]{40}$/.test(pin.commit) || typeof pin.repo !== 'string') throw new Error('Layer template pin is invalid.');
  return { commit: pin.commit, repo: resolve(candidate, pin.repo) };
};
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 }).trimEnd();
const projectRoot = (projectId,key) => join(resolve(process.env.MACHINE_DATA_DIR || join(portal, '.data')), 'layer-repos', createHash('sha256').update(projectId).digest('hex').slice(0, 20), key);
const content = (repo, commit, path) => {
  if (typeof path !== 'string' || !/^(?:knowledge|ui)\/[a-z][a-z0-9-]*\.(?:md|ts|scss)$/.test(path)) throw new Error(`Invalid layer package path: ${path}`);
  return execFileSync('git', ['-C', repo, 'show', `${commit}:${path}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
};
export function initLayerPackages(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_package_bindings (
    project_id TEXT NOT NULL REFERENCES projects(id), layer_key TEXT NOT NULL,
    repository_path TEXT NOT NULL, accepted_commit TEXT NOT NULL, installed_at TEXT NOT NULL,
    PRIMARY KEY(project_id,layer_key)
  )`);
}
function binding(db, projectId, key) {
  initLayerPackages(db);
  const row = db.prepare('SELECT repository_path AS repo, accepted_commit AS acceptedCommit FROM layer_package_bindings WHERE project_id=? AND layer_key=?').get(projectId,key);
  return row ? { repo: row.repo, commit: row.acceptedCommit } : null;
}
function packageAt(repo, commit, key) {
  if (!/^[0-9a-f]{40}$/.test(commit) || git(repo, 'rev-parse', '--verify', `${commit}^{commit}`) !== commit) throw new Error('Layer package commit is unavailable.');
  const manifest = JSON.parse(git(repo, 'show', `${commit}:layer.json`));
  const tabs = manifest.tabs;
  if (manifest.schemaVersion !== 1 || manifest.hostSdkVersion !== 1 || manifest.key !== key || typeof manifest.name !== 'string' || !manifest.name.trim()
      || typeof manifest.path !== 'string' || !/^\/[a-z][a-z0-9-]*$/.test(manifest.path)
      || !['knowledge_records','code_projection','runtime_projection'].includes(manifest.authority)
      || typeof manifest.outputProvider !== 'string' || typeof manifest.editorAdapter !== 'string'
      || !Array.isArray(manifest.outputs) || !manifest.outputs.length || !manifest.outputs.every(kind => typeof kind === 'string' && /^[a-z][a-z0-9_]*$/.test(kind))
      || !Array.isArray(tabs) || !tabs.length || new Set(tabs.map(tab => tab.key)).size !== tabs.length
      || !tabs.every(tab => /^[a-z][a-z0-9-]*$/.test(tab.key) && typeof tab.label === 'string' && tab.label.trim().length > 0 && tab.label.length <= 40)
      || !manifest.knowledge || !Array.isArray(manifest.knowledge.documents)) throw new Error('Invalid layer package manifest.');
  const charter = content(repo, commit, manifest.knowledge.charter);
  if (charter.length > 20000) throw new Error('Layer charter is too large.');
  return { manifest, charter, repo, commit };
}
export function ensureLayerPackage(db, projectId, key) {
  const pin = configured(key);
  if (!pin) return null;
  const existing = binding(db, projectId, key);
  if (existing) return packageAt(existing.repo, existing.commit, key);
  const target = projectRoot(projectId,key);
  if (existsSync(target)) throw new Error('Unbound layer repository exists; reconcile it before installing.');
  mkdirSync(dirname(target), { recursive: true });
  const staging = mkdtempSync(join(dirname(target), `.${key}-`));
  try {
    rmSync(staging, { recursive: true, force: true });
    execFileSync('git', ['clone', '--quiet', '--no-hardlinks', '--local', pin.repo, staging], { stdio: 'pipe' });
    if (git(staging, 'rev-parse', '--verify', `${pin.commit}^{commit}`) !== pin.commit) throw new Error('Layer pin is absent from the template repository.');
    execFileSync('git', ['-C', staging, 'checkout', '--quiet', '--detach', pin.commit], { stdio: 'pipe' });
    const pkg = packageAt(staging, pin.commit, key);
    renameSync(staging, target);
    db.prepare('INSERT INTO layer_package_bindings(project_id,layer_key,repository_path,accepted_commit,installed_at) VALUES (?,?,?,?,?)')
      .run(projectId,key,target,pin.commit,new Date().toISOString());
    return { ...pkg, repo: target };
  } catch (error) { rmSync(staging, { recursive: true, force: true }); throw error; }
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
    const markdown = content(pkg.repo, pkg.commit, path).trim();
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
    const markdown = content(pkg.repo, pkg.commit, path);
    if (markdown.length > 8000) throw new Error('Layer task document is too large.');
    return { path, markdown };
  });
  return { key, commit: pkg.commit, charter: pkg.charter, documents };
}
