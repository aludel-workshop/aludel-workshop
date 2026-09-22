// Shared by the browser scripts. Set PLAYWRIGHT_MODULE to a playwright index.mjs when the bootstrap runtime lives elsewhere.
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
