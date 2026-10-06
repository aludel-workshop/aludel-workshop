// W-33 #2: a project's repositories in its settings. A fresh project (not Aludel-shaped) gets two companions from local bare
// repositories: one reachable with both its lines, one missing a line. The owner sets a close-out check on the project's own
// repository and a pin into a companion, then removes the other. Run through tools/browser-checks.sh project-repositories
// (build first), or `npm run preview -- project-repositories`. Screenshots go to MACHINE_DATA_DIR/repositories-shots.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from './browser-support.mjs';
import { holdForPreview, waitForPortal } from './portal-support.mjs';

let portalProcess = null;
if (process.env.JOURNEY_PORT) {
  const root = mkdtempSync(join(tmpdir(), 'aludel-repos-preview-'));
  portalProcess = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: process.env.JOURNEY_PORT, MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: ['ignore', 'pipe', 'pipe'] });
  process.env.MACHINE_PORT = process.env.JOURNEY_PORT;
  await waitForPortal(portalProcess, `http://127.0.0.1:${process.env.JOURNEY_PORT}`);
}
const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4318}`;
const out = process.env.REPOSITORIES_SHOTS || `${process.env.MACHINE_DATA_DIR || '/tmp'}/repositories-shots`;
mkdirSync(out, { recursive: true });

// Two companions as bare repositories the portal reads by file URL.
const fixtures = mkdtempSync(join(tmpdir(), 'aludel-repos-fixtures-'));
function bareRepository(name, branches) {
  const work = join(fixtures, `${name}-work`), bare = join(fixtures, `${name}.git`);
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', work]);
  execFileSync('git', ['-C', work, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '--quiet', '--allow-empty', '-m', 'start']);
  for (const branch of branches) execFileSync('git', ['-C', work, 'branch', branch]);
  execFileSync('git', ['clone', '--quiet', '--bare', work, bare]);
  return `file://${bare}`;
}
const kitUrl = bareRepository('design-kit', ['buttons']);
const docsUrl = bareRepository('handbook', []);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error' && !/status of 40[0349]/.test(msg.text())) errors.push(msg.text()); });
const request = async (method, path, data) => {
  const response = await context.request.fetch(origin + path, { method, data, headers: { 'content-type': 'application/json' } });
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
};
const shot = name => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
const step = name => console.log('ok', name);
async function audit(name, selector = 'main') {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async selector => (await window.axe.run(document.querySelector(selector), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    .violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`), selector);
  assert.deepEqual(violations, [], `${name} axe`);
}
const section = () => page.locator('aludel-project-repositories');
const entry = key => section().locator('li.lay-repo').filter({ has: page.locator('strong', { hasText: new RegExp(`^${key}$`) }) });
async function addCompanion({ key, url, path, lines }) {
  await section().getByRole('button', { name: 'Add a repository' }).click();
  const form = section().getByRole('form', { name: 'Repository' });
  await form.getByLabel('Name').fill(key);
  await form.getByLabel('Folder beside the project').fill(path);
  await form.getByLabel('Clone URL').fill(url);
  await form.getByLabel('Lines items may change, default first').fill(lines);
  await form.getByRole('button', { name: 'Add and check access' }).click();
  await entry(key).waitFor();
}

try {
  await page.goto(origin + '/start');
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: /Continue/i }).first().click();
  const name = `REPOS ${randomBytes(3).toString('hex')}`;
  await page.getByRole('textbox', { name: 'App name' }).fill(name);
  await page.getByRole('textbox', { name: 'Elevator pitch' }).fill('Neighbours lend and borrow tools.');
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.getByRole('button', { name: 'Start with no layers' }).click();
  const account = { email: `repos-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') };
  await request('POST', '/api/accounts', { name: 'Repositories tester', ...account });
  const project = (await request('GET', '/api/session')).projects.find(value => value.name === name);
  const base = `/p/${project.slug}`;

  await page.goto(origin + base + '/settings');
  await section().getByRole('heading', { name: 'Repositories' }).waitFor();
  await entry('app').waitFor();
  assert.match(await entry('app').innerText(), /The project's own[\s\S]*Local only/);
  step('the project’s own repository is listed, local until GitHub is connected');

  await addCompanion({ key: 'design-kit', url: kitUrl, path: 'vendor/design-kit', lines: 'main, buttons' });
  assert.match(await entry('design-kit').innerText(), /Reachable/);
  await addCompanion({ key: 'handbook', url: docsUrl, path: 'handbook', lines: 'main, drafts' });
  assert.match(await entry('handbook').innerText(), /Lines missing[\s\S]*has no drafts/);
  await shot('01-two-companions');
  step('companions added and checked: one reachable, one missing a line');

  // A credential in the URL is refused, and the form stays open with the message.
  await section().getByRole('button', { name: 'Add a repository' }).click();
  const form = section().getByRole('form', { name: 'Repository' });
  await form.getByLabel('Name').fill('leaky');
  await form.getByLabel('Clone URL').fill('https://me:secret@github.com/me/leaky.git');
  await form.getByRole('button', { name: 'Add and check access' }).click();
  await page.getByText(/Leave credentials out of the URL/).waitFor();
  await form.getByRole('button', { name: 'Cancel' }).click();
  step('a URL with credentials is refused');

  // The project's own repository: a pin into the design kit and a close-out check.
  await entry('app').getByRole('button', { name: 'Edit' }).click();
  const own = section().getByRole('form', { name: 'Repository' });
  await own.getByRole('button', { name: 'Add pins' }).click();
  await own.getByLabel('File').fill('config/kit-pins.json');
  await own.getByLabel('Repository').selectOption('design-kit');
  await own.getByLabel('Entries at').fill('pins.*');
  await own.getByRole('button', { name: 'Add a check' }).click();
  await own.getByLabel('Name', { exact: true }).fill('Kit pins resolve');
  await own.getByLabel('Command').fill('node tools/check-kit.mjs');
  await own.getByRole('button', { name: 'Save' }).click();
  await page.getByText('config/kit-pins.json').waitFor();
  assert.match(await entry('app').innerText(), /config\/kit-pins\.json → design-kit at pins\.\*[\s\S]*Kit pins resolve: node tools\/check-kit\.mjs/);
  await shot('02-pins-and-checks');
  step('pins and a close-out check on the project’s own repository');

  // A repository something pins into can't go; the other can.
  page.once('dialog', dialog => dialog.accept());
  await entry('design-kit').getByRole('button', { name: 'Remove' }).click();
  await page.getByText(/has references into design-kit/).waitFor();
  page.once('dialog', dialog => dialog.accept());
  await entry('handbook').getByRole('button', { name: 'Remove' }).click();
  await entry('handbook').waitFor({ state: 'detached' });
  const listed = await request('GET', `/api/projects/${project.id}/code/repositories`);
  assert.deepEqual(listed.repositories.map(repo => repo.key), ['app', 'design-kit']);
  step('removal is refused while pinned, and works otherwise');
  await audit('Repositories settings');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + base + '/settings');
  await entry('design-kit').waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `no horizontal scroll at 390px (${overflow})`);
  await shot('03-narrow');
  await audit('Repositories settings narrow');
  step('390px');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS project-repositories: own repository, companions with access, refusal, pins and checks, removal, narrow and axe');
  await holdForPreview({ port: process.env.MACHINE_PORT || 4318, path: `${base}/settings`, account });
} finally {
  await browser.close();
  portalProcess?.kill();
}
