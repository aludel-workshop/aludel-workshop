#!/usr/bin/env node
// Symphony runs this host-side from an issue workspace, before Codex starts.
// A private project-pool credential never reaches the Codex child.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const fail = message => { throw new Error(message); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const phase = process.argv[2];
if (!['prepare', 'start-run', 'finish-run'].includes(phase)) fail('Specify prepare, start-run or finish-run.');
const workspace = process.cwd();
const source = resolve(process.env.ALUDEL_SOURCE_REPOSITORY || '');
const endpoint = String(process.env.ALUDEL_WORKER_URL || '').replace(/\/$/, '');
const token = process.env.ALUDEL_WORKER_TOKEN_FILE ? readFileSync(process.env.ALUDEL_WORKER_TOKEN_FILE, 'utf8').trim() : process.env.ALUDEL_WORKER_TOKEN;
const identifier = basename(workspace);
const hostId = process.env.ALUDEL_HOST_ID || process.env.HOSTNAME || 'local-host';
if (!token || !/^[A-Za-z0-9_-]{10,100}$/.test(identifier) || !endpoint || !process.env.ALUDEL_SOURCE_REPOSITORY) fail('Aludel workspace hook is not configured.');
const url = new URL(endpoint + '/issues');
if (!['http:', 'https:'].includes(url.protocol) || url.protocol === 'http:' && !['127.0.0.1', 'localhost', 'aludel.localhost', 'aludel.layers.localhost', '[::1]'].includes(url.hostname)) fail('Aludel worker URL must be local HTTP or HTTPS.');
if (phase === 'finish-run') {
  const marker = join(workspace, '.git', 'aludel-run');
  if (existsSync(marker)) {
    const { attemptId, run } = JSON.parse(readFileSync(marker, 'utf8'));
    if (!/^att-[0-9a-f-]{36}$/.test(attemptId || '') || !Number.isInteger(run) || run < 1) fail('Invalid run marker.');
    const finished = await fetch(new URL(endpoint + `/attempts/${attemptId}/events`), {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ eventId: `run-${run}-finished`, kind: 'finished' }), signal: AbortSignal.timeout(10_000),
    });
    if (!finished.ok) fail(`Aludel run completion failed (${finished.status}).`);
  }
  process.exit(0);
}
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
  body: JSON.stringify({ path: workspace, hostId }), signal: AbortSignal.timeout(10_000),
});
if (!registration.ok) fail(`Aludel workspace registration failed (${registration.status}).`);
if (phase === 'start-run') {
  const reservation = await fetch(new URL(endpoint + `/attempts/${attemptId}/runs`), {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ hostId }), signal: AbortSignal.timeout(10_000),
  });
  if (!reservation.ok) fail(`Aludel run reservation failed (${reservation.status}).`);
  const { runsStarted } = await reservation.json();
  if (!Number.isInteger(runsStarted) || runsStarted < 1) fail('Aludel run reservation has no run number.');
  writeFileSync(join(workspace, '.git', 'aludel-run'), JSON.stringify({ attemptId, run: runsStarted }), { mode: 0o600 });
}
} catch (error) {
  const message = String(error?.message || error || 'Symphony workspace preparation failed.').replace(/\s+/g, ' ').slice(0, 500);
  try {
    // A losing host must not block the winner's authorized attempt.
    if (/registration failed \(409\)|reservation failed \(409\)/.test(message)) throw error;
    await fetch(new URL(endpoint + '/attempts/' + attemptId + '/events'), {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ eventId: 'hook-' + phase + '-' + Date.now(), kind: 'error', message }), signal: AbortSignal.timeout(10_000),
    });
  } catch { /* Preserve the original hook failure. */ }
  throw error;
}
