// LAYER-BINDINGS-01 step 2: the design-system binding end to end, on the pinned Design and Pages templates. Discover proposes
// it, accepting it fills Pages' kit through Pages' own adapter, a Design change auto-applies and is recorded, and drift in
// Pages' copy is assessed, decided and rectified.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { bindingRecords, initBindings } from '../server/binding-records.mjs';
import { bindingRoutines, entryDigest } from '../server/binding-routines.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { applyOperation, initLayerApi, layerApi } from '../server/layer-api.mjs';
import { initLayerContract, updateLayerInstance } from '../server/layer-contract.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const templates = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1';

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'aludel-binding-routines-'));
  const old = process.env.MACHINE_DATA_DIR;
  process.env.MACHINE_DATA_DIR = dir;
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'bind@example.com', name: 'Binding owner', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
    const { project } = flow.claimDraft(token, owner, owner);
    initLayerContract(db); initBindings(db);
    know.ensureDesign(project.id);
    const pool = library({ db, know });
    const store = bindingRecords({ db });
    run({ db, know, owner, id: project.id, pool, store, routines: bindingRoutines({ db, know, pool, store }) });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (old === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = old;
  }
}
const kit = (pool, id) => pool.search(id, null, { kind: 'kit_item', source: 'output', limit: 100, withData: true }).results;
const designEntries = (pool, id) => ['design_tokens', 'component', 'brand_asset'].flatMap(kind => pool.search(id, null, { layer: 'design', kind, source: 'output', limit: 100, withData: true }).results);
const workFor = (db, bindingId) => db.prepare("SELECT id, layer, state, title, context_json FROM layer_work_items WHERE json_extract(context_json, '$.binding') = ? ORDER BY number").all(bindingId)
  .map(row => ({ ...row, context: JSON.parse(row.context_json) }));

