// LAYER-BINDINGS-01 step 1: the binding contract's pure core, run against every walkthrough in the proposal.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { authorityFor, decide, evaluate, join, settle, transfer, transition, validateBinding, validateFacets, wiring } from '../server/bindings.mjs';

const { scenarios } = JSON.parse(readFileSync(new URL('./fixtures/binding-walkthroughs.json', import.meta.url), 'utf8'));
const show = action => action.kind === 'adapter' ? `adapter ${action.entries.join(',')} @${action.target}`
  : `${action.kind} ${action.entry} @${action.target}${['adopt', 'assess', 'combine', 'conflict'].includes(action.kind) ? ` <${action.from.join(',')}` : ''}`;
const showWiring = binding => wiring(binding).map(row => `${row.participant} ${row.area} ${row.hub} ${row.adapter}`);

// Plays a scenario as the binding's routines and the people doing its Work would: automatic actions are applied and
// settled, Work is resolved as each step says. `reverse` feeds every list in reverse order to show the outcome is stable.
function play(scenario, { reverse = false } = {}) {
  let binding = structuredClone(scenario.binding);
  const snapshots = structuredClone(scenario.snapshots);
  if (reverse) {
    binding.participants.reverse(); binding.correspondence?.reverse(); binding.adapters?.reverse();
    for (const id of Object.keys(snapshots)) snapshots[id].reverse();
  }
  const trace = [];
  let last = null;
  const entry = (id, key) => {
    const ref = binding.correspondence.find(item => item.key === key)?.refs[id];
    return ref ? (snapshots[id] || []).find(item => item.ref === ref) || null : null;
  };
  const hubEntry = key => entry(authorityFor(binding, binding.correspondence.find(item => item.key === key).area ?? null), key);
  // A participant's layer writes the entry for `key` as `source` has it, or removes it.
  const write = (id, key, source) => {
    snapshots[id] ||= [];
    const concept = binding.correspondence.find(item => item.key === key);
    const existing = entry(id, key);
    if (!source) { if (existing) snapshots[id] = snapshots[id].filter(item => item !== existing); return; }
    if (existing) { existing.revision += 1; existing.digest = source.digest; return; }
    const ref = concept.refs[id] || `${id}:${key}`;
    snapshots[id].push({ ref, key, ...(concept.area ? { area: concept.area } : {}), revision: 1, digest: source.digest });
    concept.refs[id] = ref;
  };
  const settleAll = settlements => { if (settlements.length) binding = settle(binding, settlements, snapshots); };

  for (const [index, step] of scenario.steps.entries()) {
    const where = `${scenario.name}, step ${index + 1} (${step.do})`;
    if (step.do === 'evaluate') {
      const result = evaluate(binding, snapshots);
      binding = { ...binding, correspondence: result.correspondence };
      assert.deepEqual(result.actions.map(show), step.expect, `${where}: ${step.note || 'actions'}`);
      if (step.expectSameIds) assert.deepEqual(result.actions.map(action => action.id), last.actions.map(action => action.id), `${where}: replayed IDs`);
      if (step.expectFirst) assert.ok(result.actions.filter(action => action.kind === 'adopt').every(action => action.first && !action.drift), `${where}: first-reconcile drafts, not drift`);
      for (const [key, state] of Object.entries(step.expectStatus || {})) assert.equal(result.status.find(row => row.key === key)?.state, state, `${where}: ${key} is ${state}`);
      trace.push({ step: index + 1, actions: result.actions, status: result.status });
      last = result;
      if (step.noApply) continue;
      for (const action of result.actions.filter(item => item.auto)) {
        // A mechanical part with a soft part pending (a test skeleton before the implementation) does not settle yet.
        // Drift adopted mechanically writes the drifted content into the authority; otherwise the hub's content flows out.
        if (action.kind === 'apply' && action.toAuthority) write(action.target, action.entry, entry(action.from[0], action.entry));
        else if (action.kind === 'apply' && action.settles.length) write(action.target, action.entry, hubEntry(action.entry));
        settleAll(action.settles);
      }
    } else if (step.do === 'resolve') {
      let open = last.actions.filter(item => item.kind === step.kind);
      // An assessment closes with a decision; the Work it decides on is resolved here as done.
      if (step.kind === 'assess') {
        open = open.flatMap(action => decide(binding, action, step.decide));
        assert.deepEqual(open.map(show), step.expectDecided, `${where}: the assessment decides ${step.decide}`);
      }
      for (const action of open) {
        if (['import', 'review', 'rectify'].includes(action.kind)) { write(action.target, action.entry, hubEntry(action.entry)); settleAll(action.settles); }
        else if (action.kind === 'adopt' && (step.decision === 'accept' || step.kind === 'assess')) { write(action.target, action.entry, entry(action.from[0], action.entry)); settleAll(action.settles); }
        else if (action.kind === 'adopt') settleAll(action.settles.map(item => ({ ...item, outcome: 'hub' })));
        else {
          if (step.choose !== action.target) write(action.target, action.entry, entry(step.choose, action.entry));
          settleAll(action.settles.map(item => item.participant === step.choose ? item : { ...item, outcome: 'hub' }));
        }
      }
    } else if (step.do === 'join') { binding = join(binding, step.participant); snapshots[step.participant.id] ||= []; }
    else if (step.do === 'transfer') {
      binding = transfer(binding, step.change);
      if (step.expectWiring) assert.deepEqual(showWiring(binding), step.expectWiring, `${where}: adapters re-pointed to the new hub`);
    } else if (step.do === 'edit') write(step.participant, step.key, { digest: step.digest });
    else if (step.do === 'remove') write(step.participant, step.key, null);
    else if (step.do === 'add') (snapshots[step.participant] ||= []).push({ ref: step.ref, key: step.key, revision: 1, digest: step.digest });
    else if (step.do === 'setPolicy') binding = { ...binding, policy: { ...binding.policy, [step.participant]: step.policy } };
    else if (step.do === 'addAdapter') binding = { ...binding, adapters: [...binding.adapters, step.adapter] };
    else throw new Error(`Unknown step ${step.do}`);
  }
  return { binding, trace };
}

