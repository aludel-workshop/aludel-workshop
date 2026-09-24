import { initWorkflow, workList, workOperation } from './workflow.mjs';
import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { aludelProjectId, createExternalUser, createLoginTicket, createSession, createUser, endSession, getUser, redeemLoginTicket, initAccounts, isMember, ownerUserId, requireMember, saveAvatar, sessionUser, userProjects, verifyUser } from './accounts.mjs';
import { hostTopology } from './hosts.mjs';
import { initOnboarding, loadCatalogs, onboarding } from './onboarding.mjs';
import { botColors, efforts, initKnowledge, knowledge } from './knowledge.mjs';
import { previewManager, previewRuntime } from './previews.mjs';
import { agentsGuide, copyMedia, initialFiles, loadScaffoldSources, skeletonFiles, writeBinaries, writeFiles } from './scaffold.mjs';
import { brandUsage, componentStatus } from './design.mjs';
import { codeLinks, initCodeLinks, workspaceIsIndexable } from './code-links.mjs';
import { initPlatformOps, platformOps } from './platform-ops.mjs';
import { agentRuns, initAgentRuns } from './agent-runs.mjs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importCorpus } from './importer.mjs';
import { openDatabase } from './storage.mjs';
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
initAgentRuns(db);
const secrets = openSecretStore(dataDirectory);
const topology = hostTopology(process.env, port);
const setupConfigPath = join(portalRoot, 'config', 'project-setup.json');
const gitSetup = loadGitProfile(setupConfigPath, 'the-machine');
const projectGitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(setupConfigPath, 'utf8')));
const catalogs = loadCatalogs(join(portalRoot, 'config'));
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
const runs = agentRuns({ db, know, secrets, providers: catalogs.agentProviders.providers });
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
  return { ...setup, data: { objects: know.list(projectId, 'data_object'), operations: know.list(projectId, 'data_operation') }, agents: know.agentExport(projectId), designSystem };
}

async function generateSkeleton(user, projectId) {
  const setup = scaffoldSetup(user, projectId);
  const { files, media, binaries, manifest } = skeletonFiles(setup, catalogs, projectGitProfile, appUrls(setup.project.slug), flows.projectAssets(projectId), scaffoldSources);
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
  const projectRoute = /^\/api\/projects\/([^/]+)\/(setup|preferences|design|pages|assets|features|stack|connections\/agent|steps|repository|skeleton|preview|knowledge|records|work|openapi\.json|platform|database|code|reconcile|agents|changes|routines|batches|docs|comments|brand-templates)(?:\/([^/]+))?$/.exec(url.pathname);
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
    if (section === 'setup' && method === 'GET') return json(response, 200, projectView(user, projectId));
    // LAY-03: the layers read one project snapshot and write records and work items through the knowledge module.
    if (section === 'knowledge' && method === 'GET') {
      if (projectId === aludelProjectId) return json(response, 409, { error: 'Aludel’s own knowledge moves into its layers in LAY-06.' });
      // A project made after start-up plans itself the first time its layers are opened (after onboarding chose its story packs).
      know.ensurePlan(projectId);
      know.ensureDesign(projectId);
      const view = know.view(user, projectId, { builtBy: links.builtBy(projectId) });
      const workspace = flows.projectSetup(user, projectId).workspacePath;
      return json(response, 200, { setup: projectView(user, projectId), knowledge: { ...view, code: links.snapshot(projectId), batches: runs.view(projectId),
        uploads: flows.uploads(projectId), brandUsage: workspaceIsIndexable(workspace) ? brandUsage(workspace, view.brand) : {} },
        catalog: { pageTypes: catalogs.pageTypes, routeIcons: catalogs.routeIcons, feels: catalogs.feels, stacks: catalogs.stacks, tools: catalogs.roles.tools, botColors, efforts,
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
        health: await previews.probe(projectId), domains: { preview: appUrls(setup.project.slug).app, base: topology.baseDomain || 'localhost' } });
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
      writeFiles(setup.workspacePath, { 'AGENTS.md': agentsGuide(setup, catalogs) });
      return json(response, 200, { written: 'AGENTS.md', committed: false });
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
      const record = ['story', 'spec', 'doc', 'research', 'persona', 'activity', 'step', 'data_object', 'data_operation', 'access_rule', 'brief_claim', 'source', 'finding', 'insight', 'evidence_link', 'project', 'component', 'brand_asset'].flatMap(kind => know.list(projectId, kind)).find(entry => entry.id === item);
      if (!record) return json(response, 409, { error: 'That record cannot be deleted here.' });
      const users = know.referrers(projectId, item);
      if (users.length) return json(response, 409, { error: `Still used by ${users.slice(0, 3).join(', ')}${users.length > 3 ? ` and ${users.length - 3} more` : ''}. Change those first.` });
      know.remove(projectId, item);
      return json(response, 200, { deleted: item });
    }
    if (section === 'work' && method === 'POST' && !item) {
      // People stage suggestions; reconcile and routine contexts are only ever written by the server.
      const input = await readJson(request);
      return json(response, 201, know.createWork(projectId, { ...input, context: typeof input.suggestion === 'string' ? { suggestion: input.suggestion.slice(0, 400) } : null }, user.name));
    }
    if (section === 'work' && method === 'PUT' && item) {
      const input = await readJson(request);
      if (input.apply) return json(response, 200, know.applyAnswer(user, projectId, item, String(input.apply)));
      // Staging, skipping, stopping and reassigning go through the batches, which keep running batches locked.
      if (input.stage === true) return json(response, 200, runs.stage(user, projectId, item));
      if (input.stage === false) return json(response, 200, runs.unstage(user, projectId, item));
      if (typeof input.skip === 'boolean') return json(response, 200, runs.skip(user, projectId, item, input.skip));
      if (input.stop === true) return json(response, 200, runs.stopItem(user, projectId, item));
      if (input.assignee !== undefined) return json(response, 200, runs.reassign(user, projectId, item, input.assignee));
      if (typeof input.note === 'string' && input.note.trim()) know.appendLog(item, input.note.trim().slice(0, 500), {}, { by: { kind: 'person', id: user.id } });
      return json(response, 200, know.updateWork(user, projectId, item, input));
    }
    if (section === 'routines' && method === 'POST' && item) return json(response, 201, { created: know.runRoutines(projectId, { trigger: 'manual', routineId: item }) });
    // DEC-040: agent batches. Start is the owner's authorization to spend on exactly the batch's items.
    if (section === 'batches' && method === 'POST' && item) {
      const input = await readJson(request);
      if (item === 'start') { const { batch } = runs.start(user, projectId, String(input.batchId || '')); return json(response, 202, { batch }); }
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
    if (section === 'pages' && method === 'PUT') { flows.saveRoutes(user, projectId, await readJson(request)); return json(response, 200, projectView(user, projectId)); }
    if (section === 'stack' && method === 'PUT') { flows.saveStack(user, projectId, await readJson(request)); return json(response, 200, projectView(user, projectId)); }
    if (section === 'connections/agent' && method === 'GET' && item === 'models') return json(response, 200, await runs.models(projectId));
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
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { previews.stopAll(); server.close(() => { db.close(); process.exit(0); }); server.closeAllConnections?.(); });
