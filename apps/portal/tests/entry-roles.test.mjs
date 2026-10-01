// LAYER-BINDINGS-01 step 3, R3: the host side of roles. Entries carry their role in the Library and in a layer's API reads;
// a person's or agent's write to an entry in a replica or ceded facet is refused, while the binding's imports still write;
// two instances owning one kind never mix; and a refacet's preflight finds other layers' references into what moves.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { bindingRecords, initBindings } from '../server/binding-records.mjs';
import { bindingRoutines } from '../server/binding-routines.mjs';
import { referencesTo } from '../server/entry-roles.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { applyOperation, initLayerApi, layerApi, stageOperation } from '../server/layer-api.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { ensureLayerPackage } from '../server/layer-package.mjs';
import { initLayerSource } from '../server/layer-source.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { refacets } from '../server/refacets.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const skip = process.env.MACHINE_LAYER_TEMPLATES_ENABLED !== '1' && 'needs the pinned templates';

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'aludel-entry-roles-'));
  const old = process.env.MACHINE_DATA_DIR;
  process.env.MACHINE_DATA_DIR = dir;
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db); initLayerSource(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'roles@example.com', name: 'Roles owner', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
    const { project } = flow.claimDraft(token, owner, owner);
    initLayerContract(db); initBindings(db);
    know.ensureDesign(project.id);
    const pool = library({ db, know });
    const store = bindingRecords({ db });
    const routines = bindingRoutines({ db, know, pool, store });
    run({ db, know, owner, id: project.id, pool, store, routines, work: refacets({ db, know, pool, store, routines }) });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (old === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = old;
  }
}
const entries = (pool, id, kind, layer = null) => pool.search(id, null, { kind, source: 'output', limit: 100, withData: true, ...(layer ? { layer } : {}) }).results;
const call = (db, know, id, key, operationId, extra = {}) => applyOperation({ db, know, api: layerApi(db, id, key), projectId: id, operationId, author: 'Roles owner', ...extra });
// Discover's design-system binding, accepted and reconciled: Design's kit is the authority, Pages' kit its replica.
function accepted(id, owner, store, routines) {
  const [binding] = routines.discover(id);
  routines.changes.request(id, owner.id, binding.id, { kind: 'lifecycle', lifecycle: 'reconciling' }, 'Accepted.');
  routines.watch(id, binding.id);
  return store.read(id, owner.id, binding.id);
}

test('references are found in other layers\' entry data, nested or listed, never an entry\'s own ID or its own layer', () => {
  const found = referencesTo([
    { ref: 'pg-home', layer: { key: 'pages' }, data: { id: 'pg-home', sections: [{ audience: ['per-maker', 'per-borrower'] }], note: 'per-maker' } },
    { ref: 'flw-1', layer: { key: 'pages' }, data: { persona: 'per-borrower', steps: { first: { by: 'per-ghost' } } } },
    { ref: 'per-maker', layer: { key: 'vision' }, data: { id: 'per-maker', related: 'per-borrower' } }
  ], ['per-maker', 'per-borrower', 'pg-home'], { exceptLayer: 'vision' });
  assert.deepEqual(found, [{ layer: 'pages', entry: 'flw-1', to: 'per-borrower' }, { layer: 'pages', entry: 'pg-home', to: 'per-borrower' }, { layer: 'pages', entry: 'pg-home', to: 'per-maker' }]);
});

test('roles appear only once a binding is in force, in the Library and in the layer\'s own reads', { skip }, () => fixture(({ db, know, owner, id, pool, store, routines }) => {
  const [proposal] = routines.discover(id);
  assert.ok(entries(pool, id, 'design_tokens').every(entry => !entry.role), 'a proposal binds nothing yet');
  routines.changes.request(id, owner.id, proposal.id, { kind: 'lifecycle', lifecycle: 'reconciling' }, 'Accepted.');
  routines.watch(id, proposal.id);
  const [token] = entries(pool, id, 'design_tokens');
  assert.deepEqual(token.role, { facet: 'kit', role: 'authority', binding: proposal.id, authority: { participant: 'design-kit', layer: 'design', facet: 'kit', name: 'Design' } });
  const kit = entries(pool, id, 'kit_item');
  assert.ok(kit.length > 5 && kit.every(entry => entry.role?.role === 'replica' && entry.role.authority.name === 'Design'), 'Pages\' kit is a replica of Design\'s');
  assert.equal(pool.read(id, owner.id, kit[0].ref).role.role, 'replica', 'reading one entry says so too');
  const assets = call(db, know, id, 'design', 'listBrandAssets');
  assert.ok(assets.length && assets.every(asset => asset.role?.role === 'authority'), 'Design\'s own API reads carry the role');
}));

