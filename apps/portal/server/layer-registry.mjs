// One project-scoped definition contract. Built-in definitions are seeded with
// native adapters; owner-created Markdown definitions use the same reader.
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const parse=value=>JSON.parse(value);
const keyPattern=/^[a-z][a-z0-9_]{2,31}$/;
export function initLayerRegistry(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_definitions (
    project_id TEXT NOT NULL REFERENCES projects(id), layer_key TEXT NOT NULL,
    name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, icon TEXT NOT NULL,
    path TEXT NOT NULL, authority TEXT NOT NULL, output_provider TEXT NOT NULL,
    editor_adapter TEXT NOT NULL, output_kinds_json TEXT NOT NULL, built_in INTEGER NOT NULL,
    descriptor_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
    PRIMARY KEY(project_id,layer_key), UNIQUE(project_id,path)
  )`);
}
export function seedBuiltInDefinitions(db,projectId,declarations,presentation) {
  initLayerRegistry(db);
  const insert=db.prepare(`INSERT INTO layer_definitions(project_id,layer_key,name,description,category,icon,path,authority,output_provider,editor_adapter,output_kinds_json,built_in,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,layer_key) DO NOTHING`);
  const at=new Date().toISOString();
  for(const layer of declarations){const [category,icon,description]=presentation[layer.key];
    insert.run(projectId,layer.key,layer.name,description,category,icon,layer.path,layer.authority,
      layer.authority,`native:${layer.key}`,JSON.stringify(layer.outputs),1,at);}
}
const decode=row=>row&&({key:row.layer_key,name:row.name,description:row.description,category:row.category,icon:row.icon,path:row.path,
  authority:row.authority,outputProvider:row.output_provider,editorAdapter:row.editor_adapter,outputs:parse(row.output_kinds_json),
  builtIn:!!row.built_in,version:row.descriptor_version});
export function projectLayerDefinition(db,projectId,key) {
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='layer_definitions'").get())return null;
  return decode(db.prepare('SELECT * FROM layer_definitions WHERE project_id=? AND layer_key=?').get(projectId,key));
}
export function projectLayerDefinitions(db,projectId){
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='layer_definitions'").get())return [];
  return db.prepare('SELECT * FROM layer_definitions WHERE project_id=? ORDER BY rowid').all(projectId).map(decode);
}
export function createMarkdownDefinition(db,userId,projectId,input) {
  const member=db.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id=?").get(projectId,userId);
  if(!member)fail('Project not found.',404);
  if(member.role!=='owner')fail('Project owner required.',403);
  const name=typeof input?.name==='string'?input.name.trim():'';
  if(name.length<2||name.length>60)fail('Layer name must be 2–60 characters.');
  const description=typeof input.description==='string'?input.description.trim():'';
  if(description.length>300)fail('Description is too long.');
  const proposed=typeof input.key==='string'&&input.key.trim()?input.key.trim().toLowerCase():name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const key=proposed;
  if(!keyPattern.test(key))fail('Choose a key with 3–32 lowercase letters, numbers or underscores, starting with a letter.');
  initLayerRegistry(db);
  if(projectLayerDefinition(db,projectId,key))fail('This layer key is already used in the project.',409);
  if(projectLayerDefinitions(db,projectId).some(layer=>layer.name.toLowerCase()===name.toLowerCase()))fail('A layer with this name already exists.',409);
  const at=new Date().toISOString();
  db.exec('BEGIN');
  try{
    db.prepare(`INSERT INTO layer_definitions(project_id,layer_key,name,description,category,icon,path,authority,output_provider,editor_adapter,output_kinds_json,built_in,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(projectId,key,name,description||'A workspace of Markdown documents.','Custom','description',`/${key}`,
      'layer_files','markdown-files','markdown-editor',JSON.stringify(['markdown_document']),0,at);
    db.prepare('INSERT INTO layer_instances(project_id,layer_key,enabled,created_at) VALUES (?,?,1,?)').run(projectId,key,at);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return projectLayerDefinition(db,projectId,key);
}
// Instance actions are resolved from the same definition as the output/editor.
// The first format has a person-edit action and a read-only discovery action.
export function actionsForDefinition(definition) {
  if(!definition||definition.outputProvider!=='markdown-files')return [];
  const base={layer:definition.key,revision:1,permissions:{elevated:false,reads:[{layer:definition.key,kind:'markdown_document'}],fileReads:[],fileWrites:[],effects:['submit-report']},
    requiredInputs:[],optionalInputs:[],reviewer:'project-owner',applicability:'installed-layer'};
  return [
    {...base,id:`${definition.key}.edit`,key:'edit',title:'Edit Markdown output',purpose:'Create or revise Markdown documents in this layer through a checked Work item.',
      result:{owner:definition.key,kind:'markdown_document',operation:'edit'},adapter:'markdown_person_edit',humanRunnable:true,agentRunnable:false,initialAssignee:{dreamer:'human',planner:'human',tinkerer:'human'},
      checks:['Changed file paths and revisions are named','Markdown output was reviewed'],method:'Stage Work, start the assigned person run, edit this layer’s Markdown files, and submit exact file revisions for review.'},
    {...base,id:`${definition.key}.discover`,key:'discover',title:`Explore neighboring layers for ${definition.name}`,
      purpose:'Examine installed neighbors and propose receiving-layer connection policies.',result:{owner:'work',kind:'report',operation:'report'},
      adapter:'markdown_discover',humanRunnable:false,agentRunnable:true,initialAssignee:{dreamer:'agent',planner:'agent',tinkerer:'agent'},
      checks:['Source output identity and revision are cited','The receiving-layer use and uncertainty are explicit','No policy is activated without review'],
      method:'Inspect installed neighbors and exact outputs, then propose receiving policies in Work. Do not activate a policy.'}
  ];
}
export function actionForProject(db,projectId,actionId) {
  if(typeof actionId!=='string'||!actionId.includes('.'))return null;
  const definition=projectLayerDefinition(db,projectId,actionId.split('.')[0]);
  return actionsForDefinition(definition).find(action=>action.id===actionId)||null;
}
