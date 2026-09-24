// PAGES-UX-01: page specs (sections, states, links), flows, the Map's grid places, change requests that become Engineer
// work, flow reviews, and what the scaffold generates from page specs, at the domain layer.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { componentStatus } from '../server/design.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { sitePages, skeletonFiles } from '../server/scaffold.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const configDirectory = new URL('../config', import.meta.url).pathname;
const catalogs = loadCatalogs(configDirectory);
const gitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(join(configDirectory, 'project-setup.json'), 'utf8')));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-pages-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveDesign(ada, project.id, { feel: 'editorial', theme: 'light', accent: '#2e7d5b', notes: '' });
  flows.saveFeatures(ada, project.id, { picks: ['accounts', 'messaging'] });
  know.ensureDesign(project.id);
  return { db, know, flows, ada, id: project.id };
}
const component = (know, id, name) => know.list(id, 'component').find(entry => entry.name === name);
const pageNamed = (know, id, label) => know.list(id, 'page').find(entry => entry.label === label);
const blank = { icon: 'article', pageType: 'detail', inNav: false, origin: 'You', status: 'planned' };

test('a page spec holds sections from the design system; a section that leads somewhere is also a link', () => {
  const { know, id } = fixture();
  const messages = pageNamed(know, id, 'Messages');
  const detail = know.insert(id, 'page', { ...blank, label: 'Tool detail', notes: 'Everything Sam needs to decide' });
  const list = component(know, id, 'List');
  const saved = know.update(id, messages.id, { sections: [{ name: 'Conversations', component: list.id, stories: messages.stories.slice(0, 1), leadsTo: detail.id, content: { title: 'Your conversations', action: 'Open' } }],
    states: { empty: 'No conversations yet, with a way to start one', ready: 'ignored: ready is always specified' } }, { rationale: 'Spec' });
  assert.equal(saved.sections.length, 1);
  assert.match(saved.sections[0].id, /^sec-[a-z0-9]{4,10}$/, 'sections get stable ids');
  assert.equal(saved.sections[0].state, 'ready');
  assert.deepEqual(saved.links, [{ to: detail.id, label: 'Open' }], 'the section’s target becomes a link on the map');
  assert.deepEqual(Object.keys(saved.states).sort(), ['empty', 'ready']);
  assert.throws(() => know.update(id, messages.id, { sections: [{ name: 'Broken', component: 'cmp-00000000' }] }), /not found/, 'components must exist in the project');
  assert.throws(() => know.update(id, messages.id, { sections: [{ name: 'Nowhere', state: 'sideways' }] }), /Unknown page state/);
  assert.throws(() => know.update(id, messages.id, { sections: [{ name: '' }] }), /Section name is required/);

  // Deleting a page lets go of it everywhere: links, sections that led there and flow steps.
  know.ensureFlows(id);
  const flow = know.list(id, 'flow')[0];
  know.update(id, flow.id, { steps: [...flow.steps, { page: detail.id, name: 'See details' }] });
  know.remove(id, detail.id);
  const after = know.get(id, messages.id);
  assert.deepEqual(after.links, []);
  assert.equal(after.sections[0].leadsTo, null);
  const step = know.get(id, flow.id).steps.at(-1);
  assert.equal(step.page, null, 'the step becomes a gap');
  assert.equal(step.why, 'Its page was deleted.');
});

test('flows start as one per story-map activity, once, through the pages that realise their stories', () => {
  const { know, id } = fixture();
  know.ensureFlows(id);
  const activities = know.list(id, 'activity');
  const seeded = know.list(id, 'flow');
  assert.equal(seeded.length, activities.length);
  const talk = seeded.find(flow => flow.activity === activities.find(activity => activity.pack === 'Messaging')?.id);
  assert.ok(talk.steps.length >= 1, 'the Messaging flow goes through its pages');
  assert.ok(talk.steps.every(step => know.get(id, step.page)?.kind === 'page' && know.get(id, step.story)?.kind === 'story'));
  for (const flow of seeded) know.remove(id, flow.id);
  know.ensureFlows(id);
  assert.equal(know.list(id, 'flow').length, 0, 'deleting every flow does not bring them back');
  assert.throws(() => know.insert(id, 'flow', { title: 'Broken', steps: [{ page: 'pag-00000000' }] }), /not found/);
});

