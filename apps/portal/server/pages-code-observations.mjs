// LAT-06: Code facts are immutable evidence. Pages owns the separate, reviewed
// decision about whether a fact suggests an intended flow.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { compiledLat06Actions } from './lat06-actions.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const safePath = value => typeof value === 'string' && value.length > 0 && value.length <= 200 &&
  !value.startsWith('/') && !value.includes('\\') && !value.split('/').includes('..') &&
  !/(^|\/)\.env(?:\.|$)/.test(value);
const git = (workspace, ...args) => execFileSync('git', args, { cwd: workspace, timeout: 2500,
  maxBuffer: 300 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const member = (db, userId, projectId, owner = false) => {
  const row = db.prepare('SELECT role FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId);
  if (!row) fail('Project not found.', 404);
  if (owner && row.role !== 'owner') fail('Project owner required.', 403);
};
const installed = (db, projectId, key) => !!db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, key);

export function initPagesCodeObservations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS code_route_observations (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), repository_commit TEXT NOT NULL,
    source_path TEXT NOT NULL, blob_sha TEXT NOT NULL, marker TEXT NOT NULL, route TEXT NOT NULL,
    observed_by TEXT NOT NULL, observed_at TEXT NOT NULL, action_revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS pages_observation_relations (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), observation_id TEXT NOT NULL REFERENCES code_route_observations(id),
    status TEXT NOT NULL CHECK(status IN ('proposed','useful','wrong')), rationale TEXT NOT NULL,
    revision INTEGER NOT NULL, reviewed_by TEXT, reviewed_at TEXT, work_item_id TEXT, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS pages_observation_relations_source ON pages_observation_relations(project_id, observation_id);`);
  if (!db.prepare('PRAGMA table_info(code_route_observations)').all().some(column => column.name === 'action_revision'))
    db.exec('ALTER TABLE code_route_observations ADD COLUMN action_revision INTEGER NOT NULL DEFAULT 1');
}

export function recordCodeRouteObservation(db, userId, projectId, workspace, input) {
  member(db, userId, projectId, true);
  if (!installed(db, projectId, 'platform')) fail('Code is not in this project.', 409);
  const { path, marker, route } = input || {};
  const declared = compiledLat06Actions.find(action => action.id === 'platform.observe_route');
  if (!declared?.humanRunnable || !declared.permissions.effects.includes('record-observation') ||
      !declared.permissions.fileReads.some(scope => path?.startsWith(scope.slice(0, -2)))) fail('Code route capture is unavailable.', 409);
  if (!safePath(path) || !/\.(?:html|jsx?|mjs|tsx?|vue|svelte)$/.test(path) || typeof marker !== 'string' || marker.length < 3 || marker.length > 160 ||
      typeof route !== 'string' || !route.trim() || route.length > 160) fail('Choose a bounded tracked route or screen slice.');
  let commit, blob, content;
  try {
    commit = git(workspace, 'rev-parse', 'HEAD');
    git(workspace, 'ls-files', '--error-unmatch', '--', path);
    blob = git(workspace, 'rev-parse', `HEAD:${path}`);
    content = git(workspace, 'show', `HEAD:${path}`);
  } catch { fail('The tracked Code slice is unavailable.', 409); }
  if (!/^[a-f0-9]{40}$/.test(commit) || !/^[a-f0-9]{40}$/.test(blob) || !content.includes(marker))
    fail('The route marker is absent from the pinned Code slice.', 409);
  const id = `obs-${randomBytes(6).toString('hex')}`;
  const row = { id, projectId, commit, path, blob, marker, route: route.trim(), observedBy: userId, observedAt: now(), actionRevision: declared.revision };
  db.prepare('INSERT INTO code_route_observations(id,project_id,repository_commit,source_path,blob_sha,marker,route,observed_by,observed_at,action_revision) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, projectId, commit, path, blob, marker, row.route, userId, row.observedAt, declared.revision);
  return row;
}

export function codeRouteObservations(db, userId, projectId) {
  member(db, userId, projectId);
  return db.prepare('SELECT * FROM code_route_observations WHERE project_id = ? ORDER BY observed_at DESC, id DESC').all(projectId);
}

export function pagesObservationRelations(db, userId, projectId) {
  member(db, userId, projectId);
  return db.prepare(`SELECT r.*, o.repository_commit, o.source_path, o.blob_sha, o.marker, o.route
    FROM pages_observation_relations r JOIN code_route_observations o ON o.id = r.observation_id
    WHERE r.project_id = ? ORDER BY r.updated_at DESC, r.id DESC`).all(projectId);
}

export function proposePagesObservationRelation(db, userId, projectId, observationId, rationale) {
  member(db, userId, projectId, true);
  if (!installed(db, projectId, 'pages')) fail('Pages is not in this project.', 409);
  if (!installed(db, projectId, 'platform')) fail('Code is not in this project.', 409);
  const observation = db.prepare('SELECT * FROM code_route_observations WHERE id = ? AND project_id = ?').get(observationId, projectId);
  if (!observation) fail('Code observation not found.', 404);
  if (typeof rationale !== 'string' || !rationale.trim() || rationale.length > 1000) fail('Explain the proposed Pages relation.');
  const id = `rel-${randomBytes(6).toString('hex')}`, at = now();
  db.prepare("INSERT INTO pages_observation_relations VALUES (?,?,?,'proposed',?,1,NULL,NULL,NULL,?)")
    .run(id, projectId, observationId, rationale.trim(), at);
  return pagesObservationRelation(db, userId, projectId, id);
}

export function pagesObservationRelation(db, userId, projectId, relationId) {
  member(db, userId, projectId);
  const row = db.prepare(`SELECT r.*, o.repository_commit, o.source_path, o.blob_sha, o.marker, o.route
    FROM pages_observation_relations r JOIN code_route_observations o ON o.id = r.observation_id
    WHERE r.id = ? AND r.project_id = ?`).get(relationId, projectId);
  if (!row) fail('Pages relation not found.', 404);
  return row;
}

export function reviewPagesObservationRelation(db, userId, projectId, relationId, { expectedRevision, verdict, reason }) {
  member(db, userId, projectId, true);
  const row = pagesObservationRelation(db, userId, projectId, relationId);
  if (row.revision !== expectedRevision) fail('This Pages relation changed. Reload before review.', 409);
  if (verdict === 'useful' && (!installed(db, projectId, 'platform') || !installed(db, projectId, 'pages'))) fail('Both Code and Pages must be installed for a useful relation.', 409);
  if (!['useful', 'wrong'].includes(verdict) || typeof reason !== 'string' || !reason.trim() || reason.length > 1000)
    fail('Choose useful or wrong and explain the judgment.');
  db.prepare('UPDATE pages_observation_relations SET status = ?, rationale = ?, revision = revision + 1, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?')
    .run(verdict, reason.trim(), userId, now(), now(), relationId);
  return pagesObservationRelation(db, userId, projectId, relationId);
}

export function stagePagesFlowFromObservation(db, know, userId, projectId, relationId) {
  member(db, userId, projectId, true);
  const relation = pagesObservationRelation(db, userId, projectId, relationId);
  if (relation.status !== 'useful') fail('Review this relation as useful before staging Pages work.', 409);
  if (!installed(db, projectId, 'platform') || !installed(db, projectId, 'pages')) fail('Code and Pages must remain installed to stage this relation.', 409);
  if (relation.work_item_id) return know.workById(projectId, relation.work_item_id);
  const item = know.createWork(projectId, { layer: 'pages', type: 'design', action: 'pages.flows', state: 'suggested',
    title: `Review an intended flow for ${relation.route}`, targets: [], documents: ['Pages › Flows'],
    checks: ['The intended flow is supported by page evidence; the Code route is only an observation'],
    context: { observationRelation: { id: relation.id, revision: relation.revision },
      codeObservation: { id: relation.observation_id, commit: relation.repository_commit, path: relation.source_path, blob: relation.blob_sha } },
    logText: `Suggested from reviewed Code observation ${relation.observation_id}` });
  db.prepare('UPDATE pages_observation_relations SET work_item_id = ? WHERE id = ? AND work_item_id IS NULL').run(item.id, relationId);
  return item;
}
