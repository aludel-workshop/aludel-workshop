import assert from 'node:assert/strict';
import test from 'node:test';
import { symphonyIssue } from '../server/symphony-readiness.mjs';

const base = 'a'.repeat(40);
const project = { id: 'p-one', slug: 'buddy-box' };
const item = { id: 'work-1', ref: 'W-7', title: 'Build posts', action: 'platform.implement', state: 'claimed',
  priority: 'high', assignee: { kind: 'agent', id: 'profile-1' }, context: { batch: 'bat-1' }, blockedBy: [], createdAt: '2026-09-25T00:00:00Z' };
const batch = { id: 'bat-1', ref: 'B-1', state: 'running', profileId: 'profile-1', snapshot: ['work-1'], startedAt: '2026-09-25T01:00:00Z' };
const action = { id: 'platform.implement', revision: 2, tools: ['read', 'code', 'test'], changes: ['Code › code'], elevated: false };
const bundle = { digest: 'digest-1', project: { id: 'p-one' }, work: { id: 'work-1' }, repository: { commit: base }, guidance: { action: { id: action.id, revision: 2 } } };
const issue = (changes = {}) => symphonyIssue({ project, item, batch, action, bundle, repositoryCommit: base, ...changes });

test('only a Go-snapshotted, pinned coding item projects as Symphony work', () => {
  const ready = issue();
  assert.equal(ready.identifier, 'BUDDY-BOX-W-7');
  assert.equal(ready.id, 'p-one:work-1');
  assert.deepEqual(ready.labels, ['aludel-ready', 'profile-profile-1']);
  assert.equal(ready.native_ref.bundle_digest, bundle.digest);
  assert.equal(ready.native_ref.repository_commit, base);
  assert.equal(ready.priority, 2);
  assert.equal(issue({ batch: { ...batch, state: 'draft' } }), null);
  assert.equal(issue({ batch: { ...batch, snapshot: [] } }), null, 'joining a running batch does not inherit Go authorization');
  assert.equal(issue({ item: { ...item, context: { ...item.context, skip: true } } }), null);
  assert.equal(issue({ batch: { ...batch, state: 'stopping' } }), null);
  assert.equal(issue({ item: { ...item, blockedBy: ['work-0'] } }), null);
  assert.equal(issue({ item: { ...item, assignee: { kind: 'agent', id: 'profile-2' } } }), null);
  assert.equal(issue({ action: { ...action, changes: [] } }), null);
  assert.equal(issue({ bundle: { ...bundle, repository: { commit: 'b'.repeat(40) } } }), null);
  assert.equal(issue({ bundle: { ...bundle, guidance: { action: { id: action.id } } } }), null);
});
