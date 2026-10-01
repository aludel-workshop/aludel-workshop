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
