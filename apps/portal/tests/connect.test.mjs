// EX-02A: connecting an existing repository. Where the code is (detection, counting, the paths a person may choose), the
// GitHub addresses a portal may be pointed at, the connect draft and the project it becomes, and the indexing limits that
// let a real app's code through. The whole path in a browser against a fake GitHub is tests/connect-browser.mjs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { countReads, detectCodeFolders } from '../server/code-detect.mjs';
import { loadGitHubVendorConfig } from '../server/github-vendor-config.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { indexLimits, runPure } from '../server/layer-api.mjs';
import { unitGlobs } from '../server/layer-package.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { treeAt } from '../server/source-units.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Dev', '-c', 'user.email=dev@example.com', ...args], { cwd, encoding: 'utf8' }).trim();
function repository(files) {
  const root = mkdtempSync(join(tmpdir(), 'aludel-detect-'));
  git(root, 'init', '-q', '-b', 'main');
  for (const [path, text] of Object.entries(files)) { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); }
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'start');
  return root;
}

test('where the code is: folders with an app manifest are offered, the one Code would read most of is suggested, nothing is assumed', () => {
  const mono = repository({
    'README.md': '#\n', 'docs/a.md': '#\n',
    'apps/web/package.json': JSON.stringify({ dependencies: { '@angular/core': '1' } }), 'apps/web/src/a.ts': 'export const a = 1;\n', 'apps/web/src/b.ts': 'export const b = 1;\n', 'apps/web/tests/a.test.mjs': '1;\n',
    'apps/web/node_modules/x/package.json': '{}',
    'tools/cli/package.json': '{}', 'tools/cli/index.mjs': 'export const x = 1;\n',
    'api/pyproject.toml': '[project]\n', 'api/app/main.py': 'print(1)\n'
  });
  const single = repository({ 'package.json': '{}', 'src/main.ts': 'export const m = 1;\n', 'server/app.mjs': 'export const s = 1;\n' });
  const python = repository({ 'pyproject.toml': '[project]\n', 'app/main.py': 'print(1)\n' });
  const existing = repository({ '.aludel/layer.json': JSON.stringify({ files: { units: ['web/**'] } }), 'web/a.ts': 'export const a = 1;\n' });
  try {
    const found = detectCodeFolders(mono, 'HEAD');
    assert.equal(found.existing, null);
    assert.deepEqual(found.folders.map(folder => folder.path), ['', 'api', 'apps/web', 'tools/cli'], 'the root first, then each folder with a manifest; vendored packages are skipped');
    const web = found.folders.find(folder => folder.path === 'apps/web');
    assert.deepEqual([web.globs, web.reads, web.stack, web.suggested], [['apps/web/src/**', 'apps/web/tests/**'], 3, ['Node', 'Angular'], true]);
    assert.deepEqual(found.folders.find(folder => folder.path === 'tools/cli').globs, ['tools/cli/**'], 'a folder without conventional source folders reads all of itself');
    assert.equal(found.folders.find(folder => folder.path === 'api').reads, 0, 'Python isn\'t read yet; the check says so rather than showing an empty Code');
    assert.equal(found.folders.filter(folder => folder.suggested).length, 1);
    const one = detectCodeFolders(single, 'HEAD');
    assert.deepEqual(one.folders.map(folder => [folder.path, folder.globs, folder.reads, folder.suggested]), [['', ['src/**', 'server/**'], 2, true]]);
    assert.equal(detectCodeFolders(python, 'HEAD').folders[0].suggested, true, 'with nothing Code reads, the root is still the suggestion');
    const has = detectCodeFolders(existing, 'HEAD');
    assert.deepEqual(has.existing, { units: ['web/**'] });
    assert.ok(has.folders.every(folder => !folder.suggested), 'a repository with .aludel/ says where its code is itself');
    assert.deepEqual(countReads(treeAt(mono, 'HEAD'), ['**']), { reads: 4, limit: 2000, over: false });
  } finally { for (const root of [mono, single, python, existing]) rmSync(root, { recursive: true, force: true }); }
});

test('the code paths a person may choose stay inside the repository and away from secrets', () => {
  assert.deepEqual(unitGlobs(['apps/web/src/**', ' apps/web/src/** ', 'lib/*.ts']), ['apps/web/src/**', 'lib/*.ts']);
  for (const bad of [[], ['/etc/**'], ['../x/**'], ['a/../b'], ['.git/**'], ['x/.aludel/**'], ['.env'], ['src/**;rm'], Array(21).fill('a/**')])
    assert.throws(() => unitGlobs(bad), /code path/i, JSON.stringify(bad).slice(0, 40));
});

