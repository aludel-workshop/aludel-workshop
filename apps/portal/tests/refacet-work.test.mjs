// LAYER-BINDINGS-01 step 3, R2: binding changes and refacets as Work, on the pinned Design and Pages templates. A proposal is
// accepted or dismissed by deciding its Work item; a refacet is a reviewed branch of the layer instance's own layer.json;
// a partial overlap is a chain of Work whose binding proposal waits on its refacets.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { bindingRecords, initBindings } from '../server/binding-records.mjs';
import { bindingRoutines } from '../server/binding-routines.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerApi } from '../server/layer-api.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerPackageForProject, packageAt } from '../server/layer-package.mjs';
import { initLayerSource, layerBinding } from '../server/layer-source.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { commitFacets, refacets } from '../server/refacets.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const templates = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1';
const skip = !templates && 'needs the pinned templates';

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'aludel-refacet-work-'));
  const old = process.env.MACHINE_DATA_DIR;
  process.env.MACHINE_DATA_DIR = dir;
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db); initLayerSource(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'refacet@example.com', name: 'Refacet owner', password: 'correct-horse-battery' });
    const member = createUser(db, { email: 'member@example.com', name: 'A member', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
    const { project } = flow.claimDraft(token, owner, owner);
    db.prepare("INSERT INTO project_members(project_id,user_id,role,created_at) VALUES (?,?,'member',?)").run(project.id, member.id, new Date().toISOString());
    initLayerContract(db); initBindings(db);
    know.ensureDesign(project.id);
    const pool = library({ db, know });
    const store = bindingRecords({ db });
    const routines = bindingRoutines({ db, know, pool, store });
    run({ db, know, owner, member, id: project.id, pool, store, routines, work: refacets({ db, know, pool, store, routines }) });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (old === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = old;
  }
}
const item = (db, id) => { const row = db.prepare('SELECT id, layer, state, title, context_json, blocks_json FROM layer_work_items WHERE id = ?').get(id); return { ...row, context: JSON.parse(row.context_json) }; };
const kit = (pool, id) => pool.search(id, null, { kind: 'kit_item', source: 'output', limit: 100, withData: true }).results;
const facets = (db, id, key) => layerPackageForProject(db, id, key).manifest.facets.map(facet => facet.key);
const brandSplit = { op: 'split', facet: 'kit', into: { key: 'brand', title: 'Brand', take: [{ kind: 'brand_asset' }], views: ['brand'] } };
const kitBrandSplit = { op: 'split', facet: 'kit', into: { key: 'kit-brand', title: 'Brand kit', take: [{ kind: 'kit_item', where: { field: 'group', equals: 'brand' } }], roles: ['replica'] } };
// Discover proposes the design-system binding; the owner accepts it by deciding its item.
function accepted(db, id, owner, store, routines) {
  const [binding] = routines.discover(id);
  routines.changes.request(id, owner.id, binding.id, { kind: 'lifecycle', lifecycle: 'reconciling' }, 'Pages draws with Design\'s kit.');
  routines.watch(id, binding.id);
  return store.read(id, owner.id, binding.id);
}

test('accepting or dismissing a proposal decides its Work item; a member\'s change waits for the owner', { skip }, () => fixture(({ db, owner, member, id, store, routines }) => {
  const [proposal] = routines.discover(id);
  const [review] = routines.changes.pending(id, proposal.id);
  assert.equal(item(db, review.id).state, 'suggested');
  assert.deepEqual(review.change, { kind: 'lifecycle', lifecycle: 'reconciling' });
  assert.throws(() => routines.changes.decide(id, member.id, review.id, 'accept'), /owner required/);
  const asked = routines.changes.request(id, member.id, proposal.id, { kind: 'lifecycle', lifecycle: 'retired' }, 'Not yet.');
  assert.ok(asked.proposed, 'a member proposes');
  assert.equal(store.read(id, owner.id, proposal.id).lifecycle, 'proposed', 'and nothing changes until the owner decides');
  // The owner's Accept in Library › Bindings decides Discover's item rather than leaving it open (the step-2 gap).
  routines.changes.request(id, owner.id, proposal.id, { kind: 'lifecycle', lifecycle: 'reconciling' }, 'Accepted.');
  assert.equal(item(db, review.id).state, 'done');
  assert.equal(item(db, review.id).context.decision, 'accept');
  assert.equal(store.read(id, owner.id, proposal.id).lifecycle, 'active', 'accepted, reconciled and active once Watch has run');
  assert.throws(() => routines.changes.decide(id, owner.id, review.id, 'accept'), /already decided/);
  routines.discover(id);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM layer_work_items WHERE project_id = ? AND json_extract(context_json, '$.routine') = 'assess-overlap'").get(id).n, 0,
    'facets already bound together (both marked design-system) are not raised as an overlap to assess');
  routines.changes.decide(id, owner.id, asked.proposed.id, 'dismiss', 'It is accepted now.');
  assert.equal(store.read(id, owner.id, proposal.id).lifecycle, 'active', 'dismissing a change applies nothing');
  // Pausing directly is still Work: an item created and decided in one step.
  routines.changes.request(id, owner.id, proposal.id, { kind: 'lifecycle', lifecycle: 'paused' }, 'Holding while Design is reworked.');
  const pauses = db.prepare("SELECT state, context_json FROM layer_work_items WHERE json_extract(context_json, '$.change.lifecycle') = 'paused'").all();
  assert.deepEqual(pauses.map(row => [row.state, JSON.parse(row.context_json).decision]), [['done', 'accept']]);
  assert.equal(store.read(id, owner.id, proposal.id).lifecycle, 'paused');
}));

