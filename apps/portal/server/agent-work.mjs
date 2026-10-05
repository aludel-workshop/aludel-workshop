// AGENT-WORK-01 A1: goal work items. A goal item belongs to the project, not to one layer: it carries a brief, phases with
// review gates, and actions (subtasks) that each name a layer. People and agents talk through one thread of events; a
// question, an allow request or a new action waiting for approval is a "need" that sits on its action. Changes are staged
// into one changeset per item through each layer's own API (the same staging Symphony runs use, keyed by the item).
// Design: docs/design/agent-work/plan.md (A1) and the a0/v2 prototype.
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { requireMember } from './accounts.mjs';
import { callOperation, draftChanges, draftOverlay, layerApi, stageOperation } from './layer-api.mjs';
import { layerPackageForProject } from './layer-package.mjs';
import { projectLayerDefinition } from './layer-registry.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const clean = (value, max, label, required = false) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) fail(`${label} is required.`);
  if (text.length > max) fail(`${label} must be ${max} characters or fewer.`);
  return text;
};

export const actionStates = ['proposed', 'todo', 'working', 'review', 'done'];
const needKinds = ['question', 'allow', 'approval'];
const eventKinds = ['message', 'log', 'steer', ...needKinds];
// The changeset of a goal item is staged under this key in layer_run_drafts.
export const changesetKey = workId => `goal-${workId}`;

