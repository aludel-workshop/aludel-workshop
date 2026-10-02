// T03-G2 (DEC-059): repository-mode outputs. A layer's output is files in its own repository, indexed into the Library by
// a pure indexer the layer owns, with integer revisions per entry across commits.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { commitOutputFile, currentFileEntries, fileEntry, fileEntryExists, initLayerFiles, readOutputFile } from '../server/layer-files.mjs';
import { initSourceReviews } from '../server/layer-api.mjs';
import { initLayerSource, mergeLayerBranch } from '../server/layer-source.mjs';
import { createMarkdownDefinition } from '../server/layer-registry.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const portalRoot = new URL('..', import.meta.url).pathname;
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t' } }).trim();

// A pure indexer: every note in outputs/notes.json is one entry, keyed by its x-aludel-id.
const indexer = `export function entries(files) {
  const text = files['outputs/notes.json'];
  if (!text) return [];
  const notes = JSON.parse(text).notes;
  if (!Array.isArray(notes)) throw new Error('notes must be a list');
  return notes.map(note => ({ id: note['x-aludel-id'], kind: 'note', title: note.title, data: { body: note.body || '' } }));
}
`;
const notes = list => JSON.stringify({ notes: list }, null, 2) + '\n';

function withNotesLayer(run) {
  const data = mkdtempSync(join(tmpdir(), 'aludel-layer-files-'));
  const old = { dir: process.env.MACHINE_DATA_DIR, on: process.env.MACHINE_LAYER_TEMPLATES_ENABLED };
  process.env.MACHINE_DATA_DIR = data; process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
  try {
    const db = openDatabase(join(data, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(data), workspaceRoot: join(data, 'w'), assetRoot: join(data, 'a'), createWorkspace: () => {}, know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const { token } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
    const { project } = flows.claimDraft(token, ada, ada);
    initLayerContract(db); initSourceReviews(db); initLayerSource(db); initLayerFiles(db);
    createMarkdownDefinition(db, ada.id, project.id, { name: 'Notes', template: 'base' });
    const repo = db.prepare("SELECT repository_path AS repo FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'notes'").get(project.id).repo;
    // The owner turns the base fork into a notes layer whose output is a file, and accepts it (as a merge would).
    const manifest = JSON.parse(git(repo, 'show', 'HEAD:layer.json'));
    Object.assign(manifest, { outputs: ['note'], files: { paths: ['outputs/notes.json'], kinds: ['note'], indexer: 'server/notes-index.mjs' } });
    mkdirSync(join(repo, 'outputs'), { recursive: true }); mkdirSync(join(repo, 'server'), { recursive: true });
    writeFileSync(join(repo, 'layer.json'), JSON.stringify(manifest, null, 2) + '\n');
    writeFileSync(join(repo, 'server/notes-index.mjs'), indexer);
    writeFileSync(join(repo, 'outputs/notes.json'), notes([{ 'x-aludel-id': 'note-alpha', title: 'Alpha', body: 'First thought.' }]));
    git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'Notes layer keeps its notes as a file');
    const head = git(repo, 'rev-parse', 'HEAD');
    db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'notes'").run(head, project.id);
    db.prepare("UPDATE layer_definitions SET output_kinds_json = ? WHERE project_id = ? AND layer_key = 'notes'").run(JSON.stringify(['note']), project.id);
    db.prepare('INSERT INTO layer_source_reviews VALUES (?, ?, ?, ?, ?, ?, ?)').run(project.id, 'notes', 'server/notes-index.mjs', createHash('sha256').update(indexer).digest('hex'), ada.name, new Date().toISOString(), null);
    run({ db, know, ada, id: project.id, repo, head, pool: library({ db, know }) });
  } finally {
    rmSync(data, { recursive: true, force: true });
    for (const [name, value] of [['MACHINE_DATA_DIR', old.dir], ['MACHINE_LAYER_TEMPLATES_ENABLED', old.on]]) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}

test('T03-G2: a layer\'s output files are Library entries with revisions per entry; a person\'s edit commits to main', () => withNotesLayer(({ db, ada, id, repo, head, pool }) => {
  const first = currentFileEntries(db, id, 'notes');
  assert.deepEqual(first.map(entry => [entry.id, entry.kind, entry.title, entry.revision]), [['note-alpha', 'note', 'Alpha', 1]]);
  const found = pool.search(id, ada.id, { q: 'first thought' }).results;
  assert.deepEqual(found.map(entry => [entry.ref, entry.source, entry.layer.key]), [['note-alpha', 'output', 'notes']]);
  assert.equal(pool.read(id, ada.id, 'note-alpha').data.body, 'First thought.');

  // A person edits the file: alpha changes, beta is added. Unchanged entries keep their revision.
  const file = readOutputFile(db, id, 'notes', 'outputs/notes.json');
  assert.equal(file.commit, head);
  const edited = commitOutputFile(db, { projectId: id, key: 'notes', path: 'outputs/notes.json', expectedCommit: head, author: ada.name,
    content: notes([{ 'x-aludel-id': 'note-alpha', title: 'Alpha', body: 'Second thought.' }, { 'x-aludel-id': 'note-beta', title: 'Beta' }]) });
  assert.notEqual(edited.commit, head);
  assert.equal(git(repo, 'rev-parse', 'main'), edited.commit, 'main moved to the edit');
  assert.equal(git(repo, 'log', '-1', '--format=%an', 'main'), 'Ada');
  assert.deepEqual(edited.entries.map(entry => [entry.id, entry.revision]).sort(), [['note-alpha', 2], ['note-beta', 1]]);
  const old = pool.read(id, ada.id, 'note-alpha', 1);
  assert.deepEqual([old.data.body, old.revision, old.currentRevision], ['First thought.', 1, 2], 'an old revision reads from its own commit');
  assert.equal(pool.pin(id, 'note-alpha').revision, 2);
  assert.ok(fileEntryExists(db, id, 'note-beta', ['note']));
  assert.ok(!fileEntryExists(db, id, 'note-beta', ['story']), 'a reference must name the right kind');

  // A stale base, a file outside the declared outputs, and content that does not index are refused; main stays put.
  const base = { projectId: id, key: 'notes', path: 'outputs/notes.json', author: ada.name };
  assert.throws(() => commitOutputFile(db, { ...base, expectedCommit: head, content: notes([]) }), { status: 409 });
  assert.throws(() => commitOutputFile(db, { ...base, path: 'layer.json', expectedCommit: edited.commit, content: '{}' }), { status: 404 });
  assert.throws(() => commitOutputFile(db, { ...base, expectedCommit: edited.commit, content: '{ not json' }), /does not index/);
  assert.throws(() => commitOutputFile(db, { ...base, expectedCommit: edited.commit, content: notes([{ 'x-aludel-id': 'Bad Id', title: 'x' }]) }), /does not index/);
  assert.equal(git(repo, 'rev-parse', 'main'), edited.commit);

  // Removing an entry leaves a tombstone: it no longer resolves, its old revision still reads.
  const removed = commitOutputFile(db, { ...base, expectedCommit: edited.commit, content: notes([{ 'x-aludel-id': 'note-alpha', title: 'Alpha', body: 'Second thought.' }]) });
  assert.deepEqual(removed.entries.map(entry => entry.id), ['note-alpha']);
  assert.throws(() => pool.read(id, ada.id, 'note-beta'), { status: 404 });
  assert.equal(pool.read(id, ada.id, 'note-beta', 1).title, 'Beta');
  assert.ok(!fileEntryExists(db, id, 'note-beta', ['note']));
  assert.equal(fileEntry(db, id, 'note-alpha').revision, 2, 'an unchanged entry keeps its revision across commits');
}));

test('T03-G2: an agent\'s branch merges only when its output files still index, and the index follows the merge', () => withNotesLayer(({ db, know, ada, id, repo, head }) => {
  const branch = (name, content) => {
    git(repo, 'checkout', '-q', '-b', name, head);
    writeFileSync(join(repo, 'outputs/notes.json'), content);
    git(repo, 'commit', '-qam', name);
    const commit = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'checkout', '-q', 'main');
    return { branch: name, commit, base: head, files: [{ path: 'outputs/notes.json', status: 'modified' }] };
  };
  const merge = source => mergeLayerBranch(db, { projectId: id, key: 'notes', source, reviewer: ada.name, workId: null, workRef: 'W-1', catalogs, recordsOf: kind => know.list(id, kind) });
  assert.equal(currentFileEntries(db, id, 'notes')[0].revision, 1, 'the Library has seen the first version');
  assert.throws(() => merge(branch('work/w-1-bad', '{ broken')), /output files do not index/);
  assert.equal(git(repo, 'rev-parse', 'main'), head, 'a refused merge leaves main alone');
  const good = merge(branch('work/w-1-good', notes([{ 'x-aludel-id': 'note-alpha', title: 'Alpha, revised by an agent' }])));
  assert.equal(git(repo, 'rev-parse', 'main'), good.commit);
  assert.deepEqual(currentFileEntries(db, id, 'notes').map(entry => [entry.id, entry.title, entry.revision]), [['note-alpha', 'Alpha, revised by an agent', 2]]);
}));

test('T03-G2: an indexer runs only as reviewed bytes, and a manifest cannot claim files outside outputs/', () => withNotesLayer(({ db, id, repo }) => {
  writeFileSync(join(repo, 'server/notes-index.mjs'), indexer.replace("kind: 'note'", "kind: 'note', "));
  git(repo, 'commit', '-qam', 'Unreviewed indexer change');
  db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'notes'").run(git(repo, 'rev-parse', 'HEAD'), id);
  assert.throws(() => currentFileEntries(db, id, 'notes'), /has not passed review/);

  const manifest = JSON.parse(git(repo, 'show', 'HEAD:layer.json'));
  manifest.files.paths = ['layer.json'];
  writeFileSync(join(repo, 'layer.json'), JSON.stringify(manifest));
  git(repo, 'commit', '-qam', 'Claim the manifest as an output');
  db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'notes'").run(git(repo, 'rev-parse', 'HEAD'), id);
  assert.throws(() => currentFileEntries(db, id, 'notes'), /Invalid layer file outputs/);
}));
