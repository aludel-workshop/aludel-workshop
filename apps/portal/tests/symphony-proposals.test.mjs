import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns } from '../server/agent-runs.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { initPagesCodeObservations, recordCodeRouteObservation, proposePagesObservationRelation, reviewPagesObservationRelation, stagePagesFlowFromObservation } from '../server/pages-code-observations.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initSymphonyWorker, symphonyWorker } from '../server/symphony-worker.mjs';
import { initActionMigration, migrateActionProject } from '../server/lat08-migration.mjs';
import { stageLayerDiscovery } from '../server/layer-discovery.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { initWorkRuns, workRuns } from '../server/work-runs.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-proposal-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initLayerContract(db); initPagesLayerApp(db); initPagesCodeObservations(db); initAgentRuns(db); initSymphonyWorker(db); initWorkRuns(db);
  const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const owner = createUser(db, { email: 'owner@example.com', name: 'Owner', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Proposal Test', pitch: 'A disposable product.' });
  const projectId = flows.claimDraft(token, owner, owner).project.id;
  initLayerContract(db);
  know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
  know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
  const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
  mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q');
  writeFileSync(join(workspace, 'README.md'), 'Pinned base\n');
  mkdirSync(join(workspace, 'src/routes'), { recursive: true });
  writeFileSync(join(workspace, 'src/routes/browse.ts'), "export const browseRoute = '/browse';\n");
  git(workspace, 'add', '.');
  git(workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
  const profile = know.defaultProfile(projectId);
  know.update(projectId, profile.id, { model: '', effort: 'medium' }, { rationale: 'Legacy profile-scoped worker fixture has no per-turn override signal' });
  const workerRoot = join(root, 'worker'); mkdirSync(workerRoot);
  const worker = symphonyWorker({ db, know, workspaceRoot: workerRoot });
  const credential = worker.issueToken(owner, projectId, profile.id).token;
  const scope = worker.authenticate('Bearer ' + credential);
  const runs = agentRuns({ db, know, secrets: openSecretStore(root), providers: catalogs.agentProviders.providers, worker, symphonyDispatch: true,
    callModel: async () => { throw new Error('Legacy model caller must never run'); } });
  const start = (action, targets = [], question = null, context = null, deferRun = false, existing = null) => {
    const work = existing || know.createWork(projectId, { action, title: `Test ${action}`, assignee: { kind: 'agent', id: profile.id }, targets,
      checks: ['The proposed output is accurate'], ...(question ? { question } : {}), ...(context ? { context } : {}) }, owner.name);
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
    if (!deferRun) {
      worker.registerWorkspace(scope, { attemptId: issue.native_ref.attempt_id, path: clone });
      worker.reserveRun(scope, { attemptId: issue.native_ref.attempt_id });
    }
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


test('Pages-origin Work pins reviewed policy and applies a proposed flow only after checked acceptance', () => {
  const f = fixture();
  try {
    const story = f.know.insert(f.projectId, 'story', { title: 'Find a route', phase: 'demo' });
    const page = f.know.insert(f.projectId, 'page', { label: 'Find', icon: 'article', pageType: 'detail', status: 'planned' });
    f.db.prepare(`INSERT INTO layer_connections(id,project_id,receiving_key,source_key,status,mapping,instructions,reaction,question,answer,revision,reviewed_by,reviewed_at,updated_at)
      VALUES ('policy',?,'pages','product','active','flow-candidate','','','','',2,?,?,?)`).run(f.projectId, f.owner.id, new Date().toISOString(), new Date().toISOString());
    const context = { routine: 'rtn-pages', gap: `pages:flow-story:${story.id}`, receipt: 'receipt-1', policy: { id: 'policy', revision: 2 }, source: { id: story.id, revision: story.revision } };
    const { work, issue, card } = f.start('pages.flows', [{ id: story.id, kind: 'story', label: story.title }], null, context);
    assert.equal(card.outputs[0].kind, 'pages_flow_proposal');
    assert.deepEqual(card.controls, [context.policy]);
    assert.equal(card.origin.gapKey, context.gap);
    const proposal = { summary: 'Map the find route story through its existing page.', content: {
      title: 'Find route', steps: [{ page: page.id, story: story.id, name: 'Find', trigger: 'Open search' }] },
      usedInputs: [{ id: story.id, revision: story.revision }, { id: page.id, revision: page.revision }] };
    assert.throws(() => f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal: { ...proposal, usedInputs: proposal.usedInputs.slice(0, 1) } }), /each Pages step page/);
    const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
    assert.equal(f.know.list(f.projectId, 'flow').length, 0);
    assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /check/);
    f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
    f.db.prepare("UPDATE layer_connections SET revision = 3 WHERE id = 'policy'").run();
    assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /policy changed/);
    assert.equal(f.know.list(f.projectId, 'flow').length, 0);
    f.db.prepare("UPDATE layer_connections SET revision = 2 WHERE id = 'policy'").run();
    f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId);
    const flow = f.know.list(f.projectId, 'flow')[0];
    assert.equal(flow.steps[0].story, story.id);
    assert.equal(flow.steps[0].page, page.id);
    assert.equal(f.know.workById(f.projectId, work.id).state, 'done');
  } finally { f.close(); }
});


