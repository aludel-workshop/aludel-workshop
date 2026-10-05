// EX-02A C0: screenshots of today's New project steps on a disposable portal (never the owner's data), as the
// baseline the connect-path prototype is drawn against. Usage: CHROMIUM_PATH=… PLAYWRIGHT_MODULE=… node docs/design/existing-projects/capture-current.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const portalDir = new URL('../../../apps/portal/', import.meta.url).pathname;
const out = new URL('./refs/', import.meta.url).pathname; mkdirSync(out, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-ex02a-'));
const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r));
const server = spawn(process.execPath, ['server/server.mjs'], { cwd: portalDir, env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_LAYER_TEMPLATES_ENABLED: '1', MACHINE_PREVIEW_RUNTIME: 'process' }, stdio: 'ignore' });
const base = `http://aludel.localhost:${port}`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/api/session')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const [name, path] of [['00-landing', '/'], ['01-start', '/start']]) {
    await page.goto(base + path); await page.waitForTimeout(1500); await page.screenshot({ path: join(out, `current-${name}.png`), fullPage: true });
  }
  // Walk the pre-account steps by clicking the first choice and Continue on each.
  for (let step = 2; step < 6; step++) {
    const choice = page.locator('main button, main [role=radio], main input[type=radio]').first();
    if (await choice.count()) await choice.click().catch(() => {});
    const name = page.locator('main input[type=text], main textarea').first();
    if (await name.count()) await name.fill('Tool Share').catch(() => {});
    const next = page.getByRole('button', { name: /continue|next/i }).first();
    if (!(await next.count())) break;
    await next.click().catch(() => {}); await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `current-0${step}-${new URL(page.url()).pathname.split('/').filter(Boolean).pop() || 'step'}.png`), fullPage: true });
  }
} finally { await browser.close(); server.kill(); rmSync(root, { recursive: true, force: true }); }
console.log('captured');
