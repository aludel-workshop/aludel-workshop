// Owner report 2026-10-02: a portal opened at http://localhost:<port> showed every layer frame as "refused to connect".
// Opens the portal at localhost and at 127.0.0.1 and checks a layer's own frame renders in both.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from './browser-support.mjs';

const port = process.env.MACHINE_PORT || 4318;
const browser = await chromium.launch({ headless: true });
try {
  for (const host of ['localhost', '127.0.0.1']) {
    const origin = `http://${host}:${port}`;
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const request = async (method, path, data) => { const response = await context.request.fetch(origin + path, { method, data, headers: { 'content-type': 'application/json' } }); assert.ok(response.ok(), `${method} ${path}: ${response.status()}`); return response.json(); };
    await request('PUT', '/api/onboarding/draft', { profile: 'planner' });
    await request('PUT', '/api/onboarding/draft', { name: `Loop ${randomBytes(3).toString('hex')}`, pitch: 'Neighbours lend and borrow tools they rarely use.' });
    const { project } = await request('POST', '/api/accounts', { name: 'Loop', email: `loop-${randomBytes(6).toString('hex')}@example.test`, password: randomBytes(18).toString('hex') });
    const page = await context.newPage();
    await page.goto(`${origin}/p/${project.slug}/design/tokens`);
    await page.frameLocator('.lay-frame-view').locator('.lay-ds-box').first().waitFor({ timeout: 90000 });
    await context.close();
  }
  console.log('PASS loopback: layer frames render in a portal opened at localhost and at 127.0.0.1');
} finally { await browser.close(); }
