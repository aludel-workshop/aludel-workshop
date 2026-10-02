// LAYER-BINDINGS-01 step 3, R5: a new, unrelated layer covers part of an existing one. On the pinned templates, a Personas
// layer (from the Markdown template) declares a facet; the chain refacets
// Vision and binds the two; Vision's personas are offered once and adopted (each adopt naming the document it produced);
// Pages' references to them become Work; Vision's ceded personas refuse edits; and the whole thing merges back.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { bindingRecords, initBindings } from '../server/binding-records.mjs';
import { bindingRoutines } from '../server/binding-routines.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { applyOperation, initLayerApi, layerApi } from '../server/layer-api.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerPackageForProject } from '../server/layer-package.mjs';
import { createMarkdownDefinition } from '../server/layer-registry.mjs';
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
  const dir = mkdtempSync(join(tmpdir(), 'aludel-overlap-'));
  const old = process.env.MACHINE_DATA_DIR;
  process.env.MACHINE_DATA_DIR = dir;
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db); initLayerSource(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'overlap@example.com', name: 'Overlap owner', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
    const { project } = flow.claimDraft(token, owner, owner);
    initLayerContract(db); initBindings(db);
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
const call = (db, know, id, key, operationId, extra = {}) => applyOperation({ db, know, api: layerApi(db, id, key), projectId: id, operationId, author: 'Overlap owner', ...extra });
const items = (db, id, where) => db.prepare(`SELECT id, layer, state, title, context_json FROM layer_work_items WHERE project_id = ? AND ${where} ORDER BY number`).all(id)
  .map(row => ({ ...row, context: JSON.parse(row.context_json) }));
const facets = (db, id, key) => layerPackageForProject(db, id, key).manifest.facets?.map(facet => facet.key) || [];
const accept = (work, id, owner, itemId) => work.decide(id, owner.id, itemId, 'accept');

test('Vision cedes its personas to a new Personas layer, and the chain of Work merges back', { skip }, () => fixture(({ db, know, owner, id, store, routines, work }) => {
  const maker = call(db, know, id, 'product', 'createPersona', { body: { persona: { name: 'Maker', role: 'Builds things' } } });
  const borrower = call(db, know, id, 'product', 'createPersona', { body: { persona: { name: 'Borrower', role: 'Needs a tool once' } } });
  const flow = call(db, know, id, 'pages', 'createFlow', { body: { flow: { title: 'Borrow a drill', persona: borrower.id, steps: [] } } });

  // A new, unrelated layer: Personas, from the Markdown template, with no facets until it declares one.
  createMarkdownDefinition(db, owner.id, id, { name: 'Personas', key: 'personas', template: 'markdown' });
  assert.deepEqual(facets(db, id, 'personas'), []);
  const declared = work.propose(id, owner.id, 'personas', { change: { op: 'declare', into: { key: 'people', title: 'People', take: [{ kind: 'markdown_document' }], roles: ['authority', 'ceded'], hints: ['personas'] } } });
  accept(work, id, owner, declared.item.id);
  assert.deepEqual(facets(db, id, 'personas'), ['people']);

  // Shared hints no longer raise anything (LAYER-KNOWLEDGE-01): overlap is found by comparing specs, as Work.
  routines.discover(id);
  assert.deepEqual(items(db, id, "json_extract(context_json, '$.routine') = 'assess-overlap'"), []);

  // The assessment's answer is a chain: refacet Vision so its personas are a facet, then bind them, Personas the authority.
  const chain = work.chain(id, owner.id, { rationale: 'Personas now keeps the people we design for.',
    refacets: [{ layer: 'product', change: { op: 'split', facet: 'intent', into: { key: 'personas', title: 'Personas', take: [{ kind: 'persona' }] } } }],
    binding: { concept: { name: 'The people we design for' }, authority: 'personas-people',
      participants: [{ id: 'personas-people', layer: { key: 'personas' }, facet: 'people', role: 'authority', shape: 'personas.people' },
        { id: 'vision-personas', layer: { key: 'product' }, facet: 'personas', role: 'ceded', shape: 'product.personas' }] } });
  accept(work, id, owner, chain.refacets[0].id);
  assert.deepEqual(facets(db, id, 'product'), ['intent', 'personas', 'story-map']);
  const { binding: { id: bindingId } } = routines.changes.decide(id, owner.id, chain.proposal.id, 'accept');

  // Vision's personas are offered once, as adopt Work in Personas; each closes naming the document it produced.
  const adopts = items(db, id, `json_extract(context_json, '$.binding') = '${bindingId}' AND json_extract(context_json, '$.action.kind') = 'adopt'`);
  assert.deepEqual(adopts.map(item => item.layer).sort(), ['personas', 'personas']);
  assert.throws(() => routines.adopted(id, owner.id, bindingId, adopts[0].id, maker.id), /Name an entry the authority now holds/, 'an adopt names the authority\'s new entry, not the offered one');
  for (const item of adopts) {
    const persona = item.context.action.entry === maker.id ? 'maker' : 'borrower';
    const doc = call(db, know, id, 'personas', 'createDocument', { body: { document: { path: `${persona}.md`, content: `# ${persona}` } } });
    routines.adopted(id, owner.id, bindingId, item.id, doc.id);
  }
  const paired = store.read(id, owner.id, bindingId).correspondence;
  assert.ok([maker.id, borrower.id].every(ref => paired.some(entry => entry.refs['vision-personas'] === ref && entry.refs['personas-people'])), 'each ceded persona has its counterpart');

  // Pages' flow names a Vision persona. Pages' references can name personas, not Personas' documents: adapter Work, once.
  routines.watch(id, bindingId);
  const repoints = () => items(db, id, `json_extract(context_json, '$.binding') = '${bindingId}' AND json_extract(context_json, '$.action.kind') IN ('repoint', 'adapter')`);
  assert.deepEqual(repoints().map(item => [item.layer, item.context.action.kind, item.context.action.references.map(reference => reference.entry)]), [['pages', 'adapter', [flow.id]]]);
  know.appendLog(repoints()[0].id, 'Done: tracked separately', { state: 'done' });
  routines.watch(id, bindingId); routines.watch(id, bindingId);
  assert.equal(repoints().length, 1, 'raised once, even after it closes');

  // Vision's ceded personas are history: a person cannot change them, nor add one.
  assert.throws(() => call(db, know, id, 'product', 'updatePersona', { id: maker.id, body: { changes: { role: 'Edited anyway' } } }), /Managed in Personas's people/);
  assert.throws(() => call(db, know, id, 'product', 'createPersona', { body: { persona: { name: 'Lender' } } }), /Managed in Personas's people/);

  // Merging back: authority returns to Vision's ceded facet, Personas offers what it holds once, the binding is retired, and
  // Vision's facets merge, so personas are edited in Vision again.
  routines.changes.request(id, owner.id, bindingId, { kind: 'transfer', change: { to: 'vision-personas', roles: { 'personas-people': 'ceded' } } }, 'Personas is being retired.');
  const offered = items(db, id, `json_extract(context_json, '$.binding') = '${bindingId}' AND state <> 'done' AND json_extract(context_json, '$.action.target') = 'vision-personas'`);
  assert.ok(offered.length >= 1 && offered.every(item => item.layer === 'product'), 'Personas\' documents come back to Vision as Work');
  for (const item of offered) know.appendLog(item.id, 'Done: kept Vision\'s version', { state: 'done' });
  routines.watch(id, bindingId);
  const mergeBack = { change: { op: 'merge', facet: 'intent', from: 'personas' } };
  assert.throws(() => work.propose(id, owner.id, 'product', mergeBack), /takes part in .*Transfer or retire/, 'not while the binding is live');
  routines.changes.request(id, owner.id, bindingId, { kind: 'lifecycle', lifecycle: 'retired' }, 'Merged back.');
  accept(work, id, owner, work.propose(id, owner.id, 'product', mergeBack).item.id);
  assert.deepEqual(facets(db, id, 'product'), ['intent', 'story-map']);
  assert.doesNotThrow(() => call(db, know, id, 'product', 'updatePersona', { id: maker.id, body: { changes: { role: 'Builds and lends' } } }), 'Vision edits its personas again');
}));
