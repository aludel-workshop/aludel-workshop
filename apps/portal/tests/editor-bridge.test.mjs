import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSession, createUser, initAccounts } from '../server/accounts.mjs';
import { initEditorBridge, editorBridge } from '../server/editor-bridge.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { waitForPortal, stopPortal } from './portal-support.mjs';

test('editor connection scopes a versioned task bundle and live knowledge to its member and project', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-editor-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initEditorBridge(db);
  const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'),
    assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const ben = createUser(db, { email: 'ben@example.com', name: 'Ben', password: 'correct-horse-battery' });
  const makeProject = (person, name) => {
    const { token } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(token, { name, pitch: 'A useful test project.' });
    const { project } = flows.claimDraft(token, person, person);
    flows.saveFeatures(person, project.id, { picks: ['accounts'] });
    return project.id;
  };
  const adaProject = makeProject(ada, 'Buddy Box');
  const benProject = makeProject(ben, 'Other Project');
  const story = know.list(adaProject, 'story')[0];
  const otherStory = know.list(benProject, 'story')[0];
  const work = know.createWork(adaProject, { action: 'platform.implement', title: 'Build a feature', assignee: { kind: 'person', id: ada.id },
    targets: [{ id: story.id, label: 'Story' }] }, ada.name);
  const bridge = editorBridge({ db, know, projectSetup: (user, id) => flows.projectSetup(user, id), previewStatus: () => ({ status: 'stopped' }) });
  assert.throws(() => bridge.authenticate(''), error => error.status === 401);
  assert.throws(() => bridge.issue(ben, adaProject), error => error.status === 404);
  const issued = bridge.issue(ada, adaProject);
  assert.equal(issued.tools.includes('task_context'), true);
  assert.equal(bridge.authenticate('Bearer ' + issued.token).projectId, adaProject);
  assert.deepEqual(bridge.assigned(ada, adaProject).map(item => item.id), [work.id]);
  assert.equal(bridge.assigned(ben, benProject).length, 0);
  assert.throws(() => bridge.context(ben, adaProject, work.id), error => error.status === 404);
  assert.throws(() => bridge.record(adaProject, otherStory.id), error => error.status === 404);
  assert.equal(bridge.search(adaProject, story.title.slice(0, 12)).some(item => item.id === story.id), true);
  const unsupported = know.createWork(adaProject, { action: 'work.milestone', title: 'Plan the next step', assignee: { kind: 'person', id: ada.id } }, ada.name);
  assert.equal(bridge.context(ada, adaProject, unsupported.id).taskOpen.available, false, 'ordinary personal work remains readable without an agent adapter');
  const first = bridge.context(ada, adaProject, work.id);
  assert.equal(first.sources[0].revision, story.revision);
  assert.equal(first.taskOpen.outputs[0].kind, 'code_candidate');
  assert.equal(first.taskOpen.task.performer.kind, 'person');
  assert.equal(first.taskOpen.capabilities.submit, 'none through editor bridge');
  assert.equal(bridge.saved(ada, adaProject, first.digest).taskOpen.schemaVersion, 'aludel-task-open-v1');
  assert.equal(bridge.context(ada, adaProject, work.id).digest, first.digest, 'unchanged inputs keep the same bundle identity');
  assert.equal(bridge.saved(ada, adaProject, first.digest).work.id, work.id);
  know.update(adaProject, story.id, { why: 'A changed need' }, { expectedRevision: story.revision, author: ada.name, rationale: 'New evidence' });
  const second = bridge.context(ada, adaProject, work.id);
  assert.notEqual(second.digest, first.digest);
  assert.equal(bridge.saved(ada, adaProject, first.digest).sources[0].revision, story.revision);
  assert.equal(bridge.record(adaProject, story.id, story.revision).revision, story.revision);
  const nextToken = bridge.issue(ada, adaProject);
  assert.throws(() => bridge.authenticate('Bearer ' + issued.token), error => error.status === 401);
  assert.equal(bridge.authenticate('Bearer ' + nextToken.token).user.id, ada.id);
  bridge.revoke(ada, adaProject);
  assert.throws(() => bridge.authenticate('Bearer ' + nextToken.token), error => error.status === 401);

  // Exercise the real portal routes, including the browser session -> editor-token boundary.
  const { createServer } = await import('node:http');
  const { spawn, spawnSync } = await import('node:child_process');
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  const origin = 'http://127.0.0.1:' + port;
  try {
    await waitForPortal(server, origin);
    const cookie = createSession(db, ada.id).split(';')[0];
    const auth = { cookie };
    const before = await fetch(origin + '/api/projects/' + adaProject + '/editor', { headers: auth });
    assert.equal(before.status, 200);
    const issueResponse = await fetch(origin + '/api/projects/' + adaProject + '/editor', { method: 'POST', headers: auth });
    assert.equal(issueResponse.status, 201);
    assert.equal(issueResponse.headers.get('cache-control'), 'no-store');
    const apiToken = (await issueResponse.json()).token;
    const editorAuth = { authorization: 'Bearer ' + apiToken };
    const editorConfig = join(root, 'editor-client.json');
    const toolPath = new URL('../tools/editor-mcp.mjs', import.meta.url).pathname;
    const pair = spawnSync(process.execPath, [toolPath, 'pair', origin], {
      env: { ...process.env, ALUDEL_EDITOR_CONFIG: editorConfig }, input: apiToken + '\n', encoding: 'utf8', timeout: 5000
    });
    assert.equal(pair.status, 0, pair.stderr);
    const rpcInput = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'assigned_tasks', arguments: {} } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'task_context', arguments: { workId: work.id } } }
    ].map(value => JSON.stringify(value)).join('\n') + '\n';
    const mcp = spawnSync(process.execPath, [toolPath], {
      env: { ...process.env, ALUDEL_EDITOR_CONFIG: editorConfig }, input: rpcInput, encoding: 'utf8', timeout: 5000
    });
    assert.equal(mcp.status, 0, mcp.stderr);
    const replies = mcp.stdout.trim().split('\n').map(JSON.parse);
    assert.equal(replies[0].result.protocolVersion, '2025-03-26');
    assert.match(replies[1].result.content[0].text, /Build a feature/);
    assert.match(replies[2].result.content[0].text, /digest/);
    assert.equal((await fetch(origin + '/api/editor/me', { headers: editorAuth })).status, 200);
    assert.equal((await fetch(origin + '/api/editor/tasks', { headers: editorAuth })).status, 200);
    assert.equal((await fetch(origin + '/api/editor/records/' + otherStory.id, { headers: editorAuth })).status, 404);
    assert.equal((await fetch(origin + '/api/editor/tasks', { method: 'POST', headers: editorAuth })).status, 405);
    assert.equal((await fetch(origin + '/api/editor/tasks')).status, 401);
    assert.equal((await fetch(origin + '/api/projects/' + adaProject + '/editor', { method: 'DELETE', headers: auth })).status, 200);
    assert.equal((await fetch(origin + '/api/editor/me', { headers: editorAuth })).status, 401);
  } finally {
    await stopPortal(server);
    db.close();
  }
});

