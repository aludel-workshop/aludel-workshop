// LAYER-SOURCE-01 / LAYER-BASE-01 B5: a layer-scoped run works on its layer instance's repository in its own sandbox.
// The run's workspace gets the instance repository at the pinned `main` on a work branch, plus a copy of the layer's current
// outputs to test against. The host commits the branch for the agent (the sandbox's .git is read-only), fetches it into
// the instance repository as `work/<ref>-<attempt>`, and records the agent's test results. Accepting the review merges the
// exact prepared revision into `main`: the combined layer must accept every existing record, and the
// exact bytes of changed host-run files are recorded as reviewed. Review is always an elevated person's (DEC-057).
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
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
  db.exec(`CREATE TABLE IF NOT EXISTS layer_review_integrations (id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL, project_id TEXT NOT NULL, layer_key TEXT NOT NULL, source_commit TEXT NOT NULL, base_commit TEXT NOT NULL, commit_sha TEXT NOT NULL, source_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS layer_review_by_attempt ON layer_review_integrations(attempt_id, created_at)`);
}

// The installed instance repository and its pinned commit (its `main`).
export function layerBinding(db, projectId, key) {
  const row = db.prepare(`SELECT b.repository_path AS repo, b.accepted_commit AS "commit" FROM layer_package_bindings b
    JOIN layer_instances i ON i.project_id = b.project_id AND i.instance_id = b.layer_instance_id AND i.layer_key = b.layer_key
    WHERE b.project_id = ? AND b.layer_key = ?`).get(projectId, key);
  return row || fail('This layer has no installed repository.', 409);
}
export const workBranchName = (workRef, attemptId) => `work/${String(workRef).toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${attemptId.startsWith('person-run-') ? attemptId.slice(11, 19) : attemptId.slice(4, 12)}`;

// A Git bundle of the instance repository at the run's base, for the sandbox to clone without reaching the host's files.
// J6: an item kept as a draft also carries its draft commit, as refs/aludel/draft, for the run to build on.
export function layerBundle(db, { projectId, key, base, attemptId, draft = null }) {
  const { repo, commit } = layerBinding(db, projectId, key);
  if (commit !== base) fail(`The ${key} layer source changed. Authorize a fresh run.`, 409);
  const scratch = mkdtempSync(join(tmpdir(), 'aludel-layer-bundle-'));
  const ref = `refs/aludel/base/${attemptId}`, draftRef = `refs/aludel/draft/${attemptId}`;
  const drafted = typeof draft === 'string' && /^[a-f0-9]{40}$/.test(draft) && (() => { try { return git(repo, ['cat-file', '-t', draft]).trim() === 'commit'; } catch { return false; } })();
  try {
    git(repo, ['update-ref', ref, base]);
    if (drafted) git(repo, ['update-ref', draftRef, draft]);
    git(repo, ['bundle', 'create', '--quiet', join(scratch, 'layer.bundle'), ref, ...(drafted ? [draftRef] : [])], { stdio: 'pipe' });
    return readFileSync(join(scratch, 'layer.bundle'));
  } finally {
    for (const name of [ref, draftRef]) { try { git(repo, ['update-ref', '-d', name]); } catch { /* already gone */ } }
    rmSync(scratch, { recursive: true, force: true });
  }
}

// Commits the sandbox's layer checkout for the agent, fetches it into the instance repository as the run's work branch and
// checks it statically. Nothing in it runs until the review is accepted.
export function commitLayerBranch(db, { projectId, key, attemptId, workspace, base, workRef, message, tests = [] }) {
  if (!validTests(tests)) fail('Test results need a name and passed, failed or skipped status.');
  const { repo, commit } = layerBinding(db, projectId, key);
  const checkout = join(workspace, 'layer');
  if (!existsSync(join(checkout, '.git'))) fail('The run has no layer checkout.', 409);
  try { git(checkout, ['merge-base', '--is-ancestor', base, 'HEAD'], { stdio: 'ignore' }); } catch { fail('The layer checkout is not on the run\'s base.', 409); }
  git(checkout, ['add', '-A']);
  if (git(checkout, ['diff', '--cached', '--name-only']).trim())
    git(checkout, ['commit', '--quiet', '-m', `${workRef}: ${String(message || 'Layer changes').slice(0, 300)}`], { env: { ...process.env, ...agentIdentity } });
  const head = git(checkout, ['rev-parse', 'HEAD']).trim();
  if (head === base) fail('The layer checkout has no changes to submit.');
  git(repo, ['fetch', '--quiet', '--no-tags', checkout, head]);
  return registerLayerBranch(db, { projectId, key, attemptId, base, head, workRef, tests });
}

