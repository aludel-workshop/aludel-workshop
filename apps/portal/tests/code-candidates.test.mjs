import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { openDatabase } from '../server/storage.mjs';
import { codeCandidates, initCodeCandidates } from '../server/code-candidates.mjs';

const git = (cwd, ...args) => { const run = spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr); return run.stdout.trim(); };
function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'aludel-candidate-'));
  const repository = join(home, 'project'); mkdirSync(repository);
  git(repository, 'init', '-b', 'main');
  git(repository, 'config', 'user.name', 'Fixture'); git(repository, 'config', 'user.email', 'fixture@example.com');
  writeFileSync(join(repository, 'app.js'), 'export const value = 1;\n');
  git(repository, 'add', '.'); git(repository, 'commit', '-m', 'Initial');
  const db = openDatabase(join(home, 'portal.sqlite'));
  db.prepare("INSERT INTO projects(id, slug, name, description, created_at, updated_at) VALUES ('p-one', 'one', 'One', '', '', '')").run();
  initCodeCandidates(db);
  return { home, repository, db, manager: codeCandidates({ db, candidateRoot: join(home, 'candidates') }) };
}

test('candidate worktree keeps source unchanged and commits a reviewable, attributed artifact', () => {
  const { repository, manager } = fixture();
  const base = git(repository, 'rev-parse', 'HEAD');
  assert.throws(() => manager.begin({ projectId: '..', workId: 'W-7', repository, changes: ['Code › code'] }), /Invalid project/);
  const candidate = manager.begin({ projectId: 'p-one', workId: 'W-7', repository, changes: ['Code › code'] });
  assert.equal(candidate.base, base);
  assert.throws(() => manager.begin({ projectId: 'p-one', workId: 'W-8', repository, changes: ['Code › code'] }), /already running/);
  writeFileSync(join(candidate.path, 'app.js'), 'export const value = 2;\n');
  const ready = manager.finish({ projectId: 'p-one', id: candidate.id, repository, changes: ['Code › code'],
    checks: [{ name: 'S4/1', status: 'passed', detail: 'Observed expected value' }], message: 'Implement S4' });
  assert.equal(ready.state, 'review'); assert.deepEqual(ready.files, ['app.js']);
  assert.equal(ready.checks[0].status, 'passed');
  assert.equal(git(repository, 'rev-parse', 'HEAD'), base, 'shared project does not move before acceptance');
  assert.equal(readFileSync(join(repository, 'app.js'), 'utf8'), 'export const value = 1;\n');
  assert.match(git(candidate.path, 'log', '-1', '--format=%B'), /Aludel-Work: W-7\n?$/);
  assert.match(manager.inspect('p-one', candidate.id, repository).diff, /\+export const value = 2;/);
  assert.equal(manager.inspect('p-one', candidate.id, repository).baseCurrent, true);
  assert.equal(manager.get('p-other', candidate.id), null, 'project scope is enforced');
  const discarded = manager.discard('p-one', candidate.id, repository);
  assert.equal(discarded.state, 'discarded'); assert.equal(existsSync(candidate.path), false);
});

