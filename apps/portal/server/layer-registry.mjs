import { readFileSync } from 'node:fs';
import { contrastRatio } from '../src/color.js';
import { initLayerPackages, ensureLayerPackage } from './layer-package.mjs';
// Project-scoped layer definitions share one lifecycle and output/action contract.
// Built-ins seed richer adapters; a Markdown layer begins as a draft definition.
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const parse=(value,fallback)=>{try{return value?JSON.parse(value):fallback;}catch{return fallback;}};
const keyPattern=/^[a-z][a-z0-9_]{2,31}$/;
const now=()=>new Date().toISOString();
const identityFields=['purpose','scope','methodology','outputConventions','qualityBar','projectRole','collaboration'];
const clean=(value,max,label)=>{if(typeof value!=='string'||value.length>max)fail(`${label} must be text under ${max} characters.`);return value.trim();};
const builtInIdentity={
  product:{purpose:'Define what the project should achieve and why.',scope:'Product direction, outcomes, brief claims, stories and acceptance.',methodology:'Turn owner intent and evidence into explicit claims, then refine stories through questions and review.',outputConventions:'Brief claims and stories have stable identities, revisions and evidence links.',qualityBar:'Claims distinguish evidence from assumptions; stories name testable outcomes.',projectRole:'Set direction for the project without dictating every downstream implementation detail.',collaboration:'Read other layers for feasibility and feedback; offer intent and acceptance as candidate inputs.'},
  design:{purpose:'Maintain the design system that gives the project coherent visual and interaction rules.',scope:'Tokens, components, brand assets and component behavior; page flow and layout belong to Pages.',methodology:'Define reusable rules, audit component contracts, and revise the system only when evidence shows a system-level need.',outputConventions:'Version tokens and component contracts with roles, states and usage evidence.',qualityBar:'Components are reusable, accessible and consistent with token roles.',projectRole:'Provide system constraints and reusable components that Pages and Code can apply.',collaboration:'Read Pages to find system gaps, not to copy each layout into the design system; Pages generally adapts layouts to the system.'},
  pages:{purpose:'Define the pages and flows people use to complete the product intent.',scope:'Page map, page specs, navigation, states, flows and layouts; reusable tokens and component contracts belong to Design.',methodology:'Map user goals into pages, specify behavior and states, and review flow coverage and accessibility.',outputConventions:'Pages and flows have stable IDs, revisions and links to the intent they serve.',qualityBar:'Flows are coherent and page states are explicit, accessible and reviewable.',projectRole:'Translate Vision and Design into usable screens that Code can implement.',collaboration:'Consume Design rules for layout/component choices and Vision for goals; report system gaps back to Design.'},
  data:{purpose:'Define the information the app stores and exposes.',scope:'Data objects, operations, access rules and services.',methodology:'Model concepts and operations from project needs, then review contracts and access.',outputConventions:'Objects and operations have stable names, fields, revisions and links.',qualityBar:'Contracts are coherent, access is explicit and changes are traceable.',projectRole:'Give Code and Pages a reliable information contract.',collaboration:'Read product and page needs as input; publish schemas and access constraints.'},
  platform:{purpose:'Observe and change the project implementation.',scope:'Repository code, tests, routes, documentation and build candidates.',methodology:'Use pinned project inputs, scoped changes and checks before owner review.',outputConventions:'Code revisions are identified by commits and source paths.',qualityBar:'Changes satisfy reviewed intent and pass relevant checks.',projectRole:'Realize layer contracts in an independent application.',collaboration:'Read accepted layer outputs, report code observations and seek clarification for conflicts.'},
  deploy:{purpose:'Manage environments and releases for the application.',scope:'Runtime environments, release candidates, deployments and operational state.',methodology:'Promote reviewed candidates through explicit checks and recovery steps.',outputConventions:'Release and environment observations cite exact versions and times.',qualityBar:'Changes are reversible, observable and owner-authorized.',projectRole:'Run the application safely after implementation.',collaboration:'Consume Code candidates and report runtime findings to their owners.'}
};
export function initLayerRegistry(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_definitions (
    project_id TEXT NOT NULL REFERENCES projects(id), layer_key TEXT NOT NULL,
    name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, icon TEXT NOT NULL,
    path TEXT NOT NULL, authority TEXT NOT NULL, output_provider TEXT NOT NULL,
    editor_adapter TEXT NOT NULL, output_kinds_json TEXT NOT NULL, built_in INTEGER NOT NULL,
    descriptor_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
    lifecycle TEXT NOT NULL DEFAULT 'active', identity_json TEXT, identity_revision INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(project_id,layer_key), UNIQUE(project_id,path)
  );
  CREATE TABLE IF NOT EXISTS layer_identity_revisions (
    project_id TEXT NOT NULL, layer_key TEXT NOT NULL, revision INTEGER NOT NULL,
    identity_json TEXT NOT NULL, author_id TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(project_id,layer_key,revision)
  );
  CREATE TABLE IF NOT EXISTS layer_custom_actions (
    project_id TEXT NOT NULL, layer_key TEXT NOT NULL, action_key TEXT NOT NULL,
    title TEXT NOT NULL, purpose TEXT NOT NULL, method TEXT NOT NULL, checks_json TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
    PRIMARY KEY(project_id,layer_key,action_key)
  );`);
  const columns=new Set(db.prepare('PRAGMA table_info(layer_definitions)').all().map(row=>row.name));
  if(!columns.has('lifecycle'))db.exec("ALTER TABLE layer_definitions ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'active'");
  if(!columns.has('identity_json'))db.exec('ALTER TABLE layer_definitions ADD COLUMN identity_json TEXT');
  if(!columns.has('identity_revision'))db.exec('ALTER TABLE layer_definitions ADD COLUMN identity_revision INTEGER NOT NULL DEFAULT 0');
  // A chosen colour overrides the layer's seeded palette entry; null keeps the default.
  if(!columns.has('color'))db.exec('ALTER TABLE layer_definitions ADD COLUMN color TEXT');
  if(!columns.has('output_tabs_json'))db.exec("ALTER TABLE layer_definitions ADD COLUMN output_tabs_json TEXT NOT NULL DEFAULT '[]'");
  if(!columns.has('package_commit'))db.exec('ALTER TABLE layer_definitions ADD COLUMN package_commit TEXT');
  initLayerPackages(db);
  // A layer created by the earlier editor-only candidate has no identity. Keep its files,
  // but withdraw it from neighbor discovery until the owner describes and activates it.
  db.exec("UPDATE layer_definitions SET lifecycle='draft' WHERE built_in=0 AND identity_revision=0 AND lifecycle='active'");
}
export function seedBuiltInDefinitions(db,projectId,declarations,presentation) {
  initLayerRegistry(db);
  const insert=db.prepare(`INSERT INTO layer_definitions(project_id,layer_key,name,description,category,icon,path,authority,output_provider,editor_adapter,output_kinds_json,built_in,created_at,lifecycle,identity_json,identity_revision)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,1) ON CONFLICT(project_id,layer_key) DO NOTHING`);
  const at=now();
  for(const layer of declarations){
    const pkg=ensureLayerPackage(db,projectId,layer.key);
    if(pkg && (pkg.manifest.authority!==layer.authority || JSON.stringify(pkg.manifest.outputs)!==JSON.stringify(layer.outputs))) throw new Error('Layer package output authority differs from the migration contract.');
    const manifest=pkg?.manifest;
    const [fallbackCategory,fallbackIcon,fallbackDescription]=presentation[layer.key];
    const identity=pkg?{...parseCharter(pkg.charter),markdown:pkg.charter}:builtInIdentity[layer.key];
    const category=manifest?.category||fallbackCategory,icon=manifest?.icon||fallbackIcon;
    const description=manifest?.description||fallbackDescription;
    insert.run(projectId,layer.key,manifest?.name||layer.name,description,category,icon,layer.path,layer.authority,
      manifest?.outputProvider||layer.authority,manifest?.editorAdapter||`native:${layer.key}`,JSON.stringify(layer.outputs),1,at,JSON.stringify(identity));
    db.prepare("UPDATE layer_definitions SET identity_json=?,identity_revision=1 WHERE project_id=? AND layer_key=? AND built_in=1 AND identity_revision=0")
      .run(JSON.stringify(identity),projectId,layer.key);
    if(pkg)db.prepare("UPDATE layer_definitions SET output_tabs_json=?,package_commit=? WHERE project_id=? AND layer_key=? AND built_in=1 AND package_commit IS NULL")
      .run(JSON.stringify(manifest.tabs),pkg.commit,projectId,layer.key);
    db.prepare('INSERT OR IGNORE INTO layer_identity_revisions VALUES (?,?,?,?,?,?)')
      .run(projectId,layer.key,1,JSON.stringify(identity),pkg?'pages-template':'built-in',at);
  }
}
const actionRows=(db,projectId,key)=>db.prepare('SELECT * FROM layer_custom_actions WHERE project_id=? AND layer_key=? ORDER BY rowid').all(projectId,key)
  .map(row=>({key:row.action_key,title:row.title,purpose:row.purpose,method:row.method,checks:parse(row.checks_json,[]),revision:row.revision}));
const decode=(db,row)=>row&&({key:row.layer_key,name:row.name,description:row.description,category:row.category,icon:row.icon,path:row.path,
  authority:row.authority,outputProvider:row.output_provider,editorAdapter:row.editor_adapter,outputs:parse(row.output_kinds_json,[]),
  color:row.color||null,builtIn:!!row.built_in,version:row.descriptor_version,lifecycle:row.lifecycle,identity:parse(row.identity_json,null),
  outputTabs:parse(row.output_tabs_json,[]),packageCommit:row.package_commit||null,
  identityRevision:row.identity_revision,domainActions:actionRows(db,row.project_id,row.layer_key)});
export function projectLayerDefinition(db,projectId,key) {
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='layer_definitions'").get())return null;
  return decode(db,db.prepare('SELECT * FROM layer_definitions WHERE project_id=? AND layer_key=?').get(projectId,key));
}
export function projectLayerDefinitions(db,projectId){
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='layer_definitions'").get())return [];
  return db.prepare('SELECT * FROM layer_definitions WHERE project_id=? ORDER BY rowid').all(projectId).map(row=>decode(db,row));
}
const owner=(db,userId,projectId)=>{const member=db.prepare('SELECT role FROM project_members WHERE project_id=? AND user_id=?').get(projectId,userId);
  if(!member)fail('Project not found.',404);if(member.role!=='owner')fail('Project owner required.',403);};
export function createMarkdownDefinition(db,userId,projectId,input) {
  owner(db,userId,projectId);
  const name=clean(input?.name,60,'Layer name');
  if(name.length<2)fail('Layer name must be 2–60 characters.');
  const proposed=typeof input.key==='string'&&input.key.trim()?input.key.trim().toLowerCase():name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const key=proposed;
  if(!keyPattern.test(key))fail('Choose a key with 3–32 lowercase letters, numbers or underscores, starting with a letter.');
  initLayerRegistry(db);
  if(projectLayerDefinition(db,projectId,key))fail('This layer key is already used in the project.',409);
  if(projectLayerDefinitions(db,projectId).some(layer=>layer.name.toLowerCase()===name.toLowerCase()))fail('A layer with this name already exists.',409);
  const at=now();
  db.exec('BEGIN');
  try{
    db.prepare(`INSERT INTO layer_definitions(project_id,layer_key,name,description,category,icon,path,authority,output_provider,editor_adapter,output_kinds_json,built_in,created_at,lifecycle)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')`).run(projectId,key,name,'Define this layer before connecting it to the project.','Custom','description',`/${key}`,
      'layer_files','markdown-files','markdown-editor',JSON.stringify(['markdown_document']),0,at);
    db.prepare('INSERT INTO layer_instances(project_id,layer_key,enabled,created_at) VALUES (?,?,1,?)').run(projectId,key,at);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return projectLayerDefinition(db,projectId,key);
}
// Layer presentation (Manage › Settings). Every layer, built-in or custom, is fully editable: any icon the portal's font
// subset can render, and any colour a white icon and label stay readable on (the active tile is solid colour).
export const layerIcons=JSON.parse(readFileSync(new URL('../src/icon-subset.json',import.meta.url),'utf8')).icons;
export const layerColors=['#6b35c9','#a8235a','#1f4fb8','#0b5d86','#0f7465','#2e7d32','#8a5a00','#b3401e','#9c2f8f','#475467'];
export const readableLayerColour=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)&&contrastRatio(value,'#ffffff')>=4.5;
export function saveLayerPresentation(db,userId,projectId,key,input){
  owner(db,userId,projectId);
  const current=projectLayerDefinition(db,projectId,key);
  if(!current)fail('Layer not found.',404);
  if(!input||typeof input!=='object')fail('Provide the layer presentation.');
  const name=input.name===undefined?current.name:clean(input.name,60,'Layer name');
  if(name.length<2)fail('Layer name must be 2–60 characters.');
  if(projectLayerDefinitions(db,projectId).some(layer=>layer.key!==key&&layer.name.toLowerCase()===name.toLowerCase()))fail('A layer with this name already exists.',409);
  const icon=input.icon===undefined?current.icon:input.icon;
  if(!layerIcons.includes(icon)&&icon!==current.icon)fail('Choose an icon from the list.');
  const color=input.color===undefined?current.color:input.color;
  if(color!==null&&!readableLayerColour(color))fail('Choose a colour that white text stays readable on (4.5:1 contrast).');
  db.prepare('UPDATE layer_definitions SET name=?,icon=?,color=?,descriptor_version=descriptor_version+1 WHERE project_id=? AND layer_key=?').run(name,icon,color?.toLowerCase()??null,projectId,key);
  return projectLayerDefinition(db,projectId,key);
}
// Identity is Knowledge (CUSTOM-LAYER-01): every layer's charter is one Markdown document. Suggested headings seed it;
// the named sections feed the activation checklist and neighbor discovery, and any extra headings are kept as written.
export const charterSections={purpose:'Purpose',scope:'Contents and scope',methodology:'Methodology',outputConventions:'Output conventions and taxonomy',
  qualityBar:'Quality bar',projectRole:'Role in the project',collaboration:'How this layer works with others'};
