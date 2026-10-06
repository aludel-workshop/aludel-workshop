// W-33 #2: a project's repositories, kept in its settings. The project here isn't Aludel-shaped: an app with a companion
// "kit" repository whose two lines the app pins.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { githubName, initProjectRepositories, projectRepositories } from '../server/project-repositories.mjs';
import { openDatabase } from '../server/storage.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function fixture({ bound = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aludel-repos-'));
  const db = openDatabase(join(root, 'test.sqlite')); initProjectRepositories(db);
  const at = new Date().toISOString();
  db.prepare("INSERT INTO projects(id, slug, name, description, created_at, updated_at) VALUES ('p1', 'tool-share', 'Tool Share', 'x', ?, ?)").run(at, at);
  if (bound) db.prepare(`INSERT INTO repository_bindings(project_id, provider, owner, name, html_url, clone_url, default_branch, private, status, created_at, updated_at)
    VALUES ('p1', 'github', 'Ada', 'Tool-Share', 'https://github.com/Ada/tool-share', 'https://github.com/Ada/tool-share.git', 'trunk', 1, 'ready', ?, ?)`).run(at, at);
  // A companion with two lines, served from a bare repository by file URL.
  const work = join(root, 'kit-work'); const bare = join(root, 'kit.git');
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', work]);
  git(work, '-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '--quiet', '--allow-empty', '-m', 'start');
  git(work, 'branch', 'buttons');
  execFileSync('git', ['clone', '--quiet', '--bare', work, bare]);
  const tokens = [];
  const repos = projectRepositories({ db, tokenFor: async (_projectId, named) => { tokens.push(named); return 'token'; } });
  return { db, repos, kitUrl: `file://${bare}`, tokens };
}

test('the primary comes from the binding and keeps only its references and checks', () => {
  const { repos } = fixture();
  const [primary] = repos.list('p1');
  assert.deepEqual({ key: primary.key, primary: primary.primary, path: primary.path, lines: primary.lines, access: primary.access.state },
    { key: 'tool-share', primary: true, path: '.', lines: ['trunk'], access: 'ready' });
  const saved = repos.save('p1', { key: 'tool-share', url: 'https://example.com/ignored.git', checks: [{ name: 'Digests', run: 'node tools/check.mjs' }] });
  assert.equal(saved.url, 'https://github.com/Ada/tool-share.git', 'the URL follows the binding');
  assert.deepEqual(saved.checks, [{ name: 'Digests', run: 'node tools/check.mjs' }]);
  assert.throws(() => repos.remove('p1', 'tool-share'), /stays/);
});

test('a project without a GitHub repository still has its primary, as local', () => {
  const { repos } = fixture({ bound: false });
  assert.deepEqual(repos.list('p1').map(repo => [repo.key, repo.access.state]), [['app', 'local']]);
});

test('a companion is added with its lines, checked, and referenced from the primary', async () => {
  const { repos, kitUrl } = fixture();
  repos.save('p1', { key: 'kit', url: kitUrl, path: 'vendor/kit', lines: ['main', 'buttons'] });
  assert.equal(repos.get('p1', 'kit').access.state, 'unchecked');
  assert.equal((await repos.check('p1', 'kit')).access.state, 'ready');
  repos.save('p1', { key: 'tool-share', references: [{ file: 'config/kit-pins.json', repository: 'kit', at: 'pins.*' }] });
  assert.deepEqual(repos.list('p1')[0].references, [{ file: 'config/kit-pins.json', repository: 'kit', at: 'pins.*' }]);
  assert.throws(() => repos.remove('p1', 'kit'), /references into kit/);
  // A line it doesn't have is reported, and changing the lines asks for a check again.
  repos.save('p1', { key: 'kit', url: kitUrl, path: 'vendor/kit', lines: ['main', 'forms'] });
  assert.equal(repos.get('p1', 'kit').access.state, 'unchecked');
  const checked = await repos.check('p1', 'kit');
  assert.equal(checked.access.state, 'missing-lines');
  assert.match(checked.access.detail, /forms/);
});

test('an unreachable companion is no-access, and a GitHub one asks for the installation token by its name', async () => {
  const { db, repos } = fixture();
  repos.save('p1', { key: 'gone', url: 'file:///nonexistent/repo.git', lines: ['main'] });
  assert.equal((await repos.check('p1', 'gone')).access.state, 'no-access');
  assert.deepEqual(githubName('https://github.com/aludel-workshop/layer-base.git'), { owner: 'aludel-workshop', name: 'layer-base' });
  assert.equal(githubName('file:///x/kit.git'), null);
  // The App can't reach it: no git call is made, and the state says why.
  const asked = [];
  const outside = projectRepositories({ db, tokenFor: async (_projectId, named) => { asked.push(named); throw new Error('not installed there'); } });
  outside.save('p1', { key: 'remote', url: 'https://github.com/Bea/kit.git', path: 'kit-remote', lines: ['main'] });
  const checked = await outside.check('p1', 'remote');
  assert.deepEqual(asked, [{ owner: 'Bea', name: 'kit' }]);
  assert.equal(checked.access.state, 'no-access');
  assert.match(checked.access.detail, /Bea\/kit: not installed there/);
});

test('settings refuse credentials in URLs, clashing paths, bad branch names and unknown references', () => {
  const { repos, kitUrl } = fixture();
  assert.throws(() => repos.save('p1', { key: 'kit', url: 'https://x:secret@github.com/Ada/kit.git', lines: ['main'] }), /credentials/);
  assert.throws(() => repos.save('p1', { key: 'Kit!', url: kitUrl, lines: ['main'] }), /lowercase/);
  assert.throws(() => repos.save('p1', { key: 'kit', url: kitUrl, path: '../outside', lines: ['main'] }), /beside/);
  assert.throws(() => repos.save('p1', { key: 'kit', url: kitUrl, lines: ['bad..name'] }), /branch name/);
  assert.throws(() => repos.save('p1', { key: 'kit', url: kitUrl, lines: [] }), /default branch/);
  repos.save('p1', { key: 'kit', url: kitUrl, path: 'kit', lines: ['main'] });
  assert.throws(() => repos.save('p1', { key: 'kit2', url: kitUrl, path: 'kit/inner', lines: ['main'] }), /already sits/);
  assert.throws(() => repos.save('p1', { key: 'tool-share', references: [{ file: 'a.json', repository: 'nope', at: 'x' }] }), /nope isn't one/);
});
