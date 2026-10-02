// Code-owned repository read gateway for installed Work actions (DEC-054).
// A project binding and immutable commit are required on every read.
import { spawnSync } from 'node:child_process';
import { isAbsolute, posix, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { actionGrant, workActionMigration } from './lat08-migration.mjs';
import { compiledLocalActions } from './lat07-actions.mjs';

const fail = (message, status = 404) => { throw Object.assign(new Error(message), { status }); };
const blocked = /(^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|[^/]*\.(?:pem|key|p12|pfx|kdbx)|id_(?:rsa|ed25519)|(?:credentials|secrets?)\.(?:json|ya?ml|txt|env))$/i;
const sha = /^[0-9a-f]{40}$/;
const sizeLimit = 256 * 1024;
const run = (cwd, args, maxBuffer = 1024 * 1024) => spawnSync('git', args, { cwd, encoding: null, stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000, maxBuffer });

function readProjectSource(db, projectId, actionId, commit, path) {
  const binding = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId)?.workspace_path;
  if (!binding || !isAbsolute(binding) || !existsSync(resolve(binding, '.git'))) fail('Project repository is unavailable.');
  if (db.prepare('SELECT 1 FROM project_setup WHERE workspace_path = ? AND project_id <> ?').get(binding, projectId))
    fail('Repository binding is ambiguous.', 409);
  if (!sha.test(String(commit))) fail('Use an exact repository commit.', 400);
  const clean = String(path || '');
  if (!clean || clean.startsWith('/') || clean.includes('\\') || clean.includes('\0') ||
      posix.normalize(clean) !== clean || clean.split('/').some(part => !part || part === '..') || blocked.test(clean))
    fail('That file is not available.');
  const tree = run(binding, ['ls-tree', commit, '--', clean]);
  if (tree.status !== 0 || !tree.stdout.length) fail('That file is not in this project revision.');
  const line = tree.stdout.toString('utf8').trim();
  const match = /^100644 blob ([0-9a-f]{40})\t(.+)$/.exec(line) || /^100755 blob ([0-9a-f]{40})\t(.+)$/.exec(line);
  if (!match || match[2] !== clean) fail('That file is not available.'); // also rejects symlinks and submodules
  const bytes = run(binding, ['cat-file', 'blob', match[1]], sizeLimit + 1);
  if (bytes.status !== 0 || bytes.stdout.length > sizeLimit) fail('That file is too large.', 413);
  if (bytes.stdout.includes(0)) fail('That file is not text.', 415);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.stdout); } catch { fail('That file is not text.', 415); }
  return { projectId, actionId, commit, path: clean, blob: match[1], size: bytes.stdout.length, text };
}

export function readActionSource(db, actor, projectId, actionId, commit, path) {
  actionGrant(db, actor, projectId, actionId);
  return readProjectSource(db, projectId, actionId, commit, path);
}

export function readAttemptSource(db, scope, attemptId, path) {
  if (!scope?.projectId || !scope.profileId) fail('Worker scope is unavailable.', 403);
  const row = db.prepare(`SELECT a.work_id, a.state, b.content_json, w.assignee_id
    FROM symphony_attempts a JOIN symphony_bundles b ON b.digest = a.bundle_digest
    JOIN layer_work_items w ON w.id = a.work_id AND w.project_id = a.project_id
    WHERE a.id = ? AND a.project_id = ? AND a.profile_id = ?`).get(attemptId, scope.projectId, scope.profileId);
  if (!row || !['authorized', 'working'].includes(row.state) || row.assignee_id !== scope.profileId) fail('Current Go-pinned attempt required.', 403);
  const migration = workActionMigration(db, scope.projectId, row.work_id);
  const bundle = JSON.parse(row.content_json);
  if (!bundle.guidance?.layerAction || bundle.guidance.layerAction.id !== migration.action_id ||
      bundle.guidance.layerAction.revision !== migration.action_revision) fail('The pinned action changed.');
  return readProjectSource(db, scope.projectId, migration.action_id, bundle.repository.commit, path);
}

export function checkActionEffect(db, actor, projectId, actionId, effect, { path = null } = {}) {
  const action = actionGrant(db, actor, projectId, actionId);
  if (!action.permissions.effects.includes(effect)) fail('This action cannot perform that effect.', 403);
  if (path !== null) {
    const clean = String(path);
    if (!clean || clean.startsWith('/') || clean.includes('\\') || posix.normalize(clean) !== clean || clean.split('/').includes('..') || blocked.test(clean))
      fail('That file is not available.');
    if (!action.permissions.fileWrites.some(pattern => pattern === clean || pattern === '**' || pattern.endsWith('/**') && clean.startsWith(pattern.slice(0, -2))))
      fail('This action cannot write that path.', 403);
  }
  return action;
}

// Candidate writes need the Go-pinned action, effect and every changed path.
// Older isolated test fixtures without LAT-08 tables retain their historical adapter checks.
export function checkPinnedActionEffect(db, projectId, workId, effect, paths = [], baseCommit = null) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_work_migration'").get()) return null;
  const migration = workActionMigration(db, projectId, workId);
  const action = compiledLocalActions.find(entry => entry.id === migration.action_id && entry.revision === migration.action_revision);
  if (!action?.agentRunnable || !action.permissions.effects.includes(effect)) fail('This pinned action cannot perform that effect.', 403);
  const attempt = db.prepare(`SELECT a.state, b.content_json, batch.authorized_at
    FROM symphony_attempts a JOIN symphony_bundles b ON b.digest = a.bundle_digest
    JOIN agent_batches batch ON batch.id = a.batch_id AND batch.project_id = a.project_id
    WHERE a.project_id = ? AND a.work_id = ? ORDER BY a.created_at DESC LIMIT 1`).get(projectId, workId);
  if (!attempt?.authorized_at || !['authorized', 'working', 'submitted'].includes(attempt.state)) fail('A current Go-pinned attempt is required.', 403);
  const bundle = JSON.parse(attempt.content_json);
  if (bundle.guidance?.layerAction?.id !== action.id || bundle.guidance.layerAction.revision !== action.revision ||
      bundle.work?.id !== workId || baseCommit && bundle.repository?.commit !== baseCommit) fail('The pinned action or repository revision changed.');
  for (const path of paths) {
    const clean = String(path);
    if (!clean || clean.startsWith('/') || clean.includes('\\') || posix.normalize(clean) !== clean ||
        clean.split('/').some(part => !part || part === '..') || blocked.test(clean) ||
        !action.permissions.fileWrites.some(pattern => pattern === clean || pattern === '**' || pattern.endsWith('/**') && clean.startsWith(pattern.slice(0, -2))))
      fail(`This action cannot write ${clean}.`, 403);
  }
  return action;
}
