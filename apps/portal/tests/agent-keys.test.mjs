// LAY-04D: pasted agent API keys. Checked against the provider (a free model list) before saving; guide and config agree.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import test from 'node:test';
import { agentKeyChecker, loadAgentProviders } from '../server/onboarding.mjs';

const root = new URL('..', import.meta.url).pathname;
const { providers } = loadAgentProviders(join(root, 'config'));

test('the check sends the key only as the provider expects, to the models list, and reads the answer', async () => {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push({ url: request.url, headers: request.headers });
    const key = request.headers['x-api-key'] || String(request.headers.authorization || '').replace(/^Bearer /, '');
    response.writeHead(key.endsWith('good') ? 200 : key.endsWith('busy') ? 529 : 401, { 'content-type': 'application/json' }).end('{}');
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const check = agentKeyChecker({ MACHINE_ANTHROPIC_API_URL: base, MACHINE_OPENAI_API_URL: `${base}/` });
    assert.deepEqual(await check(providers.anthropic, 'sk-ant-api03-good'), { ok: true });
    assert.equal(seen[0].url, '/v1/models?limit=1');
    assert.equal(seen[0].headers['x-api-key'], 'sk-ant-api03-good');
    assert.equal(seen[0].headers['anthropic-version'], '2023-06-01');
    assert.deepEqual(await check(providers.openai, 'sk-proj-good'), { ok: true });
    assert.equal(seen[1].url, '/v1/models');
    assert.equal(seen[1].headers.authorization, 'Bearer sk-proj-good');
    assert.deepEqual(await check(providers.openai, 'sk-proj-revoked'), { ok: false, reason: 'rejected', status: 401 });
    assert.deepEqual(await check(providers.anthropic, 'sk-ant-api03-busy'), { ok: false, reason: 'error', status: 529 });
  } finally { server.close(); }
  const offline = agentKeyChecker({ MACHINE_ANTHROPIC_API_URL: 'http://127.0.0.1:9' });
  assert.deepEqual(await offline(providers.anthropic, 'sk-ant-api03-x'), { ok: false, reason: 'unreachable' });
});

test('admin keys are refused and each provider has complete, https guidance', () => {
  assert.ok(providers.anthropic.rejections[0].pattern.test('sk-ant-admin01-abc'));
  assert.ok(providers.openai.rejections[0].pattern.test('sk-admin-abc'));
  for (const provider of Object.values(providers)) {
    assert.ok(provider.steps.length >= 4 && provider.limits);
    for (const url of [provider.keyUrl, provider.limitsUrl, provider.docsUrl]) assert.match(url, /^https:\/\//);
  }
});

test('the user guide mirrors the in-app steps: same pages, same limits advice', () => {
  const guide = readFileSync(join(root, '..', '..', 'docs', 'guides', 'connect-an-agent.md'), 'utf8');
  for (const provider of Object.values(providers)) {
    for (const url of [provider.keyUrl, provider.limitsUrl]) assert.ok(guide.includes(url), `the guide links ${url}`);
    assert.ok(guide.includes(provider.label));
  }
  assert.match(guide, /never shown again/i);
  assert.match(guide, /costs nothing/i);
});
