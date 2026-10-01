// LAYER-BINDINGS-01 step 2: the routines that run bindings. Discover proposes a binding where one layer declares an adapter
// for a shape another installed layer's facet publishes. Watch evaluates each reconciling or active binding against what its
// participants currently publish in the Library: it applies mechanical imports through the receiving layer's own adapter
// (checked and applied as Aludel), raises everything else as Work in the layer that should change, settles Work that has
// closed, and logs each automatic change on the binding. Layers know nothing of this; they publish facets and accept Work.
import { createHash } from 'node:crypto';
import { decide, evaluate, facetOf, settle, validateAdapters, validateFacets } from './bindings.mjs';
import { adaptLayer, layerApi } from './layer-api.mjs';
import { layerPackageForProject } from './layer-package.mjs';

// Fields the Library adds to a record that are not its content.
const meta = new Set(['id', 'kind', 'revision', 'updatedAt', 'position']);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
// An entry's content digest, as the authority publishes it. A replica's record keeps the digest it was imported from.
export const entryDigest = data => createHash('sha256').update(JSON.stringify(stable(Object.fromEntries(Object.entries(data || {}).filter(([key]) => !meta.has(key)))))).digest('hex');
const openStates = new Set(['suggested', 'ready', 'claimed', 'needs-input', 'review']);

