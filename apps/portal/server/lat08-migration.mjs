// LAT-08: explicit, repeatable migration of legacy role-backed Work metadata.
// Historical records and run pins stay immutable; admission reads this ledger.
import { compiledLocalActions, combinedLegacyInventory } from './lat07-actions.mjs';
import { seedActionAssignee } from './layer-action-contract.mjs';
import { actionForProject, actionsForDefinition, projectLayerDefinition } from './layer-registry.mjs';

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const actions = new Map(compiledLocalActions.map(action => [action.id, action]));
const projectAction = (db, projectId, id) => actions.get(id) || actionForProject(db, projectId, id);
const layerActions = (db, projectId, key) => [...compiledLocalActions.filter(action => action.layer === key), ...actionsForDefinition(projectLayerDefinition(db, projectId, key))];
const parse = value => { try { return JSON.parse(value); } catch { return {}; } };
const styles = new Set(['dreamer', 'planner', 'tinkerer']);
const now = () => new Date().toISOString();

export function initActionMigration(db) {
  const setupColumns = new Set(db.prepare('PRAGMA table_info(project_setup)').all().map(column => column.name));
  if (!setupColumns.has('work_style')) {
    db.exec('ALTER TABLE project_setup ADD COLUMN work_style TEXT');
    db.exec("UPDATE project_setup SET work_style = CASE WHEN profile IN ('dreamer','planner','tinkerer') THEN profile ELSE 'planner' END WHERE work_style IS NULL");
  }
  db.exec(`CREATE TABLE IF NOT EXISTS layer_action_installations (
    project_id TEXT NOT NULL, layer_key TEXT NOT NULL, action_id TEXT NOT NULL,
    action_revision INTEGER NOT NULL, installed_style TEXT NOT NULL,
    assignee_kind TEXT, assignee_id TEXT, legacy_action_id TEXT, legacy_record_id TEXT,
    legacy_record_revision INTEGER, method_text TEXT NOT NULL DEFAULT '', method_revision INTEGER NOT NULL DEFAULT 1, installed_at TEXT NOT NULL,
    PRIMARY KEY(project_id, action_id));
    CREATE TABLE IF NOT EXISTS layer_action_method_revisions (project_id TEXT NOT NULL, action_id TEXT NOT NULL, revision INTEGER NOT NULL,
      method_text TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(project_id, action_id, revision));
    CREATE TABLE IF NOT EXISTS layer_action_grants (
    project_id TEXT NOT NULL, user_id TEXT NOT NULL, layer_key TEXT NOT NULL,
    action_id TEXT NOT NULL DEFAULT '', level TEXT NOT NULL CHECK(level IN ('normal','elevated')),
    source_role_id TEXT, created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, user_id, layer_key, action_id, level));
    CREATE TABLE IF NOT EXISTS layer_work_migration (
    project_id TEXT NOT NULL, work_id TEXT NOT NULL, legacy_action_id TEXT,
    legacy_record_id TEXT, legacy_record_revision INTEGER,
    action_id TEXT, action_revision INTEGER, disposition TEXT NOT NULL CHECK(disposition IN ('mapped','blocked')),
    reason TEXT, recorded_at TEXT NOT NULL, PRIMARY KEY(project_id, work_id));`);
}

