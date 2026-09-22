import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../server/storage.mjs';
import { ensureProductWorkspace, getProductWorkspace, saveProductRecord } from '../server/product-workspace.mjs';
import { initWorkflow } from '../server/workflow.mjs';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'aludel-product-'));
  const db = openDatabase(join(directory, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db);
  return db;
}

test('reconciles a useful product workspace without inventing calendar commitments', () => {
  const db = fixture();
  const product = getProductWorkspace(db);
  assert.equal(product.direction.revision, 1);
  assert.deepEqual(new Set(product.outcomes.map(item => item.horizon)), new Set(['now', 'next', 'later']));
  assert.ok(product.features.every(item => item.source_path === 'docs/product.md'));
  assert.ok(product.outcomes.every(item => !('start_date' in item) && !('progress' in item)));
  db.close();
});

test('no-op direction save does not create a revision', () => {
  const db = fixture();
  const direction = getProductWorkspace(db).direction;
  const saved = saveProductRecord(db, 'the-machine', 'direction', direction.id, { expectedRevision: direction.revision, ...direction });
  assert.equal(saved.unchanged, true);
  assert.equal(getProductWorkspace(db).direction.revision, 1);
  db.close();
});

test('stale expected revision is rejected and current record is preserved', () => {
  const db = fixture();
  const outcome = getProductWorkspace(db).outcomes[0];
  saveProductRecord(db, 'the-machine', 'outcome', outcome.id, { ...outcome, expectedRevision: 1, summary: `${outcome.summary} Updated.` });
  assert.throws(() => saveProductRecord(db, 'the-machine', 'outcome', outcome.id, { ...outcome, expectedRevision: 1, title: 'Stale edit' }), error => error.status === 409);
  assert.notEqual(getProductWorkspace(db).outcomes.find(item => item.id === outcome.id).title, 'Stale edit');
  db.close();
});

test('only linked dependents become stale and roadmap edits do not authorize work', () => {
  const db = fixture();
  const outcome = getProductWorkspace(db).outcomes[0];
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO downstream_records(id, project_id, kind, title, revision, status, currency, created_at, updated_at)
    VALUES ('PLAN-PRODUCT', 'the-machine', 'plan', 'Product-dependent plan', 1, 'draft', 'current', ?, ?),
           ('PLAN-OTHER', 'the-machine', 'plan', 'Unrelated plan', 1, 'draft', 'current', ?, ?)`).run(now, now, now, now);
  db.prepare(`INSERT INTO product_dependencies(product_record_id, downstream_record_id, consumed_revision, created_at)
    VALUES (?, 'PLAN-PRODUCT', 1, ?)`).run(outcome.id, now);
  const workBefore = db.prepare('SELECT id, state, version FROM work_items ORDER BY id').all();
  saveProductRecord(db, 'the-machine', 'outcome', outcome.id, { ...outcome, expectedRevision: 1, priority: 9 });
  assert.equal(db.prepare("SELECT currency FROM downstream_records WHERE id = 'PLAN-PRODUCT'").get().currency, 'stale');
  assert.equal(db.prepare("SELECT currency FROM downstream_records WHERE id = 'PLAN-OTHER'").get().currency, 'current');
  assert.deepEqual(db.prepare('SELECT id, state, version FROM work_items ORDER BY id').all(), workBefore);
  db.close();
});
