// PAGES-API-01: a layer's API is its output contract. The installed layer source publishes an OpenAPI 3.1 document and a
// handler module; the host validates every request and every normalized record against the document, runs only a
// reviewed handler source in a limited child process, keeps writes inside this layer's outputs and instance, and
// resolves the references the handler reports. People's calls apply at once; an agent's calls stage in its run's draft.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { layerPackageForProject, packageAt } from './layer-package.mjs';
import { fileEntryExists } from './layer-files.mjs';
import { entryRoles } from './entry-roles.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const reviewedSources = JSON.parse(readFileSync(new URL('../config/layer-reviewed-sources.json', import.meta.url), 'utf8'));
const methods = ['get', 'post', 'put', 'patch', 'delete'];
const cache = new Map();

const child = `
let raw = '';
process.stdin.setEncoding('utf8');
const limit = Number(process.argv.at(-1)) || 1048576;
process.stdin.on('data', chunk => { raw += chunk; if (raw.length > limit) process.exit(3); });
process.stdin.on('end', async () => {
  try {
    const { source, call, args } = JSON.parse(raw);
    const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    if (typeof module[call] !== 'function') throw new Error('The layer handler has no ' + call + '.');
    process.stdout.write(JSON.stringify({ ok: true, value: module[call](...args) }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, message: String(error.message || error).slice(0, 300), status: Number.isInteger(error.status) ? error.status : 400 }));
  }
});`;

// Readable messages from the document itself: a field's title, or an x-message on the schema that rejected it.
function message(errors) {
  const flagged = errors.find(error => error.parentSchema?.['x-message']);
  if (flagged) return flagged.parentSchema['x-message'];
  const error = errors[0];
  const title = error.parentSchema?.title || error.instancePath.split('/').pop() || 'The input';
  if (error.keyword === 'maxLength') return `${title} must be under ${error.params.limit} characters.`;
  if (error.keyword === 'minLength') return `${title} is required.`;
  if (error.keyword === 'required') return `${error.parentSchema?.properties?.[error.params.missingProperty]?.title || error.params.missingProperty} is required.`;
  if (error.keyword === 'additionalProperties') return `Unknown field “${error.params.additionalProperty}”${error.instancePath ? ` in ${error.instancePath}` : ''}.`;
  if (error.keyword === 'maxItems') return `${title} allows at most ${error.params.limit}.`;
  return `${error.instancePath || 'The input'} ${error.message}.`;
}

