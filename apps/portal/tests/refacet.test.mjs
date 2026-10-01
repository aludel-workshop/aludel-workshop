// LAYER-BINDINGS-01 step 3: refaceting, run against every case in the plan. A participant's snapshot is derived from its
// layer's entries through the layer's current facets, so a refacet changes what a binding sees exactly as the host will.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assignFacets, bindingOf, decide, evaluate, facetOf, join, refacet, repoint, roleOf, settle, transfer, transition, validateBinding, validateFacets } from '../server/bindings.mjs';

const { cases } = JSON.parse(readFileSync(new URL('./fixtures/refacet-cases.json', import.meta.url), 'utf8'));
const show = action => action.kind === 'adapter' ? `adapter ${action.entries.join(',')} @${action.target}`
  : `${action.kind} ${action.entry} @${action.target}${['adopt', 'assess', 'combine', 'conflict'].includes(action.kind) ? ` <${action.from.join(',')}` : ''}`;
const showMove = action => `${action.kind} @${action.layer} ${(action.pairs || action.references).map(item => `${item.entry}:${item.from}>${item.to}`).join(',')}`;
const preflightShows = {
  records: preflight => preflight.records.map(item => item.ref),
  bindings: preflight => preflight.bindings.map(item => `${item.binding}:${item.detached.join(',')}`),
  follow: preflight => preflight.follow.map(item => `${item.binding} ${item.participant} ${item.layer}/${item.facet} ${item.role} ${item.refs.join(',')}`),
  references: preflight => preflight.references.map(item => `${item.layer}/${item.entry}>${item.to}`),
  facets: preflight => preflight.facets.map(item => `${item.key}:${item.entries}:${item.bindings.join(',')}`)
};

