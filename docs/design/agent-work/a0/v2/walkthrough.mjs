// AGENT-WORK-01 A0 prototype v2 walkthrough: drives a rough Draft through defining, the phased actions, per-action reviews and
// close-out with visible controls only (Step mode), plus local work style, the board, scenarios and 390 px. Uses the shared
// tools/prototype-check.mjs. Run: node docs/design/agent-work/a0/v2/walkthrough.mjs (AXE_PATH if axe-core isn't resolvable).
import { openPrototype } from '../../../../../tools/prototype-check.mjs';

const check = await openPrototype({ url: new URL('./index.html', import.meta.url).href, shots: new URL('./shots/', import.meta.url).pathname });
const { page, step, shot, audit, narrow, load } = check;
const act = (a, extra = '') => page.click(`[data-act="${a}"]${extra}`);
const text = () => page.locator('#view').innerText();
const see = async t => { if (!(await text()).toLowerCase().includes(t.toLowerCase())) throw new Error(`expected to see "${t}"`); };
const until = (t, max = 25) => step(`until ${t}`, async () => { for (let i = 0; i < max; i++) { if ((await text()).includes(t)) return; await act('tick'); } throw new Error(`never saw "${t}"`); });
const answer = scope => page.click(`form[data-scope="${scope}"] button[type="submit"]`);
const inFrame = t => page.locator('#dlg .fbody button', { hasText: t }).first();
const jump = to => step(`jump ${to}`, async () => { await act('scenarios'); await page.click(`#scenarios [data-act="jump"][data-to="${to}"]`); });

await load();
await step('step mode', () => page.click('[data-speed="step"]'));
await shot('draft'); await audit('draft');

// Defining: Go on a rough draft; questions stack on the brief.
await step('go', () => act('go'));
await until('Question 1 of 2'); await shot('defining-question'); await audit('defining');
await step('answer 1', () => answer('def')); await step('q2', () => see('Question 2 of 2'));
await step('answer 2', () => answer('def'));
await until('Start work'); await step('ready col', () => see('Ready')); await step('defined', () => see('Create the sign-up flow')); await shot('ready'); await audit('ready');

// Changing actions before starting: edit a goal.
await step('edit', () => act('edit', '[data-a="a3"]')); await step('goal', () => page.fill('#goal-a3', 'Routes for each new page, a step test for every journey step, and Sign in kept working.'));
await step('save goal', () => act('save-edit', '[data-a="a3"]')); await step('goal said', () => see("Updated #3's goal"));
await step('start', () => act('start')); await step('progress', () => see('In progress'));

// Phase 1: two agents; each need sits on its own action.
await until('Should the Sign up page also link to Sign in?');
await until('Meanwhile');
await step('allow on card', () => see('Data is in Ask first mode')); await step('two need', () => see('2 need you'));
await shot('needs-on-actions'); await audit('needs');
await step('details', () => act('open', '[data-a="a1"]')); await step('side shows log', () => page.locator('.side').getByText('Using skill: Write a page spec').waitFor());
await shot('action-details'); await step('back', () => act('back-orch'));
await step('answer a1', () => answer('a1')); await step('allow a2', () => act('allow', '[data-a="a2"]'));
await until('needs your approval'); await shot('gate-and-new-action'); await audit('gate');
await step('phase 2 waits', async () => { await act('tick'); if ((await text()).includes('Gate cleared')) throw new Error('phase 2 started before the reviews'); });

// Review #1 at the action level; flag it once, then approve.
await until('#2 is ready for your review');
await step('review a1', () => act('review', '[data-a="a1"]')); await shot('review-flows'); await audit('review flows');
await step('flag', () => act('flag')); await step('empty refused', async () => { await act('save-flag'); if (!await page.locator('#flagtext').isVisible()) throw new Error('flag saved without a note'); });
await step('flag text', () => page.fill('#flagtext', 'Say on Check your email how long the link lasts')); await step('send flag', () => act('save-flag'));
await step('fixing', () => see('Fixing your note')); await until('addressed your note');
await step('review a1 again', () => act('review', '[data-a="a1"]')); await step('approve a1', () => act('approve-action'));
await step('review a2', () => act('review', '[data-a="a2"]')); await step('approve a2', () => act('approve-action'));
await step('gate open', () => see('Review gate cleared'));
// Approving the new action opens its details in the sidebar.
await step('open new', () => act('open', '[data-a="a5"]')); await step('approve shown', () => page.locator('.side [data-act="approve-new"]').waitFor()); await shot('approve-new-action'); await audit('approve new');
await step('approve new', () => act('approve-new', '[data-a="a5"]')); await step('back 2', () => act('back-orch'));
// Add an action mid-run.
await step('add', () => act('add', '[data-p="3"]')); await step('add text', () => page.fill('#add-3', 'Screenshot each new page on a phone width'));
await step('save add', () => act('save-add', '[data-p="3"]')); await step('added', () => see('Added by you'));

