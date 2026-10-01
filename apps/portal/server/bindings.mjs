// LAYER-BINDINGS-01: how layers share what they know. A binding is a project-level record for one shared concept (the app's
// design system, its user journeys) with any number of participating facets. This module is the contract's pure core: it
// validates facets and bindings, and evaluates a binding against what each participant currently publishes, returning the
// automatic changes and the Work it calls for. It reads and writes nothing; the caller applies its results.
//
// Hub, not mesh: every non-authority participant is a spoke of the authority for an entry's area. A spoke's baseline holds
// its own revision and the hub's at the last agreed sync, so each spoke is a three-way merge against the hub. Moving
// authority changes the hub, which voids those baselines, so the next evaluation is that spoke's first reconcile.
// Adapters belong to the receiving participant and name the source shape they read; a spoke's active adapter is the one
// that reads its current hub's shape, so a transfer re-points adapters without anyone rewiring them.
//
// Direction is always from the authority, but any participant may still change outside the binding (a commit made without
// the normal process). That is drift. The binding's drift policy for that participant and event decides: adopt it into the
// authority (automatically when the authority owns a mechanical adapter for the drifted shape), rectify the participant
// with Work, or have the drift assessed as Work, which then decides one or the other.
import { createHash } from 'node:crypto';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const own = Object.hasOwn;
const keyPattern = /^[a-z][a-z0-9-]{0,62}$/;
const shapePattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

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

