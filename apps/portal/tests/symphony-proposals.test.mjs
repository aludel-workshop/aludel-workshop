import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { waitForPortal, stopPortal } from './portal-support.mjs';
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
// Template mode (DEC-055/059) is the target; legacy expectations that DEC-057 deliberately changed are stated per mode.
const templatesOn = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1' || process.env.MACHINE_PAGES_TEMPLATE_ENABLED === '1';

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
    env: { ...process.env, MACHINE_DATA_DIR: f.root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const origin = `http://127.0.0.1:${port}`;
    await waitForPortal(portal, origin);
    const path = `/api/worker/attempts/${issue.native_ref.attempt_id}/proposal`;
    const proposal = { summary: 'Local value claim for the product owner to review.',
      content: { section: 'value', text: 'Borrow useful tools nearby.', note: '', basis: 'The product pitch describes sharing.' }, usedInputs: [] };
    const denied = await fetch(origin + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proposal }) });
    assert.equal(denied.status, 401);
    const accepted = await fetch(origin + path, { method: 'POST', headers: { authorization: `Bearer ${f.credential}`, 'content-type': 'application/json' }, body: JSON.stringify({ proposal }) });
    assert.equal(accepted.status, 200, await accepted.clone().text());
    assert.ok((await accepted.json()).proposalId);
  } finally { await stopPortal(portal); f.close(); }
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
      .run(execFileSync('git', ['-C', f.db.prepare("SELECT repository_path FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'pages'").get(f.projectId).repository_path, 'rev-parse', 'HEAD~1'], { encoding: 'utf8' }).trim(), f.projectId);
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
    const newPin=(({ templates, builtIn }) => templates[builtIn.pages].commit)(JSON.parse(readFileSync(new URL('../config/layer-templates.json', import.meta.url),'utf8'))), oldPin=execFileSync('git',['-C',f.db.prepare("SELECT repository_path FROM layer_package_bindings WHERE project_id=? AND layer_key='pages'").get(f.projectId).repository_path,'rev-parse','HEAD~1'],{encoding:'utf8'}).trim();
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

