import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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
  const attemptId = 'att-00000000-0000-4000-8000-000000000001';
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, 'Bearer test-worker-token');
    response.setHeader('content-type', 'application/json');
    if (request.method === 'POST' && request.url === `/api/worker/attempts/${attemptId}/workspace`) {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => { registrations.push(JSON.parse(body)); response.end(JSON.stringify({ registered: true })); });
      return;
    }
    if (request.method === 'POST' && request.url === `/api/worker/attempts/${attemptId}/runs`) {
      reservations++; response.end(JSON.stringify({ runsStarted: reservations, runLimit: 2 })); return;
    }
    response.end(JSON.stringify({ issues: [{ identifier: 'BUDDY-BOX-W-7', native_ref: { repository_commit: base, attempt_id: attemptId } }], nextCursor: null }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const hook = new URL('./workspace-hook.mjs', import.meta.url).pathname;
  const credentialPath = join(root, 'worker-token'); writeFileSync(credentialPath, 'test-worker-token\n', { mode: 0o600 });
  const env = { ...process.env, ALUDEL_WORKER_TOKEN: '', ALUDEL_WORKER_TOKEN_FILE: credentialPath, ALUDEL_WORKER_URL: `http://127.0.0.1:${server.address().port}/api/worker`, ALUDEL_SOURCE_REPOSITORY: source };
  const run = (cwd, phase) => new Promise(resolve => {
    const child = spawn(process.execPath, [hook, phase], { cwd, env, timeout: 10_000 });
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
    assert.deepEqual(registrations, [{ path: workspace }, { path: workspace }]);
    assert.equal(reservations, 1, 'only before_run consumes the durable allowance');
    const wrong = join(root, 'WRONG-W-7'); mkdirSync(wrong);
    const rejected = await run(wrong, 'start-run');
    assert.notEqual(rejected.status, 0, 'an unrelated workspace cannot borrow this issue');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
