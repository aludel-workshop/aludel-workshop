import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { createAppJwt, mintInstallationToken } from '../server/github-app-auth.mjs';
import { githubIntegration, initGithubIdentities } from '../server/github-integration.mjs';
import { createExternalUser, createLoginTicket, createUser, initAccounts, redeemLoginTicket } from '../server/accounts.mjs';
import { loadGitHubVendorConfig } from '../server/github-vendor-config.mjs';
import { initializeAndPush, inspectGitRepository, pushWorkspace } from '../server/git-repository.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';

const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
const openFixture = path => { const db = openDatabase(path); initAccounts(db); initGithubIdentities(db); return db; };
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
  const db = openFixture(join(root, 'data', 'test.sqlite')); const secrets = openSecretStore(join(root, 'data'));
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
  const authorization = new URL(integration.startAuthorization('owner'));
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorization.searchParams.get('redirect_uri'), 'https://portal.example/api/integrations/github/callback');
  await integration.callback({ code: 'oauth-code', state: authorization.searchParams.get('state') });
  const status = integration.status('owner', 'the-machine', { initialized: false, committed: false });
  assert.equal(status.connected, true); assert.equal(status.installations[0].eligible, true);
  assert.equal(JSON.stringify(status).includes('user-token'), false);
  assert.equal(JSON.stringify(status).includes(vendorConfig.clientSecret), false);
  assert.equal(JSON.stringify(status).includes('BEGIN PRIVATE KEY'), false);
  const installationUrl = new URL(integration.startInstallation('owner'));
  assert.match(installationUrl.toString(), /^https:\/\/github.com\/apps\/the-machine-app\/installations\/new\?state=/);
  await assert.rejects(() => integration.installed({ installationId: 91, state: 'wrong-state' }), /invalid or expired/);
  await integration.installed({ installationId: 91, state: installationUrl.searchParams.get('state') });
  const partial = await integration.createRepository('owner', 'the-machine', { installationId: 91, name: 'machine', private: true }, () => {
    throw new Error('simulated local push failure');
  });
  assert.equal(partial.status, 'local-setup-needed');
  assert.equal(calls.find(call => call.url.endsWith('/orgs/acme/repos')).authorization, 'Bearer installation-token-1');
  assert.deepEqual(minted[0].options.permissions, { administration: 'write', contents: 'write' });
  // PLATFORM-UX-01: the push token asks for Workflows too; an installation without it gets a contents-only token (tests/ci-releases.test.mjs).
  assert.deepEqual(minted[1].options, { permissions: { contents: 'write', workflows: 'write' }, repositories: ['machine'] });
  const ready = await integration.finishLocalSetup('the-machine', values => {
    assert.equal(values.token, 'installation-token-3'); return { commit: 'abc123', trackedFiles: 42 };
  });
  assert.equal(ready.status, 'ready'); assert.equal(calls.filter(call => call.url.endsWith('/orgs/acme/repos')).length, 1);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM repository_bindings').all()).includes('installation-token'), false);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM github_identities').all()).includes('user-token'), false);
  db.close();
});

test('personal repository creation uses the required user token, then installation identity for Git', async () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-github-user-'));
  const db = openFixture(join(root, 'data', 'test.sqlite')); const secrets = openSecretStore(join(root, 'data')); const calls = [];
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
  const authorization = new URL(integration.startAuthorization('owner'));
  await integration.callback({ code: 'code', state: authorization.searchParams.get('state') });
  let gitToken;
  await integration.createRepository('owner', 'the-machine', { installationId: 44, name: 'machine', private: true }, values => {
    gitToken = values.token; return { commit: 'def456', trackedFiles: 12 };
  });
  assert.equal(calls.find(call => call.url.endsWith('/user/repos')).authorization, 'Bearer user-token');
  assert.equal(gitToken, 'installation-token');
  // Another account sees neither the owner's identity nor installations, and cannot use them to create repositories.
  const other = createUser(db, { email: 'someone@example.com', name: 'Someone', password: 'a-long-password' });
  const otherStatus = integration.status(other.id, null, null);
  assert.equal(otherStatus.connected, false); assert.deepEqual(otherStatus.installations, []);
  db.prepare(`INSERT INTO projects(id, slug, name, description, created_at, updated_at) VALUES ('p-other', 'other', 'Other', 'Other app', ?, ?)`).run(new Date().toISOString(), new Date().toISOString());
  await assert.rejects(() => integration.createRepository(other.id, 'p-other', { installationId: 44, name: 'again', private: true }, () => ({})), /Choose an active all-repositories installation/);
  db.close();
});

