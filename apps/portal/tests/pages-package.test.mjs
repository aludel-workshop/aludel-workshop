import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initLayerContract, layerInstances } from '../server/layer-contract.mjs';
import { pagesPackageForProject } from '../server/layer-package.mjs';
import { initPagesLayerApp, pagesDocumentRead } from '../server/pages-layer-app.mjs';

test('Pages installs separate pinned local repository copies and reads their declared tabs and Knowledge', () => {
  const data = mkdtempSync(join(tmpdir(), 'aludel-pages-package-'));
  const oldDir = process.env.MACHINE_DATA_DIR, oldEnabled = process.env.MACHINE_PAGES_TEMPLATE_ENABLED;
  process.env.MACHINE_DATA_DIR = data;
  process.env.MACHINE_PAGES_TEMPLATE_ENABLED = '1';
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
      CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
      CREATE TABLE knowledge_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,revision INTEGER,data_json TEXT);
      INSERT INTO projects VALUES ('one'),('two');
      INSERT INTO project_members VALUES ('one','owner','owner'),('two','owner','owner');`);
    assert.equal(initLayerContract(db).inserted, 12);
    initPagesLayerApp(db);
    const one = pagesPackageForProject(db, 'one'), two = pagesPackageForProject(db, 'two');
    assert.ok(one && two);
    assert.notEqual(one.repo, two.repo);
    assert.equal(one.commit, two.commit);
    assert.equal(one.manifest.key, 'pages');
    const definition = layerInstances(db, 'owner', 'one').find(layer => layer.key === 'pages');
    assert.equal(definition.packageCommit, one.commit);
    assert.equal(definition.editorAdapter, 'pages-native');
    assert.deepEqual(definition.outputTabs.map(tab => tab.label), ['Map', 'Pages', 'Flows']);
    assert.match(definition.identity.markdown, /A project may start directly in Pages without Vision/);
    assert.match(pagesDocumentRead(db, 'owner', 'one', 'flow').content, /without Vision/);
    const charterPath = join(one.repo, 'knowledge/charter.md');
    writeFileSync(charterPath, '# Unaccepted local edit\n');
    assert.match(readFileSync(charterPath, 'utf8'), /Unaccepted/);
    assert.match(pagesPackageForProject(db, 'one').charter, /A project may start directly in Pages without Vision/,
      'working-tree edits do not change the accepted package commit');
    assert.equal(initLayerContract(db).inserted, 0);
    assert.equal(pagesPackageForProject(db, 'one').commit, one.commit);
  } finally {
    db.close(); rmSync(data, { recursive: true, force: true });
    if (oldDir === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = oldDir;
    if (oldEnabled === undefined) delete process.env.MACHINE_PAGES_TEMPLATE_ENABLED; else process.env.MACHINE_PAGES_TEMPLATE_ENABLED = oldEnabled;
  }
});
