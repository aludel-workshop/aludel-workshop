// LAYER-KNOWLEDGE-01 S2: a layer's docs and spec live in its repository. Save takes at once as a commit on `main` that
// becomes the pin; earlier versions stay readable; views aren't rebuilt for a docs-only commit; a refacet proposed before
// a docs save is still accepted.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { bindingRecords, initBindings } from '../server/binding-records.mjs';
import { bindingRoutines } from '../server/binding-routines.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerApi } from '../server/layer-api.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerDocs } from '../server/layer-docs.mjs';
import { layerPackageForProject } from '../server/layer-package.mjs';
import { createMarkdownDefinition, projectLayerDefinition, saveLayerCharter } from '../server/layer-registry.mjs';
import { initLayerSource, layerBinding } from '../server/layer-source.mjs';
import { layerUi } from '../server/layer-ui.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { refacets } from '../server/refacets.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const skip = process.env.MACHINE_LAYER_TEMPLATES_ENABLED !== '1' && 'needs the pinned templates';

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'aludel-docs-'));
  const old = process.env.MACHINE_DATA_DIR;
  process.env.MACHINE_DATA_DIR = dir;
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db); initLayerSource(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'docs@example.com', name: 'Docs owner', password: 'correct-horse-battery' });
    const helper = createUser(db, { email: 'helper@example.com', name: 'Helper', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools. Borrow a drill in minutes.' });
    const { project } = flow.claimDraft(token, owner, owner);
    db.prepare("INSERT INTO project_members(project_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)").run(project.id, helper.id, new Date().toISOString());
    initLayerContract(db); initBindings(db);
    const pool = library({ db, know }), store = bindingRecords({ db }), routines = bindingRoutines({ db, know, pool, store });
    const changed = [];
    run({ db, dir, owner, helper, id: project.id, docs: layerDocs({ db, onSpecChange: (projectId, key) => changed.push(key) }), changed, work: refacets({ db, know, pool, store, routines }) });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (old === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = old;
  }
}
const pin = (db, id, key) => layerBinding(db, id, key).commit;

test('docs are listed where Knowledge shows them, and Save takes at once as a new pin with every version kept', { skip }, () => fixture(({ db, owner, helper, id, docs }) => {
  const listed = docs.list(id, helper.id, 'pages');
  assert.deepEqual(listed.docs.map(doc => [doc.group, doc.title]).slice(0, 3), [[null, 'Charter'], ['Methods', 'Page design method'], ['Methods', 'Flow method']]);
  assert.ok(!listed.docs.some(doc => doc.path === 'knowledge/page-output.md'), 'a part\'s doc sits with its part, not in the docs list');
  assert.deepEqual(listed.docs.filter(doc => doc.group === 'Editor tabs').map(doc => [doc.tab, doc.edits.join(','), doc.exists]), [['map', 'map', false], ['page', 'pages', false], ['flows', 'flows', false], ['kit', 'kit,kit-tokens,kit-components,kit-brand', true]]);

  const before = pin(db, id, 'pages');
  const charter = docs.read(id, helper.id, 'pages', 'knowledge/charter.md');
  assert.match(charter.content, /^# Pages charter/);
  assert.throws(() => docs.save(id, helper.id, 'pages', { path: 'knowledge/charter.md', content: 'x', base: before }), /Only the project owner/);
  const saved = docs.save(id, owner.id, 'pages', { path: 'knowledge/charter.md', content: `${charter.content}\n## Notes\n\nTool Share starts with lending.`, base: before });
  assert.ok(saved.changed && saved.commit !== before);
  assert.equal(pin(db, id, 'pages'), saved.commit, 'the save is the new pin');
  assert.equal(execFileSync('git', ['-C', layerBinding(db, id, 'pages').repo, 'rev-parse', 'main'], { encoding: 'utf8' }).trim(), saved.commit, 'and main');
  assert.match(docs.read(id, helper.id, 'pages', 'knowledge/charter.md').content, /starts with lending/);
  const versions = docs.history(id, helper.id, 'pages', 'knowledge/charter.md').versions;
  assert.equal(versions[0].commit, saved.commit); assert.equal(versions[0].by, 'Docs owner'); assert.equal(versions[0].saved, true);
  assert.ok(versions.length >= 2 && versions.slice(1).every(version => !version.saved), 'earlier versions came with the template');
  assert.equal(docs.read(id, helper.id, 'pages', 'knowledge/charter.md', versions[1].commit).content, charter.content, 'an earlier version reads back exactly');
  assert.equal(docs.save(id, owner.id, 'pages', { path: 'knowledge/charter.md', content: docs.read(id, owner.id, 'pages', 'knowledge/charter.md').content, base: saved.commit }).changed, false);

  // A tab's doc can be written for the first time.
  docs.save(id, owner.id, 'pages', { path: 'knowledge/tab-flows.md', content: '# Flows\n\nWalk a journey step by step.', base: pin(db, id, 'pages') });
  assert.equal(docs.list(id, owner.id, 'pages').docs.find(doc => doc.tab === 'flows').exists, true);

  // Someone else's save to the same doc wins; a save to another doc still takes on top of it.
  assert.throws(() => docs.save(id, owner.id, 'pages', { path: 'knowledge/charter.md', content: 'Stale edit', base: before }), /changed this document since you opened it/);
  const other = docs.save(id, owner.id, 'pages', { path: 'knowledge/flow-method.md', content: '# Flow method\n\nRevised.', base: before });
  assert.ok(other.changed);
  assert.match(docs.read(id, owner.id, 'pages', 'knowledge/charter.md').content, /starts with lending/, 'the newer charter is kept');

  assert.throws(() => docs.save(id, owner.id, 'pages', { path: 'server/pages-api.mjs', content: 'x', base: other.commit }), /knowledge\/\*\.md/);
  assert.throws(() => docs.save(id, owner.id, 'pages', { path: 'knowledge/x.md', content: '  ', base: other.commit }), /needs content/);
  assert.throws(() => docs.read(id, owner.id, 'pages', 'knowledge/charter.md', '0'.repeat(40)), /not in this layer's history/);
  assert.throws(() => docs.list(id, 'nobody', 'pages'), /Project not found/);
  // A save is checked as a package like any commit: the charter has a size limit.
  assert.throws(() => docs.save(id, owner.id, 'pages', { path: 'knowledge/charter.md', content: `# Pages charter\n\n${'x'.repeat(25000)}`, base: pin(db, id, 'pages') }), /would make the layer invalid: Layer charter is too large/);
  // A repository whose main moved past the pin outside Aludel is reconciled first, never written over.
  const { repo } = layerBinding(db, id, 'pages'), env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' };
  const at = pin(db, id, 'pages');
  execFileSync('git', ['-C', repo, 'update-ref', 'refs/heads/main', execFileSync('git', ['-C', repo, 'commit-tree', `${at}^{tree}`, '-p', at, '-m', 'outside'], { encoding: 'utf8', env }).trim()]);
  assert.throws(() => docs.save(id, owner.id, 'pages', { path: 'knowledge/flow-method.md', content: '# Flow method\n\nAgain.', base: at }), /reconcile it first/);
  assert.equal(pin(db, id, 'pages'), at);
}));

test('the spec is saved whole, checked first, and a change raises Compare specs', { skip }, () => fixture(({ db, owner, id, docs, changed }) => {
  const base = pin(db, id, 'pages');
  const information = layerPackageForProject(db, id, 'pages').manifest.information;
  const withKit = (fields) => information.map(node => node.key === 'kit' ? { ...node, ...fields } : node);
  assert.throws(() => docs.saveInformation(id, owner.id, 'pages', { information: withKit({ tab: 'nowhere' }), base }), /editor tab/);
  assert.equal(pin(db, id, 'pages'), base, 'a refused spec leaves the layer as it was');
  const next = withKit({ intent: 'Everything Pages draws its pages with.' });
  const saved = docs.saveInformation(id, owner.id, 'pages', { information: next, base });
  assert.ok(saved.changed);
  assert.equal(layerPackageForProject(db, id, 'pages').manifest.information.find(node => node.key === 'kit').intent, 'Everything Pages draws its pages with.');
  assert.deepEqual(changed, ['pages']);
  assert.equal(docs.saveInformation(id, owner.id, 'pages', { information: next, base: saved.commit }).changed, false);
  assert.deepEqual(changed, ['pages'], 'an unchanged spec raises nothing');
  assert.throws(() => docs.saveInformation(id, owner.id, 'pages', { information, base }), /spec changed since you opened it/);
}));

test('a docs-only commit reuses the views\' build; a change to a view does not', { skip }, () => fixture(({ db, dir, owner, id, docs }) => {
  const ui = layerUi({ dataDirectory: dir, layerOrigin: () => 'http://x', portalOrigin: 'http://y' });
  const before = layerPackageForProject(db, id, 'pages');
  docs.save(id, owner.id, 'pages', { path: 'knowledge/page-method.md', content: '# Page method\n\nShorter.', base: before.commit });
  const after = layerPackageForProject(db, id, 'pages');
  assert.notEqual(after.commit, before.commit);
  assert.equal(ui.buildKey(after, 'pages'), ui.buildKey(before, 'pages'));
  const repo = after.repo, file = after.manifest.ui.files.find(path => path.endsWith('.scss'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' };
  execFileSync('git', ['-C', repo, 'checkout', '-q', '-b', 'scratch', after.commit]);
  execFileSync('git', ['-C', repo, 'commit', '-q', '--allow-empty', '-m', 'empty'], { env });
  const same = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('sh', ['-c', `printf '\\n/* changed */\\n' >> ${join(repo, file)} && git -C ${repo} commit -q -am view`], { env });
  const changedView = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(ui.buildKey({ ...after, commit: same }, 'pages'), ui.buildKey(after, 'pages'));
  assert.notEqual(ui.buildKey({ ...after, commit: changedView }, 'pages'), ui.buildKey(after, 'pages'));
}));

test('a custom layer\'s charter is its identity: read from it, and saved to both', { skip }, () => fixture(({ db, owner, id, docs }) => {
  createMarkdownDefinition(db, owner.id, id, { name: 'Personas', key: 'personas', template: 'markdown' });
  const identity = projectLayerDefinition(db, id, 'personas');
  assert.equal(identity.identity, null, 'a new custom layer has no identity until its charter is written');
  assert.match(docs.read(id, owner.id, 'personas', 'knowledge/charter.md').content, /charter/i, 'so the template\'s charter shows');
  saveLayerCharter(db, owner.id, id, 'personas', { content: '# Personas charter\n\n## Purpose\n\nPeople.', expectedRevision: identity.identityRevision });
  assert.match(docs.read(id, owner.id, 'personas', 'knowledge/charter.md').content, /People\./, 'an identity written elsewhere shows until the first save here');
  const written = projectLayerDefinition(db, id, 'personas');
  docs.save(id, owner.id, 'personas', { path: 'knowledge/charter.md', content: '# Personas charter\n\n## Purpose\n\nThe people we design for, in depth.', base: pin(db, id, 'personas') });
  const after = projectLayerDefinition(db, id, 'personas');
  assert.equal(after.identityRevision, written.identityRevision + 1);
  assert.match(after.identity.markdown, /in depth/);
  assert.match(docs.read(id, owner.id, 'personas', 'knowledge/charter.md').content, /in depth/);
}));

test('a refacet proposed before a docs save is still accepted; one whose facets changed meanwhile is not', { skip }, () => fixture(({ db, owner, id, docs, work }) => {
  const split = { change: { op: 'split', facet: 'intent', into: { key: 'personas', title: 'Personas', take: [{ kind: 'persona' }] } } };
  const proposed = work.propose(id, owner.id, 'product', split);
  docs.save(id, owner.id, 'product', { path: 'knowledge/charter.md', content: '# Vision charter\n\nRevised.', base: pin(db, id, 'product') });
  const accepted = work.decide(id, owner.id, proposed.item.id, 'accept');
  assert.equal(pin(db, id, 'product'), accepted.merged);
  const manifest = layerPackageForProject(db, id, 'product').manifest;
  assert.deepEqual(manifest.facets.map(facet => facet.key), ['intent', 'personas', 'story-map']);
  assert.match(docs.read(id, owner.id, 'product', 'knowledge/charter.md').content, /Revised/, 'the docs save is kept');
  const stale = work.propose(id, owner.id, 'product', { change: { op: 'rename', facet: 'personas', title: 'People' } });
  work.decide(id, owner.id, work.propose(id, owner.id, 'product', { change: { op: 'merge', facet: 'intent', from: 'personas' } }).item.id, 'accept');
  assert.throws(() => work.decide(id, owner.id, stale.item.id, 'accept'), /changed since this refacet was proposed/);
}));
