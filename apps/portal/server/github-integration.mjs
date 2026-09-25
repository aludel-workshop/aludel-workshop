import { createHash, randomBytes } from 'node:crypto';
import { mintInstallationToken as mintToken } from './github-app-auth.mjs';
import { parseJunit, unzipFile } from './ci-results.mjs';

const apiVersion = '2022-11-28';
const digest = value => createHash('sha256').update(value).digest('hex');
const challenge = value => createHash('sha256').update(value).digest('base64url');
const now = () => new Date().toISOString();

function failure(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function requestJson(url, token, options = {}, fetcher = fetch) {
  const response = await fetcher(url, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json', authorization: `Bearer ${token}`,
      'x-github-api-version': apiVersion, 'user-agent': 'aludel-portal',
      ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {})
    }
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw failure(value.message || `GitHub returned ${response.status}.`, 502);
  return value;
}

const permissions = value => typeof value === 'string' ? JSON.parse(value) : value || {};
const eligible = installation => installation.status === 'active' && installation.repository_selection === 'all'
  && permissions(installation.permissions_json).administration === 'write'
  && permissions(installation.permissions_json).contents === 'write';

// Identity and installations belong to the person who connected GitHub; repository bindings belong to projects.
export function initGithubIdentities(db) {
  const fresh = !db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'github_identities'").get();
  db.exec(`
    CREATE TABLE IF NOT EXISTS github_identities (
      user_id TEXT PRIMARY KEY REFERENCES users(id), access_token_encrypted TEXT,
      refresh_token_encrypted TEXT, token_expires_at TEXT, refresh_token_expires_at TEXT,
      login TEXT, github_user_id TEXT, oauth_state_hash TEXT UNIQUE, oauth_state_expires_at TEXT,
      oauth_code_verifier_encrypted TEXT, install_state_hash TEXT UNIQUE, install_state_expires_at TEXT,
      return_to TEXT, connected_at TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS github_sign_ins (
      state_hash TEXT PRIMARY KEY, code_verifier_encrypted TEXT NOT NULL, return_to TEXT, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS github_user_installations (
      user_id TEXT NOT NULL REFERENCES users(id), installation_id INTEGER NOT NULL,
      account_login TEXT NOT NULL, account_id TEXT NOT NULL, target_type TEXT NOT NULL,
      repository_selection TEXT NOT NULL, permissions_json TEXT NOT NULL, status TEXT NOT NULL,
      updated_at TEXT NOT NULL, PRIMARY KEY(user_id, installation_id)
    );
  `);
  // One GitHub account can belong to only one Aludel account.
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_github_identity_account ON github_identities(github_user_id) WHERE github_user_id IS NOT NULL');
  // One-time move of the single-owner, project-keyed rows to the owner account. The old tables stay for rollback.
  if (fresh) db.exec(`
    INSERT OR IGNORE INTO github_identities(user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at,
      refresh_token_expires_at, login, github_user_id, connected_at, updated_at)
      SELECT 'owner', access_token_encrypted, refresh_token_encrypted, token_expires_at, refresh_token_expires_at,
        login, user_id, connected_at, updated_at FROM github_users WHERE project_id = 'the-machine' AND access_token_encrypted IS NOT NULL;
    INSERT OR IGNORE INTO github_user_installations(user_id, installation_id, account_login, account_id, target_type,
      repository_selection, permissions_json, status, updated_at)
      SELECT 'owner', installation_id, account_login, account_id, target_type, repository_selection, permissions_json, status, updated_at
      FROM github_installations WHERE project_id = 'the-machine';
  `);
}