function compile(key, repo, commit, manifest) {
  const cacheKey = `${repo}@${commit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const root = packageAt(repo, commit, key).root;
  const read = path => {
    if (typeof path !== 'string' || !/^(?:api|server)\/[a-z][a-z0-9-]*\.(?:json|mjs)$/.test(path)) fail('Invalid layer API path.', 500);
    return execFileSync('git', ['-C', repo, 'show', `${commit}:${root}${path}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  };
  const spec = JSON.parse(read(manifest.api.spec));
  const source = read(manifest.api.handler);
  if (spec.openapi !== '3.1.0' || !spec.paths || !spec.components?.schemas) fail('The layer API is not an OpenAPI 3.1 document.', 500);
  const ajv = new Ajv2020({ strict: false, verbose: true, allErrors: true });
  ajv.addSchema({ $id: 'layer', components: spec.components, paths: spec.paths });
  const pointer = parts => 'layer#/' + parts.map(part => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
  const operations = new Map();
  for (const [path, item] of Object.entries(spec.paths)) for (const method of methods) {
    const op = item[method];
    if (!op) continue;
    const output = op['x-aludel-output'] || null;
    if (output && (!manifest.outputs.includes(output) || op['x-aludel-staging'] !== 'record' || !['normal', 'elevated'].includes(op['x-aludel-access'])))
      fail(`Operation ${op.operationId} writes outside this layer or has no staging and access.`, 500);
    if (!output && !['list', 'get', 'singleton'].includes(op['x-aludel-read']?.mode)) fail(`Operation ${op.operationId} neither reads nor writes.`, 500);
    const context = op['x-aludel-context'] || [];
    if (!Array.isArray(context) || !context.every(kind => manifest.outputs.includes(kind))) fail(`Operation ${op.operationId} asks for context outside this layer.`, 500);
    const body = op.requestBody?.content?.['application/json']?.schema;
    // A record that sits under another (a story under a step) names the request field that carries its parent.
    const parentField = op['x-aludel-parent'] || null;
    if (parentField !== null && (typeof parentField !== 'string' || !body?.properties?.[parentField])) fail(`Operation ${op.operationId} names a parent field it does not take.`, 500);
    operations.set(op.operationId, { operationId: op.operationId, method: method.toUpperCase(), path, summary: op.summary || '', description: op.description || '',
      output, access: op['x-aludel-access'] || 'normal', singleton: Boolean(op['x-aludel-singleton']), read: op['x-aludel-read'] || null, context,
      field: body?.required?.find(name => name !== 'expectedRevision' && name !== parentField) || null, parentField,
      needsId: Boolean(op.parameters?.some(parameter => parameter.in === 'path' && parameter.name === 'id')),
      validate: body ? ajv.getSchema(pointer(['paths', path, method, 'requestBody', 'content', 'application/json', 'schema'])) : null });
  }
  const records = new Map(Object.entries(spec['x-aludel-records'] || {}).map(([kind, ref]) => [kind, ajv.getSchema(`layer${ref}`)]));
  // T03-G2: a kind is kept either as records through this API or as repository files, never both.
  if (manifest.files?.kinds?.some(kind => records.has(kind))) fail('A kind is either records or files, not both.', 500);
  const catalogNames = spec['x-aludel-catalogs'] || [];
  if (!Array.isArray(catalogNames) || !catalogNames.every(name => /^[a-zA-Z][a-zA-Z0-9]*$/.test(name))) fail('The layer API names invalid host catalogs.', 500);
  const api = { key, commit, spec, source, digest: createHash('sha256').update(source).digest('hex'), handlerPath: manifest.api.handler, operations, records, catalogNames, outputs: manifest.outputs,
    seeds: manifest.api.seeds || [] };
  cache.set(cacheKey, api);
  return api;
}

