// LAYER-BINDINGS-01: how layers share what they know. A binding is a project-level record for one shared concept (the app's
// design system, its user journeys) with any number of participating facets. This module is the contract's pure core: it
// validates facets and bindings, and evaluates a binding against what each participant currently publishes, returning the
// automatic changes and the Work it calls for. It reads and writes nothing; the caller applies its results.
//
// Hub, not mesh: every non-authority participant is a spoke of the binding's one authority. A spoke's baseline holds its own
// revision and the hub's at the last agreed sync, so each spoke is a three-way merge against the hub. Moving authority
// changes the hub, which voids those baselines, so the next evaluation is that spoke's first reconcile.
// Adapters belong to the receiving participant and name the source shape they read; a spoke's active adapter is the one
// that reads its current hub's shape, so a transfer re-points adapters without anyone rewiring them.
//
// Direction is always from the authority, but any participant may still change outside the binding (a commit made without
// the normal process). That is drift. The binding's drift policy for that participant and event decides: adopt it into the
// authority (automatically when the authority owns a mechanical adapter for the drifted shape), rectify the participant
// with Work, or have the drift assessed as Work, which then decides one or the other.
//
// Step 3, refaceting: a binding always contracts on whole facets. When only part of a facet should be shared, the layer is
// refaceted so that part becomes a facet of its own (`refacet`); bindings follow facet keys, and entries that leave a bound
// facet are detached from its bindings until every participant has let them go.
import { createHash } from 'node:crypto';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const own = Object.hasOwn;
const keyPattern = /^[a-z][a-z0-9-]{0,62}$/;
const shapePattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const fieldPattern = /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

export const roles = Object.freeze(['authority', 'replica', 'ceded']);
export const events = Object.freeze(['added', 'changed', 'removed']);
export const responses = Object.freeze(['propagate', 'flag', 'ignore']);
export const driftResponses = Object.freeze(['adopt', 'rectify', 'assess']);
export const lifecycleTransitions = Object.freeze({
  proposed: ['reconciling', 'retired'], reconciling: ['active', 'paused', 'retired'],
  active: ['paused', 'reconciling', 'retired'], paused: ['active', 'reconciling', 'retired'], retired: []
});
// Action kinds, in the order a binding's page lists them for one entry.
export const actionKinds = Object.freeze(['apply', 'import', 'review', 'adapter', 'adopt', 'assess', 'rectify', 'combine', 'conflict', 'ignored']);

// ---- Facets: distinct slices of a layer's outputs ----

// A select clause names one of the layer's own kinds, optionally narrowed by one field of the entry's data. Normal form:
// { kind } | { kind, where: { field, in: [values] } } | { kind, where: { field, notIn: [values] } }; `equals` is `in` of one.
// `notIn` is what remains of a kind once part of it is split off by value.
const scalar = value => ['string', 'number', 'boolean'].includes(typeof value);
const order = values => [...new Set(values)].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
function normalClause(input, outputs, facetKey) {
  if (!input || typeof input !== 'object' || typeof input.kind !== 'string' || !outputs.includes(input.kind))
    fail(`Facet ${facetKey} must select this layer's own output kinds.`);
  if (input.where === undefined) return { kind: input.kind };
  const where = input.where, ops = where && typeof where === 'object' ? ['equals', 'in', 'notIn'].filter(op => own(where, op)) : [];
  if (!fieldPattern.test(where?.field || '') || ops.length !== 1) fail(`Facet ${facetKey} narrows ${input.kind} by one field, with equals, in or notIn.`);
  const values = ops[0] === 'equals' ? [where.equals] : where[ops[0]];
  if (!Array.isArray(values) || !values.length || values.length > 50 || !values.every(scalar)) fail(`Facet ${facetKey} narrows ${input.kind} by up to 50 plain values.`);
  return { kind: input.kind, where: { field: where.field, [ops[0] === 'notIn' ? 'notIn' : 'in']: order(values) } };
}
// Two clauses can select the same entry unless they narrow the same kind by the same field to disjoint values.
function overlaps(a, b) {
  if (a.kind !== b.kind) return false;
  if (!a.where || !b.where || a.where.field !== b.where.field) return true;
  if (a.where.in && b.where.in) return a.where.in.some(value => b.where.in.includes(value));
  if (a.where.notIn && b.where.notIn) return true;
  const [only, except] = a.where.in ? [a.where.in, b.where.notIn] : [b.where.in, a.where.notIn];
  return only.some(value => !except.includes(value));
}
const matches = (clause, entry) => {
  if (entry?.kind !== clause.kind) return false;
  if (!clause.where) return true;
  const value = entry.data?.[clause.where.field];
  return clause.where.in ? clause.where.in.includes(value) : !clause.where.notIn.includes(value);
};
// A declaration's clauses: `select`, or `kinds` as shorthand for whole kinds (the form step 2's templates use).
function declaredSelect(facet, outputs) {
  if (facet.select !== undefined && facet.kinds !== undefined) fail(`Facet ${facet.key} names select or kinds, not both.`);
  const raw = facet.select !== undefined ? facet.select : Array.isArray(facet.kinds) ? facet.kinds.map(kind => ({ kind })) : null;
  if (!Array.isArray(raw) || !raw.length || raw.length > 20) fail(`Facet ${facet.key} must select this layer's own output kinds.`);
  return raw.map(clause => normalClause(clause, outputs, facet.key));
}