test('the design-system binding: proposed by Discover, accepted by the owner, imported and kept current through Pages\' adapter', { skip: !templates && 'needs the pinned templates' }, () => fixture(({ db, know, owner, id, pool, store, routines }) => {
  // Pages works with no inputs: before any binding its kit is empty.
  assert.equal(kit(pool, id).length, 0, 'no binding, no kit');

  const [proposed] = routines.discover(id);
  assert.ok(proposed, 'Discover proposes the binding');
  assert.equal(routines.discover(id).length, 0, 'once');
  assert.equal(proposed.lifecycle, 'proposed');
  assert.deepEqual(proposed.participants.map(p => [p.layer.key, p.facet, p.role]), [['design', 'kit', 'authority'], ['pages', 'kit', 'replica']]);
  assert.deepEqual(proposed.adapters.map(adapter => [adapter.id, adapter.reads]), [['aludel-kit', 'aludel.design-kit']]);
  const review = workFor(db, proposed.id);
  assert.deepEqual(review.map(item => [item.layer, item.state]), [['work', 'suggested']], 'the proposal is Work to accept, change or dismiss');
  assert.deepEqual(routines.watch(id, proposed.id).applied, [], 'a proposal imports nothing');
  assert.equal(kit(pool, id).length, 0);

  // Accepting it starts the first reconcile: every Design entry lands in Pages' kit, applied as Aludel and recorded.
  store.lifecycle(id, owner.id, proposed.id, { expectedRevision: 1, lifecycle: 'reconciling', rationale: 'Pages draws with Design\'s kit.' });
  const first = routines.watch(id, proposed.id);
  const design = designEntries(pool, id);
  assert.ok(design.length > 5, 'Design seeded its kit');
  assert.equal(first.applied.length, design.length);
  assert.equal(first.raised.length, 0, 'mechanical import needs no Work');
  const copy = kit(pool, id);
  assert.deepEqual(copy.map(entry => entry.data.sourceRef).sort(), design.map(entry => entry.ref).sort(), 'one kit item per Design entry');
  assert.ok(copy.every(entry => entry.layer.key === 'pages'), 'the copy is Pages\' own output');
  const tokens = know.list(id, 'design_tokens')[0];
  const tokenItem = copy.find(entry => entry.data.sourceRef === tokens.id);
  assert.equal(tokenItem.data.group, 'tokens');
  assert.equal(tokenItem.data.sourceDigest, entryDigest(design.find(entry => entry.ref === tokens.id).data));
  assert.match(db.prepare('SELECT rationale, author FROM knowledge_revisions WHERE record_id = ? ORDER BY revision DESC').get(tokenItem.ref).rationale, /The app kit|binding/i);
  assert.equal(db.prepare('SELECT author FROM knowledge_revisions WHERE record_id = ?').get(tokenItem.ref).author, 'Aludel');
  assert.equal(first.activated, true, 'with everything matched and no Work open, the first reconcile completes');
  assert.equal(store.read(id, owner.id, proposed.id).lifecycle, 'active');
  assert.match(store.history(id, owner.id, proposed.id).at(-1).rationale, /First reconcile complete/);
  const again = routines.watch(id, proposed.id);
  assert.deepEqual([again.applied, again.raised, again.settled], [[], [], []], 'nothing left to do');
  const status = routines.status(id, owner.id, proposed.id);
  assert.ok(status.status.every(row => row.state === 'matched'), 'every entry is matched');
  assert.equal(status.events.filter(event => event.kind === 'applied').length, design.length, 'automatic changes are recorded on the binding');

  // A Design change auto-applies to Pages' copy.
  const current = know.list(id, 'design_tokens')[0];
  applyOperation({ db, know, api: layerApi(db, id, 'design'), projectId: id, operationId: 'setTokens', author: owner.name,
    body: { ...current, id: undefined, kind: undefined, parentId: undefined, position: undefined, revision: undefined, updatedAt: undefined,
      faces: { brand: 'Georgia, serif', plain: current.faces.plain }, fromLook: false, expectedRevision: current.revision } });
  const changed = routines.watch(id, proposed.id);
  assert.deepEqual(changed.applied.map(action => [action.kind, action.entry, action.event]), [['apply', current.id, 'changed']]);
  assert.equal(kit(pool, id).find(entry => entry.data.sourceRef === current.id).data.value.faces.brand, 'Georgia, serif');

  // Drift: Pages' copy changes outside the binding. With no drift policy it is assessed; the owner rectifies it, and closing
  // the rectify Work re-imports Design's version through the adapter.
  const item = kit(pool, id).find(entry => entry.data.sourceRef === current.id);
  const stored = know.get(id, item.ref);
  const edited = { ...item.data.value, faces: { brand: 'Comic Sans MS', plain: 'x' } };
  know.update(id, item.ref, { value: edited }, { expectedRevision: stored.revision, author: 'Someone outside the process',
    prepared: { data: { group: item.data.group, sourceRef: item.data.sourceRef, sourceDigest: item.data.sourceDigest, source: item.data.source, value: edited }, references: [] } });
  assert.equal(know.get(id, item.ref).revision, stored.revision + 1);
  const drift = routines.watch(id, proposed.id);
  assert.deepEqual(drift.raised.map(work => [work.layer, work.context.action.kind]), [['work', 'assess']]);
  assert.deepEqual(routines.watch(id, proposed.id).raised, [], 'an open assessment is not raised twice');
  assert.throws(() => routines.decideAssessment(id, owner.id, proposed.id, drift.raised[0].id, 'ignore'), /adopt or rectify/);
  const decided = routines.decideAssessment(id, owner.id, proposed.id, drift.raised[0].id, 'rectify');
  assert.deepEqual(decided.raised.map(work => [work.layer, work.context.action.kind]), [['pages', 'rectify']]);
  know.appendLog(decided.raised[0].id, 'Done: confirmed', { state: 'done' });
  const restored = routines.watch(id, proposed.id);
  assert.deepEqual(restored.settled, [decided.raised[0].id]);
  assert.deepEqual(restored.applied.map(action => action.entry), [current.id], 'the authority\'s version is imported again');
  assert.equal(kit(pool, id).find(entry => entry.data.sourceRef === current.id).data.value.faces.brand, 'Georgia, serif');
  assert.ok(routines.status(id, owner.id, proposed.id).status.every(row => row.state === 'matched'));

  // A removed Design entry leaves Pages' copy too.
  const slogan = applyOperation({ db, know, api: layerApi(db, id, 'design'), projectId: id, operationId: 'createBrandAsset', author: owner.name,
    body: { asset: { name: 'Slogan', type: 'text', text: 'Borrow, don’t buy.' } } });
  assert.deepEqual(routines.watch(id, proposed.id).applied.map(action => action.event), ['added']);
  know.remove(id, slogan.id);
  assert.deepEqual(routines.watch(id, proposed.id).applied.map(action => action.event), ['removed']);
  assert.ok(!kit(pool, id).some(entry => entry.data.sourceRef === slogan.id));

  // Switching Design off is not a deletion: the binding holds and Pages keeps its copy.
  const before = kit(pool, id).length;
  updateLayerInstance(db, owner.id, id, 'design', { enabled: false });
  assert.deepEqual(routines.watch(id, proposed.id).degraded, ['design-kit']);
  assert.equal(kit(pool, id).length, before, 'Pages keeps every kit item');
  assert.deepEqual(routines.status(id, owner.id, proposed.id).degraded, ['design-kit']);
  updateLayerInstance(db, owner.id, id, 'design', { enabled: true });
  const back = routines.watch(id, proposed.id);
  assert.deepEqual([back.applied, back.raised, back.degraded], [[], [], undefined], 'back in step with nothing to do');
}));

test('a dismissed proposal is not proposed again, and nothing binds while the proposal waits', { skip: !templates && 'needs the pinned templates' }, () => fixture(({ owner, id, pool, store, routines }) => {
  const [proposed] = routines.discover(id);
  store.lifecycle(id, owner.id, proposed.id, { expectedRevision: 1, lifecycle: 'retired', rationale: 'This project keeps Pages\' kit by hand.' });
  assert.equal(routines.discover(id).length, 0);
  assert.deepEqual(routines.watchProject(id), []);
  assert.equal(kit(pool, id).length, 0);
}));