test('the Map keeps grid places in one record, so moving pages adds no page revisions', () => {
  const { know, id } = fixture();
  const page = know.list(id, 'page')[0];
  const map = know.insert(id, 'page_map', { places: { [page.id]: { col: 2, row: 1 }, 'pag-nothere': { col: -1, row: 0 }, bogus: { col: 1, row: 1 }, [`pag-${'a'.repeat(8)}`]: { col: 1.5, row: 0 } } });
  assert.deepEqual(map.places, { [page.id]: { col: 2, row: 1 } }, 'only whole, non-negative cells for page ids');
  assert.equal(know.get(id, page.id).revision, page.revision);
});

test('a change request revises the spec with its reason and becomes Engineer › implement work', () => {
  const { know, id, db } = fixture();
  const messages = pageNamed(know, id, 'Messages');
  const list = component(know, id, 'List'), chip = component(know, id, 'Chip');
  const specced = know.update(id, messages.id, { sections: [{ name: 'Conversations', component: list.id }] }, { rationale: 'Spec' });
  const { page, work } = know.requestPageChange(id, { pageId: messages.id, expectedRevision: specced.revision, title: 'Messages: filter by tool', why: 'People lend several tools and lose track.',
    summary: ['Add section “Filter” (Chip)'], changes: { sections: [{ name: 'Filter', component: chip.id }, ...specced.sections], status: 'designed' } }, 'Ada');
  assert.equal(page.revision, specced.revision + 1);
  assert.deepEqual(page.sections.map(section => section.name), ['Filter', 'Conversations']);
  assert.notEqual(page.status, 'designed', 'only the spec fields change through a change request');
  assert.equal(work.action, 'platform.implement');
  assert.equal(work.layer, 'platform');
  assert.equal(work.type, 'implement');
  assert.equal(work.targets[0].id, messages.id);
  assert.ok(work.targets.some(target => target.kind === 'story'), 'the page’s stories go with it');
  assert.equal(work.context.change.fromRevision, specced.revision);
  assert.equal(work.context.change.toRevision, page.revision);
  const revision = db.prepare('SELECT rationale, work_item_id FROM knowledge_revisions WHERE record_id = ? AND revision = ?').get(messages.id, page.revision);
  assert.equal(revision.work_item_id, work.id, 'the revision names the work item that carries it');
  assert.match(revision.rationale, /^Messages: filter by tool: People lend several tools/);
  // Without spec changes it still becomes coding work, and the spec stays as it is.
  const plain = know.requestPageChange(id, { pageId: messages.id, title: 'Build Messages to its spec', why: 'The build is missing: Filter.' }, 'Ada');
  assert.equal(plain.page.revision, page.revision);
  assert.equal(plain.work.action, 'platform.implement');
  assert.throws(() => know.requestPageChange(id, { pageId: messages.id, title: '' }), /Title is required/);
  assert.throws(() => know.requestPageChange(id, { pageId: messages.id, expectedRevision: 1, title: 'Stale', changes: { sections: [] } }), error => error.status === 409);
});