// A layer's facets (layer.json `facets`): distinct slices of the outputs it maintains and publishes to the Library, and the
// roles each can take in a binding. No entry is in two facets; an entry in none is the layer's own business and is never
// shared. Nothing here requires a facet type; `hints` only help discovery. A read-only facet (an imported source that
// takes no Work) can only be an authority.
export function validateFacets(manifest) {
  const facets = manifest?.facets;
  if (facets === undefined) return [];
  const outputs = Array.isArray(manifest.outputs) ? manifest.outputs : [];
  const tabs = new Set((manifest.tabs || []).map(tab => tab.key));
  if (!Array.isArray(facets) || facets.length > 20) fail('Invalid layer facets.');
  const keys = new Set(), taken = [];
  const result = facets.map(facet => {
    if (!facet || !keyPattern.test(facet.key) || keys.has(facet.key) || !text(facet.title, 80)) fail('Invalid layer facet.');
    const select = declaredSelect(facet, outputs);
    for (const clause of select) {
      const clash = taken.find(other => overlaps(other.clause, clause));
      if (clash) fail(clash.facet === facet.key ? `Facet ${facet.key} selects ${clause.kind} twice.`
        : `Facets ${clash.facet} and ${facet.key} both select ${clause.kind}${clause.where ? ` by ${clause.where.field}` : ''}: each entry belongs to one facet.`);
      taken.push({ facet: facet.key, clause });
    }
    if (!Array.isArray(facet.roles) || !facet.roles.length || !facet.roles.every(role => roles.includes(role)) || new Set(facet.roles).size !== facet.roles.length)
      fail(`Facet ${facet.key} must name the roles it supports.`);
    if (facet.readOnly !== undefined && typeof facet.readOnly !== 'boolean') fail(`Facet ${facet.key}: readOnly is true or false.`);
    if (facet.readOnly && (facet.roles.length !== 1 || facet.roles[0] !== 'authority')) fail(`Facet ${facet.key} is read-only, so it can only be an authority.`);
    if (facet.views !== undefined && (!Array.isArray(facet.views) || !facet.views.every(view => tabs.has(view)))) fail(`Facet ${facet.key} names a view that is not a tab.`);
    if (facet.hints !== undefined && (!Array.isArray(facet.hints) || facet.hints.length > 8 || !facet.hints.every(hint => keyPattern.test(hint)))) fail(`Invalid hints on facet ${facet.key}.`);
    if (facet.shape !== undefined && !shapePattern.test(facet.shape)) fail(`Facet ${facet.key} names an invalid shape.`);
    keys.add(facet.key);
    return { key: facet.key, title: facet.title.trim(), select, kinds: [...new Set(select.map(clause => clause.kind))], roles: [...facet.roles],
      shape: facet.shape || `${manifest.key}.${facet.key}`, views: [...(facet.views || [])], hints: [...(facet.hints || [])], readOnly: facet.readOnly === true };
  });
  return result;
}

// The facet an entry ({ kind, data }) belongs to, or null. Validated facets never overlap; this checks it per entry anyway.
export function facetOf(facets, entry) {
  const found = facets.filter(facet => facet.select.some(clause => matches(clause, entry)));
  if (found.length > 1) fail(`${entry.ref || entry.kind} falls in facets ${found.map(facet => facet.key).join(' and ')}.`, 500);
  return found[0]?.key ?? null;
}
// Every entry's facet: { [facetKey]: [refs] }, with entries in no facet under null.
export function assignFacets(facets, entries) {
  const groups = Object.fromEntries([...facets.map(facet => [facet.key, []]), ['null', []]]);
  for (const entry of entries) groups[String(facetOf(facets, entry))].push(entry.ref);
  for (const refs of Object.values(groups)) refs.sort();
  return groups;
}

// A layer's adapters (layer.json `adapters`): which of its facets each fills, the source shape it reads, and whether it has a
// mechanical part (the handler's `adapt`) and a soft part (Work). Adapters belong to the layer that receives.
export function validateAdapters(manifest) {
  const adapters = manifest?.adapters;
  if (adapters === undefined) return [];
  const facets = validateFacets(manifest);
  if (!Array.isArray(adapters) || adapters.length > 20) fail('Invalid layer adapters.');
  const ids = new Set();
  for (const adapter of adapters) {
    if (!adapter || !keyPattern.test(adapter.id || '') || ids.has(adapter.id)) fail('Invalid or duplicate adapter.');
    if (!facets.some(facet => facet.key === adapter.facet)) fail(`Adapter ${adapter.id} fills a facet the layer does not declare.`);
    if (!shapePattern.test(adapter.reads || '')) fail(`Adapter ${adapter.id} must name the shape it reads.`);
    if (typeof adapter.mechanical !== 'boolean' || typeof adapter.soft !== 'boolean' || (!adapter.mechanical && !adapter.soft)) fail(`Adapter ${adapter.id} needs a mechanical or soft part.`);
    if (adapter.mechanical && !manifest.api?.handler) fail(`Adapter ${adapter.id} is mechanical, so the layer needs a handler that exports adapt.`);
    ids.add(adapter.id);
  }
  return adapters.map(({ id, facet, reads, mechanical, soft }) => ({ id, facet, reads, mechanical, soft }));
}

// ---- Bindings ----

// The binding's one authority. Sharing part of a facet is a refacet, so there is no authority by area.
export const authorityFor = binding => binding.authority;
const participantOf = (binding, id) => binding.participants.find(participant => participant.id === id) || null;
const refaceted = 'Contract on part of a facet by refaceting it, so the part is a facet of its own.';

