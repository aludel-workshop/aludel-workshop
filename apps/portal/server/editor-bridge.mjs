import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getUser, requireMember } from './accounts.mjs';
import { compileTaskManifest } from './task-manifest.mjs';
import { gitIdentity } from './item-environment.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const tools = ['assigned_tasks', 'task_context', 'saved_context', 'read_record', 'search_knowledge', 'environment_status',
  'work_list', 'start_work', 'work_view', 'stack_map', 'read_layer', 'define_work', 'add_action', 'update_action', 'post_message', 'ask', 'request_allow', 'stage_change', 'report_code', 'changeset'];

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
  // Where the person's connected checkout is, so the item page can open it in their editor.
  if (!db.prepare('PRAGMA table_info(editor_tokens)').all().some(column => column.name === 'checkout_json')) db.exec('ALTER TABLE editor_tokens ADD COLUMN checkout_json TEXT');
  // An item container's token works for its one item only (COLLAB-WORK-01).
  if (!db.prepare('PRAGMA table_info(editor_tokens)').all().some(column => column.name === 'work_id')) db.exec('ALTER TABLE editor_tokens ADD COLUMN work_id TEXT');
  // A container asking to be connected, until its person connects it on the item's page and it collects its token.
  db.exec(`CREATE TABLE IF NOT EXISTS editor_connect_requests (device_hash TEXT PRIMARY KEY, user_code TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL REFERENCES projects(id), work_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, approved_by TEXT)`);
}

