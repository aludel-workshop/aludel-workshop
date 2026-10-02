// T03-CODE: Code from its template. Its repository is the project's own; generation links and releases live in
// .aludel/outputs/, units are parsed by the host at the pin, and the host's code-link tables are a cache of them.
// Runs with templates on (npm run test:server:templates); the compiled Code layer is tested by lay-07 and code-layer.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { codeReleases, initCodeLayer } from '../server/code-layer.mjs';
import { codeLinks, initCodeLinks } from '../server/code-links.mjs';
import { codeRepository, initCodeRepository } from '../server/code-repository.mjs';
import { commitWorkspace } from '../server/git-repository.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initSourceReviews } from '../server/layer-api.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { currentFileEntries, initLayerFiles } from '../server/layer-files.mjs';
import { ensureProjectRepositoryLayers, layerPackageForProject } from '../server/layer-package.mjs';
import { initLayerSource } from '../server/layer-source.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { loadScaffoldSources, skeletonFiles, writeFiles } from '../server/scaffold.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const templates = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1';
const portalRoot = new URL('..', import.meta.url).pathname;
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const gitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(join(portalRoot, 'config', 'project-setup.json'), 'utf8')));
const sources = loadScaffoldSources(portalRoot);
const git = (cwd, ...args) => { const result = spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-code-template-'));
  process.env.MACHINE_DATA_DIR = root;
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initCodeLinks(db); initCodeLayer(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveFeatures(ada, project.id, { picks: ['accounts'] });
  initLayerContract(db); initSourceReviews(db); initLayerSource(db); initLayerFiles(db); initCodeRepository(db);
  const links = codeLinks({ db, know });
  const code = codeRepository({ db, know, links });
  know.onWorkDone(({ projectId, item }) => { const recordId = item.type === 'reconcile' && item.context?.reconcile?.recordId; if (recordId) code.relink(projectId, recordId); });
  const workspace = flows.projectSetup(ada, project.id).workspacePath;
  return { root, db, know, flows, links, code, ada, id: project.id, workspace };
}
// The aludel-web-v1 skeleton, committed as generateSkeleton does.
function generate({ know, flows, ada, id, workspace }, message = 'feat: generate skeleton') {
  const setup = { ...flows.projectSetup(ada, id), data: { objects: know.list(id, 'data_object'), operations: know.list(id, 'data_operation') }, agents: know.agentExport(id) };
  const { files, manifest } = skeletonFiles(setup, catalogs, gitProfile, { portal: 'http://aludel.localhost', app: 'http://tool-share.localhost' }, [], sources);
  writeFiles(workspace, files);
  const commit = commitWorkspace({ repository: workspace, profile: gitProfile, message, name: 'Ada', email: 'ada@example.com' });
  know.recordBuild(id, commit.commit, { auth: true });
  return { manifest, commit };
}
// The repository a new project starts with, before its first build (createWorkspace).
function start({ workspace }) {
  writeFiles(workspace, { 'README.md': '# Tool Share\n' });
  commitWorkspace({ repository: workspace, profile: gitProfile, message: 'chore: start', name: 'Ada', email: 'ada@example.com' });
}
const pick = (rows, fields) => rows.map(row => Object.fromEntries(fields.map(field => [field, row[field]])));

test('T03-CODE parity: an existing project adopts its Code links and releases into its repository unchanged', { skip: !templates }, () => {
  const context = fixture();
  const { db, know, links, code, ada, id, workspace } = context;
  // Before the template: the compiled path, with links and a release in host tables.
  const { manifest, commit } = generate(context);
  links.index(id, workspace);
  links.recordManifest(id, manifest, commit.commit);
  const story = know.list(id, 'story').find(entry => entry.number === 1);
  know.update(id, story.id, { why: 'Neighbours need to know who is borrowing' }, { rationale: 'From interviews' });
  const compiled = codeReleases({ db });
  compiled.record(id, workspace, know.list(id, 'story').map(entry => ({ ...entry, ref: `S${entry.number}` })), { version: '0.1.0', notes: 'First' }, 'Ada', [...links.builtBy(id).keys()]);
  db.prepare("UPDATE code_releases SET published_at = '2026-10-01T00:00:00.000Z', url = 'https://github.com/octo/tool-share/releases/tag/v0.1.0' WHERE project_id = ?").run(id);
  const before = {
    units: pick(db.prepare('SELECT * FROM code_units WHERE project_id = ? ORDER BY id').all(id), ['id', 'unit_key', 'kind', 'hash', 'line', 'end_line', 'reachable']),
    links: pick(db.prepare('SELECT * FROM trace_links WHERE project_id = ? ORDER BY id').all(id), ['id', 'record_id', 'record_revision', 'unit_id', 'kind', 'source', 'state', 'derived']),
    releases: pick(db.prepare('SELECT * FROM code_releases WHERE project_id = ?').all(id), ['id', 'version', 'commit_sha', 'notes', 'stories_json', 'created_by'])
  };
  assert.ok(before.links.some(link => link.source === 'manifest' && link.state === 'suspect'), 'the fixture has a suspect generation link');

  // The template: Code installs into the workspace as one commit, then adopts.
  assert.deepEqual(ensureProjectRepositoryLayers(db, id), ['platform']);
  const pkg = layerPackageForProject(db, id, 'platform');
  assert.equal(pkg.root, '.aludel/');
  assert.equal(pkg.repo, workspace, 'Code\'s repository is the project\'s own');
  assert.equal(git(workspace, 'rev-parse', 'HEAD^'), commit.commit, 'one install commit on top of the build');
  code.adopt(id);
  const files = currentFileEntries(db, id, 'platform');
  const fileLinks = files.filter(entry => entry.kind === 'trace_link');
  assert.deepEqual(fileLinks.map(entry => [entry.id, entry.data.record.ref, entry.data.record.revision, entry.data.unit]).sort(),
    before.links.filter(link => link.source === 'manifest').map(link => [link.id, link.record_id, link.record_revision, before.units.find(unit => unit.id === link.unit_id).unit_key]).sort(),
    'every generation link keeps its ID, record and pinned revision');
  const fileReleases = files.filter(entry => entry.kind === 'code_release');
  assert.deepEqual(fileReleases.map(entry => [entry.id, entry.data.version, entry.data.commit, entry.data.notes, JSON.stringify(entry.data.stories), entry.data.createdBy]),
    before.releases.map(row => [row.id, row.version, row.commit_sha, row.notes, row.stories_json, row.created_by]), 'every release keeps its ID, version and commit');
  assert.ok(git(workspace, 'show', 'HEAD:.aludel/outputs/trace-links.json').includes(fileLinks[0].id), 'the links are in the repository');
  // Units derived at the same commit match today's, with the same IDs; the cache matches what it was.
  const units = files.filter(entry => entry.kind === 'code_unit').map(entry => ({ id: entry.id, unit_key: entry.data.key, kind: entry.data.kind, hash: entry.data.hash, line: entry.data.line, end_line: entry.data.end, reachable: entry.data.reachable ? 1 : 0 }));
  assert.deepEqual(units.sort((a, b) => a.id.localeCompare(b.id)), before.units);
  assert.deepEqual(pick(db.prepare('SELECT * FROM trace_links WHERE project_id = ? ORDER BY id').all(id), ['id', 'record_id', 'record_revision', 'unit_id', 'kind', 'source', 'state', 'derived']), before.links);
  const release = code.releases(id)[0];
  assert.equal(release.url, 'https://github.com/octo/tool-share/releases/tag/v0.1.0', 'publication state carries over');
  assert.deepEqual(code.adopt(id), { adopted: 0 }, 'adoption runs once');
  assert.equal(git(workspace, 'status', '--porcelain'), '');
}, );

test('T03-CODE: a build writes Code\'s links into its repository; a changed story makes them suspect and Reconcile relinks them there', { skip: !templates }, () => {
  const context = fixture();
  const { db, know, code, ada, id, workspace } = context;
  start(context);
  ensureProjectRepositoryLayers(db, id);
  const { manifest, commit } = generate(context);
  assert.equal(code.settleLocal(id).moved, true, 'the pin follows the build');
  assert.deepEqual(code.recordManifest(id, manifest, commit.commit, 'Ada').missing, []);
  const fileLinks = () => currentFileEntries(db, id, 'platform').filter(entry => entry.kind === 'trace_link');
  assert.ok(fileLinks().length >= 8);
  assert.equal(git(workspace, 'log', '-1', '--format=%an %s'), 'Ada Code links from the build at ' + commit.commit.slice(0, 7));
  const story = know.list(id, 'story').find(entry => entry.number === 1);
  know.update(id, story.id, { why: 'Neighbours need to know who is borrowing' }, { rationale: 'From interviews' });
  const suspect = context.links.snapshot(id).units.filter(unit => unit.links.some(item => item.recordId === story.id && item.state === 'suspect'));
  assert.ok(suspect.some(unit => unit.symbol === 'POST /api/sign-up'));
  const reconcile = know.workList(id).filter(item => item.type === 'reconcile' && item.state !== 'done');
  assert.equal(reconcile.length, 1);
  know.updateWork(ada, id, reconcile[0].id, { state: 'done' });
  assert.ok(fileLinks().filter(entry => entry.data.record.ref === story.id).every(entry => entry.data.record.revision === 2), 'the file pins the new revision');
  assert.ok(context.links.snapshot(id).units.flatMap(unit => unit.links).filter(item => item.recordId === story.id).every(item => item.state === 'current'));
  // A second build keeps the pins, and adds nothing when nothing changed.
  const head = git(workspace, 'rev-parse', 'HEAD');
  const again = generate(context, 'feat: regenerate');
  code.settleLocal(id);
  code.recordManifest(id, again.manifest, again.commit.commit);
  assert.ok(fileLinks().filter(entry => entry.data.record.ref === story.id).every(entry => entry.data.record.revision === 2));
  assert.equal(git(workspace, 'rev-parse', 'HEAD'), head, 'an unchanged build makes no commit');
});

test('T03-CODE: releases are recorded in Code\'s repository with a tag, keeping the release rules', { skip: !templates }, () => {
  const context = fixture();
  const { db, know, code, links, id, workspace } = context;
  start(context);
  ensureProjectRepositoryLayers(db, id);
  const { manifest, commit } = generate(context);
  code.settleLocal(id); code.recordManifest(id, manifest, commit.commit);
  const stories = know.list(id, 'story').map(entry => ({ ...entry, ref: `S${entry.number}` }));
  const drafts = codeReleases({ db, releasesOf: projectId => code.releases(projectId) });
  const draft = () => drafts.draft(id, workspace, stories, [...links.builtBy(id).keys()]);
  assert.throws(() => code.recordRelease(id, draft(), { version: '1.2' }, 'Ada'), /^Error: Use a version like 1\.2\.3\.$/);
  const first = code.recordRelease(id, draft(), { version: 'v0.1.0', notes: 'First' }, 'Ada');
  assert.equal(first.version, '0.1.0');
  assert.ok(first.stories.length, 'the first release ships what is built');
  assert.equal(git(workspace, 'rev-parse', 'v0.1.0^{commit}'), git(workspace, 'rev-parse', `${first.commit}^{commit}`), 'a local tag marks its commit');
  assert.match(git(workspace, 'show', 'HEAD:.aludel/outputs/releases.json'), /"version": "0.1.0"/);
  assert.throws(() => code.recordRelease(id, draft(), { version: '0.2.0' }, 'Ada'), /Nothing has changed since v0\.1\.0\./);
  mkdirSync(join(workspace, 'db', 'migrations'), { recursive: true });
  writeFileSync(join(workspace, 'db', 'migrations', '009_loans.sql'), 'CREATE TABLE loans (id TEXT);\n');
  git(workspace, 'add', '-A'); git(workspace, 'commit', '-q', '-m', 'feat: loans');
  code.settleLocal(id);
  assert.throws(() => code.recordRelease(id, draft(), { version: '0.0.9' }, 'Ada'), /must be newer than v0\.1\.0/);
  assert.equal(draft().suggested, '0.2.0');
  const second = code.recordRelease(id, draft(), { version: '0.2.0' }, 'Ada');
  assert.deepEqual(second.migrations, ['db/migrations/009_loans.sql'], 'what changed is derived at the release\'s commit');
  assert.deepEqual(code.releases(id).map(release => release.version), ['0.2.0', '0.1.0']);
});

test('T03-CODE: starter docs come from the template\'s seed, once, matching what the compiled layer wrote', { skip: !templates }, async () => {
  const { library } = await import('../server/library.mjs');
  const { starterDocs, readStack } = await import('../server/code-layer.mjs');
  const context = fixture();
  const { db, know, code, id, workspace, root } = context;
  start(context);
  ensureProjectRepositoryLayers(db, id);
  const { manifest, commit } = generate(context);
  code.settleLocal(id); code.recordManifest(id, manifest, commit.commit);
  // The compiled layer's starter set for the same project, written into a copy of the workspace.
  const copy = join(root, 'compiled-copy');
  git(root, 'clone', '-q', workspace, copy);
  const stories = know.list(id, 'story').map(story => ({ ...story, ref: `S${story.number}` }));
  starterDocs(copy, { project: { name: 'Tool Share' }, stories, personas: know.list(id, 'persona'), objects: know.list(id, 'data_object'), operations: know.list(id, 'data_operation'),
    tokens: know.list(id, 'design_tokens')[0] || null, components: know.list(id, 'component'), stack: readStack(copy) });
  const pool = library({ db, know });
  const seeded = code.seed(id, pool.outputEntries);
  assert.ok(seeded.written.includes('ARCHITECTURE.md') && seeded.written.includes('docs/product/stories.md'));
  for (const path of ['docs/product/stories.md', 'docs/product/index.md', 'docs/data/api.md'])
    assert.equal(git(workspace, 'show', `HEAD:${path}`), readFileSync(join(copy, path), 'utf8').trim(), `${path} matches the compiled starter set`);
  const sidecar = JSON.parse(git(workspace, 'show', 'HEAD:docs/.aludel/sources.json'));
  const compiled = JSON.parse(readFileSync(join(copy, 'docs/.aludel/sources.json'), 'utf8'));
  assert.deepEqual(sidecar['docs/product/stories.md'], compiled['docs/product/stories.md'], 'sections cite the same entries at the same revisions');
  assert.equal(git(workspace, 'log', '-1', '--format=%an %s'), 'Aludel Starter docs for Code');
  assert.deepEqual(code.seed(id, pool.outputEntries).written, [], 'the install seed runs once');
});

test('T03-CODE: a coding run on Code\'s repository goes through the generic layer path; .env, CI and anything outside the writable set are refused', { skip: !templates }, async () => {
  const { commitLayerBranch, mergeLayerBranch, settleLayerCheckout } = await import('../server/layer-source.mjs');
  const context = fixture();
  const { db, code, id, workspace, root } = context;
  start(context);
  ensureProjectRepositoryLayers(db, id);
  const { manifest, commit } = generate(context);
  code.settleLocal(id); code.recordManifest(id, manifest, commit.commit);
  const base = git(workspace, 'rev-parse', 'main');
  // A local stand-in for the run's sandbox: the repository at the run's base, in layer/ of its workspace.
  const run = join(root, 'run');
  git(root, 'clone', '-q', workspace, join(run, 'layer'));
  const sandbox = join(run, 'layer');
  git(sandbox, 'config', 'user.email', 'agent@example.com'); git(sandbox, 'config', 'user.name', 'Agent');
  const attempt = (name, files) => {
    git(sandbox, 'reset', '-q', '--hard', base); git(sandbox, 'clean', '-qfdx');
    for (const [path, body] of Object.entries(files)) { mkdirSync(join(sandbox, path, '..'), { recursive: true }); writeFileSync(join(sandbox, path), body); }
    return () => commitLayerBranch(db, { projectId: id, key: 'platform', attemptId: `att-${name}-0000000000`, workspace: run, base, workRef: 'W-7', message: name });
  };
  // The app ignores .env files, so one never reaches the branch; an agent that also un-ignores it is refused by the host.
  const ignored = attempt('ignored', { 'src/app.ts': git(workspace, 'show', 'main:src/app.ts') + '\n// ignored env\n', '.env.local': 'SECRET=1\n' })();
  assert.deepEqual(ignored.files.map(file => file.path), ['src/app.ts'], 'an ignored .env file is not committed');
  assert.throws(attempt('env', { '.gitignore': 'node_modules/\n', '.env.local': 'SECRET=1\n' }), /may not change \.env\.local/);
  assert.throws(attempt('ci', { '.github/workflows/ci.yml': 'name: ci\n' }), /may not change \.github\/workflows\/ci\.yml/);
  assert.throws(attempt('outside', { '.aludel/notes.txt': 'x\n' }), /may not change \.aludel\/notes\.txt/);
  const branch = attempt('ok', { 'src/app.ts': git(workspace, 'show', 'main:src/app.ts') + '\n// a reviewed change\n', '.aludel/knowledge/units.md': '# Code units\n\nRevised.\n' })();
  assert.deepEqual(branch.files.map(file => [file.path, file.ownerReview]).sort(), [['.aludel/knowledge/units.md', false], ['src/app.ts', false]]);
  const handler = attempt('handler', { '.aludel/server/code-index.mjs': git(workspace, 'show', 'main:.aludel/server/code-index.mjs') + '\n// changed\n' })();
  assert.deepEqual(handler.files.map(file => [file.path, file.ownerReview]), [['.aludel/server/code-index.mjs', true]], 'what runs on the host is marked for review');
  // Accepting merges into main, and the pin moves with it.
  const merged = mergeLayerBranch(db, { projectId: id, key: 'platform', source: branch, reviewer: 'Ada', workId: 'w-1', workRef: 'W-7', catalogs, recordsOf: () => [] });
  settleLayerCheckout(merged);
  assert.equal(git(workspace, 'rev-parse', 'main'), merged.commit);
  assert.match(readFileSync(join(workspace, 'src/app.ts'), 'utf8'), /a reviewed change/);
  assert.equal(db.prepare("SELECT accepted_commit AS c FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'platform'").get(id).c, merged.commit);
});
