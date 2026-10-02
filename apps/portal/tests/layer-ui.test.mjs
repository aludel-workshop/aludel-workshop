// LAYER-BASE-01 B6: a layer's own views run in a sandboxed frame on their own origin, and reach the portal only through
// calls the portal page carries and the server allows.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { hostTopology, reservedSlugs } from '../server/hosts.mjs';
import { frameAllows, frameLabel, layerUi } from '../server/layer-ui.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';

test('a layer frame may read the project, use its own layer, create Work and the host features its manifest requests; nothing else', () => {
  const features = { pages: ['pageChanges', 'skeleton'], product: ['documents'] };
  const allows = (key, method, rest) => frameAllows({ key, projectId: 'p1', method, pathname: `/api/projects/p1${rest}`, features: features[key] || [] });
  for (const [method, rest] of [['GET', '/knowledge'], ['GET', '/layer-instances'], ['GET', '/assets/as-1'], ['GET', '/layers/research/api'],
    ['POST', '/records'], ['PUT', '/records/rec-1'], ['DELETE', '/records/rec-1'], ['POST', '/layers/research/api/createDocument'], ['POST', '/work']])
    assert.equal(allows('research', method, rest), true, `${method} ${rest}`);
  for (const [method, rest] of [['POST', '/layers/pages/api/createPage'], ['POST', '/pages/change'], ['POST', '/skeleton'], ['PUT', '/work/w-1'],
    ['POST', '/work/w-1/runs/a/sign'], ['PUT', '/layer-access/research'], ['GET', '/members'], ['POST', '/repository'], ['GET', '/preview']])
    assert.equal(allows('research', method, rest), false, `${method} ${rest}`);
  assert.equal(allows('pages', 'POST', '/pages/change'), true);
  assert.equal(allows('product', 'POST', '/docs'), true);
  assert.equal(allows('product', 'POST', '/docs/doc-1'), true);
  assert.equal(allows('pages', 'POST', '/docs'), false);
  // Features are by name, not by layer key: another layer that requests one gets exactly its routes, and an unknown name grants nothing.
  assert.equal(frameAllows({ key: 'research', projectId: 'p1', method: 'POST', pathname: '/api/projects/p1/docs', features: ['documents'] }), true);
  assert.equal(frameAllows({ key: 'pages', projectId: 'p1', method: 'POST', pathname: '/api/projects/p1/pages/change', features: ['everything'] }), false);
  assert.equal(frameAllows({ key: 'research', projectId: 'p1', method: 'GET', pathname: '/api/projects/p2/knowledge' }), false, 'another project');
  // LAYER-BINDINGS-01 R4: a frame reads its own layer's roles (the server takes the layer from the frame) and proposes changes.
  assert.equal(allows('research', 'GET', '/roles'), true);
  assert.equal(allows('research', 'POST', '/roles/propose'), true);
  assert.equal(allows('research', 'PUT', '/roles'), false);
  assert.equal(allows('research', 'GET', '/roles/propose'), false);
  assert.equal(frameAllows({ key: 'research', projectId: 'p1', method: 'GET', pathname: '/api/session' }), false);
});

test('each layer instance has its own frame origin, distinct from the portal and project apps', () => {
  const topology = hostTopology({}, 4310);
  const label = frameLabel('0b9f6c1e-1111-4222-8333-944455566677');
  assert.equal(label, 'i-0b9f6c1e111142228333944455566677');
  assert.deepEqual(topology.classify(`${label}.layers.localhost:4310`), { kind: 'layers', label, host: `${label}.layers.localhost` });
  assert.equal(topology.classify('layers.localhost').kind, 'unknown');
  assert.equal(topology.classify('evil.layers.localhost').kind, 'unknown');
  assert.equal(topology.classify('aludel.localhost').kind, 'portal');
  assert.ok(reservedSlugs.has('layers'), 'no project app can take the layers name');
});

