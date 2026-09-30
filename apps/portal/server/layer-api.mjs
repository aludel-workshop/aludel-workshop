// PAGES-API-01: a layer's API is its output contract. The installed layer source publishes an OpenAPI 3.1 document and a
// handler module; the host validates every request and every normalized record against the document, runs only a
// reviewed handler source in a limited child process, keeps writes inside this layer's outputs and instance, and
// resolves the references the handler reports. People's calls apply at once; an agent's calls stage in its run's draft.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { layerPackageForProject } from './layer-package.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const reviewedSources = JSON.parse(readFileSync(new URL('../config/layer-reviewed-sources.json', import.meta.url), 'utf8'));
const methods = ['get', 'post', 'put', 'patch', 'delete'];
const cache = new Map();

const child = `
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; if (raw.length > 1048576) process.exit(3); });
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
  const read = path => {
    if (typeof path !== 'string' || !/^(?:api|server)\/[a-z][a-z0-9-]*\.(?:json|mjs)$/.test(path)) fail('Invalid layer API path.', 500);
    return execFileSync('git', ['-C', repo, 'show', `${commit}:${path}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  };
  const spec = JSON.parse(read(manifest.api.spec));
  const source = read(manifest.api.handler);
  // Each handler revision needs its own review before it can run; an unreviewed commit has no API.
  if (createHash('sha256').update(source).digest('hex') !== reviewedSources[key]?.[commit]?.[manifest.api.handler])
    fail(`The ${key} API handler at this commit has not passed host review.`, 409);
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
    const body = op.requestBody?.content?.['application/json']?.schema;
    operations.set(op.operationId, { operationId: op.operationId, method: method.toUpperCase(), path, summary: op.summary || '', description: op.description || '',
      output, access: op['x-aludel-access'] || 'normal', singleton: Boolean(op['x-aludel-singleton']), read: op['x-aludel-read'] || null,
      needsId: Boolean(op.parameters?.some(parameter => parameter.in === 'path' && parameter.name === 'id')),
      validate: body ? ajv.getSchema(pointer(['paths', path, method, 'requestBody', 'content', 'application/json', 'schema'])) : null });
  }
  const records = new Map(Object.entries(spec['x-aludel-records'] || {}).map(([kind, ref]) => [kind, ajv.getSchema(`layer${ref}`)]));
  const api = { key, commit, spec, source, operations, records };
  cache.set(cacheKey, api);
  return api;
}

// The installed layer's API, or null when its source publishes none (the host's own rules then apply).
export function layerApi(db, projectId, key) {
  let pkg;
  try { pkg = layerPackageForProject(db, projectId, key); } catch { return null; }
  if (!pkg?.manifest?.api) return null;
  return compile(key, pkg.repo, pkg.commit, pkg.manifest);
}

function handle(api, call, args) {
  const payload = JSON.stringify({ source: api.source, call, args });
  if (payload.length > 1048576) fail('The layer API input is too large.');
  const result = spawnSync(process.execPath, ['--permission', '--max-old-space-size=64', '-e', child],
    { input: payload, encoding: 'utf8', timeout: 3000, maxBuffer: 1048576, env: { PATH: process.env.PATH || '' } });
  if (result.error || result.status !== 0 || !result.stdout) fail('The layer API handler did not finish within its limits.', 500);
  const response = JSON.parse(result.stdout);
  if (!response.ok) fail(response.message, response.status);
  return response.value;
}

const handlerCatalogs = catalogs => ({ routeIcons: catalogs.routeIcons || [], pageTypes: Object.keys(catalogs.pageTypes || {}) });
function checkRecord(api, kind, data) {
  const validate = api.records.get(kind);
  if (!validate) fail(`The ${api.key} API has no schema for ${kind}.`, 500);
  if (!validate(data)) fail(message(validate.errors));
}

// The layer's rules for one record, used by every host path that writes this layer's outputs.
export function normalizeRecord(api, kind, data, catalogs) {
  const result = handle(api, 'normalize', [kind, data, { catalogs: handlerCatalogs(catalogs) }]);
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
    const record = staged ? { kind: staged.kind, instanceId: instance } : stored(db, projectId, api.key, id);
    if (!record || !kinds.includes(record.kind) || outputs.has(record.kind) && record.instanceId !== instance)
      fail(`A linked ${kinds[0].replace('_', ' ')} was not found.`, 404);
  }
}

function currentFor(db, api, projectId, operation, id, overlay) {
  const instance = instanceOf(db, projectId, api.key);
  const scoped = record => record && record.kind === operation.output && record.instanceId === instance ? record : null;
  if (operation.singleton) {
    const staged = [...(overlay?.values() || [])].find(entry => entry.kind === operation.output);
    if (staged) return staged;
    const row = db.prepare('SELECT id FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id = ? ORDER BY created_at LIMIT 1').get(projectId, operation.output, instance);
    return row ? scoped(stored(db, projectId, api.key, row.id)) : null;
  }
  if (!operation.needsId) return null;
  return overlay?.get(id) || scoped(stored(db, projectId, api.key, id)) || fail(`That ${operation.output.replace('_', ' ')} was not found.`, 404);
}

