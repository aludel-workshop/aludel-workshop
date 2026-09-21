import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { openDatabase } from '../server/storage.mjs';
import { answerDecision, createProposal, ensureB02Fixture, getDecision, getProposal, listDownstreamRecords, reassessRecord, reviseProposal } from '../server/product-records.mjs';

test('proposal revisions are immutable and retain their source request', () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-products-'));
  const db = openDatabase(join(root, 'test.sqlite'));
  const timestamp = new Date().toISOString();
  db.prepare(`INSERT INTO owner_requests(id, project_id, body, status, created_at, updated_at)
    VALUES ('REQ-1', 'the-machine', 'Make decisions durable.', 'new', ?, ?)`).run(timestamp, timestamp);
  const created = createProposal(db, { requestId: 'REQ-1', title: 'Durable decisions', acceptance: ['Survives restart'] });
  assert.equal(created.revision, 1);
  const updated = reviseProposal(db, created.id, { expectedRevision: 1, title: 'Durable product decisions', intent: created.intent, acceptance: ['Survives restart'], assumptions: [], exclusions: [] });
  assert.equal(updated.revision, 2);
  assert.equal(getProposal(db, created.id).revisions.length, 2);
  assert.equal(db.prepare("SELECT status FROM owner_requests WHERE id = 'REQ-1'").get().status, 'proposed');
  db.close();
});

test('decision changes stale only linked records and reassessment is explicit', () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-decisions-'));
  const db = openDatabase(join(root, 'test.sqlite'));
  ensureB02Fixture(db);
  const before = listDownstreamRecords(db);
  assert.equal(before.find(record => record.id === 'PLAN-B02').currency, 'current');
  assert.equal(before.find(record => record.id === 'PLAN-B03').currency, 'current');

  const changed = answerDecision(db, 'DEC-MACHINE-DATA', { expectedRevision: 1, answer: 'Continue using hand-edited Markdown', rationale: 'Exercise revision propagation.' });
  assert.equal(changed.revision, 2);
  assert.equal(changed.affected[0].currency, 'stale');
  const after = listDownstreamRecords(db);
  assert.equal(after.find(record => record.id === 'PLAN-B02').currency, 'stale');
  assert.equal(after.find(record => record.id === 'PLAN-B03').currency, 'current');
  assert.throws(() => answerDecision(db, 'DEC-MACHINE-DATA', { expectedRevision: 1, answer: 'Portal database with repository sources' }), error => error.status === 409);
  assert.equal(getDecision(db, 'DEC-MACHINE-DATA').revision, 2);

  const reassessed = reassessRecord(db, 'PLAN-B02');
  assert.equal(reassessed.currency, 'current');
  assert.equal(reassessed.revision, 2);
  assert.equal(getDecision(db, 'DEC-MACHINE-DATA').affected[0].consumed_decision_revision, 2);
  db.close();
});