// A layer's facets (layer.json `facets`): coherent bodies of knowledge it maintains and publishes to the Library, and the
// roles each can take in a binding. Nothing here requires a facet type; `hints` only help discovery.
export function validateFacets(manifest) {
  const facets = manifest?.facets;
  if (facets === undefined) return [];
  const outputs = Array.isArray(manifest.outputs) ? manifest.outputs : [];
  const tabs = new Set((manifest.tabs || []).map(tab => tab.key));
  if (!Array.isArray(facets) || facets.length > 20) fail('Invalid layer facets.');
  const keys = new Set(), kinds = new Set();
  for (const facet of facets) {
    if (!facet || !keyPattern.test(facet.key) || keys.has(facet.key) || !text(facet.title, 80)) fail('Invalid layer facet.');
    if (!Array.isArray(facet.kinds) || !facet.kinds.length || !facet.kinds.every(kind => outputs.includes(kind) && !kinds.has(kind)))
      fail(`Facet ${facet.key} must publish this layer's own output kinds, each in one facet.`);
    if (!Array.isArray(facet.roles) || !facet.roles.length || !facet.roles.every(role => roles.includes(role)) || new Set(facet.roles).size !== facet.roles.length)
      fail(`Facet ${facet.key} must name the roles it supports.`);
    if (facet.views !== undefined && (!Array.isArray(facet.views) || !facet.views.every(view => tabs.has(view)))) fail(`Facet ${facet.key} names a view that is not a tab.`);
    if (facet.hints !== undefined && (!Array.isArray(facet.hints) || facet.hints.length > 8 || !facet.hints.every(hint => keyPattern.test(hint)))) fail(`Invalid hints on facet ${facet.key}.`);
    if (facet.shape !== undefined && !shapePattern.test(facet.shape)) fail(`Facet ${facet.key} names an invalid shape.`);
    keys.add(facet.key); facet.kinds.forEach(kind => kinds.add(kind));
  }
  return facets.map(facet => ({ key: facet.key, title: facet.title.trim(), kinds: [...facet.kinds], roles: [...facet.roles],
    shape: facet.shape || `${manifest.key}.${facet.key}`, views: [...(facet.views || [])], hints: [...(facet.hints || [])] }));
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

// The authority for an area. `authority` is one participant, or a map from area to participant with `*` as the default.
export function authorityFor(binding, area = null) {
  const map = typeof binding.authority === 'string' ? { '*': binding.authority } : binding.authority;
  return (area !== null && own(map, area) ? map[area] : map['*']) || null;
}
const participantOf = (binding, id) => binding.participants.find(participant => participant.id === id) || null;
const covers = (participant, area) => !participant.areas || area === null || participant.areas.includes(area);

export function validateBinding(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('A binding must be an object.');
  const binding = structuredClone(input);
  if (!text(binding.concept?.name, 120)) fail('Name the concept this binding shares.');
  if (!own(lifecycleTransitions, binding.lifecycle)) fail('Unknown binding lifecycle.');
  if (!Array.isArray(binding.participants) || binding.participants.length < 2) fail('A binding needs at least two participants.');
  const ids = new Set();
  for (const participant of binding.participants) {
    if (!participant || !keyPattern.test(participant.id) || ids.has(participant.id)) fail('Invalid or duplicate participant.');
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(participant.layer?.key || '')) fail(`Participant ${participant.id} needs a layer.`);
    if (!keyPattern.test(participant.facet || '')) fail(`Participant ${participant.id} needs a facet.`);
    if (!roles.includes(participant.role)) fail(`Participant ${participant.id} has an unknown role.`);
    if (!text(participant.shape, 80)) fail(`Participant ${participant.id} must name the shape it publishes.`);
    if (participant.areas !== undefined && (!Array.isArray(participant.areas) || !participant.areas.length || !participant.areas.every(area => keyPattern.test(area))))
      fail(`Invalid areas on ${participant.id}.`);
    // A replica keeps only the subset its adapter imports; the rest of its facet is ceded history.
    if (participant.keeps !== undefined && (participant.role !== 'replica' || !Array.isArray(participant.keeps) || !participant.keeps.every(key => typeof key === 'string')))
      fail(`Only a replica keeps a subset (${participant.id}).`);
    ids.add(participant.id);
  }
  const map = typeof binding.authority === 'string' ? { '*': binding.authority } : binding.authority;
  if (!map || typeof map !== 'object' || !Object.keys(map).length) fail('A binding needs an authority.');
  for (const [area, id] of Object.entries(map)) {
    if (area !== '*' && !keyPattern.test(area)) fail('Invalid authority area.');
    const participant = participantOf(binding, id);
    if (!participant) fail(`The authority ${id} is not a participant.`);
    if (participant.role === 'ceded') fail('A ceded facet cannot be an authority.');
    if (!covers(participant, area === '*' ? null : area)) fail(`${id} does not cover ${area}.`);
  }
  for (const participant of binding.participants)
    if (participant.role === 'authority' && !Object.values(map).includes(participant.id)) fail(`${participant.id} is marked authority but holds no area.`);
  binding.correspondence = binding.correspondence || [];
  const entryKeys = new Set();
  for (const entry of binding.correspondence) {
    if (!entry || typeof entry.key !== 'string' || !entry.key || entryKeys.has(entry.key) || !entry.refs || typeof entry.refs !== 'object') fail('Invalid correspondence entry.');
    if (Object.keys(entry.refs).some(id => !ids.has(id))) fail(`Correspondence ${entry.key} names an unknown participant.`);
    if (!authorityFor(binding, entry.area ?? null)) fail(`No authority for ${entry.key}.`);
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
// Which hub every spoke reads from, and through which adapter, for each area it takes part in.
export function wiring(input) {
  const binding = validateBinding(input);
  const map = typeof binding.authority === 'string' ? { '*': binding.authority } : binding.authority;
  return binding.participants.filter(participant => participant.role !== 'ceded').flatMap(participant => Object.entries(map)
    .filter(([area, hub]) => hub !== participant.id && covers(participant, area === '*' ? null : area))
    .map(([area, hub]) => ({ participant: participant.id, area, hub, adapter: adapterFor(binding, participant.id, hub)?.id || null })))
    .sort((a, b) => a.participant.localeCompare(b.participant) || a.area.localeCompare(b.area));
}

// The participants an entry flows to from its hub: not ceded and covering the area. A replica outside what it keeps
// takes nothing from the hub; it only offers its own content once, on its first reconcile with that hub.
const kept = (participant, entry) => !participant.keeps || participant.keeps.includes(entry.key);
function spokesOf(binding, entry, hub) {
  return binding.participants.filter(participant => participant.id !== hub && participant.role !== 'ceded' && covers(participant, entry.area ?? null));
}

// Snapshots: { [participantId]: [{ ref, key, area?, revision, digest? }] } — the participant's current facet entries from the
// Library. `key` is the concept key the participant's adapter derives (a token name, a route), so new entries match across
// participants mechanically; `digest` is the entry in the concept's comparable form, so equal content needs no Work.
// Returns the correspondence with any new entries, the actions, and a status per entry.
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
  // Correspondence: the binding's entries, then unmatched snapshot entries joined by concept key.
  const correspondence = binding.correspondence.map(entry => ({ ...entry, refs: { ...entry.refs } }));
  const claimed = new Set(correspondence.flatMap(entry => Object.entries(entry.refs).map(([id, ref]) => `${id}\u0000${ref}`)));
  for (const participant of [...binding.participants].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const entry of [...byRef[participant.id].values()].sort((a, b) => a.ref.localeCompare(b.ref))) {
      if (claimed.has(`${participant.id}\u0000${entry.ref}`)) continue;
      const key = entry.key || `${participant.id}:${entry.ref}`;
      let target = correspondence.find(item => item.key === key);
      if (target && own(target.refs, participant.id)) fail(`Two ${participant.id} entries share the concept key ${key}.`);
      if (!target) { target = { key, ...(entry.area ? { area: entry.area } : {}), refs: {}, matched: 'key' }; correspondence.push(target); }
      target.refs[participant.id] = entry.ref;
    }
  }
  correspondence.sort((a, b) => a.key.localeCompare(b.key));

  const actions = [], status = [];
  const current = (id, entry) => own(entry.refs, id) ? byRef[id].get(entry.refs[id]) || null : null;
  const same = (a, b) => (!a && !b) || (!!a && !!b && typeof a.digest === 'string' && a.digest === b.digest);
  const action = (kind, entry, fields) => {
    const body = { kind, entry: entry.key, ...fields };
    body.id = `bnd-${createHash('sha256').update(JSON.stringify([binding.id || '', kind, entry.key, fields.target, fields.from || [], fields.revisions])).digest('hex').slice(0, 16)}`;
    actions.push(body);
  };
  const adapterWork = new Map();
  for (const entry of correspondence) {
    const hubId = authorityFor(binding, entry.area ?? null);
    if (!hubId) fail(`No authority for ${entry.key}${entry.area ? ` in ${entry.area}` : ''}.`);
    const hub = participantOf(binding, hubId);
    const h = current(hubId, entry);
    const offers = [], conflicts = [], first = [];
    let pending = false;
    for (const spoke of spokesOf(binding, entry, hubId)) {
      const s = current(spoke.id, entry);
      const recorded = binding.baseline[entry.key]?.[spoke.id];
      const base = recorded && recorded.hub === hubId ? recorded : { hubRevision: null, self: null };
      const hubMoved = (h?.revision ?? null) !== base.hubRevision, selfMoved = (s?.revision ?? null) !== base.self;
      const revisions = { hub: h?.revision ?? null, self: s?.revision ?? null };
      const settles = [{ entry: entry.key, participant: spoke.id }];
      if (!kept(spoke, entry)) {
        // Content the replica no longer keeps moves to the authority before it becomes ceded history.
        if ((!recorded || recorded.hub !== hubId) && s) { first.push(spoke.id); offers.push({ spoke, s, revisions, first: true }); }
        continue;
      }
      if (!hubMoved && !selfMoved) continue;
      if (!recorded || recorded.hub !== hubId) first.push(spoke.id);
      if ((hubMoved && selfMoved) || (!h && !s)) {
        if (same(h, s)) { action('ignored', entry, { target: spoke.id, layer: spoke.layer.key, reason: !h ? 'absent on both' : 'already equal', revisions, settles, auto: true }); continue; }
        conflicts.push({ spoke, s, revisions }); continue;
      }
      if (selfMoved) { offers.push({ spoke, s, revisions, first: first.includes(spoke.id) }); continue; }
      // The hub moved and this spoke did not: the receiving participant's policy decides.
      const event = !h ? 'removed' : s ? 'changed' : 'added';
      const response = binding.policy[spoke.id]?.[event] || 'propagate';
      const common = { target: spoke.id, layer: spoke.layer.key, from: [hubId], event, revisions, settles };
      if (response === 'ignore') { action('ignored', entry, { ...common, reason: 'policy', auto: true }); continue; }
      pending = true;
      if (response === 'flag') { action('review', entry, { ...common, work: true }); continue; }
      const adapter = adapterFor(binding, spoke.id, hubId);
      if (!adapter) {
        const key = `${spoke.id}\u0000${hubId}`;
        if (!adapterWork.has(key)) adapterWork.set(key, { spoke, hub, entries: [] });
        adapterWork.get(key).entries.push(entry.key);
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
      const firstSync = involved.every(item => first.includes(item.spoke.id));
      action(firstSync ? 'combine' : 'conflict', entry, { target: hubId, layer: hub.layer.key, from: involved.map(item => item.spoke.id), work: true,
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
      const response = !drift ? 'adopt' : chosen.size === 1 ? [...chosen][0] : 'assess';
      if (response === 'adopt') {
        const reverse = drift ? adapterFor(binding, hubId, sorted[0].spoke.id) : null;
        if (reverse?.mechanical && !reverse.soft) action('apply', entry, { ...toHub, ...fields, drift, toAuthority: true, adapter: reverse.id, auto: true });
        else action('adopt', entry, { ...toHub, ...fields, drift, first: !drift, work: true, ...(reverse ? { adapter: reverse.id } : {}) });
      } else if (response === 'rectify') {
        for (const item of sorted) action('rectify', entry, { target: item.spoke.id, layer: item.spoke.layer.key, from: [hubId], event, drift: true, work: true,
          revisions: { hub: h?.revision ?? null, self: item.revisions.self }, settles: [{ entry: entry.key, participant: item.spoke.id }],
          ...(adapterFor(binding, item.spoke.id, hubId) ? { adapter: adapterFor(binding, item.spoke.id, hubId).id } : {}) });
      } else action('assess', entry, { ...toHub, ...fields, target: 'work', layer: 'work', authority: hubId, drift: true, work: true, options: ['adopt', 'rectify'] });
      pending = true;
    }
    const taking = [hubId, ...spokesOf(binding, entry, hubId).filter(spoke => kept(spoke, entry)).map(spoke => spoke.id)].sort();
    const missing = taking.filter(id => !current(id, entry));
    status.push({ key: entry.key, area: entry.area ?? null, authority: hubId,
      state: pending ? 'diverged' : missing.length === taking.length ? 'absent' : missing.length ? 'missing' : 'matched', missingIn: missing });
  }
  // One adapter to write per spoke and hub, listing the entries waiting on it.
  for (const { spoke, hub, entries } of [...adapterWork.values()].sort((a, b) => a.spoke.id.localeCompare(b.spoke.id) || a.hub.id.localeCompare(b.hub.id)))
    action('adapter', { key: entries[0] }, { target: spoke.id, layer: spoke.layer.key, from: [hub.id], reads: hub.shape, entries, work: true, revisions: null, settles: [] });
  const order = kind => actionKinds.indexOf(kind);
  actions.sort((a, b) => a.entry.localeCompare(b.entry) || order(a.kind) - order(b.kind) || a.target.localeCompare(b.target));
  return { correspondence: correspondence.map(({ matched, ...entry }) => entry), proposed: correspondence.filter(entry => entry.matched).map(entry => entry.key),
    actions, status, wiring: wiring(binding) };
}

// Records agreement for spokes of entries: their own and their hub's current revisions become the baseline. The caller
// settles an automatic action once it is applied, and a Work action's spokes when that Work closes. `outcome: 'hub'` settles
// a spoke whose content lost (a change sent back, or a conflict decided for the hub's side): the spoke has yet to take the
// hub's version, so its hub revision is recorded as 0, which no real revision equals, and the next evaluation sends it.
export function settle(input, settlements, snapshots = {}, correspondence = null) {
  const binding = validateBinding({ ...input, correspondence: correspondence || input.correspondence });
  const revision = (id, entry) => (snapshots[id] || []).find(item => item.ref === entry.refs[id])?.revision ?? null;
  for (const { entry: key, participant, outcome = 'agreed' } of settlements) {
    if (!['agreed', 'hub'].includes(outcome)) fail('Settle as agreed, or for the hub.');
    const entry = binding.correspondence.find(item => item.key === key) || fail(`Unknown correspondence entry ${key}.`);
    const hub = authorityFor(binding, entry.area ?? null);
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
  const hub = participantOf(binding, assessment.authority) || fail('The authority changed. Evaluate the binding again.', 409);
  const id = (kind, target) => `bnd-${createHash('sha256').update(JSON.stringify([assessment.id, decision, kind, target])).digest('hex').slice(0, 16)}`;
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

// Authority moves to a participant, for one area or all of them. Every participant whose role changes is named, and the
// previous authority must be given its new role. Spokes now read the new hub; their old baselines no longer apply.
export function transfer(input, { to, area = '*', roles: changes = {}, keeps = {} }) {
  const binding = validateBinding(input);
  const target = participantOf(binding, to) || fail(`${to} is not a participant.`);
  const map = typeof binding.authority === 'string' ? { '*': binding.authority } : { ...binding.authority };
  const previous = map[area] || null;
  if (previous === to) fail(`${to} already holds ${area === '*' ? 'authority' : area}.`);
  map[area] = to;
  const holds = id => Object.values(map).includes(id);
  if (previous && !holds(previous) && !own(changes, previous)) fail(`Give ${previous} its new role: replica or ceded.`);
  const participants = binding.participants.map(participant => {
    const role = participant.id === to ? 'authority' : own(changes, participant.id) ? changes[participant.id] : participant.role;
    if (participant.id !== to && role === 'authority' && !holds(participant.id)) fail(`${participant.id} no longer holds authority.`);
    const next = { ...participant, role };
    if (own(keeps, participant.id)) next.keeps = keeps[participant.id];
    if (role !== 'replica') delete next.keeps;
    return next;
  });
  if (target.role === 'ceded') fail('A ceded facet cannot become the authority.');
  const authority = Object.keys(map).length === 1 && map['*'] ? map['*'] : map;
  return validateBinding({ ...binding, participants, authority, lifecycle: binding.lifecycle === 'active' ? 'reconciling' : binding.lifecycle });
}

export function transition(input, lifecycle) {
  const binding = validateBinding(input);
  if (!lifecycleTransitions[binding.lifecycle].includes(lifecycle)) fail(`A ${binding.lifecycle} binding cannot become ${lifecycle}.`, 409);
  return { ...binding, lifecycle };
}