test('an existing-flow agent task waits for a reviewed Pages package but still needs no story', { skip: templatesOn && 'checks the path before a reviewed Pages package exists' }, () => {
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
import { saveLayerCharter } from '../server/layer-registry.mjs';
import { decideFollowUp, initLayerScope, layerAccess, setLayerDefaultAssignee, setLayerElevated } from '../server/layer-scope.mjs';
import { applyOperation, layerApi } from '../server/layer-api.mjs';

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

test('a layer-scoped Pages task changes Pages only through its API; review shows fields and follow-ups are signed as the agent from Pages', () => withPagesTemplate(async f => {
  const browse = f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list', status: 'planned' });
  const detail = f.know.insert(f.projectId, 'page', { label: 'Detail', icon: 'article', pageType: 'detail', status: 'planned' });
  const flow = f.know.insert(f.projectId, 'flow', { title: 'Browse', steps: [{ page: browse.id, name: 'Browse' }] });
  const work = layerTask(f, 'Tighten the browse journey');
  assert.equal(work.action, null);
  assert.equal(work.scope, 'layer');
  const { issue, card } = f.start(null, [], null, null, false, work);
  assert.equal(card.layerApi.openapi, '3.1.0');
  assert.ok(card.outputs[0].operations.some(op => op.operationId === 'updateFlow' && op.writes === 'flow'));
  assert.ok(card.outputs[0].followUpLayers.some(layer => layer.key === 'platform'));
  assert.match(card.outputs[0].evidence, /For each criterion/, "a layer card asks for evidence per criterion");
  assert.match(issue.description, /make the requested changes.*aludel_layer_call.*aludel_layer_commit/, "a layer task is told to make its changes, not to describe them");
  assert.doesNotMatch(issue.description, /do not change project records or files/);
  const attemptId = issue.native_ref.attempt_id;
  const call = (operation, body = {}, id = null) => f.worker.callLayer(f.scope, { attemptId, operation, id, body });
  assert.throws(() => call('createFlow', { flow: { title: 'x'.repeat(61) } }), /Flow name must be under 60 characters/);
  assert.throws(() => call('createFlow', { flow: { title: 'Ghost', steps: [{ page: 'pag-00000000', name: 'Nowhere' }] } }), /linked page was not found/);
  assert.throws(() => call('createFlow', { flow: { title: 'Extra', owner: 'me' } }), /Unknown field/);
  assert.throws(() => call('updatePage', { changes: { label: 'x' } }, flow.id), /not found/);
  assert.throws(() => call('deleteEverything'), /no operation/);
  const created = call('createFlow', { flow: { title: 'Inspect detail', steps: [{ page: detail.id, name: 'Read the detail' }] } });
  assert.equal(created.staged.op, 'create');
  assert.ok(call('listFlows').result.some(entry => entry.id === created.staged.id), 'reads include staged changes');
  call('updateFlow', { expectedRevision: flow.revision, changes: { title: 'Browse and decide', steps: [{ page: browse.id, name: 'Browse' }, { page: null, name: 'Decide', why: 'No decision page yet' }] } }, flow.id);
  assert.equal(call('getFlow', {}, flow.id).result.data.title, 'Browse and decide');
  assert.equal(f.know.list(f.projectId, 'flow').length, 1, 'nothing is applied before review');
  assert.equal(f.know.get(f.projectId, flow.id).revision, flow.revision);
  const proposal = { summary: 'Add a detail journey and mark the missing decision step in browse.', content: { notes: 'The decision step needs a page.' },
    followUps: [{ layer: 'platform', title: 'Build the detail route', brief: 'Implement the Detail page route.', why: 'The new Inspect detail flow needs a built Detail page.' }] };
  assert.throws(() => f.worker.submitProposal(f.scope, { attemptId, proposal: { ...proposal, content: { changes: [] } } }), /aludel_layer_call/);
  const submitted = f.worker.submitProposal(f.scope, { attemptId, proposal });
  assert.throws(() => call('createFlow', { flow: { title: 'Late' } }), /cannot call/);

  const run = workRuns({ db: f.db, know: f.know }).list(f.projectId, work.id)[0];
  assert.deepEqual(run.changes.map(change => [change.kind, change.op]), [['record', 'created'], ['record', 'modified'], ['report', 'created']]);
  assert.deepEqual(run.changes[1].fields.map(field => field.name), ['title', 'steps']);
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
  assert.equal(f.know.get(f.projectId, created.staged.id).title, 'Inspect detail', 'the staged ID is the accepted ID');
  assert.equal(f.know.get(f.projectId, flow.id).revision, flow.revision + 1);
  assert.equal(f.know.get(f.projectId, flow.id).steps[1].page, null);
  assert.equal(f.db.prepare('SELECT work_item_id FROM knowledge_revisions WHERE record_id = ? AND revision = ?').get(flow.id, flow.revision + 1).work_item_id, work.id);
  assert.equal(f.know.workById(f.projectId, work.id).state, 'done');

  const decided = decideFollowUp(f.db, f.know, member, f.projectId, work.id, run.followUps[0].id, 'create');
  assert.equal(decided.work.layer, 'platform');
  assert.equal(decided.work.state, 'suggested');
  assert.equal(decided.work.scope, 'layer');
  assert.deepEqual({ kind: decided.work.context.createdBy.kind, profileId: decided.work.context.createdBy.profileId, layer: decided.work.context.createdBy.layer, workRef: decided.work.context.createdBy.workRef },
    { kind: 'agent', profileId: f.profile.id, layer: 'pages', workRef: work.ref });
  assert.match(decided.work.log[0].text, /from the Pages layer as a follow-up to W-\d+; accepted by designer/);
  assert.equal(decideFollowUp(f.db, f.know, member, f.projectId, work.id, run.followUps[0].id, 'dismiss').followUp.state, 'created', 'a decided follow-up stays decided');
}));

test('T03-G1: a layer-scoped run reads other layers through the Library, and a cited Knowledge revision gates acceptance', () => withPagesTemplate(async f => {
  const story = f.know.insert(f.projectId, 'story', { title: 'Someone can compare tool conditions before borrowing', phase: 'demo' });
  const work = layerTask(f, 'Add a comparison step');
  const { issue, card } = f.start(null, [], null, null, false, work);
  assert.match(card.library, /Library/);
  const digest = issue.native_ref.bundle_digest, attemptId = issue.native_ref.attempt_id;
  const found = f.worker.knowledgeSearch(f.scope, digest, story.title.slice(0, 40));
  const hit = found.results.find(entry => entry.id === story.id);
  assert.deepEqual([hit.layer, hit.source], ['product', 'output'], 'a Vision story is found as a Library output');
  const charterHit = f.worker.knowledgeSearch(f.scope, digest, 'charter').results.find(entry => entry.id === 'k:product:identity');
  assert.equal(charterHit.source, 'knowledge', "Vision's charter is published to the Library");
  const charter = f.worker.knowledgeRead(f.scope, digest, 'k:product:identity');
  assert.match(charter.data.content, /#/);
  assert.equal(f.worker.knowledgeRead(f.scope, digest, story.id).layer, 'product');

  const detail = f.know.insert(f.projectId, 'page', { label: 'Compare', icon: 'article', pageType: 'detail', status: 'planned' });
  f.worker.callLayer(f.scope, { attemptId, operation: 'createFlow', body: { flow: { title: 'Compare tools', steps: [{ page: detail.id, name: 'Compare', story: story.id }] } } });
  const submitted = f.worker.submitProposal(f.scope, { attemptId, proposal: { summary: 'Add a comparison journey.', content: {},
    usedInputs: [{ id: story.id, revision: story.revision }, { id: 'k:product:identity', revision: charter.revision }] } });
  const charterNow = f.db.prepare("SELECT identity_revision AS revision FROM layer_definitions WHERE project_id = ? AND layer_key = 'product'").get(f.projectId).revision;
  saveLayerCharter(f.db, f.owner.id, f.projectId, 'product', { expectedRevision: charterNow, content: `${charter.data.content}\n\n## Note\n\nComparisons matter.` });
  f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
  assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /used input changed/);
}));

test('a staged draft is refused when a record it changes moved on, a reference is gone, or the layer source changed', () => withPagesTemplate(async f => {
  const page = f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list', status: 'planned' });
  const flow = f.know.insert(f.projectId, 'flow', { title: 'Browse', steps: [{ page: page.id, name: 'Browse' }] });
  const work = layerTask(f, 'Map browse');
  const { issue } = f.start(null, [], null, null, false, work);
  const attemptId = issue.native_ref.attempt_id;
  f.worker.callLayer(f.scope, { attemptId, operation: 'updateFlow', id: flow.id, body: { changes: { title: 'Browse again' } } });
  const created = f.worker.callLayer(f.scope, { attemptId, operation: 'createFlow', body: { flow: { title: 'Browse copy', steps: [{ page: page.id, name: 'Browse' }] } } });
  const submitted = f.worker.submitProposal(f.scope, { attemptId, proposal: { summary: 'Rename the browse flow and add a copy.', content: {},
    followUps: [{ layer: 'product', title: 'Write the browse story', brief: 'Capture why people browse.', why: 'The flow has no Vision story to cite.' }] } });
  f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
  const stale = f.know.update(f.projectId, flow.id, { title: 'Edited by a person' }, { expectedRevision: flow.revision });
  assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /changed since/);
  f.db.prepare('UPDATE knowledge_records SET revision = ?, data_json = (SELECT data_json FROM knowledge_revisions WHERE record_id = ? AND revision = ?) WHERE id = ?').run(flow.revision, flow.id, flow.revision, flow.id);
  f.db.prepare('DELETE FROM knowledge_revisions WHERE record_id = ? AND revision = ?').run(flow.id, stale.revision);
  f.db.prepare("UPDATE knowledge_records SET kind = 'doc' WHERE id = ?").run(page.id);
  assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /linked page was not found/);
  f.db.prepare("UPDATE knowledge_records SET kind = 'page' WHERE id = ?").run(page.id);
  f.db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'pages'").run(execFileSync('git', ['-C', pinOf(f).repo, 'rev-parse', 'HEAD~1'], { encoding: 'utf8' }).trim(), f.projectId);
  assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId), /layer source changed/);
  assert.equal(f.know.get(f.projectId, created.staged.id), null);
  assert.equal(f.know.get(f.projectId, flow.id).revision, flow.revision);
  f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'reject', note: 'The page changed; map it again.' } });
  f.know.updateWork(f.owner, f.projectId, work.id, { sendBack: true });
  f.worker.rejectProposal(f.projectId, work.id, submitted.proposalId);
  const followUp = workRuns({ db: f.db, know: f.know }).list(f.projectId, work.id)[0].followUps[0];
  assert.equal(decideFollowUp(f.db, f.know, f.owner, f.projectId, work.id, followUp.id, 'dismiss').followUp.state, 'dismissed');
}));

