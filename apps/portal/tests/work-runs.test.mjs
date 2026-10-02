import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns } from '../server/agent-runs.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
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
  const start = (action, targets = [], question = null) => {
    const work = know.createWork(projectId, { action, title: `Test ${action}`, assignee: { kind: 'agent', id: profile.id }, targets,
      checks: ['The proposed output is accurate'], ...(question ? { question } : {}) }, owner.name);
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

test('evidence names a given criterion and a change, test or thing to try; unmatched references stay visible', () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('product.brief');
    const attemptId = issue.native_ref.attempt_id;
    assert.throws(() => f.history.checkEvidence(f.projectId, attemptId, [{ criterion: 3, type: 'change', ref: 'x' }]), /criterion this run was given/);
    assert.throws(() => f.history.checkEvidence(f.projectId, attemptId, [{ criterion: 0, type: 'check', ref: 'scope' }]), /Aludel adds its own checks/);
    const evidence = f.history.checkEvidence(f.projectId, attemptId, [
      { criterion: 0, type: 'change', ref: 'Vision › Brief › Value', note: 'One sentence' },
      { criterion: 0, type: 'test', ref: 'claim is short' }]);
    f.worker.submitProposal(f.scope, { attemptId, proposal: claim('A pet in the corner of your screen.') });
    f.history.recordEvidence(attemptId, evidence);
    const [run] = f.history.list(f.projectId, work.id);
    assert.equal(run.evidence.length, 2);
    assert.equal(run.evidence[0].found, true);
    assert.equal(run.evidence[0].target, `change:${run.changes[0].id}`);
    assert.equal(run.evidence[1].found, false, 'a test the submission does not contain is shown as not found');
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
      summary: 'Defined a concrete checkpoint outcome.', evidence: [{ criterion: 0, note: 'Review the outcome named in the project plan.' }] });
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
      summary: 'Added the checkpoint date.', evidence: [{ criterion: 0, note: 'Review the dated checkpoint outcome.' }] });
    f.history.saveReview(f.projectId, work.id, second.id, { verdict: { index: 0, value: 'accept' } });
    const signed = await f.history.sign(f.owner, f.projectId, work.id, second.id, { outcome: 'accept', comment: 'Clear.' }, {
      accept: () => f.know.updateWork(f.owner, f.projectId, work.id, { state: 'done' }),
    });
    assert.equal(signed.state, 'accepted');
    assert.equal(f.know.workById(f.projectId, work.id).state, 'done');
  } finally { f.close(); }
});
