import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { knowledgeKinds } from './knowledge.mjs';
import { backfillPagesOutputScope } from './layer-output-scope.mjs';
import { compiledLocalActions, combinedLegacyInventory } from './lat07-actions.mjs';
import { hasElevated, layerWorkScope } from './layer-scope.mjs';
import { layerPackageForProject, packageAt } from './layer-package.mjs';
import { currentFileEntries, fileLayerFor } from './layer-files.mjs';
import { initLayerRegistry, seedBuiltInDefinitions, projectLayerDefinition, projectLayerDefinitions, actionsForDefinition } from './layer-registry.mjs';
// LAT-02: built-in layer declarations describe existing authorities; they do not grant writes.
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const own = Object.hasOwn;
const legacyDeclarations = [
  { key: 'product', name: 'Vision', outputs: ['vision_section', 'brief_claim', 'persona', 'phase', 'activity', 'step', 'story', 'spec', 'research', 'project'], authority: 'knowledge_records', path: '/vision' },
  { key: 'design', name: 'Design', outputs: ['design_tokens', 'component', 'brand_asset'], authority: 'knowledge_records', path: '/design' },
  // LAYER-BINDINGS-01: Pages keeps a replica of the app kit (kit items), a kind its template's API defines.
  { key: 'pages', name: 'Pages', outputs: ['page_map', 'page', 'flow', 'kit_item'], authority: 'knowledge_records', path: '/pages', ownKinds: true },
  { key: 'data', name: 'Data', outputs: ['data_object', 'data_operation', 'access_rule'], authority: 'knowledge_records', path: '/data' },
  { key: 'platform', name: 'Code', outputs: ['code_unit', 'trace_link', 'code_release', 'code_route_observation'], authority: 'code_projection', path: '/code' },
  { key: 'deploy', name: 'Deploy', outputs: ['release'], authority: 'runtime_projection', path: '/deploy' }
];
const projections = {
  code_unit: { table: 'code_units', revision: 'hash' },
  trace_link: { table: 'trace_links', revision: 'updated_at' },
  code_release: { table: 'code_releases', revision: 'commit_sha' },
  code_route_observation: { table: 'code_route_observations', revision: 'blob_sha' },
  release: { table: 'releases', revision: 'state' }
};
const sharedKinds = ['source', 'finding', 'insight', 'evidence_link', 'doc', 'agent_profile', 'role', 'work_action', 'project_instructions', 'routine'];
const allowedKinds = new Set([...knowledgeKinds.filter(kind => !sharedKinds.includes(kind)), ...Object.keys(projections)]);
const templatesEnabled = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1' || process.env.MACHINE_PAGES_TEMPLATE_ENABLED === '1';
const portal = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateConfig = templatesEnabled ? JSON.parse(readFileSync(join(portal, 'config/layer-templates.json'), 'utf8')) : null;
const pinnedManifests = new Map();
if (templateConfig) {
  if (typeof templateConfig.repo !== 'string' || !templateConfig.builtIn || !templateConfig.templates) fail('Invalid layer template catalog.');
  for (const [key, template] of Object.entries(templateConfig.builtIn)) {
    const pin = templateConfig.templates[template];
    if (!pin || !/^[0-9a-f]{40}$/.test(pin.commit)) fail(`Missing reviewed template pin for ${key}.`);
    pinnedManifests.set(key, packageAt(resolve(portal, '../..', templateConfig.repo), pin.commit, key).manifest);
  }
}
// Converted built-ins use the accepted repository manifest as their declaration. Historical
// compiled declarations remain only for keys whose template is not yet converted.
const declarations = legacyDeclarations.map(layer => {
  const manifest = pinnedManifests.get(layer.key);
  return manifest ? { key: manifest.key, name: manifest.name, outputs: manifest.outputs,
    authority: manifest.authority, path: manifest.path, ownKinds: Boolean(manifest.api) } : layer;
});