test('a person or an agent cannot write an entry in a ceded facet; the authority\'s entries and the binding\'s imports still change', { skip }, () => fixture(({ db, know, owner, id, pool, store, routines, work }) => {
  const system = accepted(id, owner, store, routines);
  // Design's brand assets become a facet of their own, ceded in the design-system binding.
  const split = work.propose(id, owner.id, 'design', { change: { op: 'split', facet: 'kit', into: { key: 'brand', title: 'Brand', take: [{ kind: 'brand_asset' }], roles: ['authority', 'ceded'] },
    join: { binding: system.id, id: 'design-brand', role: 'ceded' } } });
  work.decide(id, owner.id, split.item.id, 'accept');
  const [asset] = call(db, know, id, 'design', 'listBrandAssets');
  assert.equal(asset.role.role, 'ceded');
  assert.throws(() => call(db, know, id, 'design', 'updateBrandAsset', { id: asset.id, body: { expectedRevision: asset.revision, changes: { notes: 'Edited anyway' } } }),
    error => error.status === 409 && /Managed in Design's kit\. Propose a change there\./.test(error.message), 'a person\'s edit is refused');
  assert.throws(() => call(db, know, id, 'design', 'createBrandAsset', { body: { asset: { ...asset.data, name: 'Another', key: null } } }), /Managed in Design's kit/, 'so is a create that would land in the ceded facet');
  assert.throws(() => stageOperation({ db, catalogs, api: layerApi(db, id, 'design'), projectId: id, attemptId: randomUUID(), operationId: 'updateBrandAsset', id: asset.id,
    body: { expectedRevision: asset.revision, changes: { notes: 'An agent tries' } } }), /Managed in Design's kit/, 'and an agent\'s staged call');
  const tokens = call(db, know, id, 'design', 'getTokens');
  assert.doesNotThrow(() => call(db, know, id, 'design', 'setTokens', { body: { tokens: tokens.data } }), 'the authority\'s own entries stay editable');
  const before = entries(pool, id, 'kit_item').length;
  const pass = routines.watch(id, system.id);
  assert.ok(pass.raised.every(item => item.layer !== 'pages'), 'imports into Pages\' replica are not refused');
  assert.equal(entries(pool, id, 'kit_item').length, before);
}));

test('two instances that own one kind never mix: an unnamed project-wide read is refused, and each instance reads its own', { skip }, () => fixture(({ db, know, id, pool }) => {
  const at = new Date().toISOString();
  db.prepare(`INSERT INTO layer_definitions(project_id,layer_key,name,description,category,icon,path,authority,output_provider,editor_adapter,output_kinds_json,built_in,created_at,lifecycle)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'active')`).run(id, 'design_fork', 'Design fork', 'A heavily modified Design.', 'Custom', 'palette', '/design-fork', 'layer_records', 'records', 'records', '[]', 0, at);
  db.prepare('INSERT INTO layer_instances(project_id,layer_key,instance_id,enabled,created_at) VALUES (?,?,?,1,?)').run(id, 'design_fork', randomUUID(), at);
  const pkg = ensureLayerPackage(db, id, 'design_fork', { template: 'design', name: 'Design fork' });
  db.prepare('UPDATE layer_definitions SET output_kinds_json = ? WHERE project_id = ? AND layer_key = ?').run(JSON.stringify(pkg.manifest.outputs), id, 'design_fork');
  const [mine] = call(db, know, id, 'design', 'listBrandAssets');
  call(db, know, id, 'design_fork', 'createBrandAsset', { body: { asset: { ...mine.data, name: 'Fork slogan', key: null, type: 'text', text: 'Fork only' } } });
  assert.throws(() => know.list(id, 'brand_asset'), error => error.status === 409 && /Several layers own brand asset records here\. Name the layer\./.test(error.message));
  const design = know.list(id, 'brand_asset', { layer: 'design' }), fork = know.list(id, 'brand_asset', { layer: 'design_fork' });
  assert.deepEqual(fork.map(record => record.name), ['Fork slogan']);
  assert.ok(design.length > 0 && !design.some(record => record.name === 'Fork slogan'), 'Design does not see the fork\'s asset');
  assert.deepEqual(call(db, know, id, 'design_fork', 'listBrandAssets').map(asset => asset.data.name), ['Fork slogan']);
  assert.deepEqual(entries(pool, id, 'brand_asset', 'design_fork').map(entry => entry.title), ['Fork slogan'], 'the Library tells them apart');
}));

test('a refacet\'s preflight lists other layers\' references into the part that moves', { skip }, () => fixture(({ db, know, owner, id, pool, store, routines, work }) => {
  accepted(id, owner, store, routines);
  // Pages' kit copies name the Design entries they came from (sourceRef): those are references into Design's brand assets.
  const proposed = work.propose(id, owner.id, 'design', { change: { op: 'split', facet: 'kit', into: { key: 'brand', title: 'Brand', take: [{ kind: 'brand_asset' }] } } });
  const moved = new Set(proposed.preflight.records.map(record => record.ref));
  const brandCopies = entries(pool, id, 'kit_item').filter(entry => moved.has(entry.data.sourceRef));
  assert.ok(brandCopies.length > 0);
  assert.deepEqual(proposed.preflight.references.filter(reference => reference.layer === 'pages').map(reference => reference.entry).sort(), brandCopies.map(entry => entry.ref).sort());
  assert.ok(proposed.preflight.references.every(reference => moved.has(reference.to)));
}));

test('an edit cannot move an entry out of a ceded facet by changing the field that narrows it', { skip }, () => fixture(({ db, know, owner, id, store, routines, work }) => {
  const system = accepted(id, owner, store, routines);
  const split = work.propose(id, owner.id, 'design', { change: { op: 'split', facet: 'kit', into: { key: 'identity', title: 'Name', take: [{ kind: 'brand_asset', where: { field: 'key', equals: 'name' } }], roles: ['authority', 'ceded'] },
    join: { binding: system.id, id: 'design-identity', role: 'ceded' } } });
  work.decide(id, owner.id, split.item.id, 'accept');
  const named = call(db, know, id, 'design', 'listBrandAssets').find(asset => asset.data.key === 'name');
  assert.equal(named.role.role, 'ceded');
  assert.throws(() => call(db, know, id, 'design', 'updateBrandAsset', { id: named.id, body: { expectedRevision: named.revision, changes: { key: null } } }),
    /Managed in Design's kit/, 'clearing the key would move it into the kit facet, out from under the binding');
}));
