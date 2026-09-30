import { workActionMigration } from './lat08-migration.mjs';
import { compiledLocalActions } from './lat07-actions.mjs';
import { actionForProject } from './layer-registry.mjs';
// Work batches stage human tasks or Go-pin explicit agent actions for Symphony.
// Record changes are accepted at the checked output boundary, never during an agent turn.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
export const batchLimits = { default: 10, max: 25 };
const priorityRank = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };
const byPriority = (a, b) => (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2) || a.number - b.number;

export function initAgentRuns(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS agent_batches (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), number INTEGER NOT NULL, state TEXT NOT NULL,
    item_limit INTEGER NOT NULL, created_by TEXT, started_by TEXT, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT,
    note TEXT, UNIQUE(project_id, number)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS vision_proposals (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, work_id TEXT NOT NULL, target_id TEXT,
    expected_revision INTEGER, brief_revision INTEGER NOT NULL, content_json TEXT NOT NULL,
    state TEXT NOT NULL, accepted_claim_id TEXT, created_at TEXT NOT NULL, accepted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS vision_proposals_work ON vision_proposals(project_id, work_id);`);
  const columns = new Set(db.prepare('PRAGMA table_info(agent_batches)').all().map(column => column.name));
  // Go snapshots the batch's items, so a finished batch keeps its list after its items leave it.
  if (!columns.has('items_json')) db.exec("ALTER TABLE agent_batches ADD COLUMN items_json TEXT NOT NULL DEFAULT '[]'");
  // WORK-UX-01: each batch belongs to one agent profile.
  if (!columns.has('profile_id')) db.exec('ALTER TABLE agent_batches ADD COLUMN profile_id TEXT');
  if (!columns.has('execution_kind')) db.exec("ALTER TABLE agent_batches ADD COLUMN execution_kind TEXT NOT NULL DEFAULT 'structured'");
  if (!columns.has('requested_slots')) db.exec('ALTER TABLE agent_batches ADD COLUMN requested_slots INTEGER NOT NULL DEFAULT 1');
  if (!columns.has('authorized_at')) db.exec('ALTER TABLE agent_batches ADD COLUMN authorized_at TEXT');
}

const symphonyActions = new Set([...compiledLocalActions.filter(action => action.id.endsWith('.discover') && action.agentRunnable).map(action => action.id), 'platform.implement', 'platform.security', 'product.define', 'product.clarify', 'product.brief', 'data.contract', 'design.audit', 'pages.a11y', 'pages.flows', 'deploy.review', 'work.review']);

export function agentRuns({ db, know, worker = null, symphonyDispatch = false }) {
  const runnable = (projectId, actionId) => symphonyActions.has(actionId) || Boolean(actionForProject(db,projectId,actionId)?.agentRunnable);
  const batchRow = row => row && { id: row.id, number: row.number, ref: `B-${row.number}`, state: row.state, limit: row.item_limit, profileId: row.profile_id || null, createdAt: row.created_at, requestedSlots: row.requested_slots || 1, authorizedAt: row.authorized_at || null,
    startedAt: row.started_at, finishedAt: row.finished_at, startedBy: row.started_by, note: row.note, snapshot: parse(row.items_json, []) };
  const getBatch = (projectId, id) => batchRow(db.prepare('SELECT * FROM agent_batches WHERE id = ? AND project_id = ?').get(id, projectId));
  const item = (projectId, id) => know.workById(projectId, id);
  const itemsOf = (projectId, batchId) => know.workList(projectId).filter(entry => entry.context?.batch === batchId);
  const setContext = (projectId, id, changes) => { const current = item(projectId, id); const next = { ...(current.context || {}), ...changes };
    for (const [key, value] of Object.entries(next)) if (value === undefined) delete next[key]; know.setWorkContext(id, next); };
  const setState = (id, state) => db.prepare('UPDATE layer_work_items SET state = ?, updated_at = ? WHERE id = ?').run(state, now(), id);
  const activeBatch = (projectId, profileId, states) => batchRow(db.prepare(`SELECT * FROM agent_batches WHERE project_id = ? AND profile_id = ? AND state IN (${states.map(() => '?').join(', ')}) ORDER BY number DESC LIMIT 1`).get(projectId, profileId, ...states));
  const profileOf = (projectId, id) => know.list(projectId, 'agent_profile').find(entry => entry.id === id) || null;
  const actionLabel = (projectId, id) => know.roleView(projectId).flatMap(role => role.actions).find(action => action.id === id)?.name || id;
  const symphonyCompatible = (projectId, profileId) => {
    const profile = profileOf(projectId, profileId);
    return Boolean(symphonyDispatch && worker && profile && ['codex', undefined, null].includes(profile.provider));
  };

  // WORK-UX-01, one-time: batches from before per-profile batches take their items' agent profile (or the project's
  // default agent); an empty draft is removed.
  for (const row of db.prepare('SELECT * FROM agent_batches WHERE profile_id IS NULL').all()) {
    const items = know.workList(row.project_id).filter(entry => entry.context?.batch === row.id);
    const profileId = items.find(entry => entry.assignee?.kind === 'agent')?.assignee.id || know.defaultProfile(row.project_id)?.id || null;
    if (row.state === 'draft' && !items.length) db.prepare('DELETE FROM agent_batches WHERE id = ?').run(row.id);
    else db.prepare('UPDATE agent_batches SET profile_id = ? WHERE id = ?').run(profileId, row.id);
  }
  // A restart interrupts any batch mid-run: what it had not finished waits in a new batch, still staged.
  for (const row of db.prepare("SELECT * FROM agent_batches WHERE state IN ('running', 'stopping') AND (execution_kind IS NULL OR execution_kind != 'symphony')").all()) {
    db.prepare("UPDATE agent_batches SET state = 'stopped', finished_at = ?, note = 'Interrupted by a restart' WHERE id = ?").run(now(), row.id);
    restage(row.project_id, batchRow(row), 'The run was interrupted by a restart; still staged');
  }
  // Nothing runs at start-up, so any item still "claimed" is left over (before WORK-UX-01, assigning an agent claimed
  // it): it goes back to ready, staged if it is in a batch that hasn't finished, otherwise queued.
  for (const row of db.prepare("SELECT id, project_id, context_json FROM layer_work_items WHERE state = 'claimed'").all()) {
    const context = parse(row.context_json, {}) || {};
    const batch = context.batch && getBatch(row.project_id, context.batch);
    if (batch?.state === 'running' && db.prepare('SELECT execution_kind FROM agent_batches WHERE id = ?').get(batch.id)?.execution_kind === 'symphony') continue;
    const { run, skip, ...rest } = context;
    if (!batch || ['done', 'stopped'].includes(batch.state)) delete rest.batch;
    db.prepare("UPDATE layer_work_items SET state = 'ready', context_json = ? WHERE id = ?").run(JSON.stringify(rest), row.id);
  }

  function draft(projectId, profileId, user) {
    const existing = activeBatch(projectId, profileId, ['draft']);
    if (existing) return existing;
    const number = (db.prepare('SELECT MAX(number) AS max FROM agent_batches WHERE project_id = ?').get(projectId)?.max || 0) + 1;
    const id = `bat-${projectId.slice(2, 10)}-${number}`;
    db.prepare("INSERT INTO agent_batches(id, project_id, number, state, item_limit, created_by, created_at, profile_id) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)")
      .run(id, projectId, number, batchLimits.default, user?.name || null, now(), profileId);
    return getBatch(projectId, id);
  }

  // Unfinished items of a batch that stopped go into the profile's next batch, still staged.
  function restage(projectId, batch, reason, executionBlock = undefined) {
    const left = itemsOf(projectId, batch.id).filter(entry => entry.state === 'claimed' || entry.state === 'ready');
    if (!left.length || !batch.profileId) return;
    const next = draft(projectId, batch.profileId, null);
    for (const entry of left) {
      setState(entry.id, 'ready');
      setContext(projectId, entry.id, { batch: next.id, skip: undefined, stopping: undefined, run: entry.context?.run?.done ? entry.context.run : undefined, executionBlock });
      know.appendLog(entry.id, `${reason} (${next.ref})`);
    }
  }

  const lockedMessage = entry => `${entry.ref} is locked in while its batch runs. Skip it for this run instead.`;
  // Stage: into its agent's batch (Go runs it) or its person's list. Blocked items can't be staged.
  function stage(user, projectId, workId) {
    const entry = item(projectId, workId);
    if (!entry) fail('Work item not found.', 404);
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_work_migration'").get()) workActionMigration(db, projectId, workId);
    if (entry.state === 'suggested') fail(`Queue ${entry.ref} before staging it.`, 409);
    if (entry.state !== 'ready' || entry.context?.batch || entry.context?.staged) fail(`${entry.ref} is ${entry.state === 'done' ? 'done' : 'already staged or being worked on'}.`, 409);
    const blockers = know.blockersOf(projectId, workId);
    if (blockers.length) fail(`${entry.ref} is blocked by ${blockers.map(id => item(projectId, id)?.ref).join(', ')}. Finish or unlink those first.`, 409);
    if (!entry.assignee) fail(`Assign ${entry.ref} to someone first.`, 409);
    if (entry.assignee.kind === 'person') {
      setContext(projectId, workId, { staged: true });
      return know.appendLog(workId, `Staged in ${entry.assignee.id === user.id ? 'your' : `${entry.assignee.label}'s`} list`, {}, { by: { kind: 'person', id: user.id } });
    }
    if (entry.assignee.kind !== 'agent') fail(`${entry.ref} can't be staged.`, 409);
    if (!(runnable(projectId,entry.action) && symphonyCompatible(projectId, entry.assignee.id))) fail(`Agents can't run “${actionLabel(projectId, entry.action)}” yet. Assign ${entry.ref} to a person.`, 409);
    if (entry.question && !entry.question.answer && entry.action !== 'product.clarify') fail('Answer the open question before staging this agent task.', 409);
    if (entry.action === 'product.clarify' && (!entry.question || entry.question.answer)) fail('Draft answers only for an open question.', 409);
    if (entry.action === 'pages.flows' && (entry.targets.length > 1 || entry.targets.some(target => target.kind !== 'story'))) fail('A Pages flow may link at most one Vision story.', 409);
    if (entry.action === 'product.define' && !entry.targets.some(target => target.kind === 'story')) fail('Link a story before an agent writes acceptance.', 409);
    if (entry.action === 'product.brief' && (entry.targets.length > 1 || entry.targets.some(target => target.kind !== 'brief_claim')))
      fail('Link at most one Vision Brief claim, or leave the target empty to propose a new claim.', 409);
    if (entry.action === 'data.contract' && !entry.targets.some(target => target.kind === 'data_object')) fail('Link a Data object before an agent writes its contract.', 409);
    if (entry.action === 'platform.implement' && !entry.targets.some(target => target.kind === 'story')) fail('Link a story before an agent builds it.', 409);
    const profile = profileOf(projectId, entry.assignee.id);
    if (!profile || profile.active === false) fail(`${entry.assignee.label} is deactivated. Assign ${entry.ref} to another profile.`, 409);
    // Staging into a batch that is already running joins that run (it takes items one at a time).
    const live = null; // Symphony snapshots only draft batches at Go.
    const batch = live || draft(projectId, profile.id, user);
    if (itemsOf(projectId, batch.id).filter(other => ['ready', 'claimed'].includes(other.state)).length >= batch.limit) fail(`${batch.ref} is full (${batch.limit} items). Run it first, or unstage something.`, 409);
    setContext(projectId, workId, { batch: batch.id, feedbackSeen: undefined, executionBlock: undefined });
    if (live) setState(workId, 'claimed');
    return know.appendLog(workId, `Staged in ${profile.name}'s batch ${batch.ref}${live ? ' (joins the running batch)' : ''}`, {}, { by: { kind: 'person', id: user.id } });
  }

  // ROADMAP-01 (DEC-043): Next N is a fixed rule, not a ranking. The assignee's queued, unblocked items in the current
  // milestone's projects, highest priority first, then oldest; agents take only what they can run. Stops when the batch is full.
  // A layer's Tasks board may pass its layer key so Next fills the batch only from that layer's queue.
  function next(user, projectId, assignee, count, layer = null) {
    const limit = Number(count);
    if (!Number.isInteger(limit) || limit < 1 || limit > batchLimits.max) fail(`Choose between 1 and ${batchLimits.max} items.`);
    if (!assignee || !['person', 'agent'].includes(assignee.kind)) fail('Say whose batch to fill.');
    const milestone = know.list(projectId, 'phase').find(phase => phase.current)?.key || 'demo';
    const projects = new Map(know.list(projectId, 'project').map(project => [project.id, project]));
    const candidates = know.workList(projectId).filter(entry => entry.status === 'queued' && !entry.blockedBy.length && (!layer || entry.layer === layer) && entry.assignee?.kind === assignee.kind && entry.assignee?.id === assignee.id
      && projects.get(entry.project)?.milestone === milestone && (assignee.kind !== 'agent' || runnable(projectId,entry.action) && symphonyCompatible(projectId, assignee.id))).sort(byPriority);
    const added = [];
    for (const entry of candidates) {
      if (added.length >= limit) break;
      try { stage(user, projectId, entry.id); added.push(entry.id); }
      catch (error) { if (/is full/.test(error.message)) break; }
    }
    return { added };
  }

  function unstage(user, projectId, workId) {
    const entry = item(projectId, workId);
    if (!entry) fail('Work item not found.', 404);
    if (entry.context?.staged) { setContext(projectId, workId, { staged: undefined }); return know.appendLog(workId, 'Unstaged', {}, { by: { kind: 'person', id: user.id } }); }
    if (!entry.context?.batch || !['ready', 'claimed'].includes(entry.state)) fail('That item is not staged.', 404);
    const batch = getBatch(projectId, entry.context.batch);
    if (batch && ['running', 'stopping'].includes(batch.state)) fail(lockedMessage(entry), 409);
    setState(workId, 'ready');
    setContext(projectId, workId, { batch: undefined, skip: undefined });
    return know.appendLog(workId, `Unstaged from ${batch?.ref || 'its batch'}`, {}, { by: { kind: 'person', id: user.id } });
  }

  // While a batch runs its items are locked in; an item not yet picked up can be skipped for this run.
  function skip(user, projectId, workId, value = true) {
    const entry = item(projectId, workId);
    const batch = entry?.context?.batch && getBatch(projectId, entry.context.batch);
    if (!batch || !['running', 'stopping'].includes(batch.state) || entry.state !== 'claimed') fail('Only a waiting item in a running batch can be skipped.', 409);
    setContext(projectId, workId, { skip: value || undefined });
    return know.appendLog(workId, value ? `Skipped for this run of ${batch.ref}` : `Back in this run of ${batch.ref}`, {}, { by: { kind: 'person', id: user.id } });
  }

  // A Symphony item may be withdrawn while its batch runs; the worker sees the skip on refresh.
  function stopItem(user, projectId, workId) {
    const entry = item(projectId, workId);
    const batch = entry?.context?.batch && getBatch(projectId, entry.context.batch);
    if (!batch || batch.state !== 'running' || entry.state !== 'claimed' ||
        db.prepare('SELECT execution_kind FROM agent_batches WHERE id = ?').get(batch.id)?.execution_kind !== 'symphony')
      fail('That item is not running in Symphony.', 409);
    setContext(projectId, workId, { skip: true });
    return item(projectId, workId);
  }

  // Changing the assignee of a staged item moves it to the new assignee's batch or list; running batches are locked.
  function reassign(user, projectId, workId, assignee) {
    const entry = item(projectId, workId);
    if (!entry) fail('Work item not found.', 404);
    const batch = entry.context?.batch && getBatch(projectId, entry.context.batch);
    if (batch && ['running', 'stopping'].includes(batch.state) && ['ready', 'claimed'].includes(entry.state)) fail(lockedMessage(entry), 409);
    const wasStaged = entry.status === 'staged';
    if (wasStaged) { setContext(projectId, workId, { batch: undefined, staged: undefined, skip: undefined }); setState(workId, 'ready'); }
    const saved = know.updateWork(user, projectId, workId, { assignee });
    if (!wasStaged) return saved;
    try { return stage(user, projectId, workId); }
    catch (error) { know.appendLog(workId, `Back in the queue: ${error.message}`); return item(projectId, workId); }
  }

  // Tokens a profile has used: in one batch run, and this calendar month (from each item's recorded run).
  function usage(projectId, { profileId, batchId, since }) {
    return know.workList(projectId).filter(entry => entry.context?.run?.usage && (!profileId || entry.context.run.profileId === profileId || entry.profileId === profileId)
      && (!batchId || entry.context.run.batch === batchId) && (!since || (entry.context.run.at || '') >= since))
      .reduce((sum, entry) => sum + (entry.context.run.usage.input || 0) + (entry.context.run.usage.output || 0), 0);
  }
  const monthStart = () => { const date = new Date(); return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString(); };
  function overLimit(projectId, profile, batchId) {
    const month = usage(projectId, { profileId: profile.id, since: monthStart() });
    if (profile.limits.monthlyTokens !== null && month >= profile.limits.monthlyTokens) return `${profile.name} reached its monthly limit (${profile.limits.monthlyTokens.toLocaleString('en')} tokens).`;
    const run = usage(projectId, { batchId });
    if (profile.limits.batchTokens !== null && run >= profile.limits.batchTokens) return `This run reached ${profile.name}'s limit per batch (${profile.limits.batchTokens.toLocaleString('en')} tokens).`;
    return null;
  }

  function admit(projectId) {
    const pool = worker?.poolStatus(projectId);
    if (!pool?.online || !pool.free) return;
    let free = pool.free;
    // Strict authorization order: a smaller later batch cannot overtake a larger queued one.
    for (const row of db.prepare("SELECT * FROM agent_batches WHERE project_id = ? AND state = 'queued' AND execution_kind = 'symphony' ORDER BY authorized_at, number").all(projectId)) {
      const batch = batchRow(row);
      const selected = profileOf(projectId, batch.profileId);
      if (selected && (selected.model || (selected.effort || 'medium') !== 'medium') && !pool.profileOverrides) break;
      if (batch.requestedSlots > free) break;
      const items = batch.snapshot.map(id => item(projectId, id));
      try {
        if (items.some(entry => !entry || entry.state !== 'ready' || entry.context?.batch !== batch.id)) fail('A queued item changed before dispatch.', 409);
        if (items.some(entry => !worker.pinnedCurrent(projectId, batch.profileId, entry.id, batch.id))) fail('Pinned task inputs changed before dispatch.', 409);
      } catch (error) {
        db.prepare("UPDATE agent_batches SET state = 'stopped', finished_at = ?, note = ? WHERE id = ?")
          .run(now(), `Queued inputs changed: ${error.message}`, batch.id);
        restage(projectId, batch, 'Queued inputs changed; review and authorize again', { code: 'inputs-changed', reason: 'Task inputs changed after Go. Review them, then run the new batch.', recovery: 'retry' });
        continue;
      }
      for (const entry of items) {
        setState(entry.id, 'claimed');
        setContext(projectId, entry.id, { skip: undefined });
        know.appendLog(entry.id, `${batch.ref} started with ${batch.requestedSlots} worker slot${batch.requestedSlots === 1 ? '' : 's'}`);
      }
      db.prepare("UPDATE agent_batches SET state = 'running', started_at = ?, note = NULL WHERE id = ? AND state = 'queued'").run(now(), batch.id);
      free -= batch.requestedSlots;
    }
  }

  // Go authorizes a pinned snapshot. Capacity admission starts it when all requested slots are free.
  function start(user, projectId, batchId, requestedSlots = 1) {
    if (!db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'").get(projectId, user.id)) fail('Only a project owner can start an agent batch.', 403);
    const batch = getBatch(projectId, batchId);
    if (!batch || !['draft', 'stopped'].includes(batch.state)) fail('Only a batch that is not running can be started.', 409);
    const slots = Number(requestedSlots);
    const pool = worker?.poolStatus(projectId);
    if (!Number.isInteger(slots) || slots < 1 || slots > (pool?.configured || 1)) fail(`Choose between 1 and ${pool?.configured || 1} worker slots.`);
    const items = itemsOf(projectId, batch.id).filter(entry => entry.state === 'ready');
    if (!items.length) fail('Stage work in the batch first.', 409);
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_work_migration'").get()) for (const entry of items) workActionMigration(db, projectId, entry.id);
    if (slots > items.length) fail('A batch cannot reserve more workers than it has items.', 409);
    if (!items.every(entry => runnable(projectId,entry.action))) fail('This batch contains an action without a Symphony output adapter.', 409);
    if (!symphonyCompatible(projectId, batch.profileId)) fail('This profile needs a supported Symphony provider.', 409);
    const profile = profileOf(projectId, batch.profileId);
    if (!profile || profile.active === false) fail('This batch’s profile is deactivated.', 409);
    const limit = overLimit(projectId, profile, null);
    if (limit) fail(`${limit} Raise it in Work › Agents to run more.`, 409);
    for (const entry of items) {
      setContext(projectId, entry.id, { executionBlock: undefined });
      worker.pin(projectId, batch.profileId, entry.id, batch.id);
    }
    db.prepare("UPDATE agent_batches SET state = 'queued', authorized_at = ?, started_by = ?, started_at = NULL, finished_at = NULL, note = NULL, items_json = ?, requested_slots = ?, execution_kind = 'symphony' WHERE id = ?")
      .run(now(), user.name, JSON.stringify(items.map(entry => entry.id)), slots, batch.id);
    for (const entry of items) know.appendLog(entry.id, `Authorized ${batch.ref}; waiting for ${slots} worker slot${slots === 1 ? '' : 's'}`, {}, { by: { kind: 'person', id: user.id } });
    admit(projectId);
    return { batch: getBatch(projectId, batch.id), job: null };
  }

  function stop(user, projectId, batchId) {
    const batch = getBatch(projectId, batchId);
    if (!batch || !['running', 'queued'].includes(batch.state) || db.prepare('SELECT execution_kind FROM agent_batches WHERE id = ?').get(batch.id)?.execution_kind !== 'symphony')
      fail('That Symphony batch is not running or queued.', 409);
    db.prepare("UPDATE agent_batches SET state = 'stopped', finished_at = ?, note = ? WHERE id = ?").run(now(), `Stopped by ${user.name}`, batch.id);
    restage(projectId, getBatch(projectId, batch.id), `${batch.ref} stopped; still staged`);
    admit(projectId);
    return getBatch(projectId, batch.id);
  }

  function view(projectId) {
    const work = know.workList(projectId);
    return db.prepare('SELECT * FROM agent_batches WHERE project_id = ? ORDER BY number DESC LIMIT 20').all(projectId).map(batchRow).map(({ snapshot, ...batch }) => {
      const items = work.filter(entry => entry.context?.batch === batch.id || snapshot.includes(entry.id));
      const used = items.filter(entry => entry.context?.run?.batch === batch.id && entry.context.run.usage).reduce((sum, entry) => ({ input: sum.input + entry.context.run.usage.input, output: sum.output + entry.context.run.usage.output }), { input: 0, output: 0 });
      return { ...batch, items: items.map(entry => entry.id), usage: used, working: null };
    });
  }

  function acceptBrief(user, projectId, workId, proposalId) {
    const entry = item(projectId, workId);
    const proposal = db.prepare('SELECT * FROM vision_proposals WHERE id = ? AND project_id = ? AND work_id = ?').get(proposalId, projectId, workId);
    if (!entry || entry.action !== 'product.brief' || !proposal || entry.context?.visionProposal?.id !== proposalId)
      fail('Vision proposal not found for this Work item.', 404);
    if (entry.state === 'done' && proposal.state === 'accepted' && proposal.accepted_claim_id)
      return { work: entry, claim: know.get(projectId, proposal.accepted_claim_id) };
    if (entry.state !== 'review' || proposal.state !== 'submitted') fail('This Vision proposal is not waiting for review.', 409);
    if (!know.mayDo(user, projectId, 'product.brief')) fail('A Product lead must accept this Vision proposal.', 403);
    if (!entry.checks.length || entry.checks.some(check => check.verdict !== 'accept')) fail('Accept every Work check before applying the Vision proposal.', 409);
    if (know.briefRevision(projectId) !== proposal.brief_revision) fail('The Brief changed since this proposal was drafted. Send it back and stage a fresh run.', 409);
    const content = parse(proposal.content_json, null);
    const target = proposal.target_id ? know.get(projectId, proposal.target_id) : null;
    if (proposal.target_id && (!target || target.kind !== 'brief_claim' || target.revision !== proposal.expected_revision))
      fail('The target claim changed since this proposal was drafted.', 409);
    db.exec('BEGIN IMMEDIATE');
    try {
      const changes = { section: content.section, text: content.text, note: content.note };
      const options = { author: user.name, rationale: `Accepted ${entry.ref}: ${content.basis}`, workItemId: entry.id };
      const claim = target ? know.update(projectId, target.id, changes, { ...options, expectedRevision: proposal.expected_revision })
        : know.insert(projectId, 'brief_claim', changes, options);
      db.prepare("UPDATE vision_proposals SET state = 'accepted', accepted_claim_id = ?, accepted_at = ? WHERE id = ?")
        .run(claim.id, now(), proposalId);
      know.appendLog(entry.id, `Applied Vision claim ${claim.id} revision ${claim.revision}`, { context: { ...entry.context, visionProposal: { ...content, acceptedClaimId: claim.id } } },
        { by: { kind: 'person', id: user.id }, refs: [claim.id] });
      const work = know.updateWork(user, projectId, workId, { state: 'done', visionProposalId: proposalId });
      db.exec('COMMIT');
      return { work, claim };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function rejectBrief(projectId, workId, proposalId) {
    db.prepare("UPDATE vision_proposals SET state = 'rejected' WHERE id = ? AND project_id = ? AND work_id = ? AND state = 'submitted'")
      .run(proposalId, projectId, workId);
  }

  return { draft, stage, unstage, next, skip, stopItem, reassign, start, stop, admit, view, usage, acceptBrief, rejectBrief };
}
