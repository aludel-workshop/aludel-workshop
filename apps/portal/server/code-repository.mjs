// T03-CODE: the host side of a layer whose repository is the project's own codebase (a template with
// `install: "project-repository"`; Aludel's is Code). The layer is found by that manifest declaration, never by its key.
//
// - The pin follows the repository: a build's commit on the local main, or GitHub's main through layer-remote.mjs.
// - The code-unit table is the host's cache of the units the host parsed at the pin.
// - Releases are kept in .aludel/outputs/releases.json; what changed between releases is derived at their commits, and the
//   GitHub Release a release was published as is host state.
// - Existing projects adopt: their releases move into the file once, with their IDs.
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { currentFileEntries, seedRepositoryDocs, syncFileEntries, writeFileEntries } from './layer-files.mjs';
import { layerPackageForProject, packageAt, repositoryPaths } from './layer-package.mjs';
import { releaseChanges } from './code-layer.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const semver = /^(\d+)\.(\d+)\.(\d+)$/;
const compare = (a, b) => { const x = semver.exec(a).slice(1).map(Number), y = semver.exec(b).slice(1).map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const git = (repo, args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
const tryGit = (repo, args) => { try { return git(repo, args); } catch { return null; } };

export function initCodeRepository(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS code_release_publications (project_id TEXT NOT NULL, version TEXT NOT NULL, url TEXT NOT NULL, published_at TEXT NOT NULL,
    PRIMARY KEY(project_id, version))`);
}

export function codeRepository({ db, units }) {
  // The installed layer whose repository is the project's, with its package at the pin; null when there is none.
  function layer(projectId) {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_package_bindings'").get()) return null;
    for (const row of db.prepare(`SELECT b.layer_key AS key FROM layer_package_bindings b JOIN layer_instances i ON i.project_id = b.project_id
        AND i.instance_id = b.layer_instance_id AND i.layer_key = b.layer_key WHERE b.project_id = ? AND i.enabled = 1`).all(projectId)) {
      let pkg = null;
      try { pkg = layerPackageForProject(db, projectId, row.key); } catch { continue; }
      if (pkg?.manifest.install === 'project-repository') return { key: row.key, ...pkg };
    }
    return null;
  }
  const entries = (projectId, code, kind) => currentFileEntries(db, projectId, code.key).filter(entry => entry.kind === kind);

  // Rebuilds the code-unit cache from the layer's entries at its pin.
  function refresh(projectId) {
    const code = layer(projectId);
    if (!code) return null;
    return units.index(projectId, code.repo, { units: entries(projectId, code, 'code_unit').map(entry => ({ ...entry.data })) });
  }

  // The pin follows a newer local main (a build's commit), unless that changes what the layer runs on the host.
  function settleLocal(projectId) {
    const code = layer(projectId);
    if (!code) return null;
    const main = tryGit(code.repo, ['rev-parse', 'refs/heads/main']);
    if (!main || main === code.commit) return { key: code.key, commit: code.commit, moved: false };
    if (tryGit(code.repo, ['merge-base', '--is-ancestor', code.commit, main]) === null) return { key: code.key, commit: code.commit, moved: false, detail: 'The repository\'s main no longer contains the layer\'s pin.' };
    let next;
    try { next = packageAt(code.repo, main, code.key); } catch (error) { return { key: code.key, commit: code.commit, moved: false, detail: `The repository's main is not a valid layer: ${error.message}` }; }
    const paths = repositoryPaths(code);
    const authority = git(code.repo, ['diff', '--name-only', '--no-renames', code.commit, main]).split('\n').filter(Boolean).filter(path => paths.authority(path) || repositoryPaths(next).authority(path));
    if (authority.length) return { key: code.key, commit: code.commit, moved: false, detail: `A commit changes what this layer runs (${authority.join(', ')}); a person reviews it first.` };
    db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ? AND accepted_commit = ?').run(main, projectId, code.key, code.commit);
    syncFileEntries(db, projectId, code.key, { author: 'Aludel', rationale: `The repository moved to ${main.slice(0, 7)}` });
    refresh(projectId);
    return { key: code.key, commit: main, moved: true };
  }

  // Releases, newest first, with what changed since the one before, derived at their commits.
  function releases(projectId) {
    const code = layer(projectId);
    if (!code) return null;
    const published = new Map(db.prepare('SELECT version, url, published_at FROM code_release_publications WHERE project_id = ?').all(projectId).map(row => [row.version, row]));
    const list = entries(projectId, code, 'code_release').map(entry => ({ id: entry.id, ...entry.data })).sort((a, b) => compare(b.version, a.version));
    return list.map((release, index) => {
      const previous = list[index + 1];
      const derived = (() => { try { return releaseChanges(code.repo, previous?.commit || null, release.commit); } catch { return { stack: {}, changes: [], migrations: [] }; } })();
      const publication = published.get(release.version);
      return { id: release.id, version: release.version, commit: release.commit, notes: release.notes, stories: [], createdBy: release.createdBy, createdAt: release.createdAt,
        stack: derived.stack, changes: derived.changes, migrations: derived.migrations, publishedAt: publication?.published_at || null, url: publication?.url || null };
    });
  }
  // Records a release: one commit to releases.json through the layer's rules, and a local tag vX.Y.Z on its commit.
  function recordRelease(projectId, draft, { version, notes }, author) {
    const code = layer(projectId) || fail('This project has no code layer.', 409);
    const value = String(version || '').trim().replace(/^v/, '');
    if (!semver.test(value)) fail('Use a version like 1.2.3.');
    if (!draft) fail('There is no repository to release from yet.', 409);
    const last = releases(projectId)[0];
    if (last && compare(value, last.version) <= 0) fail(`The version must be newer than v${last.version}.`);
    if (last && !draft.commits.length) fail(`Nothing has changed since v${last.version}.`, 409);
    const id = `crl-${randomBytes(4).toString('hex')}`;
    writeFileEntries(db, { projectId, key: code.key, author, rationale: `Release v${value}`, ops: [{ op: 'create', kind: 'code_release', id,
      data: { version: value, commit: draft.head, notes: String(notes || '').slice(0, 4000), createdBy: author, createdAt: now() } }] });
    const sha = git(code.repo, ['rev-parse', '--verify', `${draft.head}^{commit}`]);
    if (tryGit(code.repo, ['rev-parse', '--verify', `refs/tags/v${value}`]) === null)
      git(code.repo, ['tag', '-a', `v${value}`, sha, '-m', `v${value}`], { env: { ...process.env, GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' } });
    return releases(projectId).find(release => release.id === id);
  }
  function markPublished(projectId, version, url) {
    db.prepare('INSERT INTO code_release_publications(project_id, version, url, published_at) VALUES (?, ?, ?, ?) ON CONFLICT(project_id, version) DO UPDATE SET url = excluded.url, published_at = excluded.published_at')
      .run(projectId, version, url, now());
    return releases(projectId).find(release => release.version === version);
  }

  // Existing projects: releases kept in host tables move into the layer's file once, as one commit, keeping their IDs,
  // commits and publication state.
  function adopt(projectId) {
    const code = layer(projectId);
    if (!code) return null;
    const has = table => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    const kept = new Set(currentFileEntries(db, projectId, code.key).map(entry => entry.id));
    const ops = [];
    if (has('code_releases')) {
      for (const row of db.prepare('SELECT * FROM code_releases WHERE project_id = ? ORDER BY created_at').all(projectId)) {
        if (!kept.has(row.id)) ops.push({ op: 'create', kind: 'code_release', id: row.id, data: { version: row.version, commit: row.commit_sha, notes: row.notes,
          createdBy: row.created_by, createdAt: row.created_at } });
        if (row.published_at && row.url) db.prepare('INSERT OR IGNORE INTO code_release_publications(project_id, version, url, published_at) VALUES (?, ?, ?, ?)').run(projectId, row.version, row.url, row.published_at);
      }
    }
    if (ops.length) writeFileEntries(db, { projectId, key: code.key, ops, author: 'Aludel', rationale: `Adopt ${ops.length} releases into the repository` });
    refresh(projectId);
    return { adopted: ops.length };
  }

  // The layer's install seed (its starter docs), once, from the other layers' Library entries. `outputEntries` is the
  // Library's (library.mjs), so the layer reads only what is published there.
  function seed(projectId, outputEntries) {
    const code = layer(projectId);
    if (!code) return null;
    const project = db.prepare('SELECT name, description FROM projects WHERE id = ?').get(projectId) || {};
    let stack = null;
    try { const pkg = JSON.parse(git(code.repo, ['show', `${code.commit}:package.json`])); stack = { dependencies: pkg.dependencies || {}, devDependencies: pkg.devDependencies || {} }; } catch { /* no manifest yet */ }
    const entries = outputEntries(projectId).filter(entry => entry.layer.key !== code.key).map(entry => ({ ref: entry.ref, kind: entry.kind, revision: entry.revision, title: entry.title, data: entry.data }));
    const result = seedRepositoryDocs(db, { projectId, key: code.key, context: { project: { name: project.name, description: project.description }, entries, stack } });
    if (result.written.length) refresh(projectId);
    return result;
  }

  return { layer, refresh, settleLocal, releases, recordRelease, markPublished, adopt, seed };
}

// The Code repository's remote is the project's GitHub repository: the existing repository binding, not a second one.
// Tokens come from the GitHub integration, fresh for each fetch or push; a failure becomes a state the layer shows.
export const githubTokenFor = github => async (projectId, remote) => {
  try { return await github.installationTokenForRepository(projectId, remote.name); }
  catch (error) { throw Object.assign(error, { code: error.status === 409 ? 'not-connected' : error.status === 401 ? 'expired' : error.status === 404 ? 'uninstalled' : 'unavailable' }); }
};
export function codeSync({ db, codeRepo, remotes }) {
  function connect(projectId) {
    const code = codeRepo.layer(projectId);
    const repo = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'repository_bindings'").get()
      && db.prepare('SELECT owner, name, clone_url, html_url, status FROM repository_bindings WHERE project_id = ?').get(projectId);
    if (!code || repo?.status !== 'ready') return null;
    if (!remotes.status(projectId, code.key)) remotes.connect(projectId, code.key, { owner: repo.owner, name: repo.name, cloneUrl: repo.clone_url, htmlUrl: repo.html_url, source: 'project-repository' });
    return code;
  }
  // A newer local main first (a build's commit), then GitHub.
  async function sync(projectId) {
    const local = codeRepo.settleLocal(projectId);
    const code = connect(projectId);
    const remote = code ? await remotes.sync(projectId, code.key) : null;
    return { local, remote };
  }
  return { connect, sync };
}
