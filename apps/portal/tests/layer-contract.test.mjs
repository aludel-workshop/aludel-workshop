import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initLayerContract, createLayerInstances, layerDescriptors, layerInstances, updateLayerInstance, layerOutputRead, layerMigrationInventory, validateLayerDeclarations, layerInstanceId } from '../server/layer-contract.mjs';

const directory = mkdtempSync(join(tmpdir(), 'lat02-'));
const sourcePath = join(directory, 'source.sqlite');
const copyPath = join(directory, 'copy.sqlite');
const db = new DatabaseSync(sourcePath);
test.after(() => { db.close(); rmSync(directory, { recursive: true, force: true }); });
db.exec(`
  CREATE TABLE projects (id TEXT PRIMARY KEY);
  CREATE TABLE project_members (project_id TEXT, user_id TEXT, role TEXT);
  CREATE TABLE knowledge_records (id TEXT PRIMARY KEY, project_id TEXT, kind TEXT, revision INTEGER, data_json TEXT);
  CREATE TABLE layer_work_items (project_id TEXT);
  CREATE TABLE routine_runs (project_id TEXT);
  CREATE TABLE code_units (id TEXT, project_id TEXT, hash TEXT);
  CREATE TABLE trace_links (id TEXT, project_id TEXT, updated_at TEXT);
  CREATE TABLE code_releases (id TEXT, project_id TEXT, commit_sha TEXT);
  CREATE TABLE releases (id TEXT, project_id TEXT, state TEXT);
  INSERT INTO projects VALUES ('a'), ('b');
  INSERT INTO project_members VALUES ('a', 'owner', 'owner'), ('a', 'viewer', 'viewer'), ('b', 'other', 'owner');
  INSERT INTO knowledge_records VALUES ('page-a', 'a', 'page', 3, '{"title":"A"}'), ('page-b', 'b', 'page', 7, '{"title":"B"}'), ('story-a', 'a', 'story', 2, '{}');
  INSERT INTO code_units VALUES ('unit-a', 'a', 'abc');
  INSERT INTO knowledge_records VALUES ('tokens-a', 'a', 'design_tokens', 4, '{"name":"Tokens"}'), ('object-a', 'a', 'data_object', 5, '{"name":"Orders"}');
  INSERT INTO code_releases VALUES ('code-release-a', 'a', 'commit-123');
  INSERT INTO releases VALUES ('release-a', 'a', 'unavailable');
`);

test('declarations reject unknown kinds, duplicate kinds and wrong authority', () => {
  assert.throws(() => validateLayerDeclarations([{ key: 'x', outputs: ['made_up'], authority: 'knowledge_records' }]));
  assert.throws(() => validateLayerDeclarations([{ key: 'x', outputs: ['source'], authority: 'knowledge_records' }]));
  assert.throws(() => validateLayerDeclarations([{ key: 'x', outputs: ['page'], authority: 'code_projection' }]));
  assert.throws(() => validateLayerDeclarations([{ key: 'x', outputs: ['release'], authority: 'code_projection' }]));
  assert.throws(() => validateLayerDeclarations([{ key: 'x', outputs: ['page'], authority: 'knowledge_records' }, { key: 'y', outputs: ['page'], authority: 'knowledge_records' }]));
});

test('migration is idempotent and scoped descriptors preserve native records', async () => {
  assert.equal(initLayerContract(db).inserted, 12);
  assert.equal(initLayerContract(db).inserted, 0);
  db.prepare('INSERT INTO projects(id) VALUES (?)').run('c');
  db.prepare('INSERT INTO project_members(project_id,user_id,role) VALUES (?,?,?)').run('c', 'owner', 'owner');
  assert.equal(createLayerInstances(db, 'c'), 6);
  assert.equal(createLayerInstances(db, 'c'), 0);
  assert.equal(layerDescriptors(db, 'owner', 'c').length, 6);
  assert.equal(layerDescriptors(db, 'owner', 'a').find(layer => layer.key === 'pages').outputs.find(output => output.kind === 'page').count, 1);
  assert.deepEqual(layerOutputRead(db, 'owner', 'a', 'pages', 'page', 'page-a').data, { title: 'A' });
  assert.match(layerOutputRead(db, 'owner', 'a', 'platform', 'code_unit', 'unit-a').revision, /^[a-f0-9]{64}$/);
  assert.equal(layerOutputRead(db, 'owner', 'a', 'design', 'design_tokens', 'tokens-a').revision, 4);
  assert.equal(layerOutputRead(db, 'owner', 'a', 'data', 'data_object', 'object-a').revision, 5);
  assert.match(layerOutputRead(db, 'owner', 'a', 'platform', 'code_release', 'code-release-a').revision, /^[a-f0-9]{64}$/);
  assert.match(layerOutputRead(db, 'owner', 'a', 'deploy', 'release', 'release-a').revision, /^[a-f0-9]{64}$/);
  for (const key of ['design', 'data', 'platform', 'deploy']) {
    const descriptor = layerDescriptors(db, 'owner', 'a').find(layer => layer.key === key);
    assert.ok(descriptor.actions.length, key);
    assert.ok(descriptor.actions.some(action => action.unavailableReason), key);
    assert.ok(descriptor.outputs.some(output => output.count > 0), key);
  }
  assert.throws(() => layerOutputRead(db, 'owner', 'a', 'pages', 'page', 'page-b'), { status: 404 });
  assert.throws(() => layerOutputRead(db, 'owner', 'a', 'pages', 'story', 'story-a'), { status: 404 });
  assert.throws(() => layerDescriptors(db, 'other', 'a'), { status: 404 });
  assert.throws(() => layerMigrationInventory(db, 'owner', 'b'), { status: 404 });
  const before = layerMigrationInventory(db, 'owner', 'a');
  assert.deepEqual(before.unmapped, []);
  await backup(db, copyPath);
  const copied = new DatabaseSync(copyPath);
  try {
    assert.equal(initLayerContract(copied).inserted, 0);
    const after = layerMigrationInventory(copied, 'owner', 'a');
    assert.deepEqual(after.knowledge, before.knowledge);
    assert.deepEqual(after.descriptors, before.descriptors);
  } finally { copied.close(); }
});

