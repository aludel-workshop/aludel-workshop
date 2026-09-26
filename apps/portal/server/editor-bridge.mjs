import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getUser, requireMember } from './accounts.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const tools = ['assigned_tasks', 'task_context', 'saved_context', 'read_record', 'search_knowledge', 'environment_status'];

export function initEditorBridge(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS editor_tokens (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT NOT NULL REFERENCES projects(id), created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_editor_tokens_owner ON editor_tokens(user_id, project_id);
    CREATE TABLE IF NOT EXISTS editor_contexts (
      digest TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
      work_id TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
}

export function editorBridge({ db, know, projectSetup, previewStatus }) {
  const project = projectId => db.prepare('SELECT id, slug, name, description FROM projects WHERE id = ?').get(projectId);
  const tokenRow = (user, projectId) => db.prepare('SELECT created_at, expires_at FROM editor_tokens WHERE user_id = ? AND project_id = ?').get(user.id, projectId);
  function issue(user, projectId) {
    requireMember(db, user, projectId);
    const token = randomBytes(32).toString('base64url');
    const created = now();
    const expires = new Date(Date.now() + 30 * 86400_000).toISOString();
    db.prepare('DELETE FROM editor_tokens WHERE user_id = ? AND project_id = ?').run(user.id, projectId);
    db.prepare('INSERT INTO editor_tokens VALUES (?, ?, ?, ?, ?)').run(sha(token), user.id, projectId, created, expires);
    return { token, expiresAt: expires, project: project(projectId), tools };
  }
  function revoke(user, projectId) {
    requireMember(db, user, projectId);
    db.prepare('DELETE FROM editor_tokens WHERE user_id = ? AND project_id = ?').run(user.id, projectId);
    return { connected: false };
  }
  function status(user, projectId) {
    requireMember(db, user, projectId);
    const row = tokenRow(user, projectId);
    return { connected: Boolean(row && row.expires_at > now()), expiresAt: row?.expires_at || null, tools };
  }
  function authenticate(header) {
    const match = /^Bearer ([A-Za-z0-9_-]{40,})$/.exec(String(header || ''));
    if (!match) fail('Editor connection required.', 401);
    const row = db.prepare('SELECT user_id, project_id, expires_at FROM editor_tokens WHERE token_hash = ?').get(sha(match[1]));
    if (!row || row.expires_at <= now()) fail('Editor connection expired or revoked.', 401);
    const user = getUser(db, row.user_id);
    requireMember(db, user, row.project_id);
    return { user, projectId: row.project_id };
  }
  function assigned(user, projectId) {
    return know.workList(projectId).filter(item => item.assignee?.kind === 'person' && item.assignee.id === user.id && item.state !== 'done')
      .map(item => ({ id: item.id, ref: item.ref, title: item.title, action: item.action, status: item.status, updatedAt: item.updatedAt, targets: item.targets }));
  }
  function checkTask(user, projectId, workId) {
    const item = know.workById(projectId, workId);
    if (!item || item.assignee?.kind !== 'person' || item.assignee.id !== user.id) fail('Task not found.', 404);
    return item;
  }
  function head(workspace) {
    try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
    catch { return null; }
  }
  function context(user, projectId, workId) {
    const item = checkTask(user, projectId, workId);
    const setup = projectSetup(user, projectId);
    const role = know.roleView(projectId).find(entry => entry.actions.some(action => action.id === item.action || action.key === item.action));
    const action = role?.actions.find(entry => entry.id === item.action || entry.key === item.action) || null;
    const targets = item.targets.map(target => know.get(projectId, target.id)).filter(Boolean);
    const docs = know.list(projectId, 'doc').filter(doc => doc.agents);
    const instructions = know.agentExport(projectId);
    const profile = item.profileId ? know.get(projectId, item.profileId) : know.defaultProfile(projectId);
    const soloAvailable = ['product.define', 'product.clarify', 'data.contract'].includes(item.action);
    const content = { schemaVersion: 1, project: project(projectId), work: item, sources: [...targets, ...docs.filter(doc => !targets.some(target => target.id === doc.id))],
      guidance: { principles: instructions.principles, project: instructions.instructions, role: role ? { id: role.id, revision: role.revision, name: role.name, instructions: role.instructions } : null,
        action: action ? { id: action.id, revision: action.revision, name: action.name, instructions: action.instructions, reads: action.reads, changes: action.changes, tools: action.tools, asks: action.asks } : null },
      repository: { commit: head(setup.workspacePath) }, tools,
      soloPreview: { availableNow: soloAvailable, profile: profile ? { id: profile.id, revision: profile.revision, name: profile.name, instructions: profile.instructions, model: profile.model, effort: profile.effort } : null,
        note: soloAvailable ? 'The current draft runner can take this action when assigned to an agent.' : 'A solo coding runner for this action arrives with LAY-05.' } };
    const encoded = JSON.stringify(content);
    const digest = sha(encoded);
    db.prepare('INSERT INTO editor_contexts(digest, project_id, work_id, content_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(digest) DO NOTHING')
      .run(digest, projectId, workId, encoded, now());
    return { digest, ...content };
  }
  function saved(user, projectId, digest) {
    const row = db.prepare('SELECT work_id, content_json FROM editor_contexts WHERE digest = ? AND project_id = ?').get(digest, projectId);
    if (!row) fail('Context not found.', 404);
    checkTask(user, projectId, row.work_id);
    return { digest, ...JSON.parse(row.content_json) };
  }
  function record(projectId, id, revision = null) {
    const current = know.get(projectId, id);
    if (!current) fail('Record not found.', 404);
    if (revision === null) return current;
    if (!Number.isInteger(revision) || revision < 1 || revision > current.revision) fail('Revision not found.', 404);
    const data = know.revisionData(id, revision);
    if (!data) fail('Revision not found.', 404);
    return { id, kind: current.kind, revision, data, currentRevision: current.revision };
  }
  function search(projectId, query) {
    const needle = String(query || '').trim().toLowerCase();
    if (needle.length < 2 || needle.length > 100) fail('Search for 2 to 100 characters.');
    const kinds = ['brief_claim', 'story', 'spec', 'page', 'doc', 'research', 'source', 'finding', 'insight', 'data_object', 'data_operation', 'component', 'project'];
    return kinds.flatMap(kind => know.list(projectId, kind)).filter(entry => {
      const value = [entry.title, entry.name, entry.label, entry.text, entry.description, entry.body, entry.summary].filter(Boolean).join(' ').toLowerCase();
      return value.includes(needle);
    }).slice(0, 30).map(entry => ({ id: entry.id, kind: entry.kind, revision: entry.revision, title: entry.title || entry.name || entry.label || entry.text?.slice(0, 100) || entry.id }));
  }
  function environment(user, projectId) {
    const setup = projectSetup(user, projectId);
    return { project: project(projectId), preview: previewStatus(projectId), repository: { commit: head(setup.workspacePath) } };
  }
  return { issue, revoke, status, authenticate, assigned, context, saved, record, search, environment, tools };
}
