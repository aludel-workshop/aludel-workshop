import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns } from '../server/agent-runs.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initCodeUnits } from '../server/code-units.mjs';
import { journeyWork } from '../server/journey-work.mjs';
import { initLayerSource } from '../server/layer-source.mjs';
import { checkFollowUps, decideFollowUp, initLayerScope, recordFollowUps } from '../server/layer-scope.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initSymphonyWorker, symphonyWorker } from '../server/symphony-worker.mjs';
import { initWorkRuns, workRuns } from '../server/work-runs.mjs';
import { initWorkflow } from '../server/workflow.mjs';

// WORK-ITEM-UX-01 WI-1/WI-3: runs are started attempts with their own task snapshot, outputs, review and signature.
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-runs-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db); initWorkRuns(db);
  const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const owner = createUser(db, { email: 'owner@example.com', name: 'Owner', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Proposal Test', pitch: 'A disposable product.' });
  const projectId = flows.claimDraft(token, owner, owner).project.id;
  know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
  know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
  const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
  mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q');
  writeFileSync(join(workspace, 'README.md'), 'Pinned base\n'); git(workspace, 'add', '.');
  git(workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
  const profile = know.defaultProfile(projectId);
  know.update(projectId, profile.id, { model: '', effort: 'medium' }, { rationale: 'Legacy profile-scoped worker fixture has no per-turn override signal' });
  const workerRoot = join(root, 'worker'); mkdirSync(workerRoot);
  const worker = symphonyWorker({ db, know, workspaceRoot: workerRoot });
  const credential = worker.issueToken(owner, projectId, profile.id).token;
  const scope = worker.authenticate('Bearer ' + credential);
  const runs = agentRuns({ db, know, secrets: openSecretStore(root), providers: catalogs.agentProviders.providers, worker, symphonyDispatch: true,
    callModel: async () => { throw new Error('Legacy model caller must never run'); } });
  const start = (action, targets = [], question = null, extra = {}) => {
    const work = know.createWork(projectId, { action, title: `Test ${action}`, assignee: { kind: 'agent', id: profile.id }, targets,
      checks: ['The proposed output is accurate'], ...(question ? { question } : {}), ...extra }, owner.name);
    if (work.state === 'suggested') know.updateWork(owner, projectId, work.id, { state: 'ready' });
    runs.stage(owner, projectId, work.id);
    const batch = runs.view(projectId).find(value => value.state === 'draft');
    assert.equal(runs.start(owner, projectId, batch.id).job, null);
    const issue = worker.issues(scope, { states: ['Ready'] }).issues.find(value => value.native_ref.work_id === work.id);
    assert.ok(issue, 'Symphony poll returns the Go-pinned item');
    const card = worker.taskOpen(scope, issue.native_ref.bundle_digest);
    const clone = join(workerRoot, issue.identifier);
    git(root, 'clone', workspace, clone); git(clone, 'checkout', '--detach', issue.native_ref.repository_commit);
    writeFileSync(join(clone, '.git', 'aludel-base'), issue.native_ref.repository_commit + '\n');
    worker.registerWorkspace(scope, { attemptId: issue.native_ref.attempt_id, path: clone });
    worker.reserveRun(scope, { attemptId: issue.native_ref.attempt_id });
    return { work, batch, issue, card, clone };
  };
  // Go again on the same item: a new batch, a new pinned bundle and a new attempt that a worker picks up.
  const relaunch = (work, { pickUp = true } = {}) => {
    runs.stage(owner, projectId, work.id);
    const batch = runs.view(projectId).find(value => value.state === 'draft');
    runs.start(owner, projectId, batch.id);
    const issue = worker.issues(scope, { states: ['Ready'] }).issues.find(value => value.native_ref.work_id === work.id);
    if (pickUp) {
      const clone = join(workerRoot, issue.identifier);
      rmSync(clone, { recursive: true, force: true });
      git(root, 'clone', workspace, clone); git(clone, 'checkout', '--detach', issue.native_ref.repository_commit);
      writeFileSync(join(clone, '.git', 'aludel-base'), issue.native_ref.repository_commit + '\n');
      worker.registerWorkspace(scope, { attemptId: issue.native_ref.attempt_id, path: clone });
      worker.reserveRun(scope, { attemptId: issue.native_ref.attempt_id });
    }
    return { batch, issue };
  };
  const history = workRuns({ db, know });
  return { root, db, know, owner, projectId, profile, worker, scope, credential, runs, start, relaunch, history, workspace,
    close: () => { db.close(); rmSync(root, { recursive: true, force: true }); } };
}

const claim = text => ({ summary: 'A value claim.', content: { section: 'value', text, note: 'From the request.', basis: 'The request.' }, usedInputs: [] });
const handlers = f => ({
  accept: run => { f.runs.acceptBrief(f.owner, f.projectId, run.work, run.proposalId); },
  reject: run => { f.runs.rejectBrief(f.projectId, run.work, run.proposalId); f.worker.rejectProposal(f.projectId, run.work, run.proposalId); },
});
const withWork = (h, workId) => ({ accept: run => h.accept({ ...run, work: workId }), reject: run => h.reject({ ...run, work: workId }) });

test('an authorization no worker picked up is not a run', () => {
  const f = fixture();
  try {
    const work = f.know.createWork(f.projectId, { action: 'product.brief', title: 'Value', assignee: { kind: 'agent', id: f.profile.id }, checks: ['Short'] }, f.owner.name);
    if (work.state === 'suggested') f.know.updateWork(f.owner, f.projectId, work.id, { state: 'ready' });
    f.relaunch(work, { pickUp: false });
    assert.deepEqual(f.history.list(f.projectId, work.id), []);
  } finally { f.close(); }
});

test('each run keeps its own task; a signed send-back carries flags and comment into the next run', async () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('product.brief');
    f.know.updateWork(f.owner, f.projectId, work.id, {}); // no-op
    f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal: claim('A pet in the corner of your screen.') });
    let [first] = f.history.list(f.projectId, work.id);
    assert.equal(first.number, 1);
    assert.equal(first.state, 'review');
    assert.deepEqual(first.task.criteria.map(c => c.text), ['The proposed output is accurate']);
    assert.equal(first.changes[0].kind, 'claim');
    assert.equal(first.changes[0].op, 'created');
    assert.throws(() => f.know.updateWork(f.owner, f.projectId, work.id, { task: { criteria: ['Changed mid-review'] } }), /locked/);
    assert.throws(() => f.history.saveReview(f.projectId, work.id, first.id, { flag: { id: 'nope' } }), /Unknown change/);
    f.history.saveReview(f.projectId, work.id, first.id, { flag: { id: first.changes[0].id, note: 'Adds a second value claim' } });
    await assert.rejects(() => f.history.sign(f.owner, f.projectId, work.id, first.id, { outcome: 'close' }, withWork(handlers(f), work.id)), /Accept or send back/);
    await f.history.sign(f.owner, f.projectId, work.id, first.id, { outcome: 'reject', comment: 'Revise the existing claim.' }, withWork(handlers(f), work.id));
    const reopened = f.know.workById(f.projectId, work.id);
    assert.equal(reopened.state, 'ready');
    assert.equal(reopened.context.reviewComment, 'Revise the existing claim.');
    assert.match(reopened.context.feedback[0].check, /Change: Vision › Brief › Value/);
    assert.equal(f.db.prepare('SELECT state FROM vision_proposals WHERE id = ?').get(first.proposalId).state, 'rejected');
    [first] = f.history.list(f.projectId, work.id);
    assert.equal(first.state, 'sent');
    assert.equal(first.review.signedBy, f.owner.name);
    await assert.rejects(() => f.history.sign(f.owner, f.projectId, work.id, first.id, { outcome: 'reject' }, {}), /already signed/);

    // The reviewer tightens the task, then Go pins it for run 2.
    f.know.updateWork(f.owner, f.projectId, work.id, { task: { criteria: ['The proposed output is accurate', 'It replaces the existing claim'] } });
    const second = f.relaunch(f.know.workById(f.projectId, work.id));
    assert.throws(() => f.know.updateWork(f.owner, f.projectId, work.id, { task: { request: 'Too late' } }), /pinned|locked/);
    f.worker.submitProposal(f.scope, { attemptId: second.issue.native_ref.attempt_id, proposal: claim('A small interactive pet in the corner of your screen.') });
    const [one, two] = f.history.list(f.projectId, work.id);
    assert.deepEqual(one.task.criteria.map(c => c.text), ['The proposed output is accurate']);
    assert.deepEqual(two.task.criteria.map(c => c.text), ['The proposed output is accurate', 'It replaces the existing claim']);
    assert.equal(two.task.carriedComment, 'Revise the existing claim.');
    assert.equal(two.task.carried[0].note, 'Adds a second value claim');
    assert.equal(two.state, 'review');

    // Accepting signs for every criterion and applies the claim through the Vision boundary.
    const before = f.know.briefRevision(f.projectId);
    await f.history.sign(f.owner, f.projectId, work.id, two.id, { outcome: 'accept', comment: 'Good.' }, withWork(handlers(f), work.id));
    assert.equal(f.know.workById(f.projectId, work.id).state, 'done');
    assert.equal(f.know.briefRevision(f.projectId), before + 1);
    assert.deepEqual(f.history.list(f.projectId, work.id).map(run => run.state), ['sent', 'accepted']);
  } finally { f.close(); }
});

