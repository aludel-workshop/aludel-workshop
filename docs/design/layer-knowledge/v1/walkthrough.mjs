// v1 walkthrough: screenshots at 1600x1000, then 390 px checks. PLAYWRIGHT_MODULE=… node walkthrough.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
import { mkdirSync } from 'node:fs';
const base = new URL('./index.html', import.meta.url).href;
const out = new URL('./shots/', import.meta.url).pathname; mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/fonts/.test(m.text()) && errors.push(m.text()));
let n = 0; const shot = async (name, full = false) => { n++; await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); if (full) await page.addStyleTag({ content: '.proto,.side,.outline{position:static!important}' }); await page.screenshot({ path: `${out}${String(n).padStart(2, '0')}-${name}.png`, fullPage: full }); };
const step = async (label, fn) => { try { await fn(); } catch (e) { errors.push(`${label}: ${e.message.split('\n')[0]}`); } };
const goto = async h => { await page.goto(base + h); await page.waitForTimeout(400); };
await goto('#pages/doc/overview'); await page.waitForTimeout(1200); await shot('pages-overview');
await goto('#pages/doc/tab-kit'); await shot('pages-doc-kit-tab');
await goto('#pages/info'); await shot('pages-information');
await goto('#pages/node/pages'); await shot('pages-node-pages', true);
await goto('#pages/node/kit-brand'); await shot('pages-node-kit-brand');
await goto('#pages/binding/design-system'); await shot('binding-design-system', true);
await goto('#pages/tab/kit'); await shot('pages-kit-tab');
await goto('#personas/node/people'); await shot('personas-node-people', true);
await goto('#vision/binding/people'); await shot('binding-people-proposed', true);
await step('accept people', () => page.click('[data-act=accept]')); await shot('binding-people-accepted');
await goto('#vision/info'); await shot('vision-information');
// Branding takes the brand: select, propose with Design and Pages, renegotiates Design system.
await goto('#branding/info');
await step('select', () => page.click('.sec-h [data-act=select]'));
await step('tick guide', () => page.check('[data-pick="branding:guide"]'));
await step('tick logos', () => page.check('[data-pick="branding:logos"]')); await shot('branding-selecting');
await step('propose', () => page.click('[data-act=propose]'));
await step('with design', () => page.selectOption('#withLayer', 'design'));
await step('design brand', () => page.check('[data-with="design:brand"]'));
await step('with pages', () => page.selectOption('#withLayer', 'pages'));
await step('pages kit brand', () => page.check('[data-with="pages:kit-brand"]'));
await step('design hands over', () => page.check('[data-role=design][value=ceded]'));
await step('name', () => page.fill('#bname', "The app's brand"));
await step('statement', () => page.fill('#bstate', "Branding's guide and logos are the brand Design kept as brand assets and Pages draws as Kit › Brand. Branding leads; Design hands its assets over; Pages keeps a copy."));
await shot('branding-propose', true);
await step('submit', () => page.click('[data-act=submit]')); await shot('branding-proposed-binding', true);
await step('accept brand', () => page.click('[data-act=accept]')); await shot('branding-accepted');
await goto('#pages/info'); await shot('pages-after-brand');
await goto('#design/binding/design-system'); await shot('design-system-after', true);
// Edit a spec node and merge: creates the compare-specs task.
await goto('#personas/edit/node/people'); await step('type', async () => { await page.fill('#ed', 'Each file in `personas/` describes one persona.\n\n## Also\n- Add a **Quote** section with one real quote.'); }); await shot('edit-spec');
await step('save', () => page.click('[data-act=save-edit]')); await shot('spec-unmerged');
await step('merge', () => page.click('[data-act=merge]')); await page.waitForTimeout(200); await page.screenshot({ path: `${out}${String(++n).padStart(2, '0')}-spec-merged-toast.png` });
await page.setViewportSize({ width: 390, height: 844 });
for (const h of ['#pages/doc/overview', '#pages/info', '#pages/node/pages', '#pages/binding/design-system', '#vision/binding/people', '#pages/tab/kit', '#personas/edit/node/people']) {
  await goto(h);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 0) errors.push(`horizontal scroll ${over}px at 390 on ${h}: ` + await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.tbl,.lbar,pre')).slice(0, 4).map(el => el.tagName + '.' + el.className).join(' | ')));
}
await goto('#pages/node/kit'); await shot('phone-node');
await step('menu', () => page.click('[data-act=menu]')); await shot('phone-sidebar', true);
await browser.close();
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : `NO ERRORS · ${n} shots`);
