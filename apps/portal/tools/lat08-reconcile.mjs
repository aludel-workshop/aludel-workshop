// Read-only LAT-08 action migration audit. No source row or credential is printed or written.
// The disposable in-memory database contains only action/role/assignment metadata.
import { DatabaseSync } from 'node:sqlite';
import { initActionMigration, migrateActionProject } from '../server/lat08-migration.mjs';

const path = process.argv[2];
if (!path) { process.stderr.write('Usage: node tools/lat08-reconcile.mjs /path/to/source.sqlite\n'); process.exit(2); }
const source = new DatabaseSync(path, { readOnly: true });
const target = new DatabaseSync(':memory:');
target.exec(`CREATE TABLE project_setup(project_id TEXT PRIMARY KEY, profile TEXT, created_by TEXT, workspace_path TEXT);
  CREATE TABLE project_members(project_id TEXT, user_id TEXT, role TEXT, created_at TEXT);
  CREATE TABLE layer_instances(project_id TEXT, layer_key TEXT, enabled INTEGER);
  CREATE TABLE knowledge_records(id TEXT PRIMARY KEY, project_id TEXT, kind TEXT, parent_id TEXT, revision INTEGER, data_json TEXT);
  CREATE TABLE layer_work_items(id TEXT PRIMARY KEY, project_id TEXT, action TEXT, state TEXT);`);
const projects = source.prepare("SELECT project_id, profile, created_by FROM project_setup WHERE project_id <> 'the-machine'").all();
const sourceCounts = {};
for (const table of ['projects', 'project_setup', 'project_members', 'knowledge_records', 'knowledge_revisions', 'layer_work_items', 'agent_batches', 'symphony_attempts']) {
  if (source.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) sourceCounts[table] = source.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}
const layerKeys = ['product', 'design', 'pages', 'data', 'platform', 'deploy'];
const result = [];
for (const project of projects) {
  target.prepare('INSERT INTO project_setup(project_id, profile, created_by, workspace_path) VALUES (?, ?, ?, NULL)').run(project.project_id, project.profile, project.created_by);
  for (const member of source.prepare('SELECT user_id, role, created_at FROM project_members WHERE project_id = ?').all(project.project_id))
    target.prepare('INSERT INTO project_members VALUES (?, ?, ?, ?)').run(project.project_id, member.user_id, member.role, member.created_at);
  for (const key of layerKeys) target.prepare('INSERT INTO layer_instances VALUES (?, ?, 1)').run(project.project_id, key);
  const records = source.prepare("SELECT id, kind, parent_id, revision, data_json FROM knowledge_records WHERE project_id = ? AND kind IN ('role','work_action','agent_profile')").all(project.project_id);
  const kinds = { role: 0, work_action: 0, agent_profile: 0 };
  for (const record of records) {
    const original = JSON.parse(record.data_json);
    const data = record.kind === 'role' ? { layer: original.layer, members: original.members || [] }
      : record.kind === 'work_action' ? { key: original.key, assignee: original.assignee || null }
      : { key: original.key, active: original.active !== false };
    target.prepare('INSERT INTO knowledge_records VALUES (?, ?, ?, ?, ?, ?)')
      .run(record.id, project.project_id, record.kind, record.parent_id, record.revision, JSON.stringify(data));
    kinds[record.kind]++;
  }
  const work = source.prepare('SELECT id, action, state FROM layer_work_items WHERE project_id = ?').all(project.project_id);
  for (const item of work) target.prepare('INSERT INTO layer_work_items VALUES (?, ?, ?, ?)').run(item.id, project.project_id, item.action, item.state);
  const first = migrateActionProject(target, project.project_id);
  const second = migrateActionProject(target, project.project_id);
  if (second.installed || second.granted || second.mapped || second.blocked || first.totalWork !== work.length)
    throw new Error('Migration reconciliation failed.');
  result.push({ source: { roles: kinds.role, actions: kinds.work_action, profiles: kinds.agent_profile, work: work.length },
    migrated: { installations: first.totalActions, grants: first.granted, mappedWork: first.mapped, blockedWork: first.blocked },
    repeatedPassChanges: 0 });
}
process.stdout.write(JSON.stringify({ sourceCounts, projectCount: projects.length, projects: result }, null, 2) + '\n');
source.close(); target.close();
