import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initLayerContract, createLayerInstances, layerDescriptors, layerOutputRead, updateLayerInstance } from '../server/layer-contract.mjs';
import { createMarkdownDefinition, saveLayerIdentity, addDomainAction, activateLayerDefinition, layerIdentityHistory } from '../server/layer-registry.mjs';
import { initMarkdownLayer, markdownTree, markdownFileCreate, markdownRead, markdownFileSave, markdownFileMove, markdownFolderCreate, markdownFolderMove } from '../server/markdown-layer.mjs';
import { activeLayerTopology, stageLayerDiscovery, discoverySourceSnapshot } from '../server/layer-discovery.mjs';
import { migrateActionProject, actionGrant, layerActionSettings } from '../server/lat08-migration.mjs';

test('two project-scoped Markdown layers use the common descriptor and isolated revisioned output', () => {
  const directory=mkdtempSync(join(tmpdir(),'aludel-markdown-'));
  const db=new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
      CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
      CREATE TABLE knowledge_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,parent_id TEXT,revision INTEGER,data_json TEXT);
      CREATE TABLE project_setup(project_id TEXT PRIMARY KEY,profile TEXT,created_by TEXT,workspace_path TEXT);
      CREATE TABLE layer_work_items(id TEXT PRIMARY KEY,project_id TEXT,layer TEXT,action TEXT,state TEXT,assignee_kind TEXT,assignee_id TEXT,context_json TEXT);
      CREATE TABLE routine_runs(project_id TEXT);
      INSERT INTO projects VALUES ('one'),('two');
      INSERT INTO project_setup VALUES ('one','planner','owner',NULL),('two','planner','other',NULL);
      INSERT INTO project_members VALUES ('one','owner','owner'),('one','reader','viewer'),('two','other','owner');`);
    initLayerContract(db);
    db.exec("UPDATE layer_instances SET enabled=0 WHERE layer_key!='product'");
    initMarkdownLayer(db);
    const research=createMarkdownDefinition(db,'owner','one',{name:'Research'});
    const notes=createMarkdownDefinition(db,'owner','one',{name:'Notes'});
    createMarkdownDefinition(db,'other','two',{name:'Research'});
    assert.equal(research.editorAdapter,'markdown-editor');
    assert.equal(research.lifecycle,'draft');
    assert.deepEqual(activeLayerTopology(db,'one').map(item=>item.key),['product']);
    const staged=[];const know={createWork(_project,input){const item={...input,id:`discovery-${staged.length+1}`};staged.push(item);return item;}};
    assert.deepEqual(stageLayerDiscovery(db,know,'one'),[],'drafts do not trigger neighbor Work');
    assert.throws(()=>activateLayerDefinition(db,'owner','one','research'),{status:409});
    const action=addDomainAction(db,'owner','one','research',{key:'add_source',title:'Add source',purpose:'Capture a research source with provenance.',
      method:'Read the source, record its claim and limitations, then place it in the source taxonomy.',checks:['Provenance is named','Uncertainty is recorded']});
    assert.deepEqual(action.domainActions.map(item=>item.key),['add_source']);
    assert.throws(()=>activateLayerDefinition(db,'owner','one','research'),{status:409});
    const identity={purpose:'Maintain research evidence for this project.',scope:'Sources, analyses and synthesized findings; product decisions belong to Vision.',
      methodology:'Collect sources, assess reliability, analyze themes, then synthesize findings with citations.',
      outputConventions:'Sources live under sources/, analyses under analysis/, with provenance headings.',
      qualityBar:'Every finding cites a source and distinguishes observation from inference.',
      projectRole:'Provide evidence and uncertainty to product, design and implementation decisions.',
      collaboration:'Offer findings to neighboring layers, while their owners decide how to apply them.'};
    const described=saveLayerIdentity(db,'owner','one','research',{...identity,expectedRevision:0});
    assert.equal(described.identityRevision,1);
    assert.throws(()=>saveLayerIdentity(db,'owner','one','research',{...identity,expectedRevision:0}),{status:409});
    assert.equal(layerIdentityHistory(db,'owner','one','research')[0].revision,1);
    assert.equal(activateLayerDefinition(db,'owner','one','research').lifecycle,'active');
    assert.deepEqual(activeLayerTopology(db,'one').map(item=>item.key),['product','research']);
    assert.deepEqual(stageLayerDiscovery(db,know,'one').map(item=>item.layer).sort(),['product','research']);
    assert.deepEqual(stageLayerDiscovery(db,know,'one'),[]);
    saveLayerIdentity(db,'owner','one','research',{...identity,purpose:'Maintain reviewed research evidence for this project.',expectedRevision:1});
    assert.deepEqual(stageLayerDiscovery(db,know,'one').map(item=>item.layer).sort(),['product','research']);

    migrateActionProject(db,'one');
    assert.equal(actionGrant(db,{id:'owner'},'one','research.add_source').id,'research.add_source');
    assert.equal(actionGrant(db,{id:'owner'},'one','research.edit').id,'research.edit');
    assert.deepEqual(layerActionSettings(db,{id:'owner'},'one','notes').map(action=>action.id),['notes.discover']);
    assert.deepEqual(layerDescriptors(db,'owner','one').map(item=>item.key),['product','research','notes']);
    assert.deepEqual(layerDescriptors(db,'other','two').map(item=>item.key),['product','research']);
    assert.throws(()=>createMarkdownDefinition(db,'reader','one',{name:'Private'}),{status:403});
    assert.throws(()=>createMarkdownDefinition(db,'owner','one',{name:'Research'}),{status:409});
    markdownFolderCreate(db,directory,'owner','one','research','field');
    const first=markdownFileCreate(db,directory,'owner','one','research','field/interview.md','# First');
    assert.equal(first.revision,1);
    assert.throws(()=>markdownRead(db,directory,'other','two','research',first.id),{status:404});
    assert.throws(()=>markdownRead(db,directory,'owner','one','notes',first.id),{status:404});
    assert.throws(()=>markdownFileSave(db,directory,'reader','one','research',first.id,{expectedRevision:1,content:'changed'}),{status:403});
    assert.throws(()=>markdownFileSave(db,directory,'owner','one','research',first.id,{expectedRevision:0,content:'changed'}),{status:409});
    const saved=markdownFileSave(db,directory,'owner','one','research',first.id,{expectedRevision:1,content:'# Second'});
    assert.equal(saved.revision,2);
    assert.equal(markdownRead(db,directory,'owner','one','research',first.id,1).content,'# First');
    assert.equal(layerOutputRead(db,'owner','one','research','markdown_document',first.id).revision,2);
    assert.equal(discoverySourceSnapshot(db,'one',['research'])[0].kinds[0].records[0].summary,'field/interview.md');
    markdownFolderCreate(db,directory,'owner','one','research','archive');
    const moved=markdownFileMove(db,directory,'owner','one','research',first.id,{expectedRevision:2,path:'archive/interview.md'});
    assert.equal(moved.revision,3);
    assert.deepEqual(markdownTree(db,directory,'owner','one','research').files.map(file=>file.path),['archive/interview.md']);
    assert.throws(()=>markdownFileCreate(db,directory,'owner','one','research','../escape.md'),{status:400});
    assert.throws(()=>markdownFileCreate(db,directory,'owner','one','research','archive/secret.txt'),{status:400});
    assert.throws(()=>markdownFileCreate(db,directory,'owner','one','research','archive/interview.md'),{status:409});
    markdownFolderMove(db,directory,'owner','one','research','archive','old');
    assert.equal(markdownTree(db,directory,'owner','one','research').files[0].path,'old/interview.md');
    const tree=markdownTree(db,directory,'owner','one','research');
    assert.ok(tree.folders.includes('old'));
    updateLayerInstance(db,'owner','one','research',{enabled:false});
    assert.throws(()=>markdownTree(db,directory,'owner','one','research'),{status:404});
    updateLayerInstance(db,'owner','one','research',{enabled:true});
    assert.equal(markdownRead(db,directory,'owner','one','research',first.id).path,'old/interview.md');
  } finally { db.close(); rmSync(directory,{recursive:true,force:true}); }
});
