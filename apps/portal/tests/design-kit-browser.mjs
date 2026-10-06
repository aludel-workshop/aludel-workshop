// W-29 #5 (DEC-070): Design's Components tab draws each component from the project's kit.js, on a stage framed from the
// Design instance's own origin. A prop edit, a state, All variants and dark mode reach the stage; a container shows its demo
// children; a component the kit can't draw says so and draws once it has a template; Copy tag gives the element's HTML.
// Screens and axe (the page and the stage) at 1440 and 390 px.
// Usage: npm run build, then MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/design-kit-browser.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { chromium } from './browser-support.mjs';
import { holdForPreview, stopPortal, waitForPortal } from './portal-support.mjs';

const dest = 'test-results/design-kit/';
mkdirSync(dest, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-design-kit-browser-'));
process.env.MACHINE_DATA_DIR = root;
process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
const password = 'correct-horse-battery';
const db = openDatabase(join(root, 'machine.sqlite'));
initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
const owner = createUser(db, { email: 'owner@example.com', name: 'Charles', password });
const { token } = flows.saveDraft(null, { profile: 'planner' });
flows.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
const project = flows.claimDraft(token, owner, owner).project;
know.ensureDesign(project.id);
const components = know.list(project.id, 'component', { layer: 'design' });
const idOf = name => components.find(component => component.name === name).id;
db.close();

const freePort = async wanted => { const probe = createServer(); await new Promise(resolve => probe.listen(wanted, '127.0.0.1', resolve)); const found = probe.address().port; await new Promise(resolve => probe.close(resolve)); return found; };
const port = await freePort(Number(process.env.JOURNEY_PORT || 0));
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_LAYER_TEMPLATES_ENABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
const portal = `http://localhost:${port}`, errors = [];
const browser = await chromium.launch({ headless: true });
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
let failed = false, page = null, serverLog = '';
server.stdout.on('data', chunk => serverLog = (serverLog + chunk).slice(-4000)); server.stderr.on('data', chunk => serverLog = (serverLog + chunk).slice(-4000));
try {
  await waitForPortal(server, portal);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  assert.ok((await context.request.post(`${portal}/api/sign-in`, { data: { email: 'owner@example.com', password } })).ok());
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  // Viewport screens with the stage scrolled into view: full-page captures of nested frames come out displaced.
  const shot = async name => { await ui.locator('.lay-ds-cstage').scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(150); await page.screenshot({ path: dest + name + '.png' }); };
  // The stage frame grows to what it draws: nothing is cut off.
  const fits = async label => {
    for (let tries = 0; ; tries++) {
      const [content, frame] = await Promise.all([stage().evaluate(() => document.documentElement.scrollHeight), ui.locator('iframe.lay-ds-stage').evaluate(node => node.clientHeight)]);
      if (content <= frame + 1) return;
      if (tries > 20) assert.fail(`the stage shows all it draws (${label}): content ${content}px, frame ${frame}px, set ${await ui.locator('iframe.lay-ds-stage').evaluate(node => node.style.height + ' / ' + getComputedStyle(node).height + ' / parent ' + node.parentElement.clientHeight + ' ' + getComputedStyle(node.parentElement).maxHeight)}, stage body ${await stage().evaluate(() => document.body.scrollHeight + ' ' + innerHeight)}`);
      await page.waitForTimeout(100);
    }
  };
  const tab = id => `/p/${project.slug}/design/components/${id}`;
  // Design's views run in their own frame on the instance's origin; the stage is framed inside them, on the same origin.
  const ui = page.frameLocator('iframe[src*="/index.html"]');
  const stageFrame = () => ui.frameLocator('iframe.lay-ds-stage');
  const stage = () => page.frames().find(frame => frame.url().includes('/published/'));
  const view = () => page.frames().find(frame => frame.url().includes('/index.html'));
  const audit = async label => {
    await page.evaluate(axe);
    const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(violations, [], `axe on the page: ${label}`);
    for (const frame of [view(), stage()].filter(Boolean)) {
      await frame.evaluate(axe);
      const inside = await frame.evaluate(async () => (await window.axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
      assert.deepEqual(inside, [], `axe in ${frame === stage() ? 'the stage' : "Design's view"}: ${label}`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll: ${label}`);
  };

  // The Button, drawn by the kit: the stage is on the Design instance's origin and loads kit.js by its digest.
  await page.goto(portal + tab(idOf('Button')));
  const button = stageFrame().locator('tool-button');
  await button.waitFor({ timeout: 180000 }); // a fresh portal builds Design's views on first open
  assert.match(stage().url(), /^http:\/\/i-[0-9a-f]{32}\.layers\.localhost:\d+\/published\/[0-9a-f]{20}\/stage\.html\?src=kit\.js$/);
  assert.equal(await button.locator('button').innerText(), 'Continue', 'the contract\'s demo label');
  await ui.getByText(/Drawn by this project's kit/).waitFor();
  await shot('01-button');

  // A prop and a state reach the stage; All variants draws each variant in each state.
  await ui.getByRole('textbox', { name: 'label' }).fill('Borrow it');
  await stageFrame().locator('tool-button button', { hasText: 'Borrow it' }).waitFor();
  await ui.getByRole('button', { name: 'hover', exact: true }).click();
  await stageFrame().locator('tool-button[state="hover"]').waitFor();
  await ui.getByRole('button', { name: 'All variants' }).click();
  await assert.doesNotReject(stageFrame().locator('.stage-grid').waitFor());
  assert.equal(await stageFrame().locator('tool-button').count(), 25, 'five variants by five states');
  await fits('all variants');
  await shot('02-button-variants');
  await audit('button variants at 1440');

  // Dark mode: the stage follows.
  await ui.getByRole('button', { name: 'Dark' }).click();
  await stageFrame().locator('html[data-theme="dark"]').waitFor();
  await shot('03-button-dark');
  await ui.getByRole('button', { name: 'Light' }).click();

  // A container shows its demo children: the card's two actions, and the page scaffold's navigation and content.
  await page.goto(portal + tab(idOf('Card')));
  await stageFrame().locator('tool-card > tool-button[slot="actions"]').nth(1).waitFor();
  assert.deepEqual(await stageFrame().locator('tool-card > tool-button').evaluateAll(nodes => nodes.map(node => node.getAttribute('label'))), ['Share', 'Open']);
  await page.goto(portal + tab(idOf('Page scaffold')));
  await stageFrame().locator('tool-page-scaffold > tool-nav-list > tool-nav-item').nth(2).waitFor();
  await stageFrame().locator('tool-page-scaffold > tool-card[slot="content"]').waitFor();
  await fits('page scaffold');
  await shot('04-scaffold');

  // A component the kit can't draw says so; with a template, it draws.
  const createdTile = await context.request.post(`${portal}/api/projects/${project.id}/layers/design/api/createComponent`, { data: { body: { component: { name: 'Option tile', group: 'Selection',
    props: [{ key: 'title', kind: 'text', default: 'Temperate woodland' }] } } } });
  assert.ok(createdTile.ok(), await createdTile.text());
  const tile = (await (await context.request.get(`${portal}/api/projects/${project.id}/knowledge`)).json()).knowledge.components.find(c => c.name === 'Option tile').id;
  await page.goto(portal + tab(tile));
  await ui.getByText('No way to draw it yet').waitFor();
  await shot('05-cant-draw');
  await ui.getByRole('button', { name: 'Add a template' }).click();
  const html = ui.getByRole('textbox', { name: /^HTML/ });
  await html.waitFor();
  assert.ok(await html.evaluate(node => node === document.activeElement), 'Add a template opens the template');
  await html.fill('<div class="tile"><b>{{title}}</b><slot></slot></div>');
  await ui.getByRole('textbox', { name: /^CSS/ }).fill('.tile{display:block;padding:var(--app-space-4);border-radius:var(--mat-sys-corner-large);background:var(--mat-sys-secondary-container);color:var(--mat-sys-on-secondary-container);font:var(--mat-sys-title-medium)}');
  await ui.getByRole('textbox', { name: /^Demo/ }).fill('title: Temperate woodland');
  await ui.getByRole('button', { name: 'Save revision' }).click();
  await stageFrame().locator('tool-option-tile .tile', { hasText: 'Temperate woodland' }).waitFor();
  await shot('06-template-drawn');

  // A template that would run something is refused, and says why.
  await ui.getByRole('button', { name: 'Edit contract' }).click();
  await ui.getByRole('textbox', { name: /^HTML/ }).fill('<img src=x onerror=alert(1)>');
  await ui.getByRole('button', { name: 'Save revision' }).click();
  await page.getByText(/can't contain event handlers/).waitFor(); // the portal's message bar, outside Design's frame
  await ui.getByRole('button', { name: 'Cancel' }).click();

  // Copy tag gives the element as HTML with what the panel set.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(portal + tab(idOf('Button')));
  await stageFrame().locator('tool-button').waitFor();
  await ui.getByRole('button', { name: 'Copy tag' }).click();
  // The notice shows in the portal's message bar. A frame may not be allowed the clipboard; then the notice carries the tag.
  const notice = page.getByText(/Copied the tag|The tag: </);
  await notice.waitFor();
  const said = await notice.innerText();
  const copied = said.startsWith('Copied') ? await view().evaluate(() => navigator.clipboard.readText()) : said.slice(said.indexOf('<'));
  assert.match(copied, /^<tool-button( [^>]*)? label="Continue"/);
  await audit('button at 1440');

  // Phone width: the side panel moves under the demo; the stage still draws.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(portal + tab(idOf('Card')));
  await stageFrame().locator('tool-card').waitFor();
  await fits('card at 390');
  await shot('07-card-390');
  await audit('card at 390');
  await page.setViewportSize({ width: 1440, height: 1000 });

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS design kit: the Components tab draws each component from kit.js on a stage on the Design instance\'s origin; a prop, a state, All variants and dark mode reach it; a card and a page scaffold show their demo children; a component the kit can\'t draw says so, takes a template and draws, and a template that would run something is refused; Copy tag gives the element\'s HTML; axe on the page and in the stage at 1440 and 390 px.');
  await holdForPreview({ port, path: tab(idOf('Button')), account: { email: 'owner@example.com', password } });
} catch (error) {
  failed = true;
  console.error(error);
  if (page) { await page.screenshot({ path: dest + 'failure.png', fullPage: true }).catch(() => {}); console.error('frames:', page.frames().map(frame => frame.url()), 'page errors:', errors); }
  console.error(serverLog.slice(-1500));
} finally {
  await browser.close();
  await stopPortal(server);
  rmSync(root, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
