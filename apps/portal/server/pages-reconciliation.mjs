import { createHash } from 'node:crypto';

const stamp = () => new Date().toISOString();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const policyRow = (db, projectId) => db.prepare(`SELECT c.* FROM layer_connections c
  JOIN layer_instances receiving ON receiving.project_id = c.project_id AND receiving.layer_key = 'pages' AND receiving.enabled = 1
  WHERE c.project_id = ? AND c.receiving_key = 'pages' AND c.source_key = 'product'`).get(projectId);
const sourceAvailable = (db, projectId) => !!db.prepare("SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = 'product' AND enabled = 1").get(projectId);
const member = (db, userId, projectId, owner = false) => {
  const row = db.prepare('SELECT role FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId);
  if (!row) fail('Project not found.', 404);
  if (owner && row.role !== 'owner') fail('Project owner required.', 403);
  if (!db.prepare("SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = 'pages' AND enabled = 1").get(projectId)) fail('Pages is not in this project.', 404);
};

export function initPagesReconciliation(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_trigger_receipts (
    project_id TEXT NOT NULL REFERENCES projects(id), receipt_key TEXT NOT NULL, policy_id TEXT NOT NULL,
    policy_revision INTEGER NOT NULL, inputs_json TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(project_id, receipt_key));
    CREATE TABLE IF NOT EXISTS layer_gap_ledger (
    project_id TEXT NOT NULL REFERENCES projects(id), gap_key TEXT NOT NULL, source_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('open','resolved','pending-review','exception','rejected','degraded')),
    work_item_id TEXT, source_revision INTEGER NOT NULL, policy_revision INTEGER NOT NULL,
    reason TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(project_id, gap_key));`);
  const columns = new Set(db.prepare('PRAGMA table_info(routine_runs)').all().map(row => row.name));
  for (const [name, type] of [['receipt_key','TEXT'],['input_json','TEXT'],['outcome','TEXT']]) {
    if (!columns.has(name)) db.exec(`ALTER TABLE routine_runs ADD COLUMN ${name} ${type}`);
  }
}

export function pagesReconciliationView(db, userId, projectId) {
  member(db, userId, projectId);
  const policy = policyRow(db, projectId);
  const available = sourceAvailable(db, projectId);
  const coverage = !policy ? 'unconnected' : !available ? 'degraded' : policy.status !== 'active' || policy.mapping !== 'flow-candidate' ? 'inactive' : 'active';
  return { coverage, policyRevision: policy?.revision || null,
    gaps: db.prepare(`SELECT gap_key AS key, source_id AS sourceId, status, work_item_id AS workItemId,
      source_revision AS sourceRevision, policy_revision AS policyRevision, reason, updated_at AS updatedAt
      FROM layer_gap_ledger WHERE project_id = ? ORDER BY gap_key`).all(projectId),
    lastReceipt: db.prepare('SELECT receipt_key AS key, policy_revision AS policyRevision, inputs_json AS inputs, created_at AS createdAt FROM layer_trigger_receipts WHERE project_id = ? ORDER BY rowid DESC LIMIT 1').get(projectId) || null };
}

export function pagesGapDecision(db, userId, projectId, key, input) {
  member(db, userId, projectId, true);
  if (!['exception','rejected','reopen'].includes(input?.decision)) fail('Choose exception, rejected or reopen.');
  const row = db.prepare('SELECT * FROM layer_gap_ledger WHERE project_id = ? AND gap_key = ?').get(projectId, key);
  if (!row) fail('Gap not found.', 404);
  if (input.expectedUpdatedAt !== row.updated_at) fail('This gap changed. Reload before deciding.', 409);
  const next = input.decision === 'reopen' ? 'open' : input.decision;
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 1000) : '';
  if (next !== 'open' && !reason) fail('Record why this gap is quiet.');
  db.prepare('UPDATE layer_gap_ledger SET status = ?, reason = ?, updated_at = ? WHERE project_id = ? AND gap_key = ?')
    .run(next, reason || null, stamp(), projectId, key);
  return pagesReconciliationView(db, userId, projectId);
}

// A policy is a receiving-layer decision. This utility only stages Work; it never starts a worker.
export function reconcilePagesFlow(db, know, projectId, { trigger = 'output-change', at = stamp() } = {}) {
  const policy = policyRow(db, projectId);
  if (!policy) return { coverage: 'unconnected', created: [], closed: [] };
  if (!sourceAvailable(db, projectId)) {
    db.prepare("UPDATE layer_gap_ledger SET status = 'degraded', updated_at = ? WHERE project_id = ? AND status IN ('open','resolved','pending-review')").run(at, projectId);
    return { coverage: 'degraded', created: [], closed: [] };
  }
  if (policy.status !== 'active' || policy.mapping !== 'flow-candidate') {
    db.prepare("UPDATE layer_gap_ledger SET status = 'degraded', updated_at = ? WHERE project_id = ? AND status IN ('open','resolved','pending-review')").run(at, projectId);
    return { coverage: 'inactive', created: [], closed: [] };
  }
  const stories = know.list(projectId, 'story').sort((a, b) => a.id.localeCompare(b.id));
  const flows = know.list(projectId, 'flow').sort((a, b) => a.id.localeCompare(b.id));
  const inputs = { policy: [policy.id, policy.revision], stories: stories.map(item => [item.id, item.revision]), flows: flows.map(item => [item.id, item.revision]) };
  const receipt = digest(inputs);
  const degraded = db.prepare("SELECT 1 FROM layer_gap_ledger WHERE project_id = ? AND status = 'degraded' LIMIT 1").get(projectId);
  const reopened = db.prepare("SELECT work_item_id FROM layer_gap_ledger WHERE project_id = ? AND status = 'open'").all(projectId)
    .some(row => !row.work_item_id || know.workById(projectId, row.work_item_id)?.state === 'done');
  if (!degraded && !reopened && db.prepare('SELECT 1 FROM layer_trigger_receipts WHERE project_id = ? AND receipt_key = ?').get(projectId, receipt)) return { coverage: 'active', repeated: true, receipt, created: [], closed: [] };
  const covered = new Set(flows.flatMap(flow => flow.steps.filter(step => step.page).map(step => step.story).filter(Boolean)));
  const missing = stories.filter(story => !covered.has(story.id));
  const live = new Set(missing.map(story => `pages:flow-story:${story.id}`));
  const created = [], closed = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    // A stopped or restarted process can replay this snapshot without creating duplicate Work.
    db.prepare('INSERT OR IGNORE INTO layer_trigger_receipts(project_id,receipt_key,policy_id,policy_revision,inputs_json,created_at) VALUES (?,?,?,?,?,?)')
      .run(projectId, receipt, policy.id, policy.revision, JSON.stringify(inputs), at);
    let routine = know.list(projectId, 'routine').find(item => item.key === 'pages-flow-coverage');
    if (!routine) routine = know.insert(projectId, 'routine', { key: 'pages-flow-coverage', title: 'Check Vision story flow coverage', layer: 'pages', type: 'design', cadence: 'monthly', documents: ['Pages › Flows'], enabled: true, executor: 'utility', trigger: 'output-change', instructionDoc: 'routine-method', allowedReads: ['Vision stories', 'Pages flows', 'Reviewed Vision → Pages connection'], capabilities: [], outputKinds: ['Work suggestion'] }, { rationale: 'LAT-05 reviewed connection utility' });
    let runWorkId = null;
    for (const story of missing) {
      const key = `pages:flow-story:${story.id}`;
      const previous = db.prepare('SELECT * FROM layer_gap_ledger WHERE project_id = ? AND gap_key = ?').get(projectId, key);
      if (['exception','rejected'].includes(previous?.status)) continue;
      let workId = previous?.work_item_id;
      const work = workId ? know.workById(projectId, workId) : null;
      if (!work || work.state === 'done') {
        const item = know.createWork(projectId, { layer: 'pages', type: 'design', action: 'pages.flows', state: 'suggested',
          title: `Map a flow for “${story.title}”`, targets: [{ id: story.id, kind: 'story', label: story.title }],
          documents: ['Pages › Flows'], context: { routine: routine.id, gap: key, receipt, policy: { id: policy.id, revision: policy.revision }, source: { id: story.id, revision: story.revision } },
          logText: `Suggested by reviewed Vision → Pages connection r${policy.revision}` });
        workId = item.id; created.push(item); runWorkId ||= item.id;
      }
      db.prepare(`INSERT INTO layer_gap_ledger(project_id,gap_key,source_id,status,work_item_id,source_revision,policy_revision,reason,updated_at)
        VALUES (?,?,?,'open',?,?,?,NULL,?) ON CONFLICT(project_id,gap_key) DO UPDATE SET status='open',work_item_id=excluded.work_item_id,
        source_revision=excluded.source_revision,policy_revision=excluded.policy_revision,updated_at=excluded.updated_at`)
        .run(projectId, key, story.id, workId, story.revision, policy.revision, at);
    }
    for (const row of db.prepare("SELECT * FROM layer_gap_ledger WHERE project_id = ? AND status IN ('open','degraded','pending-review')").all(projectId)) {
      if (live.has(row.gap_key)) continue;
      const item = row.work_item_id ? know.workById(projectId, row.work_item_id) : null;
      const untouched = item?.state === 'suggested' && item.log.length === 1;
      if (untouched) {
        know.appendLog(item.id, 'Done: a Pages flow now covers this story', { state: 'done' });
        closed.push(item.id);
        runWorkId ||= item.id;
      }
      db.prepare('UPDATE layer_gap_ledger SET status = ?, updated_at = ? WHERE project_id = ? AND gap_key = ?')
        .run(item && !untouched && item.state !== 'done' ? 'pending-review' : 'resolved', at, projectId, row.gap_key);
    }
    if (runWorkId) db.prepare('INSERT INTO routine_runs(routine_id,project_id,ran_at,trigger,work_item_id,receipt_key,input_json,outcome) VALUES (?,?,?,?,?,?,?,?)')
      .run(routine.id, projectId, at, trigger, runWorkId, receipt, JSON.stringify(inputs), JSON.stringify({ created: created.map(item => item.id), closed }));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { coverage: 'active', receipt, created, closed };
}