// Phase 2 and the combined check.
await until('found a problem'); await shot('orchestrator-check-failed');
await until('#3 is ready for your review');
await step('steer', async () => { await page.fill('#steer', 'Keep the welcome line short'); await page.click('form[data-form="steer"] button'); }); await step('steered', () => see('Noted.'));
await until('#6 is ready for your review'); await step('approve added', async () => { await act('review', '[data-a="u6"]'); await act('approve-action'); });
await step('review a3', () => act('review', '[data-a="a3"]')); await step('approve locked', async () => { if (await page.locator('[data-act="approve-action"]').isEnabled()) throw new Error('approve before walking'); });
await step('walk 1', () => act('walk', '[data-j="signup"]')); await step('w1', () => inFrame('Sign up').click()); await step('w2', () => inFrame('Create account').click());
await shot('review-walk'); await audit('walk');
await step('w3', () => inFrame('Open the email').click()); await step('w4', () => inFrame('Confirm email').click());
await step('walk 2', () => act('walk', '[data-j="first"]')); await step('w5', () => inFrame('Create your first world').click()); await step('w6', () => inFrame('Create world').click());
await step('approve a3', () => act('approve-action'));
await until('Ready to close out'); await step('in review col', () => see('In review')); await shot('close-out'); await audit('close');
await step('merge', () => act('merge')); await step('done', () => see('Merged')); await step('board', () => act('board')); await step('on done', () => page.locator('.bcol[aria-label="Done"] [data-act="open-item"]').waitFor()); await shot('board-done'); await audit('board');

// Local work style, from a fresh draft.
await step('reset', async () => { await act('open-item'); await act('scenarios'); await act('reset'); await page.click('#scenarios [data-act="close-drawer"]'); });
await step('local', () => page.click('[data-style="local"]')); await step('cmd', () => see('aludel claim W-11')); await shot('local-claim');
await step('claim', () => act('go')); await until('Question 1 of 2'); await step('local thread', () => see('Your Claude Code (local)')); await shot('local-thread');
await step('remote back', async () => { await act('scenarios'); await act('reset'); await page.click('#scenarios [data-act="close-drawer"]'); await page.click('[data-style="remote"]'); });

// Scenario: the combined check fails twice; the decision sits on #4.
await step('stuck on', async () => { await act('scenarios'); await page.check('#scn-stuck'); await page.click('#scenarios [data-act="close-drawer"]'); });
await jump('review3'); await step('stuck', () => see('#4 failed twice')); await shot('check-stuck'); await audit('stuck');
await step('more', () => act('stuck-more'));
await step('questions', () => act('questions')); await step('answer q', () => page.fill('#a-Q1', 'test answer')); await shot('review-questions'); await audit('questions');
await step('close q', () => page.click('#questions [data-act="close-drawer"]'));
await step('answers kept', async () => { await act('scenarios'); await act('reset'); await page.click('#scenarios [data-act="close-drawer"]'); await act('questions');
  if (await page.inputValue('#a-Q1') !== 'test answer') throw new Error('reset lost the answers'); await page.fill('#a-Q1', ''); await page.click('#questions [data-act="close-drawer"]'); });

// Narrow.
await page.setViewportSize({ width: 390, height: 844 }); await load();
await step('phone step', () => page.click('[data-speed="step"]'));
await narrow('draft'); await shot('phone-draft'); await audit('phone draft');
await jump('needs'); await narrow('needs'); await shot('phone-needs'); await audit('phone needs');
await jump('review3'); await step('phone review', () => act('review', '[data-a="a3"]')); await step('phone walk', () => act('walk', '[data-j="signup"]'));
await narrow('walk'); await shot('phone-walk'); await audit('phone walk');
await check.finish();
