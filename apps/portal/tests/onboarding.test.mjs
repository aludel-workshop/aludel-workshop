import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createSession, createUser, initAccounts, isMember, ownerUserId, sessionUser, verifyUser } from '../server/accounts.mjs';
import { hostTopology, slugify } from '../server/hosts.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { skeletonFiles, initialFiles } from '../server/scaffold.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const configDirectory = new URL('../config', import.meta.url).pathname;
const catalogs = loadCatalogs(configDirectory);
const gitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse((await import('node:fs')).readFileSync(join(configDirectory, 'project-setup.json'), 'utf8')));
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-onboarding-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db);
  const created = [];
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: setup => created.push(setup.project.id) });
  return { db, flows, created };
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

test('feature picks become product records, deselection retires and reselection restores them', () => {
  const { db, flows } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  const id = setup.project.id;
  let result = flows.saveFeatures(ada, id, { picks: ['search', 'messaging'], custom: [{ title: 'Tool library', summary: 'Browse nearby tools.' }] });
  assert.deepEqual(result.features.records.map(item => item.title).sort(), ['Messages and comments', 'Search', 'Tool library']);
  const searchId = result.features.records.find(item => item.title === 'Search').id;
  result = flows.saveFeatures(ada, id, { picks: ['messaging'] });
  assert.deepEqual(result.features.records.map(item => item.title).sort(), ['Messages and comments', 'Tool library']);
  result = flows.saveFeatures(ada, id, { picks: ['messaging', 'search'] });
  assert.equal(result.features.records.find(item => item.title === 'Search').id, searchId, 'the same record comes back, with history');
  assert.throws(() => flows.saveFeatures(ada, id, { picks: ['teleportation'] }), /from the list/);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM product_records WHERE project_id = 'the-machine' AND kind = 'feature'").get().count, 4, "Aludel's own features are untouched");
});

test('agent connections are sealed, never returned, and work identically for Aludel itself', () => {
  const { db, flows } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  const key = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234';
  const saved = flows.saveAgentConnection(ada, setup.project.id, { provider: 'anthropic', secret: key });
  assert.equal(saved.connection.hint, '1234');
  assert.equal(JSON.stringify(saved).includes(key), false);
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM project_connections').all()).includes(key), false);
  assert.throws(() => flows.saveAgentConnection(ada, setup.project.id, { provider: 'anthropic', secret: 'not-a-key' }), /doesn't look like/);
  assert.throws(() => flows.agentConnection(ada, 'the-machine'), error => error.status === 404, 'non-members cannot see Aludel');
  const owner = { id: ownerUserId };
  assert.equal(flows.saveAgentConnection(owner, 'the-machine', { provider: 'codex-local' }).connection.label, 'Codex on this machine');
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
  assert.deepEqual(setup.stack, { preset: 'aludel-web-v1', options: { auth: true, sampleContent: true } });
  assert.throws(() => flows.saveStack(ada, setup.project.id, { preset: 'django-htmx' }), error => error.status === 409);
  assert.deepEqual(flows.saveStack(ada, setup.project.id, { preset: 'aludel-web-v1', options: { auth: false } }).stack.options, { auth: false, sampleContent: true });
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

test('the skeleton is deterministic, maps features to pages and never links dependencies into the repository', () => {
  const { db, flows } = fixture();
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { setup } = startProject(flows, ada);
  flows.saveFeatures(ada, setup.project.id, { picks: ['search', 'accounts'], custom: [{ title: 'Sign in', summary: 'Collides with the built-in page.' }] });
  const current = flows.projectSetup(ada, setup.project.id);
  const urls = { portal: 'http://aludel.localhost:4310', app: 'http://tool-share.localhost:4310' };
  const first = skeletonFiles(current, catalogs, gitProfile, urls, []).files;
  const second = skeletonFiles(current, catalogs, gitProfile, urls, []).files;
  assert.deepEqual(first, second);
  assert.match(first['.gitignore'], /^node_modules$/m);
  const site = first['src/site.ts'];
  assert.match(site, /"path": "\/search"/);
  assert.match(site, /"path": "\/sign-in-page"/, 'feature pages never shadow the built-in sign-in route');
  assert.equal(JSON.parse(first['aludel.json']).workingStyle.profile, 'dreamer');
  assert.ok(Object.keys(initialFiles(current, catalogs, gitProfile, urls)).every(path => !path.includes('node_modules')));
  assert.equal(Object.values(first).some(content => /MACHINE_GITHUB|machine_session/.test(content)), false);
});
