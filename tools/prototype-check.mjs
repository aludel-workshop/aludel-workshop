// Shared harness for clickable-prototype walkthroughs (AGENT-WORK-01 A0; distilled from the J6 walkthroughs).
// A walkthrough imports it, drives the page with visible controls, and ends with `await check.finish()`, which prints
// "NO ERRORS · n shots" or the list of errors and sets a failing exit code.
//
// What it does so each prototype doesn't rediscover it:
// - finds Playwright (PLAYWRIGHT_MODULE, else the cloud image's /opt/node-tools copy, else a normal import);
// - fetches Google Fonts with proxy-aware curl through a route, because Chromium reaches them unreliably through the
//   session proxy and icons then render as their names (which also produced a false axe contrast failure in J6);
// - refuses to trust a load until the icon font is in;
// - injects axe-core (AXE_PATH, else node_modules lookups); when axe can't be found it records an error, so a run
//   without axe never reports "no findings";
// - checks horizontal scroll and clipped buttons at narrow widths.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

async function playwright() {
  for (const spec of [process.env.PLAYWRIGHT_MODULE, '/opt/node-tools/node_modules/playwright/index.js', 'playwright'].filter(Boolean)) {
    try { return await import(spec); } catch {}
  }
  throw new Error('Playwright not found; set PLAYWRIGHT_MODULE');
}

function axeSource() {
  const tries = [process.env.AXE_PATH];
  for (const from of [process.cwd(), import.meta.dirname]) {
    try { tries.push(join(dirname(createRequire(join(from, 'x.js')).resolve('axe-core')), 'axe.min.js')); } catch {}
  }
  const found = tries.filter(Boolean).find(path => existsSync(path));
  return found ? readFileSync(found, 'utf8') : null;
}

export async function openPrototype({ url, shots, viewport = { width: 1440, height: 1000 }, iconFont = 'Material Symbols Rounded', ignoreConsole = /ERR_CERT|ERR_TOO_MANY_RETRIES|fonts\.g/ }) {
  const { chromium } = (await playwright()).default ?? await playwright();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(5000); // a missing control fails fast and is reported, instead of stalling the run
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && !ignoreConsole.test(m.text()) && errors.push(m.text()));
  const fontCache = new Map();
  await context.route(/fonts\.(googleapis|gstatic)\.com/, async route => {
    const href = route.request().url();
    if (!fontCache.has(href)) fontCache.set(href, execFileSync('curl', ['-sS', '--retry', '4', '--max-time', '30', '-A', await page.evaluate(() => navigator.userAgent), href], { maxBuffer: 64 << 20 }));
    await route.fulfill({ body: fontCache.get(href), contentType: href.includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
  });
  const axe = axeSource();
  if (!axe) errors.push('axe-core not found (set AXE_PATH); accessibility was NOT checked');
  if (shots) mkdirSync(shots, { recursive: true });
  let n = 0;
  const check = {
    page, browser, errors,
    async load() {
      for (let i = 0; i < 4; i++) {
        await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(600);
        if (await page.evaluate(async font => { await document.fonts.ready; await document.fonts.load(`20px "${font}"`, 'home'); return document.fonts.check(`20px "${font}"`, 'home'); }, iconFont)) return;
      }
      errors.push('icon font did not load; screenshots would show icon names');
    },
    async shot(name) {
      n++; await page.waitForTimeout(200);
      await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
      if (shots) await page.screenshot({ path: join(shots, `${String(n).padStart(2, '0')}-${name}.png`) });
    },
    async step(label, fn) { try { await fn(); } catch (e) { errors.push(`${label}: ${e.message.split('\n')[0]}`); } },
    async audit(label) {
      if (!axe) return;
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ content: axe });
      const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
      for (const v of result.violations) errors.push(`axe ${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`);
      check.audits = (check.audits || 0) + 1;
    },
    async narrow(label, { ignore = '.drawer' } = {}) {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 0) errors.push(`horizontal scroll ${over}px on ${label}`);
      const clipped = await page.evaluate(sel => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && !b.closest(sel) && (r.right > innerWidth + 1 || r.left < -1); }).map(b => b.textContent.trim()).slice(0, 5), ignore);
      if (clipped.length) errors.push(`clipped buttons on ${label}: ${clipped.join(', ')}`);
    },
    async finish() {
      await browser.close();
      console.log(errors.length ? `ERRORS\n${errors.join('\n')}` : `NO ERRORS · ${n} shots · ${check.audits || 0} axe audits`);
      if (errors.length) process.exitCode = 1;
    },
  };
  return check;
}