export function migrateActionProject(db, projectId) {
  initActionMigration(db);
  const project = db.prepare('SELECT profile, work_style, created_by FROM project_setup WHERE project_id = ?').get(projectId);
  if (!project) fail('Project setup is unavailable.', 404);
  const style = styles.has(project.work_style) ? project.work_style : styles.has(project.profile) ? project.profile : 'planner';
  const owner = project.created_by || db.prepare("SELECT user_id FROM project_members WHERE project_id = ? AND role = 'owner' ORDER BY created_at LIMIT 1").get(projectId)?.user_id;
  const profile = db.prepare("SELECT id FROM knowledge_records WHERE project_id = ? AND kind = 'agent_profile' AND json_extract(data_json, '$.key') = 'default' AND json_extract(data_json, '$.active') IS NOT 0 LIMIT 1").get(projectId)?.id;
  const legacy = db.prepare("SELECT id, parent_id, revision, data_json FROM knowledge_records WHERE project_id = ? AND kind = 'work_action'").all(projectId)
    .map(row => ({ ...row, data: parse(row.data_json) }));
  const oldByKey = new Map(legacy.map(row => [row.data.key, row]));
  const roles = db.prepare("SELECT id, revision, data_json FROM knowledge_records WHERE project_id = ? AND kind = 'role'").all(projectId)
    .map(row => ({ ...row, data: parse(row.data_json) }));
  const installations = db.prepare(`INSERT OR IGNORE INTO layer_action_installations
    (project_id, layer_key, action_id, action_revision, installed_style, assignee_kind, assignee_id,
     legacy_action_id, legacy_record_id, legacy_record_revision, method_text, method_revision, installed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  const grants = db.prepare(`INSERT OR IGNORE INTO layer_action_grants
    (project_id, user_id, layer_key, action_id, level, source_role_id, created_at) VALUES (?, ?, ?, '', ?, ?, ?)`);
  const workRows = db.prepare("SELECT id, action, state FROM layer_work_items WHERE project_id = ?").all(projectId);
  const ledger = db.prepare(`INSERT OR IGNORE INTO layer_work_migration
    (project_id, work_id, legacy_action_id, legacy_record_id, legacy_record_revision,
     action_id, action_revision, disposition, reason, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const at = now();
  const transaction = db.transaction ? fn => db.transaction(fn)() : fn => {
    db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return transaction(() => {
    let installed = 0, granted = 0, mapped = 0, blocked = 0;
    for (const layer of db.prepare('SELECT layer_key FROM layer_instances WHERE project_id = ? AND enabled = 1').all(projectId)) {
      for (const action of layerActions(db, projectId, layer.layer_key)) {
        const old = oldByKey.get(action.id);
        // Keep a legacy edited assignee only when it still resolves to a member or active profile.
        const saved = old?.data.assignee;
        const validSaved = saved?.kind === 'person' ? !!db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, saved.id)
          : saved?.kind === 'agent' ? !!db.prepare("SELECT 1 FROM knowledge_records WHERE id = ? AND project_id = ? AND kind = 'agent_profile' AND json_extract(data_json, '$.active') IS NOT 0").get(saved.id, projectId) : false;
        const seed = validSaved && (saved.kind === 'person' ? action.humanRunnable : action.agentRunnable) ? saved
          : seedActionAssignee(action, style, { humanId: owner, agentId: profile });
        const added = installations.run(projectId, action.layer, action.id, action.revision, style, seed?.kind || null, seed?.id || null,
          old?.data.key || null, old?.id || null, old?.revision || null, String(old?.data.instructions || action.method || '').slice(0, 8000), at).changes;
        installed += added;
        if (added) db.prepare('INSERT OR IGNORE INTO layer_action_method_revisions VALUES (?, ?, 1, ?, ?, ?)')
          .run(projectId, action.id, String(old?.data.instructions || action.method || '').slice(0, 8000), 'LAT-08 migration', at);
      }
    }
    for (const role of roles) {
      const layer = role.data.layer;
      if (!compiledLocalActions.some(action => action.layer === layer)) continue;
      for (const member of role.data.members || []) {
        if (!db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, member.id)) continue;
        granted += grants.run(projectId, member.id, layer, 'normal', role.id, at).changes;
        if (member.lead) granted += grants.run(projectId, member.id, layer, 'elevated', role.id, at).changes;
      }
    }
    for (const work of workRows) {
      const old = oldByKey.get(work.action);
      const entry = combinedLegacyInventory[work.action];
      const action = entry?.disposition === 'recreated' ? actions.get(entry.action) : null;
      const enabled = action && db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, action.layer);
      const runnable = action && (action.humanRunnable || action.agentRunnable);
      const disposition = enabled && runnable ? 'mapped' : 'blocked';
      const reason = disposition === 'blocked' ? entry?.reason || 'No checked, installed layer action maps this historical item.' : null;
      const changes = ledger.run(projectId, work.id, work.action || null, old?.id || null, old?.revision || null,
        action?.id || null, action?.revision || null, disposition, reason, at).changes;
      if (changes) disposition === 'mapped' ? mapped++ : blocked++;
    }
    return { projectId, installed, granted, mapped, blocked, totalActions: db.prepare('SELECT COUNT(*) AS n FROM layer_action_installations WHERE project_id = ?').get(projectId).n,
      totalWork: db.prepare('SELECT COUNT(*) AS n FROM layer_work_migration WHERE project_id = ?').get(projectId).n };
  });
}

