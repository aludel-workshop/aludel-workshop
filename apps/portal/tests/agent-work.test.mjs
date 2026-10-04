// AGENT-WORK-01 A1: goal items with phases, gated actions, needs on actions, a live thread and one changeset across layers.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentWork, changesetKey, initAgentWork } from '../server/agent-work.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerApi } from '../server/layer-api.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const templates = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1';
function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'aludel-agent-work-'));
  const old = process.env.MACHINE_DATA_DIR;
  process.env.MACHINE_DATA_DIR = dir;
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db); initAgentWork(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const ben = createUser(db, { email: 'ben@example.com', name: 'Ben', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
    const { project } = flow.claimDraft(token, ada, ada);
    know.ensureDesign(project.id);
    run({ db, know, work: agentWork({ db, know }), ada, ben, id: project.id });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (old === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = old;
  }
}
const status = code => error => error.status === code;

test('a goal item is defined in phases, starts deliberately, and gates later actions until the earlier ones are done', () => fixture(({ db, know, work, ada, ben, id }) => {
  const layers = work.stackMap(id).map(layer => layer.key);
  assert.ok(layers.length >= 2, 'the stack map lists the installed layers');
  const [first, second] = layers;
  const draft = work.createGoal(ada, id, { title: 'Create the sign-up flow', brief: 'people need to join' });
  const ref = draft.item.ref, workId = draft.item.id;
  assert.equal(draft.item.scope, 'goal');
  assert.equal(draft.item.board, 'draft');
  assert.equal(draft.item.assignee, null, 'a goal item starts unassigned');
  assert.throws(() => work.move(ada, id, workId, 'ready'), status(409), 'a rough draft is defined before Ready');
  assert.throws(() => work.define(ada, id, workId, { brief: 'x', actions: [{ goal: 'y', layer: 'nowhere' }] }), /Unknown layer/);
  assert.throws(() => work.define(ada, id, workId, { brief: 'x', actions: [{ goal: 'a', after: [2] }, { goal: 'b' }] }), /earlier action/);

  const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
  const defined = work.define(agent, id, workId, { brief: 'A visitor signs up and lands in their first world.',
    phases: [{ title: 'Specify', gated: true }, { title: 'Build', gated: false }],
    actions: [{ phase: 1, layer: first, goal: 'Add sign-up to the flow' }, { phase: 1, layer: second, goal: 'Let a member hold a password' },
      { phase: 2, layer: first, goal: 'Build it', after: [] }, { phase: 2, layer: second, goal: 'Check together', after: [3] }] });
  assert.equal(defined.item.board, 'ready', 'defining moves a draft to Ready');
  assert.deepEqual(defined.actions.map(action => [action.number, action.state, Boolean(action.blocked)]), [[1, 'todo', false], [2, 'todo', false], [3, 'todo', true], [4, 'todo', true]]);
  assert.match(defined.actions[2].blocked, /review gate after Specify/);

  assert.throws(() => work.move(ada, id, workId, 'progress'), /Choose who works/, 'starting needs someone on it');
  assert.throws(() => work.claim(ben, id, workId), status(404), 'only members see the item');
  work.claim(ada, id, workId);
  assert.throws(() => work.assertPerformer(ben, id, workId), status(404));
  assert.throws(() => work.updateAction(agent, id, workId, 1, { state: 'working' }), /Start/, 'nothing works before Start');
  const started = work.move(ada, id, workId, 'progress');
  assert.equal(started.item.board, 'progress');
  assert.equal(started.performer, 'local');

  // The gate holds phase 2 back; phase 1's actions run side by side.
  assert.throws(() => work.updateAction(agent, id, workId, 3, { state: 'working' }), /review gate/);
  work.updateAction(agent, id, workId, 1, { state: 'working' });
  work.updateAction(agent, id, workId, 2, { state: 'working' });

  // A question sits on its action; the item waits on its person until it is answered.
  const asked = work.post(agent, id, workId, { kind: 'question', action: 1, text: 'Should Sign up link to Sign in?', options: ['Yes', 'No'] });
  assert.equal(asked.item.status, 'needs');
  assert.equal(asked.actions[0].needs.length, 1);
  assert.throws(() => work.post(agent, id, workId, { kind: 'question', text: 'Floating?' }), /sits on an action/);
  assert.throws(() => work.post({ kind: 'person', id: ada.id, name: 'Ada' }, id, workId, { kind: 'question', action: 1, text: 'x' }), status(403));
  const answered = work.answer(ada, id, workId, asked.id, { choice: 'Yes' });
  assert.equal(answered.item.board, 'progress');
  assert.equal(answered.needs.length, 0);
  assert.throws(() => work.answer(ada, id, workId, asked.id, { choice: 'No' }), status(409));

  // An agent's new action mid-run waits for approval; declining removes it, approving makes it ordinary.
  const proposed = work.addAction(agent, id, workId, { phase: 1, layer: first, goal: 'Screenshot each new page on a phone', reason: 'The flow has three new pages' });
  const extra = proposed.actions.at(-1);
  assert.equal(extra.state, 'proposed');
  assert.equal(extra.needs[0].kind, 'approval');
  assert.throws(() => work.updateAction(agent, id, workId, extra.number, { state: 'working' }), /waits for approval/);
  const approved = work.answer(ada, id, workId, extra.needs[0].id, { allow: true });
  assert.equal(approved.actions.at(-1).state, 'todo');
  const mine = work.addAction({ kind: 'person', id: ada.id, name: 'Ada' }, id, workId, { phase: 2, goal: 'Keep the welcome line short' });
  assert.equal(mine.actions.at(-1).state, 'todo', "a person's own action needs no approval");

  // Agents hand actions to review; only people finish them. Finishing phase 1 clears the gate.
  assert.throws(() => work.updateAction(agent, id, workId, 1, { state: 'done' }), status(409));
  for (const number of [1, 2]) work.updateAction(agent, id, workId, number, { state: 'review', summary: 'Ready to look at' });
  assert.throws(() => work.move(ada, id, workId, 'review'), /not ready for review/);
  const person = { kind: 'person', id: ada.id, name: 'Ada' };
  for (const number of [1, 2]) work.updateAction(person, id, workId, number, { state: 'done' });
  assert.throws(() => work.updateAction(agent, id, workId, 3, { state: 'working' }), /review gate/, 'the approved extra action in phase 1 still holds the gate');
  work.updateAction(person, id, workId, 5, { state: 'done' });
  work.updateAction(agent, id, workId, 3, { state: 'working' });
  assert.throws(() => work.updateAction(agent, id, workId, 4, { state: 'working' }), /Waits for #3/);
  assert.throws(() => work.move(ada, id, workId, 'done'), /closes from the item/);

  const listed = work.goals(id, { assignedTo: ada.id });
  assert.deepEqual(listed.map(item => [item.ref, item.board]), [[ref, 'progress']]);
  assert.equal(know.workList(id).find(item => item.id === workId).board, 'progress', 'every item carries its board column');
  assert.ok(work.view(id, workId).events.some(event => event.text === 'Answered: Yes'), 'the thread keeps the answer');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM layer_work_items WHERE work_scope = ?').get('goal').n, 1);
}));

test('the thread streams to subscribers, and steering is a person\'s', () => fixture(({ work, ada, id }) => {
  const workId = work.createGoal(ada, id, { title: 'Zoom the world map' }).item.id;
  const seen = [];
  const stop = work.subscribe(id, workId, change => seen.push(change));
  work.post({ kind: 'person', id: ada.id, name: 'Ada' }, id, workId, { kind: 'steer', text: 'Keep it simple' });
  assert.throws(() => work.post({ kind: 'agent', id: 'x', name: 'Agent' }, id, workId, { kind: 'steer', text: 'No' }), error => error.status === 403);
  stop();
  work.post({ kind: 'person', id: ada.id, name: 'Ada' }, id, workId, { text: 'After unsubscribing' });
  assert.deepEqual(seen.map(change => [change.type, change.kind]), [['event', 'steer']]);
  assert.throws(() => work.subscribe(id, 'wrk-missing', () => {}), error => error.status === 404);
}));

test('one changeset across layers, staged through each layer\'s API and read back through it', { skip: !templates && 'needs layer templates' }, () => fixture(({ db, know, work, ada, id }) => {
  const workId = work.createGoal(ada, id, { title: 'Brand the sign-up flow' }).item.id;
  const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
  work.define(agent, id, workId, { brief: 'A slogan and a joining activity.', actions: [{ layer: 'design', goal: 'Add a slogan' }, { layer: 'vision', goal: 'Add the joining activity' }] });
  work.claim(ada, id, workId); work.move(ada, id, workId, 'progress');
  assert.throws(() => work.stage(agent, id, workId, { action: 1, operationId: 'createBrandAsset', body: {} }), /Move #1 to working/);
  work.updateAction(agent, id, workId, 1, { state: 'working' });
  work.updateAction(agent, id, workId, 2, { state: 'working' });
  const slogan = work.stage(agent, id, workId, { action: 1, operationId: 'createBrandAsset', body: { asset: { name: 'Slogan', type: 'text', text: 'Borrow, don’t buy.' } } });
  assert.equal(slogan.staged.kind, 'brand_asset');
  assert.throws(() => work.stage(agent, id, workId, { action: 1, operationId: 'createBrandAsset', body: { asset: { name: 'Second name', type: 'text', key: 'name', text: 'Shed' } } }), /already the app's name/,
    "the layer's own rules check a staged change");
  work.stage(agent, id, workId, { action: 2, operationId: 'createActivity', body: { activity: { title: 'Join Tool Share' } } });
  const changes = work.view(id, workId).changeset;
  assert.deepEqual(changes.map(group => [group.layer, group.changes.map(change => change.op)]), [['design', ['create']], ['vision', ['create']]]);
  assert.ok(!know.list(id, 'brand_asset').some(asset => asset.text === 'Borrow, don’t buy.'), 'nothing applies before close-out');
  const listOp = [...(work.stackMap(id).find(layer => layer.key === 'vision').operations)].find(op => op.reads && /activit/i.test(op.operationId));
  if (listOp) assert.ok(JSON.stringify(work.readLayer(id, workId, 'vision', { operationId: listOp.operationId })).includes('Join Tool Share'), 'reads see the item\'s own staged changes');
  assert.equal(db.prepare('SELECT COUNT(DISTINCT layer_key) AS n FROM layer_run_drafts WHERE attempt_id = ?').get(changesetKey(workId)).n, 2);
}));
