// W-8 attempt 2, E1: what an item container gets beside its clone: the layer templates its branch pins, as a bundle from
// the portal (no GitHub credentials), and the person's git identity.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gitIdentity, sweepItemVolumes, templateBundle } from '../server/item-environment.mjs';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', ...args], { encoding: 'utf8' }).trim();

test('E1: the templates bundle carries exactly the pinned commits, as branches, and leaves the source repository alone', () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-env-'));
  try {
    const source = join(root, 'layer-base');
    execFileSync('git', ['init', '-q', '-b', 'main', source]);
    writeFileSync(join(source, 'layer.json'), '{}\n'); git(source, 'add', '.'); git(source, 'commit', '-qm', 'base');
    const base = git(source, 'rev-parse', 'HEAD');
    git(source, 'checkout', '-qb', 'pages'); writeFileSync(join(source, 'pages.txt'), 'one\n'); git(source, 'add', '.'); git(source, 'commit', '-qm', 'pages one');
    const pagesOne = git(source, 'rev-parse', 'HEAD');
    writeFileSync(join(source, 'pages.txt'), 'two\n'); git(source, 'commit', '-qam', 'pages two (not pinned)');
    const refsBefore = git(source, 'for-each-ref');

    const bundle = join(root, 'templates.bundle');
    writeFileSync(bundle, templateBundle([{ branch: 'main', commit: base }, { branch: 'pages', commit: pagesOne }], source));
    assert.equal(git(source, 'for-each-ref'), refsBefore, 'no temporary refs in the person\'s checkout');
    const heads = git(root, 'bundle', 'list-heads', bundle).split('\n').map(line => line.split(' ')).map(([commit, ref]) => [ref, commit]);
    assert.deepEqual(Object.fromEntries(heads), { 'refs/heads/main': base, 'refs/heads/pages': pagesOne }, 'the pins, not the branch tips');

    const clone = join(root, 'clone'); execFileSync('git', ['init', '-q', clone]);
    git(clone, 'fetch', '-q', bundle, '+refs/heads/*:refs/heads/*');
    assert.equal(git(clone, 'show', `${pagesOne}:pages.txt`), 'one');

    // Two pins on one branch at different commits keep both.
    const both = join(root, 'both.bundle');
    writeFileSync(both, templateBundle([{ branch: 'pages', commit: pagesOne }, { branch: 'pages', commit: base }], source));
    assert.match(git(root, 'bundle', 'list-heads', both), new RegExp(`refs/heads/pages-${base.slice(0, 7)}`));

    assert.throws(() => templateBundle([{ branch: 'main', commit: 'f'.repeat(40) }], source), error => error.status === 404 && /no commit ffffffffffff/.test(error.message));
    assert.throws(() => templateBundle([{ branch: '../x', commit: base }], source), error => error.status === 400);
    assert.throws(() => templateBundle([], source), error => error.status === 400);
    assert.throws(() => templateBundle([{ branch: 'main', commit: base }], join(root, 'nowhere')), error => error.status === 404);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('E1 (F11): a container commits as its person, with their GitHub noreply address when they signed in with GitHub', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, display_name TEXT NOT NULL)');
  db.prepare('INSERT INTO users VALUES (?, ?, ?)').run('u-ada', 'ada@example.com', 'Ada Lovelace');
  db.prepare('INSERT INTO users VALUES (?, ?, ?)').run('u-bo', null, 'Bo');
  assert.deepEqual(gitIdentity(db, 'u-ada'), { name: 'Ada Lovelace', email: 'ada@example.com' }, 'no GitHub table yet: the portal email');
  db.exec('CREATE TABLE github_identities (user_id TEXT PRIMARY KEY, login TEXT, github_user_id TEXT)');
  db.prepare('INSERT INTO github_identities VALUES (?, ?, ?)').run('u-ada', 'ada-l', '1815');
  assert.deepEqual(gitIdentity(db, 'u-ada'), { name: 'Ada Lovelace', email: '1815+ada-l@users.noreply.github.com' });
  assert.equal(gitIdentity(db, 'u-bo'), null, 'nothing to commit as: left for the person to set');
  assert.equal(gitIdentity(db, 'u-none'), null);
});

test('E2: closed items lose their container volumes; open items, running containers and other projects keep theirs', () => {
  const volumes = ['aludel-claude', 'aludel-tool-share-w-3-abc1234', 'aludel-tool-share-w-3-def5678', 'aludel-tool-share-w-4-abc1234',
    'aludel-tool-share-w-5', 'aludel-tool-share-w-6-abc1234', 'aludel-tool-share-extra-w-3-abc1234', 'aludel-tool-share-w-3-abc1234-old'];
  const containers = { 'aludel-tool-share-w-3-abc1234': 'c1 exited', 'aludel-tool-share-w-6-abc1234': 'c6 running' };
  const calls = [];
  const run = args => {
    calls.push(args.join(' '));
    if (args[0] === 'volume' && args[1] === 'ls') return volumes.join('\n');
    if (args[0] === 'ps') return containers[args[3].slice('volume='.length)] || '';
    return '';
  };
  const swept = sweepItemVolumes('tool-share', ref => ['W-3', 'W-5', 'W-6'].includes(ref), run);
  assert.deepEqual(swept.removed, ['aludel-tool-share-w-3-abc1234', 'aludel-tool-share-w-3-def5678', 'aludel-tool-share-w-5']);
  assert.deepEqual(swept.kept, [{ volume: 'aludel-tool-share-w-6-abc1234', reason: 'its container is still running' }]);
  assert.ok(calls.includes('rm c1'), 'its stopped container goes first');
  assert.ok(!calls.some(call => /w-4|claude|extra|old/.test(call) && call.startsWith('volume rm')), 'only this project\'s closed items');
  assert.deepEqual(sweepItemVolumes('tool-share', () => true, () => { throw new Error('docker: not found'); }), { removed: [], kept: [] }, 'no Docker, nothing to do');
});
