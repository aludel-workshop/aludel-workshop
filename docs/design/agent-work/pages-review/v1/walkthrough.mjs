// AGENT-WORK-01 Pages review action prototype v1 walkthrough: compares r3 with r4 side by side, walks the flow by clicking
// inside the HTML mockups, pins notes, requests changes, reviews round 2 against the last review, approves, and opens the
// source and kit drawers; then 390 px. Visible controls only. Uses the shared tools/prototype-check.mjs.
// Run: node docs/design/agent-work/pages-review/v1/walkthrough.mjs (AXE_PATH if axe-core isn't resolvable).
import { openPrototype } from '../../../../../tools/prototype-check.mjs';

const check = await openPrototype({ url: new URL('./index.html', import.meta.url).href, shots: new URL('./shots/', import.meta.url).pathname });
const { page, step, shot, audit, narrow, load } = check;
const act = (a, extra = '') => page.click(`[data-act="${a}"]${extra}`);
const text = () => page.locator('#view').innerText();
const see = async t => { if (!(await text()).toLowerCase().includes(t.toLowerCase())) throw new Error(`expected to see "${t}"`); };
const proposed = sel => page.locator(`.screen[data-side="proposed"] ${sel}`).first();
const current = () => page.locator('.stepbtn[aria-current="step"]').innerText();
const at = name => step(`at ${name}`, async () => { if (!(await current()).includes(name)) throw new Error(`current step is ${await current()}`); });
const disabled = async (a, want) => { if ((await page.locator(`[data-act="${a}"]`).isDisabled()) !== want) throw new Error(`${a} should be ${want ? 'disabled' : 'enabled'}`); };

await load();
await step('kit rendered', () => proposed('.bk-btn.filled').waitFor());
await step('side by side', () => page.locator('.screen[data-side="previous"]').waitFor());
await step('badges', async () => { for (const b of ['Changed', 'New', 'Removed', 'Same']) await page.locator('.steps .badge', { hasText: b }).first().waitFor(); });
await step('approve locked', () => disabled('approve', true));
await shot('compare-marketing'); await audit('compare');

// What changed: the list flashes the element; the removed invite shows on the previous side.
await step('changes listed', () => see('Ask for an invite is gone'));
await step('flash cta', () => page.click('[data-chg="cta"]'));
await step('removed outlined', () => page.locator('.hl .screen[data-side="previous"] [data-change="removed"]').waitFor());

// Walk inside the mockup: Start your world → Sign up → Create account → Check your email.
await step('walk 1', () => proposed('[data-go="signup"]').click()); await at('Sign up');
await step('previous absent', () => page.locator('.screen[data-side="previous"] .absent').getByText('Not in r3').waitFor());
await step('type', () => proposed('input[type="email"]').fill('robin@example.com'));
await shot('walk-signup-new'); await audit('signup');
await step('walk 2', () => proposed('[data-go="check-email"]').click()); await at('Check your email');

// Pin a note on the page, then try saving it empty.
await step('pin', () => act('pin')); await step('pick text', () => proposed('bk-text').click());
await step('form', () => page.locator('form[data-form="note"]').waitFor()); await step('empty refused', async () => { await page.click('form[data-form="note"] button[type="submit"]'); await page.locator('form[data-form="note"]').waitFor(); });
await step('kind', () => page.check('input[name="kind"][value="change"]')); await step('note', () => page.fill('#notetext', 'Say how long the link lasts, and let me fix a mistyped email'));
await step('save', () => page.click('form[data-form="note"] button[type="submit"]')); await step('marker', () => page.locator('.screen[data-side="proposed"] .marker').waitFor());
await shot('note-pinned'); await audit('note');

// Desktop, previous only, and the removed Log in step.
await step('desktop', () => page.click('[data-vp="desktop"]')); await step('zoomed', async () => { const z = await page.locator('.screen[data-side="proposed"]').evaluate(e => +e.style.zoom); if (!(z > 0 && z < 1)) throw new Error(`zoom ${z}`); });
await shot('desktop-side-by-side');
await step('log in step', () => page.click('[data-step="login"]')); await step('not a step', () => see('Not a step in r4')); await shot('removed-step');
await step('phone', () => page.click('[data-vp="phone"]'));

// Setup and World: the remaining changed step; Same needs nothing.
await step('setup', () => page.click('[data-step="setup"]')); await step('greet', () => see('Greets you by the name'));
await step('looks right', () => act('looks')); await step('world', () => page.click('[data-step="world"]')); await step('same', () => see('Same as r3'));
await step('all seen', () => see('All changed steps seen'));
await step('approve waits on note', () => disabled('approve', true));

// Request changes → round 2 against the last review.
await step('request', () => act('request')); await step('revising', () => see('Claude is working on your note'));
await step('round 2', () => page.locator('.banner.round').waitFor({ timeout: 6000 }));
await at('Check your email'); await step('vs r4', () => see('r5 against r4'));
await step('addressed', () => see('The link lasts 24 hours'));
await step('since badge', () => page.locator('.badge.b-since').waitFor());
await shot('round-2'); await audit('round 2');
await step('vs r3', () => page.click('[data-base="r3"]')); await step('chain', async () => { await page.click('[data-step="marketing"]'); await see('Ask for an invite is gone'); });
await step('back to r4', () => page.click('[data-base="r4"]'));
await step('approve', () => act('approve')); await step('approved', () => see('#1 approved')); await shot('approved'); await audit('approved');

// Source and kit.
await step('source', () => act('source')); await step('source shows tags', () => page.locator('#source pre').getByText('<bk-hero').waitFor()); await shot('source'); await audit('source');
await step('close source', () => page.click('#source [data-act="close-drawer"]'));
await step('kit', () => act('kit')); await step('kit demo live', async () => { const c = page.locator('#kit .bk-choice').first(); await c.click(); if (await c.getAttribute('aria-pressed') !== 'false') throw new Error('choice did not toggle'); });
await shot('kit'); await audit('kit'); await step('close kit', () => page.click('#kit [data-act="close-drawer"]'));

// Questions keep their answers across Reset.
await step('questions', () => act('questions')); await step('answer', () => page.fill('#a-P1', 'test answer')); await shot('review-questions'); await audit('questions');
await step('close q', () => page.click('#questions [data-act="close-drawer"]'));
await step('answers kept', async () => { await act('reset'); await act('questions'); if (await page.inputValue('#a-P1') !== 'test answer') throw new Error('reset lost answers'); await page.fill('#a-P1', ''); await page.click('#questions [data-act="close-drawer"]'); });

// Narrow.
await page.setViewportSize({ width: 390, height: 844 }); await load();
await step('phone kit', () => proposed('.bk-btn.filled').waitFor());
await narrow('compare'); await shot('phone-compare'); await audit('phone compare');
await step('phone walk', () => proposed('[data-go="signup"]').click()); await narrow('signup'); await shot('phone-signup');
await check.finish();
