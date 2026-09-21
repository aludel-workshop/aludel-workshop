import { createHash, randomBytes } from 'node:crypto';
import { mintInstallationToken as mintToken } from './github-app-auth.mjs';

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

export function githubIntegration({ db, secrets, config, callbackUrl, setupUrl, fetcher = fetch, mintInstallationToken = mintToken }) {
  const user = projectId => db.prepare('SELECT * FROM github_users WHERE project_id = ?').get(projectId);
  const binding = projectId => db.prepare(`SELECT provider, owner, name, html_url, clone_url, default_branch, private,
    status, commit_sha, tracked_files, last_error, installation_id, account_type FROM repository_bindings WHERE project_id = ?`).get(projectId) || null;
  const installations = projectId => db.prepare(`SELECT installation_id, account_login, account_id, target_type,
    repository_selection, permissions_json, status FROM github_installations WHERE project_id = ? ORDER BY account_login`).all(projectId)
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
    db.prepare(`UPDATE github_users SET access_token_encrypted = ?, refresh_token_encrypted = ?, token_expires_at = ?,
      refresh_token_expires_at = ?, updated_at = ? WHERE project_id = ?`).run(
      secrets.seal(value.access_token), value.refresh_token ? secrets.seal(value.refresh_token) : null,
      value.expires_in ? new Date(refreshedAt + value.expires_in * 1000).toISOString() : null,
      value.refresh_token_expires_in ? new Date(refreshedAt + value.refresh_token_expires_in * 1000).toISOString() : null,
      now(), row.project_id
    );
    return value.access_token;
  }

  async function syncInstallations(projectId, token) {
    const value = await requestJson('https://api.github.com/user/installations?per_page=100', token, {}, fetcher);
    const seen = [];
    db.exec('BEGIN');
    try {
      const items = value.installations || [];
      for (const item of items) {
        seen.push(Number(item.id));
        db.prepare(`INSERT INTO github_installations(project_id, installation_id, account_login, account_id, target_type,
          repository_selection, permissions_json, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, installation_id) DO UPDATE SET account_login=excluded.account_login,
          account_id=excluded.account_id, target_type=excluded.target_type, repository_selection=excluded.repository_selection,
          permissions_json=excluded.permissions_json, status=excluded.status, updated_at=excluded.updated_at`).run(
          projectId, item.id, item.account.login, String(item.account.id), item.target_type,
          item.repository_selection, JSON.stringify(item.permissions || {}), item.suspended_at ? 'suspended' : 'active', now()
        );
      }
      if (seen.length) db.prepare(`DELETE FROM github_installations WHERE project_id = ? AND installation_id NOT IN (${seen.map(() => '?').join(',')})`).run(projectId, ...seen);
      else db.prepare('DELETE FROM github_installations WHERE project_id = ?').run(projectId);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return installations(projectId);
  }

  async function installationToken(installationId, options) {
    const minted = await mintInstallationToken(config, installationId, options, fetcher);
    return minted.token;
  }

  async function pushToken(projectId, repositoryName) {
    const repo = binding(projectId);
    if (!repo?.installation_id) throw failure('The project has no GitHub installation binding.', 409);
    return installationToken(repo.installation_id, { permissions: { contents: 'write' }, repositories: [repositoryName || repo.name] });
  }

  return {
    status(projectId, local) {
      const row = user(projectId);
      return {
        provider: 'github', configured: config.configured, configurationIssues: config.issues,
        appSlug: config.configured ? config.appSlug : null,
        callbackUrl, setupUrl,
        connected: Boolean(row?.access_token_encrypted && row?.login), login: row?.login || null,
        permissions: 'Administration and Contents: read/write', installations: installations(projectId),
        repository: binding(projectId), local
      };
    },
    startAuthorization(projectId) {
      if (!config.configured) throw failure('The vendor GitHub App is not configured.', 503);
      const state = randomBytes(32).toString('base64url');
      const verifier = randomBytes(64).toString('base64url');
      db.prepare(`INSERT INTO github_users(project_id, oauth_state_hash, oauth_state_expires_at,
        oauth_code_verifier_encrypted, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET oauth_state_hash=excluded.oauth_state_hash,
        oauth_state_expires_at=excluded.oauth_state_expires_at,
        oauth_code_verifier_encrypted=excluded.oauth_code_verifier_encrypted, updated_at=excluded.updated_at`).run(
        projectId, digest(state), new Date(Date.now() + 10 * 60_000).toISOString(), secrets.seal(verifier), now()
      );
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', config.clientId); url.searchParams.set('redirect_uri', callbackUrl);
      url.searchParams.set('state', state); url.searchParams.set('code_challenge', challenge(verifier));
      url.searchParams.set('code_challenge_method', 'S256'); url.searchParams.set('prompt', 'select_account');
      return url.toString();
    },
    async callback({ code, state }) {
      const row = db.prepare('SELECT * FROM github_users WHERE oauth_state_hash = ?').get(digest(String(state || '')));
      if (!row || !code || row.oauth_state_expires_at < now() || !row.oauth_code_verifier_encrypted) throw failure('The GitHub authorization is invalid or expired.');
      const verifier = secrets.open(row.oauth_code_verifier_encrypted);
      db.prepare(`UPDATE github_users SET oauth_state_hash=NULL, oauth_state_expires_at=NULL,
        oauth_code_verifier_encrypted=NULL WHERE project_id=?`).run(row.project_id);
      const response = await fetcher('https://github.com/login/oauth/access_token', {
        method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret,
          code, redirect_uri: callbackUrl, code_verifier: verifier })
      });
      const token = await response.json();
      if (!response.ok || !token.access_token) throw failure(token.error_description || 'GitHub authorization failed.', 502);
      const profile = await requestJson('https://api.github.com/user', token.access_token, {}, fetcher);
      const issuedAt = Date.now();
      db.prepare(`UPDATE github_users SET access_token_encrypted=?, refresh_token_encrypted=?, token_expires_at=?,
        refresh_token_expires_at=?, login=?, user_id=?, connected_at=?, updated_at=? WHERE project_id=?`).run(
        secrets.seal(token.access_token), token.refresh_token ? secrets.seal(token.refresh_token) : null,
        token.expires_in ? new Date(issuedAt + token.expires_in * 1000).toISOString() : null,
        token.refresh_token_expires_in ? new Date(issuedAt + token.refresh_token_expires_in * 1000).toISOString() : null,
        profile.login, String(profile.id), now(), now(), row.project_id
      );
      await syncInstallations(row.project_id, token.access_token);
      return row.project_id;
    },
    startInstallation(projectId) {
      if (!config.configured || !user(projectId)?.access_token_encrypted) throw failure('Authorize GitHub before installing the app.');
      const state = randomBytes(32).toString('base64url');
      db.prepare('UPDATE github_users SET install_state_hash=?, install_state_expires_at=?, updated_at=? WHERE project_id=?').run(
        digest(state), new Date(Date.now() + 10 * 60_000).toISOString(), now(), projectId
      );
      return `https://github.com/apps/${config.appSlug}/installations/new?state=${encodeURIComponent(state)}`;
    },
    async installed({ installationId, state }) {
      const row = db.prepare('SELECT * FROM github_users WHERE install_state_hash = ?').get(digest(String(state || '')));
      if (!row || row.install_state_expires_at < now() || !installationId) throw failure('The GitHub installation return is invalid or expired.');
      db.prepare('UPDATE github_users SET install_state_hash=NULL, install_state_expires_at=NULL WHERE project_id=?').run(row.project_id);
      const token = await usableUserToken(row);
      const items = await syncInstallations(row.project_id, token);
      if (!items.some(item => Number(item.installation_id) === Number(installationId))) throw failure('GitHub did not confirm that installation for this owner.', 403);
      return row.project_id;
    },
    async refreshInstallations(projectId) {
      return syncInstallations(projectId, await usableUserToken(user(projectId)));
    },
    async createRepository(projectId, { installationId, name, description, private: isPrivate }, initialize) {
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(String(name || ''))) throw failure('Use a valid GitHub repository name.');
      if (binding(projectId)) throw failure('This project already has a repository binding.', 409);
      const installation = installations(projectId).find(item => Number(item.installation_id) === Number(installationId));
      if (!installation || !installation.eligible) throw failure('Choose an active all-repositories installation with Administration and Contents write permissions.', 409);
      let createToken; let path;
      if (installation.target_type === 'Organization') {
        createToken = await installationToken(installation.installation_id, { permissions: { administration: 'write', contents: 'write' } });
        path = `/orgs/${encodeURIComponent(installation.account_login)}/repos`;
      } else if (installation.target_type === 'User') {
        createToken = await usableUserToken(user(projectId));
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
    installationTokenForRepository: pushToken
  };
}
