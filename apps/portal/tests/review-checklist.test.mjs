// W-27 #3: the checklist an agent hands over with its preview, and its person's walk of it. Approve waits until every step
// is walked, checked by hand or skipped with a reason (P3); a flag sends the walk so far to the agent; a new preview starts
// a new walk (round 2). With no checklist, approving never depends on the preview.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentWork, initAgentWork } from '../server/agent-work.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerApi } from '../server/layer-api.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const status = (code, pattern) => error => error.status === code && (!pattern || pattern.test(error.message));

test('W-27 #3: a checklist comes with the preview; Approve waits for its walk; a flag carries it; a new preview walks afresh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aludel-review-checklist-'));
  const old = process.env.MACHINE_DATA_DIR; process.env.MACHINE_DATA_DIR = dir;
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db); initAgentWork(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const ben = createUser(db, { email: 'ben@example.com', name: 'Ben', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools.' });
    const id = flow.claimDraft(token, ada, ada).project.id;
    const work = agentWork({ db, know });
    const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
    const workId = work.createGoal(ada, id, { title: 'Show the map', brief: 'A map.' }).item.id;
    work.define(agent, id, workId, { brief: 'A map.', actions: [{ layer: 'platform', goal: 'Show the map' }, { layer: 'platform', goal: 'Tidy the styles' }] });
    work.claim(ada, id, workId); work.move(ada, id, workId, 'progress');
    for (const number of [1, 2]) work.updateAction(agent, id, workId, number, { state: 'working' });

    // The checklist is checked as it's handed over.
    const handOver = steps => work.updateAction(agent, id, workId, 1, { state: 'review', summary: 'The map.', preview: { url: 'http://review-0123456789ab.localhost:4310/map', try: 'Find a drill.', steps } });
    assert.throws(() => handOver([{ when: 'Open the map' }]), /Expect/);
    assert.throws(() => handOver([{ when: 'a', expect: 'b', path: 'map' }]), /starting with \//);
    assert.throws(() => handOver([{ when: 'a', expect: 'b', method: 'POST' }]), /method needs a path/);
    assert.throws(() => handOver(Array.from({ length: 21 }, () => ({ when: 'a', expect: 'b' }))), /20 steps/);
    const steps = [
      { as: 'neighbour', when: 'Open the map', expect: 'Pins for every tool nearby', path: '/map' },
      { when: 'Press Borrow on a drill', expect: 'The drill is yours until Friday', path: '/api/borrow', method: 'post' },
      { when: 'Turn location off', expect: 'The list asks where you are' }];
    const preview = handOver(steps).actions[0].preview;
    assert.deepEqual(preview.steps, [
      { id: 's1', as: 'neighbour', when: 'Open the map', expect: 'Pins for every tool nearby', path: '/map', method: null },
      { id: 's2', as: null, when: 'Press Borrow on a drill', expect: 'The drill is yours until Friday', path: '/api/borrow', method: 'POST' },
      { id: 's3', as: null, when: 'Turn location off', expect: 'The list asks where you are', path: null, method: null }]);
    assert.equal(preview.walk, undefined, 'nothing walked yet');

    // P3: Approve waits for every step.
    assert.throws(() => work.review(ada, id, workId, 1, { verdict: 'approve' }), status(409, /Walk #1's checklist first: step 1, 2 and 3 left/));
    assert.throws(() => work.walk(ben, id, workId, 1, { step: 's1', how: 'walked' }), status(404), 'members only');
    assert.throws(() => work.walk(ada, id, workId, 1, { step: 's9', how: 'walked' }), status(404));
    assert.throws(() => work.walk(ada, id, workId, 1, { step: 's1', how: 'skipped' }), /walked, checked, or skipped with a reason/);
    assert.throws(() => work.walk(ada, id, workId, 1, { step: 's3', how: 'reason' }), /Why it can't be walked/);
    let walked = work.walk(ada, id, workId, 1, { step: 's1', how: 'walked' }).actions[0].preview.walk;
    assert.deepEqual(Object.keys(walked), ['s1']); assert.equal(walked.s1.how, 'walked'); assert.equal(walked.s1.by.name, 'Ada');
    work.walk(ada, id, workId, 1, { step: 's2', how: 'checked' });
    assert.throws(() => work.review(ada, id, workId, 1, { verdict: 'approve' }), status(409, /step 3 left/));
    // A flag sends the walk so far to the agent, and the action goes back to work with it.
    work.review(ada, id, workId, 1, { verdict: 'flag', note: 'Borrow should say until when' });
    const told = work.view(id, workId).events.filter(event => event.action === 1).at(-1);
    assert.equal(told.text, 'Walk so far on #1: 2 of 3 steps walked; not walked: step 3');

    // Round 2: the new preview's checklist starts a new walk; a reason stands in for a step that can't be walked.
    handOver(steps);
    assert.equal(work.view(id, workId).actions[0].preview.walk, undefined, 'a new handover walks afresh');
    work.walk(ada, id, workId, 1, { step: 's1', how: 'walked' }); work.walk(ada, id, workId, 1, { step: 's2', how: 'walked' });
    walked = work.walk(ada, id, workId, 1, { step: 's3', how: 'reason', reason: 'The preview has no location to turn off' }).actions[0].preview.walk;
    assert.equal(walked.s3.reason, 'The preview has no location to turn off');
    // A step can be cleared again.
    work.walk(ada, id, workId, 1, { step: 's2', how: null });
    assert.throws(() => work.review(ada, id, workId, 1, { verdict: 'approve' }), status(409, /step 2 left/));
    work.walk(ada, id, workId, 1, { step: 's2', how: 'walked' });
    assert.equal(work.review(ada, id, workId, 1, { verdict: 'approve' }).actions[0].state, 'done');
    assert.throws(() => work.walk(ada, id, workId, 1, { step: 's1', how: null }), status(409), 'a done action\'s walk stays as reviewed');

    // No checklist: Approve doesn't depend on the preview at all.
    work.updateAction(agent, id, workId, 2, { state: 'review', summary: 'Tidied.', preview: { url: 'http://localhost:4390/', try: 'Look around.' } });
    assert.deepEqual(work.view(id, workId).actions[1].preview.steps, []);
    assert.equal(work.review(ada, id, workId, 2, { verdict: 'approve' }).actions[1].state, 'done');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (old === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = old;
  }
});
