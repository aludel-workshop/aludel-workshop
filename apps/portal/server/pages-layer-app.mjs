import { randomBytes } from 'node:crypto';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const clean = (value, limit, label) => {
  if (typeof value !== 'string' || value.length > limit) fail(`${label} must be text under ${limit} characters.`);
  return value.trim();
};
const defaults = [
  ['outputs', 'map', 'Map output', 'The Pages map owns page identities, placement and labeled navigation links. A page may be created without a story. Map edits revise Pages records; they do not edit Vision stories.'],
  ['outputs', 'page', 'Page output', 'Each page owns its route, purpose, section specification, content and state coverage. Spec and Built are views of the same page identity; implementation changes become reviewed Work.'],
  ['outputs', 'flow', 'Flow output', 'A flow orders page steps for a person and goal. A step may cite a Vision story when one exists, but Pages can start without Vision. Review observations remain attached to the flow.'],
  ['methods', 'page-method', 'Page design method', 'Start from a page blank. Describe the visitor job, choose sections from the project design system when available, and inspect desktop and phone states. Record a layout or behavior change as a Work item before implementation.'],
  ['methods', 'flow-method', 'Flow review method', 'Arrange pages into a journey, walk the flow at desktop and phone sizes, record observations at the affected step, and review the exact flow revision. Missing neighbor layers are questions, not automatic requirements.'],
  ['routines', 'routine-method', 'Routine instructions', 'A Pages routine names its trigger, executor, allowed reads and outputs before it can run. Runs enter Work with exact input revisions. LAT-05 will enable execution and reconciliation; editing this document cannot authorize a run.'],
  ['connections', 'connection-method', 'Connection review method', 'Inspect a neighboring layer’s current output identities and revisions. Propose a receiving policy with uncertainty and response to change. Owner review activates the policy; discovery Work alone cannot activate it.'],
  ['resources', 'review-checks', 'Review checklist', 'Check purpose, page states, navigation, accessible focus, narrow width and a complete flow. Link evidence to the exact page or flow revision. A passing checklist does not accept or deploy the app.']
];

