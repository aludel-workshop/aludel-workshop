import { initLayerSource, layerReview, layerBinding, layerBranch, submitLayerBranch, prepareLayerReview, assertLayerReviewCurrent, mergeLayerBranch, settleLayerCheckout, undoLayerMerge } from './layer-source.mjs';
import { packageAt } from './layer-package.mjs';
import { claimGate, claimProof, reviewInputPath, taskClaims } from './journeys.mjs';
import { reviewInputs } from './review-previews.mjs';
import { layerInstanceId } from './layer-contract.mjs';
import { randomUUID } from 'node:crypto';
import { followUpsForAttempt, requireElevated } from './layer-scope.mjs';

// WORK-ITEM-UX-01: a work item's runs. A run is one Symphony attempt that a worker actually started. It is read from the
// attempt, the task snapshot pinned in its Go bundle, and the outputs it submitted. Each run is reviewed and signed on its
// own record, so a later run never overwrites what an earlier one received, produced or was told.

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const clip = (value, max) => String(value ?? '').replace(/\s+\n/g, '\n').trim().slice(0, max);

export function initWorkRuns(db) {
  initLayerSource(db);
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
  CREATE TABLE IF NOT EXISTS work_person_run_steps (
    attempt_id TEXT NOT NULL REFERENCES work_person_runs(id), seq INTEGER NOT NULL, kind TEXT NOT NULL,
    payload_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(attempt_id, seq)
  );
  CREATE TABLE IF NOT EXISTS work_person_run_reviews (
    run_id TEXT PRIMARY KEY REFERENCES work_person_runs(id), project_id TEXT NOT NULL, work_id TEXT NOT NULL,
    verdicts_json TEXT NOT NULL DEFAULT '{}', flags_json TEXT NOT NULL DEFAULT '{}',
    outcome TEXT, comment TEXT, signed_by TEXT, signed_at TEXT, updated_at TEXT NOT NULL
  );`);
  // JOURNEYS-01 J4: a person states why a claim isn't proven yet when submitting over it; the reviewer reads it first.
  if (!db.prepare('PRAGMA table_info(work_person_runs)').all().some(column => column.name === 'reasons_json')) db.exec("ALTER TABLE work_person_runs ADD COLUMN reasons_json TEXT NOT NULL DEFAULT '{}'");
  // JOURNEYS-01 J4: saved verdicts are keyed by claim ID. Runs reviewed before J4 kept them by criterion position, and their
  // pinned criteria read as `note-<position + 1>` (claimAt), so a position key moves to that ID. Runs once per review.
  for (const [table, key] of [['work_run_reviews', 'attempt_id'], ['work_person_run_reviews', 'run_id']]) {
    for (const row of db.prepare(`SELECT ${key} AS id, verdicts_json FROM ${table}`).all()) {
      const verdicts = parse(row.verdicts_json, {});
      if (!Object.keys(verdicts).some(name => /^\d+$/.test(name))) continue;
      const keyed = Object.fromEntries(Object.entries(verdicts).map(([name, verdict]) => [/^\d+$/.test(name) ? `note-${Number(name) + 1}` : name, verdict]));
      db.prepare(`UPDATE ${table} SET verdicts_json = ? WHERE ${key} = ?`).run(JSON.stringify(keyed), row.id);
    }
  }
}


// Outcomes a reviewer can sign. Accepting applies the run; the others leave its changes unapplied and reopen the task.
export const signOutcomes = { accept: 'accepted', reject: 'sent', close: 'closed' };

export function workRuns({ db, know, candidates = null }) {
  const personId = id => String(id || '').startsWith('person-run-');
  const reviewTable = id => personId(id) ? ['work_person_run_reviews', 'run_id'] : ['work_run_reviews', 'attempt_id'];
  const reviewRow = id => { const [table, key] = reviewTable(id); return db.prepare(`SELECT * FROM ${table} WHERE ${key} = ?`).get(id); };
  const events = attemptId => db.prepare('SELECT kind, created_at AS at FROM symphony_attempt_events WHERE attempt_id = ? ORDER BY created_at').all(attemptId);
  const stepsTable = attemptId => personId(attemptId) ? 'work_person_run_steps' : 'work_run_steps';
  const steps = attemptId => db.prepare(`SELECT seq, kind, payload_json, created_at FROM ${stepsTable(attemptId)} WHERE attempt_id = ? ORDER BY seq`).all(attemptId)
    .map(row => ({ seq: row.seq, kind: row.kind, at: row.created_at, ...parse(row.payload_json, {}) }));
  const layerName = (projectId, key) => db.prepare('SELECT name FROM layer_definitions WHERE project_id = ? AND layer_key = ?').get(projectId, key)?.name || key;
  const sectionName = key => ({ problem: 'Problem', audience: 'Audience', value: 'Value', differentiators: 'Differentiators', scope: 'Scope', constraints: 'Constraints' })[key]
    || String(key || 'Brief').replace(/^./, first => first.toUpperCase());

  // A run started once a worker registered a workspace or reserved a turn; authorizations a worker never picked up stay in Activity.
  const started = row => row.runs_started > 0 || row.workspace_path || ['working', 'submitted'].includes(row.state);

  // What the run proposed, as one row per changed thing. Nothing here is applied until the run is accepted.
  function changesOf(projectId, row, bundle) {
    const changes = [];
    const integration = layerReview(db, projectId, row.id);
    if (integration && db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'layer_review_builds'").get()) { const build = db.prepare('SELECT checks_json FROM layer_review_builds WHERE integration_id = ?').get(integration.id); if (build) integration.tests.push(...JSON.parse(build.checks_json)); }
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
        for (const file of (integration || content.source)?.files || []) changes.push({ id: `${proposal.id}:src:${file.path}`, kind: 'source', icon: file.ownerReview ? 'code' : 'description',
          name: `${layerName(projectId, content.layer)} repository › ${file.path}`, op: file.status === 'added' ? 'created' : file.status === 'deleted' ? 'removed' : 'modified',
          size: `+${file.added} −${file.removed}`, diff: file.diff, ownerReview: file.ownerReview, commit: (integration || content.source).commit });
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
    // LAYER-BASE-01 B5: the run's work branch of the layer repository and the tests the agent ran on it in its sandbox.
    const layerSource = proposal ? parse(proposal.content_json, {}).source || null : null;
    return { changes, integration: integration && { ...integration, appRepository: Boolean(bundle.layerPackage?.root), appChanged: Boolean(bundle.layerPackage?.root) && integration.files.some(file => (reviewInputPath(file.path) || !file.path.startsWith(bundle.layerPackage.root)) && !/^(?:docs\/|README\.md$|AGENTS\.md$|ARCHITECTURE\.md$)/.test(file.path)), current: layerBinding(db, projectId, bundle.guidance.layerScope.key).commit === integration.base }, layerSource: layerSource && { branch: layerSource.branch, commit: layerSource.commit, base: layerSource.base,
        tests: (layerSource.tests || []).map(test => ({ ...test, source: 'agent-report' })) }, followUps: proposal ? followUpsForAttempt(db, row.id).map(entry => ({ ...entry, layerName: layerName(projectId, entry.layer),
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
          criteria: taskClaims(work.checks),
          targets: (work.targets || []).map(target => ({ id: target.id, label: target.label, kind: target.kind })),
          carried: (work.context?.feedback || []).map(note => ({ ...(note.claim ? { claim: note.claim } : {}), check: note.check, note: note.note, by: note.by })),
          carriedComment: work.context?.reviewComment || null,
        },
        live: live ? { phases: live.phases || [], phase: live.phase ?? null, activity: live.activity || '', model: live.model || null, usage: live.usage || null } : null,
        steps: planned.filter(step => step.kind !== 'evidence'),
        evidence: resolveEvidence(planned, outputs.changes, outputs.candidate, outputs.layerSource),
        reasons: {},
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
      task.criteria = taskClaims(task.criteria);
      const review = reviewRow(row.id);
      const source = layerBranch(db, row.id), integrated = layerReview(db, projectId, row.id);
      if (integrated && db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'layer_review_builds'").get()) { const build = db.prepare('SELECT checks_json FROM layer_review_builds WHERE integration_id = ?').get(integrated.id); if (build) integrated.tests.push(...JSON.parse(build.checks_json)); }
      const repository = task.layerRepository;
      const sourceChanges = (integrated || source)?.files.map(file => ({ id: `${row.id}:src:${file.path}`, kind: 'source', icon: file.ownerReview ? 'code' : 'description', name: file.path, op: file.status === 'added' ? 'created' : file.status === 'deleted' ? 'removed' : 'modified', size: `+${file.added} −${file.removed}`, diff: file.diff, ownerReview: file.ownerReview, commit: (integrated || source).commit })) || [];
      return {
        id: row.id, batchId: null, state: review?.outcome || row.state,
        performer: { kind: 'person', id: row.performer_id, label: row.performer_name, model: null, effort: null },
        startedAt: row.started_at, finishedAt: row.submitted_at, turns: { used: 0, limit: 0 }, task,
        live: null, steps: steps(row.id), evidence: parse(row.evidence_json, []).map(legacyEvidence), reasons: parse(row.reasons_json, {}), blockReason: null,
        layerSource: source && { ...source, tests: source.tests.map(check => ({ ...check, source: 'person-report' })) },
        integration: integrated && { ...integrated, appRepository: Boolean(repository?.root), appChanged: appChanged(integrated, repository?.root), current: layerBinding(db, projectId, repository.key).commit === integrated.base },
        changes: [...parse(row.changes_json, []), ...sourceChanges], candidate: null, proposalId: null, reportId: null, summary: row.summary || null,
        review: { verdicts: parse(review?.verdicts_json, {}), flags: parse(review?.flags_json, {}),
          outcome: review?.outcome || null, comment: review?.comment || null, signedBy: review?.signed_by || null, signedAt: review?.signed_at || null },
      };
    });
    return [...agentRuns, ...people].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((run, index) => ({ ...run, number: index + 1, ...proven(projectId, run) }));
  }

  // JOURNEYS-01 J4: each claim's automated proof on the run's reviewed build, and the claims that stop acceptance. Journey
  // results are the step tests J3 ran on that exact build; the journeys are read from the same commit.
  function proven(projectId, run) {
    const claims = run.task.criteria || [];
    if (!claims.some(claim => claim.kind === 'journey' || claim.covers === 'journeys')) return { proofs: {}, gate: [] };
    let built = {};
    const integration = run.integration;
    if (integration && db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'layer_review_journeys'").get()) {
      const walked = db.prepare('SELECT steps_json FROM layer_review_journeys WHERE integration_id = ? AND commit_sha = ?').get(integration.id, integration.commit);
      if (walked) {
        let journeys = null, unreadable = null;
        const key = db.prepare('SELECT layer_key FROM layer_review_integrations WHERE id = ?').get(integration.id)?.layer_key;
        try { journeys = reviewInputs(layerBinding(db, projectId, key).repo, integration.commit)?.journeys || null; } catch (error) { unreadable = error.message; }
        built = { journeys, results: parse(walked.steps_json, []), unreadable };
      }
    }
    const proofs = Object.fromEntries(claims.map(claim => [claim.id, claimProof(claim, built, claims)]).filter(([, proof]) => proof)
      .map(([id, proof]) => [id, built.unreadable && proof.status === 'not-run' ? { ...proof, detail: `The reviewed build's journeys can't be read: ${built.unreadable}` } : proof]));
    return { proofs, gate: claimGate(claims, proofs, run.performer.kind === 'person' ? run.reasons : {}) };
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
      // A claim by ID; a position is resolved to the claim it names now, and the verdict is kept by claim ID.
      const claim = input.verdict.claim !== undefined ? run.task.criteria.find(entry => entry.id === input.verdict.claim)
        : Number.isInteger(input.verdict.index) ? run.task.criteria[input.verdict.index] : null;
      if (!claim) fail('Unknown claim.');
      const value = input.verdict.value ?? null;
      if (![null, 'accept', 'reject', 'skip'].includes(value)) fail('A claim is accepted, rejected or skipped.');
      if (value === null) delete verdicts[claim.id]; else verdicts[claim.id] = { value, note: clip(input.verdict.note ?? verdicts[claim.id]?.note, 1000) };
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
      .map(([id, verdict]) => ({ claim: id, check: run.task.criteria.find(claim => claim.id === id)?.text || id, note: verdict.note }));
    const changes = Object.entries(run.review.flags).map(([id, note]) => ({ check: `Change: ${run.changes.find(change => change.id === id)?.name || id}`, note }));
    // A claimed step that isn't proven goes back as feedback too, with what the test reported, unless the reviewer flagged it.
    const steps = (run.gate || []).filter(entry => !run.review.verdicts[entry.claim] || run.review.verdicts[entry.claim].value !== 'reject').map(entry => ({ claim: entry.claim, check: entry.text,
      note: `Not proven on the reviewed build (${entry.status}): ${(run.proofs[entry.claim]?.steps || []).filter(step => step.status !== 'passed').map(step => `${step.id} ${step.status}${step.detail ? ` (${step.detail})` : ''}`).join('; ') || run.proofs[entry.claim]?.detail || 'no step results'}`.slice(0, 1000) }));
    return [...criteria, ...steps, ...changes];
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
      // JOURNEYS-01 J4: a claim whose automated proof isn't passing stops acceptance. An agent run goes back; a person who
      // stated why when submitting may be accepted over it.
      const blocking = run.gate.filter(entry => run.performer.kind !== 'person' || !entry.reason);
      if (blocking.length) fail(`${blocking.map(entry => `“${entry.text}” is ${entry.status === 'not-run' ? 'not proven yet: build the review to run its step tests' : `not proven (${entry.status})`}`).join('; ')}. ${run.performer.kind === 'person' ? 'Send it back, or ask the person to state why when they submit.' : 'Send it back.'}`, 409);
      // The signature stands for every claim; the action boundaries still require each check to read as accepted.
      const item = know.workById(projectId, workId);
      item.checks.forEach(check => { if (check.verdict !== 'accept') know.updateWork(user, projectId, workId, { verdict: { claim: check.id, value: 'accept' } }); });
      await handlers.accept(run);
    } else {
      if (outcome === 'reject' && handlers.reject) await handlers.reject(run);
      know.updateWork(user, projectId, workId, { reopen: { feedback: reviewNotes(run), comment, outcome } });
    }
    return recordSignature(user, projectId, workId, attemptId, outcome, comment);
  }

  const taskSnapshot = item => ({
    title: item.title, request: item.context?.suggestion || '', action: item.action,
    criteria: taskClaims(item.checks),
    targets: item.targets.map(target => ({ id: target.id, label: target.label, kind: target.kind })),
    carried: (item.context?.feedback || []).map(note => ({ ...(note.claim ? { claim: note.claim } : {}), check: note.check, note: note.note, by: note.by })),
    carriedComment: item.context?.reviewComment || null,
  });
  const personRun = (projectId, workId, runId) => db.prepare('SELECT * FROM work_person_runs WHERE id = ? AND project_id = ? AND work_id = ?').get(runId, projectId, workId);
  function startPerson(user, projectId, workId) {
    const item = know.workById(projectId, workId);
    if (!item) fail('Work item not found.', 404);
    if (item.assignee?.kind !== 'person' || item.assignee.id !== user.id) fail('Only the assigned person can start this work.', 403);
    if (item.status !== 'staged') fail('Stage this item before starting work.', 409);
    if (db.prepare("SELECT 1 FROM work_person_runs WHERE project_id = ? AND work_id = ? AND state IN ('working', 'review')").get(projectId, workId)) fail('This item already has an open person run.', 409);
    const task = taskSnapshot(item);
    if (item.scope === 'layer') { const binding = layerBinding(db, projectId, item.layer); task.layerRepository = { key: item.layer, base: binding.commit, root: packageAt(binding.repo, binding.commit, item.layer).root }; }
    const id = `person-run-${randomUUID()}`, at = now();
    db.prepare("INSERT INTO work_person_runs(id, project_id, work_id, performer_id, performer_name, task_json, state, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'working', ?, ?)")
      .run(id, projectId, workId, user.id, user.name, JSON.stringify(task), at, at);
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
    const claims = taskClaims(task.criteria);
    const evidence = (Array.isArray(input.evidence) ? input.evidence : []).map(entry => {
      const claim = evidenceClaim(claims, entry, 'Evidence names a claim this run was given.');
      const note = clip(entry?.note, 500);
      if (!note) fail('Say what the reviewer should check for each evidence item.');
      const ref = clip(entry?.ref, 300), change = ref && changes.find(value => value.id === ref);
      if (ref && !change) fail('Claim evidence refers to a change outside this review packet.');
      return { claim: claim.id, ...stepOf(claim, entry), type: change ? 'change' : 'note', ref: ref || claim.id, note,
        found: true, target: change ? `change:${change.id}` : null, label: change?.name || 'Performer note' };
    });
    // Why a claim may go to review unproven, said up front; the reviewer sees it with the failure.
    const reasons = {};
    for (const [id, value] of Object.entries(input.reasons && typeof input.reasons === 'object' && !Array.isArray(input.reasons) ? input.reasons : {})) {
      const claim = claims.find(entry => entry.id === id);
      if (!claim || !(claim.kind === 'journey' || claim.covers === 'journeys')) fail('A reason names a claim with step tests that this run was given.');
      const reason = clip(value, 500);
      if (reason) reasons[id] = reason;
    }
    if (input.source) {
      if (!task.layerRepository) fail('This run did not pin a layer repository.', 409);
      if (changes.length) fail('Submit repository changes separately from already-applied record changes.', 409);
      submitLayerBranch(db, { projectId, key: task.layerRepository.key, attemptId: runId, base: task.layerRepository.base, workRef: know.workById(projectId, workId).ref, branch: input.source.branch, commit: input.source.commit, tests: input.source.tests || [] });
    }
    const at = now();
    db.prepare("UPDATE work_person_runs SET changes_json = ?, evidence_json = ?, reasons_json = ?, summary = ?, state = 'review', submitted_at = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(changes), JSON.stringify(evidence), JSON.stringify(reasons), summary, at, at, runId);
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

  const appChanged = (review, root) => Boolean(root) && review.files.some(file => (reviewInputPath(file.path) || !file.path.startsWith(root)) && !/^(?:docs\/|README\.md$|AGENTS\.md$|ARCHITECTURE\.md$)/.test(file.path));
  function personRepository(user, projectId, workId, runId) {
    const row = personRun(projectId, workId, runId), item = know.workById(projectId, workId);
    if (!row || row.state !== 'review' || item?.state !== 'review' || item.context?.personRun !== runId) fail('This person run is not waiting for review.', 409);
    requireElevated(db, user, projectId, item.layer, 'review this repository');
    const task = parse(row.task_json, {}), source = layerBranch(db, runId);
    if (!source || !task.layerRepository || source.base !== task.layerRepository.base) fail('This run has no pinned repository submission.', 409);
    const instance = layerInstanceId(db, projectId, item.layer);
    const recordsOf = kind => db.prepare('SELECT id, data_json FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id = ?').all(projectId, kind, instance).map(record => ({ id: record.id, data: JSON.parse(record.data_json) }));
    return { item, task, source, recordsOf };
  }
  function preparePersonReview(user, projectId, workId, runId, force = false) {
    const { item, source, recordsOf } = personRepository(user, projectId, workId, runId);
    const before = layerReview(db, projectId, runId), run = runFor(projectId, workId, runId);
    const integration = prepareLayerReview(db, { projectId, key: item.layer, attemptId: runId, source, catalogs: know.catalogs, recordsOf, force });
    if (before?.id !== integration.id) {
      addStep(runId, 'review-refresh', { previousIntegration: before?.id || null, integration: integration.id, previousReview: run.review });
      db.prepare("UPDATE work_person_run_reviews SET verdicts_json = '{}', flags_json = '{}' WHERE run_id = ?").run(runId);
    }
    return integration;
  }
  function acceptPersonRepository(user, projectId, workId, runId, integrationId, assertBuilt) {
    const { item, task, source, recordsOf } = personRepository(user, projectId, workId, runId);
    const review = assertLayerReviewCurrent(db, projectId, item.layer, layerReview(db, projectId, runId), source);
    if (review.id !== integrationId) fail('The review revision changed. Refresh before accepting.', 409);
    if (appChanged(review, task.layerRepository.root)) { if (!assertBuilt) fail('Combined build checks are required.', 409); assertBuilt(review.id); }
    let merge;
    db.exec('BEGIN IMMEDIATE');
    try {
      merge = mergeLayerBranch(db, { projectId, key: item.layer, source: review, reviewer: user.name, workId, workRef: item.ref, catalogs: know.catalogs, recordsOf });
      know.updateWork(user, projectId, workId, { state: 'done' });
      db.exec('COMMIT');
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); undoLayerMerge(merge); throw error; }
    settleLayerCheckout(merge);
    return merge;
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
    const checks = parse(db.prepare('SELECT content_json FROM symphony_bundles WHERE digest = ?').get(row.bundle_digest)?.content_json, {})?.work?.checks || [];
    // A run pinned before J4 has no claim IDs in its task; its agent was told to name criteria by position.
    const pinnedBefore = checks.length > 0 && !checks.some(check => check?.id);
    const claims = taskClaims(checks);
    return evidence.map(entry => {
      if (!pinnedBefore && entry?.claim === undefined) fail('Evidence names a claim this run was given, by its ID.');
      const claim = evidenceClaim(claims, entry, 'Evidence names a claim this run was given, by its ID.');
      if (!['change', 'test', 'try'].includes(entry?.type)) fail('Evidence is a change, a test or a thing to try. Aludel adds its own checks.');
      const ref = clip(entry?.ref, 300);
      if (!ref) fail('Evidence needs a reference.');
      return { claim: claim.id, ...stepOf(claim, entry), type: entry.type, ref, note: clip(entry?.note, 300) };
    });
  }
  // The claim an evidence item names: by ID, or for a run pinned before J4 by criterion position. A step names one of the
  // steps a journey claim makes true.
  function evidenceClaim(claims, entry, message) {
    const claim = entry?.claim !== undefined ? claims.find(value => value.id === entry.claim)
      : Number.isInteger(Number(entry?.criterion)) && entry?.criterion !== null ? claims[Number(entry.criterion)] : null;
    if (!claim) fail(message);
    return claim;
  }
  function stepOf(claim, entry) {
    if (entry?.step === undefined || entry?.step === null) return {};
    if (claim.kind !== 'journey' || !claim.steps.includes(entry.step)) fail(`Evidence for ${claim.id} names a step the claim makes true.`);
    return { step: entry.step };
  }
  function recordEvidence(attemptId, evidence) { if (evidence.length) addStep(attemptId, 'evidence', { items: evidence }); }
  // A layer run's evidence names a record by its ID or title, a repository file by its path, and a test by the name it
  // reported to aludel_layer_commit; tests are the candidate's checks, or else the layer branch's reported tests.
  function resolveEvidence(steps, changes, candidate, layerSource = null) {
    const items = ([...steps].reverse().find(step => step.kind === 'evidence')?.items || []).map(legacyEvidence);
    const tests = candidate?.checks?.length ? candidate.checks : layerSource?.tests || [];
    return items.map(item => {
      if (item.type === 'change') {
        const change = changes.find(entry => entry.id === item.ref || entry.id.endsWith(`:${item.ref}`) || entry.name === item.ref || entry.kind === item.ref || entry.name.endsWith(item.ref));
        return { ...item, found: Boolean(change), target: change ? `change:${change.id}` : null, label: change?.name || item.ref };
      }
      if (item.type === 'test') {
        const index = tests.findIndex(check => check.name === item.ref);
        const check = tests[index];
        return { ...item, found: Boolean(check), target: check ? `test:${index}` : null, label: item.ref, result: check?.status || null, independent: check ? check.source !== 'agent-report' : false };
      }
      return { ...item, found: Boolean(candidate), target: candidate ? 'preview' : null, label: item.ref };
    });
  }

  // Evidence recorded before J4 named its criterion by position; that position is the claim `note-<position + 1>`.
  function legacyEvidence(item) {
    if (item.claim || !Number.isInteger(item.criterion)) return item;
    const { criterion, ...rest } = item;
    return { claim: `note-${criterion + 1}`, ...rest };
  }

  // Numbered steps on a run.
  function addStep(attemptId, kind, payload) {
    const seq = (db.prepare(`SELECT max(seq) AS n FROM ${stepsTable(attemptId)} WHERE attempt_id = ?`).get(attemptId)?.n || 0) + 1;
    db.prepare(`INSERT INTO ${stepsTable(attemptId)} VALUES (?, ?, ?, ?, ?)`).run(attemptId, seq, kind, JSON.stringify(payload), now());
    return seq;
  }

  return { list, runFor, preparePersonReview, acceptPersonRepository, saveReview, assertSignable, reviewNotes, recordSignature, sign, startPerson, submitPerson, stopPerson, reportPlan, reportProgress, checkEvidence, recordEvidence, addStep, steps };
}
