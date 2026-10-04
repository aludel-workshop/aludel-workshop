// J6 prototype v1 walkthrough: walks the review with visible controls only, takes screenshots at 1440x1000 and 390x844,
// runs axe at both widths, and checks for horizontal scroll at 390. Set PLAYWRIGHT_MODULE and AXE_PATH.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
import { mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = new URL('./index.html', import.meta.url).href;
const out = new URL('./shots/', import.meta.url).pathname; mkdirSync(out, { recursive: true });
const axe = readFileSync(process.env.AXE_PATH, 'utf8');
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/ERR_CERT|ERR_TOO_MANY_RETRIES|fonts\.g/.test(m.text()) && errors.push(m.text()));
// Fonts come from Google through the session's proxy, which Chromium reaches unreliably; curl (proxy-aware, retrying)
// fetches them instead, so screenshots never show icon names as text.
const fontCache = new Map();
await page.context().route(/fonts\.(googleapis|gstatic)\.com/, async route => { const url = route.request().url();
  if (!fontCache.has(url)) fontCache.set(url, execFileSync('curl', ['-sS', '--retry', '4', '--max-time', '30', '-A', await page.evaluate(() => navigator.userAgent), url], { maxBuffer: 64 << 20 }));
  await route.fulfill({ body: fontCache.get(url), contentType: url.includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }); });
// The icon font comes through the session proxy and sometimes fails; screenshots with ligature text are useless, so retry.
const load = async () => { for (let i = 0; i < 4; i++) { await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800);
  if (await page.evaluate(async () => { await document.fonts.ready; await document.fonts.load('20px "Material Symbols Rounded"', 'home'); return document.fonts.check('20px "Material Symbols Rounded"', 'home'); })) return; }
  errors.push('icon font did not load'); };
let n = 0; const shot = async name => { n++; await page.waitForTimeout(200); await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); await page.screenshot({ path: `${out}${String(n).padStart(2, '0')}-${name}.png` }); };
const step = async (label, fn) => { try { await fn(); } catch (e) { errors.push(`${label}: ${e.message.split('\n')[0]}`); } };
const audit = async label => { await page.evaluate(() => document.fonts.ready); await page.addScriptTag({ content: axe }); const r = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
  for (const v of r.violations) errors.push(`axe ${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`); };
const scenario = async (name, value) => { await page.click('[data-act="scenarios"]'); await page.check(`#scenarios input[name="${name}"]${value ? `[value="${value}"]` : ''}`); await page.click('#scenarios [data-act="close-drawer"]'); };
const unscenario = async name => { await page.click('[data-act="scenarios"]'); await page.uncheck(`#scenarios input[name="${name}"]`); await page.click('#scenarios [data-act="close-drawer"]'); };
const frameBtn = (side, text) => page.locator(`.fbody[data-side="${side}"] button`, { hasText: text }).first();