// A source file may run on the host only once its exact bytes were reviewed: by the host's own list, or by the project
// owner accepting the layer commit that introduced them (LAYER-SOURCE-01).
export function initSourceReviews(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_source_reviews (project_id TEXT NOT NULL, layer_key TEXT NOT NULL, path TEXT NOT NULL, digest TEXT NOT NULL,
    reviewed_by TEXT NOT NULL, reviewed_at TEXT NOT NULL, work_id TEXT, PRIMARY KEY(project_id, layer_key, path, digest))`);
}
export function sourceReviewed(db, projectId, key, path, digest) {
  // The host's own list is by file and exact bytes, whichever instance runs them; owner acceptance is per project and instance.
  if (reviewedSources[path]?.includes(digest)) return true;
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_source_reviews'").get() &&
    db.prepare('SELECT 1 FROM layer_source_reviews WHERE project_id = ? AND layer_key = ? AND path = ? AND digest = ?').get(projectId, key, path, digest));
}

// The installed layer's API, or null when its source publishes none (the host's own rules then apply).
export function layerApi(db, projectId, key) {
  let pkg;
  try { pkg = layerPackageForProject(db, projectId, key); } catch { return null; }
  if (!pkg?.manifest?.api) return null;
  const api = compile(key, pkg.repo, pkg.commit, pkg.manifest);
  if (!sourceReviewed(db, projectId, key, api.handlerPath, api.digest)) fail(`The ${key} API handler at this commit has not passed review.`, 409);
  return api;
}
// LAYER-BASE-01: which installed layers own a record kind. Several instances of one template can own the same kind;
// their records are told apart by layer instance.
export function kindOwners(db, projectId, kind) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_definitions'").get()) return [];
  return db.prepare(`SELECT d.layer_key AS key, i.instance_id AS instanceId, d.output_kinds_json AS outputs FROM layer_definitions d
    JOIN layer_instances i ON i.project_id = d.project_id AND i.layer_key = d.layer_key WHERE d.project_id = ?`).all(projectId)
    .filter(row => { try { return JSON.parse(row.outputs || '[]').includes(kind); } catch { return false; } }).map(({ key, instanceId }) => ({ key, instanceId }));
}
// The API that owns records of this kind here, narrowed by layer or instance when several layers own it; null when no owner publishes one.
export function layerApiForKind(db, projectId, kind, { layerKey = null, instanceId = null } = {}) {
  const owners = kindOwners(db, projectId, kind).filter(owner => (!layerKey || owner.key === layerKey) && (!instanceId || owner.instanceId === instanceId))
    .map(owner => ({ ...owner, api: layerApi(db, projectId, owner.key) })).filter(owner => owner.api);
  if (owners.length > 1) fail(`Several layers own ${kind.replace('_', ' ')} records here. Name the layer.`, 409);
  return owners[0] || null;
}

// Compiles a layer API at any commit of its repository, for checking a candidate before it is accepted.
export function layerApiAt(key, repo, commit, manifest) { return compile(key, repo, commit, manifest); }

function handle(api, call, args) { return runPure(api.source, call, args); }
// Runs one export of a pure, reviewed module in a limited child process: no filesystem, subprocess or network permission.
// API handlers get small limits. Indexing a repository gets larger, still bounded ones (`indexLimits`, EX-02A): a real app
// such as Aludel's own portal is about 2,500 code units, a megabyte of input before the indexer's own output.
export const indexLimits = { bytes: 16 * 1048576, timeout: 20000, heapMb: 256 };
export function runPure(source, call, args, { bytes = 1048576, timeout = 3000, heapMb = 64 } = {}) {
  const payload = JSON.stringify({ source, call, args });
  if (payload.length > bytes) fail('The layer API input is too large.');
  const result = spawnSync(process.execPath, ['--permission', `--max-old-space-size=${heapMb}`, '-e', child, String(bytes)],
    { input: payload, encoding: 'utf8', timeout, maxBuffer: bytes, env: { PATH: process.env.PATH || '' } });
  if (result.error || result.status !== 0 || !result.stdout) fail('The layer API handler did not finish within its limits.', 500);
  const response = JSON.parse(result.stdout);
  if (!response.ok) fail(response.message, response.status);
  return response.value;
}

// Host catalogs a layer's rules may check against, as the API asks for them: a list, or the keys of a map.
export const handlerCatalogs = (api, catalogs) => Object.fromEntries(api.catalogNames.map(name => {
  const value = catalogs?.[name];
  return [name, Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : value && typeof value === 'object' ? Object.keys(value) : []];
}));
function checkRecord(api, kind, data) {
  const validate = api.records.get(kind);
  if (!validate) fail(`The ${api.key} API has no schema for ${kind}.`, 500);
  if (!validate(data)) fail(message(validate.errors));
}

// The layer's rules for one record, used by every host path that writes this layer's outputs.
export function normalizeRecord(api, kind, data, catalogs) {
  const result = handle(api, 'normalize', [kind, data, { catalogs: handlerCatalogs(api, catalogs) }]);
  checkRecord(api, kind, result.data);
  return result;
}

const instanceOf = (db, projectId, key) => db.prepare('SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, key)?.instance_id || null;
const stored = (db, projectId, key, id) => {
  const row = db.prepare('SELECT id, kind, revision, data_json, layer_instance_id, project_id FROM knowledge_records WHERE id = ?').get(id);
  return row && row.project_id === projectId ? { id: row.id, kind: row.kind, revision: row.revision, data: JSON.parse(row.data_json), instanceId: row.layer_instance_id } : null;
};

// Every reference must exist in this project; this layer's own outputs must also be in this instance.
function checkReferences(db, api, projectId, references, overlay) {
  const instance = instanceOf(db, projectId, api.key);
  const outputs = new Set(api.spec['x-aludel-records'] ? Object.keys(api.spec['x-aludel-records']) : []);
  for (const [id, kinds] of references) {
    const staged = overlay?.get(id);
    const record = staged ? (staged.deleted ? null : { kind: staged.kind, instanceId: instance }) : stored(db, projectId, api.key, id);
    // DEC-059: a reference may also name an entry another layer keeps as repository files (T03-G2).
    if (!record && !staged && fileEntryExists(db, projectId, id, kinds)) continue;
    if (!record || !kinds.includes(record.kind) || outputs.has(record.kind) && record.instanceId !== instance)
      fail(`A linked ${kinds[0].replace('_', ' ')} was not found.`, 404);
  }
}

// This instance's records of one kind, as a run sees them: stored records with its staged changes applied.
function recordsOf(db, api, projectId, kind, overlay) {
  const instance = instanceOf(db, projectId, api.key);
  const rows = db.prepare('SELECT id FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id = ? ORDER BY position, created_at').all(projectId, kind, instance)
    .map(row => stored(db, projectId, api.key, row.id));
  return [...rows.map(record => overlay?.get(record.id) || record), ...[...(overlay?.values() || [])].filter(entry => entry.kind === kind && entry.created)]
    .filter(record => !record.deleted).map(({ id, kind: recordKind, revision, data }) => ({ id, kind: recordKind, revision, data }));
}

function currentFor(db, api, projectId, operation, id, overlay) {
  if (operation.singleton) return recordsOf(db, api, projectId, operation.output, overlay)[0] || null;
  if (!operation.needsId) return null;
  return recordsOf(db, api, projectId, operation.output, overlay).find(record => record.id === id) || fail(`That ${operation.output.replace('_', ' ')} was not found.`, 404);
}

function read(db, api, projectId, operation, id, overlay) {
  const { kind, mode } = operation.read;
  const all = recordsOf(db, api, projectId, kind, overlay).map(({ id: recordId, revision, data }) => ({ id: recordId, revision, data }));
  if (mode === 'list') return all;
  if (mode === 'singleton') return all[0] || null;
  return all.find(record => record.id === id) || fail(`That ${kind.replace('_', ' ')} was not found.`, 404);
}

// One call. Returns the read result, or the writes this call makes (not yet applied).
export function callOperation({ db, catalogs, api, projectId, operationId, id = null, body = {}, overlay = null, elevated = false }) {
  const operation = api.operations.get(operationId) || fail(`The ${api.key} API has no operation ${operationId}.`, 404);
  if (operation.needsId && (typeof id !== 'string' || !/^[a-z]+-[a-z0-9]{6,12}$/.test(id))) fail('This operation needs a record id.');
  // LAYER-BINDINGS-01 R3: each record read carries its role, when its facet takes part in a binding in force.
  if (operation.read) return { operation, result: withRoles(db, projectId, api.key, operation.read.kind, read(db, api, projectId, operation, id, overlay)) };
  if (operation.access === 'elevated' && !elevated) fail(`Elevated access to ${api.key} is required for ${operationId}.`, 403);
  if (operation.validate && !operation.validate(body)) fail(message(operation.validate.errors));
  const current = currentFor(db, api, projectId, operation, id, overlay);
  // An operation may ask for this instance's records of some of its kinds, for rules that span records (paths, moves).
  const records = Object.fromEntries(operation.context.map(kind => [kind, recordsOf(db, api, projectId, kind, overlay)]));
  const { writes, references } = handle(api, 'run', [operationId, { id, body },
    { current: current && { id: current.id, kind: current.kind, revision: current.revision, data: current.data }, records, catalogs: handlerCatalogs(api, catalogs) }]);
  if (!Array.isArray(writes) || !writes.length || writes.length > 200 || !Array.isArray(references)) fail('The layer API handler returned an invalid result.', 500);
  const loaded = [...(current ? [current] : []), ...Object.values(records).flat()];
  checkWrites(db, api, projectId, writes, references, loaded, overlay);
  // A person's or agent's call never writes an entry in a replica or ceded facet; only the binding's imports do.
  entryRoles(db).guard(projectId, api.key, writes, new Map(loaded.map(record => [record.id, record])));
  return { operation, writes, references };
}
function withRoles(db, projectId, key, kind, result) {
  if (!result) return result;
  const roles = entryRoles(db).resolver(projectId);
  if (!roles.live.length) return result;
  const attach = record => { const role = roles.of(key, { kind, data: record.data }); return role?.role ? { ...record, role } : record; };
  return Array.isArray(result) ? result.map(attach) : attach(result);
}

// Checks a handler's writes: this layer's outputs only; updates and deletes only of records the call loaded, at the
// revision loaded; creates with fresh IDs; every record valid against its schema; parents and references resolvable.
function checkWrites(db, api, projectId, writes, references, loadedRecords, overlay = null) {
  const loaded = new Map(loadedRecords.map(record => [record.id, record]));
  const touched = new Set();
  for (const write of writes) {
    if (!api.outputs.includes(write.kind) || !['create', 'update', 'delete'].includes(write.op) || typeof write.id !== 'string' || !/^[a-z]+-[a-z0-9]{6,12}$/.test(write.id) || touched.has(write.id))
      fail('The layer API handler wrote outside its operation.', 500);
    touched.add(write.id);
    if (write.op === 'create' && (loaded.has(write.id) || stored(db, projectId, api.key, write.id) || overlay?.has(write.id))) fail('The layer API handler reused a record id.', 500);
    if (write.op !== 'create' && (loaded.get(write.id)?.kind !== write.kind || write.baseRevision !== loaded.get(write.id).revision)) fail('The layer API handler changed a record it did not load.', 500);
    if (write.op !== 'delete') checkRecord(api, write.kind, write.data);
    // A record that sits under another names its parent, which must be one of the references checked below (its kind, and
    // this instance for this layer's own kinds).
    if (write.parentId !== undefined && (write.op === 'delete' || typeof write.parentId !== 'string' || !references.some(([id]) => id === write.parentId)))
      fail('The layer API handler named a parent it did not reference.', 500);
  }
  const next = new Map(overlay || []);
  for (const write of writes) next.set(write.id, { id: write.id, kind: write.kind, data: write.data ?? null, deleted: write.op === 'delete', created: write.op === 'create', ...(write.parentId ? { parentId: write.parentId } : {}) });
  checkReferences(db, api, projectId, references, next);
}

// T03-DESIGN-SEED: a layer's starter content and its answers to host events (`api.seeds`), from its own handler. The host
// passes the project facts every layer may use and this instance's records of every output kind, checks the writes as it
// checks an operation's, and applies them as Aludel. Each write's `note` becomes its rationale.
export function seedLayer({ db, know, api, projectId, event, project }) {
  if (!api.seeds.includes(event)) return [];
  const records = Object.fromEntries([...api.records.keys()].map(kind => [kind, recordsOf(db, api, projectId, kind, null)]));
  const { writes, references } = handle(api, 'seed', [event, { project, records, catalogs: {} }]);
  if (!Array.isArray(writes) || writes.length > 200 || !Array.isArray(references)) fail('The layer seed returned an invalid result.', 500);
  return applyAsAludel(db, know, api, projectId, writes, references, records, write => typeof write.note === 'string' ? write.note.slice(0, 300) : null);
}

// LAYER-BINDINGS-01: an active binding imports another layer's entries into this layer's facet through the adapter this
// layer declares (`adapters`) and implements as the handler's `adapt`. The host checks the writes like an operation's and
// applies them as Aludel; the rationale names the binding.
export function adaptLayer({ db, know, api, projectId, adapterId, entries = [], removed = [], rationale }) {
  const records = Object.fromEntries([...api.records.keys()].map(kind => [kind, recordsOf(db, api, projectId, kind, null)]));
  const { writes, references } = handle(api, 'adapt', [adapterId, { entries, removed }, { records }]);
  if (!Array.isArray(writes) || writes.length > 500 || !Array.isArray(references)) fail('The layer adapter returned an invalid result.', 500);
  return applyAsAludel(db, know, api, projectId, writes, references, records, () => rationale);
}

function applyAsAludel(db, know, api, projectId, writes, references, records, rationaleOf) {
  if (!writes.length) return [];
  checkWrites(db, api, projectId, writes, references, Object.values(records).flat());
  const own = !db.isTransaction;
  if (own) db.exec('BEGIN IMMEDIATE');
  try {
    const order = { create: 0, update: 1, delete: 2 };
    const applied = [...writes].sort((a, b) => order[a.op] - order[b.op]).map(write => {
      const options = { prepared: { data: write.data, references: [] }, author: 'Aludel', rationale: rationaleOf(write) };
      if (write.op === 'create') return know.insert(projectId, write.kind, write.data, { ...options, id: write.id, layer: api.key, parentId: write.parentId ?? null });
      if (write.op === 'update') return know.update(projectId, write.id, write.data, { ...options, expectedRevision: write.baseRevision });
      know.remove(projectId, write.id);
      return null;
    }).filter(Boolean);
    if (own) db.exec('COMMIT');
    return applied;
  } catch (error) { if (own) db.exec('ROLLBACK'); throw error; }
}

// How the host's generic record writes (the UI's create, change and delete) map to a layer's operations.
export function recordOperations(api, kind) {
  const ops = [...api.operations.values()].filter(op => op.output === kind);
  return { create: ops.find(op => op.singleton) || ops.find(op => op.method === 'POST' && !op.needsId) || null,
    update: ops.find(op => op.singleton) || ops.find(op => ['PATCH', 'PUT'].includes(op.method) && op.needsId) || null,
    remove: ops.find(op => op.method === 'DELETE' && op.needsId) || null };
}

// A person's call: runs the operation and applies its writes at once, through the same checks.
// `position` is where a person placed the record among its siblings: ordering is the host's, not a change to what it says.
export function applyOperation({ db, know, api, projectId, operationId, id = null, body = {}, elevated = false, author, rationale = null, workItemId = null, position = undefined }) {
  const called = callOperation({ db, catalogs: know.catalogs, api, projectId, operationId, id, body, elevated });
  if (called.result !== undefined) return called.result;
  const own = !db.isTransaction;
  if (own) db.exec('BEGIN IMMEDIATE');
  try {
    const records = applyWrites(know, projectId, called.writes, called.references, { layer: api.key, author, rationale, workItemId, position });
    if (own) db.exec('COMMIT');
    const first = records[0];
    return { id: first?.id || called.writes[0].id, revision: first?.revision ?? null, data: called.writes[0].data ?? null, record: first || null, records };
  } catch (error) { if (own) db.exec('ROLLBACK'); throw error; }
}

// Writes checked changes through the host store: creates first so later writes can point at them, deletes last.
export function applyWrites(know, projectId, writes, references, { layer, author, rationale = null, workItemId = null, position = undefined, baseCheck = true } = {}) {
  const order = { create: 0, update: 1, delete: 2 };
  return [...writes].sort((a, b) => order[a.op] - order[b.op]).map(write => {
    const prepared = { data: write.data, references: [] };
    const placed = position !== undefined && write === writes[0] ? { position } : {};
    if (write.op === 'create') return know.insert(projectId, write.kind, write.data, { id: write.id, prepared, author, rationale, workItemId, layer, parentId: write.parentId ?? null, ...placed });
    if (write.op === 'update') return know.update(projectId, write.id, write.data, { expectedRevision: baseCheck ? write.baseRevision : undefined, prepared, author, rationale, workItemId, ...(write.parentId ? { parentId: write.parentId } : {}), ...placed });
    const current = know.get(projectId, write.id);
    if (!current || baseCheck && current.revision !== write.baseRevision) fail('A record this change deletes was changed since. Reload and try again.', 409);
    know.remove(projectId, write.id);
    return null;
  }).filter(Boolean).sort((a, b) => writes.findIndex(write => write.id === a.id) - writes.findIndex(write => write.id === b.id));
}

// ---- Staged runs: an agent's calls build a draft that review shows and acceptance commits ----

export function initLayerApi(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_run_drafts (
    attempt_id TEXT NOT NULL, seq INTEGER NOT NULL, project_id TEXT NOT NULL, layer_key TEXT NOT NULL, operation_id TEXT NOT NULL,
    input_json TEXT NOT NULL, writes_json TEXT NOT NULL, references_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(attempt_id, seq))`);
}

