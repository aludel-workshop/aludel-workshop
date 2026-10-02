import { workActionMigration } from './lat08-migration.mjs';
// Symphony worker boundary. A local pool credential is scoped to one project; each claimed attempt pins its own profile.
// Polling reads only Go-snapshotted work and never grants authorization itself.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { symphonyIssue } from './symphony-readiness.mjs';
import { compileTaskManifest } from './task-manifest.mjs';
import { layerPackageTaskContext, layerPackageForProject } from './layer-package.mjs';
import { briefSections } from './knowledge.mjs';
import { compiledLocalActions } from './lat07-actions.mjs';
import { actionForProject, projectLayerDefinition } from './layer-registry.mjs';
import { layerDeclarations, layerInstanceId } from './layer-contract.mjs';
import { pagesFlowSnapshot, pagesFlowBaseInputs } from './pages-flow-work.mjs';
import { library, libraryKinds } from './library.mjs';
import { runPagesFlowCandidate } from './pages-flow-runner.mjs';
import { activeLayerTopology, discoverySourceSnapshot } from './layer-discovery.mjs';
import { applyDiscoveryProposal } from './layer-space.mjs';
import { checkFollowUps, layerWorkScope, recordFollowUps, requireElevated } from './layer-scope.mjs';
import { applyWrites, checkDraftCurrent, draftChanges, initLayerApi, initSourceReviews, layerApi, stageOperation } from './layer-api.mjs';
import { assertLayerReviewCurrent, prepareLayerReview, layerReview, commitLayerBranch, initLayerSource, layerBranch, layerBundle, mergeLayerBranch, settleLayerCheckout, undoLayerMerge, workBranchName } from './layer-source.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const validChecks = checks => Array.isArray(checks) && checks.length <= 30 && checks.every(check => check && typeof check === 'object' &&
  typeof check.name === 'string' && check.name.trim().length > 0 && check.name.length <= 120 &&
  ['passed', 'failed', 'skipped'].includes(check.status) && (check.detail === undefined || typeof check.detail === 'string' && check.detail.length <= 500));

export function initSymphonyWorker(db) {
  initLayerApi(db); initSourceReviews(db); initLayerSource(db);
  db.exec(`CREATE TABLE IF NOT EXISTS symphony_worker_tokens (
    token_hash TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), profile_id TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen_at TEXT
  );
  CREATE INDEX IF NOT EXISTS symphony_worker_scope ON symphony_worker_tokens(project_id, profile_id);
  CREATE TABLE IF NOT EXISTS symphony_pools (
    project_id TEXT PRIMARY KEY REFERENCES projects(id), token_hash TEXT NOT NULL UNIQUE, credential_path TEXT NOT NULL,
    configured_capacity INTEGER NOT NULL DEFAULT 1, reported_capacity INTEGER NOT NULL DEFAULT 0, profile_overrides INTEGER NOT NULL DEFAULT 0, last_seen_at TEXT
  );
  CREATE TABLE IF NOT EXISTS symphony_bundles (
    digest TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), profile_id TEXT NOT NULL,
    work_id TEXT NOT NULL, batch_id TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(project_id, work_id, batch_id)
  );
  CREATE INDEX IF NOT EXISTS symphony_bundle_scope ON symphony_bundles(project_id, profile_id, batch_id);
  CREATE TABLE IF NOT EXISTS symphony_attempts (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), profile_id TEXT NOT NULL,
    work_id TEXT NOT NULL, batch_id TEXT NOT NULL, bundle_digest TEXT NOT NULL REFERENCES symphony_bundles(digest),
    state TEXT NOT NULL, workspace_path TEXT, candidate_id TEXT, run_limit INTEGER NOT NULL DEFAULT 3, runs_started INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, work_id, batch_id)
  );
  CREATE TABLE IF NOT EXISTS symphony_reports (
    id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE REFERENCES symphony_attempts(id),
    project_id TEXT NOT NULL, work_id TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS symphony_proposals (
    id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE REFERENCES symphony_attempts(id),
    project_id TEXT NOT NULL, work_id TEXT NOT NULL, action_id TEXT NOT NULL, content_json TEXT NOT NULL,
    state TEXT NOT NULL, created_at TEXT NOT NULL, accepted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS symphony_attempt_events (
    attempt_id TEXT NOT NULL REFERENCES symphony_attempts(id), event_id TEXT NOT NULL,
    kind TEXT NOT NULL, thread_id TEXT, turn_id TEXT, created_at TEXT NOT NULL,
    PRIMARY KEY(attempt_id, event_id)
  );`);
  const poolColumns = db.prepare('PRAGMA table_info(symphony_pools)').all().map(row => row.name);
  if (!poolColumns.includes('profile_overrides')) db.exec('ALTER TABLE symphony_pools ADD COLUMN profile_overrides INTEGER NOT NULL DEFAULT 0');
  const tokenColumns = db.prepare('PRAGMA table_info(symphony_worker_tokens)').all().map(row => row.name);
  if (!tokenColumns.includes('last_seen_at')) db.exec('ALTER TABLE symphony_worker_tokens ADD COLUMN last_seen_at TEXT');
  const columns = db.prepare('PRAGMA table_info(symphony_attempts)').all().map(row => row.name);
  if (!columns.includes('host_id')) db.exec('ALTER TABLE symphony_attempts ADD COLUMN host_id TEXT');
  if (!columns.includes('run_limit')) db.exec('ALTER TABLE symphony_attempts ADD COLUMN run_limit INTEGER NOT NULL DEFAULT 3');
  if (!columns.includes('runs_started')) {
    db.exec('ALTER TABLE symphony_attempts ADD COLUMN runs_started INTEGER NOT NULL DEFAULT 0');
    // Earlier attempts have unknown provider usage. Require a fresh Go rather than granting new turns.
    db.exec('UPDATE symphony_attempts SET runs_started = run_limit');
  }
}

