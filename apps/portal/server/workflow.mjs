import { randomUUID } from 'node:crypto';
import { getProposal } from './product-records.mjs';
export const boundary = 'Local research, design, repository edits, checks and local preview for this scope. Stop for consequential questions. No spending, external writes, release or acceptance.';
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const required = value => { if (typeof value !== 'string' || !value.trim()) fail('A non-empty description is required.', 400); return value.trim(); };
export function initWorkflow(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS work_items (id TEXT PRIMARY KEY, version INTEGER NOT NULL, state TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS work_events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES work_items(id), actor TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL);`);
}
export function workList(db) {
  return db.prepare('SELECT * FROM work_items ORDER BY rowid DESC').all().map(row => {
    const task = { ...JSON.parse(row.data), id: row.id, version: row.version, state: row.state };
    const current = getProposal(db, task.proposal.id);
    const open = current?.decisions?.some(decision => decision.status !== 'answered');
    const changed = !current || current.revision !== task.proposal.revision || JSON.stringify(current.decisions) !== JSON.stringify(task.proposal.decisions);
    return { ...task,
      input_status: open ? 'open' : changed ? 'changed' : 'current',
      input_message: open ? 'A required decision is still open.' : changed ? 'Decision or proposal inputs changed after this scope was prepared.' : undefined,
      events: db.prepare('SELECT sequence, actor, action, created_at, payload FROM work_events WHERE task_id = ? ORDER BY sequence').all(row.id).map(event => ({ ...event, payload: JSON.parse(event.payload) })) };
  });
}
export function workOperation(db, actor, action, input = {}) {
  const allowed = actor === 'owner' ? ['authorize', 'answer', 'cancel', 'resume', 'refresh'] : actor === 'operator' ? ['prepare', 'claim', 'progress', 'question', 'submit', 'fail', 'cancelled'] : [];
  if (!allowed.includes(action)) fail('This actor cannot perform that operation.', 403);
  db.exec('BEGIN IMMEDIATE');
  try {
    let task;
    if (action === 'prepare') {
      const proposal = getProposal(db, input.proposalId);
      if (!proposal || proposal.revision !== input.proposalRevision) fail('Select the current proposal revision.');
      task = { id: `WORK-${randomUUID()}`, version: 0, state: 'ready', title: required(input.title), scope: required(input.scope), acceptance: required(input.acceptance), proposal, boundary, worker: null, question: null };
      db.prepare('INSERT INTO work_items VALUES (?, 0, ?, ?)').run(task.id, task.state, JSON.stringify(task));
    } else {
      task = workList(db).find(item => item.id === input.id);
      if (!task) fail('Work item not found.', 404);
      if (input.expectedVersion !== task.version) fail('Work changed. Refresh and review the current version; your draft is retained.');
      delete task.events; delete task.input_status; delete task.input_message;
      const current = getProposal(db, task.proposal.id);
      const currentInputs = () => {
        if (!current) fail('The source proposal no longer exists. Prepare a replacement work item.');
        if (current?.revision !== task.proposal.revision) fail('Proposal changed. Prepare a new work item against its current revision.');
        if (current.decisions.some(d => d.status !== 'answered') || JSON.stringify(current.decisions) !== JSON.stringify(task.proposal.decisions)) fail('Decision inputs changed or remain open. Prepare a new work item after resolving them.');
      };
      if (action === 'refresh') {
        if (task.state !== 'ready') fail('Only ready work can refresh its inputs.');
        if (!current) fail('The source proposal no longer exists. Prepare a replacement work item.');
        if (current.decisions.some(decision => decision.status !== 'answered')) fail('Resolve the open decision before refreshing this work item.');
        task.proposal = current;
      } else if (action === 'authorize') {
        if (task.state !== 'ready') fail('Only ready work can be authorized.');
        currentInputs(); task.state = 'authorized'; task.authorization = { at: new Date().toISOString(), proposalRevision: task.proposal.revision, boundary, scope: task.scope };
      } else if (action === 'claim') {
        if (task.state !== 'authorized') fail('Only authorized work can be claimed.');
        if (db.prepare("SELECT id FROM work_items WHERE state IN ('running','cancelling')").get()) fail('Another work item is active.');
        currentInputs(); task.state = 'running'; task.worker = required(input.worker); task.attempt = randomUUID();
      } else if (action === 'answer') {
        if (task.state !== 'awaiting-answer') fail('No question is awaiting an answer.');
        task.answer = required(input.text); task.state = 'paused';
      } else if (action === 'resume') {
        if (task.state !== 'paused') fail('Only answered, paused work can resume.');
        currentInputs(); task.state = 'authorized'; task.worker = null;
      } else if (action === 'cancel') {
        if (['submitted', 'failed', 'cancelled'].includes(task.state)) fail('Work is already terminal.');
        task.state = task.state === 'running' || task.state === 'cancelling' ? 'cancelling' : 'cancelled';
      } else {
        if (input.attempt !== task.attempt || input.worker !== task.worker) fail('The current worker and attempt are required.');
        if (action === 'cancelled') {
          if (task.state !== 'cancelling') fail('Cancellation was not requested.');
          task.state = 'cancelled';
        } else {
          if (task.state !== 'running') fail('Work is not running.');
          currentInputs();
          if (action === 'question') { task.question = required(input.text); task.answer = null; task.state = 'awaiting-answer'; }
          if (action === 'submit') { task.evidence = required(input.text); task.state = 'submitted'; }
          if (action === 'fail') { task.failure = required(input.text); task.state = 'failed'; }
          if (action === 'progress') required(input.text);
        }
      }
    }
    task.version++;
    db.prepare('UPDATE work_items SET version = ?, state = ?, data = ? WHERE id = ?').run(task.version, task.state, JSON.stringify(task), task.id);
    db.prepare('INSERT INTO work_events(task_id, actor, action, created_at, payload) VALUES (?, ?, ?, ?, ?)').run(task.id, actor, action, new Date().toISOString(), JSON.stringify({ ...input, boundary: action === 'authorize' ? boundary : undefined }));
    db.exec('COMMIT'); return workList(db).find(item => item.id === task.id);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