export function validateLayerDeclarations(input = declarations) {
  const keys = new Set(), kinds = new Set();
  for (const layer of input) {
    if (!layer || !/^[a-z][a-z0-9_]*$/.test(layer.key) || keys.has(layer.key)) fail('Invalid or duplicate layer key.');
    if (!['knowledge_records', 'code_projection', 'runtime_projection'].includes(layer.authority)) fail('Unknown layer authority.');
    if (!Array.isArray(layer.outputs) || !layer.outputs.length) fail('A layer needs output kinds.');
    for (const kind of layer.outputs) {
      // A template with its own API defines its own record kinds (LAYER-BINDINGS-01: Pages' kit items); the host's legacy
      // kinds stay listed so a template cannot claim one another layer owns.
      const ownKind = layer.ownKinds && /^[a-z][a-z0-9_]{1,40}$/.test(kind) && !sharedKinds.includes(kind) && !knowledgeKinds.includes(kind) && !own(projections, kind);
      if ((!allowedKinds.has(kind) && !ownKind) || kinds.has(kind)) fail(`Unknown or duplicated output kind: ${kind}.`);
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
// T03-G3: with templates enabled, the installable catalog is the reviewed pin set. The old
// declarations remain a migration ledger for historical keys and the templates-off fallback.
export function catalogFromPins(config, baseDirectory) {
  const entries = [];
  if (!config || typeof config.repo !== 'string' || !config.builtIn || !config.templates) fail('Invalid layer template catalog.');
  for (const [key, template] of Object.entries(config.builtIn)) {
    const pin = config.templates[template];
    if (!pin || !/^[0-9a-f]{40}$/.test(pin.commit)) fail(`Missing reviewed template pin for ${key}.`);
    const manifest = packageAt(resolve(baseDirectory, config.repo), pin.commit, key).manifest;
    if (manifest.key !== key || !manifest.outputs?.length || !manifest.category || !manifest.icon || !manifest.description)
      fail(`Invalid installable template: ${key}.`);
    entries.push({ ...manifest, ownKinds: Boolean(manifest.api) });
  }
  validateLayerDeclarations(entries);
  return Object.freeze(entries.map(({ key, name, path, category, icon, description }) =>
    Object.freeze({ key, name, path, category, icon, description })));
}
const compiledCatalog = layerDeclarations.map(layer => Object.freeze({ key: layer.key, name: layer.name, path: layer.path,
  category: layerPresentation[layer.key][0], icon: layerPresentation[layer.key][1], description: layerPresentation[layer.key][2] }));
const pinnedCatalog = templatesEnabled
  ? catalogFromPins(JSON.parse(readFileSync(join(portal, 'config/layer-templates.json'), 'utf8')), resolve(portal, '../..')) : [];
// Until Design, Code and Deploy move, keep their compiled setup choices available. Converted
// entries come from the exact reviewed manifest, never a copied presentation declaration.
export const layerCatalog = Object.freeze([...compiledCatalog.map(layer => pinnedCatalog.find(pin => pin.key === layer.key) || layer),
  ...pinnedCatalog.filter(pin => !compiledCatalog.some(layer => layer.key === pin.key))]);

function ensureLayerTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_instances (
    project_id TEXT NOT NULL REFERENCES projects(id), layer_key TEXT NOT NULL, instance_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    descriptor_version INTEGER NOT NULL DEFAULT 1 CHECK(descriptor_version > 0),
    visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0, 1)),
    dashboard_visible INTEGER NOT NULL DEFAULT 1 CHECK(dashboard_visible IN (0, 1)), created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, layer_key)
  )`);
  const columns = new Set(db.prepare('PRAGMA table_info(layer_instances)').all().map(column => column.name));
  if (!columns.has('visible')) db.exec('ALTER TABLE layer_instances ADD COLUMN visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0, 1))');
  if (!columns.has('dashboard_visible')) db.exec('ALTER TABLE layer_instances ADD COLUMN dashboard_visible INTEGER NOT NULL DEFAULT 1 CHECK(dashboard_visible IN (0, 1))');
  if (!columns.has('instance_id')) db.exec('ALTER TABLE layer_instances ADD COLUMN instance_id TEXT');
  const missing = db.prepare("SELECT project_id, layer_key FROM layer_instances WHERE instance_id IS NULL OR instance_id = ''").all();
  const backfill = db.prepare("UPDATE layer_instances SET instance_id = ? WHERE project_id = ? AND layer_key = ? AND (instance_id IS NULL OR instance_id = '')");
  for (const row of missing) backfill.run(randomUUID(), row.project_id, row.layer_key);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_layer_instance_id ON layer_instances(instance_id);
    CREATE TRIGGER IF NOT EXISTS layer_instance_id_required BEFORE INSERT ON layer_instances
      WHEN NEW.instance_id IS NULL OR NEW.instance_id = ''
      BEGIN SELECT RAISE(ABORT, 'Layer instance ID required'); END;
    CREATE TRIGGER IF NOT EXISTS layer_instance_id_immutable BEFORE UPDATE OF instance_id ON layer_instances
      WHEN NEW.instance_id IS NOT OLD.instance_id
      BEGIN SELECT RAISE(ABORT, 'Layer instance ID is immutable'); END;`);
}

