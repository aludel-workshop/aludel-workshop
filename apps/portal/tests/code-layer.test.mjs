// PLATFORM-UX-01: the Code layer reads the repository (files, stack, docs, releases); Deploy gets the Operator role.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { codeReleases, initCodeLayer, readDocs, readSource, readStack, readVariables, sidecarPath, starterDocs } from '../server/code-layer.mjs';
import { initCodeLinks } from '../server/code-links.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const git = (cwd, ...args) => { const result = spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'aludel-code-'));
  git(root, 'init', '-q', '-b', 'main'); git(root, 'config', 'user.email', 'test@example.com'); git(root, 'config', 'user.name', 'Test');
  commit(root, files, 'chore: start');
  return root;
}
function commit(root, files, message) {
  for (const [path, body] of Object.entries(files)) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); }
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', message);
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-code-db-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initCodeLinks(db); initCodeLayer(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveFeatures(ada, project.id, { picks: ['accounts'] });
  return { db, know, ada, project, id: project.id };
}
const pkg = deps => JSON.stringify({ name: 'tool-share', version: '0.1.0', engines: { node: '^24' }, dependencies: deps, devDependencies: { vite: '8.3.0' } });

test('source is read only for tracked text files inside the workspace; .env never', () => {
  const root = repo({ 'server/app.mjs': 'export const x = 1;\n', '.env.example': '# Port.\nPORT=3000\n# SMTP password. Secret.\nSMTP_PASSWORD=\n', 'package.json': pkg({ rxjs: '7.8.2' }), Dockerfile: 'FROM node:24-bookworm-slim\nHEALTHCHECK CMD true\n' });
  writeFileSync(join(root, '.env'), 'SMTP_PASSWORD=hunter2\n');
  writeFileSync(join(root, 'untracked.mjs'), 'nope');
  assert.equal(readSource(root, 'server/app.mjs').text, 'export const x = 1;\n');
  for (const path of ['.env', 'untracked.mjs', '../etc/passwd', '', '/server/../../x']) assert.throws(() => readSource(root, path), error => error.status === 404, path);
  const stack = readStack(root);
  assert.deepEqual(stack.dependencies, [{ name: 'rxjs', version: '7.8.2', dev: false }]);
  assert.deepEqual(stack.images, ['node:24-bookworm-slim']);
  assert.equal(stack.healthcheck, true);
  const { variables } = readVariables(root);
  assert.deepEqual(variables.map(variable => [variable.name, variable.value, variable.secret]), [['PORT', '3000', false], ['SMTP_PASSWORD', '', true]]);
  assert.equal(variables[0].description, 'Port.');
});

