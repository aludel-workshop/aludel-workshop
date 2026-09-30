import { randomUUID } from 'node:crypto';
import { followUpsForAttempt } from './layer-scope.mjs';

// WORK-ITEM-UX-01: a work item's runs. A run is one Symphony attempt that a worker actually started. It is read from the
// attempt, the task snapshot pinned in its Go bundle, and the outputs it submitted. Each run is reviewed and signed on its
// own record, so a later run never overwrites what an earlier one received, produced or was told.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const clip = (value, max) => String(value ?? '').replace(/\s+\n/g, '\n').trim().slice(0, max);

export function initWorkRuns(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS work_run_reviews (
    attempt_id TEXT PRIMARY KEY REFERENCES symphony_attempts(id), project_id TEXT NOT NULL, work_id TEXT NOT NULL,
    verdicts_json TEXT NOT NULL DEFAULT '{}', flags_json TEXT NOT NULL DEFAULT '{}',
    outcome TEXT, comment TEXT, signed_by TEXT, signed_at TEXT, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS work_run_steps (
    attempt_id TEXT NOT NULL REFERENCES symphony_attempts(id), seq INTEGER NOT NULL, kind TEXT NOT NULL,
    payload_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(attempt_id, seq)
  );
  CREATE TABLE IF NOT EXISTS work_person_runs (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, work_id TEXT NOT NULL, performer_id TEXT NOT NULL, performer_name TEXT NOT NULL,
    task_json TEXT NOT NULL, changes_json TEXT NOT NULL DEFAULT '[]', evidence_json TEXT NOT NULL DEFAULT '[]',
    summary TEXT, state TEXT NOT NULL, started_at TEXT NOT NULL, submitted_at TEXT, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS work_person_run_reviews (
    run_id TEXT PRIMARY KEY REFERENCES work_person_runs(id), project_id TEXT NOT NULL, work_id TEXT NOT NULL,
    verdicts_json TEXT NOT NULL DEFAULT '{}', flags_json TEXT NOT NULL DEFAULT '{}',
    outcome TEXT, comment TEXT, signed_by TEXT, signed_at TEXT, updated_at TEXT NOT NULL
  );`);
}

// Outcomes a reviewer can sign. Accepting applies the run; the others leave its changes unapplied and reopen the task.
export const signOutcomes = { accept: 'accepted', reject: 'sent', close: 'closed' };

export function workRuns({ db, know, candidates = null }) {
  const personId = id => String(id || '').startsWith('person-run-');
  const reviewTable = id => personId(id) ? ['work_person_run_reviews', 'run_id'] : ['work_run_reviews', 'attempt_id'];
  const reviewRow = id => { const [table, key] = reviewTable(id); return db.prepare(`SELECT * FROM ${table} WHERE ${key} = ?`).get(id); };
  const events = attemptId => db.prepare('SELECT kind, created_at AS at FROM symphony_attempt_events WHERE attempt_id = ? ORDER BY created_at').all(attemptId);
  const steps = attemptId => db.prepare('SELECT seq, kind, payload_json, created_at FROM work_run_steps WHERE attempt_id = ? ORDER BY seq').all(attemptId)
    .map(row => ({ seq: row.seq, kind: row.kind, at: row.created_at, ...parse(row.payload_json, {}) }));
  const layerName = (projectId, key) => db.prepare('SELECT name FROM layer_definitions WHERE project_id = ? AND layer_key = ?').get(projectId, key)?.name || key;
  const sectionName = key => ({ problem: 'Problem', audience: 'Audience', value: 'Value', differentiators: 'Differentiators', scope: 'Scope', constraints: 'Constraints' })[key]
    || String(key || 'Brief').replace(/^./, first => first.toUpperCase());

  // A run started once a worker registered a workspace or reserved a turn; authorizations a worker never picked up stay in Activity.
  const started = row => row.runs_started > 0 || row.workspace_path || ['working', 'submitted'].includes(row.state);

  // What the run proposed, as one row per changed thing. Nothing here is applied until the run is accepted.
  function changesOf(projectId, row, bundle) {
    const changes = [];
    const proposal = db.prepare('SELECT * FROM symphony_proposals WHERE attempt_id = ?').get(row.id);
    if (proposal) {
      const content = parse(proposal.content_json, {});
      const vision = content.visionProposal || (proposal.action_id === 'product.brief'
        ? parse(db.prepare('SELECT content_json FROM vision_proposals WHERE id = ?').get(proposal.id)?.content_json, null) : null);
      if (content.scope === 'layer') {
        // PAGES-API-01: one row per record the run's API calls changed, with the fields that differ.
        const kindName = { page: 'Page', flow: 'Flow', page_map: 'Map' };
        // Record IDs read as their names, so a reviewer sees "Browse tools (pag-…)" rather than an ID.
        const named = id => { const record = know.get(projectId, id); const label = record && (record.title || record.label || record.name || record.text); return label ? `${label} (${id})` : id; };
        const show = value => typeof value === 'string' ? named(value) : JSON.stringify(value, (key, entry) => typeof entry === 'string' && /^[a-z]+-[a-z0-9]{6,12}$/.test(entry) ? named(entry) : entry, 2);
        const empty = value => value === null || value === '' || Array.isArray(value) && !value.length || value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length;
        for (const change of content.changes) {
          const keys = [...new Set([...Object.keys(change.before || {}), ...Object.keys(change.after || {})])];
          const fields = keys.filter(key => JSON.stringify(change.before?.[key]) !== JSON.stringify(change.after?.[key]) && !(change.op === 'create' && empty(change.after?.[key])))
            .map(key => ({ name: key, before: change.before ? show(change.before[key] ?? '') : null, after: show(change.after?.[key] ?? '') }));
          const label = change.after?.title || change.after?.label || (change.kind === 'page_map' ? 'Placement' : change.id);
          changes.push({ id: `${proposal.id}:${change.id}`, kind: 'record', icon: change.kind === 'flow' ? 'route' : change.kind === 'page_map' ? 'map' : 'web',
            name: `${layerName(projectId, content.layer)} › ${kindName[change.kind] || change.kind} › ${label}`, op: change.op === 'create' ? 'created' : 'modified',
            size: change.op === 'create' ? '' : `${fields.length} ${fields.length === 1 ? 'field' : 'fields'} · r${change.baseRevision}`, fields });
        }
        // LAYER-SOURCE-01: files the run changed in its layer's repository, as one reviewed commit.
        for (const file of content.source?.files || []) changes.push({ id: `${proposal.id}:src:${file.path}`, kind: 'source', icon: file.ownerReview ? 'code' : 'description',
          name: `${layerName(projectId, content.layer)} repository › ${file.path}`, op: file.status === 'added' ? 'created' : file.status === 'deleted' ? 'removed' : 'modified',
          size: `+${file.added} −${file.removed}`, diff: file.diff, ownerReview: file.ownerReview, commit: content.source.commit });
        if (content.notes) changes.push({ id: `${proposal.id}:notes`, kind: 'report', icon: 'notes', name: 'Notes', op: 'created', size: '', after: content.notes });
      } else if (vision) changes.push({ id: proposal.id, kind: 'claim', icon: 'lightbulb', name: `Vision › Brief › ${sectionName(vision.section)}`,
        op: vision.targetId ? 'modified' : 'created', size: '1 claim', before: vision.beforeText || null, after: vision.text, note: vision.note || '', basis: vision.basis || '' });
      else if (proposal.action_id === 'pages.flows' && content.semanticReview) {
        const review = content.semanticReview;
        changes.push({ id:proposal.id, kind:'flow-revision', icon:'route', name:`Pages › Flow › ${review.before.title}`,
          op:'modified', size:`r${review.target.expectedRevision} → r${review.target.acceptedRevision}`,
          before:JSON.stringify(review.before,null,2), after:JSON.stringify(review.after,null,2) });
      } else {
        const targets = bundle?.work?.targets || [];
        changes.push({ id: proposal.id, kind: 'proposal', icon: 'edit_document', name: targets.length ? targets.map(target => target.label).join(', ') : content.summary || proposal.action_id,
          op: targets.length ? 'modified' : 'created', size: `${Object.keys(content.content || {}).length} fields`, after: content.summary || '', content: content.content || {} });
      }
    }
    const report = db.prepare('SELECT * FROM symphony_reports WHERE attempt_id = ?').get(row.id);
    if (report) {
      const value = parse(report.content_json, {});
      const findings = value.report?.findings || value.findings || [];
      changes.push({ id: report.id, kind: 'report', icon: 'shield', name: 'Security findings report', op: 'created',
        size: `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}`, after: value.report?.summary || value.summary || '', findings });
    }
    const candidate = row.candidate_id && candidates ? candidates.get(projectId, row.candidate_id) : null;
    if (candidate) for (const file of candidate.files || []) changes.push({ id: `${candidate.id}:${file}`, kind: 'file', icon: 'code', name: file, op: 'modified', size: '', candidateId: candidate.id });
    return { changes, followUps: proposal ? followUpsForAttempt(db, row.id).map(entry => ({ ...entry, layerName: layerName(projectId, entry.layer),
        createdRef: entry.createdWorkId ? know.workById(projectId, entry.createdWorkId)?.ref || null : null })) : [], summary: proposal ? parse(proposal.content_json, {}).summary || null : null,
      candidate: candidate ? { id: candidate.id, state: candidate.state, commit: candidate.commit, base: candidate.base, checks: candidate.checks } : null,
      proposalId: proposal?.id || null, reportId: report?.id || null };
  }

  function stateOf(row, item, review, latest, batchState, terminalStuck = false) {
    if (review?.outcome) return review.outcome;
    if (row.state === 'submitted') {
      // Runs created before `stuck` became terminal may still have accepted a diagnostic submission. Preserve that report,
      // but never present an unresolved blocker as successful or allow its output to be accepted.
      if (terminalStuck) return 'failed';
      if (latest && item.state === 'review') return 'review';
      return item.state === 'done' ? 'accepted' : 'sent';
    }
    if (row.state === 'blocked') return latest && item.state === 'needs-input' ? 'needs' : 'failed';
    if (latest && item.state === 'claimed' && batchState === 'running') return 'working';
    if (latest && item.state === 'needs-input') return 'needs';
    return 'stopped';
  }

  function list(projectId, workId) {
    const item = know.workById(projectId, workId);
    if (!item) fail('Work item not found.', 404);
    const rows = db.prepare('SELECT * FROM symphony_attempts WHERE project_id = ? AND work_id = ? ORDER BY created_at').all(projectId, workId).filter(started);
    const profiles = new Map(know.list(projectId, 'agent_profile').map(profile => [profile.id, profile]));
    const agentRuns = rows.map(row => {
      const latest = row.id === rows[rows.length - 1]?.id;
      const bundle = parse(db.prepare('SELECT content_json FROM symphony_bundles WHERE digest = ?').get(row.bundle_digest)?.content_json, null);
      const review = reviewRow(row.id);
      const batchState = db.prepare('SELECT state FROM agent_batches WHERE id = ?').get(row.batch_id)?.state || null;
      const planned = steps(row.id);
      const lastPlan = [...planned].reverse().find(step => step.kind === 'plan');
      const progress = planned.filter(step => step.kind === 'progress' && (!lastPlan || step.seq > lastPlan.seq));
      const terminalStuck = progress.some(step => step.status === 'stuck' && !progress.some(later => later.seq > step.seq && later.index === step.index && later.status === 'done'));
      const state = stateOf(row, item, review, latest, batchState, terminalStuck);
      const timeline = events(row.id);
      const startedAt = timeline.find(event => event.kind === 'started')?.at || row.created_at;
      const finishedAt = timeline.filter(event => ['submitted', 'error', 'blocked'].includes(event.kind)).pop()?.at || (['working', 'needs'].includes(state) ? null : row.updated_at);
      const work = bundle?.work || {};
      const profile = profiles.get(row.profile_id);
      const outputs = changesOf(projectId, row, bundle);
      // Live detail for the current run comes from the item; later runs replace it, so earlier runs keep only their own record.
      const live = latest && item.context?.run ? item.context.run : null;
      return {
        id: row.id, batchId: row.batch_id, state,
        performer: { kind: 'agent', id: row.profile_id, label: profile?.name || 'Agent profile', model: profile?.model || null, effort: profile?.effort || null },
        startedAt, finishedAt, turns: { used: row.runs_started, limit: row.run_limit },
        task: {
          title: work.title || item.title, request: work.context?.suggestion || '', action: work.action || item.action,
          criteria: (work.checks || []).map((check, position) => ({ index: position, text: check.text, source: check.source || null })),
          targets: (work.targets || []).map(target => ({ id: target.id, label: target.label, kind: target.kind })),
          carried: (work.context?.feedback || []).map(note => ({ check: note.check, note: note.note, by: note.by })),
          carriedComment: work.context?.reviewComment || null,
        },
        live: live ? { phases: live.phases || [], phase: live.phase ?? null, activity: live.activity || '', model: live.model || null, usage: live.usage || null } : null,
        steps: planned.filter(step => step.kind !== 'evidence'),
        evidence: resolveEvidence(planned, outputs.changes, outputs.candidate),
        blockReason: state === 'failed' ? item.context?.executionBlock?.reason || progress.find(step => step.status === 'stuck')?.note
          || item.log.filter(entry => /^Blocked: /.test(entry.text)).pop()?.text.slice(9) || null : null,
        ...outputs,
        review: {
          verdicts: parse(review?.verdicts_json, {}), flags: parse(review?.flags_json, {}),
          outcome: review?.outcome || null, comment: review?.comment || null, signedBy: review?.signed_by || null, signedAt: review?.signed_at || null,
        },
      };
    });
    const people = db.prepare('SELECT * FROM work_person_runs WHERE project_id = ? AND work_id = ? ORDER BY started_at').all(projectId, workId).map(row => {
      const task = parse(row.task_json, {});
      const review = reviewRow(row.id);
      return {
        id: row.id, batchId: null, state: review?.outcome || row.state,
        performer: { kind: 'person', id: row.performer_id, label: row.performer_name, model: null, effort: null },
        startedAt: row.started_at, finishedAt: row.submitted_at, turns: { used: 0, limit: 0 }, task,
        live: null, steps: [], evidence: parse(row.evidence_json, []), blockReason: null,
        changes: parse(row.changes_json, []), candidate: null, proposalId: null, reportId: null, summary: row.summary || null,
        review: { verdicts: parse(review?.verdicts_json, {}), flags: parse(review?.flags_json, {}),
          outcome: review?.outcome || null, comment: review?.comment || null, signedBy: review?.signed_by || null, signedAt: review?.signed_at || null },
      };
    });
    return [...agentRuns, ...people].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((run, index) => ({ ...run, number: index + 1 }));
  }

  const runFor = (projectId, workId, attemptId) => {
    const run = list(projectId, workId).find(entry => entry.id === attemptId);
    if (!run) fail('Run not found for this work item.', 404);
    return run;
  };

  // Verdicts on criteria and flags on changes, saved as the reviewer works. Only the run waiting for review takes them.
  function saveReview(projectId, workId, attemptId, input) {
    const run = runFor(projectId, workId, attemptId);
    if (run.state !== 'review') fail(`Run ${run.number} isn't waiting for review.`, 409);
    const verdicts = { ...run.review.verdicts };
    const flags = { ...run.review.flags };
    if (input.verdict) {
      const index = Number(input.verdict.index);
      if (!Number.isInteger(index) || !run.task.criteria[index]) fail('Unknown criterion.');
      const value = input.verdict.value ?? null;
      if (![null, 'accept', 'reject', 'skip'].includes(value)) fail('A criterion is accepted, rejected or skipped.');
      if (value === null) delete verdicts[index]; else verdicts[index] = { value, note: clip(input.verdict.note ?? verdicts[index]?.note, 1000) };
    }
    if (input.flag) {
      const id = String(input.flag.id || '');
      if (!run.changes.some(change => change.id === id)) fail('Unknown change.');
      if (input.flag.on === false) delete flags[id]; else flags[id] = clip(input.flag.note ?? flags[id], 1000);
    }
    const [table, key] = reviewTable(attemptId);
    db.prepare(`INSERT INTO ${table}(${key}, project_id, work_id, verdicts_json, flags_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(${key}) DO UPDATE SET verdicts_json = excluded.verdicts_json, flags_json = excluded.flags_json, updated_at = excluded.updated_at`)
      .run(attemptId, projectId, workId, JSON.stringify(verdicts), JSON.stringify(flags), now());
    return runFor(projectId, workId, attemptId);
  }

  // Which signatures each run state allows (the run actions table in the work record).
  function assertSignable(run, outcome) {
    if (!signOutcomes[outcome]) fail('Sign as accept, reject or close.');
    if (run.review.outcome) fail(`Run ${run.number} is already signed.`, 409);
    if (outcome === 'close' && !['failed', 'stopped'].includes(run.state)) fail(run.state === 'review' ? 'Accept or send back a run that is ready for review.' : 'Stop the run before closing it.', 409);
    if (outcome !== 'close' && run.state !== 'review') fail(`Run ${run.number} isn't waiting for review.`, 409);
  }

  // The reviewer's notes, for the send-back feedback the next run receives.
  function reviewNotes(run) {
    const criteria = Object.entries(run.review.verdicts).filter(([, verdict]) => verdict.value === 'reject')
      .map(([index, verdict]) => ({ check: run.task.criteria[index]?.text || `Criterion ${Number(index) + 1}`, note: verdict.note }));
    const changes = Object.entries(run.review.flags).map(([id, note]) => ({ check: `Change: ${run.changes.find(change => change.id === id)?.name || id}`, note }));
    return [...criteria, ...changes];
  }

  function recordSignature(user, projectId, workId, attemptId, outcome, comment) {
    const [table, key] = reviewTable(attemptId);
    db.prepare(`INSERT INTO ${table}(${key}, project_id, work_id, outcome, comment, signed_by, signed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(${key}) DO UPDATE SET outcome = excluded.outcome, comment = excluded.comment, signed_by = excluded.signed_by, signed_at = excluded.signed_at, updated_at = excluded.updated_at`)
      .run(attemptId, projectId, workId, signOutcomes[outcome], clip(comment, 2000) || null, user.name, now(), now());
    if (personId(attemptId)) {
      db.prepare('UPDATE work_person_runs SET state = ?, updated_at = ? WHERE id = ?').run(signOutcomes[outcome], now(), attemptId);
      const item = know.workById(projectId, workId);
      if (item?.context?.personRun === attemptId) {
        const { personRun, ...context } = item.context;
        know.setWorkContext(workId, context);
      }
    }
    return runFor(projectId, workId, attemptId);
  }

  // The reviewer's signature closes a run. Accepting applies it through the action's own checked boundary (handlers.accept);
  // rejecting or closing leaves its outputs unapplied, keeps them on this run, and reopens the task with the notes carried in.
  async function sign(user, projectId, workId, attemptId, { outcome, comment = '' }, handlers = {}) {
    const run = runFor(projectId, workId, attemptId);
    assertSignable(run, outcome);
    if (outcome === 'accept') {
      if (!handlers.accept) fail('This run has no acceptance path.', 409);
      // The signature stands for every criterion; the action boundaries still require each check to read as accepted.
      const item = know.workById(projectId, workId);
      item.checks.forEach((check, index) => { if (check.verdict !== 'accept') know.updateWork(user, projectId, workId, { verdict: { index, value: 'accept' } }); });
      await handlers.accept(run);
    } else {
      if (outcome === 'reject' && handlers.reject) await handlers.reject(run);
      know.updateWork(user, projectId, workId, { reopen: { feedback: reviewNotes(run), comment, outcome } });
    }
    return recordSignature(user, projectId, workId, attemptId, outcome, comment);
  }

  const taskSnapshot = item => ({
    title: item.title, request: item.context?.suggestion || '', action: item.action,
    criteria: item.checks.map((check, index) => ({ index, text: check.text, source: check.source || null })),
    targets: item.targets.map(target => ({ id: target.id, label: target.label, kind: target.kind })),
    carried: (item.context?.feedback || []).map(note => ({ check: note.check, note: note.note, by: note.by })),
    carriedComment: item.context?.reviewComment || null,
  });
  const personRun = (projectId, workId, runId) => db.prepare('SELECT * FROM work_person_runs WHERE id = ? AND project_id = ? AND work_id = ?').get(runId, projectId, workId);
  function startPerson(user, projectId, workId) {
    const item = know.workById(projectId, workId);
    if (!item) fail('Work item not found.', 404);
    if (item.assignee?.kind !== 'person' || item.assignee.id !== user.id) fail('Only the assigned person can start this work.', 403);
    if (item.status !== 'staged') fail('Stage this item before starting work.', 409);
    if (db.prepare("SELECT 1 FROM work_person_runs WHERE project_id = ? AND work_id = ? AND state IN ('working', 'review')").get(projectId, workId)) fail('This item already has an open person run.', 409);
    const id = `person-run-${randomUUID()}`, at = now();
    db.prepare("INSERT INTO work_person_runs(id, project_id, work_id, performer_id, performer_name, task_json, state, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'working', ?, ?)")
      .run(id, projectId, workId, user.id, user.name, JSON.stringify(taskSnapshot(item)), at, at);
    const context = { ...(item.context || {}), staged: undefined, personRun: id };
    know.appendLog(workId, 'Started work', { state: 'claimed', context }, { by: { kind: 'person', id: user.id } });
    return runFor(projectId, workId, id);
  }
  function personChanges(projectId, workId, startedAt, selected) {
    const available = know.workChanges(projectId, workId).filter(change => change.createdAt >= startedAt);
    const wanted = new Set((Array.isArray(selected) ? selected : []).map(String));
    if (wanted.size) for (const id of wanted) if (!available.some(change => `${change.recordId}:${change.revision}` === id)) fail('A selected change was not made during this run.');
    return available.filter(change => !wanted.size || wanted.has(`${change.recordId}:${change.revision}`)).map(change => {
      const record = know.get(projectId, change.recordId);
      return { id: `${change.recordId}:${change.revision}`, kind: 'proposal', icon: 'edit_note',
        name: record?.name || record?.title || record?.label || (change.kind === 'markdown_document' ? String(change.fields.find(field => field.field === 'path')?.after || change.recordId) : change.recordId), op: change.revision === 1 ? 'created' : 'modified',
        size: `${change.fields.length} ${change.fields.length === 1 ? 'field' : 'fields'}`,
        after: change.rationale || '', content: Object.fromEntries(change.fields.map(field => [field.field, field.after])) };
    });
  }
  function submitPerson(user, projectId, workId, runId, input) {
    const row = personRun(projectId, workId, runId);
    if (!row) fail('Person run not found.', 404);
    if (row.performer_id !== user.id) fail('Only the person doing this work can submit it.', 403);
    if (row.state !== 'working') fail('Only active person work can be submitted.', 409);
    const summary = clip(input.summary, 2000);
    if (!summary) fail('Summarize what is ready for review.');
    const task = parse(row.task_json, {});
    const changes = personChanges(projectId, workId, row.started_at, input.changes);
    const evidence = (Array.isArray(input.evidence) ? input.evidence : []).map(entry => {
      const criterion = Number(entry?.criterion);
      if (!Number.isInteger(criterion) || !task.criteria?.[criterion]) fail('Evidence names a criterion this run was given.');
      const note = clip(entry?.note, 500);
      if (!note) fail('Say what the reviewer should check for each evidence item.');
      const ref = clip(entry?.ref, 300), change = ref && changes.find(value => value.id === ref);
      if (ref && !change) fail('Criterion evidence refers to a change outside this review packet.');
      return { criterion, type: change ? 'change' : 'note', ref: ref || `criterion-${criterion}`, note,
        found: true, target: change ? `change:${change.id}` : null, label: change?.name || 'Performer note' };
    });
    const at = now();
    db.prepare("UPDATE work_person_runs SET changes_json = ?, evidence_json = ?, summary = ?, state = 'review', submitted_at = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(changes), JSON.stringify(evidence), summary, at, at, runId);
    const item = know.workById(projectId, workId);
    know.appendLog(workId, `Submitted person run for review: ${summary}`, { state: 'review', context: { ...(item.context || {}), personRun: runId } }, { by: { kind: 'person', id: user.id } });
    return runFor(projectId, workId, runId);
  }
  function stopPerson(user, projectId, workId, runId) {
    const row = personRun(projectId, workId, runId);
    if (!row) fail('Person run not found.', 404);
    if (row.performer_id !== user.id) fail('Only the person doing this work can stop it.', 403);
    if (row.state !== 'working') fail('Only active person work can be stopped.', 409);
    db.prepare("UPDATE work_person_runs SET state = 'stopped', submitted_at = ?, updated_at = ? WHERE id = ?").run(now(), now(), runId);
    const item = know.workById(projectId, workId);
    know.appendLog(workId, 'Stopped work; close the run to reopen the task', { state: 'ready', context: { ...(item.context || {}), personRun: undefined } }, { by: { kind: 'person', id: user.id } });
    return runFor(projectId, workId, runId);
  }

  // WI-5: the agent reports its own plan and progress. `stuck` means a blocking objective, so it terminally fails the run;
  // a recoverable obstacle stays `active` with a note. This makes the first known prerequisite failure stop downstream work.
  function reportPlan(projectId, attemptId, objectives) {
    const row = db.prepare('SELECT * FROM symphony_attempts WHERE id = ? AND project_id = ?').get(attemptId, projectId);
    if (!row) fail('Attempt not found.', 404);
    if (row.state !== 'working') fail('Only a working run can report its plan.', 409);
    if (!Array.isArray(objectives) || objectives.length < 1 || objectives.length > 12) fail('A plan has one to twelve objectives.');
    const clean = objectives.map(entry => clip(entry, 160)).filter(Boolean);
    if (clean.length !== objectives.length) fail('Each objective needs a short description.');
    const seq = addStep(attemptId, 'plan', { objectives: clean });
    live(projectId, row.work_id, run => ({ ...run, phases: clean, phase: 0, activity: clean[0] }));
    return { attemptId, seq, objectives: clean };
  }
  function reportProgress(projectId, attemptId, { index, status, note = '' }) {
    const row = db.prepare('SELECT * FROM symphony_attempts WHERE id = ? AND project_id = ?').get(attemptId, projectId);
    if (!row) fail('Attempt not found.', 404);
    if (row.state !== 'working') fail('Only a working run can report progress.', 409);
    const plan = [...steps(attemptId)].reverse().find(step => step.kind === 'plan');
    if (!plan) fail('Report a plan before reporting progress.', 409);
    if (!Number.isInteger(index) || index < 0 || index >= plan.objectives.length) fail('Progress names one of the planned objectives by index.');
    if (!['active', 'done', 'stuck'].includes(status)) fail('Progress is active, done or stuck.');
    const cleanNote = clip(note, 300);
    const seq = addStep(attemptId, 'progress', { index, status, note: cleanNote });
    const objective = plan.objectives[index];
    const activity = cleanNote || (status === 'done' ? `Finished: ${objective}` : status === 'stuck' ? `Stuck on: ${objective}` : objective);
    if (status === 'stuck') {
      const at = now();
      const item = know.workById(projectId, row.work_id);
      const reason = cleanNote || `Blocked on: ${objective}`;
      db.prepare("UPDATE symphony_attempts SET state = 'blocked', updated_at = ? WHERE id = ? AND state = 'working'").run(at, attemptId);
      db.prepare('INSERT OR IGNORE INTO symphony_attempt_events(attempt_id, event_id, kind, thread_id, turn_id, created_at) VALUES (?, ?, ?, NULL, NULL, ?)')
        .run(attemptId, `objective-stuck-${seq}`, 'error', at);
      know.appendLog(row.work_id, `Blocked: ${reason}`, { state: 'ready', context: { ...(item?.context || {}), batch: undefined,
        executionBlock: { code: 'objective-blocked', reason, recovery: 'retry' },
        run: { ...(item?.context?.run || {}), phases: plan.objectives, phase: index, activity, finishedAt: at, done: false } } },
        { by: { kind: 'agent', id: row.profile_id } });
      return { attemptId, seq, terminal: true, reason };
    }
    live(projectId, row.work_id, run => ({ ...run, phases: plan.objectives, phase: status === 'done' ? Math.min(index + 1, plan.objectives.length - 1) : index, activity }));
    return { attemptId, seq, terminal: false };
  }
  function live(projectId, workId, change) {
    const item = know.workById(projectId, workId);
    if (item?.state === 'claimed') know.setWorkContext(workId, { ...(item.context || {}), run: change(item.context?.run || {}) });
  }

  // WI-6: the evidence a submission names for each criterion. The shape is checked before the submission is accepted; each
  // reference is then matched against what the run actually produced, and anything unmatched is shown as such, never hidden.
  function checkEvidence(projectId, attemptId, evidence) {
    if (evidence === undefined || evidence === null) return [];
    if (!Array.isArray(evidence) || evidence.length > 40) fail('Evidence is a list of at most forty items.');
    const row = db.prepare('SELECT bundle_digest FROM symphony_attempts WHERE id = ? AND project_id = ?').get(attemptId, projectId);
    if (!row) fail('Attempt not found.', 404);
    const criteria = parse(db.prepare('SELECT content_json FROM symphony_bundles WHERE digest = ?').get(row.bundle_digest)?.content_json, {})?.work?.checks || [];
    return evidence.map(entry => {
      const criterion = Number(entry?.criterion);
      if (!Number.isInteger(criterion) || !criteria[criterion]) fail('Evidence names a criterion this run was given, by index.');
      if (!['change', 'test', 'try'].includes(entry?.type)) fail('Evidence is a change, a test or a thing to try. Aludel adds its own checks.');
      const ref = clip(entry?.ref, 300);
      if (!ref) fail('Evidence needs a reference.');
      return { criterion, type: entry.type, ref, note: clip(entry?.note, 300) };
    });
  }
  function recordEvidence(attemptId, evidence) { if (evidence.length) addStep(attemptId, 'evidence', { items: evidence }); }
  function resolveEvidence(steps, changes, candidate) {
    const items = [...steps].reverse().find(step => step.kind === 'evidence')?.items || [];
    return items.map(item => {
      if (item.type === 'change') {
        const change = changes.find(entry => entry.id === item.ref || entry.name === item.ref || entry.kind === item.ref || entry.name.endsWith(item.ref));
        return { ...item, found: Boolean(change), target: change ? `change:${change.id}` : null, label: change?.name || item.ref };
      }
      if (item.type === 'test') {
        const index = (candidate?.checks || []).findIndex(check => check.name === item.ref);
        const check = candidate?.checks?.[index];
        return { ...item, found: Boolean(check), target: check ? `test:${index}` : null, label: item.ref, result: check?.status || null, independent: check ? check.source !== 'agent-report' : false };
      }
      return { ...item, found: Boolean(candidate), target: candidate ? 'preview' : null, label: item.ref };
    });
  }

  // Numbered steps on a run.
  function addStep(attemptId, kind, payload) {
    const seq = (db.prepare('SELECT max(seq) AS n FROM work_run_steps WHERE attempt_id = ?').get(attemptId)?.n || 0) + 1;
    db.prepare('INSERT INTO work_run_steps VALUES (?, ?, ?, ?, ?)').run(attemptId, seq, kind, JSON.stringify(payload), now());
    return seq;
  }

  return { list, runFor, saveReview, assertSignable, reviewNotes, recordSignature, sign, startPerson, submitPerson, stopPerson, reportPlan, reportProgress, checkEvidence, recordEvidence, addStep, steps };
}