test('a direct Pages request without Vision reaches the same Go, proposal and checked review boundary', () => {
  const f = fixture();
  try {
    f.db.prepare("UPDATE layer_instances SET enabled = 0 WHERE project_id = ? AND layer_key = 'product'").run(f.projectId);
    assert.equal(f.db.prepare("SELECT enabled FROM layer_instances WHERE project_id = ? AND layer_key = 'product'").get(f.projectId).enabled, 0);
    const page = f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list', status: 'planned' });
    const { work, issue, card } = f.start('pages.flows');
    assert.deepEqual(card.requiredInputs, []);
    assert.deepEqual(card.controls, []);
    const proposal = { summary: 'Map a direct browse journey through the existing page.', content: {
      title: 'Browse', steps: [{ page: page.id, name: 'Browse tools', trigger: 'Open browse' }] },
      usedInputs: [{ id: page.id, revision: page.revision }] };
    assert.throws(() => f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id,
      proposal: { ...proposal, content: { ...proposal.content, steps: [{ ...proposal.content.steps[0], story: 'sto-unpinned' }] } } }), /Pages flow proposal/);
    assert.throws(() => f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id,
      proposal: { ...proposal, usedInputs: [] } }), /each Pages step page/);
    const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
    assert.equal(f.know.list(f.projectId, 'flow').length, 0);
    assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /check/);
    f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
    const accepted = f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId);
    const flow = f.know.get(f.projectId, accepted.flowId);
    assert.equal(flow.steps[0].page, page.id);
    assert.equal(flow.steps[0].story, null);
    assert.equal(f.know.workById(f.projectId, work.id).state, 'done');
  } finally { f.close(); }
});

test('pinned Code route observation can yield a reviewed Pages flow; wrong relation retains its source', () => {
  const f = fixture();
  try {
    f.db.prepare("UPDATE layer_instances SET enabled = 0 WHERE project_id = ? AND layer_key = 'product'").run(f.projectId);
    const observed = recordCodeRouteObservation(f.db, f.owner.id, f.projectId, f.workspace,
      { path: 'src/routes/browse.ts', marker: "export const browseRoute = '/browse';", route: '/browse' });
    assert.match(observed.commit, /^[a-f0-9]{40}$/);
    const wrong = proposePagesObservationRelation(f.db, f.owner.id, f.projectId, observed.id, 'This route might be an admin workflow.');
    const rejected = reviewPagesObservationRelation(f.db, f.owner.id, f.projectId, wrong.id,
      { expectedRevision: 1, verdict: 'wrong', reason: 'The route does not show the visitor journey.' });
    assert.equal(rejected.observation_id, observed.id);
    assert.throws(() => stagePagesFlowFromObservation(f.db, f.know, f.owner.id, f.projectId, wrong.id), /useful/);
    const useful = proposePagesObservationRelation(f.db, f.owner.id, f.projectId, observed.id, 'Review the route as a possible visitor path.');
    reviewPagesObservationRelation(f.db, f.owner.id, f.projectId, useful.id,
      { expectedRevision: 1, verdict: 'useful', reason: 'The pinned route warrants a separate Pages intent review.' });
    const suggested = stagePagesFlowFromObservation(f.db, f.know, f.owner.id, f.projectId, useful.id);
    assert.equal(stagePagesFlowFromObservation(f.db, f.know, f.owner.id, f.projectId, useful.id).id, suggested.id);
    f.know.updateWork(f.owner, f.projectId, suggested.id, { state: 'ready' });
    f.know.updateWork(f.owner, f.projectId, suggested.id, { assignee: { kind: 'agent', id: f.profile.id } });
    const page = f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list', status: 'planned' });
    const { work, issue, card } = f.start('pages.flows', [], null, null, false, f.know.workById(f.projectId, suggested.id));
    assert.equal(card.origin.kind, 'code-route-observation');
    assert.equal(card.origin.observation.repositoryCommit, observed.commit);
    assert.equal(card.origin.relation.id, useful.id);
    const proposal = { summary: 'Review an intended browse journey through the existing page.', content: {
      title: 'Browse', steps: [{ page: page.id, name: 'Browse tools' }] },
      usedInputs: [{ id: page.id, revision: page.revision }] };
    const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
    assert.equal(f.know.list(f.projectId, 'flow').length, 0);
    f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
    const accepted = f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId);
    assert.ok(accepted.flowId);
    assert.equal(f.know.get(f.projectId, accepted.flowId).steps[0].story, null);
    assert.equal(f.db.prepare('SELECT status FROM pages_observation_relations WHERE id = ?').get(wrong.id).status, 'wrong');
  } finally { f.close(); }
});

test('a changed Code relation withdraws the pinned attempt and prevents stale flow acceptance', () => {
  const f = fixture();
  try {
    const observed = recordCodeRouteObservation(f.db, f.owner.id, f.projectId, f.workspace,
      { path: 'src/routes/browse.ts', marker: "export const browseRoute = '/browse';", route: '/browse' });
    const relation = proposePagesObservationRelation(f.db, f.owner.id, f.projectId, observed.id, 'Possible visitor route.');
    reviewPagesObservationRelation(f.db, f.owner.id, f.projectId, relation.id,
      { expectedRevision: 1, verdict: 'useful', reason: 'Review as a candidate, not as accepted intent.' });
    const suggested = stagePagesFlowFromObservation(f.db, f.know, f.owner.id, f.projectId, relation.id);
    f.know.updateWork(f.owner, f.projectId, suggested.id, { state: 'ready' });
    f.know.updateWork(f.owner, f.projectId, suggested.id, { assignee: { kind: 'agent', id: f.profile.id } });
    const page = f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list', status: 'planned' });
    const { work, issue } = f.start('pages.flows', [], null, null, false, f.know.workById(f.projectId, suggested.id));
    const proposal = { summary: 'Map a visitor browse flow from the existing page.', content: {
      title: 'Browse', steps: [{ page: page.id, name: 'Browse tools' }] },
      usedInputs: [{ id: page.id, revision: page.revision }] };
    const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal });
    f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
    reviewPagesObservationRelation(f.db, f.owner.id, f.projectId, relation.id,
      { expectedRevision: 2, verdict: 'wrong', reason: 'The observed route does not express the intended visitor path.' });
    assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /Code relation changed/);
    assert.equal(f.know.list(f.projectId, 'flow').length, 0);
    assert.equal(f.know.workById(f.projectId, work.id).state, 'review');
  } finally { f.close(); }
});