// Plays a case as the routines, the people doing its Work and the reviewers of each refacet would. `reverse` feeds every
// list (entries, participants, correspondence, adapters, references) in reverse to show outcomes do not depend on order.
function run(scenario, { reverse = false } = {}) {
  const state = structuredClone(scenario);
  const layers = state.layers;
  let references = state.references;
  const bindings = new Map(state.bindings.map(binding => [binding.id, binding]));
  const flip = binding => { binding.participants.reverse(); binding.correspondence?.reverse(); binding.adapters?.reverse(); return binding; };
  if (reverse) { for (const layer of Object.values(layers)) layer.entries.reverse(); references = [...references].reverse(); for (const binding of bindings.values()) flip(binding); }
  const facetsOf = key => validateFacets({ key, outputs: layers[key].outputs, facets: layers[key].facets });
  const snapshotsFor = binding => Object.fromEntries(binding.participants.map(participant => {
    const facets = facetsOf(participant.layer.key);
    return [participant.id, layers[participant.layer.key].entries.filter(entry => facetOf(facets, entry) === participant.facet)
      .map(entry => ({ ref: entry.ref, key: entry.key ?? entry.ref, revision: entry.revision, digest: entry.digest, kind: entry.kind }))];
  }));
  const participantOf = (binding, id) => binding.participants.find(participant => participant.id === id);
  const entryOf = (binding, id, key) => {
    const ref = binding.correspondence.find(item => item.key === key)?.refs[id];
    return ref ? layers[participantOf(binding, id).layer.key].entries.find(entry => entry.ref === ref) || null : null;
  };
  // A participant's layer writes the entry for `key` as `source` has it, into its facet, or removes it.
  const write = (binding, id, key, source) => {
    const participant = participantOf(binding, id), layer = layers[participant.layer.key];
    const existing = entryOf(binding, id, key);
    if (!source) { if (existing) layer.entries = layer.entries.filter(entry => entry !== existing); return; }
    if (existing) { existing.revision += 1; existing.digest = source.digest; return; }
    const clause = facetsOf(participant.layer.key).find(facet => facet.key === participant.facet).select[0];
    const data = { ...(source.data || {}) };
    if (clause.where?.in) data[clause.where.field] = clause.where.in[0];
    const ref = `${participant.layer.key}:${key}`;
    layer.entries.push({ ref, kind: clause.kind, key, ...(Object.keys(data).length ? { data } : {}), revision: 1, digest: source.digest });
    binding.correspondence.find(item => item.key === key).refs[id] = ref;
  };
  const settleAll = (id, settlements) => { if (settlements.length) bindings.set(id, settle(bindings.get(id), settlements, snapshotsFor(bindings.get(id)))); };
  const trace = [], last = new Map();

  for (const [index, step] of scenario.steps.entries()) {
    const where = `${scenario.name}, step ${index + 1} (${step.do})`;
    const attempt = fn => {
      if (!step.expectError) return fn();
      assert.throws(fn, error => error.message.includes(step.expectError), `${where}: refused`);
      return null;
    };
    if (step.do === 'refacet') {
      const layer = layers[step.layer];
      const result = attempt(() => refacet({ key: step.layer, outputs: layer.outputs, facets: layer.facets }, step.change,
        { entries: layer.entries, bindings: [...bindings.values()], references }));
      if (!result) continue;
      for (const [field, expected] of Object.entries(step.expectPreflight || {})) assert.deepEqual(preflightShows[field](result.preflight), expected, `${where}: preflight ${field}`);
      assert.equal(result.preflight.records.length + result.preflight.unchanged, layer.entries.length, `${where}: every record is moved or unchanged`);
      layer.facets = result.facets;
      for (const binding of result.bindings) bindings.set(binding.id, binding);
      trace.push({ step: index + 1, preflight: result.preflight, facets: result.facets });
    } else if (step.do === 'facets') {
      const groups = assignFacets(facetsOf(step.layer), layers[step.layer].entries);
      assert.deepEqual(Object.fromEntries(Object.entries(groups).filter(([key]) => key !== 'null')), step.expect, `${where}: entries by facet`);
    } else if (step.do === 'select') {
      assert.deepEqual(Object.fromEntries(facetsOf(step.layer).map(facet => [facet.key, facet.select])), step.expect, `${where}: facet clauses`);
    } else if (step.do === 'role') {
      const entry = layers[step.layer].entries.find(item => item.ref === step.ref) || assert.fail(`${where}: no entry ${step.ref}`);
      const role = roleOf({ key: step.layer, outputs: layers[step.layer].outputs, facets: layers[step.layer].facets }, entry, [...bindings.values()]);
      assert.deepEqual(role, { authority: null, ...step.expect }, `${where}: role of ${step.ref}`);
    } else if (step.do === 'propose') {
      const binding = validateBinding(step.binding);
      bindings.set(binding.id, reverse ? flip(binding) : binding);
    } else if (step.do === 'evaluate') {
      const result = evaluate(bindings.get(step.binding), snapshotsFor(bindings.get(step.binding)));
      bindings.set(step.binding, { ...bindings.get(step.binding), correspondence: result.correspondence, detached: result.detached });
      assert.deepEqual(result.actions.map(show), step.expect, `${where}: ${step.note || 'actions'}`);
      for (const [key, state] of Object.entries(step.expectStatus || {})) assert.equal(result.status.find(row => row.key === key)?.state, state, `${where}: ${key} is ${state}`);
      if (step.expectDetached) assert.deepEqual(result.detached.map(entry => `${entry.key}:${Object.keys(entry.refs).sort().join(',')}`), step.expectDetached, `${where}: detached`);
      if (step.expectAdapter) assert.ok(result.actions.filter(action => action.kind === 'adopt').every(action => action.adapter === step.expectAdapter), `${where}: adopted through ${step.expectAdapter}`);
      trace.push({ step: index + 1, actions: result.actions, status: result.status, detached: result.detached });
      last.set(step.binding, result);
      for (const action of result.actions.filter(item => item.auto)) {
        const binding = bindings.get(step.binding);
        if (action.kind === 'apply' && action.toAuthority) write(binding, action.target, action.entry, entryOf(binding, action.from[0], action.entry));
        else if (action.kind === 'apply' && action.settles.length) write(binding, action.target, action.entry, entryOf(binding, binding.authority, action.entry));
        settleAll(step.binding, action.settles);
      }
    } else if (step.do === 'resolve') {
      let open = last.get(step.binding).actions.filter(item => item.kind === step.kind);
      if (step.kind === 'assess') open = open.flatMap(action => decide(bindings.get(step.binding), action, step.decide));
      for (const action of open) {
        const binding = bindings.get(step.binding);
        if (['import', 'review', 'rectify'].includes(action.kind)) { write(binding, action.target, action.entry, entryOf(binding, binding.authority, action.entry)); settleAll(step.binding, action.settles); }
        else if (action.kind === 'adopt' && step.decision === 'accept') { write(binding, action.target, action.entry, entryOf(binding, action.from[0], action.entry)); settleAll(step.binding, action.settles); }
        else if (action.kind === 'adopt') settleAll(step.binding, action.settles.map(item => ({ ...item, outcome: 'hub' })));
        else {
          if (step.choose !== action.target) write(binding, action.target, action.entry, entryOf(binding, step.choose, action.entry));
          settleAll(step.binding, action.settles.map(item => item.participant === step.choose ? item : { ...item, outcome: 'hub' }));
        }
      }
    } else if (step.do === 'transfer') {
      const moved = attempt(() => transfer(bindings.get(step.binding), step.change));
      if (moved) bindings.set(step.binding, moved);
    } else if (step.do === 'retire') bindings.set(step.binding, transition(bindings.get(step.binding), 'retired'));
    else if (step.do === 'edit') write(bindings.get(step.binding), step.participant, step.key, { digest: step.digest });
    else if (step.do === 'repoint') {
      const binding = bindings.get(step.binding);
      const result = repoint(binding, { from: step.from, references, accepts: step.accepts, snapshots: snapshotsFor(binding) });
      assert.deepEqual(result.actions.map(showMove), step.expect, `${where}: ${step.note || 'repoint'}`);
      trace.push({ step: index + 1, repoint: result });
    } else throw new Error(`Unknown step ${step.do}`);
  }
  return { trace, bindings: Object.fromEntries([...bindings].map(([id, binding]) => [id, { baseline: binding.baseline, detached: binding.detached }])), layers };
}

