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

  await page.getByRole('heading', { name: 'Save Tool Share to an account' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Save Tool Share to an account' }).waitFor({ timeout: 5000 });
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
  // LAY-04D: a pasted key, with the provider's steps in place. The provider is a local stand-in (tests/provider-stub.mjs).
  assert.equal(await page.getByRole('radio', { name: /Codex on this machine/ }).count(), 0, 'local-only Codex is not offered');
  await page.getByRole('radio', { name: /Anthropic \(Claude\)/ }).check();
  await page.getByText('Name it after this project so you can find it later, for example “Aludel · Tool Share”.').waitFor();
  assert.equal(await page.getByRole('link', { name: /Open Anthropic \(Claude\) API keys/ }).getAttribute('href'), 'https://platform.claude.com/settings/keys');
  await page.getByLabel('Anthropic (Claude) API key').fill('sk-ant-admin01-not-for-agents-xxxxxxxxxxxx');
  await page.getByRole('button', { name: 'Check and save' }).click();
  await page.getByRole('alert').getByText(/Admin API key/).waitFor();
  await page.getByLabel('Anthropic (Claude) API key').fill('sk-ant-api03-mistyped-key-xxxxxxxxxxxxxx');
  await page.getByRole('button', { name: 'Check and save' }).click();
  await page.getByRole('alert').getByText(/rejected this key/).waitFor();
  // The button just re-enabled; let Material's colour transition finish so axe measures the settled colours.
  await page.getByRole('button', { name: 'Check and save' }).evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
  await check('agent');
  await page.getByLabel('Anthropic (Claude) API key').fill('sk-ant-api03-aludel-browser-test-key-good');
  await page.getByRole('button', { name: 'Check and save' }).click();
  await page.getByText('Checked with Anthropic (Claude): the key works. Agent connection saved.').waitFor();
  await page.getByText(/key ending good\s*·\s*checked, works/).waitFor();
  await page.getByRole('button', { name: 'Check again' }).click();
  await page.getByText('The key still works.').waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.getByRole('heading', { name: 'Choose a starting feel' }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'More details' }).isChecked(), false, 'Dreamers start with quick picks');
  const proto = page.locator('aludel-proto-site');
  assert.ok(await proto.locator('.proto-pill').count() >= 3, 'Look & feel shows placeholder navigation');
  await page.getByRole('radio', { name: /Mobile-first social/ }).check();
  await page.getByRole('radio', { name: 'Top nav', checked: true }).waitFor({ timeout: 3000 }); // the feel sets its default desktop navigation
  await proto.locator('.proto-app.nav-top').waitFor();
  assert.match(await proto.locator('.proto-frame').getAttribute('style'), /--p-primary: #ca3e6f/, 'the preview uses the readable accent the app will get');
  await page.getByRole('radio', { name: 'Match device' }).check();
  await page.getByLabel('How should this be used?').fill('Hero image on the home page');
  await page.locator('input[type=file]').setInputFiles(path.resolve('public/brand/aludel-workshop.png'));
  await page.getByText('aludel-workshop.png added.').waitFor();
  await check('look');
  await page.getByRole('button', { name: 'Save and continue' }).click();

  // Functionality comes before Pages (DEC-037): story packs seed the story map and propose pages.
  await page.getByRole('heading', { name: 'What should Tool Share be able to do?' }).waitFor();
  await page.getByRole('checkbox', { name: /^Accounts/ }).check();
  await page.getByRole('list', { name: 'Accounts stories' }).getByText('Someone can sign up with email and password').waitFor();
  await page.getByRole('checkbox', { name: /^Messaging/ }).check();
  await page.getByRole('checkbox', { name: 'More details' }).check();
  await page.getByLabel('Someone can…').fill('Someone can list a tool to lend');
  await page.getByLabel('Why it matters').fill('Lenders share what they own.');
  await page.getByRole('button', { name: 'Add story idea' }).click();
  await page.getByText('Story idea added.').waitFor();
  await check('features');
  await page.getByRole('button', { name: 'Save and continue' }).click();

  await page.getByRole('heading', { name: 'Shape the navigation' }).waitFor();
  const nav = proto.getByRole('navigation', { name: 'Pages in your app' });
  const labels = () => nav.locator('.proto-link span').allInnerTexts();
  // The portal renders zonelessly, so wait for the navigation to settle rather than reading it once.
  const expectPages = async (expected, message) => {
    for (let attempt = 0; attempt < 30 && JSON.stringify(await labels()) !== JSON.stringify(expected); attempt++) await page.waitForTimeout(100);
    assert.deepEqual(await labels(), expected, message);
  };
  await expectPages(['Home', 'Explore', 'Messages', 'Profile'], 'pages are seeded from the mobile-first social feel');
  await nav.getByRole('button', { name: 'Messages' }).click();
  await proto.getByLabel('Description of Messages').fill('Neighbours arrange pick-up and return times.');
  await proto.getByLabel('Page type').selectOption('messages');
  await nav.getByRole('button', { name: 'Add page' }).click();
  const nameField = proto.getByLabel('Name', { exact: true });
  assert.equal(await nameField.evaluate(element => element === document.activeElement && element.selectionEnd - element.selectionStart === element.value.length), true, 'a new page opens with its name selected');
  await page.keyboard.type('Tool library');
  await proto.getByRole('radio', { name: 'build' }).check();
  await proto.getByRole('button', { name: 'Move left' }).click();
  await proto.getByRole('button', { name: 'Done' }).click();
  await expectPages(['Home', 'Explore', 'Messages', 'Tool library', 'Profile']);
  assert.equal(await nav.getByRole('button', { name: 'Add page' }).count(), 0, 'five pages is the limit');
  await nav.getByRole('button', { name: 'Explore' }).click();
  await nav.getByRole('button', { name: 'Edit Explore' }).click();
  await proto.getByRole('button', { name: 'Delete' }).click();
  await expectPages(['Home', 'Messages', 'Tool library', 'Profile']);
  // Drag Profile before Messages with real pointer movement, as the CDK needs.
  const from = await nav.locator('.proto-item', { hasText: 'Profile' }).boundingBox();
  const to = await nav.locator('.proto-item', { hasText: 'Messages' }).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  for (let step = 1; step <= 12; step++) await page.mouse.move(from.x + (to.x - from.x) * step / 12 - 4, to.y + to.height / 2);
  await page.mouse.up();
  await expectPages(['Home', 'Profile', 'Messages', 'Tool library'], 'dragging reorders pages');
  await nav.getByRole('button', { name: 'Messages' }).click();
  await nav.getByRole('button', { name: 'Edit Messages' }).click();
  await proto.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alert').getByText(/“Messages” realises 2 stories/).waitFor();
  await page.getByRole('button', { name: 'Keep “Messages”' }).click();
  await expectPages(['Home', 'Profile', 'Messages', 'Tool library'], 'keeping the page restores the navigation');
  await page.getByRole('radio', { name: 'Side nav' }).check();
  await page.getByRole('radio', { name: 'Mobile' }).check();
  await proto.locator('.proto-frame.mobile .proto-tabs .proto-link').nth(3).waitFor({ timeout: 3000 });
  assert.equal(await proto.locator('.proto-frame.mobile .proto-tabs .proto-link').count(), 4, 'phones show a bottom tab bar');
  await page.screenshot({ path: 'test-results/onboarding/pages-mobile.png' });
  await page.getByRole('radio', { name: 'Desktop' }).check();
  await page.getByText('All changes saved').waitFor();
  assert.equal(await page.getByText('1 of 4 described').count(), 1);
  await check('pages');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'Build Tool Share' }).waitFor();
  assert.equal(await page.getByText('Django + HTMX').count(), 0, 'unavailable presets stay behind More options');
  await page.getByRole('checkbox', { name: 'More options' }).check();
  assert.equal(await page.getByRole('radio', { name: /Django \+ HTMX/ }).isDisabled(), true);
  await check('stack');
  await page.getByRole('button', { name: 'Build my app' }).click();
  await page.getByRole('heading', { name: 'Tool Share is built' }).waitFor({ timeout: 120000 });
  await page.frameLocator('iframe.pub-preview-frame').getByRole('heading', { name: 'Home', level: 1 }).waitFor({ timeout: 15000 });
  await check('build');

  const strict = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: await context.storageState() });
  const strictPage = await strict.newPage();
  const violations = []; strictPage.on('console', message => { if (/Content Security Policy/i.test(message.text())) violations.push(message.text()); });
  await strictPage.goto(page.url());
  await strictPage.frameLocator('iframe.pub-preview-frame').getByRole('heading', { name: 'Home', level: 1 }).waitFor({ timeout: 15000 });
  assert.deepEqual(violations, [], 'the portal CSP must allow framing only the project preview');
  await strict.close();

  const appPage = await context.newPage();
  appPage.on('pageerror', error => errors.push(`app: ${error.message}`));
  await appPage.goto(app);
  await appPage.getByRole('heading', { name: 'Home', level: 1 }).waitFor();
  assert.match(await appPage.locator('.hero').getAttribute('style'), /url\(.+aludel-workshop\.png/, 'the uploaded hero image is used');
  const appNav = appPage.getByRole('navigation', { name: 'Main' });
  const built = await appNav.getByRole('link').evaluateAll(links => links.map(link => [link.querySelector('.icon')?.textContent, link.textContent.replace(link.querySelector('.icon')?.textContent || '', '').trim()]));
  assert.deepEqual(built, [['home', 'Home'], ['person', 'Profile'], ['chat', 'Messages'], ['build', 'Tool library']], 'the built app has the pages, order and icons that were arranged');
  assert.equal(await appPage.evaluate(() => document.fonts.check('22px "App Icons"')), true, 'page icons render from the bundled font');
  await appNav.getByRole('link', { name: /Messages/ }).click();
  await appPage.getByRole('heading', { name: 'Messages', level: 1 }).waitFor();
  assert.equal(new URL(appPage.url()).pathname, '/messages');
  await appPage.getByText('Neighbours arrange pick-up and return times.').waitFor();
  assert.equal(await appPage.locator('page-blocks .block.chat').count(), 1, 'the page type chosen in the preview is the layout that was built');
  await appPage.reload();
  await appPage.getByRole('heading', { name: 'Messages', level: 1 }).waitFor();
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

  await page.getByRole('link', { name: 'Continue in Aludel' }).click();
  await page.waitForURL(`${portal}/p/tool-share`);
  await page.getByRole('heading', { name: 'Tool Share', level: 1 }).waitFor();
  await page.getByRole('navigation', { name: 'Layers' }).getByRole('link', { name: 'Work' }).click();
  // WORK-UX-01: the Dreamer style only preset who takes each action; it appears nowhere after onboarding.
  await page.getByRole('navigation', { name: 'Work sections' }).getByRole('link', { name: 'Roles' }).click();
  await page.getByRole('heading', { name: 'Product lead' }).waitFor();
  assert.match(await page.locator('[id="action-product.define"]').innerText(), /Default agent/, 'a Dreamer hands acceptance to the default agent');
  assert.match(await page.locator('[id="action-platform.configure"]').innerText(), /You/, 'anything that may cost money stays with the person');
  assert.equal(await page.getByText(/Dreamer|Working style/).count(), 0, 'the style is not shown after onboarding');
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
  for (const [name, step, heading] of [['look', 'look', 'Choose a starting feel'], ['features', 'features', 'What should Tool Share be able to do?'], ['pages', 'pages', 'Shape the navigation'], ['build', 'build', 'Tool Share is built']]) {
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