export function symphonyWorker({ db, know, candidates = null, workspaceRoot = null, runLimit = 3, reviewBuildCheck = null }) {
  if (!Number.isInteger(runLimit) || runLimit < 1 || runLimit > 10) throw new Error('Symphony run limit must be between 1 and 10.');
  const atomic = fn => { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const project = id => db.prepare('SELECT id, slug, name, description FROM projects WHERE id = ?').get(id);
  const profile = (projectId, id) => know.list(projectId, 'agent_profile').find(entry => entry.id === id);
  const action = (projectId, id) => know.roleView(projectId).flatMap(role => role.actions).find(entry => entry.id === id) ||
    (id?.endsWith('.discover') && (compiledLocalActions.some(candidate => candidate.id === id) || actionForProject(db,projectId,id)) ?
      { id, revision: 1, name: 'Discover neighboring layers', instructions: (compiledLocalActions.find(candidate => candidate.id === id) || actionForProject(db,projectId,id)).method,
        reads: [], changes: [], tools: ['read'], asks: '' } : null);
  const batch = (projectId, id) => {
    const row = db.prepare('SELECT * FROM agent_batches WHERE id = ? AND project_id = ?').get(id, projectId);
    return row && { id: row.id, ref: `B-${row.number}`, state: row.state, profileId: row.profile_id, requestedSlots: row.requested_slots || 1, snapshot: parse(row.items_json) || [], startedAt: row.started_at };
  };
  function owner(user, projectId) {
    if (!user || !db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'").get(projectId, user.id)) fail('Project owner required.', 403);
  }
  function ensurePool(projectId, credentialPath) {
    if (!project(projectId)) fail('Project not found.', 404);
    const existing = db.prepare('SELECT token_hash, credential_path FROM symphony_pools WHERE project_id = ?').get(projectId);
    if (existing && existing.credential_path === credentialPath && existsSync(credentialPath)) {
      try { if (hash(readFileSync(credentialPath, 'utf8').trim()) === existing.token_hash) { chmodSync(credentialPath, 0o600); return; } } catch { /* Recover the local credential below. */ }
    }
    const token = randomBytes(32).toString('base64url');
    mkdirSync(dirname(credentialPath), { recursive: true, mode: 0o700 });
    writeFileSync(credentialPath, `${token}\n`, { mode: 0o600 });
    chmodSync(credentialPath, 0o600);
    db.prepare(`INSERT INTO symphony_pools(project_id, token_hash, credential_path) VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET token_hash = excluded.token_hash, credential_path = excluded.credential_path,
        last_seen_at = NULL, reported_capacity = 0, profile_overrides = 0`).run(projectId, hash(token), credentialPath);
  }
  function poolStatus(projectId) {
    const row = db.prepare('SELECT configured_capacity, reported_capacity, profile_overrides, last_seen_at, credential_path FROM symphony_pools WHERE project_id = ?').get(projectId);
    const recent = new Date(Date.now() - 120000).toISOString();
    const legacyOnline = Boolean(db.prepare('SELECT 1 FROM symphony_worker_tokens WHERE project_id = ? AND expires_at > ? AND last_seen_at > ?').get(projectId, now(), recent));
    const online = Boolean(row?.last_seen_at && row.last_seen_at > recent) || legacyOnline;
    const capacity = row?.last_seen_at && row.last_seen_at > recent ? Math.min(row.configured_capacity, row.reported_capacity) : legacyOnline ? 1 : 0;
    const running = db.prepare("SELECT b.id, b.profile_id, b.requested_slots FROM agent_batches b WHERE b.project_id = ? AND b.state = 'running' AND b.execution_kind = 'symphony' AND EXISTS (SELECT 1 FROM symphony_attempts a WHERE a.batch_id = b.id AND a.state IN ('authorized', 'working')) ORDER BY b.started_at").all(projectId);
    const used = running.reduce((sum, batch) => sum + (batch.requested_slots || 1), 0);
    const active = db.prepare("SELECT a.id, a.work_id, a.batch_id, a.profile_id, a.state FROM symphony_attempts a JOIN agent_batches b ON b.id = a.batch_id WHERE a.project_id = ? AND b.state = 'running' AND a.state IN ('authorized', 'working') ORDER BY a.updated_at").all(projectId)
      .map(attempt => { const work = know.workById(projectId, attempt.work_id); return { attemptId: attempt.id, workId: attempt.work_id, workRef: work?.ref || attempt.work_id, title: work?.title || '', batchId: attempt.batch_id, profileId: attempt.profile_id,
        state: attempt.state, activity: work?.context?.run?.activity || (attempt.state === 'authorized' ? 'Waiting for a worker' : 'Working') }; });
    return { configured: row?.configured_capacity || 1, profileOverrides: Boolean(online && row?.profile_overrides), reported: online ? (row?.last_seen_at && row.last_seen_at > recent ? row.reported_capacity : 1) : 0, online, capacity,
      used, free: Math.max(0, capacity - used), active, running: running.map(batch => ({ batchId: batch.id, profileId: batch.profile_id, slots: batch.requested_slots || 1 })),
      queued: db.prepare("SELECT count(*) AS n FROM agent_batches WHERE project_id = ? AND state = 'queued' AND execution_kind = 'symphony'").get(projectId).n,
      location: 'This machine', credentialPath: row?.credential_path || null, lastSeenAt: row?.last_seen_at || null };
  }
  function configurePool(user, projectId, capacity) {
    owner(user, projectId);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 8) fail('Choose one to eight worker slots.');
    const used = poolStatus(projectId).used;
    if (capacity < used) fail('Stop running batches before lowering capacity below their reserved slots.', 409);
    db.prepare('UPDATE symphony_pools SET configured_capacity = ? WHERE project_id = ?').run(capacity, projectId);
    return poolStatus(projectId);
  }
  function heartbeat(scope, capacity, profileOverrides = false) {
    if (!scope.pool) return;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 32) fail('Invalid Symphony host capacity.');
    db.prepare('UPDATE symphony_pools SET reported_capacity = ?, profile_overrides = ?, last_seen_at = ? WHERE project_id = ?').run(capacity, profileOverrides === true ? 1 : 0, now(), scope.projectId);
  }
  function scopeForDigest(scope, digest) {
    if (!scope.pool) return scope;
    const row = db.prepare('SELECT profile_id FROM symphony_bundles WHERE digest = ? AND project_id = ?').get(digest, scope.projectId);
    if (!row) fail('Context not found.', 404);
    return { projectId: scope.projectId, profileId: row.profile_id };
  }
  function scopeForAttempt(scope, attemptId) {
    if (!scope.pool) return scope;
    const row = db.prepare('SELECT profile_id FROM symphony_attempts WHERE id = ? AND project_id = ?').get(attemptId, scope.projectId);
    if (!row) fail('Attempt not found.', 404);
    return { projectId: scope.projectId, profileId: row.profile_id };
  }
  function unresolvedBatch(projectId, profileId) {
    return Boolean(db.prepare("SELECT 1 FROM agent_batches WHERE project_id = ? AND profile_id = ? AND state != 'done' AND execution_kind = 'symphony'").get(projectId, profileId));
  }
  function issueToken(user, projectId, profileId) {
    owner(user, projectId);
    if (unresolvedBatch(projectId, profileId)) fail('Resolve the Symphony batch before rotating its worker token.', 409);
    if (!profile(projectId, profileId)) fail('Agent profile not found.', 404);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
    db.prepare('DELETE FROM symphony_worker_tokens WHERE project_id = ? AND profile_id = ?').run(projectId, profileId);
    db.prepare('INSERT INTO symphony_worker_tokens(token_hash, project_id, profile_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(hash(token), projectId, profileId, user.id, now(), expiresAt);
    return { token, projectId, profileId, expiresAt };
  }
  function revoke(user, projectId, profileId) {
    owner(user, projectId);
    if (unresolvedBatch(projectId, profileId)) fail('Resolve the Symphony batch before revoking its worker token.', 409);
    db.prepare('DELETE FROM symphony_worker_tokens WHERE project_id = ? AND profile_id = ?').run(projectId, profileId);
    return { connected: false };
  }
  function status(user, projectId, profileId) {
    owner(user, projectId);
    const row = db.prepare('SELECT expires_at, last_seen_at FROM symphony_worker_tokens WHERE project_id = ? AND profile_id = ? AND expires_at > ?').get(projectId, profileId, now());
    return { connected: Boolean(row), online: Boolean(row?.last_seen_at && row.last_seen_at > new Date(Date.now() - 120000).toISOString()),
      expiresAt: row?.expires_at || null, lastSeenAt: row?.last_seen_at || null };
  }
  function hasConnection(projectId, profileId) {
    if (poolStatus(projectId).online) return true;
    return Boolean(db.prepare('SELECT 1 FROM symphony_worker_tokens WHERE project_id = ? AND profile_id = ? AND expires_at > ? AND last_seen_at > ?')
      .get(projectId, profileId, now(), new Date(Date.now() - 120000).toISOString()));
  }
  function authenticate(header) {
    const match = /^Bearer ([A-Za-z0-9_-]{40,})$/.exec(String(header || ''));
    if (!match) fail('Worker credential required.', 401);
    const pool = db.prepare('SELECT project_id FROM symphony_pools WHERE token_hash = ?').get(hash(match[1]));
    if (pool) return { projectId: pool.project_id, profileId: null, pool: true };
    const row = db.prepare('SELECT project_id, profile_id FROM symphony_worker_tokens WHERE token_hash = ? AND expires_at > ?').get(hash(match[1]), now());
    if (!row || !profile(row.project_id, row.profile_id)) fail('Worker credential expired or revoked.', 401);
    db.prepare('UPDATE symphony_worker_tokens SET last_seen_at = ? WHERE token_hash = ?').run(now(), hash(match[1]));
    return { projectId: row.project_id, profileId: row.profile_id };
  }
  function repositoryHead(source) {
    let commit;
    try {
      const run = (...args) => execFileSync('git', args, { cwd: source, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (run('status', '--porcelain=v1')) fail('Project repository has uncommitted changes.', 409);
      commit = run('rev-parse', 'HEAD');
    } catch (error) { if (error.status === 409) throw error; fail('Project repository is not ready.', 409); }
    if (!/^[a-f0-9]{40}$/.test(commit)) fail('Project repository is not ready.', 409);
    return commit;
  }
  function pinnedObservation(projectId, entry, commit) {
    if (!entry.context?.codeObservation) return null;
    const relation = db.prepare(`SELECT r.id, r.revision, r.status, o.id AS observation_id, o.repository_commit, o.source_path, o.blob_sha, o.route
      FROM pages_observation_relations r JOIN code_route_observations o ON o.id = r.observation_id
      WHERE r.id = ? AND r.project_id = ?`).get(entry.context.observationRelation?.id, projectId);
    if (!relation || !db.prepare("SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = 'platform' AND enabled = 1").get(projectId) ||
        relation.status !== 'useful' || relation.revision !== entry.context.observationRelation?.revision ||
        relation.observation_id !== entry.context.codeObservation.id || relation.repository_commit !== commit ||
        relation.repository_commit !== entry.context.codeObservation.commit || relation.source_path !== entry.context.codeObservation.path ||
        relation.blob_sha !== entry.context.codeObservation.blob)
      fail('The reviewed Code observation or repository revision changed.', 409);
    return { relationId: relation.id, relationRevision: relation.revision, observationId: relation.observation_id,
      repositoryCommit: relation.repository_commit, path: relation.source_path, blob: relation.blob_sha, route: relation.route };
  }
  function persist(projectId, profileId, workId, batchId, content) {
    compileTaskManifest(content);
    const encoded = JSON.stringify(content);
    const digest = hash(encoded);
    db.prepare(`INSERT INTO symphony_bundles(digest, project_id, profile_id, work_id, batch_id, content_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(project_id, work_id, batch_id) DO NOTHING`)
      .run(digest, projectId, profileId, workId, batchId, encoded, now());
    const created = now();
    db.prepare("INSERT INTO symphony_attempts(id, project_id, profile_id, work_id, batch_id, bundle_digest, state, run_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'authorized', ?, ?, ?) ON CONFLICT(project_id, work_id, batch_id) DO NOTHING")
      .run(`att-${randomUUID()}`, projectId, profileId, workId, batchId, digest, runLimit, created, created);
    return saved({ projectId, profileId }, digest);
  }
  // DEC-057: a layer-scoped item pins its layer's source, change scope and inputs; the charter and Knowledge guide it.
  function pinLayerScoped(projectId, profileId, entry, batchId) {
    const workerProfile = profile(projectId, profileId);
    const source = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId)?.workspace_path;
    if (!workerProfile || entry.assignee?.id !== profileId || !source) fail('Task context is incomplete.', 409);
    const scope = layerWorkScope(db, projectId, entry.layer);
    const layerPackage = scope && layerPackageTaskContext(db, projectId, entry.layer);
    if (!scope || !layerPackage || layerPackage.commit !== scope.commit) fail('This layer has no installed, checked change scope for agents.', 409);
    const commit = repositoryHead(source);
    const targets = (entry.targets || []).map(target => know.get(projectId, target.id)).filter(Boolean);
    const flowInputs = targets.filter(target => target.kind === 'flow' && entry.layer === 'pages')
      .flatMap(target => pagesFlowBaseInputs(pagesFlowSnapshot(db, know, projectId, target.id)))
      .filter((ref, index, all) => all.findIndex(other => other.id === ref.id) === index && !targets.some(target => target.id === ref.id));
    const controlPins = entry.context?.policy ? [entry.context.policy] : [];
    for (const control of controlPins) {
      const row = db.prepare('SELECT revision, status, receiving_key FROM layer_connections WHERE id = ? AND project_id = ?').get(control.id, projectId);
      if (!row || row.revision !== control.revision || row.status !== 'active' || row.receiving_key !== entry.layer) fail('The originating layer policy changed.', 409);
    }
    const docs = know.list(projectId, 'doc').filter(doc => doc.agents && !targets.some(target => target.id === doc.id));
    const instructions = know.agentExport(projectId);
    const followUpLayers = db.prepare(`SELECT i.layer_key AS key, COALESCE(d.name, i.layer_key) AS name FROM layer_instances i
      LEFT JOIN layer_definitions d ON d.project_id = i.project_id AND d.layer_key = i.layer_key WHERE i.project_id = ? AND i.enabled = 1 ORDER BY i.layer_key`).all(projectId);
    const api = layerApi(db, projectId, entry.layer);
    if (api && api.commit !== scope.commit) fail('The layer API does not match its source pin.', 409);
    return persist(projectId, profileId, entry.id, batchId, { layerPackage, layerApi: api ? { commit: api.commit, spec: api.spec } : null, flowInputs, controlPins, codeObservation: pinnedObservation(projectId, entry, commit), layerDiscovery: null,
      schemaVersion: 1, project: project(projectId), work: entry, batch: { id: batchId },
      sources: [...targets, ...flowInputs.map(ref => know.get(projectId, ref.id)).filter(Boolean), ...docs], briefRevision: null,
      sharedDocs: know.list(projectId, 'doc').filter(doc => doc.agents).map(doc => ({ id: doc.id, revision: doc.revision })), instructionPins: know.instructionPins(projectId, workerProfile, null),
      guidance: { principles: instructions.principles, project: instructions.instructions,
        layerScope: { key: scope.key, instanceId: scope.instanceId, commit: scope.commit, changes: scope.changes }, followUpLayers,
        profile: { id: workerProfile.id, revision: workerProfile.revision, name: workerProfile.name, instructions: workerProfile.instructions,
          provider: workerProfile.provider || 'codex', model: workerProfile.model, effort: workerProfile.effort } }, repository: { commit } });
  }
  // Called while the owner authorizes a coding batch. This captures records and a clean repository HEAD.
  function pin(projectId, profileId, workId, batchId) {
    const entry = know.workById(projectId, workId);
    if (entry?.scope === 'layer') return pinLayerScoped(projectId, profileId, entry, batchId);
    const workerProfile = profile(projectId, profileId);
    const taskAction = entry && action(projectId, entry.action);
    const source = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId)?.workspace_path;
    if (!entry || !workerProfile || !taskAction || entry.assignee?.id !== profileId || !source) fail('Task context is incomplete.', 409);
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_work_migration'").get()) workActionMigration(db, projectId, workId);
    const layerAction = compiledLocalActions.find(candidate => candidate.id === entry.action) || actionForProject(db,projectId,entry.action) || null;
    const method = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_action_installations'").get()
      ? db.prepare('SELECT method_text, method_revision, action_revision FROM layer_action_installations WHERE project_id = ? AND action_id = ?').get(projectId, entry.action) : null;
    if (method && method.action_revision !== layerAction?.revision) fail('The installed layer action revision changed.', 409);
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_work_migration'").get() && layerAction && (!layerAction.agentRunnable || !db.prepare("SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1").get(projectId, layerAction.layer)))
      fail('This layer action has no installed, registered agent adapter.', 409);
    const commit = repositoryHead(source);
    const role = know.roleView(projectId).find(value => value.actions.some(candidate => candidate.id === entry.action)) ||
      (entry.action?.endsWith('.discover') ? { id: entry.layer, revision: 1, name: projectLayerDefinition(db,projectId,entry.layer)?.name || entry.layer, instructions: 'Inspect neighboring outputs and propose a receiving policy for review.' } : null);
    const targets = (entry.targets || []).map(target => know.get(projectId, target.id)).filter(Boolean);
    const flowTarget = entry.action === 'pages.flows' && entry.targets.length === 1 && entry.targets[0].kind === 'flow' ? entry.targets[0] : null;
    const flowInputs = flowTarget ? pagesFlowBaseInputs(pagesFlowSnapshot(db, know, projectId, flowTarget.id)) : [];
    const docs = know.list(projectId, 'doc').filter(doc => doc.agents && !targets.some(target => target.id === doc.id));
    const briefClaims = entry.action === 'product.brief' ? know.list(projectId, 'brief_claim').filter(claim => !targets.some(target => target.id === claim.id)) : [];
    const instructions = know.agentExport(projectId);
    const codeObservation = pinnedObservation(projectId, entry, commit);
    const controlPins = entry.action === 'pages.flows' && entry.context?.policy ? [entry.context.policy] : [];
    for (const control of controlPins) {
      const row = db.prepare('SELECT revision, status, receiving_key, source_key FROM layer_connections WHERE id = ? AND project_id = ?').get(control.id, projectId);
      if (!row || row.revision !== control.revision || row.status !== 'active' || row.receiving_key !== 'pages' || row.source_key !== 'product') fail('The originating layer policy changed.', 409);
    }
    const discovery = entry.context?.discovery;
    if (discovery) {
      const installed = activeLayerTopology(db,projectId);
      if (hash(JSON.stringify(installed)) !== discovery.topologyDigest) fail('Installed layers changed. Use the newer discovery task.', 409);
    }
    const layerPackage = layerPackageTaskContext(db, projectId, layerAction?.layer || entry.layer);
    if (flowTarget && !layerPackage) fail('Revising a Pages flow requires an installed reviewed Pages package.', 409);
    const configuredMethod = method?.method_text || layerAction?.method || '';
    const methodPath = layerPackage && configuredMethod.match(new RegExp(`^${layerPackage.key}/([a-z][a-z0-9-]*)$`));
    const layerMethodText = methodPath ? layerPackage.documents.find(doc => doc.path === `knowledge/${methodPath[1]}.md`)?.markdown : configuredMethod;
    if (methodPath && !layerMethodText) fail('The pinned layer action method is missing from its package.', 409);
    const content = { layerPackage, flowInputs, controlPins, codeObservation, layerDiscovery: discovery ? { ...discovery, receiver:projectLayerDefinition(db,projectId,entry.layer), sources: discoverySourceSnapshot(db,projectId,discovery.sourceKeys,entry.layer) } : null, schemaVersion: 1, project: project(projectId), work: entry, batch: { id: batchId },
      sources: [...targets, ...flowInputs.map(ref => know.get(projectId, ref.id)).filter(Boolean), ...briefClaims, ...docs], briefRevision: entry.action === 'product.brief' ? know.briefRevision(projectId) : null, sharedDocs: know.list(projectId, 'doc').filter(doc => doc.agents).map(doc => ({ id: doc.id, revision: doc.revision })), instructionPins: know.instructionPins(projectId, workerProfile, entry.action), guidance: { principles: instructions.principles, project: instructions.instructions,
        role: role && { id: role.id, revision: role.revision, name: role.name, instructions: role.instructions },
        layerAction: layerAction && { id: layerAction.id, revision: layerAction.revision, adapter: layerAction.adapter, result: layerAction.result, permissions: layerAction.permissions,
          methodRevision: method?.method_revision || null, method: layerMethodText },
        action: { id: taskAction.id, revision: taskAction.revision, name: taskAction.name, instructions: method?.method_text ?? taskAction.instructions,
          reads: taskAction.reads, changes: taskAction.changes, tools: taskAction.tools, asks: taskAction.asks },
        profile: { id: workerProfile.id, revision: workerProfile.revision, name: workerProfile.name, instructions: workerProfile.instructions,
          provider: workerProfile.provider || 'codex', model: workerProfile.model, effort: workerProfile.effort } }, repository: { commit } };
    return persist(projectId, profileId, workId, batchId, content);
  }
  function codeObservationCurrent(projectId, pin) {
    const row = db.prepare(`SELECT r.revision, r.status, o.id AS observation_id, o.repository_commit, o.source_path, o.blob_sha
      FROM pages_observation_relations r JOIN code_route_observations o ON o.id = r.observation_id
      WHERE r.id = ? AND r.project_id = ?`).get(pin.relationId, projectId);
    return !!row && !!db.prepare("SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = 'platform' AND enabled = 1").get(projectId) &&
      row.status === 'useful' && row.revision === pin.relationRevision && row.observation_id === pin.observationId &&
      row.repository_commit === pin.repositoryCommit && row.source_path === pin.path && row.blob_sha === pin.blob;
  }
  function pinnedCurrent(projectId, profileId, workId, batchId) {
    const row = db.prepare('SELECT content_json FROM symphony_bundles WHERE project_id = ? AND profile_id = ? AND work_id = ? AND batch_id = ?')
      .get(projectId, profileId, workId, batchId);
    const entry = know.workById(projectId, workId);
    if (!row || !entry || entry.assignee?.id !== profileId || entry.context?.batch !== batchId || entry.state !== 'ready') return false;
    const bundle = JSON.parse(row.content_json);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const key of ['title', 'action', 'priority', 'targets', 'question', 'checks']) if (!same(entry[key], bundle.work[key])) return false;
    if (!same(['routine', 'gap', 'receipt', 'policy', 'source', 'observationRelation', 'codeObservation', 'discovery'].map(key => entry.context?.[key] || null),
      ['routine', 'gap', 'receipt', 'policy', 'source', 'observationRelation', 'codeObservation', 'discovery'].map(key => bundle.work.context?.[key] || null))) return false;
    if (!same(project(projectId), bundle.project)) return false;
    if (entry.action === 'product.brief' && know.briefRevision(projectId) !== bundle.briefRevision) return false;
    if (!same(know.instructionPins(projectId, profile(projectId, profileId), entry.action, { legacyRole: Boolean(bundle.instructionPins?.role) }), bundle.instructionPins)) return false;
    if (bundle.layerPackage && (layerPackageForProject(db, projectId, bundle.layerPackage.key)?.commit !== bundle.layerPackage.commit ||
      bundle.layerPackage.instanceId && layerInstanceId(db, projectId, bundle.layerPackage.key) !== bundle.layerPackage.instanceId)) return false;
    if (!same(know.list(projectId, 'doc').filter(doc => doc.agents).map(doc => ({ id: doc.id, revision: doc.revision })), bundle.sharedDocs)) return false;
    if (bundle.sources.some(source => know.get(projectId, source.id)?.revision !== source.revision)) return false;
    if (bundle.controlPins?.some(control => { const row = db.prepare('SELECT revision, status FROM layer_connections WHERE id = ? AND project_id = ?').get(control.id, projectId); return !row || row.revision !== control.revision || row.status !== 'active'; })) return false;
    if (bundle.codeObservation && !codeObservationCurrent(projectId, bundle.codeObservation)) return false;
    if (bundle.layerDiscovery) { const installed = activeLayerTopology(db,projectId); if (hash(JSON.stringify(installed)) !== bundle.layerDiscovery.topologyDigest || JSON.stringify(discoverySourceSnapshot(db,projectId,bundle.layerDiscovery.sourceKeys,bundle.work.layer)) !== JSON.stringify(bundle.layerDiscovery.sources)) return false; }
    const source = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId)?.workspace_path;
    try {
      if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== bundle.repository.commit) return false;
      if (execFileSync('git', ['status', '--porcelain=v1'], { cwd: source, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()) return false;
    } catch { return false; }
    return true;
  }
  function saved(scope, digest) {
    if (!/^[a-f0-9]{64}$/.test(String(digest || ''))) fail('Context not found.', 404);
    const row = db.prepare('SELECT content_json FROM symphony_bundles WHERE digest = ? AND project_id = ? AND profile_id = ?').get(digest, scope.projectId, scope.profileId);
    if (!row) fail('Context not found.', 404);
    return { digest, ...JSON.parse(row.content_json) };
  }
  function taskOpen(scope, digest) {
    const bundle = activeBundle(scope, digest);
    const issue = current(scope, bundle.work.id);
    return { digest, attemptId: issue.native_ref.attempt_id, ...compileTaskManifest(bundle) };
  }
  // DEC-059: a layer-scoped run reads other layers through the Library: every installed layer's outputs and Knowledge,
  // and research. Kinds no layer publishes (project docs) keep the older record path.
  const pool = library({ db, know });
  const libraryRef = id => typeof id === 'string' && id.startsWith('k:');
  const currentRevision = (projectId, id) => libraryRef(id) || !know.get(projectId, id) ? pool.read(projectId, null, id).currentRevision : know.get(projectId, id)?.revision;
  const publishedKind = (projectId, kind) => !!kind && (libraryKinds.includes(kind) ||
    db.prepare('SELECT output_kinds_json AS outputs FROM layer_definitions d JOIN layer_instances i ON i.project_id = d.project_id AND i.layer_key = d.layer_key WHERE d.project_id = ? AND i.enabled = 1').all(projectId)
      .some(row => (JSON.parse(row.outputs || '[]')).includes(kind)));
  const readableKinds = ['brief_claim', 'story', 'spec', 'page', 'doc', 'research', 'source', 'finding', 'insight', 'data_object', 'data_operation', 'access_rule', 'component', 'project'];
  // DEC-054/057: a layer-scoped task reads project-wide; only its writes are scoped to its layer.
  const projectKinds = projectId => [...new Set([...readableKinds, 'flow', 'persona', 'activity',
    ...layerDeclarations.filter(layer => layer.authority === 'knowledge_records' && db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, layer.key)).flatMap(layer => layer.outputs)])];
  const scopedKinds = bundle => bundle.guidance?.layerScope ? projectKinds(bundle.project.id) : bundle.layerDiscovery ? [...new Set(['doc', ...layerDeclarations.filter(layer => layer.authority === 'knowledge_records' && [bundle.work.layer,...bundle.layerDiscovery.sourceKeys].includes(layer.key)).flatMap(layer => layer.outputs)])] :
    bundle.work.action === 'pages.flows' && bundle.work.targets?.[0]?.kind === 'flow' ? [...readableKinds, 'flow', 'persona', 'activity'] : readableKinds;
  function knowledgeMap(scope, digest) {
    const bundle=activeBundle(scope, digest);
    return { kinds: scopedKinds(bundle).map(kind => ({ kind, count: know.list(scope.projectId, kind).length })) };
  }
  function knowledgeSearch(scope, digest, query, kind = null, cursor = 0) {
    const bundle=activeBundle(scope, digest);
    const allowed=scopedKinds(bundle);
    const needle = String(query || '').trim().toLowerCase();
    if (needle.length < 2 || needle.length > 100 || !Number.isInteger(cursor) || cursor < 0 || cursor > 10000 ||
        kind && !allowed.includes(kind)) fail('Invalid knowledge search.');
    if (bundle.guidance?.layerScope) {
      const found = pool.search(scope.projectId, null, { q: needle, kind, cursor, limit: 20 });
      const published = new Set(found.results.map(entry => entry.ref));
      const legacy = cursor ? [] : (kind ? [kind] : allowed).filter(value => !publishedKind(scope.projectId, value)).flatMap(value => know.list(scope.projectId, value))
        .filter(record => !published.has(record.id) && [record.title, record.name, record.text, record.body, record.summary].filter(Boolean).join(' ').toLowerCase().includes(needle)).slice(0, 20);
      return { results: [...found.results.map(entry => ({ id: entry.ref, kind: entry.kind, revision: entry.revision, summary: entry.title, layer: entry.layer.key, source: entry.source, excerpt: entry.excerpt })),
        ...legacy.map(record => ({ id: record.id, kind: record.kind, revision: record.revision, summary: String(record.title || record.name || '').slice(0, 200) }))], nextCursor: found.nextCursor };
    }
    const kinds = kind ? [kind] : allowed;
    const matches = kinds.flatMap(value => know.list(scope.projectId, value)).filter(record =>
      [record.title, record.name, record.label, record.text, record.description, record.body, record.summary, record.sentence]
        .filter(Boolean).join(' ').toLowerCase().includes(needle)).sort((a, b) => a.id.localeCompare(b.id));
    return { results: matches.slice(cursor, cursor + 20).map(record => ({ id: record.id, kind: record.kind, revision: record.revision, summary: String(record.title || record.name || record.label || record.text || record.description || record.sentence || '').slice(0, 200) })),
      nextCursor: matches.length > cursor + 20 ? cursor + 20 : null };
  }
  function knowledgeRead(scope, digest, id, revision = null) {
    const bundle=activeBundle(scope, digest);
    if (bundle.guidance?.layerScope && (libraryRef(id) || !know.get(scope.projectId, id) || publishedKind(scope.projectId, know.get(scope.projectId, id)?.kind))) {
      const entry = pool.read(scope.projectId, null, id, revision);
      return { id, kind: entry.kind, revision: entry.revision, currentRevision: entry.currentRevision, layer: entry.layer.key, data: entry.data ?? { title: entry.title, content: entry.content } };
    }
    const record = know.get(scope.projectId, id);
    if (!record || !scopedKinds(bundle).includes(record.kind)) fail('Record not found.', 404);
    if (revision === null) return { id, kind: record.kind, revision: record.revision, currentRevision: record.revision, data: record };
    if (!Number.isInteger(revision) || revision < 1 || revision > record.revision) fail('Revision not found.', 404);
    const data = know.revisionData(id, revision);
    if (!data) fail('Revision not found.', 404);
    return { id, kind: record.kind, revision, currentRevision: record.revision, data };
  }
  function activeBundle(scope, digest) {
    const bundle = saved(scope, digest);
    const issue = current(scope, bundle.work.id);
    if (!issue || issue.native_ref.bundle_digest !== digest) fail('Context is no longer authorized.', 404);
    return bundle;
  }
  function current(scope, workId) {
    const entry = know.workById(scope.projectId, workId);
    if (!entry || entry.assignee?.id !== scope.profileId || !entry.context?.batch) return null;
    const run = batch(scope.projectId, entry.context.batch);
    if (!run || run.profileId !== scope.profileId) return null;
    const row = db.prepare('SELECT digest, content_json FROM symphony_bundles WHERE project_id = ? AND profile_id = ? AND work_id = ? AND batch_id = ?')
      .get(scope.projectId, scope.profileId, workId, run.id);
    if (!row) return null;
    const bundle = { digest: row.digest, ...JSON.parse(row.content_json) };
    // A changed task, target, instruction, profile or shared HEAD withdraws this exact Go snapshot.
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const key of ['title', 'action', 'priority', 'targets', 'question', 'checks']) if (!same(entry[key], bundle.work[key])) return null;
    if (!same(['routine', 'gap', 'receipt', 'policy', 'source', 'observationRelation', 'codeObservation', 'discovery'].map(key => entry.context?.[key] || null),
      ['routine', 'gap', 'receipt', 'policy', 'source', 'observationRelation', 'codeObservation', 'discovery'].map(key => bundle.work.context?.[key] || null))) return null;
    if (!same(project(scope.projectId), bundle.project)) return null;
    if (bundle.work.action === 'product.brief' && know.briefRevision(scope.projectId) !== bundle.briefRevision) return null;
    if (!same(know.instructionPins(scope.projectId, profile(scope.projectId, scope.profileId), entry.action, { legacyRole: Boolean(bundle.instructionPins?.role) }), bundle.instructionPins)) return null;
    if (bundle.layerPackage && (layerPackageForProject(db, scope.projectId, bundle.layerPackage.key)?.commit !== bundle.layerPackage.commit ||
      bundle.layerPackage.instanceId && layerInstanceId(db, scope.projectId, bundle.layerPackage.key) !== bundle.layerPackage.instanceId)) return null;
    if (!same(know.list(scope.projectId, 'doc').filter(doc => doc.agents).map(doc => ({ id: doc.id, revision: doc.revision })), bundle.sharedDocs)) return null;
    if (bundle.sources.some(source => know.get(scope.projectId, source.id)?.revision !== source.revision)) return null;
    if (bundle.controlPins?.some(control => { const row = db.prepare('SELECT revision, status FROM layer_connections WHERE id = ? AND project_id = ?').get(control.id, scope.projectId); return !row || row.revision !== control.revision || row.status !== 'active'; })) return null;
    if (bundle.codeObservation && !codeObservationCurrent(scope.projectId, bundle.codeObservation)) return null;
    if (bundle.layerDiscovery) { const installed = activeLayerTopology(db,scope.projectId); if (hash(JSON.stringify(installed)) !== bundle.layerDiscovery.topologyDigest || !same(discoverySourceSnapshot(db,scope.projectId,bundle.layerDiscovery.sourceKeys,bundle.work.layer),bundle.layerDiscovery.sources)) return null; }
    const source = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(scope.projectId)?.workspace_path;
    try {
      if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== bundle.repository.commit) return null;
      if (execFileSync('git', ['status', '--porcelain=v1'], { cwd: source, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()) return null;
    } catch { return null; }
    const issue = symphonyIssue({ project: project(scope.projectId), item: entry, batch: run, action: action(scope.projectId, entry.action),
      bundle, repositoryCommit: bundle.repository.commit });
    if (!issue) return null;
    const attempt = db.prepare('SELECT id, state FROM symphony_attempts WHERE project_id = ? AND work_id = ? AND batch_id = ?').get(scope.projectId, workId, run.id);
    if (!attempt || attempt.state === 'submitted') return null;
    issue.native_ref.attempt_id = attempt.id;
    issue.description += ` Attempt ${attempt.id}.`;
    return issue;
  }
  function refreshed(scope, workId) {
    const active = current(scope, workId);
    if (active) {
      const allowance = db.prepare('SELECT run_limit, runs_started FROM symphony_attempts WHERE id = ?').get(active.native_ref.attempt_id);
      const finished = allowance && db.prepare('SELECT 1 FROM symphony_attempt_events WHERE attempt_id = ? AND event_id = ?')
        .get(active.native_ref.attempt_id, `run-${allowance.runs_started}-finished`);
      if (allowance && (allowance.runs_started < allowance.run_limit || allowance.runs_started > 0 && !finished)) return active;
    }
    const row = db.prepare('SELECT digest, batch_id, content_json FROM symphony_bundles WHERE project_id = ? AND profile_id = ? AND work_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(scope.projectId, scope.profileId, workId);
    if (!row) return null;
    const bundle = JSON.parse(row.content_json);
    const attempt = db.prepare('SELECT id, state FROM symphony_attempts WHERE project_id = ? AND work_id = ? AND batch_id = ?').get(scope.projectId, workId, row.batch_id);
    const item = know.workById(scope.projectId, workId);
    const run = batch(scope.projectId, row.batch_id);
    const stopped = !item || !run || ['stopped', 'stopping', 'done'].includes(run.state) || item.context?.skip;
    const projectRow = project(scope.projectId);
    const safe = value => String(value || '').replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 70);
    return { id: `${scope.projectId}:${workId}`, identifier: `${safe(projectRow.slug).toUpperCase()}-${safe(bundle.work.ref)}`,
      title: bundle.work.title, description: `Aludel work ${bundle.work.ref}. Context digest ${row.digest}.`,
      priority: null, state: attempt?.state === 'submitted' ? 'Submitted' : stopped ? 'Stopped' : 'Blocked', dispatchable: false,
      url: null, branch_name: null, labels: [], blocked_by: [],
      native_ref: { project_id: scope.projectId, work_id: workId, batch_id: row.batch_id, bundle_digest: row.digest, repository_commit: bundle.repository.commit, attempt_id: attempt?.id || null,
        codex_model: bundle.guidance.profile.model || null, codex_effort: bundle.guidance.profile.effort || 'medium' },
      created_at: bundle.work.createdAt || null, updated_at: item?.updatedAt || null };
  }
  function attempt(scope, id) {
    const row = db.prepare('SELECT * FROM symphony_attempts WHERE id = ? AND project_id = ? AND profile_id = ?').get(id, scope.projectId, scope.profileId);
    if (!row) fail('Attempt not found.', 404);
    return row;
  }
  function appendEvent(scope, { attemptId, eventId, kind, threadId = null, turnId = null, message = null }) {
    const row = attempt(scope, attemptId);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(eventId || '') || !['started', 'progress', 'blocked', 'error', 'submitted', 'reconciled', 'authorized', 'finished'].includes(kind)) fail('Invalid attempt event.');
    if (kind === 'finished' && (eventId !== `run-${row.runs_started}-finished` || row.runs_started < 1)) fail('Invalid run completion event.', 409);
    const short = value => value === null ? null : String(value).slice(0, 100);
    const recorded = db.prepare('INSERT OR IGNORE INTO symphony_attempt_events VALUES (?, ?, ?, ?, ?, ?)')
      .run(attemptId, eventId, kind, short(threadId), short(turnId), now());
    if (recorded.changes && ['blocked', 'error'].includes(kind)) {
      const item = know.workById(scope.projectId, row.work_id);
      if (item && item.state !== 'needs-input') {
        const reason = String(message || (kind === 'error' ? 'Symphony could not complete this run.' : 'Symphony reported an external blocker.')).replace(/\s+/g, ' ').trim().slice(0, 500);
        know.setWorkContext(item.id, { ...(item.context || {}), batch: undefined, executionBlock: { code: kind === 'error' ? 'runtime-error' : 'runtime-blocked', reason, recovery: 'retry' } });
        db.prepare("UPDATE layer_work_items SET state = 'ready', updated_at = ? WHERE id = ? AND project_id = ?").run(now(), item.id, scope.projectId);
        db.prepare("UPDATE symphony_attempts SET state = 'blocked', updated_at = ? WHERE id = ?").run(now(), attemptId);
        know.appendLog(item.id, 'Blocked: ' + reason, {}, { by: { kind: 'agent', id: scope.profileId } });
      }
    }
    return { attemptId, eventId, recorded: Boolean(recorded.changes) };
  }
  function registerWorkspace(scope, { attemptId, path, hostId = 'legacy' }) {
    const row = attempt(scope, attemptId);
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(hostId)) fail('A stable host ID is required.', 400);
    const issue = current(scope, row.work_id);
    if (!issue || issue.native_ref.attempt_id !== attemptId) fail('This attempt is no longer authorized.', 409);
    if (!workspaceRoot) fail('Symphony workspace root is not configured.', 409);
    let actual, allowedRoot, head, marker;
    try {
      actual = realpathSync(path);
      allowedRoot = realpathSync(workspaceRoot);
      if (!actual.startsWith(allowedRoot + '/') || basename(actual) !== issue.identifier) fail('Workspace does not match the authorized issue.', 409);
      const run = (...args) => execFileSync('git', args, { cwd: actual, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (realpathSync(run('rev-parse', '--show-toplevel')) !== actual) fail('Workspace is not its own repository.', 409);
      head = run('rev-parse', 'HEAD');
      marker = readFileSync(`${actual}/.git/aludel-base`, 'utf8').trim();
    } catch (error) { if (error.status === 409) throw error; fail('Symphony workspace is not ready.', 409); }
    if (marker !== issue.native_ref.repository_commit) fail('Workspace base differs from Go.', 409);
    if (spawnSync('git', ['merge-base', '--is-ancestor', marker, head], { cwd: actual, stdio: 'ignore' }).status !== 0) fail('Workspace HEAD does not descend from Go.', 409);
    if (row.workspace_path && row.workspace_path !== actual) fail('Attempt already belongs to a different workspace.', 409);
    const claimed = db.prepare("UPDATE symphony_attempts SET workspace_path = ?, host_id = ?, state = 'working', updated_at = ? WHERE id = ? AND (host_id IS NULL OR host_id = ?)")
      .run(actual, hostId, now(), attemptId, hostId);
    if (!claimed.changes) fail('This attempt is claimed by another host.', 409);
    appendEvent(scope, { attemptId, eventId: 'workspace-ready', kind: 'started' });
    return { attemptId, registered: true };
  }
  // Called once by the trusted before_run hook. A reservation is consumed before Codex starts;
  // an uncertain crash cannot replay the same run for free. WORKFLOW must set max_turns: 1.
  function reserveRun(scope, { attemptId, hostId = 'legacy' }) {
    const row = attempt(scope, attemptId);
    if (row.host_id !== hostId) fail('This attempt is claimed by another host.', 409);
    const issue = current(scope, row.work_id);
    if (!issue || issue.native_ref.attempt_id !== attemptId || !row.workspace_path || row.state !== 'working') fail('This attempt is not ready for another run.', 409);
    const updated = db.prepare("UPDATE symphony_attempts SET runs_started = runs_started + 1, updated_at = ? WHERE id = ? AND state = 'working' AND runs_started < run_limit")
      .run(now(), attemptId);
    if (!updated.changes) fail('Symphony run limit reached.', 409);
    const count = db.prepare('SELECT runs_started, run_limit FROM symphony_attempts WHERE id = ?').get(attemptId);
    appendEvent(scope, { attemptId, eventId: `run-${count.runs_started}`, kind: 'started' });
    const item = know.workById(scope.projectId, row.work_id);
    if (item?.scope === 'layer' || item?.action === 'platform.security' || ['product.define', 'product.clarify', 'product.brief', 'data.contract', 'design.audit', 'pages.a11y', 'pages.flows', 'deploy.review', 'work.review'].includes(item?.action)) {
      // WORK-ITEM-UX-01 WI-5: progress comes from the agent's own plan (aludel_task_plan); until it reports one, the run is starting.
      know.setWorkContext(item.id, { ...item.context, run: { ...item.context?.run, startedAt: item.context?.run?.startedAt || now(),
        phases: item.context?.run?.phases || [], phase: item.context?.run?.phase ?? 0, activity: item.context?.run?.activity || 'Opening the task', model: profile(scope.projectId, scope.profileId)?.model,
        batch: row.batch_id, profileId: scope.profileId, done: false } });
    }
    return { attemptId, runsStarted: count.runs_started, runLimit: count.run_limit };
  }
  function submitCandidate(scope, { attemptId, commit, checks = [] }) {
    if (!validChecks(checks)) fail('Agent checks need name and passed, failed or skipped status.', 400);
    const row = attempt(scope, attemptId);
    if (row.candidate_id) {
      const existing = candidates?.get(scope.projectId, row.candidate_id);
      if (existing?.commit === commit) return { attemptId, candidate: existing };
      fail('Attempt already submitted a different candidate.', 409);
    }
    const issue = current(scope, row.work_id);
    if (!issue || issue.native_ref.attempt_id !== attemptId || !row.workspace_path) fail('This attempt is not ready to submit.', 409);
    const bundle = saved(scope, row.bundle_digest);
    if (bundle.guidance.action.id !== 'platform.implement') fail('This action cannot submit code.', 403);
    if (!candidates) fail('Candidate validation is unavailable.', 409);
    const repository = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(scope.projectId)?.workspace_path;
    const candidate = candidates.registerExternal({ projectId: scope.projectId, workId: row.work_id, workRef: bundle.work.ref,
      repository, workspace: row.workspace_path, base: bundle.repository.commit, commit, changes: bundle.guidance.action.changes, checks });
    db.prepare("UPDATE symphony_attempts SET candidate_id = ?, state = 'submitted', updated_at = ? WHERE id = ?").run(candidate.id, now(), attemptId);
    appendEvent(scope, { attemptId, eventId: `candidate-${commit}`, kind: 'submitted' });
    return { attemptId, candidate };
  }
  function askQuestion(scope, { attemptId, question, reason, options = [] }) {
    const row = attempt(scope, attemptId);
    if (row.state === 'blocked') {
      const existing = know.workById(scope.projectId, row.work_id)?.question;
      if (existing?.text === String(question || '').trim()) return { attemptId, question: existing };
      fail('Attempt already paused on a different question.', 409);
    }
    const issue = current(scope, row.work_id);
    if (!['platform.security', 'product.define', 'product.brief', 'data.contract'].includes(saved(scope, row.bundle_digest).guidance.action.id)) fail('This action cannot ask through this flow.', 403);
    if (!issue || issue.native_ref.attempt_id !== attemptId || row.state !== 'working' || row.runs_started < 1)
      fail('This attempt cannot ask a question.', 409);
    if (typeof question !== 'string' || question.trim().length < 10 || question.length > 400 ||
        typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 1000 ||
        !Array.isArray(options) || options.length > 4 || !options.every(value => typeof value === 'string' && value.length <= 200))
      fail('Ask one concrete blocking question with a reason and up to four options.');
    atomic(() => {
      db.prepare('UPDATE layer_work_items SET state = ?, question_json = ?, updated_at = ? WHERE id = ? AND project_id = ?')
        .run('needs-input', JSON.stringify({ text: question.trim(), reasoning: reason.trim(), options }), now(), row.work_id, scope.projectId);
      db.prepare("UPDATE symphony_attempts SET state = 'blocked', updated_at = ? WHERE id = ?").run(now(), attemptId);
      know.appendLog(row.work_id, `Paused for an answer: ${question.trim()}`, {}, { by: { kind: 'agent', id: scope.profileId } });
      appendEvent(scope, { attemptId, eventId: 'question', kind: 'blocked' });
    });
    return { attemptId, question: know.workById(scope.projectId, row.work_id).question };
  }
  function submitAudit(scope, { attemptId, report }) {
    const row = attempt(scope, attemptId);
    const existing = db.prepare('SELECT id, content_json FROM symphony_reports WHERE attempt_id = ?').get(attemptId);
    if (existing) {
      const savedReport = JSON.parse(existing.content_json);
      if (JSON.stringify(report) === JSON.stringify(savedReport.report)) return { attemptId, reportId: existing.id, report: savedReport };
      fail('Attempt already submitted a different report.', 409);
    }
    const issue = current(scope, row.work_id);
    const bundle = saved(scope, row.bundle_digest);
    if (bundle.guidance.action.id !== 'platform.security' || !issue || issue.native_ref.attempt_id !== attemptId ||
        !row.workspace_path || row.state !== 'working' || row.runs_started < 1) fail('This audit attempt is not ready to submit.', 409);
    if (!report || typeof report !== 'object' || Array.isArray(report) || typeof report.summary !== 'string' ||
        report.summary.trim().length < 15 || report.summary.length > 2000 || !Array.isArray(report.findings) || report.findings.length > 30 ||
        !report.findings.every(finding => finding && typeof finding === 'object' &&
          ['critical', 'high', 'medium', 'low', 'informational'].includes(finding.severity) &&
          typeof finding.title === 'string' && finding.title.trim().length > 0 && finding.title.length <= 160 &&
          typeof finding.affected === 'string' && finding.affected.trim().length > 0 && finding.affected.length <= 250 &&
          typeof finding.evidence === 'string' && finding.evidence.trim().length > 0 && finding.evidence.length <= 3000 &&
          typeof finding.recommendation === 'string' && finding.recommendation.length <= 1000) ||
        !validChecks(report.checks) || !report.checks.length) fail('Provide a summary, bounded findings with severity/affected/evidence, and checks.');
    const usedInputs = report.usedInputs || [];
    if (!Array.isArray(usedInputs) || usedInputs.length > 40 || !usedInputs.every(ref => ref && typeof ref.id === 'string' && Number.isInteger(ref.revision) && ref.revision > 0)) fail('Invalid used inputs.');
    for (const target of bundle.work.targets || []) {
      const pinned = bundle.sources.find(source => source.id === target.id);
      if (!usedInputs.some(ref => ref.id === target.id && ref.revision === pinned?.revision))
        fail('Include each pinned target and its revision in used inputs.', 400);
    }
    for (const ref of usedInputs) {
      const record = knowledgeRead(scope, row.bundle_digest, ref.id, ref.revision);
      if (record.currentRevision !== ref.revision) fail('A used record changed; reassess before submitting.', 409);
    }
    // A read-only audit cannot smuggle a workspace edit into its report.
    let clean, head;
    try {
      clean = execFileSync('git', ['status', '--porcelain=v1'], { cwd: row.workspace_path, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: row.workspace_path, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch { fail('Read-only audit workspace is unavailable.', 409); }
    if (clean || head !== bundle.repository.commit) fail('Read-only audit workspace changed.', 409);
    const id = `rep-${randomUUID()}`;
    const submission = { repositoryCommit: bundle.repository.commit, report };
    atomic(() => {
      db.prepare('INSERT INTO symphony_reports VALUES (?, ?, ?, ?, ?, ?)').run(id, attemptId, scope.projectId, row.work_id, JSON.stringify(submission), now());
      db.prepare("UPDATE symphony_attempts SET state = 'submitted', updated_at = ? WHERE id = ?").run(now(), attemptId);
      const entry = know.workById(scope.projectId, row.work_id);
      know.appendLog(row.work_id, `Submitted security report ${id} for review`, { state: 'review', context: { ...entry.context, auditReport: { id, repositoryCommit: bundle.repository.commit, ...report },
        run: { ...entry.context?.run, phase: (entry.context?.run?.phases?.length || 3) - 1, activity: 'Submitted report', finishedAt: now(), done: true } } },
        { by: { kind: 'agent', id: scope.profileId } });
      appendEvent(scope, { attemptId, eventId: id, kind: 'submitted' });
    });
    return { attemptId, reportId: id, report: submission };
  }
  // ---- Layer-scoped runs (DEC-057, PAGES-API-01): the agent calls its layer's API; each write stages in this run's draft ----
  function runLayerApi(scope, row, bundle) {
    const api = layerApi(db, scope.projectId, bundle.guidance.layerScope.key);
    if (!api || api.commit !== bundle.guidance.layerScope.commit) fail(`The ${bundle.guidance.layerScope.key} layer source changed. Authorize a fresh run.`, 409);
    return api;
  }
  function callLayer(scope, { attemptId, operation, id = null, body = {} }) {
    const row = attempt(scope, attemptId);
    const bundle = saved(scope, row.bundle_digest);
    const issue = current(scope, row.work_id);
    if (!bundle.guidance.layerScope || !issue || issue.native_ref.attempt_id !== attemptId || row.state !== 'working' || row.runs_started < 1)
      fail('This attempt cannot call its layer API now.', 409);
    if (typeof operation !== 'string' || !body || typeof body !== 'object' || Array.isArray(body)) fail('Name an operation and pass its body.');
    return stageOperation({ db, catalogs: know.catalogs, api: runLayerApi(scope, row, bundle), projectId: scope.projectId, attemptId, operationId: operation, id, body });
  }
  // LAYER-BASE-01 B5: the run's sandbox works on its layer instance's repository. The workspace hook clones it from a bundle
  // at the run's base onto the run's work branch, with a copy of the layer's current outputs to test against.
  function layerRun(scope, attemptId, { working = false } = {}) {
    const row = attempt(scope, attemptId);
    const bundle = saved(scope, row.bundle_digest);
    if (!bundle.guidance.layerScope) return { row, bundle, layer: null };
    const issue = current(scope, row.work_id);
    if (!issue || issue.native_ref.attempt_id !== attemptId || working && (row.state !== 'working' || row.runs_started < 1)) fail('This attempt cannot work on its layer now.', 409);
    return { row, bundle, layer: bundle.guidance.layerScope };
  }
  function layerWorkspace(scope, attemptId) {
    const { row, bundle, layer } = layerRun(scope, attemptId);
    if (!layer) return { layer: null };
    const instance = layer.instanceId;
    const outputs = Object.fromEntries((bundle.layerApi ? Object.keys(bundle.layerApi.spec['x-aludel-records'] || {}) : []).map(kind => [kind,
      db.prepare('SELECT id, revision, data_json FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id = ? ORDER BY position, created_at').all(scope.projectId, kind, instance)
        .map(record => ({ id: record.id, revision: record.revision, data: JSON.parse(record.data_json) }))]));
    const catalogs = Object.fromEntries((bundle.layerApi?.spec['x-aludel-catalogs'] || []).map(name => {
      const value = know.catalogs?.[name];
      return [name, Array.isArray(value) ? value : value && typeof value === 'object' ? Object.keys(value) : []];
    }));
    return { layer: layer.key, base: bundle.layerPackage.commit, branch: workBranchName(bundle.work.ref, row.id), root: bundle.layerPackage.root || '', outputs, catalogs };
  }
  function layerSourceBundle(scope, attemptId) {
    const { row, bundle, layer } = layerRun(scope, attemptId);
    if (!layer) fail('This attempt has no layer repository.', 404);
    return layerBundle(db, { projectId: scope.projectId, key: layer.key, base: bundle.layerPackage.commit, attemptId: row.id });
  }
  function commitLayer(scope, { attemptId, message, tests = [] }) {
    const { row, bundle, layer } = layerRun(scope, attemptId, { working: true });
    if (!layer) fail('This attempt has no layer repository.', 404);
    if (!row.workspace_path) fail('Register the run workspace first.', 409);
    return commitLayerBranch(db, { projectId: scope.projectId, key: layer.key, attemptId: row.id, workspace: row.workspace_path, base: bundle.layerPackage.commit,
      workRef: bundle.work.ref, message, tests });
  }
  function submitLayerChanges(scope, row, bundle, proposal) {
    const content = proposal.content;
    if (content.changes !== undefined) fail('Make changes by calling the layer API (aludel_layer_call); the submission carries notes and follow-ups.');
    if (content.notes !== undefined && (typeof content.notes !== 'string' || content.notes.length > 4000)) fail('Notes must be text under 4000 characters.');
    const followUps = checkFollowUps(db, scope.projectId, proposal.followUps);
    const changes = draftChanges(db, scope.projectId, row.id);
    if (changes.length) checkDraftCurrent(db, runLayerApi(scope, row, bundle), scope.projectId, row.id);
    const source = layerBranch(db, row.id);
    if (!changes.length && !source && !content.notes?.trim() && !followUps.length) fail('Stage at least one change, or submit a note or a follow-up.');
    const usedInputs = proposal.usedInputs || [];
    if (!Array.isArray(usedInputs) || usedInputs.length > 200 || !usedInputs.every(ref => ref && typeof ref.id === 'string' && Number.isInteger(ref.revision) && ref.revision > 0))
      fail('Invalid used inputs.');
    for (const ref of usedInputs) if (knowledgeRead(scope, row.bundle_digest, ref.id, ref.revision).currentRevision !== ref.revision)
      fail('A used record changed; reassess before submitting.', 409);
    return { changes, source, notes: content.notes?.trim() || '', followUps, usedInputs };
  }
  function prepareProposalReview(user, projectId, workId, proposalId, rebuild = false) {
    const entry = know.workById(projectId, workId);
    const row = db.prepare('SELECT * FROM symphony_proposals WHERE id = ? AND project_id = ? AND work_id = ?').get(proposalId, projectId, workId);
    if (!entry || !row || !row.action_id.startsWith('layer:') || row.state !== 'submitted' || entry.state !== 'review' || entry.context?.workProposal?.id !== proposalId)
      fail('This layer proposal is not waiting for review.', 409);
    requireElevated(db, user, projectId, entry.layer, 'prepare this review');
    const submitted = JSON.parse(row.content_json);
    if (!submitted.source) return null;
    for (const ref of submitted.usedInputs || []) if (currentRevision(projectId, ref.id) !== ref.revision) fail('A used input changed. Send this back.', 409);
    const instance = layerInstanceId(db, projectId, entry.layer);
    const review = prepareLayerReview(db, { projectId, key: entry.layer, attemptId: row.attempt_id, source: submitted.source, catalogs: know.catalogs, force: rebuild,
      recordsOf: kind => {
        const records = new Map(db.prepare('SELECT id, data_json FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id = ?').all(projectId, kind, instance).map(record => [record.id, { id: record.id, data: JSON.parse(record.data_json) }]));
        for (const change of submitted.changes.filter(change => change.kind === kind)) { if (change.op === 'delete') records.delete(change.id); else records.set(change.id, { id: change.id, data: change.after }); }
        return [...records.values()];
      } });
    return review;
  }
  // Commits the reviewed draft as it was reviewed, only if nothing it read or changes moved on.
  function acceptLayerChanges(user, projectId, entry, submitted, bundle, options) {
    if (bundle.codeObservation && !codeObservationCurrent(projectId, bundle.codeObservation)) fail('The reviewed Code relation changed. Send this back.', 409);
    for (const control of bundle.controlPins || []) {
      const policy = db.prepare('SELECT revision, status FROM layer_connections WHERE id = ? AND project_id = ?').get(control.id, projectId);
      if (!policy || policy.revision !== control.revision || policy.status !== 'active') fail('The originating layer policy changed. Send this back.', 409);
    }
    for (const ref of submitted.usedInputs || []) if (currentRevision(projectId, ref.id) !== ref.revision) fail('A used input changed. Send this back.', 409);
    // Staged data was checked under the layer's rules at the run's base, so it applies only while those rules are the pin.
    // A run that changes only the repository merges onto a moved main instead.
    const api = layerApi(db, projectId, bundle.guidance.layerScope.key);
    if (submitted.changes.length && (!api || api.commit !== bundle.guidance.layerScope.commit)) fail(`The ${bundle.guidance.layerScope.key} layer source changed. Send this back.`, 409);
    const attemptId = db.prepare('SELECT attempt_id FROM symphony_proposals WHERE id = ?').get(submitted.id).attempt_id;
    if (submitted.changes.length) checkDraftCurrent(db, api, projectId, attemptId);
    const staged = draftChanges(db, projectId, attemptId);
    if (JSON.stringify(staged) !== JSON.stringify(submitted.changes)) fail('The staged changes differ from what was reviewed. Send this back.', 409);
    const reviewedSource = submitted.source ? assertLayerReviewCurrent(db, projectId, entry.layer,
      layerReview(db, projectId, attemptId), submitted.source) : null;
    if (reviewedSource && options.integrationId !== reviewedSource.id) fail('The review revision changed. Refresh before accepting.', 409);
    if (reviewedSource) {
      const pkg = layerPackageForProject(db, projectId, entry.layer);
      const runnable = pkg.root && reviewedSource.files.some(file => (file.path === '.aludel/review.json' || !file.path.startsWith(pkg.root)) && !/^(?:docs\/|README\.md$|AGENTS\.md$|ARCHITECTURE\.md$)/.test(file.path));
      if (runnable) {
        if (!reviewBuildCheck) fail('The combined app build/check capability is unavailable.', 409);
        reviewBuildCheck(reviewedSource.id);
      }
    }
    // References were checked against current records and the draft above.
    const applied = [...applyWrites(know, projectId, submitted.changes.map(change => ({ op: change.op, kind: change.kind, id: change.id, baseRevision: change.baseRevision, data: change.after, ...(change.parentId ? { parentId: change.parentId } : {}) })), [],
      { layer: bundle.guidance.layerScope.key, author: options.author, rationale: options.rationale, workItemId: options.workItemId }).map(record => record.id), ...submitted.changes.filter(change => change.op === 'delete').map(change => change.id)];
    // Data applies under the rules it was checked with; then the reviewed layer commit becomes the pin.
    const key = bundle.guidance.layerScope.key;
    const instance = db.prepare('SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, key)?.instance_id;
    const source = submitted.source ? mergeLayerBranch(db, { projectId, key, source: reviewedSource, reviewer: user.name, workId: entry.id, workRef: entry.ref, catalogs: know.catalogs,
      recordsOf: kind => db.prepare('SELECT id, data_json FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id = ?').all(projectId, kind, instance)
        .map(record => ({ id: record.id, data: JSON.parse(record.data_json) })) }) : null;
    return { applied, source };
  }
  function readOnlyWorkspace(row, bundle) {
    let clean, head;
    try {
      clean = execFileSync('git', ['status', '--porcelain=v1'], { cwd: row.workspace_path, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: row.workspace_path, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch { fail('Read-only proposal workspace is unavailable.', 409); }
    if (clean || head !== bundle.repository.commit) fail('Read-only proposal workspace changed.', 409);
  }
  function submitProposal(scope, { attemptId, proposal }) {
    const row = attempt(scope, attemptId);
    const existing = db.prepare('SELECT id, content_json FROM symphony_proposals WHERE attempt_id = ?').get(attemptId);
    if (existing) {
      const content = JSON.parse(existing.content_json);
      if (JSON.stringify(content.submission) === JSON.stringify(proposal)) return { attemptId, proposalId: existing.id, proposal: content };
      fail('Attempt already submitted a different proposal.', 409);
    }
    const issue = current(scope, row.work_id);
    const bundle = saved(scope, row.bundle_digest);
    if (bundle.guidance.layerScope) {
      if (!issue || issue.native_ref.attempt_id !== attemptId || !row.workspace_path || row.state !== 'working' || row.runs_started < 1)
        fail('This proposal attempt is not ready to submit.', 409);
      if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal) || typeof proposal.summary !== 'string' || proposal.summary.trim().length < 10 ||
          proposal.summary.length > 1000 || !proposal.content || typeof proposal.content !== 'object' || Array.isArray(proposal.content) ||
          Buffer.byteLength(JSON.stringify(proposal)) > 60000) fail('Provide a bounded summary and a structured change set.');
      const checked = submitLayerChanges(scope, row, bundle, proposal);
      readOnlyWorkspace(row, bundle);
      const id = `spr-${randomUUID()}`, layerKey = bundle.guidance.layerScope.key;
      const result = { id, action: `layer:${layerKey}`, scope: 'layer', layer: layerKey, summary: proposal.summary.trim(), changes: checked.changes, source: checked.source, notes: checked.notes,
        followUps: checked.followUps, usedInputs: checked.usedInputs, repositoryCommit: bundle.repository.commit, submission: proposal };
      atomic(() => {
        db.prepare("INSERT INTO symphony_proposals VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, NULL)")
          .run(id, attemptId, scope.projectId, row.work_id, result.action, JSON.stringify(result), now());
        recordFollowUps(db, { projectId: scope.projectId, workId: row.work_id, proposalId: id, attemptId, sourceLayer: layerKey, profileId: scope.profileId, followUps: checked.followUps });
        db.prepare("UPDATE symphony_attempts SET state = 'submitted', updated_at = ? WHERE id = ?").run(now(), attemptId);
        const entry = know.workById(scope.projectId, row.work_id);
        const checks = entry.checks.map(check => ({ ...check, verdict: null, note: '', source: check.source ?
          { id: check.source.id, revision: know.get(scope.projectId, check.source.id)?.revision || null } : null }));
        db.prepare('UPDATE layer_work_items SET checks_json = ? WHERE id = ?').run(JSON.stringify(checks), row.work_id);
        know.appendLog(row.work_id, `Submitted ${checked.changes.length} ${checked.changes.length === 1 ? 'change' : 'changes'}${checked.followUps.length ? ` and ${checked.followUps.length} follow-up${checked.followUps.length === 1 ? '' : 's'}` : ''} for review`,
          { state: 'review', context: { ...entry.context, workProposal: { id, scope: 'layer', layer: layerKey, summary: result.summary, changes: result.changes, notes: result.notes,
            usedInputs: result.usedInputs, repositoryCommit: result.repositoryCommit },
          run: { ...entry.context?.run, activity: 'Submitted proposal', finishedAt: now(), done: true } } },
          { by: { kind: 'agent', id: scope.profileId }, refs: (bundle.work.targets || []).map(target => target.id) });
        appendEvent(scope, { attemptId, eventId: id, kind: 'submitted' });
      });
      return { attemptId, proposalId: id, proposal: result };
    }
    const actionId = bundle.guidance.action.id;
    if (!(actionId.endsWith('.discover') || ['product.define', 'product.clarify', 'product.brief', 'data.contract', 'design.audit', 'pages.a11y', 'pages.flows', 'deploy.review', 'work.review'].includes(actionId)) || !issue ||
        issue.native_ref.attempt_id !== attemptId || !row.workspace_path || row.state !== 'working' || row.runs_started < 1)
      fail('This proposal attempt is not ready to submit.', 409);
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal) ||
        typeof proposal.summary !== 'string' || proposal.summary.trim().length < 10 || proposal.summary.length > 1000 ||
        !proposal.content || typeof proposal.content !== 'object' || Array.isArray(proposal.content) ||
        Buffer.byteLength(JSON.stringify(proposal)) > 30000) fail('Provide a bounded summary and structured content.');
    const content = proposal.content;
    const targets = bundle.work.targets || [];
    if (actionId.endsWith('.discover')) {
      const discovery = bundle.layerDiscovery;
      if (!discovery || !Array.isArray(content.connections) || content.connections.length !== discovery.sourceKeys.length ||
          new Set(content.connections.map(connection => connection.sourceKey)).size !== discovery.sourceKeys.length ||
          !content.connections.every(connection => discovery.sourceKeys.includes(connection.sourceKey) &&
            ['reference-only','candidate-input'].includes(connection.mapping) &&
            typeof connection.instructions === 'string' && connection.instructions.trim() && connection.instructions.length <= 4000 &&
            typeof connection.reaction === 'string' && connection.reaction.trim() && connection.reaction.length <= 2000 &&
            typeof connection.evidence === 'string' && connection.evidence.trim() && connection.evidence.length <= 2000 &&
            (!connection.question || typeof connection.question === 'string' && connection.question.length <= 1000) &&
            (!connection.answer || typeof connection.answer === 'string' && connection.answer.length <= 1000)))
        fail('Discovery proposal needs one evidenced, bounded receiving policy per installed neighbor.');
    } else if (actionId === 'product.brief') {
      if (targets.length > 1 || targets.some(target => target.kind !== 'brief_claim') ||
          !briefSections.includes(content.section) || typeof content.text !== 'string' || !content.text.trim() || content.text.length > 400 ||
          typeof content.note !== 'string' || content.note.length > 200 || typeof content.basis !== 'string' || !content.basis.trim() || content.basis.length > 1000)
        fail('Vision proposal needs one bounded claim, section, note and basis.');
    } else if (actionId === 'product.define') {
      if (targets.length !== 1 || targets[0].kind !== 'story' || !Array.isArray(content.scenarios) ||
          content.scenarios.length < 1 || content.scenarios.length > 4 || !content.scenarios.every(value =>
            ['given', 'when', 'then'].every(key => typeof value?.[key] === 'string' && value[key].trim() && value[key].length <= 500)))
        fail('Acceptance proposal needs one story and one to four complete scenarios.');
    } else if (actionId === 'product.clarify') {
      if (!bundle.work.question || bundle.work.question.answer || !Array.isArray(content.options) || content.options.length < 2 ||
          content.options.length > 4 || !content.options.every(value => typeof value === 'string' && value.trim() && value.length <= 200) ||
          !content.options.includes(content.recommendation) || typeof content.reasoning !== 'string' || !content.reasoning.trim() || content.reasoning.length > 1000)
        fail('Clarification proposal needs two to four options, a recommendation and a reason.');
    } else if (actionId === 'pages.flows') {
      const revise = targets.length === 1 && targets[0].kind === 'flow';
      if (revise) {
        if (typeof content.title !== 'string' || !content.title.trim() || content.title.length > 60 ||
            !Array.isArray(content.steps) || content.steps.length > 40)
          fail('Pages flow revision needs a title and no more than forty steps.');
      } else if (targets.length > 1 || targets.some(target => target.kind !== 'story') || typeof content.title !== 'string' || !content.title.trim() || content.title.length > 60 ||
          !Array.isArray(content.steps) || content.steps.length < 1 || content.steps.length > 20 || !content.steps.every(step =>
            step && (targets[0] ? step.story === targets[0].id : (step.story === null || step.story === undefined)) && typeof step.page === 'string' && know.get(scope.projectId, step.page)?.kind === 'page' &&
            typeof step.name === 'string' && step.name.trim() && step.name.length <= 60 && (!step.trigger || typeof step.trigger === 'string' && step.trigger.length <= 80)))
        fail('Pages flow proposal needs bounded steps with existing pages and, when linked, the target story.');
    } else if (['design.audit', 'pages.a11y', 'deploy.review', 'work.review'].includes(actionId)) {
      if (typeof content.scope !== 'string' || !content.scope.trim() || content.scope.length > 1000 ||
          !Array.isArray(content.findings) || content.findings.length > 30 || !content.findings.every(finding =>
            finding && typeof finding.title === 'string' && finding.title.trim() && finding.title.length <= 160 &&
            typeof finding.evidence === 'string' && finding.evidence.trim() && finding.evidence.length <= 3000 &&
            typeof finding.recommendation === 'string' && finding.recommendation.length <= 1000))
        fail('Review report needs checked scope and bounded findings with evidence and recommendations.');
    } else if (actionId === 'data.contract') {
      if (targets.length !== 1 || targets[0].kind !== 'data_object' || typeof content.description !== 'string' ||
          !content.description.trim() || content.description.length > 1000 || !Array.isArray(content.fields) ||
          content.fields.length < 1 || content.fields.length > 40 || !content.fields.every(field =>
            /^[A-Za-z_][A-Za-z0-9_]*$/.test(field?.name || '') && ['string', 'integer', 'number', 'boolean', 'array', 'object'].includes(field.type) &&
            typeof field.required === 'boolean' && (!field.description || typeof field.description === 'string' && field.description.length <= 500)))
        fail('Data contract proposal needs one object and bounded, typed fields.');
    }
    const usedInputs = proposal.usedInputs || [];
    if (!Array.isArray(usedInputs) || usedInputs.length > (actionId === 'pages.flows' && targets[0]?.kind === 'flow' ? 160 : 40) || !usedInputs.every(ref =>
        ref && typeof ref.id === 'string' && Number.isInteger(ref.revision) && ref.revision > 0)) fail('Invalid used inputs.');
    const reviseFlow = actionId === 'pages.flows' && targets.length === 1 && targets[0].kind === 'flow';
    let semanticChange = null, semanticReview = null;
    if (reviseFlow) {
      const target = bundle.sources.find(source => source.id === targets[0].id && source.kind === 'flow');
      const snapshot = pagesFlowSnapshot(db, know, scope.projectId, targets[0].id, content);
      if (!target || snapshot.current.revision !== target.revision || bundle.layerPackage?.commit !== layerPackageForProject(db,scope.projectId,'pages')?.commit)
        fail('The target flow or Pages source changed. Authorize a fresh run.', 409);
      semanticChange = runPagesFlowCandidate(db, scope.projectId, 'propose', { workId:row.work_id, ...snapshot, next:content });
      semanticReview = runPagesFlowCandidate(db, scope.projectId, 'review', { change:semanticChange, ...snapshot });
      for (const ref of semanticChange.usedInputs) if (!usedInputs.some(input => input.id === ref.id && input.revision === ref.revision))
        fail('Include every referenced flow input and its current revision.', 409);
    }
    if (actionId === 'pages.flows' && !reviseFlow) for (const step of content.steps) {
      const page = know.get(scope.projectId, step.page);
      if (!usedInputs.some(ref => ref.id === page.id && ref.revision === page.revision)) fail('Include each Pages step page and its revision in used inputs.');
    }
    for (const target of targets) if (!usedInputs.some(ref => ref.id === target.id && ref.revision === bundle.sources.find(source => source.id === target.id)?.revision))
      fail('Include each pinned target and its revision in used inputs.');
    for (const ref of usedInputs) if (knowledgeRead(scope, row.bundle_digest, ref.id, ref.revision).currentRevision !== ref.revision)
      fail('A used record changed; reassess before submitting.', 409);
    readOnlyWorkspace(row, bundle);
    const id = `spr-${randomUUID()}`;
    const result = { id, action: actionId, summary: proposal.summary.trim(), content, usedInputs,
      ...(semanticChange ? { semanticChange, semanticReview } : {}),
      repositoryCommit: bundle.repository.commit, submission: proposal };
    atomic(() => {
      db.prepare("INSERT INTO symphony_proposals VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, NULL)")
        .run(id, attemptId, scope.projectId, row.work_id, actionId, JSON.stringify(result), now());
      if (actionId === 'product.brief') {
        const target = targets[0] ? bundle.sources.find(source => source.id === targets[0].id) : null;
        const vision = { id, section: content.section, text: content.text.trim(), note: content.note.trim(), basis: content.basis.trim(),
          targetId: target?.id || null, expectedRevision: target?.revision || null, beforeText: target?.text || null,
          briefRevision: bundle.briefRevision };
        db.prepare("INSERT INTO vision_proposals VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', NULL, ?, NULL)")
          .run(id, scope.projectId, row.work_id, target?.id || null, target?.revision || null, bundle.briefRevision, JSON.stringify(vision), now());
        result.visionProposal = vision;
      }
      db.prepare("UPDATE symphony_attempts SET state = 'submitted', updated_at = ? WHERE id = ?").run(now(), attemptId);
      const entry = know.workById(scope.projectId, row.work_id);
      const checks = entry.checks.map(check => ({ ...check, verdict: null, note: '', source: check.source ?
        { id: check.source.id, revision: know.get(scope.projectId, check.source.id)?.revision || null } : null }));
      db.prepare('UPDATE layer_work_items SET checks_json = ? WHERE id = ?').run(JSON.stringify(checks), row.work_id);
      know.appendLog(row.work_id, `Submitted ${bundle.guidance.action.name} proposal for review`, { state: 'review', context: { ...entry.context,
        ...(result.visionProposal ? { visionProposal: result.visionProposal } : { workProposal: { id, action: actionId,
          summary: result.summary, content, usedInputs, repositoryCommit: result.repositoryCommit,
          ...(semanticReview ? { semanticReview } : {}) } }),
        run: { ...entry.context?.run, activity: 'Submitted proposal', finishedAt: now(), done: true } } },
        { by: { kind: 'agent', id: scope.profileId }, refs: targets.map(target => target.id) });
      appendEvent(scope, { attemptId, eventId: id, kind: 'submitted' });
    });
    return { attemptId, proposalId: id, proposal: result };
  }
  function acceptProposal(user, projectId, workId, proposalId, integrationId = null) {
    const entry = know.workById(projectId, workId);
    const row = db.prepare('SELECT * FROM symphony_proposals WHERE id = ? AND project_id = ? AND work_id = ?').get(proposalId, projectId, workId);
    if (!entry || !row || row.action_id === 'product.brief' || entry.context?.workProposal?.id !== proposalId)
      fail('Work proposal not found for this item.', 404);
    if (entry.state === 'done' && row.state === 'accepted') return { work: entry, proposalId };
    if (entry.state !== 'review' || row.state !== 'submitted') fail('This proposal is not waiting for review.', 409);
    const layerScoped = row.action_id.startsWith('layer:');
    if (layerScoped) requireElevated(db, user, projectId, entry.layer, 'accept this review');
    else if (!know.mayDo(user, projectId, entry.action)) fail('The role lead must accept this proposal.', 403);
    if (!entry.checks.length || entry.checks.some(check => check.verdict !== 'accept')) fail('Accept every Work check first.', 409);
    const attemptRow = db.prepare('SELECT * FROM symphony_attempts WHERE id = ?').get(row.attempt_id);
    const bundle = saved({ projectId, profileId: attemptRow.profile_id }, attemptRow.bundle_digest);
    for (const target of bundle.work.targets || []) {
      const pinned = bundle.sources.find(source => source.id === target.id);
      if (!pinned || know.get(projectId, target.id)?.revision !== pinned.revision)
        fail('A target changed since this proposal was drafted. Send it back and authorize a fresh run.', 409);
    }
    const submitted = JSON.parse(row.content_json);
    const content = submitted.content;
    let accepted = null;
    db.exec('BEGIN IMMEDIATE');
    try {
      let acceptedFlowId = null;
      const options = { author: user.name, rationale: `Accepted ${entry.ref} proposal`, workItemId: entry.id, integrationId };
      let appliedIds = [];
      if (layerScoped) { accepted = acceptLayerChanges(user, projectId, entry, submitted, bundle, options); appliedIds = accepted.applied; }
      else if (row.action_id.endsWith('.discover')) {
        const installed = activeLayerTopology(db,projectId);
        if (hash(JSON.stringify(installed)) !== bundle.layerDiscovery?.topologyDigest || JSON.stringify(discoverySourceSnapshot(db,projectId,bundle.layerDiscovery.sourceKeys,bundle.work.layer)) !== JSON.stringify(bundle.layerDiscovery.sources)) fail('Source outputs or installed layers changed. Reassess this proposal.', 409);
        applyDiscoveryProposal(db, projectId, entry.layer, content.connections, user.id);
      } else if (row.action_id === 'product.define') {
        const record = know.get(projectId, bundle.work.targets[0].id);
        know.update(projectId, record.id, { acceptance: [...record.acceptance, ...content.scenarios],
          edges: [...new Set([...record.edges, ...(Array.isArray(content.edges) ? content.edges.filter(value => typeof value === 'string').slice(0, 12) : [])])],
          clarifications: [...new Set([...record.clarifications, ...(Array.isArray(content.questions) ? content.questions.filter(value => typeof value === 'string').slice(0, 8) : [])])] },
          { ...options, expectedRevision: record.revision });
      } else if (row.action_id === 'data.contract') {
        const record = know.get(projectId, bundle.work.targets[0].id);
        const fields = content.fields;
        const properties = Object.fromEntries(fields.map(field => [field.name, { type: field.type,
          ...(field.format ? { format: String(field.format).slice(0, 80) } : {}),
          ...(field.description ? { description: field.description } : {}),
          ...(field.type === 'array' ? { items: { type: 'string' } } : {}) }]));
        know.update(projectId, record.id, { description: content.description,
          schema: { type: 'object', properties: { ...(record.schema.properties || {}), ...properties },
            required: [...new Set([...(record.schema.required || []), ...fields.filter(field => field.required).map(field => field.name)])] },
          states: Array.isArray(content.states) ? content.states.filter(value => typeof value === 'string').slice(0, 12) : record.states },
          { ...options, expectedRevision: record.revision });
      } else if (row.action_id === 'pages.flows') {
        if (bundle.codeObservation && !codeObservationCurrent(projectId, bundle.codeObservation)) fail('The reviewed Code relation changed. Send this proposal back.', 409);
        for (const control of bundle.controlPins || []) {
          const policy = db.prepare('SELECT revision, status FROM layer_connections WHERE id = ? AND project_id = ?').get(control.id, projectId);
          if (!policy || policy.revision !== control.revision || policy.status !== 'active') fail('The originating layer policy changed. Send this proposal back.', 409);
        }
        for (const ref of JSON.parse(row.content_json).usedInputs || []) if (know.get(projectId, ref.id)?.revision !== ref.revision)
          fail('A used input changed. Send this proposal back.', 409);
        if (bundle.work.targets.length === 1 && bundle.work.targets[0].kind === 'flow') {
          const target = bundle.work.targets[0];
          if (!submitted.semanticChange || !submitted.semanticReview || submitted.semanticChange.workId !== workId)
            fail('The reviewed flow change is missing.', 409);
          const snapshot = pagesFlowSnapshot(db, know, projectId, target.id, content);
          const review = runPagesFlowCandidate(db, projectId, 'review', { change:submitted.semanticChange, ...snapshot });
          if (JSON.stringify(review) !== JSON.stringify(submitted.semanticReview))
            fail('The reviewed flow result changed. Send this proposal back.', 409);
          acceptedFlowId = know.update(projectId, target.id, review.after, { ...options, expectedRevision:review.target.expectedRevision }).id;
        } else acceptedFlowId = know.insert(projectId, 'flow', { title: content.title, steps: content.steps, review: { state: 'none', work: entry.ref } }, options).id;
    } else if (['design.audit', 'pages.a11y', 'deploy.review', 'work.review'].includes(row.action_id)) {
        // Read-only review outputs are the accepted report itself; no target record is changed.
      } else if (row.action_id === 'product.clarify') {
        db.prepare('UPDATE layer_work_items SET question_json = ? WHERE id = ?')
          .run(JSON.stringify({ ...entry.question, options: content.options, recommendation: content.recommendation,
            reasoning: content.reasoning }), entry.id);
      } else fail('This proposal action has no acceptance adapter.', 409);
      db.prepare("UPDATE symphony_proposals SET state = 'accepted', accepted_at = ? WHERE id = ?").run(now(), proposalId);
      know.appendLog(entry.id, `Applied ${row.action_id} proposal ${proposalId}`, {}, { by: { kind: 'person', id: user.id },
        refs: [...bundle.work.targets.map(target => target.id), ...(acceptedFlowId ? [acceptedFlowId] : []), ...appliedIds] });
      const work = know.updateWork(user, projectId, workId, { state: 'done', proposalId });
      db.exec('COMMIT');
      settleLayerCheckout(accepted?.source);
      return { work, proposalId, ...(acceptedFlowId ? { flowId: acceptedFlowId } : {}), ...(layerScoped ? { applied: appliedIds, sourceCommit: accepted.source?.commit || null } : {}) };
    } catch (error) { if (db.isTransaction) { db.exec('ROLLBACK'); undoLayerMerge(accepted?.source); } throw error; }
  }
  function rejectProposal(projectId, workId, proposalId) {
    db.prepare("UPDATE symphony_proposals SET state = 'rejected' WHERE id = ? AND project_id = ? AND work_id = ? AND state = 'submitted'")
      .run(proposalId, projectId, workId);
  }
  function commitCandidate(scope, { attemptId, message, checks = [] }) {
    if (!validChecks(checks)) fail('Agent checks need name and passed, failed or skipped status.', 400);
    const row = attempt(scope, attemptId);
    if (row.candidate_id) return { attemptId, candidate: candidates?.get(scope.projectId, row.candidate_id) };
    const issue = current(scope, row.work_id);
    if (!issue || issue.native_ref.attempt_id !== attemptId || !row.workspace_path) fail('This attempt is not ready to commit.', 409);
    const bundle = saved(scope, row.bundle_digest);
    if (bundle.guidance.action.id !== 'platform.implement') fail('This action cannot commit code.', 403);
    if (!candidates) fail('Candidate validation is unavailable.', 409);
    const repository = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(scope.projectId)?.workspace_path;
    const commit = candidates.commitExternal({ repository, workspace: row.workspace_path, base: bundle.repository.commit,
      workRef: bundle.work.ref, changes: bundle.guidance.action.changes, message });
    return submitCandidate(scope, { attemptId, commit, checks });
  }
  function attemptForWork(projectId, workId) {
    const row = db.prepare('SELECT id, state, runs_started, run_limit, candidate_id, updated_at FROM symphony_attempts WHERE project_id = ? AND work_id = ? ORDER BY rowid DESC LIMIT 1')
      .get(projectId, workId);
    return row ? { id: row.id, state: row.state, runsStarted: row.runs_started, runLimit: row.run_limit,
      candidateId: row.candidate_id, updatedAt: row.updated_at } : null;
  }
  function extendRuns(user, projectId, workId, expectedRunLimit) {
    owner(user, projectId);
    if (!Number.isInteger(expectedRunLimit)) fail('Expected run limit required.');
    const row = db.prepare('SELECT * FROM symphony_attempts WHERE project_id = ? AND work_id = ? ORDER BY rowid DESC LIMIT 1').get(projectId, workId);
    if (!row || row.run_limit !== expectedRunLimit || row.run_limit >= 12 || row.runs_started < row.run_limit ||
        row.state !== 'working' || row.candidate_id || !row.workspace_path) fail('This attempt is not ready for more turns.', 409);
    const scope = { projectId, profileId: row.profile_id };
    if (!current(scope, workId)) fail('Go-pinned work changed; authorize a new batch after reassessment.', 409);
    try {
      if (!existsSync(row.workspace_path) || !workspaceRoot || !realpathSync(row.workspace_path).startsWith(realpathSync(workspaceRoot) + '/') ||
          readFileSync(`${row.workspace_path}/.git/aludel-base`, 'utf8').trim() !== saved(scope, row.bundle_digest).repository.commit) {
        fail('The unfinished workspace is unavailable; reassess before another run.', 409);
      }
    } catch (error) { if (error.status === 409) throw error; fail('The unfinished workspace is unavailable; reassess before another run.', 409); }
    const updated = db.prepare("UPDATE symphony_attempts SET run_limit = run_limit + 3, updated_at = ? WHERE id = ? AND run_limit = ? AND runs_started >= run_limit AND state = 'working' AND candidate_id IS NULL")
      .run(now(), row.id, expectedRunLimit);
    if (!updated.changes) fail('The run allowance changed; refresh before authorizing more.', 409);
    appendEvent(scope, { attemptId: row.id, eventId: `more-${expectedRunLimit + 3}`, kind: 'authorized' });
    know.appendLog(workId, `Authorized three more coding turns for this pinned batch (${expectedRunLimit + 3} total).`, {}, { by: { kind: 'person', id: user.id } });
    return attemptForWork(projectId, workId);
  }
  function attemptStatus(scope, attemptId) {
    const row = attempt(scope, attemptId);
    return { id: row.id, state: row.state, workId: row.work_id, batchId: row.batch_id, bundleDigest: row.bundle_digest,
      workspaceRegistered: Boolean(row.workspace_path), candidateId: row.candidate_id, runsStarted: row.runs_started, runLimit: row.run_limit, updatedAt: row.updated_at };
  }
  function issues(scope, { states, ids, cursor = '', limit = 50 } = {}) {
    if (typeof cursor !== 'string' || cursor.length > 180 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('Invalid page.');
    if (ids && (!Array.isArray(ids) || ids.length > 100)) fail('Invalid issue IDs.');
    if (states && (!Array.isArray(states) || states.length > 20)) fail('Invalid states.');
    const candidates = ids ? [...new Set(ids.map(id => String(id).split(':')).filter(parts => parts.length === 2 && parts[0] === scope.projectId).map(parts => parts[1]))]
      : [...new Set(db.prepare(scope.pool ? 'SELECT work_id FROM symphony_bundles WHERE project_id = ? ORDER BY created_at DESC' :
        'SELECT work_id FROM symphony_bundles WHERE project_id = ? AND profile_id = ? ORDER BY created_at DESC').all(...(scope.pool ? [scope.projectId] : [scope.projectId, scope.profileId])).map(row => row.work_id))];
    const visible = candidates.map(id => {
      const row = scope.pool && db.prepare('SELECT profile_id FROM symphony_bundles WHERE project_id = ? AND work_id = ? ORDER BY created_at DESC LIMIT 1').get(scope.projectId, id);
      return refreshed(row ? { projectId: scope.projectId, profileId: row.profile_id } : scope, id);
    }).filter(Boolean).filter(issue => !states || states.includes(issue.state))
      .sort((a, b) => a.id.localeCompare(b.id));
    const claimedPerBatch = new Map();
    const ready = (ids ? visible : visible.filter(issue => {
      if (issue.state !== 'Ready') return true;
      const batchId = issue.native_ref.batch_id;
      const max = batch(scope.projectId, batchId)?.requestedSlots || 1;
      const count = claimedPerBatch.get(batchId) || 0;
      if (count >= max) return false;
      claimedPerBatch.set(batchId, count + 1);
      return true;
    })).filter(issue => issue.id > cursor);
    const page = ready.slice(0, limit);
    return { issues: page, nextCursor: ready.length > limit ? page.at(-1).id : null };
  }
  return { ensurePool, poolStatus, configurePool, heartbeat, scopeForDigest, scopeForAttempt, pinnedCurrent, issueToken, revoke, status, hasConnection, authenticate, pin, saved, activeBundle, taskOpen, knowledgeMap, knowledgeSearch, knowledgeRead, current, issues, registerWorkspace, reserveRun, submitCandidate, submitAudit, submitProposal, prepareProposalReview, acceptProposal, rejectProposal, callLayer, layerWorkspace, layerSourceBundle, commitLayer, askQuestion, commitCandidate, appendEvent, attemptStatus, attemptForWork, extendRuns };
}
