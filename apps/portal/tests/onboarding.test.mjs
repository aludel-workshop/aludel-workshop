import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createSession, createUser, initAccounts, isMember, ownerUserId, sessionUser, verifyUser } from '../server/accounts.mjs';
import { hostTopology, slugify } from '../server/hosts.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { initialFiles, loadScaffoldSources, skeletonFiles } from '../server/scaffold.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const configDirectory = new URL('../config', import.meta.url).pathname;
const catalogs = loadCatalogs(configDirectory);
const gitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse((await import('node:fs')).readFileSync(join(configDirectory, 'project-setup.json'), 'utf8')));
const sources = loadScaffoldSources(new URL('..', import.meta.url).pathname);
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-onboarding-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
  const created = [];
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  // Key checks never leave the test: this stand-in accepts any key ending in 1234.
  const checkAgentKey = async (provider, key) => key.endsWith('1234') ? { ok: true } : { ok: false, reason: 'rejected' };
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: setup => created.push(setup.project.id), know, checkAgentKey });
  return { db, flows, created, know };
}

function startProject(flows, user, name = 'Tool Share', profile = 'dreamer') {
  const { token } = flows.saveDraft(null, { profile });
  flows.saveDraft(token, { name, pitch: 'Neighbours lend and borrow tools they rarely use.' });
  return { token, setup: flows.claimDraft(token, user, user) };
}

test('accounts hash passwords, reject duplicates and resolve sessions to users', () => {
  const { db } = fixture();
  const ada = createUser(db, { email: ' Ada@Example.com ', name: 'Ada', password: 'correct-horse-battery' });
  assert.equal(ada.email, 'ada@example.com');
  assert.throws(() => createUser(db, { email: 'ada@example.com', name: 'Other', password: 'another-long-password' }), error => error.status === 409);
  assert.throws(() => createUser(db, { email: 'b@example.com', name: 'B', password: 'short' }), /12 characters/);
  assert.throws(() => verifyUser(db, { email: 'ada@example.com', password: 'wrong-password-123' }), error => error.status === 401);
  assert.throws(() => verifyUser(db, { email: 'nobody@example.com', password: 'wrong-password-123' }), error => error.status === 401);
  assert.equal(verifyUser(db, { email: 'ADA@example.com', password: 'correct-horse-battery' }).id, ada.id);
  const token = /machine_session=([^;]+)/.exec(createSession(db, ada.id))[1];
  assert.equal(sessionUser(db, token).id, ada.id);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM users').all()).includes('correct-horse-battery'), false);
  assert.equal(isMember(db, ownerUserId, 'the-machine'), true);
  assert.equal(isMember(db, ada.id, 'the-machine'), false);
});

test('sessions created before accounts keep working as the owner', () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-legacy-session-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  db.prepare('INSERT INTO sessions(token_hash, created_at, expires_at) VALUES (?, ?, ?)').run('a'.repeat(64), new Date().toISOString(), new Date(Date.now() + 60_000).toISOString());
  initAccounts(db);
  assert.equal(db.prepare('SELECT user_id FROM sessions').get().user_id, ownerUserId);
});