test('optional layer apps are owner-scoped and preserve native outputs across removal', () => {
  initLayerContract(db);
  db.prepare('INSERT INTO projects(id) VALUES (?)').run('empty');
  db.prepare('INSERT INTO project_members(project_id,user_id,role) VALUES (?,?,?)').run('empty', 'owner', 'owner');
  assert.equal(createLayerInstances(db, 'empty', undefined, []), 6);
  assert.equal(layerDescriptors(db, 'owner', 'empty').length, 0);
  assert.equal(initLayerContract(db).inserted, 0, 'startup backfill does not activate unselected apps');
  assert.equal(updateLayerInstance(db, 'owner', 'empty', 'pages', { enabled: true }).enabled, true);
  assert.deepEqual(layerDescriptors(db, 'owner', 'empty').map(layer => layer.key), ['pages']);
  assert.equal(updateLayerInstance(db, 'owner', 'a', 'pages', { enabled: false }).enabled, false);
  assert.throws(() => layerOutputRead(db, 'owner', 'a', 'pages', 'page', 'page-a'), { status: 404 });
  assert.equal(updateLayerInstance(db, 'owner', 'a', 'pages', { enabled: true }).enabled, true);
  assert.equal(layerOutputRead(db, 'owner', 'a', 'pages', 'page', 'page-a').revision, 3);
  assert.throws(() => updateLayerInstance(db, 'viewer', 'a', 'pages', { enabled: false }), { status: 403 });
  assert.throws(() => updateLayerInstance(db, 'other', 'a', 'pages', { enabled: false }), { status: 404 });
  assert.throws(() => updateLayerInstance(db, 'owner', 'a', 'library', { enabled: false }), { status: 404 });
  assert.throws(() => updateLayerInstance(db, 'owner', 'a', 'pages', { visible: false }), { status: 400 });
});


test('legacy layer rows gain stable, immutable instance IDs on restart', () => {
  const legacy = new DatabaseSync(':memory:');
  try {
    legacy.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
      INSERT INTO projects VALUES ('legacy');
      CREATE TABLE layer_instances (project_id TEXT NOT NULL, layer_key TEXT NOT NULL,
        enabled INTEGER NOT NULL, descriptor_version INTEGER NOT NULL DEFAULT 1,
        visible INTEGER NOT NULL DEFAULT 1, dashboard_visible INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, PRIMARY KEY(project_id,layer_key));
      INSERT INTO layer_instances(project_id,layer_key,enabled,created_at) VALUES ('legacy','pages',1,'2026-09-29');
      CREATE TABLE layer_package_bindings (project_id TEXT NOT NULL, layer_key TEXT NOT NULL,
        repository_path TEXT NOT NULL, accepted_commit TEXT NOT NULL, installed_at TEXT NOT NULL,
        PRIMARY KEY(project_id,layer_key));
      INSERT INTO layer_package_bindings VALUES ('legacy','pages','/tmp/old-pages',
        '0000000000000000000000000000000000000000','2026-09-29');`);
    initLayerContract(legacy);
    const id = layerInstanceId(legacy, 'legacy', 'pages');
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal(legacy.prepare('SELECT layer_instance_id FROM layer_package_bindings WHERE project_id=? AND layer_key=?')
      .get('legacy','pages').layer_instance_id, id);
    initLayerContract(legacy);
    assert.equal(layerInstanceId(legacy, 'legacy', 'pages'), id);
    assert.throws(() => legacy.prepare('UPDATE layer_instances SET instance_id=? WHERE project_id=? AND layer_key=?')
      .run('changed','legacy','pages'), /immutable/);
    assert.throws(() => layerInstanceId(legacy, 'other', 'pages'), { status: 404 });
    legacy.prepare('UPDATE layer_package_bindings SET layer_instance_id=? WHERE project_id=? AND layer_key=?')
      .run(layerInstanceId(legacy,'legacy','product'),'legacy','pages');
    assert.throws(() => initLayerContract(legacy), /no matching instance/);
  } finally { legacy.close(); }
});
