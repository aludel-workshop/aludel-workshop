import assert from 'node:assert/strict';
import test from 'node:test';
import { compileTaskManifest } from '../server/task-manifest.mjs';

const base = {
  project: { id: 'project-1' }, batch: { id: 'batch-1' }, repository: { commit: 'a'.repeat(40) },
  work: { id: 'work-1', ref: 'W-1', title: 'Audit', targets: [{ id: 'record-1', kind: 'doc' }], checks: [{ text: 'Show evidence' }] },
  sources: [{ id: 'record-1', kind: 'doc', revision: 2, title: 'Policy' }],
  guidance: { project: '', role: { id: 'platform', revision: 1, name: 'Engineer', instructions: '' },
    action: { id: 'platform.security', revision: 1, name: 'Security audit', instructions: '', tools: ['read'], changes: [] },
    profile: { id: 'agent-1', revision: 1, name: 'Careful', instructions: '' } }, instructionPins: {}
};

test('task compiler binds an explicit output adapter to exact inputs', () => {
  const card = compileTaskManifest(base);
  assert.equal(card.requiredInputs[0].revision, 2);
  assert.equal(card.outputs[0].kind, 'security_finding_report');
  assert.equal(card.capabilities.repository, 'read-only pinned commit');
  assert.throws(() => compileTaskManifest({ ...base, sources: [] }), /pinned project revision/);
  // W-8 F10: the error names what's missing.
  assert.throws(() => compileTaskManifest({ ...base, repository: {}, guidance: { ...base.guidance, profile: null } }), /missing pinned inputs: agent profile revision, repository commit\./);
  assert.throws(() => compileTaskManifest({ ...base, guidance: { ...base.guidance, action: { ...base.guidance.action, id: 'platform.deploy', tools: ['read', 'code'] } } }), /no task output adapter/);
  assert.throws(() => compileTaskManifest({ ...base, guidance: { ...base.guidance, action: { ...base.guidance.action, changes: ['Code › all'] } } }), /no task output adapter/);
});