test('two hosts racing for one Go-pinned attempt have one workspace claim and one runnable owner', async () => {
  const f = fixture();
  try {
    const { issue, clone } = f.start('product.brief', [], null, null, true);
    const attemptId = issue.native_ref.attempt_id;
    const hosts = ['host-a', 'host-b'];
    const outcomes = await Promise.allSettled(hosts.map(hostId => Promise.resolve().then(() =>
      f.worker.registerWorkspace(f.scope, { attemptId, path: clone, hostId }))));
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(result => result.status === 'rejected' && result.reason.status === 409).length, 1);
    const winner = hosts[outcomes.findIndex(result => result.status === 'fulfilled')];
    const loser = hosts.find(host => host !== winner);
    assert.throws(() => f.worker.reserveRun(f.scope, { attemptId, hostId: loser }), /claimed by another host/);
    assert.equal(f.worker.reserveRun(f.scope, { attemptId, hostId: winner }).runsStarted, 1);
    assert.equal(f.worker.attemptStatus(f.scope, attemptId).state, 'working');
  } finally { f.close(); }
});


test('layer discovery Go submits reviewed receiving policies without activating them', () => {
  const f=fixture();
  try {
    initActionMigration(f.db); migrateActionProject(f.db,f.projectId);
    const staged=stageLayerDiscovery(f.db,f.know,f.projectId);
    const discovery=staged.find(item=>item.layer==='product');
    assert.ok(discovery);
    assert.equal(discovery.assignee?.kind,'agent');
    const {work,issue,card}=f.start('product.discover',[],null,null,false,discovery);
    assert.equal(card.outputs[0].kind,'layer_connection_proposal');
    assert.deepEqual(card.origin.discovery.sourceKeys.slice().sort(),['data','deploy','design','pages','platform']);
    const connections=card.origin.discovery.sourceKeys.map(sourceKey=>({sourceKey,mapping:'reference-only',
      instructions:`Inspect ${sourceKey} outputs as evidence for Vision.`,reaction:'Reassess when its outputs change.',
      evidence:`${sourceKey} declared outputs and pinned source snapshot were inspected.`}));
    const proposal={summary:'Propose bounded receiving policies for all installed neighbors.',content:{connections},usedInputs:[]};
    const submitted=f.worker.submitProposal(f.scope,{attemptId:issue.native_ref.attempt_id,proposal});
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM layer_connections WHERE project_id=? AND receiving_key='product'").get(f.projectId).n,0);
    assert.throws(()=>f.worker.acceptProposal(f.owner,f.projectId,work.id,submitted.proposalId),/check/);
    for(let index=0;index<f.know.workById(f.projectId,work.id).checks.length;index++)
      f.know.updateWork(f.owner,f.projectId,work.id,{verdict:{index,value:'accept'}});
    f.worker.acceptProposal(f.owner,f.projectId,work.id,submitted.proposalId);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM layer_connections WHERE project_id=? AND receiving_key='product' AND status='proposed'").get(f.projectId).n,5);
    assert.equal(f.know.workById(f.projectId,work.id).state,'done');
  } finally { f.close(); }
});

test('discovery knowledge gateway follows the installed layer graph', () => {
  const f=fixture();
  try {
    f.db.prepare("UPDATE layer_instances SET enabled=0 WHERE project_id=? AND layer_key NOT IN ('product','pages')").run(f.projectId);
    initActionMigration(f.db);migrateActionProject(f.db,f.projectId);
    const discovery=stageLayerDiscovery(f.db,f.know,f.projectId).find(item=>item.layer==='product');
    const {issue,card}=f.start('product.discover',[],null,null,false,discovery);
    assert.deepEqual(card.origin.discovery.sourceKeys,['pages']);
    const kinds=f.worker.knowledgeMap(f.scope,issue.native_ref.bundle_digest).kinds.map(entry=>entry.kind);
    assert.ok(kinds.includes('page'));
    assert.ok(kinds.includes('story'));
    assert.equal(kinds.includes('data_object'),false);
    assert.throws(()=>f.worker.knowledgeSearch(f.scope,issue.native_ref.bundle_digest,'object','data_object'),/Invalid knowledge search/);
  } finally {f.close();}
});