test('a failed run can only be closed, which reopens the task', async () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('product.brief');
    f.worker.appendEvent(f.scope, { attemptId: issue.native_ref.attempt_id, eventId: 'boom', kind: 'error', message: 'Preview port in use.' });
    let [run] = f.history.list(f.projectId, work.id);
    assert.equal(run.state, 'failed');
    assert.equal(run.blockReason, 'Preview port in use.');
    await assert.rejects(() => f.history.sign(f.owner, f.projectId, work.id, run.id, { outcome: 'accept' }, {}), /isn't waiting/);
    await f.history.sign(f.owner, f.projectId, work.id, run.id, { outcome: 'close', comment: 'Stop the old preview first.' });
    [run] = f.history.list(f.projectId, work.id);
    assert.equal(run.state, 'closed');
    const item = f.know.workById(f.projectId, work.id);
    assert.equal(item.state, 'ready');
    assert.equal(item.context.executionBlock, undefined);
    assert.equal(item.context.reviewComment, 'Stop the old preview first.');
  } finally { f.close(); }
});

test('a stuck objective ends the run immediately and prevents later objectives or submission', async () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('platform.security');
    const attemptId = issue.native_ref.attempt_id;
    f.history.reportPlan(f.projectId, attemptId, ['Inspect the pinned repository', 'Run focused checks', 'Submit the report']);
    f.history.reportProgress(f.projectId, attemptId, { index: 0, status: 'active' });
    const stopped = f.history.reportProgress(f.projectId, attemptId, { index: 0, status: 'stuck', note: 'The command sandbox could not create its namespace.' });
    assert.equal(stopped.terminal, true);
    assert.equal(f.db.prepare('SELECT state FROM symphony_attempts WHERE id = ?').get(attemptId).state, 'blocked');
    assert.throws(() => f.history.reportProgress(f.projectId, attemptId, { index: 1, status: 'active' }), /Only a working run/);
    assert.throws(() => f.worker.submitAudit(f.scope, { attemptId, report: {
      summary: 'The repository could not be inspected.', findings: [], checks: [{ name: 'Repository inspection', status: 'skipped' }] } }), /not ready to submit/);
    const [run] = f.history.list(f.projectId, work.id);
    assert.equal(run.state, 'failed');
    assert.equal(run.blockReason, 'The command sandbox could not create its namespace.');
    assert.equal(run.steps.filter(step => step.kind === 'progress').length, 2, 'no downstream objective was recorded');
    await assert.rejects(() => f.history.sign(f.owner, f.projectId, work.id, run.id, { outcome: 'accept' }, {}), /isn't waiting/);
  } finally { f.close(); }
});

test('an older submitted diagnostic with an unresolved stuck objective remains a failed, non-acceptable run', async () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('platform.security');
    const attemptId = issue.native_ref.attempt_id;
    f.history.addStep(attemptId, 'plan', { objectives: ['Inspect the pinned repository', 'Run focused checks', 'Submit the report'] });
    f.history.addStep(attemptId, 'progress', { index: 0, status: 'stuck', note: 'Pinned repository inspection could not start.' });
    f.worker.submitAudit(f.scope, { attemptId, report: {
      summary: 'No findings are asserted because repository inspection could not start.', findings: [],
      checks: [{ name: 'Pinned source review', status: 'skipped', detail: 'The sandbox failed before execution.' }], usedInputs: [] } });
    const [run] = f.history.list(f.projectId, work.id);
    assert.equal(f.db.prepare('SELECT state FROM symphony_attempts WHERE id = ?').get(attemptId).state, 'submitted');
    assert.equal(run.state, 'failed');
    assert.equal(run.blockReason, 'Pinned repository inspection could not start.');
    assert.equal(run.changes[0].kind, 'report', 'the diagnostic report remains available for read-only review');
    await assert.rejects(() => f.history.sign(f.owner, f.projectId, work.id, run.id, { outcome: 'accept' }, {}), /isn't waiting/);
    f.know.updateWork(f.owner, f.projectId, work.id, { archive: true });
    assert.equal(f.know.workById(f.projectId, work.id), null, 'archived work leaves normal lookups');
    assert.ok(!f.know.workList(f.projectId).some(item => item.id === work.id), 'archived work leaves normal lists');
    const stored = f.db.prepare('SELECT archived_at, archived_by FROM layer_work_items WHERE id = ?').get(work.id);
    assert.ok(stored.archived_at);
    assert.equal(stored.archived_by, f.owner.name);
    assert.ok(f.db.prepare('SELECT 1 FROM symphony_reports WHERE attempt_id = ?').get(attemptId), 'diagnostic output is preserved');
    assert.ok(f.db.prepare('SELECT 1 FROM symphony_attempts WHERE id = ?').get(attemptId), 'run history is preserved');
  } finally { f.close(); }
});

test('active and genuinely reviewable work cannot be archived', () => {
  const f = fixture();
  try {
    const active = f.start('product.brief');
    assert.throws(() => f.know.updateWork(f.owner, f.projectId, active.work.id, { archive: true }), /active/);
    f.worker.submitProposal(f.scope, { attemptId: active.issue.native_ref.attempt_id, proposal: claim('A pet in the corner of your screen.') });
    assert.throws(() => f.know.updateWork(f.owner, f.projectId, active.work.id, { archive: true }), /ready for review/);
  } finally { f.close(); }
});

test('a working run reports its own plan and progress; the live run follows it', () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('product.brief');
    const attemptId = issue.native_ref.attempt_id;
    assert.equal(f.know.workById(f.projectId, work.id).context.run.activity, 'Opening the task');
    assert.throws(() => f.history.reportProgress(f.projectId, attemptId, { index: 0, status: 'active' }), /plan before/);
    assert.throws(() => f.history.reportPlan(f.projectId, attemptId, []), /one to twelve/);
    f.history.reportPlan(f.projectId, attemptId, ['Read the Brief', 'Draft the claim', 'Submit']);
    f.history.reportProgress(f.projectId, attemptId, { index: 0, status: 'done' });
    f.history.reportProgress(f.projectId, attemptId, { index: 1, status: 'active', note: 'Comparing two wordings' });
    assert.throws(() => f.history.reportProgress(f.projectId, attemptId, { index: 7, status: 'done' }), /planned objectives/);
    assert.throws(() => f.history.reportProgress(f.projectId, attemptId, { index: 1, status: 'finished' }), /active, done or stuck/);
    const live = f.know.workById(f.projectId, work.id).context.run;
    assert.deepEqual(live.phases, ['Read the Brief', 'Draft the claim', 'Submit']);
    assert.equal(live.phase, 1);
    assert.equal(live.activity, 'Comparing two wordings');
    const [run] = f.history.list(f.projectId, work.id);
    assert.deepEqual(run.steps.map(step => step.kind), ['plan', 'progress', 'progress']);
    f.worker.submitProposal(f.scope, { attemptId, proposal: claim('A pet in the corner of your screen.') });
    assert.throws(() => f.history.reportPlan(f.projectId, attemptId, ['Too late']), /Only a working run/);
  } finally { f.close(); }
});

