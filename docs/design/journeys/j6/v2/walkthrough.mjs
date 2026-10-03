// J6 prototype v2 walkthrough: walks the review with visible controls only, takes screenshots at 1440x1000 and 390x844,
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

await load(); await shot('claim1-card'); await audit('wide claim card');
const inFrame = (text, side = 'proposed') => page.locator(`.fbody[data-side="${side}"] button`, { hasText: text }).first();
const exact = (text, side = 'proposed') => page.locator(`.fbody[data-side="${side}"] button`).filter({ hasText: new RegExp(`^${text}$`) }).first();
const expectH = async want => { const h = await page.locator('#ph').innerText(); if (!h.includes(want)) throw new Error(`expected "${want}", saw "${h}"`); };
// Claim 1: walk it in the preview; each step's action moves the review on.
await step('walk', () => page.click('[data-act="walk"]')); await step('h step1', () => expectH('Open the team'));
await step('click Settings', () => exact('Settings').click()); await step('h step2', () => expectH('Open the invite form')); await shot('claim1-step2');
await step('click Invite', () => inFrame('Invite teammate').click()); await step('h step3', () => expectH('Send the invite'));
await step('expand test', () => page.click('details.proof summary')); await shot('claim1-step3-test-open');
await step('flag', () => page.click('[data-act="flagstep"]')); await step('empty flag refused', async () => { await page.click('[data-act="saveflag"]'); if (!await page.locator('#flagtext').isVisible()) throw new Error('a flag saved without a note'); });
await step('type flag', () => page.fill('#flagtext', 'Show who sent the invite next to Pending')); await shot('claim1-step3-flagging'); await step('save flag', () => page.click('[data-act="saveflag"]'));
await step('send', () => inFrame('Send invite').click()); await step('h card', () => expectH('Invite a teammate')); await shot('claim1-confirm-flagged');
await step('sign absent', async () => { if (await page.locator('[data-act="sign"]').count()) throw new Error('sign-off offered with a flagged step'); });
await step('confirm flag', () => page.click('[data-act="confirmflag"]')); await step('next claim', () => page.click('[data-act="nextclaim"]'));
// Claim 2: a different persona, its own journey.
await step('h c2', () => expectH('Accept an invite')); await step('walk 2', () => page.click('[data-act="walk"]'));
await step('join email', () => inFrame('Join Team Notes').click()); await step('side', () => page.click('[data-view="side"]')); await shot('claim2-step2-side-by-side');
await step('proposed', () => page.click('[data-view="proposed"]')); await step('join', () => exact('Join').click());
await step('h c2 card', () => expectH('Accept an invite')); await shot('claim2-confirm'); await step('sign c2', () => page.click('[data-act="sign"]'));
await step('next 3', () => page.click('[data-act="nextclaim"]')); await shot('claim3-regression'); await audit('wide regression');
await step('sign c3', () => page.click('[data-act="sign"]')); await step('next 4', () => page.click('[data-act="nextclaim"]'));
await step('flag c4', () => page.click('[data-act="flagclaim"]')); await step('note c4', () => page.fill('#flagtext', 'Subject says “You are invited”, not the team name')); await step('save c4', () => page.click('[data-act="saveflag"]'));
await shot('claim4-note-flagged'); await step('finish', () => page.click('[data-act="nextclaim"]')); await shot('finish-send-back'); await audit('wide finish');
await step('send back', () => page.click('[data-act="sendback"]'));
// The claims menu, and changing a decision.
await step('menu', () => page.click('[data-act="menu"]')); await shot('claims-menu'); await audit('menu');
await step('pick c4', () => page.click('#claimmenu [data-claim="c4"]')); await step('undecide', () => page.click('[data-act="undecide"]')); await step('sign c4', () => page.click('[data-act="sign"]'));
await step('menu 2', () => page.click('[data-act="menu"]')); await step('pick c1', () => page.click('#claimmenu [data-claim="c1"]')); await step('undecide c1', () => page.click('[data-act="undecide"]'));
await step('step row 3', () => page.click('.srow[data-step="2"]')); await step('unflag', () => page.click('[data-act="unflag"]')); await step('looks good', () => page.click('[data-act="next"]'));
await step('sign c1', () => page.click('[data-act="sign"]')); await step('to finish', async () => { await page.click('[data-act="menu"]'); await page.click('#claimmenu [data-claim="finish"]'); });
await shot('finish-accept'); await step('accept', () => page.click('[data-act="accept"]')); await shot('finish-accepted');
// Under the hood sits in the preview's bottom bar.
await step('hood', () => page.click('[data-act="hood"]')); await shot('under-the-hood'); await audit('hood'); await step('hood close', () => page.click('[data-act="hood"]'));
// Exceptional states, through the visible scenario controls.
await step('reset', async () => { await page.click('[data-act="scenarios"]'); await page.click('[data-act="reset"]'); await page.click('#scenarios [data-act="close-drawer"]'); });
await scenario('sendTest', 'failed'); await shot('claim1-blocked-failed'); await audit('failed');
await step('sign blocked', async () => { if (await page.locator('[data-act="sign"]').count()) throw new Error('sign-off offered with a failing claimed step'); });
await step('row 3 failed', () => page.click('.srow[data-step="2"]')); await shot('claim1-step3-failed');
await scenario('sendTest', 'passed'); await scenario('inviteTest', 'uncovered'); await step('card', () => page.click('[data-act="card"]')); await shot('claim1-no-test');
await scenario('inviteTest', 'passed'); await scenario('fixture', 'missing'); await step('c2', async () => { await page.click('[data-act="menu"]'); await page.click('#claimmenu [data-claim="c2"]'); }); await shot('claim2-no-fixture');
await scenario('fixture', 'present'); await scenario('preview', 'building'); await shot('building');
await scenario('preview', 'stopped'); await step('restart', () => page.click('[data-act="restart"]'));
await scenario('stale'); await shot('stale'); await step('refresh', () => page.click('[data-act="refresh"]'));
await step('questions', () => page.click('[data-act="questions"]')); await step('answer', () => page.fill('#a-Q1', 'test answer')); await shot('review-questions'); await audit('questions');
await step('close q', () => page.click('#questions [data-act="close-drawer"]'));
await step('reset 2', async () => { await page.click('[data-act="scenarios"]'); await page.click('[data-act="reset"]'); await page.click('#scenarios [data-act="close-drawer"]'); });
await step('answers kept', async () => { await page.click('[data-act="questions"]'); if (await page.inputValue('#a-Q1') !== 'test answer') throw new Error('reset lost the review answers'); await page.fill('#a-Q1', ''); await page.click('#questions [data-act="close-drawer"]'); });
// Narrow.
await page.setViewportSize({ width: 390, height: 844 }); await load();
const over = async label => { const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 0) errors.push(`horizontal scroll ${o}px at 390 on ${label}`); };
await over('card'); await shot('phone-card'); await audit('phone card');
await step('phone walk', () => page.click('[data-act="walk"]')); await step('phone settings', () => exact('Settings').click());
await page.evaluate(() => document.querySelector('.cp').scrollIntoView()); await shot('phone-step'); await over('step'); await audit('phone step');
const sideHidden = await page.locator('[data-view="side"]').isHidden(); if (!sideHidden) errors.push('side by side should hide at 390');
await step('phone finish', async () => { await page.click('[data-act="menu"]'); await page.click('#claimmenu [data-claim="finish"]'); }); await over('finish'); await shot('phone-finish');
const clipped = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && !b.closest('.drawer') && (r.right > innerWidth + 1 || r.left < -1); }).map(b => b.textContent.trim()).slice(0, 5));
if (clipped.length) errors.push('clipped at 390: ' + clipped.join(', '));
await browser.close();
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : `NO ERRORS · ${n} shots`);