await load(); await shot('walk-step2'); await audit('wide walk');
// Walk claim 1 with visible controls: the steps rail, the app inside the preview, the note buttons.
await step('step 1', () => page.click('.stepbtn[data-step="0"]'));
await step('click Settings', () => frameBtn('proposed', 'Settings').click()); await shot('step1-reached');
await step('looks right 1', () => page.click('[data-note="looks-right"]'));
await step('next', () => page.click('[data-act="next"]'));
await step('click Invite', () => frameBtn('proposed', 'Invite teammate').click());
await step('looks right 2', () => page.click('[data-note="looks-right"]'));
await step('next 3', () => page.click('[data-act="next"]'));
await step('send', () => frameBtn('proposed', 'Send invite').click());
await step('change note', () => page.click('[data-note="change"]')); await step('type', () => page.fill('#ntext', 'Show who sent the invite next to Pending'));
await step('layer', () => page.selectOption('#nlayer', 'Pages')); await shot('step3-change-note'); await step('add', () => page.click('[data-act="addnote"]'));
await step('side by side', () => page.click('[data-view="side"]')); await shot('step3-side-by-side');
await step('proposed', () => page.click('[data-view="proposed"]'));
await step('next 4', () => page.click('[data-act="next"]'));
await step('join', () => frameBtn('proposed', 'Join Team Notes').click()); await step('accept', () => frameBtn('proposed', 'Join').click());
await shot('step4-newcomer'); await step('looks right 4', () => page.click('[data-note="looks-right"]'));
await step('shot', () => page.click('[data-act="shot"]')); await shot('test-screenshot'); await step('close lb', () => page.click('[data-act="close-lb"]'));
await step('hood', () => page.click('details.hood summary')); await page.evaluate(() => document.querySelector('details.hood').scrollIntoView()); await shot('under-the-hood');
await page.evaluate(() => scrollTo(0, 0));
await step('next claim', () => page.click('[data-act="nextclaim"]')); await shot('claim2-regression'); await audit('wide regression');
await step('holds', () => page.click('[data-cv="c2:holds"]'));
await step('claim 3', () => page.click('.claimview [data-claim="c3"]')); await step('c3 holds', () => page.click('[data-cv="c3:holds"]'));
await step('sign off', () => page.click('.claimview [data-claim="end"]')); await shot('signoff'); await audit('wide signoff');
await step('accept', () => page.click('[data-act="accept"]')); await shot('signoff-accepted');
// Exceptional states, through the visible scenario controls.
await scenario('sendTest', 'failed'); await shot('signoff-blocked-failed');
await step('c1', () => page.click('.claims [data-claim="c1"]')); await step('step 3', () => page.click('.stepbtn[data-step="2"]')); await shot('step3-failed'); await audit('wide failed');
await scenario('sendTest', 'passed'); await scenario('inviteTest', 'uncovered'); await step('step 2', () => page.click('.stepbtn[data-step="1"]')); await shot('step2-no-test');
await scenario('inviteTest', 'passed'); await scenario('fixture', 'missing'); await step('step 4', () => page.click('.stepbtn[data-step="3"]')); await shot('step4-no-fixture');
await step('anon', () => page.click('[data-act="anon"]')); await shot('step4-signed-out');
await scenario('fixture', 'present'); await scenario('preview', 'building'); await shot('building');
await scenario('preview', 'stopped'); await step('restart', () => page.click('[data-act="restart"]'));
await scenario('stale'); await shot('stale'); await step('refresh', () => page.click('[data-act="refresh"]'));
await scenario('source', 'pages'); await shot('pages-authority'); await scenario('source', 'code');
await step('questions', () => page.click('[data-act="questions"]')); await step('answer', () => page.fill('#a-Q1', 'test answer')); await shot('review-questions'); await audit('questions');
await step('close q', () => page.click('#questions [data-act="close-drawer"]'));
await step('reset', async () => { await page.click('[data-act="scenarios"]'); await page.click('[data-act="reset"]'); await page.click('#scenarios [data-act="close-drawer"]'); });
await step('answers kept', async () => { await page.click('[data-act="questions"]'); if (await page.inputValue('#a-Q1') !== 'test answer') throw new Error('reset lost the review answers'); await page.fill('#a-Q1', ''); await page.click('#questions [data-act="close-drawer"]'); });
// Narrow.
await page.setViewportSize({ width: 390, height: 844 }); await load();
const over = async label => { const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 0) errors.push(`horizontal scroll ${o}px at 390 on ${label}`); };
await over('walk'); await shot('phone-walk'); await audit('phone walk');
await step('phone step 3', async () => { await page.locator('.stepbtn[data-step="2"]').scrollIntoViewIfNeeded(); await page.click('.stepbtn[data-step="2"]'); });
await page.evaluate(() => document.querySelector('.sp').scrollIntoView()); await shot('phone-step-panel'); await over('step panel');
const sideHidden = await page.locator('[data-view="side"]').isHidden(); if (!sideHidden) errors.push('side by side should hide at 390');
await page.evaluate(() => scrollTo(0, 0));
await step('phone c2', () => page.click('.claims [data-claim="c2"]')); await over('regression');
await step('phone end', () => page.click('.claims [data-claim="end"]')); await over('signoff'); await shot('phone-signoff'); await audit('phone signoff');
// Clipped controls pass an overflow check, so also check every visible button sits inside the viewport.
const clipped = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && !b.closest('.claims,.steps ol,.drawer') && (r.right > innerWidth + 1 || r.left < -1); }).map(b => b.textContent.trim()).slice(0, 5));
if (clipped.length) errors.push('clipped at 390: ' + clipped.join(', '));
await browser.close();
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : `NO ERRORS · ${n} shots`);