export function actionGrant(db, actor, projectId, actionId, level = 'normal') {
  const action = projectAction(db, projectId, actionId);
  if (!action || !['normal', 'elevated'].includes(level)) fail('Unknown layer action.', 404);
  const installed = db.prepare('SELECT action_revision FROM layer_action_installations WHERE project_id = ? AND action_id = ?').get(projectId, actionId);
  if (!action.humanRunnable && !action.agentRunnable) fail('No checked adapter is registered.');
  if (!installed || installed.action_revision !== action.revision || !db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, action.layer))
    fail('This layer action is unavailable.');
  if (!actor?.id || !db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, actor.id)) fail('Project not found.', 404);
  const member = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, actor.id);
  if (member.role === 'owner') return action;
  const required = action.permissions.elevated || level === 'elevated' ? 'elevated' : 'normal';
  const grant = db.prepare(`SELECT 1 FROM layer_action_grants WHERE project_id = ? AND user_id = ? AND layer_key = ?
    AND action_id IN ('', ?) AND level = ?`).get(projectId, actor.id, action.layer, actionId, required);
  if (!grant) fail('A layer action grant is required.', 403);
  return action;
}

export function workActionMigration(db, projectId, workId) {
  const row = db.prepare('SELECT * FROM layer_work_migration WHERE project_id = ? AND work_id = ?').get(projectId, workId);
  if (!row) fail('This Work item has no checked action mapping.');
  if (row.disposition !== 'mapped') fail(row.reason || 'This historical action requires reassessment.');
  const action = db.prepare('SELECT action_revision FROM layer_action_installations WHERE project_id = ? AND action_id = ?').get(projectId, row.action_id);
  const current = projectAction(db, projectId, row.action_id);
  if (!action || !current || action.action_revision !== row.action_revision || current.revision !== row.action_revision ||
      !db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, current.layer))
    fail('This Work action or installed layer changed.');
  return row;
}

