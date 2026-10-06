// AGENT-WORK-01 A1: goal items with phases, gated actions, needs on actions, a live thread and one changeset across layers.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSession, createUser, initAccounts } from '../server/accounts.mjs';
import { agentWork, changesetKey, initAgentWork } from '../server/agent-work.mjs';
import { pushReport } from '../tools/aludel-client.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerApi } from '../server/layer-api.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { stopPortal, waitForPortal } from './portal-support.mjs';

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
  // W-8, the board's move rules: Draft ⇄ Ready; Ready → In progress only; nothing skips a column or drags to Done.
  assert.throws(() => work.move(ada, id, workId, 'review'), /Only an item in progress/, 'Ready can\'t skip to review');
  assert.throws(() => work.move(ada, id, workId, 'done'), /closes from the item/, 'nothing reaches Done by moving');
  assert.equal(work.move(ada, id, workId, 'draft').item.board, 'draft', 'a Ready item goes back to Draft');
  assert.throws(() => work.move(ada, id, workId, 'progress'), /Only a Ready item can start/, 'Draft can\'t skip to In progress');
  assert.equal(work.move(ada, id, workId, 'ready').item.board, 'ready', 'a defined Draft moves to Ready');
  assert.throws(() => work.claim(ben, id, workId), status(404), 'only members see the item');
  work.claim(ada, id, workId);
  assert.throws(() => work.assertPerformer(ben, id, workId), status(404));
  assert.throws(() => work.updateAction(agent, id, workId, 1, { state: 'working' }), /Start/, 'nothing works before Start');
  const started = work.move(ada, id, workId, 'progress');
  assert.equal(started.item.board, 'progress');
  assert.throws(() => work.move(ada, id, workId, 'draft'), /has started/, 'a started item can\'t go back to Draft');
  assert.throws(() => work.move(ada, id, workId, 'ready'), /can't move back to Ready/);
  assert.equal(started.performer, 'local');

  // The gate holds phase 2 back; phase 1's actions run side by side.
  assert.throws(() => work.updateAction(agent, id, workId, 3, { state: 'working' }), /review gate/);
  work.updateAction(agent, id, workId, 1, { state: 'working' });
  work.updateAction(agent, id, workId, 2, { state: 'working' });

  // A question sits on its action; the item waits on its person until it is answered.
  const asked = work.post(agent, id, workId, { kind: 'question', action: 1, text: 'Should Sign up link to Sign in?', options: ['Yes', 'No'] });
  assert.equal(asked.item.status, 'needs');
  assert.equal(asked.item.status, 'needs');
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
  assert.throws(() => work.updateAction(agent, id, workId, 4, { state: 'working' }), /waits for #3/);
  assert.throws(() => work.move(ada, id, workId, 'done'), /closes from the item/);

  const listed = work.goals(id, { assignedTo: ada.id });
  assert.deepEqual(listed.map(item => [item.ref, item.board]), [[ref, 'progress']]);
  const named = [...new Set(work.view(id, workId).actions.filter(action => action.state !== 'proposed' && action.layer).map(action => action.layer))].sort();
  assert.ok(named.length, 'the fixture names at least one layer');
  assert.deepEqual(listed[0].layers, named, 'the board card shows the layers its actions name');
  assert.equal(know.workList(id).find(item => item.id === workId).board, 'progress', 'every item carries its board column');
  assert.ok(work.view(id, workId).events.some(event => event.text === 'Answered: Yes'), 'the thread keeps the answer');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM layer_work_items WHERE project_id = ? AND work_scope = ?').get(id, 'goal').n, 1);
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
  work.define(agent, id, workId, { brief: 'A slogan and a joining activity.', actions: [{ layer: 'design', goal: 'Add a slogan' }, { layer: 'product', goal: 'Add the joining activity' }] });
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
  assert.deepEqual(changes.map(group => [group.layer, group.changes.map(change => change.op)]), [['design', ['create']], ['product', ['create']]]);
  assert.ok(!know.list(id, 'brand_asset').some(asset => asset.text === 'Borrow, don’t buy.'), 'nothing applies before close-out');
  assert.ok(JSON.stringify(work.readLayer(id, workId, 'product', { operationId: 'listActivities' })).includes('Join Tool Share'), 'reads see the item\'s own staged changes');
  assert.ok(!JSON.stringify(work.readLayer(id, null, 'product', { operationId: 'listActivities' })).includes('Join Tool Share'), 'other readers see the live records');
  assert.throws(() => work.readLayer(id, workId, 'product', { operationId: 'createActivity' }), /stage_change/);
  assert.equal(db.prepare('SELECT COUNT(DISTINCT layer_key) AS n FROM layer_run_drafts WHERE attempt_id = ? AND project_id = ?').get(changesetKey(workId), id).n, 2);
}));