test('evidence names a given claim by ID and a change, test or thing to try; unmatched references stay visible', () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('product.brief');
    const attemptId = issue.native_ref.attempt_id;
    const [claim0] = f.know.workById(f.projectId, work.id).checks;
    assert.equal(claim0.id, 'note-1');
    assert.throws(() => f.history.checkEvidence(f.projectId, attemptId, [{ claim: 'note-9', type: 'change', ref: 'x' }]), /claim this run was given/);
    // JOURNEYS-01 J4: a run pinned with claim IDs names them; a position is refused.
    assert.throws(() => f.history.checkEvidence(f.projectId, attemptId, [{ criterion: 0, type: 'change', ref: 'x' }]), /by its ID/);
    assert.throws(() => f.history.checkEvidence(f.projectId, attemptId, [{ claim: 'note-1', step: 'sign-up', type: 'change', ref: 'x' }]), /names a step the claim makes true/);
    assert.throws(() => f.history.checkEvidence(f.projectId, attemptId, [{ claim: 'note-1', type: 'check', ref: 'scope' }]), /Aludel adds its own checks/);
    const evidence = f.history.checkEvidence(f.projectId, attemptId, [
      { claim: 'note-1', type: 'change', ref: 'Vision › Brief › Value', note: 'One sentence' },
      { claim: 'note-1', type: 'test', ref: 'claim is short' }]);
    assert.deepEqual(evidence.map(item => item.claim), ['note-1', 'note-1']);
    f.worker.submitProposal(f.scope, { attemptId, proposal: claim('A pet in the corner of your screen.') });
    f.history.recordEvidence(attemptId, evidence);
    const [run] = f.history.list(f.projectId, work.id);
    assert.equal(run.evidence.length, 2);
    assert.equal(run.evidence[0].found, true);
    assert.equal(run.evidence[0].target, `change:${run.changes[0].id}`);
    assert.equal(run.evidence[1].found, false, 'a test the submission does not contain is shown as not found');
    // A run pinned before J4 has no claim IDs; its agent was told positions, which read as the claim the migration named.
    const digest = f.db.prepare('SELECT bundle_digest FROM symphony_attempts WHERE id = ?').get(attemptId).bundle_digest;
    const bundle = JSON.parse(f.db.prepare('SELECT content_json FROM symphony_bundles WHERE digest = ?').get(digest).content_json);
    bundle.work.checks = bundle.work.checks.map(({ id, kind, backed, ...check }) => check);
    f.db.prepare('UPDATE symphony_bundles SET content_json = ? WHERE digest = ?').run(JSON.stringify(bundle), digest);
    assert.deepEqual(f.history.checkEvidence(f.projectId, attemptId, [{ criterion: 0, type: 'change', ref: 'x' }]).map(item => item.claim), ['note-1']);
    assert.deepEqual(f.history.list(f.projectId, work.id)[0].task.criteria.map(entry => entry.id), ['note-1']);
    assert.ok(run.steps.every(step => step.kind !== 'evidence'));
  } finally { f.close(); }
});

test('answering an agent question can amend the next run without changing this run snapshot', async () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('product.brief');
    const original = f.history.runFor(f.projectId, work.id, issue.native_ref.attempt_id);
    f.worker.askQuestion(f.scope, { attemptId: issue.native_ref.attempt_id,
      question: 'Should the value claim include the interactive pet?', reason: 'This changes the requested scope.', options: ['Include it', 'Leave it out'] });
    f.know.updateWork(f.owner, f.projectId, work.id, { answer: 'Include it', rationale: 'It is the differentiator.',
      criteriaAmendment: ['The proposed output is accurate', 'The value claim includes the interactive pet'] });
    assert.deepEqual(f.history.runFor(f.projectId, work.id, original.id).task.criteria.map(entry => entry.text), ['The proposed output is accurate']);
    assert.deepEqual(f.know.workById(f.projectId, work.id).checks.map(entry => entry.text),
      ['The proposed output is accurate', 'The value claim includes the interactive pet']);
    const log = f.know.workById(f.projectId, work.id).log.map(entry => entry.text);
    assert.ok(log.some(entry => /Answered: Include it/.test(entry)));
    assert.ok(log.some(entry => /Amended the next run to 2 criteria/.test(entry)));
    f.history.recordSignature(f.owner, f.projectId, work.id, original.id, 'close', 'Continue with the amended scope.');
    const next = f.relaunch(f.know.workById(f.projectId, work.id));
    assert.deepEqual(f.worker.taskOpen(f.scope, next.issue.native_ref.bundle_digest).outputs[0].checks,
      ['The proposed output is accurate', 'The value claim includes the interactive pet']);
  } finally { f.close(); }
});

test('the assigned person can start, submit and sign a run without synthetic agent telemetry', async () => {
  const f = fixture();
  try {
    const work = f.know.createWork(f.projectId, { action: 'work.milestone', title: 'Plan the checkpoint',
      assignee: { kind: 'person', id: f.owner.id }, checks: ['The checkpoint has a clear outcome'] }, f.owner.name);
    if (work.state === 'suggested') f.know.updateWork(f.owner, f.projectId, work.id, { state: 'ready' });
    f.runs.stage(f.owner, f.projectId, work.id);
    const started = f.history.startPerson(f.owner, f.projectId, work.id);
    assert.equal(started.performer.kind, 'person');
    assert.equal(started.state, 'working');
    assert.equal(started.live, null);
    assert.deepEqual(started.steps, []);
    agentRuns({ db: f.db, know: f.know, worker: f.worker, symphonyDispatch: true });
    assert.equal(f.know.workById(f.projectId, work.id).state, 'claimed', 'restarting agent admission preserves active person work');
    assert.equal(f.history.runFor(f.projectId, work.id, started.id).state, 'working');
    assert.throws(() => f.know.updateWork(f.owner, f.projectId, work.id, { task: { criteria: ['Changed too late'] } }), /locked/);
    const submitted = f.history.submitPerson(f.owner, f.projectId, work.id, started.id, {
      summary: 'Defined a concrete checkpoint outcome.', evidence: [{ claim: 'note-1', note: 'Review the outcome named in the project plan.' }] });
    assert.equal(submitted.state, 'review');
    assert.equal(submitted.summary, 'Defined a concrete checkpoint outcome.');
    assert.equal(submitted.evidence[0].type, 'note');
    f.history.saveReview(f.projectId, work.id, started.id, { verdict: { index: 0, value: 'reject', note: 'Name the date.' } });
    const sent = await f.history.sign(f.owner, f.projectId, work.id, started.id, { outcome: 'reject', comment: 'One more pass.' });
    assert.equal(sent.state, 'sent');
    f.runs.stage(f.owner, f.projectId, work.id);
    const second = f.history.startPerson(f.owner, f.projectId, work.id);
    assert.equal(second.number, 2, 'a signed person run does not block the next one');
    assert.equal(second.task.carriedComment, 'One more pass.');
    f.history.submitPerson(f.owner, f.projectId, work.id, second.id, {
      summary: 'Added the checkpoint date.', evidence: [{ claim: 'note-1', note: 'Review the dated checkpoint outcome.' }] });
    f.history.saveReview(f.projectId, work.id, second.id, { verdict: { index: 0, value: 'accept' } });
    const signed = await f.history.sign(f.owner, f.projectId, work.id, second.id, { outcome: 'accept', comment: 'Clear.' }, {
      accept: () => f.know.updateWork(f.owner, f.projectId, work.id, { state: 'done' }),
    });
    assert.equal(signed.state, 'accepted');
    assert.equal(f.know.workById(f.projectId, work.id).state, 'done');
  } finally { f.close(); }
});

// JOURNEYS-01 J4: claims with stable IDs replace positional criteria; a claimed journey step must pass to accept.
const journeyClaim = { id: 'onboarding-steps', kind: 'journey', journey: 'onboarding', revision: 2, steps: ['sign-up', 'team'] };

test('J4: the restart migration gives legacy criteria and run verdicts claim IDs, once, keeping their text and verdicts', async () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('product.brief');
    f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal: claim('A pet in the corner of your screen.') });
    const person = f.know.createWork(f.projectId, { action: 'platform.docs', title: 'Write the guide', assignee: { kind: 'person', id: f.owner.id }, checks: ['It names the owner', 'It has a date'] }, f.owner.name);
    // Rows as they were before J4: criteria without IDs; a run's verdicts kept by position.
    for (const id of [work.id, person.id]) {
      const row = f.db.prepare('SELECT checks_json FROM layer_work_items WHERE id = ?').get(id);
      const legacy = JSON.parse(row.checks_json).map(({ id: _id, kind, backed, ...check }) => check);
      f.db.prepare('UPDATE layer_work_items SET checks_json = ? WHERE id = ?').run(JSON.stringify(legacy), id);
    }
    f.db.prepare("UPDATE layer_work_items SET checks_json = ? WHERE id = ?").run(JSON.stringify([{ text: 'It names the owner', source: null, verdict: 'accept', note: '', by: 'Owner' }, { text: 'It has a date', source: null, verdict: null, note: '' }]), person.id);
    f.db.prepare("INSERT INTO work_run_reviews(attempt_id, project_id, work_id, verdicts_json, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(issue.native_ref.attempt_id, f.projectId, work.id, JSON.stringify({ 0: { value: 'reject', note: 'Too long.' } }), new Date().toISOString());
    initKnowledge(f.db); initWorkRuns(f.db);
    const migrated = f.know.workById(f.projectId, person.id);
    assert.deepEqual(migrated.checks.map(check => [check.id, check.kind, check.backed, check.text, check.verdict]), [['note-1', 'note', false, 'It names the owner', 'accept'], ['note-2', 'note', false, 'It has a date', null]]);
    assert.match(migrated.log.at(-1).text, /2 criteria are now note claims/);
    const [run] = f.history.list(f.projectId, work.id);
    assert.deepEqual(run.review.verdicts, { 'note-1': { value: 'reject', note: 'Too long.' } }, 'a position verdict moves to the claim it named');
    assert.equal(run.task.criteria[0].id, 'note-1', 'the bundle pinned before J4 reads by position as the same ID');
    // Running it again changes nothing.
    initKnowledge(f.db); initWorkRuns(f.db);
    assert.equal(f.know.workById(f.projectId, person.id).log.length, migrated.log.length);
    assert.deepEqual(f.history.list(f.projectId, work.id)[0].review.verdicts, run.review.verdicts);
  } finally { f.close(); }
});

