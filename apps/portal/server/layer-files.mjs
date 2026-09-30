// T03-G2 (DEC-059): repository-mode outputs. A layer may keep its output as files in its own repository instead of records
// in the project database. Its manifest names the files and a pure indexer (`files.indexer`, exporting `entries(files)`)
// that splits them into entries: stable IDs, kinds from the layer's outputs, a title and data. The host indexes the files
// at the accepted `main` commit into the Library, keeping integer revisions per entry across commits so references pin and
// go stale exactly as record references do. A person's edit commits straight to `main`; an agent's arrives as a reviewed
// branch (layer-source.mjs). Either way the new commit's files must index cleanly before `main` moves.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runPure, sourceReviewed } from './layer-api.mjs';
import { fileOutputs, outputPath, packageAt } from './layer-package.mjs';

export { fileOutputs, outputPath };

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const git = (repo, args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
export const entryId = /^[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]{1,62}$/;
const maxFileBytes = 512 * 1024, maxEntries = 2000;

export function initLayerFiles(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_file_entries (project_id TEXT NOT NULL, entry_id TEXT NOT NULL, revision INTEGER NOT NULL,
    layer_key TEXT NOT NULL, layer_instance_id TEXT NOT NULL, kind TEXT NOT NULL, content_hash TEXT, commit_sha TEXT NOT NULL, title TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, entry_id, revision));
    CREATE TABLE IF NOT EXISTS layer_file_syncs (project_id TEXT NOT NULL, layer_instance_id TEXT NOT NULL, commit_sha TEXT NOT NULL, PRIMARY KEY(project_id, layer_instance_id))`);
}

const read = (repo, commit, path) => {
  let text;
  try { text = git(repo, ['show', `${commit}:${path}`]); } catch { return null; }
  if (Buffer.byteLength(text) > maxFileBytes) fail(`${path} is larger than ${maxFileBytes / 1024} KB.`);
  return text;
};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// The entries at one commit. Commits are immutable, so the result is kept. The indexer runs only as reviewed bytes.
const indexes = new Map();
export function indexAt(db, projectId, key, repo, commit, { reviewed = true } = {}) {
  const cacheKey = `${repo}@${commit}`;
  if (indexes.has(cacheKey)) return indexes.get(cacheKey);
  const manifest = packageAt(repo, commit, key).manifest;
  const declared = fileOutputs(manifest);
  if (!declared) return null;
  const source = read(repo, commit, declared.indexer) ?? fail('The layer indexer is missing.', 500);
  const digest = createHash('sha256').update(source).digest('hex');
  if (reviewed && !sourceReviewed(db, projectId, key, declared.indexer, digest)) fail(`The ${key} indexer at this commit has not passed review.`, 409);
  const files = Object.fromEntries(declared.paths.map(path => [path, read(repo, commit, path)]).filter(([, text]) => text !== null));
  const entries = runPure(source, 'entries', [files, { kinds: declared.kinds }]);
  if (!Array.isArray(entries) || entries.length > maxEntries) fail('The layer indexer returned an invalid result.', 500);
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || !entryId.test(String(entry.id)) || seen.has(entry.id) || !declared.kinds.includes(entry.kind) || typeof entry.title !== 'string' || !entry.title.trim()
        || entry.title.length > 200 || !entry.data || typeof entry.data !== 'object') fail(`The layer indexer returned an invalid entry${entry?.id ? ` (${entry.id})` : ''}.`, 500);
    seen.add(entry.id);
  }
  const value = { commit, declared, entries: entries.map(entry => ({ id: entry.id, kind: entry.kind, title: entry.title.trim(), data: entry.data, hash: hash([entry.kind, entry.title, entry.data]) })) };
  indexes.set(cacheKey, value);
  return value;
}

const binding = (db, projectId, key) => db.prepare(`SELECT b.repository_path AS repo, b.accepted_commit AS "commit", i.instance_id AS instanceId FROM layer_package_bindings b
  JOIN layer_instances i ON i.project_id = b.project_id AND i.instance_id = b.layer_instance_id AND i.layer_key = b.layer_key WHERE b.project_id = ? AND b.layer_key = ?`).get(projectId, key);
const latest = (db, projectId, id) => db.prepare('SELECT * FROM layer_file_entries WHERE project_id = ? AND entry_id = ? ORDER BY revision DESC LIMIT 1').get(projectId, id);

// Brings the index up to the layer's pin: a changed entry gets its next revision, a removed one a tombstone revision.
export function syncFileEntries(db, projectId, key) {
  initLayerFiles(db);
  const bound = binding(db, projectId, key);
  if (!bound) return [];
  const index = indexAt(db, projectId, key, bound.repo, bound.commit);
  if (!index) return [];
  const insert = db.prepare('INSERT INTO layer_file_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const at = now(), present = new Set();
  for (const entry of index.entries) {
    present.add(entry.id);
    const last = latest(db, projectId, entry.id);
    if (last && last.layer_instance_id !== bound.instanceId && last.content_hash !== null) fail(`Entry ${entry.id} already belongs to another layer.`, 409);
    if (last?.content_hash === entry.hash) continue;
    insert.run(projectId, entry.id, (last?.revision || 0) + 1, key, bound.instanceId, entry.kind, entry.hash, bound.commit, entry.title, at);
  }
  for (const row of db.prepare(`SELECT e.* FROM layer_file_entries e WHERE e.project_id = ? AND e.layer_instance_id = ? AND e.revision = (
      SELECT MAX(revision) FROM layer_file_entries x WHERE x.project_id = e.project_id AND x.entry_id = e.entry_id) AND e.content_hash IS NOT NULL`).all(projectId, bound.instanceId))
    if (!present.has(row.entry_id)) insert.run(projectId, row.entry_id, row.revision + 1, key, bound.instanceId, row.kind, null, bound.commit, row.title, at);
  db.prepare('INSERT INTO layer_file_syncs VALUES (?, ?, ?) ON CONFLICT(project_id, layer_instance_id) DO UPDATE SET commit_sha = excluded.commit_sha').run(projectId, bound.instanceId, bound.commit);
  return currentFileEntries(db, projectId, key);
}

// This layer's current entries, with data, at its pin.
export function currentFileEntries(db, projectId, key) {
  initLayerFiles(db);
  const bound = binding(db, projectId, key);
  const index = bound && indexAt(db, projectId, key, bound.repo, bound.commit);
  if (!index) return [];
  // The pin moved since the index last looked (an install, a merge, a person's edit): catch up first.
  if (db.prepare('SELECT commit_sha FROM layer_file_syncs WHERE project_id = ? AND layer_instance_id = ?').get(projectId, bound.instanceId)?.commit_sha !== bound.commit)
    return syncFileEntries(db, projectId, key);
  const byId = new Map(index.entries.map(entry => [entry.id, entry]));
  return db.prepare(`SELECT * FROM layer_file_entries e WHERE e.project_id = ? AND e.layer_instance_id = ? AND e.content_hash IS NOT NULL AND e.revision = (
      SELECT MAX(revision) FROM layer_file_entries x WHERE x.project_id = e.project_id AND x.entry_id = e.entry_id)`).all(projectId, bound.instanceId)
    .filter(row => byId.has(row.entry_id))
    .map(row => ({ id: row.entry_id, kind: row.kind, title: row.title, revision: row.revision, updatedAt: row.created_at, data: byId.get(row.entry_id).data, layerKey: key, instanceId: row.layer_instance_id }));
}

// One entry, current or at a revision. Null when it never existed here; a deleted entry reads at its old revisions only.
export function fileEntry(db, projectId, id, revision = null) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_file_entries'").get() || !entryId.test(String(id))) return null;
  const last = latest(db, projectId, id);
  if (!last) return null;
  const row = revision === null ? last : db.prepare('SELECT * FROM layer_file_entries WHERE project_id = ? AND entry_id = ? AND revision = ?').get(projectId, id, revision);
  if (!row || row.content_hash === null) return null;
  const bound = binding(db, projectId, row.layer_key);
  if (!bound || bound.instanceId !== row.layer_instance_id) return null;
  const entry = indexAt(db, projectId, row.layer_key, bound.repo, row.commit_sha)?.entries.find(item => item.id === id);
  if (!entry) return null;
  return { id, kind: row.kind, title: entry.title, revision: row.revision, currentRevision: last.content_hash === null ? null : last.revision, data: entry.data,
    layerKey: row.layer_key, instanceId: row.layer_instance_id, commit: row.commit_sha };
}
// Whether a reference to a file entry resolves now, to one of these kinds.
export const fileEntryExists = (db, projectId, id, kinds) => { const entry = fileEntry(db, projectId, id); return !!entry && entry.currentRevision !== null && kinds.includes(entry.kind); };

// A declared output file's current text, for the layer's own editor.
export function readOutputFile(db, projectId, key, path) {
  const bound = binding(db, projectId, key) || fail('This layer has no installed repository.', 409);
  const declared = fileOutputs(packageAt(bound.repo, bound.commit, key).manifest) || fail('This layer keeps no output files.', 404);
  if (!declared.paths.includes(path)) fail('That is not one of this layer\'s output files.', 404);
  return { path, commit: bound.commit, content: read(bound.repo, bound.commit, path) ?? '' };
}

// A person's edit to an output file: one commit on `main`, applied at once when the files still index. `expectedCommit`
// guards against writing over a newer `main`.
export function commitOutputFile(db, { projectId, key, path, content, expectedCommit, author, message = null }) {
  if (typeof content !== 'string' || Buffer.byteLength(content) > maxFileBytes) fail(`An output file must be text under ${maxFileBytes / 1024} KB.`);
  const bound = binding(db, projectId, key) || fail('This layer has no installed repository.', 409);
  if (expectedCommit !== bound.commit) fail('This layer changed since you opened it. Reload and try again.', 409);
  const declared = fileOutputs(packageAt(bound.repo, bound.commit, key).manifest) || fail('This layer keeps no output files.', 404);
  if (!declared.paths.includes(path)) fail('That is not one of this layer\'s output files.', 404);
  const { repo, commit: main } = bound;
  if (git(repo, ['rev-parse', 'refs/heads/main']).trim() !== main) fail('The layer repository\'s main branch is not at its pin; reconcile it first.', 409);
  if (read(repo, main, path) === content) return { commit: main, entries: currentFileEntries(db, projectId, key), unchanged: true };
  const index = `${repo}/.git/aludel-index-${process.pid}-${Date.now()}`;
  const env = { ...process.env, GIT_INDEX_FILE: index, GIT_AUTHOR_NAME: String(author || 'Aludel').slice(0, 80), GIT_AUTHOR_EMAIL: 'person@aludel.invalid',
    GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' };
  let next;
  try {
    const blob = git(repo, ['hash-object', '-w', '--stdin'], { input: content }).trim();
    git(repo, ['read-tree', main], { env });
    git(repo, ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
    const tree = git(repo, ['write-tree'], { env }).trim();
    next = git(repo, ['commit-tree', tree, '-p', main, '-m', String(message || `Edit ${path}`).slice(0, 300)], { env }).trim();
  } finally { try { execFileSync('rm', ['-f', index]); } catch { /* none */ } }
  try { indexAt(db, projectId, key, repo, next); } catch (error) { fail(`The edited file does not index: ${error.message}`, error.status === 500 ? 400 : error.status); }
  const own = !db.isTransaction;
  if (own) db.exec('BEGIN IMMEDIATE');
  try {
    git(repo, ['update-ref', 'refs/heads/main', next, main]);
    db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ?').run(next, projectId, key);
    const entries = syncFileEntries(db, projectId, key);
    if (own) db.exec('COMMIT');
    try { if (!git(repo, ['status', '--porcelain']).trim()) git(repo, ['reset', '--quiet', '--hard', 'main']); } catch { /* the pin is authoritative */ }
    return { commit: next, entries };
  } catch (error) {
    if (own) db.exec('ROLLBACK');
    try { git(repo, ['update-ref', 'refs/heads/main', main, next]); } catch { /* main was not moved */ }
    throw error;
  }
}
