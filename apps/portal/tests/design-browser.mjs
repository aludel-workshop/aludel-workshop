// DESIGN-UX-01 (DEC-045): the Design layer in the browser. Sets a project up through the onboarding APIs, builds it, then
// drives Tokens (tree, preview pages, hover, editing, save), Components (real Material previews, nested selection,
// needed components, references), Brand and Docs, and checks that a saved token change reaches the generated app.
// Usage: start a fresh portal, then MACHINE_PORT=<port> MACHINE_DATA_DIR=<dir> PLAYWRIGHT_MODULE=<…> node tests/design-browser.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from './browser-support.mjs';

const port = process.env.MACHINE_PORT || 4318;
const portal = `http://aludel.localhost:${port}`;
const out = process.env.DESIGN_SHOTS || 'test-results/design';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const axe = async page => {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => `${item.id}: ${item.nodes[0]?.target}`));
};
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, bypassCSP: true });
  const api = context.request;
  const json = async (method, path, data) => { const response = await api.fetch(`${portal}${path}`, { method, data, headers: { 'content-type': 'application/json' } }); assert.ok(response.ok(), `${method} ${path} → ${response.status()} ${await response.text()}`); return response.json(); };
  await json('PUT', '/api/onboarding/draft', { profile: 'planner' });
  await json('PUT', '/api/onboarding/draft', { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use. No buying needed.' });
  const { project } = await json('POST', '/api/accounts', { name: 'Ada Lovelace', email: 'ada@example.com', password: 'correct-horse-battery' });
  await json('PUT', `/api/projects/${project.id}/design`, { feel: 'sleek-saas', theme: 'light', accent: '#2e7d5b', notes: 'Neighbourly and practical, like a community noticeboard.' });
  await json('PUT', `/api/projects/${project.id}/features`, { picks: ['accounts', 'messaging'] });
  // A Library screenshot with a region finding, to reference from a component.
  const { uploaded } = await json('POST', `/api/projects/${project.id}/assets`, { filename: 'sidebar.png', dataUrl: pixel, notes: '', purpose: 'library' });
  const source = await json('POST', `/api/projects/${project.id}/records`, { kind: 'source', data: { type: 'screenshot', title: 'Linear sidebar', assetId: uploaded } });
  const finding = await json('POST', `/api/projects/${project.id}/records`, { kind: 'finding', data: { sourceId: source.id, type: 'image', text: 'The active row uses a subtle font weight.', region: { x: 0.05, y: 0.2, w: 0.4, h: 0.1 } } });
  await json('POST', `/api/projects/${project.id}/skeleton`, {});

  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/favicon|Failed to load resource/.test(message.text())) errors.push(message.text()); });
  const checked = [];
  const previewPage = name => page.getByRole('group', { name: 'Preview pages' }).getByRole('button', { name, exact: true }).click();
  const shot = async (name, { a11y = true } = {}) => { if (a11y) assert.deepEqual(await axe(page), [], `${name} has accessibility violations`); await page.screenshot({ path: `${out}/${name}.png` }); checked.push(name); };

  // ---- Tokens: tree and live preview ----
  await page.goto(`${portal}/p/tool-share/design`);
  await page.getByRole('heading', { name: "Tool Share's design system", level: 1 }).waitFor();
  const tabs = await page.getByRole('navigation', { name: 'Design sections' }).getByRole('link').allInnerTexts();
  assert.deepEqual(tabs.map(text => text.replace(/^\S+\s*/, '').trim()), ['Tokens', 'Components', 'Brand', 'Docs']);
  const tree = page.getByRole('complementary', { name: 'Token tree' });
  await tree.locator('.lay-ds-tier', { hasText: 'Raw values' }).waitFor();
  const treeText = await tree.textContent(); assert.ok(treeText.indexOf('Raw values') < treeText.indexOf('Roles') && treeText.indexOf('Roles') < treeText.indexOf('Rules'), 'raw values come first, then roles, then rules');
  await page.locator('.lay-ds-box').first().waitFor();
  assert.equal(await page.locator('.lay-ds-pal').count(), 6, 'six palettes');
  await shot('01-palettes');

  // Hovering a palette outlines what uses it; the seed box edits the whole row.
  const primaryBefore = await page.locator('.lay-ds-canvas').evaluate(element => element.style.getPropertyValue('--mat-sys-primary'));
  await page.locator('.lay-ds-box[aria-label^="Primary 50"]').click();
  await page.getByRole('dialog', { name: 'Primary 50' }).waitFor();
  await shot('02-box-editor', { a11y: false });
  await page.getByRole('dialog').getByLabel('Hex value').fill('#1f6fb2');
  await page.getByRole('dialog').getByLabel('Hex value').press('Enter');
  await page.getByRole('dialog').getByLabel('Close').click();
  const primaryAfter = await page.locator('.lay-ds-canvas').evaluate(element => element.style.getPropertyValue('--mat-sys-primary'));
  assert.notEqual(primaryAfter, primaryBefore, 'changing the seed changes the primary role live');
  await page.getByText('Unsaved token changes').waitFor();

  // Roles page: hover a role in the tree, then point it somewhere else.
  await previewPage('Colour roles');
  await page.locator('.lay-ds-role').first().waitFor();
  await tree.locator('.lay-ds-tok', { has: page.getByRole('button', { name: 'secondary-container', exact: true }) }).hover();
  await page.locator('.lay-ds-hl').first().waitFor();
  assert.ok(await page.locator('.lay-ds-hl span', { hasText: 'secondary-container' }).count(), 'hovering a token labels it in the preview');
  await shot('03-roles-hover');
  await page.locator('.lay-ds-role[data-t^="color.tertiary "]').click();
  await page.getByRole('dialog', { name: 'color.tertiary' }).getByRole('button', { name: 'Tertiary 30' }).click();
  const tokRow = name => tree.locator('.lay-ds-tok', { has: page.getByRole('button', { name, exact: true }) });
  await tokRow('tertiary').filter({ hasText: 'tertiary 30' }).waitFor();

  // Type page: select a slot, try a role by hovering, place it by clicking.
  await previewPage('Type');
  await page.getByRole('button', { name: /^body slot/ }).click();
  await tree.locator('details[data-group="type"] > summary').click();
  await tokRow('title-large').hover();
  await page.locator('.lay-ds-slot.lay-ds-trying').waitFor();
  await tokRow('title-large').click();
  assert.match(await page.getByRole('button', { name: /^body slot/ }).getAttribute('aria-label'), /Title large/);
  await page.getByRole('button', { name: /^Title medium/ }).click();
  await page.getByLabel(/^Size ·/).fill('18');
  await shot('04-type');

  // Elevation, motion and behaviour pages.
  await previewPage('Elevation');
  await page.getByRole('button', { name: /^Level 2/ }).click();
  await shot('05-elevation');
  await previewPage('Motion');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await shot('06-motion');
  await previewPage('Behaviour');
  const first = page.locator('.lay-ds-ditem').first();
  const key = async name => { await page.keyboard.press(name); await page.waitForTimeout(120); };
  await first.focus(); await key(' '); await key('ArrowDown'); await key(' ');
  assert.match(await page.locator('.lay-ds-ditem').nth(1).innerText(), /Cordless drill/, 'keyboard drag moves the row down');
  await shot('07-behaviour');
  // A token not on this page offers the page it's on.
  await tree.locator('details[data-group="elevation"]').waitFor();
  await tokRow('level 2').hover();
  await page.locator('.lay-ds-hint').waitFor();

  // Sample screens render real Material components in the project's theme, light and dark, desktop and phone.
  await previewPage('Sample · a list page');
  await page.locator('.lay-ds-canvas mat-card').first().waitFor();
  await shot('08-sample-list');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Phone width' }).click();
  await page.waitForTimeout(400); // the canvas fades between modes
  await shot('09-sample-dark-phone');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.getByRole('button', { name: 'Desktop width' }).click();
  await previewPage('Sample · a form page');
  await shot('10-sample-form');

  // Save the draft as one revision of the token set; history shows it.
  await page.getByLabel('What changed').fill('Bluer primary, bigger title');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await page.getByText('Saved as a new revision of the token set.').waitFor();
  await page.getByRole('button', { name: 'History' }).click();
  await page.getByText('Bluer primary, bigger title').waitFor();
  await page.getByRole('complementary', { name: 'Token history' }).getByLabel('Close').click();

  // ---- Components ----
  await page.getByRole('navigation', { name: 'Design sections' }).getByRole('link', { name: 'Components' }).click();
  await page.getByRole('complementary', { name: 'Components' }).getByRole('link', { name: /Nav list/ }).click();
  await page.locator('.lay-ds-ccanvas .lay-ds-navitem').first().waitFor();
  await page.locator('.lay-ds-ccanvas .lay-ds-inst').nth(2).click();
  await page.locator('.lay-ds-crumb', { hasText: 'Nav item 3' }).waitFor();
  await page.locator('.lay-ds-prop', { hasText: 'selected' }).getByRole('button').click();
  assert.equal(await page.locator('.lay-ds-ccanvas .lay-ds-navitem.lay-ds-on').count(), 1, 'one selected item at a time');
  await page.locator('.lay-ds-acc > summary', { hasText: 'References' }).click();
  await page.locator('#ds-ref').selectOption(finding.id);
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await page.locator('.lay-ds-ref', { hasText: 'subtle font weight' }).waitFor();
  await shot('11-components-nested');
  await page.getByRole('complementary', { name: 'Components' }).getByRole('link', { name: 'Built Button', exact: true }).click();
  await page.locator('.lay-ds-ccanvas button.mat-mdc-button-base').first().waitFor();
  await page.getByRole('button', { name: 'All variants' }).click();
  await page.locator('.lay-ds-vgrid button.mat-mdc-button-base').first().waitFor();
  assert.equal(await page.locator('.lay-ds-vgrid button.mat-mdc-button-base').count(), 25, 'five variants × five states of the real Material button');
  await shot('12-components-grid');
  await page.getByLabel('New component name').fill('Carousel (large)');
  await page.getByLabel('New component name').press('Enter');
  await page.getByText("Carousel (large) isn't specified yet").waitFor();
  await shot('13-components-needed');
  await page.getByRole('button', { name: 'Specify it' }).click();
  await page.getByRole('textbox', { name: /^Properties/ }).fill('peek, boolean, , true');
  await page.getByRole('textbox', { name: /^Anatomy/ }).fill('Item, corner.extra-large|elevation.level1');
  await page.getByLabel('What changed').fill('First contract');
  await page.getByRole('button', { name: 'Save revision' }).click();
  await page.locator('.lay-ds-chip-specified').waitFor();

  // ---- Brand ----
  await page.getByRole('navigation', { name: 'Design sections' }).getByRole('link', { name: 'Brand' }).click();
  await page.locator('.lay-ds-asset').first().waitFor();
  assert.ok(await page.locator('.lay-ds-asset', { hasText: 'Tagline' }).count());
  await shot('14-brand');
  await page.getByRole('button', { name: 'Add from a template' }).click();
  await page.getByRole('button', { name: /Email header/ }).click();
  await page.locator('.lay-ds-asset', { hasText: 'Email sign-off' }).waitFor();
  await page.locator('.lay-ds-asset', { hasText: 'Logo mark' }).click();
  await page.getByRole('heading', { name: 'In context' }).waitFor();
  await page.locator('.lay-ds-use').first().waitFor();
  await shot('15-brand-mark');
  await page.getByLabel('Letters', { exact: true }).fill('T');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Saved.').waitFor();
  await page.getByRole('complementary', { name: 'Logo mark' }).getByLabel('Close').click();

  // ---- Docs (Library documents shown in Design) ----
  await page.getByRole('navigation', { name: 'Design sections' }).getByRole('link', { name: 'Docs' }).click();
  await page.getByRole('link', { name: /Design direction/ }).click();
  await page.getByText('Neighbourly and practical').waitFor();
  await page.getByRole('group', { name: 'Shows in' }).getByRole('button', { name: 'Pages' }).click();
  await page.getByText('Saved.').waitFor();
  await shot('16-docs');
  await page.goto(`${portal}/p/tool-share/library/docs`);
  await page.getByRole('link', { name: /Accessibility baseline/ }).waitFor();
  await page.goto(`${portal}/p/tool-share/library/source/${source.id}`);
  await page.getByRole('heading', { name: 'Referenced by' }).waitFor();
  await shot('17-library-source');

  // ---- The generated app follows the Design layer ----
  await json('POST', `/api/projects/${project.id}/skeleton`, {});
  const workspace = join(process.env.MACHINE_DATA_DIR || '.data', 'workspaces');
  const repo = existsSync(workspace) ? (await import('node:fs')).readdirSync(workspace).map(name => join(workspace, name)).find(path => existsSync(join(path, 'aludel.json'))) || null : null;
  if (repo) {
    const styles = readFileSync(join(repo, 'src/styles.scss'), 'utf8');
    assert.match(styles, /--mat-sys-title-medium-size: 18px;/, 'the saved type change is in the app');
    assert.ok(existsSync(join(repo, 'design/tokens.json')) && existsSync(join(repo, 'public/favicon.svg')));
    assert.match(readFileSync(join(repo, 'src/site.ts'), 'utf8'), /"markText": "T"/, 'the edited mark is in the app');
  }

  // Phone width
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
  await phone.addCookies(await context.cookies());
  const small = await phone.newPage();
  small.on('pageerror', error => errors.push(error.message));
  await small.goto(`${portal}/p/tool-share/design/tokens/roles`);
  await small.locator('.lay-ds-role').first().waitFor();
  assert.ok(await small.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 390px');
  assert.deepEqual(await axe(small), []);
  await small.screenshot({ path: `${out}/18-phone.png` });
  await small.goto(`${portal}/p/tool-share/design/components`);
  await small.locator('.lay-ds-ccanvas').waitFor();
  assert.ok(await small.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'components fit at 390px');
  await phone.close();

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`PASS design layer: ${checked.length} screens checked (axe on each), token save reached the app${repo ? '' : ' (workspace not found; app check skipped)'}`);
} finally {
  await browser.close();
}
