import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { loadCatalogs } from '../server/onboarding.mjs';
import { initLayerContract, layerInstanceId } from '../server/layer-contract.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { pagesPackageForProject } from '../server/layer-package.mjs';
import { runPagesFlowCandidate } from '../server/pages-flow-runner.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);

test('reviewed Pages source runs on a disposable real flow and matches the host validator', () => {
  const data = mkdtempSync(join(tmpdir(), 'aludel-pages-flow-runner-'));
  const oldDir = process.env.MACHINE_DATA_DIR, oldEnabled = process.env.MACHINE_PAGES_TEMPLATE_ENABLED;
  process.env.MACHINE_DATA_DIR = data;
  process.env.MACHINE_PAGES_TEMPLATE_ENABLED = '1';
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
      CREATE TABLE project_setup(project_id TEXT PRIMARY KEY);
      CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
      INSERT INTO projects VALUES ('one'),('two');
      INSERT INTO project_members VALUES ('one','owner','owner'),('two','owner','owner');`);
    initKnowledge(db);
    initLayerContract(db);
    initPagesLayerApp(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const page = know.insert('one','page',{label:'Browse',icon:'article',pageType:'list',status:'planned'});
    const second = know.insert('one','page',{label:'Detail',icon:'article',pageType:'detail',status:'planned'});
    const persona = know.insert('one','persona',{name:'Shopper'});
    const activity = know.insert('one','activity',{title:'Explore'});
    const flow = know.insert('one','flow',{title:'Browse',activity:activity.id,persona:persona.id,steps:[{page:page.id,name:'Browse'}]});
    const instanceId = layerInstanceId(db,'one','pages');
    const current = { projectId:'one',layerInstanceId:instanceId,kind:'flow',id:flow.id,revision:flow.revision,
      data:JSON.parse(db.prepare('SELECT data_json FROM knowledge_records WHERE id=?').get(flow.id).data_json) };
    const pages = [page,second].map(record => ({projectId:'one',layerInstanceId:instanceId,kind:'page',id:record.id,revision:record.revision}));
    const personas = [{projectId:'one',layerInstanceId:null,kind:'persona',id:persona.id,revision:persona.revision}];
    const activities = [{projectId:'one',layerInstanceId:null,kind:'activity',id:activity.id,revision:activity.revision}];
    const input = {workId:'wrk-1',current,pages,personas,activities,next:{title:'Browse and inspect',steps:[
      {page:page.id,name:'Browse'},{page:second.id,name:'Inspect',trigger:'Open detail'}]}};
    const change = runPagesFlowCandidate(db,'one','propose',input);
    const reviewed = runPagesFlowCandidate(db,'one','review',{change,current,pages,personas,activities});
    assert.equal(change.sourceCommit,pagesPackageForProject(db,'one').commit);
    assert.equal(change.layerInstanceId,instanceId);
    assert.equal(reviewed.target.acceptedRevision,flow.revision+1);
    assert.deepEqual(runPagesFlowCandidate(db,'one','review',{change,current,pages,personas,activities}),reviewed);
    assert.equal(know.get('one',flow.id).revision,flow.revision,'review does not write output');
    const host = know.update('one',flow.id,reviewed.after,{expectedRevision:flow.revision});
    assert.deepEqual(JSON.parse(db.prepare('SELECT data_json FROM knowledge_records WHERE id=?').get(flow.id).data_json),reviewed.after);
    assert.equal(host.revision,reviewed.target.acceptedRevision);
    assert.throws(()=>runPagesFlowCandidate(db,'one','review',{change,current:{...current,revision:host.revision},pages,personas,activities}),/base revision changed/);
    assert.throws(()=>runPagesFlowCandidate(db,'one','review',{change,current,pages:[{...pages[0],revision:2},pages[1]],personas,activities}),/referenced flow input revision changed/);
    assert.throws(()=>runPagesFlowCandidate(db,'one','propose',{...input,layerInstanceId:layerInstanceId(db,'two','pages')}),/does not match/);
    assert.throws(()=>runPagesFlowCandidate(db,'one','propose',{...input,sourceCommit:'a'.repeat(40)}),/does not match/);
    assert.throws(()=>runPagesFlowCandidate(db,'one','review',{change:{...change,digest:'bad'},current,pages,personas,activities}),/altered/);
    assert.throws(()=>runPagesFlowCandidate(db,'one','review',{change,current,pages,personas:[{...personas[0],revision:2}],activities}),/referenced flow input revision changed/);
    const currentGap = {...current,revision:host.revision,data:JSON.parse(db.prepare('SELECT data_json FROM knowledge_records WHERE id=?').get(flow.id).data_json)};
    const gapInput = {workId:'wrk-2',current:currentGap,pages,personas,activities,next:{title:'Browse with gap',steps:[
      {page:null,persona:persona.id,name:'Missing decision page',why:'No page yet'},
      {page:second.id}]}};
    const gapChange = runPagesFlowCandidate(db,'one','propose',gapInput);
    const gapReview = runPagesFlowCandidate(db,'one','review',{change:gapChange,current:currentGap,pages,personas,activities});
    assert.equal(gapReview.after.steps[0].page,null);
    assert.equal(gapReview.after.steps[0].persona,persona.id);
    assert.equal(gapReview.after.steps[1].name,'');
    assert.equal(know.get('one',flow.id).revision,host.revision);
    know.update('one',flow.id,gapReview.after,{expectedRevision:host.revision});
    assert.deepEqual(JSON.parse(db.prepare('SELECT data_json FROM knowledge_records WHERE id=?').get(flow.id).data_json),gapReview.after);

    const pkg = pagesPackageForProject(db,'one');
    const sourcePath = join(pkg.repo,'server/flow-change.mjs');
    writeFileSync(sourcePath,readFileSync(sourcePath,'utf8') + '\n// New unreviewed rule source.\n');
    execFileSync('git',['-C',pkg.repo,'-c','user.name=Local Test','-c','user.email=local@test.invalid','commit','-am','Unreviewed flow source'],{stdio:'pipe'});
    const unreviewedCommit = execFileSync('git',['-C',pkg.repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
    db.prepare("UPDATE layer_package_bindings SET accepted_commit=? WHERE project_id='one' AND layer_key='pages'").run(unreviewedCommit);
    assert.throws(()=>runPagesFlowCandidate(db,'one','propose',input),/has not passed host review/);
    db.prepare("UPDATE layer_package_bindings SET accepted_commit=? WHERE project_id='one' AND layer_key='pages'")
      .run('e88409c78e790e8d4fdccc2ef4db043b6d3c39d3');
    const legacy = runPagesFlowCandidate(db,'one','propose',{...input,sourceCommit:undefined});
    assert.equal(legacy.sourceCommit,'e88409c78e790e8d4fdccc2ef4db043b6d3c39d3');

  } finally {
    db.close(); rmSync(data,{recursive:true,force:true});
    if (oldDir === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = oldDir;
    if (oldEnabled === undefined) delete process.env.MACHINE_PAGES_TEMPLATE_ENABLED; else process.env.MACHINE_PAGES_TEMPLATE_ENABLED = oldEnabled;
  }
});

test('runner permission flags deny file reads, writes and subprocesses', () => {
  for (const code of ["require('node:fs').readFileSync('/etc/hosts')", "require('node:fs').writeFileSync('/tmp/aludel-forbidden-write', 'x')", "require('node:child_process').execFileSync('true')"]) {
    const result = spawnSync(process.execPath,['--permission','-e',code],{encoding:'utf8',timeout:2000});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/restricted|permission/i);
  }
});