export function initAgentWork(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_goal_phases (
      project_id TEXT NOT NULL, work_id TEXT NOT NULL, number INTEGER NOT NULL, title TEXT NOT NULL, gated INTEGER NOT NULL,
      PRIMARY KEY(work_id, number)
    );
    CREATE TABLE IF NOT EXISTS work_goal_actions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, work_id TEXT NOT NULL, number INTEGER NOT NULL, phase INTEGER NOT NULL,
      layer TEXT, goal TEXT NOT NULL, after_json TEXT NOT NULL, state TEXT NOT NULL, summary TEXT, added_by_json TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(work_id, number)
    );
    CREATE TABLE IF NOT EXISTS work_goal_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, work_id TEXT NOT NULL, action_number INTEGER,
      kind TEXT NOT NULL, author_json TEXT NOT NULL, body_json TEXT NOT NULL, created_at TEXT NOT NULL,
      resolved_at TEXT, resolution_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_goal_events ON work_goal_events(work_id, id);
  `);
}

// actor: { kind: 'person' | 'agent', id, name }. A person's local CLI agent acts as an agent on that person's behalf.
export function agentWork({ db, know, catalogs = null }) {
  const bus = new EventEmitter();
  bus.setMaxListeners(200);
  const emit = (projectId, workId, change) => bus.emit(`${projectId}:${workId}`, { at: now(), ...change });

  function goalItem(projectId, workId) {
    const item = know.workById(projectId, workId);
    if (!item || item.scope !== 'goal') fail('Work item not found.', 404);
    return item;
  }
  const goalOf = item => item.context?.goal || { brief: '', defined: false };
  function saveGoal(projectId, item, patch, logText = null, by = null) {
    const context = { ...(item.context || {}), goal: { ...goalOf(item), ...patch } };
    const log = logText ? [...item.log, { at: now(), text: logText, ...(by ? { by } : {}) }] : item.log;
    db.prepare('UPDATE layer_work_items SET context_json = ?, log_json = ?, updated_at = ? WHERE id = ? AND project_id = ?')
      .run(JSON.stringify(context), JSON.stringify(log), now(), item.id, projectId);
  }
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  function setState(projectId, item, state, logText, by) {
    const log = [...item.log, { at: now(), text: logText, ...(by ? { by } : {}) }];
    db.prepare('UPDATE layer_work_items SET state = ?, log_json = ?, updated_at = ? WHERE id = ? AND project_id = ?').run(state, JSON.stringify(log), now(), item.id, projectId);
  }
  const byOf = actor => ({ kind: actor.kind, id: actor.id });

  const phasesOf = (projectId, workId) => db.prepare('SELECT number, title, gated FROM work_goal_phases WHERE project_id = ? AND work_id = ? ORDER BY number').all(projectId, workId)
    .map(row => ({ number: row.number, title: row.title, gated: Boolean(row.gated) }));
  const actionRows = (projectId, workId) => db.prepare('SELECT * FROM work_goal_actions WHERE project_id = ? AND work_id = ? ORDER BY number').all(projectId, workId)
    .map(row => ({ id: row.id, number: row.number, phase: row.phase, layer: row.layer, goal: row.goal, after: parse(row.after_json, []), state: row.state,
      summary: row.summary || '', addedBy: parse(row.added_by_json, null), updatedAt: row.updated_at }));
  const eventRow = row => ({ id: row.id, action: row.action_number, kind: row.kind, author: parse(row.author_json, null), ...parse(row.body_json, {}),
    at: row.created_at, resolvedAt: row.resolved_at, resolution: parse(row.resolution_json, null) });
  const openNeeds = (projectId, workId) => db.prepare(`SELECT * FROM work_goal_events WHERE project_id = ? AND work_id = ? AND resolved_at IS NULL AND kind IN (${needKinds.map(() => '?').join(',')}) ORDER BY id`)
    .all(projectId, workId, ...needKinds).map(eventRow);

  // Why an action can't start yet: a review gate above it that isn't cleared, or an "after" action not yet handed over.
  function blockedReason(action, actions, phases) {
    for (const phase of phases.filter(entry => entry.gated && entry.number < action.phase)) {
      const open = actions.filter(other => other.phase <= phase.number && other.state !== 'proposed' && other.state !== 'done');
      if (open.length) return `Waits for the review gate after ${phase.title}`;
    }
    const waiting = action.after.map(number => actions.find(other => other.number === number)).filter(other => other && !['review', 'done'].includes(other.state));
    return waiting.length ? `Waits for #${waiting.map(other => other.number).join(', #')}` : null;
  }

  function view(projectId, workId) {
    const item = goalItem(projectId, workId);
    const phases = phasesOf(projectId, workId), actions = actionRows(projectId, workId), needs = openNeeds(projectId, workId);
    const events = db.prepare('SELECT * FROM (SELECT * FROM work_goal_events WHERE project_id = ? AND work_id = ? ORDER BY id DESC LIMIT 300) ORDER BY id').all(projectId, workId).map(eventRow);
    return { item, brief: goalOf(item).brief, defined: Boolean(goalOf(item).defined), performer: goalOf(item).performer || null, code: goalOf(item).code || null, phases,
      actions: actions.map(action => ({ ...action, needs: needs.filter(need => need.action === action.number), blocked: ['todo', 'proposed'].includes(action.state) ? blockedReason(action, actions, phases) : null })),
      needs, events, changeset: changeset(projectId, workId) };
  }

  function createGoal(user, projectId, input = {}) {
    const brief = clean(input.brief, 8000, 'Brief');
    const item = know.createWork(projectId, { scope: 'goal', title: input.title, state: 'suggested', priority: input.priority, project: input.project ?? null,
      context: { goal: { brief, defined: false } }, logText: `Created by ${user.name}` }, user.name);
    record(projectId, item.id, { kind: 'log', author: { kind: 'person', id: user.id, name: user.name }, text: 'Created as a draft' });
    return view(projectId, item.id);
  }

  // A layer an action may name: an installed layer of this project, or the host's own (Work).
  function checkLayer(projectId, layer) {
    if (layer === null || layer === undefined || layer === '') return null;
    if (typeof layer !== 'string' || !projectLayerDefinition(db, projectId, layer)) fail(`Unknown layer: ${layer}.`);
    return layer;
  }
  function checkAfter(after, number, known) {
    const list = [...new Set((Array.isArray(after) ? after : []).map(Number))];
    for (const other of list) if (!Number.isInteger(other) || other >= number || !known.has(other)) fail(`#${number} can only follow an earlier action.`);
    return list;
  }

  // Defining: the brief, the phases (each may end in a review gate) and the first actions. It replaces earlier definitions
  // until work starts; then actions change one by one.
  function define(actor, projectId, workId, input = {}) {
    const item = goalItem(projectId, workId);
    if (!['suggested', 'ready'].includes(item.state)) fail(`${item.ref} has started; change its actions one at a time.`, 409);
    const brief = clean(input.brief, 8000, 'Brief', true);
    const phases = Array.isArray(input.phases) && input.phases.length ? input.phases : [{ title: 'Work', gated: false }];
    if (phases.length > 8) fail('Use up to eight phases.');
    const actions = Array.isArray(input.actions) ? input.actions : [];
    if (!actions.length) fail('Name at least one action.');
    if (actions.length > 30) fail('Use up to thirty actions.');
    const known = new Set();
    const rows = actions.map((action, index) => {
      const number = index + 1, phase = Number(action.phase ?? 1);
      if (!Number.isInteger(phase) || phase < 1 || phase > phases.length) fail(`#${number} names a phase that doesn't exist.`);
      const row = { number, phase, layer: checkLayer(projectId, action.layer), goal: clean(action.goal, 1000, `#${number}'s goal`, true), after: checkAfter(action.after, number, known) };
      known.add(number);
      return row;
    });
    const at = now();
    transaction(() => {
      db.prepare('DELETE FROM work_goal_phases WHERE project_id = ? AND work_id = ?').run(projectId, workId);
      db.prepare('DELETE FROM work_goal_actions WHERE project_id = ? AND work_id = ?').run(projectId, workId);
      phases.forEach((phase, index) => db.prepare('INSERT INTO work_goal_phases VALUES (?, ?, ?, ?, ?)')
        .run(projectId, workId, index + 1, clean(phase.title, 80, 'Phase title', true), phase.gated ? 1 : 0));
      for (const row of rows) db.prepare('INSERT INTO work_goal_actions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(`act-${randomBytes(4).toString('hex')}`, projectId, workId, row.number, row.phase, row.layer, row.goal, JSON.stringify(row.after), 'todo', null, JSON.stringify(actor), at, at);
    });
    saveGoal(projectId, item, { brief, defined: true }, `${actor.name} defined it: ${rows.length} action${rows.length === 1 ? '' : 's'}`, byOf(actor));
    if (item.state === 'suggested') setState(projectId, goalItem(projectId, workId), 'ready', 'Moved to Ready', byOf(actor));
    record(projectId, workId, { kind: 'log', author: actor, text: `Defined: ${rows.length} action${rows.length === 1 ? '' : 's'} in ${phases.length} phase${phases.length === 1 ? '' : 's'}` });
    emit(projectId, workId, { type: 'item' });
    return view(projectId, workId);
  }

  // Board moves (the deliberate act of the board): Draft ⇄ Ready, Ready → In progress, In progress → In review.
  // Done comes only from the item's close-out (A4).
  function move(user, projectId, workId, to) {
    const item = goalItem(projectId, workId);
    const by = { kind: 'person', id: user.id };
    if (item.board === to) return view(projectId, workId);
    if (to === 'draft') {
      if (item.board !== 'ready') fail(`${item.ref} has started; it can't go back to Draft.`, 409);
      setState(projectId, item, 'suggested', 'Moved back to Draft', by);
    } else if (to === 'ready') {
      if (item.board !== 'draft') fail(`${item.ref} can't move back to Ready.`, 409);
      if (!goalOf(item).defined) fail(`Define ${item.ref} first: a brief and at least one action.`, 409);
      setState(projectId, item, 'ready', 'Moved to Ready', by);
    } else if (to === 'progress') {
      if (item.board !== 'ready') fail(`Only a Ready item can start.`, 409);
      if (!item.assignee) fail(`Choose who works on ${item.ref}: send it to an agent or claim it.`, 409);
      setState(projectId, item, 'claimed', 'Started', by);
      saveGoal(projectId, goalItem(projectId, workId), { startedAt: now() });
    } else if (to === 'review') {
      if (item.board !== 'progress') fail(`Only an item in progress can go to review.`, 409);
      const actions = actionRows(projectId, workId).filter(action => action.state !== 'proposed');
      const left = actions.filter(action => !['review', 'done'].includes(action.state));
      if (left.length) fail(`#${left.map(action => action.number).join(', #')} ${left.length === 1 ? 'is' : 'are'} not ready for review yet.`, 409);
      if (openNeeds(projectId, workId).length) fail('Answer what the item is waiting on first.', 409);
      setState(projectId, item, 'review', 'Ready for review', by);
    } else if (to === 'done') fail(`${item.ref} closes from the item once its actions are reviewed.`, 409);
    else fail('Unknown column.');
    record(projectId, workId, { kind: 'log', author: { kind: 'person', id: user.id, name: user.name }, text: `Moved to ${{ draft: 'Draft', ready: 'Ready', progress: 'In progress', review: 'In review' }[to]}` });
    emit(projectId, workId, { type: 'item' });
    return view(projectId, workId);
  }

  // Claiming: the person takes the item to work on locally with their own agent (A8), or defines it themselves.
  function claim(user, projectId, workId) {
    requireMember(db, user, projectId);
    const item = goalItem(projectId, workId);
    if (item.assignee && !(item.assignee.kind === 'person' && item.assignee.id === user.id)) fail(`${item.ref} is assigned to ${item.assignee.label}.`, 409);
    db.prepare("UPDATE layer_work_items SET assignee_kind = 'person', assignee_id = ?, assignee_label = ?, profile_id = NULL, updated_at = ? WHERE id = ? AND project_id = ?")
      .run(user.id, user.name, now(), workId, projectId);
    saveGoal(projectId, goalItem(projectId, workId), { performer: 'local' }, `${user.name} claimed it to work locally`, { kind: 'person', id: user.id });
    record(projectId, workId, { kind: 'log', author: { kind: 'person', id: user.id, name: user.name }, text: 'Claimed to work locally' });
    emit(projectId, workId, { type: 'item' });
    return view(projectId, workId);
  }
  // The local agent works for the person the item is assigned to. Writes need the item claimed by that person.
  function assertPerformer(user, projectId, workId) {
    const item = goalItem(projectId, workId);
    if (item.assignee?.kind !== 'person' || item.assignee.id !== user.id) fail('Task not found.', 404);
    return item;
  }

  function addAction(actor, projectId, workId, input = {}) {
    const item = goalItem(projectId, workId);
    if (item.board === 'done') fail(`${item.ref} is closed.`, 409);
    const actions = actionRows(projectId, workId), phases = phasesOf(projectId, workId);
    if (actions.length >= 30) fail('Use up to thirty actions.');
    const number = (actions.at(-1)?.number || 0) + 1;
    const phase = Number(input.phase ?? (phases.at(-1)?.number || 1));
    if (!phases.length) db.prepare('INSERT INTO work_goal_phases VALUES (?, ?, 1, ?, 0)').run(projectId, workId, 'Work');
    if (!Number.isInteger(phase) || phase < 1 || phase > Math.max(1, phases.length)) fail(`#${number} names a phase that doesn't exist.`);
    const goal = clean(input.goal, 1000, `#${number}'s goal`, true);
    const after = checkAfter(input.after, number, new Set(actions.map(action => action.number)));
    // Once work has started, an agent's new action waits for a person's approval; a person's own is approved by adding it.
    const needsApproval = actor.kind === 'agent' && !['draft', 'ready'].includes(item.board);
    const at = now();
    db.prepare('INSERT INTO work_goal_actions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(`act-${randomBytes(4).toString('hex')}`, projectId, workId, number, phase, checkLayer(projectId, input.layer), goal, JSON.stringify(after), needsApproval ? 'proposed' : 'todo',
        null, JSON.stringify(actor), at, at);
    if (needsApproval) record(projectId, workId, { kind: 'approval', action: number, author: actor, text: clean(input.reason, 1000, 'Reason') || `New action: ${goal}` });
    else record(projectId, workId, { kind: 'log', action: number, author: actor, text: `Added #${number}` });
    emit(projectId, workId, { type: 'action', number });
    return view(projectId, workId);
  }

  const agentMoves = { todo: ['working'], working: ['review', 'todo'], review: ['working'], proposed: [] };
  function updateAction(actor, projectId, workId, number, input = {}) {
    const item = goalItem(projectId, workId);
    const actions = actionRows(projectId, workId), phases = phasesOf(projectId, workId);
    const action = actions.find(entry => entry.number === Number(number)) || fail('Action not found.', 404);
    const next = { ...action };
    if (input.goal !== undefined) next.goal = clean(input.goal, 1000, `#${action.number}'s goal`, true);
    if (input.summary !== undefined) next.summary = clean(input.summary, 4000, 'Summary');
    if (input.layer !== undefined) next.layer = checkLayer(projectId, input.layer);
    if (input.after !== undefined) next.after = checkAfter(input.after, action.number, new Set(actions.map(entry => entry.number)));
    if (input.phase !== undefined) {
      const phase = Number(input.phase);
      if (!Number.isInteger(phase) || phase < 1 || phase > phases.length) fail(`#${action.number} names a phase that doesn't exist.`);
      next.phase = phase;
    }
    if (input.state !== undefined && input.state !== action.state) {
      if (!actionStates.includes(input.state)) fail('Unknown action state.');
      if (action.state === 'proposed') fail(`#${action.number} waits for approval.`, 409);
      if (input.state === 'proposed') fail('Only a new action is proposed.');
      if (actor.kind === 'agent' && !(agentMoves[action.state] || []).includes(input.state)) fail(`An agent can't move #${action.number} from ${action.state} to ${input.state}.`, 409);
      if (input.state === 'working') {
        if (item.board !== 'progress') fail(`Start ${item.ref} before working on its actions.`, 409);
        const reason = blockedReason(next, actions, phases);
        if (reason) fail(`#${action.number} can't start: ${reason.toLowerCase()}.`, 409);
      }
      next.state = input.state;
    }
    db.prepare('UPDATE work_goal_actions SET goal = ?, summary = ?, layer = ?, after_json = ?, phase = ?, state = ?, updated_at = ? WHERE id = ? AND project_id = ?')
      .run(next.goal, next.summary || null, next.layer, JSON.stringify(next.after), next.phase, next.state, now(), action.id, projectId);
    const changed = ['goal', 'summary', 'layer', 'after', 'phase', 'state'].filter(key => JSON.stringify(next[key]) !== JSON.stringify(action[key]));
    if (changed.length) record(projectId, workId, { kind: 'log', action: action.number, author: actor,
      text: changed.includes('state') ? `#${action.number}: ${{ todo: 'to do', working: 'working', review: 'ready for review', done: 'done' }[next.state]}` : `Changed #${action.number}'s ${changed.join(', ')}` });
    emit(projectId, workId, { type: 'action', number: action.number });
    return view(projectId, workId);
  }

  // The thread: messages and logs, and needs (a question, an allow request) that sit on an action until answered.
  function record(projectId, workId, { kind, action = null, author, text, options = null, ...extra }) {
    if (!eventKinds.includes(kind)) fail('Unknown event kind.');
    const body = { text: clean(text, 4000, 'Message', true), ...(options ? { options } : {}), ...extra };
    const info = db.prepare('INSERT INTO work_goal_events(project_id, work_id, action_number, kind, author_json, body_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(projectId, workId, action, kind, JSON.stringify(author), JSON.stringify(body), now());
    emit(projectId, workId, { type: 'event', id: Number(info.lastInsertRowid), kind, action });
    return Number(info.lastInsertRowid);
  }
  function post(actor, projectId, workId, input = {}) {
    const item = goalItem(projectId, workId);
    const kind = input.kind || 'message';
    if (!['message', 'log', 'steer', 'question', 'allow'].includes(kind)) fail('Post a message, a log line, a question or an allow request.');
    if (kind === 'steer' && actor.kind !== 'person') fail('Only a person steers.', 403);
    if (['question', 'allow'].includes(kind) && actor.kind !== 'agent') fail('Only the working agent asks.', 403);
    const action = input.action === undefined || input.action === null ? null : Number(input.action);
    if (action !== null && !actionRows(projectId, workId).some(entry => entry.number === action)) fail('Action not found.', 404);
    if (['question', 'allow'].includes(kind) && action === null) fail('A question or an allow request sits on an action.');
    const options = kind === 'question' && Array.isArray(input.options)
      ? input.options.slice(0, 6).map(option => clean(option, 200, 'Option', true)) : null;
    const id = record(projectId, workId, { kind, action, author: actor, text: input.text, options });
    if (item.board === 'progress' && ['question', 'allow'].includes(kind) && item.state === 'claimed') setState(projectId, item, 'needs-input', 'Waiting on you', byOf(actor));
    return { id, ...view(projectId, workId) };
  }
  function answer(user, projectId, workId, eventId, input = {}) {
    const item = goalItem(projectId, workId);
    const row = db.prepare('SELECT * FROM work_goal_events WHERE id = ? AND work_id = ? AND project_id = ?').get(Number(eventId), workId, projectId);
    if (!row || !needKinds.includes(row.kind)) fail('Nothing to answer.', 404);
    if (row.resolved_at) fail('Already answered.', 409);
    const need = eventRow(row);
    let resolution;
    if (need.kind === 'question') {
      const text = clean(input.text ?? input.choice, 2000, 'Answer', true);
      resolution = { text };
    } else {
      if (typeof input.allow !== 'boolean') fail('Allow or decline it.');
      resolution = { allow: input.allow, note: clean(input.note, 1000, 'Note') };
      if (need.kind === 'approval') {
        const action = actionRows(projectId, workId).find(entry => entry.number === need.action);
        if (action?.state === 'proposed') {
          if (input.allow) db.prepare("UPDATE work_goal_actions SET state = 'todo', updated_at = ? WHERE id = ? AND project_id = ?").run(now(), action.id, projectId);
          else db.prepare('DELETE FROM work_goal_actions WHERE id = ? AND project_id = ?').run(action.id, projectId);
        }
      }
    }
    db.prepare('UPDATE work_goal_events SET resolved_at = ?, resolution_json = ? WHERE id = ? AND project_id = ?').run(now(), JSON.stringify({ ...resolution, by: { id: user.id, name: user.name } }), row.id, projectId);
    const author = { kind: 'person', id: user.id, name: user.name };
    record(projectId, workId, { kind: 'log', action: need.action, author,
      text: need.kind === 'question' ? `Answered: ${resolution.text}` : need.kind === 'approval' ? (resolution.allow ? `Approved #${need.action}` : `Declined #${need.action}`) : resolution.allow ? 'Allowed' : 'Declined' });
    if (item.state === 'needs-input' && !openNeeds(projectId, workId).length) setState(projectId, goalItem(projectId, workId), 'claimed', 'Answered; work continues', { kind: 'person', id: user.id });
    emit(projectId, workId, { type: 'item' });
    return view(projectId, workId);
  }

  // Staging: one changeset per item across layers, through each layer's API. Nothing applies until close-out (A4).
  function stage(actor, projectId, workId, input = {}) {
    const item = goalItem(projectId, workId);
    if (item.board !== 'progress') fail(`Start ${item.ref} before changing layers.`, 409);
    const action = actionRows(projectId, workId).find(entry => entry.number === Number(input.action));
    if (!action) fail('Stage a change under one of the item\'s actions.');
    if (action.state !== 'working') fail(`Move #${action.number} to working before it changes anything.`, 409);
    const layer = checkLayer(projectId, input.layer || action.layer) || fail('Name the layer to change.');
    const api = layerApi(db, projectId, layer) || fail(`The ${layer} layer publishes no API to stage through.`, 409);
    const result = stageOperation({ db, catalogs: catalogs || know.catalogs, api, projectId, attemptId: changesetKey(workId), operationId: clean(input.operationId, 120, 'Operation', true), id: input.id ?? null, body: input.body || {} });
    if (result.staged) record(projectId, workId, { kind: 'log', action: action.number, author: actor, text: `Staged ${result.staged.op} of ${result.staged.kind.replace(/_/g, ' ')} in ${layer}` });
    return result;
  }
  // A8: Code changes made locally live on a branch of the person's checkout, not in the record changeset. The local agent
  // reports where they are; close-out (A4) reviews and merges that branch. Only names and hashes are stored, never content.
  function recordCode(actor, projectId, workId, input = {}) {
    const item = goalItem(projectId, workId);
    if (!['progress', 'review'].includes(item.board)) fail(`Start ${item.ref} before reporting code.`, 409);
    const branch = clean(input.branch, 200, 'Branch', true);
    if (!/^[A-Za-z0-9._/-]+$/.test(branch)) fail('Name a git branch.');
    const commit = clean(input.commit, 64, 'Commit', true);
    if (!/^[0-9a-f]{7,64}$/.test(commit)) fail('Give the commit as a hex hash.');
    const base = input.base ? clean(input.base, 64, 'Base commit') : null;
    if (base && !/^[0-9a-f]{7,64}$/.test(base)) fail('Give the base as a hex hash.');
    const files = (Array.isArray(input.files) ? input.files : []).slice(0, 500).map(file => ({ path: clean(file?.path, 400, 'File path', true), status: ['added', 'modified', 'deleted', 'renamed'].includes(file?.status) ? file.status : 'modified' }));
    const code = { branch, commit, base, files, at: now() };
    saveGoal(projectId, item, { code }, `${actor.name} reported ${branch} at ${commit.slice(0, 7)}`, byOf(actor));
    record(projectId, workId, { kind: 'log', author: actor, text: `Code on ${branch} at ${commit.slice(0, 7)}: ${files.length} file${files.length === 1 ? '' : 's'} changed` });
    emit(projectId, workId, { type: 'item' });
    return view(projectId, workId);
  }
  function changeset(projectId, workId) {
    const rows = db.prepare('SELECT layer_key, writes_json FROM layer_run_drafts WHERE attempt_id = ? AND project_id = ? ORDER BY seq').all(changesetKey(workId), projectId);
    if (!rows.length) return [];
    const layerOf = new Map();
    for (const row of rows) for (const write of parse(row.writes_json, [])) layerOf.set(write.id, row.layer_key);
    const changes = draftChanges(db, projectId, changesetKey(workId));
    const layers = [...new Set(rows.map(row => row.layer_key))];
    return layers.map(layer => ({ layer, changes: changes.filter(change => layerOf.get(change.id) === layer) }));
  }

  // Reading: the stack map is always loaded; a layer's records and read operations on demand.
  function stackMap(projectId) {
    const rows = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_instances'").get()
      ? db.prepare('SELECT layer_key AS key FROM layer_instances WHERE project_id = ? AND enabled = 1 ORDER BY rowid').all(projectId) : [];
    return rows.map(({ key }) => {
      const definition = projectLayerDefinition(db, projectId, key);
      let charter = null, operations = [];
      try { charter = layerPackageForProject(db, projectId, key)?.charter || null; } catch { charter = null; }
      try { operations = [...(layerApi(db, projectId, key)?.operations.values() || [])].map(op => ({ operationId: op.operationId, summary: op.summary, reads: Boolean(op.read), writes: op.output || null, elevated: op.access === 'elevated' })); } catch { operations = []; }
      return { key, name: definition?.name || key, description: definition?.description || '', outputs: definition?.outputs || [],
        charter: charter ? charter.split(/\n\s*\n/).find(part => part.trim() && !part.trim().startsWith('#'))?.trim().slice(0, 1200) || null : null, operations };
    });
  }
  function readLayer(projectId, workId, layer, input = {}) {
    if (workId) goalItem(projectId, workId);
    const api = layerApi(db, projectId, checkLayer(projectId, layer) || fail('Name the layer to read.')) || fail(`The ${layer} layer publishes no API.`, 409);
    const operation = api.operations.get(input.operationId) || fail(`The ${layer} API has no operation ${input.operationId}.`, 404);
    if (!operation.read) fail('Use stage_change for operations that write.');
    // Reads see the item's own staged changes, so an agent reads what it has written so far.
    return callOperation({ db, catalogs: catalogs || know.catalogs, api, projectId, operationId: operation.operationId, id: input.id ?? null, overlay: workId ? draftOverlay(db, projectId, changesetKey(workId)) : null }).result;
  }

  // assignedTo: the person's own items. claimableBy: also the open items nobody has taken yet.
  function goals(projectId, { assignedTo = null, claimableBy = null } = {}) {
    const mine = (item, id) => item.assignee?.kind === 'person' && item.assignee.id === id;
    return know.workList(projectId).filter(item => item.scope === 'goal' && (claimableBy ? mine(item, claimableBy) || (!item.assignee && ['draft', 'ready'].includes(item.board)) : !assignedTo || mine(item, assignedTo)))
      .map(item => ({ id: item.id, ref: item.ref, title: item.title, board: item.board, priority: item.priority, assignee: item.assignee, defined: Boolean(item.context?.goal?.defined),
        actions: db.prepare("SELECT state, COUNT(*) AS n FROM work_goal_actions WHERE project_id = ? AND work_id = ? AND state != 'proposed' GROUP BY state").all(projectId, item.id)
          .reduce((sum, row) => ({ ...sum, [row.state]: row.n }), {}), needs: openNeeds(projectId, item.id).length }));
  }
  function subscribe(projectId, workId, listener) {
    goalItem(projectId, workId);
    const key = `${projectId}:${workId}`;
    bus.on(key, listener);
    return () => bus.off(key, listener);
  }

  return { createGoal, view, define, move, claim, assertPerformer, addAction, updateAction, post, answer, stage, recordCode, changeset, stackMap, readLayer, goals, subscribe };
}
