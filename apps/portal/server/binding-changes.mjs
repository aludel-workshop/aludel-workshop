// LAYER-BINDINGS-01 step 3, R2: every change to a binding is Work. A change (create, accept, dismiss, pause, resume, retire,
// join, transfer, or an edit of concept, policy or adapters) is proposed as a Work item in the Work layer and applied only
// when the project owner decides it. Discover's proposal is one of these items, so accepting or dismissing it in Library ›
// Bindings closes it. An owner acting directly still goes through an item, created and decided in one step, so every
// change leaves the same trail. Items can be blocked (Work's `blocks`), for example a binding that waits on the refacets
// that make its facets exist; a blocked item can't be decided.
import { isDeepStrictEqual } from 'node:util';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const openStates = new Set(['suggested', 'ready', 'claimed', 'needs-input', 'review']);
const lifecycleWords = { reconciling: 'Accept', retired: 'Retire', paused: 'Pause', active: 'Resume' };

export function bindingChanges({ db, know, store, routines }) {
  const isOwner = (projectId, userId) => !!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ? AND role = 'owner'").get(userId, projectId);
  const isMember = (projectId, userId) => !!db.prepare('SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId);
  const items = projectId => db.prepare(`SELECT id, state, context_json, blocks_json FROM layer_work_items WHERE project_id = ? AND archived_at IS NULL
    AND json_extract(context_json, '$.routine') = 'binding-change'`).all(projectId).map(row => ({ id: row.id, state: row.state, context: JSON.parse(row.context_json) }));
  // Open items that list this one in their blocks.
  const blockedBy = (projectId, workId) => db.prepare(`SELECT id FROM layer_work_items WHERE project_id = ? AND archived_at IS NULL AND state <> 'done'
    AND EXISTS (SELECT 1 FROM json_each(blocks_json) WHERE value = ?)`).all(projectId, workId).map(row => row.id);

  function validChange(change) {
    if (!change || typeof change !== 'object') fail('Describe the binding change.');
    if (change.kind === 'create') { if (!change.binding || typeof change.binding !== 'object') fail('Give the binding to create.'); }
    else if (change.kind === 'lifecycle') { if (!lifecycleWords[change.lifecycle]) fail('Accept, pause, resume or retire.'); }
    else if (change.kind === 'join') { if (!change.participant) fail('Name the participant that joins.'); }
    else if (change.kind === 'transfer') { if (!change.change?.to) fail('Name who takes authority.'); }
    else if (change.kind === 'update') { if (!change.changes || typeof change.changes !== 'object') fail('Name what changes.'); }
    else fail('Unknown binding change.');
    return change;
  }
  const title = (binding, change) => {
    const name = binding?.concept?.name || change.binding?.concept?.name || 'a binding';
    if (change.kind === 'create') return `Propose the “${name}” binding`;
    if (change.kind === 'lifecycle') return binding?.lifecycle === 'proposed' && change.lifecycle === 'reconciling' ? `Review the proposed binding: ${name}` : `${lifecycleWords[change.lifecycle]} the “${name}” binding`;
    if (change.kind === 'join') return `${change.participant.layer?.key || 'A layer'}'s ${change.participant.facet} joins “${name}” as ${change.participant.role}`;
    if (change.kind === 'transfer') return `Move authority in “${name}” to ${change.change.to}`;
    return `Change ${Object.keys(change.changes).join(', ')} of “${name}”`;
  };

  // Proposes a change as Work. `by` is a person ({ kind: 'person', id }) or Aludel (a routine). `blocks` names items this one
  // waits on, which gain it in their blocks.
  function propose(projectId, { bindingId = null, change, rationale = null, by = null, state = 'review', routine = null, waitsOn = [] }) {
    if (by?.kind === 'person' && !isMember(projectId, by.id)) fail('Project not found.', 404);
    validChange(change);
    const binding = bindingId ? store.all(projectId).find(item => item.id === bindingId) || fail('Binding not found.', 404) : null;
    if (!binding && change.kind !== 'create') fail('Name the binding to change.');
    const item = know.createWork(projectId, { layer: 'work', layerScoped: true, type: 'review', state, title: title(binding, change).slice(0, 160),
      documents: ['Library › Bindings'], context: { routine: 'binding-change', binding: bindingId, change, rationale, ...(routine ? { by: routine } : {}) },
      logText: rationale ? `Proposed: ${rationale}`.slice(0, 500) : 'Proposed' });
    for (const blocker of waitsOn) {
      const row = db.prepare('SELECT blocks_json FROM layer_work_items WHERE id = ? AND project_id = ?').get(blocker, projectId) || fail(`No Work item ${blocker}.`, 404);
      db.prepare('UPDATE layer_work_items SET blocks_json = ? WHERE id = ?').run(JSON.stringify([...new Set([...JSON.parse(row.blocks_json || '[]'), item.id])]), blocker);
    }
    if (bindingId) store.logEvent(bindingId, { kind: 'change-proposed', detail: { change: change.kind, lifecycle: change.lifecycle || null }, workItemId: item.id });
    return item;
  }

  // The owner decides a change: accept applies it, dismiss closes it unapplied. Dismissing a proposal retires the binding,
  // so Discover doesn't propose it again.
  function decide(projectId, userId, workId, decision, reason = null) {
    if (!isOwner(projectId, userId)) fail('Project owner required.', 403);
    if (!['accept', 'dismiss'].includes(decision)) fail('Accept or dismiss.');
    const item = items(projectId).find(entry => entry.id === workId) || fail('Binding change not found.', 404);
    if (!openStates.has(item.state)) fail('This change is already decided.', 409);
    const waiting = blockedBy(projectId, workId);
    if (waiting.length) fail(`This change waits on ${waiting.length === 1 ? 'another Work item' : `${waiting.length} Work items`} to finish first.`, 409);
    const { change, rationale } = item.context;
    let bindingId = item.context.binding;
    const why = reason || rationale || null;
    if (decision === 'accept') {
      const current = () => store.read(projectId, userId, bindingId);
      if (change.kind === 'create') {
        const created = store.create(projectId, userId, { ...change.binding, rationale: why });
        bindingId = created.id;
        store.lifecycle(projectId, userId, bindingId, { expectedRevision: created.revision, lifecycle: 'reconciling', rationale: why || 'Accepted.' });
      } else if (change.kind === 'lifecycle') store.lifecycle(projectId, userId, bindingId, { expectedRevision: current().revision, lifecycle: change.lifecycle, rationale: why });
      else if (change.kind === 'join') store.join(projectId, userId, bindingId, { expectedRevision: current().revision, participant: change.participant, policy: change.policy, adapters: change.adapters, rationale: why });
      else if (change.kind === 'transfer') store.transfer(projectId, userId, bindingId, { expectedRevision: current().revision, change: change.change, rationale: why });
      else store.update(projectId, userId, bindingId, { expectedRevision: current().revision, changes: change.changes, rationale: why });
    } else if (change.kind === 'lifecycle' && change.lifecycle === 'reconciling') {
      const binding = store.read(projectId, userId, bindingId);
      if (binding.lifecycle === 'proposed') store.lifecycle(projectId, userId, bindingId, { expectedRevision: binding.revision, lifecycle: 'retired', rationale: why || 'Dismissed.' });
    }
    know.appendLog(workId, decision === 'accept' ? 'Done: accepted and applied' : `Done: dismissed${reason ? ` (${reason})` : ''}`.slice(0, 500),
      { state: 'done', context: { ...item.context, binding: bindingId, decision } }, { by: { kind: 'person', id: userId } });
    if (bindingId) {
      store.logEvent(bindingId, { kind: decision === 'accept' ? 'change-accepted' : 'change-dismissed', detail: { change: change.kind, lifecycle: change.lifecycle || null }, workItemId: workId });
      routines?.watch(projectId, bindingId);
    }
    return { workItemId: workId, binding: bindingId ? store.read(projectId, userId, bindingId) : null };
  }

  // An owner's direct action in Library › Bindings: decide the open item that proposes exactly this change (Discover's
  // proposal, for one), dismiss a proposal when the binding is retired from proposed, or else propose and decide in one step.
  // Anyone else's request is proposed and waits for the owner.
  function request(projectId, userId, bindingId, change, rationale = null) {
    validChange(change);
    if (!isOwner(projectId, userId)) return { proposed: propose(projectId, { bindingId, change, rationale, by: { kind: 'person', id: userId } }) };
    const open = items(projectId).filter(item => openStates.has(item.state) && item.context.binding === bindingId);
    const same = open.find(item => isDeepStrictEqual(item.context.change, change));
    if (same) return decide(projectId, userId, same.id, 'accept', rationale);
    const binding = bindingId ? store.read(projectId, userId, bindingId) : null;
    const proposal = open.find(item => item.context.change.kind === 'lifecycle' && item.context.change.lifecycle === 'reconciling');
    if (binding?.lifecycle === 'proposed' && change.kind === 'lifecycle' && change.lifecycle === 'retired' && proposal)
      return decide(projectId, userId, proposal.id, 'dismiss', rationale);
    const item = propose(projectId, { bindingId, change, rationale, by: { kind: 'person', id: userId } });
    return decide(projectId, userId, item.id, 'accept', rationale);
  }

  // Open change items for one binding, for its page in Library › Bindings.
  const pending = (projectId, bindingId) => items(projectId).filter(item => openStates.has(item.state) && item.context.binding === bindingId)
    .map(item => ({ id: item.id, state: item.state, change: item.context.change, blockedBy: blockedBy(projectId, item.id) }));

  return { propose, decide, request, pending, blockedBy };
}
