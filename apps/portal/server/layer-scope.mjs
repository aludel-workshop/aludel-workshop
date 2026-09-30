// DEC-057: a Work item names the layer it may change instead of an action. Guidance comes from the
// layer's pinned charter and Knowledge; authority stays here. Host-registered change adapters bound
// what a layer-scoped item may write, and elevated access per layer gates review, follow-up decisions
// and layer configuration. Package text can opt a layer in, but it can never add a change kind.
import { randomUUID } from 'node:crypto';
import { layerPackageForProject } from './layer-package.mjs';

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const hasTable = (db, name) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));

// Output kinds each layer can change through a checked host adapter, with their operations.
export const layerChangeAdapters = Object.freeze({ pages: Object.freeze({ flow: Object.freeze(['create', 'revise']) }) });
export const followUpLimit = 5;

export function initLayerScope(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_elevated_grants (
    project_id TEXT NOT NULL, user_id TEXT NOT NULL, layer_key TEXT NOT NULL, granted_by TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, user_id, layer_key));
  CREATE TABLE IF NOT EXISTS layer_work_defaults (
    project_id TEXT NOT NULL, layer_key TEXT NOT NULL, assignee_kind TEXT, assignee_id TEXT, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(project_id, layer_key));
  CREATE TABLE IF NOT EXISTS work_follow_ups (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, work_id TEXT NOT NULL, proposal_id TEXT NOT NULL, attempt_id TEXT NOT NULL,
    position INTEGER NOT NULL, source_layer TEXT NOT NULL, layer TEXT NOT NULL, title TEXT NOT NULL, brief TEXT NOT NULL, why TEXT NOT NULL,
    profile_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('proposed','created','dismissed')), created_work_id TEXT,
    decided_by TEXT, decided_at TEXT, created_at TEXT NOT NULL, UNIQUE(proposal_id, position));
  CREATE INDEX IF NOT EXISTS work_follow_ups_work ON work_follow_ups(project_id, work_id);`);
  // Carry layer-wide elevated grants forward. Action-specific grants are not widened to the whole layer.
  if (hasTable(db, 'layer_action_grants')) db.exec(`INSERT OR IGNORE INTO layer_elevated_grants(project_id, user_id, layer_key, granted_by, created_at)
    SELECT project_id, user_id, layer_key, 'DEC-057 migration', created_at FROM layer_action_grants WHERE action_id = '' AND level = 'elevated'`);
}

const installed = (db, projectId, layerKey) => Boolean(db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, layerKey));
const isOwner = (db, userId, projectId) => Boolean(db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'").get(projectId, userId));
const isMember = (db, userId, projectId) => Boolean(db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId));

// The layer's Work scope when its installed package opts in: the kinds it may change, limited to host adapters.
export function layerWorkScope(db, projectId, layerKey) {
  const adapters = layerChangeAdapters[layerKey];
  if (!adapters || !installed(db, projectId, layerKey)) return null;
  let pkg;
  try { pkg = layerPackageForProject(db, projectId, layerKey); } catch { return null; }
  const declared = pkg?.manifest?.work;
  if (declared?.scope !== 'layer' || !Array.isArray(declared.changes)) return null;
  const changes = Object.fromEntries(declared.changes.filter(kind => Object.hasOwn(adapters, kind)).map(kind => [kind, [...adapters[kind]]]));
  if (!Object.keys(changes).length) return null;
  const instance = db.prepare('SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, layerKey)?.instance_id;
  return { key: layerKey, instanceId: instance, commit: pkg.commit, changes, unavailable: declared.changes.filter(kind => !Object.hasOwn(adapters, kind)) };
}

export function hasElevated(db, userId, projectId, layerKey) {
  if (!userId || !isMember(db, userId, projectId)) return false;
  if (isOwner(db, userId, projectId)) return true;
  return hasTable(db, 'layer_elevated_grants') &&
    Boolean(db.prepare('SELECT 1 FROM layer_elevated_grants WHERE project_id = ? AND user_id = ? AND layer_key = ?').get(projectId, userId, layerKey));
}

export function requireElevated(db, user, projectId, layerKey, doing = 'do this') {
  if (!hasElevated(db, user?.id, projectId, layerKey)) fail(`Elevated access to this layer is required to ${doing}.`, 403);
}

// Who has elevated access to a layer, and its default assignee, for the layer's Manage › Access view.
export function layerAccess(db, actor, projectId, layerKey) {
  if (!actor?.id || !isMember(db, actor.id, projectId)) fail('Project not found.', 404);
  if (!installed(db, projectId, layerKey)) fail('Layer not found.', 404);
  const members = db.prepare(`SELECT m.user_id AS id, m.role, u.display_name AS name FROM project_members m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.project_id = ? ORDER BY m.created_at`).all(projectId);
  const grants = new Set(db.prepare('SELECT user_id FROM layer_elevated_grants WHERE project_id = ? AND layer_key = ?').all(projectId, layerKey).map(row => row.user_id));
  const fallback = db.prepare('SELECT assignee_kind AS kind, assignee_id AS id FROM layer_work_defaults WHERE project_id = ? AND layer_key = ?').get(projectId, layerKey);
  const scope = layerWorkScope(db, projectId, layerKey);
  return { layer: layerKey, layerScoped: Boolean(scope), changes: scope?.changes || {}, unavailable: scope?.unavailable || [],
    canManageGrants: isOwner(db, actor.id, projectId), canConfigure: hasElevated(db, actor.id, projectId, layerKey),
    people: members.map(member => ({ id: member.id, name: member.name || member.id, owner: member.role === 'owner', elevated: member.role === 'owner' || grants.has(member.id) })),
    defaultAssignee: fallback?.id ? { kind: fallback.kind, id: fallback.id } : null };
}

export function setLayerElevated(db, actor, projectId, { userId, layerKey, enabled }) {
  if (!actor?.id || !isOwner(db, actor.id, projectId)) fail('Project owner required.', 403);
  if (!isMember(db, userId, projectId)) fail('Person is not a project member.', 404);
  if (!installed(db, projectId, layerKey)) fail('Layer is not installed.', 404);
  if (typeof enabled !== 'boolean') fail('Say whether elevated access is on.', 400);
  if (enabled) db.prepare('INSERT OR IGNORE INTO layer_elevated_grants VALUES (?, ?, ?, ?, ?)').run(projectId, userId, layerKey, actor.id, now());
  else db.prepare('DELETE FROM layer_elevated_grants WHERE project_id = ? AND user_id = ? AND layer_key = ?').run(projectId, userId, layerKey);
  return { userId, layerKey, elevated: enabled || isOwner(db, userId, projectId) };
}

export function layerDefaultAssignee(db, projectId, layerKey) {
  if (!hasTable(db, 'layer_work_defaults')) return null;
  const row = db.prepare('SELECT assignee_kind AS kind, assignee_id AS id FROM layer_work_defaults WHERE project_id = ? AND layer_key = ?').get(projectId, layerKey);
  return row?.id ? { kind: row.kind, id: row.id } : null;
}

export function setLayerDefaultAssignee(db, actor, projectId, layerKey, assignee) {
  requireElevated(db, actor, projectId, layerKey, 'change its default assignee');
  if (!installed(db, projectId, layerKey)) fail('Layer is not installed.', 404);
  if (assignee !== null) {
    if (!assignee || !['person', 'agent'].includes(assignee.kind) || typeof assignee.id !== 'string') fail('Choose a person or an active agent.', 400);
    if (assignee.kind === 'person' && !isMember(db, assignee.id, projectId)) fail('Person is not a project member.', 404);
    if (assignee.kind === 'agent' && !db.prepare("SELECT 1 FROM knowledge_records WHERE id = ? AND project_id = ? AND kind = 'agent_profile' AND json_extract(data_json, '$.active') IS NOT 0").get(assignee.id, projectId))
      fail('Choose an active agent profile.', 404);
  }
  db.prepare(`INSERT INTO layer_work_defaults VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_id, layer_key) DO UPDATE SET
    assignee_kind = excluded.assignee_kind, assignee_id = excluded.assignee_id, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .run(projectId, layerKey, assignee?.kind || null, assignee?.id || null, actor.id, now());
  return { layerKey, defaultAssignee: assignee };
}

