import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const sha = value => createHash('sha256').update(value).digest('hex');
const dir = mkdtempSync(join(tmpdir(), 'machine-d03-reconcile-'));
const path = join(dir, 'proof.sqlite');
const backup = join(dir, 'before-apply.sqlite');
const db = new DatabaseSync(path);
db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE projects(id TEXT PRIMARY KEY);
CREATE TABLE plan_records(project_id TEXT,id TEXT,revision INTEGER,title TEXT,lifecycle TEXT,provenance TEXT,PRIMARY KEY(project_id,id));
CREATE TABLE source_assertions(project_id TEXT,logical_key TEXT,source_path TEXT,source_hash TEXT,claim TEXT,PRIMARY KEY(project_id,logical_key,source_path));
CREATE TABLE reconciliation_batches(id TEXT PRIMARY KEY,project_id TEXT,input_digest TEXT UNIQUE,status TEXT);
CREATE TABLE plan_work_links(project_id TEXT,plan_id TEXT,work_id TEXT,relation TEXT,PRIMARY KEY(project_id,plan_id,work_id));
INSERT INTO projects VALUES ('the-machine'),('borrowbox');`);
db.close(); copyFileSync(path, backup);

const mappings=[
 {id:'B-02',title:'Product records and dependencies',lifecycle:'recorded-complete',claim:'complete within B-02 local boundary',source:'docs/execution-plan.md'},
 {id:'B-03A',title:'Supervised authorization bridge',lifecycle:'recorded-complete',claim:'complete within supervised-local boundary',source:'docs/status.md'},
 {id:'B-03',title:'Real run and preview review',lifecycle:'planned-blocked',claim:'full B-03 remains incomplete',source:'docs/execution-plan.md'},
 {id:'D-02',title:'Project workspace strategy',lifecycle:'submitted',claim:'link existing portal work; do not recreate events',source:'docs/status.md',work:'WORK-17d6c61a-3b7f-4a58-a382-f67f9e5c6a3b'}
];
const snapshot=mappings.map(m=>({...m,sourceHash:sha(readFileSync(m.source))}));
const digest=sha(JSON.stringify(snapshot));

function apply({rows=snapshot,failAfter=Infinity,batchId='batch-1'}={}){
 const cx=new DatabaseSync(path);cx.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
 try{
  const inputDigest=sha(JSON.stringify(rows));
  const existing=cx.prepare('SELECT id FROM reconciliation_batches WHERE input_digest=? AND status=?').get(inputDigest,'applied');
  if(existing){cx.exec('ROLLBACK');cx.close();return {replayed:true,created:0}}
  cx.prepare('INSERT INTO reconciliation_batches VALUES (?,?,?,?)').run(batchId,'the-machine',inputDigest,'applying');
  let created=0;
  for(const [index,m] of rows.entries()){
   if(sha(readFileSync(m.source))!==m.sourceHash)throw new Error('stale source');
   cx.prepare('INSERT INTO source_assertions VALUES (?,?,?,?,?)').run('the-machine',m.id,m.source,m.sourceHash,m.claim);
   cx.prepare('INSERT INTO plan_records VALUES (?,?,?,?,?,?)').run('the-machine',m.id,1,m.title,m.lifecycle,`source:${m.source}`);
   if(m.work)cx.prepare('INSERT INTO plan_work_links VALUES (?,?,?,?)').run('the-machine',m.id,m.work,'represented-by-existing-work');
   created++;if(index+1===failAfter)throw new Error('injected failure');
  }
  cx.prepare('UPDATE reconciliation_batches SET status=? WHERE id=?').run('applied',batchId);cx.exec('COMMIT');cx.close();return {replayed:false,created};
 }catch(error){cx.exec('ROLLBACK');cx.close();throw error}
}

assert.throws(()=>apply({failAfter:2,batchId:'failure'}),/injected failure/);
let check=new DatabaseSync(path,{readOnly:true});assert.equal(check.prepare('SELECT count(*) n FROM plan_records').get().n,0);check.close();
assert.deepEqual(apply(),{replayed:false,created:4});
assert.deepEqual(apply(),{replayed:true,created:0});
check=new DatabaseSync(path);assert.equal(check.prepare('SELECT count(*) n FROM plan_records').get().n,4);assert.equal(check.prepare('SELECT count(*) n FROM plan_work_links').get().n,1);
assert.equal(check.prepare('SELECT * FROM plan_records WHERE project_id=? AND id=?').get('borrowbox','B-02'),undefined);
check.close();
const stale=snapshot.map(x=>({...x}));stale[0].sourceHash='0'.repeat(64);assert.throws(()=>apply({rows:stale,batchId:'stale'}),/stale source/);
const after=new DatabaseSync(path,{readOnly:true});assert.equal(after.prepare('SELECT count(*) n FROM plan_records').get().n,4);after.close();
copyFileSync(backup,path);const restored=new DatabaseSync(path,{readOnly:true});assert.equal(restored.prepare('SELECT count(*) n FROM plan_records').get().n,0);restored.close();
const report={status:'pass',temporaryDirectory:'fresh mkdtemp directory removed by the host later',cases:{failureAtomicity:true,firstApplyCreated:4,idempotentReplayCreated:0,changedSourceRejected:true,projectScopedLookup:true,existingWorkLinkedNotRecreated:true,backupRestoreReturnedPlanCount:0},limitations:['Disposable schema proof, not production portal migration','Source hashes prove exact local inputs; no Git identity available','No live portal database opened or modified']};
writeFileSync(new URL('./reconciliation-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