export function githubIntegration({ db, secrets, config, callbackUrl, setupUrl, fetcher = fetch, mintInstallationToken = mintToken,
  createUserFromGithub = () => { throw failure('Signing in with GitHub is not available here.', 503); } }) {
  const user = userId => db.prepare('SELECT * FROM github_identities WHERE user_id = ?').get(userId);
  const binding = projectId => db.prepare(`SELECT provider, owner, name, html_url, clone_url, default_branch, private,
    status, commit_sha, tracked_files, last_error, installation_id, account_type FROM repository_bindings WHERE project_id = ?`).get(projectId) || null;
  const installations = userId => db.prepare(`SELECT installation_id, account_login, account_id, target_type,
    repository_selection, permissions_json, status FROM github_user_installations WHERE user_id = ? ORDER BY account_login`).all(userId)
    .map(value => ({ ...value, permissions: permissions(value.permissions_json), eligible: eligible(value) }));

  async function usableUserToken(row) {
    if (!row?.access_token_encrypted) throw failure('Authorize the vendor GitHub App first.');
    if (!row.token_expires_at || row.token_expires_at > new Date(Date.now() + 60_000).toISOString()) return secrets.open(row.access_token_encrypted);
    if (!row.refresh_token_encrypted) throw failure('The GitHub authorization expired. Connect again.', 409);
    const response = await fetcher('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret,
        grant_type: 'refresh_token', refresh_token: secrets.open(row.refresh_token_encrypted) })
    });
    const value = await response.json();
    if (!response.ok || !value.access_token) throw failure(value.error_description || 'GitHub user-token refresh failed.', 502);
    const refreshedAt = Date.now();
    db.prepare(`UPDATE github_identities SET access_token_encrypted = ?, refresh_token_encrypted = ?, token_expires_at = ?,
      refresh_token_expires_at = ?, updated_at = ? WHERE user_id = ?`).run(
      secrets.seal(value.access_token), value.refresh_token ? secrets.seal(value.refresh_token) : null,
      value.expires_in ? new Date(refreshedAt + value.expires_in * 1000).toISOString() : null,
      value.refresh_token_expires_in ? new Date(refreshedAt + value.refresh_token_expires_in * 1000).toISOString() : null,
      now(), row.user_id
    );
    return value.access_token;
  }

  async function syncInstallations(userId, token) {
    const value = await requestJson('https://api.github.com/user/installations?per_page=100', token, {}, fetcher);
    const seen = [];
    db.exec('BEGIN');
    try {
      const items = value.installations || [];
      for (const item of items) {
        seen.push(Number(item.id));
        db.prepare(`INSERT INTO github_user_installations(user_id, installation_id, account_login, account_id, target_type,
          repository_selection, permissions_json, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, installation_id) DO UPDATE SET account_login=excluded.account_login,
          account_id=excluded.account_id, target_type=excluded.target_type, repository_selection=excluded.repository_selection,
          permissions_json=excluded.permissions_json, status=excluded.status, updated_at=excluded.updated_at`).run(
          userId, item.id, item.account.login, String(item.account.id), item.target_type,
          item.repository_selection, JSON.stringify(item.permissions || {}), item.suspended_at ? 'suspended' : 'active', now()
        );
      }
      if (seen.length) db.prepare(`DELETE FROM github_user_installations WHERE user_id = ? AND installation_id NOT IN (${seen.map(() => '?').join(',')})`).run(userId, ...seen);
      else db.prepare('DELETE FROM github_user_installations WHERE user_id = ?').run(userId);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return installations(userId);
  }

  function authorizeUrl(state, verifier) {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', config.clientId); url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('state', state); url.searchParams.set('code_challenge', challenge(verifier));
    url.searchParams.set('code_challenge_method', 'S256'); url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  async function exchange(code, verifier) {
    const response = await fetcher('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: callbackUrl, code_verifier: verifier })
    });
    const token = await response.json();
    if (!response.ok || !token.access_token) throw failure(token.error_description || 'GitHub authorization failed.', 502);
    return { token, profile: await requestJson('https://api.github.com/user', token.access_token, {}, fetcher) };
  }

  async function saveIdentity(userId, token, profile) {
    const issuedAt = Date.now();
    db.prepare(`INSERT INTO github_identities(user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at,
      refresh_token_expires_at, login, github_user_id, connected_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET access_token_encrypted=excluded.access_token_encrypted, refresh_token_encrypted=excluded.refresh_token_encrypted,
      token_expires_at=excluded.token_expires_at, refresh_token_expires_at=excluded.refresh_token_expires_at, login=excluded.login,
      github_user_id=excluded.github_user_id, connected_at=excluded.connected_at, updated_at=excluded.updated_at`).run(
      userId, secrets.seal(token.access_token), token.refresh_token ? secrets.seal(token.refresh_token) : null,
      token.expires_in ? new Date(issuedAt + token.expires_in * 1000).toISOString() : null,
      token.refresh_token_expires_in ? new Date(issuedAt + token.refresh_token_expires_in * 1000).toISOString() : null,
      profile.login, String(profile.id), now(), now()
    );
    await syncInstallations(userId, token.access_token);
  }

  async function installationToken(installationId, options) {
    const minted = await mintInstallationToken(config, installationId, options, fetcher);
    return minted.token;
  }

  // PLATFORM-UX-01: pushing files under .github/workflows needs the Workflows permission. An installation that hasn't
  // accepted it still gets a contents-only token, and the scaffold leaves its workflow files out (canPushWorkflows).
  async function scopedToken(projectId, permissionSet, repositoryName) {
    const repo = binding(projectId);
    if (!repo?.installation_id) throw failure('The project has no GitHub installation binding.', 409);
    return installationToken(repo.installation_id, { permissions: permissionSet, repositories: [repositoryName || repo.name] });
  }
  async function tryToken(projectId, permissionSet, repositoryName) { try { return await scopedToken(projectId, permissionSet, repositoryName); } catch { return null; } }
  async function pushToken(projectId, repositoryName) {
    return (await tryToken(projectId, { contents: 'write', workflows: 'write' }, repositoryName)) || scopedToken(projectId, { contents: 'write' }, repositoryName);
  }
  const api = (repo, path) => `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}${path}`;

  return {
    status(userId, projectId, local) {
      const row = user(userId);
      return {
        provider: 'github', configured: config.configured, configurationIssues: config.issues,
        appSlug: config.configured ? config.appSlug : null,
        callbackUrl, setupUrl,
        connected: Boolean(row?.access_token_encrypted && row?.login), login: row?.login || null,
        permissions: 'Administration and Contents: read/write', installations: installations(userId),
        repository: projectId ? binding(projectId) : null, local
      };
    },
    startAuthorization(userId, returnTo = null) {
      if (!config.configured) throw failure('The vendor GitHub App is not configured.', 503);
      const state = randomBytes(32).toString('base64url');
      const verifier = randomBytes(64).toString('base64url');
      db.prepare(`INSERT INTO github_identities(user_id, oauth_state_hash, oauth_state_expires_at,
        oauth_code_verifier_encrypted, return_to, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET oauth_state_hash=excluded.oauth_state_hash,
        oauth_state_expires_at=excluded.oauth_state_expires_at,
        oauth_code_verifier_encrypted=excluded.oauth_code_verifier_encrypted, return_to=excluded.return_to, updated_at=excluded.updated_at`).run(
        userId, digest(state), new Date(Date.now() + 10 * 60_000).toISOString(), secrets.seal(verifier), returnTo, now()
      );
      return authorizeUrl(state, verifier);
    },
    // "Sign in with GitHub": the same OAuth app authenticates the person and connects their GitHub identity in one trip.
    startSignIn(returnTo = null) {
      if (!config.configured) throw failure('The vendor GitHub App is not configured.', 503);
      const state = randomBytes(32).toString('base64url');
      const verifier = randomBytes(64).toString('base64url');
      db.prepare('DELETE FROM github_sign_ins WHERE expires_at < ?').run(now());
      db.prepare('INSERT INTO github_sign_ins(state_hash, code_verifier_encrypted, return_to, expires_at) VALUES (?, ?, ?, ?)')
        .run(digest(state), secrets.seal(verifier), returnTo, new Date(Date.now() + 10 * 60_000).toISOString());
      return authorizeUrl(state, verifier);
    },
    async callback({ code, state }) {
      const stateHash = digest(String(state || ''));
      const connecting = db.prepare('SELECT * FROM github_identities WHERE oauth_state_hash = ?').get(stateHash);
      if (connecting) {
        if (!code || connecting.oauth_state_expires_at < now() || !connecting.oauth_code_verifier_encrypted) throw failure('The GitHub authorization is invalid or expired.');
        const verifier = secrets.open(connecting.oauth_code_verifier_encrypted);
        db.prepare(`UPDATE github_identities SET oauth_state_hash=NULL, oauth_state_expires_at=NULL,
          oauth_code_verifier_encrypted=NULL WHERE user_id=?`).run(connecting.user_id);
        const { token, profile } = await exchange(code, verifier);
        const owner = db.prepare('SELECT user_id FROM github_identities WHERE github_user_id = ? AND user_id <> ?').get(String(profile.id), connecting.user_id);
        if (owner) throw failure(`The GitHub account ${profile.login} is already connected to a different Aludel account. Sign in with GitHub to use that account.`, 409);
        await saveIdentity(connecting.user_id, token, profile);
        return { userId: connecting.user_id, returnTo: connecting.return_to };
      }
      const signIn = db.prepare('SELECT * FROM github_sign_ins WHERE state_hash = ?').get(stateHash);
      if (!signIn || !code || signIn.expires_at < now()) throw failure('The GitHub authorization is invalid or expired.');
      db.prepare('DELETE FROM github_sign_ins WHERE state_hash = ?').run(stateHash);
      const { token, profile } = await exchange(code, secrets.open(signIn.code_verifier_encrypted));
      const existing = db.prepare('SELECT user_id FROM github_identities WHERE github_user_id = ?').get(String(profile.id));
      const userId = existing?.user_id || createUserFromGithub(profile);
      await saveIdentity(userId, token, profile);
      return { userId, returnTo: signIn.return_to, signIn: true, created: !existing };
    },
    startInstallation(userId, returnTo = null) {
      if (!config.configured || !user(userId)?.access_token_encrypted) throw failure('Authorize GitHub before installing the app.');
      const state = randomBytes(32).toString('base64url');
      db.prepare('UPDATE github_identities SET install_state_hash=?, install_state_expires_at=?, return_to=?, updated_at=? WHERE user_id=?').run(
        digest(state), new Date(Date.now() + 10 * 60_000).toISOString(), returnTo, now(), userId
      );
      return `https://github.com/apps/${config.appSlug}/installations/new?state=${encodeURIComponent(state)}`;
    },
    async installed({ installationId, state }) {
      const row = db.prepare('SELECT * FROM github_identities WHERE install_state_hash = ?').get(digest(String(state || '')));
      if (!row || row.install_state_expires_at < now() || !installationId) throw failure('The GitHub installation return is invalid or expired.');
      db.prepare('UPDATE github_identities SET install_state_hash=NULL, install_state_expires_at=NULL WHERE user_id=?').run(row.user_id);
      const token = await usableUserToken(row);
      const items = await syncInstallations(row.user_id, token);
      if (!items.some(item => Number(item.installation_id) === Number(installationId))) throw failure('GitHub did not confirm that installation for this account.', 403);
      return { userId: row.user_id, returnTo: row.return_to };
    },
    async refreshInstallations(userId) {
      return syncInstallations(userId, await usableUserToken(user(userId)));
    },
    async createRepository(userId, projectId, { installationId, name, description, private: isPrivate }, initialize) {
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(String(name || ''))) throw failure('Use a valid GitHub repository name.');
      if (binding(projectId)) throw failure('This project already has a repository binding.', 409);
      const installation = installations(userId).find(item => Number(item.installation_id) === Number(installationId));
      if (!installation || !installation.eligible) throw failure('Choose an active all-repositories installation with Administration and Contents write permissions.', 409);
      let createToken; let path;
      if (installation.target_type === 'Organization') {
        createToken = await installationToken(installation.installation_id, { permissions: { administration: 'write', contents: 'write' } });
        path = `/orgs/${encodeURIComponent(installation.account_login)}/repos`;
      } else if (installation.target_type === 'User') {
        createToken = await usableUserToken(user(userId));
        path = '/user/repos';
      } else throw failure('That GitHub installation account type is not supported.', 409);
      const remote = await requestJson(`https://api.github.com${path}`, createToken, {
        method: 'POST', body: JSON.stringify({ name, description, private: Boolean(isPrivate), auto_init: false })
      }, fetcher);
      const created = now();
      db.prepare(`INSERT INTO repository_bindings(project_id, provider, owner, name, html_url, clone_url, default_branch,
        private, status, installation_id, account_type, created_at, updated_at)
        VALUES (?, 'github', ?, ?, ?, ?, ?, ?, 'remote-created', ?, ?, ?, ?)`).run(
        projectId, remote.owner.login, remote.name, remote.html_url, remote.clone_url, remote.default_branch,
        remote.private ? 1 : 0, installation.installation_id, installation.target_type, created, created
      );
      try {
        const token = await pushToken(projectId, remote.name);
        const result = initialize({ remoteUrl: remote.clone_url, login: 'the-machine[bot]', userId: config.appId, token });
        db.prepare(`UPDATE repository_bindings SET status='ready', commit_sha=?, tracked_files=?, last_error=NULL, updated_at=? WHERE project_id=?`).run(
          result.commit, result.trackedFiles, now(), projectId
        );
      } catch (error) {
        db.prepare(`UPDATE repository_bindings SET status='local-setup-needed', last_error=?, updated_at=? WHERE project_id=?`).run(String(error.message || error), now(), projectId);
      }
      return binding(projectId);
    },
    async finishLocalSetup(projectId, initialize) {
      const repo = binding(projectId);
      if (!repo || !['remote-created', 'local-setup-needed'].includes(repo.status)) throw failure('There is no recoverable local Git setup.', 409);
      try {
        const token = await pushToken(projectId, repo.name);
        const result = initialize({ remoteUrl: repo.clone_url, login: 'the-machine[bot]', userId: config.appId, token });
        db.prepare(`UPDATE repository_bindings SET status='ready', commit_sha=?, tracked_files=?, last_error=NULL, updated_at=? WHERE project_id=?`).run(
          result.commit, result.trackedFiles, now(), projectId
        );
      } catch (error) {
        const detail = String(error.message || error);
        db.prepare(`UPDATE repository_bindings SET status='local-setup-needed', last_error=?, updated_at=? WHERE project_id=?`).run(detail, now(), projectId);
        throw failure(detail, 409);
      }
      return binding(projectId);
    },
    installationTokenForRepository: pushToken,
    // null when the project has no GitHub repository; otherwise whether the App may push workflow files to it.
    async canPushWorkflows(projectId) {
      const repo = binding(projectId);
      if (!repo?.installation_id) return null;
      return Boolean(await tryToken(projectId, { contents: 'write', workflows: 'write' }));
    },
    // A tag and a GitHub Release on the project's own repository. The commit must already be on GitHub.
    async createRelease(projectId, { tag, sha, name, body }) {
      const repo = binding(projectId);
      if (!repo || repo.status !== 'ready') throw failure('The project has no GitHub repository yet.', 409);
      const token = await scopedToken(projectId, { contents: 'write' });
      const created = await requestJson(api(repo, '/releases'), token, { method: 'POST', body: JSON.stringify({ tag_name: tag, target_commitish: sha, name, body, draft: false, prerelease: false }) }, fetcher);
      return { url: created.html_url, id: created.id };
    },
    // The CI run for a commit and its test results (the test-results artifact). Needs the Actions permission (read).
    async ciResults(projectId, sha) {
      const repo = binding(projectId);
      if (!repo || repo.status !== 'ready') return { state: 'no-github' };
      const token = await tryToken(projectId, { actions: 'read' });
      if (!token) return { state: 'no-permission' };
      const runs = await requestJson(api(repo, `/actions/runs?head_sha=${encodeURIComponent(sha)}&per_page=10`), token, {}, fetcher);
      const run = (runs.workflow_runs || []).find(entry => /(^|\/)ci\.ya?ml$/.test(entry.path || '')) || null;
      if (!run) return { state: 'no-run', sha };
      const summary = { state: run.status === 'completed' ? run.conclusion || 'completed' : 'running', url: run.html_url, sha, at: run.updated_at, tests: [] };
      if (run.status !== 'completed') return summary;
      const artifacts = await requestJson(run.artifacts_url, token, {}, fetcher);
      const artifact = (artifacts.artifacts || []).find(entry => entry.name === 'test-results' && !entry.expired);
      if (!artifact) return summary;
      const download = await fetcher(artifact.archive_download_url, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': apiVersion, 'user-agent': 'aludel-portal' } });
      if (!download.ok) return summary;
      const file = unzipFile(Buffer.from(await download.arrayBuffer()), name => name.endsWith('.xml'));
      return { ...summary, tests: file ? parseJunit(file.text) : [] };
    }
  };
}