// ---- Follow-ups: work an agent proposes for any installed layer, decided in review ----

export function checkFollowUps(db, projectId, followUps) {
  if (followUps === undefined) return [];
  if (!Array.isArray(followUps) || followUps.length > followUpLimit) fail(`Propose at most ${followUpLimit} follow-ups.`);
  return followUps.map(entry => {
    const value = { layer: text(entry?.layer, 40), title: text(entry?.title, 161), brief: text(entry?.brief, 2001), why: text(entry?.why, 1001) };
    if (!installed(db, projectId, value.layer)) fail(`A follow-up names a layer that is not installed: ${value.layer || 'none'}.`);
    if (value.title.length < 3 || value.title.length > 160 || value.brief.length > 2000 || value.why.length < 10 || value.why.length > 1000)
      fail('Each follow-up needs a title, a bounded brief, and why it is needed.');
    return value;
  });
}

export function recordFollowUps(db, { projectId, workId, proposalId, attemptId, sourceLayer, profileId, followUps }) {
  const insert = db.prepare(`INSERT INTO work_follow_ups(id, project_id, work_id, proposal_id, attempt_id, position, source_layer, layer, title, brief, why, profile_id, state, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?)`);
  followUps.forEach((entry, position) => insert.run(`fup-${randomUUID()}`, projectId, workId, proposalId, attemptId, position, sourceLayer,
    entry.layer, entry.title, entry.brief, entry.why, profileId, now()));
}

