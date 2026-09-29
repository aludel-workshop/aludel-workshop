import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initPagesReconciliation, pagesGapDecision, pagesReconciliationView, reconcilePagesFlow } from '../server/pages-reconciliation.mjs';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
    CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
    CREATE TABLE layer_instances(project_id TEXT,layer_key TEXT,enabled INTEGER);
    CREATE TABLE layer_connections(id TEXT PRIMARY KEY,project_id TEXT,receiving_key TEXT,source_key TEXT,status TEXT,mapping TEXT,revision INTEGER);
    CREATE TABLE routine_runs(id INTEGER PRIMARY KEY AUTOINCREMENT,routine_id TEXT,project_id TEXT,ran_at TEXT,trigger TEXT,work_item_id TEXT);
    INSERT INTO projects VALUES ('a');
    INSERT INTO project_members VALUES ('a','owner','owner'),('a','viewer','viewer');
    INSERT INTO layer_instances VALUES ('a','pages',1),('a','product',1);
    INSERT INTO layer_connections VALUES ('policy','a','pages','product','active','flow-candidate',2);`);
  initPagesReconciliation(db);
  const stories = [{ id: 'sto-one', title: 'One', revision: 3 }, { id: 'sto-two', title: 'Two', revision: 1 }];
  const flows = [];
  const work = new Map();
  let sequence = 0;
  let routine;
  const know = {
    list(_project, kind) { return kind === 'story' ? stories : kind === 'flow' ? flows : routine ? [routine] : []; },
    insert(_project, kind, value) { assert.equal(kind, 'routine'); return routine = { ...value, id: 'rtn-coverage', revision: 1 }; },
    createWork(_project, input) { const item = { ...input, id: `wrk-${++sequence}`, log: [{ text: input.logText }] }; work.set(item.id, item); return item; },
    workById(_project, id) { return work.get(id) || null; },
    appendLog(id, text, changes) { const item = work.get(id); item.log.push({ text }); item.state = changes.state; return item; }
  };
  return { db, know, stories, flows, work };
}

test('reviewed Pages policy has durable receipts, one Work suggestion per gap, and safe closure', () => {
  const f = fixture();
  try {
    const first = reconcilePagesFlow(f.db, f.know, 'a');
    assert.equal(first.created.length, 2);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM routine_runs').get().n, 1);
    assert.deepEqual(JSON.parse(f.db.prepare('SELECT input_json FROM routine_runs').get().input_json).policy, ['policy', 2]);
    assert.equal(reconcilePagesFlow(f.db, f.know, 'a').repeated, true);
    initPagesReconciliation(f.db); // restart migration is idempotent
    f.stories.reverse();
    assert.equal(reconcilePagesFlow(f.db, f.know, 'a').repeated, true);
    f.stories.reverse();
    f.flows.push({ id: 'flw-one', revision: 1, steps: [{ story: 'sto-one', page: 'pag-one' }] });
    const resolved = reconcilePagesFlow(f.db, f.know, 'a');
    assert.deepEqual(resolved.closed, [first.created[0].id]);
    assert.equal(f.work.get(first.created[0].id).state, 'done');
    assert.equal(pagesReconciliationView(f.db, 'viewer', 'a').gaps.find(g => g.sourceId === 'sto-one').status, 'resolved');
    f.work.get(first.created[1].id).log.push({ text: 'Owner edited task' });
    f.flows[0].revision++;
    f.flows[0].steps.push({ story: 'sto-two', page: 'pag-two' });
    assert.deepEqual(reconcilePagesFlow(f.db, f.know, 'a').closed, []);
    assert.equal(pagesReconciliationView(f.db, 'viewer', 'a').gaps.find(g => g.sourceId === 'sto-two').status, 'pending-review');
  } finally { f.db.close(); }
});

test('source disappearance degrades coverage; rejected and excepted gaps stay quiet', () => {
  const f = fixture();
  try {
    reconcilePagesFlow(f.db, f.know, 'a');
    let view = pagesReconciliationView(f.db, 'owner', 'a');
    assert.throws(() => pagesGapDecision(f.db, f.know, 'viewer', 'a', view.gaps[0].key, { decision: 'exception', reason: 'Intentional', expectedUpdatedAt: view.gaps[0].updatedAt }), { status: 403 });
    pagesGapDecision(f.db, f.know, 'owner', 'a', view.gaps[0].key, { decision: 'exception', reason: 'Intentional', expectedUpdatedAt: view.gaps[0].updatedAt });
    view = pagesReconciliationView(f.db, 'owner', 'a');
    pagesGapDecision(f.db, f.know, 'owner', 'a', view.gaps[1].key, { decision: 'rejected', reason: 'Wrong relation', expectedUpdatedAt: view.gaps[1].updatedAt });
    assert.deepEqual([...f.work.values()].map(item => item.state), ['done', 'done']);
    f.db.prepare("UPDATE layer_instances SET enabled = 0 WHERE layer_key = 'product'").run();
    assert.equal(reconcilePagesFlow(f.db, f.know, 'a').coverage, 'degraded');
    assert.equal(pagesReconciliationView(f.db, 'viewer', 'a').coverage, 'degraded');
    assert.equal(f.work.size, 2);
    f.db.prepare("UPDATE layer_instances SET enabled = 1 WHERE layer_key = 'product'").run();
    f.stories[0].revision++;
    assert.equal(reconcilePagesFlow(f.db, f.know, 'a').created.length, 0);
    assert.deepEqual(pagesReconciliationView(f.db, 'owner', 'a').gaps.map(g => g.status), ['exception', 'rejected']);
  } finally { f.db.close(); }
});

test('the real Pages connection stages Work and a flow edit closes its untouched suggestion', async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { openDatabase } = await import('../server/storage.mjs');
  const { initWorkflow } = await import('../server/workflow.mjs');
  const { ensureProductWorkspace } = await import('../server/product-workspace.mjs');
  const { initAccounts, createUser } = await import('../server/accounts.mjs');
  const { initOnboarding, loadCatalogs, onboarding } = await import('../server/onboarding.mjs');
  const { initKnowledge, knowledge } = await import('../server/knowledge.mjs');
  const { initLayerContract } = await import('../server/layer-contract.mjs');
  const { initPagesLayerApp, pagesConnectionCreate, pagesConnectionUpdate } = await import('../server/pages-layer-app.mjs');
  const { openSecretStore } = await import('../server/secret-store.mjs');
  const root = mkdtempSync(join(tmpdir(), 'aludel-lat05-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  try {
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initLayerContract(db); initPagesLayerApp(db); initPagesReconciliation(db);
    const configDirectory = new URL('../config', import.meta.url).pathname;
    const catalogs = loadCatalogs(configDirectory);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'lat05@example.com', name: 'Owner', password: 'correct-horse-battery' });
    const { token } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(token, { name: 'Flow trial', pitch: 'Map a visitor journey.' });
    const { project } = flows.claimDraft(token, owner, owner);
    const story = know.insert(project.id, 'story', { title: 'Find a route', phase: 'demo' });
    const draft = pagesConnectionCreate(db, owner.id, project.id, 'product');
    pagesConnectionUpdate(db, owner.id, project.id, draft.id, { expectedRevision: 1, status: 'active', mapping: 'flow-candidate', instructions: 'Map stories to page steps.' });
    const run = reconcilePagesFlow(db, know, project.id);
    const item = run.created.find(item => item.targets.some(target => target.id === story.id));
    assert.ok(item);
    assert.equal(item.action, 'pages.flows');
    assert.ok(know.defaultProfile(project.id), 'Work initializes its profile when Pages emits the first task');
    assert.equal(know.workById(project.id, item.id).state, 'suggested');
    const page = know.insert(project.id, 'page', { label: 'Find', icon: 'article', pageType: 'detail', inNav: false, status: 'planned' });
    know.insert(project.id, 'flow', { title: 'Find route', steps: [{ page: page.id, story: story.id, name: 'Find' }] });
    const resolved = reconcilePagesFlow(db, know, project.id);
    assert.ok(resolved.closed.includes(item.id));
    assert.equal(know.workById(project.id, item.id).state, 'done');
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});


test('a touched Work suggestion cannot be silently quieted by a gap decision', () => {
  const f = fixture();
  try {
    reconcilePagesFlow(f.db, f.know, 'a');
    const gap = pagesReconciliationView(f.db, 'owner', 'a').gaps[0];
    f.work.get(gap.workItemId).log.push({ text: 'Owner changed task' });
    assert.throws(() => pagesGapDecision(f.db, f.know, 'owner', 'a', gap.key, { decision: 'exception', reason: 'Intentional', expectedUpdatedAt: gap.updatedAt }), { status: 409 });
    assert.equal(pagesReconciliationView(f.db, 'owner', 'a').gaps[0].status, 'open');
  } finally { f.db.close(); }
});
