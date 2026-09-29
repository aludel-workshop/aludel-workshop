import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSession, createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns } from '../server/agent-runs.mjs';
import { codeCandidates, initCodeCandidates } from '../server/code-candidates.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { previewImageName } from '../server/previews.mjs';
import { initSymphonyWorker, symphonyWorker } from '../server/symphony-worker.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();

test('worker token scopes pinned coding work; ID refresh withdraws skipped and stopped items', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-symphony-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initCodeCandidates(db); initSymphonyWorker(db);
  const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'),
    assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const owner = createUser(db, { email: 'owner@example.com', name: 'Owner', password: 'correct-horse-battery' });
  const outsider = createUser(db, { email: 'outsider@example.com', name: 'Outsider', password: 'correct-horse-battery' });
  const makeProject = name => {
    const { token } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(token, { name, pitch: 'A test project' });
    return flows.claimDraft(token, owner, owner).project.id;
  };
  const projectId = makeProject('Buddy Box');
  const otherProjectId = makeProject('Other Project');
  know.ensureDesign(projectId);
  const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
  mkdirSync(workspace, { recursive: true });
  git(workspace, 'init', '-q');
  writeFileSync(join(workspace, 'README.md'), 'Initial project\n');
  writeFileSync(join(workspace, 'Dockerfile'), 'FROM node:24-bookworm-slim\nWORKDIR /app\nCOPY server.mjs ./server.mjs\nCMD [\"node\", \"server.mjs\"]\n');
  writeFileSync(join(workspace, 'server.mjs'), 'import { createServer } from \"node:http\"; createServer((req, res) => { res.writeHead(req.url === \"/api/health\" ? 200 : 404); res.end(\"ok\"); }).listen(3000, \"0.0.0.0\");\n');
  git(workspace, 'add', '.');
  git(workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
  const profile = know.defaultProfile(projectId);
  assert.ok(profile);
  know.update(projectId, profile.id, { model: '', effort: 'medium' }, { rationale: 'Legacy profile-scoped worker fixture has no per-turn override signal' });
  const story = know.list(projectId, 'story')[0] || know.insert(projectId, 'story', { title: 'Build posts', phase: 'demo' });
  const work = know.createWork(projectId, { action: 'platform.implement', title: 'Build posts', assignee: { kind: 'agent', id: profile.id },
    targets: story ? [{ id: story.id, label: 'Story' }] : [] }, owner.name);
  const symphonyRoot = join(root, 'symphony-workspaces');
  const candidates = codeCandidates({ db, candidateRoot: join(root, 'code-candidates'), externalRoot: symphonyRoot });
  const worker = symphonyWorker({ db, know, candidates, workspaceRoot: symphonyRoot });
  assert.throws(() => worker.issueToken(outsider, projectId, profile.id), error => error.status === 403);
  const firstToken = worker.issueToken(owner, projectId, profile.id);
  assert.equal(worker.status(owner, projectId, profile.id).connected, true);
  assert.equal(worker.hasConnection(projectId, profile.id), false, 'a token alone is not a running worker');
  const scope = worker.authenticate('Bearer ' + firstToken.token);
  assert.equal(worker.hasConnection(projectId, profile.id), true, 'authenticated worker polling makes the profile runnable');
  db.prepare('UPDATE symphony_worker_tokens SET last_seen_at = ? WHERE project_id = ? AND profile_id = ?')
    .run('2020-01-01T00:00:00.000Z', projectId, profile.id);
  assert.equal(worker.hasConnection(projectId, profile.id), false, 'a stale worker cannot receive new Go work');
  worker.authenticate('Bearer ' + firstToken.token);
  assert.equal(scope.projectId, projectId);
  assert.throws(() => worker.authenticate('Bearer wrong'), error => error.status === 401);
  const runs = agentRuns({ db, know, secrets: openSecretStore(root), providers: catalogs.agentProviders.providers, worker, symphonyDispatch: true,
    callModel: async () => { throw new Error('Structured model must not run for coding work'); } });
  if (know.workById(projectId, work.id).state === 'suggested') know.updateWork(owner, projectId, work.id, { state: 'ready' });
  runs.stage(owner, projectId, work.id);
  const batchId = runs.view(projectId)[0].id;
  assert.equal(worker.issues(scope).issues.length, 0, 'draft does not authorize execution');
  assert.equal(runs.start(owner, projectId, batchId).job, null, 'coding Go does not call the structured runner');
  const entry = know.workById(projectId, work.id);
  const page = worker.issues(scope, { states: ['Ready'], limit: 1 });
  const bundle = worker.saved(scope, page.issues[0].native_ref.bundle_digest);
  assert.equal(bundle.repository.commit, git(workspace, 'rev-parse', 'HEAD'));
  assert.equal(bundle.guidance.action.id, 'platform.implement');
  assert.equal(page.issues.length, 1);
  assert.equal(worker.issues(scope, { states: ['Ready'], cursor: page.issues[0].id }).issues.length, 0, 'keyset cursor advances by stable issue ID');
  assert.equal(page.issues[0].native_ref.bundle_digest, bundle.digest);
  assert.equal(worker.issues(scope, { ids: [`${otherProjectId}:${work.id}`] }).issues.length, 0);
  assert.equal(worker.issues(scope, { ids: [page.issues[0].id] }).issues.length, 1, 'ID refresh finds authorized work');
  assert.throws(() => worker.issueToken(owner, projectId, profile.id), error => error.status === 409, 'active token cannot rotate under a run');
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const portal = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: 'ignore'
  });
  const origin = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    const deadline = Date.now() + 8000;
    while (!ready && Date.now() < deadline) {
      try { ready = (await fetch(origin + '/api/session')).ok; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.ok(ready, 'portal started on disposable data');
    const auth = { authorization: 'Bearer ' + firstToken.token };
    assert.equal((await fetch(origin + '/api/worker/issues')).status, 401);
    const polled = await fetch(origin + '/api/worker/issues?states=Ready', { headers: auth });
    assert.equal(polled.status, 200, await polled.clone().text());
    const polledBody = await polled.json();
    assert.equal(polledBody.issues[0].id, page.issues[0].id);
    const refreshed = await fetch(origin + '/api/worker/issues?ids=' + encodeURIComponent(page.issues[0].id), { headers: auth });
    assert.equal((await refreshed.json()).issues.length, 1);
    const context = await fetch(origin + '/api/worker/bundles/' + bundle.digest, { headers: auth });
    assert.equal(context.status, 200);
    assert.equal((await context.json()).digest, bundle.digest);
    assert.equal((await fetch(origin + '/api/worker/issues', { method: 'POST', headers: auth })).status, 405);
    const session = { cookie: createSession(db, owner.id).split(';')[0] };
    const status = await fetch(origin + `/api/projects/${projectId}/agents/symphony`, { headers: session });
    assert.equal((await status.json()).online, true);
    const pairing = await fetch(origin + `/api/projects/${projectId}/agents/symphony`, { method: 'POST', headers: { ...session, 'content-type': 'application/json' }, body: JSON.stringify({ profileId: profile.id }) });
    assert.equal(pairing.status, 404, 'Work no longer exposes manual worker pairing');
  } finally {
    portal.kill();
    await new Promise(resolve => portal.once('exit', resolve));
  }
  writeFileSync(join(workspace, 'README.md'), 'Changed after Go\n');
  assert.equal(worker.saved(scope, bundle.digest).repository.commit, bundle.repository.commit, 'bundle remains pinned');
  assert.equal(worker.issues(scope, { states: ['Ready'] }).issues.length, 0, 'dirty source withdraws the issue');
  assert.equal(worker.issues(scope, { ids: [page.issues[0].id] }).issues[0].state, 'Blocked');
  writeFileSync(join(workspace, 'README.md'), 'Initial project\n');
  db.prepare('UPDATE layer_work_items SET context_json = ? WHERE id = ?').run(JSON.stringify({ ...entry.context, batch: batchId, skip: true }), work.id);
  const skipped = worker.issues(scope, { ids: [page.issues[0].id] }).issues[0];
  assert.equal(skipped.state, 'Stopped', 'ID refresh reports a terminal state');
  assert.equal(skipped.dispatchable, false);
  assert.equal(worker.issues(scope, { states: ['Ready'] }).issues.length, 0);
  runs.stop(owner, projectId, batchId);
  assert.equal(worker.issues(scope, { states: ['Stopped'] }).issues[0].state, 'Stopped');
  assert.throws(() => worker.revoke(owner, projectId, profile.id), error => error.status === 409, 'stop has not acknowledged worker cancellation');
  const nextBatch = runs.view(projectId).find(value => value.state === 'draft');
  assert.ok(nextBatch, 'stopped work was restaged for a new Go');
  runs.start(owner, projectId, nextBatch.id);
  const secondIssue = worker.issues(scope, { states: ['Ready'] }).issues[0];
  const secondAttempt = secondIssue.native_ref.attempt_id;
  const clone = join(symphonyRoot, secondIssue.identifier);
  git(root, 'clone', workspace, clone);
  git(clone, 'checkout', '--detach', secondIssue.native_ref.repository_commit);
  writeFileSync(join(clone, '.git', 'aludel-base'), secondIssue.native_ref.repository_commit + '\n');
  assert.equal(worker.registerWorkspace(scope, { attemptId: secondAttempt, path: clone }).registered, true);
  assert.equal(worker.registerWorkspace(scope, { attemptId: secondAttempt, path: clone }).registered, true, 'workspace registration is idempotent');
  assert.deepEqual(worker.reserveRun(scope, { attemptId: secondAttempt }), { attemptId: secondAttempt, runsStarted: 1, runLimit: 3 });
  assert.equal(worker.issues(scope, { states: ['Ready'] }).issues.length, 1, 'one reserved run still leaves work resumable');
  writeFileSync(join(clone, 'resume.txt'), 'preserve pending work\n');
  const resumedPortal = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: 'ignore'
  });
  try {
    let ready = false;
    const deadline = Date.now() + 8000;
    while (!ready && Date.now() < deadline) {
      try { ready = (await fetch(`http://127.0.0.1:${port}/api/session`)).ok; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.ok(ready, 'portal restarted mid-attempt');
    const resumed = await fetch(`http://127.0.0.1:${port}/api/worker/attempts/${secondAttempt}/runs`, {
      method: 'POST', headers: { authorization: 'Bearer ' + firstToken.token, 'content-type': 'application/json' }, body: '{}'
    });
    assert.equal(resumed.status, 200, await resumed.clone().text());
    assert.equal((await resumed.json()).runsStarted, 2);
    assert.equal(git(clone, 'status', '--porcelain').includes('resume.txt'), true, 'restart retained unfinished workspace edits');
  } finally {
    resumedPortal.kill();
    await new Promise(resolve => resumedPortal.once('exit', resolve));
  }
  assert.equal(worker.reserveRun(scope, { attemptId: secondAttempt }).runsStarted, 3);
  assert.equal(worker.issues(scope, { states: ['Ready'] }).issues.length, 1, 'the final reserved turn remains routed while it runs');
  worker.appendEvent(scope, { attemptId: secondAttempt, eventId: 'run-3-finished', kind: 'finished' });
  assert.equal(worker.issues(scope, { states: ['Ready'] }).issues.length, 0, 'completion of the final turn withdraws dispatch');
  assert.equal(worker.issues(scope, { ids: [secondIssue.id] }).issues[0].state, 'Blocked');
  assert.deepEqual({ runsStarted: worker.attemptForWork(projectId, work.id).runsStarted, candidateId: worker.attemptForWork(projectId, work.id).candidateId },
    { runsStarted: 3, candidateId: null }, 'owner-facing attempt summary shows exhaustion before a candidate exists');
  assert.throws(() => worker.reserveRun(scope, { attemptId: secondAttempt }), error => error.status === 409);
  assert.equal(worker.activeBundle(scope, secondIssue.native_ref.bundle_digest).digest, secondIssue.native_ref.bundle_digest, 'the final reserved turn retains submission context');
  assert.throws(() => worker.extendRuns(outsider, projectId, work.id, 3), error => error.status === 403);
  assert.throws(() => worker.extendRuns(owner, projectId, work.id, 2), error => error.status === 409, 'stale owner intent cannot extend twice');
  const ownerPortal = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: 'ignore'
  });
  try {
    let ready = false;
    const deadline = Date.now() + 8000;
    while (!ready && Date.now() < deadline) {
      try { ready = (await fetch(`http://127.0.0.1:${port}/api/session`)).ok; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.ok(ready, 'owner route started on persisted exhausted attempt');
    const response = await fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/agents/symphony-runs`, {
      method: 'POST', headers: { cookie: createSession(db, owner.id).split(';')[0], 'content-type': 'application/json' },
      body: JSON.stringify({ workId: work.id, expectedRunLimit: 3 })
    });
    assert.equal(response.status, 200, await response.clone().text());
    const extended = await response.json();
    assert.equal(extended.runLimit, 6);
    assert.equal(extended.runsStarted, 3);
  } finally {
    ownerPortal.kill();
    await new Promise(resolve => ownerPortal.once('exit', resolve));
  }
  assert.throws(() => worker.extendRuns(owner, projectId, work.id, 3), error => error.status === 409);
  assert.equal(worker.issues(scope, { states: ['Ready'] }).issues.length, 1, 'explicit owner reauthorization resumes the same pinned item');
  assert.equal(worker.reserveRun(scope, { attemptId: secondAttempt }).runsStarted, 4);
  worker.appendEvent(scope, { attemptId: secondAttempt, eventId: 'turn-1', kind: 'progress', threadId: 'thread-test', turnId: 'turn-test' });
  worker.appendEvent(scope, { attemptId: secondAttempt, eventId: 'turn-1', kind: 'progress' });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM symphony_attempt_events WHERE attempt_id = ? AND event_id = ?').get(secondAttempt, 'turn-1').count, 1);
  writeFileSync(join(clone, 'README.md'), 'Agent-built candidate\n');
  assert.throws(() => worker.commitCandidate(scope, { attemptId: secondAttempt, checks: [{ command: 'node --test', result: 'passed' }] }), /Agent checks need name/,
    'malformed agent claims are rejected before the host writes Git metadata');
  assert.equal(git(clone, 'rev-parse', 'HEAD'), secondIssue.native_ref.repository_commit);
  const submitted = worker.commitCandidate(scope, { attemptId: secondAttempt, message: 'Build posts', checks: [{ name: 'S1/1', status: 'passed', detail: 'Agent report' }] });
  const commit = git(clone, 'rev-parse', 'HEAD');
  assert.equal(submitted.candidate.commit, commit);
  assert.match(git(clone, 'show', '-s', '--format=%B', commit), new RegExp(`Aludel-Work: ${work.ref}`));
  assert.equal(submitted.candidate.state, 'submitted');
  assert.equal(worker.submitCandidate(scope, { attemptId: secondAttempt, commit }).candidate.id, submitted.candidate.id);
  assert.equal(worker.attemptStatus(scope, secondAttempt).candidateId, submitted.candidate.id);
  assert.equal(worker.issues(scope, { ids: [secondIssue.id] }).issues[0].state, 'Submitted');
  assert.equal(worker.issues(scope, { states: ['Ready'] }).issues.length, 0);
  assert.throws(() => know.updateWork(owner, projectId, work.id, { state: 'done' }), error => error.status === 409 && /exact.*candidate/.test(error.message),
    'a submitted agent report cannot close coding work');
  assert.equal(git(workspace, 'rev-parse', 'HEAD'), bundle.repository.commit, 'submission did not move the shared project');
  rmSync(clone, { recursive: true, force: true }); // Symphony deletes terminal issue workspaces before owner review.
  assert.equal(existsSync(submitted.candidate.path), true, 'Aludel retained an independent exact-commit snapshot');
  const restartedPortal = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
    env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: 'ignore'
  });
  try {
    const origin = `http://127.0.0.1:${port}`;
    let ready = false;
    const deadline = Date.now() + 8000;
    while (!ready && Date.now() < deadline) {
      try { ready = (await fetch(origin + '/api/session')).ok; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.ok(ready, 'portal restored the submitted attempt');
    const auth = { authorization: 'Bearer ' + firstToken.token };
    const attemptStatus = await fetch(origin + `/api/worker/attempts/${secondAttempt}`, { headers: auth });
    assert.equal(attemptStatus.status, 200);
    const restoredAttempt = await attemptStatus.json();
    assert.equal(restoredAttempt.candidateId, submitted.candidate.id);
    assert.equal(restoredAttempt.runsStarted, 4, 'run reservations survive a portal restart');
    assert.equal(restoredAttempt.runLimit, 6);
    const hostCommitAgain = await fetch(origin + `/api/worker/attempts/${secondAttempt}/commit`, {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Build posts' })
    });
    assert.equal(hostCommitAgain.status, 201, 'host commit endpoint returns the exact existing candidate after restart');
    assert.equal((await hostCommitAgain.json()).candidate.commit, commit);
    const again = await fetch(origin + `/api/worker/attempts/${secondAttempt}/candidate`, {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ commit })
    });
    assert.equal(again.status, 201, 'candidate submission is idempotent across a restart');
    const session = { cookie: createSession(db, owner.id).split(';')[0] };
    const listing = await fetch(origin + `/api/projects/${projectId}/candidates?workId=${work.id}`, { headers: session });
    assert.equal(listing.status, 200);
    const listed = await listing.json();
    assert.equal(listed.candidates[0].id, submitted.candidate.id);
    assert.equal(listed.attempt.runsStarted, 4);
    assert.equal(listed.attempt.runLimit, 6);
    assert.equal(listed.attempt.candidateId, submitted.candidate.id);
    const detail = await fetch(origin + `/api/projects/${projectId}/candidates/${submitted.candidate.id}`, { headers: session });
    assert.equal(detail.status, 200);
    assert.match((await detail.json()).diff, /README.md/);
    const built = await fetch(origin + `/api/projects/${projectId}/candidates/${submitted.candidate.id}/preview`, {
      method: 'POST', headers: { ...session, 'content-type': 'application/json' }, body: '{}'
    });
    assert.equal(built.status, 200, await built.clone().text());
    const builtValue = await built.json();
    assert.equal(builtValue.preview.status, 'running');
    const candidateHost = new URL(builtValue.url).host;
    const onCandidateHost = path => new Promise((resolve, reject) => {
      const request = httpRequest({ host: '127.0.0.1', port, path, headers: { host: candidateHost } }, response => {
        response.resume(); response.on('end', () => resolve(response.statusCode));
      });
      request.on('error', reject); request.end();
    });
    assert.equal(await onCandidateHost('/api/health'), 200, 'candidate preview is served from its own host');
    assert.equal(await onCandidateHost('/api/session'), 404, 'the candidate host cannot reach portal session APIs');
    assert.equal(know.workById(projectId, work.id).state, 'review');
    const checks = know.workById(projectId, work.id).checks;
    assert.ok(checks.length > 0, 'the owner has an actual checklist');
    const premature = await fetch(origin + `/api/projects/${projectId}/candidates/${submitted.candidate.id}/accept`, {
      method: 'POST', headers: { ...session, 'content-type': 'application/json' }, body: JSON.stringify({ commit })
    });
    assert.equal(premature.status, 409, 'the owner must accept the checklist first');
    for (let index = 0; index < checks.length; index++) {
      const verdict = await fetch(origin + `/api/projects/${projectId}/work/${work.id}`, {
        method: 'PUT', headers: { ...session, 'content-type': 'application/json' }, body: JSON.stringify({ verdict: { index, value: 'accept' } })
      });
      assert.equal(verdict.status, 200, await verdict.clone().text());
    }
    const accepted = await fetch(origin + `/api/projects/${projectId}/candidates/${submitted.candidate.id}/accept`, {
      method: 'POST', headers: { ...session, 'content-type': 'application/json' }, body: JSON.stringify({ commit })
    });
    assert.equal(accepted.status, 200, await accepted.clone().text());
    assert.equal(git(workspace, 'rev-parse', 'HEAD'), commit);
    assert.equal(know.workById(projectId, work.id).state, 'done');
    // Simulate a crash after Git moved but before the review DB update completed.
    db.prepare("UPDATE code_candidates SET state = 'review' WHERE id = ?").run(submitted.candidate.id);
    db.prepare("UPDATE layer_work_items SET state = 'review' WHERE id = ?").run(work.id);
    const recovered = await fetch(origin + `/api/projects/${projectId}/candidates/${submitted.candidate.id}/accept`, {
      method: 'POST', headers: { ...session, 'content-type': 'application/json' }, body: JSON.stringify({ commit })
    });
    assert.equal(recovered.status, 200, await recovered.clone().text());
    assert.equal(git(workspace, 'rev-parse', 'HEAD'), commit, 'recovery does not merge a second time');
    assert.equal(know.workById(projectId, work.id).state, 'done');
  } finally {
    restartedPortal.kill();
    await new Promise(resolve => restartedPortal.once('exit', resolve));
  }
  assert.equal(db.prepare('SELECT state FROM agent_batches WHERE id = ?').get(nextBatch.id).state, 'done');
  db.prepare("UPDATE agent_batches SET state = 'done' WHERE id IN (?, ?)").run(batchId, nextBatch.id);
  const nextToken = worker.issueToken(owner, projectId, profile.id);
  assert.throws(() => worker.authenticate('Bearer ' + firstToken.token), error => error.status === 401);
  worker.revoke(owner, projectId, profile.id);
  assert.throws(() => worker.authenticate('Bearer ' + nextToken.token), error => error.status === 401);
  db.close();
  spawnSync('docker', ['image', 'rm', '-f', previewImageName(join(root, 'candidate-preview-workspaces'), 'candidate', submitted.candidate.id)], { stdio: 'ignore' });
  rmSync(root, { recursive: true, force: true });
});


test('existing Symphony attempts migrate to a durable run allowance', () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-symphony-migration-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  db.exec(`CREATE TABLE symphony_attempts (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, profile_id TEXT NOT NULL,
    work_id TEXT NOT NULL, batch_id TEXT NOT NULL, bundle_digest TEXT NOT NULL,
    state TEXT NOT NULL, workspace_path TEXT, candidate_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(project_id, work_id, batch_id)
  )`);
  db.prepare("INSERT INTO symphony_attempts VALUES ('att-old', 'p', 'a', 'w', 'b', 'digest', 'working', NULL, NULL, 'now', 'now')").run();
  initSymphonyWorker(db);
  const row = db.prepare("SELECT runs_started, run_limit FROM symphony_attempts WHERE id = 'att-old'").get();
  assert.deepEqual({ ...row }, { runs_started: 3, run_limit: 3 }, 'unknown legacy usage migrates as exhausted');
  db.close();
  rmSync(root, { recursive: true, force: true });
});