test('J4: claims keep their IDs through task edits; verdicts and send-back feedback name them', async () => {
  const f = fixture();
  try {
    const work = f.know.createWork(f.projectId, { action: 'platform.docs', title: 'Write the guide', assignee: { kind: 'person', id: f.owner.id },
      claims: [journeyClaim], checks: ['It names the owner', 'It has a date'] }, f.owner.name);
    assert.deepEqual(work.checks.map(check => [check.id, check.kind, check.backed]), [['onboarding-steps', 'journey', true], ['note-1', 'note', false], ['note-2', 'note', false]]);
    assert.equal(work.checks[0].text, 'Journey onboarding at revision 2: steps sign-up, team');
    // Editing the free text keeps the backed claim and each unchanged note's ID; a new note never takes a removed note's ID.
    const edited = f.know.updateWork(f.owner, f.projectId, work.id, { task: { criteria: ['It has a date', 'It links the FAQ'] } });
    assert.deepEqual(edited.checks.map(check => [check.id, check.text]), [['onboarding-steps', work.checks[0].text], ['note-2', 'It has a date'], ['note-3', 'It links the FAQ']]);
    assert.throws(() => f.know.createWork(f.projectId, { action: 'platform.docs', title: 'Bad', claims: [{ id: 'x', kind: 'journey', journey: 'onboarding', revision: 2, steps: [] }] }), /names a journey/);
    f.runs.stage(f.owner, f.projectId, work.id);
    const started = f.history.startPerson(f.owner, f.projectId, work.id);
    assert.deepEqual(started.task.criteria.map(claim => claim.id), ['onboarding-steps', 'note-2', 'note-3']);
    assert.throws(() => f.history.submitPerson(f.owner, f.projectId, work.id, started.id, { summary: 'Wrote the guide.', evidence: [{ claim: 'note-7', note: 'x' }] }), /claim this run was given/);
    assert.throws(() => f.history.submitPerson(f.owner, f.projectId, work.id, started.id, { summary: 'Wrote the guide.', reasons: { 'note-3': 'x' } }), /claim with step tests/);
    const submitted = f.history.submitPerson(f.owner, f.projectId, work.id, started.id, { summary: 'Wrote the guide.', evidence: [{ claim: 'onboarding-steps', step: 'team', note: 'The team page.' }] });
    assert.deepEqual([submitted.evidence[0].claim, submitted.evidence[0].step], ['onboarding-steps', 'team']);
    // A position names the claim it points at now and is stored by ID.
    f.history.saveReview(f.projectId, work.id, started.id, { verdict: { index: 1, value: 'reject', note: 'The date is missing.' } });
    assert.deepEqual(Object.keys(f.history.runFor(f.projectId, work.id, started.id).review.verdicts), ['note-2']);
    f.history.saveReview(f.projectId, work.id, started.id, { verdict: { claim: 'note-3', value: 'accept' } });
    assert.throws(() => f.history.saveReview(f.projectId, work.id, started.id, { verdict: { claim: 'note-1', value: 'accept' } }), /Unknown claim/, 'a removed note is no longer a claim');
    await f.history.sign(f.owner, f.projectId, work.id, started.id, { outcome: 'reject' });
    const feedback = f.know.workById(f.projectId, work.id).context.feedback;
    assert.deepEqual(feedback.map(note => note.claim), ['note-2', 'onboarding-steps'], 'the flagged note, then the unproven journey claim, go back by ID');
    assert.match(feedback[1].note, /Not proven on the reviewed build \(not-run\)/);
  } finally { f.close(); }
});

test('J4: an agent run whose journey claim is not proven cannot be accepted', async () => {
  const f = fixture();
  try {
    const { work, issue, card } = f.start('product.brief', [], null, { claims: [journeyClaim] });
    assert.deepEqual(f.know.workById(f.projectId, work.id).checks.map(check => check.id), ['onboarding-steps', 'note-1']);
    assert.ok(card, 'the run started with its claims pinned');
    f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal: claim('A pet in the corner of your screen.') });
    const [run] = f.history.list(f.projectId, work.id);
    assert.deepEqual([run.proofs['onboarding-steps'].status, run.gate.map(entry => entry.claim)], ['not-run', ['onboarding-steps']]);
    let applied = false;
    await assert.rejects(f.history.sign(f.owner, f.projectId, work.id, run.id, { outcome: 'accept' }, { accept: () => { applied = true; } }), /not proven yet.*Send it back\./);
    assert.equal(applied, false);
    assert.equal(f.history.runFor(f.projectId, work.id, run.id).state, 'review');
  } finally { f.close(); }
});

