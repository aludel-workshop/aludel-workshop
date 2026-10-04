// AGENT-WORK-01 work ecosystem prototype v1 walkthrough: the board with Linear sync (moves, drag, peek, filters, arriving
// events), routines (formula editing, Run now) and projects (milestones, Plan the rest with Claude), plus 390 px. Visible
// controls only, Step mode. Uses the shared tools/prototype-check.mjs. Run: node docs/design/agent-work/ecosystem/v1/walkthrough.mjs
import { openPrototype } from '../../../../../tools/prototype-check.mjs';

const check = await openPrototype({ url: new URL('./index.html', import.meta.url).href, shots: new URL('./shots/', import.meta.url).pathname });
const { page, step, shot, audit, narrow, load } = check;
const act = (a, extra = '') => page.click(`[data-act="${a}"]${extra}`);
const text = () => page.locator('#view').innerText();
const see = async t => { if (!(await text()).toLowerCase().includes(t.toLowerCase())) throw new Error(`expected to see "${t}"`); };
const dlg = async t => { if (!(await page.locator('#dlg').innerText()).includes(t)) throw new Error(`dialog should say "${t}"`); };
const col = (ref) => page.locator(`.card[data-ref="${ref}"]`).evaluate(c => c.closest('.bcol').dataset.col);
const inCol = (ref, c) => step(`${ref} in ${c}`, async () => { const got = await col(ref); if (got !== c) throw new Error(`${ref} is in ${got}, not ${c}`); });
const menuMove = (ref, to) => step(`move ${ref} → ${to}`, async () => { await page.hover(`.card[data-ref="${ref}"]`); await act('menu', `[data-ref="${ref}"]`); await act('move', `[data-ref="${ref}"][data-to="${to}"]`); });

await load();
await step('step mode', () => page.click('[data-speed="step"]'));
await step('sync pill', () => see('Linear · team BIO')); await shot('board'); await audit('board');

// Peek a card in progress; its actions and needs show without leaving the board.
await step('peek W-11', () => act('peek', '[data-ref="W-11"]')); await step('peek actions', () => page.locator('.peek').getByText('Let a Member hold a password').waitFor());
await shot('peek'); await audit('peek');
await step('needs filter', () => act('needs-only')); await step('only needs', async () => { if (await page.locator('.card').count() !== 2) throw new Error('needs filter should leave 2 cards'); });
await step('needs off', () => act('needs-only')); await step('close peek', () => act('close-peek'));

// Moves: a rough note to Ready asks to define it; Claude defines and moves it.
await menuMove('W-12', 'ready'); await step('define asked', () => dlg('still a rough note')); await shot('move-define'); await audit('define dialog');
await step('define', () => act('dlg-define')); await step('defined', () => page.locator('.card[data-ref="W-12"] .t:not(.rough)').waitFor());
await inCol('W-12', 'ready'); await step('renamed', () => see('Reset a forgotten password'));
// Unassigned Ready item to In progress asks who works on it; local claim.
await menuMove('W-12', 'progress'); await step('start asked', () => dlg('Start W-12 with Claude'));
await step('cancel', () => act('dlg-cancel')); await inCol('W-12', 'ready');
// Drag W-13 to In progress: confirm Start.
await step('drag W-13', () => page.dragAndDrop('.card[data-ref="W-13"]', '.bcol[data-col="progress"]')); await step('start confirm', () => dlg('Start W-13 with Claude'));
await shot('move-start'); await step('start', () => act('dlg-start')); await inCol('W-13', 'progress');
// Claude's items can't be dragged to Done.
await menuMove('W-11', 'done'); await step('closeout', () => dlg('closes from the item')); await shot('move-done-refused'); await step('cancel 2', () => act('dlg-cancel')); await inCol('W-11', 'progress');
// Peek's Move to on a draft without an assignee... W-14 to In progress asks who.
await step('peek W-14', () => act('peek', '[data-ref="W-14"]')); await step('move select', () => page.selectOption('#peek-move', 'progress'));
await step('assign asked', () => dlg('Who works on W-14')); await shot('move-assign'); await audit('assign');
await step('local', () => act('dlg-local')); await inCol('W-14', 'progress'); await step('claim cmd', async () => { if (!(await page.locator('.toast').innerText()).includes('aludel claim W-14')) throw new Error('no claim command'); });
await step('close peek 2', () => act('close-peek'));

