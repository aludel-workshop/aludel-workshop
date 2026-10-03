// T03-CODE disposable journey through the Code layer's own frame, on a template-enabled server. The build installs Code
// into the app's repository; Overview, Explorer down to a unit, Journeys (JOURNEYS-01 J2: committed in the repository, read
// back with steps and tests), Tests, a change request as Code's Work, a release recorded in
// the repository and published to the Library, Knowledge showing the app's docs with their checks and a save, axe and
// 390px. Run with MACHINE_LAYER_TEMPLATES_ENABLED=1 tools/browser-checks.sh code-layer.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from './browser-support.mjs';

const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4326}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const request = async (method, path, data) => {
  const response = await context.request.fetch(origin + path, { method, data, headers: { 'content-type': 'application/json' } });
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
};
const axe = async (target, name) => {
  await target.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await target.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(value => `${value.id}: ${value.nodes[0]?.target}`));
  assert.deepEqual(violations, [], `${name} accessibility`);
};
try {
  await request('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await request('PUT', '/api/onboarding/draft', { name: `Tool Share ${randomBytes(3).toString('hex')}`, pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await request('POST', '/api/accounts', { name: 'Code tester', email: `code-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  await request('PUT', `/api/projects/${project.id}/design`, { feel: 'sleek-saas', theme: 'light', accent: '#2e7d5b' });
  await request('PUT', `/api/projects/${project.id}/features`, { picks: ['accounts'] });
  await request('POST', `/api/projects/${project.id}/skeleton`, {});

  // ---- The build installed Code into the app's own repository ----
  const sync = await request('GET', `/api/projects/${project.id}/layers/platform/sync`);
  assert.match(sync.commit, /^[0-9a-f]{40}$/);
  const workspace = join(process.env.MACHINE_DATA_DIR, 'workspaces', project.id);
  const git = (...args) => execFileSync('git', ['-C', workspace, ...args], { encoding: 'utf8' }).trim();
  assert.equal(git('rev-parse', 'main'), sync.commit, 'Code\'s pin is the repository\'s main');
  assert.ok(git('ls-tree', '--name-only', 'main', '.aludel/').includes('.aludel/layer.json'), 'Code\'s definition is in .aludel/');
  assert.ok(git('ls-tree', '-r', '--name-only', 'main').split('\n').includes('docs/product/stories.md'), 'starter docs from the template\'s seed');
  assert.ok(!git('ls-tree', '-r', '--name-only', 'main').split('\n').includes('.aludel/outputs/trace-links.json'), 'no code links (code tracing was removed)');

  const base = `/p/${project.slug}`;
  const bar = page.locator('.lay-layer-outputs');
  const view = page.frameLocator('.lay-frame-view');
  await page.goto(origin + base + '/code');
  await bar.getByRole('link', { name: 'Releases' }).waitFor({ timeout: 30000 });
  assert.deepEqual((await bar.getByRole('link').allInnerTexts()).map(text => text.trim()).filter(Boolean).slice(0, 5), ['Overview', 'Explorer', 'Journeys', 'Tests', 'Releases'], 'Docs is now Knowledge');

  // ---- Overview → Explorer down to a unit, read only ----
  await view.getByRole('heading', { name: 'Structure' }).waitFor({ timeout: 60000 });
  await view.getByRole('region', { name: 'GitHub' }).getByText(/Not on GitHub yet/).waitFor();
  await view.getByRole('button', { name: /API server/ }).click();
  await view.getByRole('link', { name: 'POST /api/sign-up' }).first().click();
  await view.getByRole('heading', { name: 'POST /api/sign-up', level: 2 }).waitFor();
  await view.locator('.lay-cx-src tr.lay-cx-hl').first().waitFor();
  assert.match(await view.locator('.lay-cx-srcbar').innerText(), /server\/server\.mjs[\s\S]*lines \d+–\d+/);
  assert.equal(await view.locator('.lay-cx-src textarea, .lay-cx-src [contenteditable]').count(), 0, 'source is read only');
  // A change request becomes Work in this layer (views never name it).
  await view.getByLabel(/What should change/).fill('Ask for the name before the email');
  await view.getByRole('button', { name: 'Add to Work' }).click();
  await page.getByText('Added to Work.').waitFor();
  const knowledge = await request('GET', `/api/projects/${project.id}/knowledge`);
  const asked = knowledge.knowledge.work.find(item => /Ask for the name/.test(item.context?.suggestion || '') || /sign-up/.test(item.title));
  assert.equal(asked?.layer, 'platform', 'the request is Code\'s Work');

  // ---- Journeys: none yet, then one committed in the repository as Work would, read back after a sync ----
  await bar.getByRole('link', { name: 'Journeys' }).click();
  await view.getByText(/No journeys yet/).waitFor();
  const journey = { version: 1, id: 'sign-up', title: 'Sign up and borrow', origin: 'observed', revision: 1, persona: 'newcomer', proof: { commit: git('rev-parse', 'main'), status: 'passed' },
    steps: [{ id: 'start', name: 'Open sign-up', route: '/sign-up', trigger: 'Chooses Join', expected: 'Sees the sign-up form', test: 'sign-up.spec.mjs#start' },
      { id: 'borrow', name: 'Borrow a tool', route: '/tools', trigger: 'Signs up', expected: 'Asks to borrow a drill' }] };
  writeFileSync(join(workspace, '.aludel/outputs/journeys.json'), `${JSON.stringify({ journeys: [journey] }, null, 2)}\n`);
  git('add', '.aludel/outputs/journeys.json');
  execFileSync('git', ['-C', workspace, '-c', 'user.name=Ada', '-c', 'user.email=ada@example.com', 'commit', '-q', '-m', 'Journeys: sign-up observed'], { encoding: 'utf8' });
  await request('POST', `/api/projects/${project.id}/layers/platform/sync`, {});
  const journeys = (await request('GET', `/api/projects/${project.id}/library?kind=journey&layer=platform&data=1`)).results;
  assert.deepEqual(journeys.map(entry => [entry.ref, entry.data.steps.map(step => step.id)]), [['journey-sign-up', ['start', 'borrow']]], 'the journey is Code\'s output, with its step IDs');
  await page.goto(origin + base + '/code/journeys/sign-up');
  await view.getByRole('heading', { name: 'Sign up and borrow' }).waitFor({ timeout: 60000 });
  await view.getByText('1 of 2 steps tested').waitFor();
  await view.getByText('sign-up.spec.mjs#start').waitFor();
  await view.getByText('No test yet').waitFor();
  await view.getByText(/proven by a run that passed at/).waitFor();
  await axe(page.frames().find(value => /\.layers\./.test(value.url())), 'Code frame (journeys)');
  if (process.env.CODE_JOURNEYS_SHOT) await page.screenshot({ path: process.env.CODE_JOURNEYS_SHOT });

  // ---- Tests ----
  await bar.getByRole('link', { name: 'Tests' }).click();
  await view.getByText(/^\d+ tests$/).waitFor();
  assert.equal(await view.getByText(/scenarios with a test|Given/).count(), 0, 'no story-scenario coverage (code tracing was removed)');

  // ---- Releases: recorded in the repository, with a tag, and in the Library ----
  await bar.getByRole('link', { name: 'Releases' }).click();
  await view.getByRole('heading', { name: 'Next release' }).waitFor();
  await view.getByRole('button', { name: /^Record v0\.1\.0/ }).click();
  await view.getByRole('heading', { name: 'v0.1.0' }).waitFor();
  assert.match(git('show', 'main:.aludel/outputs/releases.json'), /"version": "0.1.0"/);
  assert.ok(git('tag', '--list', 'v0.1.0'), 'a local tag');
  const releases = (await request('GET', `/api/projects/${project.id}/library?kind=code_release&source=output&data=1`)).results;
  assert.deepEqual(releases.map(entry => [entry.layer.key, entry.data.version]), [['platform', '0.1.0']]);

  // ---- Knowledge: the app's docs, with the checks every layer's docs get, and a save that commits there ----
  await page.goto(origin + base + '/code/knowledge');
  await page.getByRole('button', { name: 'In the repository' }).waitFor();
  await page.getByRole('link', { name: 'Stories and their acceptance' }).click();
  await page.getByText(/Name a test after the scenario/).first().waitFor();
  const listed = await request('GET', `/api/projects/${project.id}/layers/platform/knowledge/docs`);
  assert.ok(listed.docs.some(doc => doc.path === '/AGENTS.md' && doc.map), 'AGENTS.md is the map');
  assert.deepEqual(listed.checks.offMap, [], 'every repository doc is on the map');
  const doc = await request('GET', `/api/projects/${project.id}/layers/platform/knowledge/doc?path=${encodeURIComponent('/docs/product/index.md')}`);
  await request('PUT', `/api/projects/${project.id}/layers/platform/knowledge/doc`, { path: '/docs/product/index.md', content: `${doc.content}\n\nNeighbours first.\n`, base: doc.commit });
  assert.match(git('show', 'main:docs/product/index.md'), /Neighbours first\./, 'the save is a commit at the repository path');
  assert.equal(git('log', '-1', '--format=%s'), 'Knowledge: docs/product/index.md');

  // ---- Accessibility and 390px ----
  await page.goto(origin + base + '/code/explorer');
  await view.getByRole('tree', { name: 'Files' }).waitFor({ timeout: 60000 });
  const frame = () => page.frames().find(value => /\.layers\./.test(value.url()));
  await axe(page, 'portal');
  await axe(frame(), 'Code frame (explorer)');
  await page.goto(origin + base + '/code');
  await view.getByRole('heading', { name: 'Structure' }).waitFor({ timeout: 60000 });
  await axe(frame(), 'Code frame (overview)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/code/releases/0.1.0');
  await view.getByRole('heading', { name: 'v0.1.0' }).waitFor({ timeout: 60000 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'no sideways scroll at 390px');
  await axe(frame(), 'Code frame (releases, 390px)');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS Code frame: installed in the app repository, Overview to a unit, change request as Code\'s Work, Journeys from the repository, Tests, release in the repository and Library, app docs in Knowledge with checks and a save, axe and 390px');
} finally {
  await browser.close();
}