test('Codex stdio adapter exposes read tools and forwards a bearer-scoped task request', async () => {
  const { createServer } = await import('node:http');
  const { spawn } = await import('node:child_process');
  const { writeFileSync } = await import('node:fs');
  const root = mkdtempSync(join(tmpdir(), 'aludel-mcp-'));
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ path: req.url, authorization: req.headers.authorization });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ tasks: [{ ref: 'W-1', title: 'Build it' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const config = join(root, 'editor.json');
  writeFileSync(config, JSON.stringify({ url: 'http://127.0.0.1:' + server.address().port, token: 'test-token' }));
  const child = spawn(process.execPath, [new URL('../tools/editor-mcp.mjs', import.meta.url).pathname], {
    env: { ...process.env, ALUDEL_EDITOR_CONFIG: config }, stdio: ['pipe', 'pipe', 'pipe']
  });
  const results = [];
  let pending = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    pending += chunk;
    while (pending.includes('\n')) {
      const index = pending.indexOf('\n');
      const line = pending.slice(0, index); pending = pending.slice(index + 1);
      if (line.trim()) results.push(JSON.parse(line));
    }
  });
  const waitFor = async count => {
    const until = Date.now() + 5000;
    while (results.length < count && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(results.length >= count, 'MCP response arrived');
  };
  try {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'assigned_tasks', arguments: {} } }) + '\n');
    await waitFor(3);
    assert.ok(results[1].result.tools.some(tool => tool.name === 'task_context'));
    assert.match(results[2].result.content[0].text, /Build it/);
    // Besides the tool's request, the adapter tells Aludel where its checkout is when it starts in one (best effort).
    assert.deepEqual(requests.filter(entry => entry.path !== '/api/editor/checkout'), [{ path: '/api/editor/tasks', authorization: 'Bearer test-token' }]);
    assert.ok(requests.every(entry => entry.authorization === 'Bearer test-token'));
  } finally {
    child.stdin.end();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
