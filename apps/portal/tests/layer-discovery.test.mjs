import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { stageLayerDiscovery, discoverySourceSnapshot } from '../server/layer-discovery.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { applyDiscoveryProposal, layerDocumentList, layerDocumentRead, layerDocumentUpdate, layerConnectionCreate, layerConnectionUpdate } from '../server/layer-space.mjs';

function fixture(order) {
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
    INSERT INTO projects VALUES ('p1');
    CREATE TABLE layer_instances(project_id TEXT,layer_key TEXT,enabled INTEGER,descriptor_version INTEGER);
    CREATE TABLE knowledge_records(id TEXT,project_id TEXT,kind TEXT,revision INTEGER,data_json TEXT);
    CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
    INSERT INTO project_members VALUES ('p1','owner','owner'),('p1','viewer','viewer');`);
  const create=db.prepare('INSERT INTO layer_instances VALUES (?,?,1,1)');
  const issued=[];
  const know={createWork(projectId,input) { const item={...input,id:`work-${issued.length+1}`,projectId};issued.push(item);return item; }};
  create.run('p1',order[0]);
  assert.equal(stageLayerDiscovery(db,know,'p1').length,0);
  create.run('p1',order[1]);
  return {db,know,issued};
}
for (const order of [['product','pages'],['pages','product']]) test(`neighbor discovery is reciprocal and idempotent for ${order.join(' then ')}`,() => {
  const {db,know,issued}=fixture(order);
  const first=stageLayerDiscovery(db,know,'p1');
  assert.deepEqual(first.map(item=>item.layer).sort(),['pages','product']);
  assert.deepEqual(first.map(item=>item.action).sort(),['pages.discover','product.discover']);
  assert.ok(first.every(item=>item.context.discovery.sourceKeys.length===1 && item.state==='ready'));
  assert.deepEqual(stageLayerDiscovery(db,know,'p1'),[]);
  assert.equal(issued.length,2);
  db.prepare('INSERT INTO layer_instances VALUES (?,?,1,1)').run('p1','design');
  assert.equal(stageLayerDiscovery(db,know,'p1').length,3);
  assert.equal(stageLayerDiscovery(db,know,'p1').length,0);
  db.close();
});

test('source snapshot changes with an exact output revision',() => {
  const {db}=fixture(['product','pages']);
  const before=discoverySourceSnapshot(db,'p1',['product']);
  db.prepare('INSERT INTO knowledge_records VALUES (?,?,?,?,?)').run('s1','p1','story',1,'{"title":"Borrow a tool"}');
  const first=discoverySourceSnapshot(db,'p1',['product']);
  assert.notDeepEqual(first,before);
  db.prepare('UPDATE knowledge_records SET revision=2 WHERE id=?').run('s1');
  assert.notDeepEqual(discoverySourceSnapshot(db,'p1',['product']),first);
  db.close();
});

test('signed discovery output creates proposed documents and cannot overwrite active policy',() => {
  const {db}=fixture(['product','pages']);
  initPagesLayerApp(db);
  const proposal={sourceKey:'product',mapping:'candidate-input',instructions:'Inspect accepted stories.',reaction:'Reassess when a story changes.',question:'',answer:'',evidence:'Story s1 at revision 1.'};
  const [id]=applyDiscoveryProposal(db,'p1','pages',[proposal],'owner');
  const first=db.prepare('SELECT status,mapping,instructions,revision FROM layer_connections WHERE id=?').get(id);
  assert.equal(first.status,'proposed');assert.equal(first.mapping,'candidate-input');assert.equal(first.revision,2);
  assert.equal(first.instructions,proposal.instructions);
  db.prepare("UPDATE layer_connections SET status='active' WHERE id=?").run(id);
  assert.throws(()=>applyDiscoveryProposal(db,'p1','pages',[proposal],'owner'),/active connection/);
  assert.equal(db.prepare('SELECT revision FROM layer_connections WHERE id=?').get(id).revision,2);
  db.close();
});


test('non-Pages layers use the same revisioned Knowledge and connection contracts',() => {
  const {db}=fixture(['product','pages']);initPagesLayerApp(db);
  const docs=layerDocumentList(db,'owner','p1','product');
  assert.deepEqual([...new Set(docs.map(doc=>doc.groupName))],['outputs','methods','routines','connections','resources']);
  const doc=layerDocumentRead(db,'viewer','p1','product','connection-method');
  assert.equal(doc.revision,1);
  assert.throws(()=>layerDocumentUpdate(db,'viewer','p1','product',doc.key,{content:'Viewer edit',expectedRevision:1}),{status:403});
  const revised=layerDocumentUpdate(db,'owner','p1','product',doc.key,{content:'Review exact source output revisions.',expectedRevision:1});
  assert.equal(revised.revision,2);
  assert.equal(layerDocumentRead(db,'owner','p1','product',doc.key,1).content,doc.content);
  const draft=layerConnectionCreate(db,'owner','p1','product','pages');
  assert.equal(draft.status,'proposed');
  assert.throws(()=>layerConnectionUpdate(db,'owner','p1','product',draft.id,{expectedRevision:1,status:'active'}),{status:409});
  const active=layerConnectionUpdate(db,'owner','p1','product',draft.id,{expectedRevision:1,status:'active',instructions:'Use reviewed Pages maps as context.'});
  assert.equal(active.status,'active');
  db.close();
});
