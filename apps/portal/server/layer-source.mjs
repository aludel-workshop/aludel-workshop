// LAYER-SOURCE-01 / LAYER-BASE-01 B5: a layer-scoped run works on its layer instance's repository in its own sandbox.
// The run's workspace gets the instance repository at the pinned `main` on a work branch, plus a copy of the layer's current
// outputs to test against. The host commits the branch for the agent (the sandbox's .git is read-only), fetches it into
// the instance repository as `work/<ref>-<attempt>`, and records the agent's test results. Accepting the review merges the
// branch into `main`: the merged layer must be a valid package whose rules still accept every existing record, and the
// exact bytes of changed host-run files are recorded as reviewed. Review is always an elevated person's (DEC-057).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { layerApiAt, normalizeRecord } from './layer-api.mjs';
import { ownWritablePatterns, packageAt, repositoryPaths } from './layer-package.mjs';
import { indexAt, syncFileEntries } from './layer-files.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const maxFiles = 40, maxDiff = 60 * 1024;
// What a run may change and what review marks come from the package at the run's base (layer-package `repositoryPaths`):
// the package's own files under its root, plus the repository files its manifest declares as output (T03-CODE).
export const writablePatterns = ownWritablePatterns;
const git = (repo, args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
const agentIdentity = { GIT_AUTHOR_NAME: 'Aludel agent', GIT_AUTHOR_EMAIL: 'agent@aludel.invalid', GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' };
const validTests = tests => Array.isArray(tests) && tests.length <= 200 && tests.every(entry => entry && typeof entry.name === 'string' && entry.name.trim() && entry.name.length <= 200 &&
  ['passed', 'failed', 'skipped'].includes(entry.status) && (entry.detail === undefined || typeof entry.detail === 'string' && entry.detail.length <= 2000));

export function initLayerSource(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_work_branches (attempt_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, layer_key TEXT NOT NULL, branch TEXT NOT NULL,
    base TEXT NOT NULL, commit_sha TEXT NOT NULL, files_json TEXT NOT NULL, tests_json TEXT NOT NULL, created_at TEXT NOT NULL)`);
}

// The installed instance repository and its pinned commit (its `main`).
export function layerBinding(db, projectId, key) {
  const row = db.prepare(`SELECT b.repository_path AS repo, b.accepted_commit AS "commit" FROM layer_package_bindings b
    JOIN layer_instances i ON i.project_id = b.project_id AND i.instance_id = b.layer_instance_id AND i.layer_key = b.layer_key
    WHERE b.project_id = ? AND b.layer_key = ?`).get(projectId, key);
  return row || fail('This layer has no installed repository.', 409);
}
export const workBranchName = (workRef, attemptId) => `work/${String(workRef).toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${attemptId.slice(4, 12)}`;

// A Git bundle of the instance repository at the run's base, for the sandbox to clone without reaching the host's files.
export function layerBundle(db, { projectId, key, base, attemptId }) {
  const { repo, commit } = layerBinding(db, projectId, key);
  if (commit !== base) fail(`The ${key} layer source changed. Authorize a fresh run.`, 409);
  const scratch = mkdtempSync(join(tmpdir(), 'aludel-layer-bundle-'));
  const ref = `refs/aludel/base/${attemptId}`;
  try {
    git(repo, ['update-ref', ref, base]);
    git(repo, ['bundle', 'create', '--quiet', join(scratch, 'layer.bundle'), ref], { stdio: 'pipe' });
    return readFileSync(join(scratch, 'layer.bundle'));
  } finally { try { git(repo, ['update-ref', '-d', ref]); } catch { /* already gone */ } rmSync(scratch, { recursive: true, force: true }); }
}

// Commits the sandbox's layer checkout for the agent, fetches it into the instance repository as the run's work branch and
// checks it statically. Nothing in it runs until the review is accepted.
export function commitLayerBranch(db, { projectId, key, attemptId, workspace, base, workRef, message, tests = [] }) {
  if (!validTests(tests)) fail('Test results need a name and passed, failed or skipped status.');
  const { repo, commit } = layerBinding(db, projectId, key);
  if (commit !== base) fail(`The ${key} layer source changed. Authorize a fresh run.`, 409);
  const checkout = join(workspace, 'layer');
  if (!existsSync(join(checkout, '.git'))) fail('The run has no layer checkout.', 409);
  try { git(checkout, ['merge-base', '--is-ancestor', base, 'HEAD'], { stdio: 'ignore' }); } catch { fail('The layer checkout is not on the run\'s base.', 409); }
  git(checkout, ['add', '-A']);
  if (git(checkout, ['diff', '--cached', '--name-only']).trim())
    git(checkout, ['commit', '--quiet', '-m', `${workRef}: ${String(message || 'Layer changes').slice(0, 300)}`], { env: { ...process.env, ...agentIdentity } });
  const head = git(checkout, ['rev-parse', 'HEAD']).trim();
  if (head === base) fail('The layer checkout has no changes to submit.');
  const changed = git(checkout, ['diff', '--name-status', '--no-renames', base, head]).trim().split('\n').filter(Boolean).map(line => { const [status, path] = line.split('\t'); return { status, path }; });
  if (changed.length > maxFiles) fail(`A run may change at most ${maxFiles} files.`);
  const paths = repositoryPaths(packageAt(repo, base, key));
  const refused = changed.filter(file => !paths.writable(file.path));
  if (refused.length) fail(`A run may not change ${refused.map(file => file.path).join(', ')}. Writable: ${paths.patterns.join(', ')}.`, 403);
  const branch = workBranchName(workRef, attemptId);
  git(repo, ['fetch', '--quiet', '--no-tags', checkout, `+${head}:refs/heads/${branch}`]);
  if (git(repo, ['rev-parse', `refs/heads/${branch}`]).trim() !== head) fail('The work branch did not arrive intact.', 409);
  let pkg;
  try { pkg = packageAt(repo, head, key); } catch (error) { fail(`The changed layer is not a valid package: ${error.message}`); }
  if (pkg.manifest.api) try { layerApiAt(key, repo, head, pkg.manifest); } catch (error) { fail(`The changed layer API does not load: ${error.message}`); }
  const files = changed.map(file => {
    let diff = git(repo, ['diff', '--no-color', '--no-ext-diff', base, head, '--', file.path]);
    if (diff.length > maxDiff) diff = diff.slice(0, maxDiff) + '\n… diff truncated';
    const lines = diff.split('\n');
    return { path: file.path, status: file.status === 'A' ? 'added' : file.status === 'D' ? 'deleted' : 'modified', ownerReview: paths.authority(file.path),
      added: lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).length, removed: lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length, diff };
  });
  db.prepare(`INSERT INTO layer_work_branches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(attempt_id) DO UPDATE SET branch = excluded.branch, commit_sha = excluded.commit_sha,
    files_json = excluded.files_json, tests_json = excluded.tests_json, created_at = excluded.created_at`)
    .run(attemptId, projectId, key, branch, base, head, JSON.stringify(files), JSON.stringify(tests), now());
  return layerBranch(db, attemptId);
}

export function layerBranch(db, attemptId) {
  const row = db.prepare('SELECT * FROM layer_work_branches WHERE attempt_id = ?').get(attemptId);
  return row ? { attempt: row.attempt_id, branch: row.branch, base: row.base, commit: row.commit_sha, files: JSON.parse(row.files_json), tests: JSON.parse(row.tests_json),
    ownerReview: JSON.parse(row.files_json).some(file => file.ownerReview) } : null;
}

// Inside the acceptance transaction: merges the reviewed branch into `main` (fast-forward, or a clean merge when `main`
// moved), records the reviewed bytes of changed host-run files, proves the merged rules still accept every existing
// record, and moves the pin. Throws, leaving `main` and the pin as they were, on any failure.
export function mergeLayerBranch(db, { projectId, key, source, reviewer, workId, workRef, catalogs, recordsOf }) {
  const { repo, commit: main } = layerBinding(db, projectId, key);
  if (git(repo, ['rev-parse', `refs/heads/${source.branch}`]).trim() !== source.commit) fail('The reviewed work branch changed. Send it back.', 409);
  if (git(repo, ['rev-parse', 'refs/heads/main']).trim() !== main) fail('The layer repository\'s main branch is not at its pin; reconcile it first.', 409);
  let merged = source.commit;
  if (main !== source.base) {
    let tree;
    try { tree = git(repo, ['merge-tree', '--write-tree', main, source.commit]).trim().split('\n')[0]; }
    catch { fail('The work branch no longer merges cleanly into main. Send it back for a fresh run.', 409); }
    merged = git(repo, ['commit-tree', tree, '-p', main, '-p', source.commit, '-m', `Merge ${source.branch} (${workRef}), accepted by ${reviewer}`],
      { env: { ...process.env, GIT_AUTHOR_NAME: reviewer, GIT_AUTHOR_EMAIL: 'reviewer@aludel.invalid', GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' } }).trim();
  }
  const pkg = packageAt(repo, merged, key);
  // Reviewed bytes are recorded by the package's own path, which is how the host looks a handler up.
  const own = repositoryPaths(pkg).own;
  for (const file of source.files.filter(entry => entry.status !== 'deleted' && /^server\/.+\.mjs$/.test(own(entry.path) || '')))
    db.prepare('INSERT OR IGNORE INTO layer_source_reviews VALUES (?, ?, ?, ?, ?, ?, ?)').run(projectId, key, own(file.path),
      createHash('sha256').update(git(repo, ['show', `${merged}:${file.path}`])).digest('hex'), reviewer, now(), workId);
  if (pkg.manifest.api) {
    const api = layerApiAt(key, repo, merged, pkg.manifest);
    for (const [kind] of api.records) for (const record of recordsOf(kind)) {
      try { normalizeRecord(api, kind, record.data, catalogs); }
      catch (error) { fail(`The changed ${key} rules reject the existing ${kind.replace('_', ' ')} “${record.data.title || record.data.label || record.data.path || record.id}”: ${error.message}`, 409); }
    }
  }
  // T03-G2: output files must still index under the merged indexer.
  if (pkg.manifest.files) try { indexAt(db, projectId, key, repo, merged); }
  catch (error) { fail(`The changed ${key} output files do not index: ${error.message}`, 409); }
  const clean = !git(repo, ['status', '--porcelain']).trim();
  git(repo, ['update-ref', 'refs/heads/main', merged, main]);
  db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ?').run(merged, projectId, key);
  if (pkg.manifest.files) syncFileEntries(db, projectId, key);
  return { commit: merged, repo, clean, main };
}

// After the transaction commits: bring a clean checkout of `main` up to the merge. A checkout with local edits is left alone.
export function settleLayerCheckout(merge) {
  if (!merge?.clean) return;
  try { git(merge.repo, ['checkout', '--quiet', 'main']); git(merge.repo, ['reset', '--quiet', '--hard', 'main']); } catch { /* the pin is authoritative */ }
}
// If the transaction rolls back, `main` returns to where it was.
export function undoLayerMerge(merge) {
  if (!merge) return;
  try { git(merge.repo, ['update-ref', 'refs/heads/main', merge.main, merge.commit]); } catch { /* main was not moved */ }
}
