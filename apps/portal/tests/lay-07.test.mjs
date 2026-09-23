// LAY-07 (DEC-038): Data layer, Platform operations, Work › Agents and code links, at the domain layer.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { codeLinks, extractUnits, indexWorkspace, initCodeLinks } from '../server/code-links.mjs';
import { commitWorkspace } from '../server/git-repository.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPlatformOps, platformOps } from '../server/platform-ops.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { agentsGuide, loadScaffoldSources, skeletonFiles, writeFiles } from '../server/scaffold.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const portalRoot = new URL('..', import.meta.url).pathname;
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const gitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(join(portalRoot, 'config', 'project-setup.json'), 'utf8')));
const sources = loadScaffoldSources(portalRoot);
const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

function fixture({ picks = ['accounts', 'messaging'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aludel-lay07-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initCodeLinks(db); initPlatformOps(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const links = codeLinks({ db, know });
  const ops = platformOps({ db, backupRoot: join(root, 'backups') });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveFeatures(ada, project.id, { picks });
  return { root, db, know, flows, links, ops, ada, id: project.id };
}

// Generates the aludel-web-v1 skeleton for the project into a real git workspace, as generateSkeleton does.
function build({ know, flows, links, ada, id, root }) {
  const setup = { ...flows.projectSetup(ada, id), data: { objects: know.list(id, 'data_object'), operations: know.list(id, 'data_operation') }, agents: know.agentExport(id) };
  const workspace = join(root, 'workspaces', id);
  const { files, manifest } = skeletonFiles(setup, catalogs, gitProfile, { portal: 'http://aludel.localhost', app: 'http://tool-share.localhost' }, [], sources);
  writeFiles(workspace, files);
  const commit = commitWorkspace({ repository: workspace, profile: gitProfile, message: 'feat: generate skeleton', name: 'Ada', email: 'ada@example.com' });
  know.recordBuild(id, commit.commit, { auth: true });
  links.index(id, workspace);
  return { workspace, manifest, commit, result: links.recordManifest(id, manifest, commit.commit) };
}

test('LAY-07A: the Accounts pack seeds exactly the contract aludel-web-v1 generates, accepted', () => {
  const { know, ada, id } = fixture();
  const view = know.view(ada, id);
  const account = view.objects.find(object => object.name === 'Account');
  const session = view.objects.find(object => object.name === 'Session');
  assert.deepEqual(Object.keys(account.schema.properties), ['email', 'name']);
  assert.deepEqual(account.schema.required, ['email', 'name']);
  assert.equal(session.relations[0].target, account.id, 'relations point at objects by id');
  assert.deepEqual(view.operations.filter(op => op.pack === 'Accounts').map(op => op.operationId).sort(), ['getSession', 'health', 'signIn', 'signOut', 'signUp']);
  assert.ok(view.operations.filter(op => op.pack === 'Accounts').every(op => op.contract === 'accepted' && op.status === 'contracted'), 'template contracts are accepted, not yet built');
  assert.equal(view.operations.find(op => op.operationId === 'getSession').response.schema.properties.account.$ref, account.id, 'pack $refs resolve to object ids');
  assert.ok(view.objects.filter(object => object.pack === 'Messaging').every(object => object.status === 'proposed'), 'other packs’ objects are proposed');
  const signUpStory = view.stories.find(story => story.title.startsWith('Someone can sign up'));
  assert.deepEqual(view.operations.find(op => op.operationId === 'signUp').stories, [signUpStory.id]);
  assert.ok(view.access.length >= 5 && view.access.every(rule => rule.sentence));
  assert.deepEqual(view.services.find(service => service.key === 'email').stories, [view.stories.find(story => story.title.includes('reset a forgotten password')).id]);
});

test('LAY-07A: Data validators are structural and references must exist in the project', () => {
  const { know, id } = fixture();
  const account = know.list(id, 'data_object').find(object => object.name === 'Account');
  assert.throws(() => know.insert(id, 'data_object', { name: 'tool', schema: {} }), /Object name/);
  assert.throws(() => know.insert(id, 'data_object', { name: 'Tool', schema: { properties: { name: { type: 'text' } } } }), /type/);
  assert.throws(() => know.insert(id, 'data_object', { name: 'Tool', schema: { properties: { name: { type: 'string' } }, required: ['owner'] } }), /required but is not a field/);
  assert.throws(() => know.insert(id, 'data_object', { name: 'Tool', relations: [{ name: 'lender', target: 'obj-00000000', cardinality: 'one' }] }), error => error.status === 404);
  const tool = know.insert(id, 'data_object', { name: 'Tool', schema: { properties: { name: { type: 'string', maxLength: 80 } }, required: ['name'] }, relations: [{ name: 'lender', target: account.id, cardinality: 'one', owner: true }] });
  assert.equal(tool.contract, 'proposed');
  assert.throws(() => know.insert(id, 'data_operation', { operationId: 'ListTools', summary: 'x', method: 'GET', path: '/tools' }), /operationId/);
  assert.throws(() => know.insert(id, 'data_operation', { operationId: 'listTools', summary: 'x', method: 'FETCH', path: '/tools' }), /method/);
  assert.throws(() => know.insert(id, 'data_operation', { operationId: 'listTools', summary: 'x', method: 'GET', path: 'tools' }), /Path/);
  const op = know.insert(id, 'data_operation', { operationId: 'listTools', summary: 'Tools near me', method: 'GET', path: '/tools', objectId: tool.id,
    parameters: [{ name: 'near', in: 'query', schema: { type: 'string' } }], response: { status: '200', description: 'Tools', schema: { type: 'array', items: { $ref: tool.id } } } });
  assert.throws(() => know.insert(id, 'access_rule', { role: 'member', objectId: tool.id, action: 'read', effect: 'maybe', sentence: 'x' }), /allows/);
  know.insert(id, 'access_rule', { role: 'member', objectId: tool.id, action: 'read', effect: 'allow', sentence: 'Members see tools near them.' });
  assert.deepEqual(know.referrers(id, tool.id).sort(), ['Members see tools near them.', 'listTools']);
  const doc = know.openApi(id, { title: 'Tool Share' });
  assert.equal(doc.openapi, '3.1.0');
  assert.equal(doc.jsonSchemaDialect, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(doc.paths['/api/sign-up'].post.operationId, 'signUp');
  assert.deepEqual(doc.paths['/api/sign-up'].post.requestBody.content['application/json'].schema.required, ['email', 'name', 'password']);
  assert.equal(doc.paths['/tools'].get.responses['200'].content['application/json'].schema.items.$ref, '#/components/schemas/Tool');
  assert.equal(doc.components.schemas.Tool['x-aludel-relations'][0].target, '#/components/schemas/Account');
  assert.equal(doc.paths['/api/sign-in'].post.responses['401'].description, 'That email and password do not match');
  assert.equal(op.status, undefined, 'status is derived in the view, never stored');
});

test('LAY-07A: unselecting a pack removes its untouched Data records only', () => {
  const { know, flows, ada, id } = fixture();
  const conversation = know.list(id, 'data_object').find(object => object.name === 'Conversation');
  know.update(id, conversation.id, { description: 'Two neighbours talking about one tool.' }, { rationale: 'Our words' });
  flows.saveFeatures(ada, id, { picks: ['accounts'] });
  const names = know.list(id, 'data_object').map(object => object.name).sort();
  assert.deepEqual(names, ['Account', 'Conversation', 'Session'], 'the edited Conversation stays; the untouched Message goes');
});

test('LAY-07C: default profiles route every work type once; assigning an agent pins the profile and instruction revisions', () => {
  const { know, ada, id } = fixture();
  const profiles = know.list(id, 'agent_profile');
  assert.deepEqual(profiles.map(profile => profile.name), ['Product lead', 'Design lead', 'Architect', 'Coding agent', 'Reviewer']);
  assert.ok(profiles.every(profile => profile.budget === 0 && profile.accountId === 'project-agent'));
  const routed = profiles.flatMap(profile => profile.workTypes).sort();
  assert.deepEqual(routed, [...new Set(routed)], 'no work type goes to two profiles');
  assert.ok(know.list(id, 'project_instructions')[0].body.includes('principles'));
  assert.throws(() => know.insert(id, 'agent_profile', { name: 'Spender', budget: -1 }), /zero or more/);
  assert.throws(() => know.insert(id, 'agent_profile', { name: 'Odd', workTypes: ['dance'] }), /Unknown work type/);

  const reviewer = profiles.find(profile => profile.name === 'Reviewer');
  know.routeWorkType(id, 'design', reviewer.id, 'Ada');
  const after = know.list(id, 'agent_profile');
  assert.ok(!after.find(profile => profile.name === 'Design lead').workTypes.includes('design'));
  assert.ok(after.find(profile => profile.name === 'Reviewer').workTypes.includes('design'));
  assert.equal(know.history(reviewer.id)[0].rationale, 'Takes design work');

  const story = know.list(id, 'story').find(entry => entry.title.startsWith('Someone can start a conversation'));
  const work = know.createWork(id, { layer: 'product', type: 'define', title: 'Write acceptance', targets: [{ id: story.id, label: story.title }], documents: ['Product › story'] });
  const assigned = know.updateWork(ada, id, work.id, { assignee: { kind: 'agent' } });
  const productLead = after.find(profile => profile.name === 'Product lead');
  assert.equal(assigned.profileId, productLead.id, 'working style picks the profile for the work type');
  assert.equal(assigned.assignee.label, 'Product lead');
  assert.deepEqual(assigned.instructions.role, { id: productLead.id, revision: productLead.revision });
  assert.equal(assigned.instructions.project.revision, 1);
  assert.equal(assigned.instructions.guidance, 'define');
  const person = know.updateWork(ada, id, work.id, { assignee: { kind: 'person' } });
  assert.equal(person.profileId, null);

  const guide = agentsGuide({ ...{ project: { name: 'Tool Share' }, profile: 'planner', preferences: {}, stack: { preset: 'aludel-web-v1' } }, agents: know.agentExport(id) }, catalogs);
  assert.match(guide, /## Project instructions/);
  assert.match(guide, /### Coding agent/);
  assert.match(guide, /Aludel-Work: W-12/);
});

test('LAY-07D: the index reads units, references and reachability from a generated skeleton', () => {
  const context = fixture();
  const { workspace, result, manifest } = build(context);
  assert.deepEqual(result.missing, [], 'every manifest entry matches a unit the index found');
  assert.deepEqual(manifest.filter(entry => !entry.derived).map(entry => entry.symbol).sort(),
    ['/api/health', '/api/session', 'App', 'POST /api/sign-in', 'POST /api/sign-out', 'POST /api/sign-up', 'table accounts', 'table sessions'], 'the template declares what it generated for the Accounts contract');
  assert.ok(manifest.filter(entry => entry.derived).length >= 1 && manifest.filter(entry => entry.derived).every(entry => entry.symbol.startsWith('route /')), 'each generated page is declared as a route');
  // A dead export and a test named after a story, added by hand.
  writeFileSync(join(workspace, 'src', 'unused.ts'), 'export function forgotten() { return 1; }\n');
  mkdirSync(join(workspace, 'tests'), { recursive: true });
  writeFileSync(join(workspace, 'tests', 'accounts.test.mjs'), "import test from 'node:test';\ntest('S1 · Given a visitor, when they sign up, then they are signed in', () => {});\n");
  context.links.index(context.id, workspace);
  const { units } = context.links.snapshot(context.id);
  const unit = key => units.find(entry => `${entry.path}#${entry.symbol}` === key);
  assert.equal(unit('server/server.mjs#POST /api/sign-up').kind, 'handler');
  assert.equal(unit('server/server.mjs#table accounts').kind, 'table');
  assert.equal(unit('src/app.ts#App').kind, 'component');
  assert.ok(unit('server/server.mjs#POST /api/sign-up').calls.includes(unit('server/server.mjs#table accounts').id), 'SQL in a handler references its table');
  assert.ok(unit('server/server.mjs#api').calls.includes(unit('server/server.mjs#POST /api/sign-up').id), 'a handler belongs to the function that routes to it');
  assert.equal(unit('src/unused.ts#forgotten').reachable, false);
  assert.equal(unit('src/unused.ts#forgotten').state, 'dead');
  assert.equal(unit('src/app.ts#App').reachable, true);
  assert.equal(unit('server/server.mjs#send').state, 'untraced', 'glue is reachable but has no story');
  assert.equal(unit('server/server.mjs#POST /api/sign-up').state, 'healthy');
  const signUpStory = context.know.list(context.id, 'story').find(story => story.number === 1);
  assert.ok(unit('tests/accounts.test.mjs#S1 · Given a visitor, when they sign up, then they are signed in').links.some(item => item.recordId === signUpStory.id && item.kind === 'tests'));
  const view = context.know.view(context.ada, context.id, { builtBy: context.links.builtBy(context.id) });
  assert.equal(view.objects.find(object => object.name === 'Account').status, 'built', 'a generated table makes its object built');
  assert.equal(view.operations.find(op => op.operationId === 'signUp').status, 'built');
  assert.equal(view.objects.find(object => object.name === 'Message').status, 'proposed');
});

test('LAY-07D: a new revision makes links suspect and opens exactly one Reconcile item; closing it relinks', () => {
  const context = fixture();
  build(context);
  const { know, links, ada, id } = context;
  const story = know.list(id, 'story').find(entry => entry.number === 1);
  know.update(id, story.id, { why: 'Neighbours need to know who is borrowing' }, { rationale: 'From interviews' });
  const suspect = links.snapshot(id).units.filter(unit => unit.links.some(item => item.recordId === story.id && item.state === 'suspect'));
  assert.ok(suspect.some(unit => unit.symbol === 'POST /api/sign-up') && suspect.some(unit => unit.symbol === 'App'));
  know.update(id, story.id, { edges: ['Email already used'] }, { rationale: 'Edge case' });
  const reconcile = know.workList(id).filter(item => item.type === 'reconcile' && item.state !== 'done');
  assert.equal(reconcile.length, 1, 'one open Reconcile item per record, however many revisions');
  assert.deepEqual(reconcile[0].context.reconcile, { recordId: story.id, fromRevision: 1, toRevision: 3 });
  const detail = links.reconcileContext(id, reconcile[0]);
  assert.deepEqual(detail.changes.map(change => change.field).sort(), ['edges', 'why']);
  assert.ok(detail.units.find(unit => unit.symbol === 'POST /api/sign-up').calls.some(name => name.startsWith('table accounts')));
  // Moving a page (position only) is not a content change and suspects nothing.
  const page = know.list(id, 'page').find(entry => entry.inNav);
  know.update(id, page.id, {}, { position: 3 });
  assert.equal(know.workList(id).filter(item => item.type === 'reconcile' && item.state !== 'done').length, 1);
  const done = know.updateWork(ada, id, reconcile[0].id, { state: 'done' });
  assert.equal(done.state, 'done');
  assert.ok(links.snapshot(id).units.flatMap(unit => unit.links).filter(item => item.recordId === story.id).every(item => item.state === 'current' && item.revision === 3));
});

test('LAY-07D: a rebuild regenerates pages from their records and resolves their Reconcile items', () => {
  const context = fixture();
  build(context);
  const { know, links, id } = context;
  const page = know.list(id, 'page').find(entry => entry.inNav);
  know.update(id, page.id, { description: 'Everything you lent and borrowed' }, { rationale: 'Clearer' });
  assert.equal(know.workList(id).filter(item => item.type === 'reconcile' && item.state !== 'done').length, 1);
  build(context);
  assert.equal(know.workList(id).filter(item => item.type === 'reconcile' && item.state !== 'done').length, 0, 'the regenerated page is current again');
  assert.ok(links.snapshot(id).units.flatMap(unit => unit.links).filter(item => item.recordId === page.id).every(item => item.state === 'current'));
});

test('LAY-07D: commit trailers link the units a commit changed, at the revision current when it was made', () => {
  const context = fixture();
  const { workspace } = build(context);
  const { know, links, id } = context;
  const story = know.list(id, 'story').find(entry => entry.title.startsWith('Someone can start a conversation'));
  const server = readFileSync(join(workspace, 'server', 'server.mjs'), 'utf8');
  writeFileSync(join(workspace, 'server', 'server.mjs'), server.replace("  if (pathname === '/api/health') return send(response, 200, { ok: true });",
    "  if (pathname === '/api/health') return send(response, 200, { ok: true });\n  if (pathname === '/api/conversations' && request.method === 'POST') {\n    return send(response, 201, { conversation: { startedAt: new Date().toISOString() } });\n  }"));
  commitWorkspace({ repository: workspace, profile: gitProfile, message: 'feat: start a conversation', name: 'Ada', email: 'ada@example.com', trailers: { 'Aludel-Work': 'W-7', Implements: `S${story.number}` } });
  assert.match(git(workspace, 'log', '-1', '--format=%B').stdout, new RegExp(`Aludel-Work: W-7\\nImplements: S${story.number}`));
  links.index(id, workspace);
  const unit = links.snapshot(id).units.find(entry => entry.symbol === 'POST /api/conversations');
  assert.deepEqual(unit.links.map(item => [item.recordId, item.kind, item.source, item.workRef, item.state]), [[story.id, 'implements', 'trailer', 'W-7', 'current']]);
  assert.ok(!links.snapshot(id).units.find(entry => entry.symbol === 'api').links.some(item => item.source === 'trailer'), 'the innermost changed unit is linked, not the router around it');
});

test('LAY-07D: extractUnits keeps sibling tables from one SQL string at the same level', () => {
  const { units } = extractUnits('server/x.mjs', "db.exec(`CREATE TABLE a (id); CREATE TABLE b (id);`);\n");
  assert.deepEqual(units.map(unit => [unit.symbol, unit.parent]), [['table a', null], ['table b', null]]);
  assert.equal(indexWorkspace(mkdtempSync(join(tmpdir(), 'empty-'))).length, 0);
});

test('LAY-07B: preview database health, masked browsing, guarded read-only queries, backups and confirmed restore', async () => {
  const context = fixture();
  const { workspace } = build(context);
  const { ops, id } = context;
  assert.equal(ops.health(workspace).exists, false, 'no database until the app stores something');
  mkdirSync(join(workspace, '.data'), { recursive: true });
  const app = new DatabaseSync(join(workspace, '.data', 'app.sqlite'));
  app.exec(`CREATE TABLE accounts (email TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL);`);
  app.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?)').run('sam@example.com', 'Sam', 'SALT-SECRET', 'HASH-SECRET', '2026-09-22');
  app.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run('TOKEN-SECRET', 'sam@example.com', '2026-10-22');
  app.close();
  const health = ops.health(workspace);
  assert.equal(health.integrity, 'ok');
  assert.deepEqual(health.tables, [{ name: 'accounts', rows: 1 }, { name: 'sessions', rows: 1 }]);
  assert.deepEqual(ops.schema(workspace).map(item => item.name).sort(), ['accounts', 'sessions']);
  const accounts = ops.browse(workspace, 'accounts');
  assert.deepEqual(accounts.masked, ['salt', 'hash']);
  assert.ok(!JSON.stringify(accounts).includes('SECRET'), 'secret values never leave the module');
  assert.ok(!JSON.stringify(ops.browse(workspace, 'sessions')).includes('TOKEN-SECRET'));
  assert.ok(!JSON.stringify(ops.query(workspace, 'SELECT * FROM sessions')).includes('SECRET'), 'SELECT * is masked by column');
  assert.throws(() => ops.browse(workspace, 'nope'), error => error.status === 404);
  assert.deepEqual(ops.query(workspace, 'SELECT name FROM accounts;').rows, [['Sam']]);
  assert.throws(() => ops.query(workspace, "INSERT INTO accounts VALUES ('a','b','c','d','e')"), /Only SELECT/);
  assert.throws(() => ops.query(workspace, 'SELECT 1; DELETE FROM accounts'), /one statement/);
  assert.throws(() => ops.query(workspace, 'SELECT hash AS h FROM accounts'), /secret columns/);
  assert.throws(() => ops.query(workspace, 'SELECT substr(salt, 1) FROM accounts'), /secret columns/);
  assert.throws(() => ops.query(workspace, 'SELECT * FROM missing'), /database said/);
  assert.throws(() => ops.query(workspace, 'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT x FROM n'), /Only SELECT/, 'an unbounded recursive query is refused before it runs');
  assert.equal(ops.query(workspace, 'SELECT a.value FROM json_each(\'[1,2,3,4,5,6,7,8,9,10]\') a, json_each(\'[1,2,3,4,5,6,7,8,9,10]\') b, json_each(\'[1,2,3]\') c').rows.length, 200, 'results stop at the row limit');
});

test('LAY-07B: backups sit outside the repository and restore needs confirmation', async () => {
  const context = fixture();
  const { workspace } = build(context);
  const { ops, id, root } = context;
  mkdirSync(join(workspace, '.data'), { recursive: true });
  const path = join(workspace, '.data', 'app.sqlite');
  let app = new DatabaseSync(path); app.exec('CREATE TABLE notes (body TEXT); INSERT INTO notes VALUES (\'first\');'); app.close();
  const backup = await ops.backup(id, workspace, 'before release');
  assert.ok(existsSync(join(root, 'backups', id, backup.name)) && !backup.name.includes('/'));
  assert.equal(backup.reason, 'before release');
  app = new DatabaseSync(path); app.exec("INSERT INTO notes VALUES ('second');"); app.close();
  let stopped = 0;
  await assert.rejects(ops.restore(id, workspace, backup.name, { confirm: false, stopPreview: async () => { stopped++; } }), error => error.status === 409);
  await assert.rejects(ops.restore(id, workspace, '../../etc/passwd', { confirm: true, stopPreview: async () => { stopped++; } }), error => error.status === 404);
  assert.equal(stopped, 0);
  const restored = await ops.restore(id, workspace, backup.name, { confirm: true, stopPreview: async () => { stopped++; } });
  assert.equal(stopped, 1);
  assert.ok(restored.safety, 'a fresh backup is taken before restoring');
  assert.deepEqual(ops.query(workspace, 'SELECT body FROM notes').rows, [['first']]);
  assert.equal(git(workspace, 'status', '--porcelain').stdout.includes('backups'), false, 'backups never appear in the project repository');
});

test('LAY-07B: releases record checks from the preview result and the stories they carry', () => {
  const { ops, id } = fixture();
  const release = ops.releases.start(id, { commit: 'abc1234', stories: ['sto-aaaaaaaa'] });
  assert.equal(release.number, 1);
  assert.equal(release.state, 'building');
  const passed = ops.releases.finish(release.id, { status: 'running', builtAt: new Date().toISOString() });
  assert.deepEqual(passed.checks.map(check => check.state), ['passed', 'passed']);
  const second = ops.releases.start(id, { commit: 'def5678' });
  const failed = ops.releases.finish(second.id, { status: 'failed', builtAt: '2020-01-01T00:00:00.000Z' });
  assert.deepEqual(failed.checks.map(check => check.state), ['failed', 'skipped'], 'an old build time does not count as this release building');
  assert.deepEqual(ops.releases.list(id).map(item => item.number), [2, 1]);
});

test('a project workspace inside another repository gets its own repository and never commits the parent', () => {
  const parent = mkdtempSync(join(tmpdir(), 'aludel-parent-'));
  git(parent, 'init', '-b', 'main');
  git(parent, 'config', 'user.name', 'Owner'); git(parent, 'config', 'user.email', 'owner@example.com');
  writeFileSync(join(parent, '.gitignore'), '.data\n');
  writeFileSync(join(parent, 'aludel.txt'), 'Aludel itself\n');
  git(parent, 'add', '-A'); git(parent, 'commit', '-m', 'aludel baseline');
  writeFileSync(join(parent, 'aludel.txt'), 'Aludel itself, with uncommitted work\n');
  const workspace = join(parent, '.data', 'workspaces', 'p-1');
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, 'README.md'), '# A project\n');
  const result = commitWorkspace({ repository: workspace, profile: gitProfile, message: 'chore: start a project', name: 'Ada', email: 'ada@example.com' });
  assert.ok(existsSync(join(workspace, '.git')), 'the workspace got its own repository');
  assert.equal(git(workspace, 'log', '--format=%s').stdout.trim(), 'chore: start a project');
  assert.equal(git(parent, 'log', '--format=%s').stdout.trim(), 'aludel baseline', 'the parent gained no commit');
  assert.match(git(parent, 'status', '--porcelain').stdout, /M aludel\.txt/, 'the parent\'s uncommitted work is untouched');
  assert.ok(result.trackedFiles >= 1);
});