test('a draft needs a working style and becomes exactly one project owned by the claimant', () => {
  const { db, flows, created } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const bob = createUser(db, { email: 'bob@example.com', name: 'Bob', password: 'correct-horse-battery' });
  const { token: unstyled } = flows.saveDraft(null, { name: 'No Style', pitch: 'A draft without a working style.' });
  assert.throws(() => flows.claimDraft(unstyled, ada, ada), /how you want to work/);
  assert.throws(() => flows.saveDraft(null, { profile: 'wizard' }), /Dreamer, Planner or Tinkerer/);
  assert.throws(() => flows.saveDraft(null, { profile: 'dreamer', name: 'X', pitch: 'short' }), /sentence or two/);

  const { token, setup } = startProject(flows, ada);
  assert.equal(setup.project.slug, 'tool-share');
  assert.equal(setup.direction.summary, 'Neighbours lend and borrow tools they rarely use.');
  assert.deepEqual(created, [setup.project.id]);
  assert.equal(flows.claimDraft(token, ada, ada).project.id, setup.project.id, 'claiming twice returns the same project');
  assert.throws(() => flows.claimDraft(token, bob, bob), error => error.status === 404, 'another account cannot take over a claimed draft');
  assert.throws(() => flows.projectSetup(bob, setup.project.id), error => error.status === 404);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects WHERE slug LIKE ?').get('tool-share%').count, 1);
  assert.equal(startProject(flows, bob).setup.project.slug, 'tool-share-2');
  assert.equal(startProject(flows, bob, 'Aludel').setup.project.slug, 'aludel-2', 'reserved subdomains are never assigned');
});

test('working style is a preference set: overrides survive a switch and equal-to-default values are not overrides', () => {
  const { db, flows } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  assert.equal(setup.preferences.implementation, 'agent');
  assert.equal(setup.preferences.setupDetail, 'quick');
  let updated = flows.savePreferences(ada, setup.project.id, { overrides: { setupDetail: 'detailed' } });
  assert.deepEqual(updated.overrides, { setupDetail: 'detailed' });
  updated = flows.savePreferences(ada, setup.project.id, { profile: 'tinkerer' });
  assert.equal(updated.preferences.implementation, 'self');
  assert.deepEqual(updated.overrides, { setupDetail: 'detailed' }, 'switching profile keeps explicit choices');
  updated = flows.savePreferences(ada, setup.project.id, { overrides: { autofill: 'off' } });
  assert.equal('autofill' in updated.overrides, false, 'a value equal to the profile default is not stored as an override');
  assert.throws(() => flows.savePreferences(ada, setup.project.id, { overrides: { implementation: 'magic' } }), /valid value/);
  assert.deepEqual(flows.savePreferences(ada, setup.project.id, { resetOverrides: true }).overrides, {});
});

test('story packs seed ordinary stories and pages; unselecting removes only untouched pack content', () => {
  const { db, flows, know } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  const id = setup.project.id;
  flows.saveDesign(ada, id, { feel: 'mobile-social', theme: 'light' });
  let result = flows.saveFeatures(ada, id, { picks: ['accounts', 'messaging'], custom: [{ title: 'Someone can list a tool', summary: 'Lenders share what they own' }] });
  assert.deepEqual(result.features.picks, ['accounts', 'messaging']);
  const view = know.view(ada, id);
  assert.deepEqual(view.activities.map(a => a.title), ['Join', 'Talk it over', 'Ideas to place']);
  const signUp = view.stories.find(s => s.title.startsWith('Someone can sign up'));
  assert.equal(signUp.template, true); assert.equal(signUp.status, 'defined', 'acceptance present; built only after a real build');
  const messages = view.pages.find(p => p.label === 'Messages');
  assert.equal(messages.origin, 'Starting feel', 'the feel already had Messages, so pack stories join that page instead of a duplicate');
  assert.equal(messages.stories.length, 2);
  assert.ok(view.pages.find(p => p.label === 'Conversation' && p.parentId === messages.id), 'pack sub-pages sit under the matched page');
  assert.equal(view.pages.find(p => p.label === 'Sign in').inNav, false);
  const thread = view.stories.find(s => s.title.startsWith('Someone can read and reply'));
  know.update(id, thread.id, { title: 'Sam can reply to Priya in a thread' }, { author: 'Ada', rationale: 'Specific to Tool Share' });
  result = flows.saveFeatures(ada, id, { picks: ['accounts'] });
  const after = know.view(ada, id);
  assert.ok(after.activities.some(a => a.title === 'Talk it over'), 'a pack the person edited is kept when unselected');
  flows.saveFeatures(ada, id, { picks: [] });
  assert.equal(know.view(ada, id).activities.some(a => a.title === 'Join'), false, 'an untouched pack is removed cleanly');
  assert.throws(() => flows.saveFeatures(ada, id, { picks: ['teleportation'] }), /story packs/);
});

