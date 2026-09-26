import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
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
import { initWorkflow } from '../server/workflow.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-proposal-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db);
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
  return { root, db, know, owner, projectId, profile, worker, scope, credential, runs, start, workspace,
    close: () => { db.close(); rmSync(root, { recursive: true, force: true }); } };
}
test('runtime error event blocks the item with a retry reason', () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('product.brief');
    f.worker.appendEvent(f.scope, { attemptId: issue.native_ref.attempt_id, eventId: 'runtime-error', kind: 'error', message: 'Codex authentication is unavailable.' });
    const blocked = f.know.workById(f.projectId, work.id);
    assert.equal(blocked.status, 'blocked');
    assert.deepEqual(blocked.context.executionBlock, { code: 'runtime-error', reason: 'Codex authentication is unavailable.', recovery: 'retry' });
    assert.equal(f.worker.attemptStatus(f.scope, issue.native_ref.attempt_id).state, 'blocked');
  } finally { f.close(); }
});


test('Vision uses Symphony only, submits a read-only claim, then exact lead acceptance applies it once', () => {
  const f = fixture();
  try {
    const { work, issue, card } = f.start('product.brief');
    assert.equal(card.outputs[0].kind, 'vision_claim_proposal');
    assert.equal(card.capabilities.submit, 'work_proposal');
    const before = f.know.briefRevision(f.projectId);
    const proposal = { summary: 'A concise value proposition based on current project intent.',
      content: { section: 'value', text: 'Borrow useful tools from nearby neighbours.', note: 'Promise to validate with interviews.', basis: 'The project pitch describes local tool sharing.' }, usedInputs: [] };
    assert.throws(() => f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id,
      proposal: { ...proposal, content: { ...proposal.content, section: 'invalid' } } }), /Vision proposal/);
    const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
    assert.equal(f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal }).proposalId, submitted.proposalId);
    assert.equal(f.know.briefRevision(f.projectId), before);
    assert.equal(f.know.workById(f.projectId, work.id).state, 'review');
    assert.throws(() => f.runs.acceptBrief(f.owner, f.projectId, work.id, submitted.proposalId), /check/);
    f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
    const accepted = f.runs.acceptBrief(f.owner, f.projectId, work.id, submitted.proposalId);
    assert.equal(accepted.claim.text, proposal.content.text);
    assert.equal(f.know.briefRevision(f.projectId), before + 1);
    assert.equal(f.runs.acceptBrief(f.owner, f.projectId, work.id, submitted.proposalId).claim.id, accepted.claim.id);
  } finally { f.close(); }
});

test('Data contract proposal changes its target only after checked acceptance', () => {
  const f = fixture();
  try {
    const target = f.know.insert(f.projectId, 'data_object', { name: 'Tool', description: 'A lent item.' }, { author: f.owner.name });
    const { work, issue, card } = f.start('data.contract', [{ id: target.id, label: target.name }]);
    assert.equal(card.requiredInputs[0].revision, target.revision);
    const proposal = { summary: 'Define the fields needed to identify and borrow a tool.', content: {
      description: 'A shareable item owned by one neighbour.', fields: [
        { name: 'label', type: 'string', required: true, description: 'Owner-facing name' },
        { name: 'available', type: 'boolean', required: true, description: 'Whether it can be borrowed' }], states: ['available', 'borrowed'] },
      usedInputs: [{ id: target.id, revision: target.revision }] };
    const result = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
    assert.equal(f.know.get(f.projectId, target.id).revision, target.revision);
    assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, result.proposalId), /check/);
    f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
    f.worker.acceptProposal(f.owner, f.projectId, work.id, result.proposalId);
    const revised = f.know.get(f.projectId, target.id);
    assert.equal(revised.revision, target.revision + 1);
    assert.equal(revised.schema.properties.available.type, 'boolean');
    assert.equal(f.know.workById(f.projectId, work.id).state, 'done');
  } finally { f.close(); }
});

test('Acceptance criteria remain a proposal until lead review, then revise the pinned story', () => {
  const f = fixture();
  try {
    const story = f.know.list(f.projectId, 'story')[0] || f.know.insert(f.projectId, 'story', { title: 'Borrow a tool', phase: 'demo' });
    const { work, issue } = f.start('product.define', [{ id: story.id, label: story.title }]);
    const scenario = { given: 'A tool is available', when: 'I request it', then: 'The owner sees my request' };
    const proposal = { summary: 'Check that a borrower can request an available tool.',
      content: { scenarios: [scenario], edges: ['Tool already borrowed'], questions: [] },
      usedInputs: [{ id: story.id, revision: story.revision }] };
    const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
    assert.equal(f.know.get(f.projectId, story.id).revision, story.revision);
    assert.throws(() => f.know.updateWork(f.owner, f.projectId, work.id, { state: 'done' }), /exact Work proposal/);
    f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
    f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId);
    const revised = f.know.get(f.projectId, story.id);
    assert.equal(revised.revision, story.revision + 1);
    assert.equal(revised.acceptance.at(-1).then, scenario.then);
    assert.equal(f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId).proposalId, submitted.proposalId);
  } finally { f.close(); }
});

