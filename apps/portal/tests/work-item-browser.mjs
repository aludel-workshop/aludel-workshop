// WORK-ITEM-UX-01: the work item page over real run records. Seeds a disposable portal through the same domain modules the
// server uses (a sent-back run, a run in review, a failed run and a draft), starts the portal on it, then drives each state.
// Usage: PLAYWRIGHT_MODULE=<…/playwright/index.mjs> node tests/work-item-browser.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns } from '../server/agent-runs.mjs';
import { codeCandidates, initCodeCandidates } from '../server/code-candidates.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initSymphonyWorker, symphonyWorker } from '../server/symphony-worker.mjs';
import { initWorkRuns, workRuns } from '../server/work-runs.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { chromium } from './browser-support.mjs';

const out = 'test-results/work-item';
mkdirSync(out, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-work-item-'));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
const password = 'correct-horse-battery';

// Seed: one project, W-items in each run state.
const db = openDatabase(join(root, 'machine.sqlite'));
initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db); initCodeCandidates(db); initWorkRuns(db);
const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
const owner = createUser(db, { email: 'owner@example.com', name: 'Charles', password });
const { token } = flows.saveDraft(null, { profile: 'planner' });
flows.saveDraft(token, { name: 'Browser Buddy', pitch: 'A pet in a browser window.' });
const project = flows.claimDraft(token, owner, owner).project;
const projectId = project.id;
know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q');
writeFileSync(join(workspace, 'README.md'), 'Pinned base\n'); git(workspace, 'add', '.');
writeFileSync(join(workspace, 'Dockerfile'), 'FROM node:24-bookworm-slim\nWORKDIR /app\nCOPY server.mjs ./server.mjs\nCMD ["node", "server.mjs"]\n');
writeFileSync(join(workspace, 'server.mjs'), 'import { createServer } from "node:http"; createServer((req, res) => { res.writeHead(req.url === "/api/health" ? 200 : 404); res.end("ok"); }).listen(3000, "0.0.0.0");\n');
git(workspace, 'add', '.');
git(workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
const profile = know.defaultProfile(projectId);
know.update(projectId, profile.id, { model: '', effort: 'medium' }, { rationale: 'Profile-scoped worker fixture' });
const workerRoot = join(root, 'symphony-workspaces'); mkdirSync(workerRoot);
const candidates = codeCandidates({ db, candidateRoot: join(root, 'code-candidates'), externalRoot: workerRoot });
const worker = symphonyWorker({ db, know, candidates, workspaceRoot: workerRoot });
const scope = worker.authenticate('Bearer ' + worker.issueToken(owner, projectId, profile.id).token);
const runs = agentRuns({ db, know, secrets: openSecretStore(root), providers: catalogs.agentProviders.providers, worker, symphonyDispatch: true, callModel: async () => { throw new Error('No model'); } });
const history = workRuns({ db, know, candidates });
const request = "can you write the value proposition for our app? aren't going on much here except that it would be kind of cute to have an interactive pet sitting in an open window in the corner of your screen.";
const create = (title, checks) => {
  const work = know.createWork(projectId, { action: 'product.brief', title, assignee: { kind: 'agent', id: profile.id }, checks }, owner.name);
  if (work.state === 'suggested') know.updateWork(owner, projectId, work.id, { state: 'ready' });
  know.updateWork(owner, projectId, work.id, { task: { request } });
  return know.workById(projectId, work.id);
};
const go = work => {
  runs.stage(owner, projectId, work.id);
  const batch = runs.view(projectId).find(value => value.state === 'draft');
  runs.start(owner, projectId, batch.id);
  const issue = worker.issues(scope, { states: ['Ready'] }).issues.find(value => value.native_ref.work_id === work.id);
  const clone = join(workerRoot, issue.identifier);
  rmSync(clone, { recursive: true, force: true });
  git(root, 'clone', workspace, clone); git(clone, 'checkout', '--detach', issue.native_ref.repository_commit);
  writeFileSync(join(clone, '.git', 'aludel-base'), issue.native_ref.repository_commit + '\n');
  worker.registerWorkspace(scope, { attemptId: issue.native_ref.attempt_id, path: clone });
  worker.reserveRun(scope, { attemptId: issue.native_ref.attempt_id });
  return issue.native_ref.attempt_id;
};
const plan = (attemptId, objectives, done, stuck) => {
  history.addStep(attemptId, 'plan', { objectives });
  objectives.forEach((_, index) => { if (index < done) { history.addStep(attemptId, 'progress', { index, status: 'active' }); history.addStep(attemptId, 'progress', { index, status: 'done' }); } });
  if (stuck) history.addStep(attemptId, 'progress', { index: done, status: 'stuck', note: stuck });
};
const claim = text => ({ summary: 'A value claim.', content: { section: 'value', text, note: 'From the request.', basis: 'The W-4 request.' }, usedInputs: [] });
const reject = (work) => ({ reject: run => { runs.rejectBrief(projectId, work.id, run.proposalId); worker.rejectProposal(projectId, work.id, run.proposalId); } });

const review = create('write value prop', ['Each claim is one short, checkable statement']);
const first = go(review);
plan(first, ['Open the task card', 'Check the existing Vision, stories and design direction', 'Keep the proposal narrow', 'Submit the proposal'], 4);
worker.submitProposal(scope, { attemptId: first, proposal: claim('Keep an interactive pet in a small browser window in the corner of your screen.') });
const [run1] = history.list(projectId, review.id);
history.saveReview(projectId, review.id, first, { flag: { id: run1.changes[0].id, note: 'This adds a second value claim. It should replace “A pet in a browser window”.' } });
await history.sign(owner, projectId, review.id, first, { outcome: 'reject', comment: 'Meets the one check it had, but the check was too thin. I added criteria.' }, reject(review));
know.updateWork(owner, projectId, review.id, { task: { criteria: ['Each claim is one short, checkable statement', 'The value describes an interactive pet in a small window in the corner of the screen',
  'It adds no outcome the request did not ask for, such as mood, focus or productivity', 'The Brief keeps exactly one value claim'] } });
const second = go(know.workById(projectId, review.id));
plan(second, ['Read why run 1 was sent back', 'Re-read the current value claim and the request', 'Look for guidance on what a value claim should say', 'Revise the claim', 'Check the draft against the criteria', 'Submit for review'], 6);
worker.submitProposal(scope, { attemptId: second, proposal: claim('A small interactive pet that lives in a browser window in the corner of your screen.') });
history.recordEvidence(second, history.checkEvidence(projectId, second, [
  { criterion: 0, type: 'change', ref: 'Vision › Brief › Value', note: 'One sentence, 17 words' },
  { criterion: 1, type: 'change', ref: 'Vision › Brief › Value', note: 'Names the pet, a window and the corner' },
  { criterion: 1, type: 'try', ref: 'Read the claim next to the request' },
  { criterion: 2, type: 'change', ref: 'Vision › Brief › Value', note: 'No mood, focus or productivity words' },
  { criterion: 3, type: 'change', ref: 'Vision › Brief › Value', note: 'Revises the existing claim' }]));

const failing = create('describe who it is for', ['Names one audience']);
const failed = go(failing);
plan(failed, ['Open the task card', 'Read the Brief', 'Draft an audience claim'], 2, 'Preview port 5173 was in use');
worker.appendEvent(scope, { attemptId: failed, eventId: 'runtime-error', kind: 'error', message: 'The preview could not start: port 5173 is in use.' });

const draft = create('write the problem statement', ['States one problem in the user’s words']);
const personal = know.createWork(projectId, { action: 'product.brief', title: 'shape the next checkpoint',
  assignee: { kind: 'person', id: owner.id }, checks: ['The checkpoint has a clear outcome', 'The result is ready for the owner to inspect'] }, owner.name);
if (personal.state === 'suggested') know.updateWork(owner, projectId, personal.id, { state: 'ready' });
const story = know.list(projectId, 'story')[0] || know.insert(projectId, 'story', { title: 'Show a healthy preview', phase: 'demo' });
const code = know.createWork(projectId, { action: 'platform.implement', title: 'show the exact code review',
  assignee: { kind: 'agent', id: profile.id }, targets: [{ id: story.id, label: `S${story.number}` }],
  checks: ['The submitted change is visible in the diff', 'The exact candidate preview answers its health check'] }, owner.name);
if (code.state === 'suggested') know.updateWork(owner, projectId, code.id, { state: 'ready' });
const codeAttempt = go(know.workById(projectId, code.id));
const codeRow = db.prepare('SELECT workspace_path FROM symphony_attempts WHERE id = ?').get(codeAttempt);
writeFileSync(join(codeRow.workspace_path, 'README.md'), 'Pinned base\n\nCandidate review is visible.\n');
git(codeRow.workspace_path, 'add', 'README.md');
git(codeRow.workspace_path, '-c', 'user.name=Agent', '-c', 'user.email=agent@example.invalid', 'commit', '-qm', 'Show candidate review', '-m', `Aludel-Work: ${code.ref}`);
const codeCommit = git(codeRow.workspace_path, 'rev-parse', 'HEAD');
const codeCandidate = worker.submitCandidate(scope, { attemptId: codeAttempt, commit: codeCommit,
  checks: [{ name: 'README review fixture', status: 'passed', detail: 'Candidate contains the review marker.' }] }).candidate;
db.close();

// Serve it.
const port = await new Promise(resolve => { const probe = createServer().listen(0, '127.0.0.1', () => { const { port: free } = probe.address(); probe.close(() => resolve(free)); }); });
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_SYMPHONY_WORKSPACE_ROOT: workerRoot, MACHINE_SYMPHONY_DISPATCH: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', chunk => serverLog += chunk); server.stderr.on('data', chunk => serverLog += chunk);
const portal = `http://aludel.localhost:${port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (let i = 0; i < 80 && !/listening|http:\/\//i.test(serverLog); i++) await new Promise(resolve => setTimeout(resolve, 150));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const signIn = await context.request.post(`${portal}/api/sign-in`, { data: { email: 'owner@example.com', password } });
  assert.ok(signIn.ok(), `sign-in ${signIn.status()} ${await signIn.text()}`);
  const page = await context.newPage();
  await page.addInitScript({ path: 'node_modules/axe-core/axe.min.js' });
  page.on('pageerror', error => errors.push(error.message));
  const open = async (work, name) => { await page.goto(`${portal}/p/${project.slug}/work/item/${work.id}`); await page.getByRole('heading', { name: work.title, level: 1 }).waitFor(); await page.waitForTimeout(400); };
  const section = name => page.locator('details.wi-sec', { has: page.locator('summary', { hasText: name }) }).evaluate(element => { element.open = true; });
  const shot = name => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  const axe = async () => {
    return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
      .violations.map(item => `${item.id}: ${item.nodes[0]?.target}`));
  };

  // Ready for review: run 2 selected, run 1 to its left, the status block's call to action first.
  await open(review);
  assert.equal(await page.getByRole('tab', { selected: true }).innerText().then(text => text.replace(/\s+/g, ' ').trim()), 'Run 2 Run complete');
  await page.getByRole('heading', { name: 'Run complete', level: 2 }).waitFor();
  await page.getByRole('button', { name: /objectives/ }).click();
  await page.getByText('Look for guidance on what a value claim should say').waitFor();
  await page.locator('.wi-who').focus();
  await page.locator('.wi-hovercard').waitFor({ state: 'visible' });
  const criteriaSection = page.locator('details.wi-sec', { has: page.locator('summary', { hasText: 'Criteria' }) });
  await criteriaSection.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await criteriaSection.evaluate(element => element.open), true, 'keyboard opens a ruled section');
  await shot('review');
  // Flag a change: Reject shows the count, and Accept warns before signing.
  await section('Changes');
  await page.locator('.wi-change').first().hover();
  await page.getByRole('button', { name: /^Flag Vision › Brief › Value/ }).click();
  await page.getByPlaceholder("What's wrong with this change?").fill('Too long for a claim');
  await page.getByPlaceholder("What's wrong with this change?").press('Tab');
  await page.getByRole('button', { name: /Reject\s*1 flag/ }).waitFor();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await page.getByText(/1 flag will be dropped/).waitFor();
  await shot('review-signoff');
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Review mode: one criterion at a time, with the claim as a was/now card; A, R, Skip, then the sign-off summary.
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await page.getByRole('heading', { name: /Review W-1 · Run 2/ }).waitFor();
  await page.locator('.wr-change .wr-now', { hasText: 'A small interactive pet' }).waitFor();
  await page.getByRole('heading', { name: 'Each claim is one short, checkable statement', level: 2 }).waitFor();
  await page.getByText('One sentence, 17 words').waitFor();
  await page.getByText(/Named by the run when it submitted/).waitFor();
  await shot('review-mode');
  await page.keyboard.press('a');
  await page.getByText('Criterion 2 of 4').waitFor();
  await page.getByText('Named by the performer, but not in the review packet').waitFor();
  await page.keyboard.press('r');
  await page.getByPlaceholder('What should change?').fill('Say it is a desktop companion');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Criterion 3 of 4').waitFor();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByText('Criterion 4 of 4').waitFor();
  await page.getByRole('button', { name: /Accept/ }).click();
  await page.getByRole('heading', { name: 'Send back with 2 flags', level: 2 }).waitFor();
  await page.getByText('Say it is a desktop companion').waitFor();
  await shot('review-signoff-step');
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Run complete', level: 2 }).waitFor();

  // The sent-back run keeps what it was given, its flag and the signature.
  await page.getByRole('tab', { name: /Run 1/ }).click();
  await page.getByRole('heading', { name: 'Sent back', level: 2 }).waitFor();
  await page.getByText('Signed by Charles').waitFor();
  await section('Criteria');
  assert.equal(await page.locator('.wi-crits > li').count(), 1, 'run 1 shows the single criterion it was given');
  await section('Changes');
  await page.getByText('This adds a second value claim').waitFor();
  await shot('sent-back');

  // Send run 2 back from the status block: Next run appears with the carried notes.
  await page.getByRole('tab', { name: /Run 2/ }).click();
  await page.getByRole('button', { name: /Reject/ }).click();
  await page.getByLabel('Overall comment (optional)').fill('Shorter, please.');
  await page.getByRole('button', { name: 'Sign and send back' }).click();
  await page.getByRole('tab', { name: /Next run/ }).waitFor();
  await page.getByRole('tab', { name: /Next run/, selected: true }).waitFor();
  await page.getByText('Comment: “Shorter, please.”').waitFor();
  await page.getByText('Too long for a claim').waitFor();
  await shot('next-run-after-send-back');

  // A failed run can only be closed.
  await open(failing);
  await page.getByRole('heading', { name: 'Failed', level: 2 }).waitFor();
  await page.getByText(/port 5173 is in use/).first().waitFor();
  assert.equal(await page.getByRole('button', { name: 'Accept', exact: true }).count(), 0);
  await page.getByRole('button', { name: /objectives/ }).click();
  await page.getByRole('button', { name: 'Open the agent log' }).click();
  await shot('failed');
  await page.getByRole('button', { name: 'Close run' }).click();
  await page.getByRole('button', { name: 'Sign and close' }).click();
  await page.getByRole('tab', { name: /Next run/, selected: true }).waitFor();

  // Before any run: only Next run, editable, with the assignee in its status block.
  await open(draft);
  assert.equal(await page.locator('.wi-runcount').innerText(), 'No runs yet');
  await page.getByRole('heading', { name: 'Next run', level: 2 }).waitFor();
  await page.getByRole('button', { name: 'Add a criterion' }).click();
  await page.getByRole('textbox', { name: 'Criterion 2' }).fill('Says who has the problem');
  await page.getByRole('button', { name: 'Save task' }).click();
  await page.getByText('Task saved for the next run.').waitFor();
  assert.deepEqual(await axe(), [], 'work item has no WCAG A/AA axe violations');
  await shot('before-work');
  await page.setViewportSize({ width: 400, height: 900 });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll at 400px');
  await shot('before-work-narrow');

  // A person gets the same run/review/signature loop without invented model, token or agent-log data.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(personal);
  await page.getByRole('button', { name: /Stage in your batch/ }).click();
  await page.getByRole('button', { name: "I'm working" }).click();
  await page.getByRole('tab', { name: /Run 1 Working/, selected: true }).waitFor();
  await page.getByText('No agent telemetry').waitFor({ state: 'hidden' });
  await page.locator('.wi-who').focus();
  await page.getByText('No agent telemetry').waitFor();
  assert.equal(await page.getByRole('button', { name: /agent log/i }).count(), 0);
  await page.getByRole('button', { name: 'Ready for review' }).click();
  await page.getByLabel('What is ready for review').fill('The checkpoint outcome and review boundary are written down.');
  await page.getByLabel(/Evidence for 1/).fill('Read the checkpoint outcome in the planning notes.');
  await page.getByLabel(/Evidence for 2/).fill('The review packet names what the owner should inspect.');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByRole('heading', { name: 'Run complete', level: 2 }).waitFor();
  await page.getByText('Performer summary').waitFor();
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await page.getByText('Performer evidence').first().waitFor();
  await page.getByText('Read the checkpoint outcome in the planning notes.').waitFor();
  await page.keyboard.press('a');
  await page.getByText('Criterion 2 of 2').waitFor();
  await page.keyboard.press('a');
  await page.getByRole('heading', { name: 'Everything checks out', level: 2 }).waitFor();
  await page.getByRole('button', { name: 'Sign and accept' }).click();
  await page.getByText(/Run 1 accepted and signed off/).waitFor();
  await shot('person-run-accepted');

  // A real code candidate builds an isolated preview; review exposes Preview, Tests and Changes, then accepts the exact commit.
  const built = await context.request.post(`${portal}/api/projects/${projectId}/candidates/${codeCandidate.id}/preview`, { data: {} });
  assert.ok(built.ok(), `candidate preview ${built.status()} ${await built.text()}`);
  assert.equal((await built.json()).preview.status, 'running');
  await open(code);
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: /Preview/ }).waitFor();
  await page.getByRole('tab', { name: /Tests/ }).waitFor();
  await page.getByRole('tab', { name: /Changes/ }).click();
  await page.getByRole('button', { name: 'Show the code diff' }).click();
  await page.locator('.wr-diff').waitFor();
  assert.match(await page.locator('.wr-diff').innerText(), /Candidate review is visible/, 'review shows the candidate diff');
  await page.keyboard.press('a');
  await page.getByText('Criterion 2 of 2').waitFor();
  await page.keyboard.press('a');
  await page.getByRole('heading', { name: 'Everything checks out', level: 2 }).waitFor();
  await page.getByRole('button', { name: 'Sign and accept' }).click();
  await page.getByText(/Run 1 accepted and applied/).waitFor();
  assert.equal(git(workspace, 'rev-parse', 'HEAD'), codeCommit, 'accepting the review fast-forwards the exact candidate commit');
  await shot('code-run-accepted');

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`work item browser check passed; screenshots in ${out}`);
} catch (error) {
  console.error(serverLog.slice(-2000));
  throw error;
} finally {
  await browser.close();
  server.kill();
  rmSync(root, { recursive: true, force: true });
}
