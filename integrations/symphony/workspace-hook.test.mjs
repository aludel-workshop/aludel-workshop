import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();

test('workspace hook checks out the exact Go commit and preserves a reused workspace', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-symphony-hook-'));
  const source = join(root, 'source');
  const workspace = join(root, 'BUDDY-BOX-W-7');
  mkdirSync(source); mkdirSync(workspace);
  git(source, 'init', '-q');
  writeFileSync(join(source, 'README.md'), 'base\n');
  git(source, 'add', '.');
  git(source, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base');
  const base = git(source, 'rev-parse', 'HEAD');
  writeFileSync(join(source, 'README.md'), 'later\n');
  git(source, 'add', '.');
  git(source, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'later');
  const registrations = [];
  let reservations = 0;
  let errorEvents = 0;
  const attemptId = 'att-00000000-0000-4000-8000-000000000001';
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, 'Bearer test-worker-token');
    response.setHeader('content-type', 'application/json');
    if (request.method === 'POST' && request.url === `/api/worker/attempts/${attemptId}/workspace`) {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => { const claim = JSON.parse(body); registrations.push(claim); response.statusCode = claim.hostId === 'test-host' ? 200 : 409; response.end(JSON.stringify({ registered: response.statusCode === 200 })); });
      return;
    }
    if (request.method === 'POST' && request.url === `/api/worker/attempts/${attemptId}/runs`) {
      reservations++; response.end(JSON.stringify({ runsStarted: reservations, runLimit: 2 })); return;
    }
    if (request.method === 'POST' && request.url === `/api/worker/attempts/${attemptId}/events`) { errorEvents++; response.end('{}'); return; }
    response.end(JSON.stringify({ issues: [{ identifier: 'BUDDY-BOX-W-7', native_ref: { repository_commit: base, attempt_id: attemptId } }], nextCursor: null }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const hook = new URL('./workspace-hook.mjs', import.meta.url).pathname;
  const credentialPath = join(root, 'worker-token'); writeFileSync(credentialPath, 'test-worker-token\n', { mode: 0o600 });
  const env = { ...process.env, ALUDEL_WORKER_TOKEN: '', ALUDEL_WORKER_TOKEN_FILE: credentialPath, ALUDEL_WORKER_URL: `http://127.0.0.1:${server.address().port}/api/worker`, ALUDEL_SOURCE_REPOSITORY: source, ALUDEL_HOST_ID: 'test-host' };
  const run = (cwd, phase, extraEnv = {}) => new Promise(resolve => {
    const child = spawn(process.execPath, [hook, phase], { cwd, env: { ...env, ...extraEnv }, timeout: 10_000 });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stderr }));
  });
  try {
    const first = await run(workspace, 'prepare');
    assert.equal(first.status, 0, first.stderr);
    assert.equal(git(workspace, 'rev-parse', 'HEAD'), base);
    writeFileSync(join(workspace, 'local.txt'), 'keep me\n');
    const second = await run(workspace, 'start-run');
    assert.equal(second.status, 0, second.stderr);
    assert.equal(git(workspace, 'status', '--porcelain').includes('local.txt'), true);
    assert.deepEqual(registrations, [{ path: workspace, hostId: 'test-host' }, { path: workspace, hostId: 'test-host' }]);
    const losingHost = await run(workspace, 'start-run', { ALUDEL_HOST_ID: 'other-host' });
    assert.notEqual(losingHost.status, 0);
    assert.equal(errorEvents, 0, 'a claim loser must not block the winning attempt');
    assert.equal(reservations, 1, 'only before_run consumes the durable allowance');
    const finished = await run(workspace, 'finish-run');
    assert.equal(finished.status, 0, finished.stderr);
    assert.equal(errorEvents, 1, 'after_run reports completion without reserving another turn');
    const wrong = join(root, 'WRONG-W-7'); mkdirSync(wrong);
    const rejected = await run(wrong, 'start-run');
    assert.notEqual(rejected.status, 0, 'an unrelated workspace cannot borrow this issue');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('a layer run gets its layer repository on its work branch in layer/, hidden from the project checkout, with a copy of outputs', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-symphony-layer-hook-'));
  const source = join(root, 'source'), layerRepo = join(root, 'layer-repo'), workspace = join(root, 'BUDDY-BOX-W-8');
  for (const dir of [source, layerRepo, workspace]) mkdirSync(dir);
  for (const [repo, file] of [[source, 'README.md'], [layerRepo, 'layer.json']]) {
    git(repo, 'init', '-q'); writeFileSync(join(repo, file), '{}\n'); git(repo, 'add', '.');
    git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base');
  }
  const base = git(source, 'rev-parse', 'HEAD'), layerBase = git(layerRepo, 'rev-parse', 'HEAD');
  const attemptId = 'att-00000000-0000-4000-8000-000000000002';
  git(layerRepo, 'update-ref', `refs/aludel/base/${attemptId}`, layerBase);
  git(layerRepo, 'bundle', 'create', '-q', join(root, 'layer.bundle'), `refs/aludel/base/${attemptId}`);
  const bundle = readFileSync(join(root, 'layer.bundle'));
  const server = createServer((request, response) => {
    if (request.url.endsWith('/layer-bundle')) { response.setHeader('content-type', 'application/octet-stream'); response.end(bundle); return; }
    response.setHeader('content-type', 'application/json');
    if (request.url.endsWith('/layer-workspace')) { response.end(JSON.stringify({ layer: 'pages', base: layerBase, branch: 'work/w-8-00000000',
      outputs: { page: [{ id: 'pag-aaaaaaaa', revision: 1, data: { label: 'Browse' } }] }, catalogs: { routeIcons: ['article'] } })); return; }
    if (request.method === 'POST') { response.end(JSON.stringify({ registered: true, runsStarted: 1 })); request.resume(); return; }
    response.end(JSON.stringify({ issues: [{ identifier: 'BUDDY-BOX-W-8', native_ref: { repository_commit: base, attempt_id: attemptId } }], nextCursor: null }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const hook = new URL('./workspace-hook.mjs', import.meta.url).pathname;
  const env = { ...process.env, ALUDEL_WORKER_TOKEN: 'test-worker-token', ALUDEL_WORKER_URL: `http://127.0.0.1:${server.address().port}/api/worker`, ALUDEL_SOURCE_REPOSITORY: source, ALUDEL_HOST_ID: 'test-host' };
  const run = phase => new Promise(resolve => {
    const child = spawn(process.execPath, [hook, phase], { cwd: workspace, env, timeout: 10_000 });
    let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; }); child.on('close', status => resolve({ status, stderr }));
  });
  try {
    const first = await run('prepare');
    assert.equal(first.status, 0, first.stderr);
    const checkout = join(workspace, 'layer');
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), layerBase);
    assert.equal(git(checkout, 'rev-parse', '--abbrev-ref', 'HEAD'), 'work/w-8-00000000');
    assert.deepEqual(JSON.parse(readFileSync(join(checkout, '.aludel', 'outputs', 'page.json'), 'utf8'))[0].data, { label: 'Browse' });
    assert.equal(git(workspace, 'status', '--porcelain'), '', 'the layer checkout does not dirty the project checkout');
    writeFileSync(join(checkout, 'notes.md'), 'kept\n');
    const second = await run('prepare');
    assert.equal(second.status, 0, second.stderr);
    assert.equal(readFileSync(join(checkout, 'notes.md'), 'utf8'), 'kept\n', 'a reused workspace keeps the agent\'s layer edits');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