export function validateBinding(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('A binding must be an object.');
  const binding = structuredClone(input);
  if (!text(binding.concept?.name, 120)) fail('Name the concept this binding shares.');
  if (!own(lifecycleTransitions, binding.lifecycle)) fail('Unknown binding lifecycle.');
  if (!Array.isArray(binding.participants) || binding.participants.length < 2) fail('A binding needs at least two participants.');
  const ids = new Set(), facets = new Set();
  for (const participant of binding.participants) {
    if (!participant || !keyPattern.test(participant.id) || ids.has(participant.id)) fail('Invalid or duplicate participant.');
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(participant.layer?.key || '')) fail(`Participant ${participant.id} needs a layer.`);
    if (!keyPattern.test(participant.facet || '')) fail(`Participant ${participant.id} needs a facet.`);
    if (facets.has(`${participant.layer.key}\u0000${participant.facet}`)) fail(`${participant.layer.key}'s ${participant.facet} takes part once.`);
    if (!roles.includes(participant.role)) fail(`Participant ${participant.id} has an unknown role.`);
    if (!text(participant.shape, 80)) fail(`Participant ${participant.id} must name the shape it publishes.`);
    if (participant.areas !== undefined || participant.keeps !== undefined) fail(`${participant.id} takes part with its whole facet. ${refaceted}`);
    if (participant.readOnly !== undefined && typeof participant.readOnly !== 'boolean') fail(`Participant ${participant.id}: readOnly is true or false.`);
    // A read-only source takes no Work, so it cannot import: it is the authority, or ceded once something else is.
    if (participant.readOnly && participant.role === 'replica') fail(`${participant.id} is read-only, so it cannot be a replica.`);
    ids.add(participant.id); facets.add(`${participant.layer.key}\u0000${participant.facet}`);
  }
  if (typeof binding.authority !== 'string') fail(binding.authority && typeof binding.authority === 'object' ? `A binding has one authority. ${refaceted}` : 'A binding needs an authority.');
  const hub = participantOf(binding, binding.authority);
  if (!hub) fail(`The authority ${binding.authority} is not a participant.`);
  if (hub.role !== 'authority') fail(`${hub.id} holds authority, so its role is authority.`);
  for (const participant of binding.participants)
    if (participant.role === 'authority' && participant.id !== hub.id) fail(`${participant.id} is marked authority but ${hub.id} holds it.`);
  binding.correspondence = binding.correspondence || [];
  binding.detached = binding.detached || [];
  const entryKeys = new Set();
  // A detached entry holds, per participant, every ref it still publishes under the key: { key, refs: { [id]: [refs] } }.
  for (const entry of binding.detached)
    if (!entry?.refs || typeof entry.refs !== 'object' || Object.values(entry.refs).some(refs => !Array.isArray(refs) || !refs.every(ref => typeof ref === 'string'))) fail('Invalid detached entry.');
  for (const entry of [...binding.correspondence, ...binding.detached]) {
    if (!entry || typeof entry.key !== 'string' || !entry.key || entryKeys.has(entry.key) || !entry.refs || typeof entry.refs !== 'object') fail('Invalid correspondence entry.');
    if (entry.area !== undefined) fail(`Correspondence ${entry.key} names an area. ${refaceted}`);
    if (Object.keys(entry.refs).some(id => !ids.has(id))) fail(`Correspondence ${entry.key} names an unknown participant.`);
    entryKeys.add(entry.key);
  }
  binding.baseline = binding.baseline || {};
  binding.policy = binding.policy || {};
  for (const [id, policy] of Object.entries(binding.policy)) {
    if (!ids.has(id)) fail(`Policy names an unknown participant: ${id}.`);
    for (const [event, response] of Object.entries(policy || {})) {
      if (event === 'drift') {
        if (!response || typeof response !== 'object' || Object.entries(response).some(([kind, value]) => !events.includes(kind) || !driftResponses.includes(value))) fail(`Invalid drift policy for ${id}.`);
      } else if (!events.includes(event) || !responses.includes(response)) fail(`Invalid policy for ${id}.`);
    }
  }
  binding.adapters = binding.adapters || [];
  for (const adapter of binding.adapters) {
    if (!adapter || !keyPattern.test(adapter.id || '') || !ids.has(adapter.participant) || !text(adapter.reads, 80)) fail('Invalid adapter.');
    if (typeof adapter.mechanical !== 'boolean' || typeof adapter.soft !== 'boolean' || (!adapter.mechanical && !adapter.soft)) fail(`Adapter ${adapter.id} needs a mechanical or soft part.`);
  }
  return binding;
}

// For one spoke, the adapter it owns that reads its hub's own shape, or null: then the spoke's layer has an adapter to write.
export function adapterFor(binding, participantId, hubId) {
  const hub = participantOf(binding, hubId);
  return binding.adapters.filter(adapter => adapter.participant === participantId && adapter.reads === hub?.shape)
    .sort((a, b) => a.id.localeCompare(b.id))[0] || null;
}
// Which hub every spoke reads from, and through which adapter.
export function wiring(input) {
  const binding = validateBinding(input);
  return binding.participants.filter(participant => participant.role !== 'ceded' && participant.id !== binding.authority)
    .map(participant => ({ participant: participant.id, hub: binding.authority, adapter: adapterFor(binding, participant.id, binding.authority)?.id || null }))
    .sort((a, b) => a.participant.localeCompare(b.participant));
}

// Every participant but the hub. A ceded participant takes nothing from the hub; it offers its own content once, on its
// first reconcile with that hub, and is read-only history after that.
const spokesOf = (binding, hub) => binding.participants.filter(participant => participant.id !== hub);
const taking = (binding, hub) => [hub, ...spokesOf(binding, hub).filter(spoke => spoke.role !== 'ceded').map(spoke => spoke.id)].sort();

