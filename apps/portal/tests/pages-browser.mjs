// PAGES-UX-01: the Pages layer in the browser. Sets Tool Share up through the onboarding APIs, builds it, then drives the Map
// (page blanks, links drawn from a handle, group moves, flows edited on the canvas), a page (spec editing, a change request
// that becomes Engineer work, content editing, Built through the preview bridge) and Flows (a review).
// Usage: start a fresh portal, then MACHINE_PORT=<port> PLAYWRIGHT_MODULE=<…> node tests/pages-browser.mjs
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from './browser-support.mjs';

const port = process.env.MACHINE_PORT || 4318;
const portal = `http://aludel.localhost:${port}`;
mkdirSync('test-results/pages', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const axe = async page => {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => `${item.id}: ${item.nodes[0]?.target}`));
};
const until = async (check, message, tries = 60) => { for (let i = 0; i < tries && !(await check()); i++) await new Promise(resolve => setTimeout(resolve, 250)); assert.ok(await check(), message); };

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, bypassCSP: true });
  const api = context.request;
  const json = async (method, path, data) => { const response = await api.fetch(`${portal}${path}`, { method, data, headers: { 'content-type': 'application/json' } }); assert.ok(response.ok(), `${method} ${path} → ${response.status()} ${await response.text()}`); return response.json(); };
  await json('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await json('PUT', '/api/onboarding/draft', { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = await json('POST', '/api/accounts', { name: 'Ada Lovelace', email: 'ada@example.com', password: 'correct-horse-battery' });
  await json('PUT', `/api/projects/${project.id}/design`, { feel: 'mobile-social', theme: 'light', accent: '#2e7d5b' });
  await json('PUT', `/api/projects/${project.id}/features`, { picks: ['accounts', 'messaging'] });
  await json('POST', `/api/projects/${project.id}/skeleton`, {});
  const running = async () => (await json('GET', `/api/projects/${project.id}/preview`)).preview.status === 'running';
  for (let i = 0; i < 120 && !(await running()); i++) await new Promise(resolve => setTimeout(resolve, 1000));
  const knowledge = async () => (await json('GET', `/api/projects/${project.id}/knowledge`)).knowledge;

  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const checked = [];
  const check = async name => { assert.deepEqual(await axe(page), [], `${name} has accessibility violations`); await page.screenshot({ path: `test-results/pages/${name}.png` }); checked.push(name); };
  const node = label => page.locator(`.lay-pg-node:has(.lay-pg-nt:text-is("${label}"))`);
  const drag = async (from, to) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + (to.x - from.x) * i / 12, from.y + (to.y - from.y) * i / 12); await page.mouse.up(); };
  const center = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

  // ---- Map ----
  await page.goto(`${portal}/p/tool-share/pages`);
  await node('Messages').waitFor();
  assert.ok(await page.locator('.lay-pg-node .lay-pg-nth').count() >= 12, 'every page shows desktop and phone in Both');
  await until(async () => (await page.locator('.lay-pg-frow').count()) >= 2, 'flows come from the story map');
  await check('map');
  await page.getByRole('button', { name: 'Phone', exact: true }).click();
  await until(async () => (await node('Messages').locator('.lay-pg-nth').count()) === 1, 'Phone shows one thumbnail per page');
  await page.getByRole('button', { name: 'Both', exact: true }).click();
  // A page blank, named and noted in place.
  await page.getByRole('button', { name: 'Page blank' }).click();
  await until(async () => (await page.locator('input[aria-label="Page title"]').count()) === 1, 'a page blank appears');
  await page.keyboard.type('Tool detail'); await page.keyboard.press('Enter');
  const blank = page.locator('.lay-pg-node:has(input[aria-label="Page title"])');
  await blank.locator('textarea').click(); await blank.locator('textarea').click();
  await page.keyboard.type('Photos, condition and the lender.');
  await page.getByRole('heading', { name: 'Flows' }).click();
  await until(async () => (await knowledge()).pages.some(entry => entry.label === 'Tool detail' && entry.notes === 'Photos, condition and the lender.'), 'the blank keeps its title and note');
  // A link drawn from Explore's handle to the blank, then named.
  const explore = node('Explore');
  await explore.hover();
  await drag(center(await explore.locator('.lay-pg-handle').boundingBox()), center(await blank.boundingBox()));
  const rename = page.getByLabel('What does someone do to get there?');
  await rename.waitFor(); await rename.fill('Tap a tool'); await rename.press('Enter');
  await page.locator('.lay-pg-llabel', { hasText: 'Tap a tool' }).waitFor();
  await until(async () => (await knowledge()).pages.find(entry => entry.label === 'Explore').links.some(link => link.label === 'Tap a tool'), 'the link is saved on the page it starts from');
  // Marquee select two pages and move them a column right together; a taken cell is refused.
  const before = await knowledge();
  const messagesBox = await node('Messages').boundingBox(), conversationBox = await node('Conversation').boundingBox();
  await drag({ x: messagesBox.x - 20, y: messagesBox.y + 40 }, { x: conversationBox.x + conversationBox.width - 20, y: conversationBox.y + 30 });
  assert.equal(await page.locator('.lay-pg-node.lay-pg-sel').count(), 2, 'the marquee selects both');
  const step = (await node('Profile').boundingBox()).x - messagesBox.x;
  const grab = { x: messagesBox.x + messagesBox.width / 2, y: messagesBox.y + messagesBox.height - 10 };
  await drag(grab, { x: grab.x + step * 3, y: grab.y });
  await until(async () => { const places = (await knowledge()).pageMap?.places || {}; const messages = before.pages.find(entry => entry.label === 'Messages'); const conversation = before.pages.find(entry => entry.label === 'Conversation');
    return places[messages.id]?.col === places[conversation.id]?.col && places[messages.id]?.row + 1 === places[conversation.id]?.row && places[messages.id]?.col >= 3; }, 'both move together, keeping their shape');
  const homeBox = await node('Home').boundingBox(), exploreBox = await node('Explore').boundingBox();
  await drag({ x: homeBox.x + homeBox.width / 2, y: homeBox.y + homeBox.height - 10 }, { x: exploreBox.x + exploreBox.width / 2, y: exploreBox.y + exploreBox.height - 10 });
  await page.getByText('That spot is taken, so the pages went back.').waitFor();
  // Editing a flow on the canvas: the blank becomes its last step.
  const flowTitle = (await page.locator('.lay-pg-fhd strong').last().innerText()).trim();
  await page.locator('.lay-pg-fhd').last().click();
  await page.getByText(`Editing ${flowTitle}`).waitFor();
  await blank.locator('.lay-pg-addstep').click();
  await page.getByText(new RegExp(`Tool detail is step \\d+ of ${flowTitle}`)).waitFor();
  await check('map-flow');

  // ---- A built page: spec draft → change request → Engineer work ----
  await page.getByRole('navigation', { name: 'Pages sections' }).getByRole('link', { name: 'Pages' }).click();
  const tree = page.getByRole('navigation', { name: 'Page tree' });
  await tree.getByRole('link', { name: /^Messages/ }).click();
  await page.locator('.lay-pg-right h2', { hasText: 'Messages' }).waitFor();
  await check('page-spec');
  await page.locator('.lay-pg-right').getByRole('button', { name: 'Edit spec' }).click();
  await page.getByLabel('Section name').fill('Conversations'); await page.locator('.lay-pg-addsec select').selectOption({ label: 'List' }); await page.getByRole('button', { name: 'Add section' }).click();
  await page.getByLabel('Section name').fill('Start a conversation'); await page.locator('.lay-pg-addsec select').selectOption({ label: 'Button' }); await page.getByRole('button', { name: 'Add section' }).click();
  await page.getByText('2 changes').waitFor();
  assert.ok(await page.locator('.lay-pg-app mat-list-item').count() >= 3, 'the List section renders the design system’s list');
  await page.getByRole('button', { name: 'Request this change' }).click();
  await page.getByRole('dialog').getByText('Work · Engineer · implement').waitFor();
  await page.getByLabel('What should change, and why').fill('People need their conversations and a way to start one.');
  await check('change-request');
  await page.getByRole('button', { name: 'Add to Work' }).click();
  await page.getByText(/is in Work as Engineer · implement\. Messages’s spec is at revision \d+\./).waitFor();
  const afterChange = await knowledge();
  const change = afterChange.work.find(item => item.title.startsWith('Messages: Add section'));
  assert.equal(change.action, 'platform.implement');
  assert.deepEqual(afterChange.pages.find(entry => entry.label === 'Messages').sections.map(section => section.name), ['Conversations', 'Start a conversation']);
  // Hovering names a section; content is edited in place.
  const section = page.locator('.lay-pg-app [data-sec]:not([data-sec="__shell"])').first();
  await section.hover();
  await page.locator('.lay-pg-ov .lay-pg-tag', { hasText: 'Conversations · List' }).waitFor();
  await page.getByRole('button', { name: 'Edit content' }).click();
  const heading = page.locator('.lay-pg-app [data-ct$=":title"]').first();
  await heading.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Your conversations');
  await page.locator('.lay-pg-cbar').click({ position: { x: 4, y: 4 } });
  await until(async () => (await knowledge()).pages.find(entry => entry.label === 'Messages').sections[0].content.title === 'Your conversations', 'content saves straight away');
  await check('page-content');
  // ---- A page blank: its spec is edited directly, then accepted (before the rebuild gives it a route) ----
  await tree.getByRole('link', { name: /^Tool detail/ }).click();
  await page.locator('.lay-pg-right').getByText('Note from the Map: Photos, condition and the lender.').waitFor();
  await page.locator('.lay-pg-right').getByRole('button', { name: 'Edit spec' }).click();
  await page.getByLabel('Section name').fill('Photos'); await page.locator('.lay-pg-addsec select').selectOption({ label: 'Card' }); await page.getByRole('button', { name: 'Add section' }).click();
  await page.getByPlaceholder('Why (saved with the revision)').fill('Sam decides from the photos first');
  await page.getByRole('button', { name: 'Save spec' }).click();
  await page.getByText(/Tool detail’s spec is saved as revision \d+\./).waitFor();
  await page.locator('.lay-pg-right').getByRole('button', { name: 'Accept spec' }).click();
  await page.getByText(/spec is accepted/).waitFor();
  const detail = (await knowledge()).pages.find(entry => entry.label === 'Tool detail');
  assert.equal(detail.status, 'designed');
  assert.ok(detail.history.some(entry => entry.rationale === 'Sam decides from the photos first'), 'the reason is kept with the revision');

  await tree.getByRole('link', { name: /^Messages/ }).click();
  await page.locator('.lay-pg-right h2', { hasText: 'Messages' }).waitFor();
  // Built: the running app, through its bridge, after the preview is rebuilt from the specs.
  await page.getByRole('button', { name: 'Built' }).click();
  await page.getByRole('button', { name: 'Update preview' }).click();
  await new Promise(resolve => setTimeout(resolve, 2000));
  for (let i = 0; i < 150 && !(await running()); i++) await new Promise(resolve => setTimeout(resolve, 1000));
  await page.getByRole('button', { name: 'Spec', exact: true }).click(); await page.getByRole('button', { name: 'Built' }).click();
  await page.getByText(/Every section in the spec is on the page \(2 still skeletons\)/).waitFor({ timeout: 20000 });
  const inFrame = await page.frameLocator('.lay-pg-frame iframe').locator('[data-aludel-section]').first().boundingBox();
  await page.mouse.move(inFrame.x + 20, inFrame.y + 10);
  await page.locator('.lay-pg-ov .lay-pg-tag', { hasText: 'Conversations · List · skeleton' }).waitFor();
  await page.mouse.click(inFrame.x + 20, inFrame.y + 10);
  await page.locator('.lay-pg-right h2', { hasText: 'Conversations' }).waitFor();
  await check('page-built');

  // ---- Flows: walk through and review ----
  await page.getByRole('navigation', { name: 'Pages sections' }).getByRole('link', { name: 'Flows' }).click();
  await page.locator('.lay-pg-fsi').first().waitFor();
  await page.getByRole('button', { name: 'Review this flow' }).click();
  await page.getByText('In review', { exact: true }).first().waitFor();
  await page.getByLabel('Note', { exact: true }).fill('Clear enough.');
  await page.getByRole('button', { name: 'Add note' }).click();
  await page.locator('.lay-pg-note', { hasText: 'Clear enough.' }).waitFor();
  if (await page.getByRole('button', { name: 'Next' }).isEnabled()) {
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Question' }).click();
    await page.getByLabel('Note', { exact: true }).fill('Should unread counts show on the tab?');
    await page.getByRole('button', { name: 'Add note' }).click();
    await page.locator('.lay-pg-note', { hasText: 'Should unread counts show on the tab?' }).waitFor();
    assert.equal(await page.locator('.lay-pg-fsi.lay-pg-on .lay-pg-n').innerText(), '2', 'the walkthrough stays on the step being reviewed');
  }
  await check('flows-review');
  await page.getByRole('button', { name: 'Finish review' }).click();
  await page.getByText(/Reviewed · /).waitFor();
  const reviewed = (await knowledge()).work.filter(item => item.action === 'pages.review');
  assert.equal(reviewed.length, 1); assert.equal(reviewed[0].state, 'done');

  // Phone width: no horizontal page scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('navigation', { name: 'Pages sections' }).getByRole('link', { name: 'Map' }).click();
  await node('Messages').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 391), 'no horizontal scroll at 390px');
  await check('map-phone');
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`PASS pages: ${checked.join(', ')}`);
} finally {
  await browser.close();
}