export function bindingRoutines({ db, know, pool, store }) {
  const manifest = (projectId, key) => { try { return layerPackageForProject(db, projectId, key)?.manifest || null; } catch { return null; } };
  const installed = projectId => db.prepare('SELECT layer_key AS key, instance_id AS instanceId FROM layer_instances WHERE project_id = ? AND enabled = 1 ORDER BY rowid').all(projectId)
    .map(row => { const found = manifest(projectId, row.key); return found ? { ...row, name: found.name, facets: validateFacets(found), adapters: validateAdapters(found) } : null; })
    .filter(Boolean);

  // Every Library entry of a participant's facet, in the form evaluate takes. An imported record names the entry it came
  // from, which is its concept key and digest; any other entry is keyed by its own ref and digested from its content.
  // A participant's facet entries come from the installed layers' published outputs, read once per pass. An imported record
  // names the entry it came from, which is its concept key and digest; any other entry is keyed by its own ref and digested
  // from its content.
  function snapshot(projectId, binding) {
    const layers = new Map(installed(projectId).map(layer => [layer.key, layer]));
    const outputs = pool.outputEntries(projectId);
    const library = {}, snapshots = {}, missing = [];
    for (const participant of binding.participants) {
      const layer = layers.get(participant.layer.key);
      const facet = layer?.facets.find(item => item.key === participant.facet);
      if (!facet && participant.role !== 'ceded') missing.push(participant.id);
      // An entry is in the facet its layer's select clauses put it in, which may narrow a kind by one field.
      library[participant.id] = facet ? outputs.filter(entry => entry.layer.key === layer.key && facetOf(layer.facets, entry) === facet.key) : [];
      snapshots[participant.id] = library[participant.id].map(entry => ({ ref: entry.ref, revision: entry.revision,
        key: typeof entry.data?.sourceRef === 'string' ? entry.data.sourceRef : entry.ref,
        digest: typeof entry.data?.sourceDigest === 'string' ? entry.data.sourceDigest : entryDigest(entry.data) }));
    }
    return { library, snapshots, missing };
  }

  // Discover: a layer that declares an adapter for a shape another installed layer's facet publishes is a candidate binding,
  // with the publisher as authority. Each pairing is proposed once; a retired (dismissed) one is not proposed again.
  function discover(projectId) {
    const layers = installed(projectId), proposed = [];
    const existing = store.all(projectId);
    for (const receiver of layers) for (const adapter of receiver.adapters) for (const source of layers) {
      if (source.key === receiver.key) continue;
      const facet = source.facets.find(item => item.shape === adapter.reads && item.roles.includes('authority'));
      const own = receiver.facets.find(item => item.key === adapter.facet);
      if (!facet || !own?.roles.includes('replica')) continue;
      const covered = existing.some(binding => binding.participants.some(p => p.layer.key === receiver.key && p.facet === own.key)
        && binding.participants.some(p => p.layer.key === source.key && p.facet === facet.key));
      if (covered) continue;
      const authorityId = `${source.key}-${facet.key}`.replaceAll('_', '-'), replicaId = `${receiver.key}-${own.key}`.replaceAll('_', '-');
      const binding = store.propose(projectId, {
        concept: { name: facet.title, description: `${source.name}'s ${facet.title.toLowerCase()}, which ${receiver.name}'s ${own.title.toLowerCase()} keeps a copy of.` },
        participants: [{ id: authorityId, layer: { key: source.key }, facet: facet.key, role: 'authority', shape: facet.shape },
          { id: replicaId, layer: { key: receiver.key }, facet: own.key, role: 'replica', shape: own.shape }],
        authority: authorityId,
        adapters: [{ id: adapter.id, participant: replicaId, reads: adapter.reads, mechanical: adapter.mechanical, soft: adapter.soft }]
      }, `${receiver.name} declares the ${adapter.id} adapter for ${facet.shape}, which ${source.name}'s ${facet.title} publishes. ${source.name}'s facet supports authority and ${receiver.name}'s supports replica, so ${source.name} is proposed as the authority.`);
      const work = know.createWork(projectId, { layer: 'work', layerScoped: true, type: 'review', state: 'suggested',
        title: `Review the proposed binding: ${source.name}'s ${facet.title.toLowerCase()} → ${receiver.name}'s ${own.title.toLowerCase()}`,
        documents: ['Library › Bindings'], context: { binding: binding.id, routine: 'binding-discover' },
        logText: `Proposed by Discover: ${receiver.name}'s ${adapter.id} adapter reads what ${source.name} publishes` });
      store.logEvent(binding.id, { kind: 'proposed', detail: { by: 'discover', adapter: adapter.id }, workItemId: work.id });
      proposed.push(binding);
    }
    return proposed;
  }

  // Binding Work raised earlier: open items by action, and closed ones not yet settled.
  const bindingWork = (projectId, bindingId) => db.prepare(`SELECT id, state, context_json FROM layer_work_items WHERE project_id = ? AND archived_at IS NULL
    AND json_extract(context_json, '$.binding') = ? AND json_extract(context_json, '$.action.id') IS NOT NULL`).all(projectId, bindingId)
    .map(row => ({ id: row.id, state: row.state, context: JSON.parse(row.context_json) }));
  const settled = (bindingId, workId) => !!db.prepare("SELECT 1 FROM layer_binding_events WHERE binding_id = ? AND kind = 'settled' AND work_item_id = ?").get(bindingId, workId);

  const workTitle = (action, binding, names) => {
    const from = (action.from || []).map(id => names(id)).join(', ');
    return { adopt: `Take “${action.entry}” into ${names(action.target)} from ${from}`, assess: `Assess drift in “${action.entry}” from ${from}: adopt it or rectify it`,
      rectify: `Bring “${action.entry}” in ${names(action.target)} back in line with ${from}`, import: `Import “${action.entry}” from ${from}`,
      review: `Review ${from}'s change to “${action.entry}”`, adapter: `Write an adapter for ${action.reads} so ${names(action.target)} can follow ${from}`,
      combine: `Combine “${action.entry}”: ${from} and ${names(action.target)} differ`, conflict: `Decide “${action.entry}”: ${names(action.target)} and ${from} both changed` }[action.kind]
      || `${action.kind} “${action.entry}”`;
  };

  // Watch: one pass over a binding. Returns what it applied and raised.
  function watch(projectId, bindingId) {
    let binding = store.all(projectId).find(item => item.id === bindingId);
    if (!binding || !['reconciling', 'active'].includes(binding.lifecycle)) return { applied: [], raised: [], settled: [] };
    const names = id => { const p = binding.participants.find(item => item.id === id); return p ? `${installed(projectId).find(l => l.key === p.layer.key)?.name || p.layer.key}'s ${p.facet}` : id === 'work' ? 'Work' : id; };
    const result = { applied: [], raised: [], settled: [] };
    let { snapshots, missing } = snapshot(projectId, binding);
    // A participant whose layer is switched off (or no longer declares the facet) publishes nothing, which is not the same as
    // removing everything. The binding holds until it is back: nothing is imported, raised or settled.
    if (missing.length) {
      const last = db.prepare('SELECT kind FROM layer_binding_events WHERE binding_id = ? ORDER BY seq DESC LIMIT 1').get(bindingId);
      if (last?.kind !== 'degraded') store.logEvent(bindingId, { kind: 'degraded', detail: { missing } });
      return { ...result, degraded: missing };
    }

    // Actions already in hand: open items, and decided assessments whose follow-up Work is still open.
    const work = bindingWork(projectId, bindingId), live = work.filter(item => openStates.has(item.state));
    const open = new Set([...live.map(item => item.context.action.id), ...live.map(item => item.context.action.decidedFrom).filter(Boolean)]);
    function raise(action) {
      if (open.has(action.id)) return;
      const layer = action.layer === 'work' ? 'work' : action.layer;
      const item = know.createWork(projectId, { layer, layerScoped: true, type: action.kind === 'assess' || action.kind === 'review' ? 'review' : 'reconcile', state: 'suggested',
        title: workTitle(action, binding, names).slice(0, 160), documents: ['Library › Bindings'],
        context: { binding: bindingId, routine: 'binding-watch', action }, logText: `Raised by the “${binding.concept.name}” binding` });
      open.add(action.id);
      if (action.decidedFrom) open.add(action.decidedFrom);
      store.logEvent(bindingId, { actionId: action.id, kind: 'raised', entry: action.entry, target: action.target, detail: { action: action.kind }, workItemId: item.id });
      result.raised.push(item);
    }

    // Work that closed since the last pass settles its spokes. An assessment closes with a decision, which raises its follow-up.
    for (const item of bindingWork(projectId, bindingId).filter(item => item.state === 'done' && !settled(bindingId, item.id))) {
      const action = item.context.action;
      const decision = action.kind === 'assess' ? item.context.decision : null;
      if (action.kind === 'assess' && ['adopt', 'rectify'].includes(decision)) {
        for (const next of decide(binding, action, decision)) raise(next);
      } else {
        // Rectifying a replica its adapter fills mechanically is confirmed by closing the item: the hub's version wins and the
        // next pass imports it again. Otherwise the person or agent did the work, and closing it records agreement.
        const adapter = binding.adapters.find(entry => entry.id === action.adapter);
        const outcome = item.context.outcome || (action.kind === 'rectify' && adapter?.mechanical && !adapter.soft ? 'hub' : 'agreed');
        if (action.settles?.length) binding = settle(binding, action.settles.map(entry => ({ ...entry, outcome })), snapshots);
      }
      store.logEvent(bindingId, { actionId: action.id, kind: 'settled', entry: action.entry, target: action.target, detail: { decision, outcome: decision ? null : item.context.outcome || 'agreed' }, workItemId: item.id });
      result.settled.push(item.id);
    }

    const evaluated = evaluate(binding, snapshots);
    binding = { ...binding, correspondence: evaluated.correspondence };
    // Mechanical imports, grouped by receiving participant and adapter: one adapt call each, applied as Aludel.
    const applies = evaluated.actions.filter(action => action.kind === 'apply');
    const groups = new Map();
    for (const action of applies) {
      const key = `${action.target}\u0000${action.adapter}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(action);
    }
    const { library } = snapshot(projectId, binding);
    for (const actions of groups.values()) {
      const receiver = binding.participants.find(item => item.id === actions[0].target);
      const adapterId = binding.adapters.find(item => item.id === actions[0].adapter)?.id;
      const entries = [], removed = [];
      for (const action of actions) {
        const source = action.from[0];
        const ref = evaluated.correspondence.find(item => item.key === action.entry)?.refs[source];
        const found = ref ? library[source].find(entry => entry.ref === ref) : null;
        if (found) entries.push({ ref: found.ref, kind: found.kind, revision: found.revision, digest: entryDigest(found.data), data: found.data, layer: found.layer });
        else removed.push(action.entry);
      }
      const api = layerApi(db, projectId, receiver.layer.key);
      if (!api) continue;
      const written = adaptLayer({ db, know, api, projectId, adapterId, entries, removed,
        rationale: `Imported through the “${binding.concept.name}” binding (${adapterId})` });
      for (const action of actions) {
        store.logEvent(bindingId, { actionId: action.id, kind: 'applied', entry: action.entry, target: action.target, detail: { event: action.event, adapter: adapterId, from: action.from } });
        result.applied.push(action);
      }
      void written;
    }
    // Settle what was applied or recorded automatically, against what the participants now publish.
    ({ snapshots } = snapshot(projectId, binding));
    binding = { ...binding, correspondence: evaluate(binding, snapshots).correspondence };
    const autoSettles = evaluated.actions.filter(action => action.auto).flatMap(action => action.settles);
    for (const action of evaluated.actions.filter(item => item.kind === 'ignored')) store.logEvent(bindingId, { actionId: action.id, kind: 'recorded', entry: action.entry, target: action.target, detail: { reason: action.reason } });
    if (autoSettles.length) binding = settle(binding, autoSettles, snapshots);
    for (const action of evaluated.actions.filter(item => item.work)) raise(action);
    store.saveSync(bindingId, binding);
    const settledNow = evaluate(binding, snapshots);
    if (binding.lifecycle === 'reconciling' && !settledNow.actions.some(action => !action.auto) && !open.size) {
      store.activate(projectId, bindingId);
      store.logEvent(bindingId, { kind: 'activated', detail: { reason: 'first reconcile complete' } });
      result.activated = true;
    }
    return { ...result, status: settledNow.status };
  }

  function watchProject(projectId) {
    return store.all(projectId).filter(binding => ['reconciling', 'active'].includes(binding.lifecycle)).map(binding => ({ id: binding.id, ...watch(projectId, binding.id) }));
  }
  // A binding's current state for Library › Bindings: the record, its correspondence status and recent automatic changes.
  function status(projectId, userId, bindingId) {
    const binding = store.read(projectId, userId, bindingId);
    const { snapshots, missing } = snapshot(projectId, binding);
    const evaluated = evaluate(binding, snapshots);
    return { binding, degraded: missing, status: missing.length ? [] : evaluated.status, pending: evaluated.actions.filter(action => action.work).map(action => ({ kind: action.kind, entry: action.entry, target: action.target })),
      wiring: evaluated.wiring, events: store.events(projectId, userId, bindingId, 30),
      work: bindingWork(projectId, bindingId).map(item => ({ id: item.id, state: item.state, kind: item.context.action.kind, entry: item.context.action.entry })) };
  }
  // An owner decides an assessment of drift: adopt it into the authority, or rectify the drifted participant. The assessment
  // closes with the decision, and the next pass raises the Work it decides on.
  function decideAssessment(projectId, userId, bindingId, workId, decision) {
    if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ? AND role = 'owner'").get(userId, projectId))
      throw Object.assign(new Error('Project owner required.'), { status: 403 });
    if (!['adopt', 'rectify'].includes(decision)) throw Object.assign(new Error('Decide adopt or rectify.'), { status: 400 });
    const item = bindingWork(projectId, bindingId).find(entry => entry.id === workId);
    if (!item || item.context.action.kind !== 'assess') throw Object.assign(new Error('Assessment not found.'), { status: 404 });
    if (!openStates.has(item.state)) throw Object.assign(new Error('This assessment is already closed.'), { status: 409 });
    know.appendLog(workId, `Done: ${decision === 'adopt' ? 'adopt the drift into the authority' : 'rectify the drifted participant'}`,
      { state: 'done', context: { ...item.context, decision } }, { by: { kind: 'person', id: userId } });
    return watch(projectId, bindingId);
  }
  return { discover, watch, watchProject, snapshot, status, decideAssessment };
}