// The records a draft has touched, as they would be after it applies. `baseRevision` is the stored revision it started from.
export function draftOverlay(db, projectId, attemptId) {
  const overlay = new Map();
  for (const row of db.prepare('SELECT writes_json FROM layer_run_drafts WHERE attempt_id = ? AND project_id = ? ORDER BY seq').all(attemptId, projectId))
    for (const write of JSON.parse(row.writes_json)) {
      const previous = overlay.get(write.id);
      const created = previous ? previous.created : write.op === 'create';
      // Deleting a record this draft created leaves nothing to apply.
      if (write.op === 'delete' && created) { overlay.delete(write.id); continue; }
      overlay.set(write.id, { id: write.id, kind: write.kind, data: write.op === 'delete' ? null : write.data, created, deleted: write.op === 'delete',
        revision: previous ? previous.revision : write.baseRevision ?? 0, baseRevision: previous ? previous.baseRevision : write.baseRevision ?? null,
        ...(write.parentId || previous?.parentId ? { parentId: write.parentId || previous.parentId } : {}) });
    }
  return overlay;
}

export function stageOperation({ db, catalogs, api, projectId, attemptId, operationId, id = null, body = {} }) {
  const overlay = draftOverlay(db, projectId, attemptId);
  const called = callOperation({ db, catalogs, api, projectId, operationId, id, body, overlay });
  if (called.result !== undefined) return { operationId, result: called.result };
  const seq = (db.prepare('SELECT MAX(seq) AS seq FROM layer_run_drafts WHERE attempt_id = ? AND project_id = ?').get(attemptId, projectId)?.seq ?? 0) + 1;
  if (seq > 200) fail('This run has staged the most changes one review can hold.');
  db.prepare('INSERT INTO layer_run_drafts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(attemptId, seq, projectId, api.key, operationId,
    JSON.stringify({ id, body }), JSON.stringify(called.writes), JSON.stringify(called.references), now());
  const [write] = called.writes;
  return { operationId, staged: { id: write.id, kind: write.kind, op: write.op, data: write.data ?? null }, writes: called.writes.map(entry => ({ id: entry.id, kind: entry.kind, op: entry.op })),
    draft: draftChanges(db, projectId, attemptId).map(change => ({ id: change.id, kind: change.kind, op: change.op })) };
}