// Stable identity for a particular installed app. Template keys remain a temporary legacy route.
export function layerInstanceId(db, projectId, key) {
  const row = db.prepare('SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, key);
  if (!row?.instance_id) fail('Layer instance not found.', 404);
  return row.instance_id;
}
export function createLayerInstances(db, projectId, created = new Date().toISOString(), selected = null) {
  ensureLayerTable(db);
  const chosen = selected === null ? new Set(layerCatalog.map(layer => layer.key)) : new Set(selected);
  if ([...chosen].some(key => !layerCatalog.some(layer => layer.key === key))) fail('Choose layers from the available catalog.');
  const insert = db.prepare(`INSERT INTO layer_instances(project_id, layer_key, instance_id, enabled, created_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(project_id, layer_key) DO NOTHING`);
  const inserted = layerDeclarations.reduce((count, layer) => count + insert.run(projectId, layer.key, randomUUID(), Number(chosen.has(layer.key)), created).changes, 0);
  seedBuiltInDefinitions(db, projectId, declarations, layerPresentation);
  return inserted;
}

export function initLayerContract(db) {
  ensureLayerTable(db);
  initLayerRegistry(db);
  // Existing projects already expose all built-in layers. Preserve their current records and visibility.
  const unknown = db.prepare('SELECT project_id,layer_key FROM layer_instances').all().find(row => !projectLayerDefinition(db,row.project_id,row.layer_key) && !layerDeclarations.some(layer => layer.key === row.layer_key));
  if (unknown) fail(`Unknown layer instance: ${unknown.layer_key}.`);
  const projects = db.prepare("SELECT id FROM projects WHERE id <> 'the-machine'").all();
  const created = new Date().toISOString();
  let inserted = 0;
  db.exec('BEGIN');
  try {
    for (const project of projects) inserted += createLayerInstances(db, project.id, created);
    backfillPagesOutputScope(db);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { projects: projects.length, inserted };
}

function member(db, userId, projectId) {
  if (!userId || !db.prepare('SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId))
    fail('Project not found.', 404);
}
function instance(db, projectId, key) {
  const layer = projectLayerDefinition(db,projectId,key);
  if (!layer) fail('Layer not found.', 404);
  const row = db.prepare('SELECT instance_id, enabled, descriptor_version FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, key);
  if (!row || !row.enabled) fail('Layer not found.', 404);
  return { ...layer, instanceId: row.instance_id, version: row.descriptor_version };
}
function outputCount(db, projectId, kind) {
  const fileKey = fileLayerFor(db, projectId, kind);
  if (fileKey) return currentFileEntries(db, projectId, fileKey).filter(entry => entry.kind === kind).length;
  if (own(projections, kind)) {
    const { table } = projections[kind];
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) return 0;
    return db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE project_id = ?`).get(projectId).n;
  }
  return db.prepare('SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind = ?').get(projectId, kind).n;
}
export function layerInstances(db, userId, projectId) {
  member(db, userId, projectId);
  ensureLayerTable(db);
  return db.prepare('SELECT layer_key, instance_id, enabled, visible, dashboard_visible FROM layer_instances WHERE project_id = ? ORDER BY rowid').all(projectId)
    .map(row => {
      const declaration = projectLayerDefinition(db,projectId,row.layer_key);
      if (!declaration) fail('Unknown layer instance.');
      // DEC-057: which outputs layer-scoped Work may change, and whether this person holds elevated access.
      return { ...declaration, instanceId: row.instance_id,
        enabled: !!row.enabled, visible: !!row.visible, dashboardVisible: !!row.dashboard_visible,
        workScope: row.enabled ? layerWorkScope(db, projectId, row.layer_key)?.changes || null : null, elevated: hasElevated(db, userId, projectId, row.layer_key),
        // LAYER-BASE-01 B6: the layer brings its own views, which run in a sandboxed frame built from its repository.
        frameUi: row.enabled ? Boolean((() => { try { return layerPackageForProject(db, projectId, row.layer_key)?.manifest?.ui?.entry; } catch { return null; } })()) : false };
    });
}
export function updateLayerInstance(db, userId, projectId, key, settings) {
  member(db, userId, projectId);
  if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ? AND role = 'owner'").get(userId, projectId)) fail('Project owner required.', 403);
  if (!projectLayerDefinition(db,projectId,key)) fail('Layer not found.', 404);
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
    .map(layer => ({ key: layer.key, instanceId: layer.instanceId, name: layer.name, path: layer.path, authority: layer.authority, outputProvider:layer.outputProvider, editorAdapter:layer.editorAdapter, version: layer.version,
      outputs: layer.outputs.map(kind => ({ kind, count: kind === 'markdown_document' ? (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='markdown_files'").get() ? db.prepare('SELECT COUNT(*) AS n FROM markdown_files WHERE project_id=? AND layer_key=? AND deleted=0').get(projectId,layer.key).n : 0) : outputCount(db, projectId, kind), revision: kind === 'markdown_document' ? 'revision' : projections[kind] ? 'content-hash' : 'revision' })),
      actions: [...compiledLocalActions.filter(action => action.layer === layer.key), ...actionsForDefinition(layer)].filter(action=>!action.legacy).map(action => ({ id: action.id, revision: action.revision, title: action.title, purpose: action.purpose,
        result: action.result, permissions: action.permissions, checks: action.checks, elevated: action.permissions.elevated, agentAvailable: action.agentRunnable, humanAvailable: action.humanRunnable,
        unavailableReason: combinedLegacyInventory[action.id]?.reason || (!action.agentRunnable && !action.humanRunnable ? 'No checked adapter is registered.' : null) })),
      legacy: Object.entries(combinedLegacyInventory).filter(([id]) => id.startsWith(`${layer.key}.`)).map(([id, entry]) => ({ id, ...entry })) }));
}
export function layerOutputRead(db, userId, projectId, key, kind, id) {
  member(db, userId, projectId);
  const layer = instance(db, projectId, key);
  if (!layer.outputs.includes(kind)) fail('Output not found.', 404);
  if (kind === 'markdown_document') { const row=db.prepare('SELECT id,path,revision,content_sha FROM markdown_files WHERE project_id=? AND layer_key=? AND id=? AND deleted=0').get(projectId,key,id);if(!row)fail('Output not found.',404);return {id:row.id,kind,revision:row.revision,path:row.path,sha:row.content_sha,authority:layer.authority}; }
  if (own(projections, kind)) {
    const { table } = projections[kind];
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) fail('Output not found.', 404);
    const row = db.prepare(`SELECT * FROM ${table} WHERE project_id = ? AND id = ?`).get(projectId, id);
    if (!row) fail('Output not found.', 404);
    // Projection reads return identity and revision only. Existing native endpoints own detailed views.
    return { id: row.id, kind, revision: createHash('sha256').update(JSON.stringify(row)).digest('hex'), authority: layer.authority };
  }
  const row = key === 'pages'
    ? db.prepare('SELECT id, kind, revision, data_json FROM knowledge_records WHERE project_id = ? AND layer_instance_id = ? AND kind = ? AND id = ?').get(projectId, layer.instanceId, kind, id)
    : db.prepare('SELECT id, kind, revision, data_json FROM knowledge_records WHERE project_id = ? AND kind = ? AND id = ?').get(projectId, kind, id);
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
