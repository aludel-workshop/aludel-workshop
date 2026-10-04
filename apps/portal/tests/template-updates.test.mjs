import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { templateMerge } from '../server/template-updates.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
const commit = (cwd, message) => { git(cwd, 'add', '-A'); git(cwd, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-qm', message); return git(cwd, 'rev-parse', 'HEAD'); };
const write = (root, files) => { for (const [path, text] of Object.entries(files)) { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); } };
const show = (cwd, rev, path) => git(cwd, 'show', `${rev}:${path}`);
const lines = (...values) => values.join('\n') + '\n';

// JOURNEYS-01 J8: Code's package lives under .aludel/ in the app's repository, with no history shared with the template.
test('a template update merges the template\'s own files three ways and leaves the project\'s changes and outputs alone', () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-template-merge-'));
  try {
    const template = join(root, 'template'), app = join(root, 'app');
    mkdirSync(template); git(template, 'init', '-q', '-b', 'code');
    const v1 = { 'layer.json': lines('{', '  "key": "code",', '  "name": "Code"', '}'), 'server/index.mjs': lines('one', 'two', 'three', 'four', 'five'),
      'ui/view.ts': lines('alpha', 'beta'), 'knowledge/charter.md': lines('# Charter'), 'outputs/journeys.json': lines('{ "journeys": [] }'), 'server/old.mjs': lines('old') };
    write(template, v1); const from = commit(template, 'v1');
    write(template, { 'server/index.mjs': lines('one', 'two', 'three', 'four', 'FIVE'), 'ui/view.ts': lines('alpha', 'BETA'), 'knowledge/charter.md': lines('# Charter', 'More.'), 'server/new.mjs': lines('new') });
    rmSync(join(template, 'server/old.mjs')); const to = commit(template, 'v2');
    mkdirSync(app); git(app, 'init', '-q', '-b', 'main');
    write(app, { 'README.md': 'App\n', ...Object.fromEntries(Object.entries(v1).map(([path, text]) => [`.aludel/${path}`, text])) });
    // The project's own edits since install: a line of the server the template didn't touch, the same UI line the template
    // changed, its own journeys, and a changed manifest name.
    write(app, { '.aludel/server/index.mjs': lines('ONE', 'two', 'three', 'four', 'five'), '.aludel/ui/view.ts': lines('alpha', 'gamma'),
      '.aludel/outputs/journeys.json': lines('{ "journeys": [{ "id": "invite" }] }'), '.aludel/layer.json': lines('{', '  "key": "code",', '  "name": "Platform"', '}') });
    const main = commit(app, 'app with its layer');
    git(app, 'fetch', '-q', template, `${from}:refs/aludel/template-from`, `${to}:refs/aludel/template`);
    const merged = templateMerge(app, { main, root: '.aludel/', from, to, template: 'code' });
    assert.deepEqual(merged.changed, ['.aludel/knowledge/charter.md', '.aludel/server/index.mjs', '.aludel/server/new.mjs', '.aludel/server/old.mjs', '.aludel/ui/view.ts']);
    assert.deepEqual(merged.conflicts, ['.aludel/ui/view.ts'], 'both changed the same line');
    assert.equal(show(app, merged.commit, '.aludel/server/index.mjs'), 'ONE\ntwo\nthree\nfour\nFIVE', 'both kept');
    assert.equal(show(app, merged.commit, '.aludel/knowledge/charter.md'), '# Charter\nMore.', 'template change taken');
    assert.equal(show(app, merged.commit, '.aludel/server/new.mjs'), 'new');
    assert.throws(() => show(app, merged.commit, '.aludel/server/old.mjs'), 'a file the template removed and the project never changed goes');
    assert.match(show(app, merged.commit, '.aludel/ui/view.ts'), /<<<<<<< this project\ngamma\n[|]{7} template [0-9a-f]{12}\nbeta\n=======\nBETA\n>>>>>>> template/);
    assert.equal(show(app, merged.commit, '.aludel/outputs/journeys.json'), '{ "journeys": [{ "id": "invite" }] }', 'outputs untouched');
    assert.match(show(app, merged.commit, '.aludel/layer.json'), /"name": "Platform"/);
    assert.equal(show(app, merged.commit, 'README.md'), 'App', 'the app is untouched');
    assert.equal(git(app, 'rev-parse', `${merged.commit}^`), main);
    assert.match(git(app, 'log', '-1', '--format=%B', merged.commit), new RegExp(`Aludel-Template: code ${to}`));
    assert.equal(git(app, 'rev-parse', 'main'), main, 'main does not move');
    // Already up to date: nothing to commit.
    assert.deepEqual(templateMerge(app, { main: merged.commit, root: '.aludel/', from: to, to, template: 'code' }), { commit: null, changed: [], conflicts: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
