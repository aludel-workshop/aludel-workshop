// T03-DATA (DEC-059): Data is a fork of the data template and keeps its contract as one OpenAPI file in its repository.
// The host's record calls, packs, Library, references and history keep working on it; existing projects adopt their records.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { currentFileEntries, fileEntry } from '../server/layer-files.mjs';
import { initLayerSource, mergeLayerBranch } from '../server/layer-source.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const portalRoot = new URL('..', import.meta.url).pathname;
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Data agent', GIT_AUTHOR_EMAIL: 'data@aludel.invalid', GIT_COMMITTER_NAME: 'Data agent', GIT_COMMITTER_EMAIL: 'data@aludel.invalid' } }).trim();

function withProject(run, { templates = true } = {}) {
  const data = mkdtempSync(join(tmpdir(), 'aludel-data-layer-'));
  const old = { dir: process.env.MACHINE_DATA_DIR, on: process.env.MACHINE_LAYER_TEMPLATES_ENABLED };
  process.env.MACHINE_DATA_DIR = data;
  if (templates) process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1'; else delete process.env.MACHINE_LAYER_TEMPLATES_ENABLED;
  try {
    const db = openDatabase(join(data, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerSource(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(data), workspaceRoot: join(data, 'w'), assetRoot: join(data, 'a'), createWorkspace: () => {}, know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const { token } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
    const { project } = flows.claimDraft(token, ada, ada);
    flows.saveFeatures(ada, project.id, { picks: ['accounts', 'messaging'] });
    const repo = () => db.prepare("SELECT repository_path AS repo FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'data'").get(project.id)?.repo;
    const contract = () => JSON.parse(git(repo(), 'show', 'main:outputs/openapi.json'));
    run({ db, know, flows, ada, id: project.id, dataDir: data, repo, contract, enableTemplates: () => { process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1'; } });
  } finally {
    rmSync(data, { recursive: true, force: true });
    for (const [name, value] of [['MACHINE_DATA_DIR', old.dir], ['MACHINE_LAYER_TEMPLATES_ENABLED', old.on]]) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}

test('T03-DATA: a new project\'s Data is a fork whose contract file holds the pack; no Data rows are left as records', () => withProject(({ db, know, id, repo, contract }) => {
  assert.ok(repo(), 'Data has its own repository');
  assert.match(git(repo(), 'log', '--format=%s', 'main'), /Seeded by the Accounts story pack/, 'the pack arrived as a commit');
  const doc = contract();
  assert.ok(doc.components.schemas.Account?.['x-aludel-id'].startsWith('obj-'), 'the Accounts pack is in the file');
  assert.deepEqual(Object.keys(doc.components.schemas.Account.properties), ['email', 'name']);
  assert.ok(doc.paths['/api/sign-up'].post['x-aludel-id'].startsWith('opr-'));
  assert.ok(doc['x-aludel-access'].length >= 5);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind IN ('data_object','data_operation','access_rule')").get(id).n, 0);
  // The host reads the file as records, so every existing consumer sees the same contract.
  const account = know.list(id, 'data_object').find(object => object.name === 'Account');
  assert.equal(account.id, doc.components.schemas.Account['x-aludel-id']);
  assert.equal(know.get(id, account.id).name, 'Account');
  assert.equal(know.openApi(id).components.schemas.Account.type, 'object');
}));

test('T03-DATA: record calls on Data become commits as the person, checked by the Data layer\'s rules', () => withProject(({ know, ada, id, repo, contract }) => {
  const account = know.list(id, 'data_object').find(object => object.name === 'Account');
  const before = git(repo(), 'rev-parse', 'main');
  const tool = know.insert(id, 'data_object', { name: 'Tool', description: 'Something a neighbour lends.', schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    relations: [{ name: 'lender', target: account.id, cardinality: 'one', owner: true }] }, { author: ada.name, rationale: 'Tools are what people lend' });
  assert.match(tool.id, /^obj-/);
  assert.equal(tool.revision, 1);
  assert.notEqual(git(repo(), 'rev-parse', 'main'), before);
  assert.equal(git(repo(), 'log', '-1', '--format=%an|%s', 'main'), `${ada.name}|Tools are what people lend`);
  assert.deepEqual(contract().components.schemas.Tool['x-aludel-relations'], [{ name: 'lender', target: '#/components/schemas/Account', cardinality: 'one', owner: true }]);

  const renamed = know.update(id, tool.id, { name: 'Gear' }, { expectedRevision: 1, author: ada.name, rationale: 'Gear, not tools' });
  assert.equal(renamed.revision, 2);
  assert.equal(renamed.id, tool.id, 'a rename keeps the id');
  assert.ok(contract().components.schemas.Gear && !contract().components.schemas.Tool);
  assert.throws(() => know.update(id, tool.id, { description: 'x' }, { expectedRevision: 1 }), { status: 409 });
  assert.throws(() => know.insert(id, 'data_object', { name: 'tool' }), /Object name/, 'the Data layer\'s rules apply');
  assert.throws(() => know.insert(id, 'data_object', { name: 'Loan', relations: [{ name: 'item', target: 'obj-00000000', cardinality: 'one' }] }), { status: 404 });
  assert.throws(() => know.insert(id, 'data_object', { name: 'Loan', stories: ['sto-00000000'] }), { status: 404 }, 'a story reference must exist in the Library');
  const history = know.history(tool.id);
  assert.deepEqual(history.map(entry => [entry.revision, entry.author, entry.rationale]), [[2, ada.name, 'Gear, not tools'], [1, ada.name, 'Tools are what people lend']]);
  assert.equal(know.revisionData(tool.id, 1).name, 'Tool');

  // A Pages section can point at a Data entry; the reference resolves through the Library.
  const page = know.insert(id, 'page', { label: 'Gear', icon: 'build', pageType: 'detail', status: 'planned' });
  assert.ok(know.update(id, page.id, { sections: [{ name: 'Gear', data: [tool.id], stories: [] }] }, { expectedRevision: page.revision }));

  // Deleting lets go of it everywhere, as a record would.
  know.remove(id, tool.id);
  assert.equal(know.get(id, tool.id), null);
  assert.ok(!contract().components.schemas.Gear);
  assert.deepEqual(know.get(id, page.id).sections[0].data, [], 'the page let go of the deleted entry');
}));

test('T03-DATA: the Library publishes Data entries from the file; unselecting a pack removes its untouched entries in one commit', () => withProject(({ db, know, flows, ada, id, repo }) => {
  const pool = library({ db, know });
  const account = pool.search(id, ada.id, { q: 'Account', kind: 'data_object' }).results.find(entry => entry.title === 'Account');
  assert.equal(account.layer.key, 'data');
  assert.equal(pool.read(id, ada.id, account.ref).data.name, 'Account');
  const messaging = know.list(id, 'data_object').filter(object => object.pack === 'Messaging');
  assert.ok(messaging.length);
  const commits = Number(git(repo(), 'rev-list', '--count', 'main'));
  flows.saveFeatures(ada, id, { picks: ['accounts'] });
  assert.equal(know.list(id, 'data_object').filter(object => object.pack === 'Messaging').length, 0);
  assert.equal(Number(git(repo(), 'rev-list', '--count', 'main')), commits + 1, 'the pack left in one commit');
  assert.ok(currentFileEntries(db, id, 'data').every(entry => entry.data.pack !== 'Messaging'));
}));

test('T03-DATA: an existing project adopts its Data records into the file with ids and revisions intact', () => withProject(({ db, know, ada, id, repo, contract, enableTemplates }) => {
  assert.equal(repo(), undefined, 'records mode first');
  const account = know.list(id, 'data_object').find(object => object.name === 'Account');
  const edited = know.update(id, account.id, { description: 'Someone who can sign in.' }, { expectedRevision: account.revision, author: ada.name, rationale: 'Say what it is' });
  const counts = Object.fromEntries(['data_object', 'data_operation', 'access_rule'].map(kind => [kind, know.list(id, kind).length]));
  enableTemplates();
  initLayerContract(db);
  assert.ok(repo(), 'startup forked Data');
  assert.equal(git(repo(), 'log', '-1', '--format=%s', 'main'), `Adopt ${Object.values(counts).reduce((a, b) => a + b, 0)} existing records into outputs/openapi.json`);
  assert.deepEqual(Object.fromEntries(Object.keys(counts).map(kind => [kind, know.list(id, kind).length])), counts);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind IN ('data_object','data_operation','access_rule')").get(id).n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM knowledge_records_archive WHERE project_id = ?").get(id).n, Object.values(counts).reduce((a, b) => a + b, 0), 'the records are archived, not lost');
  const adopted = know.get(id, account.id);
  assert.equal(adopted.revision, edited.revision, 'the revision continues, so existing pins stay current');
  assert.equal(adopted.description, 'Someone who can sign in.');
  assert.equal(contract().components.schemas.Account['x-aludel-id'], account.id);
  assert.equal(know.revisionData(account.id, 1).description, account.description, 'the record\'s earlier revision still reads');
  assert.equal(fileEntry(db, id, account.id).currentRevision, edited.revision);
  const next = know.update(id, account.id, { description: 'Someone with an account.' }, { expectedRevision: edited.revision, author: ada.name, rationale: 'Shorter' });
  assert.equal(next.revision, edited.revision + 1);
  assert.deepEqual(know.history(account.id).slice(0, 2).map(entry => [entry.revision, entry.rationale]), [[edited.revision + 1, 'Shorter'], [edited.revision, 'Say what it is']]);
  initLayerContract(db);
  assert.equal(know.get(id, account.id).revision, edited.revision + 1, 'a second startup adopts nothing twice');
}, { templates: false }));


test('T03-DATA: an agent branch changes the Data contract only after a checked merge', () => withProject(({ db, know, ada, id, repo, contract }) => {
  const base = git(repo(), 'rev-parse', 'main');
  const account = know.list(id, 'data_object').find(object => object.name === 'Account');
  const branch = (name, change) => {
    git(repo(), 'checkout', '-q', '-b', name, base);
    const doc = contract();
    change(doc);
    writeFileSync(join(repo(), 'outputs/openapi.json'), JSON.stringify(doc, null, 2) + '\n');
    git(repo(), 'commit', '-qam', name);
    const commit = git(repo(), 'rev-parse', 'HEAD');
    git(repo(), 'checkout', '-q', 'main');
    return { branch: name, commit, base, files: [{ path: 'outputs/openapi.json', status: 'modified' }] };
  };
  const merge = source => mergeLayerBranch(db, { projectId: id, key: 'data', source, reviewer: ada.name, workId: null, workRef: 'W-DATA', catalogs, recordsOf: kind => know.list(id, kind) });
  const bad = branch('work/w-data-bad', doc => { doc.components.schemas.Account['x-aludel-relations'] = [{ name: 'missing', target: '#/components/schemas/Absent', cardinality: 'one' }]; });
  assert.throws(() => merge(bad), /output files do not index/);
  assert.equal(git(repo(), 'rev-parse', 'main'), base, 'rejected branch leaves main unchanged');
  const good = branch('work/w-data-good', doc => { doc.components.schemas.Account.description = 'An account holder, clarified by Data.'; });
  const accepted = merge(good);
  assert.equal(git(repo(), 'rev-parse', 'main'), accepted.commit);
  assert.equal(know.get(id, account.id).description, 'An account holder, clarified by Data.');
  assert.equal(know.get(id, account.id).revision, account.revision + 1);
}));


test('T03-DATA: a failed adoption restores main and can be retried without losing records', () => withProject(({ db, know, id, dataDir, repo, enableTemplates }) => {
  const before = know.list(id, 'data_object').map(entry => [entry.id, entry.revision]).sort((a, b) => a[0].localeCompare(b[0]));
  db.exec('CREATE TABLE knowledge_records_archive (only_column TEXT)');
  enableTemplates();
  assert.throws(() => initLayerContract(db), /columns|values|archive/i);
  assert.equal(repo(), undefined, 'the outer transaction also rolled back the repository binding');
  const instance = db.prepare("SELECT instance_id AS id FROM layer_instances WHERE project_id = ? AND layer_key = 'data'").get(id).id;
  const orphan = join(dataDir, 'layer-repos', createHash('sha256').update(id).digest('hex').slice(0, 20), instance);
  const pin = git(orphan, 'rev-parse', 'template/data');
  assert.equal(git(orphan, 'rev-parse', 'main'), pin, 'failed SQLite archive rolls back the Git ref');
  assert.deepEqual(know.list(id, 'data_object').map(entry => [entry.id, entry.revision]).sort((a, b) => a[0].localeCompare(b[0])), before);
  db.exec('DROP TABLE knowledge_records_archive');
  db.close();
  const restarted = openDatabase(join(dataDir, 'machine.sqlite'));
  initWorkflow(restarted); ensureProductWorkspace(restarted); initAccounts(restarted); initOnboarding(restarted); initKnowledge(restarted); initPagesLayerApp(restarted);
  initLayerContract(restarted);
  const rebound = restarted.prepare("SELECT repository_path AS repo FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'data'").get(id)?.repo;
  assert.equal(rebound, orphan, 'restart rebinds the exact clean orphan');
  const current = knowledge({ db: restarted, catalogs, packs: catalogs.packs });
  assert.deepEqual(current.list(id, 'data_object').map(entry => [entry.id, entry.revision]).sort((a, b) => a[0].localeCompare(b[0])), before);
  restarted.close();
}, { templates: false }));