test('Vision send-back and changed Brief do not apply a stale Symphony proposal', () => {
  const f = fixture();
  try {
    const { work, issue } = f.start('product.brief');
    const proposal = { summary: 'Propose a first value claim for review.',
      content: { section: 'value', text: 'Borrow useful tools nearby.', note: '', basis: 'Local tool sharing is the stated product idea.' }, usedInputs: [] };
    const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
    f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'reject', note: 'State who benefits.' } });
    f.know.updateWork(f.owner, f.projectId, work.id, { sendBack: true });
    f.worker.rejectProposal(f.projectId, work.id, submitted.proposalId);
    assert.equal(f.db.prepare('SELECT state FROM symphony_proposals WHERE id = ?').get(submitted.proposalId).state, 'rejected');
    assert.throws(() => f.runs.acceptBrief(f.owner, f.projectId, work.id, submitted.proposalId), /not waiting for review/);
    const second = f.start('product.brief');
    const next = f.worker.submitProposal(f.scope, { attemptId: second.issue.native_ref.attempt_id, proposal });
    f.know.updateWork(f.owner, f.projectId, second.work.id, { verdict: { index: 0, value: 'accept' } });
    f.know.insert(f.projectId, 'brief_claim', { section: 'value', text: 'Owner changed the Brief.', note: '' }, { author: f.owner.name });
    assert.throws(() => f.runs.acceptBrief(f.owner, f.projectId, second.work.id, next.proposalId), /Brief changed/);
  } finally { f.close(); }
});

test('worker HTTP proposal route accepts only its scoped token and current attempt', async () => {
  const f = fixture();
  const { issue } = f.start('product.brief');
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const portal = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, MACHINE_DATA_DIR: f.root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: 'ignore' });
  try {
    const origin = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let tries = 0; tries < 100 && !ready; tries++) {
      try { ready = (await fetch(origin + '/api/session')).ok; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.ok(ready);
    const path = `/api/worker/attempts/${issue.native_ref.attempt_id}/proposal`;
    const proposal = { summary: 'Local value claim for the product owner to review.',
      content: { section: 'value', text: 'Borrow useful tools nearby.', note: '', basis: 'The product pitch describes sharing.' }, usedInputs: [] };
    const denied = await fetch(origin + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proposal }) });
    assert.equal(denied.status, 401);
    const accepted = await fetch(origin + path, { method: 'POST', headers: { authorization: `Bearer ${f.credential}`, 'content-type': 'application/json' }, body: JSON.stringify({ proposal }) });
    assert.equal(accepted.status, 200, await accepted.clone().text());
    assert.ok((await accepted.json()).proposalId);
  } finally { portal.kill(); await new Promise(resolve => portal.once('exit', resolve)); f.close(); }
});

test('clarification question and options travel through the Symphony card and review', () => {
  const f = fixture();
  try {
    const question = { text: 'Which tool-sharing request should a borrower start with?', options: [], reasoning: 'The first flow is unclear.' };
    const { work, issue, card } = f.start('product.clarify', [], question);
    assert.equal(card.task.openQuestion, question.text);
    const proposal = { summary: 'Give the owner three distinct entry points for the request.', content: {
      options: ['A tool listing', 'A neighbour profile', 'A borrow request'], recommendation: 'A tool listing',
      reasoning: 'A listing identifies the item before a conversation starts.' }, usedInputs: [] };
    const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
    assert.equal(f.know.workById(f.projectId, work.id).question.options.length, 0);
    f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
    f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId);
    const accepted = f.know.workById(f.projectId, work.id);
    assert.deepEqual(accepted.question.options, proposal.content.options);
    assert.equal(accepted.question.recommendation, 'A tool listing');
  } finally { f.close(); }
});

test('Design, Pages, Deploy, and Work review reports use explicit read-only Symphony adapters', () => {
  const f = fixture();
  try {
    for (const action of ['design.audit', 'pages.a11y', 'deploy.review', 'work.review']) {
      const { work, issue, card } = f.start(action);
      assert.equal(card.outputs[0].kind, 'review_report');
      assert.equal(card.capabilities.repository, 'read-only pinned commit');
      const before = f.know.list(f.projectId, 'brief_claim').map(claim => [claim.id, claim.revision]);
      const proposal = { summary: `Review the current ${action} scope and report findings.`, content: {
        scope: 'Pinned project workspace and the relevant current project knowledge.',
        findings: [{ title: 'Missing evidence', evidence: 'The task has no linked proof for this check.', recommendation: 'Attach a source before release.' }],
        uncertainty: 'A person should confirm the intended scope.' }, usedInputs: [] };
      assert.throws(() => f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id,
        proposal: { ...proposal, content: { findings: [] } } }), /Review report/);
      const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
      assert.equal(f.know.workById(f.projectId, work.id).state, 'review');
      assert.deepEqual(f.know.list(f.projectId, 'brief_claim').map(claim => [claim.id, claim.revision]), before);
      const checks = f.know.workById(f.projectId, work.id).checks;
      for (let index = 0; index < checks.length; index++) f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index, value: 'accept' } });
      assert.equal(f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId).work.state, 'done');
      assert.deepEqual(f.know.list(f.projectId, 'brief_claim').map(claim => [claim.id, claim.revision]), before);
    }
  } finally { f.close(); }
});