test('Pages flow task includes exact installed layer method and repository Knowledge alongside the same pinned targets', async () => {
  const data = mkdtempSync(join(tmpdir(), 'aludel-pages-context-'));
  const oldData = process.env.MACHINE_DATA_DIR;
  const oldTemplates = process.env.MACHINE_PAGES_TEMPLATE_ENABLED;
  process.env.MACHINE_DATA_DIR = data;
  process.env.MACHINE_PAGES_TEMPLATE_ENABLED = '1';
  let f;
  try {
    f = fixture();
    const story = f.know.insert(f.projectId, 'story', { title: 'Find a useful page', phase: 'demo' });
    const { work, card, issue } = f.start('pages.flows', [{ id: story.id, kind: 'story', label: story.title }]);
    assert.equal(card.requiredInputs[0].id, story.id);
    assert.equal(card.requiredInputs[0].revision, story.revision);
    assert.equal(card.layerSource.key, 'pages');
    assert.match(card.layerSource.instanceId, /^[0-9a-f-]{36}$/);
    assert.match(card.layerSource.commit, /^[0-9a-f]{40}$/);
    assert.match(card.layerSource.charter, /start directly in Pages without Vision/);
    assert.ok(card.layerSource.documents.some(doc => doc.path === 'knowledge/flow-method.md' && /exact revision/.test(doc.markdown)));
    assert.equal(card.layerMethod.actionId, 'pages.flows');
    assert.match(card.layerMethod.text, /For a new flow/);
    const bundle = f.worker.saved(f.scope, issue.native_ref.bundle_digest);
    assert.equal(bundle.layerPackage.commit, card.layerSource.commit);
    assert.equal(bundle.layerPackage.instanceId, card.layerSource.instanceId);
    assert.equal(bundle.guidance.layerAction.method, card.layerMethod.text);
    const baselineSource = execFileSync('git', ['show', 'f6adc8e813aead602304080e1f0e18584e84d66d:apps/portal/server/task-manifest.mjs'],
      { cwd: new URL('../../', import.meta.url).pathname, encoding: 'utf8' });
    const oldCompilerPath = join(data, 'old-task-manifest.mjs');
    writeFileSync(oldCompilerPath, baselineSource);
    const { compileTaskManifest: compileBefore } = await import(pathToFileURL(oldCompilerPath).href);
    const oldCard = compileBefore(bundle);
    assert.deepEqual(card.requiredInputs, oldCard.requiredInputs);
    assert.deepEqual(card.outputs, oldCard.outputs);
    assert.deepEqual(card.controls, oldCard.controls);
    assert.deepEqual(card.capabilities, oldCard.capabilities);
    assert.equal(oldCard.layerSource, undefined);
    assert.equal(oldCard.layerMethod, undefined);
    const existingPage = f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list', status: 'planned' });
    const existingFlow = f.know.insert(f.projectId, 'flow', { title: 'Browse journey', steps: [{ page: existingPage.id, name: 'Browse' }] });
    const modify = f.know.createWork(f.projectId, { action: 'pages.flows', title: 'Modify the existing flow',
      assignee: { kind: 'agent', id: f.profile.id }, targets: [{ id: existingFlow.id, kind: 'flow', label: existingFlow.title }],
      checks: ['Preserve the flow identity and explain the changed steps'] }, f.owner.name);
    if (modify.state === 'suggested') f.know.updateWork(f.owner, f.projectId, modify.id, { state: 'ready' });
    assert.equal(f.runs.stage(f.owner, f.projectId, modify.id).context.batch !== undefined, true,
      'an existing flow can be staged without a Vision story');
    assert.ok(f.worker.current(f.scope, work.id));
    f.db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'pages'")
      .run('aabcfff1f457f8fe4517ea4ec8aef23263e38371', f.projectId);
    assert.equal(f.worker.current(f.scope, work.id), null, 'a Pages package repin withdraws the prior task context');
  } finally {
    f?.close();
    rmSync(data, { recursive: true, force: true });
    if (oldData === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = oldData;
    if (oldTemplates === undefined) delete process.env.MACHINE_PAGES_TEMPLATE_ENABLED; else process.env.MACHINE_PAGES_TEMPLATE_ENABLED = oldTemplates;
  }
});


test('a flow-only Pages task reviews Previous/Proposed and atomically revises one existing flow', async () => {
  const data = mkdtempSync(join(tmpdir(), 'aludel-pages-revise-'));
  const oldData = process.env.MACHINE_DATA_DIR, oldTemplates = process.env.MACHINE_PAGES_TEMPLATE_ENABLED;
  process.env.MACHINE_DATA_DIR = data;
  process.env.MACHINE_PAGES_TEMPLATE_ENABLED = '1';
  let f;
  try {
    f = fixture();
    f.db.prepare("UPDATE layer_instances SET enabled = 0 WHERE project_id = ? AND layer_key = 'product'").run(f.projectId);
    const page = f.know.insert(f.projectId,'page',{label:'Browse',icon:'article',pageType:'list',status:'planned'});
    const second = f.know.insert(f.projectId,'page',{label:'Detail',icon:'article',pageType:'detail',status:'planned'});
    const flow = f.know.insert(f.projectId,'flow',{title:'Browse',steps:[{page:page.id,name:'Browse'}]});
    const {work,issue,card} = f.start('pages.flows',[{id:flow.id,kind:'flow',label:flow.title}]);
    assert.equal(card.requiredInputs[0].id,flow.id);
    assert.ok(card.requiredInputs.some(ref=>ref.id===page.id && ref.revision===page.revision));
    assert.match(card.guidance.method,/Vision story is optional/);
    assert.equal(card.outputs[0].kind,'pages_flow_proposal');
    const proposal = {summary:'Revise the existing browse flow with a missing decision page.',content:{title:'Browse and decide',steps:[
      {page:null,name:'Decision gap',why:'No decision page yet'},
      {page:second.id,name:'Inspect detail'}]},usedInputs:[
      {id:flow.id,revision:flow.revision},{id:page.id,revision:page.revision},{id:second.id,revision:second.revision}]};
    assert.throws(()=>f.worker.submitProposal(f.scope,{attemptId:issue.native_ref.attempt_id,proposal:{...proposal,usedInputs:proposal.usedInputs.slice(0,2)}}),/every referenced flow input/);
    const submitted=f.worker.submitProposal(f.scope,{attemptId:issue.native_ref.attempt_id,proposal});
    assert.equal(f.know.get(f.projectId,flow.id).revision,flow.revision);
    assert.equal(f.know.list(f.projectId,'flow').length,1);
    const history=workRuns({db:f.db,know:f.know});
    const reviewed=history.list(f.projectId,work.id)[0].changes[0];
    assert.equal(reviewed.kind,'flow-revision');
    assert.equal(JSON.parse(reviewed.before).title,'Browse');
    assert.equal(JSON.parse(reviewed.after).steps[0].page,null);
    assert.throws(()=>f.worker.acceptProposal(f.owner,f.projectId,work.id,submitted.proposalId),/check/);
    const signed=await history.sign(f.owner,f.projectId,work.id,issue.native_ref.attempt_id,{outcome:'accept',comment:'The gap is clear.'},
      {accept:()=>f.worker.acceptProposal(f.owner,f.projectId,work.id,submitted.proposalId)});
    assert.equal(signed.review.outcome,'accepted');
    assert.equal(f.know.get(f.projectId,flow.id).revision,flow.revision+1);
    assert.equal(f.know.list(f.projectId,'flow').length,1);
    assert.equal(f.know.workById(f.projectId,work.id).state,'done');
    assert.equal(f.db.prepare('SELECT work_item_id FROM knowledge_revisions WHERE record_id=? AND revision=?').get(flow.id,flow.revision+1).work_item_id,work.id);
    const recoveredWorker=symphonyWorker({db:f.db,know:f.know,workspaceRoot:join(f.root,'worker')});
    assert.equal(recoveredWorker.acceptProposal(f.owner,f.projectId,work.id,submitted.proposalId).proposalId,submitted.proposalId);
    assert.equal(f.db.prepare('SELECT count(*) AS count FROM knowledge_revisions WHERE record_id=?').get(flow.id).count,2);
  } finally {
    f?.close(); rmSync(data,{recursive:true,force:true});
    if (oldData===undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR=oldData;
    if (oldTemplates===undefined) delete process.env.MACHINE_PAGES_TEMPLATE_ENABLED; else process.env.MACHINE_PAGES_TEMPLATE_ENABLED=oldTemplates;
  }
});


test('revising a flow rejects changed source, foreign instance and stale page without partial acceptance', () => {
  const data = mkdtempSync(join(tmpdir(), 'aludel-pages-revise-stale-'));
  const oldData=process.env.MACHINE_DATA_DIR, oldTemplates=process.env.MACHINE_PAGES_TEMPLATE_ENABLED;
  process.env.MACHINE_DATA_DIR=data; process.env.MACHINE_PAGES_TEMPLATE_ENABLED='1';
  let f;
  try {
    f=fixture();
    const page=f.know.insert(f.projectId,'page',{label:'Browse',icon:'article',pageType:'list',status:'planned'});
    const flow=f.know.insert(f.projectId,'flow',{title:'Browse',steps:[{page:page.id,name:'Browse'}]});
    const {work,issue}=f.start('pages.flows',[{id:flow.id,kind:'flow',label:flow.title}]);
    const proposal={summary:'Revise the existing browse flow without a Vision story.',content:{title:'Browse again',steps:[{page:page.id,name:'Revised browse'}]},
      usedInputs:[{id:flow.id,revision:flow.revision},{id:page.id,revision:page.revision}]};
    const submitted=f.worker.submitProposal(f.scope,{attemptId:issue.native_ref.attempt_id,proposal});
    f.know.updateWork(f.owner,f.projectId,work.id,{verdict:{index:0,value:'accept'}});
    const newPin=JSON.parse(readFileSync(new URL('../config/layer-template-pins.json', import.meta.url),'utf8')).pages.commit, oldPin='e88409c78e790e8d4fdccc2ef4db043b6d3c39d3';
    f.db.prepare("UPDATE layer_package_bindings SET accepted_commit=? WHERE project_id=? AND layer_key='pages'").run(oldPin,f.projectId);
    assert.throws(()=>f.worker.acceptProposal(f.owner,f.projectId,work.id,submitted.proposalId),/installed source|source.*changed/);
    f.db.prepare("UPDATE layer_package_bindings SET accepted_commit=? WHERE project_id=? AND layer_key='pages'").run(newPin,f.projectId);
    const instance=f.db.prepare('SELECT layer_instance_id FROM knowledge_records WHERE id=?').get(flow.id).layer_instance_id;
    f.db.prepare('UPDATE knowledge_records SET layer_instance_id=? WHERE id=?').run('foreign-instance',flow.id);
    assert.throws(()=>f.worker.acceptProposal(f.owner,f.projectId,work.id,submitted.proposalId),/target changed|target flow|changed since/);
    f.db.prepare('UPDATE knowledge_records SET layer_instance_id=? WHERE id=?').run(instance,flow.id);
    f.know.update(f.projectId,page.id,{notes:'Page changed after proposal'},{expectedRevision:page.revision});
    assert.throws(()=>f.worker.acceptProposal(f.owner,f.projectId,work.id,submitted.proposalId),/used input changed/);
    assert.equal(f.know.get(f.projectId,flow.id).revision,flow.revision);
    assert.equal(f.know.workById(f.projectId,work.id).state,'review');
    assert.equal(f.db.prepare('SELECT state FROM symphony_proposals WHERE id=?').get(submitted.proposalId).state,'submitted');
    assert.equal(f.db.prepare('SELECT count(*) AS count FROM knowledge_revisions WHERE record_id=?').get(flow.id).count,1);
  } finally {
    f?.close(); rmSync(data,{recursive:true,force:true});
    if (oldData===undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR=oldData;
    if (oldTemplates===undefined) delete process.env.MACHINE_PAGES_TEMPLATE_ENABLED; else process.env.MACHINE_PAGES_TEMPLATE_ENABLED=oldTemplates;
  }
});


test('a cited persona revision is mandatory and stale persona denies flow acceptance', () => {
  const data=mkdtempSync(join(tmpdir(),'aludel-pages-revise-persona-'));
  const oldData=process.env.MACHINE_DATA_DIR, oldTemplates=process.env.MACHINE_PAGES_TEMPLATE_ENABLED;
  process.env.MACHINE_DATA_DIR=data; process.env.MACHINE_PAGES_TEMPLATE_ENABLED='1';
  let f;
  try {
    f=fixture();
    const persona=f.know.insert(f.projectId,'persona',{name:'Shopper'});
    const page=f.know.insert(f.projectId,'page',{label:'Browse',icon:'article',pageType:'list',status:'planned'});
    const flow=f.know.insert(f.projectId,'flow',{title:'Browse',persona:persona.id,steps:[{page:page.id,persona:persona.id,name:'Browse'}]});
    const {work,issue,card}=f.start('pages.flows',[{id:flow.id,kind:'flow',label:flow.title}]);
    assert.ok(card.requiredInputs.some(ref=>ref.id===persona.id && ref.revision===persona.revision));
    const proposal={summary:'Revise the flow while keeping the cited shopper persona.',content:{title:'Browse again',steps:[{page:page.id,persona:persona.id,name:'Browse again'}]},
      usedInputs:[{id:flow.id,revision:flow.revision},{id:page.id,revision:page.revision},{id:persona.id,revision:persona.revision}]};
    assert.throws(()=>f.worker.submitProposal(f.scope,{attemptId:issue.native_ref.attempt_id,proposal:{...proposal,usedInputs:proposal.usedInputs.slice(0,2)}}),/every referenced flow input/);
    const submitted=f.worker.submitProposal(f.scope,{attemptId:issue.native_ref.attempt_id,proposal});
    f.know.updateWork(f.owner,f.projectId,work.id,{verdict:{index:0,value:'accept'}});
    f.know.update(f.projectId,persona.id,{note:'Changed after submission'},{expectedRevision:persona.revision});
    assert.throws(()=>f.worker.acceptProposal(f.owner,f.projectId,work.id,submitted.proposalId),/used input changed/);
    assert.equal(f.know.get(f.projectId,flow.id).revision,flow.revision);
    assert.equal(f.know.workById(f.projectId,work.id).state,'review');
  } finally {
    f?.close(); rmSync(data,{recursive:true,force:true});
    if (oldData===undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR=oldData;
    if (oldTemplates===undefined) delete process.env.MACHINE_PAGES_TEMPLATE_ENABLED; else process.env.MACHINE_PAGES_TEMPLATE_ENABLED=oldTemplates;
  }
});

test('an existing-flow agent task waits for a reviewed Pages package but still needs no story', () => {
  const f=fixture();
  try {
    const page=f.know.insert(f.projectId,'page',{label:'Browse',icon:'article',pageType:'list',status:'planned'});
    const flow=f.know.insert(f.projectId,'flow',{title:'Browse',steps:[{page:page.id,name:'Browse'}]});
    const work=f.know.createWork(f.projectId,{action:'pages.flows',title:'Revise browse',
      assignee:{kind:'agent',id:f.profile.id},targets:[{id:flow.id,kind:'flow',label:flow.title}],checks:['Preserve the flow ID']},f.owner.name);
    if (work.state==='suggested') f.know.updateWork(f.owner,f.projectId,work.id,{state:'ready'});
    assert.throws(()=>f.runs.stage(f.owner,f.projectId,work.id),/Install a reviewed Pages package/);
    assert.equal(f.know.workById(f.projectId,work.id).state,'ready');
  } finally { f.close(); }
});

// ---- DEC-057: layer-scoped Work, elevated access and agent follow-ups ----
import { decideFollowUp, initLayerScope, layerAccess, setLayerDefaultAssignee, setLayerElevated } from '../server/layer-scope.mjs';

async function withPagesTemplate(run) {
  const data = mkdtempSync(join(tmpdir(), 'aludel-layer-scope-'));
  const oldData = process.env.MACHINE_DATA_DIR, oldTemplates = process.env.MACHINE_PAGES_TEMPLATE_ENABLED;
  process.env.MACHINE_DATA_DIR = data; process.env.MACHINE_PAGES_TEMPLATE_ENABLED = '1';
  let f;
  try { f = fixture(); initLayerScope(f.db); await run(f); } finally {
    f?.close(); rmSync(data, { recursive: true, force: true });
    if (oldData === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = oldData;
    if (oldTemplates === undefined) delete process.env.MACHINE_PAGES_TEMPLATE_ENABLED; else process.env.MACHINE_PAGES_TEMPLATE_ENABLED = oldTemplates;
  }
}
const addMember = (f, email) => {
  const user = createUser(f.db, { email, name: email.split('@')[0], password: 'correct-horse-battery' });
  f.db.prepare("INSERT INTO project_members VALUES (?, ?, 'member', ?)").run(f.projectId, user.id, new Date().toISOString());
  return user;
};
const layerTask = (f, title, extra = {}) => {
  const work = f.know.createWork(f.projectId, { layer: 'pages', title, assignee: { kind: 'agent', id: f.profile.id }, ...extra }, f.owner.name);
  if (work.state === 'suggested') f.know.updateWork(f.owner, f.projectId, work.id, { state: 'ready' });
  return f.know.workById(f.projectId, work.id);
};

test('a layer-scoped Pages task needs no action, writes only Pages flows, and signs follow-ups as the agent from Pages', () => withPagesTemplate(async f => {
  const browse = f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list', status: 'planned' });
  const detail = f.know.insert(f.projectId, 'page', { label: 'Detail', icon: 'article', pageType: 'detail', status: 'planned' });
  const flow = f.know.insert(f.projectId, 'flow', { title: 'Browse', steps: [{ page: browse.id, name: 'Browse' }] });
  const work = layerTask(f, 'Tighten the browse journey');
  assert.equal(work.action, null);
  assert.equal(work.scope, 'layer');
  assert.match(work.checks[0].text, /Pages charter/);
  const { issue, card } = f.start(null, [], null, null, false, work);
  assert.equal(card.schemaVersion, 'aludel-task-open-v2');
  assert.equal(card.task.layer, 'pages');
  assert.deepEqual(card.outputs[0].changes, [{ kind: 'flow', operations: ['create', 'revise'] }]);
  assert.match(card.layerSource.charter, /Pages/);
  assert.ok(card.outputs[0].followUpLayers.some(layer => layer.key === 'platform'));
  const kinds = f.worker.knowledgeMap(f.scope, issue.native_ref.bundle_digest).kinds.map(entry => entry.kind);
  assert.ok(kinds.includes('flow') && kinds.includes('story'), 'reads are project-wide');
  const attemptId = issue.native_ref.attempt_id;
  const proposal = { summary: 'Add a detail journey and mark the missing decision step in browse.', content: { changes: [
    { kind: 'flow', op: 'create', title: 'Inspect detail', steps: [{ page: detail.id, name: 'Read the detail' }] },
    { kind: 'flow', op: 'revise', id: flow.id, title: 'Browse and decide', steps: [{ page: browse.id, name: 'Browse' }, { page: null, name: 'Decide', why: 'No decision page yet' }] }
  ], notes: 'The decision step needs a page; Code has no detail route.' },
  followUps: [{ layer: 'platform', title: 'Build the detail route', brief: 'Implement the Detail page route.', why: 'The new Inspect detail flow needs a built Detail page.' }],
  usedInputs: [{ id: detail.id, revision: detail.revision }, { id: browse.id, revision: browse.revision }, { id: flow.id, revision: flow.revision }] };
  assert.throws(() => f.worker.submitProposal(f.scope, { attemptId, proposal: { ...proposal, content: { changes: [{ kind: 'page', op: 'create', title: 'X', steps: [] }] } } }), /may change only flow/);
  assert.throws(() => f.worker.submitProposal(f.scope, { attemptId, proposal: { ...proposal, followUps: [{ ...proposal.followUps[0], layer: 'nowhere' }] } }), /not installed/);
  assert.throws(() => f.worker.submitProposal(f.scope, { attemptId, proposal: { ...proposal, usedInputs: proposal.usedInputs.slice(1) } }), /every record a change cites/);
  const submitted = f.worker.submitProposal(f.scope, { attemptId, proposal });
  assert.equal(f.know.list(f.projectId, 'flow').length, 1, 'nothing is applied before review');
  assert.equal(f.know.get(f.projectId, flow.id).revision, flow.revision);

  const run = workRuns({ db: f.db, know: f.know }).list(f.projectId, work.id)[0];
  assert.deepEqual(run.changes.map(change => change.kind), ['flow', 'flow-revision', 'report']);
  assert.equal(run.followUps.length, 1);
  assert.equal(run.followUps[0].state, 'proposed');

  const member = addMember(f, 'designer@example.com');
  f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
  assert.throws(() => f.worker.acceptProposal(member, f.projectId, work.id, submitted.proposalId), /Elevated access/);
  assert.throws(() => decideFollowUp(f.db, f.know, member, f.projectId, work.id, run.followUps[0].id, 'create'), /Elevated access/);
  assert.throws(() => setLayerElevated(f.db, member, f.projectId, { userId: member.id, layerKey: 'pages', enabled: true }), /owner required/);
  setLayerElevated(f.db, f.owner, f.projectId, { userId: member.id, layerKey: 'pages', enabled: true });
  assert.ok(layerAccess(f.db, member, f.projectId, 'pages').people.find(person => person.id === member.id).elevated);

  const accepted = f.worker.acceptProposal(member, f.projectId, work.id, submitted.proposalId);
  assert.equal(accepted.applied.length, 2);
  assert.equal(f.know.list(f.projectId, 'flow').length, 2);
  assert.equal(f.know.get(f.projectId, flow.id).revision, flow.revision + 1);
  assert.equal(f.know.get(f.projectId, flow.id).steps[1].page, null);
  assert.equal(f.know.workById(f.projectId, work.id).state, 'done');

  const decided = decideFollowUp(f.db, f.know, member, f.projectId, work.id, run.followUps[0].id, 'create');
  assert.equal(decided.work.layer, 'platform');
  assert.equal(decided.work.state, 'suggested');
  assert.equal(decided.work.scope, 'layer');
  assert.equal(decided.work.action, null);
  assert.deepEqual({ kind: decided.work.context.createdBy.kind, profileId: decided.work.context.createdBy.profileId, layer: decided.work.context.createdBy.layer, workRef: decided.work.context.createdBy.workRef },
    { kind: 'agent', profileId: f.profile.id, layer: 'pages', workRef: work.ref });
  assert.match(decided.work.log[0].text, /from the Pages layer as a follow-up to W-\d+; accepted by designer/);
  assert.equal(decideFollowUp(f.db, f.know, member, f.projectId, work.id, run.followUps[0].id, 'dismiss').followUp.state, 'created', 'a decided follow-up stays decided');
  assert.equal(workRuns({ db: f.db, know: f.know }).list(f.projectId, work.id)[0].followUps[0].createdRef, decided.work.ref);
}));

test('a layer-scoped change set is withdrawn on stale input and changed layer source; follow-ups stay decidable after send-back', () => withPagesTemplate(async f => {
  const page = f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list', status: 'planned' });
  const work = layerTask(f, 'Map browse');
  const { issue } = f.start(null, [], null, null, false, work);
  const submitted = f.worker.submitProposal(f.scope, { attemptId: issue.native_ref.attempt_id, proposal: { summary: 'Map the browse journey through the list page.',
    content: { changes: [{ kind: 'flow', op: 'create', title: 'Browse', steps: [{ page: page.id, name: 'Browse' }] }] },
    followUps: [{ layer: 'product', title: 'Write the browse story', brief: 'Capture why people browse.', why: 'The flow has no Vision story to cite.' }],
    usedInputs: [{ id: page.id, revision: page.revision }] } });
  f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
  f.know.update(f.projectId, page.id, { notes: 'Changed after submission' }, { expectedRevision: page.revision });
  assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /used input changed/);
  f.db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'pages'").run('ae93312c96299c3b855024911f33362ab5cfecb9', f.projectId);
  assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /layer source changed/);
  assert.equal(f.know.list(f.projectId, 'flow').length, 0);
  f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'reject', note: 'The page changed; map it again.' } });
  f.know.updateWork(f.owner, f.projectId, work.id, { sendBack: true });
  f.worker.rejectProposal(f.projectId, work.id, submitted.proposalId);
  const followUp = workRuns({ db: f.db, know: f.know }).list(f.projectId, work.id)[0].followUps[0];
  assert.equal(decideFollowUp(f.db, f.know, f.owner, f.projectId, work.id, followUp.id, 'dismiss').followUp.state, 'dismissed');
  assert.equal(f.know.workList(f.projectId).filter(item => item.context?.createdBy).length, 0);
}));

