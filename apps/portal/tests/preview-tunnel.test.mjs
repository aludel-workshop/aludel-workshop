// W-27 (A7) #2: the preview tunnel, end to end. An item's agent runs a preview in its container and dials out to the
// portal; a member's browser reaches it at review-<id>.<base> through that connection: one page (with the walk script,
// framable by the portal), one request with a body, one WebSocket. Members only (a one-time link sets the preview host's
// own cookie, which the app never sees); a token for another item can't dial; the preview closes with its item.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSession, createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { runTunnel } from '../tools/preview-tunnel.mjs';
import { stopPortal, waitForPortal } from './portal-support.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const freePort = async () => { const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const { port } = probe.address(); await new Promise(resolve => probe.close(resolve)); return port; };

// The agent's preview: an app that refuses to be framed, sets its own cookie, echoes what it was sent, and speaks WebSocket.
function previewApp() {
  const seen = [];
  const app = createServer((request, response) => {
    let body = ''; request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      seen.push({ method: request.method, url: request.url, host: request.headers.host, cookie: request.headers.cookie || '', body });
      if (request.url === '/') {
        const page = '<!doctype html><html><head><title>Tools</title></head><body><h1>Tools near you</h1></body></html>';
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(page), 'content-security-policy': "default-src 'self'; frame-ancestors 'self'",
          'x-frame-options': 'DENY', 'set-cookie': 'session=abc; Path=/; HttpOnly; SameSite=Lax' });
        return response.end(page);
      }
      const value = JSON.stringify({ method: request.method, body });
      response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(value) }); response.end(value);
    });
  });
  // A WebSocket that answers each text frame with "echo: <text>".
  app.on('upgrade', (request, socket) => {
    const accept = createHash('sha1').update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-accept: ${accept}\r\n\r\n`);
    socket.on('data', frame => {
      const length = frame[1] & 0x7f, mask = frame.subarray(2, 6), text = Buffer.from(frame.subarray(6, 6 + length).map((byte, index) => byte ^ mask[index % 4])).toString();
      const reply = Buffer.from(`echo: ${text}`); socket.write(Buffer.concat([Buffer.from([0x81, reply.length]), reply]));
    });
  });
  return { app, seen };
}

// A request to the preview host, as a browser sends it (Host names review-<id>.localhost).
function hit(port, host, path, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const call = httpRequest({ host: '127.0.0.1', port, method, path, headers: { host, ...headers } }, response => {
      let text = ''; response.on('data', chunk => { text += chunk; }); response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text }));
    });
    call.on('error', reject); call.end(body);
  });
}
function webSocket(port, host, cookie, text) {
  return new Promise((resolve, reject) => {
    const call = httpRequest({ host: '127.0.0.1', port, path: '/live', headers: { host, cookie, connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==' } });
    call.on('response', response => resolve({ status: response.statusCode }));
    call.on('upgrade', (response, socket) => {
      const mask = Buffer.from([1, 2, 3, 4]), payload = Buffer.from(text).map((byte, index) => byte ^ mask[index % 4]);
      socket.write(Buffer.concat([Buffer.from([0x81, 0x80 | text.length]), mask, payload]));
      socket.once('data', frame => { socket.destroy(); resolve({ status: response.statusCode, accept: response.headers['sec-websocket-accept'], text: frame.subarray(2, 2 + (frame[1] & 0x7f)).toString() }); });
    });
    call.on('error', reject); call.end();
  });
}

test('W-27 #2: a member reaches the agent\'s preview through the tunnel its container dials; it closes with the item', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-preview-tunnel-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flow = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'w'), assetRoot: join(root, 'a'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token: draft } = flow.saveDraft(null, { profile: 'planner' });
  flow.saveDraft(draft, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
  const id = flow.claimDraft(draft, ada, ada).project.id;
  const port = await freePort();
  const server = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const origin = 'http://127.0.0.1:' + port;
  const { app, seen } = previewApp();
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const stop = new AbortController();
  try {
    await waitForPortal(server, origin);
    const cookie = createSession(db, ada.id).split(';')[0];
    const portal = async (path, body) => { const response = await fetch(`${origin}/api/projects/${id}/goals${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
      return { status: response.status, body: await response.json() }; };
    const workId = (await portal('', { title: 'Show tools near me', brief: 'A map.' })).body.item.id;
    await portal(`/${workId}/claim`);
    const editorToken = (await (await fetch(`${origin}/api/projects/${id}/editor`, { method: 'POST', headers: { cookie } })).json()).token;
    const agent = async (path, body) => { const response = await fetch(`${origin}/api/editor/goals/${workId}${path}`, { method: 'POST', headers: { authorization: 'Bearer ' + editorToken, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() }; };
    await agent('/define', { brief: 'A map.', actions: [{ layer: 'platform', goal: 'Show the map' }, { layer: 'platform', goal: 'Pin the tools' }] });
    await portal(`/${workId}/move`, { to: 'progress' });
    await agent('/actions/1', { state: 'working' });
    assert.equal((await agent('/tunnels', { action: 7 })).status, 404, 'only an action of the item');

    // The container opens a tunnel for #1 and dials in; nothing listens in the container for the outside.
    const lines = [];
    const opened = await runTunnel({ config: { url: origin, token: editorToken }, item: workId, action: 1, port: app.address().port, pool: 2, log: line => lines.push(line), signal: stop.signal });
    assert.match(opened.host, /^review-[a-f0-9]{12}$/);
    assert.equal(opened.url, `http://${opened.host}.localhost:${port}`);
    for (const deadline = Date.now() + 5000; !lines.length && Date.now() < deadline;) await new Promise(resolve => setTimeout(resolve, 50));
    assert.match(lines[0] || '', /^Tunnel: http:\/\/review-[a-f0-9]{12}\.localhost:\d+ \(#1, to localhost:\d+\)$/);
    const host = `${opened.host}.localhost:${port}`;

    // Members only: without the preview host's own cookie, nothing reaches the app.
    const before = seen.length;
    assert.equal((await hit(port, host, '/')).status, 403);
    assert.equal(seen.length, before, 'a stranger never reaches the agent\'s app');
    // A member opens it from the review: a one-time link sets the preview host's cookie and goes to the path asked for.
    const link = await portal(`/${workId}/previews/1`, { path: '/' });
    assert.equal(link.status, 200);
    assert.equal(link.body.connected, true);
    const enter = new URL(link.body.open);
    assert.equal(enter.host, host);
    const entered = await hit(port, host, enter.pathname);
    assert.equal(entered.status, 303); assert.equal(entered.headers.location, '/');
    const access = entered.headers['set-cookie'][0];
    assert.match(access, /^aludel_review=[A-Za-z0-9_-]+; Path=\/; HttpOnly; SameSite=None; Secure; Partitioned$/);
    assert.equal((await hit(port, host, enter.pathname)).status, 410, 'the link works once');
    const session = access.split(';')[0];

    // One page: the walk script is added, the portal may frame it, and the app's own cookie still works in that frame.
    const page = await hit(port, host, '/', { headers: { cookie: `${session}; session=abc`, accept: 'text/html' } });
    assert.equal(page.status, 200);
    assert.match(page.text, /<head><script src="\/__aludel\/walk\.js"><\/script><title>Tools<\/title>/);
    assert.match(page.headers['content-security-policy'], /^default-src 'self'; frame-ancestors 'self' http:\/\/aludel\.localhost:\d+ /);
    assert.equal(page.headers['x-frame-options'], undefined);
    assert.deepEqual(page.headers['set-cookie'], ['session=abc; Path=/; HttpOnly; SameSite=None; Secure; Partitioned']);
    const asked = seen.at(-1);
    assert.equal(asked.host, 'localhost', 'the app answers as itself');
    assert.equal(asked.cookie, 'session=abc', 'the preview host\'s access cookie never reaches the app');
    const walk = await hit(port, host, '/__aludel/walk.js', { headers: { cookie: session } });
    assert.match(walk.text, /aludelWalk/); assert.equal(seen.at(-1), asked, 'the portal serves the walk script itself');
    // One request with a body, relayed both ways.
    const posted = await hit(port, host, '/api/borrow', { method: 'POST', headers: { cookie: session, 'content-type': 'application/json' }, body: '{"tool":"drill"}' });
    assert.deepEqual(JSON.parse(posted.text), { method: 'POST', body: '{"tool":"drill"}' });
    // One WebSocket, byte for byte.
    assert.equal((await webSocket(port, host, '', 'hi')).status, 403, 'a WebSocket is members only too');
    const live = await webSocket(port, host, session, 'hello');
    assert.equal(live.status, 101); assert.equal(live.accept, 's3pPLMBiTxaQ9kYGzzhZRbK+xOo='); assert.equal(live.text, 'echo: hello');

    // Another item's token can't dial this one's tunnel.
    const otherWork = (await portal('', { title: 'Something else', brief: 'x' })).body.item.id;
    const dial = await new Promise(resolve => { const call = httpRequest({ host: '127.0.0.1', port, path: `/api/editor/goals/${otherWork}/tunnels/${opened.id}/dial`, headers: { authorization: 'Bearer ' + editorToken, connection: 'Upgrade', upgrade: 'aludel-tunnel' } });
      call.on('response', response => resolve(response.statusCode)); call.on('upgrade', (_response, socket) => { socket.destroy(); resolve(101); }); call.end(); });
    assert.equal(dial, 404);

    // The item ends: its preview closes, and the container's tunnel is refused from then on.
    assert.equal((await portal(`/${workId}/end`, { reason: 'Testing the tunnel only.' })).status, 200);
    const closed = await hit(port, host, '/', { headers: { cookie: session } });
    assert.equal(closed.status, 404); assert.match(closed.text, /Open this preview from its Work review/);
    for (const deadline = Date.now() + 5000; !lines.some(line => /closed this tunnel/.test(line)) && Date.now() < deadline;) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(lines.some(line => /The portal closed this tunnel \((401|404|410)\)/.test(line)), lines.join('\n'));
  } finally {
    stop.abort(); app.closeAllConnections(); app.close(); await stopPortal(server); db.close(); rmSync(root, { recursive: true, force: true });
  }
});