test('pages are records: deleting one that realises stories needs a home for them', () => {
  const { db, flows, know } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  const id = setup.project.id;
  flows.saveDesign(ada, id, { feel: 'sleek-saas', theme: 'light' });
  flows.saveFeatures(ada, id, { picks: ['messaging'] });
  const routes = flows.projectSetup(ada, id).pages.routes;
  const messages = routes.find(r => r.label === 'Messages');
  assert.ok(messages, 'the Messaging pack adds Messages to the navigation');
  const without = routes.filter(r => r.id !== messages.id);
  assert.throws(() => flows.saveRoutes(ada, id, { routes: without }), error => error.status === 409 && /Choose which page takes them/.test(error.message));
  const home = routes[0];
  flows.saveRoutes(ada, id, { routes: without, reassign: { [messages.id]: home.id } });
  const homePage = know.view(ada, id).pages.find(p => p.id === home.id);
  assert.equal(homePage.stories.length, 2);
  assert.match(homePage.history[0].rationale, /Took the stories of “Messages”/);
  assert.equal(flows.saveDesign(ada, id, { feel: 'marketplace', theme: 'light' }).pages.routes[0].id, home.id, 'customised navigation is never reseeded');
});

test('story status is derived from connected work, and work cannot close without documentation', () => {
  const { db, flows, know } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  const id = setup.project.id;
  const activity = know.insert(id, 'activity', { title: 'Borrow', persona: 'Sam' });
  const step = know.insert(id, 'step', { title: 'Request' }, { parentId: activity.id });
  const story = know.insert(id, 'story', { title: 'Sam can ask to borrow a tool', phase: 'demo' }, { parentId: step.id });
  const status = () => know.view(ada, id).stories.find(s => s.id === story.id).status;
  assert.equal(status(), 'proposed');
  assert.equal(story.number, 1);
  assert.throws(() => know.update(id, story.id, { acceptance: [{ given: 'x', when: '', then: 'y' }] }), /Given, When and Then/);
  know.update(id, story.id, { acceptance: [{ given: 'an available tool', when: 'Sam asks', then: 'the lender sees it' }] }, { expectedRevision: 1 });
  assert.equal(status(), 'defined');
  assert.throws(() => know.update(id, story.id, { title: 'stale' }, { expectedRevision: 1 }), error => error.status === 409);
  const design = know.createWork(id, { layer: 'pages', type: 'design', title: 'Design the request page', targets: [{ id: story.id }] });
  // Every item carries its action's checks; a record-changing item still can't close until its target changed from it.
  assert.ok(design.checks.length && design.action === 'pages.design');
  assert.throws(() => know.updateWork(ada, id, design.id, { state: 'done' }), /has no change from W-1/);
  const agent = know.defaultProfile(id);
  const implement = know.createWork(id, { layer: 'product', type: 'implement', title: 'Build the request', targets: [{ id: story.id }], documents: ['Product › story built'], question: { text: 'Dates or ASAP?', options: ['Dates', 'ASAP'] }, state: 'needs-input', assignee: { kind: 'agent', id: agent.id } });
  assert.throws(() => know.createWork(id, { layer: 'product', type: 'implement', title: 'x', assignee: { kind: 'agent', label: 'Coding agent' } }), error => error.status === 404);
  // An answer lands in the story it changes, and that finishes the item.
  const answered = know.updateWork(ada, id, implement.id, { answer: 'Dates', rationale: 'Lenders plan ahead' });
  assert.equal(answered.state, 'done'); assert.equal(answered.question.answeredBy, 'Ada');
  assert.deepEqual(know.get(id, story.id).resolved.map(entry => entry.answer), ['Dates']);
  assert.equal(status(), 'built');
  assert.equal(implement.ref, 'W-2');
  const bob = createUser(db, { email: 'bob@example.com', name: 'Bob', password: 'correct-horse-battery' });
  assert.throws(() => know.view(bob, id), error => error.status === 404);
  assert.throws(() => know.createWork(id, { layer: 'product', type: 'implement', title: 'x', targets: [{ id: 'sto-00000000' }] }), error => error.status === 404);
});

