// CUSTOM-LAYER-01 editor pass: drives the Markdown layer's VS Code-like editor end to end on a fresh portal.
// Run through tools/browser-checks.sh markdown-editor (build first). Screenshots go to MACHINE_DATA_DIR/markdown-editor-shots.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { chromium } from './browser-support.mjs';

const origin = `http://aludel.localhost:${process.env.MACHINE_PORT || 4318}`;
const out = `${process.env.MACHINE_DATA_DIR || '/tmp'}/markdown-editor-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if ((msg.type() === 'error' && !/status of 409/.test(msg.text())) || /sanitiz/i.test(msg.text())) errors.push(msg.text()); });
page.on('dialog', dialog => dialog.accept());
const request = async (method, path, data) => {
  const response = await context.request.fetch(origin + path, { method, data, headers: { 'content-type': 'application/json' } });
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
};
const shot = name => page.screenshot({ path: `${out}/${name}.png` });
const step = name => console.log('ok', name);
async function audit(name) {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('aludel-markdown-layer'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`));
  assert.deepEqual(violations, [], `${name} axe`);
  step(`axe clean: ${name}`);
}
// The overlay only works if the textarea wraps exactly like the coloured mirror beneath it.
async function aligned(label) {
  const result = await page.evaluate(() => {
    const input = document.querySelector('.mde-input'), lines = document.querySelector('.mde-lines');
    const before = input.style.height; input.style.height = '0px'; const content = input.scrollHeight; input.style.height = before;
    return { content, mirror: lines.offsetHeight, rows: lines.children.length };
  });
  assert.ok(Math.abs(result.content - result.mirror) <= 1, `${label} overlay misaligned ${JSON.stringify(result)}`);
  step(`overlay aligned: ${label} ${JSON.stringify(result)}`);
}

