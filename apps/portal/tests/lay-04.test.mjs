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

test('LAY-04A (as revised by WORK-UX-01): an answer lands in the record it changes, with its reason, and finishes the item', () => {
  const { know, ada, id } = fixture();
  const story = storyTitled(know, id, 'Someone can start a conversation');
  const question = story.clarifications[0];
  const work = know.createWork(id, { layer: 'product', type: 'define', title: `Clarify: ${question}`, targets: [{ id: story.id, label: story.title }], question: { text: question, options: [] }, documents: ['Product › story (clarified)'] });
  assert.equal(work.action, 'product.clarify', 'a question makes it the clarify action');
  assert.deepEqual(work.question, { text: question, options: [] }, 'a free-text question is kept, not dropped');
  assert.throws(() => know.applyAnswer(ada, id, work.id, story.id), /Answer the question/);
  const answered = know.updateWork(ada, id, work.id, { answer: 'A tool listing', rationale: 'Tools are what people talk about' });
  const after = know.get(id, story.id);
  assert.deepEqual(after.clarifications, []);
  assert.deepEqual(after.resolved, [{ question, answer: 'A tool listing', work: work.ref }]);
  assert.equal(know.history(story.id)[0].rationale, `${question} → A tool listing. Tools are what people talk about`);
  assert.deepEqual(answered.question.applied, [story.id]);
  assert.equal(answered.state, 'done', 'applying the answer is the work');
  assert.ok(answered.checks.every(check => check.verdict === 'accept'));
  assert.equal(know.applyAnswer(ada, id, work.id, story.id).question.applied.length, 1, 'applying again changes nothing');
  assert.equal(know.get(id, story.id).resolved.length, 1);

  const page = know.list(id, 'page').find(entry => entry.label === 'Messages');
  const pageWork = know.createWork(id, { layer: 'pages', type: 'design', title: 'Layout', targets: [{ id: page.id, label: 'Messages page' }], question: { text: 'List or cards?', options: ['List', 'Cards'] }, documents: ['Pages › Messages'] });
  know.updateWork(ada, id, pageWork.id, { answer: 'List' });
  assert.match(know.get(id, page.id).notes, new RegExp(`Decided in ${pageWork.ref}: List or cards\\? List`));
});

test('WORK-UX-01 (DEC-041): each layer\'s gaps become backlog items, assigned by their action; filled gaps close them', () => {
  const { know, ada, id } = fixture({ profile: 'tinkerer' });
  const created = know.syncBacklog(id);
  const conversation = know.list(id, 'data_object').find(object => object.name === 'Conversation');
  assert.ok(created.length >= 5);
  assert.ok(created.every(item => item.state === 'suggested' && item.status === 'backlog'));
  assert.ok(created.every(item => item.assignee?.kind === 'person' && item.assignee.id === ada.id), 'a Tinkerer takes everything');
  assert.ok(created.some(item => item.action === 'data.contract' && item.targets[0].id === conversation.id));
  assert.ok(created.some(item => item.action === 'product.clarify' && item.question), 'a clarification carries its question');
  assert.ok(!created.some(item => item.action === 'data.contract' && item.title.includes('Account')), 'accepted contracts need no work');
  assert.ok(created.every(item => item.checks.length && item.checks[0].source), 'checks come from the action, sourced from the target');
  assert.deepEqual(know.syncBacklog(id), [], 'one item per gap');
  // Filling a gap some other way removes its untouched backlog item.
  const acceptance = created.find(item => item.action === 'product.define');
  know.update(id, acceptance.targets[0].id, { acceptance: [{ given: 'a neighbour', when: 'they look', then: 'they see it' }] }, { rationale: 'Written by hand' });
  know.syncBacklog(id);
  assert.ok(!know.workList(id).some(item => item.id === acceptance.id));
  // Priorities start from the phase: current-phase acceptance and contracts first.
  const demo = created.find(item => item.action === 'data.contract' && item.targets[0].id === conversation.id);
  assert.ok(['high', 'medium', 'low'].includes(demo.priority));
});

