// Shared Operations and Knowledge records for every installed built-in layer.
// Native editors still own domain outputs; these documents and connection policies
// are scoped to the receiving layer and keep exact revision history.
import { randomBytes } from 'node:crypto';
import { layerDeclarations } from './layer-contract.mjs';
import { compiledLocalActions } from './lat07-actions.mjs';
import { pagesDocumentList, pagesDocumentRead, pagesDocumentUpdate, pagesConnections, pagesConnectionCreate, pagesConnectionUpdate } from './pages-layer-app.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const clean = (value, max, name) => {
  if (typeof value !== 'string' || value.length > max) fail(`${name} must be text under ${max} characters.`);
  return value.trim();
};
const layer = key => layerDeclarations.find(item => item.key === key);
function allowed(db, userId, projectId, layerKey, owner = false) {
  if (!layer(layerKey)) fail('Layer not found.', 404);
  const member = db.prepare('SELECT role FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId);
  if (!member) fail('Project not found.', 404);
  if (owner && member.role !== 'owner') fail('Project owner required.', 403);
  if (!db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, layerKey))
    fail('Layer is not installed.', 404);
}
function defaults(layerKey) {
  const definition = layer(layerKey);
  const actions = compiledLocalActions.filter(item => item.layer === layerKey);
  return [
    ...definition.outputs.map(kind => ['outputs', `output-${kind}`, `${kind.replaceAll('_', ' ')} output`,
      `${definition.name} owns ${kind} output identities and revisions. Open the native ${definition.name} view to inspect actual records. This document describes the contract; it does not create an output.`]),
    ...actions.map(action => ['methods', `action-${action.key}`, `${action.title} method`,
      `${action.method || action.purpose}\n\nReview checks:\n${action.checks.map(check => `- ${check}`).join('\n')}\n\nEditing this method changes future work, never an authorized attempt.`]),
    ['routines', 'routine-method', 'Routine instructions',
      `${definition.name} routines observe scoped changes and may stage Work. A routine cannot grant its own Go or accept a connection policy.`],
    ['connections', 'connection-method', 'Connection review method',
      `Inspect the other layer's declared output types and exact revisions. Propose how they might inform ${definition.name}; record uncertainty and change response. The receiving layer owns its interpretation. A proposed connection does not authorize sync.`],
    ['resources', 'review-checks', 'Review checklist',
      `Check the source identity and revision, output authority, applicability, missing inputs, and the resulting ${definition.name} work. Review a proposed policy before activating it.`]
  ];
}
function seed(db, projectId, layerKey) {
  const at = now();
  const insert = db.prepare(`INSERT INTO layer_documents(project_id,layer_key,doc_key,group_name,title,content,revision,updated_at)
    VALUES (?,?,?,?,?,?,1,?) ON CONFLICT DO NOTHING`);
  const history = db.prepare(`INSERT INTO layer_document_revisions(project_id,layer_key,doc_key,revision,content,author_id,created_at)
    VALUES (?,?,?,1,?,'built-in',?) ON CONFLICT DO NOTHING`);
  for (const [group,key,title,content] of defaults(layerKey)) {
    insert.run(projectId,layerKey,key,group,title,content,at);
    history.run(projectId,layerKey,key,content,at);
  }
}
export function layerDocumentList(db, userId, projectId, layerKey) {
  if (layerKey === 'pages') return pagesDocumentList(db,userId,projectId);
  allowed(db,userId,projectId,layerKey);
  seed(db,projectId,layerKey);
  return db.prepare(`SELECT doc_key AS key, group_name AS groupName, title, revision, updated_at AS updatedAt FROM layer_documents
    WHERE project_id = ? AND layer_key = ? ORDER BY CASE group_name WHEN 'outputs' THEN 0 WHEN 'methods' THEN 1 WHEN 'routines' THEN 2 WHEN 'connections' THEN 3 ELSE 4 END, rowid`).all(projectId,layerKey);
}
export function layerDocumentRead(db, userId, projectId, layerKey, key, revision = null) {
  if (layerKey === 'pages') return pagesDocumentRead(db,userId,projectId,key,revision);
  allowed(db,userId,projectId,layerKey);
  seed(db,projectId,layerKey);
  const row = db.prepare(`SELECT doc_key AS key, group_name AS groupName, title, content, revision, updated_at AS updatedAt FROM layer_documents
    WHERE project_id = ? AND layer_key = ? AND doc_key = ?`).get(projectId,layerKey,key);
  if (!row) fail('Document not found.',404);
  if (revision === null) return row;
  if (!Number.isInteger(revision) || revision < 1) fail('Choose a valid revision.');
  const past = db.prepare(`SELECT content, created_at AS updatedAt FROM layer_document_revisions
    WHERE project_id = ? AND layer_key = ? AND doc_key = ? AND revision = ?`).get(projectId,layerKey,key,revision);
  if (!past) fail('Document revision not found.',404);
  return {...row,...past,revision};
}
export function layerDocumentUpdate(db,userId,projectId,layerKey,key,input) {
  if (layerKey === 'pages') return pagesDocumentUpdate(db,userId,projectId,key,input);
  allowed(db,userId,projectId,layerKey,true);
  const current = layerDocumentRead(db,userId,projectId,layerKey,key);
  if (input?.expectedRevision !== current.revision) fail('This document changed. Reload before saving.',409);
  const content = clean(input.content,8000,'Document');
  if (!content) fail('A document needs content.');
  if (content === current.content) return current;
  const revision = current.revision + 1, at = now();
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE layer_documents SET content=?,revision=?,updated_at=? WHERE project_id=? AND layer_key=? AND doc_key=?`)
      .run(content,revision,at,projectId,layerKey,key);
    db.prepare(`INSERT INTO layer_document_revisions(project_id,layer_key,doc_key,revision,content,author_id,created_at) VALUES (?,?,?,?,?,?,?)`)
      .run(projectId,layerKey,key,revision,content,userId,at);
    db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK'); throw error; }
  return layerDocumentRead(db,userId,projectId,layerKey,key);
}
const available = (db,projectId,key) => !!db.prepare('SELECT 1 FROM layer_instances WHERE project_id=? AND layer_key=? AND enabled=1').get(projectId,key);
export function layerConnections(db,userId,projectId,receivingKey) {
  if (receivingKey === 'pages') return pagesConnections(db,userId,projectId);
  allowed(db,userId,projectId,receivingKey);
  return db.prepare(`SELECT id, source_key AS sourceKey, status, mapping, instructions, reaction, question, answer,
    revision, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, updated_at AS updatedAt FROM layer_connections
    WHERE project_id=? AND receiving_key=? ORDER BY rowid`).all(projectId,receivingKey)
    .map(row => ({...row,sourceAvailable:available(db,projectId,row.sourceKey)}));
}
export function proposeLayerConnection(db,projectId,receivingKey,sourceKey,authorId='discovery-routine') {
  if (!layer(receivingKey) || !layer(sourceKey) || receivingKey === sourceKey || !available(db,projectId,receivingKey) || !available(db,projectId,sourceKey))
    fail('Choose installed source and receiving layers.');
  const existing = db.prepare('SELECT id FROM layer_connections WHERE project_id=? AND receiving_key=? AND source_key=?').get(projectId,receivingKey,sourceKey);
  if (existing) return existing.id;
  const id=`lcn-${randomBytes(6).toString('hex')}`,at=now();
  const state={sourceKey,status:'proposed',mapping:'reference-only',instructions:'',reaction:'',question:'',answer:'',reviewedBy:null,reviewedAt:null};
  db.prepare(`INSERT INTO layer_connections(id,project_id,receiving_key,source_key,status,mapping,instructions,reaction,question,answer,revision,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`).run(id,projectId,receivingKey,sourceKey,state.status,state.mapping,state.instructions,state.reaction,state.question,state.answer,at);
  db.prepare('INSERT INTO layer_connection_revisions(id,revision,state_json,author_id,created_at) VALUES (?,1,?,?,?)')
    .run(id,JSON.stringify(state),authorId,at);
  return id;
}
export function layerConnectionCreate(db,userId,projectId,receivingKey,sourceKey) {
  if (receivingKey === 'pages') return pagesConnectionCreate(db,userId,projectId,sourceKey);
  allowed(db,userId,projectId,receivingKey,true);
  const id=proposeLayerConnection(db,projectId,receivingKey,sourceKey,userId);
  return layerConnections(db,userId,projectId,receivingKey).find(row=>row.id===id);
}
export function layerConnectionUpdate(db,userId,projectId,receivingKey,id,input) {
  if (receivingKey === 'pages') return pagesConnectionUpdate(db,userId,projectId,id,input);
  allowed(db,userId,projectId,receivingKey,true);
  const row=layerConnections(db,userId,projectId,receivingKey).find(item=>item.id===id);
  if (!row) fail('Connection not found.',404);
  if (input?.expectedRevision!==row.revision) fail('This connection changed. Reload before saving.',409);
  const mapping=input.mapping===undefined?row.mapping:input.mapping;
  if (!['reference-only','candidate-input'].includes(mapping)) fail('Choose a supported mapping.');
  const instructions=input.instructions===undefined?row.instructions:clean(input.instructions,4000,'Mapping instructions');
  const reaction=input.reaction===undefined?row.reaction:clean(input.reaction,2000,'Change response');
  const question=input.question===undefined?row.question:clean(input.question,1000,'Question');
  const answer=input.answer===undefined?row.answer:clean(input.answer,1000,'Answer');
  const changed=mapping!==row.mapping||instructions!==row.instructions||reaction!==row.reaction||question!==row.question||answer!==row.answer;
  const status=input.status===undefined?(row.status==='active'&&changed?'proposed':row.status):input.status;
  if (!['proposed','active','inactive'].includes(status)) fail('Choose a supported status.');
  if (status==='active'&&(!row.sourceAvailable||!instructions||(question&&!answer))) fail('Review the source and complete the mapping before activation.',409);
  const reviewedBy=status==='active'&&row.status!=='active'?userId:row.reviewedBy;
  const reviewedAt=status==='active'&&row.status!=='active'?now():row.reviewedAt;
  const revision=row.revision+1,at=now();
  const state={sourceKey:row.sourceKey,status,mapping,instructions,reaction,question,answer,reviewedBy,reviewedAt};
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE layer_connections SET status=?,mapping=?,instructions=?,reaction=?,question=?,answer=?,revision=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=?`)
      .run(status,mapping,instructions,reaction,question,answer,revision,reviewedBy,reviewedAt,at,id);
    db.prepare('INSERT INTO layer_connection_revisions(id,revision,state_json,author_id,created_at) VALUES (?,?,?,?,?)')
      .run(id,revision,JSON.stringify(state),userId,at);
    db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK'); throw error; }
  return layerConnections(db,userId,projectId,receivingKey).find(item=>item.id===id);
}
export function layerRoutineRuns(db,userId,projectId,layerKey,routineId) {
  allowed(db,userId,projectId,layerKey);
  const routine=db.prepare("SELECT 1 FROM knowledge_records WHERE id=? AND project_id=? AND kind='routine' AND json_extract(data_json,'$.layer')=?").get(routineId,projectId,layerKey);
  if (!routine) fail('Routine not found.',404);
  return db.prepare(`SELECT r.id,r.ran_at AS ranAt,r.trigger,r.work_item_id AS workItemId,w.title AS workTitle,w.state AS workState
    FROM routine_runs r LEFT JOIN layer_work_items w ON w.id=r.work_item_id WHERE r.project_id=? AND r.routine_id=? ORDER BY r.id DESC`).all(projectId,routineId);
}

