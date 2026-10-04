// J6: the review preview tells the portal frame where the reviewer is, so walking a journey advances its review.
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { injectWalk, walkPath, walkScript } from '../server/review-walk.mjs';
import { previewManager } from '../server/previews.mjs';
import { openDatabase } from '../server/storage.mjs';

test('the walk script goes in once, after <head>, or first when a page has none', () => {
  assert.equal(injectWalk('<!doctype html><html><head lang="en"><title>A</title></head></html>'), `<!doctype html><html><head lang="en"><script src="${walkPath}"></script><title>A</title></head></html>`);
  assert.equal(injectWalk('<p>Bare</p>'), `<script src="${walkPath}"></script><p>Bare</p>`);
  assert.equal(injectWalk(injectWalk('<head></head>')), injectWalk('<head></head>'));
  assert.doesNotMatch(walkScript(['https://portal.example', 'javascript:alert(1)', 'https://x.example/path']), /javascript:|x\.example/);
});

// Runs the script in a stand-in frame and returns what it posts to the portal.
function frame() {
  const posted = [], listeners = {}, loads = [];
  const location = new URL('http://review-abc.preview.test/team');
  const history = { pushState(_state, _title, url) { const next = new URL(url, location.href); location.pathname = next.pathname; location.search = next.search; }, replaceState() {} };
  class Request { constructor(url, init = {}) { this.url = url; this.method = init.method || 'GET'; } }
  class XMLHttpRequest { addEventListener(_kind, listener) { loads.push(() => listener.call(this)); } open() {} }
  class HTMLFormElement { constructor(method, action) { this.method = method; this.action = action; } }
  const parent = { postMessage: (message, origin) => posted.push([origin, JSON.parse(JSON.stringify(message))]) };
  const window = { parent, fetch: async () => ({ ok: true }) };
  const context = { window, location, history, Request, XMLHttpRequest, HTMLFormElement, URL, setTimeout: callback => callback(),
    addEventListener: (kind, listener) => { listeners[kind] = listener; } };
  vm.runInNewContext(walkScript(['http://portal.test']), context);
  return { posted, listeners, context, loads, messages: () => posted.map(([, message]) => message) };
}

test('the walk script reports the page shown and successful same-origin actions, not reads or other sites', async () => {
  const f = frame();
  assert.deepEqual(f.posted[0], ['http://portal.test', { aludelWalk: 1, kind: 'page', path: '/team' }]);
  f.context.history.pushState(null, '', '/team/invite?from=menu');
  await f.context.window.fetch('/api/members');
  await f.context.window.fetch('/api/invites', { method: 'post' });
  await f.context.window.fetch('https://elsewhere.example/api/track', { method: 'POST' });
  const xhr = new f.context.XMLHttpRequest(); xhr.status = 201; xhr.open('PUT', '/api/invites/1'); f.loads.forEach(load => load());
  f.listeners.submit({ target: new f.context.HTMLFormElement('post', 'http://review-abc.preview.test/session'), defaultPrevented: false });
  f.listeners.submit({ target: new f.context.HTMLFormElement('post', 'http://review-abc.preview.test/handled'), defaultPrevented: true });
  assert.deepEqual(f.messages().slice(1).map(message => [message.kind, message.method || null, message.path, message.page || null]), [
    ['page', null, '/team/invite?from=menu', null],
    ['action', 'POST', '/api/invites', '/team/invite?from=menu'],
    ['action', 'PUT', '/api/invites/1', '/team/invite?from=menu'],
    ['action', 'POST', '/session', '/team/invite?from=menu']]);
});

test('review previews add the walk script to HTML pages only, uncompressed', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-walk-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  db.exec('CREATE TABLE IF NOT EXISTS layer_review_integrations (id TEXT PRIMARY KEY)');
  const seen = [];
  const app = createServer((req, res) => {
    seen.push(req.headers['accept-encoding'] || null);
    if (req.url === '/data') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"head":"<head>"}'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': 28, etag: '"v1"' }); res.end('<html><head></head>hi</html>');
  });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const manager = previewManager({ db, portalRoot: root, workspaceRoot: root, logRoot: root, kind: 'review', runtime: 'process' });
  const bridge = createServer((req, res) => manager.proxy(req, res, app.address().port, null, { html: injectWalk }));
  await new Promise(resolve => bridge.listen(0, '127.0.0.1', resolve));
  const get = (path, accept) => new Promise((resolve, reject) => httpRequest({ host: '127.0.0.1', port: bridge.address().port, path, headers: { accept, 'accept-encoding': 'gzip' } }, res => {
    const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks).toString() }));
  }).on('error', reject).end());
  try {
    const page = await get('/team', 'text/html,application/xhtml+xml');
    assert.equal(page.body, `<html><head><script src="${walkPath}"></script></head>hi</html>`);
    assert.equal(Number(page.headers['content-length']), Buffer.byteLength(page.body));
    assert.equal(page.headers.etag, undefined);
    const data = await get('/data', 'application/json');
    assert.equal(data.body, '{"head":"<head>"}');
    assert.deepEqual(seen, ['identity', 'gzip']);
  } finally { bridge.close(); app.close(); db.close(); rmSync(root, { recursive: true, force: true }); }
});
