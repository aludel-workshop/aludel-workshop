import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { createAppJwt, mintInstallationToken } from '../server/github-app-auth.mjs';
import { githubIntegration } from '../server/github-integration.mjs';
import { loadGitHubVendorConfig } from '../server/github-vendor-config.mjs';
import { initializeAndPush, inspectGitRepository } from '../server/git-repository.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';

const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
const vendorConfig = { configured: true, issues: [], appId: '24680', appSlug: 'the-machine-app',
  clientId: 'Iv1234567890', clientSecret: 'a-very-long-vendor-client-secret', privateKey };

test('vendor configuration validates once and app JWTs are short-lived and signed', async () => {
  const config = loadGitHubVendorConfig({
    MACHINE_GITHUB_APP_ID: '24680', MACHINE_GITHUB_APP_SLUG: 'the-machine-app',
    MACHINE_GITHUB_CLIENT_ID: 'Iv1234567890', MACHINE_GITHUB_CLIENT_SECRET: 'a-very-long-vendor-client-secret',
    MACHINE_GITHUB_PRIVATE_KEY_PATH: '/managed/github-app.pem'
  }, () => privateKey);
  assert.equal(config.configured, true);
  const instant = Date.parse('2026-09-21T12:00:00Z');
  const jwt = createAppJwt(config, () => instant);
  const [header, payload, signature] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.iss, '24680');
  assert.equal(claims.exp - claims.iat, 600);
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), keys.publicKey, Buffer.from(signature, 'base64url')), true);
  let request;
  const token = await mintInstallationToken(config, 91, { permissions: { contents: 'write' }, repositories: ['machine'] }, async (url, options) => {
    request = { url, options };
    return response({ token: 'short-lived-install-token', expires_at: '2026-09-21T13:00:00Z' }, 201);
  }, () => instant);
  assert.equal(token.token, 'short-lived-install-token');
  assert.equal(request.url, 'https://api.github.com/app/installations/91/access_tokens');
  assert.deepEqual(JSON.parse(request.options.body), { permissions: { contents: 'write' }, repositories: ['machine'] });
});

test('organization flow verifies installation, seals user token, and recovers with fresh installation tokens', async () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-github-org-'));
  const db = openDatabase(join(root, 'data', 'test.sqlite')); const secrets = openSecretStore(join(root, 'data'));
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='github_connections'").get(), undefined);
  const calls = []; const minted = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, authorization: options.headers?.authorization, body: options.body ? JSON.parse(options.body) : null });
    if (url.includes('login/oauth/access_token')) return response({ access_token: 'user-token', refresh_token: 'refresh-token', expires_in: 28800 });
    if (url.endsWith('/user')) return response({ login: 'owner', id: 7 });
    if (url.includes('/user/installations')) return response({ installations: [{ id: 91, account: { login: 'acme', id: 8 },
      target_type: 'Organization', repository_selection: 'all', permissions: { administration: 'write', contents: 'write' }, suspended_at: null }] });
    if (url.endsWith('/orgs/acme/repos')) return response({ owner: { login: 'acme' }, name: 'machine',
      html_url: 'https://github.com/acme/machine', clone_url: 'https://github.com/acme/machine.git', default_branch: 'main', private: true }, 201);
    throw new Error(`Unexpected request ${url}`);
  };
  const integration = githubIntegration({ db, secrets, config: vendorConfig,
    callbackUrl: 'https://portal.example/api/integrations/github/callback', setupUrl: 'https://portal.example/api/integrations/github/installed', fetcher,
    mintInstallationToken: async (_config, installationId, options) => {
      minted.push({ installationId, options }); return { token: `installation-token-${minted.length}`, expiresAt: 'soon' };
    } });
  const authorization = new URL(integration.startAuthorization('the-machine'));
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorization.searchParams.get('redirect_uri'), 'https://portal.example/api/integrations/github/callback');
  await integration.callback({ code: 'oauth-code', state: authorization.searchParams.get('state') });
  const status = integration.status('the-machine', { initialized: false, committed: false });
  assert.equal(status.connected, true); assert.equal(status.installations[0].eligible, true);
  assert.equal(JSON.stringify(status).includes('user-token'), false);
  assert.equal(JSON.stringify(status).includes(vendorConfig.clientSecret), false);
  assert.equal(JSON.stringify(status).includes('BEGIN PRIVATE KEY'), false);
  const installationUrl = new URL(integration.startInstallation('the-machine'));
  assert.match(installationUrl.toString(), /^https:\/\/github.com\/apps\/the-machine-app\/installations\/new\?state=/);
  await assert.rejects(() => integration.installed({ installationId: 91, state: 'wrong-state' }), /invalid or expired/);
  await integration.installed({ installationId: 91, state: installationUrl.searchParams.get('state') });
  const partial = await integration.createRepository('the-machine', { installationId: 91, name: 'machine', private: true }, () => {
    throw new Error('simulated local push failure');
  });
  assert.equal(partial.status, 'local-setup-needed');
  assert.equal(calls.find(call => call.url.endsWith('/orgs/acme/repos')).authorization, 'Bearer installation-token-1');
  assert.deepEqual(minted[0].options.permissions, { administration: 'write', contents: 'write' });
  assert.deepEqual(minted[1].options, { permissions: { contents: 'write' }, repositories: ['machine'] });
  const ready = await integration.finishLocalSetup('the-machine', values => {
    assert.equal(values.token, 'installation-token-3'); return { commit: 'abc123', trackedFiles: 42 };
  });
  assert.equal(ready.status, 'ready'); assert.equal(calls.filter(call => call.url.endsWith('/orgs/acme/repos')).length, 1);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM repository_bindings').all()).includes('installation-token'), false);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM github_users').all()).includes('user-token'), false);
  db.close();
});

