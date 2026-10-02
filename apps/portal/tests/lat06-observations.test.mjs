import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { codeRouteObservations, initPagesCodeObservations, pagesObservationRelations, proposePagesObservationRelation,
  recordCodeRouteObservation, reviewPagesObservationRelation } from '../server/pages-code-observations.mjs';

const candidateRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('a real pinned portal route supports useful and wrong Pages relations without rewriting Code evidence', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
      CREATE TABLE project_members(project_id TEXT, user_id TEXT, role TEXT);
      CREATE TABLE layer_instances(project_id TEXT, layer_key TEXT, enabled INTEGER);
      INSERT INTO projects VALUES ('candidate');
      INSERT INTO project_members VALUES ('candidate','owner','owner'),('candidate','member','member');
      INSERT INTO layer_instances VALUES ('candidate','platform',1),('candidate','pages',1);`);
    initPagesCodeObservations(db);
    assert.throws(() => recordCodeRouteObservation(db, 'member', 'candidate', candidateRoot,
      { path: 'apps/portal/src/layers/shell.ts', marker: 'PagesLayerComponent', route: 'Portal › Pages route' }), { status: 403 });
    const observation = recordCodeRouteObservation(db, 'owner', 'candidate', candidateRoot,
      { path: 'apps/portal/src/layers/shell.ts', marker: 'PagesLayerComponent', route: 'Portal › Pages route' });
    assert.match(observation.commit, /^[a-f0-9]{40}$/);
    assert.match(observation.blob, /^[a-f0-9]{40}$/);
    assert.throws(() => recordCodeRouteObservation(db, 'owner', 'candidate', candidateRoot,
      { path: '../.env', marker: 'SECRET', route: 'Invalid' }), /unavailable|bounded tracked/);
    const useful = proposePagesObservationRelation(db, 'owner', 'candidate', observation.id,
      'The portal route exposes the Pages app; the intended journey still needs separate review.');
    const wrong = proposePagesObservationRelation(db, 'owner', 'candidate', observation.id,
      'The route proves every visitor activity is complete.');
    assert.throws(() => reviewPagesObservationRelation(db, 'member', 'candidate', wrong.id,
      { expectedRevision: 1, verdict: 'wrong', reason: 'Not shown' }), { status: 403 });
    const reviewedUseful = reviewPagesObservationRelation(db, 'owner', 'candidate', useful.id,
      { expectedRevision: 1, verdict: 'useful', reason: 'The route is observed; intended journey still needs review.' });
    const reviewedWrong = reviewPagesObservationRelation(db, 'owner', 'candidate', wrong.id,
      { expectedRevision: 1, verdict: 'wrong', reason: 'A route cannot establish that all visitor activities are covered.' });
    assert.equal(reviewedUseful.observation_id, reviewedWrong.observation_id);
    assert.equal(codeRouteObservations(db, 'member', 'candidate').length, 1);
    assert.deepEqual(pagesObservationRelations(db, 'member', 'candidate').map(row => row.status).sort(), ['useful', 'wrong']);
    assert.throws(() => reviewPagesObservationRelation(db, 'owner', 'candidate', useful.id,
      { expectedRevision: 1, verdict: 'wrong', reason: 'Stale review' }), { status: 409 });
    db.prepare("UPDATE layer_instances SET enabled = 0 WHERE project_id = 'candidate' AND layer_key = 'platform'").run();
    assert.throws(() => proposePagesObservationRelation(db, 'owner', 'candidate', observation.id, 'New relation'), { status: 409 });
    assert.equal(pagesObservationRelations(db, 'member', 'candidate').length, 2, 'removing Code retains reviewed history');
  } finally { db.close(); }
});