// Events: Linear issue, a routine-made bug defined to Ready, a Linear field change.
await step('e1', () => act('tick')); await step('from linear', () => see('Empty state for Explore')); await step('from linear tag', () => see('From Linear'));
await step('e2', () => act('tick')); await step('e3', () => act('tick')); await step('routine made', () => see('Search crashes with an emoji')); await shot('routine-item-defining');
await step('e4', () => act('tick')); await inCol('W-20', 'ready');
await step('e5', () => act('tick')); await step('peek W-15', () => act('peek', '[data-ref="W-15"]')); await step('sync note', () => page.locator('.syncnote').getByText('Priority changed in Linear').waitFor());
await shot('linear-change'); await step('close peek 3', () => act('close-peek'));

// Sync settings drawer.
await step('sync', () => act('sync')); await step('mapping', () => page.locator('#syncd').getByText('Aludel → Linear sub-issues').waitFor()); await shot('sync-settings'); await audit('sync');
await step('close sync', () => page.click('#syncd [data-act="close-drawer"]'));

// Routines: list, formula, edit reads back, Run now lands on the board.
await step('routines', () => page.click('[data-tab="routines"]')); await shot('routines'); await audit('routines');
await step('open deps', () => act('routine', '[data-id="deps"]')); await step('sentence', () => see('Every Monday at 09:00'));
await step('edit when', () => page.fill('#r-whentext', 'Every Monday and Thursday at 09:00')); await step('reads back', async () => { if (!(await page.locator('#sentence').innerText()).includes('every Monday and Thursday')) throw new Error('sentence did not follow'); });
await step('until ready', () => page.selectOption('#r-until', 'ready')); await step('sentence until', () => see('stops at Ready')); await shot('routine-formula'); await audit('formula');
await step('until start', () => page.selectOption('#r-until', 'start'));
await step('run now', () => act('run-now', '[data-id="deps"]')); await step('run listed', () => page.locator('.runs').getByText('W-21').waitFor());
await step('to item', () => act('peek-from', '[data-ref="W-21"]')); await inCol('W-21', 'progress'); await shot('routine-run-on-board');
await step('back routines', () => page.click('[data-tab="routines"]')); await step('new', () => act('new-routine')); await step('new off', () => page.locator('[data-act="run-now"][disabled]').waitFor());

// Projects: list, detail, plan with Claude, accept a suggestion.
await step('projects', () => page.click('[data-tab="projects"]')); await shot('projects'); await audit('projects');
await step('open onb', () => act('project', '[data-id="onb"]')); await step('plan', () => act('plan', '[data-id="onb"]'));
await step('suggested', () => see('Welcome email after confirming')); await shot('project-plan'); await audit('plan');
await step('accept', () => act('accept-sugg', '[data-i="0"]')); await step('drop', () => act('drop-sugg', '[data-i="0"]'));
await step('in milestone', () => page.locator('.msrow').first().getByText('Welcome email after confirming').waitFor());
await step('to board', () => act('project-board', '[data-id="onb"]')); await step('filtered', async () => { if (await page.locator('.card[data-ref="W-13"]').count()) throw new Error('project filter missed'); });
await inCol('W-22', 'draft'); await shot('project-board');

// Questions keep their answers across Reset.
await step('questions', () => act('questions')); await step('answer', () => page.fill('#a-E1', 'test answer')); await shot('review-questions'); await audit('questions');
await step('close q', () => page.click('#questions [data-act="close-drawer"]'));
await step('answers kept', async () => { await act('reset'); await act('questions'); if (await page.inputValue('#a-E1') !== 'test answer') throw new Error('reset lost answers'); await page.fill('#a-E1', ''); await page.click('#questions [data-act="close-drawer"]'); });

// Narrow.
await page.setViewportSize({ width: 390, height: 844 }); await load();
await step('phone step', () => page.click('[data-speed="step"]'));
await narrow('board'); await shot('phone-board'); await audit('phone board');
await step('phone peek', () => act('peek', '[data-ref="W-11"]')); await narrow('peek'); await shot('phone-peek');
await step('phone routine', async () => { await page.click('[data-tab="routines"]'); await act('routine', '[data-id="triage"]'); }); await narrow('formula'); await shot('phone-formula'); await audit('phone formula');
await check.finish();