test('built views are served sandboxed, may embed only their project\'s app, and never outside the build', () => {
  const data = mkdtempSync(join(tmpdir(), 'aludel-layer-ui-'));
  try {
    const ui = layerUi({ dataDirectory: data, layerOrigin: label => `http://${label}.layers.localhost:4310`, portalOrigin: 'http://aludel.localhost:4310', portalOrigins: hostTopology({}, 4310).portalOrigins,
      appOriginFor: label => label === 'i-aaaa' ? 'http://tool-share.localhost:4310' : null });
    const build = join(data, 'layer-ui', 'b'.repeat(32));
    mkdirSync(join(build, 'assets'), { recursive: true });
    writeFileSync(join(build, 'index.html'), '<!doctype html>'); writeFileSync(join(build, 'assets', 'a.js'), '1');
    const respond = (path, label = 'i-aaaa') => { const out = {}; ui.serve({ method: 'GET' }, { writeHead: (status, headers) => Object.assign(out, { status, headers }), end: body => { out.body = body; } }, path, label); return out; };
    const page = respond(`/${'b'.repeat(32)}/index.html`);
    assert.equal(page.status, 200);
    const csp = page.headers['content-security-policy'];
    assert.match(csp, /^sandbox allow-scripts allow-forms allow-same-origin allow-downloads;/);
    assert.match(csp, /connect-src 'none'/); assert.match(csp, /form-action 'none'/);
    assert.match(csp, /frame-src http:\/\/tool-share\.localhost:4310;/);
    // The portal answers on localhost and 127.0.0.1 too; a layer opened there must still show (owner report, 2026-10-02).
    assert.match(csp, /frame-ancestors http:\/\/aludel\.localhost:4310 http:\/\/127\.0\.0\.1:4310 http:\/\/localhost:4310 http:\/\/\[::1\]:4310$/);
    assert.match(respond(`/${'b'.repeat(32)}/index.html`, 'i-bbbb').headers['content-security-policy'], /frame-src 'none'/, 'an unknown instance embeds nothing');
    assert.equal(respond(`/${'b'.repeat(32)}/assets/a.js`).headers['content-security-policy'], undefined);
    assert.equal(respond(`/${'b'.repeat(32)}/../../../etc/passwd`).status, 404);
    assert.equal(respond('/not-a-build/index.html').status, 404);
  } finally { rmSync(data, { recursive: true, force: true }); }
});

test('an instance\'s views are built from its own repository commit, and instances on one commit share the build', async () => {
  const data = mkdtempSync(join(tmpdir(), 'aludel-layer-ui-build-'));
  const old = { dir: process.env.MACHINE_DATA_DIR, on: process.env.MACHINE_LAYER_TEMPLATES_ENABLED };
  process.env.MACHINE_DATA_DIR = data; process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY); CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
      CREATE TABLE knowledge_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,revision INTEGER,data_json TEXT);
      INSERT INTO projects VALUES ('one'),('two'); INSERT INTO project_members VALUES ('one','owner','owner'),('two','owner','owner');`);
    initLayerContract(db);
    const ui = layerUi({ dataDirectory: data, layerOrigin: label => `http://${label}.layers.localhost`, portalOrigin: 'http://aludel.localhost' });
    assert.equal(ui.status(db, 'one', 'product').status, 'building');
    await ui.settle(db, 'one', 'product');
    assert.equal(ui.status(db, 'one', 'product').status, 'ready', 'Vision builds from its pinned repository');
    assert.equal(ui.status(db, 'one', 'pages').status, 'building');
    await ui.settle(db, 'one', 'pages');
    const one = ui.status(db, 'one', 'pages'), two = ui.status(db, 'two', 'pages');
    assert.equal(one.status, 'ready');
    assert.equal(two.status, 'ready', 'the same template commit is already built');
    assert.notEqual(new URL(one.url).origin, new URL(two.url).origin, 'but each instance has its own origin');
    assert.equal(new URL(one.url).pathname, new URL(two.url).pathname);
    const repo = db.prepare("SELECT repository_path FROM layer_package_bindings WHERE project_id = 'one' AND layer_key = 'pages'").get().repository_path;
    const built = execFileSync('grep', ['-l', 'aludel-pages-layer', '-r', join(data, 'layer-ui')], { encoding: 'utf8' });
    assert.ok(built.trim(), 'the bundle holds the layer\'s own entry component');
    assert.ok(repo);
  } finally {
    db.close(); rmSync(data, { recursive: true, force: true });
    if (old.dir === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = old.dir;
    if (old.on === undefined) delete process.env.MACHINE_LAYER_TEMPLATES_ENABLED; else process.env.MACHINE_LAYER_TEMPLATES_ENABLED = old.on;
  }
});
