#!/usr/bin/env node
// Symphony runs this host-side from an issue workspace, before Codex starts.
// A private project-pool credential never reaches the Codex child.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const fail = message => { throw new Error(message); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const phase = process.argv[2];
if (!['prepare', 'start-run'].includes(phase)) fail('Specify prepare or start-run.');
const workspace = process.cwd();
const source = resolve(process.env.ALUDEL_SOURCE_REPOSITORY || '');
const endpoint = String(process.env.ALUDEL_WORKER_URL || '').replace(/\/$/, '');
const token = process.env.ALUDEL_WORKER_TOKEN_FILE ? readFileSync(process.env.ALUDEL_WORKER_TOKEN_FILE, 'utf8').trim() : process.env.ALUDEL_WORKER_TOKEN;
const identifier = basename(workspace);
if (!token || !/^[A-Za-z0-9_-]{10,100}$/.test(identifier) || !endpoint || !process.env.ALUDEL_SOURCE_REPOSITORY) fail('Aludel workspace hook is not configured.');
const url = new URL(endpoint + '/issues');
if (!['http:', 'https:'].includes(url.protocol) || url.protocol === 'http:' && !['127.0.0.1', 'localhost', 'aludel.localhost', '[::1]'].includes(url.hostname)) fail('Aludel worker URL must be local HTTP or HTTPS.');
url.searchParams.set('states', 'Ready');
url.searchParams.set('limit', '100');
const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
if (!response.ok) fail(`Aludel worker poll failed (${response.status}).`);
const body = await response.json();
const matches = (body.issues || []).filter(issue => issue.identifier === identifier);
if (matches.length !== 1 || body.nextCursor) fail('Workspace issue is not uniquely Ready in this worker scope.');
const commit = matches[0].native_ref?.repository_commit;
const attemptId = matches[0].native_ref?.attempt_id;
if (!/^att-[0-9a-f-]{36}$/.test(attemptId || '')) fail('Ready issue has no authorized attempt.');
try {
if (!/^[a-f0-9]{40}$/.test(commit || '')) fail('Ready issue has no pinned repository commit.');
if (!existsSync(join(source, '.git'))) fail('Project source repository is missing.');
const marker = join(workspace, '.git', 'aludel-base');
if (!existsSync(join(workspace, '.git'))) {
  if (existsSync(join(workspace, 'WORKFLOW.md'))) fail('Workspace is not empty.');
  git(workspace, 'clone', '--no-hardlinks', '--', source, '.');
  git(workspace, 'checkout', '--detach', commit);
  writeFileSync(marker, commit + '\n', { mode: 0o600 });
} else {
  if (readFileSync(marker, 'utf8').trim() !== commit) fail('Workspace base no longer matches the Go-authorized commit.');
  try { git(workspace, 'merge-base', '--is-ancestor', commit, 'HEAD'); }
  catch { fail('Workspace HEAD is not descended from the Go-authorized commit.'); }
}

const registration = await fetch(new URL(endpoint + `/attempts/${attemptId}/workspace`), {
  method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ path: workspace }), signal: AbortSignal.timeout(10_000),
});
if (!registration.ok) fail(`Aludel workspace registration failed (${registration.status}).`);
if (phase === 'start-run') {
  const reservation = await fetch(new URL(endpoint + `/attempts/${attemptId}/runs`), {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(10_000),
  });
  if (!reservation.ok) fail(`Aludel run reservation failed (${reservation.status}).`);
}
} catch (error) {
  const message = String(error?.message || error || 'Symphony workspace preparation failed.').replace(/\s+/g, ' ').slice(0, 500);
  try {
    await fetch(new URL(endpoint + '/attempts/' + attemptId + '/events'), {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ eventId: 'hook-' + phase + '-' + Date.now(), kind: 'error', message }), signal: AbortSignal.timeout(10_000),
    });
  } catch { /* Preserve the original hook failure. */ }
  throw error;
}
