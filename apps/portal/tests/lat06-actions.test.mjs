import test from 'node:test';
import assert from 'node:assert/strict';
import { compiledLat06Actions, lat06LayerActions, lat06Adapters, lat06LegacyInventory, seedActionAssignee } from '../server/lat06-actions.mjs';
import { compileLayerActions } from '../server/layer-action-contract.mjs';

const byId = Object.fromEntries(compiledLat06Actions.map(action => [action.id, action]));

test('Vision, Pages and Code observation have layer-owned typed action declarations', () => {
  assert.deepEqual(Object.keys(byId).sort(), ['pages.a11y', 'pages.design', 'pages.flows', 'platform.observe_route',
    'product.brief', 'product.clarify', 'product.define']);
  assert.equal(Object.keys(lat06LegacyInventory).length, 13);
  assert.equal(lat06LegacyInventory['product.research'].disposition, 'unavailable');
  assert.equal(lat06LegacyInventory['pages.review'].disposition, 'retired');
  assert.equal(byId['pages.flows'].result.kind, 'flow');
  assert.equal(byId['pages.flows'].permissions.fileWrites.length, 0);
  assert.ok(byId['pages.flows'].permissions.reads.some(read => read.layer === 'platform' && read.kind === 'code_unit'));
  assert.equal(byId['platform.observe_route'].result.owner, 'platform');
  assert.equal(byId['platform.observe_route'].result.operation, 'observe');
  assert.equal(byId['platform.observe_route'].humanRunnable, true);
  assert.equal(byId['platform.observe_route'].agentRunnable, false, 'there is no Code observation agent adapter');
  assert.deepEqual(seedActionAssignee(byId['platform.observe_route'], 'planner', { humanId: 'owner' }), { kind: 'person', id: 'owner' });
  assert.equal(byId['product.brief'].permissions.elevated, true);
  for (const style of ['dreamer', 'planner', 'tinkerer']) assert.equal(byId['product.brief'].initialAssignee[style], 'human');
});

test('a declaration cannot turn Code observation into a Pages write or widen file access', () => {
  const layers = structuredClone(lat06LayerActions);
  const observation = layers.find(layer => layer.key === 'platform').actions[0];
  observation.result = { owner: 'pages', kind: 'flow', operation: 'propose' };
  assert.throws(() => compileLayerActions(layers, { registeredAdapters: lat06Adapters }), /another layer/);
  observation.result = { owner: 'platform', kind: 'code_route_observation', operation: 'observe' };
  observation.permissions.fileWrites = ['src/**'];
  assert.throws(() => compileLayerActions(layers, { registeredAdapters: lat06Adapters }), /only for a candidate/);
});
