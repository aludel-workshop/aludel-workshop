import { createHash, randomBytes } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { projectLayerDefinition } from './layer-registry.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const now=()=>new Date().toISOString();
const sha=value=>createHash('sha256').update(value).digest('hex');
const id=()=>`md-${randomBytes(8).toString('hex')}`;
const segment=value=>typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=80&&value!=='.'&&value!=='..'&&/^[\p{L}\p{N} _.-]+$/u.test(value);
function pathParts(value,folder=false){
  if(typeof value!=='string'||value.length>240||value.startsWith('/')||value.endsWith('/')||value.includes('\\')||value.includes('\0'))fail('Choose a relative Markdown path.');
  const parts=value.split('/');
  if(!parts.every(segment)||parts.length>12)fail('Path contains an unsupported name or depth.');
  if(!folder&&!parts.at(-1).toLowerCase().endsWith('.md'))fail('Files must end in .md');
  return parts;
}
export function access(db,userId,projectId,key,write=false){
  const member=db.prepare('SELECT role FROM project_members WHERE project_id=? AND user_id=?').get(projectId,userId);
  if(!member)fail('Project not found.',404);
  if(write&&member.role!=='owner')fail('Project owner required.',403);
  const definition=projectLayerDefinition(db,projectId,key);
  if(!definition||definition.outputProvider!=='markdown-files'||!db.prepare('SELECT 1 FROM layer_instances WHERE project_id=? AND layer_key=? AND enabled=1').get(projectId,key))fail('Markdown layer not found.',404);
  return definition;
}
export function root(dataDirectory,projectId,key){
  const projectFolder=sha(projectId).slice(0,24);
  const base=resolve(dataDirectory,'layer-outputs',projectFolder,key);
  mkdirSync(base,{recursive:true,mode:0o700});
  if(lstatSync(base).isSymbolicLink())fail('Layer output root is unsafe.',409);
  return base;
}
export function physical(base,path){
  const parts=pathParts(path,path?.endsWith('.md')?false:true);
  let current=base;
  for(const part of parts){ current=join(current,part);if(existsSync(current)&&lstatSync(current).isSymbolicLink())fail('Symbolic links are not allowed in layer outputs.',409); }
  const target=resolve(base,...parts);
  if(!target.startsWith(base+sep))fail('Path escapes the layer output root.',400);
  return target;
}
function parent(path){const at=path.lastIndexOf('/');return at<0?'':path.slice(0,at);}
function folderExists(db,projectId,key,path){return !path||!!db.prepare('SELECT 1 FROM markdown_folders WHERE project_id=? AND layer_key=? AND path=?').get(projectId,key,path);}
function fileRow(db,projectId,key,fileId){const row=db.prepare('SELECT * FROM markdown_files WHERE id=? AND project_id=? AND layer_key=? AND deleted=0').get(fileId,projectId,key);if(!row)fail('Markdown file not found.',404);return row;}
export function workLink(db,projectId,key,userId,workId){
  if(!workId)return null;
  const row=db.prepare('SELECT layer,state,assignee_kind,assignee_id,context_json FROM layer_work_items WHERE id=? AND project_id=?').get(workId,projectId);
  const context=row?.context_json?JSON.parse(row.context_json):{};
  if(!row||row.layer!==key||row.state!=='claimed'||row.assignee_kind!=='person'||row.assignee_id!==userId||!context.personRun)fail('Start the assigned person run before linking an edit to Work.',409);
  return workId;
}
export function initMarkdownLayer(db){
  db.exec(`CREATE TABLE IF NOT EXISTS markdown_folders(project_id TEXT NOT NULL,layer_key TEXT NOT NULL,path TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(project_id,layer_key,path));
    CREATE TABLE IF NOT EXISTS markdown_files(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,layer_key TEXT NOT NULL,path TEXT NOT NULL,revision INTEGER NOT NULL,content_sha TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS markdown_file_current_path ON markdown_files(project_id,layer_key,path) WHERE deleted=0;
    CREATE TABLE IF NOT EXISTS markdown_file_revisions(file_id TEXT NOT NULL,revision INTEGER NOT NULL,path TEXT NOT NULL,content TEXT NOT NULL,content_sha TEXT NOT NULL,operation TEXT NOT NULL,author_id TEXT NOT NULL,work_id TEXT,created_at TEXT NOT NULL,PRIMARY KEY(file_id,revision));
    CREATE INDEX IF NOT EXISTS markdown_revisions_work ON markdown_file_revisions(work_id);`);
}
export function markdownTree(db,dataDirectory,userId,projectId,key){
  access(db,userId,projectId,key);initMarkdownLayer(db);root(dataDirectory,projectId,key);
  return {folders:db.prepare('SELECT path FROM markdown_folders WHERE project_id=? AND layer_key=? ORDER BY path').all(projectId,key).map(row=>row.path),
    files:db.prepare('SELECT id,path,revision,content_sha AS sha,updated_at AS updatedAt FROM markdown_files WHERE project_id=? AND layer_key=? AND deleted=0 ORDER BY path').all(projectId,key)};
}
export function markdownRead(db,dataDirectory,userId,projectId,key,fileId,revision=null){
  access(db,userId,projectId,key);initMarkdownLayer(db);const row=fileRow(db,projectId,key,fileId);
  if(revision!==null){if(!Number.isInteger(revision)||revision<1)fail('Choose a valid revision.');const past=db.prepare('SELECT path,content,content_sha AS sha,operation,created_at AS updatedAt FROM markdown_file_revisions WHERE file_id=? AND revision=?').get(fileId,revision);if(!past)fail('Revision not found.',404);return {id:fileId,revision,...past};}
  const base=root(dataDirectory,projectId,key),target=physical(base,row.path);
  if(!existsSync(target)||!lstatSync(target).isFile())fail('File is unavailable; restore it before editing.',409);
  const content=readFileSync(target,'utf8');
  if(sha(content)!==row.content_sha)fail('File changed outside this editor; reconcile it before editing.',409);
  return {id:fileId,path:row.path,revision:row.revision,content,sha:row.content_sha,updatedAt:row.updated_at};
}
export function markdownFolderCreate(db,dataDirectory,userId,projectId,key,path){
  access(db,userId,projectId,key,true);initMarkdownLayer(db);pathParts(path,true);
  if(!folderExists(db,projectId,key,parent(path)))fail('Create the parent folder first.',409);
  if(folderExists(db,projectId,key,path))fail('Folder already exists.',409);
  const base=root(dataDirectory,projectId,key),target=physical(base,path);mkdirSync(target,{mode:0o700});
  try{db.prepare('INSERT INTO markdown_folders VALUES (?,?,?,?)').run(projectId,key,path,now());}catch(error){rmSync(target,{recursive:false});throw error;}
  return {path};
}
export function markdownFileCreate(db,dataDirectory,userId,projectId,key,path,content='',workId=null){
  access(db,userId,projectId,key,true);initMarkdownLayer(db);pathParts(path);
  if(!folderExists(db,projectId,key,parent(path)))fail('Create the parent folder first.',409);
  if(typeof content!=='string'||Buffer.byteLength(content)>200000)fail('Markdown content must be under 200 KB.');
  if(db.prepare('SELECT 1 FROM markdown_files WHERE project_id=? AND layer_key=? AND path=? AND deleted=0').get(projectId,key,path))fail('File already exists.',409);
  workLink(db,projectId,key,userId,workId);
  const base=root(dataDirectory,projectId,key),target=physical(base,path),fileId=id(),at=now();
  writeFileSync(target,content,{flag:'wx',mode:0o600});
  db.exec('BEGIN');
  try{db.prepare('INSERT INTO markdown_files VALUES (?,?,?,?,1,?,0,?)').run(fileId,projectId,key,path,sha(content),at);
    db.prepare('INSERT INTO markdown_file_revisions VALUES (?,1,?,?,?,?,?,?,?)').run(fileId,path,content,sha(content),'create',userId,workId,at);db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');rmSync(target,{force:true});throw error;}
  return markdownRead(db,dataDirectory,userId,projectId,key,fileId);
}
export function markdownFileSave(db,dataDirectory,userId,projectId,key,fileId,input){
  access(db,userId,projectId,key,true);initMarkdownLayer(db);const row=fileRow(db,projectId,key,fileId);
  if(input?.expectedRevision!==row.revision)fail('This file changed. Reload before saving.',409);
  if(typeof input.content!=='string'||Buffer.byteLength(input.content)>200000)fail('Markdown content must be under 200 KB.');
  const workId=workLink(db,projectId,key,userId,input.workId||null);
  const current=markdownRead(db,dataDirectory,userId,projectId,key,fileId);
  if(current.content===input.content)return current;
  const base=root(dataDirectory,projectId,key),target=physical(base,row.path),temp=join(base,`.save-${randomBytes(8).toString('hex')}`),revision=row.revision+1,at=now();
  writeFileSync(temp,input.content,{flag:'wx',mode:0o600});
  // Store the revision first. If rename fails, roll back the ledger; the old file remains.
  db.exec('BEGIN');
  try{db.prepare('UPDATE markdown_files SET revision=?,content_sha=?,updated_at=? WHERE id=?').run(revision,sha(input.content),at,fileId);
    db.prepare('INSERT INTO markdown_file_revisions VALUES (?,?,?,?,?,?,?,?,?)').run(fileId,revision,row.path,input.content,sha(input.content),'edit',userId,workId,at);
    renameSync(temp,target);db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');rmSync(temp,{force:true});throw error;}
  return markdownRead(db,dataDirectory,userId,projectId,key,fileId);
}
export function markdownFileMove(db,dataDirectory,userId,projectId,key,fileId,input){
  access(db,userId,projectId,key,true);initMarkdownLayer(db);const row=fileRow(db,projectId,key,fileId);
  if(input?.expectedRevision!==row.revision)fail('This file changed. Reload before moving.',409);
  pathParts(input.path);if(!folderExists(db,projectId,key,parent(input.path)))fail('Destination folder does not exist.',409);
  const current=markdownRead(db,dataDirectory,userId,projectId,key,fileId);
  if(row.path===input.path)return current;
  const base=root(dataDirectory,projectId,key),from=physical(base,row.path),to=physical(base,input.path),at=now(),revision=row.revision+1;
  if(existsSync(to))fail('Destination already exists.',409);
  workLink(db,projectId,key,userId,input.workId||null);
  db.exec('BEGIN');
  try{db.prepare('UPDATE markdown_files SET path=?,revision=?,updated_at=? WHERE id=?').run(input.path,revision,at,fileId);
    db.prepare('INSERT INTO markdown_file_revisions VALUES (?,?,?,?,?,?,?,?,?)').run(fileId,revision,input.path,current.content,row.content_sha,'move',userId,input.workId||null,at);
    renameSync(from,to);db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');throw error;}
  return markdownRead(db,dataDirectory,userId,projectId,key,fileId);
}
export function markdownFileDelete(db,dataDirectory,userId,projectId,key,fileId,expectedRevision){
  access(db,userId,projectId,key,true);initMarkdownLayer(db);const row=fileRow(db,projectId,key,fileId);
  if(expectedRevision!==row.revision)fail('This file changed. Reload before deleting.',409);
  const current=markdownRead(db,dataDirectory,userId,projectId,key,fileId),at=now(),revision=row.revision+1;
  db.exec('BEGIN');
  try{db.prepare('UPDATE markdown_files SET deleted=1,revision=?,updated_at=? WHERE id=?').run(revision,at,fileId);
    db.prepare('INSERT INTO markdown_file_revisions VALUES (?,?,?,?,?,?,?,?,?)').run(fileId,revision,row.path,current.content,row.content_sha,'delete',userId,null,at);
    rmSync(physical(root(dataDirectory,projectId,key),row.path));db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');throw error;}
  return {id:fileId,deleted:true,revision};
}
export function markdownFolderMove(db,dataDirectory,userId,projectId,key,from,to){
  access(db,userId,projectId,key,true);initMarkdownLayer(db);pathParts(from,true);pathParts(to,true);
  if(!folderExists(db,projectId,key,from))fail('Folder not found.',404);
  if(to===from||to.startsWith(from+'/'))fail('Choose a different destination.');
  if(!folderExists(db,projectId,key,parent(to)))fail('Destination parent does not exist.',409);
  const folders=db.prepare('SELECT path FROM markdown_folders WHERE project_id=? AND layer_key=? AND (path=? OR path LIKE ?) ORDER BY length(path)').all(projectId,key,from,from+'/%');
  const files=db.prepare('SELECT id,path,revision,content_sha FROM markdown_files WHERE project_id=? AND layer_key=? AND deleted=0 AND path LIKE ?').all(projectId,key,from+'/%');
  const moved=path=>to+path.slice(from.length);
  if([...folders.map(row=>moved(row.path)),...files.map(row=>moved(row.path))].some(path=>folderExists(db,projectId,key,path)||db.prepare('SELECT 1 FROM markdown_files WHERE project_id=? AND layer_key=? AND path=? AND deleted=0').get(projectId,key,path)))fail('Destination contains a file or folder.',409);
  const base=root(dataDirectory,projectId,key),source=physical(base,from),destination=physical(base,to);if(existsSync(destination))fail('Destination exists.',409);
  const at=now();db.exec('BEGIN');
  try{for(const row of folders)db.prepare('UPDATE markdown_folders SET path=? WHERE project_id=? AND layer_key=? AND path=?').run(moved(row.path),projectId,key,row.path);
    for(const row of files){const next=moved(row.path),revision=row.revision+1,content=readFileSync(physical(base,row.path),'utf8');
      db.prepare('UPDATE markdown_files SET path=?,revision=?,updated_at=? WHERE id=?').run(next,revision,at,row.id);
      db.prepare('INSERT INTO markdown_file_revisions VALUES (?,?,?,?,?,?,?,?,?)').run(row.id,revision,next,content,row.content_sha,'move',userId,null,at);}
    renameSync(source,destination);db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');throw error;}
  return {from,to};
}
export function markdownFolderDelete(db,dataDirectory,userId,projectId,key,path){
  access(db,userId,projectId,key,true);initMarkdownLayer(db);pathParts(path,true);
  if(!folderExists(db,projectId,key,path))fail('Folder not found.',404);
  if(db.prepare('SELECT 1 FROM markdown_files WHERE project_id=? AND layer_key=? AND deleted=0 AND path LIKE ?').get(projectId,key,path+'/%')||
    db.prepare('SELECT 1 FROM markdown_folders WHERE project_id=? AND layer_key=? AND path LIKE ?').get(projectId,key,path+'/%'))fail('Empty the folder before deleting it.',409);
  rmSync(physical(root(dataDirectory,projectId,key),path),{recursive:false});
  db.prepare('DELETE FROM markdown_folders WHERE project_id=? AND layer_key=? AND path=?').run(projectId,key,path);
  return {path,deleted:true};
}
