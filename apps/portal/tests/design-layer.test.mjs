// T03-DESIGN: Design keeps its app kit as records through its own API, its views come from its template, and other layers
// read the kit only through the Library.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { applyOperation, callOperation, initLayerApi, layerApi } from '../server/layer-api.mjs';
import { initLayerContract, layerInstanceId, updateLayerInstance } from '../server/layer-contract.mjs';
import { layerHostCalls, layerPackageForProject } from '../server/layer-package.mjs';
import { frameAllows, hostRecordFeatures } from '../server/layer-ui.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const kitKinds = ['design_tokens', 'component', 'brand_asset'];
function fixture(run, adopt = false) {
  const dir = mkdtempSync(join(tmpdir(), 'aludel-design-'));
  const old = { dir: process.env.MACHINE_DATA_DIR, enabled: process.env.MACHINE_LAYER_TEMPLATES_ENABLED };
  process.env.MACHINE_DATA_DIR = dir;
  if (adopt) delete process.env.MACHINE_LAYER_TEMPLATES_ENABLED; else process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'design@example.com', name: 'Design owner', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
    const { project } = flow.claimDraft(token, owner, owner);
    if (adopt) {
      know.ensureDesign(project.id);
      const before = db.prepare('SELECT id, kind, revision, data_json FROM knowledge_records WHERE project_id = ? AND kind IN (?, ?, ?) ORDER BY id').all(project.id, ...kitKinds);
      const instance = layerInstanceId(db, project.id, 'design');
      process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
      initLayerContract(db);
      assert.equal(layerInstanceId(db, project.id, 'design'), instance, 'the Design instance keeps its identity');
      assert.deepEqual(db.prepare('SELECT id, kind, revision, data_json FROM knowledge_records WHERE project_id = ? AND kind IN (?, ?, ?) ORDER BY id').all(project.id, ...kitKinds), before,
        'the kit keeps its IDs, revisions and content');
    }
    know.ensureDesign(project.id);
    run({ db, know, owner, id: project.id });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    for (const [name, value] of [['MACHINE_DATA_DIR', old.dir], ['MACHINE_LAYER_TEMPLATES_ENABLED', old.enabled]])
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}

