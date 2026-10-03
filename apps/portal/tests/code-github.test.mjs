// T03-CODE github-sync journey: the Code repository on the owner's GitHub, against a fake GitHub. The API answers through the
// integration's injected fetcher; Git talks smart-HTTP to a separate fake server process (fake-github-git.mjs) that accepts
// only installation tokens. Covers importing a repository the scaffold didn't make, a push after a Knowledge save,
// picking up an external commit, divergence held as Work, an expired token and an uninstalled App, with the person's own
// credential helper never used and no token stored. Runs with templates on.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initCodeLayer } from '../server/code-layer.mjs';
import { codeUnits, initCodeUnits } from '../server/code-units.mjs';
import { codeImport } from '../server/code-import.mjs';
import { codeRepository, codeSync, githubTokenFor, initCodeRepository } from '../server/code-repository.mjs';
import { commitWorkspace } from '../server/git-repository.mjs';
import { githubIntegration, initGithubIdentities } from '../server/github-integration.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initSourceReviews } from '../server/layer-api.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerDocs } from '../server/layer-docs.mjs';
import { initLayerFiles } from '../server/layer-files.mjs';
import { initLayerRemotes, layerRemotes } from '../server/layer-remote.mjs';
import { initLayerSource } from '../server/layer-source.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const templates = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1';
const portalRoot = new URL('..', import.meta.url).pathname;
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const gitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(join(portalRoot, 'config', 'project-setup.json'), 'utf8')));
const identity = { GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'dev@example.com' };
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, ...identity }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value, text: async () => JSON.stringify(value) });
const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const vendorConfig = { configured: true, issues: [], appId: '24680', appSlug: 'the-machine-app', clientId: 'Iv1234567890', clientSecret: 'a-very-long-vendor-client-secret', privateKey };