for (const scenario of cases) test(`refacet case: ${scenario.name}`, () => { run(scenario); });

test('every refacet case has the same outcome, action IDs included, whatever order its inputs come in', () => {
  for (const scenario of cases) {
    const forward = run(scenario), backward = run(scenario, { reverse: true });
    assert.deepEqual(backward.trace, forward.trace, scenario.name);
    assert.deepEqual(backward.bindings, forward.bindings, `${scenario.name}: baselines`);
  }
});

// ---- Refacet rules ----

const outputs = ['brand_asset', 'design_tokens', 'component'];
const facet = (key, select, roles = ['authority', 'replica', 'ceded']) => ({ key, title: key, select, roles });
const brand = where => ({ kind: 'brand_asset', ...(where ? { where } : {}) });
const assets = ['name', 'mark', 'voice', 'tagline', 'palette'].map(key => ({ ref: `brd-${key}`, kind: 'brand_asset', data: { key } }))
  .concat([{ ref: 'brd-none', kind: 'brand_asset', data: {} }, { ref: 'tok-1', kind: 'design_tokens' }, { ref: 'cmp-1', kind: 'component' }]);

test('facets never overlap: a kind is selected whole once, or narrowed by one field to disjoint values', () => {
  const check = (...facets) => validateFacets({ key: 'design', outputs, facets });
  assert.doesNotThrow(() => check(facet('a', [brand({ field: 'key', in: ['name'] })]), facet('b', [brand({ field: 'key', in: ['mark'] })])));
  assert.doesNotThrow(() => check(facet('a', [brand({ field: 'key', in: ['name', 'mark'] })]), facet('b', [brand({ field: 'key', notIn: ['name', 'mark'] })])));
  for (const [a, b] of [
    [[brand()], [brand({ field: 'key', in: ['name'] })]],
    [[brand({ field: 'key', in: ['name', 'mark'] })], [brand({ field: 'key', equals: 'mark' })]],
    [[brand({ field: 'key', in: ['name'] })], [brand({ field: 'key', notIn: ['mark'] })]],
    [[brand({ field: 'key', notIn: ['name'] })], [brand({ field: 'key', notIn: ['mark'] })]],
    [[brand({ field: 'key', in: ['name'] })], [brand({ field: 'group', in: ['brand'] })]]
  ]) assert.throws(() => check(facet('a', a), facet('b', b)), /both select brand_asset/, JSON.stringify([a, b]));
  assert.throws(() => check(facet('a', [brand(), brand({ field: 'key', in: ['x'] })])), /selects brand_asset twice/);
  assert.throws(() => check(facet('a', [{ kind: 'persona' }])), /own output kinds/);
  assert.throws(() => check(facet('a', [brand({ field: 'key', in: [] })])), /up to 50 plain values/);
  assert.throws(() => check(facet('a', [brand({ field: 'key', in: ['a'], notIn: ['b'] })])), /one field/);
  assert.throws(() => check({ ...facet('a', [brand()]), kinds: ['brand_asset'] }), /select or kinds, not both/);
  assert.throws(() => check({ ...facet('a', [brand()]), readOnly: true }), /read-only, so it can only be an authority/);
  assert.deepEqual(check({ key: 'a', title: 'A', kinds: ['brand_asset'], roles: ['authority'] })[0].select, [brand()], 'kinds is shorthand for whole kinds');
});

