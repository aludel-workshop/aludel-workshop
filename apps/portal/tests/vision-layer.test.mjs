// T03-VISION: record authority and native view are adopted without changing stable output identity.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerContract, layerInstanceId, updateLayerInstance } from '../server/layer-contract.mjs';
import { layerPackageForProject } from '../server/layer-package.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
function fixture(run, adopt = false) {
  const dir = mkdtempSync(join(tmpdir(), 'aludel-vision-'));
  const old = { dir: process.env.MACHINE_DATA_DIR, enabled: process.env.MACHINE_LAYER_TEMPLATES_ENABLED };
  process.env.MACHINE_DATA_DIR = dir;
  if (adopt) delete process.env.MACHINE_LAYER_TEMPLATES_ENABLED; else process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const owner = createUser(db, { email: 'vision@example.com', name: 'Vision owner', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Vision trial', pitch: 'Help neighbours share tools.' });
    const { project } = flow.claimDraft(token, owner, owner);
    flow.saveFeatures(owner, project.id, { picks: ['accounts'] });
    if (adopt) {
      const before = db.prepare("SELECT id,revision FROM knowledge_records WHERE project_id=? AND kind='story' ORDER BY id").all(project.id);
      const instance = layerInstanceId(db, project.id, 'product');
      process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
      initLayerContract(db);
      assert.equal(layerInstanceId(db, project.id, 'product'), instance);
      assert.deepEqual(db.prepare("SELECT id,revision FROM knowledge_records WHERE project_id=? AND kind='story' ORDER BY id").all(project.id), before);
    }
    run({ db, know, owner, id: project.id });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    for (const [name, value] of [['MACHINE_DATA_DIR', old.dir], ['MACHINE_LAYER_TEMPLATES_ENABLED', old.enabled]])
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}

test('Vision template owns its pinned view and Knowledge; Library preserves story pins', () => fixture(({ db, know, owner, id }) => {
  const pkg = layerPackageForProject(db, id, 'product');
  assert.equal(pkg.manifest.key, 'product');
  assert.equal(pkg.manifest.ui.entry, 'ui/vision.ts');
  assert.deepEqual(pkg.manifest.tabs.map(tab => tab.key), ['brief', 'map', 'docs']);
  const story = know.list(id, 'story')[0];
  assert.ok(story);
  const pool = library({ db, know });
  const pin = pool.pin(id, story.id);
  assert.equal(pin.layerInstanceId, layerInstanceId(db, id, 'product'));
  assert.equal(pool.read(id, owner.id, story.id, story.revision).revision, story.revision);
  assert.match(pool.read(id, owner.id, 'k:product:identity').content, /# Vision/);
  for (const key of ['pages', 'data', 'design', 'platform', 'deploy']) updateLayerInstance(db, owner.id, id, key, { enabled: false });
  assert.equal(pool.read(id, owner.id, story.id).data.title, story.title, 'Vision still works without later layers');
}));

test('existing Vision instance adopts a repository without changing story identity or revision', () => fixture(({ db, id }) => {
  assert.ok(layerPackageForProject(db, id, 'product'));
}, true));

// T03-VISION, rules in the layer: Vision publishes its own API; every write, from the portal's views or an agent, runs its rules.
import { applyOperation, callOperation, layerApi } from '../server/layer-api.mjs';

test('Vision changes go through its own API rules, and the story map keeps its hierarchy through that API', () => fixture(({ db, know, owner, id }) => {
  const api = layerApi(db, id, 'product');
  assert.ok(api, 'Vision publishes an API');
  assert.equal(api.operations.get('createStory').output, 'story');
  assert.deepEqual([api.operations.get('createStory').field, api.operations.get('createStory').parentField], ['story', 'stepId'], 'the portal\'s record calls know where the parent goes');
  const instance = layerInstanceId(db, id, 'product');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind = 'story' AND layer_instance_id IS NOT ?").get(id, instance).n, 0,
    'every story belongs to the Vision instance');

  const call = (operationId, body, recordId = null) => applyOperation({ db, know, api, projectId: id, operationId, id: recordId, body, author: owner.name });
  const activity = call('createActivity', { activity: { title: 'Borrow a tool' } });
  const step = call('createStep', { step: { title: 'Find one nearby' }, activityId: activity.id });
  const story = call('createStory', { story: { title: 'Someone can see tools within a mile', phase: 'demo' }, stepId: step.id });
  assert.equal(db.prepare('SELECT parent_id FROM knowledge_records WHERE id = ?').get(step.id).parent_id, activity.id);
  assert.equal(db.prepare('SELECT parent_id FROM knowledge_records WHERE id = ?').get(story.id).parent_id, step.id);
  assert.ok(know.get(id, story.id).number > 0, 'the host still numbers stories');
  assert.throws(() => call('createStory', { story: { title: 'Wrong parent', phase: 'demo' }, stepId: activity.id }), /linked step was not found/);
  assert.throws(() => call('createStory', { story: { title: 'Someday', phase: 'never' }, stepId: step.id }), /Choose a phase/);
  const other = call('createStep', { step: { title: 'Ask to borrow' }, activityId: activity.id });
  call('updateStory', { changes: { why: 'Distance decides whether people bother.' }, stepId: other.id, expectedRevision: 1 }, story.id);
  assert.equal(db.prepare('SELECT parent_id FROM knowledge_records WHERE id = ?').get(story.id).parent_id, other.id, 'a story moves to another step');

  // The portal's own views write through the same rules: a person's generic record write is checked by Vision's handler.
  assert.throws(() => know.insert(id, 'brief_claim', { section: 'mood', text: 'x' }), /Choose a Brief section/);
  const claim = know.insert(id, 'brief_claim', { section: 'problem', text: 'Tools sit unused in sheds.' });
  assert.equal(db.prepare('SELECT layer_instance_id FROM knowledge_records WHERE id = ?').get(claim.id).layer_instance_id, instance);

  // An agent's staged story keeps its parent through review and acceptance.
  const staged = callOperation({ db, catalogs: know.catalogs, api, projectId: id, operationId: 'createStory', body: { story: { title: 'Staged story', phase: 'mvp' }, stepId: step.id } });
  assert.equal(staged.writes[0].parentId, step.id);
}));

test('an existing project\'s Vision records join its instance when Vision starts publishing its API', () => fixture(({ db, id }) => {
  const instance = layerInstanceId(db, id, 'product');
  for (const kind of ['story', 'step', 'activity', 'phase', 'brief_claim'])
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id IS NOT ?').get(id, kind, instance).n, 0, `${kind} is tagged`);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM knowledge_revisions v JOIN knowledge_records r ON r.id = v.record_id WHERE r.project_id = ? AND r.kind = 'story' AND v.layer_instance_id IS NULL").get(id).n, 0,
    'revisions follow their records');
}, true));
