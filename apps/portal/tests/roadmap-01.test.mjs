// ROADMAP-01 (DEC-042/043): the Brief, the Library's evidence, generated documents, projects, Next N and elevated actions,
// at the domain layer.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { agentRuns, initAgentRuns } from '../server/agent-runs.mjs';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);

function fixture({ profile = 'planner', picks = ['accounts', 'messaging'], pitch = 'Neighbours lend and borrow tools they rarely use.', plan = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aludel-roadmap01-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const secrets = openSecretStore(root);
  const flows = onboarding({ db, catalogs, secrets, workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile });
  flows.saveDraft(token, { name: 'Tool Share', pitch });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveFeatures(ada, project.id, { picks });
  if (plan) know.ensurePlan(project.id);
  const runs = agentRuns({ db, know, secrets, providers: catalogs.agentProviders.providers, callModel: async () => { throw new Error('no provider in tests'); } });
  return { db, know, runs, ada, id: project.id };
}

test('the Brief starts from the pitch; older vision sections migrate once into claims, and principles reach agents', () => {
  const { know, id, db } = fixture();
  assert.deepEqual(know.list(id, 'brief_claim').map(claim => [claim.section, claim.text]), [['value', 'Neighbours lend and borrow tools they rarely use.']]);
  assert.equal(know.list(id, 'vision_section').length, 0, 'new projects no longer get vision sections');

  // An older project: vision sections, no claims.
  db.prepare("DELETE FROM knowledge_records WHERE project_id = ? AND kind = 'brief_claim'").run(id);
  know.insert(id, 'vision_section', { key: 'statement', body: 'Borrow from your street.', items: [] });
  know.insert(id, 'vision_section', { key: 'needs', body: '', items: ['People buy tools they use once'] });
  know.insert(id, 'vision_section', { key: 'principles', body: '', items: ['Lenders decide who borrows'] });
  know.insert(id, 'vision_section', { key: 'nogos', body: '', items: ['No payments'] });
  know.ensureBrief(id);
  know.ensureBrief(id);
  const claims = know.list(id, 'brief_claim');
  assert.deepEqual(claims.map(claim => [claim.section, claim.text, claim.note]), [
    ['value', 'Borrow from your street.', ''], ['problem', 'People buy tools they use once', ''], ['principles', 'Lenders decide who borrows', ''], ['approach', 'No payments', 'Rules out']], 'migrates once, idempotently');
  assert.deepEqual(know.agentExport(id).principles, ['Lenders decide who borrows'], 'agents read principles from the Brief');
  assert.throws(() => know.insert(id, 'brief_claim', { section: 'nonsense', text: 'x' }), /Brief section/);
});

test('evidence links insights to records; deleting cleans up instead of dangling; comments carry who said them', () => {
  const { know, ada, id } = fixture();
  const claim = know.insert(id, 'brief_claim', { section: 'problem', text: 'Lending feels risky' });
  const source = know.insert(id, 'source', { type: 'interview', title: 'Interview: Dana', body: 'I lent my drill and never saw it again.' });
  assert.throws(() => know.insert(id, 'source', { type: 'interview', title: 'Bad link', url: 'javascript:alert(1)' }), /http/);
  const finding = know.insert(id, 'finding', { sourceId: source.id, type: 'quote', text: 'I lent my drill and never saw it again.' });
  const poll = know.insert(id, 'finding', { sourceId: source.id, type: 'data', text: 'How far would you walk?', data: [['5 min', 9], ['10 min', 18]] });
  assert.deepEqual(poll.data, [['5 min', 9], ['10 min', 18]]);
  const insight = know.insert(id, 'insight', { text: 'Lenders fear loss', strength: 'strong', tags: ['Trust', 'trust', 'lenders'], findings: [finding.id, poll.id] });
  assert.deepEqual(insight.tags, ['trust', 'lenders'], 'tags are lower-case and unique');
  const link = know.insert(id, 'evidence_link', { insightId: insight.id, recordId: claim.id, direction: 'contradicts' });
  assert.throws(() => know.insert(id, 'evidence_link', { insightId: insight.id, recordId: source.id }), /not found/, 'evidence attaches to layer records, not to sources');
  const commented = know.addComment(ada, id, insight.id, 'Only one lender so far.');
  assert.deepEqual(commented.comments.map(comment => [comment.by, comment.text]), [['Ada', 'Only one lender so far.']]);

  know.remove(id, finding.id);
  assert.deepEqual(know.get(id, insight.id).findings, [poll.id], 'a deleted finding leaves its insight');
  know.remove(id, claim.id);
  assert.equal(know.get(id, link.id), null, 'evidence on a deleted record goes with it');
  know.remove(id, source.id);
  assert.equal(know.list(id, 'finding').length, 0, 'deleting a source deletes its findings');
});

test('generated documents compose from the Brief, go out of date when it changes, and agents read the ones marked', () => {
  const { know, ada, id } = fixture();
  know.insert(id, 'brief_claim', { section: 'problem', text: 'Neighbours buy tools they use twice a year' });
  const principle = know.insert(id, 'brief_claim', { section: 'principles', text: 'Lenders decide who borrows' });
  const doc = know.generateDoc(ada, id, { generator: 'prfaq' });
  assert.equal(doc.form, 'generated');
  assert.equal(doc.briefRevision, know.briefRevision(id));
  assert.match(doc.body, /^# Tool Share: Neighbours lend and borrow tools they rarely use/);
  assert.match(doc.body, new RegExp(`Lenders decide who borrows\\. \\[\\[${principle.id}\\]\\]`), 'claims are cited so the document links back to them');
  know.update(id, principle.id, { text: 'Lenders always decide who borrows' });
  assert.equal(know.briefRevision(id) - doc.briefRevision, 1, 'one Brief change since it was generated');
  const regenerated = know.generateDoc(ada, id, { id: doc.id });
  assert.equal(regenerated.briefRevision, know.briefRevision(id));
  assert.match(regenerated.body, /always decide/);
  const written = know.insert(id, 'doc', { title: 'Why we exist', body: 'Every street is a hardware store.', agents: true });
  assert.equal(written.form, 'written');
  assert.throws(() => know.generateDoc(ada, id, { id: written.id }), /Only a generated document/);
});

test('specs and the story map become projects once; items join their project; dependencies cannot loop', () => {
  const { know, id } = fixture({ plan: false });
  const story = know.list(id, 'story').find(entry => entry.title.startsWith('Someone can start a conversation'));
  know.insert(id, 'spec', { title: 'Start talking', phase: 'demo', status: 'accepted', stories: [story.id], problem: 'People cannot reach a lender. More text.', requirements: ['FR-001 The system must …'] });
  know.ensurePlan(id);
  know.ensurePlan(id);
  const projects = know.list(id, 'project');
  const fromSpec = projects.find(project => project.origin === 'From a spec');
  assert.equal(fromSpec.status, 'planned');
  assert.deepEqual(fromSpec.requirements, ['FR-001 The system must …']);
  assert.equal(fromSpec.summary, 'People cannot reach a lender.');
  assert.ok(projects.some(project => project.origin === 'Playbook' && project.title === 'Design foundations'), 'the playbook adds foundations');
  const accounts = projects.find(project => project.origin === 'From the story map' && project.title.startsWith('Join'));
  assert.ok(projects.filter(project => project.origin === 'From the story map').every((project, index, all) => all.findIndex(other => other.title === project.title) === index), 'no two story-map projects share a name');
  assert.equal(accounts?.status, 'completed', 'a template-built activity arrives completed');
  assert.ok(!projects.some(project => project.origin === 'From the story map' && project.stories.includes(story.id)), 'a story in a spec is not planned twice');
  assert.equal(projects.length, know.list(id, 'project').length, 'planning happens once');

  know.remove(id, fromSpec.id);
  know.ensurePlan(id);
  assert.ok(!know.list(id, 'project').some(project => project.origin === 'From a spec'), 'a deleted project does not come back');

  const work = know.createWork(id, { layer: 'product', type: 'define', title: 'Acceptance', targets: [{ id: story.id }] });
  const home = know.list(id, 'project').find(project => project.stories.includes(story.id));
  assert.equal(work.project, home?.id || null, 'an item joins the project of the story it targets');

  const [a, b] = know.list(id, 'project');
  know.update(id, b.id, { deps: [a.id] });
  assert.throws(() => know.update(id, a.id, { deps: [b.id] }), /wait on itself/);
  assert.throws(() => know.update(id, a.id, { start: '2026-10-10', target: '2026-10-01' }), /before the start/);
});

test('Next N follows a fixed rule: the assignee, queued, unblocked, active milestone, highest priority then oldest', () => {
  const { know, runs, ada, id } = fixture();
  const projects = know.list(id, 'project');
  const demo = projects.find(project => project.milestone === 'demo');
  const mvp = projects.find(project => project.milestone === 'mvp');
  const me = { kind: 'person', id: ada.id };
  const make = (title, extra) => know.createWork(id, { layer: 'product', type: 'research', title, targets: [], assignee: me, project: demo.id, ...extra });
  const low = make('Low', { priority: 'low' });
  const highOld = make('High, older', { priority: 'high' });
  const highNew = make('High, newer', { priority: 'high' });
  const later = make('Later milestone', { priority: 'highest', project: mvp.id });
  const blocker = make('Blocker', { priority: 'lowest' });
  const blocked = make('Blocked', { priority: 'highest' });
  know.updateWork(ada, id, blocker.id, { blocks: [blocked.id] });
  const backlog = make('Backlog', { priority: 'highest', state: 'suggested' });
  const { added } = runs.next(ada, id, me, 3);
  assert.deepEqual(added.map(entry => know.workById(id, entry).title), ['High, older', 'High, newer', 'Low']);
  assert.deepEqual(runs.next(ada, id, me, 5).added.map(entry => know.workById(id, entry).title), ['Blocker'], 'what is left: blocked, backlog and later-milestone items never come');
  for (const skipped of [later, blocked, backlog]) assert.notEqual(know.workById(id, skipped.id).status, 'staged');
  assert.throws(() => runs.next(ada, id, me, 0), /between 1 and/);
  assert.ok(low && highOld && highNew);
});

test('elevated actions: agents never default to them, and only a lead of the role (or the owner) accepts their review', () => {
  const { know, ada, id, db } = fixture({ profile: 'dreamer' });
  const roles = know.roleView(id);
  const vision = roles.find(role => role.layer === 'product');
  assert.deepEqual(vision.members, [{ id: ada.id, lead: true }], 'the owner leads every role');
  const brief = vision.actions.find(action => action.id === 'product.brief');
  assert.equal(brief.elevated, true);
  assert.equal(brief.assignee.kind, 'person', 'a Dreamer hands most work to agents, but never an elevated action');
  assert.ok(roles.every(role => role.actions.some(action => action.type === 'review')), 'every role reviews its own work');
  assert.equal(roles.find(role => role.layer === 'work').actions.find(action => action.id === 'work.review').name, 'Final project review');

  const bob = createUser(db, { email: 'bob@example.com', name: 'Bob', password: 'correct-horse-battery' });
  db.prepare("INSERT INTO project_members(project_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)").run(id, bob.id, new Date().toISOString());
  const item = know.createWork(id, { action: 'product.brief', title: 'Tighten the problem', targets: [], documents: ['Vision › Brief'], assignee: { kind: 'person', id: bob.id } });
  db.prepare("UPDATE layer_work_items SET state = 'review', checks_json = ? WHERE id = ?").run(JSON.stringify([{ text: 'Short', verdict: 'accept', note: '' }]), item.id);
  assert.throws(() => know.updateWork(bob, id, item.id, { state: 'done' }), error => error.status === 403 && /Only a lead of the Product lead/.test(error.message));
  const role = know.list(id, 'role').find(entry => entry.layer === 'product');
  know.update(id, role.id, { members: [...role.members, { id: bob.id, lead: true }] });
  assert.equal(know.updateWork(bob, id, item.id, { state: 'done' }).state, 'done', 'a lead may accept');
});