test('a split keeps every record in exactly one facet, and merging it back restores the original membership', () => {
  const parents = [[brand(), { kind: 'design_tokens' }], [brand({ field: 'key', in: ['name', 'mark', 'voice'] })], [brand({ field: 'key', notIn: ['palette'] }), { kind: 'component' }]];
  const takes = [[brand({ field: 'key', in: ['name'] })], [brand({ field: 'key', in: ['name', 'mark'] })], [brand()], [brand({ field: 'key', notIn: ['palette', 'voice'] })]];
  let tried = 0;
  for (const select of parents) for (const take of takes) {
    const layer = { key: 'design', outputs, facets: [facet('kit', select), facet('other', [{ kind: 'component' }].filter(() => !select.some(clause => clause.kind === 'component')))].filter(item => item.select.length) };
    const before = assignFacets(validateFacets(layer), assets);
    let split;
    try { split = refacet(layer, { op: 'split', facet: 'kit', into: { key: 'part', title: 'Part', take } }, { entries: assets }); }
    catch (error) { assert.match(error.message, /does not select all of|Rename the facet/, JSON.stringify({ select, take })); continue; }
    tried += 1;
    const after = assignFacets(validateFacets({ ...layer, facets: split.facets }), assets);
    assert.deepEqual([...after.kit, ...after.part].sort(), before.kit, `${JSON.stringify({ select, take })}: the parent's records are split, none lost or doubled`);
    assert.deepEqual(after.null, before.null, 'records in no facet stay in none');
    assert.deepEqual(split.preflight.records.map(item => item.ref), after.part);
    const merged = refacet({ ...layer, facets: split.facets }, { op: 'merge', facet: 'kit', from: 'part' }, { entries: assets });
    assert.deepEqual(assignFacets(validateFacets({ ...layer, facets: merged.facets }), assets), before, `${JSON.stringify({ select, take })}: merge restores membership`);
  }
  assert.ok(tried >= 8, `enough splits were valid to mean something (${tried})`);
});