test('GitHub\'s addresses can point at an Enterprise Server or a local fake, never at plain http elsewhere', () => {
  const base = { MACHINE_GITHUB_APP_ID: '1', MACHINE_GITHUB_APP_SLUG: 'a', MACHINE_GITHUB_CLIENT_ID: 'Iv1234567890', MACHINE_GITHUB_CLIENT_SECRET: 'x'.repeat(24) };
  const read = env => loadGitHubVendorConfig({ ...base, ...env }, () => { throw new Error('no key'); }, {});
  assert.deepEqual([read({}).apiUrl, read({}).webUrl], ['https://api.github.com', 'https://github.com']);
  assert.deepEqual([read({ MACHINE_GITHUB_API_URL: 'https://ghe.example/api/v3/', MACHINE_GITHUB_WEB_URL: 'https://ghe.example' }).apiUrl], ['https://ghe.example/api/v3']);
  assert.equal(read({ MACHINE_GITHUB_API_URL: 'http://127.0.0.1:9/api' }).apiUrl, 'http://127.0.0.1:9/api');
  const insecure = read({ MACHINE_GITHUB_API_URL: 'http://ghe.example/api' });
  assert.equal(insecure.apiUrl, 'https://api.github.com');
  assert.ok(insecure.issues.some(issue => /MACHINE_GITHUB_API_URL/.test(issue)));
});

test('a connect draft becomes a project only when the person connects: no pitch, no scaffold, Code always on', () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-connect-draft-'));
  try {
    const db = openDatabase(join(root, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
    const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const scaffolded = [];
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: setup => scaffolded.push(setup.project.id), know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const { token } = flows.saveDraft(null, { start: 'connect' });
    assert.throws(() => flows.saveDraft(token, { start: 'import' }), /Start a new app or connect/);
    assert.throws(() => flows.createConnected(token, ada, { name: 'Tool Share' }), /how you want to work/);
    flows.saveDraft(token, { profile: 'planner', connect: { installationId: 44, owner: 'octo', name: 'tool-share' } });
    flows.saveDraft(token, { connect: { paths: ['apps/web/src/**'] } });
    assert.deepEqual(flows.getDraft(token).connect, { installationId: 44, owner: 'octo', name: 'tool-share', paths: ['apps/web/src/**'] }, 'choices merge, and survive the sign-in round trip');
    assert.throws(() => flows.saveDraft(token, { connect: { name: '../evil' } }), /valid GitHub repository/);
    flows.saveDraft(token, { layers: ['product'] });
    assert.throws(() => flows.createConnected(token, ada, { name: 'Tool Share' }), /needs the Code layer/);
    flows.saveDraft(token, { layers: ['platform', 'product'] });
    assert.equal(flows.connectDraft(token).key.startsWith('draft-'), true);
    assert.throws(() => flows.createConnected(token, ada, { name: ' ' }), /Give the project a name/);
    const setup = flows.createConnected(token, ada, { name: 'Tool Share', description: 'Lend tools.' });
    assert.equal(setup.project.name, 'Tool Share'); assert.equal(setup.project.description, 'Lend tools.');
    assert.deepEqual(scaffolded, [], 'no starter app is generated for a connected repository');
    assert.equal(setup.direction, null, 'no pitch is invented');
    assert.deepEqual(db.prepare('SELECT layer_key FROM layer_instances WHERE project_id = ? AND enabled = 1 ORDER BY layer_key').all(setup.project.id).map(row => row.layer_key), ['platform', 'product']);
    assert.throws(() => flows.createConnected(token, ada, { name: 'Again' }), /Start again/, 'once per draft');
    const fresh = flows.saveDraft(null, { start: 'new', profile: 'planner' }).token;
    assert.throws(() => flows.connectDraft(fresh), /starts a new app/);
    db.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('indexing gets larger, still bounded sandbox limits than an API handler', () => {
  const source = 'export function entries(files, { units }) { return units.map(unit => ({ id: unit, kind: "code_unit", title: unit, data: { pad: "x".repeat(400) } })); }';
  const units = Array.from({ length: 2500 }, (_, index) => `cu-${String(index).padStart(12, '0')}`);
  assert.throws(() => runPure(source, 'entries', [{}, { units }]), /did not finish within its limits/, 'an API handler\'s 1 MB output limit');
  assert.equal(runPure(source, 'entries', [{}, { units }], indexLimits).length, 2500);
  assert.throws(() => runPure(source, 'entries', [{}, { units: Array(20).fill('y'.repeat(1048576)) }], indexLimits), /too large/, 'still bounded');
});