test('a person drives a goal item in the portal while their local agent works it through the stdio tools', async () => {
  const { createServer } = await import('node:http');
  const { spawn, spawnSync } = await import('node:child_process');
  const root = mkdtempSync(join(tmpdir(), 'aludel-agent-work-http-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flow = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'w'), assetRoot: join(root, 'a'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token: draft } = flow.saveDraft(null, { profile: 'planner' });
  flow.saveDraft(draft, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
  const id = flow.claimDraft(draft, ada, ada).project.id;
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const origin = 'http://127.0.0.1:' + port;
  const stream = new AbortController();
  try {
    await waitForPortal(server, origin);
    const cookie = createSession(db, ada.id).split(';')[0];
    const portal = async (path, body, method = body ? 'POST' : 'GET') => {
      const response = await fetch(origin + '/api/projects/' + id + '/goals' + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, body: await response.json() };
    };
    const created = await portal('', { title: 'Create the sign-up flow', brief: 'people need to join' });
    assert.equal(created.status, 201);
    const workId = created.body.item.id;
    const apiToken = (await (await fetch(origin + '/api/projects/' + id + '/editor', { method: 'POST', headers: { cookie } })).json()).token;
    const editor = { authorization: 'Bearer ' + apiToken, 'content-type': 'application/json' };
    assert.equal((await fetch(origin + '/api/editor/goals/' + workId, { headers: editor })).status, 404, 'the agent sees an item once its person claims it');
    assert.equal((await fetch(origin + '/api/editor/goals/' + workId + '/define', { method: 'POST', headers: editor, body: '{}' })).status, 404);
    assert.equal((await portal('/' + workId + '/claim', {})).status, 200);

    const config = join(root, 'editor-client.json');
    const tool = new URL('../tools/editor-mcp.mjs', import.meta.url).pathname;
    assert.equal(spawnSync(process.execPath, [tool, 'pair', origin], { env: { ...process.env, ALUDEL_EDITOR_CONFIG: config }, input: apiToken + '\n', encoding: 'utf8', timeout: 5000 }).status, 0);
    let rpc = 0;
    const call = async calls => {
      const input = calls.map(([name, args]) => JSON.stringify({ jsonrpc: '2.0', id: ++rpc, method: 'tools/call', params: { name, arguments: args } })).join('\n') + '\n';
      const child = spawn(process.execPath, [tool], { env: { ...process.env, ALUDEL_EDITOR_CONFIG: config }, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { out += chunk; });
      child.stdin.end(input);
      await new Promise(resolve => child.on('close', resolve));
      return out.trim().split('\n').map(line => JSON.parse(line).result).map(result => result.isError ? { error: result.content[0].text } : JSON.parse(result.content[0].text));
    };
    const [stack, defined, listed] = await call([['stack_map', {}],
      ['define_work', { workId, brief: 'A visitor signs up and lands in their first world.', phases: [{ title: 'Specify', gated: true }, { title: 'Build' }], actions: [{ phase: 1, goal: 'Add sign-up to the flow' }, { phase: 2, goal: 'Build it' }] }],
      ['work_list', {}]]);
    assert.ok(Array.isArray(stack.layers));
    assert.equal(defined.item.board, 'ready');
    assert.deepEqual(listed.goals.map(item => [item.id, item.board, item.actions.todo]), [[workId, 'ready', 2]]);
    assert.equal((await portal('/' + workId + '/move', { to: 'progress' })).body.item.board, 'progress');

    const events = [];
    const live = await fetch(origin + '/api/projects/' + id + '/goals/' + workId + '/stream', { headers: { cookie }, signal: stream.signal });
    assert.equal(live.headers.get('content-type'), 'text/event-stream');
    (async () => { try { for await (const chunk of live.body) events.push(Buffer.from(chunk).toString()); } catch { /* closed */ } })();
    const [working, early, asked, refused] = await call([['update_action', { workId, number: 1, state: 'working' }], ['update_action', { workId, number: 2, state: 'working' }],
      ['ask', { workId, action: 1, text: 'Should Sign up link to Sign in?', options: ['Yes', 'No'] }], ['update_action', { workId, number: 1, state: 'done' }]]);
    assert.equal(working.actions[0].state, 'working');
    assert.match(early.error, /review gate/);
    assert.equal(asked.item.status, 'needs');
    assert.match(refused.error, /An agent can't move #1 from working to done/, 'only people finish actions');
    const until = Date.now() + 3000;
    while (!events.join('').includes('"kind":"question"') && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
    assert.match(events.join(''), /event: ready[\s\S]*event: change[\s\S]*"kind":"question"/, 'the page hears the question as it is asked');

    assert.equal((await portal('/' + workId + '/answer/' + asked.id, { choice: 'Yes' })).body.item.board, 'progress');
    assert.equal((await portal('/' + workId + '/events', { kind: 'steer', text: 'Keep it short' })).status, 201);
    assert.equal((await fetch(origin + '/api/editor/goals/' + workId + '/events', { method: 'POST', headers: editor, body: JSON.stringify({ kind: 'steer', text: 'No' }) })).status, 403, 'the agent does not steer');
    assert.equal((await fetch(origin + '/api/editor/tasks', { method: 'POST', headers: editor })).status, 405, 'other editor routes stay read only');
    const thread = (await portal('/' + workId)).body.events.map(event => event.text);
    assert.ok(thread.includes('Answered: Yes') && thread.includes('Keep it short'));
  } finally {
    stream.abort();
    await stopPortal(server);
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('A8: a checkout is connected once; the page assigns the item; Claude Code starts it on its own branch and reports committed code', async () => {
  const { createServer } = await import('node:http');
  const { execFileSync, spawn, spawnSync } = await import('node:child_process');
  const { existsSync, mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
  const root = mkdtempSync(join(tmpdir(), 'aludel-agent-work-cli-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flow = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'w'), assetRoot: join(root, 'a'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token: draft } = flow.saveDraft(null, { profile: 'planner' });
  flow.saveDraft(draft, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
  const id = flow.claimDraft(draft, ada, ada).project.id;
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const origin = 'http://127.0.0.1:' + port;
  try {
    await waitForPortal(server, origin);
    const cookie = createSession(db, ada.id).split(';')[0];
    const portal = async (path, body) => (await fetch(origin + '/api/projects/' + id + '/goals' + path, { method: body ? 'POST' : 'GET', headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
    const created = await portal('', { title: 'Add a borrow button', brief: 'A member borrows a tool from its page.' });
    const ref = created.item.ref, workId = created.item.id;
    await portal('', { title: 'Someone else’s later goal' });
    const apiToken = (await (await fetch(origin + '/api/projects/' + id + '/editor', { method: 'POST', headers: { cookie } })).json()).token;

    // A throwaway checkout, as the person's own clone of their app.
    const checkout = join(root, 'checkout'); mkdirSync(checkout);
    const git = (...args) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8' }).trim();
    git('init', '-q', '-b', 'main'); writeFileSync(join(checkout, 'README.md'), 'Tool Share\n');
    git('add', '.'); git('-c', 'user.name=Ada', '-c', 'user.email=ada@example.invalid', 'commit', '-qm', 'start');
    // Its origin stands in for the project's GitHub repository (CW-1: code is reported by pushing there).
    const github = join(root, 'github.git');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', github]); git('remote', 'add', 'origin', github); git('push', '-q', 'origin', 'main');
    // A person's own checkout, even when these tests run inside an item container (W-8 F23).
    const env = { ...process.env, ALUDEL_EDITOR_CONFIG: join(root, 'editor.json') }; delete env.ALUDEL_CONTAINER;
    const cli = (...args) => spawnSync(process.execPath, [new URL('../tools/aludel.mjs', import.meta.url).pathname, ...args], { cwd: checkout, env, input: apiToken + '\n', encoding: 'utf8', timeout: 8000 });

    assert.match(cli('list').stderr, /Pair first/);
    // Pairing, once per checkout: the token stays outside it, Claude Code here reaches Aludel, and the item page learns where it is.
    const paired = spawnSync(process.execPath, [new URL('../tools/aludel.mjs', import.meta.url).pathname, 'pair', origin.replace('127.0.0.1', 'aludel.localhost')],
      { cwd: checkout, env: { ...env, WSL_DISTRO_NAME: 'Ubuntu' }, input: apiToken + '\n', encoding: 'utf8', timeout: 8000 });
    assert.equal(paired.status, 0, paired.stderr);
    assert.match(paired.stdout, /Connected to .* as Ada/);
    const mcp = JSON.parse(readFileSync(join(checkout, '.mcp.json'), 'utf8'));
    assert.match(mcp.mcpServers.aludel.args[0], /tools\/editor-mcp\.mjs$/, 'Claude Code in the checkout reaches the Aludel tools');
    assert.match(readFileSync(join(checkout, '.git/info/exclude'), 'utf8'), /^\.mcp\.json$/m, 'the local connection stays out of commits');
    assert.equal(git('status', '--porcelain'), '');
    const editorStatus = await (await fetch(origin + '/api/projects/' + id + '/editor', { headers: { cookie } })).json();
    assert.deepEqual([editorStatus.checkout.path, editorStatus.checkout.distro], [git('rev-parse', '--show-toplevel'), 'Ubuntu'], 'the page can open this checkout');
    assert.equal((await fetch(origin + '/api/editor/checkout', { method: 'POST', headers: { authorization: 'Bearer ' + apiToken }, body: JSON.stringify({ path: 'relative/path' }) })).status, 400);
    const listed = cli('list');
    assert.match(listed.stdout, new RegExp(`${ref}\\s+Draft\\s+open`));

    // Who works on it is the assignee: a remote agent waits on A2; a person (here, herself) works on her own machine.
    assert.match((await portal('/' + workId + '/assign', { assignee: { kind: 'agent', id: 'agt-any' } })).error, /Remote agents come with the remote runtime/);
    assert.match((await portal('/' + workId + '/assign', { assignee: { kind: 'person', id: 'u-nobody' } })).error, /member of this project/);
    const assigned = await portal('/' + workId + '/assign', { assignee: { kind: 'person', id: ada.id } });
    assert.deepEqual([assigned.item.assignee.id, assigned.performer], [ada.id, 'local']);
    assert.equal((await portal('/' + workId + '/assign', { assignee: null })).item.assignee, null, 'unassigned until it starts');
    await portal('/' + workId + '/assign', { assignee: { kind: 'person', id: ada.id } });

    // Claude Code, as the agent, defines it; the person starts it on the page; the agent commits code on a branch and reports it.
    const tool = new URL('../tools/editor-mcp.mjs', import.meta.url).pathname;
    const call = calls => {
      const input = calls.map(([name, args], index) => JSON.stringify({ jsonrpc: '2.0', id: index + 1, method: 'tools/call', params: { name, arguments: args } })).join('\n') + '\n';
      const result = spawnSync(process.execPath, [tool], { cwd: checkout, env, input, encoding: 'utf8', timeout: 8000 });
      return result.stdout.trim().split('\n').map(line => JSON.parse(line).result).map(value => value.isError ? { error: value.content[0].text } : JSON.parse(value.content[0].text));
    };
    call([['define_work', { workId, brief: 'A member borrows a tool from its page.', actions: [{ goal: 'Add the borrow button' }] }]]);
    await portal('/' + workId + '/move', { to: 'progress' });
    assert.match((await portal('/' + workId + '/assign', { assignee: null })).error, /has started/, 'the assignee stays once it starts');
    // Open in VS Code asks Claude Code to work on it; its first call checks out the item's branch from the latest main.
    writeFileSync(join(checkout, 'README.md'), 'Tool Share, edited\n');
    assert.match(call([['start_work', { workId: ref }]])[0].error, /Commit or stash the 1 uncommitted change/);
    git('checkout', '-q', 'README.md');
    const [started, again] = call([['start_work', { workId: ref }], ['start_work', { workId }]]);
    assert.deepEqual([started.started.branch, started.started.created, started.started.base, started.item.item.id], [`aludel/${ref.toLowerCase()}`, true, 'origin/main', workId]);
    assert.equal(again.started.created, false, 'starting again keeps the branch');
    assert.equal(git('rev-parse', '--abbrev-ref', 'HEAD'), `aludel/${ref.toLowerCase()}`);
    assert.match(call([['start_work', { workId: 'W-999' }]])[0].error, /isn't assigned to your person/);
    writeFileSync(join(checkout, 'borrow.js'), 'export const borrow = () => true;\n');
    const [dirty] = call([['report_code', { workId }]]);
    assert.match(dirty.error, /Commit or stash the 1 uncommitted change/);
    git('add', '.'); git('-c', 'user.name=Ada', '-c', 'user.email=ada@example.invalid', 'commit', '-qm', 'borrow button');
    const [reported, moved] = call([['report_code', { workId }], ['update_action', { workId, number: 1, state: 'working' }]]);
    assert.deepEqual([reported.code.branch, reported.code.files], [`aludel/${ref.toLowerCase()}`, [{ path: 'borrow.js', status: 'added' }]]);
    assert.equal(reported.code.commit, git('rev-parse', 'HEAD'));
    assert.equal(moved.actions[0].state, 'working');

    writeFileSync(join(checkout, 'borrow.js'), 'export const borrow = tool => Boolean(tool);\n');
    assert.match(cli('submit', ref).stderr, /Commit or stash the 1 uncommitted change/);
    git('-c', 'user.name=Ada', '-c', 'user.email=ada@example.invalid', 'commit', '-qam', 'borrow takes a tool');
    const submitted = cli('submit', ref);
    assert.equal(submitted.status, 0, submitted.stderr);
    assert.match(submitted.stdout, /Still open: #1/);
    assert.equal((await portal('/' + workId)).code.commit, git('rev-parse', 'HEAD'));
    assert.equal(execFileSync('git', ['-C', github, 'rev-parse', `aludel/${ref.toLowerCase()}`], { encoding: 'utf8' }).trim(), git('rev-parse', 'HEAD'), 'submit pushed the branch');
    assert.match(submitted.stdout, /Pushed aludel\/w-\d+ and reported it/);
    const status = cli('status', ref).stdout;
    assert.match(status, /In progress/); assert.match(status, /#1 working/); assert.match(status, /Code: aludel\/w-\d+ at [0-9a-f]{7}, 1 files/);
    assert.ok(!existsSync(join(checkout, 'editor.json')), 'the token never lands in the checkout');
  } finally {
    await stopPortal(server);
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('A4: an action is reviewed on its own; a flag sends it back to its agent; close-out merges the code, sending conflicts back to rebase', () => fixture(({ db, work, ada, id }) => {
  const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
  const workId = work.createGoal(ada, id, { title: 'Borrow button' }).item.id;
  work.define(agent, id, workId, { brief: 'A member borrows a tool.', phases: [{ title: 'Build', gated: true }, { title: 'Polish' }], actions: [{ phase: 1, goal: 'Add the button' }, { phase: 2, goal: 'Tidy the copy' }] });
  work.claim(ada, id, workId); work.move(ada, id, workId, 'progress');
  work.updateAction(agent, id, workId, 1, { state: 'working' });
  assert.throws(() => work.review(ada, id, workId, 1, { verdict: 'approve' }), /isn't ready for review/);
  work.updateAction(agent, id, workId, 1, { state: 'review', summary: 'Button added' });
  assert.throws(() => work.review(ada, id, workId, 1, { verdict: 'flag' }), /Note is required/);
  const flagged = work.review(ada, id, workId, 1, { verdict: 'flag', note: 'Say how long the loan lasts' });
  assert.equal(flagged.actions[0].state, 'working');
  assert.deepEqual(flagged.events.filter(event => event.kind === 'flag').map(event => [event.action, event.text]), [[1, 'Say how long the loan lasts']], 'the agent reads the flag in its thread');
  work.updateAction(agent, id, workId, 1, { state: 'review', summary: 'Button says "for 3 days"' });
  assert.throws(() => work.updateAction(agent, id, workId, 2, { state: 'working' }), /review gate/);
  const approved = work.review(ada, id, workId, 1, { verdict: 'approve' });
  assert.equal(approved.actions[0].state, 'done');
  assert.equal(approved.actions[1].blocked, null, 'approving the phase clears its gate');
  work.updateAction(agent, id, workId, 2, { state: 'working' });

  // CW-1, as a second machine: the project's GitHub repository (a bare stand-in), Aludel's own copy of the project (main
  // checked out), and the person's checkout elsewhere. The two copies share nothing but the remote.
  const root = mkdtempSync(join(tmpdir(), 'aludel-merge-'));
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Ada', '-c', 'user.email=ada@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
  const github = join(root, 'github.git'), repo = join(root, 'project'), checkout = join(root, 'elsewhere', 'checkout');
  const remote = { url: github };
  try {
    git(root, 'init', '-q', '--bare', '-b', 'main', github);
    git(root, 'clone', '-q', github, repo);
    writeFileSync(join(repo, 'copy.txt'), 'Borrow\n'); git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'start'); git(repo, 'push', '-q', 'origin', 'main');
    git(root, 'clone', '-q', github, checkout); git(checkout, 'checkout', '-q', '-b', 'aludel/borrow');
    writeFileSync(join(checkout, 'copy.txt'), 'Borrow for 3 days\n'); writeFileSync(join(checkout, 'borrow.js'), 'export const borrow = () => true;\n');
    git(checkout, 'add', '.'); git(checkout, 'commit', '-qm', 'borrow button');
    writeFileSync(join(repo, 'copy.txt'), 'Borrow it\n'); git(repo, 'commit', '-qam', 'main moves the same line'); git(repo, 'push', '-q', 'origin', 'main');
    assert.throws(() => pushReport(join(root, 'project')), /Work on a branch named for the item, not main/);
    // The person's tools push the branch to GitHub and report it: branch, commit and files, never a folder path.
    const report = () => work.recordCode(agent, id, workId, { ...pushReport(checkout), checkout: '/an/old/client/still/sends/this' });
    assert.equal(report().code.checkout, undefined, 'a folder path is never stored');
    assert.equal(git(github, 'rev-parse', 'aludel/borrow'), git(checkout, 'rev-parse', 'HEAD'), 'the branch is on GitHub');
    assert.throws(() => work.recordCode(agent, id, workId, { branch: 'bad branch;', commit: 'a'.repeat(40) }), /Name a git branch/);
    work.updateAction(agent, id, workId, 2, { state: 'review' });
    assert.throws(() => work.closeOut(ada, id, workId), /Move .* to review first/);
    work.move(ada, id, workId, 'review');
    assert.throws(() => work.closeOut(ada, id, workId), /Review #2 first/);
    work.review(ada, id, workId, 2, { verdict: 'approve' });
    assert.throws(() => work.fetchCode(id, workId, remote), /no repository with a main branch/);
    db.prepare('UPDATE project_setup SET workspace_path = ? WHERE project_id = ?').run(repo, id);
    assert.equal(work.view(id, workId).code.target, 'main');
    assert.throws(() => work.closeOut(ada, id, workId), /doesn't have aludel\/borrow at [0-9a-f]{7}\. Push it/, 'nothing reaches into the checkout');
    assert.throws(() => work.fetchCode(id, workId, null), /no GitHub repository to fetch aludel\/borrow from/);

    // A conflict goes back to the agent, who rebases onto GitHub's main and pushes and reports again.
    const mainBefore = git(repo, 'rev-parse', 'main');
    work.fetchCode(id, workId, remote);
    assert.throws(() => work.closeOut(ada, id, workId), error => error.status === 409 && /conflicts with main in copy\.txt\. Sent back to the agent to rebase/.test(error.message));
    const sentBack = work.view(id, workId);
    assert.equal(sentBack.item.board, 'progress');
    assert.match(sentBack.events.at(-1).text, /couldn't merge aludel\/borrow into main: it conflicts in copy\.txt\. Rebase it onto main/);
    assert.equal(git(repo, 'rev-parse', 'main'), mainBefore, 'nothing merged');
    git(checkout, 'fetch', '-q', 'origin'); git(checkout, 'reset', '-q', '--hard', 'origin/main');
    writeFileSync(join(checkout, 'borrow.js'), 'export const borrow = () => true;\n'); git(checkout, 'add', '.'); git(checkout, 'commit', '-qm', 'borrow button, rebased');
    report();
    // Main moves again without conflict, and the branch moves on GitHub after it was reported: close-out refuses until the
    // code is reported again, so what merges is what was reviewed.
    writeFileSync(join(repo, 'other.txt'), 'elsewhere\n'); git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'unrelated');
    work.move(ada, id, workId, 'review');
    writeFileSync(join(checkout, 'late.txt'), 'unreviewed\n'); git(checkout, 'add', '.'); git(checkout, 'commit', '-qm', 'late change'); git(checkout, 'push', '-q', 'origin', 'aludel/borrow');
    assert.throws(() => work.fetchCode(id, workId, remote), /aludel\/borrow is at [0-9a-f]{7} on GitHub, but [0-9a-f]{7} was reported\. Report the code again/);
    git(checkout, 'reset', '-q', '--hard', 'HEAD~1'); pushReport(checkout);
    // The checkout is gone from this machine's view entirely: close-out needs only GitHub.
    rmSync(join(root, 'elsewhere'), { recursive: true, force: true });
    assert.equal(work.fetchCode(id, workId, remote), work.view(id, workId).code.commit);
    const closed = work.closeOut(ada, id, workId);
    assert.equal(closed.item.board, 'done');
    assert.equal(closed.code.merged.mode, 'merge commit');
    assert.equal(git(repo, 'rev-parse', 'main'), closed.code.merged.commit);
    assert.equal(git(repo, 'rev-list', '--parents', '-n', '1', 'main').split(' ').length, 3, 'a merge commit');
    assert.match(git(repo, 'log', '-1', '--format=%s %an', 'main'), /^Merge aludel\/borrow \(W-\d+: Borrow button\) Ada$/);
    assert.ok(existsSync(join(repo, 'borrow.js')) && existsSync(join(repo, 'other.txt')) && !existsSync(join(repo, 'late.txt')), 'the reviewed commit merged, not the late one');
    assert.equal(git(repo, 'status', '--porcelain'), '');
    assert.equal(closed.code.inRepository, true);
    assert.match(closed.events.at(-1).text, /Closed: applied 0 record changes; merged aludel\/borrow into main with a merge commit \([0-9a-f]{7}\)/);
  } finally { rmSync(root, { recursive: true, force: true }); }
}));

test('A4: close-out applies the staged changes of every layer at once, and refuses when a record moved since', { skip: !templates && 'needs layer templates' }, () => fixture(({ know, work, ada, id }) => {
  const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
  const workId = work.createGoal(ada, id, { title: 'Brand the sign-up flow' }).item.id;
  work.define(agent, id, workId, { brief: 'A slogan and a joining activity.', actions: [{ layer: 'design', goal: 'Add a slogan' }, { layer: 'product', goal: 'Add the joining activity' }] });
  work.claim(ada, id, workId); work.move(ada, id, workId, 'progress');
  for (const number of [1, 2]) work.updateAction(agent, id, workId, number, { state: 'working' });
  work.stage(agent, id, workId, { action: 1, operationId: 'createBrandAsset', body: { asset: { name: 'Slogan', type: 'text', text: 'Borrow, don’t buy.' } } });
  const activity = work.stage(agent, id, workId, { action: 2, operationId: 'createActivity', body: { activity: { title: 'Join Tool Share' } } });
  assert.deepEqual(work.view(id, workId).changeset.map(group => group.changes.map(change => change.action)), [[1], [2]], 'each change knows the action that staged it');
  for (const number of [1, 2]) { work.updateAction(agent, id, workId, number, { state: 'review' }); work.review(ada, id, workId, number, { verdict: 'approve' }); }
  work.move(ada, id, workId, 'review');
  const closed = work.closeOut(ada, id, workId);
  assert.equal(closed.item.board, 'done');
  assert.ok(know.list(id, 'brand_asset').some(asset => asset.text === 'Borrow, don’t buy.'), 'Design got its slogan');
  assert.ok(know.get(id, activity.staged.id), 'Vision got its activity');
  assert.match(closed.events.at(-1).text, /Closed: applied 2 record changes/);

  // A second item whose record moved under it.
  const second = work.createGoal(ada, id, { title: 'Rename the slogan' }).item.id;
  const slogan = know.list(id, 'brand_asset').find(asset => asset.text === 'Borrow, don’t buy.');
  work.define(agent, id, second, { brief: 'Shorter.', actions: [{ layer: 'design', goal: 'Shorten it' }] });
  work.claim(ada, id, second); work.move(ada, id, second, 'progress');
  work.updateAction(agent, id, second, 1, { state: 'working' });
  work.stage(agent, id, second, { action: 1, operationId: 'updateBrandAsset', id: slogan.id, body: { changes: { text: 'Borrow it.' } } });
  know.update(id, slogan.id, { text: 'Borrow, never buy.' }, { author: 'Ada' });
  work.updateAction(agent, id, second, 1, { state: 'review' }); work.review(ada, id, second, 1, { verdict: 'approve' }); work.move(ada, id, second, 'review');
  assert.throws(() => work.closeOut(ada, id, second), /was changed since it was staged/);
  assert.equal(know.get(id, slogan.id).text, 'Borrow, never buy.', 'nothing applied');
}));

test('E3: an action that fails can end the item as not done: a wrap-up proposes what comes first, and close-out applies and merges nothing', () => fixture(({ know, work, ada, ben, id }) => {
  const [first, second] = work.stackMap(id).map(layer => layer.key);
  const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
  const workId = work.createGoal(ada, id, { title: 'Kanban board', brief: 'a board' }).item.id;
  work.define(agent, id, workId, { brief: 'A board for every item.', actions: [{ layer: first, goal: 'Spec the board' }, { layer: second, goal: 'Build the board', after: [1] }] });
  work.claim(ada, id, workId); work.move(ada, id, workId, 'progress');
  work.updateAction(agent, id, workId, 1, { state: 'working' });
  assert.throws(() => work.addAction(agent, id, workId, { goal: 'Wrap up', wrapUp: true }), /Say why/);

  // #1 fails: the agent judges it can't be fixed this time, and proposes ending as not done. Its person approves.
  let view = work.addAction(agent, id, workId, { goal: 'Wrap up and propose what comes first', wrapUp: true, reason: "The container can't build the portal" });
  const wrap = view.actions.at(-1);
  assert.deepEqual([wrap.number, wrap.kind, wrap.state, view.ending], [3, 'wrap-up', 'proposed', null], 'nothing ends until its person approves');
  assert.throws(() => work.addAction(agent, id, workId, { goal: 'Again', wrapUp: true, reason: 'twice' }), /already has a wrap-up/);
  work.answer(ada, id, workId, view.needs.find(need => need.kind === 'approval').id, { allow: true });
  view = work.view(id, workId);
  assert.deepEqual(view.ending, { kind: 'not-done', action: 3, reason: "The container can't build the portal" });
  assert.equal(view.actions.find(action => action.number === 3).blocked, null, 'a wrap-up waits on nothing');

  // It proposes the prerequisites and the retry; the retry comes after both.
  assert.throws(() => work.proposeItems(agent, id, workId, 3, { items: [{ title: 'x', why: 'y' }] }), /working/);
  work.updateAction(agent, id, workId, 3, { state: 'working' });
  assert.throws(() => work.proposeItems(agent, id, workId, 3, { items: [{ title: 'Retry', why: 'later', after: [0] }] }), /earlier item/);
  work.proposeItems(agent, id, workId, 3, { items: [{ title: 'Fetch templates in the container', why: 'The build needs layer-base', brief: 'Serve them' },
    { title: 'Personas in Pages', why: 'Flows need a persona' }, { title: 'Kanban board, again', why: 'The retry', after: [0, 1] }] });
  view = work.updateAction(agent, id, workId, 3, { state: 'review', summary: 'Ended: the container cannot build the portal.' });
  const proposals = view.actions.find(action => action.number === 3).proposals;
  assert.deepEqual(proposals.map(proposal => [proposal.position, proposal.state]), [[0, 'proposed'], [1, 'proposed'], [2, 'proposed']]);
  assert.deepEqual(proposals[2].after, [proposals[0].id, proposals[1].id]);

  // Only the wrap-up is reviewed; #1 and #2 stay as they were.
  work.move(ada, id, workId, 'review');
  work.review(ada, id, workId, 3, { verdict: 'approve' });
  assert.throws(() => work.closeOut(ada, id, workId), /3 proposed items first/);
  // Created out of order, the dependencies still become blocking links; an edited title is kept; one is dismissed.
  assert.throws(() => work.decideProposal(ben, id, workId, proposals[0].id, { decision: 'create' }), status(404), 'members only');
  const retry = know.workById(id, work.decideProposal(ada, id, workId, proposals[2].id, { decision: 'create', task: { title: 'Kanban board (attempt 2)' } })
    .actions.find(action => action.number === 3).proposals[2].createdWorkId);
  assert.deepEqual([retry.title, retry.scope, retry.board], ['Kanban board (attempt 2)', 'goal', 'draft']);
  const templatesItem = know.workById(id, work.decideProposal(ada, id, workId, proposals[0].id, { decision: 'create' }).actions.find(action => action.number === 3).proposals[0].createdWorkId);
  work.decideProposal(ada, id, workId, proposals[1].id, { decision: 'dismiss' });
  assert.throws(() => work.decideProposal(ada, id, workId, proposals[1].id, { decision: 'create' }), status(409));
  assert.deepEqual(know.workById(id, templatesItem.id).blocks, [retry.id], 'the prerequisite blocks the retry');
  assert.deepEqual(know.workList(id).find(item => item.id === retry.id).blockedBy, [templatesItem.id]);
  assert.match(work.view(id, retry.id).events.map(event => event.text).join('\n'), /Proposed in W-\d+ #3: The retry/, 'it says where it came from');

  const ended = work.closeOut(ada, id, workId);
  assert.deepEqual([ended.item.board, ended.outcome.kind, ended.outcome.reason, ended.merged], ['done', 'not-done', 'Ended: the container cannot build the portal.', null]);
  assert.deepEqual(ended.actions.map(action => action.state), ['working', 'todo', 'done'], 'the abandoned actions are left as they were');
  assert.match(ended.events.at(-1).text, new RegExp(`Ended as not done: 0 staged record changes not applied; continued in ${templatesItem.ref}, ${retry.ref}`));
}));

test('W-8 small findings: a to-do action is dropped (F24); a person ends an item as not done themself; goal items carry no legacy status (F5)', () => fixture(({ know, work, ada, id }) => {
  const [first, second] = work.stackMap(id).map(layer => layer.key);
  const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
  const workId = work.createGoal(ada, id, { title: 'Board', brief: 'b' }).item.id;
  work.define(agent, id, workId, { brief: 'A board.', actions: [{ layer: first, goal: 'Spec it' }, { layer: second, goal: 'Tasks tab' }, { layer: second, goal: 'Build it', after: [2] }] });
  work.claim(ada, id, workId); work.move(ada, id, workId, 'progress');
  assert.notEqual(know.workById(id, workId).status, 'blocked');
  assert.equal(know.workById(id, workId).migration, null, 'no layer-action migration on a goal item');
  work.updateAction(agent, id, workId, 1, { state: 'working' });
  assert.throws(() => work.dropAction(ada, id, workId, 1), /has started/);
  let view = work.dropAction(ada, id, workId, 2);
  assert.deepEqual(view.actions.map(action => [action.number, action.after]), [[1, []], [3, []]], '#3 no longer waits on the dropped #2');
  work.post(agent, id, workId, { kind: 'question', action: 1, text: 'Which columns?' });
  assert.throws(() => work.endAsNotDone(ada, id, workId, {}), /Reason is required/);
  view = work.endAsNotDone(ada, id, workId, { reason: "The container can't build the portal." });
  assert.deepEqual([view.item.board, view.outcome.kind, view.outcome.reason, view.needs.length], ['done', 'not-done', "The container can't build the portal.", 0], 'its open question is withdrawn');
  assert.equal(view.actions.at(-1).kind, 'wrap-up');
  assert.throws(() => work.endAsNotDone(ada, id, workId, { reason: 'again' }), status(409));
}));

test('W-8 F7/F18: an operation is described with its body schema and the host catalogs it checks', { skip: !templates && 'needs layer templates' }, () => fixture(({ work, id }) => {
  const described = work.describeOperation(id, 'pages', 'createFlow');
  assert.equal(described.writes, 'flow');
  assert.deepEqual(described.body.required, ['flow']);
  assert.ok(described.schemas.Flow, 'the schemas it refers to come with it');
  assert.ok(described.catalogs.pageTypes.includes('board'), 'with the catalogs it checks (F19: a Board page type)');
  assert.throws(() => work.describeOperation(id, 'pages', 'nope'), /stack_map lists them/);
}));

test('W-8 F34: an action added to an item in review sends it back to In progress; a person can take it back, or remove a to-do action', () => fixture(({ work, ada, id }) => {
  const [first] = work.stackMap(id).map(layer => layer.key);
  const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
  const workId = work.createGoal(ada, id, { title: 'Board', brief: 'b' }).item.id;
  work.define(agent, id, workId, { brief: 'A board.', actions: [{ layer: first, goal: 'Build it' }] });
  work.claim(ada, id, workId); work.move(ada, id, workId, 'progress');
  work.updateAction(agent, id, workId, 1, { state: 'working' }); work.updateAction(agent, id, workId, 1, { state: 'review' });
  work.review(ada, id, workId, 1, { verdict: 'approve' });
  work.move(ada, id, workId, 'review');
  // The agent proposes #2 while the item is in review; approving it sends the item back, so #2 can be worked.
  let view = work.addAction(agent, id, workId, { goal: 'Align the spec', reason: 'Three details no longer match' });
  assert.equal(view.item.board, 'review', 'a proposal alone changes nothing');
  work.answer(ada, id, workId, view.needs[0].id, { allow: true });
  assert.equal(work.view(id, workId).item.board, 'progress');
  work.updateAction(agent, id, workId, 2, { state: 'working' });
  work.updateAction(agent, id, workId, 2, { state: 'review' }); work.review(ada, id, workId, 2, { verdict: 'approve' });
  // A person's own action added in review does the same; or they take the item back themselves, or remove the action.
  work.move(ada, id, workId, 'review');
  assert.equal(work.addAction(ada, id, workId, { goal: 'One more check' }).item.board, 'progress');
  assert.throws(() => work.move(ada, id, workId, 'review'), /#3 is not ready/);
  view = work.dropAction(ada, id, workId, 3);
  assert.equal(work.move(ada, id, workId, 'review').item.board, 'review', 'with it removed, the item goes to review');
  assert.equal(work.move(ada, id, workId, 'progress').item.board, 'progress', 'Back to In progress');
}));