test('a split takes only part of the facet, under a new key; renaming keeps the key', () => {
  const layer = { key: 'design', outputs, facets: [facet('kit', [brand({ field: 'key', in: ['name', 'mark'] })]), facet('tokens', [{ kind: 'design_tokens' }])] };
  const split = (into, facetKey = 'kit') => refacet(layer, { op: 'split', facet: facetKey, into: { title: 'Part', ...into } }, { entries: assets });
  assert.throws(() => split({ key: 'part', take: [brand({ field: 'key', in: ['voice'] })] }), /does not select all of brand_asset/);
  assert.throws(() => split({ key: 'part', take: [{ kind: 'design_tokens' }] }), /does not select all of design_tokens/);
  assert.throws(() => split({ key: 'part', take: [brand()] }), /Rename the facet instead/);
  assert.throws(() => split({ key: 'tokens', take: [brand({ field: 'key', in: ['name'] })] }), /key this layer does not use/);
  assert.throws(() => split({ key: 'part', take: [] }), /Name the part/);
  assert.throws(() => refacet(layer, { op: 'split', facet: 'ghost', into: {} }), /declares no ghost facet/);
  assert.throws(() => refacet(layer, { op: 'merge', facet: 'kit', from: 'kit' }), /no other facet/);
  assert.throws(() => refacet(layer, { op: 'reshape', facet: 'kit' }), /split, merge or rename/);
  const renamed = refacet(layer, { op: 'rename', facet: 'kit', title: 'Name and mark' }, { entries: assets });
  assert.deepEqual(renamed.facets.map(item => [item.key, item.title]), [['kit', 'Name and mark'], ['tokens', 'tokens']]);
  assert.deepEqual(renamed.preflight.records, []);
});

test('bindings follow keys: the parent keeps its bindings, the split-off facet starts unbound or joins one named binding', () => {
  const layer = { key: 'design', outputs, facets: [facet('kit', [brand(), { kind: 'design_tokens' }])] };
  const entries = [{ ref: 'brd-name', kind: 'brand_asset', data: { key: 'name' } }, { ref: 'tok-1', kind: 'design_tokens' }];
  const binding = (id, participants, extra = {}) => validateBinding({ id, concept: { name: id }, lifecycle: 'active', participants, authority: participants[0].id, ...extra });
  const designKit = binding('bnd-kit', [
    { id: 'design-kit', layer: { key: 'design' }, facet: 'kit', role: 'authority', shape: 'design.kit' },
    { id: 'pages-kit', layer: { key: 'pages' }, facet: 'kit', role: 'replica', shape: 'pages.kit' }],
  { correspondence: [{ key: 'app-name', refs: { 'design-kit': 'brd-name', 'pages-kit': 'kit-name' } }, { key: 'primary', refs: { 'design-kit': 'tok-1', 'pages-kit': 'kit-1' } }],
    baseline: { 'app-name': { 'pages-kit': { hub: 'design-kit', hubRevision: 1, self: 1 } }, primary: { 'pages-kit': { hub: 'design-kit', hubRevision: 1, self: 1 } } } });
  const branding = binding('bnd-brand', [
    { id: 'branding', layer: { key: 'branding' }, facet: 'brand', role: 'authority', shape: 'branding.brand' },
    { id: 'pages-brand', layer: { key: 'pages' }, facet: 'kit-brand', role: 'replica', shape: 'pages.kit-brand' }]);
  const into = { key: 'brand', title: 'Brand', take: [brand()] };
  const unbound = refacet(layer, { op: 'split', facet: 'kit', into }, { entries, bindings: [designKit, branding] });
  assert.deepEqual(unbound.preflight.facets.map(item => [item.key, item.bindings]), [['kit', ['bnd-kit']], ['brand', []]]);
  const kept = unbound.bindings.find(item => item.id === 'bnd-kit');
  assert.deepEqual(kept.correspondence.map(item => item.key), ['primary'], 'the moved entry leaves the binding');
  assert.deepEqual(kept.detached, [{ key: 'app-name', refs: { 'pages-kit': ['kit-name'] } }], 'and is held for Pages until it lets go');
  assert.deepEqual(Object.keys(kept.baseline), ['primary']);
  assert.deepEqual(kept.participants, designKit.participants, 'roles are untouched');
  const joined = refacet(layer, { op: 'split', facet: 'kit', into, join: { binding: 'bnd-brand', id: 'design-brand', role: 'ceded' } }, { entries, bindings: [designKit, branding] });
  assert.deepEqual(joined.preflight.facets.map(item => [item.key, item.bindings]), [['kit', ['bnd-kit']], ['brand', ['bnd-brand']]]);
  assert.deepEqual(joined.bindings.find(item => item.id === 'bnd-brand').participants.map(p => `${p.id}:${p.role}`), ['branding:authority', 'pages-brand:replica', 'design-brand:ceded']);
  assert.throws(() => refacet(layer, { op: 'split', facet: 'kit', into: { ...into, roles: ['replica'] }, join: { binding: 'bnd-brand', id: 'design-brand', role: 'ceded' } }, { entries, bindings: [branding] }), /does not support ceded/);
  assert.throws(() => refacet(layer, { op: 'split', facet: 'kit', into, join: { binding: 'bnd-brand', id: 'design-brand', role: 'authority' } }, { entries, bindings: [branding] }), /transfer authority/);
  assert.throws(() => refacet(layer, { op: 'split', facet: 'kit', into, join: { binding: 'bnd-gone', id: 'x', role: 'ceded' } }, { entries, bindings: [] }), /No live binding/);
  const retired = transition(designKit, 'retired');
  assert.deepEqual(refacet(layer, { op: 'split', facet: 'kit', into }, { entries, bindings: [retired] }).bindings, [], 'a retired binding is history and is left alone');
});

