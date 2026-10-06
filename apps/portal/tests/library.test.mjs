// T03-G1 (DEC-059): the Library pools every enabled layer's outputs and Knowledge with the Library's own research and documents, and is how layers read each other.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerContract, updateLayerInstance } from '../server/layer-contract.mjs';
import { library, recordOwner } from '../server/library.mjs';
import { frameAllows } from '../server/layer-ui.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const portalRoot = new URL('..', import.meta.url).pathname;
const catalogs = loadCatalogs(join(portalRoot, 'config'));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-library-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const eve = createUser(db, { email: 'eve@example.com', name: 'Eve', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveFeatures(ada, project.id, { picks: ['accounts'] });
  initLayerContract(db);
  know.ensurePlan(project.id);
  return { db, know, ada, eve, id: project.id, pool: library({ db, know }) };
}

test('T03-G1: outputs, Knowledge and research are one searchable pool, each entry naming its owning instance', () => {
  const { db, know, ada, id, pool } = fixture();
  const source = know.insert(id, 'source', { title: 'Neighbourhood tool survey', type: 'note', body: 'Most drills are used for thirteen minutes.' });
  for (const kind of ['output', 'knowledge', 'library']) assert.ok(pool.search(id, ada.id, { source: kind }).total > 0, `pool has ${kind} entries`);
  assert.equal(pool.search(id, ada.id, {}).total, ['output', 'knowledge', 'library'].reduce((sum, kind) => sum + pool.search(id, ada.id, { source: kind }).total, 0));

  // An output: the Accounts pack's data object, owned by the Data instance.
  const dataInstance = db.prepare("SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = 'data'").get(id).instance_id;
  const account = pool.search(id, ada.id, { q: 'Account', kind: 'data_object' }).results.find(entry => entry.title === 'Account');
  assert.equal(account.layer.key, 'data');
  assert.equal(account.layer.instanceId, dataInstance);
  const read = pool.read(id, ada.id, account.ref);
  assert.equal(read.data.name, 'Account');
  assert.equal(read.currentRevision, read.revision);

  // Knowledge: every layer's charter is an entry, readable with its content (kept in the database, or at the layer's pin).
  const charter = pool.search(id, ada.id, { layer: 'product', source: 'knowledge' }).results.find(entry => ['k:product:identity', 'k:product:knowledge/charter.md'].includes(entry.ref));
  assert.ok(charter, 'Vision charter is published');
  assert.match(pool.read(id, ada.id, charter.ref).content, /# /);

  // Research stays the Library's own content.
  const survey = pool.search(id, ada.id, { q: 'thirteen minutes' }).results;
  assert.deepEqual(survey.map(entry => [entry.ref, entry.source, entry.layer.key]), [[source.id, 'library', 'library']]);

  // Filters and bad input.
  assert.ok(pool.search(id, ada.id, { source: 'knowledge' }).results.every(entry => entry.source === 'knowledge'));
  assert.throws(() => pool.search(id, ada.id, { q: 'x' }), { status: 400 });
  assert.throws(() => pool.search(id, ada.id, { source: 'secrets' }), { status: 400 });
});

test('T03-G1: reads pin revisions, stay inside the project and installed layers, and refuse non-members', () => {
  const { db, know, ada, eve, id, pool } = fixture();
  const story = know.list(id, 'story')[0];
  know.update(id, story.id, { ...story, title: `${story.title} (revised)` }, { expectedRevision: story.revision });
  const old = pool.read(id, ada.id, story.id, story.revision);
  assert.equal(old.revision, story.revision);
  assert.equal(old.currentRevision, story.revision + 1, 'a stale pin is visible');
  assert.equal(old.data.title, story.title);
  const pin = pool.pin(id, story.id);
  assert.equal(pin.layerInstanceId, db.prepare("SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = 'product'").get(id).instance_id);
  assert.equal(pin.revision, story.revision + 1);
  assert.equal(recordOwner(db, id, { kind: 'story', layer_instance_id: null }).key, 'product');

  assert.throws(() => pool.search(id, eve.id, {}), { status: 404 });
  assert.throws(() => pool.read(id, eve.id, story.id), { status: 404 });
  assert.throws(() => pool.read(id, ada.id, 'sto-00000000'), { status: 404 });
  assert.throws(() => pool.read(id, ada.id, 'k:nothing:identity'), { status: 404 });

  // A disabled layer publishes nothing.
  const object = know.list(id, 'data_object')[0];
  updateLayerInstance(db, ada.id, id, 'data', { enabled: false });
  assert.equal(pool.search(id, ada.id, { layer: 'data' }).total, 0);
  assert.throws(() => pool.read(id, ada.id, object.id), { status: 404 });
});

test('T03-G1: layer frames may search and read the Library, and nothing else new', () => {
  const allow = (method, rest) => frameAllows({ key: 'pages', projectId: 'p1', method, pathname: `/api/projects/p1${rest}` });
  assert.equal(allow('GET', '/library'), true);
  assert.equal(allow('GET', '/library/entry'), true);
  assert.equal(allow('POST', '/library'), false);
  assert.equal(allow('GET', '/library/other'), false);
  // T03-G2: a layer's own output files, but never another layer's.
  assert.equal(allow('GET', '/layers/pages/files'), true);
  assert.equal(allow('PUT', '/layers/pages/files'), true);
  assert.equal(allow('PUT', '/layers/data/files'), false);
  assert.equal(allow('DELETE', '/layers/pages/files'), false);
});
