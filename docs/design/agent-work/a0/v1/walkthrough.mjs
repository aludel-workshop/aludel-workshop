// AGENT-WORK-01 A0 prototype v1 walkthrough: drives the goal run with visible controls only (Step mode, so each run event
// is deliberate), takes screenshots at 1440x1000 and 390x844, runs axe, and checks narrow overflow. Uses the shared
// tools/prototype-check.mjs. Run: node docs/design/agent-work/a0/v1/walkthrough.mjs (AXE_PATH if axe-core isn't resolvable).
import { openPrototype } from '../../../../../tools/prototype-check.mjs';

const check = await openPrototype({ url: new URL('./index.html', import.meta.url).href, shots: new URL('./shots/', import.meta.url).pathname });
const { page, step, shot, audit, narrow, load } = check;
const act = (a, extra = '') => page.click(`[data-act="${a}"]${extra}`);
const tick = (n = 1) => step(`tick ×${n}`, async () => { for (let i = 0; i < n; i++) await act("tick"); });
const until = (text, max = 20) => step(`until ${text}`, async () => { for (let i = 0; i < max; i++) { if ((await page.locator('#view').innerText()).includes(text)) return; await act('tick'); } throw new Error(`never saw "${text}"`); });
const see = async text => { if (!(await page.locator('#view').innerText()).includes(text)) throw new Error(`expected to see "${text}"`); };
const absent = async sel => { if (await page.locator(sel).count()) throw new Error(`${sel} should not be offered`); };
const inFrame = text => page.locator('.fbody[data-side="proposed"] button', { hasText: text }).first();

await load();
await step('step mode', () => page.click('[data-speed="step"]'));
await shot('ready'); await audit('ready');

// Planning, then the plan card.
await step('go', () => act('go')); await step('planning', () => see('Reading the stack'));
await tick(2); await shot('planning');
await until('How the sign-up flow gets built');
await step('context', () => page.click('details.ctx summary')); await shot('plan'); await audit('plan');
// Request changes needs a note, then revises the plan.
await step('request', () => act('request-changes'));
await step('empty note refused', async () => { await act('send-plannote'); if (!await page.locator('#plannote').isVisible()) throw new Error('an empty note was sent'); });
await step('note', () => page.fill('#plannote', 'Keep Sign in reachable from the sign-up page'));
await shot('plan-request-changes'); await step('send note', () => act('send-plannote'));
await until('Revised for your note'); await shot('plan-revised');
await step('approve', () => act('approve-plan'));

// The run: parallel agents, Ask first, a question that doesn't stop other steps.
await until('Data is in Ask first mode'); await shot('running-parallel'); await audit('running');
await until('How should a new member confirm their email?');
await until('Meanwhile: wrote Create your first world'); await shot('question'); await audit('question');
await step('allow data', () => act('data-allow'));
await step('answer', () => page.click('form[data-form="answer"] button[type="submit"]'));
await until('Added by binding'); await shot('binding-added');
// Verify catches a failure and hands it back to the Code agent before review.
await until('opened /verify without its token'); await shot('verify-failed');
await until('Fixed the token Verify caught');
await until('Ready for review'); await shot('ready-for-review');
await step('collapsed summaries', () => see('Two journeys, one persona each'));

