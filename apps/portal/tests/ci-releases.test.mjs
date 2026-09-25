// PLATFORM-UX-01 round 3: releases published to the project's own GitHub repository, and CI results read back from it.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import test from 'node:test';
import { parseJunit, unzipFile } from '../server/ci-results.mjs';
import { githubIntegration, initGithubIdentities } from '../server/github-integration.mjs';
import { initAccounts } from '../server/accounts.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { agentsMap, workflowPaths } from '../server/scaffold.mjs';

// A one-file zip, as GitHub serves an artifact.
function zip(name, text) {
  const data = deflateRawSync(Buffer.from(text)); const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(text.length, 22); local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(text.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(0, 42);
  const centralAt = local.length + nameBytes.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + nameBytes.length, 12); end.writeUInt32LE(centralAt, 16);
  return Buffer.concat([local, nameBytes, data, central, nameBytes, end]);
}
const junit = `<?xml version="1.0"?><testsuites>
  <testcase name="S1/1 · signs a new account in" file="/work/tests/signup.test.mjs"/>
  <testcase name="S2/2 &amp; wrong password" file="/work/tests/signup.test.mjs" failure="expected 401"><failure message="expected 401">…</failure></testcase>
  <testcase name="later" file="/work/tests/x.test.mjs"><skipped/></testcase>
</testsuites>`;

test('an artifact zip is read without a dependency, and JUnit becomes pass, fail or skipped per test', () => {
  const file = unzipFile(zip('test-results.xml', junit), name => name.endsWith('.xml'));
  assert.equal(file.name, 'test-results.xml');
  assert.deepEqual(parseJunit(file.text).map(entry => [entry.name, entry.result]), [['S1/1 · signs a new account in', 'pass'], ['S2/2 & wrong password', 'fail'], ['later', 'skipped']]);
  assert.equal(parseJunit(file.text)[1].message, 'expected 401');
});

function fixture({ granted }) {
  const root = mkdtempSync(join(tmpdir(), 'aludel-ci-'));
  const db = openDatabase(join(root, 'test.sqlite')); initAccounts(db); initGithubIdentities(db);
  const at = new Date().toISOString();
  db.prepare("INSERT INTO projects(id, slug, name, description, created_at, updated_at) VALUES ('p1', 'tool-share', 'Tool Share', 'x', ?, ?)").run(at, at);
  db.prepare(`INSERT INTO repository_bindings(project_id, provider, owner, name, html_url, clone_url, default_branch, private, status, installation_id, account_type, created_at, updated_at)
    VALUES ('p1', 'github', 'Ada', 'tool-share', 'https://github.com/Ada/tool-share', 'https://github.com/Ada/tool-share.git', 'main', 1, 'ready', 91, 'User', ?, ?)`).run(at, at);
  const minted = []; const calls = [];
  const mintInstallationToken = async (_config, installationId, options) => {
    minted.push(options.permissions);
    if (Object.keys(options.permissions).some(key => !granted.includes(key))) throw Object.assign(new Error('The permissions requested are not granted to this installation.'), { status: 422 });
    return { token: `token-${Object.keys(options.permissions).join('-')}` };
  };
  const fetcher = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', authorization: options.headers?.authorization, body: options.body ? JSON.parse(options.body) : null });
    const ok = value => ({ ok: true, status: 200, json: async () => value, arrayBuffer: async () => value });
    if (url.endsWith('/repos/Ada/tool-share/releases')) return { ok: true, status: 201, json: async () => ({ id: 7, html_url: 'https://github.com/Ada/tool-share/releases/tag/v0.1.0' }) };
    if (url.includes('/actions/runs?head_sha=abc123')) return ok({ workflow_runs: [{ path: '.github/workflows/release.yml', status: 'completed' }, { path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/run/1', updated_at: '2026-09-24T10:00:00Z', artifacts_url: 'https://api.github.com/run/1/artifacts' }] });
    if (url === 'https://api.github.com/run/1/artifacts') return ok({ artifacts: [{ name: 'test-results', expired: false, archive_download_url: 'https://api.github.com/artifact/5/zip' }] });
    if (url === 'https://api.github.com/artifact/5/zip') return { ok: true, status: 200, arrayBuffer: async () => zip('test-results.xml', junit) };
    if (url.includes('/actions/runs?head_sha=fff')) return ok({ workflow_runs: [] });
    throw new Error(`Unexpected request ${url}`);
  };
  const vendor = { configured: true, issues: [], appId: '1', appSlug: 'aludel', clientId: 'Iv1', clientSecret: 'secret-secret-secret', privateKey: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const github = githubIntegration({ db, secrets: openSecretStore(root), config: vendor, callbackUrl: 'http://x/cb', setupUrl: 'http://x/setup', fetcher, mintInstallationToken });
  return { github, minted, calls };
}

test('releases go to the project\'s own repository; CI results come from its ci.yml run and test-results artifact', async () => {
  const { github, calls } = fixture({ granted: ['contents', 'workflows', 'actions'] });
  assert.equal(await github.canPushWorkflows('p1'), true);
  const published = await github.createRelease('p1', { tag: 'v0.1.0', sha: 'abc123', name: 'v0.1.0', body: 'First.' });
  assert.equal(published.url, 'https://github.com/Ada/tool-share/releases/tag/v0.1.0');
  const release = calls.find(call => call.url.endsWith('/releases'));
  assert.equal(release.method, 'POST');
  assert.deepEqual(release.body, { tag_name: 'v0.1.0', target_commitish: 'abc123', name: 'v0.1.0', body: 'First.', draft: false, prerelease: false });
  assert.equal(release.authorization, 'Bearer token-contents', 'a contents-only installation token, not a user token');
  const results = await github.ciResults('p1', 'abc123');
  assert.equal(results.state, 'failure');
  assert.equal(results.url, 'https://github.com/run/1', 'the CI workflow run, not the release workflow');
  assert.deepEqual(results.tests.map(entry => entry.result), ['pass', 'fail', 'skipped']);
  assert.equal((await github.ciResults('p1', 'fff')).state, 'no-run');
});

test('without the new permissions nothing breaks: pushes stay contents-only, workflows are left out, results say why', async () => {
  const { github, minted } = fixture({ granted: ['contents'] });
  assert.equal(await github.canPushWorkflows('p1'), false);
  assert.equal(await github.installationTokenForRepository('p1', 'tool-share'), 'token-contents', 'falls back to a contents-only push token');
  assert.deepEqual(minted.at(-1), { contents: 'write' });
  assert.equal((await github.ciResults('p1', 'abc123')).state, 'no-permission');
  assert.deepEqual(workflowPaths, ['.github/workflows/ci.yml', '.github/workflows/release.yml']);
});

test('AGENTS.md starts as a short map; the generated guide is a doc', () => {
  const map = agentsMap({ project: { name: 'Tool Share', description: 'Neighbours lend tools.' } });
  assert.ok(map.split('\n').length < 30, 'a map, not a manual');
  assert.match(map, /docs\/agents\.md/);
  assert.match(map, /docker compose up --build/);
});