test('J4: a person run is proven by the step results of its reviewed build, or accepted over a failure only with a stated reason', async () => {
  const f = fixture();
  try {
    initLayerSource(f.db);
    // An app repository whose reviewed build has the onboarding journey at revision 2.
    const repo = join(f.root, 'app'); mkdirSync(join(repo, '.aludel', 'outputs'), { recursive: true });
    git(repo, 'init', '-q', '-b', 'main');
    writeFileSync(join(repo, '.aludel', 'review.json'), JSON.stringify({ version: 2, checks: [{ name: 'App tests', command: ['npm', 'test'] }], personas: { newcomer: { fixture: 'fresh', session: null } } }));
    const step = id => ({ id, name: `Do ${id}`, route: `/${id}`, trigger: 'Opens it', expected: `The ${id} page shows.`, test: `onboarding.spec.mjs#${id}` });
    writeFileSync(join(repo, '.aludel', 'outputs', 'journeys.json'), JSON.stringify({ journeys: [{ version: 1, id: 'onboarding', title: 'Onboarding', origin: 'authored', revision: 2, persona: 'newcomer', steps: ['sign-up', 'team', 'dashboard'].map(step) }] }));
    git(repo, 'add', '.'); git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'app');
    const commit = git(repo, 'rev-parse', 'HEAD');
    f.db.prepare("INSERT INTO layer_instances(project_id, layer_key, instance_id, created_at) VALUES (?, 'j4app', 'inst-j4app', ?)").run(f.projectId, new Date().toISOString());
    f.db.prepare("INSERT INTO layer_package_bindings(project_id, layer_key, layer_instance_id, repository_path, accepted_commit, installed_at) VALUES (?, 'j4app', 'inst-j4app', ?, ?, ?)").run(f.projectId, repo, commit, new Date().toISOString());
    const passing = ['sign-up', 'team', 'dashboard'].map(id => ({ id: `onboarding.${id}`, status: 'passed', detail: null, screenshot: true }));
    const prepare = (claims, results, reasons) => {
      const work = f.know.createWork(f.projectId, { action: 'platform.docs', title: 'Add the team step', assignee: { kind: 'person', id: f.owner.id }, claims, checks: [] }, f.owner.name);
      f.runs.stage(f.owner, f.projectId, work.id);
      const started = f.history.startPerson(f.owner, f.projectId, work.id);
      const task = JSON.parse(f.db.prepare('SELECT task_json FROM work_person_runs WHERE id = ?').get(started.id).task_json);
      f.db.prepare('UPDATE work_person_runs SET task_json = ? WHERE id = ?').run(JSON.stringify({ ...task, layerRepository: { key: 'j4app', base: commit, root: '' } }), started.id);
      f.history.submitPerson(f.owner, f.projectId, work.id, started.id, { summary: 'Added the team step.', ...(reasons ? { reasons } : {}) });
      const integration = `rvi-${started.id.slice(-8)}`;
      f.db.prepare('INSERT INTO layer_review_integrations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(integration, started.id, f.projectId, 'j4app', commit, commit, commit,
        JSON.stringify({ id: integration, branch: 'review/x', base: commit, commit, submittedCommit: commit, files: [], tests: [] }), new Date().toISOString());
      // As the review previews module declares it at startup.
      f.db.exec('CREATE TABLE IF NOT EXISTS layer_review_journeys (integration_id TEXT PRIMARY KEY, commit_sha TEXT NOT NULL, steps_json TEXT NOT NULL, separability_json TEXT NOT NULL, ran_at TEXT NOT NULL)');
      f.db.withProject(f.projectId, () => {
        f.db.prepare("INSERT INTO layer_review_journeys VALUES (?, ?, ?, '{}', ?)").run(integration, commit, JSON.stringify(results), new Date().toISOString());
      });
      return { work, run: f.history.runFor(f.projectId, work.id, started.id) };
    };
    const unchanged = { id: 'journeys-unchanged', kind: 'invariant', covers: 'journeys', text: 'Every other journey step still passes.' };
    // All claimed steps pass: proven, and accepted.
    const proven = prepare([journeyClaim, unchanged], passing);
    assert.deepEqual([proven.run.proofs['onboarding-steps'].status, proven.run.proofs['journeys-unchanged'].status, proven.run.gate], ['passed', 'passed', []]);
    await f.history.sign(f.owner, f.projectId, proven.work.id, proven.run.id, { outcome: 'accept' }, { accept: () => {} });
    assert.equal(f.history.runFor(f.projectId, proven.work.id, proven.run.id).state, 'accepted');
    // A failing claimed step blocks; an unclaimed step failing breaks the invariant instead.
    const failing = passing.map(result => result.id === 'onboarding.team' ? { ...result, status: 'failed', detail: 'No team form.' } : result.id === 'onboarding.dashboard' ? { ...result, status: 'failed', detail: 'Blank.' } : result);
    const blocked = prepare([journeyClaim, unchanged], failing);
    assert.deepEqual(blocked.run.proofs['onboarding-steps'].steps.map(entry => [entry.id, entry.status]), [['onboarding.sign-up', 'passed'], ['onboarding.team', 'failed']]);
    assert.deepEqual(blocked.run.gate.map(entry => [entry.claim, entry.status]), [['onboarding-steps', 'failed'], ['journeys-unchanged', 'failed']]);
    await assert.rejects(f.history.sign(f.owner, f.projectId, blocked.work.id, blocked.run.id, { outcome: 'accept' }, { accept: () => {} }), /not proven \(failed\).*state why when they submit/);
    await f.history.sign(f.owner, f.projectId, blocked.work.id, blocked.run.id, { outcome: 'reject' });
    const feedback = f.know.workById(f.projectId, blocked.work.id).context.feedback;
    assert.match(feedback.find(note => note.claim === 'onboarding-steps').note, /onboarding\.team failed \(No team form\.\)/);
    // A build at an older journey revision doesn't prove the claim.
    const stale = prepare([{ ...journeyClaim, id: 'later', revision: 3 }], passing);
    assert.match(stale.run.proofs.later.detail, /revision 2; this claim is for revision 3/);
    // The person said why up front: the reviewer may accept over the failure.
    const excused = prepare([journeyClaim], failing, { 'onboarding-steps': 'The team form needs the design kit; tracked as W-9.' });
    assert.deepEqual(excused.run.gate.map(entry => entry.reason), ['The team form needs the design kit; tracked as W-9.']);
    await f.history.sign(f.owner, f.projectId, excused.work.id, excused.run.id, { outcome: 'accept' }, { accept: () => {} });
    assert.equal(f.history.runFor(f.projectId, excused.work.id, excused.run.id).state, 'accepted');
  } finally { f.close(); }
});