test('T03-CODE github-sync: import, push, pick-up, divergence and unavailable states against a fake GitHub', { skip: !templates }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-code-github-'));
  const old = { dir: process.env.MACHINE_DATA_DIR, config: process.env.GIT_CONFIG_GLOBAL };
  process.env.MACHINE_DATA_DIR = root;
  // The person's own git config has a helper (like `gh auth git-credential`) that would answer with their login.
  const marker = join(root, 'helper-used');
  writeFileSync(join(root, 'gitconfig'), `[credential]\n\thelper = "!f() { echo used > '${marker}'; echo username=person; echo password=personal-token; }; f"\n`);
  process.env.GIT_CONFIG_GLOBAL = join(root, 'gitconfig');
  const github = join(root, 'github');
  mkdirSync(join(github, 'octo'), { recursive: true });
  writeFileSync(join(github, 'tokens.json'), JSON.stringify(['ghs_installation-1']));
  const server = spawn(process.execPath, [join(portalRoot, 'tests/fake-github-git.mjs'), github], { stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    const port = await new Promise(resolve => server.stdout.once('data', chunk => resolve(Number(String(chunk).trim()))));
    // A repository the owner made outside Aludel: not a scaffold.
    const made = join(root, 'made');
    mkdirSync(join(made, 'src'), { recursive: true });
    git(root, 'init', '-q', '-b', 'main', made);
    writeFileSync(join(made, 'README.md'), '# Legacy tool share\n');
    writeFileSync(join(made, 'src/main.ts'), "import { lend } from './lend';\nconsole.log(lend('ladder'));\n");
    writeFileSync(join(made, 'src/lend.ts'), 'export function lend(tool: string) { return `Lent ${tool}`; }\n');
    git(made, 'add', '-A'); git(made, 'commit', '-q', '-m', 'Their app');
    const bare = join(github, 'octo', 'legacy.git');
    git(root, 'clone', '-q', '--bare', made, bare);

    const db = openDatabase(join(root, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initGithubIdentities(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initCodeUnits(db); initCodeLayer(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const { token: draft } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(draft, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
    const { project } = flows.claimDraft(draft, ada, ada);
    const id = project.id;
    initLayerContract(db); initSourceReviews(db); initLayerSource(db); initLayerFiles(db); initCodeRepository(db); initLayerRemotes(db);
    // The project's starter repository, as the GitHub step finds it.
    const workspace = flows.projectSetup(ada, id).workspacePath;
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, 'README.md'), '# Tool Share\n');
    commitWorkspace({ repository: workspace, profile: gitProfile, message: 'chore: start', name: 'Ada', email: 'ada@example.com' });

    // GitHub's API, through the integration's injected fetcher; installation tokens through an injected minter.
    let mint = async () => ({ token: 'ghs_installation-1', expiresAt: 'soon' });
    const fetcher = async url => {
      if (url.includes('login/oauth/access_token')) return response({ access_token: 'user-token' });
      if (url.endsWith('/user')) return response({ login: 'octo', id: 7 });
      if (url.includes('/user/installations')) return response({ installations: [{ id: 44, account: { login: 'octo', id: 7 }, target_type: 'User', repository_selection: 'all', permissions: { administration: 'write', contents: 'write' } }] });
      if (url.endsWith('/repos/octo/legacy')) return response({ owner: { login: 'octo' }, name: 'legacy', html_url: 'https://github.com/octo/legacy', clone_url: `http://127.0.0.1:${port}/octo/legacy.git`, default_branch: 'main', private: true });
      throw new Error(`Unexpected request ${url}`);
    };
    const integration = githubIntegration({ db, secrets: openSecretStore(root), config: vendorConfig, callbackUrl: 'https://portal.example/callback', setupUrl: 'https://portal.example/installed',
      fetcher, mintInstallationToken: (...args) => mint(...args) });
    const authorization = new URL(integration.startAuthorization(ada.id));
    await integration.callback({ code: 'code', state: authorization.searchParams.get('state') });

    const units = codeUnits({ db });
    const code = codeRepository({ db, units });
    const pool = library({ db, know });
    const work = [];
    const remotes = layerRemotes({ db, tokenFor: githubTokenFor(integration), onAdvance: projectId => code.refresh(projectId),
      onHeld: (projectId, key, change) => work.push(know.createWork(projectId, { layer: key, layerScoped: true, state: 'ready', title: `Review GitHub changes (${change.to.slice(0, 7)})` }, 'Aludel')),
      onDiverged: (projectId, key, change) => work.push(know.createWork(projectId, { layer: key, layerScoped: true, state: 'ready', title: `Bring this copy and GitHub back together (${change.remote.slice(0, 7)})` }, 'Aludel')) });
    const syncing = codeSync({ db, codeRepo: code, remotes });
    const importer = codeImport({ db, github: integration, importRoot: join(root, 'imports'), afterInstall: projectId => { code.seed(projectId, pool.outputEntries); code.refresh(projectId); },
      sync: async projectId => { const layer = syncing.connect(projectId); return layer ? remotes.sync(projectId, layer.key) : null; } });

    // ---- Import: check first (nothing changes), then confirm ----
    await assert.rejects(() => importer.preview(ada.id, id, { installationId: 44, name: 'missing' }), /Unexpected request|can't reach/);
    const check = await importer.preview(ada.id, id, { installationId: 44, name: 'legacy' });
    assert.equal(check.repository.owner, 'octo'); assert.equal(check.files, 3); assert.equal(check.existing, false);
    assert.ok(check.adds.includes('.aludel/layer.json') && check.adds.includes('.aludel/server/code-index.mjs'), 'the check lists the files Aludel would add');
    assert.equal(git(workspace, 'log', '-1', '--format=%s'), 'chore: start', 'checking changes nothing');
    const imported = await importer.confirm(ada.id, id, { installationId: 44, name: 'legacy' }, workspace);
    assert.deepEqual(imported.installed, ['platform']);
    assert.equal(imported.sync.state, 'in-sync');
    assert.equal(git(workspace, 'log', '--format=%s', '--reverse').split('\n')[0], 'Their app', 'the workspace is their repository');
    assert.ok(readdirSync(join(root, 'workspaces')).some(name => name.startsWith(`${id}.before-import-`)), 'the starter repository is moved aside, not deleted');
    assert.equal(git(bare, 'rev-parse', 'main'), git(workspace, 'rev-parse', 'main'), 'GitHub has .aludel/ and the starter docs');
    assert.ok(git(bare, 'ls-tree', '-r', '--name-only', 'main').split('\n').includes('.aludel/layer.json'));
    assert.ok(git(bare, 'ls-tree', '-r', '--name-only', 'main').split('\n').includes('docs/product/index.md'));
    assert.ok(units.snapshot(id).units.some(unit => unit.symbol === 'lend'), 'Code indexes code the scaffold never made');

    // ---- A Knowledge save, then pushed ----
    const docs = layerDocs({ db });
    const before = docs.read(id, ada.id, 'platform', '/README.md');
    const saved = docs.save(id, ada.id, 'platform', { path: '/README.md', content: '# Legacy tool share\n\nLend tools to neighbours.\n', base: before.commit });
    assert.equal((await syncing.sync(id)).remote.state, 'in-sync');
    assert.equal(git(bare, 'rev-parse', 'main'), saved.commit);

    // ---- Someone pushes on GitHub: picked up, and the code read again ----
    const other = join(root, 'other');
    git(root, 'clone', '-q', bare, other);
    writeFileSync(join(other, 'src/borrow.ts'), 'export function borrow(tool: string) { return `Borrowed ${tool}`; }\n');
    git(other, 'add', '-A'); git(other, 'commit', '-q', '-m', 'Borrowing'); git(other, 'push', '-q', 'origin', 'main');
    assert.equal((await syncing.sync(id)).remote.state, 'in-sync');
    assert.equal(git(workspace, 'rev-parse', 'main'), git(other, 'rev-parse', 'HEAD'));
    assert.ok(units.snapshot(id).units.some(unit => unit.symbol === 'borrow'), 'the new code is read');

    // ---- Both sides move: held as Work, nothing pushed ----
    const mine = docs.read(id, ada.id, 'platform', '/README.md');
    docs.save(id, ada.id, 'platform', { path: '/README.md', content: '# Legacy tool share\n\nLend and borrow.\n', base: mine.commit });
    writeFileSync(join(other, 'src/return.ts'), 'export function giveBack() { return 1; }\n');
    git(other, 'add', '-A'); git(other, 'commit', '-q', '-m', 'Returning'); git(other, 'push', '-q', 'origin', 'main');
    const split = await syncing.sync(id);
    assert.equal(split.remote.state, 'diverged');
    assert.equal(git(bare, 'rev-parse', 'main'), git(other, 'rev-parse', 'HEAD'), 'GitHub is left as it was');
    assert.ok(work.some(item => item.layer === 'platform' && /back together/.test(item.title)), 'divergence is Work in Code');

    // ---- Unavailable: an expired authorization, an uninstalled App ----
    mint = async () => { throw Object.assign(new Error('Bad credentials'), { status: 401 }); };
    assert.match((await syncing.sync(id)).remote.detail, /^expired: /);
    mint = async () => { throw Object.assign(new Error('Not Found'), { status: 404 }); };
    const gone = (await syncing.sync(id)).remote;
    assert.equal(gone.state, 'unavailable'); assert.match(gone.detail, /^uninstalled: /);

    // ---- Only installation tokens reached GitHub; no token is stored ----
    assert.equal(existsSync(marker), false, 'the person\'s credential helper is never used');
    assert.deepEqual([...new Set(readFileSync(join(github, 'seen.txt'), 'utf8').trim().split('\n'))], ['x-access-token:ghs_installation-1']);
    // Every database file Aludel wrote (the platform's and each project's), read as bytes.
    db.close();
    const databases = []; const walk = dir => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'workspaces' && entry.name !== 'github') walk(path); else if (/\.sqlite(-wal)?$/.test(entry.name)) databases.push(path); } };
    walk(root);
    assert.ok(databases.length >= 2, 'the platform database and the project\'s');
    for (const file of databases) assert.ok(!readFileSync(file).includes('ghs_installation'), `${file} holds no token`);
    assert.doesNotMatch(readFileSync(join(workspace, '.git', 'config'), 'utf8'), /ghs_|x-access-token/, 'the repository\'s remote holds no credential');
  } finally {
    server.kill();
    for (const [name, value] of [['MACHINE_DATA_DIR', old.dir], ['GIT_CONFIG_GLOBAL', old.config]]) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
