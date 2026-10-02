// LAYER-KNOWLEDGE-01 S3/S4: the Knowledge site of a layer (spec, contents, sharing, docs) and binding from its tree. A new
// Personas layer (Markdown template) writes its spec, which raises Compare specs once; ticking Personas › people and
// Vision's Personas (handing over) proposes one binding as a chain; accepting it decides everything at once. A Branding
// layer taking Design's brand assets renegotiates the live design-system binding.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { bindingRecords, initBindings } from '../server/binding-records.mjs';
import { bindingRoutines } from '../server/binding-routines.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { knowledgeSite } from '../server/knowledge-site.mjs';
import { applyOperation, initLayerApi, layerApi } from '../server/layer-api.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerDocs } from '../server/layer-docs.mjs';
import { layerPackageForProject } from '../server/layer-package.mjs';
import { createMarkdownDefinition } from '../server/layer-registry.mjs';
import { initLayerSource, layerBinding } from '../server/layer-source.mjs';
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
  const dir = mkdtempSync(join(tmpdir(), 'aludel-site-'));
  const old = process.env.MACHINE_DATA_DIR;
  process.env.MACHINE_DATA_DIR = dir;
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db); initLayerSource(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'site@example.com', name: 'Site owner', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
    const { project } = flow.claimDraft(token, owner, owner);
    initLayerContract(db); initBindings(db);
    const pool = library({ db, know }), store = bindingRecords({ db }), routines = bindingRoutines({ db, know, pool, store });
    const work = refacets({ db, know, pool, store, routines });
    const docs = layerDocs({ db, onSpecChange: (projectId, key) => routines.specChanged(projectId, key) });
    const site = knowledgeSite({ db, pool, store, changes: routines.changes, refacets: work, docs });
    run({ db, know, owner, id: project.id, store, routines, docs, site });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (old === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = old;
  }
}
const call = (db, know, id, key, operationId, extra = {}) => applyOperation({ db, know, api: layerApi(db, id, key), projectId: id, operationId, author: 'Site owner', ...extra });
const pin = (db, id, key) => layerBinding(db, id, key).commit;
const flat = nodes => nodes.flatMap(node => [node, ...flat(node.children || [])]);
const compareItems = (db, id) => db.prepare("SELECT title, context_json FROM layer_work_items WHERE project_id = ? AND json_extract(context_json, '$.routine') = 'compare-specs'").all(id);
// A Markdown layer's spec says what its folders mean.
const personasSpec = [{ key: 'documents', title: 'Documents', intent: 'Markdown documents this layer keeps.', select: { kind: 'markdown_document' }, tab: 'files', children: [
  { key: 'people', title: 'Personas', intent: 'One document per person we design for.', select: { kind: 'markdown_document', where: { field: 'folder', equals: 'personas' } }, tab: 'files', shape: { format: '# {Name}\n\n> {Their situation}' } },
  { key: 'notes', title: 'Notes', intent: 'Loose notes on improvements.', select: { kind: 'markdown_document', where: { field: 'folder', equals: 'notes' } }, tab: 'files' }] },
  { key: 'folders', title: 'Folders', intent: 'Folders documents sit in.', select: { kind: 'markdown_folder' }, tab: 'files' }];

test('a layer\'s site joins its spec, what each part holds, how it is shared, and its docs', { skip }, () => fixture(({ db, know, owner, id, site }) => {
  call(db, know, id, 'product', 'createPersona', { body: { persona: { name: 'Borrower', role: 'Needs a tool once' } } });
  call(db, know, id, 'product', 'createPersona', { body: { persona: { name: 'Lender', role: 'Owns idle tools' } } });
  const vision = site.site(id, owner.id, 'product');
  assert.equal(vision.layer.name, 'Vision'); assert.equal(vision.canEdit, true);
  assert.deepEqual(vision.information.map(node => node.key), ['brief', 'personas', 'story-map', 'documents']);
  const personas = vision.information.find(node => node.key === 'personas');
  assert.equal(personas.count, 2); assert.equal(personas.tab, 'brief'); assert.deepEqual(personas.shared, []);
  assert.ok(personas.shape.fields.some(([name]) => name === 'name'), 'a part without a stated shape takes its fields from the API schema');
  assert.ok(vision.docs.some(doc => doc.title === 'Charter'));
  assert.ok(vision.layers.some(layer => layer.key === 'pages'));
  const held = site.contents(id, owner.id, 'product', 'personas');
  assert.deepEqual(held.entries.map(entry => entry.title).sort(), ['Borrower', 'Lender']);
  assert.throws(() => site.contents(id, owner.id, 'product', 'nope'), /no information nope/);
}));