test('Work staging keeps personal work separate, blocks unsupported actions, and pins a manual brief for Symphony', () => {
  const f = fixture();
  try {
    const personal = f.know.createWork(f.projectId, { action: 'work.milestone', title: 'Plan the next checkpoint',
      assignee: { kind: 'person', id: f.owner.id } }, f.owner.name);
    if (personal.state === 'suggested') f.know.updateWork(f.owner, f.projectId, personal.id, { state: 'ready' });
    const stagedPerson = f.runs.stage(f.owner, f.projectId, personal.id);
    assert.equal(stagedPerson.context.staged, true);
    assert.equal(stagedPerson.context.batch, undefined);
    assert.equal(f.runs.unstage(f.owner, f.projectId, personal.id).status, 'queued');

    const unsupported = f.know.createWork(f.projectId, { action: 'pages.design', title: 'Draw a page',
      assignee: { kind: 'agent', id: f.profile.id } }, f.owner.name);
    if (unsupported.state === 'suggested') f.know.updateWork(f.owner, f.projectId, unsupported.id, { state: 'ready' });
    assert.throws(() => f.runs.stage(f.owner, f.projectId, unsupported.id), /Agents can't run/);

    const claim = f.know.createWork(f.projectId, { action: 'product.brief', title: 'Write the value claim',
      assignee: { kind: 'agent', id: f.profile.id }, context: { suggestion: 'Focus on neighbours who need a tool for one afternoon.' },
      checks: ['The claim says who benefits'] }, f.owner.name);
    if (claim.state === 'suggested') f.know.updateWork(f.owner, f.projectId, claim.id, { state: 'ready' });
    f.know.updateWork(f.owner, f.projectId, personal.id, { blocks: [claim.id] });
    assert.throws(() => f.runs.stage(f.owner, f.projectId, claim.id), /blocked by W-/);
    f.know.updateWork(f.owner, f.projectId, personal.id, { blocks: [] });
    const staged = f.runs.stage(f.owner, f.projectId, claim.id);
    const batch = f.runs.view(f.projectId).find(value => value.id === staged.context.batch);
    assert.equal(batch.profileId, f.profile.id);
    const moved = f.runs.reassign(f.owner, f.projectId, claim.id, { kind: 'person', id: f.owner.id });
    assert.equal(moved.context.staged, true);
    assert.equal(moved.context.batch, undefined);
    f.runs.reassign(f.owner, f.projectId, claim.id, { kind: 'agent', id: f.profile.id });
    const ready = f.runs.view(f.projectId).find(value => value.state === 'draft' && value.items.includes(claim.id));
    assert.equal(f.runs.start(f.owner, f.projectId, ready.id).job, null);
    assert.equal(f.db.prepare('SELECT execution_kind FROM agent_batches WHERE id = ?').get(ready.id).execution_kind, 'symphony');
    const issue = f.worker.issues(f.scope, { states: ['Ready'] }).issues.find(value => value.native_ref.work_id === claim.id);
    assert.ok(issue);
    const card = f.worker.taskOpen(f.scope, issue.native_ref.bundle_digest);
    assert.match(card.task.brief, /one afternoon/);
    assert.equal(card.task.action.id, 'product.brief');
    assert.throws(() => f.runs.unstage(f.owner, f.projectId, claim.id), /locked in/);
  } finally { f.close(); }
});

test('a project with Symphony dispatch disabled cannot fall back to the legacy model caller', () => {
  const f = fixture();
  try {
    const alternate = agentRuns({ db: f.db, know: f.know, secrets: openSecretStore(f.root), providers: loadCatalogs(new URL('../config', import.meta.url).pathname).agentProviders.providers,
      worker: f.worker, symphonyDispatch: false, callModel: async () => { throw new Error('Legacy caller reached'); } });
    const item = f.know.createWork(f.projectId, { action: 'product.brief', title: 'Value claim',
      assignee: { kind: 'agent', id: f.profile.id } }, f.owner.name);
    if (item.state === 'suggested') f.know.updateWork(f.owner, f.projectId, item.id, { state: 'ready' });
    assert.throws(() => alternate.stage(f.owner, f.projectId, item.id), /Agents can't run/);
  } finally { f.close(); }
});