test('personal repository creation uses the required user token, then installation identity for Git', async () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-github-user-'));
  const db = openDatabase(join(root, 'data', 'test.sqlite')); const secrets = openSecretStore(join(root, 'data')); const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, authorization: options.headers?.authorization });
    if (url.includes('login/oauth/access_token')) return response({ access_token: 'user-token' });
    if (url.endsWith('/user')) return response({ login: 'octocat', id: 7 });
    if (url.includes('/user/installations')) return response({ installations: [{ id: 44, account: { login: 'octocat', id: 7 },
      target_type: 'User', repository_selection: 'all', permissions: { administration: 'write', contents: 'write' } }] });
    if (url.endsWith('/user/repos')) return response({ owner: { login: 'octocat' }, name: 'machine',
      html_url: 'https://github.com/octocat/machine', clone_url: 'https://github.com/octocat/machine.git', default_branch: 'main', private: true }, 201);
    throw new Error(`Unexpected request ${url}`);
  };
  const integration = githubIntegration({ db, secrets, config: vendorConfig, callbackUrl: 'https://portal.example/callback',
    setupUrl: 'https://portal.example/installed', fetcher,
    mintInstallationToken: async () => ({ token: 'installation-token', expiresAt: 'soon' }) });
  const authorization = new URL(integration.startAuthorization('the-machine'));
  await integration.callback({ code: 'code', state: authorization.searchParams.get('state') });
  let gitToken;
  await integration.createRepository('the-machine', { installationId: 44, name: 'machine', private: true }, values => {
    gitToken = values.token; return { commit: 'def456', trackedFiles: 12 };
  });
  assert.equal(calls.find(call => call.url.endsWith('/user/repos')).authorization, 'Bearer user-token');
  assert.equal(gitToken, 'installation-token');
  db.close();
});

test('configured Git profile creates and pushes a clean initial repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-git-profile-'));
  const repository = join(root, 'source'); const remote = join(root, 'remote.git');
  mkdirSync(repository); writeFileSync(join(repository, 'README.md'), '# Example\n');
  mkdirSync(join(repository, '.data')); writeFileSync(join(repository, '.data', 'secret.sqlite'), 'not committed');
  assert.equal(spawnSync('git', ['init', '--bare', '-b', 'main', remote]).status, 0);
  const profile = { initialBranch: 'main', initialCommitMessage: 'chore: establish project baseline',
    gitignore: ['.data/', 'node_modules/'], gitattributes: ['* text=auto', '*.md text eol=lf'] };
  const result = initializeAndPush({ repository, profile, remoteUrl: remote, login: 'the-machine[bot]', userId: '24680', token: 'unused-local-token' });
  assert.equal(result.trackedFiles, 3); assert.equal(inspectGitRepository(repository).committed, true);
  assert.equal(readFileSync(join(repository, '.gitignore'), 'utf8'), '.data/\nnode_modules/\n');
  const remoteHead = spawnSync('git', ['--git-dir', remote, 'rev-parse', 'main'], { encoding: 'utf8' });
  assert.equal(remoteHead.status, 0); assert.equal(remoteHead.stdout.trim(), result.commit);
});
