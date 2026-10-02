// T03-CODE (G-CODE): a layer instance's repository can have a remote (the owner's GitHub) that it stays in sync with.
// Built for any layer instance; Code turns it on first. The model: the remote's `main` is the shared repository, the
// instance repository is a working clone, and the instance's pin (its accepted commit) is a commit on both.
//
// - fetch: reads the remote's `main` into `refs/aludel/remote/main`. Equal: in sync. The remote ahead: fast-forward the pin
//   and re-index, unless the change touches the package's authority files (they run on the host), which holds it for review.
//   The pin ahead: push. Both moved: diverged, held for a person, never merged automatically.
// - push: sends the pin to the remote's `main`, never forced. A rejection fetches once and retries once.
// - Any failure to reach the remote (no connection, expired token, App uninstalled, repository gone) leaves the instance
//   working locally and records why. Git talks to the remote only with the token it is given (gitWithToken); tokens are
//   never stored or logged.
import { execFileSync } from 'node:child_process';
import { gitWithToken } from './git-repository.mjs';
import { packageAt, repositoryPaths } from './layer-package.mjs';
import { syncFileEntries } from './layer-files.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const git = (repo, args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
const tryGit = (repo, args) => { try { return git(repo, args); } catch { return null; } };
const remoteRef = 'refs/aludel/remote/main';
const states = ['in-sync', 'ahead', 'behind', 'held', 'diverged', 'unavailable', 'unknown'];
// What git said, without anything that could carry a credential.
const clean = text => String(text || '').replace(/(https?:\/\/)[^@/\s]+@/g, '$1').replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[token]').split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300);

