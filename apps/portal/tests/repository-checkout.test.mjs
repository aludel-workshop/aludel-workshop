// W-33 #8: an item checkout gets the project's other repositories beside it, and puts one line of one of them on the
// item's branch. Local bare repositories stand in for GitHub; git uses whatever access the person has (here, none needed).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkoutRepositories, companionReports, lineBranch, startLine } from '../tools/aludel-client.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = (cwd, message) => git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '--quiet', '--allow-empty', '-m', message);

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-checkout-'));
  // The companion: a kit with two lines.
  const kitWork = join(root, 'kit-work'), kit = join(root, 'kit.git');
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', kitWork]); commit(kitWork, 'kit start');
  git(kitWork, 'checkout', '--quiet', '-b', 'buttons'); commit(kitWork, 'buttons');
  execFileSync('git', ['clone', '--quiet', '--bare', kitWork, kit]);
  // The item's checkout of the project's own repository, on its branch, with the person's identity.
  const app = join(root, 'app');
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', app]); commit(app, 'app start');
  git(app, 'checkout', '--quiet', '-b', 'aludel/w-7');
  git(app, 'config', 'user.name', 'Ada'); git(app, 'config', 'user.email', 'ada@example.test');
  const repositories = [
    { key: 'app', primary: true, url: null, path: '.', lines: ['main'] },
    { key: 'kit', primary: false, url: kit, path: 'vendor/kit', lines: ['main', 'buttons'] }
  ];
  return { root, app, kit, repositories };
}

test('companions are cloned beside the checkout with the person’s identity, then updated in place', () => {
  const { app, kit, repositories } = fixture();
  const [first] = checkoutRepositories(app, repositories);
  assert.deepEqual(first, { key: 'kit', path: 'vendor/kit', state: 'cloned', missing: [] });
  const folder = join(app, 'vendor/kit');
  assert.equal(git(folder, 'remote', 'get-url', 'origin'), kit, 'the remote is the plain URL, with no credential');
  assert.equal(git(folder, 'config', 'user.email'), 'ada@example.test');
  assert.equal(git(folder, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  assert.equal(checkoutRepositories(app, repositories)[0].state, 'updated');
  // A line origin doesn't have is reported, not hidden.
  assert.deepEqual(checkoutRepositories(app, [repositories[0], { ...repositories[1], lines: ['main', 'forms'] }])[0].missing, ['forms']);
});

test('a folder from the old template bundle (no remote) is adopted; one pointing elsewhere is left alone', () => {
  const { root, app, repositories } = fixture();
  const bundled = join(app, 'vendor/kit');
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', bundled]); commit(bundled, 'from a bundle');
  assert.equal(checkoutRepositories(app, repositories)[0].state, 'updated');
  assert.ok(git(bundled, 'rev-parse', 'origin/buttons'));
  git(bundled, 'remote', 'set-url', 'origin', join(root, 'elsewhere.git'));
  const [refused] = checkoutRepositories(app, repositories);
  assert.equal(refused.state, 'failed');
  assert.match(refused.detail, /its origin is .*elsewhere\.git/);
});

test('an unreachable companion fails on its own, naming why', () => {
  const { app, repositories } = fixture();
  const [failed] = checkoutRepositories(app, [repositories[0], { ...repositories[1], url: '/nonexistent/kit.git' }]);
  assert.equal(failed.state, 'failed');
  assert.ok(failed.detail);
  assert.equal(existsSync(join(app, 'vendor/kit/.git')), false);
});

test('a line goes on the item’s branch: the default line on aludel/w-n, another on aludel/w-n--<line>; then pushed and taken up again', () => {
  const { root, app, kit, repositories } = fixture();
  checkoutRepositories(app, repositories);
  const folder = join(app, 'vendor/kit');
  assert.equal(lineBranch('W-7', repositories[1], 'main'), 'aludel/w-7');
  assert.equal(lineBranch('W-7', repositories[1], 'buttons'), 'aludel/w-7--buttons');
  const started = startLine(app, repositories, 'kit', 'buttons');
  assert.deepEqual({ branch: started.branch, created: started.created }, { branch: 'aludel/w-7--buttons', created: true });
  assert.equal(git(folder, 'rev-parse', 'HEAD'), git(kit, 'rev-parse', 'buttons'), 'made from origin’s line');
  writeFileSync(join(folder, 'button.css'), '.b{}'); git(folder, 'add', '.'); commit(folder, 'a button');
  git(folder, 'push', '--quiet', 'origin', 'aludel/w-7--buttons');
  assert.equal(startLine(app, repositories, 'kit', 'buttons').created, false, 'already on it');
  // A fresh checkout (the container opened again) takes the pushed branch up instead of starting over.
  const again = join(root, 'again');
  execFileSync('git', ['clone', '--quiet', app, again]);
  git(again, 'checkout', '--quiet', 'aludel/w-7');
  checkoutRepositories(again, repositories);
  const resumed = startLine(again, repositories, 'kit', 'buttons');
  assert.equal(resumed.from, 'origin/aludel/w-7--buttons');
  assert.equal(git(join(again, 'vendor/kit'), 'log', '-1', '--format=%s'), 'a button');
});

test('starting a line refuses what it can’t do safely', () => {
  const { app, repositories } = fixture();
  assert.throws(() => startLine(app, repositories, 'kit', 'buttons'), /isn't checked out at vendor\/kit yet/);
  checkoutRepositories(app, repositories);
  assert.throws(() => startLine(app, repositories, 'nope', 'main'), /isn't one of the project's repositories/);
  assert.throws(() => startLine(app, repositories, 'kit', 'forms'), /isn't one of kit's lines/);
  assert.throws(() => startLine(app, repositories, 'app', 'main'), /is this checkout/);
  writeFileSync(join(app, 'vendor/kit/wip.txt'), 'x');
  assert.throws(() => startLine(app, repositories, 'kit', 'buttons'), /uncommitted changes/);
  assert.throws(() => checkoutRepositories(app, [repositories[0], { ...repositories[1], path: '../outside' }])[0].state === 'x', /isn't inside this checkout/);
});

test('W-33 #3: the item’s branches with work of their own are pushed and reported, with their files; others aren’t', () => {
  const { app, kit, repositories } = fixture();
  checkoutRepositories(app, repositories);
  const folder = join(app, 'vendor/kit');
  assert.deepEqual(companionReports(app, repositories), [], 'nothing until a line has work');
  startLine(app, repositories, 'kit', 'buttons');
  assert.deepEqual(companionReports(app, repositories), [], 'a fresh line branch has no work of its own');
  writeFileSync(join(folder, 'button.css'), '.b{}'); git(folder, 'add', '.');
  assert.throws(() => companionReports(app, repositories), /uncommitted change in vendor\/kit/);
  commit(folder, 'a button');
  const [report] = companionReports(app, repositories);
  assert.deepEqual({ ...report, commit: undefined, base: undefined }, { repository: 'kit', line: 'buttons', branch: 'aludel/w-7--buttons', commit: undefined, base: undefined, files: [{ path: 'button.css', status: 'added' }] });
  assert.equal(report.commit, git(kit, 'rev-parse', 'aludel/w-7--buttons'), 'pushed to origin');
  assert.equal(report.base, git(kit, 'rev-parse', 'buttons'));
});
