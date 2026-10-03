// LAY-05: immutable local code candidates. A candidate is a detached worktree at a pinned project commit.
// The agent receives only that worktree; accepting it into the shared project is a separate operation.
import { mkdirSync, rmSync, realpathSync, existsSync, lstatSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { checkPinnedActionEffect } from './code-action-gateway.mjs';

const now = () => new Date().toISOString();
const sensitivePath = /(^|\/)(\.env(?:\.|$)|[^/]+\.(?:pem|key|p12|sqlite|sqlite3|db)$|\.data(?:\/|$))/i;
const badPath = /(^|\/)(node_modules|dist)(?:\/|$)/i;
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (result.status !== 0) fail(`Git ${args[0]} failed: ${String(result.stderr || result.stdout).trim().slice(0, 300)}`);
  return result.stdout.trimEnd();
}
function root(repository) {
  if (!existsSync(repository)) fail('Project repository is missing.');
  const actual = realpathSync(repository);
  if (realpathSync(git(actual, 'rev-parse', '--show-toplevel')) !== actual) fail('Project workspace is not its own repository.');
  return actual;
}
function changedPaths(repository) {
  return git(repository, 'status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all').split('\0').filter(Boolean).map(line => line.slice(3));
}
function allowedPath(path, changes) {
  if (sensitivePath.test(path) || badPath.test(path) || path === '.gitmodules' || path.startsWith('.git/')) return false;
  // The editable surface comes from the action record, not an agent prompt.
  if (changes.includes('Code › code')) return !path.startsWith('docs/');
  if (changes.includes('Code › docs')) return path === 'AGENTS.md' || path.startsWith('docs/');
  return false;
}
const rowView = row => row ? ({ id: row.id, projectId: row.project_id, workId: row.work_id, state: row.state,
  base: row.base_commit, commit: row.candidate_commit, path: row.worktree_path,
  changes: JSON.parse(row.changes_json), files: JSON.parse(row.files_json), checks: JSON.parse(row.checks_json), createdAt: row.created_at,
  finishedAt: row.finished_at, note: row.note, workspaceOwner: row.workspace_owner || 'aludel' }) : null;