for (const scenario of scenarios) test(`walkthrough: ${scenario.name}`, () => { play(scenario); });

test('every walkthrough has the same outcome, action IDs included, whatever order its inputs come in', () => {
  for (const scenario of scenarios) {
    const forward = play(scenario), backward = play(scenario, { reverse: true });
    assert.deepEqual(backward.trace, forward.trace, scenario.name);
    assert.deepEqual(backward.binding.baseline, forward.binding.baseline, `${scenario.name}: baseline`);
  }
});

const base = () => structuredClone(scenarios[0].binding);
const snapshots = () => structuredClone(scenarios[0].snapshots);

test('the receiving participant\'s policy decides what the hub\'s change does there', () => {
  const flagged = evaluate({ ...base(), policy: { 'code-ds': { changed: 'flag' } } }, snapshots());
  assert.deepEqual(flagged.actions.map(show), ['review color-primary @code-ds']);
  assert.equal(flagged.actions[0].work, true);
  const ignored = evaluate({ ...base(), policy: { 'code-ds': { changed: 'ignore' } } }, snapshots());
  assert.deepEqual(ignored.actions.map(show), ['ignored color-primary @code-ds']);
  assert.equal(ignored.actions[0].auto, true, 'ignoring is recorded and settles');
  assert.equal(evaluate(settle(base(), ignored.actions[0].settles, snapshots()), snapshots()).actions.length, 0);
});

