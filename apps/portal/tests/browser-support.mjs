// Shared by the browser scripts. Set PLAYWRIGHT_MODULE to a playwright index.mjs when the bootstrap runtime lives elsewhere.
import dns from 'node:dns';

// Browsers resolve *.localhost to loopback by themselves (DEC-033), but Node's resolver (used by Playwright's request
// context since 1.61) asks the system, which on this WSL machine does not. Resolve them here, for the test process only.
const loopback = hostname => /(^|\.)localhost$/i.test(String(hostname));
const systemLookup = dns.lookup;
dns.lookup = function lookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (typeof options === 'number') options = { family: options };
  if (!loopback(hostname)) return systemLookup.call(dns, hostname, options, callback);
  return options?.all ? process.nextTick(callback, null, [{ address: '127.0.0.1', family: 4 }]) : process.nextTick(callback, null, '127.0.0.1', 4);
};
// Playwright asks per address family with { all: true }; the portal listens on IPv4 loopback only.
const systemPromiseLookup = dns.promises.lookup;
dns.promises.lookup = async function lookup(hostname, options = {}) {
  if (!loopback(hostname)) return systemPromiseLookup.call(dns.promises, hostname, options);
  const family = typeof options === 'number' ? options : options.family;
  const found = family === 6 ? [] : [{ address: '127.0.0.1', family: 4 }];
  return options.all ? found : found[0] || Promise.reject(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }));
};

const modulePath = process.env.PLAYWRIGHT_MODULE || '/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs';
export const { chromium } = await import(modulePath);

// Owner access moved from the root page to /login (ONB-01); first run sets the key, later runs enter it.
export async function ownerSignIn(page, base, key) {
  await page.goto(`${base}/login`);
  const setup = page.getByRole('button', { name: 'Set up owner access' });
  const existing = page.getByRole('button', { name: 'Use owner access key' });
  await setup.or(existing).first().waitFor();
  if (await setup.count()) {
    await setup.click();
    await page.getByLabel('Owner access key', { exact: true }).fill(key);
    await page.getByLabel('Confirm owner access key').fill(key);
    await page.getByRole('button', { name: 'Create owner access' }).click();
  } else {
    await existing.click();
    await page.getByLabel('Owner access key', { exact: true }).fill(key);
    await page.getByRole('button', { name: 'Open portal' }).click();
  }
  await page.waitForURL(/#\/the-machine\/overview/);
}