// The review: claims by layer, a walk, flags, Finish, Send back.
await step('open review', () => act('open-review')); await shot('review-pages'); await audit('review pages');
await step('approve pages', () => act('approve')); await step('next', () => act('next-claim'));
await shot('review-data'); await step('approve data', () => act('approve')); await step('next 2', () => act('next-claim'));
await step('walk', () => act('walk')); await step('sign up btn', () => inFrame('Sign up').click());
await step('create', () => inFrame('Create account').click()); await shot('review-walk-step3'); await audit('walk');
await step('open email', () => inFrame('Open the email').click());
await step('flag step', () => act('flag-step')); await step('empty flag refused', async () => { await act('save-flag'); if (!await page.locator('#flagtext').isVisible()) throw new Error('a flag saved without a note'); });
await step('flag text', () => page.fill('#flagtext', 'Say how long the link stays valid')); await step('save flag', () => act('save-flag'));
await step('approve hidden', () => absent('[data-act="approve"]')); await shot('review-journey-flagged');
await step('flag journey', () => act('flag-journey')); await step('journey note', () => page.fill('#flagtext', 'Also offer Send it again on the email page')); await step('save j', () => act('save-flag'));
await step('next 3', () => act('next-claim'));
await step('walk 2', () => act('walk')); await step('start world', () => inFrame('Create your first world').click()); await step('create world', () => inFrame('Create world').click());
await step('approve j2', () => act('approve')); await step('next 4', () => act('next-claim'));
await step('approve existing', () => act('approve')); await step('next 5', () => act('next-claim'));
await shot('review-finish-send-back'); await audit('finish');
await step('menu', () => act('menu')); await shot('review-claims-menu'); await audit('menu'); await step('menu close', () => act('menu'));
await step('send back', () => act('send-back'));
await step('round 2', () => see('Address your')); await tick(1); await shot('round-2');
await until('after round 2');
await step('review 2', () => act('open-review'));
await step('pages kept', async () => { if (!(await page.locator('.claimbtn').innerText()).includes('Approved')) throw new Error('round 1 approval was lost'); });
await step('to signup', async () => { await act('menu'); await page.click('#claimmenu [data-claim="signup"]'); });
await step('changed chip', () => see('Changed in round 2')); await step('approve 2', () => act('approve'));
await step('to finish', async () => { await act('menu'); await page.click('#claimmenu [data-claim="finish"]'); }); await shot('review-finish-accept');
await step('accept', () => act('accept')); await step('accepted', () => see('Merged as one')); await shot('accepted');

// Scenarios: fails before start, Verify stuck, stale main.
const scenario = async name => { await act('scenarios'); await page.check(`#scenarios input[data-scn="${name}"]`); await page.click('#scenarios [data-act="close-drawer"]'); };
await step('reset', async () => { await act('scenarios'); await act('reset'); await page.click('#scenarios [data-act="close-drawer"]'); });
await scenario('failStart'); await step('go fail', () => act('go')); await step('didnt start', () => see("Didn't start")); await shot('failed-before-start'); await audit('failed start');
await step('retry', () => act('retry')); await step('replanning', () => see('Planning'));
await scenario('verifyStuck');
await step('jump review', async () => { await act('scenarios'); await page.click('#scenarios [data-act="jump"][data-to="review"]'); });
await step('stuck', () => see('Verify failed twice')); await shot('verify-stuck'); await audit('stuck');
await step('more', () => act('stuck-more'));
await step('uncheck stuck', async () => { await act('scenarios'); await page.uncheck('#scenarios input[data-scn="verifyStuck"]'); await page.click('#scenarios [data-act="close-drawer"]'); });
await scenario('stale');
await step('jump review 2', async () => { await act('scenarios'); await page.click('#scenarios [data-act="jump"][data-to="review"]'); });
await step('to finish stale', async () => { await act('menu'); await page.click('#claimmenu [data-claim="finish"]'); }); await step('stale note', () => see('main moved')); await shot('finish-stale');
await step('questions', () => act('questions')); await step('answer q', () => page.fill('#a-Q1', 'test answer')); await shot('review-questions'); await audit('questions');
await step('close q', () => page.click('#questions [data-act="close-drawer"]'));
await step('answers kept', async () => { await act('scenarios'); await act('reset'); await page.click('#scenarios [data-act="close-drawer"]'); await act('questions');
  if (await page.inputValue('#a-Q1') !== 'test answer') throw new Error('reset lost the review answers'); await page.fill('#a-Q1', ''); await page.click('#questions [data-act="close-drawer"]'); });

// Narrow.
await page.setViewportSize({ width: 390, height: 844 }); await load();
await step('phone step mode', () => page.click('[data-speed="step"]'));
await step('phone jump plan', async () => { await act('scenarios'); await page.click('#scenarios [data-act="jump"][data-to="plan"]'); });
await narrow('plan'); await shot('phone-plan'); await audit('phone plan');
await step('phone jump run', async () => { await act('scenarios'); await page.click('#scenarios [data-act="jump"][data-to="running"]'); });
await narrow('running'); await shot('phone-question'); await audit('phone running');
await step('phone jump review', async () => { await act('scenarios'); await page.click('#scenarios [data-act="jump"][data-to="review"]'); });
await step('phone walk', async () => { await act('menu'); await page.click('#claimmenu [data-claim="signup"]'); await act('walk'); });
await narrow('walk'); await shot('phone-walk'); await audit('phone walk');
await check.finish();