export function initLayerRemotes(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_remotes (project_id TEXT NOT NULL, layer_instance_id TEXT NOT NULL, provider TEXT NOT NULL, owner TEXT NOT NULL,
    name TEXT NOT NULL, clone_url TEXT NOT NULL, html_url TEXT, source TEXT NOT NULL, state TEXT NOT NULL, remote_commit TEXT, held_commit TEXT, detail TEXT,
    fetched_at TEXT, pushed_at TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(project_id, layer_instance_id))`);
}

// tokenFor(projectId, remote) → a short-lived token, or throws { code, message } (not-connected, expired, uninstalled, gone).
// onAdvance(projectId, key, { from, to }) after the pin moves to the remote's commit; onHeld / onDiverged raise Work.
export function layerRemotes({ db, tokenFor, onAdvance = () => {}, onHeld = () => {}, onDiverged = () => {} }) {
  const bound = (projectId, key) => db.prepare(`SELECT b.repository_path AS repo, b.accepted_commit AS pin, i.instance_id AS instanceId FROM layer_package_bindings b
    JOIN layer_instances i ON i.project_id = b.project_id AND i.instance_id = b.layer_instance_id AND i.layer_key = b.layer_key WHERE b.project_id = ? AND b.layer_key = ?`).get(projectId, key)
    || fail('This layer has no installed repository.', 409);
  const row = (projectId, instanceId) => db.prepare('SELECT * FROM layer_remotes WHERE project_id = ? AND layer_instance_id = ?').get(projectId, instanceId);
  const view = remote => remote && { provider: remote.provider, owner: remote.owner, name: remote.name, url: remote.html_url, source: remote.source, state: remote.state,
    remoteCommit: remote.remote_commit, heldCommit: remote.held_commit, detail: remote.detail, fetchedAt: remote.fetched_at, pushedAt: remote.pushed_at };
  const record = (projectId, instanceId, fields) => {
    if (fields.state && !states.includes(fields.state)) fail('Unknown sync state.', 500);
    const sets = Object.keys(fields).map(name => `${name} = ?`).join(', ');
    db.prepare(`UPDATE layer_remotes SET ${sets}, updated_at = ? WHERE project_id = ? AND layer_instance_id = ?`).run(...Object.values(fields), now(), projectId, instanceId);
    return view(row(projectId, instanceId));
  };

  // Names the remote for a layer instance. `source` says where it came from (for Code, the project's repository binding).
  function connect(projectId, key, { provider = 'github', owner, name, cloneUrl, htmlUrl = null, source = 'layer' }) {
    const { instanceId } = bound(projectId, key);
    if (![owner, name, cloneUrl].every(value => typeof value === 'string' && value.trim()) || !/^(?:https?|file):\/\//.test(cloneUrl) || /@/.test(cloneUrl.replace(/^file:\/\//, '')))
      fail('A remote needs an owner, a name and a clone URL without credentials.');
    db.prepare(`INSERT INTO layer_remotes(project_id, layer_instance_id, provider, owner, name, clone_url, html_url, source, state, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unknown', ?)
      ON CONFLICT(project_id, layer_instance_id) DO UPDATE SET provider = excluded.provider, owner = excluded.owner, name = excluded.name, clone_url = excluded.clone_url,
        html_url = excluded.html_url, source = excluded.source, updated_at = excluded.updated_at`).run(projectId, instanceId, provider, owner, name, cloneUrl, htmlUrl, source, now());
    return view(row(projectId, instanceId));
  }
  function status(projectId, key) { const { instanceId } = bound(projectId, key); return view(row(projectId, instanceId)) || null; }

  async function token(projectId, remote) {
    try { return { token: await tokenFor(projectId, view(remote)) }; }
    catch (error) { return { error: error.code || 'unavailable', detail: clean(error.message) || 'GitHub is not reachable.' }; }
  }

  // Reads the remote's main and settles the pin against it.
  async function fetch(projectId, key) {
    const { repo, pin, instanceId } = bound(projectId, key);
    const remote = row(projectId, instanceId) || fail('This layer has no remote.', 409);
    const auth = await token(projectId, remote);
    if (auth.error) return record(projectId, instanceId, { state: 'unavailable', detail: `${auth.error}: ${auth.detail}` });
    const fetched = gitWithToken(repo, ['fetch', '--quiet', '--no-tags', remote.clone_url, `+refs/heads/main:${remoteRef}`], auth.token);
    if (fetched.status !== 0) return record(projectId, instanceId, { state: 'unavailable', detail: `fetch failed: ${clean(fetched.stderr)}` });
    const theirs = git(repo, ['rev-parse', remoteRef]);
    const fields = { remote_commit: theirs, fetched_at: now() };
    if (theirs === pin) return record(projectId, instanceId, { ...fields, state: 'in-sync', held_commit: null, detail: null });
    const ancestor = (a, b) => tryGit(repo, ['merge-base', '--is-ancestor', a, b]) !== null;
    if (ancestor(theirs, pin)) return record(projectId, instanceId, { ...fields, state: 'ahead', detail: null });
    if (!ancestor(pin, theirs)) {
      if (remote.state !== 'diverged' || remote.remote_commit !== theirs) onDiverged(projectId, key, { pin, remote: theirs });
      return record(projectId, instanceId, { ...fields, state: 'diverged', detail: 'Both this copy and GitHub changed. A person rebases or merges them in a run.' });
    }
    return advance(projectId, key, { repo, pin, instanceId, theirs, fields, remote });
  }

  // The remote is ahead: take it, unless it changes what runs on the host.
  function advance(projectId, key, { repo, pin, instanceId, theirs, fields, remote }) {
    let pkg;
    try { pkg = packageAt(repo, theirs, key); } catch (error) { return record(projectId, instanceId, { ...fields, state: 'held', held_commit: theirs, detail: `GitHub's main is not a valid layer: ${clean(error.message)}` }); }
    const paths = repositoryPaths(packageAt(repo, pin, key));
    const authority = git(repo, ['diff', '--name-only', '--no-renames', pin, theirs]).split('\n').filter(Boolean).filter(path => paths.authority(path) || repositoryPaths(pkg).authority(path));
    if (authority.length) {
      if (remote.held_commit !== theirs) onHeld(projectId, key, { from: pin, to: theirs, paths: authority });
      return record(projectId, instanceId, { ...fields, state: 'held', held_commit: theirs, detail: `GitHub's main changes what this layer runs (${authority.slice(0, 3).join(', ')}${authority.length > 3 ? ', …' : ''}). A person reviews it first.` });
    }
    return take(projectId, key, { repo, pin, instanceId, theirs, fields });
  }
  function take(projectId, key, { repo, pin, instanceId, theirs, fields }) {
    if (git(repo, ['rev-parse', 'refs/heads/main']) !== pin) return record(projectId, instanceId, { ...fields, state: 'behind', detail: 'The repository\'s main is not at its pin; reconcile it first.' });
    if (git(repo, ['status', '--porcelain', '--untracked-files=no'])) return record(projectId, instanceId, { ...fields, state: 'behind', detail: 'This copy has uncommitted changes, so it waits.' });
    const checkedOut = tryGit(repo, ['symbolic-ref', '--quiet', 'HEAD']) === 'refs/heads/main';
    if (checkedOut) git(repo, ['merge', '--ff-only', '--quiet', theirs]); else git(repo, ['update-ref', 'refs/heads/main', theirs, pin]);
    db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ?').run(theirs, projectId, key);
    if (packageAt(repo, theirs, key).manifest.files) syncFileEntries(db, projectId, key, { author: 'GitHub', rationale: `Synced from GitHub ${theirs.slice(0, 7)}` });
    onAdvance(projectId, key, { from: pin, to: theirs });
    return record(projectId, instanceId, { ...fields, state: 'in-sync', held_commit: null, detail: null });
  }

  // A person accepts a held change: the pin takes it, and the handler bytes it brings are recorded as reviewed.
  async function acceptHeld(projectId, key, reviewer, { review = () => {} } = {}) {
    const { repo, pin, instanceId } = bound(projectId, key);
    const remote = row(projectId, instanceId);
    if (remote?.state !== 'held' || !remote.held_commit) fail('Nothing is waiting for review.', 409);
    review(repo, remote.held_commit, reviewer);
    return take(projectId, key, { repo, pin, instanceId, theirs: remote.held_commit, fields: {} });
  }

  // Sends the pin to the remote's main. If GitHub moved meanwhile, fetch once and try once more.
  async function push(projectId, key, { retried = false } = {}) {
    const { repo, pin, instanceId } = bound(projectId, key);
    const remote = row(projectId, instanceId) || fail('This layer has no remote.', 409);
    const auth = await token(projectId, remote);
    if (auth.error) return record(projectId, instanceId, { state: 'unavailable', detail: `${auth.error}: ${auth.detail}` });
    const pushed = gitWithToken(repo, ['push', '--quiet', '--porcelain', remote.clone_url, `${pin}:refs/heads/main`], auth.token);
    if (pushed.status === 0) {
      git(repo, ['update-ref', remoteRef, pin]);
      return record(projectId, instanceId, { state: 'in-sync', remote_commit: pin, pushed_at: now(), held_commit: null, detail: null });
    }
    const rejected = /rejected|non-fast-forward|fetch first/i.test(`${pushed.stdout}${pushed.stderr}`);
    if (!rejected) return record(projectId, instanceId, { state: 'unavailable', detail: `push failed: ${clean(pushed.stderr || pushed.stdout)}` });
    const settled = await fetch(projectId, key);
    return settled.state === 'ahead' && !retried ? push(projectId, key, { retried: true }) : settled;
  }

  // Fetch, then push what this copy has that GitHub doesn't.
  async function sync(projectId, key) {
    const fetched = await fetch(projectId, key);
    return fetched.state === 'ahead' ? push(projectId, key) : fetched;
  }
  return { connect, status, fetch, push, sync, acceptHeld };
}