// Snapshots: { [participantId]: [{ ref, key, revision, digest?, kind? }] } — the participant's current facet entries from the
// Library. `key` is the concept key the participant's adapter derives (a token name, a route), so new entries match across
// participants mechanically; `digest` is the entry in the concept's comparable form, so equal content needs no Work.
// Returns the correspondence with any new entries, what is still detached, the actions, and a status per entry.
export function evaluate(input, snapshots = {}) {
  const binding = validateBinding(input);
  const byRef = {};
  for (const participant of binding.participants) {
    byRef[participant.id] = new Map();
    for (const entry of snapshots[participant.id] || []) {
      if (!entry || typeof entry.ref !== 'string' || !Number.isInteger(entry.revision)) fail(`Invalid snapshot entry for ${participant.id}.`);
      byRef[participant.id].set(entry.ref, entry);
    }
  }
  // Entries a refacet took out of a participant's facet are detached: the binding holds them, for every participant, until
  // none still publishes them, so a refacet on one side never reads as a removal or an offer on the other.
  const detached = binding.detached.map(entry => ({ key: entry.key, refs: Object.fromEntries(Object.entries(entry.refs).map(([id, refs]) => [id, [...refs]])) }));
  const detachedKey = new Map(detached.map(entry => [entry.key, entry]));
  const held = new Set(detached.flatMap(entry => Object.entries(entry.refs).flatMap(([id, refs]) => refs.map(ref => `${id}\u0000${ref}`))));
  // Correspondence: the binding's entries, then unmatched snapshot entries joined by concept key.
  const correspondence = binding.correspondence.map(entry => ({ ...entry, refs: { ...entry.refs } }));
  const claimed = new Set(correspondence.flatMap(entry => Object.entries(entry.refs).map(([id, ref]) => `${id}\u0000${ref}`)));
  for (const participant of [...binding.participants].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const entry of [...byRef[participant.id].values()].sort((a, b) => a.ref.localeCompare(b.ref))) {
      const pair = `${participant.id}\u0000${entry.ref}`;
      if (claimed.has(pair) || held.has(pair)) continue;
      const key = entry.key || `${participant.id}:${entry.ref}`;
      if (detachedKey.has(key)) { (detachedKey.get(key).refs[participant.id] ||= []).push(entry.ref); continue; }
      let target = correspondence.find(item => item.key === key);
      if (target && own(target.refs, participant.id)) fail(`Two ${participant.id} entries share the concept key ${key}.`);
      if (!target) { target = { key, refs: {}, matched: 'key' }; correspondence.push(target); }
      target.refs[participant.id] = entry.ref;
    }
  }
  correspondence.sort((a, b) => a.key.localeCompare(b.key));
  for (const entry of detached) for (const [id, refs] of Object.entries(entry.refs)) {
    const still = refs.filter(ref => byRef[id]?.has(ref)).sort();
    if (still.length) entry.refs[id] = still; else delete entry.refs[id];
  }
  const holding = detached.filter(entry => Object.keys(entry.refs).length).sort((a, b) => a.key.localeCompare(b.key));

  const actions = [], status = [];
  const hubId = binding.authority, hub = participantOf(binding, hubId);
  const current = (id, entry) => own(entry.refs, id) ? byRef[id].get(entry.refs[id]) || null : null;
  const same = (a, b) => (!a && !b) || (!!a && !!b && typeof a.digest === 'string' && a.digest === b.digest);
  const action = (kind, entry, fields) => {
    const body = { kind, entry: entry.key, ...fields };
    body.id = `bnd-${hash([binding.id || '', kind, entry.key, fields.target, fields.from || [], fields.revisions])}`;
    actions.push(body);
  };
  // A read-only authority takes no Work. What would go to it instead brings each replica back to it, and a ceded
  // participant's content stays as its history.
  const toReadOnlyHub = (entry, items, h, reason) => {
    for (const item of items) {
      const settles = [{ entry: entry.key, participant: item.spoke.id }];
      if (item.spoke.role === 'ceded') action('ignored', entry, { target: item.spoke.id, layer: item.spoke.layer.key, reason, revisions: item.revisions, settles, auto: true });
      else action('rectify', entry, { target: item.spoke.id, layer: item.spoke.layer.key, from: [hubId], event: !h ? 'removed' : item.s ? 'changed' : 'added', drift: !item.first, work: true,
        revisions: item.revisions, settles, ...(adapterFor(binding, item.spoke.id, hubId) ? { adapter: adapterFor(binding, item.spoke.id, hubId).id } : {}) });
    }
  };
  const adapterWork = new Map();
  for (const entry of correspondence) {
    const h = current(hubId, entry);
    const offers = [], conflicts = [], first = [];
    let pending = false;
    for (const spoke of spokesOf(binding, hubId)) {
      const s = current(spoke.id, entry);
      const recorded = binding.baseline[entry.key]?.[spoke.id];
      const synced = !!recorded && recorded.hub === hubId;
      if (spoke.role === 'ceded' && (synced || !s)) continue;
      const base = synced ? recorded : { hubRevision: null, self: null };
      const hubMoved = (h?.revision ?? null) !== base.hubRevision, selfMoved = (s?.revision ?? null) !== base.self;
      const revisions = { hub: h?.revision ?? null, self: s?.revision ?? null };
      const settles = [{ entry: entry.key, participant: spoke.id }];
      if (!hubMoved && !selfMoved) continue;
      if (!synced) first.push(spoke.id);
      if ((hubMoved && selfMoved) || (!h && !s)) {
        if (same(h, s)) { action('ignored', entry, { target: spoke.id, layer: spoke.layer.key, reason: !h ? 'absent on both' : 'already equal', revisions, settles, auto: true }); continue; }
        conflicts.push({ spoke, s, revisions, first: !synced }); continue;
      }
      if (selfMoved) { offers.push({ spoke, s, revisions, first: !synced }); continue; }
      // The hub moved and this spoke did not: the receiving participant's policy decides.
      const event = !h ? 'removed' : s ? 'changed' : 'added';
      const response = binding.policy[spoke.id]?.[event] || 'propagate';
      const common = { target: spoke.id, layer: spoke.layer.key, from: [hubId], event, revisions, settles };
      if (response === 'ignore') { action('ignored', entry, { ...common, reason: 'policy', auto: true }); continue; }
      pending = true;
      if (response === 'flag') { action('review', entry, { ...common, work: true }); continue; }
      const adapter = adapterFor(binding, spoke.id, hubId);
      if (!adapter) {
        if (!adapterWork.has(spoke.id)) adapterWork.set(spoke.id, { spoke, entries: [] });
        adapterWork.get(spoke.id).entries.push(entry.key);
        continue;
      }
      // Mechanical parts apply automatically and are recorded on the binding; soft parts are Work in the receiving layer.
      if (adapter.mechanical) action('apply', entry, { ...common, adapter: adapter.id, auto: true, settles: adapter.soft ? [] : settles });
      if (adapter.soft) action('import', entry, { ...common, adapter: adapter.id, work: true });
    }
    // Content only a spoke holds at its first reconcile goes to the hub as adopt Work. A spoke's later change is drift, which
    // its drift policy handles. Several spokes with different content, or a spoke and the hub both moving, is a conflict a
    // person decides (a combine on first reconcile).
    const disagree = offers.length > 1 && !offers.every(offer => same(offer.s, offers[0].s));
    if (conflicts.length || disagree) {
      const involved = [...conflicts, ...offers].sort((a, b) => a.spoke.id.localeCompare(b.spoke.id));
      if (hub.readOnly) toReadOnlyHub(entry, involved, h, 'the authority is read-only');
      else action(involved.every(item => item.first) ? 'combine' : 'conflict', entry, { target: hubId, layer: hub.layer.key, from: involved.map(item => item.spoke.id), work: true,
        revisions: { hub: h?.revision ?? null, ...Object.fromEntries(involved.map(item => [item.spoke.id, item.revisions.self])) },
        settles: involved.map(item => ({ entry: entry.key, participant: item.spoke.id })) });
      pending = true;
    } else if (offers.length) {
      const sorted = [...offers].sort((a, b) => a.spoke.id.localeCompare(b.spoke.id));
      const event = !sorted[0].s ? 'removed' : h ? 'changed' : 'added';
      const fields = { event, revisions: { hub: h?.revision ?? null, ...Object.fromEntries(sorted.map(item => [item.spoke.id, item.revisions.self])) } };
      const toHub = { target: hubId, layer: hub.layer.key, from: sorted.map(item => item.spoke.id), settles: sorted.map(item => ({ entry: entry.key, participant: item.spoke.id })) };
      const drift = sorted.every(item => !item.first);
      const chosen = new Set(sorted.map(item => binding.policy[item.spoke.id]?.drift?.[event] || 'assess'));
      const response = hub.readOnly ? 'read-only' : !drift ? 'adopt' : chosen.size === 1 ? [...chosen][0] : 'assess';
      if (response === 'read-only') toReadOnlyHub(entry, sorted, h, 'the authority is read-only');
      else if (response === 'adopt') {
        // Adopting goes through the authority's own adapter for the offering shape. Drift it can read mechanically applies on
        // its own; a first reconcile's content is always reviewed, since it is a draft of the authority's own entries.
        const reverse = adapterFor(binding, hubId, sorted[0].spoke.id);
        if (drift && reverse?.mechanical && !reverse.soft) action('apply', entry, { ...toHub, ...fields, drift, toAuthority: true, adapter: reverse.id, auto: true });
        else action('adopt', entry, { ...toHub, ...fields, drift, first: !drift, work: true, ...(reverse ? { adapter: reverse.id } : {}) });
      } else if (response === 'rectify') {
        for (const item of sorted) action('rectify', entry, { target: item.spoke.id, layer: item.spoke.layer.key, from: [hubId], event, drift: true, work: true,
          revisions: { hub: h?.revision ?? null, self: item.revisions.self }, settles: [{ entry: entry.key, participant: item.spoke.id }],
          ...(adapterFor(binding, item.spoke.id, hubId) ? { adapter: adapterFor(binding, item.spoke.id, hubId).id } : {}) });
      } else action('assess', entry, { ...toHub, ...fields, target: 'work', layer: 'work', authority: hubId, drift: true, work: true, options: ['adopt', 'rectify'] });
      pending = true;
    }
    // A replica that ignores additions (a narrow copy, such as a name and mark) is not missing what it never takes.
    const takers = taking(binding, hubId).filter(id => id === hubId || current(id, entry) || binding.policy[id]?.added !== 'ignore');
    const missing = takers.filter(id => !current(id, entry));
    status.push({ key: entry.key, authority: hubId,
      state: pending ? 'diverged' : missing.length === takers.length ? 'absent' : missing.length ? 'missing' : 'matched', missingIn: missing });
  }
  for (const entry of holding) status.push({ key: entry.key, authority: hubId, state: 'detached', missingIn: [], holding: Object.keys(entry.refs).sort() });
  status.sort((a, b) => a.key.localeCompare(b.key));
  // One adapter to write per spoke, listing the entries waiting on it.
  for (const { spoke, entries } of [...adapterWork.values()].sort((a, b) => a.spoke.id.localeCompare(b.spoke.id)))
    action('adapter', { key: entries[0] }, { target: spoke.id, layer: spoke.layer.key, from: [hubId], reads: hub.shape, entries, work: true, revisions: null, settles: [] });
  const rank = kind => actionKinds.indexOf(kind);
  actions.sort((a, b) => a.entry.localeCompare(b.entry) || rank(a.kind) - rank(b.kind) || a.target.localeCompare(b.target));
  return { correspondence: correspondence.map(({ matched, ...entry }) => entry), detached: holding, proposed: correspondence.filter(entry => entry.matched).map(entry => entry.key),
    actions, status, wiring: wiring(binding) };
}