test('candidate rejects dirty bases, forbidden paths, and a base that moved', () => {
  const { repository, manager } = fixture();
  writeFileSync(join(repository, 'app.js'), 'dirty\n');
  assert.throws(() => manager.begin({ projectId: 'p-one', workId: 'W-7', repository, changes: ['Code › code'] }), /uncommitted/);
  git(repository, 'checkout', '--', 'app.js');
  const candidate = manager.begin({ projectId: 'p-one', workId: 'W-7', repository, changes: ['Code › code'] });
  writeFileSync(join(candidate.path, '.env'), 'SECRET=do-not-commit\n');
  assert.throws(() => manager.finish({ projectId: 'p-one', id: candidate.id, repository, changes: ['Code › code'] }), /may not change: .env/);
  assert.equal(git(candidate.path, 'status', '--porcelain').includes('?? .env'), true);
  manager.discard('p-one', candidate.id, repository);
  const ignored = manager.begin({ projectId: 'p-one', workId: 'W-7a', repository, changes: ['Code › code'] });
  writeFileSync(join(ignored.path, '.gitignore'), '.env\n');
  writeFileSync(join(ignored.path, '.env'), 'SECRET=still-local\n');
  assert.throws(() => manager.finish({ projectId: 'p-one', id: ignored.id, repository }), /ignored sensitive files: .env/);
  manager.discard('p-one', ignored.id, repository);
  const limited = manager.begin({ projectId: 'p-one', workId: 'W-7b', repository, changes: ['Code › docs'] });
  writeFileSync(join(limited.path, 'app.js'), 'export const value = 8;\n');
  assert.throws(() => manager.finish({ projectId: 'p-one', id: limited.id, repository, changes: ['Code › code'] }), /may not change: app.js/, 'a finish caller cannot widen permissions');
  manager.discard('p-one', limited.id, repository);
  const next = manager.begin({ projectId: 'p-one', workId: 'W-8', repository, changes: ['Code › code'] });
  writeFileSync(join(next.path, 'app.js'), 'export const value = 3;\n');
  writeFileSync(join(repository, 'app.js'), 'export const value = 4;\n');
  git(repository, 'add', 'app.js'); git(repository, 'commit', '-m', 'Another change');
  assert.throws(() => manager.finish({ projectId: 'p-one', id: next.id, repository, changes: ['Code › code'] }), /base moved/);
  assert.equal(manager.inspect('p-one', next.id, repository).baseCurrent, false);
  manager.discard('p-one', next.id, repository);
});

test('restart marks unfinished candidate interrupted without silently accepting it', () => {
  const { db, repository, manager } = fixture();
  const candidate = manager.begin({ projectId: 'p-one', workId: 'W-9', repository, changes: ['Code › docs'] });
  initCodeCandidates(db);
  assert.equal(manager.get('p-one', candidate.id).state, 'interrupted');
  manager.discard('p-one', candidate.id, repository);
});

test('Symphony-owned committed workspace becomes a submitted candidate without moving or deleting the source', () => {
  const { home, repository, manager } = fixture();
  const externalRoot = join(home, 'candidates', 'symphony');
  const workspace = join(externalRoot, 'ONE-W-7'); mkdirSync(externalRoot, { recursive: true });
  git(home, 'clone', repository, workspace);
  const base = git(repository, 'rev-parse', 'HEAD');
  writeFileSync(join(workspace, 'app.js'), 'export const value = 2;\n');
  git(workspace, 'add', 'app.js');
  git(workspace, '-c', 'user.name=Agent', '-c', 'user.email=agent@example.invalid', 'commit', '-m', 'Build W-7', '-m', 'Aludel-Work: W-7');
  const commit = git(workspace, 'rev-parse', 'HEAD');
  const input = { projectId: 'p-one', workId: 'wrk-seven', workRef: 'W-7', repository, workspace, base, commit,
    changes: ['Code › code'], checks: [{ name: 'S1/1', status: 'passed', detail: 'Agent says it passed' }] };
  const candidate = manager.registerExternal(input);
  assert.equal(candidate.state, 'submitted');
  assert.equal(candidate.workspaceOwner, 'symphony');
  assert.notEqual(candidate.path, workspace, 'Aludel stores its own immutable candidate snapshot');
  assert.equal(git(candidate.path, 'rev-parse', 'HEAD'), commit);
  assert.equal(candidate.checks[0].source, 'agent-report');
  assert.deepEqual(candidate.files, ['app.js']);
  assert.equal(manager.registerExternal(input).id, candidate.id, 'same submission is idempotent');
  assert.equal(git(repository, 'rev-parse', 'HEAD'), base, 'shared source stays at Go base');
  assert.match(manager.inspect('p-one', candidate.id, repository).diff, /app.js/);
  manager.discard('p-one', candidate.id, repository);
  assert.equal(existsSync(workspace), true, 'Symphony keeps ownership of its workspace');
  assert.equal(existsSync(candidate.path), false, 'discard removes Aludel snapshot only');
  writeFileSync(join(workspace, 'app.js'), 'export const value = 5;\n');
  git(workspace, 'add', 'app.js');
  git(workspace, '-c', 'user.name=Agent', '-c', 'user.email=agent@example.invalid', 'commit', '-m', 'Revise W-7', '-m', 'Aludel-Work: W-7');
  const revised = manager.registerExternal({ ...input, commit: git(workspace, 'rev-parse', 'HEAD') });
  assert.notEqual(revised.id, candidate.id, 'a sent-back attempt can submit a new commit from the reused workspace');
  assert.equal(git(repository, 'rev-parse', 'HEAD'), base);
});