export function editorBridge({ db, know, projectSetup, previewStatus }) {
  const project = projectId => db.prepare('SELECT id, slug, name, description FROM projects WHERE id = ?').get(projectId);
  const tokenRow = (user, projectId) => db.prepare('SELECT created_at, expires_at, checkout_json FROM editor_tokens WHERE user_id = ? AND project_id = ? AND work_id IS NULL').get(user.id, projectId);
  function issue(user, projectId) {
    requireMember(db, user, projectId);
    const token = randomBytes(32).toString('base64url');
    const created = now();
    const expires = new Date(Date.now() + 30 * 86400_000).toISOString();
    db.prepare('DELETE FROM editor_tokens WHERE user_id = ? AND project_id = ? AND work_id IS NULL').run(user.id, projectId);
    db.prepare('INSERT INTO editor_tokens(token_hash, user_id, project_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(sha(token), user.id, projectId, created, expires);
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
    const connected = Boolean(row && row.expires_at > now());
    return { connected, expiresAt: row?.expires_at || null, checkout: connected && row.checkout_json ? JSON.parse(row.checkout_json) : null, tools };
  }
  // The person's local tools say where their checkout is: an absolute path, and the WSL distribution it lives in, if any.
  // Only a location to open; Aludel never reads from it (work comes back through GitHub).
  function noteCheckout(user, projectId, header, input = {}) {
    const path = String(input.path || ''), distro = input.distro ? String(input.distro) : null;
    if (!path.startsWith('/') || path.length > 1024 || /[\u0000-\u001f]/.test(path) || path.split('/').includes('..')) fail('Send the checkout\'s absolute path.');
    if (distro && !/^[A-Za-z0-9._-]{1,64}$/.test(distro)) fail('That WSL distribution name isn\'t valid.');
    const checkout = { path, distro, at: now() };
    db.prepare('UPDATE editor_tokens SET checkout_json = ? WHERE token_hash = ?').run(JSON.stringify(checkout), sha(/^Bearer (\S+)$/.exec(String(header))[1]));
    return { checkout };
  }
  function authenticate(header) {
    const match = /^Bearer ([A-Za-z0-9_-]{40,})$/.exec(String(header || ''));
    if (!match) fail('Editor connection required.', 401);
    const row = db.prepare('SELECT user_id, project_id, expires_at, work_id FROM editor_tokens WHERE token_hash = ?').get(sha(match[1]));
    if (!row || row.expires_at <= now()) fail('Editor connection expired or revoked.', 401);
    const user = getUser(db, row.user_id);
    requireMember(db, user, row.project_id);
    return { user, projectId: row.project_id, workId: row.work_id || null };
  }

  // COLLAB-WORK-01: an item container connects without pairing, as `gh auth login` does. It asks for a code; its person,
  // signed in on the item's page, connects it; it collects a token for that one item. Nothing secret crosses a link or a
  // terminal: the container keeps the device code to itself, and the person only compares the short code.
  const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function requestConnection(projectId, workId) {
    db.prepare('DELETE FROM editor_connect_requests WHERE expires_at <= ?').run(now());
    if (db.prepare('SELECT COUNT(*) AS n FROM editor_connect_requests WHERE project_id = ?').get(projectId).n >= 10) fail('Too many containers are waiting to connect to this project. Connect them or let them expire first.', 429);
    const deviceCode = randomBytes(32).toString('base64url');
    const letters = [...randomBytes(8)].map(byte => codeAlphabet[byte % codeAlphabet.length]).join('');
    const userCode = `${letters.slice(0, 4)}-${letters.slice(4)}`;
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    db.prepare('INSERT INTO editor_connect_requests VALUES (?, ?, ?, ?, ?, ?, NULL)').run(sha(deviceCode), userCode, projectId, workId, now(), expiresAt);
    return { deviceCode, userCode, expiresAt, interval: 2 };
  }
  // A container that doesn't know its item yet (it was cloned on main) asks with work_id '' and shows on its project's items;
  // the item it is connected from becomes its item.
  function pendingConnections(projectId, workId) {
    return db.prepare("SELECT user_code AS code, created_at AS at FROM editor_connect_requests WHERE project_id = ? AND work_id IN (?, '') AND approved_by IS NULL AND expires_at > ? ORDER BY created_at")
      .all(projectId, workId, now());
  }
  function approveConnection(user, projectId, workId, code) {
    requireMember(db, user, projectId);
    const row = db.prepare("SELECT device_hash FROM editor_connect_requests WHERE project_id = ? AND work_id IN (?, '') AND user_code = ? AND approved_by IS NULL AND expires_at > ?")
      .get(projectId, workId, String(code || '').toUpperCase(), now());
    if (!row) fail('That container is no longer waiting. Start it again from the item.', 404);
    db.prepare('UPDATE editor_connect_requests SET approved_by = ?, work_id = ? WHERE device_hash = ?').run(user.id, workId, row.device_hash);
    return { connected: true };
  }
  // The container polls with its device code. Once connected, it gets its token once, and the request is gone.
  function collectConnection(deviceCode) {
    const row = db.prepare('SELECT * FROM editor_connect_requests WHERE device_hash = ?').get(sha(String(deviceCode || '')));
    if (!row || row.expires_at <= now()) fail('This connection request expired. Run `aludel connect` again.', 410);
    if (!row.approved_by) return { status: 'pending' };
    const user = getUser(db, row.approved_by);
    requireMember(db, user, row.project_id);
    const token = randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO editor_tokens(token_hash, user_id, project_id, created_at, expires_at, work_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(sha(token), user.id, row.project_id, now(), new Date(Date.now() + 30 * 86400_000).toISOString(), row.work_id);
    db.prepare('DELETE FROM editor_connect_requests WHERE device_hash = ?').run(row.device_hash);
    return { status: 'connected', token, projectId: row.project_id, workId: row.work_id, identity: gitIdentity(db, user.id) };
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
    const content = { schemaVersion: 1, performer: { kind: 'person', id: user.id, name: user.name }, batch: { id: `person-${workId}` }, project: project(projectId), work: item, sources: [...targets, ...docs.filter(doc => !targets.some(target => target.id === doc.id))],
      guidance: { principles: instructions.principles, project: instructions.instructions, role: role ? { id: role.id, revision: role.revision, name: role.name, instructions: role.instructions } : null,
        action: action ? { id: action.id, revision: action.revision, name: action.name, instructions: action.instructions, reads: action.reads, changes: action.changes, tools: action.tools, asks: action.asks } : null },
      repository: { commit: head(setup.workspacePath) }, instructionPins: {}, tools,
      soloPreview: { availableNow: soloAvailable, profile: profile ? { id: profile.id, revision: profile.revision, name: profile.name, instructions: profile.instructions, model: profile.model, effort: profile.effort } : null,
        note: soloAvailable ? 'The current draft runner can take this action when assigned to an agent.' : 'A solo coding runner for this action arrives with LAY-05.' } };
    try { content.taskOpen = compileTaskManifest(content); }
    catch (error) {
      if (error.status !== 409) throw error;
      content.taskOpen = { available: false, reason: error.message };
    }
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
  return { issue, revoke, status, noteCheckout, authenticate, requestConnection, pendingConnections, approveConnection, collectConnection, assigned, context, saved, record, search, environment, tools };
}