// Records agreement for spokes of entries: their own and their hub's current revisions become the baseline. The caller
// settles an automatic action once it is applied, and a Work action's spokes when that Work closes. `outcome: 'hub'` settles
// a spoke whose content lost (a change sent back, or a conflict decided for the hub's side): the spoke has yet to take the
// hub's version, so its hub revision is recorded as 0, which no real revision equals, and the next evaluation sends it.
export function settle(input, settlements, snapshots = {}, correspondence = null) {
  const binding = validateBinding({ ...input, correspondence: correspondence || input.correspondence });
  const revision = (id, entry) => (snapshots[id] || []).find(item => item.ref === entry.refs[id])?.revision ?? null;
  const hub = binding.authority;
  for (const { entry: key, participant, outcome = 'agreed' } of settlements) {
    if (!['agreed', 'hub'].includes(outcome)) fail('Settle as agreed, or for the hub.');
    const entry = binding.correspondence.find(item => item.key === key) || fail(`Unknown correspondence entry ${key}.`);
    if (participant === hub || !participantOf(binding, participant)) fail(`Only a spoke settles (${participant}).`);
    binding.baseline[key] = { ...binding.baseline[key], [participant]: { hub, hubRevision: outcome === 'hub' ? 0 : revision(hub, entry), self: revision(participant, entry) } };
  }
  return binding;
}