test('two spokes drifting differently on one entry is a conflict for a person; the same drift is assessed once', () => {
  const binding = { ...base(), participants: [...base().participants, { id: 'docs', layer: { key: 'docs' }, facet: 'tokens', role: 'replica', shape: 'docs.tokens' }],
    correspondence: [{ key: 'radius', refs: { 'pages-kit': 'kit-radius', 'code-ds': 'tokens/radius', docs: 'radius.md' } }],
    baseline: { radius: { 'code-ds': { hub: 'pages-kit', hubRevision: 1, self: 1 }, docs: { hub: 'pages-kit', hubRevision: 1, self: 1 } } } };
  const current = { 'pages-kit': [{ ref: 'kit-radius', revision: 1, digest: '4px' }],
    'code-ds': [{ ref: 'tokens/radius', revision: 2, digest: '6px' }], docs: [{ ref: 'radius.md', revision: 2, digest: '8px' }] };
  assert.deepEqual(evaluate(binding, current).actions.map(show), ['conflict radius @pages-kit <code-ds,docs']);
  current.docs[0].digest = '6px';
  assert.deepEqual(evaluate(binding, current).actions.map(show), ['assess radius @work <code-ds,docs'], 'the same drift in two spokes is assessed once');
});

test('drift: the drifted participants\' contract decides, mixed answers are assessed, and an assessment decides adopt or rectify', () => {
  const binding = { ...base(), participants: [...base().participants, { id: 'docs', layer: { key: 'docs' }, facet: 'tokens', role: 'replica', shape: 'docs.tokens' }],
    correspondence: [{ key: 'radius', refs: { 'pages-kit': 'kit-radius', 'code-ds': 'tokens/radius', docs: 'radius.md' } }],
    baseline: { radius: { 'code-ds': { hub: 'pages-kit', hubRevision: 1, self: 1 }, docs: { hub: 'pages-kit', hubRevision: 1, self: 1 } } } };
  const current = { 'pages-kit': [{ ref: 'kit-radius', revision: 1, digest: '4px' }],
    'code-ds': [{ ref: 'tokens/radius', revision: 2, digest: '6px' }], docs: [{ ref: 'radius.md', revision: 2, digest: '6px' }] };
  const withPolicy = (code, docs) => ({ ...binding, policy: { 'code-ds': { drift: { changed: code } }, docs: { drift: { changed: docs } } } });
  assert.deepEqual(evaluate(withPolicy('rectify', 'rectify'), current).actions.map(show), ['rectify radius @code-ds', 'rectify radius @docs']);
  assert.deepEqual(evaluate(withPolicy('adopt', 'adopt'), current).actions.map(show), ['adopt radius @pages-kit <code-ds,docs'], 'no mechanical reader in the authority: adopting is Work');
  const assessed = evaluate(withPolicy('adopt', 'rectify'), current).actions;
  assert.deepEqual(assessed.map(show), ['assess radius @work <code-ds,docs']);
  assert.deepEqual(decide(binding, assessed[0], 'rectify').map(show), ['rectify radius @code-ds', 'rectify radius @docs']);
  assert.deepEqual(decide(binding, assessed[0], 'rectify').map(action => action.adapter ?? null), ['code-from-pages-kit', null], 'a rectify carries the adapter that can restore the replica');
  assert.deepEqual(decide(binding, assessed[0], 'adopt').map(action => action.settles.length), [2]);
  assert.throws(() => decide(binding, assessed[0], 'ignore'), /adopt or rectify/);
  assert.throws(() => decide(binding, { ...assessed[0], kind: 'adopt' }, 'adopt'), /Only an assessment/);
});

