import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initLayerContract, createLayerInstances, layerDescriptors, layerOutputRead, layerMigrationInventory, validateLayerDeclarations } from '../server/layer-contract.mjs';

const directory = mkdtempSync(join(tmpdir(), 'lat02-'));
const sourcePath = join(directory, 'source.sqlite');
const copyPath = join(directory, 'copy.sqlite');
const db = new DatabaseSync(sourcePath);
test.after(() => { db.close(); rmSync(directory, { recursive: true, force: true }); });
db.exec(`
  CREATE TABLE projects (id TEXT PRIMARY KEY);
  CREATE TABLE project_members (project_id TEXT, user_id TEXT);
  CREATE TABLE knowledge_records (id TEXT PRIMARY KEY, project_id TEXT, kind TEXT, revision INTEGER, data_json TEXT);
  CREATE TABLE layer_work_items (project_id TEXT);
  CREATE TABLE routine_runs (project_id TEXT);
  CREATE TABLE code_units (id TEXT, project_id TEXT, hash TEXT);
  CREATE TABLE trace_links (id TEXT, project_id TEXT, updated_at TEXT);
  CREATE TABLE code_releases (id TEXT, project_id TEXT, commit_sha TEXT);
  CREATE TABLE releases (id TEXT, project_id TEXT, state TEXT);
  INSERT INTO projects VALUES ('a'), ('b');
  INSERT INTO project_members VALUES ('a', 'owner'), ('b', 'other');
  INSERT INTO knowledge_records VALUES ('page-a', 'a', 'page', 3, '{"title":"A"}'), ('page-b', 'b', 'page', 7, '{"title":"B"}'), ('story-a', 'a', 'story', 2, '{}');
  INSERT INTO code_units VALUES ('unit-a', 'a', 'abc');
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
  db.prepare('INSERT INTO project_members(project_id,user_id) VALUES (?,?)').run('c', 'owner');
  assert.equal(createLayerInstances(db, 'c'), 6);
  assert.equal(createLayerInstances(db, 'c'), 0);
  assert.equal(layerDescriptors(db, 'owner', 'c').length, 6);
  assert.equal(layerDescriptors(db, 'owner', 'a').find(layer => layer.key === 'pages').outputs.find(output => output.kind === 'page').count, 1);
  assert.deepEqual(layerOutputRead(db, 'owner', 'a', 'pages', 'page', 'page-a').data, { title: 'A' });
  assert.match(layerOutputRead(db, 'owner', 'a', 'platform', 'code_unit', 'unit-a').revision, /^[a-f0-9]{64}$/);
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