test('Design comes from its template: views, Knowledge, API and host calls', () => fixture(({ db, know, owner, id }) => {
  const pkg = layerPackageForProject(db, id, 'design');
  assert.equal(pkg.manifest.ui.entry, 'ui/design.ts');
  assert.deepEqual(pkg.manifest.tabs.map(tab => tab.key), ['tokens', 'components', 'brand', 'docs']);
  assert.deepEqual(layerHostCalls(db, id, 'design').sort(), ['brandTemplates', 'libraryRecords', 'uploads']);
  const api = layerApi(db, id, 'design');
  assert.ok(api, 'Design publishes an API at a reviewed digest');
  assert.deepEqual([...api.operations.values()].filter(op => op.output).map(op => op.operationId).sort(),
    ['createBrandAsset', 'createComponent', 'setTokens', 'updateBrandAsset', 'updateComponent']);
  assert.match(library({ db, know }).read(id, owner.id, 'k:design:identity').content, /never the portal's theme/, 'the charter is in the Library');
}));

test('the seeded kit is written through Design\'s rules into its instance, and people\'s changes keep the rules', () => fixture(({ db, know, owner, id }) => {
  const instance = layerInstanceId(db, id, 'design');
  for (const kind of kitKinds) {
    assert.ok(know.list(id, kind).length, `${kind} is seeded`);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id IS NOT ?').get(id, kind, instance).n, 0, `${kind} is in the Design instance`);
  }
  const api = layerApi(db, id, 'design');
  const call = (operationId, body, recordId = null) => applyOperation({ db, know, api, projectId: id, operationId, id: recordId, body, author: owner.name });
  // One token set: the singleton changes the same record; a stale revision is refused.
  const tokens = know.list(id, 'design_tokens')[0];
  const saved = call('setTokens', { ...tokens, id: undefined, kind: undefined, parentId: undefined, position: undefined, revision: undefined, updatedAt: undefined,
    faces: { brand: 'Georgia, serif', plain: tokens.faces.plain }, fromLook: false, expectedRevision: tokens.revision });
  assert.equal(saved.id, tokens.id);
  assert.equal(know.get(id, tokens.id).revision, tokens.revision + 1);
  assert.equal(know.get(id, tokens.id).fromLook, false);
  assert.throws(() => call('setTokens', { base: 'Custom', expectedRevision: tokens.revision }), /changed since you opened it/);
  assert.throws(() => know.insert(id, 'design_tokens', { ...tokens }), /already has a token set/, 'the host backstop still holds for its own seeding');
  // Brand: one asset per key, and colour roles that exist.
  assert.throws(() => call('createBrandAsset', { asset: { name: 'Second name', type: 'text', key: 'name', text: 'Shed' } }), /already the app's name/);
  assert.throws(() => call('createBrandAsset', { asset: { name: 'Mark', type: 'mark', mark: { text: 'T', background: 'sparkle' } } }), /Colour role “sparkle” doesn't exist/);
  const slogan = call('createBrandAsset', { asset: { name: 'Slogan', type: 'text', text: 'Borrow, don’t buy.' } });
  assert.equal(db.prepare('SELECT layer_instance_id FROM knowledge_records WHERE id = ?').get(slogan.id).layer_instance_id, instance);
  assert.throws(() => call('createBrandAsset', { asset: { name: 'Logo', type: 'image', assetId: 'asset-00000000-0000-0000-0000-000000000000' } }), /upload was not found/, 'uploads stay the host\'s to check');
  // Components: a needed one by name, nested inside a component, slot references checked.
  const list = know.list(id, 'component').find(component => component.name === 'List');
  const row = call('createComponent', { component: { name: 'Avatar row' }, parentId: list.id });
  assert.equal(db.prepare('SELECT parent_id FROM knowledge_records WHERE id = ?').get(row.id).parent_id, list.id);
  assert.throws(() => call('createComponent', { component: { name: 'Orphan' }, parentId: slogan.id }), /nests inside another component/);
  assert.throws(() => call('updateComponent', { changes: { slots: [{ name: 'items', accepts: ['cmp-00000000'], min: 0, max: 2 }] } }, list.id), /linked component was not found/);
  assert.throws(() => know.insert(id, 'component', { name: 'Carousel', group: 'Widgets' }), /Choose a group/, 'host writes run the layer\'s rules too');
  // An agent's call is checked into writes for its run's draft; nothing applies until review accepts it.
  const staged = callOperation({ db, catalogs: know.catalogs, api, projectId: id, operationId: 'createComponent', body: { component: { name: 'Carousel (large)', group: 'Containment' }, parentId: list.id } });
  assert.deepEqual(staged.writes.map(write => [write.kind, write.op, write.data.name, write.parentId]), [['component', 'create', 'Carousel (large)', list.id]]);
  assert.ok(!know.list(id, 'component').some(component => component.name === 'Carousel (large)'), 'nothing applies before review');
}));

test('the Library is the kit\'s read path: every kit kind with its data, and an empty kit without Design', () => fixture(({ db, know, owner, id }) => {
  const pool = library({ db, know });
  const tokens = pool.search(id, owner.id, { kind: 'design_tokens', source: 'output', withData: true });
  assert.equal(tokens.results.length, 1);
  assert.equal(tokens.results[0].layer.key, 'design');
  assert.deepEqual(tokens.results[0].data.palettes, know.list(id, 'design_tokens')[0].palettes);
  const components = pool.search(id, owner.id, { kind: 'component', source: 'output', withData: true, limit: 100 });
  assert.equal(components.results.length, know.list(id, 'component').length);
  assert.ok(components.results.some(entry => entry.data.parentId), 'nesting comes through');
  assert.equal(pool.search(id, owner.id, { kind: 'component' }).results[0].data, undefined, 'data only when asked for');
  // Pages reads the same entries; with Design switched off it gets none, and its preview falls back to placeholders.
  updateLayerInstance(db, owner.id, id, 'design', { enabled: false });
  for (const kind of kitKinds) assert.equal(pool.search(id, owner.id, { kind, source: 'output', withData: true }).total, 0, `no ${kind} without Design`);
  assert.ok(know.list(id, 'design_tokens').length, 'switching Design off keeps its records');
}));

test('an existing project\'s Design records join its instance when Design starts publishing its API', () => fixture(({ db, id }) => {
  const instance = layerInstanceId(db, id, 'design');
  for (const kind of kitKinds)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id IS NOT ?').get(id, kind, instance).n, 0, `${kind} is tagged`);
}, true));

test('a frame may upload, add brand templates and write Library records only when it asks for those features', () => {
  const projectId = 'prj-1';
  const allows = (method, path, features) => frameAllows({ key: 'design', projectId, method, pathname: `/api/projects/${projectId}${path}`, features });
  assert.equal(allows('POST', '/assets', []), false);
  assert.equal(allows('POST', '/assets', ['uploads']), true);
  assert.equal(allows('POST', '/brand-templates/social', ['brandTemplates']), true);
  assert.equal(allows('POST', '/brand-templates/social', ['uploads']), false);
  assert.equal(allows('DELETE', '/assets/asset-1', ['uploads']), false, 'uploading is not deleting');
  assert.deepEqual([...hostRecordFeatures.libraryRecords].sort(), ['doc', 'evidence_link']);
});
