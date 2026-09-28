import { initWorkflow, workList, workOperation } from './workflow.mjs';
import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { aludelProjectId, createExternalUser, createLoginTicket, createSession, createUser, endSession, getUser, redeemLoginTicket, initAccounts, isMember, ownerUserId, requireMember, saveAvatar, sessionUser, userProjects, verifyUser } from './accounts.mjs';
import { hostTopology } from './hosts.mjs';
import { initOnboarding, loadCatalogs, onboarding } from './onboarding.mjs';
import { botColors, efforts, initKnowledge, knowledge } from './knowledge.mjs';
import { previewManager, previewRuntime } from './previews.mjs';
import { agentsGuide, copyMedia, initialFiles, loadScaffoldSources, sitePages, skeletonFiles, workflowPaths, writeBinaries, writeFiles } from './scaffold.mjs';
import { brandUsage, componentStatus } from './design.mjs';
import { codeLinks, initCodeLinks, workspaceIsIndexable } from './code-links.mjs';
import { initPlatformOps, platformOps } from './platform-ops.mjs';
import { codeReleases, initCodeLayer, readDocs, readSource, readStack, readVariables, starterDocs, trackedFiles } from './code-layer.mjs';
import { agentRuns, initAgentRuns } from './agent-runs.mjs';
import { codeCandidates, initCodeCandidates } from './code-candidates.mjs';
import { editorBridge, initEditorBridge } from './editor-bridge.mjs';
import { symphonyWorker, initSymphonyWorker } from './symphony-worker.mjs';
import { workRuns, initWorkRuns } from './work-runs.mjs';
import { providerModelCatalog } from './provider-models.mjs';
import { extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { importCorpus } from './importer.mjs';
import { openDatabase } from './storage.mjs';
import { initLayerContract, layerDescriptors, layerInstances, updateLayerInstance, layerOutputRead, layerMigrationInventory } from './layer-contract.mjs';
import { answerDecision, createProposal, ensureB02Fixture, getDecision, getProposal, listDecisions, listDownstreamRecords, listProposals, reassessRecord, reviseProposal } from './product-records.mjs';
import { openSecretStore } from './secret-store.mjs';
import { githubIntegration, initGithubIdentities } from './github-integration.mjs';
import { loadGitHubVendorConfig } from './github-vendor-config.mjs';
import { commitWorkspace, initializeAndPush, inspectGitRepository, loadGitProfile, pushWorkspace } from './git-repository.mjs';
import { getProjectBrand, updateProjectBrand } from './project-brand.mjs';
import { ensureProductWorkspace, getProductWorkspace, saveProductRecord } from './product-workspace.mjs';

const portalRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = resolve(portalRoot, '../..');
const dataDirectory = resolve(process.env.MACHINE_DATA_DIR || join(portalRoot, '.data'));
const databasePath = join(dataDirectory, 'machine.sqlite');
const distDirectory = join(portalRoot, 'dist');
const brandAssetDirectory = join(dataDirectory, 'brand-assets');
const host = process.env.MACHINE_HOST || '127.0.0.1';
const port = Number(process.env.MACHINE_PORT || 4310);
const publicBaseUrl = (process.env.MACHINE_PUBLIC_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');
const db = openDatabase(databasePath);
initWorkflow(db);
ensureProductWorkspace(db);
initAccounts(db);
initGithubIdentities(db);
initOnboarding(db);
initKnowledge(db);
initCodeLinks(db);
initPlatformOps(db);
initCodeLayer(db);
initAgentRuns(db);
initCodeCandidates(db);
initEditorBridge(db);
initSymphonyWorker(db);
initWorkRuns(db);
initLayerContract(db);
const secrets = openSecretStore(dataDirectory);
const topology = hostTopology(process.env, port);
const setupConfigPath = join(portalRoot, 'config', 'project-setup.json');
const gitSetup = loadGitProfile(setupConfigPath, 'the-machine');
const projectGitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(setupConfigPath, 'utf8')));
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const localSymphonyCodex = '/tmp/aludel-codex-cli-preflight/node_modules/.bin/codex';
const modelCatalog = providerModelCatalog({ codexCommand: process.env.MACHINE_CODEX_COMMAND || (existsSync(localSymphonyCodex) ? localSymphonyCodex : 'codex') });
const scaffoldSources = loadScaffoldSources(portalRoot);
const workspaceRoot = join(dataDirectory, 'workspaces');
const previews = previewManager({ db, portalRoot, workspaceRoot, logRoot: join(dataDirectory, 'preview-logs'), runtime: previewRuntime() });
const appUrls = slug => ({ portal: topology.portalOrigin, app: topology.appOrigin(slug) });
const commitIdentity = user => ({ name: user?.name || 'Aludel', email: user?.email || 'owner@aludel.invalid' });
// A new project's repository starts local; GitHub publishing is a later, separate step.
function createWorkspace(setup, user) {
  if (inspectGitRepository(setup.workspacePath).committed) return;
  writeFiles(setup.workspacePath, initialFiles(setup, catalogs, projectGitProfile, appUrls(setup.project.slug)));
  commitWorkspace({ repository: setup.workspacePath, profile: projectGitProfile, message: `chore: start ${setup.project.name} with Aludel`, ...commitIdentity(user) });
}
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets, workspaceRoot, assetRoot: join(dataDirectory, 'project-assets'), createWorkspace, know });
// One-time: projects created before the layers (LAY-03) get phases, a vision and page records from their onboarding data.
for (const project of db.prepare(`SELECT p.id, p.description, s.feel FROM projects p JOIN project_setup s ON s.project_id = p.id
  WHERE p.id <> 'the-machine' AND NOT EXISTS (SELECT 1 FROM knowledge_records k WHERE k.project_id = p.id AND k.kind = 'phase')`).all()) {
  know.ensureProject(project.id, { pitch: project.description });
  know.seedPages(project.id, project.feel);
}
// LAY-07: projects from before the Data layer and agent profiles get them (idempotent), before code links start listening.
const layerProjects = () => db.prepare("SELECT p.id FROM projects p JOIN project_setup s ON s.project_id = p.id WHERE p.id <> 'the-machine'").all().map(row => row.id);
for (const projectId of layerProjects()) {
  know.ensureAgents(projectId);
  know.ensurePackData(projectId);
  know.ensureRoutines(projectId);
  // WORK-UX-01: roles and actions replace working style; existing items get actions, priorities, checks and assignee ids.
  know.migrateWork(projectId);
  // ROADMAP-01: vision sections become Brief claims, research becomes Library sources, and the plan gets its projects.
  know.ensureBrief(projectId);
  know.ensureLibrary(projectId);
  know.ensurePlan(projectId);
  // DESIGN-UX-01: the token set, template component contracts, starter brand assets and documents.
  know.ensureDesign(projectId);
}
const links = codeLinks({ db, know });
const ops = platformOps({ db, backupRoot: join(dataDirectory, 'backups') });
const codeRelease = codeReleases({ db });
const storyRefs = projectId => know.list(projectId, 'story').map(story => ({ ...story, ref: `S${story.number}` }));
const symphonyWorkspaceRoot = resolve(process.env.MACHINE_SYMPHONY_WORKSPACE_ROOT || join(dataDirectory, 'symphony-workspaces'));
const candidates = codeCandidates({ db, candidateRoot: join(dataDirectory, 'code-candidates'), externalRoot: symphonyWorkspaceRoot });
const candidatePreviews = previewManager({ db, portalRoot, workspaceRoot: join(dataDirectory, 'candidate-preview-workspaces'),
  logRoot: join(dataDirectory, 'candidate-preview-logs'), dataRoot: join(dataDirectory, 'candidate-preview-data'), runtime: 'docker', kind: 'candidate' });
const candidateHost = id => `candidate-${createHash('sha256').update(id).digest('hex').slice(0, 12)}`;
function settleSymphonyBatch(projectId, batchId) {
  if (!batchId) return;
  const row = db.prepare("SELECT items_json FROM agent_batches WHERE id = ? AND project_id = ? AND execution_kind = 'symphony' AND state = 'running'").get(batchId, projectId);
  if (!row) return;
  const unresolved = Boolean(db.prepare("SELECT 1 FROM symphony_attempts WHERE batch_id = ? AND state IN ('authorized', 'working')").get(batchId));
  if (!unresolved) {
    db.prepare("UPDATE agent_batches SET state = 'done', finished_at = ? WHERE id = ?").run(new Date().toISOString(), batchId);
    if (typeof runs !== 'undefined') runs.admit(projectId);
  }
}
const worker = symphonyWorker({ db, know, candidates, workspaceRoot: symphonyWorkspaceRoot });
const symphonyDispatchEnabled = process.env.MACHINE_SYMPHONY_DISPATCH === '1';
const workerPoolView = projectId => ({ ...worker.poolStatus(projectId), dispatchEnabled: symphonyDispatchEnabled });