const charterPrompts={purpose:'What is this layer trying to achieve?',scope:'What belongs here, and what belongs in other layers?',
  methodology:'How are these outputs developed, reviewed and revised?',outputConventions:'What shapes, folders, headings, labels, keywords or metadata do outputs follow?',
  qualityBar:'What makes an output trustworthy or ready for others to rely on?',projectRole:'What does this layer contribute to the whole project?',
  collaboration:'What does it read from other layers, what does it publish, and what does it deliberately ignore?'};
export function charterTemplate(name){
  return `# ${name} charter\n\nThis charter is ${name}'s identity: other layers and agents read it to understand what ${name} is for. Replace each prompt with your own words; add sections as you need them.\n\n`+
    Object.entries(charterSections).map(([field,label])=>`## ${label}\n\n<!-- ${charterPrompts[field]} -->\n`).join('\n');
}
export function charterFromFields(name,identity){
  return `# ${name} charter\n\n`+Object.entries(charterSections).map(([field,label])=>`## ${label}\n\n${identity?.[field]||''}\n`).join('\n');
}
// A section counts once its text, without the prompt comments, says something.
export function parseCharter(markdown){
  const fields=Object.fromEntries(Object.keys(charterSections).map(field=>[field,'']));
  const byHeading=Object.fromEntries(Object.entries(charterSections).map(([field,label])=>[label.toLowerCase(),field]));
  let current=null;
  for(const line of markdown.replace(/<!--[\s\S]*?-->/g,'').split('\n')){
    const heading=/^##\s+(.+?)\s*#*\s*$/.exec(line);
    if(heading){current=byHeading[heading[1].toLowerCase()]||null;continue;}
    if(/^#\s/.test(line)){current=null;continue;}
    if(current)fields[current]+=line+'\n';
  }
  for(const field of Object.keys(fields))fields[field]=fields[field].trim();
  return fields;
}
export function saveLayerCharter(db,userId,projectId,key,input){
  owner(db,userId,projectId);
  const current=projectLayerDefinition(db,projectId,key);
  if(!current)fail('Layer not found.',404);
  if(input?.expectedRevision!==current.identityRevision)fail('The charter changed. Reload before saving.',409);
  if(typeof input.content!=='string'||!input.content.trim())fail('A charter needs content.');
  if(input.content.length>20000)fail('Keep the charter under 20,000 characters.');
  const fields=parseCharter(input.content),identity={...fields,markdown:input.content};
  const revision=current.identityRevision+1,at=now();
  db.exec('BEGIN');
  try{
    db.prepare('UPDATE layer_definitions SET identity_json=?,identity_revision=?,description=?,descriptor_version=descriptor_version+1 WHERE project_id=? AND layer_key=?')
      .run(JSON.stringify(identity),revision,fields.purpose.replace(/\s+/g,' ').slice(0,300)||current.description,projectId,key);
    db.prepare('INSERT INTO layer_identity_revisions VALUES (?,?,?,?,?,?)').run(projectId,key,revision,JSON.stringify(identity),userId,at);
    if(current.lifecycle==='active')db.prepare('UPDATE layer_instances SET descriptor_version=descriptor_version+1 WHERE project_id=? AND layer_key=?').run(projectId,key);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return projectLayerDefinition(db,projectId,key);
}
export function saveLayerIdentity(db,userId,projectId,key,input) {
  owner(db,userId,projectId);
  const current=projectLayerDefinition(db,projectId,key);
  if(!current||current.builtIn)fail('Custom layer not found.',404);
  if(!input || typeof input !== 'object')fail('Provide a layer identity.');
  if(input.expectedRevision!==current.identityRevision)fail('This layer identity changed. Reload before saving.',409);
  const identity=Object.fromEntries(identityFields.map(field=>[field,clean(input[field],4000,field)]));
  const revision=current.identityRevision+1,at=now();
  db.exec('BEGIN');
  try{
    db.prepare('UPDATE layer_definitions SET identity_json=?,identity_revision=?,description=?,descriptor_version=descriptor_version+1 WHERE project_id=? AND layer_key=?')
      .run(JSON.stringify(identity),revision,identity.purpose.slice(0,300)||'Define this layer before connecting it to the project.',projectId,key);
    db.prepare('INSERT INTO layer_identity_revisions VALUES (?,?,?,?,?,?)').run(projectId,key,revision,JSON.stringify(identity),userId,at);
    if(current.lifecycle==='active')db.prepare('UPDATE layer_instances SET descriptor_version=descriptor_version+1 WHERE project_id=? AND layer_key=?').run(projectId,key);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return projectLayerDefinition(db,projectId,key);
}
export function layerIdentityHistory(db,userId,projectId,key){
  const member=db.prepare('SELECT 1 FROM project_members WHERE project_id=? AND user_id=?').get(projectId,userId);
  if(!member)fail('Project not found.',404);
  if(!projectLayerDefinition(db,projectId,key))fail('Layer not found.',404);
  return db.prepare('SELECT revision,author_id AS authorId,created_at AS createdAt FROM layer_identity_revisions WHERE project_id=? AND layer_key=? ORDER BY revision DESC').all(projectId,key);
}
export function addDomainAction(db,userId,projectId,key,input){
  owner(db,userId,projectId);
  const definition=projectLayerDefinition(db,projectId,key);
  if(!definition||definition.builtIn)fail('Custom layer not found.',404);
  const actionKey=clean(input?.key,32,'Action key').toLowerCase();
  if(!keyPattern.test(actionKey)||['edit','discover'].includes(actionKey))fail('Choose an action key with 3–32 lowercase letters, numbers or underscores.');
  const title=clean(input?.title,100,'Action title'),purpose=clean(input?.purpose,600,'Action purpose'),method=clean(input?.method,4000,'Action method');
  const checks=Array.isArray(input?.checks)?input.checks.map(value=>clean(value,300,'Review check')).filter(Boolean):[];
  if(!title||!purpose||!method||!checks.length||checks.length>8)fail('Name the action, its purpose, method and one to eight review checks.');
  if(definition.domainActions.length>=20)fail('This layer has reached its action limit.',409);
  db.prepare('INSERT INTO layer_custom_actions(project_id,layer_key,action_key,title,purpose,method,checks_json,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(projectId,key,actionKey,title,purpose,method,JSON.stringify(checks),now());
  return projectLayerDefinition(db,projectId,key);
}
export function activateLayerDefinition(db,userId,projectId,key){
  owner(db,userId,projectId);
  const definition=projectLayerDefinition(db,projectId,key);
  if(!definition||definition.builtIn)fail('Custom layer not found.',404);
  if(definition.lifecycle==='active')return definition;
  if(!definition.identity||identityFields.some(field=>definition.identity[field]?.length<12))
    fail('Complete every identity field with at least 12 characters before activation.',409);
  if(!definition.domainActions.length)fail('Add a domain action before activation.',409);
  db.exec('BEGIN');
  try{
    db.prepare("UPDATE layer_definitions SET lifecycle='active',descriptor_version=descriptor_version+1 WHERE project_id=? AND layer_key=?").run(projectId,key);
    db.prepare('UPDATE layer_instances SET descriptor_version=descriptor_version+1 WHERE project_id=? AND layer_key=?').run(projectId,key);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return projectLayerDefinition(db,projectId,key);
}
export function actionsForDefinition(definition) {
  if(!definition||definition.outputProvider!=='markdown-files')return [];
  const base={layer:definition.key,permissions:{elevated:false,reads:[{layer:definition.key,kind:'markdown_document'}],fileReads:[],fileWrites:[],effects:['submit-report']},
    requiredInputs:[],optionalInputs:[],reviewer:'project-owner',applicability:'installed-layer'};
  const human={...base,result:{owner:definition.key,kind:'markdown_document',operation:'edit'},adapter:'markdown_person_edit',humanRunnable:true,agentRunnable:false,
    initialAssignee:{dreamer:'human',planner:'human',tinkerer:'human'}};
  return [
    {...human,id:`${definition.key}.edit`,key:'edit',revision:1,legacy:true,title:'Generic Markdown edit (legacy)',purpose:'Existing work created before domain actions were configured.',
      checks:['Changed file paths and revisions are named','Markdown output was reviewed'],method:'Edit this layer’s Markdown files and submit exact revisions for review.'},
    ...definition.domainActions.map(action=>({...human,id:`${definition.key}.${action.key}`,key:action.key,revision:action.revision,
      title:action.title,purpose:action.purpose,method:action.method,checks:action.checks})),
    {...base,id:`${definition.key}.discover`,key:'discover',revision:1,title:`Explore neighboring layers for ${definition.name}`,
      purpose:'Examine installed neighbors and propose receiving-layer connection policies.',result:{owner:'work',kind:'report',operation:'report'},
      adapter:'markdown_discover',humanRunnable:false,agentRunnable:true,initialAssignee:{dreamer:'agent',planner:'agent',tinkerer:'agent'},
      checks:['Source output identity and revision are cited','The receiving-layer use and uncertainty are explicit','No policy is activated without review'],
      method:'Read both layers’ identities, outputs and reciprocal policies. Propose this layer’s receiving interpretation; never activate it.'}
  ];
}
export function actionForProject(db,projectId,actionId) {
  if(typeof actionId!=='string'||!actionId.includes('.'))return null;
  const definition=projectLayerDefinition(db,projectId,actionId.split('.')[0]);
  return actionsForDefinition(definition).find(action=>action.id===actionId)||null;
}