test('a build marks template stories built with a done template work item and gives every page a skeleton', () => {
  const { db, flows, know } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  const id = setup.project.id;
  flows.saveFeatures(ada, id, { picks: ['accounts', 'messaging'] });
  know.recordBuild(id, 'abc1234def', { auth: true });
  know.recordBuild(id, 'abc1234def', { auth: true });
  const view = know.view(ada, id);
  const template = view.work.filter(item => item.assignee?.kind === 'template');
  assert.equal(template.length, 1, 'recording a build twice does not duplicate template work');
  assert.equal(template[0].state, 'done');
  assert.deepEqual(view.stories.filter(s => s.status === 'built').map(s => s.pack), ['Accounts', 'Accounts', 'Accounts']);
  assert.ok(view.stories.filter(s => s.pack === 'Messaging').every(s => s.status !== 'built'), 'messaging is not built by the template, so it is not claimed as built');
  assert.ok(view.pages.every(p => p.status === 'skeleton'));
  assert.ok(view.vision.statement.body.startsWith('Neighbours lend'));
  assert.deepEqual(view.phases.map(p => p.key), ['demo', 'mvp', 'later']);
});

test('agent connections are checked, sealed, never returned, and work identically for Aludel itself', async () => {
  const { db, flows } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  const key = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234';
  const saved = await flows.saveAgentConnection(ada, setup.project.id, { provider: 'anthropic', secret: key });
  assert.equal(saved.connection.hint, '1234');
  assert.equal(saved.connection.status, 'verified');
  assert.equal(JSON.stringify(saved).includes(key), false);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM project_connections').all()).includes(key), false);
  await assert.rejects(flows.saveAgentConnection(ada, setup.project.id, { provider: 'anthropic', secret: 'not-a-key' }), /doesn't look like/);
  await assert.rejects(flows.saveAgentConnection(ada, setup.project.id, { provider: 'anthropic', secret: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz9999' }), /rejected this key/);
  assert.equal((await flows.agentConnection(ada, setup.project.id)).connection.hint, '1234', 'a rejected key replaces nothing');
  assert.throws(() => flows.agentConnection(ada, 'the-machine'), error => error.status === 404, 'non-members cannot see Aludel');
  const owner = { id: ownerUserId };
  await assert.rejects(flows.saveAgentConnection(owner, 'the-machine', { provider: 'codex-local' }), /not offered for new connections/);
  assert.equal((await flows.saveAgentConnection(owner, 'the-machine', { provider: 'openai', secret: 'sk-proj-abcdefghijklmnopqrstuvwxyz1234' })).connection.label, 'OpenAI');
  assert.equal(flows.removeAgentConnection(owner, 'the-machine').connection, null);
});

test('look and feel validates choices and uploads enforce type, size and ownership', () => {
  const { db, flows } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const bob = createUser(db, { email: 'bob@example.com', name: 'Bob', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  const id = setup.project.id;
  assert.equal(flows.saveDesign(ada, id, { feel: 'data-console', theme: 'dark', accent: '#12A58A' }).design.accent, '#12a58a');
  assert.throws(() => flows.saveDesign(ada, id, { feel: 'brutalist', theme: 'dark' }), /starting feel/);
  const withImage = flows.addAsset(ada, id, { filename: 'logo.png', dataUrl: pixel, notes: 'Logo in the header' });
  assert.equal(withImage.assets[0].notes, 'Logo in the header');
  assert.throws(() => flows.addAsset(ada, id, { filename: 'x.svg', dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }), /PNG, JPEG or WebP/);
  assert.throws(() => flows.assetFile(bob, id, withImage.assets[0].id), error => error.status === 404);
  const doc = flows.addAsset(ada, id, { filename: 'brief.md', dataUrl: `data:text/markdown;base64,${Buffer.from('# Brief').toString('base64')}`, notes: 'Requirements' });
  assert.equal(doc.assets[1].kind, 'document');
  assert.equal(flows.removeAsset(ada, id, withImage.assets[0].id).assets.length, 1);
  for (const filename of ['..', '../../etc/passwd', '.hidden.png']) {
    const stored = flows.addAsset(ada, id, { filename, dataUrl: pixel, notes: '' }).assets.at(-1).filename;
    assert.equal(/^\.|\//.test(stored), false, `${filename} became ${stored}`);
  }
});

test('only available stack presets can be chosen', () => {
  const { db, flows } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  assert.deepEqual(setup.stack, { preset: 'aludel-web-v1', options: { auth: true } });
  assert.throws(() => flows.saveStack(ada, setup.project.id, { preset: 'django-htmx' }), error => error.status === 409);
  assert.deepEqual(flows.saveStack(ada, setup.project.id, { preset: 'aludel-web-v1', options: { auth: false } }).stack.options, { auth: false });
});

test('host topology separates the portal from app subdomains and supports a hosted domain', () => {
  const local = hostTopology({}, 4310);
  assert.equal(local.portalOrigin, 'http://aludel.localhost:4310');
  assert.equal(local.appOrigin('tool-share'), 'http://tool-share.localhost:4310');
  assert.deepEqual(local.classify('tool-share.localhost:4310'), { kind: 'app', slug: 'tool-share', host: 'tool-share.localhost' });
  for (const host of ['aludel.localhost:4310', '127.0.0.1:4310', 'localhost:4310']) assert.equal(local.classify(host).kind, 'portal');
  for (const host of ['www.localhost', 'a.b.localhost', 'evil.example', '-bad.localhost']) assert.notEqual(local.classify(host).kind, 'app');
  assert.equal(local.portalOriginFor('evil.example'), 'http://aludel.localhost:4310', 'return URLs never point at foreign hosts');
  const hosted = hostTopology({ MACHINE_BASE_DOMAIN: 'aludel.dev', MACHINE_PUBLIC_SCHEME: 'https', MACHINE_PUBLIC_PORT: '' }, 4310);
  assert.equal(hosted.portalOrigin, 'https://aludel.aludel.dev');
  assert.equal(hosted.appOrigin('shop'), 'https://shop.aludel.dev');
  assert.equal(slugify('Café  Crème!!'), 'cafe-creme');
});

test('pages are seeded from the chosen feel, then saved as the person arranges them', () => {
  const { db, flows } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  assert.deepEqual(setup.pages.routes.map(page => page.label), ['Home'], 'no feel yet: just Home');
  const marketplace = flows.saveDesign(ada, setup.project.id, { feel: 'marketplace', theme: 'light' });
  assert.equal(marketplace.design.navigation, 'top', 'the feel sets the default desktop navigation');
  assert.deepEqual(marketplace.pages.routes.map(page => page.label), ['Home', 'Browse', 'Sell', 'Messages', 'Account']);
  assert.ok(marketplace.pages.seeded && marketplace.pages.routes.every(page => page.description === ''), 'seeds never invent descriptions');
  const routes = [{ ...marketplace.pages.routes[1], description: 'Find tools near you.' }, { ...marketplace.pages.routes[0], label: 'Lend', icon: 'build', pageType: 'form' }];
  const saved = flows.saveRoutes(ada, setup.project.id, { routes, navigation: 'sidebar' });
  assert.deepEqual(saved.pages.routes.map(page => [page.label, page.pageType]), [['Browse', 'gallery'], ['Lend', 'form']]);
  assert.equal(saved.pages.seeded, false); assert.equal(saved.design.navigation, 'sidebar');
  assert.equal(flows.saveDesign(ada, setup.project.id, { feel: 'editorial', theme: 'light' }).pages.routes[0].label, 'Browse', 'saved pages are never reseeded');
  const page = { label: 'A', icon: 'home', pageType: 'feed', description: '' };
  assert.throws(() => flows.saveRoutes(ada, setup.project.id, { routes: [] }), /one and five/);
  assert.throws(() => flows.saveRoutes(ada, setup.project.id, { routes: Array.from({ length: 6 }, (_, index) => ({ ...page, label: `P${index}` })) }), /one and five/);
  assert.throws(() => flows.saveRoutes(ada, setup.project.id, { routes: [page, { ...page, label: 'a' }] }), /both called/);
  assert.throws(() => flows.saveRoutes(ada, setup.project.id, { routes: [{ ...page, icon: 'rocket' }] }), /icon/);
  assert.throws(() => flows.saveRoutes(ada, setup.project.id, { routes: [{ ...page, pageType: 'wiki' }] }), /page type/);
  const bob = createUser(db, { email: 'bob@example.com', name: 'Bob', password: 'correct-horse-battery' });
  assert.throws(() => flows.saveRoutes(bob, setup.project.id, { routes: [page] }), error => error.status === 404);
});

test('the skeleton is deterministic, builds pages from the navigation and never links dependencies into the repository', () => {
  const { db, flows } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  flows.saveFeatures(ada, setup.project.id, { picks: ['search'] });
  flows.saveRoutes(ada, setup.project.id, { routes: [
    { label: 'Home', icon: 'home', pageType: 'dashboard', description: 'What needs attention today.' },
    { label: 'Sign in', icon: 'person', pageType: 'form', description: '' },
    { label: 'Messages', icon: 'chat', pageType: 'messages', description: '' }
  ] });
  const current = flows.projectSetup(ada, setup.project.id);
  const urls = { portal: 'http://aludel.localhost:4310', app: 'http://tool-share.localhost:4310' };
  const first = skeletonFiles(current, catalogs, gitProfile, urls, [], sources);
  const second = skeletonFiles(current, catalogs, gitProfile, urls, [], sources);
  assert.deepEqual(first.files, second.files);
  const files = first.files;
  assert.match(files['.gitignore'], /^node_modules$/m);
  const site = JSON.parse(files['src/site.ts'].split('export const site: Site = ')[1].replace(/;\s*$/, ''));
  assert.deepEqual(site.pages.map(page => page.path), ['/', '/sign-in-page', '/messages'], 'the first page is home and nothing shadows /sign-in');
  assert.deepEqual(site.pages[0].blocks, catalogs.pageTypes.dashboard.blocks, 'the skeleton uses the same layout the preview showed');
  assert.equal(files['src/page-blocks.ts'], sources.pageBlocks, 'the layout renderer is shared verbatim with the preview');
  assert.ok(first.binaries['public/fonts/icons.ttf'].length > 1000);
  const product = files['docs/product.md'];
  assert.match(product, /## Pages[\s\S]*\*\*Home\*\* \(Dashboard\) — What needs attention today\./);
  assert.match(product, /## Stories[\s\S]*Someone can search by keyword _\(Search pack\)_/);
  assert.match(product, /## Story packs[\s\S]*\*\*Search\*\*/);
  assert.deepEqual(JSON.parse(files['aludel.json']).pages.map(page => page.label), ['Home', 'Sign in', 'Messages']);
  assert.ok(Object.keys(initialFiles(current, catalogs, gitProfile, urls)).every(path => !path.includes('node_modules')));
  assert.equal(Object.values(files).some(content => /MACHINE_GITHUB|machine_session/.test(content)), false);
});
