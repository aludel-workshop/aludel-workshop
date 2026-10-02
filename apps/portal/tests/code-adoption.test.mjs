// T03-CODE: what the owner's portal does on its first start with Code as a template. A project built and released with the
// compiled Code layer (templates off) is restarted with templates on: once the portal is listening, Code installs into the
// project's own repository and adopts its generation links and release, with their IDs, revisions and commits unchanged.
// Disposable data only. Runs in the templates suite.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const templates = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1';
const serverPath = new URL('../server/server.mjs', import.meta.url).pathname;
const freePort = () => new Promise(resolve => { const probe = createServer(); probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); }); });

async function portal(root, port, env) {
  const child = spawn(process.execPath, [serverPath], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process', MACHINE_LAYER_TEMPLATES_ENABLED: '0', ...env }, stdio: 'ignore' });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (const deadline = Date.now() + 30_000; !ready && Date.now() < deadline;) { try { ready = (await fetch(origin + '/api/session')).ok; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
  assert.ok(ready, 'portal started');
  let cookie = '';
  const call = async (method, path, data) => {
    const response = await fetch(origin + path, { method, headers: { 'content-type': 'application/json', cookie }, body: data === undefined ? undefined : JSON.stringify(data) });
    const set = response.headers.getSetCookie?.() || [];
    if (set.length) cookie = [...new Map([...cookie.split('; ').filter(Boolean).map(part => [part.split('=')[0], part]), ...set.map(value => value.split(';')[0]).map(part => [part.split('=')[0], part])]).values()].join('; ');
    const body = await response.json().catch(() => ({}));
    assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(body)}`);
    return body;
  };
  const stop = () => new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
  return { call, stop, setCookie: value => { cookie = value; }, cookie: () => cookie };
}

test('T03-CODE: on the first start with templates, an existing project\'s Code moves into its repository with IDs unchanged', { skip: !templates }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-code-adoption-'));
  // ---- Before: the compiled Code layer ----
  const before = await portal(root, await freePort(), { MACHINE_LAYER_TEMPLATES_ENABLED: '0' });
  let project, session;
  try {
    await before.call('PUT', '/api/onboarding/draft', { profile: 'planner' });
    await before.call('PUT', '/api/onboarding/draft', { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
    ({ project } = await before.call('POST', '/api/accounts', { name: 'Ada', email: 'ada@example.com', password: 'correct-horse-battery' }));
    await before.call('PUT', `/api/projects/${project.id}/features`, { picks: ['accounts'] });
    await before.call('POST', `/api/projects/${project.id}/skeleton`, {});
    await before.call('POST', `/api/projects/${project.id}/code/releases`, { version: '0.1.0', notes: 'First' });
    session = before.cookie();
  } finally { await before.stop(); }
  const workspace = join(root, 'workspaces', project.id);
  const git = (...args) => execFileSync('git', ['-C', workspace, ...args], { encoding: 'utf8' }).trim();
  const builtHead = git('rev-parse', 'HEAD');
  const projectDb = () => { const files = execFileSync('find', [root, '-name', '*.sqlite', '-path', `*${project.id}*`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); return files[0] || join(root, 'machine.sqlite'); };
  const read = sql => { const db = new DatabaseSync(projectDb(), { readOnly: true }); try { return db.prepare(sql).all(project.id); } finally { db.close(); } };
  const links = read("SELECT id, record_id, record_revision FROM trace_links WHERE project_id = ? AND source = 'manifest' ORDER BY id");
  const releases = read('SELECT id, version, commit_sha FROM code_releases WHERE project_id = ?');
  assert.ok(links.length >= 5 && releases.length === 1, 'the compiled layer kept links and a release in host tables');

  // ---- After: templates on ----
  const after = await portal(root, await freePort(), { MACHINE_LAYER_TEMPLATES_ENABLED: '1' });
  try {
    after.setCookie(session);
    let sync;
    for (const deadline = Date.now() + 30_000; Date.now() < deadline; await new Promise(resolve => setTimeout(resolve, 250))) {
      try { sync = await after.call('GET', `/api/projects/${project.id}/layers/platform/sync`); break; } catch { /* still adopting */ }
    }
    assert.ok(sync?.commit, 'Code is installed once the portal is listening');
    assert.equal(git('rev-parse', 'main'), sync.commit);
    assert.equal(git('merge-base', '--is-ancestor', builtHead, 'main') === '', true, 'the build is kept; Aludel only adds commits');
    const fileLinks = JSON.parse(git('show', 'main:.aludel/outputs/trace-links.json')).links;
    assert.deepEqual(fileLinks.map(link => [link['x-aludel-id'], link.record.ref, link.record.revision]).sort(), links.map(row => [row.id, row.record_id, row.record_revision]).sort(),
      'every generation link keeps its ID, record and pinned revision');
    const fileReleases = JSON.parse(git('show', 'main:.aludel/outputs/releases.json')).releases;
    assert.deepEqual(fileReleases.map(release => [release['x-aludel-id'], release.version, release.commit]), releases.map(row => [row.id, row.version, row.commit_sha]));
    const library = await after.call('GET', `/api/projects/${project.id}/library?kind=code_release&source=output&data=1`);
    assert.deepEqual(library.results.map(entry => [entry.ref, entry.layer.key]), [[releases[0].id, 'platform']], 'the release is a Library entry of Code');
    assert.ok(git('ls-tree', '-r', '--name-only', 'main').split('\n').includes('docs/product/stories.md'), 'starter docs were seeded');
    assert.equal(git('status', '--porcelain'), '', 'the working tree follows');
  } finally { await after.stop(); }
});