test('every host write of a Pages record uses the Pages API rules and messages; people call the same operations', () => withPagesTemplate(async f => {
  assert.throws(() => f.know.insert(f.projectId, 'page', { label: 'x'.repeat(31), icon: 'article', pageType: 'list' }), /Page name must be under 30 characters/);
  assert.throws(() => f.know.insert(f.projectId, 'page', { label: 'Bad', icon: 'article', pageType: 'list', sections: [{ name: 'A', state: 'broken' }] }), /Unknown page state/);
  assert.throws(() => f.know.insert(f.projectId, 'page', { label: 'Bad', icon: 'article', pageType: 'list', sections: [{ name: '' }] }), /Section name is required/);
  assert.throws(() => f.know.insert(f.projectId, 'flow', { title: 'Notes', review: { notes: [{ type: 'rant', text: 'x' }] } }), /Unknown kind of review note/);
  const api = layerApi(f.db, f.projectId, 'pages');
  const target = f.know.insert(f.projectId, 'page', { label: 'Detail', icon: 'article', pageType: 'detail' });
  const made = applyOperation({ db: f.db, know: f.know, api, projectId: f.projectId, operationId: 'createPage', author: f.owner.name,
    body: { page: { label: 'Browse', icon: 'article', pageType: 'list', sections: [{ name: 'List', leadsTo: target.id, content: { action: 'Open' } }] } } });
  assert.deepEqual(f.know.get(f.projectId, made.id).links, [{ to: target.id, label: 'Open' }], 'the layer derives Map links');
  assert.throws(() => applyOperation({ db: f.db, know: f.know, api, projectId: f.projectId, operationId: 'updatePage', id: made.id, author: f.owner.name,
    body: { expectedRevision: 99, changes: { label: 'Late' } } }), /changed since/);
  const map = applyOperation({ db: f.db, know: f.know, api, projectId: f.projectId, operationId: 'setPageMap', author: f.owner.name, body: { places: { [made.id]: { col: 1, row: 2 } } } });
  assert.deepEqual(f.know.get(f.projectId, map.id).places, { [made.id]: { col: 1, row: 2 } });
  const foreign = f.db.prepare('SELECT layer_instance_id FROM knowledge_records WHERE id = ?').get(target.id).layer_instance_id;
  f.db.prepare("UPDATE knowledge_records SET layer_instance_id = 'foreign-instance' WHERE id = ?").run(target.id);
  assert.throws(() => applyOperation({ db: f.db, know: f.know, api, projectId: f.projectId, operationId: 'updatePage', id: made.id, author: f.owner.name,
    body: { changes: { links: [{ to: target.id }] } } }), /linked page was not found/);
  f.db.prepare('UPDATE knowledge_records SET layer_instance_id = ? WHERE id = ?').run(foreign, target.id);
  assert.equal(api.operations.get('updatePage').output, 'page');
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

test('without an opted-in layer package, an action-less request keeps the legacy action path', { skip: templatesOn && 'checks the path without any layer package' }, () => {
  const f = fixture();
  try {
    initLayerScope(f.db);
    const work = f.know.createWork(f.projectId, { layer: 'pages', type: 'design', title: 'Legacy request' }, f.owner.name);
    assert.equal(work.scope, 'action');
    assert.ok(work.action?.startsWith('pages.'));
  } finally { f.close(); }
});

// ---- LAYER-SOURCE-01 / LAYER-BASE-01 B5: a run works on its layer repository on a branch in its sandbox; accepting merges it ----
const pinOf = f => f.db.prepare("SELECT repository_path AS repo, accepted_commit AS \"commit\" FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'pages'").get(f.projectId);
// What the workspace hook does: the layer repository at the run base on its work branch in layer/, plus a copy of current outputs.
function sandboxLayer(f, issue, clone) {
  const attemptId = issue.native_ref.attempt_id;
  const info = f.worker.layerWorkspace(f.scope, attemptId);
  const checkout = join(clone, 'layer');
  const bundle = join(clone, '.git', 'aludel-layer.bundle');
  writeFileSync(bundle, f.worker.layerSourceBundle(f.scope, attemptId));
  mkdirSync(checkout); git(checkout, 'init', '-q');
  git(checkout, 'fetch', '-q', bundle, `refs/aludel/base/${attemptId}:refs/aludel/base`);
  git(checkout, 'checkout', '-q', '-b', info.branch, info.base);
  writeFileSync(join(clone, '.git', 'info', 'exclude'), '/layer/\n', { flag: 'a' });
  mkdirSync(join(checkout, '.aludel', 'outputs'), { recursive: true });
  for (const [kind, records] of Object.entries(info.outputs)) writeFileSync(join(checkout, '.aludel', 'outputs', `${kind}.json`), JSON.stringify(records));
  writeFileSync(join(checkout, '.aludel', 'outputs', 'catalogs.json'), JSON.stringify(info.catalogs));
  return { info, checkout };
}
function sourceRun(f, title) {
  const work = layerTask(f, title);
  const { issue, clone } = f.start(null, [], null, null, false, work);
  const attemptId = issue.native_ref.attempt_id;
  const { info, checkout } = sandboxLayer(f, issue, clone);
  const file = path => join(checkout, path);
  const test = () => {
    try { execFileSync(process.execPath, ['--test', 'tests/'], { cwd: checkout, stdio: 'pipe' }); return [{ name: 'node --test tests/', status: 'passed' }]; }
    catch (error) { return [{ name: 'node --test tests/', status: 'failed', detail: String(error.stdout || '').slice(-500) }]; }
  };
  return { work, attemptId, info, checkout, file, test, commit: (message, tests) => f.worker.commitLayer(f.scope, { attemptId, message, tests }) };
}
const edit = (path, change) => writeFileSync(path, change(readFileSync(path, 'utf8')));

test('a run edits its layer on a work branch in its sandbox, tests it against the output copy, and accepting merges the branch', () => withPagesTemplate(async f => {
  const member = addMember(f, 'designer@example.com');
  setLayerElevated(f.db, f.owner, f.projectId, { userId: member.id, layerKey: 'pages', enabled: true });
  f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list' });
  const before = pinOf(f);
  const run = sourceRun(f, 'Sharpen the flow method');
  assert.equal(git(run.checkout, 'rev-parse', '--abbrev-ref', 'HEAD'), run.info.branch);
  assert.ok(run.info.outputs.page.some(record => record.data.label === 'Browse'), 'the sandbox gets a copy of current outputs');
  assert.throws(() => run.commit('Nothing yet', []), /no changes/);
  edit(run.file('knowledge/flow-method.md'), text => `${text.trim()}\n\nName the goal before the first step.\n`);
  writeFileSync(run.file('knowledge/review-method.md'), '# Review method\n\nWalk each flow at phone width first.\n');
  const tests = run.test();
  assert.equal(tests[0].status, 'passed', tests[0].detail);
  const branch = run.commit('Tighten the flow method and add a review method.', tests);
  assert.equal(branch.branch, run.info.branch);
  assert.deepEqual(branch.files.map(entry => [entry.path, entry.status]), [['knowledge/flow-method.md', 'modified'], ['knowledge/review-method.md', 'added']]);
  assert.equal(execFileSync('git', ['-C', before.repo, 'rev-parse', `refs/heads/${branch.branch}`], { encoding: 'utf8' }).trim(), branch.commit, 'the branch is in the instance repository');
  assert.equal(pinOf(f).commit, before.commit, 'submitting a branch does not move main');
  const submitted = f.worker.submitProposal(f.scope, { attemptId: run.attemptId, proposal: { summary: 'Tighten the flow method and add a review method.', content: {} } });
  // LAYER-TOOLS-02: the submission's evidence names a committed file and a reported test; review shows each against its criterion.
  const history = workRuns({ db: f.db, know: f.know });
  history.recordEvidence(run.attemptId, history.checkEvidence(f.projectId, run.attemptId, [
    { criterion: 0, type: 'change', ref: 'knowledge/flow-method.md', note: 'The goal rule is the last paragraph.' },
    { criterion: 0, type: 'test', ref: tests[0].name, note: 'Layer tests on the branch.' },
    { criterion: 0, type: 'test', ref: 'a test never reported', note: 'Shown as missing.' }]));
  const reviewed = history.list(f.projectId, run.work.id)[0];
  assert.deepEqual(reviewed.evidence.map(item => [item.type, item.found, item.target?.split(':')[0] || null]), [['change', true, 'change'], ['test', true, 'test'], ['test', false, null]]);
  assert.equal(reviewed.evidence[1].result, 'passed');
  assert.equal(reviewed.layerSource.branch, branch.branch);
  assert.deepEqual(reviewed.layerSource.tests.map(entry => entry.status), ['passed']);
  assert.match(reviewed.changes.find(change => change.kind === 'source').diff, /^\+Name the goal before the first step\.$/m);
  f.know.updateWork(f.owner, f.projectId, run.work.id, { verdict: { index: 0, value: 'accept' } });
  const prepared = f.worker.prepareProposalReview(member, f.projectId, run.work.id, submitted.proposalId);
  const accepted = f.worker.acceptProposal(member, f.projectId, run.work.id, submitted.proposalId, prepared.id);
  assert.equal(accepted.sourceCommit, branch.commit, 'a branch from the current main fast-forwards');
  assert.equal(pinOf(f).commit, branch.commit);
  assert.equal(execFileSync('git', ['-C', before.repo, 'rev-parse', 'main'], { encoding: 'utf8' }).trim(), branch.commit, 'main is the pin');
  assert.ok(layerApi(f.db, f.projectId, 'pages'), 'a Knowledge-only merge keeps the reviewed API handler');
}));

test('a run cannot commit files outside the layer contract, an invalid package, or an API that does not load', () => withPagesTemplate(async f => {
  const run = sourceRun(f, 'Break things');
  writeFileSync(run.file('secrets.env'), 'TOKEN=x\n');
  assert.throws(() => run.commit('Add a secret', []), /may not change secrets\.env/);
  rmSync(run.file('secrets.env'));
  git(run.checkout, 'reset', '-q', '--hard', run.info.base);
  writeFileSync(run.file('layer.json'), '{ not json');
  assert.throws(() => run.commit('Break the manifest', []), /not a valid package/);
  git(run.checkout, 'reset', '-q', '--hard', run.info.base);
  writeFileSync(run.file('api/openapi.json'), JSON.stringify({ openapi: '3.0.0', paths: {} }));
  assert.throws(() => run.commit('Wrong API version', []), /API does not load/);
}));

test('an elevated reviewer merges a change to what the layer runs; the merged rules must accept existing records, and a moved main merges only when clean', () => withPagesTemplate(async f => {
  const member = addMember(f, 'designer@example.com');
  setLayerElevated(f.db, f.owner, f.projectId, { userId: member.id, layerKey: 'pages', enabled: true });
  f.know.insert(f.projectId, 'page', { label: 'Browse', icon: 'article', pageType: 'list' });
  const base = pinOf(f).commit;
  // Three runs from the same main, all submitted before any is accepted.
  const code = sourceRun(f, 'Default new pages to the planner');
  edit(code.file('server/pages-api.mjs'), text => text.replace("origin: str(data.origin || 'You')", "origin: str(data.origin || 'Planner')"));
  code.commit('Default the origin of new pages to Planner.', code.test());
  const codeProposal = f.worker.submitProposal(f.scope, { attemptId: code.attemptId, proposal: { summary: 'Default the origin of new pages to Planner.', content: {} } });
  const docs = sourceRun(f, 'Describe the Map');
  edit(docs.file('knowledge/map-output.md'), text => `${text.trim()}\n\nPlaces are kept per page.\n`);
  docs.commit('Describe Map placement.', docs.test());
  const docsProposal = f.worker.submitProposal(f.scope, { attemptId: docs.attemptId, proposal: { summary: 'Describe how the Map keeps placements.', content: {} } });
  const clash = sourceRun(f, 'Rewrite the pages API differently');
  edit(clash.file('server/pages-api.mjs'), text => text.replace("origin: str(data.origin || 'You')", "origin: str(data.origin || 'Someone')"));
  clash.commit('Default the origin of new pages to Someone.', []);
  const clashProposal = f.worker.submitProposal(f.scope, { attemptId: clash.attemptId, proposal: { summary: 'Default the origin of new pages to Someone.', content: {} } });
  for (const run of [code, docs, clash]) f.know.updateWork(f.owner, f.projectId, run.work.id, { verdict: { index: 0, value: 'accept' } });

  const outsider = addMember(f, 'viewer@example.com');
  assert.throws(() => f.worker.acceptProposal(outsider, f.projectId, code.work.id, codeProposal.proposalId), /Elevated access/);
  const codeReview = f.worker.prepareProposalReview(member, f.projectId, code.work.id, codeProposal.proposalId);
  f.worker.acceptProposal(member, f.projectId, code.work.id, codeProposal.proposalId, codeReview.id);
  assert.equal(f.db.prepare("SELECT reviewed_by FROM layer_source_reviews WHERE path = 'server/pages-api.mjs'").get().reviewed_by, 'designer');
  assert.equal(f.know.insert(f.projectId, 'page', { label: 'Detail', icon: 'article', pageType: 'detail' }).origin, 'Planner', 'the merged handler now runs');
  const afterCode = pinOf(f).commit;
  assert.notEqual(afterCode, base);

  const prepared = f.worker.prepareProposalReview(member, f.projectId, docs.work.id, docsProposal.proposalId);
  assert.equal(pinOf(f).commit, afterCode, 'preparing a review never moves accepted main');
  const merged = f.worker.acceptProposal(member, f.projectId, docs.work.id, docsProposal.proposalId, prepared.id);
  assert.equal(merged.sourceCommit, prepared.commit, 'acceptance uses the exact combined commit shown for review');
  const parents = execFileSync('git', ['-C', pinOf(f).repo, 'show', '-s', '--format=%P', merged.sourceCommit], { encoding: 'utf8' }).trim().split(' ');
  assert.deepEqual(parents, [afterCode, f.db.prepare('SELECT commit_sha FROM layer_work_branches WHERE attempt_id = ?').get(docs.attemptId).commit_sha], 'a moved main gets a merge commit');
  assert.match(execFileSync('git', ['-C', pinOf(f).repo, 'show', `${merged.sourceCommit}:knowledge/map-output.md`], { encoding: 'utf8' }), /Places are kept per page/);
  assert.match(execFileSync('git', ['-C', pinOf(f).repo, 'show', `${merged.sourceCommit}:server/pages-api.mjs`], { encoding: 'utf8' }), /'Planner'/);

  assert.throws(() => f.worker.prepareProposalReview(member, f.projectId, clash.work.id, clashProposal.proposalId), /conflicts with the accepted repository/);
  assert.equal(pinOf(f).commit, merged.sourceCommit, 'a refused merge leaves main and the pin');

  const rule = sourceRun(f, 'Shorten page names');
  edit(rule.file('api/openapi.json'), text => { const spec = JSON.parse(text); spec.components.schemas.Page.properties.label.maxLength = 3; return JSON.stringify(spec, null, 2); });
  const ruleTests = rule.test();
  assert.equal(ruleTests[0].status, 'passed', 'the repository tests do not know the schema limit; the host checks it at merge');
  rule.commit('Limit page names to three characters.', ruleTests);
  const tight = f.worker.submitProposal(f.scope, { attemptId: rule.attemptId, proposal: { summary: 'Limit page names to three characters.', content: {} } });
  f.know.updateWork(f.owner, f.projectId, rule.work.id, { verdict: { index: 0, value: 'accept' } });
  const pin = pinOf(f).commit;
  assert.throws(() => f.worker.prepareProposalReview(member, f.projectId, rule.work.id, tight.proposalId), /reject page .*Page name must be under 3 characters/);
  assert.equal(pinOf(f).commit, pin);
  assert.equal(execFileSync('git', ['-C', pinOf(f).repo, 'rev-parse', 'main'], { encoding: 'utf8' }).trim(), pin, 'main is put back when acceptance fails');
}));

// ---- LAYER-BASE-01: every added layer is a fork of the base layer repository; Markdown proves it beside Pages ----
test('repository reviews refresh before acceptance, retain submissions and refuse a stale reviewed generation', () => withPagesTemplate(async f => {
  const first = sourceRun(f, 'Document one');
  edit(first.file('knowledge/map-output.md'), text => text + '\nFirst clarification.\n');
  first.commit('First clarification.', []);
  const a = f.worker.submitProposal(f.scope, { attemptId: first.attemptId, proposal: { summary: 'First clarification.', content: {} } });
  const second = sourceRun(f, 'Document two');
  edit(second.file('knowledge/flow-method.md'), text => text + '\nSecond clarification.\n');
  const submitted = second.commit('Second clarification.', []);
  const b = f.worker.submitProposal(f.scope, { attemptId: second.attemptId, proposal: { summary: 'Second clarification.', content: {} } });
  const ar = f.worker.prepareProposalReview(f.owner, f.projectId, first.work.id, a.proposalId);
  const br = f.worker.prepareProposalReview(f.owner, f.projectId, second.work.id, b.proposalId);
  assert.equal(f.worker.prepareProposalReview(f.owner, f.projectId, second.work.id, b.proposalId).id, br.id, 'unchanged integration reuses evidence');
  for (const run of [first, second]) f.know.updateWork(f.owner, f.projectId, run.work.id, { verdict: { index: 0, value: 'accept' } });
  assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, first.work.id, a.proposalId, 'wrong-review'), /review revision changed/);
  f.worker.acceptProposal(f.owner, f.projectId, first.work.id, a.proposalId, ar.id);
  assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, second.work.id, b.proposalId, br.id), /Refresh this review/);
  const refreshed = f.worker.prepareProposalReview(f.owner, f.projectId, second.work.id, b.proposalId);
  assert.notEqual(refreshed.id, br.id);
  assert.equal(refreshed.submittedCommit, submitted.commit, 'the submission stays immutable');
  assert.match(git(pinOf(f).repo, 'show', `${refreshed.commit}:knowledge/map-output.md`), /First clarification/);
  assert.match(git(pinOf(f).repo, 'show', `${refreshed.commit}:knowledge/flow-method.md`), /Second clarification/);
  assert.throws(() => f.worker.acceptProposal(f.owner, f.projectId, second.work.id, b.proposalId, br.id), /review revision changed/);
  const accepted = f.worker.acceptProposal(f.owner, f.projectId, second.work.id, b.proposalId, refreshed.id);
  assert.equal(accepted.sourceCommit, refreshed.commit);
}));

