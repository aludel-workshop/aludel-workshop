// W-33 (MULTI-REPO-ITEMS-01): the repositories a project owns. The primary is the project's repository binding; companions
// sit beside its checkout at their own path. Kept in portal settings (owner, Q1), never in a repository file.
//
// Each repository has:
// - lines: the long-lived branches items may change, the first being its default;
// - references: files in it that name commits on another repository's lines (Aludel's template pins), which close-out checks;
// - checks: commands close-out runs over the merged set in a sealed container (Q2).
// The host keeps an access state per repository from its last check; no URL here ever carries a credential.
import { tmpdir } from 'node:os';
import { gitWithToken } from './git-repository.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const keyPattern = /^[a-z0-9][a-z0-9-]{0,39}$/;
// A git branch name, without the forms git refuses (`..`, `@{`, a trailing `.lock` or slash, and so on).
const lineName = value => /^[A-Za-z0-9._/-]{1,100}$/.test(value) && !/\.\.|\/\/|^[/.]|[/.]$|\.lock$|@\{/.test(value);
const filePath = value => /^[^\0]{1,400}$/.test(value) && !value.startsWith('/') && !value.split('/').some(part => part === '..' || part === '' || part === '.git');

export function initProjectRepositories(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS project_repositories (
    project_id TEXT NOT NULL, key TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0, url TEXT, path TEXT NOT NULL,
    lines_json TEXT NOT NULL DEFAULT '[]', references_json TEXT NOT NULL DEFAULT '[]', checks_json TEXT NOT NULL DEFAULT '[]',
    access TEXT NOT NULL DEFAULT 'unchecked', access_detail TEXT, checked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(project_id, key))`);
}

// The owner and name of a GitHub https URL, for the installation token; null for any other remote.
export function githubName(url) {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url || '');
  return match ? { owner: match[1], name: match[2] } : null;
}

export function projectRepositories({ db, tokenFor = null }) {
  const binding = projectId => {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'repository_bindings'").get()) return null;
    return db.prepare('SELECT owner, name, clone_url, default_branch, status, last_error FROM repository_bindings WHERE project_id = ?').get(projectId) || null;
  };
  const primaryKey = projectId => (binding(projectId)?.name || 'app').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40);
  const rows = projectId => db.prepare('SELECT * FROM project_repositories WHERE project_id = ? ORDER BY is_primary DESC, key').all(projectId);
  const shape = row => ({ key: row.key, primary: Boolean(row.is_primary), url: row.url, path: row.path, lines: JSON.parse(row.lines_json),
    references: JSON.parse(row.references_json), checks: JSON.parse(row.checks_json),
    access: { state: row.access, detail: row.access_detail || null, checkedAt: row.checked_at || null } });

  // The primary always comes first. Its URL and default line follow the binding; its references and checks are its own row's.
  function list(projectId) {
    const bound = binding(projectId), key = primaryKey(projectId);
    const own = rows(projectId);
    const stored = own.find(row => row.is_primary);
    const primary = {
      key, primary: true, url: bound?.clone_url || null, path: '.', lines: [bound?.default_branch || 'main'],
      references: stored ? JSON.parse(stored.references_json) : [], checks: stored ? JSON.parse(stored.checks_json) : [],
      access: bound ? { state: bound.status === 'ready' ? 'ready' : 'no-access', detail: bound.status === 'ready' ? null : bound.last_error || bound.status, checkedAt: null }
        : { state: 'local', detail: 'The project has no GitHub repository yet.', checkedAt: null }
    };
    return [primary, ...own.filter(row => !row.is_primary).map(shape)];
  }
  const get = (projectId, key) => list(projectId).find(repo => repo.key === key) || null;

  function validReferences(value, keys) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 20) fail('References are a list of up to 20.');
    return value.map(entry => {
      const file = String(entry?.file || '').trim(), repository = String(entry?.repository || '').trim(), at = String(entry?.at || '').trim();
      if (!filePath(file)) fail('A reference names a file in the repository, by its path.');
      if (!keys.has(repository)) fail(`A reference names a repository of this project; ${repository || 'none'} isn't one.`);
      // A dotted path to the entries, with * for every key at that level; each entry has a branch and a commit.
      if (!/^[A-Za-z0-9_*-]+(\.[A-Za-z0-9_*-]+)*$/.test(at)) fail('Say where the references are in the file, such as templates.*');
      return { file, repository, at };
    });
  }
  function validChecks(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 10) fail('Checks are a list of up to 10.');
    return value.map(entry => {
      const name = String(entry?.name || '').trim(), run = String(entry?.run || '').trim();
      if (!name || name.length > 80) fail('Name each check.');
      if (!run || run.length > 400 || /[\r\n]/.test(run)) fail('Give each check one command line.');
      return { name, run };
    });
  }

  // Adds or changes a repository. The primary takes only references and checks; its URL and line follow the binding.
  function save(projectId, input = {}) {
    const key = String(input.key || '').trim().toLowerCase();
    const current = list(projectId), primary = current[0];
    const keys = new Set([...current.map(repo => repo.key), key]);
    const at = now();
    if (key === primary.key) {
      const references = validReferences(input.references, keys), checks = validChecks(input.checks);
      db.prepare(`INSERT INTO project_repositories(project_id, key, is_primary, url, path, lines_json, references_json, checks_json, created_at, updated_at)
        VALUES (?, ?, 1, NULL, '.', '[]', ?, ?, ?, ?) ON CONFLICT(project_id, key) DO UPDATE SET references_json = excluded.references_json,
        checks_json = excluded.checks_json, updated_at = excluded.updated_at`).run(projectId, key, JSON.stringify(references), JSON.stringify(checks), at, at);
      return get(projectId, key);
    }
    if (!keyPattern.test(key)) fail('Name the repository in lowercase letters, digits and dashes.');
    const url = String(input.url || '').trim();
    if (!/^(https:\/\/|file:\/\/|\/)/.test(url) || url.length > 400) fail('Give the repository’s https clone URL.');
    if (/^https:\/\/[^/]*@/.test(url)) fail('Leave credentials out of the URL; Aludel and each person bring their own.');
    const path = String(input.path || key).trim().replace(/\/+$/, '');
    if (!filePath(path) || path === '.') fail('Say where it sits beside the project’s checkout, as a folder such as layer-base.');
    if (current.some(repo => repo.key !== key && !repo.primary && (repo.path === path || path.startsWith(repo.path + '/') || repo.path.startsWith(path + '/'))))
      fail(`Another repository already sits at ${path}.`);
    const lines = (Array.isArray(input.lines) ? input.lines : [input.lines]).map(value => String(value || '').trim()).filter(Boolean);
    if (!lines.length) fail('Name at least its default branch.');
    if (lines.length > 40) fail('Up to 40 branches.');
    const bad = lines.find(line => !lineName(line));
    if (bad) fail(`${bad} isn't a branch name git accepts.`);
    if (new Set(lines).size !== lines.length) fail('Name each branch once.');
    const references = validReferences(input.references, keys), checks = validChecks(input.checks);
    const existing = current.find(repo => repo.key === key);
    // A changed URL or set of lines needs checking again.
    const recheck = !existing || existing.url !== url || JSON.stringify(existing.lines) !== JSON.stringify(lines);
    db.prepare(`INSERT INTO project_repositories(project_id, key, is_primary, url, path, lines_json, references_json, checks_json, access, created_at, updated_at)
      VALUES (?, ?, 0, ?, ?, ?, ?, ?, 'unchecked', ?, ?) ON CONFLICT(project_id, key) DO UPDATE SET url = excluded.url, path = excluded.path,
      lines_json = excluded.lines_json, references_json = excluded.references_json, checks_json = excluded.checks_json,
      access = CASE WHEN ? THEN 'unchecked' ELSE project_repositories.access END,
      access_detail = CASE WHEN ? THEN NULL ELSE project_repositories.access_detail END, updated_at = excluded.updated_at`)
      .run(projectId, key, url, path, JSON.stringify(lines), JSON.stringify(references), JSON.stringify(checks), at, at, recheck ? 1 : 0, recheck ? 1 : 0);
    return get(projectId, key);
  }

  function remove(projectId, key) {
    const repo = get(projectId, key);
    if (!repo) fail(`${key} isn't one of this project's repositories.`, 404);
    if (repo.primary) fail('The project’s own repository stays; change it from the project’s GitHub settings.', 409);
    const user = list(projectId).find(other => other.references.some(reference => reference.repository === key));
    if (user) fail(`${user.key} has references into ${key}. Remove them first.`, 409);
    db.prepare('DELETE FROM project_repositories WHERE project_id = ? AND key = ?').run(projectId, key);
    return { removed: key };
  }

  // Whether Aludel can reach a companion with the project's installation token, and that each of its lines is there.
  async function check(projectId, key) {
    const repo = get(projectId, key);
    if (!repo) fail(`${key} isn't one of this project's repositories.`, 404);
    if (repo.primary) return repo;
    const named = githubName(repo.url);
    let token = null, state = 'ready', detail = null;
    if (named && tokenFor) {
      try { token = await tokenFor(projectId, named); }
      catch (error) { state = 'no-access'; detail = `Aludel's GitHub App can't reach ${named.owner}/${named.name}: ${String(error.message || error).slice(0, 200)}`; }
    }
    if (state === 'ready') {
      const listed = gitWithToken(tmpdir(), ['ls-remote', '--heads', repo.url], token || '');
      if (listed.status !== 0) { state = 'no-access'; detail = `Aludel couldn't read ${repo.url}: ${String(listed.stderr || '').trim().split('\n').pop().slice(0, 200)}`; }
      else {
        const heads = new Set(listed.stdout.split('\n').map(line => line.split('\t')[1]).filter(Boolean));
        const missing = repo.lines.filter(line => !heads.has(`refs/heads/${line}`));
        if (missing.length) { state = 'missing-lines'; detail = `${repo.url} has no ${missing.join(', ')}.`; }
      }
    }
    db.prepare('UPDATE project_repositories SET access = ?, access_detail = ?, checked_at = ? WHERE project_id = ? AND key = ?').run(state, detail, now(), projectId, key);
    return get(projectId, key);
  }

  return { list, get, save, remove, check };
}