test('facets name the layer\'s own outputs, one facet per kind, and the roles each supports', () => {
  const manifest = { outputs: ['design_tokens', 'component', 'brand_asset'], tabs: [{ key: 'tokens' }, { key: 'brand' }] };
  assert.deepEqual(validateFacets(manifest), []);
  const facets = validateFacets({ ...manifest, facets: [
    { key: 'tokens', title: 'Tokens', kinds: ['design_tokens'], roles: ['authority', 'replica'], views: ['tokens'], hints: ['design-tokens'] },
    { key: 'branding', title: 'Branding', kinds: ['brand_asset'], roles: ['authority', 'replica', 'ceded'], views: ['brand'] }] });
  assert.deepEqual(facets.map(facet => [facet.key, facet.roles.length]), [['tokens', 2], ['branding', 3]]);
  for (const facet of [
    { key: 'kit', title: 'Kit', kinds: ['page'], roles: ['authority'] },
    { key: 'kit', title: 'Kit', kinds: ['component'], roles: ['owner'] },
    { key: 'kit', title: 'Kit', kinds: ['component'], roles: ['authority'], views: ['pages'] },
    { key: 'Kit', title: 'Kit', kinds: ['component'], roles: ['authority'] }
  ]) assert.throws(() => validateFacets({ ...manifest, facets: [facet] }), /facet|roles|view/i, JSON.stringify(facet));
  assert.throws(() => validateFacets({ ...manifest, facets: [
    { key: 'a', title: 'A', kinds: ['component'], roles: ['authority'] }, { key: 'b', title: 'B', kinds: ['component'], roles: ['authority'] }] }), /each in one facet/);
});

test('a binding is checked: a real authority per area, roles that hold, policies and adapters for its participants', () => {
  assert.doesNotThrow(() => validateBinding(base()));
  const cases = [
    [{ authority: 'nobody' }, /not a participant/],
    [{ participants: base().participants.map(p => p.id === 'pages-kit' ? { ...p, role: 'ceded' } : p) }, /ceded facet cannot be an authority/],
    [{ participants: base().participants.map(p => p.id === 'code-ds' ? { ...p, role: 'authority' } : p) }, /holds no area/],
    [{ participants: base().participants.map(p => p.id === 'code-ds' ? { ...p, keeps: ['radius'], role: 'ceded' } : p) }, /Only a replica keeps/],
    [{ participants: base().participants.map(p => p.id === 'code-ds' ? { ...p, role: 'peer' } : p) }, /unknown role/],
    [{ policy: { 'code-ds': { drift: { changed: 'merge' } } } }, /Invalid drift policy/],
    [{ policy: { ghost: { changed: 'flag' } } }, /unknown participant/],
    [{ policy: { 'code-ds': { changed: 'merge' } } }, /Invalid policy/],
    [{ adapters: [{ id: 'none', participant: 'code-ds', reads: 'pages.kit', mechanical: false, soft: false }] }, /mechanical or soft/],
    [{ participants: [base().participants[0]] }, /at least two/],
    [{ lifecycle: 'live' }, /lifecycle/]
  ];
  for (const [change, error] of cases) assert.throws(() => validateBinding({ ...base(), ...change }), error, JSON.stringify(change));
});

test('authority moves only by transfer, and the previous authority is given a role', () => {
  assert.throws(() => join(base(), { id: 'design-kit', layer: { key: 'design' }, facet: 'kit', role: 'authority', shape: 'design.kit' }), /transfer authority/);
  const joined = join(base(), { id: 'design-kit', layer: { key: 'design' }, facet: 'kit', role: 'replica', shape: 'design.kit' });
  assert.throws(() => transfer(joined, { to: 'design-kit' }), /Give pages-kit its new role/);
  const moved = transfer(joined, { to: 'design-kit', roles: { 'pages-kit': 'replica' } });
  assert.equal(moved.authority, 'design-kit');
  assert.equal(moved.lifecycle, 'reconciling', 'an active binding reconciles after a transfer');
  assert.deepEqual(moved.participants.map(p => [p.id, p.role]), [['pages-kit', 'replica'], ['code-ds', 'replica'], ['design-kit', 'authority']]);
  assert.throws(() => transfer(moved, { to: 'design-kit', roles: {} }), /already holds/);
});

test('lifecycle: proposed → reconciling → active → paused | retired', () => {
  const proposed = { ...base(), lifecycle: 'proposed' };
  assert.throws(() => transition(proposed, 'active'), /cannot become active/);
  const active = transition(transition(proposed, 'reconciling'), 'active');
  assert.equal(transition(active, 'paused').lifecycle, 'paused');
  assert.throws(() => transition(transition(active, 'retired'), 'active'), /retired binding/);
});