test('combined layer tests catch a clean merge whose API remains structurally valid', () => withPagesTemplate(async f => {
  const run = sourceRun(f, 'Break behavior');
  edit(run.file('tests/pages-api.test.mjs'), text => text + "\ntest('regression', () => assert.equal(1, 2));\n");
  run.commit('Introduce a failing behavior check.', []);
  const submitted = f.worker.submitProposal(f.scope, { attemptId: run.attemptId, proposal: { summary: 'A structurally valid but failing change.', content: {} } });
  const before = pinOf(f).commit;
  assert.throws(() => f.worker.prepareProposalReview(f.owner, f.projectId, run.work.id, submitted.proposalId), /combined layer tests failed/);
  assert.equal(pinOf(f).commit, before);
}));

import { createMarkdownDefinition } from '../server/layer-registry.mjs';
import { adoptMarkdownLayer, markdownOutputs } from '../server/markdown-outputs.mjs';
import { initMarkdownLayer, markdownFileCreate, markdownFolderCreate } from '../server/markdown-layer.mjs';
const bindingOf = (f, key) => f.db.prepare('SELECT repository_path AS repo, accepted_commit AS "commit", template, template_commit AS templateCommit FROM layer_package_bindings WHERE project_id = ? AND layer_key = ?').get(f.projectId, key);
const catalogPins = () => JSON.parse(readFileSync(new URL('../config/layer-templates.json', import.meta.url), 'utf8'));

