import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compiledLocalActions, combinedLegacyInventory, lat07LegacyInventory } from '../server/lat07-actions.mjs';

const actions = new Map(compiledLocalActions.map(action => [action.id, action]));
const legacy = JSON.parse(readFileSync(new URL('../config/roles.json', import.meta.url), 'utf8'));
const layers = new Set(['design', 'data', 'platform', 'deploy']);

test('every remaining built-in legacy action has an explicit, truthful disposition', () => {
  const expected = legacy.roles.filter(role => layers.has(role.layer)).flatMap(role => role.actions.map(action => `${role.layer}.${action.key}`)).sort();
  assert.deepEqual(Object.keys(lat07LegacyInventory).sort(), expected);
  for (const id of expected) {
    const entry = combinedLegacyInventory[id];
    assert.ok(['unavailable', 'retired', 'recreated'].includes(entry.disposition));
    if (entry.disposition !== 'recreated') assert.ok(entry.reason?.length > 15, id);
    if (entry.action) assert.ok(actions.has(entry.action), id);
  }
});

test('remaining layer actions publish typed outputs and explicit effect/read boundaries without runnable adapters', () => {
  for (const layer of layers) assert.ok([...actions.values()].some(action => action.layer === layer), layer);
  for (const action of [...actions.values()].filter(action => layers.has(action.layer) && action.id !== 'platform.observe_route')) {
    assert.equal(action.agentRunnable, false, action.id);
    assert.equal(action.humanRunnable, false, action.id);
    assert.deepEqual(action.permissions.effects.length, 1);
    assert.ok(action.checks.length);
    assert.ok(action.revision > 0);
    if (action.permissions.elevated) assert.ok(Object.values(action.initialAssignee).every(value => value === 'human'));
  }
  assert.deepEqual(actions.get('platform.docs').permissions.fileWrites, ['docs/**', 'README.md']);
  assert.deepEqual(actions.get('platform.dependencies').permissions.fileWrites, ['package.json', 'package-lock.json']);
  assert.equal(actions.get('deploy.inspect').result.owner, 'work');
  for (const id of ['deploy.configure', 'deploy.promote', 'deploy.rollback']) assert.equal(actions.has(id), false, `${id} has no effect adapter`);
});