test('a facet takes part in one live binding; a straddle is refaceted', () => {
  const participants = facetKey => [{ id: 'a', layer: { key: 'design' }, facet: 'kit', role: 'authority', shape: 'design.kit' }, { id: 'b', layer: { key: 'pages' }, facet: facetKey, role: 'replica', shape: 'pages.kit' }];
  const one = validateBinding({ id: 'bnd-one', concept: { name: 'one' }, lifecycle: 'active', participants: participants('kit'), authority: 'a' });
  const two = validateBinding({ ...one, id: 'bnd-two', participants: [{ ...participants('kit')[0], layer: { key: 'branding' }, facet: 'brand' }, participants('kit')[1]] });
  assert.throws(() => bindingOf([one, two], 'pages', 'kit'), /takes part in bnd-one and bnd-two\. Refacet it/);
  assert.equal(bindingOf([one, transition(two, 'retired')], 'pages', 'kit').id, 'bnd-one');
  assert.equal(bindingOf([one, two], 'design', 'kit').id, 'bnd-one', 'the same facet key in another layer is another facet');
  assert.throws(() => roleOf({ key: 'pages', outputs: ['kit_item'], facets: [{ key: 'kit', title: 'Kit', kinds: ['kit_item'], roles: ['replica'] }] }, { ref: 'k', kind: 'kit_item' }, [one, two]), /Refacet it/);
});

test('an entry whose narrowing field changes moves facet, and its role moves with it', () => {
  const layer = { key: 'design', outputs, facets: [facet('identity', [brand({ field: 'key', in: ['name', 'mark'] })]), facet('brand', [brand({ field: 'key', notIn: ['name', 'mark'] })])] };
  const binding = validateBinding({ id: 'bnd-brand', concept: { name: 'Brand' }, lifecycle: 'active', authority: 'branding', participants: [
    { id: 'branding', layer: { key: 'branding' }, facet: 'brand', role: 'authority', shape: 'branding.brand' },
    { id: 'design-identity', layer: { key: 'design' }, facet: 'identity', role: 'replica', shape: 'design.identity' },
    { id: 'design-brand', layer: { key: 'design' }, facet: 'brand', role: 'ceded', shape: 'design.brand' }] });
  assert.equal(roleOf(layer, { ref: 'brd-mark', kind: 'brand_asset', data: { key: 'mark' } }, [binding]).role, 'replica');
  assert.equal(roleOf(layer, { ref: 'brd-mark', kind: 'brand_asset', data: { key: 'motto' } }, [binding]).role, 'ceded');
  assert.equal(roleOf(layer, { ref: 'tok', kind: 'design_tokens' }, [binding]), null, 'an entry in no facet is the layer\'s own business');
  assert.equal(facetOf(validateFacets(layer), { ref: 'brd-x', kind: 'brand_asset' }), 'brand', 'a missing field is not in any listed value');
});

