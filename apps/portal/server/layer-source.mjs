// LAYER-SOURCE-01: a layer-scoped run may edit its own layer instance's repository. Edits stage per run; submission writes
// one Git commit on top of the pinned commit (kept at refs/aludel/candidates/<attempt>) without touching the checkout
// or the pin; acceptance advances the pin. Docs are guidance an elevated reviewer can accept. Files that run on the host
// or define the layer's authority need the project owner, whose acceptance records their exact bytes as reviewed, and the
// new rules must still accept every existing record of the layer.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { layerApiAt, normalizeRecord } from './layer-api.mjs';
import { packageAt } from './layer-package.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const maxFile = 200 * 1024, maxFiles = 40, maxDiff = 60 * 1024;
const writable = [/^knowledge\/[a-z0-9][a-z0-9-]*\.md$/, /^docs\/[a-z0-9][a-z0-9-]*\.md$/, /^(?:README|AGENTS)\.md$/, /^fixtures\/[a-z0-9][a-z0-9-]*\.(?:md|json)$/,
  /^api\/[a-z0-9][a-z0-9-]*\.json$/, /^server\/[a-z0-9][a-z0-9-]*\.mjs$/, /^ui\/[a-z0-9][a-z0-9-]*\.(?:ts|scss)$/, /^tests\/[a-z0-9][a-z0-9-]*\.test\.mjs$/, /^layer\.json$/];
// Files that run on the host or define what the layer may do.
export const authorityPath = path => /^(?:server|ui|api|tests)\//.test(path) || path === 'layer.json';
export const writablePatterns = ['knowledge/*.md', 'docs/*.md', 'README.md', 'AGENTS.md', 'fixtures/*.md|json', 'api/*.json (owner review)', 'server/*.mjs (owner review)',
  'ui/*.ts|scss (owner review)', 'tests/*.test.mjs (owner review)', 'layer.json (owner review)'];
const git = (repo, args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });

export function initLayerSource(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_source_drafts (attempt_id TEXT NOT NULL, path TEXT NOT NULL, project_id TEXT NOT NULL, layer_key TEXT NOT NULL,
    base_commit TEXT NOT NULL, content TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(attempt_id, path))`);
}

// The installed instance repository and its pinned commit.
export function layerBinding(db, projectId, key) {
  const row = db.prepare(`SELECT b.repository_path AS repo, b.accepted_commit AS "commit" FROM layer_package_bindings b
    JOIN layer_instances i ON i.project_id = b.project_id AND i.instance_id = b.layer_instance_id AND i.layer_key = b.layer_key
    WHERE b.project_id = ? AND b.layer_key = ?`).get(projectId, key);
  return row || fail('This layer has no installed repository.', 409);
}

const drafts = (db, attemptId) => db.prepare('SELECT path, content FROM layer_source_drafts WHERE attempt_id = ? ORDER BY path').all(attemptId);
const exists = (repo, commit, path) => { try { git(repo, ['cat-file', '-e', `${commit}:${path}`], { stdio: 'ignore' }); return true; } catch { return false; } };

// One call from a run: list, read, write or delete a file of its layer's repository, against the pinned commit plus its draft.
export function sourceCall(db, { projectId, key, attemptId, baseCommit, action, path = null, content = null }) {
  const { repo, commit } = layerBinding(db, projectId, key);
  if (commit !== baseCommit) fail(`The ${key} layer source changed. Authorize a fresh run.`, 409);
  const staged = new Map(drafts(db, attemptId).map(row => [row.path, row.content]));
  if (action === 'list') {
    const files = new Set(git(repo, ['ls-tree', '-r', '--name-only', commit]).split('\n').filter(Boolean));
    for (const [file, value] of staged) value === null ? files.delete(file) : files.add(file);
    return { files: [...files].sort().map(file => ({ path: file, staged: staged.has(file), writable: writable.some(pattern => pattern.test(file)), ownerReview: authorityPath(file) })) };
  }
  if (typeof path !== 'string' || path.length > 160 || path.includes('..') || path.startsWith('/') || path.startsWith('.git')) fail('Name a file inside the layer repository.');
  if (action === 'read') {
    if (staged.has(path)) return staged.get(path) === null ? fail('That file is deleted in this run.', 404) : { path, content: staged.get(path), staged: true };
    if (!exists(repo, commit, path)) fail('That file does not exist.', 404);
    const text = git(repo, ['show', `${commit}:${path}`]);
    if (text.length > maxFile) fail('That file is too large to read here.');
    return { path, content: text, staged: false };
  }
  if (!['write', 'delete'].includes(action)) fail('Use list, read, write or delete.');
  if (!writable.some(pattern => pattern.test(path))) fail(`A run may not change ${path}. Writable: ${writablePatterns.join(', ')}.`, 403);
  if (action === 'write' && (typeof content !== 'string' || content.length > maxFile || content.includes('\0'))) fail('Write text under 200 KB.');
  if (action === 'delete' && !exists(repo, commit, path) && !staged.has(path)) fail('That file does not exist.', 404);
  if (!staged.has(path) && staged.size >= maxFiles) fail(`A run may change at most ${maxFiles} files.`);
  db.prepare(`INSERT INTO layer_source_drafts VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(attempt_id, path) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`)
    .run(attemptId, path, projectId, key, commit, action === 'write' ? content : null, now());
  return { path, staged: action, ownerReview: authorityPath(path), draft: drafts(db, attemptId).map(row => ({ path: row.path, deleted: row.content === null })) };
}

export const hasSourceDraft = (db, attemptId) => Boolean(db.prepare('SELECT 1 FROM layer_source_drafts WHERE attempt_id = ? LIMIT 1').get(attemptId));

// Writes the draft as one commit on the pinned commit, retained under refs/aludel/candidates/<attempt>. Checks it statically:
// a valid layer package, and a layer API document that compiles. Nothing in it runs until the owner accepts it.
export function buildSourceCandidate(db, { projectId, key, attemptId, baseCommit, message }) {
  const { repo, commit } = layerBinding(db, projectId, key);
  if (commit !== baseCommit) fail(`The ${key} layer source changed. Authorize a fresh run.`, 409);
  const changes = drafts(db, attemptId);
  const scratch = mkdtempSync(join(tmpdir(), 'aludel-layer-index-'));
  const env = { ...process.env, GIT_INDEX_FILE: join(scratch, 'index'), GIT_AUTHOR_NAME: 'Aludel agent', GIT_AUTHOR_EMAIL: 'agent@aludel.invalid',
    GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' };
  let candidate;
  try {
    git(repo, ['read-tree', commit], { env });
    for (const change of changes) {
      if (change.content === null) git(repo, ['update-index', '--force-remove', change.path], { env });
      else {
        const blob = git(repo, ['hash-object', '-w', '--stdin'], { env, input: change.content }).trim();
        git(repo, ['update-index', '--add', '--cacheinfo', `100644,${blob},${change.path}`], { env });
      }
    }
    const tree = git(repo, ['write-tree'], { env }).trim();
    candidate = git(repo, ['commit-tree', tree, '-p', commit, '-m', String(message).slice(0, 500)], { env }).trim();
    git(repo, ['update-ref', `refs/aludel/candidates/${attemptId}`, candidate]);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  let pkg;
  try { pkg = packageAt(repo, candidate, key); } catch (error) { fail(`The changed layer is not a valid package: ${error.message}`); }
  if (pkg.manifest.api) try { layerApiAt(key, repo, candidate, pkg.manifest); } catch (error) { fail(`The changed layer API does not load: ${error.message}`); }
  const files = changes.map(change => {
    const before = exists(repo, commit, change.path);
    let diff = git(repo, ['diff', '--no-color', '--no-ext-diff', commit, candidate, '--', change.path]);
    if (diff.length > maxDiff) diff = diff.slice(0, maxDiff) + '\n… diff truncated';
    const lines = diff.split('\n');
    return { path: change.path, status: change.content === null ? 'deleted' : before ? 'modified' : 'added', ownerReview: authorityPath(change.path),
      added: lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).length, removed: lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length, diff };
  });
  return { commit: candidate, base: commit, files, ownerReview: files.some(file => file.ownerReview) };
}

// Inside the acceptance transaction: records owner review of changed host-run files, proves the new rules still accept
// every existing record of the layer, then advances the pin. Throws (rolling back) on any failure.
export function acceptSourceCandidate(db, { projectId, key, source, reviewer, owner, workId, catalogs, recordsOf }) {
  const { repo, commit } = layerBinding(db, projectId, key);
  if (commit !== source.base) fail(`The ${key} layer source changed since this was reviewed. Send it back.`, 409);
  if (git(repo, ['rev-parse', '--verify', `refs/aludel/candidates/${source.attempt}^{commit}`]).trim() !== source.commit) fail('The reviewed layer commit is missing.', 409);
  if (source.ownerReview && !owner) fail(`This run changes what the ${key} layer runs or may do. The project owner accepts it.`, 403);
  const pkg = packageAt(repo, source.commit, key);
  for (const file of source.files.filter(entry => entry.status !== 'deleted' && /^server\/.+\.mjs$/.test(entry.path)))
    db.prepare('INSERT OR IGNORE INTO layer_source_reviews VALUES (?, ?, ?, ?, ?, ?, ?)').run(projectId, key, file.path,
      createHash('sha256').update(git(repo, ['show', `${source.commit}:${file.path}`])).digest('hex'), reviewer, now(), workId);
  if (pkg.manifest.api) {
    const api = layerApiAt(key, repo, source.commit, pkg.manifest);
    for (const [kind] of api.records) for (const record of recordsOf(kind)) {
      try { normalizeRecord(api, kind, record.data, catalogs); }
      catch (error) { fail(`The changed ${key} rules reject the existing ${kind.replace('_', ' ')} “${record.data.title || record.data.label || record.id}”: ${error.message}`, 409); }
    }
  }
  db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ?').run(source.commit, projectId, key);
  return { commit: source.commit, repo };
}

// After the transaction commits: keep the instance checkout and a named ref on the accepted commit.
export function settleSourceCheckout(repo, commit) {
  try { git(repo, ['update-ref', 'refs/aludel/accepted', commit]); git(repo, ['checkout', '--quiet', '--detach', commit]); } catch { /* the pin is authoritative; a stale checkout is repaired on the next acceptance */ }
}