// JOURNEYS-01 J5: an imported app with no journeys. A request about /settings is offered Specify; Specify raises the
// reviewable prerequisite; accepting the Specify run raises Implement with only the steps the app doesn't do yet.
test('J5: a request is specified first, and accepting Specify raises Implement with the unbuilt steps as claims', async () => {
  const f = fixture();
  try {
    initLayerSource(f.db); initCodeUnits(f.db);
    const at = new Date().toISOString(), commitAll = (repo, message) => { git(repo, 'add', '.'); git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', message); return git(repo, 'rev-parse', 'HEAD'); };
    const repo = join(f.root, 'imported-app'); mkdirSync(join(repo, '.aludel', 'outputs'), { recursive: true }); mkdirSync(join(repo, 'server'));
    git(repo, 'init', '-q', '-b', 'main');
    writeFileSync(join(repo, '.aludel', 'layer.json'), JSON.stringify({ schemaVersion: 1, hostSdkVersion: 1, key: 'platform', name: 'Code', path: '/code', authority: 'code_projection',
      outputProvider: 'files', editorAdapter: 'none', outputs: [], tabs: [], knowledge: { charter: 'knowledge/charter.md', documents: [] }, work: { scope: 'layer' } }));
    mkdirSync(join(repo, '.aludel', 'knowledge')); writeFileSync(join(repo, '.aludel', 'knowledge', 'charter.md'), '# Code\n');
    writeFileSync(join(repo, '.aludel', 'review.json'), JSON.stringify({ version: 2, checks: [{ name: 'App tests', command: ['npm', 'test'] }], personas: { member: { fixture: 'team', session: 'member' } } }));
    writeFileSync(join(repo, 'server', 'server.mjs'), "// The app's own server; it has no review setup route yet.\n");
    const base = commitAll(repo, 'imported app');
    // Code is the `platform` layer (DEC-049), bound to the imported app's repository.
    f.db.prepare("INSERT OR IGNORE INTO layer_instances(project_id, layer_key, instance_id, created_at) VALUES (?, 'platform', 'inst-code', ?)").run(f.projectId, at);
    const instance = f.db.prepare("SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = 'platform'").get(f.projectId).instance_id;
    f.db.prepare("INSERT OR REPLACE INTO layer_package_bindings(project_id, layer_key, layer_instance_id, repository_path, accepted_commit, installed_at) VALUES (?, 'platform', ?, ?, ?, ?)").run(f.projectId, instance, repo, base, at);
    for (const path of ['/', '/settings', '/app']) f.db.prepare('INSERT INTO code_units(id, project_id, unit_key, path, symbol, kind, hash, reachable, last_commit, line, calls_json, indexed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, 1, ?, ?)')
      .run(`unit-${path}`, f.projectId, `src/routes.ts#route ${path}`, 'src/routes.ts', `route ${path}`, 'route', 'h', '[]', at);
    const items = journeyWork({ db: f.db, know: f.know });

    // The offer: /settings has no journey, so Code offers to draft one; a footer typo gets no offer.
    const request = { title: 'Invite teammates', brief: 'From /settings, a member invites people by email.' };
    const offered = items.offer(f.projectId, request);
    assert.deepEqual([offered.offer.kind, offered.offer.journey, offered.uncovered], ['draft', { id: 'invite-teammates', title: 'Invite teammates', revision: 1 }, ['/settings']]);
    assert.equal(items.offer(f.projectId, { title: 'Fix the footer typo' }).offer, null);

    // Specify: the journey's record claim and the invariant; no setup route, so the reviewable prerequisite blocks it.
    const created = items.specify(f.owner, f.projectId, { ...request, journey: offered.offer.journey, persona: 'member', assignee: { kind: 'person', id: f.owner.id } });
    const specify = created.specify;
    assert.deepEqual(specify.checks.map(claim => [claim.id, claim.kind, claim.entry ?? claim.covers]), [['journey-spec', 'record', 'journey-invite-teammates'], ['journeys-unchanged', 'invariant', 'journeys']]);
    assert.deepEqual([specify.scope, specify.layer, specify.context.journeyWork.revision], ['layer', 'platform', 1]);
    assert.deepEqual(created.prerequisite.checks.map(claim => claim.id), ['setup-route']);
    assert.deepEqual(f.know.workList(f.projectId).find(entry => entry.id === specify.id).blockedBy, [created.prerequisite.id]);
    // Once per app: a second Specify reuses the open prerequisite.
    const other = items.specify(f.owner, f.projectId, { title: 'Change billing', brief: 'On /settings/billing', journey: { id: 'billing', title: 'Billing' } });
    assert.equal(other.prerequisite.id, created.prerequisite.id);
    await assert.rejects(async () => items.specify(f.owner, f.projectId, { ...request, journey: offered.offer.journey }), /already being specified/);
    f.know.updateWork(f.owner, f.projectId, created.prerequisite.id, { blocks: [] });

    // The person specifies: characterization test for opening settings (passes), the new invite step without a test.
    const step = (id, route, test) => ({ id, name: `Step ${id}`, route, persona: 'member', trigger: `Goes to ${route}`, expected: `${id} works`, ...(test ? { test } : {}) });
    const journey = revision => ({ version: 1, id: 'invite-teammates', title: 'Invite teammates', origin: 'authored', revision, persona: 'member',
      steps: [step('open-settings', '/settings', 'invite-teammates.spec.mjs#open-settings'), step('invite', '/settings/invite')] });
    writeFileSync(join(repo, '.aludel', 'outputs', 'journeys.json'), JSON.stringify({ journeys: [journey(1)] }));
    const specified = commitAll(repo, 'Specify invite teammates');
    git(repo, 'checkout', '-q', '--detach', base);
    f.runs.stage(f.owner, f.projectId, specify.id);
    const started = f.history.startPerson(f.owner, f.projectId, specify.id);
    assert.deepEqual(JSON.parse(f.db.prepare('SELECT task_json FROM work_person_runs WHERE id = ?').get(started.id).task_json).criteria.map(claim => claim.id), ['journey-spec', 'journeys-unchanged']);
    f.history.submitPerson(f.owner, f.projectId, specify.id, started.id, { summary: 'Specified invite teammates.' });
    const integration = `rvi-${started.id.slice(-8)}`;
    f.db.prepare('INSERT INTO layer_review_integrations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(integration, started.id, f.projectId, 'platform', specified, base, specified,
      JSON.stringify({ id: integration, branch: 'review/specify', base, commit: specified, submittedCommit: specified, files: [], tests: [] }), at);
    f.db.exec('CREATE TABLE IF NOT EXISTS layer_review_journeys (integration_id TEXT PRIMARY KEY, commit_sha TEXT NOT NULL, steps_json TEXT NOT NULL, separability_json TEXT NOT NULL, ran_at TEXT NOT NULL)');
    f.db.withProject(f.projectId, () => f.db.prepare("INSERT INTO layer_review_journeys VALUES (?, ?, ?, '{}', ?)").run(integration, specified,
      JSON.stringify([{ id: 'invite-teammates.open-settings', status: 'passed', detail: null, screenshot: true }, { id: 'invite-teammates.invite', status: 'uncovered', detail: null, screenshot: false }]), at));
    const run = f.history.runFor(f.projectId, specify.id, started.id);
    assert.deepEqual([run.proofs['journey-spec'].status, run.proofs['journeys-unchanged'].status, run.gate], ['passed', 'passed', []]);

    // Accepting merges the specified commit (as the repository acceptance does) and raises Implement.
    await f.history.sign(f.owner, f.projectId, specify.id, started.id, { outcome: 'accept' }, { accept: () => {
      f.db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'platform'").run(specified, f.projectId);
      f.know.updateWork(f.owner, f.projectId, specify.id, { state: 'done' });
    } });
    const implement = items.afterAccept(f.owner, f.projectId, specify.id, started.id);
    assert.equal(implement.title, 'Implement: Invite teammates');
    assert.deepEqual(implement.checks.map(claim => [claim.id, claim.kind, claim.steps ?? claim.text]), [['invite-teammates-steps', 'journey', ['invite']],
      ['journeys-unchanged', 'invariant', 'Every other journey still passes its tests, as do steps open-settings of Invite teammates.']]);
    assert.deepEqual([implement.scope, implement.layer, implement.context.journeyWork.specify, implement.context.journeyWork.request.title], ['layer', 'platform', specify.id, 'Invite teammates']);
    assert.match(f.know.workById(f.projectId, specify.id).log.at(-1).text, new RegExp(`Raised ${implement.ref} to implement invite-teammates at revision 1; steps open-settings already pass`));
    assert.equal(items.afterAccept(f.owner, f.projectId, specify.id, started.id).id, implement.id, 'raised once');
    // The offer now sees the journey covering /settings, and offers to revise it.
    assert.deepEqual([items.offer(f.projectId, request).offer.kind, items.offer(f.projectId, request).offer.journey.revision], ['revise', 2]);
  } finally { f.close(); }
});

test('J5: a Specify run whose build lacks the journey, or holds it unsigned, cannot be accepted', async () => {
  const f = fixture();
  try {
    initLayerSource(f.db);
    const repo = join(f.root, 'app'); mkdirSync(join(repo, '.aludel', 'outputs'), { recursive: true });
    git(repo, 'init', '-q', '-b', 'main');
    writeFileSync(join(repo, '.aludel', 'review.json'), JSON.stringify({ version: 2, checks: [{ name: 'App tests', command: ['npm', 'test'] }], personas: {} }));
    writeFileSync(join(repo, '.aludel', 'outputs', 'journeys.json'), JSON.stringify({ journeys: [{ version: 1, id: 'billing', title: 'Billing', origin: 'observed', revision: 1,
      steps: [{ id: 'open', name: 'Open billing', route: '/billing', trigger: 'Opens it', expected: 'Billing shows.', test: 'billing.spec.mjs#open' }] }] }));
    git(repo, 'add', '.'); git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'app');
    const commit = git(repo, 'rev-parse', 'HEAD'), at = new Date().toISOString();
    f.db.prepare("INSERT INTO layer_instances(project_id, layer_key, instance_id, created_at) VALUES (?, 'j5app', 'inst-j5app', ?)").run(f.projectId, at);
    f.db.prepare("INSERT INTO layer_package_bindings(project_id, layer_key, layer_instance_id, repository_path, accepted_commit, installed_at) VALUES (?, 'j5app', 'inst-j5app', ?, ?, ?)").run(f.projectId, repo, commit, at);
    f.db.exec('CREATE TABLE IF NOT EXISTS layer_review_journeys (integration_id TEXT PRIMARY KEY, commit_sha TEXT NOT NULL, steps_json TEXT NOT NULL, separability_json TEXT NOT NULL, ran_at TEXT NOT NULL)');
    const check = async (claim, status, pattern) => {
      const work = f.know.createWork(f.projectId, { action: 'platform.docs', title: 'Specify billing', assignee: { kind: 'person', id: f.owner.id }, claims: [claim], checks: [] }, f.owner.name);
      f.runs.stage(f.owner, f.projectId, work.id);
      const started = f.history.startPerson(f.owner, f.projectId, work.id);
      const task = JSON.parse(f.db.prepare('SELECT task_json FROM work_person_runs WHERE id = ?').get(started.id).task_json);
      f.db.prepare('UPDATE work_person_runs SET task_json = ? WHERE id = ?').run(JSON.stringify({ ...task, layerRepository: { key: 'j5app', base: commit, root: '' } }), started.id);
      f.history.submitPerson(f.owner, f.projectId, work.id, started.id, { summary: 'Specified billing.' });
      const integration = `rvi-${started.id.slice(-8)}`;
      f.db.prepare('INSERT INTO layer_review_integrations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(integration, started.id, f.projectId, 'j5app', commit, commit, commit,
        JSON.stringify({ id: integration, branch: 'review/x', base: commit, commit, submittedCommit: commit, files: [], tests: [] }), at);
      f.db.withProject(f.projectId, () => f.db.prepare("INSERT INTO layer_review_journeys VALUES (?, ?, ?, '{}', ?)").run(integration, commit, JSON.stringify([{ id: 'billing.open', status: 'passed' }]), at));
      const run = f.history.runFor(f.projectId, work.id, started.id);
      assert.equal(run.proofs[claim.id].status, status);
      await assert.rejects(f.history.sign(f.owner, f.projectId, work.id, started.id, { outcome: 'accept' }, { accept: () => {} }), pattern);
    };
    const spec = { id: 'journey-spec', kind: 'record', layer: 'platform', text: 'The journey, specified' };
    await check({ ...spec, entry: 'journey-billing', revision: 2 }, 'stale', /not proven \(stale\)/);
    await check({ ...spec, entry: 'journey-billing', revision: 1 }, 'unsigned', /not proven \(unsigned\)/);
    await check({ ...spec, entry: 'journey-invite', revision: 1 }, 'missing', /not proven \(missing\)/);
  } finally { f.close(); }
});