test('re-pointing waits for entries the authority has not adopted yet', () => {
  const binding = validateBinding({ id: 'bnd-personas', concept: { name: 'Personas' }, lifecycle: 'active', authority: 'people',
    participants: [{ id: 'people', layer: { key: 'personas' }, facet: 'people', role: 'authority', shape: 'personas.people' },
      { id: 'vision', layer: { key: 'vision' }, facet: 'personas', role: 'ceded', shape: 'vision.personas' }],
    correspondence: [{ key: 'maker', refs: { people: 'p-maker', vision: 'per-maker' } }, { key: 'borrower', refs: { vision: 'per-borrower' } }] });
  const result = repoint(binding, { from: 'vision', accepts: { pages: '*' }, snapshots: { people: [{ ref: 'p-maker', kind: 'person', revision: 1 }] },
    references: [{ layer: 'pages', entry: 'pg-home', to: 'per-maker' }, { layer: 'pages', entry: 'flw-borrow', to: 'per-borrower' }] });
  assert.deepEqual(result.actions.map(showMove), ['repoint @pages pg-home:per-maker>p-maker']);
  assert.deepEqual(result.waiting, [{ layer: 'pages', entry: 'flw-borrow', to: 'per-borrower' }]);
  assert.throws(() => repoint(binding, { from: 'people' }), /not a ceded participant/);
  assert.equal(join(binding, { id: 'docs', layer: { key: 'docs' }, facet: 'people', role: 'replica', shape: 'docs.people' }).participants.length, 3);
});

test('detached entries are held by ref and by concept key until no participant publishes them', () => {
  const layer = { key: 'design', outputs, facets: [facet('kit', [brand(), { kind: 'design_tokens' }])] };
  const binding = validateBinding({ id: 'bnd-kit', concept: { name: 'Kit' }, lifecycle: 'active', authority: 'design-kit',
    participants: [{ id: 'design-kit', layer: { key: 'design' }, facet: 'kit', role: 'authority', shape: 'design.kit' },
      { id: 'pages-kit', layer: { key: 'pages' }, facet: 'kit', role: 'replica', shape: 'pages.kit' }],
    correspondence: [{ key: 'app-name', refs: { 'design-kit': 'brd-name', 'pages-kit': 'kit-name' } }],
    baseline: { 'app-name': { 'pages-kit': { hub: 'design-kit', hubRevision: 1, self: 1 } } } });
  const [split] = refacet(layer, { op: 'split', facet: 'kit', into: { key: 'brand', title: 'Brand', take: [brand()] } },
    { entries: [{ ref: 'brd-name', kind: 'brand_asset' }], bindings: [binding] }).bindings;
  // Pages' copy was matched by ref under its own key, and Pages has since made a second entry under the concept key.
  const pages = [{ ref: 'kit-name', key: 'name-item', revision: 1, digest: 'Tool Share' }, { ref: 'kit-name-2', key: 'app-name', revision: 1, digest: 'Tool Share 2' }];
  const held = evaluate(split, { 'design-kit': [], 'pages-kit': pages });
  assert.deepEqual(held.actions, [], 'neither is offered to Design nor read as drift');
  assert.deepEqual(held.detached, [{ key: 'app-name', refs: { 'pages-kit': ['kit-name', 'kit-name-2'] } }], 'both are held');
  const one = evaluate({ ...split, detached: held.detached }, { 'design-kit': [], 'pages-kit': [pages[0]] });
  assert.deepEqual([one.actions, one.detached], [[], [{ key: 'app-name', refs: { 'pages-kit': ['kit-name'] } }]], 'the first is still held once the second goes');
  const released = evaluate({ ...split, detached: one.detached }, { 'design-kit': [], 'pages-kit': [] });
  assert.deepEqual([released.actions, released.detached], [[], []]);
});
