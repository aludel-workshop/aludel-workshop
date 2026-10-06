// W-33 #5: the steps of closing out a set that don't need an item: a line in Aludel's copy brought level with its remote,
// and pins read from a file by a dotted path.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkReferences, syncLine } from '../server/set-close-out.mjs';

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const handleOf = workspace => ({ workspace, git: args => git(workspace, ...args), has: args => { try { git(workspace, ...args); return true; } catch { return false; } } });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-sync-line-'));
  const work = join(root, 'work'), remote = join(root, 'kit.git'), copy = join(root, 'copy');
  git(root, 'init', '-q', '-b', 'main', work); git(work, 'commit', '-q', '--allow-empty', '-m', 'one');
  git(root, 'clone', '-q', '--bare', work, remote); git(root, 'clone', '-q', remote, copy);
  const advance = message => { git(work, 'commit', '-q', '--allow-empty', '-m', message); git(work, 'push', '-q', remote, 'main'); return git(work, 'rev-parse', 'HEAD'); };
  return { root, work, remote, copy, handle: handleOf(copy), advance };
}

test('a line behind its remote catches up, checked out or not; a missing one is made', () => {
  const { remote, copy, handle, advance } = fixture();
  const two = advance('two');
  assert.equal(syncLine(handle, { url: remote }, 'kit', 'main'), two);
  assert.equal(git(copy, 'rev-parse', 'HEAD'), two, 'the checked-out line fast-forwards');
  git(copy, 'checkout', '-q', '--detach'); const three = advance('three');
  syncLine(handle, { url: remote }, 'kit', 'main');
  assert.equal(git(copy, 'rev-parse', 'main'), three, 'a line not checked out moves by its ref');
  git(copy, 'branch', '-D', 'main');
  assert.equal(syncLine(handle, { url: remote }, 'kit', 'main'), three);
});

test('a line with commits its remote lacks, or one checked out with changes, makes close-out wait', () => {
  const { remote, copy, handle, advance } = fixture();
  git(copy, 'commit', '-q', '--allow-empty', '-m', 'local only');
  assert.throws(() => syncLine(handle, { url: remote }, 'kit', 'main'), error => error.status === 409 && /has commits GitHub doesn't/.test(error.message));
  advance('remote moved');
  assert.throws(() => syncLine(handle, { url: remote }, 'kit', 'main'), /has commits GitHub doesn't/, 'diverged too');
  git(copy, 'reset', '-q', '--hard', 'origin/main'); advance('again');
  writeFileSync(join(copy, 'wip.txt'), 'x'); git(copy, 'add', 'wip.txt');
  assert.throws(() => syncLine(handle, { url: remote }, 'kit', 'main'), /uncommitted changes on main/);
  assert.throws(() => syncLine(handle, { url: remote }, 'kit', 'nope'), /couldn't fetch nope of kit/);
});

test('pins are read by a dotted path with *, and each must be on a line of its repository', () => {
  const { work, handle } = fixture();
  const one = git(work, 'rev-parse', 'HEAD');
  const app = handleOf(work);
  writeFileSync(join(work, 'pins.json'), JSON.stringify({ templates: { a: { branch: 'main', commit: one }, b: { branch: 'main', commit: one } }, other: 1 }));
  git(work, 'add', '.'); git(work, 'commit', '-q', '-m', 'pins'); const tip = git(work, 'rev-parse', 'HEAD');
  const set = [{ key: 'app', primary: true, lines: ['main'], references: [{ file: 'pins.json', repository: 'kit', at: 'templates.*' }] }, { key: 'kit', lines: ['main'], references: [] }];
  const copies = key => key === 'app' ? app : handle;
  checkReferences(set, (key, line) => key === 'app' ? tip : handle.git(['rev-parse', line]), copies);
  assert.throws(() => checkReferences([{ ...set[0], references: [{ file: 'pins.json', repository: 'kit', at: 'missing.*' }] }, set[1]], () => tip, copies), /has nothing at missing\.\*/);
  assert.throws(() => checkReferences([{ ...set[0], references: [{ file: 'nope.json', repository: 'kit', at: 'x' }] }, set[1]], () => tip, copies), /has no readable nope\.json/);
  assert.throws(() => checkReferences([{ ...set[0], references: [{ file: 'pins.json', repository: 'kit', at: 'other' }] }, set[1]], () => tip, copies), /without a branch and a commit/);
  assert.throws(() => checkReferences([set[0], { ...set[1], lines: ['forms'] }], () => tip, copies), /pins main, which isn't one of kit's lines/);
});