test('adding a layer forks its template from the base repository into the instance\'s own repository', () => withPagesTemplate(async f => {
  const pins = catalogPins();
  const notes = createMarkdownDefinition(f.db, f.owner.id, f.projectId, { name: 'Research notes' });
  const decisions = createMarkdownDefinition(f.db, f.owner.id, f.projectId, { name: 'Decisions', template: 'base' });
  assert.throws(() => createMarkdownDefinition(f.db, f.owner.id, f.projectId, { name: 'Second pages', template: 'pages' }), /base layer or the Markdown template/);
  const repos = ['pages', notes.key, decisions.key].map(key => bindingOf(f, key));
  assert.equal(new Set(repos.map(repo => repo.repo)).size, 3, 'each instance has its own repository');
  assert.deepEqual(repos.map(repo => repo.template), ['pages', 'markdown', 'base']);
  for (const [key, repo] of [[notes.key, repos[1]], [decisions.key, repos[2]]]) {
    const manifest = JSON.parse(execFileSync('git', ['-C', repo.repo, 'show', `${repo.commit}:layer.json`], { encoding: 'utf8' }));
    assert.equal(manifest.key, key);
    assert.equal(execFileSync('git', ['-C', repo.repo, 'rev-parse', `${repo.commit}^`], { encoding: 'utf8' }).trim(), pins.templates[repo.template].commit, 'one install commit on the template');
    assert.equal(execFileSync('git', ['-C', repo.repo, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim(), 'main');
  }
  assert.equal(repos[0].commit, pins.templates.pages.commit, 'Pages keeps its key, so it needs no install commit');
  assert.deepEqual(notes.outputs, ['markdown_document', 'markdown_folder']);
  assert.deepEqual(decisions.outputs, [], 'the base layer starts with no outputs');
  assert.equal(layerApi(f.db, f.projectId, decisions.key), null);
}));

test('a Markdown layer changes its files only through its own API and stays apart from another Markdown layer', () => withPagesTemplate(async f => {
  const data = process.env.MACHINE_DATA_DIR;
  const research = createMarkdownDefinition(f.db, f.owner.id, f.projectId, { name: 'Research' });
  const journal = createMarkdownDefinition(f.db, f.owner.id, f.projectId, { name: 'Journal' });
  const md = markdownOutputs({ db: f.db, know: f.know, dataDirectory: data });
  md.folderCreate(f.owner.id, f.projectId, research.key, 'notes');
  const file = md.fileCreate(f.owner.id, f.projectId, research.key, 'notes/a.md', '# A');
  assert.match(file.id, /^mdd-[a-f0-9]{8}$/);
  assert.deepEqual([file.path, file.revision, file.content], ['notes/a.md', 1, '# A']);
  assert.throws(() => md.fileCreate(f.owner.id, f.projectId, research.key, '../escape.md', ''), /unsupported name/);
  assert.throws(() => md.fileCreate(f.owner.id, f.projectId, journal.key, 'notes/a.md', ''), /parent folder/, 'another Markdown layer has its own folders');
  assert.throws(() => md.fileSave(f.owner.id, f.projectId, research.key, file.id, { expectedRevision: 9, content: 'x' }), /changed/);
  assert.equal(md.fileSave(f.owner.id, f.projectId, research.key, file.id, { expectedRevision: 1, content: '# A\n\nMore.' }).revision, 2);
  md.fileMove(f.owner.id, f.projectId, research.key, file.id, { expectedRevision: 2, path: 'notes/b.md' });
  md.folderCreate(f.owner.id, f.projectId, research.key, 'archive');
  md.folderMove(f.owner.id, f.projectId, research.key, 'notes', 'archive/notes');
  assert.deepEqual(md.tree(f.owner.id, f.projectId, research.key).files.map(entry => entry.path), ['archive/notes/b.md']);
  assert.equal(md.read(f.owner.id, f.projectId, research.key, file.id, 2).content, '# A\n\nMore.', 'history is kept per revision');
  assert.throws(() => md.folderDelete(f.owner.id, f.projectId, research.key, 'archive'), /Empty the folder/);
  const instance = key => f.db.prepare('SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(f.projectId, key).instance_id;
  assert.equal(f.db.prepare('SELECT layer_instance_id FROM knowledge_records WHERE id = ?').get(file.id).layer_instance_id, instance(research.key));
  assert.throws(() => f.know.insert(f.projectId, 'markdown_document', { path: 'x.md', content: '' }), /Several layers own/);
  assert.equal(f.know.insert(f.projectId, 'markdown_document', { path: 'x.md', content: '' }, { layer: journal.key }).path, 'x.md');
  md.fileDelete(f.owner.id, f.projectId, research.key, file.id, md.read(f.owner.id, f.projectId, research.key, file.id).revision);
  assert.deepEqual(md.tree(f.owner.id, f.projectId, research.key).files, []);
}));

test('a Markdown layer from before layer repositories moves into its own repository with its files and charter', { skip: templatesOn && 'switches templates on midway to adopt a pre-repository layer' }, async () => {
  const f = fixture();
  const data = mkdtempSync(join(tmpdir(), 'aludel-adopt-'));
  const oldData = process.env.MACHINE_DATA_DIR;
  process.env.MACHINE_DATA_DIR = data;
  try {
    initMarkdownLayer(f.db); initLayerScope(f.db);
    const legacy = createMarkdownDefinition(f.db, f.owner.id, f.projectId, { name: 'Field notes' });
    f.db.prepare('UPDATE layer_definitions SET identity_json = ? WHERE project_id = ? AND layer_key = ?')
      .run(JSON.stringify({ markdown: '# Field notes charter\n\n## Purpose\n\nNotes from customer visits.\n' }), f.projectId, legacy.key);
    markdownFolderCreate(f.db, data, f.owner.id, f.projectId, legacy.key, 'visits');
    markdownFileCreate(f.db, data, f.owner.id, f.projectId, legacy.key, 'visits/monday.md', '# Monday\n\nTwo visits.');
    process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
    const pkg = adoptMarkdownLayer({ db: f.db, know: f.know, dataDirectory: data, projectId: f.projectId, key: legacy.key });
    assert.match(pkg.charter, /Notes from customer visits/, 'the layer keeps its own charter in its repository');
    const md = markdownOutputs({ db: f.db, know: f.know, dataDirectory: data });
    const [file] = md.tree(f.owner.id, f.projectId, legacy.key).files;
    assert.equal(file.path, 'visits/monday.md');
    assert.equal(md.read(f.owner.id, f.projectId, legacy.key, file.id).content, '# Monday\n\nTwo visits.');
    assert.equal(f.db.withProject(f.projectId, () => f.db.prepare('SELECT COUNT(*) AS n FROM markdown_adoptions').get().n), 1);
    assert.equal(adoptMarkdownLayer({ db: f.db, know: f.know, dataDirectory: data, projectId: f.projectId, key: legacy.key }).commit, pkg.commit, 'adoption runs once');
    assert.equal(md.tree(f.owner.id, f.projectId, legacy.key).files.length, 1);
  } finally {
    f.close(); rmSync(data, { recursive: true, force: true });
    delete process.env.MACHINE_LAYER_TEMPLATES_ENABLED;
    if (oldData === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = oldData;
  }
});

test('an agent works on a Markdown layer through the same staged API, review and elevated acceptance as Pages', () => withPagesTemplate(async f => {
  const research = createMarkdownDefinition(f.db, f.owner.id, f.projectId, { name: 'Research' });
  f.db.prepare("UPDATE layer_definitions SET lifecycle = 'active' WHERE project_id = ? AND layer_key = ?").run(f.projectId, research.key);
  const work = f.know.createWork(f.projectId, { layer: research.key, title: 'Summarize the interviews', assignee: { kind: 'agent', id: f.profile.id } }, f.owner.name);
  assert.equal(work.scope, 'layer');
  if (work.state === 'suggested') f.know.updateWork(f.owner, f.projectId, work.id, { state: 'ready' });
  const { issue, card } = f.start(null, [], null, null, false, f.know.workById(f.projectId, work.id));
  assert.equal(card.layerApi.info.title, 'Markdown layer');
  const attemptId = issue.native_ref.attempt_id;
  const call = (operation, body = {}, id = null) => f.worker.callLayer(f.scope, { attemptId, operation, id, body });
  call('createFolder', { folder: { path: 'interviews' } });
  const doc = call('createDocument', { document: { path: 'interviews/summary.md', content: '# Summary' } });
  assert.throws(() => call('createDocument', { document: { path: 'interviews/summary.md', content: '' } }), /already exists/, 'staged records count');
  const submitted = f.worker.submitProposal(f.scope, { attemptId, proposal: { summary: 'Add an interview summary under a new folder.', content: {} } });
  assert.equal(f.db.withProject(f.projectId, () => f.db.prepare("SELECT COUNT(*) AS n FROM knowledge_records WHERE kind LIKE 'markdown_%'").get().n), 0);
  f.know.updateWork(f.owner, f.projectId, work.id, { verdict: { index: 0, value: 'accept' } });
  f.worker.acceptProposal(f.owner, f.projectId, work.id, submitted.proposalId);
  const md = markdownOutputs({ db: f.db, know: f.know, dataDirectory: process.env.MACHINE_DATA_DIR });
  assert.equal(md.read(f.owner.id, f.projectId, research.key, doc.staged.id).content, '# Summary');
}));

test('a real person run submits an immutable repository branch and uses shared integration and checked acceptance', () => withPagesTemplate(async f => {
  const history = workRuns({ db: f.db, know: f.know });
  const work = layerTask(f, 'Person repository review', { assignee: { kind: 'person', id: f.owner.id } });
  f.runs.stage(f.owner, f.projectId, work.id);
  const started = history.startPerson(f.owner, f.projectId, work.id), before = pinOf(f);
  assert.equal(started.task.layerRepository.base, before.commit);
  const checkout = join(f.root, 'person-checkout');
  git(f.root, 'clone', '--quiet', before.repo, checkout);
  git(checkout, 'switch', '-c', 'person-submission');
  edit(join(checkout, 'knowledge/flow-method.md'), text => text + '\nA person reviews the same committed branch.\n');
  git(checkout, 'add', '.');
  git(checkout, '-c', 'user.name=Person', '-c', 'user.email=person@example.invalid', 'commit', '-qm', 'Person changes');
  const commit = git(checkout, 'rev-parse', 'HEAD');
  git(before.repo, 'fetch', '--quiet', checkout, 'person-submission:person-submission');
  const input = { summary: 'Submit a real local branch for owner review.', source: { branch: 'person-submission', commit }, evidence: [{ criterion: 0, note: 'Review the flow-method change.' }] };
  assert.throws(() => history.submitPerson({ id: 'foreign' }, f.projectId, work.id, started.id, input), /Only the person/);
  assert.throws(() => history.submitPerson(f.owner, f.projectId, work.id, started.id, { ...input, source: { ...input.source, commit: before.commit } }), /branch changed/);
  const submitted = history.submitPerson(f.owner, f.projectId, work.id, started.id, input);
  assert.equal(submitted.state, 'review');assert.equal(submitted.performer.kind, 'person');assert.equal(submitted.layerSource.commit, commit);assert.ok(submitted.changes.some(change => change.name === 'knowledge/flow-method.md'));
  assert.equal(pinOf(f).commit, before.commit);
  assert.throws(() => history.preparePersonReview({ id: 'foreign' }, f.projectId, work.id, started.id), /elevated|owner|member/i);
  const review = history.preparePersonReview(f.owner, f.projectId, work.id, started.id);
  git(checkout, 'switch', '-c', 'person-parallel', before.commit);
  writeFileSync(join(checkout, 'knowledge/parallel-note.md'), '# Parallel accepted note\n');
  git(checkout, 'add', '.');git(checkout, '-c', 'user.name=Person', '-c', 'user.email=person@example.invalid', 'commit', '-qm', 'Another accepted change');
  const parallel = git(checkout, 'rev-parse', 'HEAD');
  git(before.repo, 'fetch', '--quiet', checkout, 'person-parallel:person-parallel');git(before.repo, 'update-ref', 'refs/heads/main', parallel);
  f.db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ?').run(parallel, f.projectId, 'pages');
  assert.throws(() => history.acceptPersonRepository(f.owner, f.projectId, work.id, started.id, review.id), /accepted repository changed/);
  history.saveReview(f.projectId, work.id, started.id, { verdict: { index: 0, value: 'accept' } });
  const fresh = history.preparePersonReview(f.owner, f.projectId, work.id, started.id, true);
  assert.notEqual(fresh.id, review.id);assert.deepEqual(history.runFor(f.projectId, work.id, started.id).review.verdicts, {});
  assert.ok(history.steps(started.id).some(step => step.previousReview.verdicts[0]?.value === 'accept'));
  assert.throws(() => history.acceptPersonRepository(f.owner, f.projectId, work.id, started.id, review.id), /revision changed/);
  await history.sign(f.owner, f.projectId, work.id, started.id, { outcome: 'accept' }, { accept: () => history.acceptPersonRepository(f.owner, f.projectId, work.id, started.id, fresh.id) });
  assert.equal(pinOf(f).commit, fresh.commit);assert.equal(git(before.repo,'show',fresh.commit+':knowledge/parallel-note.md'),'# Parallel accepted note');assert.equal(f.know.workById(f.projectId, work.id).state, 'done');assert.equal(history.runFor(f.projectId, work.id, started.id).state, 'accepted');
}));