test('dismissing a proposal retires it, and Discover does not propose it again', { skip }, () => fixture(({ db, owner, id, store, routines }) => {
  const [proposal] = routines.discover(id);
  routines.changes.request(id, owner.id, proposal.id, { kind: 'lifecycle', lifecycle: 'retired' }, 'Pages keeps its own kit for now.');
  const [review] = db.prepare("SELECT state, context_json FROM layer_work_items WHERE json_extract(context_json, '$.binding') = ?").all(proposal.id);
  assert.deepEqual([review.state, JSON.parse(review.context_json).decision], ['done', 'dismiss']);
  assert.equal(store.read(id, owner.id, proposal.id).lifecycle, 'retired');
  assert.deepEqual(routines.discover(id), []);
}));

test('a facet takes part in one live binding', { skip }, () => fixture(({ db, owner, id, store, routines }) => {
  const binding = accepted(db, id, owner, store, routines);
  assert.throws(() => store.create(id, owner.id, { concept: { name: 'Another' }, authority: 'design-kit', participants: binding.participants.map(({ layer, ...rest }) => ({ ...rest, layer: { key: layer.key } })) }),
    /already takes part in .* Refacet it/);
}));

test('a refacet is reviewed Work in its layer: a branch of layer.json that merges on acceptance, with the bindings following', { skip }, () => fixture(({ db, owner, member, id, pool, store, routines, work }) => {
  const binding = accepted(db, id, owner, store, routines);
  const before = kit(pool, id).length;
  const pin = layerBinding(db, id, 'design').commit;
  const proposed = work.propose(id, member.id, 'design', { change: brandSplit, rationale: 'A Branding layer is coming.' });
  const raised = item(db, proposed.item.id);
  assert.deepEqual([raised.layer, raised.state, raised.context.routine], ['design', 'review', 'refacet']);
  assert.ok(proposed.preflight.records.length > 0 && proposed.preflight.records.every(record => record.kind === 'brand_asset'), 'the brand assets move');
  assert.deepEqual(proposed.preflight.bindings.map(entry => entry.binding), [binding.id]);
  assert.deepEqual(proposed.preflight.follow.map(entry => [entry.layer, entry.facet, entry.refs.length]), [['pages', 'kit', proposed.preflight.records.length]], 'Pages holds copies and should follow');
  assert.match(raised.title, /split kit into kit and brand/);
  assert.equal(layerBinding(db, id, 'design').commit, pin, 'nothing changes until the review');
  const { repo } = layerBinding(db, id, 'design');
  assert.equal(execFileSync('git', ['-C', repo, 'diff', '--name-only', pin, proposed.commit], { encoding: 'utf8' }).trim(), 'layer.json', 'the branch changes layer.json only');

  assert.throws(() => work.decide(id, member.id, proposed.item.id, 'accept'), /owner required/);
  const decided = work.decide(id, owner.id, proposed.item.id, 'accept');
  assert.equal(layerBinding(db, id, 'design').commit, decided.merged, 'the reviewed branch is the new pin');
  assert.deepEqual(facets(db, id, 'design'), ['kit', 'brand']);
  assert.equal(item(db, proposed.item.id).state, 'done');
  const after = store.read(id, owner.id, binding.id);
  assert.deepEqual(after.detached.map(entry => entry.key).sort(), proposed.preflight.records.map(record => record.ref).sort(), 'the moved entries are held for Pages');
  const pass = routines.watch(id, binding.id);
  assert.deepEqual([pass.applied.length, pass.raised.length], [0, 0], 'Design\'s refacet is neither a removal for Pages nor drift');
  assert.equal(kit(pool, id).length, before, 'Pages keeps every copy');
  assert.throws(() => work.decide(id, owner.id, proposed.item.id, 'accept'), /already decided/);
}));