const followUpRow = row => ({ id: row.id, position: row.position, layer: row.layer, sourceLayer: row.source_layer, title: row.title, brief: row.brief, why: row.why,
  state: row.state, createdWorkId: row.created_work_id, decidedBy: row.decided_by, decidedAt: row.decided_at, attemptId: row.attempt_id, proposalId: row.proposal_id, profileId: row.profile_id });

export function followUpsForAttempt(db, attemptId) {
  if (!hasTable(db, 'work_follow_ups')) return [];
  return db.prepare('SELECT * FROM work_follow_ups WHERE attempt_id = ? ORDER BY position').all(attemptId).map(followUpRow);
}

// Creating a follow-up signs the new item as the agent's, from its layer; the reviewer's decision is logged beside it.
export function decideFollowUp(db, know, user, projectId, workId, followUpId, decision) {
  const row = db.prepare('SELECT * FROM work_follow_ups WHERE id = ? AND project_id = ? AND work_id = ?').get(followUpId, projectId, workId);
  if (!row) fail('Follow-up not found.', 404);
  if (!['create', 'dismiss'].includes(decision)) fail('Create or dismiss the follow-up.', 400);
  requireElevated(db, user, projectId, row.source_layer, 'decide follow-ups');
  if (row.state !== 'proposed') return { followUp: followUpRow(row), work: row.created_work_id ? know.workById(projectId, row.created_work_id) : null };
  const source = know.workById(projectId, workId);
  const profile = know.list(projectId, 'agent_profile').find(entry => entry.id === row.profile_id);
  const layerName = key => db.prepare('SELECT name FROM layer_definitions WHERE project_id = ? AND layer_key = ?').get(projectId, key)?.name || key;
  let created = null;
  if (decision === 'create') {
    if (!installed(db, projectId, row.layer)) fail('The follow-up layer is no longer installed.');
    const createdBy = { kind: 'agent', profileId: row.profile_id, name: profile?.name || 'Agent', layer: row.source_layer,
      workId, workRef: source?.ref || null, attemptId: row.attempt_id, proposalId: row.proposal_id, followUpId: row.id, why: row.why, acceptedBy: user.name };
    created = know.createWork(projectId, { layer: row.layer, layerScoped: true, title: row.title, state: 'suggested',
      context: { suggestion: row.brief, createdBy },
      logText: `Created by ${createdBy.name} from the ${layerName(row.source_layer)} layer as a follow-up to ${source?.ref || workId}; accepted by ${user.name}` }, createdBy.name);
  }
  db.prepare('UPDATE work_follow_ups SET state = ?, created_work_id = ?, decided_by = ?, decided_at = ? WHERE id = ?')
    .run(decision === 'create' ? 'created' : 'dismissed', created?.id || null, user.name, now(), row.id);
  know.appendLog(workId, decision === 'create' ? `Created follow-up ${created.ref} in ${layerName(row.layer)}: ${row.title}` : `Dismissed follow-up: ${row.title}`,
    {}, { by: { kind: 'person', id: user.id } });
  return { followUp: followUpRow(db.prepare('SELECT * FROM work_follow_ups WHERE id = ?').get(row.id)), work: created };
}
