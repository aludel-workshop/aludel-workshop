// AGENT-WORK-01 A1: goal work items. A goal item belongs to the project, not to one layer: it carries a brief, phases with
// review gates, and actions (subtasks) that each name a layer. People and agents talk through one thread of events; a
// question, an allow request or a new action waiting for approval is a "need" that sits on its action. Changes are staged
// into one changeset per item through each layer's own API (the same staging Symphony runs use, keyed by the item).
// Design: docs/design/agent-work/plan.md (A1) and the a0/v2 prototype.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getUser, isMember, requireMember } from './accounts.mjs';
import { gitWithToken } from './git-repository.mjs';
import { applyWrites, callOperation, draftChanges, draftOverlay, handlerCatalogs, layerApi, stageOperation } from './layer-api.mjs';
import { layerCatalog } from './layer-contract.mjs';
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
// A flag is a person's review note on an action: the action goes back to working and the agent addresses it.
const eventKinds = ['message', 'log', 'steer', 'flag', ...needKinds];
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
    -- A4: which action staged each draft row of the item's changeset, so review is per action.
    CREATE TABLE IF NOT EXISTS work_goal_staged (
      project_id TEXT NOT NULL, work_id TEXT NOT NULL, seq INTEGER NOT NULL, action_number INTEGER NOT NULL, PRIMARY KEY(work_id, seq)
    );
    -- W-8 attempt 2, E3: work items an action proposes (follow-ups, or what has to happen before a retry), each decided by a
    -- person; after_json names other proposals of the same item that come first, and becomes their items' blocking links.
    CREATE TABLE IF NOT EXISTS work_goal_proposals (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, work_id TEXT NOT NULL, action_number INTEGER NOT NULL, position INTEGER NOT NULL,
      title TEXT NOT NULL, brief TEXT NOT NULL, why TEXT NOT NULL, after_json TEXT NOT NULL, author_json TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('proposed', 'created', 'dismissed')), created_work_id TEXT, decided_json TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_goal_proposals ON work_goal_proposals(work_id, action_number, position);
  `);
  // E3: a wrap-up action ends its item as not done (the orchestrator decided it can't be finished this time).
  if (!db.prepare('PRAGMA table_info(work_goal_actions)').all().some(column => column.name === 'kind')) db.exec('ALTER TABLE work_goal_actions ADD COLUMN kind TEXT');
  // W-25: what an action hands over to look at with its review: a preview link (from wherever the agent serves it), the
  // commit it shows and what to try, or why there is none.
  if (!db.prepare('PRAGMA table_info(work_goal_actions)').all().some(column => column.name === 'preview_json')) db.exec('ALTER TABLE work_goal_actions ADD COLUMN preview_json TEXT');
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
      summary: row.summary || '', addedBy: parse(row.added_by_json, null), updatedAt: row.updated_at, kind: row.kind || null, preview: parse(row.preview_json, null) }));
  const proposalRow = row => ({ id: row.id, action: row.action_number, position: row.position, title: row.title, brief: row.brief, why: row.why,
    after: parse(row.after_json, []), author: parse(row.author_json, null), state: row.state, createdWorkId: row.created_work_id, decided: parse(row.decided_json, null) });
  const proposalRows = (projectId, workId) => db.prepare('SELECT * FROM work_goal_proposals WHERE project_id = ? AND work_id = ? ORDER BY action_number, position').all(projectId, workId).map(proposalRow);
  // The item's wrap-up action, once it isn't waiting for approval: the item then ends as not done.
  const wrapUpOf = actions => actions.find(action => action.kind === 'wrap-up' && action.state !== 'proposed') || null;
  const eventRow = row => ({ id: row.id, action: row.action_number, kind: row.kind, author: parse(row.author_json, null), ...parse(row.body_json, {}),
    at: row.created_at, resolvedAt: row.resolved_at, resolution: parse(row.resolution_json, null) });
  const openNeeds = (projectId, workId) => db.prepare(`SELECT * FROM work_goal_events WHERE project_id = ? AND work_id = ? AND resolved_at IS NULL AND kind IN (${needKinds.map(() => '?').join(',')}) ORDER BY id`)
    .all(projectId, workId, ...needKinds).map(eventRow);

  // Why an action can't start yet: a review gate above it that isn't cleared, or an "after" action not yet handed over.
  function blockedReason(action, actions, phases) {
    if (action.kind === 'wrap-up') return null; // it ends the item; nothing it would wait for is going to finish
    for (const phase of phases.filter(entry => entry.gated && entry.number < action.phase)) {
      const open = actions.filter(other => other.phase <= phase.number && other.state !== 'proposed' && other.state !== 'done');
      if (open.length) return `Waits for the review gate after ${phase.title}`;
    }
    const waiting = action.after.map(number => actions.find(other => other.number === number)).filter(other => other && !['review', 'done'].includes(other.state));
    return waiting.length ? `Waits for #${waiting.map(other => other.number).join(', #')}` : null;
  }

  // Stale once the item's reported code isn't the commit the preview shows (either may be abbreviated).
  const previewView = (preview, code) => preview && preview.url
    ? { ...preview, stale: Boolean(preview.commit && code?.commit && !code.commit.startsWith(preview.commit) && !preview.commit.startsWith(code.commit)) } : preview;
  function view(projectId, workId) {
    const item = goalItem(projectId, workId);
    const phases = phasesOf(projectId, workId), actions = actionRows(projectId, workId), needs = openNeeds(projectId, workId), proposals = proposalRows(projectId, workId);
    const wrapUp = wrapUpOf(actions);
    const events = db.prepare('SELECT * FROM (SELECT * FROM work_goal_events WHERE project_id = ? AND work_id = ? ORDER BY id DESC LIMIT 300) ORDER BY id').all(projectId, workId).map(eventRow);
    return { item, brief: goalOf(item).brief, defined: Boolean(goalOf(item).defined), performer: goalOf(item).performer || null, code: goalOf(item).code ? { ...goalOf(item).code, inRepository: Boolean(goalOf(item).code.merged) || codeMerged(projectId, goalOf(item).code), target: goalOf(item).code.merged?.into || repository(projectId)?.target || null } : null, phases,
      actions: actions.map(action => ({ ...action, preview: previewView(action.preview, goalOf(item).code), needs: needs.filter(need => need.action === action.number), blocked: ['todo', 'proposed'].includes(action.state) ? blockedReason(action, actions, phases) : null,
        proposals: proposals.filter(proposal => proposal.action === action.number).map(proposal => {
          const created = proposal.createdWorkId ? know.workById(projectId, proposal.createdWorkId) : null;
          return { ...proposal, created: created ? { ref: created.ref, title: created.title } : null };
        }) })),
      ending: wrapUp ? { kind: 'not-done', action: wrapUp.number, reason: wrapUp.summary } : null, outcome: goalOf(item).outcome || null,
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
      for (const row of rows) db.prepare('INSERT INTO work_goal_actions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)')
        .run(`act-${randomBytes(4).toString('hex')}`, projectId, workId, row.number, row.phase, row.layer, row.goal, JSON.stringify(row.after), 'todo', null, JSON.stringify(actor), at, at);
    });
    saveGoal(projectId, item, { brief, defined: true }, `${actor.name} defined it: ${rows.length} action${rows.length === 1 ? '' : 's'}`, byOf(actor));
    if (item.state === 'suggested') setState(projectId, goalItem(projectId, workId), 'ready', 'Moved to Ready', byOf(actor));
    record(projectId, workId, { kind: 'log', author: actor, text: `Defined: ${rows.length} action${rows.length === 1 ? '' : 's'} in ${phases.length} phase${phases.length === 1 ? '' : 's'}` });
    emit(projectId, workId, { type: 'item' });
    return view(projectId, workId);
  }

  // W-8 F34: an action added to an item in review has to be worked, so the item goes back to In progress, as a flag does.
  function reopen(projectId, workId, number, actor) {
    const item = goalItem(projectId, workId);
    if (item.board === 'review') setState(projectId, item, 'claimed', `Back in progress: #${number} was added`, byOf(actor));
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
    } else if (to === 'progress' && item.board === 'review') {
      // W-8 F34: a person takes an item back out of review to do more on it.
      setState(projectId, item, 'claimed', 'Back in progress', by);
    } else if (to === 'progress') {
      if (item.board !== 'ready') fail(`Only a Ready item can start.`, 409);
      if (!item.assignee) fail(`Choose who works on ${item.ref}: send it to an agent or claim it.`, 409);
      setState(projectId, item, 'claimed', 'Started', by);
      saveGoal(projectId, goalItem(projectId, workId), { startedAt: now() });
    } else if (to === 'review') {
      if (item.board !== 'progress') fail(`Only an item in progress can go to review.`, 409);
      const actions = actionRows(projectId, workId).filter(action => action.state !== 'proposed');
      // Ending as not done, only the wrap-up is reviewed; the rest stays as it was left.
      const wrapUp = wrapUpOf(actions);
      const left = (wrapUp ? [wrapUp] : actions).filter(action => !['review', 'done'].includes(action.state));
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
  // Who works on it is the assignee: a person works on their own machine (with their own agent), and one of the project's
  // agents works remotely, which waits for the remote runtime (A2). Changeable until the item starts.
  function assign(user, projectId, workId, assignee) {
    requireMember(db, user, projectId);
    const item = goalItem(projectId, workId);
    if (!['draft', 'ready'].includes(item.board)) fail(`${item.ref} has started; its assignee stays.`, 409);
    const by = { kind: 'person', id: user.id }, author = { kind: 'person', id: user.id, name: user.name };
    if (!assignee) {
      db.prepare("UPDATE layer_work_items SET assignee_kind = NULL, assignee_id = NULL, assignee_label = NULL, profile_id = NULL, updated_at = ? WHERE id = ? AND project_id = ?").run(now(), workId, projectId);
      saveGoal(projectId, goalItem(projectId, workId), { performer: null }, `${user.name} unassigned it`, by);
      record(projectId, workId, { kind: 'log', author, text: 'Unassigned' });
    } else if (assignee.kind === 'agent') {
      fail('Remote agents come with the remote runtime (AGENT-WORK-01 A2). Assign a person for now.', 409);
    } else if (assignee.kind === 'person') {
      const person = isMember(db, String(assignee.id || ''), projectId) ? getUser(db, String(assignee.id)) : null;
      if (!person) fail('Assign someone who is a member of this project.', 409);
      db.prepare("UPDATE layer_work_items SET assignee_kind = 'person', assignee_id = ?, assignee_label = ?, profile_id = NULL, updated_at = ? WHERE id = ? AND project_id = ?").run(person.id, person.name, now(), workId, projectId);
      saveGoal(projectId, goalItem(projectId, workId), { performer: 'local' }, `${user.name} assigned it to ${person.id === user.id ? 'themself' : person.name}`, by);
      record(projectId, workId, { kind: 'log', author, text: person.id === user.id ? 'Assigned to themself' : `Assigned to ${person.name}` });
    } else fail('Assign a person or an agent.');
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
    // E3: a wrap-up action ends the item as not done. The working agent decides the item can't be finished this time, says
    // why, and its person approves; the wrap-up then proposes what has to happen first, and close-out applies and merges nothing.
    const wrapUp = input.wrapUp === true;
    if (wrapUp) {
      if (item.board !== 'progress') fail(`Only an item in progress can be wrapped up as not done.`, 409);
      if (actions.some(action => action.kind === 'wrap-up')) fail(`${item.ref} already has a wrap-up action.`, 409);
      if (!clean(input.reason, 1000, 'Reason')) fail('Say why the item can\'t be finished.');
    }
    // Once work has started, an agent's new action waits for a person's approval; a person's own is approved by adding it.
    const needsApproval = actor.kind === 'agent' && !['draft', 'ready'].includes(item.board);
    const at = now();
    db.prepare('INSERT INTO work_goal_actions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
      .run(`act-${randomBytes(4).toString('hex')}`, projectId, workId, number, wrapUp ? Math.max(1, phases.length) : phase, checkLayer(projectId, input.layer), goal, JSON.stringify(wrapUp ? [] : after), needsApproval ? 'proposed' : 'todo',
        wrapUp ? clean(input.reason, 1000, 'Reason') : null, JSON.stringify(actor), at, at, wrapUp ? 'wrap-up' : null);
    if (needsApproval) record(projectId, workId, { kind: 'approval', action: number, author: actor, text: (wrapUp ? 'End as not done: ' : '') + (clean(input.reason, 1000, 'Reason') || `New action: ${goal}`) });
    else { record(projectId, workId, { kind: 'log', action: number, author: actor, text: `Added #${number}` }); reopen(projectId, workId, number, actor); }
    emit(projectId, workId, { type: 'action', number });
    return view(projectId, workId);
  }

  // W-27 #3: the checklist an agent hands over with its preview: steps to try, each As / When / Expect, and optionally the
  // page path reaching it (or the method and path doing it) so walking the live build ticks it. Ids are the steps' order.
  function checkSteps(input) {
    if (input === undefined || input === null) return [];
    if (!Array.isArray(input)) fail('Give the checklist as a list of steps.');
    if (input.length > 20) fail('Keep the checklist to 20 steps; split the action if it needs more.');
    return input.map((step, index) => {
      if (!step || typeof step !== 'object') fail(`Step ${index + 1} needs When and Expect.`);
      const path = step.path ? clean(step.path, 300, `Step ${index + 1}'s path`) : null;
      if (path && !/^\/(?!\/)/.test(path)) fail(`Step ${index + 1}'s path is a path in the preview, starting with /.`);
      const method = step.method ? clean(step.method, 10, `Step ${index + 1}'s method`).toUpperCase() : null;
      if (method && (!path || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method))) fail(`Step ${index + 1}: a method needs a path, and is POST, PUT, PATCH or DELETE.`);
      return { id: `s${index + 1}`, as: clean(step.as, 100, `Step ${index + 1}'s As`) || null, when: clean(step.when, 300, `Step ${index + 1}'s When`, true),
        expect: clean(step.expect, 300, `Step ${index + 1}'s Expect`, true), path, method };
    });
  }
  const walkLeft = preview => (preview?.steps || []).filter(step => !preview.walk?.[step.id]);
  const walkSummary = preview => {
    const steps = preview?.steps || [], walk = preview?.walk || {};
    const done = steps.filter(step => walk[step.id]?.how !== 'reason' && walk[step.id]).length;
    const skipped = steps.filter(step => walk[step.id]?.how === 'reason').map(step => `step ${step.id.slice(1)} (${walk[step.id].reason})`);
    const left = walkLeft(preview).map(step => step.id.slice(1));
    return `${done} of ${steps.length} step${steps.length === 1 ? '' : 's'} walked` + (skipped.length ? `; skipped with a reason: ${skipped.join(', ')}` : '') + (left.length ? `; not walked: step ${left.join(', ')}` : '');
  };
  // A person records one step of an action's walk: walked in the live build (the walk script told the page), checked by hand
  // (Looks good), or skipped with a reason; or clears it. The walk belongs to the preview handed over: a new one starts afresh.
  function walk(user, projectId, workId, number, input = {}) {
    requireMember(db, user, projectId);
    const item = goalItem(projectId, workId);
    const action = actionRows(projectId, workId).find(entry => entry.number === Number(number)) || fail('Action not found.', 404);
    if (action.state !== 'review') fail(`#${action.number} isn't ready for review.`, 409);
    const preview = action.preview;
    const step = (preview?.steps || []).find(entry => entry.id === input.step) || fail(`#${action.number}'s checklist has no step ${input.step}.`, 404);
    const walkNow = { ...(preview.walk || {}) };
    if (input.how === null) delete walkNow[step.id];
    else {
      if (!['walked', 'checked', 'reason'].includes(input.how)) fail('A step is walked, checked, or skipped with a reason.');
      const reason = input.how === 'reason' ? clean(input.reason, 300, 'Why it can\'t be walked', true) : null;
      walkNow[step.id] = { how: input.how, ...(reason ? { reason } : {}), at: now(), by: { id: user.id, name: user.name } };
    }
    db.prepare('UPDATE work_goal_actions SET preview_json = ?, updated_at = ? WHERE id = ? AND project_id = ?').run(JSON.stringify({ ...preview, walk: walkNow }), now(), action.id, projectId);
    emit(projectId, workId, { type: 'action', number: action.number });
    return view(projectId, item.id);
  }
  const agentMoves = { todo: ['working'], working: ['review', 'todo'], review: ['working'], proposed: [] };
  // W-25: a preview handed over with an action ({ url, commit, try }), or why there is none ({ none }); null removes it. The
  // commit defaults to the item's reported code, so the page can tell when newer code makes the preview stale.
  function checkPreview(input, item, actor) {
    if (input === null) return null;
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('A preview is { url, commit, try } or { none }.');
    const by = { kind: actor.kind, id: actor.id, name: actor.name }, at = now();
    if (input.none !== undefined) return { none: clean(input.none, 400, 'Why there is no preview', true), by, at };
    const url = clean(input.url, 500, 'Preview link', true);
    let parsed; try { parsed = new URL(url); } catch { fail('Give the preview as a full http or https link.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) fail('Give the preview as a full http or https link.');
    const commit = input.commit ? clean(input.commit, 64, 'Commit') : goalOf(item).code?.commit || null;
    if (commit && !/^[0-9a-f]{7,64}$/.test(commit)) fail('Give the preview\'s commit as a hex hash.');
    return { url: parsed.href, commit, try: clean(input.try, 2000, 'What to try') || '', steps: checkSteps(input.steps), by, at };
  }
  function updateAction(actor, projectId, workId, number, input = {}) {
    const item = goalItem(projectId, workId);
    const actions = actionRows(projectId, workId), phases = phasesOf(projectId, workId);
    const action = actions.find(entry => entry.number === Number(number)) || fail('Action not found.', 404);
    const next = { ...action };
    if (input.goal !== undefined) next.goal = clean(input.goal, 1000, `#${action.number}'s goal`, true);
    if (input.summary !== undefined) next.summary = clean(input.summary, 4000, 'Summary');
    if (input.layer !== undefined) next.layer = checkLayer(projectId, input.layer);
    if (input.after !== undefined) next.after = checkAfter(input.after, action.number, new Set(actions.map(entry => entry.number)));
    if (input.preview !== undefined) {
      if (['done', 'proposed'].includes(action.state)) fail(`#${action.number} is ${action.state === 'done' ? 'done' : 'waiting for approval'}; its preview can't change.`, 409);
      next.preview = checkPreview(input.preview, item, actor);
    }
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
    db.prepare('UPDATE work_goal_actions SET goal = ?, summary = ?, layer = ?, after_json = ?, phase = ?, state = ?, preview_json = ?, updated_at = ? WHERE id = ? AND project_id = ?')
      .run(next.goal, next.summary || null, next.layer, JSON.stringify(next.after), next.phase, next.state, next.preview ? JSON.stringify(next.preview) : null, now(), action.id, projectId);
    const changed = ['goal', 'summary', 'layer', 'after', 'phase', 'state'].filter(key => JSON.stringify(next[key]) !== JSON.stringify(action[key]));
    if (input.preview !== undefined) record(projectId, workId, { kind: 'log', action: action.number, author: actor,
      text: !next.preview ? `Removed #${action.number}'s preview` : next.preview.none ? `No preview for #${action.number}: ${next.preview.none}` : `Handed over a preview of #${action.number}${next.preview.commit ? ` at ${next.preview.commit.slice(0, 7)}` : ''}` });
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
          if (input.allow) { db.prepare("UPDATE work_goal_actions SET state = 'todo', updated_at = ? WHERE id = ? AND project_id = ?").run(now(), action.id, projectId); reopen(projectId, workId, action.number, { kind: 'person', id: user.id }); }
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
    if (result.staged) {
      const seq = db.prepare('SELECT MAX(seq) AS seq FROM layer_run_drafts WHERE attempt_id = ? AND project_id = ?').get(changesetKey(workId), projectId).seq;
      db.prepare('INSERT OR REPLACE INTO work_goal_staged VALUES (?, ?, ?, ?)').run(projectId, workId, seq, action.number);
      record(projectId, workId, { kind: 'log', action: action.number, author: actor, text: `Staged ${result.staged.op} of ${result.staged.kind.replace(/_/g, ' ')} in ${layerCatalog.find(entry => entry.key === layer)?.name || layer}` });
      emit(projectId, workId, { type: 'item' });
    }
    return result;
  }
  // A4: a person reviews one action that is ready: approve it (done), or flag it with a note (back to working, for the agent).
  function review(user, projectId, workId, number, input = {}) {
    const item = goalItem(projectId, workId);
    if (!['progress', 'review'].includes(item.board)) fail(`${item.ref} isn't being worked on.`, 409);
    const action = actionRows(projectId, workId).find(entry => entry.number === Number(number)) || fail('Action not found.', 404);
    if (action.state !== 'review') fail(`#${action.number} isn't ready for review.`, 409);
    const person = { kind: 'person', id: user.id, name: user.name };
    if (input.verdict === 'approve') {
      // P3 (W-27 #3): with a checklist, every step is walked, checked by hand, or skipped with a reason first.
      const left = walkLeft(action.preview);
      if (left.length) fail(`Walk #${action.number}'s checklist first: step ${left.map(step => step.id.slice(1)).join(', ').replace(/, (\d+)$/, ' and $1')} left, or say why one can't be walked.`, 409);
      db.prepare("UPDATE work_goal_actions SET state = 'done', updated_at = ? WHERE id = ? AND project_id = ?").run(now(), action.id, projectId);
      record(projectId, workId, { kind: 'log', action: action.number, author: person, text: `Approved #${action.number}` });
    } else if (input.verdict === 'flag') {
      const note = clean(input.note, 2000, 'Note', true);
      db.prepare("UPDATE work_goal_actions SET state = 'working', updated_at = ? WHERE id = ? AND project_id = ?").run(now(), action.id, projectId);
      if (item.board === 'review') setState(projectId, item, 'claimed', `Flagged #${action.number}`, byOf(person));
      record(projectId, workId, { kind: 'flag', action: action.number, author: person, text: note });
      if (action.preview?.steps?.length) record(projectId, workId, { kind: 'log', action: action.number, author: person, text: `Walk so far on #${action.number}: ${walkSummary(action.preview)}` });
    } else fail('Approve it, or flag it with a note.');
    emit(projectId, workId, { type: 'action', number: action.number });
    return view(projectId, workId);
  }
  // W-8 F24: a person drops an action that hasn't started (one that turned out unneeded, or done by another); actions that
  // came after it no longer wait on it. Started work stays, so its log and staged changes keep their action.
  function dropAction(user, projectId, workId, number) {
    requireMember(db, user, projectId);
    const item = goalItem(projectId, workId);
    if (item.board === 'done') fail(`${item.ref} is closed.`, 409);
    const actions = actionRows(projectId, workId);
    const action = actions.find(entry => entry.number === Number(number)) || fail('Action not found.', 404);
    if (action.state !== 'todo') fail(action.state === 'proposed' ? `Decline #${action.number} instead.` : `#${action.number} has started; only an action still to do can be dropped.`, 409);
    transaction(() => {
      db.prepare('DELETE FROM work_goal_actions WHERE id = ? AND project_id = ?').run(action.id, projectId);
      for (const other of actions.filter(entry => entry.after.includes(action.number)))
        db.prepare('UPDATE work_goal_actions SET after_json = ?, updated_at = ? WHERE id = ? AND project_id = ?').run(JSON.stringify(other.after.filter(n => n !== action.number)), now(), other.id, projectId);
    });
    record(projectId, workId, { kind: 'log', action: action.number, author: { kind: 'person', id: user.id, name: user.name }, text: `Dropped #${action.number}: ${action.goal}` });
    emit(projectId, workId, { type: 'item' });
    return view(projectId, workId);
  }
  // A person ends an item as not done themself, with the reason, whether or not its agent proposed a wrap-up: the wrap-up is
  // recorded as done with that reason, what the item still waits on is withdrawn, and close-out ends it (proposals first).
  function endAsNotDone(user, projectId, workId, input = {}) {
    requireMember(db, user, projectId);
    const item = goalItem(projectId, workId);
    if (!['progress', 'review'].includes(item.board)) fail(`Only an item in progress or in review can end as not done.`, 409);
    const reason = clean(input.reason, 1000, 'Reason', true);
    const undecided = proposalRows(projectId, workId).filter(proposal => proposal.state === 'proposed');
    if (undecided.length) fail(`Create or dismiss the ${undecided.length} proposed item${undecided.length === 1 ? '' : 's'} first.`, 409);
    const actions = actionRows(projectId, workId), person = { kind: 'person', id: user.id, name: user.name };
    const existing = actions.find(action => action.kind === 'wrap-up'), at = now();
    transaction(() => {
      if (existing) db.prepare("UPDATE work_goal_actions SET state = 'done', summary = ?, updated_at = ? WHERE id = ? AND project_id = ?").run(existing.summary && existing.state !== 'proposed' ? existing.summary : reason, at, existing.id, projectId);
      else db.prepare("INSERT INTO work_goal_actions VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'done', ?, ?, ?, ?, 'wrap-up', NULL)")
        .run(`act-${randomBytes(4).toString('hex')}`, projectId, workId, (actions.at(-1)?.number || 0) + 1, Math.max(1, phasesOf(projectId, workId).length), null, 'Wrap up: end as not done', reason, JSON.stringify(person), at, at);
      for (const need of openNeeds(projectId, workId))
        db.prepare('UPDATE work_goal_events SET resolved_at = ?, resolution_json = ? WHERE id = ? AND project_id = ?').run(at, JSON.stringify({ text: 'Withdrawn: the item ended as not done', by: { id: user.id, name: user.name } }), need.id, projectId);
      if (item.board === 'progress') setState(projectId, item, 'review', 'Ending as not done', byOf(person));
    });
    return closeOut(user, projectId, workId);
  }
  // E3: an action proposes work items: follow-ups after a success, or what has to happen first after a wrap-up. Each names
  // why, and may come after others in the same list (by index). A new list replaces the action's undecided proposals.
  function proposeItems(actor, projectId, workId, number, input = {}) {
    const item = goalItem(projectId, workId);
    const action = actionRows(projectId, workId).find(entry => entry.number === Number(number)) || fail('Action not found.', 404);
    if (action.state !== 'working') fail(`Move #${action.number} to working before it proposes anything.`, 409);
    const items = Array.isArray(input.items) ? input.items : [];
    if (!items.length || items.length > 10) fail('Propose one to ten items.');
    const ids = items.map(() => `prp-${randomBytes(4).toString('hex')}`);
    const rows = items.map((entry, index) => ({ id: ids[index], title: clean(entry?.title, 160, `Item ${index + 1}'s title`, true), brief: clean(entry?.brief, 4000, `Item ${index + 1}'s brief`),
      why: clean(entry?.why, 1000, `Why item ${index + 1}`, true),
      after: [...new Set((Array.isArray(entry?.after) ? entry.after : []).map(Number))].map(other => Number.isInteger(other) && other >= 0 && other < index ? ids[other] : fail(`Item ${index + 1} can only come after an earlier item (by its index from 0).`)) }));
    const kept = db.prepare("SELECT COALESCE(MAX(position), -1) AS last FROM work_goal_proposals WHERE project_id = ? AND work_id = ? AND action_number = ? AND state != 'proposed'").get(projectId, workId, action.number).last;
    transaction(() => {
      db.prepare("DELETE FROM work_goal_proposals WHERE project_id = ? AND work_id = ? AND action_number = ? AND state = 'proposed'").run(projectId, workId, action.number);
      rows.forEach((row, index) => db.prepare("INSERT INTO work_goal_proposals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', NULL, NULL, ?)")
        .run(row.id, projectId, workId, action.number, kept + 1 + index, row.title, row.brief, row.why, JSON.stringify(row.after), JSON.stringify(actor), now()));
    });
    record(projectId, workId, { kind: 'log', action: action.number, author: actor, text: `Proposed ${rows.length} work item${rows.length === 1 ? '' : 's'}: ${rows.map(row => row.title).join('; ')}` });
    emit(projectId, workId, { type: 'action', number: action.number });
    return view(projectId, item.id);
  }
  // A person creates a proposed item (as edited) as a Draft goal item, or dismisses it. Its dependencies become blocking
  // links between the created items, whichever order they're created in.
  function decideProposal(user, projectId, workId, proposalId, input = {}) {
    requireMember(db, user, projectId);
    const item = goalItem(projectId, workId);
    const row = db.prepare('SELECT * FROM work_goal_proposals WHERE id = ? AND project_id = ? AND work_id = ?').get(String(proposalId), projectId, workId);
    if (!row) fail('Proposal not found.', 404);
    const proposal = proposalRow(row);
    if (proposal.state !== 'proposed') fail('Already decided.', 409);
    const person = { kind: 'person', id: user.id, name: user.name };
    const decided = { by: { id: user.id, name: user.name }, at: now() };
    if (input.decision === 'dismiss') {
      db.prepare("UPDATE work_goal_proposals SET state = 'dismissed', decided_json = ? WHERE id = ?").run(JSON.stringify(decided), row.id);
      record(projectId, workId, { kind: 'log', action: proposal.action, author: person, text: `Dismissed proposed item: ${proposal.title}` });
    } else if (input.decision === 'create') {
      const task = input.task && typeof input.task === 'object' ? input.task : {};
      const created = createGoal(user, projectId, { title: clean(task.title ?? proposal.title, 160, 'Title', true), brief: task.brief ?? task.suggestion ?? proposal.brief, priority: task.priority }).item;
      const from = `${item.ref} #${proposal.action}`;
      record(projectId, created.id, { kind: 'log', author: proposal.author || person, text: `Proposed in ${from}: ${proposal.why}` });
      db.prepare("UPDATE work_goal_proposals SET state = 'created', created_work_id = ?, decided_json = ? WHERE id = ?").run(created.id, JSON.stringify(decided), row.id);
      const all = proposalRows(projectId, workId);
      const blocks = (blocker, blocked) => { const current = know.workById(projectId, blocker); if (current && !current.blocks.includes(blocked)) know.updateWork(user, projectId, blocker, { blocks: [...current.blocks, blocked] }); };
      for (const first of all.filter(other => proposal.after.includes(other.id) && other.createdWorkId)) blocks(first.createdWorkId, created.id);
      for (const next of all.filter(other => other.after.includes(proposal.id) && other.createdWorkId)) blocks(created.id, next.createdWorkId);
      record(projectId, workId, { kind: 'log', action: proposal.action, author: person, text: `Created ${created.ref} from a proposal: ${created.title}` });
    } else fail('Create or dismiss the proposed item.');
    emit(projectId, workId, { type: 'item' });
    return view(projectId, workId);
  }
  // A4: close-out merges the reported branch into the project's main branch, as a person saying "looks good, merge it".
  // COLLAB-WORK-01 CW-1: the commit comes from the project's GitHub repository (fetchCode), never from a folder on the
  // person's machine, so it works the same for a collaborator on another machine. A fast-forward when it can,
  // otherwise a merge commit written without touching any working tree; conflicts go back to the agent to rebase.
  function repository(projectId) {
    const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId)?.workspace_path;
    if (!workspace || !existsSync(join(workspace, '.git'))) return null;
    const git = (args, options = {}) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, ...options }).trim();
    const has = args => { try { git(args); return true; } catch { return false; } };
    const target = ['main', 'master'].find(name => has(['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]));
    return target ? { workspace, git, has, target } : null;
  }
  function codeMerged(projectId, code) {
    const repo = code && repository(projectId);
    return Boolean(repo && repo.has(['merge-base', '--is-ancestor', code.commit, `refs/heads/${repo.target}`]));
  }
  function planMerge(user, projectId, item, code) {
    const repo = repository(projectId);
    if (!repo) fail(`This project has no repository with a main branch for Aludel to merge ${code.branch} into.`, 409);
    const { git, has, target } = repo;
    if (!has(['cat-file', '-e', `${code.commit}^{commit}`])) fail(`Aludel doesn't have ${code.branch} at ${code.commit.slice(0, 7)}. Push it to the project's GitHub repository, then close out.`, 409);
    const tip = git(['rev-parse', `refs/heads/${target}`]);
    const commit = git(['rev-parse', `${code.commit}^{commit}`]);
    if (has(['merge-base', '--is-ancestor', commit, tip])) return { ...repo, tip, to: tip, mode: 'already' };
    if (has(['merge-base', '--is-ancestor', tip, commit])) return { ...repo, tip, to: commit, mode: 'fast-forward' };
    let tree;
    try { tree = git(['merge-tree', '--write-tree', '--name-only', '--no-messages', tip, commit]).split('\n')[0]; }
    catch (error) {
      const conflicts = String(error.stdout || '').split('\n').slice(1).filter(Boolean);
      const where = conflicts.length ? ` in ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? ` and ${conflicts.length - 5} more` : ''}` : '';
      const person = { kind: 'person', id: user.id, name: user.name };
      setState(projectId, item, 'claimed', `Merge conflict on ${code.branch}`, byOf(person));
      record(projectId, item.id, { kind: 'steer', author: person, text: `Close-out couldn't merge ${code.branch} into ${target}: it conflicts${where}. Rebase it onto ${target}, resolve, commit and report the code again.` });
      emit(projectId, item.id, { type: 'item' });
      fail(`${code.branch} conflicts with ${target}${where}. Sent back to the agent to rebase.`, 409);
    }
    const env = { ...process.env, GIT_AUTHOR_NAME: user.name, GIT_AUTHOR_EMAIL: user.email || 'aludel@localhost', GIT_COMMITTER_NAME: user.name, GIT_COMMITTER_EMAIL: user.email || 'aludel@localhost' };
    const merge = git(['commit-tree', tree, '-p', tip, '-p', commit, '-m', `Merge ${code.branch} (${item.ref}: ${item.title})`], { env });
    return { ...repo, tip, to: merge, mode: 'merge commit' };
  }
  // Moves the main branch, only if it is still where the plan found it. A checked-out main must be clean and is fast-forwarded.
  function applyMerge(plan) {
    const { git, target, tip, to } = plan;
    if (to === tip) return;
    let head = null;
    try { head = git(['symbolic-ref', '--quiet', 'HEAD']); } catch { /* detached */ }
    if (head === `refs/heads/${target}` && git(['rev-parse', '--is-bare-repository']) !== 'true') {
      if (git(['status', '--porcelain', '--untracked-files=no'])) fail(`The project repository has uncommitted changes on ${target}. Commit or stash them, then close out.`, 409);
      if (git(['rev-parse', 'HEAD']) !== tip) fail(`${target} moved while closing out. Try again.`, 409);
      git(['merge', '--ff-only', '--quiet', to]);
    } else {
      try { git(['update-ref', `refs/heads/${target}`, to, tip]); } catch { fail(`${target} moved while closing out. Try again.`, 409); }
    }
  }
  // CW-1: before close-out, the host fetches the reported branch from the project's GitHub repository (remote: its clone URL
  // and an installation token; a plain URL in tests). What merges is exactly the commit that was reported and reviewed: a
  // branch that moved on GitHub since is refused until the code is reported again. Without a remote, the commit must
  // already be in the project repository.
  function fetchCode(projectId, workId, remote) {
    const item = goalItem(projectId, workId), code = goalOf(item).code;
    if (!code || item.board !== 'review') return null; // close-out itself says what's missing first
    if (wrapUpOf(actionRows(projectId, workId))) return null; // ending as not done merges nothing
    const repo = repository(projectId);
    if (!repo) fail(`This project has no repository with a main branch for Aludel to merge ${code.branch} into.`, 409);
    if (!remote) {
      if (repo.has(['cat-file', '-e', `${code.commit}^{commit}`])) return code.commit;
      fail(`This project has no GitHub repository to fetch ${code.branch} from. Connect one, push the branch, then close out.`, 409);
    }
    const ref = `refs/aludel/work/${workId}`;
    const args = ['fetch', '--no-tags', '--quiet', remote.url, `+refs/heads/${code.branch}:${ref}`];
    const fetched = remote.token ? gitWithToken(repo.workspace, args, remote.token).status === 0 : repo.has(args);
    if (!fetched) fail(`Aludel couldn't fetch ${code.branch} from GitHub. Push it (aludel submit ${item.ref}), then close out.`, 409);
    const tip = repo.git(['rev-parse', ref]);
    if (!tip.startsWith(code.commit)) fail(`${code.branch} is at ${tip.slice(0, 7)} on GitHub, but ${code.commit.slice(0, 7)} was reported. Report the code again so what merges is what was reviewed.`, 409);
    return tip;
  }
  // W-27 #5: what an item's code changed, at the reported commit against its base: the files (with line counts), or one
  // file's diff. The commit comes from the project's repository, fetched from GitHub when Aludel doesn't have it yet.
  const diffLimit = 400_000;
  function codeFiles(projectId, workId, remote, path = null) {
    const item = goalItem(projectId, workId), code = goalOf(item).code;
    if (!code) fail(`${item.ref} has no code reported yet.`, 404);
    const repo = repository(projectId);
    if (!repo) fail('This project has no repository to read the code from.', 409);
    const short = code.commit.slice(0, 7), present = sha => repo.has(['cat-file', '-e', `${sha}^{commit}`]);
    if (!present(code.commit)) {
      if (!remote) fail(`Aludel doesn't have ${short} yet, and this project has no GitHub repository to fetch ${code.branch} from.`, 409);
      const args = ['fetch', '--no-tags', '--quiet', remote.url, `+refs/heads/${code.branch}:refs/aludel/work/${workId}`];
      const fetched = remote.token ? gitWithToken(repo.workspace, args, remote.token).status === 0 : repo.has(args);
      if (!fetched) fail(`Aludel couldn't fetch ${code.branch} from GitHub. The agent pushes it with its report; ask it to report again.`, 409);
      if (!present(code.commit)) fail(`${code.branch} on GitHub doesn't contain ${short}. Ask the agent to report its code again.`, 409);
    }
    const base = code.base && present(code.base) ? repo.git(['rev-parse', code.base]) : repo.git(['merge-base', `refs/heads/${repo.target}`, code.commit]);
    const commit = repo.git(['rev-parse', code.commit]);
    // -z keeps any path intact; a rename has its old and new path.
    const fields = repo.git(['diff', '--name-status', '-z', '-M', base, commit]).split('\0').filter(Boolean);
    const files = [];
    for (let at = 0; at < fields.length;) {
      const letter = fields[at++][0];
      const from = letter === 'R' || letter === 'C' ? fields[at++] : null, file = fields[at++];
      files.push({ path: file, from, status: { A: 'added', D: 'deleted', R: 'renamed', C: 'added' }[letter] || 'modified', added: 0, removed: 0, binary: false });
    }
    const counts = repo.git(['diff', '--numstat', '-z', '-M', base, commit]).split('\0');
    for (let at = 0; at < counts.length;) {
      const head = counts[at++]; if (!head) continue;
      const [added, removed, inline] = head.split('\t');
      const file = inline || (at++, counts[at++]); // a rename: "a\tb\t" then old\0new
      const entry = files.find(candidate => candidate.path === file); if (!entry) continue;
      if (added === '-') entry.binary = true; else { entry.added = Number(added); entry.removed = Number(removed); }
    }
    if (path === null) return { branch: code.branch, commit, base, files };
    const entry = files.find(candidate => candidate.path === path);
    if (!entry) fail(`${path} isn't one of the files ${item.ref} changed.`, 404);
    if (entry.binary) return { ...entry, diff: null, tooLarge: false };
    const diff = repo.git(['diff', '--no-color', '-M', '-U3', base, commit, '--', ...(entry.from ? [entry.from] : []), entry.path], { maxBuffer: 8 * diffLimit });
    return diff.length > diffLimit ? { ...entry, diff: null, tooLarge: true } : { ...entry, diff, tooLarge: false };
  }
  // A4: close-out. Every action reviewed; the record changeset applies once, in one transaction, under each layer's API
  // checks it was staged with, after confirming nothing it changes moved since; the code merges into main in the same step.
  function closeOut(user, projectId, workId) {
    const item = goalItem(projectId, workId);
    if (item.board !== 'review') fail(`Move ${item.ref} to review first.`, 409);
    const wrapUp = wrapUpOf(actionRows(projectId, workId));
    const left = (wrapUp ? [wrapUp] : actionRows(projectId, workId)).filter(action => action.state !== 'done');
    if (left.length) fail(`Review #${left.map(action => action.number).join(', #')} first.`, 409);
    if (openNeeds(projectId, workId).length) fail('Answer what the item is waiting on first.', 409);
    const undecided = proposalRows(projectId, workId).filter(proposal => proposal.state === 'proposed');
    if (undecided.length) fail(`Create or dismiss the ${undecided.length} proposed item${undecided.length === 1 ? '' : 's'} first.`, 409);
    if (wrapUp) return endNotDone(user, projectId, item, wrapUp);
    const code = goalOf(item).code || null;
    const groups = changeset(projectId, workId);
    for (const group of groups) for (const change of group.changes) {
      const current = know.get(projectId, change.id);
      if (change.op === 'create' ? current : current?.revision !== change.baseRevision) fail(`A ${change.kind.replace(/_/g, ' ')} this item changes was changed since it was staged. Send its action back to restage.`, 409);
    }
    const plan = code ? planMerge(user, projectId, item, code) : null;
    const author = user.name, rationale = `Closed ${item.ref}: ${item.title}`;
    const own = !db.isTransaction;
    if (own) db.exec('BEGIN IMMEDIATE');
    let applied = 0;
    try {
      for (const group of groups) {
        applyWrites(know, projectId, group.changes.map(change => ({ op: change.op, kind: change.kind, id: change.id, baseRevision: change.baseRevision, data: change.after, ...(change.parentId ? { parentId: change.parentId } : {}) })), [],
          { layer: group.layer, author, rationale, workItemId: workId });
        applied += group.changes.length;
      }
      if (plan) applyMerge(plan);
      if (own) db.exec('COMMIT');
    } catch (error) { if (own) db.exec('ROLLBACK'); throw error; }
    const by = { kind: 'person', id: user.id };
    const merged = plan ? { into: plan.target, commit: plan.to, mode: plan.mode } : null;
    saveGoal(projectId, item, { closedAt: now(), applied, code: code ? { ...code, merged } : null }, `${user.name} closed it`, by);
    setState(projectId, goalItem(projectId, workId), 'done', 'Closed', by);
    const codeText = !plan ? '' : plan.mode === 'already' ? `; ${code.branch} was already in ${plan.target}`
      : `; merged ${code.branch} into ${plan.target}${plan.mode === 'merge commit' ? ` with a merge commit (${plan.to.slice(0, 7)})` : ` (${plan.to.slice(0, 7)})`}`;
    record(projectId, workId, { kind: 'log', author: { kind: 'person', id: user.id, name: user.name },
      text: `Closed: applied ${applied} record change${applied === 1 ? '' : 's'}${codeText}` });
    emit(projectId, workId, { type: 'item' });
    return { ...view(projectId, workId), merged: merged && merged.mode !== 'already' ? { ...merged, workspace: plan.workspace } : null };
  }
  // E3: ending as not done applies nothing and merges nothing. The staged changeset stays unapplied on the item, and its
  // branch stays on GitHub for a retry to build on; the items its wrap-up proposed carry the work forward.
  function endNotDone(user, projectId, item, wrapUp) {
    const staged = changeset(projectId, item.id).reduce((sum, group) => sum + group.changes.length, 0), code = goalOf(item).code || null;
    const by = { kind: 'person', id: user.id };
    saveGoal(projectId, item, { closedAt: now(), applied: 0, outcome: { kind: 'not-done', reason: wrapUp.summary, by: { id: user.id, name: user.name } } }, `${user.name} ended it as not done`, by);
    setState(projectId, goalItem(projectId, item.id), 'done', 'Ended as not done', by);
    const created = proposalRows(projectId, item.id).filter(proposal => proposal.createdWorkId).map(proposal => know.workById(projectId, proposal.createdWorkId)?.ref).filter(Boolean);
    record(projectId, item.id, { kind: 'log', author: { kind: 'person', id: user.id, name: user.name },
      text: `Ended as not done: ${staged} staged record change${staged === 1 ? '' : 's'} not applied${code ? `; ${code.branch} not merged` : ''}${created.length ? `; continued in ${created.join(', ')}` : ''}` });
    emit(projectId, item.id, { type: 'item' });
    return { ...view(projectId, item.id), merged: null };
  }
  // After a merge, the host pushes main when the project has a GitHub repository, and notes the outcome on the item.
  function notePush(projectId, workId, text) {
    record(projectId, workId, { kind: 'log', author: { kind: 'agent', id: 'aludel', name: 'Aludel' }, text });
    emit(projectId, workId, { type: 'item' });
  }

  // A8: Code changes made locally live on a branch, not in the record changeset. The local tools push the branch to the
  // project's GitHub repository, then report it here, so close-out (A4) can fetch and merge it. Never file content, and
  // never a folder path (CW-1: older clients still send `checkout`; it is ignored).
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
    const rows = db.prepare('SELECT seq, layer_key, writes_json FROM layer_run_drafts WHERE attempt_id = ? AND project_id = ? ORDER BY seq').all(changesetKey(workId), projectId);
    if (!rows.length) return [];
    const actionOf = new Map(db.prepare('SELECT seq, action_number FROM work_goal_staged WHERE project_id = ? AND work_id = ?').all(projectId, workId).map(row => [row.seq, row.action_number]));
    const layerOf = new Map(), byAction = new Map();
    for (const row of rows) for (const write of parse(row.writes_json, [])) { layerOf.set(write.id, row.layer_key); byAction.set(write.id, actionOf.get(row.seq) ?? null); }
    const changes = draftChanges(db, projectId, changesetKey(workId)).map(change => ({ ...change, action: byAction.get(change.id) ?? null }));
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
  // W-8 F7/F18: one operation as an agent needs it before staging: its request body schema (with the schemas it refers to)
  // and the host catalogs its rules check values against (page types, icons), so nobody reads the server to learn a shape.
  function describeOperation(projectId, layer, operationId) {
    const key = checkLayer(projectId, layer) || fail('Name the layer.');
    const api = layerApi(db, projectId, key) || fail(`The ${key} layer publishes no API.`, 409);
    const operation = api.operations.get(operationId) || fail(`The ${key} API has no operation ${operationId}; stack_map lists them.`, 404);
    const body = api.spec.paths[operation.path]?.[operation.method.toLowerCase()]?.requestBody?.content?.['application/json']?.schema || null;
    const schemas = {};
    const collect = value => {
      if (!value || typeof value !== 'object') return;
      const name = typeof value.$ref === 'string' && /^#\/components\/schemas\/(.+)$/.exec(value.$ref)?.[1];
      if (name && !schemas[name] && api.spec.components.schemas[name]) { schemas[name] = api.spec.components.schemas[name]; collect(schemas[name]); }
      for (const child of Object.values(value)) collect(child);
    };
    collect(body);
    return { layer: key, operationId, method: operation.method, summary: operation.summary, description: operation.description, reads: Boolean(operation.read), writes: operation.output,
      elevated: operation.access === 'elevated', needsId: operation.needsId, parentField: operation.parentField, body, schemas, catalogs: handlerCatalogs(api, catalogs || know.catalogs) };
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
          .reduce((sum, row) => ({ ...sum, [row.state]: row.n }), {}), needs: openNeeds(projectId, item.id).length,
        layers: db.prepare("SELECT DISTINCT layer FROM work_goal_actions WHERE project_id = ? AND work_id = ? AND state != 'proposed' AND layer IS NOT NULL ORDER BY layer").all(projectId, item.id).map(row => row.layer) }));
  }
  function subscribe(projectId, workId, listener) {
    goalItem(projectId, workId);
    const key = `${projectId}:${workId}`;
    bus.on(key, listener);
    return () => bus.off(key, listener);
  }

  return { createGoal, view, define, move, claim, assign, assertPerformer, addAction, updateAction, post, answer, stage, recordCode, review, proposeItems, decideProposal, describeOperation, dropAction, endAsNotDone, fetchCode, codeFiles, walk, closeOut, notePush, changeset, stackMap, readLayer, goals, subscribe };
}