test('a refacet whose layer moved on, or whose result would differ, is refused; a branch with overlapping facets is not a package', { skip }, () => fixture(({ db, owner, id, store, routines, work }) => {
  accepted(db, id, owner, store, routines);
  const first = work.propose(id, owner.id, 'design', { change: brandSplit });
  const second = work.propose(id, owner.id, 'design', { change: { op: 'rename', facet: 'kit', title: 'Kit' } });
  work.decide(id, owner.id, first.item.id, 'accept');
  assert.throws(() => work.decide(id, owner.id, second.item.id, 'accept'), /layer changed since this refacet was proposed/);
  assert.throws(() => work.propose(id, owner.id, 'design', { change: { op: 'merge', facet: 'kit', from: 'ghost' } }), /no other facet ghost/);
  const { repo, commit } = layerBinding(db, id, 'design');
  const overlapping = [{ key: 'kit', title: 'Kit', kinds: ['design_tokens', 'component', 'brand_asset'], roles: ['authority'] }, { key: 'brand', title: 'Brand', kinds: ['brand_asset'], roles: ['authority'] }];
  const bad = commitFacets(repo, commit, overlapping, 'refacet/overlap-test', 'Overlapping facets');
  assert.throws(() => packageAt(repo, bad, 'design'), /each entry belongs to one facet/);
  work.decide(id, owner.id, second.item.id, 'dismiss', 'Stale.');
  assert.equal(item(db, second.item.id).context.decision, 'dismiss');
}));

test('a partial overlap is a chain of Work: refacet each side, then the binding proposal that waits on them', { skip }, () => fixture(({ db, owner, id, pool, store, routines, work }) => {
  const system = accepted(db, id, owner, store, routines);
  const before = kit(pool, id).length;
  const chain = work.chain(id, owner.id, {
    rationale: 'Brand gets its own binding.',
    refacets: [{ layer: 'design', change: brandSplit }, { layer: 'pages', change: kitBrandSplit }],
    binding: { concept: { name: 'The app\'s brand' }, authority: 'design-brand',
      participants: [{ id: 'design-brand', layer: { key: 'design' }, facet: 'brand', role: 'authority', shape: 'design.brand' },
        { id: 'pages-kit-brand', layer: { key: 'pages' }, facet: 'kit-brand', role: 'replica', shape: 'pages.kit-brand' }],
      adapters: [{ id: 'aludel-kit', participant: 'pages-kit-brand', reads: 'design.brand', mechanical: true, soft: false }] } });
  assert.deepEqual(chain.refacets.map(entry => entry.layer), ['design', 'pages']);
  assert.deepEqual(routines.changes.blockedBy(id, chain.proposal.id).sort(), chain.refacets.map(entry => entry.id).sort());
  assert.throws(() => routines.changes.decide(id, owner.id, chain.proposal.id, 'accept'), /waits on 2 Work items/);
  work.decide(id, owner.id, chain.refacets[0].id, 'accept');
  assert.throws(() => routines.changes.decide(id, owner.id, chain.proposal.id, 'accept'), /waits on another Work item/);
  work.decide(id, owner.id, chain.refacets[1].id, 'accept');
  assert.deepEqual(facets(db, id, 'pages'), ['kit', 'kit-brand']);
  assert.deepEqual(store.read(id, owner.id, system.id).detached, [], 'Pages let go, so the design-system binding holds nothing');
  const { binding } = routines.changes.decide(id, owner.id, chain.proposal.id, 'accept');
  assert.equal(binding.lifecycle, 'active', 'the brand entries already match, so the first reconcile completes');
  assert.equal(kit(pool, id).length, before, 'no entry was copied, lost or doubled');
  assert.deepEqual(routines.watch(id, system.id).raised, []);
}));

test('only the owner decides, even a dismissal; a refacet waits on Work that blocks it; a split-off facet can join a named binding', { skip }, () => fixture(({ db, know, owner, member, id, store, routines, work }) => {
  const system = accepted(db, id, owner, store, routines);
  const pause = routines.changes.propose(id, { bindingId: system.id, change: { kind: 'lifecycle', lifecycle: 'paused' }, by: { kind: 'person', id: member.id } });
  assert.throws(() => routines.changes.decide(id, member.id, pause.id, 'dismiss'), /owner required/);
  assert.equal(item(db, pause.id).state, 'review', 'a member cannot close the owner\'s decision either');

  const proposed = work.propose(id, owner.id, 'design', { change: { ...brandSplit, into: { ...brandSplit.into, roles: ['authority', 'ceded'] }, join: { binding: system.id, id: 'design-brand', role: 'ceded' } } });
  const blocker = know.createWork(id, { layer: 'design', layerScoped: true, type: 'review', state: 'ready', title: 'Assess the overlap first' });
  db.prepare('UPDATE layer_work_items SET blocks_json = ? WHERE id = ?').run(JSON.stringify([proposed.item.id]), blocker.id);
  assert.throws(() => work.decide(id, owner.id, proposed.item.id, 'accept'), /waits on other Work/);
  know.appendLog(blocker.id, 'Done', { state: 'done' });
  const revision = store.read(id, owner.id, system.id).revision;
  work.decide(id, owner.id, proposed.item.id, 'accept');
  const joined = store.read(id, owner.id, system.id);
  assert.deepEqual(joined.participants.map(p => `${p.id}:${p.role}`), ['design-kit:authority', 'pages-kit:replica', 'design-brand:ceded']);
  assert.ok(joined.revision > revision, 'joining is a reviewed revision of the contract');
}));