// An assessment of drift is decided: adopt it into the authority, or rectify the drifted participants. Returns the Work that
// follows, with the assessment's settlements, so the caller raises it in place of the closed assessment.
export function decide(input, assessment, decision) {
  const binding = validateBinding(input);
  if (assessment?.kind !== 'assess') fail('Only an assessment is decided.');
  if (!['adopt', 'rectify'].includes(decision)) fail('Decide adopt or rectify.');
  const hub = participantOf(binding, assessment.authority);
  if (!hub || hub.id !== binding.authority) fail('The authority changed. Evaluate the binding again.', 409);
  const id = (kind, target) => `bnd-${hash([assessment.id, decision, kind, target])}`;
  if (decision === 'adopt') return [{ kind: 'adopt', entry: assessment.entry, target: hub.id, layer: hub.layer.key, from: assessment.from, event: assessment.event,
    drift: true, work: true, revisions: assessment.revisions, settles: assessment.settles, decidedFrom: assessment.id, id: id('adopt', hub.id) }];
  return assessment.from.map(spokeId => {
    const spoke = participantOf(binding, spokeId) || fail(`${spokeId} left the binding.`, 409);
    return { kind: 'rectify', entry: assessment.entry, target: spoke.id, layer: spoke.layer.key, from: [hub.id], event: assessment.event, drift: true, work: true,
      revisions: { hub: assessment.revisions.hub, self: assessment.revisions[spoke.id] ?? null }, settles: [{ entry: assessment.entry, participant: spoke.id }],
      decidedFrom: assessment.id, id: id('rectify', spoke.id), ...(adapterFor(binding, spoke.id, hub.id) ? { adapter: adapterFor(binding, spoke.id, hub.id).id } : {}) };
  });
}

// A participant joins. It starts with no baseline, so the next evaluation is its first reconcile against the hub.
export function join(input, participant, { policy = null, adapters = [] } = {}) {
  const binding = validateBinding(input);
  if (participant?.role === 'authority') fail('Join as a replica or ceded participant, then transfer authority.');
  return validateBinding({ ...binding, participants: [...binding.participants, participant],
    policy: policy ? { ...binding.policy, [participant.id]: policy } : binding.policy, adapters: [...binding.adapters, ...adapters] });
}

// Authority moves to another participant. The previous authority must be given its new role. Every spoke now reads the new
// hub; their old baselines no longer apply, so the next evaluation is a first reconcile, in which a ceded participant
// offers its content once. A ceded facet may take authority back (a merge reversing a cede); its history is what it offers.
export function transfer(input, { to, roles: changes = {}, ...rest }) {
  const binding = validateBinding(input);
  if (own(rest, 'area') || own(rest, 'keeps')) fail(`Authority moves for the whole binding. ${refaceted}`);
  participantOf(binding, to) || fail(`${to} is not a participant.`);
  const previous = binding.authority;
  if (previous === to) fail(`${to} already holds authority.`);
  if (!own(changes, previous)) fail(`Give ${previous} its new role: replica or ceded.`);
  const participants = binding.participants.map(participant => {
    const role = participant.id === to ? 'authority' : own(changes, participant.id) ? changes[participant.id] : participant.role;
    if (participant.id !== to && role === 'authority') fail(`${participant.id} no longer holds authority.`);
    return { ...participant, role };
  });
  return validateBinding({ ...binding, participants, authority: to, lifecycle: binding.lifecycle === 'active' ? 'reconciling' : binding.lifecycle });
}

export function transition(input, lifecycle) {
  const binding = validateBinding(input);
  if (!lifecycleTransitions[binding.lifecycle].includes(lifecycle)) fail(`A ${binding.lifecycle} binding cannot become ${lifecycle}.`, 409);
  return { ...binding, lifecycle };
}

// ---- Roles: what an entry is in this project ----

const live = binding => binding.lifecycle !== 'retired';
// The live binding a layer's facet takes part in, or null. A facet takes part in at most one: a facet that would straddle
// two authorities is refaceted into two facets, one per binding.
export function bindingOf(bindings, layerKey, facetKey) {
  const found = bindings.filter(live).filter(binding => binding.participants.some(p => p.layer.key === layerKey && p.facet === facetKey));
  if (found.length > 1) fail(`${layerKey}'s ${facetKey} takes part in ${found.map(binding => binding.id).sort().join(' and ')}. Refacet it so each part has one binding.`, 409);
  return found[0] || null;
}
// What an entry is: its facet, that facet's role in its live binding, and where its authority is. Null when the entry is in
// no facet (the layer's own business); role null when its facet is unbound. Views and the host's write guard read this.
export function roleOf(layer, entry, bindings = []) {
  const facets = layer.facets[0]?.select ? layer.facets : validateFacets({ key: layer.key, outputs: layer.outputs, facets: layer.facets });
  const facet = facetOf(facets, entry);
  if (!facet) return null;
  const binding = bindingOf(bindings, layer.key, facet);
  if (!binding) return { facet, role: null, binding: null, authority: null };
  const self = binding.participants.find(p => p.layer.key === layer.key && p.facet === facet);
  const hub = participantOf(binding, binding.authority);
  return { facet, role: self.role, binding: binding.id ?? null, authority: { participant: hub.id, layer: hub.layer.key, facet: hub.facet } };
}

// ---- Refaceting: reshaping a layer's facets ----

// Whether clause `part` selects only entries that `whole` selects, and what remains of `whole` once `part` is taken out.
function contains(whole, part) {
  if (whole.kind !== part.kind) return false;
  if (!whole.where) return true;
  if (!part.where || part.where.field !== whole.where.field) return false;
  if (whole.where.in) return !!part.where.in && part.where.in.every(value => whole.where.in.includes(value));
  return part.where.in ? part.where.in.every(value => !whole.where.notIn.includes(value)) : whole.where.notIn.every(value => part.where.notIn.includes(value));
}
function subtract(whole, part) {
  const where = (op, values) => values.length ? [{ kind: whole.kind, where: { field: part.where.field, [op]: order(values) } }] : [];
  if (!part.where) return [];
  if (!whole.where) return part.where.in ? where('notIn', part.where.in) : where('in', part.where.notIn);
  if (whole.where.in) return where('in', whole.where.in.filter(value => !part.where.in.includes(value)));
  if (part.where.in) return where('notIn', [...whole.where.notIn, ...part.where.in]);
  return where('in', part.where.notIn.filter(value => !whole.where.notIn.includes(value)));
}
// The union of two facets' clauses, folded per kind: valid facets select each kind whole, or by one field.
function union(a, b) {
  const byKind = new Map();
  for (const clause of [...a, ...b]) {
    const prior = byKind.get(clause.kind);
    if (!prior) { byKind.set(clause.kind, clause); continue; }
    if (!prior.where || !clause.where) { byKind.set(clause.kind, { kind: clause.kind }); continue; }
    if (prior.where.field !== clause.where.field) fail(`${clause.kind} is narrowed by two fields; merge needs one.`);
    const [x, y] = [prior.where, clause.where];
    let next;
    if (x.in && y.in) next = { in: order([...x.in, ...y.in]) };
    else { const [only, except] = x.in ? [x.in, y.notIn] : y.in ? [y.in, x.notIn] : [null, null];
      const rest = except ? except.filter(value => !only.includes(value)) : order(x.notIn.filter(value => y.notIn.includes(value)));
      next = rest.length ? { notIn: rest } : null; }
    byKind.set(clause.kind, next ? { kind: clause.kind, where: { field: x.field, ...next } } : { kind: clause.kind });
  }
  return [...byKind.values()];
}
const declaration = (facet, outputs) => {
  const { kinds, ...rest } = facet;
  return { ...rest, select: declaredSelect(facet, outputs) };
};

