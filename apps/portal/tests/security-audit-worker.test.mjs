import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
test('security audit: Go, scoped reads, question, new Go, read-only report, review', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-audit-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  try {
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db);
    const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'owner@example.com', name: 'Owner', password: 'correct-horse-battery' });
    const { token } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(token, { name: 'Audit Test', pitch: 'Disposable audit project' });
    const projectId = flows.claimDraft(token, owner, owner).project.id;
    know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
    know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
    const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
    mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q');
    writeFileSync(join(workspace, 'README.md'), 'Audit base\n'); git(workspace, 'add', '.');
    git(workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
    const profile = know.defaultProfile(projectId);
    const workerRoot = join(root, 'worker');
    const worker = symphonyWorker({ db, know, workspaceRoot: workerRoot });
    const poolCredential = join(root, 'worker-pool-token');
    worker.ensurePool(projectId, poolCredential);
    worker.heartbeat(worker.authenticate('Bearer ' + readFileSync(poolCredential, 'utf8').trim()), 1, true);
    const credential = worker.issueToken(owner, projectId, profile.id).token;
    const scope = worker.authenticate('Bearer ' + credential);
    const runs = agentRuns({ db, know, secrets: openSecretStore(root), providers: catalogs.agentProviders.providers, worker, symphonyDispatch: true,
      callModel: async () => { throw new Error('Structured provider must not run'); } });
    const target = know.list(projectId, 'doc')[0]; assert.ok(target);
    const work = know.createWork(projectId, { action: 'platform.security', title: 'Audit session handling', assignee: { kind: 'agent', id: profile.id },
      targets: [{ id: target.id, label: 'Security context' }], checks: ['Every finding names severity and affected source'] }, owner.name);
    assert.throws(() => know.updateWork(owner, projectId, work.id, { state: 'done' }), /submitted security report/);
    if (work.state === 'suggested') know.updateWork(owner, projectId, work.id, { state: 'ready' });
    runs.stage(owner, projectId, work.id);
    let batchId = runs.view(projectId).find(value => value.state === 'draft').id;
    assert.equal(runs.start(owner, projectId, batchId).job, null);
    let issue = worker.issues(scope, { states: ['Ready'] }).issues[0]; assert.ok(issue);
    let card = worker.taskOpen(scope, issue.native_ref.bundle_digest);
    assert.equal(card.task.action.id, 'platform.security'); assert.equal(card.capabilities.repository, 'read-only pinned commit');
    assert.ok(Array.isArray(card.contextSeeds));
    assert.ok(Buffer.byteLength(JSON.stringify(card)) < 10000, 'entry card stays compact on a seeded project');
    const portProbe = createServer();
    await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
    const port = portProbe.address().port;
    await new Promise(resolve => portProbe.close(resolve));
    const portal = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
      env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: 'ignore' });
    try {
      const origin = `http://127.0.0.1:${port}`;
      let ready = false;
      const deadline = Date.now() + 8000;
      while (!ready && Date.now() < deadline) {
        try { ready = (await fetch(origin + '/api/session')).ok; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
      }
      assert.ok(ready, 'disposable portal started');
      const auth = { authorization: 'Bearer ' + credential };
      const opened = await fetch(origin + '/api/worker/tasks/' + card.digest, { headers: auth });
      assert.equal(opened.status, 200, await opened.clone().text());
      assert.equal((await opened.json()).task.action.id, 'platform.security');
      const sourceRead = await fetch(origin + '/api/worker/attempts/' + issue.native_ref.attempt_id + '/source?path=README.md', { headers: auth });
      assert.equal(sourceRead.status, 200, await sourceRead.clone().text());
      assert.equal((await sourceRead.json()).text, 'Audit base\n');
      const secretRead = await fetch(origin + '/api/worker/attempts/' + issue.native_ref.attempt_id + '/source?path=.env', { headers: auth });
      assert.equal(secretRead.status, 404);
      const mapped = await fetch(origin + '/api/worker/knowledge/map?digest=' + card.digest, { headers: auth });
      assert.equal(mapped.status, 200);
      assert.ok((await mapped.json()).kinds.some(value => value.kind === 'doc'));
      const denied = await fetch(origin + '/api/worker/tasks/' + '0'.repeat(64), { headers: auth });
      assert.equal(denied.status, 404);
    } finally { portal.kill(); await new Promise(resolve => portal.once('exit', resolve)); }

    assert.ok(worker.knowledgeMap(scope, card.digest).kinds.some(value => value.kind === 'doc'));
    const doc = know.list(projectId, 'doc')[0];
    if (doc) assert.equal(worker.knowledgeRead(scope, card.digest, doc.id, doc.revision).revision, doc.revision);
    assert.throws(() => worker.knowledgeRead(scope, '0'.repeat(64), doc?.id || 'missing'), /not found|authorized/i);
    assert.throws(() => worker.knowledgeSearch(scope, card.digest, 'x'), /Invalid knowledge search/);
    mkdirSync(workerRoot);
    const prepare = issue => { const clone = join(workerRoot, issue.identifier); git(root, 'clone', workspace, clone); git(clone, 'checkout', '--detach', issue.native_ref.repository_commit);
      writeFileSync(join(clone, '.git', 'aludel-base'), issue.native_ref.repository_commit + '\n');
      worker.registerWorkspace(scope, { attemptId: issue.native_ref.attempt_id, path: clone }); worker.reserveRun(scope, { attemptId: issue.native_ref.attempt_id }); return clone; };
    let clone = prepare(issue);
    assert.equal(know.workById(projectId, work.id).status, 'working');
    assert.throws(() => worker.commitCandidate(scope, { attemptId: issue.native_ref.attempt_id }), /cannot commit code/);
    assert.throws(() => worker.submitCandidate(scope, { attemptId: issue.native_ref.attempt_id, commit: issue.native_ref.repository_commit }), /cannot submit code/);
    const asked = worker.askQuestion(scope, { attemptId: issue.native_ref.attempt_id, question: 'Which session paths must be in scope?', reason: 'The work brief leaves the release surface unclear.', options: ['Sign in and sign out', 'All routes'] });
    assert.equal(asked.question.text, 'Which session paths must be in scope?');
    assert.equal(know.workById(projectId, work.id).status, 'needs');
    assert.equal(worker.askQuestion(scope, { attemptId: issue.native_ref.attempt_id, question: asked.question.text }).question.text, asked.question.text);
    assert.throws(() => worker.askQuestion(scope, { attemptId: issue.native_ref.attempt_id, question: 'A different blocking question?' }), /different question/);
    assert.equal(worker.issues(scope, { states: ['Ready'] }).issues.length, 0);
    know.updateWork(owner, projectId, work.id, { answer: 'Sign in and sign out', rationale: 'This release touches those flows.' });
    assert.equal(know.workById(projectId, work.id).state, 'ready');
    runs.stage(owner, projectId, work.id);
    batchId = runs.view(projectId).find(value => value.state === 'draft' && value.id !== batchId).id;
    const activePool = worker.poolStatus(projectId).credentialPath;
    worker.heartbeat(worker.authenticate('Bearer ' + readFileSync(activePool, 'utf8').trim()), 1, true);
    runs.start(owner, projectId, batchId);
    issue = worker.issues(scope, { states: ['Ready'] }).issues[0];
    assert.notEqual(issue.native_ref.attempt_id, asked.attemptId);
    card = worker.taskOpen(scope, issue.native_ref.bundle_digest);
    assert.equal(card.task.answeredQuestion.answer, 'Sign in and sign out');
    rmSync(clone, { recursive: true }); clone = prepare(issue);
    const report = { summary: 'Checked the pinned session implementation and found one scoped issue.', findings: [
      { severity: 'medium', title: 'Session expiry unclear', affected: 'README.md at pinned commit', evidence: 'The source states no expiry rule.', recommendation: 'Define and test expiry.' }
    ], checks: [{ name: 'Review session scope', status: 'passed', detail: 'Read the pinned source.' }], usedInputs: [{ id: target.id, revision: target.revision }] };
    writeFileSync(join(clone, 'scratch.txt'), 'Unexpected edit\n');
    assert.throws(() => worker.submitAudit(scope, { attemptId: issue.native_ref.attempt_id, report }), /workspace changed/);
    rmSync(join(clone, 'scratch.txt'));
    assert.throws(() => worker.submitAudit(scope, { attemptId: issue.native_ref.attempt_id, report: { ...report, usedInputs: [] } }), /pinned target/);
    const result = worker.submitAudit(scope, { attemptId: issue.native_ref.attempt_id, report });
    assert.equal(worker.submitAudit(scope, { attemptId: issue.native_ref.attempt_id, report }).reportId, result.reportId);
    const portalAfterSubmit = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
      env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: 'ignore' });
    try {
      const origin = `http://127.0.0.1:${port}`;
      let ready = false; const deadline = Date.now() + 8000;
      while (!ready && Date.now() < deadline) {
        try { ready = (await fetch(origin + '/api/session')).ok; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
      }
      assert.ok(ready, 'portal restarted after report submission');
      const repeated = await fetch(origin + `/api/worker/attempts/${issue.native_ref.attempt_id}/audit`, {
        method: 'POST', headers: { authorization: 'Bearer ' + credential, 'content-type': 'application/json' }, body: JSON.stringify({ report }) });
      assert.equal(repeated.status, 200, await repeated.clone().text());
      assert.equal((await repeated.json()).reportId, result.reportId);
    } finally { portalAfterSubmit.kill(); await new Promise(resolve => portalAfterSubmit.once('exit', resolve)); }

    assert.equal(know.workById(projectId, work.id).state, 'review');
    assert.equal(know.workById(projectId, work.id).context.run.done, true);
    assert.equal(know.workById(projectId, work.id).context.auditReport.findings[0].severity, 'medium');
    assert.equal(worker.issues(scope, { ids: [issue.id] }).issues[0].state, 'Submitted');
    assert.throws(() => know.updateWork(owner, projectId, work.id, { state: 'done' }), /Accept every check/);
    know.updateWork(owner, projectId, work.id, { verdict: { index: 0, value: 'accept' } });
    assert.equal(know.updateWork(owner, projectId, work.id, { state: 'done' }).state, 'done');
    assert.equal(git(workspace, 'rev-parse', 'HEAD'), card.runtime.repositoryCommit);
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