try {
  await page.goto(origin + '/start');
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: /Continue/i }).first().click();
  const name = `MDE ${randomBytes(3).toString('hex')}`;
  await page.getByRole('textbox', { name: 'App name' }).fill(name);
  await page.getByRole('textbox', { name: 'Elevator pitch' }).fill('Check the Markdown layer editor.');
  await page.getByRole('button', { name: /Continue/i }).first().click();
  await page.getByRole('button', { name: 'Start with no layers' }).click();
  await request('POST', '/api/accounts', { name: 'MDE tester', email: `mde-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
  const project = (await request('GET', '/api/session')).projects.find(value => value.name === name);
  const layer = await request('POST', `/api/projects/${project.id}/layer-definitions`, { name: 'Research' });
  const md = `/api/projects/${project.id}/layers/${layer.key}/markdown`;
  await request('POST', `${md}/folders`, { path: 'interviews' });
  await request('POST', `${md}/folders`, { path: 'interviews/2026' });
  await request('POST', `${md}/files`, { path: 'README.md', content: '# Research\n\nNotes from **customer interviews**. See [Alice](interviews/alice.md).\n\n- [x] Recruit\n- [ ] Synthesise\n' });
  await request('POST', `${md}/files`, { path: 'interviews/alice.md', content: `# Alice\n\n> Wants fewer tools.\n\n## Quotes\n\n1. "I copy things between five tabs."\n2. Uses \`notion\` daily.\n\n| Topic | Signal |\n| --- | --- |\n| Tools | strong |\n\n${'A very long paragraph that should wrap across several visual lines in the editor so the overlay alignment is tested properly. '.repeat(4)}\n\n\`\`\`\nconst x = 1;\n\`\`\`\n` });
  step('seeded project and Research layer');

  await page.goto(`${origin}/p/${project.slug}/${layer.key}/editor`);
  await page.locator('.mde-row', { hasText: 'README.md' }).waitFor();
  await shot('01-explorer');
  const rows = await page.locator('.mde-row').allInnerTexts();
  assert.deepEqual(rows.map(r => r.trim()), ['interviews', '2026', 'alice.md', 'README.md'], 'folders first, expanded top level');
  step('tree lists folders first');

  // Single click opens a preview tab; a second single click replaces it; double-click keeps it.
  await page.locator('.mde-row', { hasText: 'README.md' }).click();
  await page.locator('.mde-tab.preview', { hasText: 'README.md' }).waitFor();
  await page.locator('.mde-row', { hasText: 'alice.md' }).click();
  await page.locator('.mde-tab.preview', { hasText: 'alice.md' }).waitFor();
  assert.equal(await page.locator('.mde-tab').count(), 1, 'preview tab replaced');
  await page.locator('.mde-row', { hasText: 'alice.md' }).dblclick();
  await page.locator('.mde-tab:not(.preview)', { hasText: 'alice.md' }).waitFor();
  await page.locator('.mde-row', { hasText: 'README.md' }).dblclick();
  await page.locator('.mde-tab:not(.preview)', { hasText: 'README.md' }).waitFor();
  await page.waitForTimeout(200);
  console.log(await page.locator('.mde-tab').evaluateAll(tabs => tabs.map(t => t.className + ' ' + t.getAttribute('data-tab') + ' ' + t.textContent.trim())));
  assert.equal(await page.locator('.mde-tab').count(), 2, 'two pinned tabs');
  step('preview and pinned tabs');
  await page.locator('.mde-tab', { hasText: 'alice.md' }).click();
  await page.locator('.mde-crumbs li.file', { hasText: 'alice.md' }).waitFor();
  await aligned('alice (wrapped paragraph, table, fence)');
  await shot('02-editor');

  // Inline create inside a folder via its hover action.
  await page.locator('.mde-row', { hasText: /^\s*interviews/ }).first().hover();
  await page.locator('.mde-row', { hasText: /^\s*interviews/ }).first().locator('.mde-new-file').click();
  const input = page.locator('.mde-name-input');
  await input.fill('bob');
  await shot('03-inline-new-file');
  await input.press('Enter');
  await page.locator('.mde-tab.active', { hasText: 'bob.md' }).waitFor();
  assert.ok(await page.locator('.mde-row', { hasText: 'bob.md' }).count(), 'bob.md in tree');
  step('inline new file in folder, .md appended, opened in tab');

  const editor = page.locator('.mde-input');
  await editor.click();
  await page.keyboard.type('# Bob\n\n- first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  assert.equal(await editor.inputValue(), '# Bob\n\n- first\n- second', 'list continues on Enter');
  await page.locator('.mde-tab.dirty', { hasText: 'bob.md' }).waitFor();
  await page.keyboard.press('Control+z');
  assert.notEqual(await editor.inputValue(), '# Bob\n\n- first\n- second', 'undo works after list continuation');
  await page.keyboard.press('Control+Shift+z');
  await page.keyboard.press('Control+s');
  await page.locator('.mde-tab:not(.dirty)', { hasText: 'bob.md' }).waitFor();
  await page.locator('.mde-rev', { hasText: 'r2' }).waitFor();
  assert.match(await page.locator('.mde-status').innerText(), /Saved/);
  step('typing, list continuation, undo, Ctrl+S saves r2');

  // Nested path from the explorer header creates missing folders.
  await page.locator('.mde-side').hover();
  await page.getByRole('button', { name: 'New file', exact: true }).click();
  await input.fill('plans/q4/roadmap');
  await input.press('Enter');
  await page.locator('.mde-tab.active', { hasText: 'roadmap.md' }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.mde-crumbs li')].map(li => li.textContent.trim()).join('/') === 'plans/q4/roadmap.md');
  step('nested new file creates folders; breadcrumbs');

  // Refused names stay in the box with the reason.
  await page.locator('.mde-side').hover();
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  await input.fill('interviews');
  await input.press('Enter');
  await page.locator('.mde-input-error').waitFor();
  await shot('04-inline-error');
  await input.press('Escape');
  await input.waitFor({ state: 'detached' });
  step('refused name shows inline error; Escape cancels');

  // Context-menu rename of a folder keeps open tabs on the same files.
  await page.locator('.mde-row', { hasText: /^\s*interviews/ }).first().click({ button: 'right' });
  await shot('05-context-menu');
  await page.getByRole('menuitem', { name: /Rename/ }).click();
  await input.fill('people');
  await input.press('Enter');
  await page.locator('.mde-row', { hasText: /^\s*people/ }).first().waitFor();
  await page.locator('.mde-tab', { hasText: 'bob.md' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.mde-crumbs li')].map(li => li.textContent.trim()).join('/') === 'people/bob.md');
  step('folder rename via context menu; open tab follows');

  // Keyboard: F2 on a file, arrows, Enter.
  await page.locator('.mde-row', { hasText: 'README.md' }).click();
  await page.locator('.mde-row', { hasText: 'README.md' }).press('F2');
  await input.fill('index');
  await input.press('Enter');
  await page.locator('.mde-row', { hasText: 'index.md' }).waitFor();
  await page.locator('.mde-row', { hasText: 'index.md' }).press('ArrowUp');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-path'));
  assert.ok(focused && focused !== 'index.md', `arrow moved focus (${focused})`);
  step('F2 rename and arrow navigation');

  // Drag a file to the root.
  await page.locator('.mde-row', { hasText: 'bob.md' }).dragTo(page.locator('.mde-tree'), { targetPosition: { x: 60, y: 420 } });
  await page.waitForFunction(() => [...document.querySelectorAll('.mde-row')].some(row => row.getAttribute('data-path') === 'bob.md'));
  step('drag file to root moves it');

  // Split preview renders and relative .md links open the file.
  await page.locator('.mde-tab', { hasText: 'index.md' }).click();
  await page.getByRole('button', { name: 'Preview to the side' }).click();
  await page.locator('.mde-preview h1', { hasText: 'Research' }).waitFor();
  assert.equal(await page.locator('.mde-preview .md-check.done').count(), 1);
  await shot('06-split-preview');
  await page.locator('.mde-tab', { hasText: 'alice.md' }).click();
  await page.locator('.mde-preview table').waitFor();
  await page.locator('.mde-crumbs li.file', { hasText: 'alice.md' }).waitFor();
  await page.locator('.mde-preview blockquote').waitFor();
  await aligned('alice in split view');
  step('split preview renders table, blockquote, tasks');
  await audit('split editor');

  // Close with middle-click; sidebar toggle; watermark.
  for (const tab of await page.locator('.mde-tab').all()) await page.locator('.mde-tab').first().click({ button: 'middle' });
  await page.locator('.mde-watermark').waitFor();
  await shot('07-watermark');
  await audit('empty editor');
  step('middle-click closes tabs; watermark shows');

  // Restored after reload: tabs and expansion are per-viewer conveniences.
  await page.locator('.mde-row', { hasText: 'alice.md' }).dblclick();
  await page.locator('.mde-tab:not(.preview)', { hasText: 'alice.md' }).waitFor();
  await page.waitForTimeout(300);
  await page.reload();
  await page.locator('.mde-tab', { hasText: 'alice.md' }).waitFor();
  step('open tab restored after reload');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `narrow horizontal overflow ${overflow}`);
  await aligned('narrow');
  await shot('08-narrow');
  step('390px: no horizontal page scroll');

  assert.deepEqual(errors, [], 'page errors');
  console.log('PASS markdown editor: tree, inline create/rename, tabs, save, drag move, split preview, axe, 390px');
} catch (error) {
  await shot('failure').catch(() => {});
  console.error(error); console.error('page errors:', errors); process.exitCode = 1;
} finally { await browser.close(); }