function read(db, api, projectId, operation, id, overlay) {
  const instance = instanceOf(db, projectId, api.key);
  const { kind, mode } = operation.read;
  const rows = db.prepare('SELECT id FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id = ? ORDER BY position, created_at').all(projectId, kind, instance)
    .map(row => stored(db, projectId, api.key, row.id));
  const all = [...rows.map(record => overlay?.get(record.id) || record), ...[...(overlay?.values() || [])].filter(entry => entry.kind === kind && entry.created)]
    .map(({ id: recordId, revision, data }) => ({ id: recordId, revision, data }));
  if (mode === 'list') return all;
  if (mode === 'singleton') return all[0] || null;
  return all.find(record => record.id === id) || fail(`That ${kind.replace('_', ' ')} was not found.`, 404);
}

// One call. Returns the read result, or the writes this call makes (not yet applied).
export function callOperation({ db, catalogs, api, projectId, operationId, id = null, body = {}, overlay = null, elevated = false }) {
  const operation = api.operations.get(operationId) || fail(`The ${api.key} API has no operation ${operationId}.`, 404);
  if (operation.needsId && (typeof id !== 'string' || !/^[a-z]+-[a-z0-9]{6,12}$/.test(id))) fail('This operation needs a record id.');
  if (operation.read) return { operation, result: read(db, api, projectId, operation, id, overlay) };
  if (operation.access === 'elevated' && !elevated) fail(`Elevated access to ${api.key} is required for ${operationId}.`, 403);
  if (operation.validate && !operation.validate(body)) fail(message(operation.validate.errors));
  const current = currentFor(db, api, projectId, operation, id, overlay);
  const { writes, references } = handle(api, 'run', [operationId, { id, body },
    { current: current && { id: current.id, kind: current.kind, revision: current.revision, data: current.data }, catalogs: handlerCatalogs(catalogs) }]);
  if (!Array.isArray(writes) || writes.length !== 1) fail('The layer API handler returned an invalid result.', 500);
  for (const write of writes) {
    if (write.kind !== operation.output || !['create', 'update'].includes(write.op) || typeof write.id !== 'string' || !/^[a-z]+-[a-z0-9]{6,12}$/.test(write.id))
      fail('The layer API handler wrote outside its operation.', 500);
    if (write.op === 'update' && (write.id !== current?.id || write.baseRevision !== current.revision)) fail('The layer API handler changed a record it did not load.', 500);
    if (write.op === 'create' && (current || stored(db, projectId, api.key, write.id) || overlay?.has(write.id))) fail('The layer API handler reused a record id.', 500);
    checkRecord(api, write.kind, write.data);
  }
  checkReferences(db, api, projectId, references, overlay);
  return { operation, writes, references };
}

// A person's call: runs the operation and applies its writes at once, through the same checks.
export function applyOperation({ db, know, api, projectId, operationId, id = null, body = {}, elevated = false, author, rationale = null, workItemId = null }) {
  const called = callOperation({ db, catalogs: know.catalogs, api, projectId, operationId, id, body, elevated });
  if (called.result !== undefined) return called.result;
  const [write] = called.writes;
  const prepared = { data: write.data, references: called.references };
  const record = write.op === 'create' ? know.insert(projectId, write.kind, write.data, { id: write.id, prepared, author, rationale, workItemId })
    : know.update(projectId, write.id, write.data, { expectedRevision: write.baseRevision, prepared, author, rationale, workItemId });
  return { id: record.id, revision: record.revision, data: write.data, record };
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
      overlay.set(write.id, { id: write.id, kind: write.kind, data: write.data, created: previous ? previous.created : write.op === 'create',
        revision: previous ? previous.revision : write.baseRevision ?? 0, baseRevision: previous ? previous.baseRevision : write.baseRevision ?? null });
    }
  return overlay;
}

export function stageOperation({ db, catalogs, api, projectId, attemptId, operationId, id = null, body = {} }) {
  const overlay = draftOverlay(db, projectId, attemptId);
  const called = callOperation({ db, catalogs, api, projectId, operationId, id, body, overlay });
  if (called.result !== undefined) return { operationId, result: called.result };
  const seq = (db.prepare('SELECT MAX(seq) AS seq FROM layer_run_drafts WHERE attempt_id = ?').get(attemptId)?.seq ?? 0) + 1;
  if (seq > 200) fail('This run has staged the most changes one review can hold.');
  db.prepare('INSERT INTO layer_run_drafts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(attemptId, seq, projectId, api.key, operationId,
    JSON.stringify({ id, body }), JSON.stringify(called.writes), JSON.stringify(called.references), now());
  const write = called.writes[0];
  return { operationId, staged: { id: write.id, kind: write.kind, op: write.op, data: write.data }, draft: draftChanges(db, projectId, attemptId).map(change => ({ id: change.id, kind: change.kind, op: change.op })) };
}

// What review shows: each touched record before and after.
export function draftChanges(db, projectId, attemptId) {
  const revision = (id, number) => JSON.parse(db.prepare('SELECT data_json FROM knowledge_revisions WHERE record_id = ? AND revision = ?').get(id, number)?.data_json || 'null');
  return [...draftOverlay(db, projectId, attemptId).values()].map(entry => ({ id: entry.id, kind: entry.kind, op: entry.created ? 'create' : 'update',
    baseRevision: entry.baseRevision, before: entry.created ? null : revision(entry.id, entry.baseRevision), after: entry.data }));
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