export function recordNewWorkAction(db, projectId, workId, legacyActionId) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_work_migration'").get()) return;
  const entry = combinedLegacyInventory[legacyActionId];
  const action = entry?.disposition === 'recreated' ? projectAction(db, projectId, entry.action) : projectAction(db, projectId, legacyActionId);
  const installed = action && db.prepare('SELECT action_revision FROM layer_action_installations WHERE project_id = ? AND action_id = ?').get(projectId, action.id);
  const disposition = installed?.action_revision === action?.revision && (action.humanRunnable || action.agentRunnable) ? 'mapped' : 'blocked';
  db.prepare(`INSERT OR IGNORE INTO layer_work_migration
    (project_id, work_id, legacy_action_id, action_id, action_revision, disposition, reason, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(projectId, workId, legacyActionId, action?.id || null, action?.revision || null, disposition,
      disposition === 'blocked' ? entry?.reason || 'No checked layer action maps this item.' : null, now());
}

export function setProjectWorkStyle(db, actor, projectId, style) {
  if (!styles.has(style)) fail('Choose Dreamer, Planner or Tinkerer.', 400);
  if (!actor?.id || !db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'").get(projectId, actor.id))
    fail('Project owner required.', 403);
  db.prepare('UPDATE project_setup SET work_style = ? WHERE project_id = ?').run(style, projectId);
  return { workStyle: style };
}

export function layerActionSettings(db, actor, projectId, layerKey) {
  if (!actor?.id || !db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, actor.id)) fail('Project not found.', 404);
  if (!db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, layerKey)) fail('Layer not found.', 404);
  return layerActions(db, projectId, layerKey).filter(action => !action.legacy).map(action => {
    const installed = db.prepare('SELECT * FROM layer_action_installations WHERE project_id = ? AND action_id = ?').get(projectId, action.id);
    return { id: action.id, revision: action.revision, title: action.title, purpose: action.purpose, elevated: action.permissions.elevated,
      available: action.humanRunnable || action.agentRunnable, assignee: installed?.assignee_id ? { kind: installed.assignee_kind, id: installed.assignee_id } : null,
      installedStyle: installed?.installed_style || null, method: installed?.method_text || '', methodRevision: installed?.method_revision || 1,
      // Read-only declaration facts, so Tasks › Actions can show what an action reads, changes and is checked against.
      checks: action.checks || [], reads: action.permissions.reads || [], result: action.result || null, fileWrites: action.permissions.fileWrites || [],
      effects: action.permissions.effects || [], reviewer: action.reviewer || null, humanRunnable: !!action.humanRunnable, agentRunnable: !!action.agentRunnable, unavailableReason: combinedLegacyInventory[action.id]?.reason ||
        (!action.humanRunnable && !action.agentRunnable ? 'No checked adapter is registered.' : null) };
  });
}

export function setActionAssignee(db, actor, projectId, actionId, assignee) {
  if (!actor?.id || !db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'").get(projectId, actor.id)) fail('Project owner required.', 403);
  const action = projectAction(db, projectId, actionId);
  if (!action) fail('Action not found.', 404);
  const installed = db.prepare('SELECT 1 FROM layer_action_installations WHERE project_id = ? AND action_id = ?').get(projectId, actionId);
  if (!installed) fail('Action is not installed.');
  if (assignee !== null) {
    if (!assignee || !['person', 'agent'].includes(assignee.kind) || typeof assignee.id !== 'string') fail('Choose a person or active agent.', 400);
    if (assignee.kind === 'person' && !db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, assignee.id)) fail('Person is not a project member.', 404);
    if (assignee.kind === 'agent' && (!action.agentRunnable || !db.prepare("SELECT 1 FROM knowledge_records WHERE id = ? AND project_id = ? AND kind = 'agent_profile' AND json_extract(data_json, '$.active') IS NOT 0").get(assignee.id, projectId))) fail('No active checked agent adapter is available.');
    if (assignee.kind === 'person' && !action.humanRunnable) fail('No checked person adapter is available.');
  }
  db.prepare('UPDATE layer_action_installations SET assignee_kind = ?, assignee_id = ? WHERE project_id = ? AND action_id = ?')
    .run(assignee?.kind || null, assignee?.id || null, projectId, actionId);
  return { actionId, assignee };
}

export function setLayerActionGrant(db, actor, projectId, { userId, layerKey, actionId = '', level, enabled }) {
  if (!actor?.id || !db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'").get(projectId, actor.id)) fail('Project owner required.', 403);
  if (!db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId)) fail('Person is not a project member.', 404);
  if (!db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, layerKey)) fail('Layer is not installed.', 404);
  if (actionId && (!actionId.startsWith(`${layerKey}.`) || !db.prepare('SELECT 1 FROM layer_action_installations WHERE project_id = ? AND action_id = ?').get(projectId, actionId))) fail('Action is not installed.', 404);
  if (!['normal', 'elevated'].includes(level) || typeof enabled !== 'boolean') fail('Choose a grant level and enabled state.', 400);
  if (enabled) db.prepare(`INSERT INTO layer_action_grants(project_id, user_id, layer_key, action_id, level, source_role_id, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?) ON CONFLICT(project_id, user_id, layer_key, action_id, level) DO NOTHING`)
    .run(projectId, userId, layerKey, actionId, level, now());
  else db.prepare('DELETE FROM layer_action_grants WHERE project_id = ? AND user_id = ? AND layer_key = ? AND action_id = ? AND level = ?')
    .run(projectId, userId, layerKey, actionId, level);
  return { userId, layerKey, actionId, level, enabled };
}

export function setActionMethod(db, actor, projectId, actionId, method, expectedRevision) {
  if (!actor?.id || !db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'").get(projectId, actor.id)) fail('Project owner required.', 403);
  if (!projectAction(db, projectId, actionId) || typeof method !== 'string' || method.length > 8000 || !method.trim()) fail('Use a current action and a concise method.', 400);
  const row = db.prepare('SELECT method_revision FROM layer_action_installations WHERE project_id = ? AND action_id = ?').get(projectId, actionId);
  if (!row) fail('Action is not installed.', 404);
  if (row.method_revision !== expectedRevision) fail('This action method changed. Reload before saving.');
  const revision = row.method_revision + 1;
  const at = now();
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE layer_action_installations SET method_text = ?, method_revision = ? WHERE project_id = ? AND action_id = ?')
      .run(method.trim(), revision, projectId, actionId);
    db.prepare('INSERT INTO layer_action_method_revisions VALUES (?, ?, ?, ?, ?, ?)')
      .run(projectId, actionId, revision, method.trim(), actor.id, at);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { actionId, methodRevision: revision, method: method.trim() };
}