// J6: an app bound to Code with an authored journey and a replica of a Pages flow, for follow-ups that change a spec.
function codeApp(f) {
  initLayerSource(f.db); initLayerScope(f.db);
  const at = new Date().toISOString(), repo = join(f.root, 'j6-app');
  mkdirSync(join(repo, '.aludel', 'outputs'), { recursive: true }); git(repo, 'init', '-q', '-b', 'main');
  const step = (id, route) => ({ id, name: `Step ${id}`, route, trigger: `Goes to ${route}`, expected: `${id} works` });
  writeFileSync(join(repo, '.aludel', 'review.json'), JSON.stringify({ version: 2, checks: [{ name: 'App tests', command: ['npm', 'test'] }], personas: { owner: { fixture: 'team', session: 'owner' } } }));
  writeFileSync(join(repo, '.aludel', 'layer.json'), JSON.stringify({ schemaVersion: 1, hostSdkVersion: 1, key: 'platform', name: 'Code', path: '/code', authority: 'code_projection',
    outputProvider: 'files', editorAdapter: 'none', outputs: [], tabs: [], knowledge: { charter: 'knowledge/charter.md', documents: [] }, work: { scope: 'layer' } }));
  mkdirSync(join(repo, '.aludel', 'knowledge')); writeFileSync(join(repo, '.aludel', 'knowledge', 'charter.md'), '# Code\n');
  writeFileSync(join(repo, '.aludel', 'outputs', 'journeys.json'), JSON.stringify({ journeys: [
    { version: 1, id: 'invite-teammate', title: 'Invite a teammate', origin: 'authored', revision: 2, persona: 'owner', steps: [step('open', '/team'), step('send', '/team/invite')] },
    { version: 1, id: 'first-world', title: 'Start a first world', origin: 'replica', revision: 3, persona: 'newcomer', source: { layer: 'pages', entry: 'flw-first', revision: 3 }, steps: [step('signup', '/signup')] }] }));
  git(repo, 'add', '.'); git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'app');
  const commit = git(repo, 'rev-parse', 'HEAD');
  f.db.prepare("INSERT OR IGNORE INTO layer_instances(project_id, layer_key, instance_id, created_at) VALUES (?, 'platform', 'inst-code', ?)").run(f.projectId, at);
  f.db.prepare("INSERT OR IGNORE INTO layer_instances(project_id, layer_key, instance_id, created_at) VALUES (?, 'pages', 'inst-pages', ?)").run(f.projectId, at);
  const instance = f.db.prepare("SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = 'platform'").get(f.projectId).instance_id;
  f.db.prepare("INSERT OR REPLACE INTO layer_package_bindings(project_id, layer_key, layer_instance_id, repository_path, accepted_commit, installed_at) VALUES (?, 'platform', ?, ?, ?, ?)").run(f.projectId, instance, repo, commit, at);
  for (const key of ['platform', 'pages']) f.db.prepare('INSERT OR IGNORE INTO layer_elevated_grants VALUES (?, ?, ?, ?, ?)').run(f.projectId, f.owner.id, key, 'test', at);
  return { repo, commit };
}