// Called only after signed Work acceptance, inside the caller's transaction.
// It writes proposed receiving documents and preserves any active policy.
export function applyDiscoveryProposal(db,projectId,receivingKey,connections,authorId) {
  for (const proposal of connections) {
    if (!available(db,projectId,proposal.sourceKey) || !available(db,projectId,receivingKey)) fail('Installed layers changed. Reassess the proposal.',409);
    const existing=db.prepare('SELECT id,status,revision FROM layer_connections WHERE project_id=? AND receiving_key=? AND source_key=?')
      .get(projectId,receivingKey,proposal.sourceKey);
    if (existing?.status==='active') fail('An active connection already exists. Review a revision of that policy separately.',409);
  }
  const ids=[];
  for (const proposal of connections) {
    const id=proposeLayerConnection(db,projectId,receivingKey,proposal.sourceKey,authorId);
    const current=db.prepare('SELECT revision FROM layer_connections WHERE id=?').get(id);
    const revision=current.revision+1,at=now();
    const state={sourceKey:proposal.sourceKey,status:'proposed',mapping:proposal.mapping,
      instructions:proposal.instructions.trim(),reaction:proposal.reaction.trim(),
      question:(proposal.question||'').trim(),answer:(proposal.answer||'').trim(),
      evidence:proposal.evidence.trim(),reviewedBy:null,reviewedAt:null};
    db.prepare(`UPDATE layer_connections SET status='proposed',mapping=?,instructions=?,reaction=?,question=?,answer=?,revision=?,reviewed_by=NULL,reviewed_at=NULL,updated_at=? WHERE id=?`)
      .run(state.mapping,state.instructions,state.reaction,state.question,state.answer,revision,at,id);
    db.prepare('INSERT INTO layer_connection_revisions(id,revision,state_json,author_id,created_at) VALUES (?,?,?,?,?)')
      .run(id,revision,JSON.stringify(state),authorId,at);
    ids.push(id);
  }
  return ids;
}
