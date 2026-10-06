// T03-DESIGN: Design keeps its app kit as records through its own API, its views come from its template, and other layers
// read the kit only through the Library.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { applyOperation, callOperation, initLayerApi, layerApi, publishedLayerFile, publishLayerFile, runPure } from '../server/layer-api.mjs';
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
import { tokenVariables } from '../src/design-tokens.js';

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
    run({ db, know, owner, flow, id: project.id });
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
  assert.deepEqual(layerHostCalls(db, id, 'design').sort(), ['libraryRecords', 'uploads']);
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

test('an existing project\'s Design records join its instance when Design starts publishing its API', () => fixture(({ db, know, id }) => {
  const instance = layerInstanceId(db, id, 'design');
  assert.equal(know.list(id, 'brand_asset').length, 5, 'adopting gains no second set of starters');
  assert.equal(know.list(id, 'design_tokens').length, 1);
  for (const kind of kitKinds)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id IS NOT ?').get(id, kind, instance).n, 0, `${kind} is tagged`);
}, true));

test('a frame may upload and write Library records only when it asks for those features', () => {
  const projectId = 'prj-1';
  const allows = (method, path, features) => frameAllows({ key: 'design', projectId, method, pathname: `/api/projects/${projectId}${path}`, features });
  assert.equal(allows('POST', '/assets', []), false);
  assert.equal(allows('POST', '/assets', ['uploads']), true);
  assert.equal(allows('POST', '/brand-templates/social', ['uploads']), false, 'brand templates are Design\'s own, added through its API');
  assert.equal(allows('DELETE', '/assets/asset-1', ['uploads']), false, 'uploading is not deleting');
  assert.deepEqual([...hostRecordFeatures.libraryRecords].sort(), ['doc', 'evidence_link']);
});

// T03-DESIGN-SEED: the starter kit and the Look & feel sync come from Design's own handler.
test('a new project\'s kit is seeded by the Design template, and a Look & feel change follows an untouched token set', () => fixture(({ db, know, owner, flow, id }) => {
  const seeded = db.prepare("SELECT kind FROM knowledge_counters WHERE project_id = ? AND (kind LIKE 'layer-seed:%' OR kind IN ('design-components-seeded', 'design-brand-seeded'))").all(id).map(row => row.kind);
  assert.deepEqual(seeded, [`layer-seed:${layerInstanceId(db, id, 'design')}`], 'the template seeded the kit, not the host');
  const revision = id_ => db.prepare('SELECT author, rationale FROM knowledge_revisions WHERE record_id = ? AND revision = 1').get(id_);
  const tokens = know.list(id, 'design_tokens')[0];
  assert.match(revision(tokens.id).rationale, /^Material 3 starting set from the Look & feel/);
  assert.equal(know.list(id, 'component').length, 15);
  assert.equal(know.list(id, 'component').find(component => component.name === 'List item').parentId, know.list(id, 'component').find(component => component.name === 'List').id);
  assert.deepEqual(know.list(id, 'brand_asset').map(asset => asset.name), ['Product name', 'Tagline', 'Short description', 'Logo mark', 'Social card']);
  assert.equal(revision(know.list(id, 'brand_asset')[0].id).author, 'Aludel');
  know.ensureDesign(id);
  assert.equal(know.list(id, 'component').length, 15, 'install runs once per instance');
  flow.saveDesign(owner, id, { feel: 'sleek-saas', theme: 'light', accent: '#b3261e' });
  const followed = know.list(id, 'design_tokens')[0];
  assert.equal(followed.palettes[0].seed, '#b3261e');
  assert.equal(revision(followed.id).author, 'Aludel');
  applyOperation({ db, know, api: layerApi(db, id, 'design'), projectId: id, operationId: 'setTokens', body: { fromLook: false }, author: owner.name });
  flow.saveDesign(owner, id, { feel: 'sleek-saas', theme: 'light', accent: '#2e7d5b' });
  assert.equal(know.list(id, 'design_tokens')[0].palettes[0].seed, '#b3261e', 'an edited token set stays as edited');
}));