test('external candidate rejects changed base, dirty workspace, forbidden files and a wrong Work trailer', () => {
  const { home, repository, manager } = fixture();
  const externalRoot = join(home, 'candidates', 'symphony');
  const workspace = join(externalRoot, 'ONE-W-8'); mkdirSync(externalRoot, { recursive: true });
  git(home, 'clone', repository, workspace);
  const base = git(repository, 'rev-parse', 'HEAD');
  writeFileSync(join(workspace, '.env'), 'DO_NOT_SUBMIT=true\n');
  git(workspace, 'add', '.env');
  git(workspace, '-c', 'user.name=Agent', '-c', 'user.email=agent@example.invalid', 'commit', '-m', 'Bad', '-m', 'Aludel-Work: W-8');
  const input = { projectId: 'p-one', workId: 'wrk-eight', workRef: 'W-8', repository, workspace, base,
    commit: git(workspace, 'rev-parse', 'HEAD'), changes: ['Code › code'] };
  assert.throws(() => manager.registerExternal(input), /may not change: .env/);
  git(workspace, 'reset', '--hard', base);
  writeFileSync(join(workspace, 'app.js'), 'export const value = 3;\n');
  git(workspace, 'add', 'app.js');
  git(workspace, '-c', 'user.name=Agent', '-c', 'user.email=agent@example.invalid', 'commit', '-m', 'Wrong', '-m', 'Aludel-Work: W-9');
  input.commit = git(workspace, 'rev-parse', 'HEAD');
  assert.throws(() => manager.registerExternal(input), /does not name this Aludel work item/);
  writeFileSync(join(workspace, 'uncommitted.txt'), 'dirty\n');
  assert.throws(() => manager.registerExternal(input), /uncommitted changes/);
  git(workspace, 'clean', '-fd');
  writeFileSync(join(repository, 'app.js'), 'export const value = 4;\n');
  git(repository, 'add', 'app.js'); git(repository, 'commit', '-m', 'Moved base');
  assert.throws(() => manager.registerExternal(input), /Project base moved/);
});


test('host commits only permitted Symphony workspace changes and can recover the committed HEAD', () => {
  const { home, repository, manager } = fixture();
  const externalRoot = join(home, 'candidates', 'symphony');
  const workspace = join(externalRoot, 'ONE-W-10'); mkdirSync(externalRoot, { recursive: true });
  git(home, 'clone', repository, workspace);
  const base = git(repository, 'rev-parse', 'HEAD');
  const input = { repository, workspace, base, workRef: 'W-10', changes: ['Code › code'], message: 'Build W-10' };
  writeFileSync(join(workspace, '.env'), 'DO_NOT_COMMIT=true\n');
  assert.throws(() => manager.commitExternal(input), /may not change: .env/);
  assert.equal(git(workspace, 'rev-parse', 'HEAD'), base);
  git(workspace, 'clean', '-fd');
  symlinkSync('app.js', join(workspace, 'shortcut.js'));
  assert.throws(() => manager.commitExternal(input), /may not change: shortcut.js/);
  git(workspace, 'clean', '-fd');
  writeFileSync(join(workspace, 'app.js'), 'export const value = 10;\n');
  const commit = manager.commitExternal(input);
  assert.notEqual(commit, base);
  assert.equal(git(workspace, 'status', '--porcelain'), '');
  assert.match(git(workspace, 'show', '-s', '--format=%B', commit), /Aludel-Work: W-10/);
  assert.equal(manager.commitExternal(input), commit, 'retry after a commit recovers the same HEAD');
  const candidate = manager.registerExternal({ ...input, projectId: 'p-one', workId: 'wrk-ten', commit });
  assert.equal(candidate.commit, commit);
  assert.equal(git(repository, 'rev-parse', 'HEAD'), base, 'host commit never moves shared source');
});