// A refacet changes one layer instance's facet declarations: split part of a facet into a new one, merge one facet into
// another, or retitle one. It arrives as a reviewed change to the layer's own repository; this computes the new
// declarations, how live bindings follow, and the preflight its Work item shows. Bindings follow keys: the facet that keeps
// its key keeps its bindings and role. A split-off facet starts unbound, or joins one named binding in a role it supports.
//   layer:   { key, outputs, facets }   (as in layer.json; key is the instance's layer key)
//   change:  { op: 'split', facet, into: { key, title, take: [clauses], roles?, views?, hints?, shape? }, join?: { binding, id, role } }
//          | { op: 'merge', facet, from }   | { op: 'rename', facet, title }
//   context: { entries: [{ ref, kind, data }], bindings: [binding], references: [{ layer, entry, to }] }
export function refacet(layer, change, { entries = [], bindings = [], references = [] } = {}) {
  if (!layer || !Array.isArray(layer.facets) || !/^[a-z][a-z0-9_]{1,31}$/.test(layer.key || '')) fail('Refacet one installed layer.');
  const outputs = layer.outputs || [];
  const manifest = facets => ({ key: layer.key, outputs, tabs: (layer.tabs || []), facets });
  const before = validateFacets(manifest(layer.facets));
  const declared = layer.facets.map(facet => declaration(facet, outputs));
  const index = declared.findIndex(facet => facet.key === change?.facet);
  if (index < 0) fail(`${layer.key} declares no ${change?.facet} facet.`);
  const parent = declared[index];
  let after, moved = [], into = null, joined = null;

  if (change.op === 'rename') {
    if (!text(change.title, 80)) fail('Give the facet a title.');
    after = declared.map(facet => facet.key === parent.key ? { ...facet, title: change.title.trim() } : facet);
  } else if (change.op === 'split') {
    const spec = change.into || {};
    if (!keyPattern.test(spec.key || '') || declared.some(facet => facet.key === spec.key)) fail('Name the new facet with a key this layer does not use.');
    if (!Array.isArray(spec.take) || !spec.take.length) fail('Name the part of the facet that becomes the new one.');
    // A clause without `where` takes the kind as the facet holds it, however the facet narrows it.
    const take = spec.take.map(clause => normalClause(clause, outputs, spec.key))
      .map(part => part.where ? part : parent.select.find(whole => whole.kind === part.kind) || part);
    let rest = parent.select;
    for (const part of take) {
      const at = rest.findIndex(whole => contains(whole, part));
      if (at < 0) fail(`${parent.key} does not select all of ${part.kind}${part.where ? ` where ${part.where.field} ${part.where.in ? 'in' : 'not in'} ${JSON.stringify(part.where.in || part.where.notIn)}` : ''}.`);
      rest = [...rest.slice(0, at), ...subtract(rest[at], part), ...rest.slice(at + 1)];
    }
    if (!rest.length) fail(`That takes all of ${parent.key}. Rename the facet instead of splitting it.`);
    into = { key: spec.key, title: spec.title, select: take, roles: spec.roles || [...parent.roles],
      ...(spec.views ? { views: spec.views } : {}), ...(spec.hints ? { hints: spec.hints } : {}), ...(spec.shape ? { shape: spec.shape } : {}),
      ...(parent.readOnly ? { readOnly: true } : {}) };
    after = [...declared.slice(0, index), { ...parent, select: rest, ...(spec.views ? { views: (parent.views || []).filter(view => !spec.views.includes(view)) } : {}) }, into, ...declared.slice(index + 1)];
  } else if (change.op === 'merge') {
    const from = declared.find(facet => facet.key === change.from);
    if (!from || from.key === parent.key) fail(`${layer.key} declares no other facet ${change.from} to merge.`);
    const bound = bindings.filter(live).filter(binding => binding.participants.some(p => p.layer.key === layer.key && p.facet === from.key));
    if (bound.length) fail(`${from.key} takes part in ${bound.map(binding => binding.id).sort().join(', ')}. Transfer or retire that binding before merging it.`, 409);
    after = declared.filter(facet => facet.key !== from.key).map(facet => facet.key !== parent.key ? facet : { ...facet, select: union(parent.select, from.select),
      ...(parent.views || from.views ? { views: [...new Set([...(parent.views || []), ...(from.views || [])])] } : {}) });
  } else fail('Refacet by split, merge or rename.');

  const next = validateFacets(manifest(after));
  // Every entry that was in a facet is still in exactly one, and only the facets named by the change gain or lose entries.
  const was = assignFacets(before, entries), now = assignFacets(next, entries);
  const facetNow = new Map(entries.map(entry => [entry.ref, facetOf(next, entry)])), facetWas = new Map(entries.map(entry => [entry.ref, facetOf(before, entry)]));
  for (const entry of entries) {
    const a = facetWas.get(entry.ref), b = facetNow.get(entry.ref);
    if (a === b) continue;
    const allowed = change.op === 'split' ? a === parent.key && b === into.key : change.op === 'merge' && a === change.from && b === parent.key;
    if (!allowed) fail(`The refacet would move ${entry.ref} from ${a ?? 'no facet'} to ${b ?? 'no facet'}.`, 500);
    moved.push({ ref: entry.ref, kind: entry.kind, from: a, to: b });
  }
  moved.sort((a, b) => a.ref.localeCompare(b.ref));
  const movedRefs = new Set(moved.map(item => item.ref));

  // Live bindings of the facet entries leave: those entries are detached there, and each other participant still holding
  // them is named, since its layer should refacet too. A merge brings entries into the kept facet's bindings as new.
  const changed = [], follow = [];
  for (const binding of bindings) {
    if (!live(binding)) continue;
    const self = binding.participants.find(p => p.layer.key === layer.key && p.facet === parent.key);
    if (!self || change.op !== 'split') continue;
    const leaving = binding.correspondence.filter(entry => movedRefs.has(entry.refs[self.id]));
    if (!leaving.length) continue;
    const keys = new Set(leaving.map(entry => entry.key));
    const baseline = Object.fromEntries(Object.entries(binding.baseline || {}).filter(([key]) => !keys.has(key)));
    changed.push(validateBinding({ ...binding, correspondence: binding.correspondence.filter(entry => !keys.has(entry.key)),
      detached: [...(binding.detached || []), ...leaving.map(entry => ({ key: entry.key, refs: Object.fromEntries(Object.entries(entry.refs).filter(([id]) => id !== self.id).map(([id, ref]) => [id, [ref]])) }))], baseline }));
    for (const other of binding.participants.filter(p => p.id !== self.id)) {
      const refs = leaving.filter(entry => own(entry.refs, other.id)).map(entry => entry.refs[other.id]).sort();
      if (refs.length) follow.push({ binding: binding.id ?? null, participant: other.id, layer: other.layer.key, facet: other.facet, role: other.role, refs });
    }
  }
  if (change.op === 'split' && change.join) {
    const target = (changed.find(binding => binding.id === change.join.binding) || bindings.find(binding => binding.id === change.join.binding));
    if (!target || !live(target)) fail(`No live binding ${change.join.binding} to join.`, 404);
    if (!into.roles.includes(change.join.role)) fail(`${into.key} does not support ${change.join.role}.`);
    joined = join(target, { id: change.join.id, layer: { key: layer.key }, facet: into.key, role: change.join.role, shape: into.shape || `${layer.key}.${into.key}` });
    const at = changed.findIndex(binding => binding.id === joined.id);
    if (at >= 0) changed[at] = joined; else changed.push(joined);
  }
  follow.sort((a, b) => String(a.binding).localeCompare(String(b.binding)) || a.participant.localeCompare(b.participant));

  const byKind = {};
  for (const item of moved) byKind[item.kind] = (byKind[item.kind] || 0) + 1;
  const bindingsOf = key => bindings.filter(live).filter(binding => binding.participants.some(p => p.layer.key === layer.key && p.facet === key)).map(binding => binding.id ?? null).sort();
  const preflight = {
    change: change.op, layer: layer.key,
    records: moved, byKind,
    facets: next.map(facet => ({ key: facet.key, title: facet.title, entries: now[facet.key].length,
      bindings: facet.key === into?.key ? (joined ? [joined.id ?? null] : []) : bindingsOf(facet.key) })),
    bindings: changed.map(binding => ({ binding: binding.id ?? null, detached: binding.detached.map(entry => entry.key).sort() })),
    follow,
    references: references.filter(reference => movedRefs.has(reference.to)).map(reference => ({ layer: reference.layer, entry: reference.entry, to: reference.to }))
      .sort((a, b) => a.layer.localeCompare(b.layer) || a.entry.localeCompare(b.entry) || a.to.localeCompare(b.to)),
    unchanged: entries.length - moved.length, inNoFacet: { before: was.null.length, after: now.null.length }
  };
  return { facets: after, bindings: changed, preflight };
}