test('reviewing a flow is Experience designer work: notes decide the verdict and finishing closes the item', () => {
  const { know, id, ada } = fixture();
  know.ensureFlows(id);
  const flow = know.list(id, 'flow').find(entry => entry.steps.length);
  const { work } = know.reviewFlow(id, { flowId: flow.id, action: 'start', assignee: { kind: 'person', id: ada.id } }, 'Ada');
  assert.equal(work.action, 'pages.review');
  assert.equal(work.layer, 'pages');
  assert.throws(() => know.reviewFlow(id, { flowId: flow.id, action: 'start' }), error => error.status === 409);
  const open = know.get(id, flow.id);
  assert.equal(open.review.state, 'progress');
  know.update(id, flow.id, { review: { ...open.review, notes: [{ step: 0, type: 'looks-right', text: 'Clear' }, { step: 0, type: 'change', text: 'Show unread first' }] } });
  assert.throws(() => know.update(id, flow.id, { review: { ...open.review, notes: [{ step: 0, type: 'rant', text: 'x' }] } }), /Unknown kind of review note/);
  const { flow: done } = know.reviewFlow(id, { flowId: flow.id, action: 'finish' }, 'Ada');
  assert.equal(done.review.state, 'done');
  assert.equal(done.review.verdict, 'Needs changes', 'a note other than “looks right” means it needs changes');
  assert.equal(know.workList(id).find(item => item.id === work.id).state, 'done');
});

test('the scaffold routes every page, renders spec sections marked for Pages, and ships the preview bridge', () => {
  const { know, flows, ada, id } = fixture();
  const detail = know.insert(id, 'page', { ...blank, label: 'Tool detail' });
  const messages = pageNamed(know, id, 'Messages');
  const button = component(know, id, 'Button');
  know.update(id, messages.id, { sections: [{ name: 'Start', component: button.id, leadsTo: detail.id, content: { title: 'Talk it over', action: 'New message' } }, { name: 'Empty', state: 'empty' }] });
  const setup = { ...flows.projectSetup(ada, id), data: { objects: [], operations: [] }, agents: { principles: [], profiles: [], roles: [], project: '' },
    designSystem: { tokens: know.list(id, 'design_tokens')[0], components: know.list(id, 'component').map(entry => ({ ...entry, status: componentStatus(entry) })), brand: know.list(id, 'brand_asset') },
    pageRecords: know.list(id, 'page') };
  const sources = { pageBlocks: '', iconFont: Buffer.from(''), iconLicense: '' };
  const { files, manifest } = skeletonFiles(setup, catalogs, gitProfile, { portal: 'http://aludel.localhost:4310', app: 'http://tool-share.localhost:4310' }, [], sources);
  const site = JSON.parse(files['src/site.ts'].match(/export const site: Site = ([\s\S]*);\n$/)[1]);
  const extra = site.pages.find(page => page.id === detail.id);
  assert.equal(extra.nav, false, 'pages outside the navigation get routes too');
  assert.equal(extra.path, '/tool-detail');
  assert.ok(site.pages.filter(page => page.nav).length >= 1);
  const generated = site.pages.find(page => page.id === messages.id);
  assert.deepEqual(generated.sections.map(section => [section.name, section.kind, section.title, section.action, section.leadsTo]), [['Start', 'button', 'Talk it over', 'New message', '/tool-detail']],
    'Ready sections only, with their component’s preview kind and the target page’s path');
  assert.equal(site.portal, 'http://aludel.localhost:4310');
  assert.match(files['src/aludel-bridge.ts'], /event\.origin !== site\.portal/, 'the bridge answers only its portal');
  assert.match(files['src/aludel-bridge.ts'], /window\.parent !== window/);
  assert.match(files['src/main.ts'], /import '\.\/aludel-bridge';/);
  assert.match(files['src/app.html'], /\[attr\.data-aludel-page\]="current\.id"/);
  assert.match(files['src/app.html'], /@for \(item of navPages; track item\.path\)/, 'navigation lists navigation pages only');
  assert.ok(manifest.some(entry => entry.symbol === 'route /tool-detail' && entry.recordIds[0] === detail.id), 'the generated route links to its page record');
  assert.deepEqual(sitePages([{ id: 'a', label: 'Home' }], [{ id: 'a', label: 'Home' }, { id: 'b', label: 'Sign in' }]).map(page => page.path), ['/', '/sign-in-page'], 'reserved paths are avoided');
});
