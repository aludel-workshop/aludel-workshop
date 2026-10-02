// T03-CODE (G-CODE): a layer whose repository belongs to something else. The package sits under `.aludel/`, installs into
// an existing repository as one commit, and declares which of the repository's own files are its output. Checked on a
// plain repository with a base-template layer, not on Code, so the contract is shown to be general.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerDocs } from '../server/layer-docs.mjs';
import { installLayerPackageInto, layerPackageForProject, layerPackageTaskContext, matchesGlob, packageAt, repositoryPaths } from '../server/layer-package.mjs';
import { initLayerSource } from '../server/layer-source.mjs';
import { createMarkdownDefinition } from '../server/layer-registry.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const portalRoot = new URL('..', import.meta.url).pathname;
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const identity = { GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'dev@example.com' };
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, ...identity } }).trim();

function withPlainRepository(run) {
  const data = mkdtempSync(join(tmpdir(), 'aludel-package-root-'));
  const old = { dir: process.env.MACHINE_DATA_DIR, on: process.env.MACHINE_LAYER_TEMPLATES_ENABLED };
  process.env.MACHINE_DATA_DIR = data; process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
  try {
    const db = openDatabase(join(data, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(data), workspaceRoot: join(data, 'w'), assetRoot: join(data, 'a'), createWorkspace: () => {}, know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const { token } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
    const { project } = flows.claimDraft(token, ada, ada);
    initLayerContract(db); initLayerSource(db);
    createMarkdownDefinition(db, ada.id, project.id, { name: 'Notes', template: 'base' });
    // Someone else's repository: an app with its own README, docs and source, made outside Aludel.
    const repo = join(data, 'app');
    mkdirSync(join(repo, 'src'), { recursive: true }); mkdirSync(join(repo, 'docs'));
    git(data, 'init', '-q', '-b', 'main', repo);
    writeFileSync(join(repo, 'README.md'), '# Tool Share\n');
    writeFileSync(join(repo, 'docs/setup.md'), '# Setup\n');
    writeFileSync(join(repo, 'src/app.ts'), 'export const app = 1;\n');
    git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'The app');
    run({ db, ada, id: project.id, repo, appCommit: git(repo, 'rev-parse', 'HEAD') });
  } finally {
    rmSync(data, { recursive: true, force: true });
    for (const [name, value] of [['MACHINE_DATA_DIR', old.dir], ['MACHINE_LAYER_TEMPLATES_ENABLED', old.on]]) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}

test('G-CODE: a layer installs into an existing repository under .aludel/ as one commit, and only on a clean tree', () => withPlainRepository(({ db, ada, id, repo, appCommit }) => {
  const forked = db.prepare("SELECT repository_path AS repo FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'notes'").get(id).repo;
  assert.notEqual(forked, repo);
  assert.throws(() => installLayerPackageInto(db, id, 'notes', repo, { template: 'base' }), /already has a repository/);
  writeFileSync(join(repo, 'src/app.ts'), 'export const app = 2;\n');
  assert.throws(() => installLayerPackageInto(db, id, 'notes', repo, { template: 'base', replace: true }), /uncommitted changes/);
  git(repo, 'checkout', '-q', '--', 'src/app.ts');
  writeFileSync(join(repo, 'scratch.txt'), 'untracked\n');
  assert.throws(() => installLayerPackageInto(db, id, 'notes', repo, { template: 'base', replace: true }), /uncommitted changes/);
  rmSync(join(repo, 'scratch.txt'));

  const pkg = installLayerPackageInto(db, id, 'notes', repo, { template: 'base', replace: true, author: ada.name });
  assert.equal(pkg.installed, true);
  assert.equal(pkg.root, '.aludel/');
  assert.equal(pkg.manifest.key, 'notes');
  const head = git(repo, 'rev-parse', 'HEAD');
  assert.equal(git(repo, 'rev-parse', 'HEAD^'), appCommit, 'one commit on top of the app');
  assert.deepEqual(git(repo, 'diff', '--name-only', appCommit, head).split('\n').every(path => path.startsWith('.aludel/')), true, 'the app\'s own files are untouched');
  assert.equal(JSON.parse(readFileSync(join(repo, '.aludel/layer.json'), 'utf8')).key, 'notes', 'the working tree has the package');
  assert.equal(git(repo, 'rev-parse', 'refs/aludel/template'), JSON.parse(readFileSync(join(portalRoot, 'config/layer-templates.json'), 'utf8')).templates.base.commit, 'template history is kept as a ref');
  assert.equal(git(repo, 'log', '--format=%an', '-1'), 'Ada');
  assert.equal(git(repo, 'status', '--porcelain'), '');
  // One binding claims the instance, on the app repository.
  const rows = db.prepare("SELECT repository_path AS repo, accepted_commit AS commit_ FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'notes'").all(id);
  assert.deepEqual(rows.map(row => ({ ...row })), [{ repo, commit_: head }]);
  assert.equal(layerPackageForProject(db, id, 'notes').root, '.aludel/');
  assert.match(layerPackageForProject(db, id, 'notes').charter, /\S/, 'the charter is read from under the package root');

  // Installing again binds what is there: no second commit.
  const again = installLayerPackageInto(db, id, 'notes', repo, { template: 'base' });
  assert.equal(again.installed, false);
  assert.equal(git(repo, 'rev-parse', 'HEAD'), head);

  // A run's task context names the package root, and the outputs copy sits under it.
  const context = layerPackageTaskContext(db, id, 'notes');
  assert.equal(context.root, '.aludel/');
  assert.ok(context.writable.includes('.aludel/knowledge/*.md'));
}));

test('G-CODE: Knowledge saves commit under the package root, and the package stays valid', () => withPlainRepository(({ db, ada, id, repo }) => {
  installLayerPackageInto(db, id, 'notes', repo, { template: 'base', replace: true });
  const docs = layerDocs({ db });
  const listed = docs.list(id, ada.id, 'notes');
  assert.equal(listed.docs[0].path, 'knowledge/charter.md');
  const before = docs.read(id, ada.id, 'notes', 'knowledge/charter.md');
  const saved = docs.save(id, ada.id, 'notes', { path: 'knowledge/charter.md', content: '# Notes\n\nWhat we keep about the app.\n', base: before.commit });
  assert.equal(saved.changed, true);
  assert.deepEqual(git(repo, 'diff', '--name-only', before.commit, saved.commit).split('\n'), ['.aludel/knowledge/charter.md']);
  assert.equal(docs.read(id, ada.id, 'notes', 'knowledge/charter.md').content, '# Notes\n\nWhat we keep about the app.');
  assert.equal(docs.history(id, ada.id, 'notes', 'knowledge/charter.md').versions[0].commit, saved.commit);
  assert.equal(packageAt(repo, saved.commit, 'notes').root, '.aludel/');
  assert.ok(!existsSync(join(repo, 'knowledge')), 'nothing is written at the app\'s root');
}));

test('G-CODE: a nested package declares which repository files are its output; secrets, Git and CI never are', () => {
  const manifest = root => ({ outputs: ['note'], files: { paths: [], kinds: ['note'], indexer: 'server/index.mjs', repository: ['src/**', '*.md', 'docs/'] } });
  const nested = repositoryPaths({ root: '.aludel/', manifest: manifest() });
  for (const path of ['src/app.ts', 'src/a/b.ts', 'README.md', 'docs/setup/x.md', '.aludel/knowledge/charter.md', '.aludel/server/rules.mjs', '.aludel/layer.json'])
    assert.ok(nested.writable(path), `${path} is writable`);
  for (const path of ['.env', 'src/.env.local', '.git/config', '.github/workflows/ci.yml', 'package.json', '.aludel/notes.txt', '../outside.md', '/etc/passwd', 'src/../.env'])
    assert.ok(!nested.writable(path), `${path} is not writable`);
  assert.deepEqual(['.aludel/layer.json', '.aludel/server/rules.mjs', '.aludel/ui/view.ts', 'src/server/x.mjs', 'server/x.mjs'].map(nested.authority), [true, true, true, false, false],
    'authority paths are the package\'s own, never the app\'s similarly named folders');
  assert.equal(nested.own('.aludel/knowledge/charter.md'), 'knowledge/charter.md');
  assert.equal(nested.own('src/app.ts'), null);
  // A package at the root owns its repository; `repository` adds nothing there.
  const flat = repositoryPaths({ root: '', manifest: manifest() });
  assert.ok(!flat.writable('src/app.ts'));
  assert.ok(flat.writable('knowledge/charter.md') && flat.authority('server/x.mjs'));
  assert.ok(matchesGlob('**', 'a/b/c') && !matchesGlob('src/*', 'src/a/b'));
});
