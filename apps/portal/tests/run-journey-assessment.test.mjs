import test from 'node:test';
import assert from 'node:assert/strict';
import { augmentJourneyClaims } from '../server/run-journey-assessment.mjs';
test('assessment augments owner coverage across sender and recipient without replacing owner claims', () => {
  const held = [{ id: 'note-1', kind: 'note', text: 'Errors explain how to retry' }, { id: 'owner', kind: 'journey', journey: 'sender', revision: 2, steps: ['open'] }];
  const before = structuredClone(held);
  const journeys = [{ id: 'sender', revision: 2, steps: [{ id: 'open' }, { id: 'send' }] }, { id: 'recipient', revision: 1, steps: [{ id: 'accept' }] }];
  const refs = [{ journey: 'sender', revision: 2, steps: ['open', 'send', 'send'], why: 'Invitation delivery changes' }, { journey: 'recipient', revision: 1, steps: ['accept'], why: 'Recipient uses the same invite' }];
  const result = augmentJourneyClaims(held, { reason: 'Check both sides of invitations', journeys: refs }, journeys);
  assert.deepEqual(held, before); assert.deepEqual(result.claims.map(c => [c.journey, c.steps]), [['sender', ['send']], ['recipient', ['accept']]]);
  assert.deepEqual(augmentJourneyClaims(held, { reason: 'Documentation only; review changed text and links', journeys: [] }, journeys).claims, []);
  for (const ref of [{ ...refs[0], revision: 1 }, { ...refs[0], steps: ['missing'] }, { ...refs[0], why: '' }, { ...refs[0], journey: 'unknown' }]) assert.throws(() => augmentJourneyClaims(held, { reason: 'Affected', journeys: [ref] }, journeys), /current revision/);
});
