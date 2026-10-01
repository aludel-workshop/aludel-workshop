// LAYER-BINDINGS-01 step 1: the binding record, kept with exact revisions and checked against the installed layers' facets.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { bindingRecords, initBindings, installedFacets } from '../server/binding-records.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerContract, updateLayerInstance } from '../server/layer-contract.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(join(new URL('..', import.meta.url).pathname, 'config'));
// Facets as the Design and Pages templates will declare them in step 2. Tests inject them; the host reads accepted manifests.
const declared = {
  design: [{ key: 'kit', title: 'Design system', kinds: ['design_tokens', 'component'], roles: ['authority', 'replica'], views: [], hints: ['design-system'] },
    { key: 'branding', title: 'Branding', kinds: ['brand_asset'], roles: ['authority', 'replica', 'ceded'], views: [], hints: [] }],
  pages: [{ key: 'kit', title: 'Kit', kinds: ['page'], roles: ['authority', 'replica'], views: [], hints: ['design-system'] }]
};

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-bindings-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const eve = createUser(db, { email: 'eve@example.com', name: 'Eve', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  initLayerContract(db); initBindings(db);
  const facetsFor = (projectId, key) => installedFacets(db, projectId, key) === null ? null : declared[key] || [];
  return { db, ada, eve, id: project.id, store: bindingRecords({ db, facetsFor }) };
}
const designSystem = () => ({
  concept: { name: "The app's design system" }, authority: 'design-kit',
  participants: [{ id: 'design-kit', layer: { key: 'design' }, facet: 'kit', role: 'authority', shape: 'design.kit' },
    { id: 'pages-kit', layer: { key: 'pages' }, facet: 'kit', role: 'replica', shape: 'pages.kit' }],
  adapters: [{ id: 'pages-aludel-kit', participant: 'pages-kit', reads: 'design.kit', mechanical: true, soft: false }],
  rationale: 'Pages draws specs with the kit Design maintains.'
});

test('a binding is proposed, revised with exact history, and moved on by the owner', () => {
  const { db, ada, eve, id, store } = fixture();
  const created = store.create(id, ada.id, { ...designSystem(), lifecycle: 'active', baseline: { x: {} } });
  assert.equal(created.lifecycle, 'proposed', 'every new binding starts as a proposal');
  assert.deepEqual(created.baseline, {}, 'a new binding has no baseline');
  const designInstance = db.prepare("SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = 'design'").get(id).instance_id;
  assert.equal(created.participants[0].layer.instanceId, designInstance, 'participants name the installed instance');
  assert.throws(() => store.create(id, eve.id, designSystem()), /Project not found/);

  const reconciling = store.lifecycle(id, ada.id, created.id, { expectedRevision: 1, lifecycle: 'reconciling', rationale: 'Accepted' });
  assert.throws(() => store.update(id, ada.id, created.id, { expectedRevision: 1, changes: { policy: {} } }), /changed\. Reload/);
  const flagged = store.update(id, ada.id, created.id, { expectedRevision: reconciling.revision, changes: { policy: { 'pages-kit': { removed: 'flag' } } } });
  assert.equal(flagged.revision, 3);
  assert.throws(() => store.update(id, ada.id, created.id, { expectedRevision: 3, changes: { authority: 'pages-kit' } }), /join and transfer/);
  assert.deepEqual(store.read(id, ada.id, created.id, 1).policy, {}, 'earlier revisions stay readable');
  assert.deepEqual(store.history(id, ada.id, created.id).map(entry => [entry.revision, entry.rationale]),
    [[1, 'Pages draws specs with the kit Design maintains.'], [2, 'Accepted'], [3, null]]);
  assert.equal(store.list(id, ada.id).length, 1);
});

test('participants are declared facets of installed layers, in roles those facets support', () => {
  const { db, ada, id, store } = fixture();
  const withRole = (pid, role) => ({ ...designSystem(), participants: designSystem().participants.map(p => p.id === pid ? { ...p, role } : p) });
  assert.throws(() => store.create(id, ada.id, withRole('pages-kit', 'ceded')), /Kit cannot be ceded/);
  assert.throws(() => store.create(id, ada.id, { ...designSystem(), participants: [...designSystem().participants,
    { id: 'data-kit', layer: { key: 'data' }, facet: 'kit', role: 'replica', shape: 'data.kit' }] }), /data does not declare a kit facet/);
  updateLayerInstance(db, ada.id, id, 'design', { enabled: false });
  assert.throws(() => store.create(id, ada.id, designSystem()), /design is not installed/);
  // Without injected declarations the host reads the installed layer's accepted manifest: a facet it doesn't declare can't bind.
  updateLayerInstance(db, ada.id, id, 'design', { enabled: true });
  assert.throws(() => bindingRecords({ db }).create(id, ada.id, { ...designSystem(), participants: designSystem().participants.map(p => p.id === 'design-kit' ? { ...p, facet: 'palette' } : p) }),
    /does not declare a palette facet/);
});

test('authority moves by a reviewed transfer with a reason, and a joining participant must hold a supported role', () => {
  const { ada, id, store } = fixture();
  const created = store.create(id, ada.id, { ...designSystem(), authority: 'pages-kit',
    participants: designSystem().participants.map(p => ({ ...p, role: p.id === 'pages-kit' ? 'authority' : 'replica' })) });
  assert.throws(() => store.transfer(id, ada.id, created.id, { expectedRevision: 1, change: { to: 'design-kit', roles: { 'pages-kit': 'replica' } } }), /Record why/);
  const moved = store.transfer(id, ada.id, created.id, { expectedRevision: 1, change: { to: 'design-kit', roles: { 'pages-kit': 'replica' } }, rationale: 'Design is added and owns the design system.' });
  assert.equal(moved.authority, 'design-kit');
  assert.throws(() => store.transfer(id, ada.id, created.id, { expectedRevision: 2, change: { to: 'pages-kit', roles: { 'design-kit': 'ceded' } }, rationale: 'Back' }),
    /Design system cannot be ceded/, 'the previous authority must support the role it is given');
  assert.equal(store.read(id, ada.id, created.id).revision, 2, 'a refused transfer changes nothing');
  const joined = store.join(id, ada.id, created.id, { expectedRevision: 2, participant: { id: 'design-brand', layer: { key: 'design' }, facet: 'branding', role: 'replica', shape: 'design.kit' } });
  assert.equal(joined.participants.length, 3);
});
