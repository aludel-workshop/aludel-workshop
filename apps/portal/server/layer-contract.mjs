import { createHash } from 'node:crypto';
import { knowledgeKinds } from './knowledge.mjs';
// LAT-02: built-in layer declarations describe existing authorities; they do not grant writes.
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const own = Object.hasOwn;
const declarations = [
  { key: 'product', name: 'Vision', outputs: ['vision_section', 'brief_claim', 'persona', 'phase', 'activity', 'step', 'story', 'spec', 'research', 'project'], authority: 'knowledge_records', path: '/vision' },
  { key: 'design', name: 'Design', outputs: ['design_tokens', 'component', 'brand_asset'], authority: 'knowledge_records', path: '/design' },
  { key: 'pages', name: 'Pages', outputs: ['page_map', 'page', 'flow'], authority: 'knowledge_records', path: '/pages' },
  { key: 'data', name: 'Data', outputs: ['data_object', 'data_operation', 'access_rule'], authority: 'knowledge_records', path: '/data' },
  { key: 'platform', name: 'Code', outputs: ['code_unit', 'trace_link', 'code_release'], authority: 'code_projection', path: '/code' },
  { key: 'deploy', name: 'Deploy', outputs: ['release'], authority: 'runtime_projection', path: '/deploy' }
];
const projections = {
  code_unit: { table: 'code_units', revision: 'hash' },
  trace_link: { table: 'trace_links', revision: 'updated_at' },
  code_release: { table: 'code_releases', revision: 'commit_sha' },
  release: { table: 'releases', revision: 'state' }
};
const sharedKinds = ['source', 'finding', 'insight', 'evidence_link', 'doc', 'agent_profile', 'role', 'work_action', 'project_instructions', 'routine'];
const allowedKinds = new Set([...knowledgeKinds.filter(kind => !sharedKinds.includes(kind)), ...Object.keys(projections)]);

export function validateLayerDeclarations(input = declarations) {
  const keys = new Set(), kinds = new Set();
  for (const layer of input) {
    if (!layer || !/^[a-z][a-z0-9_]*$/.test(layer.key) || keys.has(layer.key)) fail('Invalid or duplicate layer key.');
    if (!['knowledge_records', 'code_projection', 'runtime_projection'].includes(layer.authority)) fail('Unknown layer authority.');
    if (!Array.isArray(layer.outputs) || !layer.outputs.length) fail('A layer needs output kinds.');
    for (const kind of layer.outputs) {
      if (!allowedKinds.has(kind) || kinds.has(kind)) fail(`Unknown or duplicated output kind: ${kind}.`);
      if ((own(projections, kind) ? (kind === 'release' ? layer.authority === 'runtime_projection' : layer.authority === 'code_projection') : layer.authority === 'knowledge_records') === false)
        fail(`Wrong authority for ${kind}.`);
      kinds.add(kind);
    }
    keys.add(layer.key);
  }
  if (input === declarations && [...allowedKinds].some(kind => !kinds.has(kind))) fail('Built-in output inventory is incomplete.');
  return input.map(layer => ({ ...layer, outputs: [...layer.outputs] }));
}

export const layerDeclarations = Object.freeze(validateLayerDeclarations().map(layer => Object.freeze({ ...layer, outputs: Object.freeze(layer.outputs) })));
const layerPresentation = {
  product: ['Plan', 'lightbulb', 'Shape intent, stories and outcomes.'],
  design: ['Make', 'palette', 'Own the design system, components and brand.'],
  pages: ['Make', 'web', 'Map pages, compose specs and review flows.'],
  data: ['Make', 'schema', 'Define data objects, operations and access.'],
  platform: ['Build', 'code', 'Observe code, tests and repository docs.'],
  deploy: ['Run', 'rocket_launch', 'Inspect environments and releases.']
};
export const layerCatalog = Object.freeze(layerDeclarations.map(layer => Object.freeze({ key: layer.key, name: layer.name, path: layer.path,
  category: layerPresentation[layer.key][0], icon: layerPresentation[layer.key][1], description: layerPresentation[layer.key][2] })));

function ensureLayerTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_instances (
    project_id TEXT NOT NULL REFERENCES projects(id), layer_key TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    descriptor_version INTEGER NOT NULL DEFAULT 1 CHECK(descriptor_version > 0),
    visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0, 1)),
    dashboard_visible INTEGER NOT NULL DEFAULT 1 CHECK(dashboard_visible IN (0, 1)), created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, layer_key)
  )`);
  const columns = new Set(db.prepare('PRAGMA table_info(layer_instances)').all().map(column => column.name));
  if (!columns.has('visible')) db.exec('ALTER TABLE layer_instances ADD COLUMN visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0, 1))');
  if (!columns.has('dashboard_visible')) db.exec('ALTER TABLE layer_instances ADD COLUMN dashboard_visible INTEGER NOT NULL DEFAULT 1 CHECK(dashboard_visible IN (0, 1))');
}
export function createLayerInstances(db, projectId, created = new Date().toISOString(), selected = null) {
  ensureLayerTable(db);
  const chosen = selected === null ? new Set(layerDeclarations.map(layer => layer.key)) : new Set(selected);
  if ([...chosen].some(key => !layerDeclarations.some(layer => layer.key === key))) fail('Choose layers from the available catalog.');
  const insert = db.prepare(`INSERT INTO layer_instances(project_id, layer_key, enabled, created_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(project_id, layer_key) DO NOTHING`);
  return layerDeclarations.reduce((count, layer) => count + insert.run(projectId, layer.key, Number(chosen.has(layer.key)), created).changes, 0);
}

export function initLayerContract(db) {
  ensureLayerTable(db);
  // Existing projects already expose all built-in layers. Preserve their current records and visibility.
  const unknown = db.prepare('SELECT layer_key FROM layer_instances').all().find(row => !layerDeclarations.some(layer => layer.key === row.layer_key));
  if (unknown) fail(`Unknown layer instance: ${unknown.layer_key}.`);
  const projects = db.prepare("SELECT id FROM projects WHERE id <> 'the-machine'").all();
  const created = new Date().toISOString();
  let inserted = 0;
  db.exec('BEGIN');
  try {
    for (const project of projects) inserted += createLayerInstances(db, project.id, created);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { projects: projects.length, inserted };
}

function member(db, userId, projectId) {
  if (!userId || !db.prepare('SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId))
    fail('Project not found.', 404);
}
function instance(db, projectId, key) {
  const layer = layerDeclarations.find(item => item.key === key);
  if (!layer) fail('Layer not found.', 404);
  const row = db.prepare('SELECT enabled, descriptor_version FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, key);
  if (!row || !row.enabled) fail('Layer not found.', 404);
  return { ...layer, version: row.descriptor_version };
}
function outputCount(db, projectId, kind) {
  if (own(projections, kind)) {
    const { table } = projections[kind];
    return db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE project_id = ?`).get(projectId).n;
  }
  return db.prepare('SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind = ?').get(projectId, kind).n;
}
export function layerInstances(db, userId, projectId) {
  member(db, userId, projectId);
  ensureLayerTable(db);
  return db.prepare('SELECT layer_key, enabled, visible, dashboard_visible FROM layer_instances WHERE project_id = ? ORDER BY rowid').all(projectId)
    .map(row => {
      const declaration = layerDeclarations.find(layer => layer.key === row.layer_key);
      if (!declaration) fail('Unknown layer instance.');
      return { ...layerCatalog.find(layer => layer.key === row.layer_key),
        enabled: !!row.enabled, visible: !!row.visible, dashboardVisible: !!row.dashboard_visible };
    });
}
export function updateLayerInstance(db, userId, projectId, key, settings) {
  member(db, userId, projectId);
  if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ? AND role = 'owner'").get(userId, projectId)) fail('Project owner required.', 403);
  if (!layerDeclarations.some(layer => layer.key === key)) fail('Layer not found.', 404);
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)
    || !Object.keys(settings).length || Object.keys(settings).some(field => !['enabled', 'dashboardVisible'].includes(field))
    || Object.values(settings).some(value => typeof value !== 'boolean')) fail('Invalid layer settings.');
  const row = db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, key);
  if (!row) fail('Layer not found.', 404);
  const updates = [];
  const values = [];
  if (Object.hasOwn(settings, 'enabled')) { updates.push('enabled = ?'); values.push(Number(settings.enabled)); }
  if (Object.hasOwn(settings, 'dashboardVisible')) { updates.push('dashboard_visible = ?'); values.push(Number(settings.dashboardVisible)); }
  db.prepare(`UPDATE layer_instances SET ${updates.join(', ')} WHERE project_id = ? AND layer_key = ?`).run(...values, projectId, key);
  return layerInstances(db, userId, projectId).find(layer => layer.key === key);
}
export function layerDescriptors(db, userId, projectId) {
  member(db, userId, projectId);
  return db.prepare('SELECT layer_key FROM layer_instances WHERE project_id = ? AND enabled = 1 ORDER BY rowid').all(projectId)
    .map(row => instance(db, projectId, row.layer_key))
    .map(layer => ({ key: layer.key, name: layer.name, path: layer.path, authority: layer.authority, version: layer.version,
      outputs: layer.outputs.map(kind => ({ kind, count: outputCount(db, projectId, kind), revision: projections[kind] ? 'content-hash' : 'revision' })) }));
}
export function layerOutputRead(db, userId, projectId, key, kind, id) {
  member(db, userId, projectId);
  const layer = instance(db, projectId, key);
  if (!layer.outputs.includes(kind)) fail('Output not found.', 404);
  if (own(projections, kind)) {
    const { table } = projections[kind];
    const row = db.prepare(`SELECT * FROM ${table} WHERE project_id = ? AND id = ?`).get(projectId, id);
    if (!row) fail('Output not found.', 404);
    // Projection reads return identity and revision only. Existing native endpoints own detailed views.
    return { id: row.id, kind, revision: createHash('sha256').update(JSON.stringify(row)).digest('hex'), authority: layer.authority };
  }
  const row = db.prepare('SELECT id, kind, revision, data_json FROM knowledge_records WHERE project_id = ? AND kind = ? AND id = ?').get(projectId, kind, id);
  if (!row) fail('Output not found.', 404);
  return { id: row.id, kind: row.kind, revision: row.revision, data: JSON.parse(row.data_json), authority: layer.authority };
}
export function layerMigrationInventory(db, userId, projectId) {
  member(db, userId, projectId);
  const descriptors = layerDescriptors(db, userId, projectId);
  const mapped = new Set(descriptors.flatMap(layer => layer.outputs.map(output => output.kind)));
  const knowledge = db.prepare('SELECT kind, COUNT(*) AS count, SUM(revision) AS revisionSum FROM knowledge_records WHERE project_id = ? GROUP BY kind ORDER BY kind').all(projectId);
  return { projectId, descriptors, knowledge, shared: knowledge.filter(row => sharedKinds.includes(row.kind)),
    unmapped: knowledge.filter(row => !mapped.has(row.kind) && !sharedKinds.includes(row.kind)),
    workItems: db.prepare('SELECT COUNT(*) AS n FROM layer_work_items WHERE project_id = ?').get(projectId).n,
    routineRuns: db.prepare('SELECT COUNT(*) AS n FROM routine_runs WHERE project_id = ?').get(projectId).n };
}
