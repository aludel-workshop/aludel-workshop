// LAY-04: verified work outputs, applied answers, working-style automation and routines, at the domain layer.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { codeLinks, initCodeLinks } from '../server/code-links.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const day = 86400000;

function fixture({ profile = 'planner', picks = ['accounts', 'messaging'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aludel-lay04-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initCodeLinks(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const links = codeLinks({ db, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveFeatures(ada, project.id, { picks });
  return { db, know, flows, links, ada, id: project.id };
}
const storyTitled = (know, id, start) => know.list(id, 'story').find(story => story.title.startsWith(start));

test('LAY-04A: closing a record-changing item needs a revision made from it; code and findings work is exempt', () => {
  const { know, ada, id } = fixture();
  const story = storyTitled(know, id, 'Someone can see their conversations');
  const work = know.createWork(id, { layer: 'product', type: 'define', title: 'Write acceptance', targets: [{ id: story.id, label: story.title }], documents: ['Product › acceptance'] });
  assert.throws(() => know.updateWork(ada, id, work.id, { state: 'done' }), error => error.status === 409 && /no change from W-\d+ yet/.test(error.message));
  know.update(id, story.id, { why: 'People lose track of borrow chats' }, { rationale: 'Unrelated edit' });
  assert.throws(() => know.updateWork(ada, id, work.id, { state: 'done' }), /no change from/, 'an edit not made from the item does not count');
  const edited = know.update(id, story.id, { acceptance: [{ given: 'two conversations', when: 'Sam opens Messages', then: 'both show with unread counts' }] }, { rationale: 'Acceptance', workItemId: work.id });
  assert.equal(know.history(story.id)[0].workItemId, work.id);
  assert.equal(know.updateWork(ada, id, work.id, { state: 'done' }).state, 'done');
  assert.equal(edited.revision, 3);
  assert.throws(() => know.openWorkItem(id, work.id), error => error.status === 409, 'a done item takes no more changes');
  const audit = know.createWork(id, { layer: 'platform', type: 'audit', title: 'Audit', targets: [], documents: ['Platform › findings'] });
  assert.equal(know.updateWork(ada, id, audit.id, { state: 'done' }).state, 'done', 'findings are verified in LAY-05, not by revision');
});

test('LAY-04A: an answer is applied to the record it changes, with its reason, and closes the loop', () => {
  const { know, ada, id } = fixture();
  const story = storyTitled(know, id, 'Someone can start a conversation');
  const question = story.clarifications[0];
  const work = know.createWork(id, { layer: 'product', type: 'define', title: `Clarify: ${question}`, targets: [{ id: story.id, label: story.title }], question: { text: question, options: [] }, documents: ['Product › story (clarified)'] });
  assert.deepEqual(work.question, { text: question, options: [] }, 'a free-text question is kept, not dropped');
  assert.throws(() => know.applyAnswer(ada, id, work.id, story.id), /Answer the question/);
  know.updateWork(ada, id, work.id, { answer: 'A tool listing', rationale: 'Tools are what people talk about' });
  assert.throws(() => know.applyAnswer(ada, id, work.id, know.list(id, 'story')[0].id), /not a target/);
  const applied = know.applyAnswer(ada, id, work.id, story.id);
  const after = know.get(id, story.id);
  assert.deepEqual(after.clarifications, []);
  assert.deepEqual(after.resolved, [{ question, answer: 'A tool listing', work: work.ref }]);
  assert.equal(know.history(story.id)[0].rationale, `${question} → A tool listing. Tools are what people talk about`);
  assert.deepEqual(applied.question.applied, [story.id]);
  assert.match(applied.log.at(-1).text, /Applied the answer/);
  assert.equal(know.updateWork(ada, id, work.id, { state: 'done' }).state, 'done');

  const page = know.list(id, 'page').find(entry => entry.label === 'Messages');
  const pageWork = know.createWork(id, { layer: 'pages', type: 'design', title: 'Layout', targets: [{ id: page.id, label: 'Messages page' }], question: { text: 'List or cards?', options: ['List', 'Cards'] }, documents: ['Pages › Messages'] });
  know.updateWork(ada, id, pageWork.id, { answer: 'List' });
  know.applyAnswer(ada, id, pageWork.id, page.id);
  assert.match(know.get(id, page.id).notes, new RegExp(`Decided in ${pageWork.ref}: List or cards\\? List`));
});

test('LAY-04B: suggestions come from the server, including contracts that Demo stories need', () => {
  const { know, ada, id } = fixture({ profile: 'tinkerer' });
  const view = know.view(ada, id);
  const conversation = view.objects.find(object => object.name === 'Conversation');
  assert.ok(view.suggestions.some(item => item.key === `plan:${conversation.id}` && item.layer === 'data'));
  assert.ok(view.suggestions.some(item => item.type === 'define' && item.question), 'a clarification carries its question');
  assert.ok(!view.suggestions.some(item => item.key.startsWith('plan:') && item.title.includes('Account')), 'accepted contracts need no plan');
  assert.deepEqual(know.automate(id), [], 'a Tinkerer does everything themselves: nothing is staged');
  assert.ok(Object.values(view.automation).every(policy => policy.mode === 'you'));
});

test('LAY-04B (as revised by DEC-040): working style decides what is available for agents; nothing is opened until batched', () => {
  const { know, flows, ada, id } = fixture({ profile: 'planner' });
  assert.deepEqual(know.automate(id), [], 'no items are opened automatically');
  assert.equal(know.workList(id).length, 0);
  const pool = know.agentPool(id);
  assert.deepEqual([...new Set(pool.map(entry => entry.type))], ['plan'], 'a Planner writes acceptance themselves; agents take plans (page designs wait for a design runner)');
  assert.ok(pool.every(entry => entry.profileId === know.list(id, 'agent_profile').find(profile => profile.name === 'Architect').id));
  assert.equal(know.automationPolicy(id).plan.mode, 'agent');
  assert.equal(know.automationPolicy(id).design.mode, 'agent-review');
  assert.equal(know.automationPolicy(id).define.mode, 'you');
  // Overriding one preference changes the policy and the pool.
  flows.savePreferences(ada, id, { overrides: { planning: 'self' } });
  assert.equal(know.automationPolicy(id).design.mode, 'you');
  assert.deepEqual(know.agentPool(id), []);
});

test('LAY-04B (as revised by DEC-040): a Dreamer makes acceptance writing available to the Product lead', () => {
  const { know, id } = fixture({ profile: 'dreamer' });
  const define = know.agentPool(id).filter(entry => entry.type === 'define');
  assert.ok(define.length > 0);
  const lead = know.list(id, 'agent_profile').find(profile => profile.name === 'Product lead');
  assert.ok(define.every(entry => entry.profileId === lead.id));
  assert.equal(know.automationPolicy(id).define.mode, 'agent-review');
});

test('LAY-04C: routines run when due, before releases or by hand, never twice while open', () => {
  const { know, ada, id } = fixture({ profile: 'planner' });
  const routines = know.list(id, 'routine');
  assert.deepEqual(routines.map(routine => routine.cadence), ['weekly', 'weekly', 'monthly', 'before-release']);
  const created = Date.parse(know.view(ada, id).routines[0].nextRunAt) - 7 * day;
  const at = offset => new Date(created + offset * day).toISOString();
  assert.deepEqual(know.runRoutines(id, { at: at(6) }), [], 'nothing is due in the first week');
  const weekly = know.runRoutines(id, { at: at(8) });
  assert.deepEqual(weekly.map(item => item.title.split(' · ')[0]).sort(), ['Accessibility sweep', 'Product drift check']);
  assert.ok(weekly.every(item => item.assignee?.label === 'Reviewer'), 'a Planner hands audits to the Reviewer');
  assert.deepEqual(know.runRoutines(id, { at: at(16) }), [], 'the previous items are still open');
  const drift = weekly.find(item => item.title.startsWith('Product drift'));
  know.updateWork(ada, id, drift.id, { state: 'done' });
  assert.deepEqual(know.runRoutines(id, { at: at(16) }).map(item => item.title.split(' · ')[0]), ['Product drift check'], 'due again once closed, a week after the last run');
  assert.deepEqual(know.runRoutines(id, { trigger: 'release', at: at(16) }).map(item => item.title.split(' · ')[0]), ['Security audit before release']);
  assert.deepEqual(know.runRoutines(id, { trigger: 'release', at: at(17) }), [], 'one open security audit, however many builds');
  const monthly = routines.find(routine => routine.cadence === 'monthly');
  assert.equal(know.runRoutines(id, { at: at(31) }).filter(item => item.context.routine === monthly.id).length, 1);
  assert.throws(() => know.runRoutines(id, { trigger: 'manual', routineId: monthly.id }), error => error.status === 409);
  const sweep = routines.find(routine => routine.title === 'Accessibility sweep');
  know.update(id, sweep.id, { enabled: false }, { rationale: 'Not yet' });
  know.updateWork(ada, id, weekly.find(item => item.title.startsWith('Accessibility')).id, { state: 'done' });
  assert.deepEqual(know.runRoutines(id, { at: at(60) }).filter(item => item.context.routine === sweep.id), [], 'a disabled routine does not run on schedule');
  assert.equal(know.runRoutines(id, { trigger: 'manual', routineId: sweep.id }).length, 1, 'but can still be run by hand');
  assert.throws(() => know.insert(id, 'routine', { title: 'Hourly', layer: 'product', type: 'audit', cadence: 'hourly' }), /how often/);
});

test('LAY-04B: reconcile items created by code links are routed like any other work', () => {
  const { know, links, db, id } = fixture({ profile: 'planner' });
  const story = storyTitled(know, id, 'Someone can sign up');
  db.prepare("INSERT INTO code_units(id, project_id, unit_key, path, symbol, kind, hash, reachable, last_commit, line, calls_json, indexed_at) VALUES ('cu-1', ?, 'src/app.ts#App', 'src/app.ts', 'App', 'component', 'h', 1, NULL, 1, '[]', ?)").run(id, new Date().toISOString());
  links.link(id, story.id, 'cu-1', { kind: 'generated', source: 'manifest' });
  know.update(id, story.id, { why: 'Changed' }, { rationale: 'Change' });
  know.automate(id);
  const reconcile = know.workList(id).find(item => item.type === 'reconcile');
  assert.equal(reconcile.assignee.label, 'Coding agent');
  assert.equal(reconcile.context.automation.mode, 'agent-review');
  assert.ok(reconcile.context.reconcile, 'routing keeps the reconcile context');
});