export function initPagesLayerApp(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_documents (
    project_id TEXT NOT NULL REFERENCES projects(id), layer_key TEXT NOT NULL, doc_key TEXT NOT NULL,
    group_name TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL, PRIMARY KEY(project_id, layer_key, doc_key));
    CREATE TABLE IF NOT EXISTS layer_document_revisions (
    project_id TEXT NOT NULL, layer_key TEXT NOT NULL, doc_key TEXT NOT NULL, revision INTEGER NOT NULL,
    content TEXT NOT NULL, author_id TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, layer_key, doc_key, revision));
    CREATE TABLE IF NOT EXISTS layer_connections (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), receiving_key TEXT NOT NULL,
    source_key TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('proposed','active','inactive')),
    mapping TEXT NOT NULL, instructions TEXT NOT NULL, reaction TEXT NOT NULL, question TEXT NOT NULL,
    answer TEXT NOT NULL, revision INTEGER NOT NULL, reviewed_by TEXT, reviewed_at TEXT, updated_at TEXT NOT NULL,
    UNIQUE(project_id, receiving_key, source_key));
    CREATE TABLE IF NOT EXISTS layer_connection_revisions (
    id TEXT NOT NULL, revision INTEGER NOT NULL, state_json TEXT NOT NULL, author_id TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(id, revision));`);
}
function allowed(db, userId, projectId, owner = false) {
  const member = db.prepare('SELECT role FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId);
  if (!member) fail('Project not found.', 404);
  if (owner && member.role !== 'owner') fail('Project owner required.', 403);
  if (!db.prepare("SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = 'pages' AND enabled = 1").get(projectId)) fail('Pages is not in this project.', 404);
}
function seed(db, projectId) {
  const stamp = now();
  const insert = db.prepare(`INSERT INTO layer_documents(project_id,layer_key,doc_key,group_name,title,content,revision,updated_at)
    VALUES (?, 'pages', ?, ?, ?, ?, 1, ?) ON CONFLICT DO NOTHING`);
  const history = db.prepare(`INSERT INTO layer_document_revisions(project_id,layer_key,doc_key,revision,content,author_id,created_at)
    VALUES (?, 'pages', ?, 1, ?, 'built-in', ?) ON CONFLICT DO NOTHING`);
  for (const [group, key, title, content] of defaults) {
    insert.run(projectId, key, group, title, content, stamp);
    history.run(projectId, key, content, stamp);
  }
}
export function pagesDocumentList(db, userId, projectId) {
  allowed(db, userId, projectId);
  seed(db, projectId);
  return db.prepare("SELECT doc_key AS key, group_name AS groupName, title, revision, updated_at AS updatedAt FROM layer_documents WHERE project_id = ? AND layer_key = 'pages' ORDER BY CASE group_name WHEN 'outputs' THEN 0 WHEN 'methods' THEN 1 WHEN 'routines' THEN 2 WHEN 'connections' THEN 3 ELSE 4 END, rowid").all(projectId);
}
export function pagesDocumentRead(db, userId, projectId, key, revision = null) {
  allowed(db, userId, projectId);
  seed(db, projectId);
  const row = db.prepare("SELECT doc_key AS key, group_name AS groupName, title, content, revision, updated_at AS updatedAt FROM layer_documents WHERE project_id = ? AND layer_key = 'pages' AND doc_key = ?").get(projectId, key);
  if (!row) fail('Document not found.', 404);
  if (revision === null) return row;
  if (!Number.isInteger(revision) || revision < 1) fail('Choose a valid revision.');
  const historical = db.prepare("SELECT content, created_at AS updatedAt FROM layer_document_revisions WHERE project_id = ? AND layer_key = 'pages' AND doc_key = ? AND revision = ?").get(projectId, key, revision);
  if (!historical) fail('Document revision not found.', 404);
  return { ...row, ...historical, revision };
}
export function pagesDocumentUpdate(db, userId, projectId, key, input) {
  allowed(db, userId, projectId, true);
  const current = pagesDocumentRead(db, userId, projectId, key);
  if (input?.expectedRevision !== current.revision) fail('This document changed. Reload its current revision before saving.', 409);
  const content = clean(input.content, 8000, 'Document');
  if (!content) fail('A document needs content.');
  if (content === current.content) return current;
  const revision = current.revision + 1, stamp = now();
  db.prepare("UPDATE layer_documents SET content = ?, revision = ?, updated_at = ? WHERE project_id = ? AND layer_key = 'pages' AND doc_key = ?")
    .run(content, revision, stamp, projectId, key);
  db.prepare("INSERT INTO layer_document_revisions(project_id,layer_key,doc_key,revision,content,author_id,created_at) VALUES (?, 'pages', ?, ?, ?, ?, ?)")
    .run(projectId, key, revision, content, userId, stamp);
  return pagesDocumentRead(db, userId, projectId, key);
}
const sourceState = (db, projectId, row) => ({ ...row, sourceAvailable: !!(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='layer_definitions'").get()
  ? db.prepare("SELECT 1 FROM layer_instances i JOIN layer_definitions d ON d.project_id=i.project_id AND d.layer_key=i.layer_key WHERE i.project_id=? AND i.layer_key=? AND i.enabled=1 AND d.lifecycle='active'").get(projectId,row.sourceKey)
  : db.prepare('SELECT 1 FROM layer_instances WHERE project_id=? AND layer_key=? AND enabled=1').get(projectId,row.sourceKey)) });
export function pagesConnections(db, userId, projectId) {
  allowed(db, userId, projectId);
  return db.prepare("SELECT id, source_key AS sourceKey, status, mapping, instructions, reaction, question, answer, revision, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, updated_at AS updatedAt FROM layer_connections WHERE project_id = ? AND receiving_key = 'pages' ORDER BY rowid").all(projectId)
    .map(row => sourceState(db, projectId, row));
}
export function pagesConnectionCreate(db, userId, projectId, sourceKey) {
  allowed(db, userId, projectId, true);
  if (sourceKey === 'pages' || !(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='layer_definitions'").get()
    ? db.prepare("SELECT 1 FROM layer_instances i JOIN layer_definitions d ON d.project_id=i.project_id AND d.layer_key=i.layer_key WHERE i.project_id = ? AND i.layer_key = ? AND i.enabled = 1 AND d.lifecycle = 'active'").get(projectId, sourceKey)
    : db.prepare('SELECT 1 FROM layer_instances WHERE project_id=? AND layer_key=? AND enabled=1').get(projectId,sourceKey))) fail('Choose an installed neighboring layer.', 400);
  const existing = pagesConnections(db, userId, projectId).find(row => row.sourceKey === sourceKey);
  if (existing) return existing;
  const id = `lcn-${randomBytes(6).toString('hex')}`, stamp = now();
  const state = { sourceKey, status: 'proposed', mapping: 'reference-only', instructions: '', reaction: '', question: '', answer: '', reviewedBy: null, reviewedAt: null };
  db.prepare("INSERT INTO layer_connections(id,project_id,receiving_key,source_key,status,mapping,instructions,reaction,question,answer,revision,updated_at) VALUES (?,?,'pages',?,?,?,?,?,?,?,1,?)")
    .run(id, projectId, state.sourceKey, state.status, state.mapping, state.instructions, state.reaction, state.question, state.answer, stamp);
  db.prepare('INSERT INTO layer_connection_revisions(id,revision,state_json,author_id,created_at) VALUES (?,1,?,?,?)').run(id, JSON.stringify(state), userId, stamp);
  return pagesConnections(db, userId, projectId).find(row => row.id === id);
}
export function pagesConnectionUpdate(db, userId, projectId, id, input) {
  allowed(db, userId, projectId, true);
  const row = pagesConnections(db, userId, projectId).find(item => item.id === id);
  if (!row) fail('Connection not found.', 404);
  if (input?.expectedRevision !== row.revision) fail('This connection changed. Reload before saving.', 409);
  const mapping = input.mapping === undefined ? row.mapping : input.mapping;
  if (!['reference-only','flow-candidate'].includes(mapping)) fail('Choose a supported mapping.');
  const instructions = input.instructions === undefined ? row.instructions : clean(input.instructions, 4000, 'Mapping instructions');
  const reaction = input.reaction === undefined ? row.reaction : clean(input.reaction, 2000, 'Change response');
  const question = input.question === undefined ? row.question : clean(input.question, 1000, 'Question');
  const answer = input.answer === undefined ? row.answer : clean(input.answer, 1000, 'Answer');
  const changed = mapping !== row.mapping || instructions !== row.instructions || reaction !== row.reaction || question !== row.question || answer !== row.answer;
  const status = input.status === undefined ? (row.status === 'active' && changed ? 'proposed' : row.status) : input.status;
  if (!['proposed','active','inactive'].includes(status)) fail('Choose a supported status.');
  if (status === 'active' && !row.sourceAvailable) fail('The source layer must be installed before activation.', 409);
  if (status === 'active' && (!instructions || (question && !answer))) fail('Answer the question and write mapping instructions before activation.', 409);
  const reviewedBy = status === 'active' && row.status !== 'active' ? userId : row.reviewedBy;
  const reviewedAt = status === 'active' && row.status !== 'active' ? now() : row.reviewedAt;
  const state = { sourceKey: row.sourceKey, status, mapping, instructions, reaction, question, answer, reviewedBy, reviewedAt };
  const revision = row.revision + 1, stamp = now();
  db.prepare('UPDATE layer_connections SET status=?,mapping=?,instructions=?,reaction=?,question=?,answer=?,revision=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=?')
    .run(status,mapping,instructions,reaction,question,answer,revision,reviewedBy,reviewedAt,stamp,id);
  db.prepare('INSERT INTO layer_connection_revisions(id,revision,state_json,author_id,created_at) VALUES (?,?,?,?,?)').run(id,revision,JSON.stringify(state),userId,stamp);
  return pagesConnections(db, userId, projectId).find(item => item.id === id);
}
