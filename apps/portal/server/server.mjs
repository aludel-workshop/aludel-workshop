import { initWorkflow, workList, workOperation } from './workflow.mjs';
import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { aludelProjectId, createExternalUser, createLoginTicket, createSession, createUser, endSession, getUser, redeemLoginTicket, initAccounts, isMember, ownerUserId, requireMember, sessionUser, userProjects, verifyUser } from './accounts.mjs';
import { hostTopology } from './hosts.mjs';
import { initOnboarding, loadCatalogs, onboarding } from './onboarding.mjs';
import { previewManager } from './previews.mjs';
import { copyMedia, initialFiles, loadScaffoldSources, skeletonFiles, writeBinaries, writeFiles } from './scaffold.mjs';
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
const secrets = openSecretStore(dataDirectory);
const topology = hostTopology(process.env, port);
const setupConfigPath = join(portalRoot, 'config', 'project-setup.json');
const gitSetup = loadGitProfile(setupConfigPath, 'the-machine');
const projectGitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(setupConfigPath, 'utf8')));
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const scaffoldSources = loadScaffoldSources(portalRoot);
const workspaceRoot = join(dataDirectory, 'workspaces');
const previews = previewManager({ db, portalRoot, workspaceRoot, logRoot: join(dataDirectory, 'preview-logs') });
const appUrls = slug => ({ portal: topology.portalOrigin, app: topology.appOrigin(slug) });
const commitIdentity = user => ({ name: user?.name || 'Aludel', email: user?.email || 'owner@aludel.invalid' });
// A new project's repository starts local; GitHub publishing is a later, separate step.
function createWorkspace(setup, user) {
  if (inspectGitRepository(setup.workspacePath).committed) return;
  writeFiles(setup.workspacePath, initialFiles(setup, catalogs, projectGitProfile, appUrls(setup.project.slug)));
  commitWorkspace({ repository: setup.workspacePath, profile: projectGitProfile, message: `chore: start ${setup.project.name} with Aludel`, ...commitIdentity(user) });
}
const flows = onboarding({ db, catalogs, secrets, workspaceRoot, assetRoot: join(dataDirectory, 'project-assets'), createWorkspace });
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

async function generateSkeleton(user, projectId) {
  const setup = flows.projectSetup(user, projectId);
  const { files, media, binaries } = skeletonFiles(setup, catalogs, projectGitProfile, appUrls(setup.project.slug), flows.projectAssets(projectId), scaffoldSources);
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
  void previews.build(projectId, setup.workspacePath, result.commit);
  return { commit: result.commit, trackedFiles: result.trackedFiles, pushed, pushError };
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
  const projectRoute = /^\/api\/projects\/([^/]+)\/(setup|preferences|design|pages|assets|features|stack|connections\/agent|steps|repository|skeleton|preview)(?:\/([^/]+))?$/.exec(url.pathname);
  if (projectRoute) {
    const [, rawId, section, rawItem] = projectRoute;
    const projectId = decodeURIComponent(rawId);
    const item = rawItem ? decodeURIComponent(rawItem) : null;
    requireMember(db, user, projectId);
    const method = request.method;
    if (section === 'setup' && method === 'GET') return json(response, 200, projectView(user, projectId));
    if (section === 'preferences' && method === 'PUT') { flows.savePreferences(user, projectId, await readJson(request)); return json(response, 200, projectView(user, projectId)); }
    if (section === 'design' && method === 'PUT') { flows.saveDesign(user, projectId, await readJson(request)); return json(response, 200, projectView(user, projectId)); }
    if (section === 'assets' && method === 'POST' && !item) { flows.addAsset(user, projectId, await readJson(request, 12 * 1024 * 1024)); return json(response, 201, projectView(user, projectId)); }
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
    if (section === 'connections/agent' && method === 'GET') return json(response, 200, flows.agentConnection(user, projectId));
    if (section === 'connections/agent' && method === 'PUT') return json(response, 200, flows.saveAgentConnection(user, projectId, await readJson(request)));
    if (section === 'connections/agent' && method === 'DELETE') return json(response, 200, flows.removeAgentConnection(user, projectId));
    if (section === 'steps' && method === 'POST' && item) { flows.markStep(user, projectId, item); return json(response, 200, projectView(user, projectId)); }
    if (section === 'repository' && method === 'POST' && projectId !== aludelProjectId) {
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
  previews.proxy(request, response, port);
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
