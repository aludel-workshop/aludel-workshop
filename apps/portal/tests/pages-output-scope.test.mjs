import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { loadCatalogs } from '../server/onboarding.mjs';
import { initLayerContract, layerInstanceId, layerOutputRead } from '../server/layer-contract.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);

test('Pages legacy outputs and tombstones backfill exact instance scope, and current writes preserve it', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
      CREATE TABLE project_setup(project_id TEXT PRIMARY KEY);
      CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
      INSERT INTO projects VALUES ('a'),('b');
      INSERT INTO project_members VALUES ('a','owner','owner'),('b','other','owner');`);
    initKnowledge(db);
    const stamp = '2026-09-29T00:00:00.000Z';
    db.prepare(`INSERT INTO knowledge_records(id,project_id,kind,parent_id,position,data_json,revision,created_at,updated_at)
      VALUES ('pag-old','a','page',NULL,0,?,2,?,?)`).run(JSON.stringify({ label: 'Old page', stories: [], links: [], sections: [] }),stamp,stamp);
    db.prepare(`INSERT INTO knowledge_revisions(record_id,revision,data_json,author,created_at)
      VALUES ('pag-old',1,'{}','owner',?),('pag-old',2,'{}','owner',?),('flw-deleted',1,'{}','owner',?)`).run(stamp,stamp,stamp);
    db.prepare(`INSERT INTO knowledge_deletions(record_id,project_id,kind,parent_id,position,last_revision,data_json,deleted_at)
      VALUES ('flw-deleted','a','flow',NULL,0,1,'{}',?)`).run(stamp);
    initLayerContract(db);
    const a = layerInstanceId(db,'a','pages'), b = layerInstanceId(db,'b','pages');
    assert.notEqual(a,b);
    assert.equal(db.prepare("SELECT layer_instance_id FROM knowledge_records WHERE id='pag-old'").get().layer_instance_id,a);
    assert.deepEqual(db.prepare("SELECT DISTINCT layer_instance_id FROM knowledge_revisions WHERE record_id IN ('pag-old','flw-deleted')").all().map(row=>row.layer_instance_id),[a]);
    assert.equal(db.prepare("SELECT layer_instance_id FROM knowledge_deletions WHERE record_id='flw-deleted'").get().layer_instance_id,a);
    initLayerContract(db);
    assert.equal(layerOutputRead(db,'owner','a','pages','page','pag-old').revision,2);
    assert.throws(()=>layerOutputRead(db,'other','b','pages','page','pag-old'),{status:404});

    const know = knowledge({db,catalogs,packs:catalogs.packs});
    const page = know.insert('a','page',{label:'New page',icon:'article',pageType:'detail',status:'planned'});
    assert.equal(db.prepare('SELECT layer_instance_id FROM knowledge_records WHERE id=?').get(page.id).layer_instance_id,a);
    know.update('a',page.id,{notes:'Scoped revision'},{expectedRevision:1});
    assert.deepEqual(db.prepare('SELECT layer_instance_id FROM knowledge_revisions WHERE record_id=? ORDER BY revision').all(page.id).map(row=>row.layer_instance_id),[a,a]);
    db.prepare('UPDATE knowledge_records SET layer_instance_id=? WHERE id=?').run(b,page.id);
    assert.equal(know.get('a',page.id),null);
    assert.ok(!know.list('a','page').some(record=>record.id===page.id));
    assert.throws(()=>know.update('a',page.id,{notes:'Foreign'}),{status:404});
    assert.throws(()=>know.remove('a',page.id),{status:404});
    assert.throws(()=>layerOutputRead(db,'owner','a','pages','page',page.id),{status:404});
    assert.throws(()=>initLayerContract(db),/different instance/);
    db.prepare('UPDATE knowledge_records SET layer_instance_id=? WHERE id=?').run(a,page.id);
    know.remove('a',page.id);
    assert.equal(db.prepare('SELECT layer_instance_id FROM knowledge_deletions WHERE record_id=?').get(page.id).layer_instance_id,a);
  } finally { db.close(); }
});