// What review shows: each touched record before and after.
export function draftChanges(db, projectId, attemptId) {
  const revision = (id, number) => JSON.parse(db.prepare('SELECT data_json FROM knowledge_revisions WHERE record_id = ? AND revision = ?').get(id, number)?.data_json || 'null');
  return [...draftOverlay(db, projectId, attemptId).values()].map(entry => ({ id: entry.id, kind: entry.kind, op: entry.created ? 'create' : entry.deleted ? 'delete' : 'update',
    baseRevision: entry.baseRevision, before: entry.created ? null : revision(entry.id, entry.baseRevision), after: entry.data, ...(entry.parentId ? { parentId: entry.parentId } : {}) }));
}

// Stale if any record the draft changes moved on, or a reference it relies on is gone.
export function checkDraftCurrent(db, api, projectId, attemptId) {
  const overlay = draftOverlay(db, projectId, attemptId);
  for (const entry of overlay.values()) {
    const current = stored(db, projectId, api.key, entry.id);
    if (entry.created ? current : current?.revision !== entry.baseRevision) fail('A record this run changes was changed since. Send it back for a fresh run.', 409);
  }
  checkReferences(db, api, projectId, db.prepare('SELECT references_json FROM layer_run_drafts WHERE attempt_id = ? AND project_id = ?').all(attemptId, projectId)
    .flatMap(row => JSON.parse(row.references_json)), overlay);
  return overlay;
}
