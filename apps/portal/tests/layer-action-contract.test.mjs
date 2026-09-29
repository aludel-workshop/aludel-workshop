import test from 'node:test';
import assert from 'node:assert/strict';
import { compileLayerActions, seedActionAssignee } from '../server/layer-action-contract.mjs';

const pages = () => ({ key: 'pages', outputs: ['page', 'flow'], actions: [{
  key: 'map_flow', revision: 1, result: { kind: 'flow', operation: 'propose' }, adapter: 'pages_flow',
  permissions: { elevated: false, reads: [{ layer: 'pages', kind: 'page' }], fileReads: [], fileWrites: [], effects: ['submit-proposal'] },
  initialAssignee: { dreamer: 'agent', planner: 'human', tinkerer: 'agent' }, checks: ['Every declared activity can be reached']
}] });
const vision = () => ({ key: 'product', outputs: ['story'], actions: [] });
const pagesAdapter = { id: 'pages_flow', layer: 'pages', owner: 'pages', kind: 'flow', operation: 'propose', performers: ['human', 'agent'] };
const compile = (layers = [pages(), vision()], adapters = [pagesAdapter]) => compileLayerActions(layers, { registeredAdapters: adapters });

test('layer action IDs and first assignments are independent of a Work role', () => {
  const [action] = compile();
  assert.equal(action.id, 'pages.map_flow');
  assert.equal(action.result.owner, 'pages');
  assert.equal(action.agentRunnable, true);
  assert.deepEqual(seedActionAssignee(action, 'dreamer', { humanId: 'owner', agentId: 'agent' }), { kind: 'agent', id: 'agent' });
  assert.deepEqual(seedActionAssignee(action, 'planner', { humanId: 'owner', agentId: 'agent' }), { kind: 'person', id: 'owner' });
  assert.equal(seedActionAssignee(action, 'tinkerer', { humanId: 'owner' }), null, 'missing agent stays unassigned');
});

test('declarations reject foreign outputs, unregistered adapters and invented reads/effects', () => {
  const invalid = edit => { const layer = pages(); edit(layer.actions[0]); return [layer, vision()]; };
  assert.throws(() => compile(invalid(action => { action.result.owner = 'product'; })), /another layer/);
  assert.throws(() => compile(invalid(action => { action.permissions.reads = [{ layer: 'product', kind: 'unknown' }]; })), /undeclared/);
  assert.throws(() => compile(invalid(action => { action.permissions.effects = ['commit-candidate']; })), /outside its result/);
  assert.throws(() => compile(invalid(action => { action.permissions.fileReads = ['../secrets']; })), /unsafe/);
  assert.throws(() => compile([pages(), vision()], []), /cannot seed an agent/);
  assert.throws(() => compile([pages(), vision()], [{ ...pagesAdapter, kind: 'page' }]), /different output/);
  assert.throws(() => compile(invalid(action => { action.initialAssignee = { planner: 'human' }; })), /every work style/);
});

test('elevated actions seed a human and file writes require a candidate result', () => {
  const layer = pages(); const action = layer.actions[0]; action.permissions.elevated = true;
  assert.throws(() => compile([layer, vision()]), /elevated work to a human/);
  action.initialAssignee = { dreamer: 'human', planner: 'human', tinkerer: 'human' };
  assert.equal(compile([layer, vision()])[0].permissions.elevated, true);
  const humanOnly = compile([layer, vision()], [{ ...pagesAdapter, performers: ['human'] }])[0];
  assert.equal(seedActionAssignee(humanOnly, 'planner', { humanId: 'owner' })?.id, 'owner');
  const unavailable = compile([layer, vision()], [])[0];
  assert.equal(unavailable.humanRunnable, false);
  assert.equal(seedActionAssignee(unavailable, 'planner', { humanId: 'owner' }), null, 'missing adapter cannot acquire an assignee by default');
  action.permissions.fileWrites = ['src/**'];
  assert.throws(() => compile([layer, vision()]), /only for a candidate/);
});