test('starter docs never overwrite a developer\'s file; the sidecar marks sections whose sources changed', () => {
  const { know, id, project } = fixture();
  const root = repo({ 'AGENTS.md': '# Tool Share\n\nWork on one story at a time.\n', 'docs/product/index.md': '# Ours\n\nWritten by a developer.\n', 'src/app.ts': 'export {}\n', 'package.json': pkg({}) });
  const stories = know.list(id, 'story').map(story => ({ ...story, ref: `S${story.number}` }));
  const { written } = starterDocs(root, { project, stories, personas: know.list(id, 'persona'), objects: know.list(id, 'data_object'), operations: know.list(id, 'data_operation'), tokens: null, components: [], stack: readStack(root) });
  assert.ok(written.includes('docs/product/stories.md') && written.includes('ARCHITECTURE.md'));
  assert.ok(!written.includes('docs/product/index.md'), 'an existing doc is left alone');
  assert.equal(readFileSync(join(root, 'docs/product/index.md'), 'utf8'), '# Ours\n\nWritten by a developer.\n');
  assert.match(readFileSync(join(root, 'AGENTS.md'), 'utf8'), /Work on one story at a time\.[\s\S]*## Where to look/, 'AGENTS.md keeps its text and gains the map');
  const sidecar = JSON.parse(readFileSync(join(root, sidecarPath), 'utf8'));
  assert.ok(!sidecar['docs/product/index.md'], 'no provenance is invented for a developer\'s own doc');
  const revisionOf = recordId => know.get(id, recordId)?.revision;
  let view = readDocs(root, revisionOf);
  assert.equal(view.checks.refresh, 0);
  assert.deepEqual(view.checks.offMap, [], 'every doc is reachable from AGENTS.md');
  const story = stories[0];
  const section = view.docs.find(doc => doc.path === 'docs/product/stories.md').sections.find(entry => entry.heading === `${story.ref} ${story.title}`);
  assert.equal(section.state, 'current');
  know.update(id, story.id, { why: 'A new reason' }, { rationale: 'Changed' });
  view = readDocs(root, revisionOf);
  const after = view.docs.find(doc => doc.path === 'docs/product/stories.md').sections.find(entry => entry.heading === `${story.ref} ${story.title}`);
  assert.equal(after.state, 'refresh');
  assert.deepEqual(after.sources.map(source => [source.id, source.revision, source.current]), [[story.id, story.revision, story.revision + 1]]);
  writeFileSync(join(root, 'docs/extra.md'), '# Extra\n\n[missing](nowhere.md) and [ok](../AGENTS.md)\n');
  view = readDocs(root, revisionOf);
  assert.deepEqual(view.checks.offMap, ['docs/extra.md']);
  assert.deepEqual(view.checks.broken, ['docs/extra.md → nowhere.md']);
});

test('releases are explicit: the draft names commits, stories from trailers, stack changes and new migrations', () => {
  const { db, know, id } = fixture();
  const releases = codeReleases({ db });
  const stories = know.list(id, 'story').map(story => ({ ...story, ref: `S${story.number}` }));
  const root = repo({ 'package.json': pkg({ rxjs: '7.8.1' }) });
  let draft = releases.draft(id, root, stories, [stories[1].id]);
  assert.equal(draft.suggested, '0.1.0');
  assert.deepEqual(draft.stories, [stories[1].id], 'the first release ships what is built so far');
  assert.deepEqual(draft.changes, [], 'and has no stack to compare with');
  const first = releases.record(id, root, stories, { version: 'v0.1.0', notes: 'First.' }, 'Ada');
  assert.equal(first.version, '0.1.0');
  assert.throws(() => releases.record(id, root, stories, { version: '0.2.0' }, 'Ada'), /Nothing has changed/);
  commit(root, { 'package.json': pkg({ rxjs: '7.8.2' }), 'db/migrations/0002_tools.sql': 'CREATE TABLE tools (id TEXT);\n' }, `feat: tools\n\nAludel-Work: W-3\nImplements: ${stories[0].ref}`);
  draft = releases.draft(id, root, stories);
  assert.deepEqual(draft.since, { version: '0.1.0', commit: first.commit });
  assert.deepEqual(draft.stories, [stories[0].id]);
  assert.deepEqual(draft.changes, [{ name: 'rxjs', from: '7.8.1', to: '7.8.2' }]);
  assert.deepEqual(draft.migrations, ['db/migrations/0002_tools.sql']);
  assert.equal(draft.suggested, '0.2.0', 'a new story raises the minor version');
  assert.throws(() => releases.record(id, root, stories, { version: '0.1.0' }, 'Ada'), /newer than v0.1.0/);
  assert.throws(() => releases.record(id, root, stories, { version: 'next' }, 'Ada'), /like 1.2.3/);
  const second = releases.record(id, root, stories, { version: '0.2.0', notes: 'Tools.' }, 'Ada');
  assert.equal(second.publishedAt, null, 'recording is local; publishing to GitHub is a separate, authorized step');
  assert.deepEqual(releases.list(id).map(release => release.version), ['0.2.0', '0.1.0']);
});

test('Deploy has the Operator role; an older project\'s configure action and its open work move there', () => {
  const { db, know, id } = fixture();
  const roles = know.roleView(id);
  assert.deepEqual(roles.find(role => role.layer === 'deploy').actions.map(action => action.id), ['deploy.configure', 'deploy.promote', 'deploy.rollback', 'deploy.review']);
  assert.ok(roles.find(role => role.layer === 'platform').actions.some(action => action.id === 'platform.docs'));
  // Make it look like a project from before the split.
  const engineer = know.list(id, 'role').find(role => role.layer === 'platform');
  const configure = know.list(id, 'work_action').find(action => action.key === 'deploy.configure');
  db.prepare("UPDATE knowledge_records SET data_json = json_set(data_json, '$.key', 'platform.configure'), parent_id = ? WHERE id = ?").run(engineer.id, configure.id);
  const item = know.createWork(id, { layer: 'deploy', type: 'configure', title: 'Choose an email provider', targets: [] });
  db.prepare("UPDATE layer_work_items SET action = 'platform.configure', layer = 'platform' WHERE id = ?").run(item.id);
  know.ensureRoles(id);
  const moved = know.list(id, 'work_action').filter(action => action.key.endsWith('.configure'));
  assert.equal(moved.length, 1);
  assert.equal(moved[0].id, configure.id, 'the same record, with its assignee and history');
  assert.equal(moved[0].key, 'deploy.configure');
  assert.equal(moved[0].parentId, know.list(id, 'role').find(role => role.layer === 'deploy').id);
  assert.deepEqual({ ...db.prepare('SELECT action, layer FROM layer_work_items WHERE id = ?').get(item.id) }, { action: 'deploy.configure', layer: 'deploy' });
});

test('with the scaffold\'s map already in AGENTS.md, a starter set adds its docs to that list', () => {
  const { know, id, project } = fixture();
  const root = repo({ 'AGENTS.md': '# Tool Share\n\nIntro.\n\n## Where to look\n\n- `README.md`: what it is\n\n## Run it\n\n- `npm test`\n', 'src/app.ts': 'export {}\n', 'package.json': pkg({}) });
  starterDocs(root, { project, stories: [], personas: [], objects: know.list(id, 'data_object'), operations: [], tokens: null, components: [], stack: readStack(root) });
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.equal(agents.match(/## Where to look/g).length, 1, 'one map');
  assert.match(agents, /- `README.md`: what it is\n- `ARCHITECTURE.md`: the parts, the stack and the data\n[\s\S]*## Run it/, 'new docs join the list, before the next section');
  assert.deepEqual(readDocs(root, recordId => know.get(id, recordId)?.revision).checks.offMap, []);
});