test('layer access keeps elevated grants layer-wide, never widens action grants, and seeds the layer default assignee', () => withPagesTemplate(async f => {
  const member = addMember(f, 'reader@example.com'), lead = addMember(f, 'lead@example.com');
  f.db.exec(`CREATE TABLE IF NOT EXISTS layer_action_grants (project_id TEXT NOT NULL, user_id TEXT NOT NULL, layer_key TEXT NOT NULL,
    action_id TEXT NOT NULL DEFAULT '', level TEXT NOT NULL, source_role_id TEXT, created_at TEXT NOT NULL, PRIMARY KEY(project_id, user_id, layer_key, action_id, level))`);
  const at = new Date().toISOString();
  f.db.prepare("INSERT INTO layer_action_grants VALUES (?, ?, 'pages', '', 'elevated', NULL, ?)").run(f.projectId, lead.id, at);
  f.db.prepare("INSERT INTO layer_action_grants VALUES (?, ?, 'pages', 'pages.flows', 'elevated', NULL, ?)").run(f.projectId, member.id, at);
  initLayerScope(f.db);
  const access = layerAccess(f.db, f.owner, f.projectId, 'pages');
  assert.equal(access.layerScoped, true);
  assert.equal(access.people.find(person => person.id === lead.id).elevated, true);
  assert.equal(access.people.find(person => person.id === member.id).elevated, false, 'an action-specific grant is not widened');
  assert.throws(() => setLayerDefaultAssignee(f.db, member, f.projectId, 'pages', { kind: 'person', id: member.id }), /Elevated access/);
  setLayerDefaultAssignee(f.db, lead, f.projectId, 'pages', { kind: 'person', id: member.id });
  const work = f.know.createWork(f.projectId, { layer: 'pages', title: 'Review the map' }, f.owner.name);
  assert.equal(work.assignee.id, member.id);
  f.know.migrateWork(f.projectId);
  assert.equal(f.know.workById(f.projectId, work.id).action, null, 'a layer-scoped item is never back-filled with an action');
}));

test('without an opted-in layer package, an action-less request keeps the legacy action path', () => {
  const f = fixture();
  try {
    initLayerScope(f.db);
    const work = f.know.createWork(f.projectId, { layer: 'pages', type: 'design', title: 'Legacy request' }, f.owner.name);
    assert.equal(work.scope, 'action');
    assert.ok(work.action?.startsWith('pages.'));
  } finally { f.close(); }
});
