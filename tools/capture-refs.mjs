#!/usr/bin/env node
// Captures reference screenshots for a UX pass and records what happened to each one.
//
//   node tools/capture-refs.mjs <targets.json> <out-dir>
//
// targets.json is a list of { "name", "url", "note"?, "width"?, "height"?, "fullPage"?, "waitMs"?,
// "selector"? (screenshot one element), "click"? (selectors to click first, e.g. a cookie banner),
// "scrollTo"? (a selector to scroll into view first) }.
//
// Writes <out-dir>/<name>.png (<name>.failed.png when the page is a wall) and merges a record per target into <out-dir>/manifest.json: the url asked for,
// the url that answered, the HTTP status, the page title, the access time, and why a capture failed (a bot
// check, a sign-in wall, a 404). The manifest is the evidence a work record cites, so a failed capture is
// recorded, not silently skipped. Public pages only: this never signs in and never uses a browser profile.
//
// A capture marked ok can still be the wrong page: look at every image before citing it.
//
// Playwright is found from PLAYWRIGHT_MODULE, then from the npx cache. Chromium headless shell must be installed.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const [targetsFile, outDir] = process.argv.slice(2);
if (!targetsFile || !outDir) { console.error('usage: node tools/capture-refs.mjs <targets.json> <out-dir>'); process.exit(2); }

function findPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return process.env.PLAYWRIGHT_MODULE;
  const npx = join(homedir(), '.npm', '_npx');
  for (const dir of existsSync(npx) ? readdirSync(npx) : []) {
    const candidate = join(npx, dir, 'node_modules', 'playwright', 'index.mjs');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Playwright not found. Set PLAYWRIGHT_MODULE, or run `npx playwright --version` once.');
}

// Signs that the page is not the page: recorded as the failure reason instead of a misleading screenshot.
const walls = [[/just a moment|verify you are human|captcha|cf-chl|access denied/i, 'bot check'],
  [/sign in to|log in to|please log in|sign up to continue/i, 'sign-in wall'], [/page not found|entity not found|404 not found|^404\b/i, 'not found']];

const { chromium } = await import(pathToFileURL(resolve(findPlaywright())).href);
const targets = JSON.parse(readFileSync(targetsFile, 'utf8'));
mkdirSync(outDir, { recursive: true });
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const browser = await chromium.launch();
for (const target of targets) {
  const context = await browser.newContext({ viewport: { width: target.width || 1440, height: target.height || 900 }, deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36' });
  const page = await context.newPage();
  const record = { url: target.url, note: target.note || '', accessed: new Date().toISOString() };
  try {
    const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(target.waitMs ?? 1500);
    for (const selector of target.click || []) await page.click(selector, { timeout: 3000 }).catch(() => {});
    if (target.scrollTo) await page.locator(target.scrollTo).first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    Object.assign(record, { status: response?.status() ?? null, finalUrl: page.url(), title: await page.title() });
    const text = `${record.title} ${(await page.locator('body').innerText().catch(() => '')).slice(0, 600)}`;
    const wall = (record.status >= 400 ? [[/./, `HTTP ${record.status}`]] : walls).find(([pattern]) => pattern.test(text));
    // A failed capture is kept for diagnosis under a name nobody will cite by mistake.
    const name = `${target.name}${wall ? '.failed' : ''}.png`; const file = join(outDir, name);
    if (target.selector) await page.locator(target.selector).first().screenshot({ path: file, timeout: 10000 });
    else await page.screenshot({ path: file, fullPage: Boolean(target.fullPage) });
    Object.assign(record, { file: name, ok: !wall, ...(wall ? { problem: wall[1] } : {}) });
  } catch (error) {
    Object.assign(record, { ok: false, problem: String(error.message || error).split('\n')[0] });
  }
  manifest[target.name] = record;
  console.log(`${record.ok ? 'ok  ' : 'FAIL'}  ${target.name}  ${record.problem || record.title || ''}`);
  await context.close();
}
await browser.close();
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
