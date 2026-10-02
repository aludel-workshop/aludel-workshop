import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initPagesLayerApp, pagesDocumentList, pagesDocumentRead, pagesDocumentUpdate, pagesConnections, pagesConnectionCreate, pagesConnectionUpdate } from '../server/pages-layer-app.mjs';

const db = new DatabaseSync(':memory:');
test.after(() => db.close());
db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
CREATE TABLE layer_instances(project_id TEXT,layer_key TEXT,instance_id TEXT,enabled INTEGER);
INSERT INTO projects VALUES('a'),('b');
INSERT INTO project_members VALUES('a','owner','owner'),('a','viewer','viewer'),('b','other','owner');
INSERT INTO layer_instances VALUES('a','pages','pages-a',1),('a','product','product-a',1),('a','design','design-a',0),('b','pages','pages-b',1);`);
initPagesLayerApp(db);

test('Pages documents seed once, retain exact revisions and owner scope', () => {
  const docs = pagesDocumentList(db, 'owner', 'a');
  assert.equal(docs.length, 8);
  assert.ok(docs.some(doc => doc.key === 'connection-method' && doc.groupName === 'connections'));
  const first = pagesDocumentRead(db, 'owner', 'a', 'map');
  const saved = pagesDocumentUpdate(db, 'owner', 'a', 'map', { content: 'A revised Pages map contract.', expectedRevision: 1 });
  assert.equal(saved.revision, 2);
  assert.equal(pagesDocumentRead(db, 'owner', 'a', 'map', 1).content, first.content);
  assert.equal(pagesDocumentRead(db, 'viewer', 'a', 'map', 2).content, saved.content);
  assert.throws(() => pagesDocumentUpdate(db, 'viewer', 'a', 'map', { content: 'No', expectedRevision: 2 }), { status: 403 });
  assert.throws(() => pagesDocumentUpdate(db, 'owner', 'a', 'map', { content: 'Stale', expectedRevision: 1 }), { status: 409 });
  assert.throws(() => pagesDocumentRead(db, 'other', 'a', 'map'), { status: 404 });
  assert.equal(pagesDocumentList(db, 'owner', 'a').find(item => item.key === 'map').revision, 2);
});

test('connection proposal needs an installed source and review; removal retains it', () => {
  assert.throws(() => pagesConnectionCreate(db, 'owner', 'a', 'design'), { status: 400 });
  const draft = pagesConnectionCreate(db, 'owner', 'a', 'product');
  assert.equal(draft.status, 'proposed');
  assert.throws(() => pagesConnectionUpdate(db, 'owner', 'a', draft.id, { expectedRevision: 1, status: 'active' }), { status: 409 });
  const active = pagesConnectionUpdate(db, 'owner', 'a', draft.id, { expectedRevision: 1, status: 'active', instructions: 'Use reviewed story references.' });
  assert.equal(active.status, 'active');
  assert.equal(active.revision, 2);
  assert.ok(active.reviewedBy);
  db.prepare("UPDATE layer_instances SET enabled = 0 WHERE project_id = 'a' AND layer_key = 'product'").run();
  assert.equal(pagesConnections(db, 'viewer', 'a')[0].sourceAvailable, false);
  assert.throws(() => pagesConnectionUpdate(db, 'owner', 'a', draft.id, { expectedRevision: 2, status: 'active' }), { status: 409 });
  db.prepare("UPDATE layer_instances SET enabled = 0 WHERE project_id = 'a' AND layer_key = 'pages'").run();
  assert.throws(() => pagesDocumentList(db, 'owner', 'a'), { status: 404 });
});
