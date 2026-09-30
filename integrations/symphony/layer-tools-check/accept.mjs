// LAYER-TOOLS-01: the owner accepts task A over HTTP, and the accepted run's data and layer branch both land.
// Usage: node accept.mjs <data-dir> <port> <seed.json> <password-file>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { request } from 'node:http';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const [data, port, seedFile, passwordFile] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedFile, 'utf8'));
let cookie = '';
const call = (method, path, body) => new Promise((resolve, reject) => {
  const payload = body === undefined ? null : JSON.stringify(body);
  const req = request({ host: '127.0.0.1', port: Number(port), method, path, headers: { host: `aludel.localhost:${port}`, origin: `http://aludel.localhost:${port}`, cookie,
    ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}) } }, response => {
    let text = ''; response.on('data', chunk => text += chunk);
    response.on('end', () => {
      if (response.headers['set-cookie']) cookie = response.headers['set-cookie'].map(value => value.split(';')[0]).join('; ');
      const value = text ? JSON.parse(text) : {};
      response.statusCode >= 400 ? reject(new Error(`${method} ${path} ${response.statusCode}: ${value.error}`)) : resolve(value);
    });
  });
  req.on('error', reject); if (payload) req.write(payload); req.end();
});
const base = `/api/projects/${seed.projectId}`;
const knowledge = async () => (await call('GET', `${base}/knowledge`)).knowledge;

await call('POST', '/api/sign-in', { email: 'owner@example.com', password: readFileSync(passwordFile, 'utf8').trim() });
const work = (await knowledge()).work.find(value => value.id === seed.workA);
assert.equal(work.state, 'review');
const proposal = work.context.workProposal;
assert.equal(proposal.scope, 'layer');
assert.deepEqual(proposal.changes.map(change => `${change.op} ${change.kind}`), ['create flow', 'update page']);
// Accepting a run is an elevated review: each check first, then the run.
await assert.rejects(call('PUT', `${base}/work/${seed.workA}`, { acceptProposal: proposal.id }), /Accept every Work check/);
for (const index of work.checks.keys()) await call('PUT', `${base}/work/${seed.workA}`, { verdict: { index, value: 'accept', note: 'Scripted check' } });
assert.equal((await call('PUT', `${base}/work/${seed.workA}`, { acceptProposal: proposal.id })).work.state, 'done');

const after = await knowledge();
const flow = after.flows.find(value => value.title === 'Find a tool');
assert.deepEqual(flow.steps.map(step => step.page), [seed.pages.browse, seed.pages.detail]);
assert.equal(after.pages.find(value => value.id === seed.pages.detail).description, 'Everything a neighbour needs before borrowing.');
const db = new DatabaseSync(join(data, 'machine.sqlite'), { readOnly: true });
const binding = db.prepare("SELECT repository_path AS repo, accepted_commit AS accepted FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'pages'").get(seed.projectId);
db.close();
const git = (...args) => execFileSync('git', ['-C', binding.repo, ...args]).toString().trim();
assert.equal(git('rev-parse', 'main'), binding.accepted, 'the layer is pinned to its merged main');
assert.match(git('log', '-1', '--format=%s', 'main'), /Name the goal before the first step/);
assert.match(git('show', 'main:knowledge/flow-method.md'), /Name the goal before the first step\.\s*$/);
console.log(`accepted: flow ${flow.id}, page ${seed.pages.detail} rev 2, pages main ${binding.accepted.slice(0, 7)}`);