// Once a ceded participant's content has been adopted, each of its entries has a counterpart in the authority. References
// other layers hold to the ceded entries are re-pointed by Work in each referencing layer; a layer whose references cannot
// name the authority's kind gets adapter Work instead (the host-kind reference model running out). References to entries
// not adopted yet wait.
//   references: [{ layer, entry, to }]; accepts: { [layerKey]: [kinds] | '*' }; snapshots: the authority's entries, with kind.
export function repoint(input, { from, references = [], accepts = {}, snapshots = {} }) {
  const binding = validateBinding(input);
  const ceded = participantOf(binding, from);
  if (!ceded || ceded.role !== 'ceded') fail(`${from} is not a ceded participant.`);
  const hub = participantOf(binding, binding.authority);
  const hubEntries = new Map((snapshots[hub.id] || []).map(entry => [entry.ref, entry]));
  const pairs = new Map();
  for (const entry of binding.correspondence) {
    const target = hubEntries.get(entry.refs[hub.id]);
    if (own(entry.refs, ceded.id) && target) pairs.set(entry.refs[ceded.id], { to: target.ref, kind: target.kind ?? null });
  }
  const byLayer = new Map(), waiting = [];
  for (const reference of [...references].sort((a, b) => a.layer.localeCompare(b.layer) || a.entry.localeCompare(b.entry) || a.to.localeCompare(b.to))) {
    const pair = pairs.get(reference.to);
    if (!pair) { waiting.push({ layer: reference.layer, entry: reference.entry, to: reference.to }); continue; }
    const kinds = accepts[reference.layer];
    const can = kinds === '*' || (Array.isArray(kinds) && pair.kind !== null && kinds.includes(pair.kind));
    if (!byLayer.has(reference.layer)) byLayer.set(reference.layer, { repoint: [], adapter: [] });
    byLayer.get(reference.layer)[can ? 'repoint' : 'adapter'].push({ entry: reference.entry, from: reference.to, to: pair.to, kind: pair.kind });
  }
  const actions = [];
  for (const [layer, { repoint: moves, adapter }] of byLayer) {
    if (moves.length) actions.push({ kind: 'repoint', target: layer, layer, from: [hub.id], pairs: moves, work: true, id: `bnd-${hash([binding.id || '', 'repoint', layer, moves])}` });
    if (adapter.length) actions.push({ kind: 'adapter', target: layer, layer, from: [hub.id], reads: hub.shape, references: adapter,
      reason: `${layer}'s references cannot name ${[...new Set(adapter.map(item => item.kind))].join(', ')}`, work: true, id: `bnd-${hash([binding.id || '', 'repoint-adapter', layer, adapter])}` });
  }
  return { actions, waiting };
}