const runtimeBlockedWork = (view, batches, pool) => {
  const batchById = new Map(batches.map(batch => [batch.id, batch]));
  const profileById = new Map(view.profiles.map(profile => [profile.id, profile]));
  return view.work.map(item => {
    if (item.context?.executionBlock || !item.context?.batch) return item;
    const batch = batchById.get(item.context.batch);
    if (batch?.state !== 'queued') return item;
    const profile = profileById.get(batch.profileId);
    const block = !pool.dispatchEnabled
      ? { code: 'dispatch-disabled', reason: 'Symphony dispatch is disabled for this project.', recovery: 'deploy' }
      : !pool.online
        ? { code: 'host-offline', reason: 'The Symphony host is offline.', recovery: 'deploy' }
        : (profile?.model || (profile?.effort || 'medium') !== 'medium') && !pool.profileOverrides
          ? { code: 'profile-unsupported', reason: 'The Symphony host cannot apply this profile’s model and effort.', recovery: 'deploy' }
          : null;
    return block ? { ...item, status: 'blocked', context: { ...(item.context || {}), executionBlock: block } } : item;
  });
};
const ensureWorkerPool = projectId => worker.ensurePool(projectId, join(dataDirectory, 'symphony', projectId, 'worker-token'));
for (const projectId of layerProjects()) ensureWorkerPool(projectId);
const runs = agentRuns({ db, know, worker, symphonyDispatch: symphonyDispatchEnabled });
const runHistory = workRuns({ db, know, candidates });
// Accepting an exact code candidate: owner only, every check accepted, a healthy preview, and a fast-forward into the project.
async function acceptCandidate(user, projectId, candidateId, commit) {
  if (!db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'").get(projectId, user.id))
    return { status: 403, body: { error: 'Only a project owner can accept a code candidate.' } };
  const candidate = candidates.get(projectId, candidateId);
  if (!candidate || candidate.commit !== commit || !['review', 'accepted'].includes(candidate.state))
    return { status: 409, body: { error: 'Review the exact candidate commit before acceptance.' } };
  const work = know.workById(projectId, candidate.workId);
  if (!work || work.action !== 'platform.implement' || work.state !== 'review' || work.checks.some(check => check.verdict !== 'accept'))
    return { status: 409, body: { error: 'Accept every Work check before accepting this candidate.' } };
  const preview = candidatePreviews.status(candidateId);
  if (preview.commit !== candidate.commit || preview.status !== 'running' || !(await candidatePreviews.probe(candidateId)).ok)
    return { status: 409, body: { error: 'The exact candidate preview must be healthy before acceptance.' } };
  const source = flows.projectSetup(user, projectId).workspacePath;
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' });
  const clean = spawnSync('git', ['status', '--porcelain=v1'], { cwd: source, encoding: 'utf8' });
  if (head.status !== 0 || clean.status !== 0 || clean.stdout.trim() || ![candidate.base, candidate.commit].includes(head.stdout.trim()))
    return { status: 409, body: { error: 'The shared project changed since this candidate was built.' } };
  if (head.stdout.trim() === candidate.base) {
    const fetched = spawnSync('git', ['fetch', '--no-tags', '--', candidate.path, candidate.commit], { cwd: source, encoding: 'utf8', timeout: 30000 });
    if (fetched.status !== 0) return { status: 409, body: { error: 'Could not fetch the candidate commit.' } };
    const merged = spawnSync('git', ['merge', '--ff-only', candidate.commit], { cwd: source, encoding: 'utf8', timeout: 30000 });
    if (merged.status !== 0) return { status: 409, body: { error: 'The candidate cannot be fast-forwarded into the project.' } };
  }
  db.prepare("UPDATE code_candidates SET state = 'accepted', finished_at = ? WHERE id = ?").run(new Date().toISOString(), candidateId);
  const accepted = know.updateWork(user, projectId, work.id, { state: 'done', candidateId });
  know.appendLog(work.id, `Accepted exact code commit ${candidate.commit.slice(0, 12)} from ${candidateId}`, {}, { by: { kind: 'person', id: user.id } });
  settleSymphonyBatch(projectId, work.context?.batch);
  return { status: 200, body: { candidate: { id: candidateId, commit: candidate.commit, state: 'accepted' }, work: accepted } };
}

const editor = editorBridge({ db, know, projectSetup: (user, id) => flows.projectSetup(user, id), previewStatus: id => previews.status(id) });
// LAY-04: routines that are due create work, and each layer's gaps become backlog items (DEC-041). At start-up, then every ten minutes.
function tickRoutines() {
  for (const projectId of layerProjects()) {
    try { know.runRoutines(projectId); know.syncBacklog(projectId); } catch (error) { console.error(`Routines for ${projectId}: ${error.message}`); }
  }
}
tickRoutines();
setInterval(tickRoutines, 10 * 60 * 1000).unref();
const github = githubIntegration({
  db, secrets, config: loadGitHubVendorConfig(),
  callbackUrl: `${publicBaseUrl}/api/integrations/github/callback`,
  setupUrl: `${publicBaseUrl}/api/integrations/github/installed`,
  createUserFromGithub: profile => createExternalUser(db, { email: profile.email, name: profile.name || profile.login }).id
});

const digest = value => createHash('sha256').update(value).digest('hex');
const hashKey = (key, salt) => scryptSync(key, Buffer.from(salt, 'hex'), 32).toString('hex');
const json = (response, status, value, headers = {}) => {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), ...headers });
  response.end(body);
};
const readJson = (request, maxBytes = 1024 * 1024) => new Promise((resolveBody, reject) => {
  let body = '';
  request.on('data', chunk => { body += chunk; if (body.length > maxBytes) reject(Object.assign(new Error('Request too large'), { status: 413 })); });
  request.on('end', () => { try { resolveBody(body ? JSON.parse(body) : {}); } catch (error) { reject(error); } });
  request.on('error', reject);
});
const draftCookie = (token, maxAge) => `aludel_draft=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
const safeReturnPath = value => /^\/(?![/\\])[^\s]*$/.test(String(value || '')) ? String(value) : null;
const cookie = request => Object.fromEntries((request.headers.cookie || '').split(';').flatMap(part => {
  const index = part.indexOf('=');
  return index < 0 ? [] : [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))]];
}));

function saveOwnerKey(key) {
  const salt = randomBytes(16).toString('hex');
  db.prepare(`INSERT INTO auth_config(id, salt, key_hash, updated_at) VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET salt = excluded.salt, key_hash = excluded.key_hash, updated_at = excluded.updated_at`)
    .run(salt, hashKey(key, salt), new Date().toISOString());
  db.prepare('DELETE FROM sessions').run();
}

if (process.argv.includes('--reset-owner')) {
  db.prepare('DELETE FROM sessions').run();
  db.prepare('DELETE FROM auth_config').run();
  console.log('Owner access reset. Choose a new key in the local setup screen.');
  db.close();
  process.exit(0);
}

importCorpus(db, { root: repositoryRoot });
ensureB02Fixture(db);

const currentUser = request => sessionUser(db, cookie(request).machine_session);
const currentOwner = () => getUser(db, ownerUserId);

function projectView(user, projectId) {
  const setup = flows.projectSetup(user, projectId);
  const repository = inspectGitRepository(setup.workspacePath || gitSetup.repository);
  return { ...setup, urls: appUrls(setup.project.slug), github: github.status(user.id, projectId, repository), preview: previews.status(projectId) };
}

// Sign-up and sign-in continue the onboarding: an unclaimed draft becomes the new user's project.
function continueWithDraft(request, user, headers) {
  const token = cookie(request).aludel_draft;
  const draft = flows.getDraft(token);
  if (!draft || draft.claimedProjectId || !draft.profile || !draft.name) return null;
  const setup = flows.claimDraft(token, user, user);
  headers.push(draftCookie('', 0));
  return setup.project;
}

// Everything the scaffold needs from the layers: the Data contract for its manifest and Work › Agents for AGENTS.md.
function scaffoldSetup(user, projectId) {
  const setup = flows.projectSetup(user, projectId);
  know.ensureDesign(projectId);
  // DESIGN-UX-01: the Design layer's tokens, contracts and brand drive the generated styles, token files and brand.
  const brandUploads = new Map(flows.projectAssets(projectId, 'brand').map(asset => [asset.id, asset]));
  const designSystem = { tokens: know.list(projectId, 'design_tokens')[0] || null,
    components: know.list(projectId, 'component').map(component => ({ ...component, status: componentStatus(component) })), brand: know.list(projectId, 'brand_asset').map(asset => ({ ...asset, upload: asset.assetId ? brandUploads.get(asset.assetId) || null : null })) };
  return { ...setup, data: { objects: know.list(projectId, 'data_object'), operations: know.list(projectId, 'data_operation') }, agents: know.agentExport(projectId), designSystem,
    pageRecords: know.list(projectId, 'page') };
}

async function generateSkeleton(user, projectId) {
  const setup = scaffoldSetup(user, projectId);
  const { files, media, binaries, manifest } = skeletonFiles(setup, catalogs, projectGitProfile, appUrls(setup.project.slug), flows.projectAssets(projectId), scaffoldSources);
  // PLATFORM-UX-01: AGENTS.md belongs to the developers once it exists. Workflow files are left out while the GitHub
  // App lacks the Workflows permission, because GitHub refuses the whole push otherwise.
  // The old generated guide (it starts "# Agent guide for") is Aludel's own file: it becomes the map once; its content lives on in docs/agents.md.
  const agentsPath = join(setup.workspacePath, 'AGENTS.md');
  if (existsSync(agentsPath) && !readFileSync(agentsPath, 'utf8').startsWith('# Agent guide for ')) delete files['AGENTS.md'];
  const workflows = await github.canPushWorkflows(projectId).catch(() => false);
  if (workflows === false) for (const path of workflowPaths) if (!existsSync(join(setup.workspacePath, path))) delete files[path];
  createWorkspace(setup, user);
  writeFiles(setup.workspacePath, files);
  writeBinaries(setup.workspacePath, binaries);
  copyMedia(setup.workspacePath, media);
  const result = commitWorkspace({ repository: setup.workspacePath, profile: projectGitProfile, message: `feat: generate ${setup.project.name} skeleton from ${setup.stack.preset}`, ...commitIdentity(user) });
  const binding = github.status(user.id, projectId, null).repository;
  let pushed = false; let pushError = null;
  if (binding?.status === 'ready') {
    try {
      const token = await github.installationTokenForRepository(projectId, binding.name);
      pushWorkspace({ repository: setup.workspacePath, remoteUrl: binding.clone_url, token, branch: result.branch });
      pushed = true;
    } catch (error) { pushError = String(error.message || error); }
  }
  flows.markStep(user, projectId, 'build');
  know.recordBuild(projectId, result.commit, { auth: Boolean(setup.stack.options?.auth) });
  // LAY-07D: read the code and attach the manifest, so template-built records have code links from the start.
  let manifestResult = { missing: [] };
  try { links.index(projectId, setup.workspacePath); manifestResult = links.recordManifest(projectId, manifest, result.commit); }
  catch (error) { console.error(`Code index failed for ${projectId}: ${error.message}`); }
  // LAY-07B: every preview build is a release; the preview database is backed up before the app restarts.
  const backup = await ops.backup(projectId, setup.workspacePath, 'before release').catch(() => null);
  const built = links.builtBy(projectId);
  const release = ops.releases.start(projectId, { commit: result.commit, backup: backup?.name || null, stories: know.list(projectId, 'story').filter(story => built.has(story.id)).map(story => story.id) });
  void previews.build(projectId, setup.workspacePath, result.commit).then(status => ops.releases.finish(release.id, status));
  know.runRoutines(projectId, { trigger: 'release' });
  return { commit: result.commit, trackedFiles: result.trackedFiles, pushed, pushError, release: release.number, unmatchedManifest: manifestResult.missing };
}

function overview() {
  return {
    project: getProjectBrand(db, 'the-machine'),
    counts: {
      records: db.prepare('SELECT COUNT(*) AS count FROM source_documents').get().count,
      revisions: db.prepare('SELECT COUNT(*) AS count FROM source_revisions').get().count,
      requests: db.prepare('SELECT COUNT(*) AS count FROM owner_requests').get().count,
      proposals: db.prepare('SELECT COUNT(*) AS count FROM change_proposals').get().count,
      decisions: db.prepare('SELECT COUNT(*) AS count FROM decisions').get().count,
      stale: db.prepare("SELECT COUNT(*) AS count FROM downstream_records WHERE currency = 'stale'").get().count,
      unresolvedLinks: db.prepare('SELECT COUNT(*) AS count FROM source_links WHERE target_exists = 0').get().count
    },
    latestImport: db.prepare('SELECT * FROM import_runs ORDER BY id DESC LIMIT 1').get(),
    recentRecords: db.prepare(`SELECT id, title, path, kind, status, imported_at
      FROM source_documents ORDER BY imported_at DESC, title LIMIT 6`).all(),
    recentRequests: db.prepare(`SELECT id, body, status, created_at FROM owner_requests ORDER BY created_at DESC LIMIT 5`).all()
  };
}

async function api(request, response, url) {
  const user = currentUser(request);
  if (url.pathname === '/api/session' && request.method === 'GET') return json(response, 200, {
    authenticated: Boolean(user), user,
    setupRequired: !db.prepare('SELECT id FROM auth_config WHERE id = 1').get(),
    aludelMember: Boolean(user && isMember(db, user.id, aludelProjectId)),
    githubSignIn: github.status(null, null, null).configured,
    projects: user ? userProjects(db, user.id) : [],
    draft: flows.getDraft(cookie(request).aludel_draft)
  });
  // WORK-UX-01: each person's avatar (DiceBear Big Smile options), shown wherever work is assigned to them.
  if (url.pathname === '/api/account/avatar' && request.method === 'PUT') {
  if (!user) return json(response, 401, { error: 'Sign in to continue.' });
    return json(response, 200, { user: saveAvatar(db, user.id, (await readJson(request)).avatar ?? null) });
  }
  if (url.pathname === '/api/onboarding/catalog' && request.method === 'GET') return json(response, 200, flows.catalog());
  if (url.pathname === '/api/onboarding/draft' && request.method === 'GET') return json(response, 200, { draft: flows.getDraft(cookie(request).aludel_draft) });
  if (url.pathname === '/api/onboarding/draft' && request.method === 'PUT') {
    const saved = flows.saveDraft(cookie(request).aludel_draft, await readJson(request));
    return json(response, 200, { draft: saved.draft }, saved.token ? { 'set-cookie': draftCookie(saved.token, saved.maxAge) } : {});
  }
  if (url.pathname === '/api/accounts' && request.method === 'POST') {
    const created = createUser(db, await readJson(request));
    const headers = [createSession(db, created.id)];
    const project = continueWithDraft(request, created, headers);
    return json(response, 201, { user: created, project }, { 'set-cookie': headers });
  }
  if (url.pathname === '/api/sign-in' && request.method === 'POST') {
    const signedIn = verifyUser(db, await readJson(request));
    const headers = [createSession(db, signedIn.id)];
    const project = continueWithDraft(request, signedIn, headers);
    return json(response, 200, { user: signedIn, project }, { 'set-cookie': headers });
  }
  if (url.pathname === '/api/setup' && request.method === 'POST') {
    if (db.prepare('SELECT id FROM auth_config WHERE id = 1').get()) return json(response, 409, { error: 'Owner access is already configured.' });
    const { key = '' } = await readJson(request);
    if (String(key).length < 12) return json(response, 400, { error: 'Use at least 12 characters for the owner key.' });
    saveOwnerKey(String(key));
    const headers = [createSession(db, ownerUserId)];
    const project = continueWithDraft(request, currentOwner(), headers);
    return json(response, 201, { authenticated: true, project }, { 'set-cookie': headers });
  }
  if (url.pathname === '/api/login' && request.method === 'POST') {
    const { key = '' } = await readJson(request);
    const config = db.prepare('SELECT salt, key_hash FROM auth_config WHERE id = 1').get();
    if (!config) return json(response, 409, { error: 'Complete local owner setup first.' });
    const candidate = Buffer.from(hashKey(String(key), config.salt), 'hex');
    const expected = Buffer.from(config.key_hash, 'hex');
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return json(response, 401, { error: 'That owner key is not valid.' });
    const headers = [createSession(db, ownerUserId)];
    const project = continueWithDraft(request, currentOwner(), headers);
    return json(response, 200, { authenticated: true, project }, { 'set-cookie': headers });
  }
  if (url.pathname === '/api/logout' && request.method === 'POST') {
    return json(response, 200, { authenticated: false }, { 'set-cookie': endSession(db, cookie(request).machine_session) });
  }
  if (url.pathname === '/api/auth/github' && request.method === 'GET') {
    const path = safeReturnPath(url.searchParams.get('return')) || '/projects';
    response.writeHead(302, { location: github.startSignIn(`${topology.portalOriginFor(request.headers.host)}${path}`) });
    return response.end();
  }
  if (url.pathname === '/api/auth/complete' && request.method === 'GET') {
    const signedIn = redeemLoginTicket(db, url.searchParams.get('ticket'));
    const headers = [createSession(db, signedIn.id)];
    let project = null;
    try { project = continueWithDraft(request, signedIn, headers); } catch { /* The draft stays available to claim from the account step. */ }
    const path = safeReturnPath(url.searchParams.get('return')) || '/projects';
    const location = project ? `/start/${encodeURIComponent(project.id)}/github` : path === '/start/account' ? path : isMember(db, signedIn.id, aludelProjectId) && path === '/projects' ? '/#/the-machine/overview' : path;
    response.writeHead(302, { location, 'set-cookie': headers, 'cache-control': 'no-store' });
    return response.end();
  }
  if (url.pathname === '/api/integrations/github/callback' && request.method === 'GET') {
    let result;
    try { result = await github.callback({ code: url.searchParams.get('code'), state: url.searchParams.get('state') }); }
    catch (error) {
      // GitHub returns to the registered callback host; send people back to a readable page rather than raw JSON.
      response.writeHead(302, { location: `${topology.portalOrigin}/login?github_error=${encodeURIComponent(error.status ? error.message : 'GitHub sign-in failed. Please try again.')}` });
      return response.end();
    }
    if (result.signIn) {
      const target = new URL(result.returnTo || `${topology.portalOrigin}/projects`);
      const ticket = createLoginTicket(db, result.userId);
      response.writeHead(302, { location: `${target.origin}/api/auth/complete?ticket=${encodeURIComponent(ticket)}&return=${encodeURIComponent(target.pathname)}` });
      return response.end();
    }
    response.writeHead(302, { location: result.returnTo || '/#/the-machine/overview?github=connected' });
    return response.end();
  }
  if (url.pathname === '/api/integrations/github/installed' && request.method === 'GET') {
    const result = await github.installed({ installationId: url.searchParams.get('installation_id'), state: url.searchParams.get('state') });
    response.writeHead(302, { location: result.returnTo || '/#/the-machine/overview?github=installed' });
    return response.end();
  }
  // Editor tokens are accepted only on these read-only routes, never as portal sessions or write authority.
  if (url.pathname.startsWith('/api/editor/')) {
    if (request.method !== 'GET') return json(response, 405, { error: 'Read only.' });
    const { user: editorUser, projectId } = editor.authenticate(request.headers.authorization);
    const path = url.pathname.slice('/api/editor/'.length).split('/').map(decodeURIComponent);
    if (path[0] === 'me' && path.length === 1) return json(response, 200, { projectId, user: editorUser, tools: editor.tools }, { 'cache-control': 'no-store' });
    if (path[0] === 'tasks' && path.length === 1) return json(response, 200, { tasks: editor.assigned(editorUser, projectId) }, { 'cache-control': 'no-store' });
    if (path[0] === 'tasks' && path.length === 2) return json(response, 200, editor.context(editorUser, projectId, path[1]), { 'cache-control': 'no-store' });
    if (path[0] === 'bundles' && path.length === 2) return json(response, 200, editor.saved(editorUser, projectId, path[1]), { 'cache-control': 'no-store' });
    if (path[0] === 'records' && path.length === 2) {
      const value = url.searchParams.get('revision');
      return json(response, 200, editor.record(projectId, path[1], value === null ? null : Number(value)), { 'cache-control': 'no-store' });
    }
    if (path[0] === 'search' && path.length === 1) return json(response, 200, { results: editor.search(projectId, url.searchParams.get('q')) }, { 'cache-control': 'no-store' });
    if (path[0] === 'environment' && path.length === 1) return json(response, 200, editor.environment(editorUser, projectId), { 'cache-control': 'no-store' });
    return json(response, 404, { error: 'Not found.' });
  }
  // Symphony host credentials have no browser/session authority. Pool requests resolve their pinned profile per attempt.
  if (url.pathname.startsWith('/api/worker/')) {
    const workerAuth = worker.authenticate(request.headers.authorization);
    const attemptRoute = /^\/api\/worker\/attempts\/([^/]+)(?:\/(workspace|runs|events|candidate|commit|audit|proposal|question|plan|progress))?$/.exec(url.pathname);
    if (attemptRoute) {
      const [, attemptId, operation] = attemptRoute;
      const scope = worker.scopeForAttempt(workerAuth, attemptId);
      if (!operation && request.method === 'GET') return json(response, 200, worker.attemptStatus(scope, attemptId), { 'cache-control': 'no-store' });
      if (request.method === 'POST' && operation) {
        const input = await readJson(request, ['audit', 'proposal'].includes(operation) ? 128 * 1024 : 64 * 1024);
        // WORK-ITEM-UX-01 WI-5: the agent's own plan and progress, shown as the run's objectives.
        if (operation === 'plan') return json(response, 200, runHistory.reportPlan(workerAuth.projectId, attemptId, input.objectives), { 'cache-control': 'no-store' });
        if (operation === 'progress') {
          const result = runHistory.reportProgress(workerAuth.projectId, attemptId, { index: input.index, status: input.status, note: input.note });
          if (result.terminal) settleSymphonyBatch(workerAuth.projectId, worker.attemptStatus(scope, attemptId).batchId);
          return json(response, 200, result, { 'cache-control': 'no-store' });
        }
        const evidence = ['candidate', 'commit', 'audit', 'proposal'].includes(operation) ? runHistory.checkEvidence(workerAuth.projectId, attemptId, input.evidence) : [];
        const result = operation === 'workspace' ? worker.registerWorkspace(scope, { attemptId, path: input.path })
          : operation === 'runs' ? worker.reserveRun(scope, { attemptId })
          : operation === 'events' ? worker.appendEvent(scope, { attemptId, ...input })
            : operation === 'commit' ? worker.commitCandidate(scope, { attemptId, message: input.message, checks: input.checks })
              : operation === 'audit' ? worker.submitAudit(scope, { attemptId, report: input.report })
                : operation === 'proposal' ? worker.submitProposal(scope, { attemptId, proposal: input.proposal })
                : operation === 'question' ? worker.askQuestion(scope, { attemptId, question: input.question, reason: input.reason, options: input.options })
                : worker.submitCandidate(scope, { attemptId, commit: input.commit, checks: input.checks });
        runHistory.recordEvidence(attemptId, evidence);
        if (['candidate', 'commit', 'audit', 'proposal', 'question', 'events'].includes(operation)) settleSymphonyBatch(workerAuth.projectId, worker.attemptStatus(scope, attemptId).batchId);
        if (result.candidate) { const { path, ...candidate } = result.candidate; return json(response, 201, { attemptId, candidate }, { 'cache-control': 'no-store' }); }
        return json(response, 200, result, { 'cache-control': 'no-store' });
      }
      return json(response, 405, { error: 'Method not allowed.' });
    }
    if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' });
    if (url.pathname === '/api/worker/issues') {
      const ids = url.searchParams.get('ids');
      const states = url.searchParams.get('states');
      const cursor = url.searchParams.get('cursor') || '';
      const limit = Number(url.searchParams.get('limit') || 50);
      if (workerAuth.pool) { worker.heartbeat(workerAuth, Number(url.searchParams.get('capacity') || 1), url.searchParams.get('profile_overrides') === '1'); runs.admit(workerAuth.projectId); }
      return json(response, 200, worker.issues(workerAuth, { ids: ids === null ? null : ids.split(','), states: states === null ? null : states.split(','), cursor, limit }), { 'cache-control': 'no-store' });
    }
    const task = /^\/api\/worker\/tasks\/([a-f0-9]{64})$/.exec(url.pathname);
    if (task) return json(response, 200, worker.taskOpen(worker.scopeForDigest(workerAuth, task[1]), task[1]), { 'cache-control': 'no-store' });
    const digest = String(url.searchParams.get('digest') || '');
    const scope = workerAuth.pool ? worker.scopeForDigest(workerAuth, digest) : workerAuth;
    if (url.pathname === '/api/worker/knowledge/map') return json(response, 200, worker.knowledgeMap(scope, digest), { 'cache-control': 'no-store' });
    if (url.pathname === '/api/worker/knowledge/search') return json(response, 200, worker.knowledgeSearch(scope, digest, url.searchParams.get('q'), url.searchParams.get('kind'), Number(url.searchParams.get('cursor') || 0)), { 'cache-control': 'no-store' });
    const record = /^\/api\/worker\/knowledge\/records\/([^/]+)$/.exec(url.pathname);
    if (record) return json(response, 200, worker.knowledgeRead(scope, digest, record[1], url.searchParams.has('revision') ? Number(url.searchParams.get('revision')) : null), { 'cache-control': 'no-store' });
    const bundle = /^\/api\/worker\/bundles\/([a-f0-9]{64})$/.exec(url.pathname);
    if (bundle) return json(response, 200, worker.activeBundle(worker.scopeForDigest(workerAuth, bundle[1]), bundle[1]), { 'cache-control': 'no-store' });
    return json(response, 404, { error: 'Not found.' });
  }
  if (!user) return json(response, 401, { error: 'Sign in to continue.' });
  const returnTo = () => {
    const path = safeReturnPath(url.searchParams.get('return'));
    return path ? `${topology.portalOriginFor(request.headers.host)}${path}` : null;
  };
  if (url.pathname === '/api/github' && request.method === 'GET') return json(response, 200, github.status(user.id, null, null));
  if (url.pathname === '/api/github/connect' && request.method === 'GET') {
    response.writeHead(302, { location: github.startAuthorization(user.id, returnTo()) });
    return response.end();
  }
  if (url.pathname === '/api/github/install' && request.method === 'GET') {
    response.writeHead(302, { location: github.startInstallation(user.id, returnTo()) });
    return response.end();
  }
  if (url.pathname === '/api/github/installations/refresh' && request.method === 'POST') {
    await github.refreshInstallations(user.id);
    return json(response, 200, github.status(user.id, null, null));
  }
  if (url.pathname === '/api/onboarding/claim' && request.method === 'POST') {
    const token = cookie(request).aludel_draft;
    const setup = flows.claimDraft(token, user, user);
    return json(response, 201, { project: setup.project }, { 'set-cookie': draftCookie('', 0) });
  }
  if (url.pathname === '/api/projects' && request.method === 'GET') return json(response, 200, { projects: userProjects(db, user.id) });
  const layerRoute = /^\/api\/projects\/([^/]+)\/layers(?:\/([^/]+)\/outputs\/([^/]+)\/([^/]+))?$/.exec(url.pathname);
  if (layerRoute && request.method === 'GET') {
    const [, projectId, layerKey, kind, recordId] = layerRoute.map(value => value ? decodeURIComponent(value) : value);
    if (!layerKey) return json(response, 200, { layers: layerDescriptors(db, user.id, projectId) }, { 'cache-control': 'no-store' });
    return json(response, 200, layerOutputRead(db, user.id, projectId, layerKey, kind, recordId), { 'cache-control': 'no-store' });
  }
  const instanceRoute = /^\/api\/projects\/([^/]+)\/layer-instances(?:\/([^/]+))?$/.exec(url.pathname);
  if (instanceRoute) {
    const projectId = decodeURIComponent(instanceRoute[1]);
    if (request.method === 'GET' && !instanceRoute[2]) return json(response, 200, { layers: layerInstances(db, user.id, projectId) }, { 'cache-control': 'no-store' });
    if (request.method === 'PUT' && instanceRoute[2]) return json(response, 200,
      updateLayerInstance(db, user.id, projectId, decodeURIComponent(instanceRoute[2]), await readJson(request)), { 'cache-control': 'no-store' });
    return json(response, 405, { error: 'Method not allowed.' });
  }
  const inventoryRoute = /^\/api\/projects\/([^/]+)\/layers-inventory$/.exec(url.pathname);
  if (inventoryRoute && request.method === 'GET') return json(response, 200, layerMigrationInventory(db, user.id, decodeURIComponent(inventoryRoute[1])), { 'cache-control': 'no-store' });

  const candidateAcceptRoute = /^\/api\/projects\/([^/]+)\/candidates\/([^/]+)\/accept$/.exec(url.pathname);
  if (candidateAcceptRoute) {
    const [, projectId, candidateId] = candidateAcceptRoute;
    requireMember(db, user, projectId);
    if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' });
    const input = await readJson(request);
    const result = await acceptCandidate(user, projectId, candidateId, input.commit);
    return json(response, result.status, result.body, { 'cache-control': 'no-store' });
  }
  // WORK-ITEM-UX-01: an item's runs, each with its own task snapshot, outputs, review and signature.
  const runRoute = /^\/api\/projects\/([^/]+)\/work\/([^/]+)\/runs(?:\/([^/]+)\/(review|sign|submit|stop))?$/.exec(url.pathname);
  if (runRoute) {
    const [, rawProject, rawWork, rawAttempt, operation] = runRoute;
    const projectId = decodeURIComponent(rawProject), workId = decodeURIComponent(rawWork), attemptId = rawAttempt ? decodeURIComponent(rawAttempt) : null;
    requireMember(db, user, projectId);
    if (!operation && request.method === 'GET') return json(response, 200, { runs: runHistory.list(projectId, workId) }, { 'cache-control': 'no-store' });
    if (!operation && request.method === 'POST') {
      const input = await readJson(request);
      if (input.action === 'start-person') return json(response, 201, runHistory.startPerson(user, projectId, workId), { 'cache-control': 'no-store' });
      return json(response, 400, { error: 'Unknown run action.' });
    }
    if (operation === 'submit' && request.method === 'POST') return json(response, 200, runHistory.submitPerson(user, projectId, workId, attemptId, await readJson(request)), { 'cache-control': 'no-store' });
    if (operation === 'stop' && request.method === 'POST') return json(response, 200, runHistory.stopPerson(user, projectId, workId, attemptId), { 'cache-control': 'no-store' });
    if (operation === 'review' && request.method === 'PUT') return json(response, 200, runHistory.saveReview(projectId, workId, attemptId, await readJson(request)), { 'cache-control': 'no-store' });
    if (operation === 'sign' && request.method === 'POST') {
      const input = await readJson(request);
      const stamp = () => new Date().toISOString();
      const signed = await runHistory.sign(user, projectId, workId, attemptId, { outcome: String(input.outcome || ''), comment: typeof input.comment === 'string' ? input.comment : '' }, {
        accept: async run => {
          if (run.candidate) {
            const result = await acceptCandidate(user, projectId, run.candidate.id, run.candidate.commit);
            if (result.status !== 200) throw Object.assign(new Error(result.body.error), { status: result.status });
          } else if (run.proposalId && run.changes[0]?.kind === 'claim') {
            runs.acceptBrief(user, projectId, workId, run.proposalId);
            db.prepare("UPDATE symphony_proposals SET state = 'accepted', accepted_at = ? WHERE id = ? AND project_id = ?").run(stamp(), run.proposalId, projectId);
          } else if (run.proposalId) worker.acceptProposal(user, projectId, workId, run.proposalId);
          else know.updateWork(user, projectId, workId, { state: 'done' });
        },
        reject: async run => {
          if (run.candidate?.state === 'review') {
            db.prepare("UPDATE code_candidates SET state = 'rejected', finished_at = ? WHERE id = ?").run(stamp(), run.candidate.id);
            await candidatePreviews.stop(run.candidate.id);
          }
          if (run.proposalId && run.changes[0]?.kind === 'claim') runs.rejectBrief(projectId, workId, run.proposalId);
          if (run.proposalId) worker.rejectProposal(projectId, workId, run.proposalId);
        },
      });
      settleSymphonyBatch(projectId, signed.batchId);
      return json(response, 200, { run: signed, work: know.workById(projectId, workId) }, { 'cache-control': 'no-store' });
    }
    return json(response, 405, { error: 'Method not allowed.' });
  }
  const candidatePreviewRoute = /^\/api\/projects\/([^/]+)\/candidates\/([^/]+)\/preview$/.exec(url.pathname);
  if (candidatePreviewRoute) {
    const [, projectId, candidateId] = candidatePreviewRoute;
    requireMember(db, user, projectId);
    const candidate = candidates.get(projectId, candidateId);
    if (!candidate) return json(response, 404, { error: 'Candidate not found.' });
    const link = topology.appOrigin(candidateHost(candidateId));
    if (request.method === 'GET') return json(response, 200, { preview: candidatePreviews.status(candidateId), url: link }, { 'cache-control': 'no-store' });
    if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' });
    if (!db.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'").get(projectId, user.id))
      return json(response, 403, { error: 'Only a project owner can build a code candidate preview.' });
    const source = flows.projectSetup(user, projectId).workspacePath;
    const detail = candidates.inspect(projectId, candidateId, source);
    if (candidate.state !== 'submitted' || !detail.baseCurrent || !candidate.commit) return json(response, 409, { error: 'Candidate is not a current submitted commit.' });
    const snapshot = mkdtempSync(join(tmpdir(), 'aludel-candidate-preview-'));
    try {
      const clone = spawnSync('git', ['clone', '--no-hardlinks', '--no-checkout', '--', candidate.path, snapshot], { encoding: 'utf8', timeout: 30000 });
      if (clone.status !== 0) throw Object.assign(new Error('Could not snapshot the candidate commit.'), { status: 409 });
      const checkout = spawnSync('git', ['checkout', '--detach', candidate.commit], { cwd: snapshot, encoding: 'utf8', timeout: 30000 });
      if (checkout.status !== 0) throw Object.assign(new Error('Candidate commit is no longer available.'), { status: 409 });
      rmSync(join(snapshot, '.git'), { recursive: true, force: true });
      const preview = await candidatePreviews.build(candidateId, snapshot, candidate.commit);
      if (preview.status === 'running' && (await candidatePreviews.probe(candidateId)).ok) {
        db.prepare("UPDATE code_candidates SET state = 'review', checks_json = ?, finished_at = ? WHERE id = ? AND state = 'submitted'")
          .run(JSON.stringify([...candidate.checks, { name: 'Docker build and /api/health', status: 'passed', detail: 'Built from exact candidate commit in an isolated container.', source: 'aludel' }]), new Date().toISOString(), candidateId);
        know.appendLog(candidate.workId, `Candidate ${candidate.commit.slice(0, 12)} built and ready for review`, { state: 'review' });
      }
      return json(response, 200, { preview, url: link }, { 'cache-control': 'no-store' });
    } finally { rmSync(snapshot, { recursive: true, force: true }); }
  }
  const projectRoute = /^\/api\/projects\/([^/]+)\/(setup|preferences|design|pages|assets|features|stack|connections\/agent|steps|repository|skeleton|preview|knowledge|records|work|editor|candidates|openapi\.json|platform|database|code|reconcile|agents|changes|routines|batches|docs|comments|brand-templates)(?:\/([^/]+))?$/.exec(url.pathname);
  if (projectRoute) {
    const [, rawId, section, rawItem] = projectRoute;
    const projectId = decodeURIComponent(rawId);
    const item = rawItem ? decodeURIComponent(rawItem) : null;
    requireMember(db, user, projectId);
    const method = request.method;
    // After any successful change to a project's layers, the gaps they reveal become backlog items (DEC-041).
    if (method !== 'GET' && projectId !== aludelProjectId && ['records', 'work', 'features', 'pages', 'skeleton', 'routines', 'batches'].includes(section)) {
      response.once('finish', () => { if (response.statusCode < 400) { try { know.syncBacklog(projectId); } catch (error) { console.error(`Backlog for ${projectId}: ${error.message}`); } } });
    }
    // Candidate evidence is project-scoped and read-only. Promotion needs a separate reviewed flow.
    if (section === 'candidates' && method === 'GET') {
      const workspace = flows.projectSetup(user, projectId).workspacePath;
      if (item) { const { path, ...view } = candidates.inspect(projectId, item, workspace); return json(response, 200, view, { 'cache-control': 'no-store' }); }
      const workId = url.searchParams.get('workId');
      if (!workId || !know.workById(projectId, workId)) return json(response, 404, { error: 'Work item not found.' });
      return json(response, 200, { candidates: candidates.forWork(projectId, workId).map(({ path, ...view }) => view), attempt: worker.attemptForWork(projectId, workId) }, { 'cache-control': 'no-store' });
    }
    // Work exposes runtime status only; the local host credential is provisioned into private data storage.
    if (section === 'agents' && item === 'symphony-runs' && method === 'POST') {
      const input = await readJson(request);
      return json(response, 200, worker.extendRuns(user, projectId, String(input.workId || ''), input.expectedRunLimit), { 'cache-control': 'no-store' });
    }
    if (section === 'agents' && item === 'symphony' && method === 'GET') { ensureWorkerPool(projectId); return json(response, 200, workerPoolView(projectId), { 'cache-control': 'no-store' }); }
    if (section === 'agents' && item === 'symphony' && method === 'PUT') { ensureWorkerPool(projectId); const input = await readJson(request); return json(response, 200, { ...worker.configurePool(user, projectId, input.capacity), dispatchEnabled: symphonyDispatchEnabled }, { 'cache-control': 'no-store' }); }
    if (section === 'editor' && method === 'GET') return json(response, 200, editor.status(user, projectId));
    if (section === 'editor' && method === 'POST') return json(response, 201, editor.issue(user, projectId), { 'cache-control': 'no-store' });
    if (section === 'editor' && method === 'DELETE') return json(response, 200, editor.revoke(user, projectId));
    if (section === 'setup' && method === 'GET') return json(response, 200, projectView(user, projectId));
    // LAY-03: the layers read one project snapshot and write records and work items through the knowledge module.
    if (section === 'knowledge' && method === 'GET') {
      ensureWorkerPool(projectId);
      if (projectId === aludelProjectId) return json(response, 409, { error: 'Aludel’s own knowledge moves into its layers in LAY-06.' });
      // A project made after start-up plans itself the first time its layers are opened (after onboarding chose its story packs).
      know.ensurePlan(projectId);
      know.ensureDesign(projectId);
      know.ensureFlows(projectId);
      const view = know.view(user, projectId, { builtBy: links.builtBy(projectId) });
      const batchView = runs.view(projectId);
      const poolView = workerPoolView(projectId);
      const workView = runtimeBlockedWork(view, batchView, poolView);
      // PAGES-UX-01: each page's address in the generated app, so Pages › Built opens the right one.
      const pagePaths = Object.fromEntries(sitePages(know.navRoutes(projectId), know.list(projectId, 'page')).filter(page => page.id).map(page => [page.id, page.path]));
      const workspace = flows.projectSetup(user, projectId).workspacePath;
      const codexModels = await modelCatalog.list('codex');
      return json(response, 200, { setup: projectView(user, projectId), knowledge: { ...view, work: workView, pagePaths, code: links.snapshot(projectId), batches: batchView,
        uploads: flows.uploads(projectId), symphonyProfiles: symphonyDispatchEnabled ? know.list(projectId, 'agent_profile').filter(profile => profile.active && (!profile.provider || profile.provider === 'codex')).map(profile => profile.id) : [], workerPool: poolView, brandUsage: workspaceIsIndexable(workspace) ? brandUsage(workspace, view.brand) : {} },
        catalog: { pageTypes: catalogs.pageTypes, routeIcons: catalogs.routeIcons, feels: catalogs.feels, stacks: catalogs.stacks, tools: catalogs.roles.tools, botColors, efforts,
          providers: { codex: codexModels, 'openai-api': { models: [], fetchedAt: null, error: 'Runtime adapter unavailable.' }, anthropic: { models: [], fetchedAt: null, error: 'Runtime adapter unavailable.' } },
          brandTemplates: Object.fromEntries(Object.entries(catalogs.brandTemplates).map(([id, template]) => [id, { label: template.label, summary: template.summary, icon: template.icon, assets: template.assets.length }])) } });
    }
    // LAY-07A: the Data layer's contract as OpenAPI 3.1.
    if (section === 'openapi.json' && method === 'GET') {
      const setup = flows.projectSetup(user, projectId);
      const body = JSON.stringify(know.openApi(projectId, { title: setup.project.name }), null, 2);
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'content-disposition': `inline; filename="${setup.project.slug}-openapi.json"` });
      return response.end(body);
    }
    // LAY-07B: Platform operations for the local preview environment.
    if (section === 'platform' && method === 'GET') {
      const setup = flows.projectSetup(user, projectId);
      const workspace = setup.workspacePath;
      return json(response, 200, { releases: ops.releases.list(projectId), repository: ops.commits(workspace), database: ops.health(workspace), backups: ops.listBackups(projectId),
        health: await previews.probe(projectId), domains: { preview: appUrls(setup.project.slug).app, base: topology.baseDomain || 'localhost' }, variables: readVariables(workspace) });
    }
    if (section === 'database') {
      const workspace = flows.projectSetup(user, projectId).workspacePath;
      if (item === 'schema' && method === 'GET') return json(response, 200, { schema: ops.schema(workspace) });
      if (item === 'browse' && method === 'GET') return json(response, 200, ops.browse(workspace, url.searchParams.get('table') || ''));
      if (item === 'query' && method === 'POST') return json(response, 200, ops.query(workspace, (await readJson(request)).sql));
      if (item === 'backups' && method === 'POST') {
        const created = await ops.backup(projectId, workspace, 'manual');
        return created ? json(response, 201, { backup: created, backups: ops.listBackups(projectId) }) : json(response, 404, { error: 'The preview has no database to back up yet.' });
      }
      if (item === 'restore' && method === 'POST') {
        const input = await readJson(request);
        return json(response, 200, await ops.restore(projectId, workspace, input.name, { confirm: input.confirm, stopPreview: () => previews.stop(projectId) }));
      }
    }
    // PLATFORM-UX-01: Code reads the repository; it never edits code. Starter docs fill only missing files.
    if (section === 'code' && item !== 'index') {
      const workspace = flows.projectSetup(user, projectId).workspacePath;
      if (item === 'files' && method === 'GET') { const files = trackedFiles(workspace); return json(response, 200, { files, stack: readStack(workspace, files) }); }
      if (item === 'file' && method === 'GET') return json(response, 200, readSource(workspace, url.searchParams.get('path')));
      if (item === 'docs' && method === 'GET') return json(response, 200, readDocs(workspace, id => { const record = know.get(projectId, id); return record ? record.revision : undefined; }));
      if (item === 'docs-starter' && method === 'POST') {
        if (!inspectGitRepository(workspace).committed) return json(response, 409, { error: 'The repository does not exist yet. Finish setup first.' });
        const setup = flows.projectSetup(user, projectId);
        return json(response, 200, starterDocs(workspace, { project: setup.project, stories: storyRefs(projectId), personas: know.list(projectId, 'persona'), objects: know.list(projectId, 'data_object'),
          operations: know.list(projectId, 'data_operation'), tokens: know.list(projectId, 'design_tokens')[0] || null, components: know.list(projectId, 'component'), stack: readStack(workspace) }));
      }
      if (item === 'docs-refresh' && method === 'POST') {
        const input = await readJson(request);
        const view = readDocs(workspace, id => { const record = know.get(projectId, id); return record ? record.revision : undefined; });
        const docSection = view.docs.find(doc => doc.path === input.path)?.sections.find(entry => entry.heading === input.heading);
        if (!docSection) return json(response, 404, { error: 'That section is not in the docs.' });
        const changed = docSection.sources.filter(source => source.state !== 'current' && know.get(projectId, source.id));
        return json(response, 201, know.createWork(projectId, { action: 'platform.docs', title: `Refresh ${input.path} › ${input.heading}`.slice(0, 160),
          targets: changed.map(source => ({ id: source.id, label: `${source.kind} revision ${source.revision} → ${source.current}` })) }, user.name));
      }
      if (item === 'releases' && method === 'GET') return json(response, 200, { releases: codeRelease.list(projectId), draft: codeRelease.draft(projectId, workspace, storyRefs(projectId), [...links.builtBy(projectId).keys()]) });
      if (item === 'releases' && method === 'POST') return json(response, 201, codeRelease.record(projectId, workspace, storyRefs(projectId), await readJson(request), user.name, [...links.builtBy(projectId).keys()]));
      // Round 3 (owner-authorized): publish a recorded release to the project's own GitHub repository as a tag and a GitHub Release.
      // The repository's release workflow then builds the image into GitHub Packages.
      if (item === 'releases-publish' && method === 'POST') {
        const version = String((await readJson(request)).version || '');
        const release = codeRelease.list(projectId).find(entry => entry.version === version);
        if (!release) return json(response, 404, { error: 'That release is not recorded.' });
        if (release.publishedAt) return json(response, 409, { error: `v${release.version} is already published.` });
        const sha = codeRelease.fullSha(workspace, release.commit);
        const titles = new Map(storyRefs(projectId).map(story => [story.id, `${story.ref} ${story.title}`]));
        const body = [release.notes, release.stories.length ? `Ships:\n${release.stories.map(id => `- ${titles.get(id) || id}`).join('\n')}` : '', release.changes.length ? `Stack changes:\n${release.changes.map(change => `- ${change.name} ${change.from || 'added'} → ${change.to || 'removed'}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
        const published = await github.createRelease(projectId, { tag: `v${release.version}`, sha, name: `v${release.version}`, body });
        return json(response, 200, codeRelease.markPublished(projectId, release.version, published.url));
      }
      if (item === 'ci' && method === 'GET') return json(response, 200, await github.ciResults(projectId, codeRelease.fullSha(workspace, url.searchParams.get('sha') || 'HEAD')));
    }
    // LAY-07D: re-read the workspace; and the context a Reconcile item needs.
    if (section === 'code' && item === 'index' && method === 'POST') {
      const workspace = flows.projectSetup(user, projectId).workspacePath;
      if (!workspaceIsIndexable(workspace)) return json(response, 409, { error: 'Build the app first; there is no code to read yet.' });
      return json(response, 200, links.index(projectId, workspace));
    }
    if (section === 'reconcile' && item && method === 'GET') {
      const work = know.workList(projectId).find(entry => entry.id === item);
      return work ? json(response, 200, links.reconcileContext(projectId, work) || {}) : json(response, 404, { error: 'Work item not found.' });
    }
    // WORK-UX-01: what an item changed, as revision diffs.
    if (section === 'changes' && item && method === 'GET') return json(response, 200, { changes: know.workChanges(projectId, item) });
    // AGENTS.md carries the project, role and action instructions into the repository.
    if (section === 'agents' && item === 'export' && method === 'POST') {
      const setup = scaffoldSetup(user, projectId);
      if (!inspectGitRepository(setup.workspacePath).committed) return json(response, 409, { error: 'The repository does not exist yet. Finish setup first.' });
      writeFiles(setup.workspacePath, { 'docs/agents.md': agentsGuide(setup, catalogs) });
      return json(response, 200, { written: 'docs/agents.md', committed: false });
    }
    if (section === 'records' && method === 'POST' && !item) {
      const input = await readJson(request);
      const work = know.openWorkItem(projectId, input.workItemId);
      return json(response, 201, know.insert(projectId, String(input.kind || ''), input.data || {}, { parentId: input.parentId || null, author: user.name, rationale: input.rationale || null, workItemId: work?.id || null }));
    }
    if (section === 'records' && method === 'PUT' && item) {
      const input = await readJson(request);
      const work = know.openWorkItem(projectId, input.workItemId);
      return json(response, 200, know.update(projectId, item, input.data || {}, { expectedRevision: input.expectedRevision, author: user.name, rationale: input.rationale || null, position: input.position, parentId: input.parentId, workItemId: work?.id || null }));
    }
    if (section === 'records' && method === 'DELETE' && item) {
      const record = ['story', 'spec', 'doc', 'research', 'persona', 'activity', 'step', 'data_object', 'data_operation', 'access_rule', 'brief_claim', 'source', 'finding', 'insight', 'evidence_link', 'project', 'component', 'brand_asset', 'flow', 'page'].flatMap(kind => know.list(projectId, kind)).find(entry => entry.id === item);
      if (!record) return json(response, 409, { error: 'That record cannot be deleted here.' });
      // PAGES-UX-01: only page blanks go from the Map. Pages in the navigation change in the navigation editor; built pages change through a change request.
      if (record.kind === 'page' && (record.inNav || record.status !== 'planned' || links.builtBy(projectId).get(record.id)?.units)) return json(response, 409, { error: `“${record.label}” has a build or is in the navigation, so it can't be deleted from the Map.` });
      const users = know.referrers(projectId, item);
      if (users.length) return json(response, 409, { error: `Still used by ${users.slice(0, 3).join(', ')}${users.length > 3 ? ` and ${users.length - 3} more` : ''}. Change those first.` });
      know.remove(projectId, item);
      return json(response, 200, { deleted: item });
    }
    if (section === 'work' && method === 'POST' && !item) {
      // People stage suggestions; reconcile and routine contexts are only ever written by the server.
      const input = await readJson(request);
      if (input.action) {
        const selected = know.roleView(projectId).flatMap(role => role.actions.map(action => ({ ...action, layer: role.layer }))).find(action => action.id === input.action);
        if (!selected || input.layer && input.layer !== selected.layer || input.type && input.type !== selected.type) throw Object.assign(new Error('Choose a current role action.'), { status: 400 });
      }
      return json(response, 201, know.createWork(projectId, { ...input, context: typeof input.suggestion === 'string' ? { suggestion: input.suggestion.slice(0, 2000) } : null }, user.name));
    }
    if (section === 'work' && method === 'PUT' && item) {
      const input = await readJson(request);
      if (input.apply) return json(response, 200, know.applyAnswer(user, projectId, item, String(input.apply)));
      if (typeof input.acceptBrief === 'string') {
        const accepted = runs.acceptBrief(user, projectId, item, input.acceptBrief);
        db.prepare("UPDATE symphony_proposals SET state = 'accepted', accepted_at = ? WHERE id = ? AND project_id = ?").run(new Date().toISOString(), input.acceptBrief, projectId);
        settleSymphonyBatch(projectId, accepted.work.context?.batch);
        return json(response, 200, accepted);
      }
      if (typeof input.acceptProposal === 'string') {
        const accepted = worker.acceptProposal(user, projectId, item, input.acceptProposal);
        settleSymphonyBatch(projectId, accepted.work.context?.batch);
        return json(response, 200, accepted);
      }
      // Staging, skipping, stopping and reassigning go through the batches, which keep running batches locked.
      if (input.stage === true) return json(response, 200, runs.stage(user, projectId, item));
      if (input.stage === false) return json(response, 200, runs.unstage(user, projectId, item));
      if (typeof input.skip === 'boolean') return json(response, 200, runs.skip(user, projectId, item, input.skip));
      if (input.stop === true) return json(response, 200, runs.stopItem(user, projectId, item));
      if (input.assignee !== undefined) return json(response, 200, runs.reassign(user, projectId, item, input.assignee));
      if (typeof input.note === 'string' && input.note.trim()) know.appendLog(item, input.note.trim().slice(0, 500), {}, { by: { kind: 'person', id: user.id } });
      if (input.sendBack && know.workById(projectId, item)?.action === 'platform.implement') {
        const before = know.workById(projectId, item);
        const result = know.updateWork(user, projectId, item, input);
        const reviewCandidate = candidates.forWork(projectId, item).find(value => value.state === 'review');
        if (reviewCandidate) {
          db.prepare("UPDATE code_candidates SET state = 'rejected', finished_at = ? WHERE id = ?").run(new Date().toISOString(), reviewCandidate.id);
          await candidatePreviews.stop(reviewCandidate.id);
        }
        settleSymphonyBatch(projectId, before.context?.batch);
        return json(response, 200, result);
      }
      const before = know.workById(projectId, item);
      const updated = know.updateWork(user, projectId, item, input);
      if (before?.state === 'needs-input' && input.answer !== undefined) {
        const interrupted = db.prepare("SELECT id FROM symphony_attempts WHERE project_id = ? AND work_id = ? AND state = 'blocked' ORDER BY created_at DESC LIMIT 1").get(projectId, item);
        if (interrupted) runHistory.recordSignature(user, projectId, item, interrupted.id, 'close',
          `Answered “${String(input.answer).trim().slice(0, 300)}”${input.criteriaAmendment !== undefined ? '; next-run criteria reviewed' : ''}.`);
      }
      if (before?.action === 'product.brief' && input.sendBack && before.context?.visionProposal?.id) {
        runs.rejectBrief(projectId, item, before.context.visionProposal.id);
        worker.rejectProposal(projectId, item, before.context.visionProposal.id);
      }
      if (before?.context?.workProposal?.id && input.sendBack) worker.rejectProposal(projectId, item, before.context.workProposal.id);
      if (['platform.security', 'product.define', 'product.clarify', 'product.brief', 'data.contract', 'design.audit', 'pages.a11y', 'deploy.review', 'work.review'].includes(before?.action) &&
          (input.sendBack || input.state === 'done' || input.answer !== undefined)) settleSymphonyBatch(projectId, before.context?.batch);
      return json(response, 200, updated);
    }
    if (section === 'routines' && method === 'POST' && item) return json(response, 201, { created: know.runRoutines(projectId, { trigger: 'manual', routineId: item }) });
    // DEC-040: agent batches. Start is the owner's authorization to spend on exactly the batch's items.
    if (section === 'batches' && method === 'POST' && item) {
      const input = await readJson(request);
      if (item === 'start') { const { batch } = runs.start(user, projectId, String(input.batchId || ''), input.requestedSlots ?? 1); return json(response, 202, { batch }); }
      if (item === 'stop') return json(response, 200, { batch: runs.stop(user, projectId, String(input.batchId || '')) });
      if (item === 'next') return json(response, 200, runs.next(user, projectId, input.assignee, input.count));
    }
    // ROADMAP-01: documents generated from the Brief, and comments on insights.
    if (section === 'docs' && method === 'POST') return json(response, item ? 200 : 201, know.generateDoc(user, projectId, { generator: String((await readJson(request)).generator || ''), id: item }));
    if (section === 'comments' && method === 'POST' && item) return json(response, 201, know.addComment(user, projectId, item, (await readJson(request)).text));
    // DESIGN-UX-01: a brand template adds its stock assets; each can be changed or deleted like any other.
    if (section === 'brand-templates' && method === 'POST' && item) return json(response, 201, { added: know.addBrandTemplate(user, projectId, item) });
    if (section === 'preferences' && method === 'PUT') { flows.savePreferences(user, projectId, await readJson(request)); return json(response, 200, projectView(user, projectId)); }
    if (section === 'design' && method === 'PUT') { flows.saveDesign(user, projectId, await readJson(request)); return json(response, 200, projectView(user, projectId)); }
    if (section === 'assets' && method === 'POST' && !item) { const { uploaded } = flows.addAsset(user, projectId, await readJson(request, 12 * 1024 * 1024)); return json(response, 201, { ...projectView(user, projectId), uploaded }); }
    if (section === 'assets' && method === 'GET' && item) {
      const asset = flows.assetFile(user, projectId, item);
      const body = readFileSync(asset.path);
      response.writeHead(200, { 'content-type': asset.mime, 'content-length': body.length, 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=3600' });
      return response.end(body);
    }
    if (section === 'assets' && method === 'DELETE' && item) { flows.removeAsset(user, projectId, item); return json(response, 200, projectView(user, projectId)); }
    if (section === 'features' && method === 'PUT' && !item) { flows.saveFeatures(user, projectId, await readJson(request)); return json(response, 200, projectView(user, projectId)); }
    if (section === 'features' && method === 'DELETE' && item) { flows.removeFeature(user, projectId, item); return json(response, 200, projectView(user, projectId)); }
    if (section === 'pages' && item === 'change' && method === 'POST') return json(response, 201, know.requestPageChange(projectId, await readJson(request), user.name));
    if (section === 'pages' && item === 'review' && method === 'POST') return json(response, 200, know.reviewFlow(projectId, { ...(await readJson(request)), assignee: { kind: 'person', id: user.id } }, user.name));
    if (section === 'pages' && method === 'PUT') { flows.saveRoutes(user, projectId, await readJson(request)); return json(response, 200, projectView(user, projectId)); }
    if (section === 'stack' && method === 'PUT') { flows.saveStack(user, projectId, await readJson(request)); return json(response, 200, projectView(user, projectId)); }
    if (section === 'connections/agent' && method === 'GET') return json(response, 200, flows.agentConnection(user, projectId));
    if (section === 'connections/agent' && method === 'PUT') return json(response, 200, await flows.saveAgentConnection(user, projectId, await readJson(request)));
    if (section === 'connections/agent' && method === 'POST') return json(response, 200, await flows.checkAgentConnection(user, projectId));
    if (section === 'connections/agent' && method === 'DELETE') return json(response, 200, flows.removeAgentConnection(user, projectId));
    if (section === 'steps' && method === 'POST' && item) { flows.markStep(user, projectId, item); return json(response, 200, projectView(user, projectId)); }
    // Retries the first push after a failure (the repository already exists on GitHub, so nothing is created twice).
    if (section === 'repository' && item === 'finish' && method === 'POST' && projectId !== aludelProjectId) {
      const workspace = flows.projectSetup(user, projectId).workspacePath;
      await github.finishLocalSetup(projectId, ({ remoteUrl, token }) => pushWorkspace({ repository: workspace, remoteUrl, token, branch: projectGitProfile.initialBranch }));
      return json(response, 200, projectView(user, projectId));
    }
    if (section === 'repository' && !item && method === 'POST' && projectId !== aludelProjectId) {
      const input = await readJson(request);
      const workspace = flows.projectSetup(user, projectId).workspacePath;
      await github.createRepository(user.id, projectId, input, ({ remoteUrl, token }) => pushWorkspace({ repository: workspace, remoteUrl, token, branch: projectGitProfile.initialBranch }));
      flows.markStep(user, projectId, 'github');
      return json(response, 201, projectView(user, projectId));
    }
    if (section === 'skeleton' && method === 'POST') {
      if (projectId === aludelProjectId) return json(response, 409, { error: 'Aludel is already running; it has no generated skeleton.' });
      const result = await generateSkeleton(user, projectId);
      return json(response, 202, { ...projectView(user, projectId), result });
    }
    if (section === 'preview' && method === 'GET') return json(response, 200, { preview: previews.status(projectId), urls: appUrls(flows.projectSetup(user, projectId).project.slug) });
    return json(response, 404, { error: 'Not found.' });
  }
  const brandMatch = /^\/api\/projects\/([^/]+)\/brand$/.exec(url.pathname);
  if (brandMatch) requireMember(db, user, decodeURIComponent(brandMatch[1]));
  if (brandMatch && request.method === 'GET') {
    const brand = getProjectBrand(db, decodeURIComponent(brandMatch[1]));
    return brand ? json(response, 200, brand) : json(response, 404, { error: 'Project not found.' });
  }
  if (brandMatch && request.method === 'PUT') {
    const brand = updateProjectBrand(db, brandAssetDirectory, decodeURIComponent(brandMatch[1]), await readJson(request, 12 * 1024 * 1024));
    return brand ? json(response, 200, brand) : json(response, 404, { error: 'Project not found.' });
  }
  const productMatch = /^\/api\/projects\/([^/]+)\/product(?:\/(direction|outcome|feature)(?:\/([^/]+))?)?$/.exec(url.pathname);
  if (productMatch) {
    const projectId = decodeURIComponent(productMatch[1]);
    requireMember(db, user, projectId);
    if (!productMatch[2] && request.method === 'GET') return json(response, 200, getProductWorkspace(db, projectId));
    if (productMatch[2] && request.method === 'PUT') {
      const id = productMatch[3] ? decodeURIComponent(productMatch[3]) : undefined;
      return json(response, id ? 200 : 201, saveProductRecord(db, projectId, productMatch[2], id, await readJson(request)));
    }
  }
  // Everything below is Aludel's own workspace (still single-project until ONB-06), so it needs Aludel membership.
  if (!isMember(db, user.id, aludelProjectId)) return json(response, 404, { error: 'Not found.' });
  if (url.pathname === '/api/integrations/github' && request.method === 'GET') return json(response, 200,
    github.status(user.id, 'the-machine', inspectGitRepository(gitSetup.repository)));
  if (url.pathname === '/api/integrations/github/connect' && request.method === 'GET') {
    response.writeHead(302, { location: github.startAuthorization(user.id) });
    return response.end();
  }
  if (url.pathname === '/api/integrations/github/install' && request.method === 'GET') {
    response.writeHead(302, { location: github.startInstallation(user.id) });
    return response.end();
  }
  if (url.pathname === '/api/integrations/github/installations/refresh' && request.method === 'POST') {
    await github.refreshInstallations(user.id);
    return json(response, 200, github.status(user.id, 'the-machine', inspectGitRepository(gitSetup.repository)));
  }
  if (url.pathname === '/api/integrations/github/repository' && request.method === 'POST') {
    const input = await readJson(request);
    if (input.confirmName !== input.name) return json(response, 400, { error: 'Type the repository name exactly to confirm creation.' });
    const binding = await github.createRepository(user.id, 'the-machine', input, values => initializeAndPush({ ...values, repository: gitSetup.repository, profile: gitSetup.profile }));
    return json(response, 201, binding);
  }
  if (url.pathname === '/api/integrations/github/repository/finish' && request.method === 'POST') {
    const binding = await github.finishLocalSetup('the-machine', values => initializeAndPush({ ...values, repository: gitSetup.repository, profile: gitSetup.profile }));
    return json(response, 200, binding);
  }
  if (url.pathname === '/api/work' && request.method === 'GET') return json(response, 200, { tasks: workList(db), requests: db.prepare('SELECT id, body, status, created_at FROM owner_requests ORDER BY created_at DESC').all() });
  if (/^\/api\/work\/(authorize|answer|resume|cancel|refresh)$/.test(url.pathname) && request.method === 'POST') return json(response, 200, workOperation(db, 'owner', url.pathname.split('/').pop(), await readJson(request)));
  if (url.pathname === '/api/overview' && request.method === 'GET') return json(response, 200, overview());
  if (url.pathname === '/api/product-state' && request.method === 'GET') return json(response, 200, {
    proposals: listProposals(db), decisions: listDecisions(db), records: listDownstreamRecords(db)
  });
  if (url.pathname === '/api/proposals' && request.method === 'GET') return json(response, 200, { proposals: listProposals(db) });
  if (url.pathname === '/api/proposals' && request.method === 'POST') return json(response, 201, createProposal(db, await readJson(request)));
  if (url.pathname.startsWith('/api/proposals/') && request.method === 'GET') {
    const proposal = getProposal(db, decodeURIComponent(url.pathname.slice('/api/proposals/'.length)));
    return proposal ? json(response, 200, proposal) : json(response, 404, { error: 'Proposal not found.' });
  }
  if (url.pathname.match(/^\/api\/proposals\/[^/]+\/revisions$/) && request.method === 'POST') {
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    return json(response, 200, reviseProposal(db, id, await readJson(request)));
  }
  if (url.pathname === '/api/decisions' && request.method === 'GET') return json(response, 200, { decisions: listDecisions(db) });
  if (url.pathname.match(/^\/api\/decisions\/[^/]+\/answer$/) && request.method === 'POST') {
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    return json(response, 200, answerDecision(db, id, await readJson(request)));
  }
  if (url.pathname.startsWith('/api/decisions/') && request.method === 'GET') {
    const decision = getDecision(db, decodeURIComponent(url.pathname.slice('/api/decisions/'.length)));
    return decision ? json(response, 200, decision) : json(response, 404, { error: 'Decision not found.' });
  }
  if (url.pathname === '/api/dependents' && request.method === 'GET') return json(response, 200, { records: listDownstreamRecords(db) });
  if (url.pathname.match(/^\/api\/dependents\/[^/]+\/reassess$/) && request.method === 'POST') {
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    return json(response, 200, reassessRecord(db, id));
  }
  if (url.pathname === '/api/imports' && request.method === 'POST') return json(response, 200, importCorpus(db, { root: repositoryRoot }));
  if (url.pathname === '/api/records' && request.method === 'GET') {
    const query = (url.searchParams.get('q') || '').trim();
    const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
    const records = db.prepare(`SELECT id, title, path, kind, status, current_hash, imported_at
      FROM source_documents WHERE ? = '' OR title LIKE ? ESCAPE '\\' OR path LIKE ? ESCAPE '\\'
      ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, title LIMIT 250`).all(query, pattern, pattern);
    return json(response, 200, { query, records });
  }
  if (url.pathname.startsWith('/api/records/') && request.method === 'GET') {
    const id = decodeURIComponent(url.pathname.slice('/api/records/'.length));
    const record = db.prepare(`SELECT d.*, r.revision, r.raw_content, r.metadata_json
      FROM source_documents d JOIN source_revisions r ON r.id = d.current_revision_id WHERE d.id = ?`).get(id);
    if (!record) return json(response, 404, { error: 'Record not found.' });
    record.metadata = JSON.parse(record.metadata_json);
    delete record.metadata_json;
    record.links = db.prepare(`SELECT raw_target, target_path, target_exists, resolved_document_id
      FROM source_links WHERE source_document_id = ? ORDER BY target_path`).all(id);
    record.revisions = db.prepare(`SELECT revision, content_hash, imported_at FROM source_revisions
      WHERE document_id = ? ORDER BY revision DESC`).all(id);
    return json(response, 200, record);
  }
  if (url.pathname === '/api/requests' && request.method === 'POST') {
    const { body = '' } = await readJson(request);
    if (!String(body).trim()) return json(response, 400, { error: 'Describe the outcome you want.' });
    const now = new Date().toISOString();
    const value = { id: `REQ-${randomUUID()}`, body: String(body).trim(), status: 'new', created_at: now };
    db.prepare(`INSERT INTO owner_requests(id, project_id, body, status, created_at, updated_at)
      VALUES (?, 'the-machine', ?, ?, ?, ?)`).run(value.id, value.body, value.status, now, now);
    return json(response, 201, value);
  }
  if (url.pathname.startsWith('/api/requests/') && request.method === 'PATCH') {
    const id = decodeURIComponent(url.pathname.slice('/api/requests/'.length));
    const { expectedStatus, status } = await readJson(request);
    if (!['new', 'deferred'].includes(status)) return json(response, 400, { error: 'Choose untriaged or deferred.' });
    const current = db.prepare('SELECT id, body, status, created_at, updated_at FROM owner_requests WHERE id = ?').get(id);
    if (!current) return json(response, 404, { error: 'Request not found.' });
    if (current.status !== expectedStatus) return json(response, 409, { error: 'This signal changed. Refresh and review its current state.' });
    const updatedAt = new Date().toISOString();
    db.prepare('UPDATE owner_requests SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, id);
    return json(response, 200, { ...current, status, updated_at: updatedAt });
  }
  return json(response, 404, { error: 'Not found.' });
}

function serveStatic(response, pathname) {
  if (pathname.startsWith('/brand-assets/')) {
    const relative = normalize(pathname.slice('/brand-assets/'.length)).replace(/^(\.\.(\/|\\|$))+/, '');
    const assetPath = join(brandAssetDirectory, relative);
    if (assetPath.startsWith(brandAssetDirectory) && existsSync(assetPath)) return serveFile(response, assetPath);
  }
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  let path = join(distDirectory, safePath);
  if (!existsSync(path) || !path.startsWith(distDirectory)) path = join(distDirectory, 'index.html');
  return serveFile(response, path);
}

function serveFile(response, path) {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[extname(path)] || 'application/octet-stream';
  const body = readFileSync(path);
  response.writeHead(200, { 'content-type': mime, 'content-length': body.length, 'x-content-type-options': 'nosniff', 'content-security-policy': `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src ${topology.appOrigin('*')}; frame-ancestors 'self'` });
  response.end(body);
}

function appPage(response, status, title, message) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font-family:Roboto,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f6fb;color:#141727}main{max-width:460px;padding:32px}a{color:#3047b9}</style>
</head><body><main><h1>${title}</h1><p>${message}</p><p><a href="${topology.portalOrigin}/projects">Open Aludel</a></p></main></body></html>`;
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  response.end(body);
}

// <slug>.<base> serves only that project's preview. Portal APIs and cookies never exist on app hosts.
async function serveApp(request, response, slug) {
  if (/^candidate-[a-f0-9]{12}$/.test(slug)) {
    const matching = db.prepare("SELECT id FROM code_candidates WHERE state IN ('submitted', 'review', 'accepted')").all()
      .filter(row => candidateHost(row.id) === slug);
    if (matching.length === 1) {
      const port = await candidatePreviews.ensureRunning(matching[0].id, '');
      if (!port) return appPage(response, 503, 'Candidate preview unavailable', 'Build this candidate from its Work item first.');
      return candidatePreviews.proxy(request, response, port, matching[0].id);
    }
  }
  const project = db.prepare('SELECT p.id, p.name, s.workspace_path FROM projects p JOIN project_setup s ON s.project_id = p.id WHERE p.slug = ?').get(slug);
  if (!project?.workspace_path) return appPage(response, 404, 'No app here yet', 'There is no Aludel project at this address.');
  const port = await previews.ensureRunning(project.id, project.workspace_path);
  if (!port) {
    const status = previews.status(project.id).status;
    return appPage(response, 503, `${project.name.replace(/[<>&"]/g, '')} is not built yet`, status === 'building' ? 'The skeleton is building. Refresh in a few seconds.' : 'Finish setup in Aludel to generate and build this app.');
  }
  previews.proxy(request, response, port, project.id);
}

const server = createServer(async (request, response) => {
  try {
    const target = topology.classify(request.headers.host);
    if (target.kind === 'app') return await serveApp(request, response, target.slug);
    if (target.kind !== 'portal') return appPage(response, 421, 'Unknown address', 'This host is not served by Aludel.');
    const url = new URL(request.url, `http://${host}:${port}`);
    if (url.pathname.startsWith('/api/')) await api(request, response, url);
    else serveStatic(response, url.pathname);
  } catch (error) {
    if (!error.status) console.error(error);
    if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'The local portal could not complete that operation.', currentRevision: error.currentRevision });
    else response.end();
  }
});

server.listen(port, host, () => {
  console.log(`Aludel is running at ${topology.portalOrigin} (also http://${host}:${port})`);
  console.log(`Project apps are served at ${topology.appOrigin('<app>')}`);
  console.log(`Database: ${databasePath}`);
  console.log(`Symphony Work admission: ${symphonyDispatchEnabled ? 'enabled' : 'disabled'}; worker health: Deploy › Agents`);
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { previews.stopAll(); candidatePreviews.stopAll(); server.close(() => { db.close(); process.exit(0); }); server.closeAllConnections?.(); });