test('J6: a follow-up that changes a journey is raised where its spec is kept', () => {
  const f = fixture();
  try {
    codeApp(f);
    const ask = target => ({ title: 'Invite several people at once', brief: 'The reviewer wants to paste a list of emails.', why: 'Out of scope for this run: the journey invites one person.', ...(target ? { target } : {}) });
    const [own] = checkFollowUps(f.db, f.projectId, [ask({ journey: 'invite-teammate' })]);
    assert.deepEqual([own.layer, own.target], ['platform', { journey: 'invite-teammate', title: 'Invite a teammate', revision: 2, layer: 'platform', entry: 'journey-invite-teammate', entryRevision: 2 }]);
    // A replica's spec is the Pages flow it was imported from; naming another layer is refused with where it is kept.
    const [replica] = checkFollowUps(f.db, f.projectId, [ask({ journey: 'first-world' })]);
    assert.deepEqual([replica.layer, replica.target.entry], ['pages', 'flw-first']);
    assert.throws(() => checkFollowUps(f.db, f.projectId, [{ ...ask({ journey: 'first-world' }), layer: 'platform' }]), /kept in the pages layer \(flw-first\)/);
    assert.throws(() => checkFollowUps(f.db, f.projectId, [ask({ journey: 'billing' })]), /isn't in Code's accepted app \(invite-teammate, first-world\)/);
    assert.throws(() => checkFollowUps(f.db, f.projectId, [ask({ journey: 'invite-teammate', route: '/team' })]), /names a journey by ID/);

    const work = f.know.createWork(f.projectId, { action: 'product.brief', title: 'Invite flow', checks: ['Works'] }, f.owner.name);
    recordFollowUps(f.db, { projectId: f.projectId, workId: work.id, proposalId: 'spr-j6', attemptId: 'att-j6', sourceLayer: 'platform', profileId: f.profile.id, followUps: [own, replica] });
    const [first, second] = f.db.prepare('SELECT id FROM work_follow_ups WHERE attempt_id = ? ORDER BY position').all('att-j6').map(row => row.id);
    // Code's own journey: creating raises Specify (J5) on it, signed as the agent and parked in the backlog.
    const specify = decideFollowUp(f.db, f.know, f.owner, f.projectId, work.id, first, 'create', { title: 'Clarify the invitation', suggestion: 'Keep the sender and recipient roles explicit.', assignee: null, priority: 'high', state: 'suggested', checks: ['Both roles are described.'], claims: [] });
    assert.equal(specify.work.assignee, null); assert.equal(specify.work.priority, 'high');
    assert.ok(specify.work.checks.some(check => check.text === 'Both roles are described.'));
    assert.deepEqual([specify.followUp.target.journey, specify.work.title, specify.work.state, specify.work.context.journeyWork.kind, specify.work.context.journeyWork.revision, specify.work.context.createdBy.kind],
      ['invite-teammate', 'Specify: Clarify the invitation', 'suggested', 'specify', 3, 'agent']);
    // The replica: the change goes to Pages, naming the flow.
    const pages = decideFollowUp(f.db, f.know, f.owner, f.projectId, work.id, second, 'create').work;
    assert.deepEqual([pages.layer, pages.context.specTarget.entry], ['pages', 'flw-first']);
    assert.match(pages.context.suggestion, /changes flw-first \(revision 3\), which Code's journey first-world is imported from/);
  } finally { f.close(); }
});

test('J6: walked steps are flagged with a note; a merge-or-draft question parks the draft behind its spec', async () => {
  const f = fixture();
  try {
    const app = codeApp(f);
    const journeyClaim = { id: 'invite-steps', kind: 'journey', journey: 'invite-teammate', revision: 2, steps: ['open', 'send'] };
    const { work, issue } = f.start('product.brief', [], null, { claims: [journeyClaim] });
    f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal: claim('A pet in the corner of your screen.') });
    let [run] = f.history.list(f.projectId, work.id);
    const save = input => f.history.saveReview(f.projectId, work.id, run.id, input);
    assert.throws(() => save({ step: { claim: 'invite-steps', step: 'Not a step', value: 'ok' } }), /Unknown journey step/);
    assert.throws(() => save({ step: { claim: 'invite-steps', step: 'send', value: 'flag' } }), /Say what is wrong/);
    assert.throws(() => save({ verdict: { claim: 'note-1', value: 'reject' } }), /Say what is wrong with this claim/);
    save({ step: { claim: 'invite-steps', step: 'open', value: 'ok' } });
    run = save({ step: { claim: 'invite-steps', step: 'send', value: 'flag', note: 'Send gives no confirmation.' } });
    assert.deepEqual(run.review.steps, { 'invite-steps/open': { value: 'ok', note: '' }, 'invite-steps/send': { value: 'flag', note: 'Send gives no confirmation.' } });
    assert.throws(() => save({ verdict: { claim: 'invite-steps', value: 'accept' } }), /flagged step can't be approved/);
    await assert.rejects(f.history.sign(f.owner, f.projectId, work.id, run.id, { outcome: 'accept' }, { accept: () => {} }), /Something in this run is flagged/);
    run = save({ step: { claim: 'invite-steps', step: 'send', value: null } });
    assert.throws(() => save({ answer: 'merge' }), /asks no question/);

    // The run asks merge-or-draft about its committed change, with a follow-up that targets the journey.
    const source = { branch: 'work/j6-draft', commit: 'a'.repeat(40), base: 'b'.repeat(40), tests: [] };
    const content = JSON.parse(f.db.prepare('SELECT content_json FROM symphony_proposals WHERE id = ?').get(run.proposalId).content_json);
    f.db.prepare('UPDATE symphony_proposals SET content_json = ? WHERE id = ?').run(JSON.stringify({ ...content, source, question: { ask: 'merge-or-draft', why: 'Bulk invites need a revised journey first.' } }), run.proposalId);
    const [target] = checkFollowUps(f.db, f.projectId, [{ title: 'Invite several people at once', brief: 'Paste a list of emails.', why: 'The reviewer asked for it; the journey invites one.', target: { journey: 'invite-teammate' } }]);
    recordFollowUps(f.db, { projectId: f.projectId, workId: work.id, proposalId: run.proposalId, attemptId: run.id, sourceLayer: 'platform', profileId: f.profile.id, followUps: [target] });
    [run] = f.history.list(f.projectId, work.id);
    assert.deepEqual(run.question, { ask: 'merge-or-draft', why: 'Bulk invites need a revised journey first.' });
    assert.throws(() => save({ answer: 'later' }), /Answer merge or draft/);
    run = save({ answer: 'draft' });
    await assert.rejects(f.history.sign(f.owner, f.projectId, work.id, run.id, { outcome: 'accept' }, { accept: () => {} }), /park it instead/);
    await assert.rejects(f.history.sign(f.owner, f.projectId, work.id, run.id, { outcome: 'park' }, {}), /Create the suggested spec change first/);
    const specify = decideFollowUp(f.db, f.know, f.owner, f.projectId, work.id, run.followUps[0].id, 'create').work;
    let rejected = false;
    const parked = await f.history.sign(f.owner, f.projectId, work.id, run.id, { outcome: 'park', comment: 'Keep it until bulk invites are specified.' }, { reject: () => { rejected = true; } });
    assert.deepEqual([parked.state, rejected], ['parked', true]);
    const item = f.know.workList(f.projectId).find(entry => entry.id === work.id);
    assert.deepEqual([item.state, item.blockedBy, item.context.draft], ['ready', [specify.id], { commit: source.commit, branch: source.branch, runRef: 'Run 1', kept: true }]);
    assert.equal(f.know.workById(f.projectId, specify.id).context.journeyWork.parked, work.id, 'accepting the spec continues in the parked item');

    // The spec is accepted at revision 3 with a new step: its Implement claims join the parked item, which then builds on its draft.
    const journeys = JSON.parse(execFileSync('git', ['-C', app.repo, 'show', `${app.commit}:.aludel/outputs/journeys.json`]).toString());
    journeys.journeys[0] = { ...journeys.journeys[0], revision: 3, steps: [...journeys.journeys[0].steps, { id: 'bulk', name: 'Paste emails', route: '/team/invite', trigger: 'Pastes a list', expected: 'Each gets an invite' }] };
    writeFileSync(join(app.repo, '.aludel', 'outputs', 'journeys.json'), JSON.stringify(journeys));
    git(app.repo, 'add', '.'); git(app.repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Specify bulk invites');
    const specified = git(app.repo, 'rev-parse', 'HEAD'), at = new Date().toISOString();
    const prerequisite = f.know.workList(f.projectId).find(entry => entry.context?.journeyWork?.kind === 'reviewable');
    f.know.updateWork(f.owner, f.projectId, prerequisite.id, { blocks: [] });
    f.know.updateWork(f.owner, f.projectId, specify.id, { state: 'ready', assignee: { kind: 'person', id: f.owner.id } });
    f.runs.stage(f.owner, f.projectId, specify.id);
    const started = f.history.startPerson(f.owner, f.projectId, specify.id);
    f.history.submitPerson(f.owner, f.projectId, specify.id, started.id, { summary: 'Specified bulk invites.' });
    f.db.prepare('INSERT INTO layer_review_integrations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('rvi-j6', started.id, f.projectId, 'platform', specified, app.commit, specified,
      JSON.stringify({ id: 'rvi-j6', branch: 'review/specify', base: app.commit, commit: specified, submittedCommit: specified, files: [], tests: [] }), at);
    f.db.exec('CREATE TABLE IF NOT EXISTS layer_review_journeys (integration_id TEXT PRIMARY KEY, commit_sha TEXT NOT NULL, steps_json TEXT NOT NULL, separability_json TEXT NOT NULL, ran_at TEXT NOT NULL)');
    f.db.withProject(f.projectId, () => f.db.prepare("INSERT INTO layer_review_journeys VALUES (?, ?, ?, '{}', ?)").run('rvi-j6', specified,
      JSON.stringify(['open', 'send', 'bulk'].map(step => ({ id: `invite-teammate.${step}`, status: step === 'bulk' ? 'uncovered' : 'passed' }))), at));
    const before = f.know.workList(f.projectId).length;
    const continued = journeyWork({ db: f.db, know: f.know }).afterAccept(f.owner, f.projectId, specify.id, started.id);
    assert.equal(continued.id, work.id);
    assert.equal(f.know.workList(f.projectId).length, before, 'no separate Implement item');
    assert.deepEqual(continued.checks.find(check => check.kind === 'journey' && check.journey === 'invite-teammate' && check.revision === 3)?.steps, ['bulk']);
  } finally { f.close(); }
});

test('task creation preserves explicitly empty criteria and unassigned choice; omitted checks retain existing defaults', () => {
  const f = fixture();
  try {
    const empty = f.know.createWork(f.projectId, { action: 'product.brief', title: 'A plain request', checks: [], assignee: null });
    assert.deepEqual(empty.checks, []); assert.equal(empty.assignee, null);
    assert.throws(() => f.know.updateWork(f.owner, f.projectId, empty.id, { state: 'done' }), /Name what this work checks or documents/, 'empty work without an accepted durable output still cannot close');
    assert.ok(f.know.createWork(f.projectId, { action: 'product.brief', title: 'An automated default' }).checks.length);
  } finally { f.close(); }
});

test('Code pickup assessment leaves Go immutable, exposes added claims to task/evidence/review, and freezes assessment', () => {
  const f = fixture();
  try {
    codeApp(f);
    const { work, issue } = f.start(null, [], null, { layer: 'platform', layerScoped: true, checks: ['Do not remove owner wording'], claims: [{ id: 'owner-step', kind: 'journey', journey: 'invite-teammate', revision: 2, steps: ['open'] }] });
    const id = issue.native_ref.attempt_id, digest = issue.native_ref.bundle_digest;
    const pinned = f.db.prepare('SELECT content_json FROM symphony_bundles WHERE digest = ?').get(digest).content_json;
    const assessment = { reason: 'Sending affects invitation status too', journeys: [{ journey: 'invite-teammate', revision: 2, steps: ['open', 'send'], why: 'The sender sends and sees delivery status' }] };
    assert.throws(() => f.history.reportPlan(f.projectId, id, ['Assess impact'], { reason: 'Affected', journeys: [{ journey: 'invite-teammate', revision: 1, steps: ['send'], why: 'Stale' }] }), /current revision/);
    const result = f.history.reportPlan(f.projectId, id, ['Assess invitation impact', 'Update delivery'], assessment);
    assert.deepEqual(result.claims.map(c => c.id), ['owner-step', 'note-1', 'impact-1']);
    assert.deepEqual(f.worker.taskOpen(f.scope, digest).task.claims.find(c => c.id === 'impact-1').steps, ['send']);
    assert.equal(f.history.checkEvidence(f.projectId, id, [{ claim: 'impact-1', step: 'send', type: 'test', ref: 'invite test' }])[0].claim, 'impact-1');
    assert.equal(f.history.runFor(f.projectId, work.id, id).task.journeyAssessment.reason, assessment.reason);
    assert.ok(f.history.runFor(f.projectId, work.id, id).gate.some(claim => claim.claim === 'impact-1'), 'Added journey claims participate in acceptance gating');
    assert.equal(f.db.prepare('SELECT content_json FROM symphony_bundles WHERE digest = ?').get(digest).content_json, pinned);
    assert.deepEqual(f.know.workById(f.projectId, work.id).checks.map(c => c.id), ['owner-step', 'note-1']);
    assert.throws(() => f.history.reportPlan(f.projectId, id, ['Replace assessment'], assessment), /once/);
  } finally { f.close(); }
});

test('Code pickup may conclude no journey applies and keep a plain task free of invented claims', () => {
  const f = fixture();
  try {
    codeApp(f);
    const { work, issue } = f.start(null, [], null, { layer: 'platform', layerScoped: true, checks: [] });
    const id = issue.native_ref.attempt_id;
    const result = f.history.reportPlan(f.projectId, id, ['Review documentation links'], { reason: 'Documentation only; review the changed text and checked links', journeys: [] });
    assert.deepEqual(result.claims, []);
    assert.deepEqual(f.worker.taskOpen(f.scope, issue.native_ref.bundle_digest).task.claims, []);
    assert.deepEqual(f.know.workById(f.projectId, work.id).checks, []);
    assert.equal(f.history.runFor(f.projectId, work.id, id).task.journeyAssessment.journeys.length, 0);
  } finally { f.close(); }
});
