import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { join } from 'node:path';
import test from 'node:test';
import { createSession, createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns } from '../server/agent-runs.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initSymphonyWorker, symphonyWorker } from '../server/symphony-worker.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
test('managed pool switches profiles and admits 2 + 1 slots before a queued 3-slot batch', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-pool-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  try {
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db);
    const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'owner@example.com', name: 'Owner', password: 'correct-horse-battery' });
    const { token } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(token, { name: 'Pool Test', pitch: 'A disposable product.' });
    const projectId = flows.claimDraft(token, owner, owner).project.id;
    know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
    know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
    const source = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
    mkdirSync(source, { recursive: true }); git(source, 'init', '-q'); writeFileSync(join(source, 'README.md'), 'Pinned base\n');
    git(source, 'add', '.'); git(source, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
    const first = know.defaultProfile(projectId);
    const second = know.insert(projectId, 'agent_profile', { ...first, name: 'Second profile', provider: 'codex', model: 'gpt-6-sol', effort: 'high', instructions: 'Review evidence more carefully.' }, { author: owner.name });
    const worker = symphonyWorker({ db, know, workspaceRoot: join(root, 'symphony-workspaces') });
    const credentialPath = join(root, 'symphony', projectId, 'worker-token');
    worker.ensurePool(projectId, credentialPath);
    const secret = readFileSync(credentialPath, 'utf8').trim();
    assert.equal(statSync(credentialPath).mode & 0o777, 0o600);
    worker.ensurePool(projectId, credentialPath);
    assert.equal(readFileSync(credentialPath, 'utf8').trim(), secret, 'restart keeps the private host credential');
    const poolScope = worker.authenticate(`Bearer ${secret}`);
    worker.configurePool(owner, projectId, 3);
    const runs = agentRuns({ db, know, worker, symphonyDispatch: true });
    const stage = (profile, count) => {
      const ids = [];
      for (let index = 0; index < count; index++) {
        const item = know.createWork(projectId, { action: 'product.brief', title: `${profile.name} claim ${index}`, assignee: { kind: 'agent', id: profile.id }, targets: [], checks: ['Claim is checkable'] }, owner.name);
        if (item.state === 'suggested') know.updateWork(owner, projectId, item.id, { state: 'ready' });
        runs.stage(owner, projectId, item.id); ids.push(item.id);
      }
      return { ids, batch: runs.view(projectId).find(batch => batch.state === 'draft' && batch.profileId === profile.id) };
    };
    const a = stage(first, 2); assert.equal(runs.start(owner, projectId, a.batch.id, 2).batch.state, 'queued', 'Go queues while host is offline');
    assert.equal(worker.issues(poolScope, { states: ['Ready'] }).issues.length, 0);
    worker.heartbeat(poolScope, 3); runs.admit(projectId);
    assert.equal(runs.view(projectId).find(batch => batch.id === a.batch.id).state, 'queued', 'explicit default model waits for host override support');
    worker.heartbeat(poolScope, 3, true); runs.admit(projectId);
    assert.equal(runs.view(projectId).find(batch => batch.id === a.batch.id).state, 'running');
    worker.heartbeat(poolScope, 3, false);
    const b = stage(second, 1); assert.equal(runs.start(owner, projectId, b.batch.id, 1).batch.state, 'queued', 'named profile waits for capable host');
    worker.heartbeat(poolScope, 3, true); runs.admit(projectId);
    assert.equal(runs.view(projectId).find(batch => batch.id === b.batch.id).state, 'running');
    const c = stage(first, 3); assert.equal(runs.start(owner, projectId, c.batch.id, 3).batch.state, 'queued');
    assert.deepEqual({ free: worker.poolStatus(projectId).free, queued: worker.poolStatus(projectId).queued }, { free: 0, queued: 1 });
    const issues = worker.issues(poolScope, { states: ['Ready'] }).issues;
    assert.equal(issues.length, 3, 'one pool polls tasks from both profiles');
    const secondIssue = issues.find(issue => issue.native_ref.work_id === b.ids[0]);
    const card = worker.taskOpen(worker.scopeForDigest(poolScope, secondIssue.native_ref.bundle_digest), secondIssue.native_ref.bundle_digest);
    assert.equal(card.task.profile.id, second.id);
    assert.equal(card.task.profile.name, second.name);
    assert.equal(card.task.profile.revision, second.revision);
    assert.equal(secondIssue.native_ref.codex_model, 'gpt-6-sol');
    assert.equal(secondIssue.native_ref.codex_effort, 'high');
    const probe = createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const portal = spawn(process.execPath, [new URL('../server/server.mjs', import.meta.url).pathname], {
      env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_SYMPHONY_DISPATCH: '1', MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: 'ignore'
    });
    try {
      const origin = `http://127.0.0.1:${port}`;
      let ready = false;
      // A fresh portal starts in about 1.5 s alone, but well past 8 s while the whole suite runs in parallel (T03-CODE run 1).
      for (const deadline = Date.now() + 30_000; !ready && Date.now() < deadline;) {
        try { ready = (await fetch(origin + '/api/session')).ok; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
      }
      assert.ok(ready, 'disposable portal started');
      const auth = { authorization: `Bearer ${secret}` };
      const page = await fetch(origin + '/api/worker/issues?states=Ready&capacity=3&profile_overrides=1', { headers: auth });
      assert.equal(page.status, 200, await page.clone().text());
      assert.equal((await page.json()).issues.length, 3, 'HTTP pool polls across profiles');
      const opened = await fetch(origin + '/api/worker/tasks/' + secondIssue.native_ref.bundle_digest, { headers: auth });
      assert.equal(opened.status, 200, await opened.clone().text());
      assert.equal((await opened.json()).task.profile.id, second.id);
      const session = { cookie: createSession(db, owner.id).split(';')[0] };
      const status = await fetch(origin + `/api/projects/${projectId}/agents/symphony`, { headers: session });
      const runtime = await status.json();
      assert.equal(runtime.configured, 3);
      assert.equal(runtime.dispatchEnabled, true, 'Deploy reports Work dispatch separately from the host heartbeat');
      const snapshot = await fetch(origin + `/api/projects/${projectId}/knowledge`, { headers: session });
      assert.equal(snapshot.status, 200);
      const workView = (await snapshot.json()).knowledge;
      assert.ok(workView.symphonyProfiles.includes(second.id), 'Work can assign named Codex profiles');
      assert.equal(workView.workerPool.dispatchEnabled, true);
    } finally { portal.kill(); await new Promise(resolve => portal.once('exit', resolve)); }

    for (const id of a.ids) db.prepare("UPDATE symphony_attempts SET state = 'submitted' WHERE work_id = ?").run(id);
    runs.admit(projectId);
    assert.equal(runs.view(projectId).find(batch => batch.id === c.batch.id).state, 'queued', 'three slots wait until all are free');
    db.prepare("UPDATE symphony_attempts SET state = 'submitted' WHERE work_id = ?").run(b.ids[0]);
    runs.admit(projectId);
    assert.equal(runs.view(projectId).find(batch => batch.id === c.batch.id).state, 'running');
    assert.equal(worker.poolStatus(projectId).used, 3);
    assert.equal(worker.issues(poolScope, { states: ['Ready'] }).issues.length, 3, 'new batch is visible to the same host credential');
    const unsupported = know.insert(projectId, 'agent_profile', { ...first, name: 'Other provider', provider: 'anthropic' }, { author: owner.name });
    const bad = know.createWork(projectId, { action: 'product.brief', title: 'Unsupported provider', assignee: { kind: 'agent', id: unsupported.id }, targets: [] }, owner.name);
    if (bad.state === 'suggested') know.updateWork(owner, projectId, bad.id, { state: 'ready' });
    assert.throws(() => runs.stage(owner, projectId, bad.id), error => error.status === 409, 'unavailable provider cannot silently use Codex');
    const stale = stage(second, 1);
    assert.equal(runs.start(owner, projectId, stale.batch.id, 1).batch.state, 'queued');
    know.insert(projectId, 'brief_claim', { section: 'value', text: 'New governing claim.', note: '' }, { author: owner.name });
    for (const id of c.ids) db.prepare("UPDATE symphony_attempts SET state = 'submitted' WHERE work_id = ?").run(id);
    runs.admit(projectId);
    assert.equal(runs.view(projectId).find(batch => batch.id === stale.batch.id).state, 'stopped', 'changed governing input withdraws queued authorization');
    const staleBlocked = know.workById(projectId, stale.ids[0]);
    assert.equal(staleBlocked.status, 'blocked');
    assert.deepEqual(staleBlocked.context.executionBlock, { code: 'inputs-changed', reason: 'Task inputs changed after Go. Review them, then run the new batch.', recovery: 'retry' });
    const retryBatch = runs.view(projectId).find(batch => batch.state === 'draft' && batch.profileId === second.id);
    assert.equal(runs.start(owner, projectId, retryBatch.id, 1).batch.state, 'running');
    assert.equal(know.workById(projectId, stale.ids[0]).context.executionBlock, undefined, 'explicit Go clears the prior execution block');

  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
