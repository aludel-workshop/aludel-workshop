// ONB-01–05 end to end: logged-out "Get started" → working style → idea → account → GitHub (operator not configured)
// → agent → look & feel → features → stack → build → click around the generated app on its own subdomain.
// Usage: start a fresh portal (MACHINE_DATA_DIR, MACHINE_PORT), then run with MACHINE_PORT and PLAYWRIGHT_MODULE set.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, ownerSignIn } from './browser-support.mjs';

const port = process.env.MACHINE_PORT || 4314;
const portal = `http://aludel.localhost:${port}`;
const app = `http://tool-share.localhost:${port}`;
mkdirSync('test-results/onboarding', { recursive: true });
const shot = (page, name) => page.screenshot({ path: `test-results/onboarding/${name}.png`, fullPage: true });
const axe = async page => {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  return page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => `${item.id}: ${item.nodes[0]?.target}`));
};
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  // axe is injected as an inline script, so audited pages bypass CSP; the preview frame is re-checked below with CSP enforced.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, bypassCSP: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const checked = [];
  const check = async name => { assert.deepEqual(await axe(page), [], `${name} has accessibility violations`); await shot(page, `${name}-wide`); checked.push(name); };

  await page.goto(portal);
  await page.getByRole('heading', { name: 'Turn an idea into an app you can click around.' }).waitFor();
  await check('landing');
  await page.getByRole('link', { name: 'Get started' }).click();

  await page.getByRole('heading', { name: 'How do you want to work?' }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 3);
  await check('profile');
  await page.getByRole('radio', { name: /Dreamer/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('heading', { name: 'What are you making?' }).waitFor();
  await page.getByLabel('App name').fill('Tool Share');
  await page.getByLabel('Elevator pitch').fill('Neighbours lend and borrow tools they rarely use, so nobody has to buy a ladder for one afternoon.');
  await check('idea');
  await page.reload();
  await page.getByRole('heading', { name: 'What are you making?' }).waitFor();
  await page.getByLabel('App name').fill('Tool Share');
  await page.getByLabel('Elevator pitch').fill('Neighbours lend and borrow tools they rarely use, so nobody has to buy a ladder for one afternoon.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('heading', { name: 'Create your account to keep Tool Share' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Create your account to keep Tool Share' }).waitFor({ timeout: 5000 });
  await check('account');
  await page.getByLabel('Your name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await page.getByLabel('Confirm password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Create account and continue' }).click();

  await page.getByRole('heading', { name: 'Give Tool Share a home on GitHub' }).waitFor();
  assert.match(await page.locator('main').innerText(), /GitHub isn't set up on this Aludel yet/);
  assert.match(page.url(), /\/start\/p-[0-9a-f]+\/github$/);
  await check('github-unconfigured');
  await page.getByRole('button', { name: 'Continue with the local repository' }).click();

  await page.getByRole('heading', { name: 'Connect an agent' }).waitFor();
  await page.getByRole('button', { name: 'Connect an agent' }).click();
  await page.getByRole('radio', { name: /Codex on this machine/ }).check();
  await check('agent');
  await page.getByRole('button', { name: 'Save connection' }).click();
  await page.getByText('Agent connection saved.').waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.getByRole('heading', { name: 'Choose a starting feel' }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'More details' }).isChecked(), false, 'Dreamers start with quick picks');
  await page.getByRole('radio', { name: /Mobile-first social/ }).check();
  await page.getByRole('radio', { name: 'Match device' }).check();
  await page.getByLabel('How should this be used?').fill('Hero image on the home page');
  await page.locator('input[type=file]').setInputFiles(path.resolve('public/brand/aludel-workshop.png'));
  await page.getByText('aludel-workshop.png added.').waitFor();
  await check('look');
  await page.getByRole('button', { name: 'Save and continue' }).click();

  await page.getByRole('heading', { name: 'What should Tool Share include to start?' }).waitFor();
  await page.getByRole('checkbox', { name: /^Search/ }).check();
  await page.getByRole('checkbox', { name: /^Messages and comments/ }).check();
  await page.getByRole('checkbox', { name: 'More details' }).check();
  await page.getByLabel('Feature name').fill('Tool library');
  await page.getByLabel('What it does').fill('Browse the tools your neighbours are happy to lend.');
  await page.getByRole('button', { name: 'Add feature' }).click();
  await page.getByText('Feature added.').waitFor();
  await check('features');
  await page.getByRole('button', { name: 'Save and continue' }).click();

  await page.getByRole('heading', { name: 'How it\'s built' }).waitFor();
  assert.equal(await page.getByText('Django + HTMX').count(), 0, 'unavailable presets stay behind More options');
  await page.getByRole('checkbox', { name: 'More options' }).check();
  assert.equal(await page.getByRole('radio', { name: /Django \+ HTMX/ }).isDisabled(), true);
  await check('stack');
  await page.getByRole('button', { name: 'Save and continue' }).click();

  await page.getByRole('heading', { name: 'Build Tool Share' }).waitFor();
  await page.getByRole('button', { name: 'Build my app' }).click();
  await page.getByRole('heading', { name: 'Tool Share is ready to click around' }).waitFor({ timeout: 120000 });
  await page.frameLocator('iframe.pub-preview-frame').getByRole('heading', { name: 'Tool Share', level: 1 }).waitFor({ timeout: 15000 });
  await check('build');

  const strict = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: await context.storageState() });
  const strictPage = await strict.newPage();
  const violations = []; strictPage.on('console', message => { if (/Content Security Policy/i.test(message.text())) violations.push(message.text()); });
  await strictPage.goto(page.url());
  await strictPage.frameLocator('iframe.pub-preview-frame').getByRole('heading', { name: 'Tool Share', level: 1 }).waitFor({ timeout: 15000 });
  assert.deepEqual(violations, [], 'the portal CSP must allow framing only the project preview');
  await strict.close();

  const appPage = await context.newPage();
  appPage.on('pageerror', error => errors.push(`app: ${error.message}`));
  await appPage.goto(app);
  await appPage.getByRole('heading', { name: 'Tool Share', level: 1 }).waitFor();
  assert.match(await appPage.locator('.hero').getAttribute('style'), /url\(.+aludel-workshop\.png/, 'the uploaded hero image is used');
  await appPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tool library' }).click();
  await appPage.getByRole('heading', { name: 'Tool library', level: 1 }).waitFor();
  assert.equal(new URL(appPage.url()).pathname, '/tool-library');
  await appPage.reload();
  await appPage.getByRole('heading', { name: 'Tool library', level: 1 }).waitFor();
  await appPage.getByRole('link', { name: 'Sign in' }).first().click();
  await appPage.getByRole('button', { name: 'New here? Create an account' }).click();
  await appPage.getByLabel('Name').fill('Grace');
  await appPage.getByLabel('Email').fill('grace@example.com');
  await appPage.getByLabel('Password').fill('lend-me-a-ladder');
  await appPage.getByRole('button', { name: 'Create account' }).click();
  await appPage.getByText('Grace').first().waitFor();
  assert.deepEqual(await axe(appPage), [], 'generated app has accessibility violations');
  await appPage.screenshot({ path: 'test-results/onboarding/app-wide.png', fullPage: true });
  const portalCookies = (await context.cookies(app)).map(cookie => cookie.name);
  assert.equal(portalCookies.includes('machine_session'), false, 'the portal session never reaches app subdomains');
  await appPage.setViewportSize({ width: 390, height: 844 });
  await appPage.goto(app);
  await appPage.getByRole('navigation', { name: 'Sections' }).waitFor();
  assert.equal(await noOverflow(appPage), true, 'generated app overflows at 390px');
  await appPage.screenshot({ path: 'test-results/onboarding/app-narrow.png', fullPage: true });

  await page.goto(`${portal}/projects`);
  await page.getByRole('link', { name: /Tool Share/ }).click();
  await page.getByRole('heading', { name: 'Tool Share', level: 1 }).waitFor();
  await page.getByRole('radio', { name: 'Planner' }).check();
  await page.getByText('Working style changed to Planner. Your individual changes were kept.').waitFor();
  await page.getByLabel('Who writes the code').selectOption('self');
  await page.getByText('Preference saved.').waitFor();
  await page.getByText('changed', { exact: true }).waitFor();
  await check('project');

  await page.goto(`${portal}/#/the-machine/overview`);
  await page.waitForURL(`${portal}/projects`);
  const forbidden = await page.evaluate(async () => (await fetch('/api/overview')).status);
  assert.equal(forbidden, 404, "a new user cannot read Aludel's own workspace");

  // Signed-in visitors to / go to their apps, so the public pages are checked narrow in a signed-out browser.
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true });
  const visitorPage = await visitor.newPage();
  visitorPage.on('pageerror', error => errors.push(`visitor: ${error.message}`));
  for (const [name, url, heading] of [
    ['landing', `${portal}/`, 'Turn an idea into an app you can click around.'],
    ['profile', `${portal}/start`, 'How do you want to work?'],
    ['login', `${portal}/login`, 'Sign in']
  ]) {
    await visitorPage.goto(url);
    await visitorPage.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert.equal(await noOverflow(visitorPage), true, `${name} overflows at 390px`);
    assert.deepEqual(await axe(visitorPage), []);
    await visitorPage.screenshot({ path: `test-results/onboarding/${name}-narrow.png`, fullPage: true });
  }
  await visitor.close();
  await page.goto(`${portal}/`);
  await page.waitForURL(`${portal}/projects`);
  await page.setViewportSize({ width: 390, height: 844 });
  const projectId = (await page.evaluate(async () => (await (await fetch('/api/projects')).json()).projects[0].id));
  for (const [name, step, heading] of [['look', 'look', 'Choose a starting feel'], ['features', 'features', 'What should Tool Share include to start?'], ['build', 'build', 'Tool Share is ready to click around']]) {
    await page.goto(`${portal}/start/${projectId}/${step}`);
    await page.getByRole('heading', { name: heading }).waitFor();
    assert.equal(await noOverflow(page), true, `${name} overflows at 390px`);
    assert.deepEqual(await axe(page), []);
    await shot(page, `${name}-narrow`);
  }

  const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 }, bypassCSP: true });
  const ownerPage = await owner.newPage();
  ownerPage.on('pageerror', error => errors.push(`owner: ${error.message}`));
  await ownerSignIn(ownerPage, portal, randomBytes(24).toString('hex'));
  await ownerPage.getByRole('heading', { name: 'Agent connection' }).waitFor();
  assert.match(await ownerPage.locator('.agent-connection').innerText(), /built inside itself/);
  await ownerPage.screenshot({ path: 'test-results/onboarding/owner-overview-agent.png', fullPage: true });

  assert.deepEqual(errors, []);
  console.log(`PASS: onboarding ${checked.join(' → ')}; generated app on its subdomain with its own accounts; portal cookie isolation; working-style switch and override; Aludel guard; 390px checks; owner shares the agent connection.`);
} finally { await browser.close(); }