// W-29 (DEC-070; kit-contract.md K1): Design publishes kit.js from its records; the host keeps each version by digest.
test('Design publishes kit.js from its own records, each version kept by its digest', () => fixture(({ db, know, owner, id }) => {
  const api = layerApi(db, id, 'design');
  assert.deepEqual(api.publishes, ['kit.js']);
  const project = { name: 'Tool Share', slug: 'tool-share' };
  const first = publishLayerFile({ db, api, projectId: id, path: 'kit.js', project });
  assert.match(first.type, /^text\/javascript/);
  assert.match(first.digest, /^[0-9a-f]{20}$/);
  assert.ok(first.body.includes('"tag":"tool-button"') && first.body.includes('"tag":"tool-page-scaffold"'), 'one element per seeded contract, named for the project');
  assert.equal(publishLayerFile({ db, api, projectId: id, path: 'kit.js', project }).digest, first.digest, 'the same records give the same version');
  assert.throws(() => publishLayerFile({ db, api, projectId: id, path: 'other.js', project }), /publishes no other.js/);
  const tokens = know.list(id, 'design_tokens', { layer: 'design' })[0];
  applyOperation({ db, know, api, projectId: id, operationId: 'setTokens', body: { corners: { ...tokens.corners, medium: 20 } }, author: owner.name });
  const second = publishLayerFile({ db, api, projectId: id, path: 'kit.js', project });
  assert.notEqual(second.digest, first.digest, 'a new Design revision is a new kit');
  assert.equal(publishedLayerFile(db, id, 'design', 'kit.js', first.digest).body, first.body, 'a pinned version still reads');
  assert.equal(publishedLayerFile(db, id, 'design', 'kit.js', '0'.repeat(20)), null);
}));

test('the kit\'s token variables are the generated app\'s: Design\'s handler and the portal compute the same values', () => fixture(({ db, know, id }) => {
  const api = layerApi(db, id, 'design');
  const tokens = know.list(id, 'design_tokens', { layer: 'design' })[0];
  const data = Object.fromEntries(Object.entries(tokens).filter(([key]) => !['id', 'kind', 'revision', 'layer', 'title'].includes(key)));
  for (const mode of ['light', 'dark']) assert.deepEqual(runPure(api.source, 'tokenVariables', [data, mode]), tokenVariables(data, mode), mode);
}));

test('a contract keeps a demo and a template through Design\'s API, and the kit draws the template', () => fixture(({ db, know, owner, id }) => {
  const api = layerApi(db, id, 'design');
  const created = applyOperation({ db, know, api, projectId: id, operationId: 'createComponent', author: owner.name, body: { component: { name: 'World map', group: 'Other',
    props: [{ key: 'title', kind: 'text', default: 'My world' }], demo: { props: { title: 'Mossbank' } },
    template: { html: '<section><h2>{{title}}</h2></section>', css: 'section{background:var(--mat-sys-surface-container);font:var(--mat-sys-title-large)}' } } } });
  const map = know.list(id, 'component', { layer: 'design' }).find(component => component.name === 'World map');
  assert.ok(created && map, 'created');
  assert.deepEqual(map.demo, { props: { title: 'Mossbank' }, slots: {} });
  assert.match(map.template.html, /\{\{title\}\}/);
  assert.throws(() => applyOperation({ db, know, api, projectId: id, operationId: 'updateComponent', id: map.id, author: owner.name, body: { changes: { template: { html: '<script>x()</script>', css: '' } } } }),
    /run or load/);
  const kit = publishLayerFile({ db, api, projectId: id, path: 'kit.js', project: { name: 'Tool Share', slug: 'tool-share' } });
  assert.ok(kit.body.includes('"tag":"tool-world-map"') && kit.body.includes('{{title}}'));
}));