export function initCodeCandidates(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS code_candidates (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), work_id TEXT NOT NULL,
    state TEXT NOT NULL, base_commit TEXT NOT NULL, candidate_commit TEXT,
    worktree_path TEXT NOT NULL, changes_json TEXT NOT NULL DEFAULT '[]', files_json TEXT NOT NULL DEFAULT '[]', checks_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL, finished_at TEXT, note TEXT, origin_workspace_path TEXT
  )`);
  if (!db.prepare('PRAGMA table_info(code_candidates)').all().some(column => column.name === 'changes_json'))
    db.exec("ALTER TABLE code_candidates ADD COLUMN changes_json TEXT NOT NULL DEFAULT '[]'");
  if (!db.prepare('PRAGMA table_info(code_candidates)').all().some(column => column.name === 'workspace_owner'))
    db.exec("ALTER TABLE code_candidates ADD COLUMN workspace_owner TEXT NOT NULL DEFAULT 'aludel'");
  if (!db.prepare('PRAGMA table_info(code_candidates)').all().some(column => column.name === 'origin_workspace_path'))
    db.exec('ALTER TABLE code_candidates ADD COLUMN origin_workspace_path TEXT');
  db.prepare("UPDATE code_candidates SET origin_workspace_path = worktree_path WHERE workspace_owner = 'symphony' AND origin_workspace_path IS NULL").run();
  db.exec('CREATE INDEX IF NOT EXISTS code_candidates_work ON code_candidates(project_id, work_id, created_at)');
  // A portal restart leaves no agent process behind. Preserve the worktree for inspection but never claim it ran to completion.
  db.prepare("UPDATE code_candidates SET state = 'interrupted', finished_at = ?, note = 'Portal restarted during run' WHERE state = 'running'").run(now());
}

export function codeCandidates({ db, candidateRoot, externalRoot = join(candidateRoot, 'symphony') }) {
  mkdirSync(candidateRoot, { recursive: true });
  mkdirSync(externalRoot, { recursive: true });
  const get = (projectId, id) => rowView(db.prepare('SELECT * FROM code_candidates WHERE id = ? AND project_id = ?').get(id, projectId));
  const forWork = (projectId, workId) => db.prepare('SELECT * FROM code_candidates WHERE project_id = ? AND work_id = ? ORDER BY created_at DESC').all(projectId, workId).map(rowView);

  function begin({ projectId, workId, repository, changes }) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(projectId || '') || !/^[A-Za-z0-9_-]{1,80}$/.test(workId || '')) fail('Invalid project or work identifier.', 400);
    const source = root(repository);
    if (db.prepare("SELECT id FROM code_candidates WHERE project_id = ? AND state = 'running'").get(projectId)) fail('Another coding candidate is already running for this project.');
    if (changedPaths(source).length) fail('Project repository has uncommitted changes; finish or save them before a coding run.');
    if (git(source, 'ls-files', '--stage', '-z').split('\0').some(line => /^(120000|160000) /.test(line)))
      fail('Project repository contains a symlink or submodule; an isolated coding run cannot follow it safely.');
    if (!changes?.some(change => ['Code › code', 'Code › docs'].includes(change))) fail('This action does not allow code or docs changes.');
    const base = git(source, 'rev-parse', 'HEAD');
    const id = `can-${randomUUID()}`;
    const path = resolve(candidateRoot, projectId, id);
    mkdirSync(dirname(path), { recursive: true });
    try { git(source, 'worktree', 'add', '--detach', path, base); }
    catch (error) { rmSync(path, { recursive: true, force: true }); throw error; }
    try {
      db.prepare('INSERT INTO code_candidates(id, project_id, work_id, state, base_commit, worktree_path, changes_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, projectId, workId, 'running', base, path, JSON.stringify(changes), now());
    } catch (error) { git(source, 'worktree', 'remove', '--force', path); throw error; }
    return get(projectId, id);
  }

  function finish({ projectId, id, repository, checks = [], message }) {
    const candidate = get(projectId, id);
    if (!candidate || candidate.state !== 'running') fail('Candidate is not running.');
    const source = root(repository);
    if (git(source, 'rev-parse', 'HEAD') !== candidate.base) fail('Project base moved during the run; candidate needs reassessment.');
    const path = candidate.path;
    if (!existsSync(path) || realpathSync(git(path, 'rev-parse', '--show-toplevel')) !== realpathSync(path)) fail('Candidate worktree is missing or invalid.');
    const ignoredSecrets = git(path, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z').split('\0').filter(file => sensitivePath.test(file));
    if (ignoredSecrets.length) fail(`Candidate contains ignored sensitive files: ${ignoredSecrets.slice(0, 10).join(', ')}`);
    const files = changedPaths(path);
    if (!files.length) fail('Coding run made no file changes.');
    const disallowed = files.filter(file => !allowedPath(file, candidate.changes) || (existsSync(join(path, file)) && lstatSync(join(path, file)).isSymbolicLink()));
    if (disallowed.length) fail(`Action may not change: ${disallowed.slice(0, 10).join(', ')}`);
    checkPinnedActionEffect(db, projectId, candidate.workId, 'commit-candidate', files, candidate.base);
    git(path, 'add', '--', ...files);
    const staged = git(path, 'diff', '--cached', '--name-only', '-z').split('\0').filter(Boolean);
    if (staged.some(file => !allowedPath(file, candidate.changes))) fail('Staged changes exceed the action permission.');
    if (!staged.length) fail('Coding run made no committable file changes.');
    git(path, '-c', 'user.name=Aludel Agent', '-c', 'user.email=agent@aludel.local', 'commit', '-m', String(message || 'Implement work item').slice(0, 160), '-m',
      `Aludel-Work: ${candidate.workId}`);
    const commit = git(path, 'rev-parse', 'HEAD');
    const evidence = (Array.isArray(checks) ? checks : []).slice(0, 30).map(check => ({ name: String(check.name || '').slice(0, 120),
      status: ['passed', 'failed', 'skipped'].includes(check.status) ? check.status : 'skipped', detail: String(check.detail || '').slice(0, 500) }));
    db.prepare("UPDATE code_candidates SET state = 'review', candidate_commit = ?, files_json = ?, checks_json = ?, finished_at = ? WHERE id = ? AND state = 'running'")
      .run(commit, JSON.stringify(staged), JSON.stringify(evidence), now(), id);
    return get(projectId, id);
  }

  // Codex can edit the Symphony clone but its sandbox protects .git. The trusted host
  // commits only the Go-authorized file surface, then the normal candidate validator runs.
  function commitExternal({ repository, workspace, base, workRef, changes, message }) {
    if (!/^[a-f0-9]{40}$/.test(base || '') || !/^[A-Za-z0-9_-]{1,80}$/.test(workRef || '')) fail('A pinned base and Work reference are required.');
    const source = root(repository);
    const allowedRoot = realpathSync(externalRoot);
    const path = realpathSync(workspace);
    if (!path.startsWith(allowedRoot + '/') || root(path) !== path) fail('Symphony workspace is outside its configured root.');
    if (git(source, 'rev-parse', 'HEAD') !== base || changedPaths(source).length) fail('Project base moved or became dirty; candidate needs reassessment.');
    const head = git(path, 'rev-parse', 'HEAD');
    if (spawnSync('git', ['merge-base', '--is-ancestor', base, head], { cwd: path, stdio: 'ignore' }).status !== 0) fail('Symphony workspace does not descend from the pinned base.');
    if (git(path, 'ls-files', '--stage', '-z').split('\0').some(line => /^(120000|160000) /.test(line))) fail('Workspace has a symlink or submodule.');
    const ignoredSecrets = git(path, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z').split('\0').filter(file => sensitivePath.test(file));
    if (ignoredSecrets.length) fail(`Workspace contains ignored sensitive files: ${ignoredSecrets.slice(0, 10).join(', ')}`);
    const files = changedPaths(path);
    if (!files.length) {
      if (head === base) fail('Coding run made no file changes.');
      return head; // Recover a host commit made before a response or DB interruption.
    }
    const disallowed = files.filter(file => !allowedPath(file, changes || []) ||
      (existsSync(join(path, file)) && lstatSync(join(path, file)).isSymbolicLink()));
    if (disallowed.length) fail(`Action may not change: ${disallowed.slice(0, 10).join(', ')}`);
    git(path, 'add', '--', ...files);
    const staged = git(path, 'diff', '--cached', '--name-only', '-z').split('\0').filter(Boolean);
    if (!staged.length) fail('Coding run made no committable file changes.');
    if (staged.some(file => !allowedPath(file, changes || []))) fail('Staged changes exceed the action permission.');
    const title = String(message || `Implement ${workRef}`).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 160);
    git(path, '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Aludel Agent', '-c', 'user.email=agent@aludel.local', 'commit', '-m', title, '-m', `Aludel-Work: ${workRef}`);
    return git(path, 'rev-parse', 'HEAD');
  }

  // Symphony owns its short-lived clone. Aludel validates and snapshots its exact commit
  // before acknowledging submission; it never deletes or resets Symphony’s workspace.
  function registerExternal({ projectId, workId, workRef, repository, workspace, base, commit, changes, checks = [] }) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(projectId || '') || !/^[A-Za-z0-9_-]{1,80}$/.test(workId || '')) fail('Invalid project or work identifier.', 400);
    if (!/^[a-f0-9]{40}$/.test(base || '') || !/^[a-f0-9]{40}$/.test(commit || '')) fail('A full Git commit is required.', 400);
    const source = root(repository);
    const allowedRoot = realpathSync(externalRoot);
    const path = realpathSync(workspace);
    if (!path.startsWith(allowedRoot + '/') || root(path) !== path) fail('Symphony workspace is outside its configured root.');
    if (git(source, 'rev-parse', 'HEAD') !== base || changedPaths(source).length) fail('Project base moved or became dirty; candidate needs reassessment.');
    if (git(path, 'status', '--porcelain=v1') !== '') fail('Symphony workspace has uncommitted changes.');
    if (git(path, 'rev-parse', 'HEAD') !== commit) fail('Submitted commit is not the workspace HEAD.');
    if (git(path, 'cat-file', '-t', base) !== 'commit') fail('Pinned base is missing from the workspace.');
    const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', base, commit], { cwd: path, encoding: 'utf8' });
    if (ancestor.status !== 0 || base === commit) fail('Candidate commit does not descend from the pinned base.');
    if (git(path, 'ls-files', '--stage', '-z').split('\0').some(line => /^(120000|160000) /.test(line))) fail('Candidate has a symlink or submodule.');
    const ignoredSecrets = git(path, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z').split('\0').filter(file => sensitivePath.test(file));
    if (ignoredSecrets.length) fail(`Candidate contains ignored sensitive files: ${ignoredSecrets.slice(0, 10).join(', ')}`);
    const files = git(path, 'diff', '--name-only', '-z', '--no-renames', base, commit).split('\0').filter(Boolean);
    if (!files.length) fail('Candidate commit has no changes.');
    const disallowed = files.filter(file => !allowedPath(file, changes || []));
    if (disallowed.length) fail(`Action may not change: ${disallowed.slice(0, 10).join(', ')}`);
    checkPinnedActionEffect(db, projectId, workId, 'commit-candidate', files, base);
    const message = git(path, 'show', '-s', '--format=%B', commit);
    const trailers = message.split('\n').filter(line => /^Aludel-Work: /.test(line)).map(line => line.slice('Aludel-Work: '.length).trim());
    if (!trailers.includes(workId) && !trailers.includes(workRef)) fail('Candidate commit does not name this Aludel work item.');
    const existing = db.prepare("SELECT * FROM code_candidates WHERE project_id = ? AND work_id = ? AND workspace_owner = 'symphony' AND origin_workspace_path = ? ORDER BY created_at DESC LIMIT 1")
      .get(projectId, workId, path);
    if (existing && !['rejected', 'discarded'].includes(existing.state)) {
      if (existing.base_commit !== base || existing.candidate_commit !== commit) fail('This Symphony workspace already submitted a different candidate.');
      return rowView(existing);
    }
    const evidence = (Array.isArray(checks) ? checks : []).slice(0, 30).map(check => ({ name: String(check.name || '').slice(0, 120),
      status: ['passed', 'failed', 'skipped'].includes(check.status) ? check.status : 'skipped', detail: String(check.detail || '').slice(0, 500), source: 'agent-report' }));
    const id = `can-${randomUUID()}`;
    const snapshot = resolve(candidateRoot, projectId, id);
    mkdirSync(dirname(snapshot), { recursive: true });
    try {
      mkdirSync(snapshot);
      git(snapshot, 'init', '-q');
      // Fetch the exact SHA: Symphony normally commits on a detached HEAD, so a branch-only clone can omit it.
      git(snapshot, 'fetch', '--no-tags', '--', path, commit);
      git(snapshot, 'checkout', '--detach', commit);
      if (git(snapshot, 'rev-parse', 'HEAD') !== commit || git(snapshot, 'status', '--porcelain=v1'))
        fail('Candidate snapshot did not preserve the exact clean commit.');
      db.prepare(`INSERT INTO code_candidates(id, project_id, work_id, state, base_commit, candidate_commit, worktree_path, origin_workspace_path, changes_json, files_json, checks_json, created_at, finished_at, workspace_owner)
        VALUES (?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'symphony')`)
        .run(id, projectId, workId, base, commit, snapshot, path, JSON.stringify(changes || []), JSON.stringify(files), JSON.stringify(evidence), now(), now());
    } catch (error) { rmSync(snapshot, { recursive: true, force: true }); throw error; }
    return get(projectId, id);
  }

  function inspect(projectId, id, repository) {
    const candidate = get(projectId, id);
    if (!candidate) fail('Candidate not found.', 404);
    const source = root(repository);
    const baseCurrent = git(source, 'rev-parse', 'HEAD') === candidate.base;
    if (!candidate.commit) return { ...candidate, baseCurrent, diff: '' };
    if (git(candidate.path, 'cat-file', '-t', candidate.commit) !== 'commit') fail('Candidate commit is missing.');
    // Review needs the actual immutable patch. A stat is useful metadata, but presenting it as a diff left the Changes
    // viewer with no lines to inspect and made criterion evidence point at an empty artifact.
    const diff = git(candidate.path, 'diff', '--no-ext-diff', '--no-color', candidate.base, candidate.commit, '--');
    return { ...candidate, baseCurrent, diff };
  }

  function discard(projectId, id, repository) {
    const candidate = get(projectId, id);
    if (!candidate || !['running', 'interrupted', 'review', 'submitted'].includes(candidate.state)) fail('Candidate cannot be discarded.');
    const source = root(repository);
    if (candidate.workspaceOwner === 'aludel' && existsSync(candidate.path)) git(source, 'worktree', 'remove', '--force', candidate.path);
    if (candidate.workspaceOwner === 'symphony' && existsSync(candidate.path)) {
      const storedRoot = realpathSync(candidateRoot);
      const storedPath = realpathSync(candidate.path);
      if (storedPath.startsWith(storedRoot + '/')) rmSync(storedPath, { recursive: true, force: true });
    }
    db.prepare("UPDATE code_candidates SET state = 'discarded', finished_at = ? WHERE id = ?").run(now(), id);
    return get(projectId, id);
  }
  return { begin, finish, commitExternal, registerExternal, get, forWork, inspect, discard };
}