// Person submissions reference a committed branch in this layer's bound repository; never a client-supplied host path.
export function submitLayerBranch(db, { projectId, key, attemptId, base, workRef, branch, commit, tests = [] }) {
  if (typeof branch !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_\/-]{0,199}$/.test(branch) || !/^[a-f0-9]{40}$/.test(commit || '')) fail('Name a local branch and its exact commit.');
  const { repo } = layerBinding(db, projectId, key);
  let head;
  try { head = git(repo, ['rev-parse', `refs/heads/${branch}`]).trim(); } catch { fail('The submitted local branch was not found.'); }
  if (head !== commit) fail('The submitted branch changed. Refresh its commit.', 409);
  try { git(repo, ['merge-base', '--is-ancestor', base, head], { stdio: 'ignore' }); } catch { fail('The submitted branch does not descend from this run\'s pinned base.', 409); }
  if (head === base) fail('The submitted branch has no changes.');
  return registerLayerBranch(db, { projectId, key, attemptId, base, head, workRef, tests });
}

function registerLayerBranch(db, { projectId, key, attemptId, base, head, workRef, tests }) {
  if (!validTests(tests)) fail('Test results need a name and passed, failed or skipped status.');
  const { repo } = layerBinding(db, projectId, key);
  const changed = git(repo, ['diff', '--name-status', '--no-renames', base, head]).trim().split('\n').filter(Boolean).map(line => { const [status, path] = line.split('\t'); return { status, path }; });
  if (changed.length > maxFiles) fail(`A run may change at most ${maxFiles} files.`);
  const paths = repositoryPaths(packageAt(repo, base, key));
  const refused = changed.filter(file => !paths.writable(file.path));
  if (refused.length) fail(`A run may not change ${refused.map(file => file.path).join(', ')}. Writable: ${paths.patterns.join(', ')}.`, 403);
  const branch = workBranchName(workRef, attemptId);
  git(repo, ['update-ref', `refs/heads/${branch}`, head]);
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

// Prepare a retained integration commit before review. Accepted main and the submission stay untouched.
export function prepareLayerReview(db, { projectId, key, attemptId, source, catalogs, recordsOf, force = false }) {
  const { repo, commit: main } = layerBinding(db, projectId, key);
  if (git(repo, ['rev-parse', 'refs/heads/main']).trim() !== main) fail('The layer repository main is not at its pin; reconcile it first.', 409);
  if (git(repo, ['rev-parse', `refs/heads/${source.branch}`]).trim() !== source.commit) fail('The submitted work branch changed.', 409);
  const existing = db.prepare('SELECT source_json FROM layer_review_integrations WHERE attempt_id = ? AND project_id = ? AND source_commit = ? AND base_commit = ? ORDER BY rowid DESC LIMIT 1').get(attemptId, projectId, source.commit, main);
  if (existing && !force) return JSON.parse(existing.source_json);
  let commit = source.commit;
  if (main !== source.base) {
    let tree;
    try { tree = git(repo, ['merge-tree', '--write-tree', main, source.commit]).trim().split('\n')[0]; }
    catch { fail('The submission conflicts with the accepted repository. Send it back for resolution.', 409); }
    commit = git(repo, ['commit-tree', tree, '-p', main, '-p', source.commit, '-m', `Prepare review of ${source.branch}`], { env: { ...process.env, ...agentIdentity } }).trim();
  }
  const pkg = packageAt(repo, commit, key);
  if (pkg.manifest.api) {
    const api = layerApiAt(key, repo, commit, pkg.manifest);
    for (const [kind] of api.records) for (const record of recordsOf(kind)) {
      try { normalizeRecord(api, kind, record.data, catalogs); }
      catch (error) { fail(`The combined ${key} rules reject ${kind} ${record.id}: ${error.message}`, 409); }
    }
  }
  if (pkg.manifest.files) indexAt(db, projectId, key, repo, commit, { reviewed: false });
  const paths = repositoryPaths(pkg);
  const files = git(repo, ['diff', '--name-status', '--no-renames', main, commit]).trim().split('\n').filter(Boolean).map(line => {
    const [status, path] = line.split('\t');
    const diff = git(repo, ['diff', '--no-color', '--no-ext-diff', main, commit, '--', path]).slice(0, maxDiff);
    const lines = diff.split('\n');
    return { path, status: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified', ownerReview: paths.authority(path), diff,
      added: lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).length, removed: lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length };
  });
  const tests = [{ name: 'Combined layer package and existing output validation', status: 'passed', source: 'aludel', detail: `Validated ${commit.slice(0, 12)}` }];
  // Package tests run in a bounded container with no network and only a read-only package snapshot.
  // They never receive repository credentials or the host environment.
  if (files.some(file => file.ownerReview)) {
    const testPaths = git(repo, ['ls-tree', '-r', '--name-only', commit]).trim().split('\n').filter(path => /^tests\/.+\.test\.mjs$/.test(paths.own(path) || ''));
    if (testPaths.length) {
      const scratch = mkdtempSync(join(tmpdir(), 'aludel-review-tests-')), container = `aludel-review-tests-${randomUUID()}`;
      try {
        chmodSync(scratch, 0o755);
        for (const path of git(repo, ['ls-tree', '-r', '--name-only', commit]).trim().split('\n')) {
          const own = paths.own(path);
          if (!own || /(?:^|\/)(?:\.env(?:\.|$)|[^/]+\.(?:pem|key|sqlite|db)$)/i.test(own)) continue;
          const target = join(scratch, own); mkdirSync(join(target, '..'), { recursive: true });
          writeFileSync(target, git(repo, ['show', `${commit}:${path}`]));
        }
        execFileSync('docker', ['run', '--rm', '--name', container, '--network', 'none', '--memory', '256m', '--memory-swap', '256m', '--cpus', '0.5', '--pids-limit', '64', '--read-only', '--tmpfs', '/tmp:size=16m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', 'node', '--volume', `${scratch}:/layer:ro`, '--workdir', '/layer', 'node:24-bookworm-slim', 'node', '--test', '--test-reporter=tap', ...testPaths.map(path => paths.own(path))],
          { timeout: 30000, maxBuffer: 1024 * 1024, stdio: 'pipe' });
        tests.push({ name: 'Combined layer tests', status: 'passed', source: 'aludel', detail: `${testPaths.length} test files at ${commit.slice(0, 12)}; isolated read-only package.` });
      } catch (error) {
        const failed = String(error.stdout || '').split('\n').filter(line => /^not ok \d+ -/.test(line)).slice(0, 3).join('; ').slice(0, 300) || `runner ${error.code || error.status || 'unavailable'}`;
        fail(`The combined layer tests failed or exceeded their limit${failed ? ': ' + failed : ''}. Send this back for revision.`, 409);
      }
      finally { try { execFileSync('docker', ['rm', '-f', container], { timeout: 10000, stdio: 'ignore' }); } catch { /* already removed */ } rmSync(scratch, { recursive: true, force: true }); }
    }
  }
  const id = `rvi-${randomUUID()}`, branch = `review/${id}`;
  git(repo, ['update-ref', `refs/heads/${branch}`, commit]);
  const result = { id, branch, base: main, commit, submittedCommit: source.commit, submittedBase: source.base, files,
    tests, createdAt: now() };
  db.prepare('INSERT INTO layer_review_integrations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, attemptId, projectId, key, source.commit, main, commit, JSON.stringify(result), result.createdAt);
  return result;
}
export function layerReview(db, projectId, attemptId) {
  const row = db.prepare('SELECT source_json FROM layer_review_integrations WHERE project_id = ? AND attempt_id = ? ORDER BY rowid DESC LIMIT 1').get(projectId, attemptId);
  return row ? JSON.parse(row.source_json) : null;
}
export function assertLayerReviewCurrent(db, projectId, key, review, source) {
  if (!review || review.submittedCommit !== source.commit) fail('Prepare this repository review before accepting it.', 409);
  const { repo, commit } = layerBinding(db, projectId, key);
  if (review.base !== commit || git(repo, ['rev-parse', 'refs/heads/main']).trim() !== commit) fail('The accepted repository changed. Refresh this review against latest.', 409);
  if (git(repo, ['rev-parse', `refs/heads/${source.branch}`]).trim() !== source.commit) fail('The submitted branch changed. Refresh the submission.', 409);
  return review;
}

// Inside the acceptance transaction: advances `main` to the exact prepared revision only while its base is current; records the reviewed bytes of changed host-run files, proves the merged rules still accept every existing
// record, and moves the pin. Throws, leaving `main` and the pin as they were, on any failure.
export function mergeLayerBranch(db, { projectId, key, source, reviewer, workId, workRef, catalogs, recordsOf }) {
  const { repo, commit: main } = layerBinding(db, projectId, key);
  if (git(repo, ['rev-parse', `refs/heads/${source.branch}`]).trim() !== source.commit) fail('The reviewed work branch changed. Send it back.', 409);
  if (git(repo, ['rev-parse', 'refs/heads/main']).trim() !== main) fail('The layer repository\'s main branch is not at its pin; reconcile it first.', 409);
  if (main !== source.base) fail('The accepted repository changed. Refresh this review against latest.', 409);
  const merged = source.commit;
  const pkg = packageAt(repo, merged, key);
  refuseDirtySharedCheckout(repo, pkg.root);
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
  try {
    db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ?').run(merged, projectId, key);
    if (pkg.manifest.files) syncFileEntries(db, projectId, key);
    return { commit: merged, repo, clean, main };
  } catch (error) { git(repo, ['update-ref', 'refs/heads/main', main, merged]); throw error; }
}

// T03-CODE: a package nested in someone else's repository (an app) shares its checkout with that owner's work. Moving `main`
// under uncommitted changes would leave the index behind, and the next `git add -A` commit would quietly undo the move,
// so the host refuses instead.
export function refuseDirtySharedCheckout(repo, root) {
  if (!root) return;
  let head = null;
  try { head = git(repo, ['symbolic-ref', '--quiet', 'HEAD']).trim(); } catch { return; }
  if (head === 'refs/heads/main' && git(repo, ['status', '--porcelain', '--untracked-files=no']).trim())
    fail('The repository has uncommitted changes. Commit or discard them, then save again.', 409);
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
