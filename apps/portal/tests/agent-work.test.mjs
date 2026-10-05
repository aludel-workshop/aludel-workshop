// AGENT-WORK-01 A1: goal items with phases, gated actions, needs on actions, a live thread and one changeset across layers.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSession, createUser, initAccounts } from '../server/accounts.mjs';
import { agentWork, changesetKey, initAgentWork } from '../server/agent-work.mjs';
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

test('A8: the aludel CLI claims a goal item from a checkout, connects Claude Code to Aludel, and reports committed code', async () => {
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
    const env = { ...process.env, ALUDEL_EDITOR_CONFIG: join(root, 'editor.json') };
    const cli = (...args) => spawnSync(process.execPath, [new URL('../tools/aludel.mjs', import.meta.url).pathname, ...args], { cwd: checkout, env, input: apiToken + '\n', encoding: 'utf8', timeout: 8000 });

    assert.match(cli('list').stderr, /Pair first/);
    const paired = cli('pair', origin);
    assert.equal(paired.status, 0, paired.stderr);
    assert.match(paired.stdout, /Connected to .* as Ada/);
    const listed = cli('list');
    assert.match(listed.stdout, new RegExp(`${ref}\\s+Draft\\s+open`));
    const claimed = cli('claim', ref.toLowerCase());
    assert.equal(claimed.status, 0, claimed.stderr);
    assert.match(claimed.stdout, new RegExp(`Work on ${ref} \\(${workId}\\) using the Aludel tools`));
    const mcp = JSON.parse(readFileSync(join(checkout, '.mcp.json'), 'utf8'));
    assert.match(mcp.mcpServers.aludel.args[0], /tools\/editor-mcp\.mjs$/, 'Claude Code in the checkout reaches the Aludel tools');
    assert.match(readFileSync(join(checkout, '.git/info/exclude'), 'utf8'), /^\.mcp\.json$/m, 'the local connection stays out of commits');
    assert.equal(git('status', '--porcelain'), '');
    assert.equal((await portal('/' + workId)).item.assignee.id, ada.id);
    assert.equal(cli('claim', 'W-999').status, 1);

    // Claude Code, as the agent, defines it; the person starts it on the page; the agent commits code on a branch and reports it.
    const tool = new URL('../tools/editor-mcp.mjs', import.meta.url).pathname;
    const call = calls => {
      const input = calls.map(([name, args], index) => JSON.stringify({ jsonrpc: '2.0', id: index + 1, method: 'tools/call', params: { name, arguments: args } })).join('\n') + '\n';
      const result = spawnSync(process.execPath, [tool], { cwd: checkout, env, input, encoding: 'utf8', timeout: 8000 });
      return result.stdout.trim().split('\n').map(line => JSON.parse(line).result).map(value => value.isError ? { error: value.content[0].text } : JSON.parse(value.content[0].text));
    };
    call([['define_work', { workId, brief: 'A member borrows a tool from its page.', actions: [{ goal: 'Add the borrow button' }] }]]);
    await portal('/' + workId + '/move', { to: 'progress' });
    git('checkout', '-q', '-b', `aludel/${ref.toLowerCase()}`);
    writeFileSync(join(checkout, 'borrow.js'), 'export const borrow = () => true;\n');
    const [dirty] = call([['report_code', { workId }]]);
    assert.match(dirty.error, /Commit first/);
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
    const status = cli('status', ref).stdout;
    assert.match(status, /In progress/); assert.match(status, /#1 working/); assert.match(status, /Code: aludel\/w-\d+ at [0-9a-f]{7}, 1 files/);
    assert.ok(!existsSync(join(checkout, 'editor.json')), 'the token never lands in the checkout');
  } finally {
    await stopPortal(server);
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