test('Personas binds its people folder with Vision\'s personas: one proposal, decided at once', { skip }, () => fixture(({ db, know, owner, id, store, routines, docs, site }) => {
  const borrower = call(db, know, id, 'product', 'createPersona', { body: { persona: { name: 'Borrower', role: 'Needs a tool once' } } });
  call(db, know, id, 'pages', 'createFlow', { body: { flow: { title: 'Borrow a drill', persona: borrower.id, steps: [] } } });
  createMarkdownDefinition(db, owner.id, id, { name: 'Personas', key: 'personas', template: 'markdown' });
  call(db, know, id, 'personas', 'createFolder', { body: { folder: { path: 'personas' } } });
  call(db, know, id, 'personas', 'createDocument', { body: { document: { path: 'personas/lender.md', content: '# Lender' } } });

  // Personas says what its folders mean; that raises Compare specs once, for a person or an agent.
  docs.saveInformation(id, owner.id, 'personas', { information: personasSpec, base: pin(db, id, 'personas') });
  assert.equal(compareItems(db, id).length, 1);
  assert.match(compareItems(db, id)[0].title, /Compare specs: Personas's spec changed/);
  assert.equal(flat(site.site(id, owner.id, 'personas').information).find(node => node.key === 'people').count, 1);

  const input = { name: 'The people we design for', statement: 'Personas holds the full portraits; Vision points to them.',
    participants: [{ layer: 'personas', nodes: ['people'], lead: true }, { layer: 'product', nodes: ['personas'], copy: false }] };
  const preview = site.preview(id, owner.id, input);
  assert.deepEqual(preview.refacets.map(step => [step.layer, step.change.op]), [['personas', 'declare'], ['product', 'split']]);
  assert.ok(preview.effects.some(text => /Vision's Personas hand over to Personas/.test(text)));
  assert.ok(preview.effects.some(text => /Pages points at Vision's Personas \(1 reference\)/.test(text)), 'the flow that names a persona gets Work');
  assert.deepEqual(preview.renegotiates, []);

  const before = { personas: pin(db, id, 'personas'), product: pin(db, id, 'product') };
  const proposed = site.propose(id, owner.id, input);
  assert.equal(pin(db, id, 'product'), before.product, 'nothing changes until it is accepted');
  for (const key of ['personas', 'product']) {
    const card = site.site(id, owner.id, key).bindings.find(item => item.id === proposed.id);
    assert.equal(card.status, 'proposed');
    assert.deepEqual(card.participants.map(p => [p.layer, p.lead, p.nodes.map(node => node.key).join()]), [['personas', true, 'people'], ['product', false, 'personas']]);
  }
  assert.equal(site.binding(id, owner.id, proposed.id).blockedBy.length, 2, 'the proposal waits on both refacets');

  const { binding } = site.decide(id, owner.id, proposed.id, 'accept');
  assert.equal(binding.lifecycle, 'reconciling');
  assert.deepEqual(layerPackageForProject(db, id, 'personas').manifest.facets.map(facet => facet.key), ['people']);
  assert.deepEqual(layerPackageForProject(db, id, 'product').manifest.facets.map(facet => facet.key), ['intent', 'personas', 'story-map']);
  const vision = site.site(id, owner.id, 'product');
  assert.deepEqual(vision.information.find(node => node.key === 'personas').shared.map(share => [share.name, share.status, share.role]), [['The people we design for', 'live', 'ceded']]);
  const card = vision.bindings.find(item => item.id === binding.id);
  assert.deepEqual(card.participants.map(p => [p.name, p.role, p.nodes.map(node => node.title).join()]), [['Personas', 'authority', 'Personas'], ['Vision', 'ceded', 'Personas']]);
  assert.ok(!vision.bindings.some(item => item.id === proposed.id), 'the proposal became the binding');
  assert.equal(store.all(id).find(item => item.id === binding.id).concept.description, input.statement);
  // A retired binding is history: it leaves the cards.
  routines.changes.request(id, owner.id, binding.id, { kind: 'lifecycle', lifecycle: 'retired' }, 'Done with it.');
  assert.ok(!site.site(id, owner.id, 'product').bindings.some(item => item.id === binding.id));
}));

test('Branding takes Design\'s brand assets, renegotiating the design-system binding', { skip }, () => fixture(({ db, owner, id, store, routines, docs, site }) => {
  routines.discover(id);
  const system = store.all(id).find(item => item.participants.some(p => p.layer.key === 'design'));
  routines.changes.request(id, owner.id, system.id, { kind: 'lifecycle', lifecycle: 'reconciling' }, 'Pages draws with Design\'s kit.');
  const design = site.site(id, owner.id, 'design');
  assert.deepEqual(design.bindings.find(item => item.id === system.id).participants.find(p => p.layer === 'design').nodes.map(node => node.key), ['tokens', 'components', 'brand']);
  assert.equal(design.information.find(node => node.key === 'brand').shared[0].role, 'authority');

  createMarkdownDefinition(db, owner.id, id, { name: 'Branding', key: 'branding', template: 'markdown' });
  docs.saveInformation(id, owner.id, 'branding', { base: pin(db, id, 'branding'), information: [{ key: 'brand', title: 'Brand', intent: 'The app\'s name, voice and mark.', select: { kind: 'markdown_document' }, tab: 'files' }] });
  const input = { name: 'The app\'s brand', participants: [{ layer: 'branding', nodes: ['brand'], lead: true }, { layer: 'design', nodes: ['brand'], copy: false }] };
  const preview = site.preview(id, owner.id, input);
  assert.deepEqual(preview.renegotiates, [system.id]);
  assert.ok(preview.effects.some(text => /^Renegotiates Design system: Design's Brand assets leaves it for this binding/.test(text)));
  site.decide(id, owner.id, site.propose(id, owner.id, input).id, 'accept');
  const after = site.site(id, owner.id, 'design');
  assert.deepEqual(after.bindings.find(item => item.id === system.id).participants.find(p => p.layer === 'design').nodes.map(node => node.key), ['tokens', 'components']);
  assert.equal(after.information.find(node => node.key === 'brand').shared[0].name, 'The app\'s brand');
}));

test('a proposal needs two layers, one lead, roles each part supports, and a name; dismissing it dismisses its refacets', { skip }, () => fixture(({ db, owner, id, docs, site }) => {
  createMarkdownDefinition(db, owner.id, id, { name: 'Personas', key: 'personas', template: 'markdown' });
  docs.saveInformation(id, owner.id, 'personas', { information: personasSpec, base: pin(db, id, 'personas') });
  const people = { layer: 'personas', nodes: ['people'], lead: true }, vision = { layer: 'product', nodes: ['personas'] };
  assert.throws(() => site.preview(id, owner.id, { name: 'x', participants: [people] }), /at least two layers/);
  assert.throws(() => site.preview(id, owner.id, { name: 'x', participants: [people, { ...vision, lead: true }] }), /one layer that leads/);
  assert.throws(() => site.preview(id, owner.id, { name: 'x', participants: [people, { layer: 'personas', nodes: ['notes'] }] }), /takes part once/);
  assert.throws(() => site.preview(id, owner.id, { name: ' ', participants: [people, vision] }), /Name what is shared/);
  // A facet that only supports keeping a copy can't lead (a template may say so; here Pages' kit is narrowed to replica).
  const { repo, commit } = layerBinding(db, id, 'pages');
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' } }).trim();
  const manifest = JSON.parse(git('show', `${commit}:layer.json`));
  manifest.facets = manifest.facets.map(facet => facet.key === 'kit' ? { ...facet, roles: ['replica'] } : facet);
  writeFileSync(join(repo, 'layer.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  git('commit', '-q', '-am', 'Kit only keeps a copy');
  db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ?').run(git('rev-parse', 'HEAD'), id, 'pages');
  assert.throws(() => site.preview(id, owner.id, { name: 'x', participants: [{ layer: 'pages', nodes: ['kit'], lead: true }, { layer: 'design', nodes: ['tokens'] }] }), /Pages's App kit can't lead here: it supports keeps a copy/);
  const proposed = site.propose(id, owner.id, { name: 'People', participants: [people, vision] });
  const before = pin(db, id, 'product');
  site.decide(id, owner.id, proposed.id, 'dismiss');
  assert.equal(pin(db, id, 'product'), before);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM layer_work_items WHERE project_id = ? AND json_extract(context_json, '$.routine') = 'refacet' AND state <> 'done'").get(id).n, 0);
  assert.ok(!site.site(id, owner.id, 'personas').bindings.length);
}));