test('legacy project-keyed GitHub rows move once to the owner account', () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-github-migrate-'));
  const db = openDatabase(join(root, 'test.sqlite')); initAccounts(db);
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO github_users(project_id, access_token_encrypted, login, user_id, connected_at, updated_at) VALUES ('the-machine', 'sealed', 'octocat', '7', ?, ?)`).run(now, now);
  db.prepare(`INSERT INTO github_installations(project_id, installation_id, account_login, account_id, target_type, repository_selection, permissions_json, status, updated_at)
    VALUES ('the-machine', 44, 'octocat', '7', 'User', 'all', '{}', 'active', ?)`).run(now);
  initGithubIdentities(db);
  assert.equal(db.prepare("SELECT login FROM github_identities WHERE user_id = 'owner'").get().login, 'octocat');
  db.prepare("DELETE FROM github_user_installations WHERE user_id = 'owner'").run();
  initGithubIdentities(db);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM github_user_installations').get().count, 0, 'a removed installation must not be resurrected on restart');
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

// Git runs askpass directly and the owner runs ./launch-machine directly; both broke when committed as 644.
test('every tracked script with a shebang is committed executable', () => {
  const root = new URL('../../..', import.meta.url).pathname;
  const entries = spawnSync('git', ['ls-files', '-s'], { cwd: root, encoding: 'utf8' }).stdout.trim().split('\n');
  const missing = entries.map(line => /^(\d+) \S+ \d+\t(.+)$/.exec(line)).filter(Boolean)
    .filter(([, mode, path]) => mode !== '100755' && !path.startsWith('prototypes/') && readFileSync(join(root, path)).subarray(0, 2).toString() === '#!')
    .map(([, , path]) => path);
  assert.deepEqual(missing, [], 'Fix with: git update-index --chmod=+x <path> && chmod +x <path>');
});

test('continue with GitHub creates or finds one account, never takes over by email, and never shares an identity', async () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-github-signin-'));
  const db = openFixture(join(root, 'test.sqlite')); const secrets = openSecretStore(root);
  let profile = { login: 'octocat', id: 7, name: 'Mona', email: 'mona@example.com' };
  const fetcher = async url => {
    if (url.includes('login/oauth/access_token')) return response({ access_token: 'user-token' });
    if (url.endsWith('/user')) return response(profile);
    if (url.includes('/user/installations')) return response({ installations: [] });
    throw new Error(`Unexpected request ${url}`);
  };
  const integration = githubIntegration({ db, secrets, config: vendorConfig, callbackUrl: 'https://portal.example/callback', setupUrl: 'https://portal.example/installed', fetcher,
    createUserFromGithub: value => createExternalUser(db, { email: value.email, name: value.name || value.login }).id });
  const signIn = async () => integration.callback({ code: 'code', state: new URL(integration.startSignIn('https://aludel.example/start/account')).searchParams.get('state') });

  const first = await signIn();
  assert.equal(first.signIn, true); assert.equal(first.created, true);
  assert.equal(first.returnTo, 'https://aludel.example/start/account');
  assert.equal(db.prepare('SELECT display_name, password_hash FROM users WHERE id = ?').get(first.userId).display_name, 'Mona');
  assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(first.userId).password_hash, null, 'GitHub accounts have no Aludel password');
  const again = await signIn();
  assert.equal(again.userId, first.userId); assert.equal(again.created, false);
  await assert.rejects(() => integration.callback({ code: 'code', state: new URL(integration.startSignIn(null)).searchParams.get('state').replace(/.$/, 'x') }), /invalid or expired/);

  createUser(db, { email: 'grace@example.com', name: 'Grace', password: 'correct-horse-battery' });
  profile = { login: 'grace-gh', id: 8, name: 'Grace', email: 'grace@example.com' };
  await assert.rejects(signIn, error => error.status === 409 && /Sign in with your email and password/.test(error.message));

  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  profile = { login: 'octocat', id: 7, name: 'Mona', email: null };
  const connect = new URL(integration.startAuthorization(ada.id)).searchParams.get('state');
  await assert.rejects(() => integration.callback({ code: 'code', state: connect }), /already connected to a different Aludel account/);
  assert.equal(integration.status(ada.id, null, null).connected, false);

  const ticket = createLoginTicket(db, first.userId);
  assert.equal(redeemLoginTicket(db, ticket).id, first.userId);
  assert.throws(() => redeemLoginTicket(db, ticket), error => error.status === 401, 'tickets are single use');
  db.close();
});

test('the App\'s public identifiers are committed config; secrets come only from the environment', () => {
  const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });
  const committed = { appId: '13579', appSlug: 'aludel-app', clientId: 'Iv23committed', clientSecret: 'a-secret-that-must-be-ignored', privateKeyPath: '/ignored.pem' };
  const secrets = { MACHINE_GITHUB_CLIENT_SECRET: 'a-very-long-vendor-client-secret', MACHINE_GITHUB_PRIVATE_KEY_PATH: '/managed/github-app.pem' };
  const fromFile = loadGitHubVendorConfig(secrets, () => pem, committed);
  assert.equal(fromFile.configured, true, fromFile.issues.join());
  assert.deepEqual([fromFile.appId, fromFile.appSlug, fromFile.clientId], ['13579', 'aludel-app', 'Iv23committed']);
  const noSecrets = loadGitHubVendorConfig({}, () => pem, committed);
  assert.equal(noSecrets.configured, false, 'secrets in the committed file are never read');
  assert.deepEqual(noSecrets.issues, ['MACHINE_GITHUB_CLIENT_SECRET', 'MACHINE_GITHUB_PRIVATE_KEY_PATH']);
  const overridden = loadGitHubVendorConfig({ ...secrets, MACHINE_GITHUB_APP_SLUG: 'other-app' }, () => pem, committed);
  assert.equal(overridden.appSlug, 'other-app', 'the environment overrides committed identifiers');
  const empty = loadGitHubVendorConfig({}, () => pem, {});
  assert.ok(empty.issues[0].includes('config/github-app.json'), 'a missing identifier points at the committed file');
  const shipped = JSON.parse(readFileSync(new URL('../config/github-app.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(shipped).filter(key => !key.startsWith('$')).sort(), ['appId', 'appSlug', 'clientId'], 'the committed file holds only public identifiers');
});

test('pushes use only the installation token, never a credential helper from the person\'s git config', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-push-identity-'));
  // A stand-in for GitHub's smart-HTTP endpoint: it demands credentials and records what arrives, then refuses.
  const seen = join(root, 'seen.txt');
  const server = spawn(process.execPath, ['-e', `
    const { appendFileSync } = require('node:fs');
    require('node:http').createServer((request, response) => {
      const auth = request.headers.authorization;
      if (auth) appendFileSync(${JSON.stringify(seen)}, Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString() + '\\n');
      response.writeHead(401, { 'www-authenticate': 'Basic realm="GitHub"' }); response.end();
    }).listen(0, '127.0.0.1', function () { console.log(this.address().port); });`], { stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await new Promise(resolve => server.stdout.once('data', chunk => resolve(Number(String(chunk).trim()))));
  // The person's own git config has a helper (like `gh auth git-credential`) that would answer with their login.
  const marker = join(root, 'helper-used');
  const globalConfig = join(root, 'gitconfig');
  writeFileSync(globalConfig, `[credential]\n\thelper = "!f() { echo used > '${marker}'; echo username=person; echo password=personal-token; }; f"\n`);
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = globalConfig;
  try {
    const repository = join(root, 'app');
    mkdirSync(repository);
    for (const args of [['init', '-b', 'main'], ['config', 'user.name', 'Ada'], ['config', 'user.email', 'ada@example.com'], ['commit', '--allow-empty', '-m', 'start']]) spawnSync('git', args, { cwd: repository });
    const remoteUrl = `http://127.0.0.1:${port}/owner/app.git`;
    // Control: a plain push asks the helper, which is how the first live push went out as the person.
    spawnSync('git', ['push', remoteUrl, 'main'], { cwd: repository, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    assert.ok(existsSync(marker), 'control: without the fix, git uses the configured helper');
    assert.match(readFileSync(seen, 'utf8'), /^person:personal-token$/m);
    writeFileSync(seen, ''); spawnSync('rm', ['-f', marker]);

    assert.throws(() => pushWorkspace({ repository, remoteUrl, token: 'ghs_installation-token', branch: 'main' }));
    assert.equal(existsSync(marker), false, 'the helper is never asked');
    assert.deepEqual(readFileSync(seen, 'utf8').trim().split('\n'), ['x-access-token:ghs_installation-token'], 'only the installation token is sent');
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = previous;
    server.kill();
  }
});