test('WORK-UX-01: roles by layer; the onboarding style only presets who takes each action', () => {
  const planner = fixture({ profile: 'planner' });
  const roles = planner.know.roleView(planner.id);
  assert.deepEqual(roles.map(role => role.layer), ['product', 'design', 'pages', 'data', 'platform', 'work']);
  const action = (fixtureValue, key) => fixtureValue.know.roleView(fixtureValue.id).flatMap(role => role.actions).find(entry => entry.id === key);
  const agent = planner.know.defaultProfile(planner.id);
  assert.deepEqual(action(planner, 'product.define').assignee, { kind: 'person', id: planner.ada.id }, 'a Planner writes acceptance');
  assert.deepEqual(action(planner, 'data.contract').assignee, { kind: 'agent', id: agent.id }, 'agents write contracts');
  const dreamer = fixture({ profile: 'dreamer' });
  assert.equal(action(dreamer, 'product.define').assignee.kind, 'agent');
  assert.equal(action(dreamer, 'platform.configure').assignee.kind, 'person', 'anything that may cost money stays with the person');
  const tinkerer = fixture({ profile: 'tinkerer' });
  assert.ok(tinkerer.know.roleView(tinkerer.id).flatMap(role => role.actions).every(entry => entry.assignee.kind === 'person'));
  // Changing an action's assignee is a revision; new items follow it, existing ones keep theirs.
  const define = action(planner, 'product.define');
  planner.know.update(planner.id, define.recordId, { assignee: { kind: 'agent', id: agent.id } }, { rationale: 'Agents write acceptance now' });
  const story = storyTitled(planner.know, planner.id, 'Someone can see their conversations');
  const item = planner.know.createWork(planner.id, { layer: 'product', type: 'define', title: 'Acceptance', targets: [{ id: story.id }] });
  assert.deepEqual(item.assignee, { kind: 'agent', id: agent.id, label: 'Default agent' });
  assert.throws(() => planner.know.insert(planner.id, 'work_action', { key: 'product.nope', phases: ['x'] }), /Unknown action/);
  assert.throws(() => planner.know.update(planner.id, define.recordId, { tools: ['teleport'] }), /Unknown tool/);
  // No working style anywhere in the snapshot.
  const view = planner.know.view(planner.ada, planner.id);
  assert.equal(view.automation, undefined); assert.equal(view.agentPool, undefined);
});

test('WORK-UX-01: priority and blocking links as Jira has them', () => {
  const { know, ada, id } = fixture();
  const [a, b, c] = ['One', 'Two', 'Three'].map(title => know.createWork(id, { layer: 'platform', type: 'audit', title, documents: ['x'] }));
  assert.equal(a.priority, 'medium');
  assert.equal(know.updateWork(ada, id, a.id, { priority: 'highest' }).priority, 'highest');
  assert.throws(() => know.updateWork(ada, id, a.id, { priority: 'urgent' }), /Choose a priority/);
  know.updateWork(ada, id, a.id, { blocks: [b.id] });
  know.updateWork(ada, id, b.id, { blocks: [c.id] });
  assert.deepEqual(know.workList(id).find(item => item.id === c.id).blockedBy, [b.id]);
  assert.throws(() => know.updateWork(ada, id, c.id, { blocks: [a.id] }), error => error.status === 409 && /block itself/.test(error.message));
  assert.throws(() => know.updateWork(ada, id, a.id, { blocks: [a.id] }), /can't block itself/);
  know.updateWork(ada, id, b.id, { state: 'done' });
  assert.deepEqual(know.workList(id).find(item => item.id === c.id).blockedBy, [], 'a done blocker no longer blocks');
});

test('LAY-04C: routines run when due, before releases or by hand, never twice while open', () => {
  const { know, ada, id } = fixture({ profile: 'planner' });
  const routines = know.list(id, 'routine');
  assert.deepEqual(routines.map(routine => routine.cadence), ['weekly', 'weekly', 'monthly', 'before-release', 'weekly'], 'ROADMAP-01 adds the weekly milestone check');
  const created = Date.parse(know.view(ada, id).routines[0].nextRunAt) - 7 * day;
  const at = offset => new Date(created + offset * day).toISOString();
  assert.deepEqual(know.runRoutines(id, { at: at(6) }), [], 'nothing is due in the first week');
  const weekly = know.runRoutines(id, { at: at(8) });
  assert.deepEqual(weekly.map(item => item.title.split(' · ')[0]).sort(), ['Accessibility sweep', 'Milestone check', 'Product drift check']);
  assert.deepEqual(weekly.map(item => item.action).sort(), ['pages.a11y', 'product.drift', 'work.milestone'], 'each routine has its action');
  assert.ok(weekly.every(item => item.assignee?.label === 'Default agent'), 'a Planner hands audits to the default agent');
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

test('LAY-04B (as revised by WORK-UX-01): reconcile items created by code links go to the reconcile action\'s assignee', () => {
  const { know, links, db, id } = fixture({ profile: 'planner' });
  const story = storyTitled(know, id, 'Someone can sign up');
  db.prepare("INSERT INTO code_units(id, project_id, unit_key, path, symbol, kind, hash, reachable, last_commit, line, calls_json, indexed_at) VALUES ('cu-1', ?, 'src/app.ts#App', 'src/app.ts', 'App', 'component', 'h', 1, NULL, 1, '[]', ?)").run(id, new Date().toISOString());
  links.link(id, story.id, 'cu-1', { kind: 'generated', source: 'manifest' });
  know.update(id, story.id, { why: 'Changed' }, { rationale: 'Change' });
  const reconcile = know.workList(id).find(item => item.type === 'reconcile');
  assert.equal(reconcile.action, 'platform.reconcile');
  assert.equal(reconcile.assignee.label, 'Default agent');
  assert.equal(reconcile.priority, 'high');
  assert.ok(reconcile.context.reconcile, 'the reconcile context is kept');
});
