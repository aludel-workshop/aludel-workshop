// LAYER-BINDINGS-01 step 3, R2: a refacet is reviewed Work in the layer it changes. Proposing one computes the new facet
// declarations from the layer instance's current manifest, entries and live bindings (the pure `refacet`), commits them to
// a `refacet/…` branch of the instance's own repository (layer.json only), checks that the branch is a valid package, and
// raises a Work item in that layer carrying the change, the branch and its preflight. Accepting it (the project owner,
// since layer.json defines what a layer may do) refuses if the layer moved on since the proposal, merges the branch as the
// instance's new pin, and applies the bindings' follow-through, recomputed against what they hold now: moved entries detach, and a split-off facet may join a named binding. Nothing about a layer's records
// changes; only which facet they are in.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refacet } from './bindings.mjs';
import { referencesTo } from './entry-roles.mjs';
import { packageAt, packageRootAt } from './layer-package.mjs';
import { layerBinding, mergeLayerBranch, settleLayerCheckout, undoLayerMerge } from './layer-source.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const openStates = new Set(['suggested', 'ready', 'claimed', 'needs-input', 'review']);
const git = (repo, args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options }).trimEnd();
const aludel = { GIT_AUTHOR_NAME: 'Aludel', GIT_AUTHOR_EMAIL: 'aludel@aludel.invalid', GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' };

// Commits `layer.json` with new facets on top of `base`, without touching any checkout, as branch `name`.
export function commitFacets(repo, base, facets, name, message) {
  const root = packageRootAt(repo, base);
  const manifest = JSON.parse(git(repo, ['show', `${base}:${root}layer.json`]));
  const content = `${JSON.stringify({ ...manifest, facets }, null, 2)}\n`;
  const scratch = mkdtempSync(join(tmpdir(), 'aludel-refacet-'));
  try {
    const env = { ...process.env, ...aludel, GIT_INDEX_FILE: join(scratch, 'index') };
    git(repo, ['read-tree', base], { env });
    const blob = git(repo, ['hash-object', '-w', '--stdin'], { input: content });
    git(repo, ['update-index', '--cacheinfo', `100644,${blob},${root}layer.json`], { env });
    const tree = git(repo, ['write-tree'], { env });
    const commit = git(repo, ['commit-tree', tree, '-p', base, '-m', message], { env });
    git(repo, ['update-ref', `refs/heads/${name}`, commit]);
    return commit;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

export function refacets({ db, know, pool, store, routines }) {
  const isOwner = (projectId, userId) => !!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ? AND role = 'owner'").get(userId, projectId);
  const isMember = (projectId, userId) => !!db.prepare('SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId);
  // The layer as the pure refacet takes it: its manifest at the pin, its published entries, and the project's bindings.
  function current(projectId, key) {
    const { repo, commit } = layerBinding(db, projectId, key);
    const { manifest, root } = packageAt(repo, commit, key);
    const all = pool.outputEntries(projectId);
    const entries = all.filter(entry => entry.layer.key === key).map(entry => ({ ref: entry.ref, kind: entry.kind, data: entry.data || {} }));
    // Other layers' references into this layer's entries, for the preflight (R3's reference index).
    const references = referencesTo(all, entries.map(entry => entry.ref), { exceptLayer: key });
    return { repo, commit, root, manifest, entries, references, bindings: store.all(projectId) };
  }
  const compute = (state, key, change) => refacet({ key, outputs: state.manifest.outputs || [], tabs: state.manifest.tabs || [], facets: state.manifest.facets || [] },
    change, { entries: state.entries, bindings: state.bindings, references: state.references });
  const describe = (change, preflight) => {
    const what = change.op === 'declare' ? `declare the ${change.into?.key} facet` : change.op === 'split' ? `split ${change.facet} into ${change.facet} and ${change.into?.key}` : change.op === 'merge' ? `merge ${change.from} into ${change.facet}` : `rename ${change.facet}`;
    const kinds = Object.entries(preflight.byKind).map(([kind, count]) => `${count} ${kind.replaceAll('_', ' ')}`).join(', ');
    const detached = preflight.bindings.map(item => `${item.binding} holds ${item.detached.join(', ')}`).join('; ');
    const follow = preflight.follow.map(item => `${item.layer}'s ${item.facet} (${item.refs.length})`).join(', ');
    return { what, log: [`Refacet: ${what}.`, kinds && `Moves ${kinds}.`, detached && `Detached: ${detached}.`, follow && `Should follow: ${follow}.`].filter(Boolean).join(' ') };
  };

  // Proposes a refacet of one layer as Work in that layer. `waitsOn` names items it waits for; `blocks` names items that
  // wait for it (an overlap chain's binding proposal).
  function propose(projectId, userId, key, { change, rationale = null, blocks = [] } = {}) {
    if (!isMember(projectId, userId)) fail('Project not found.', 404);
    const state = current(projectId, key);
    const result = compute(state, key, change);
    const branch = `refacet/${randomBytes(5).toString('hex')}`;
    const { what, log } = describe(change, result.preflight);
    const commit = commitFacets(state.repo, state.commit, result.facets, branch, `Refacet ${key}: ${what}`);
    try { packageAt(state.repo, commit, key); }
    catch (error) { git(state.repo, ['update-ref', '-d', `refs/heads/${branch}`]); fail(`The refaceted layer is not a valid package: ${error.message}`, 409); }
    const item = know.createWork(projectId, { layer: key, layerScoped: true, type: 'configure', state: 'review',
      title: `Refacet ${state.manifest.name || key}: ${what}`.slice(0, 160), documents: ['layer.json'],
      context: { routine: 'refacet', refacet: { layer: key, change, branch, base: state.commit, commit, facets: result.facets, preflight: result.preflight }, rationale },
      logText: `${log}${rationale ? ` Why: ${rationale}` : ''}`.slice(0, 1000) });
    if (blocks.length) db.prepare('UPDATE layer_work_items SET blocks_json = ? WHERE id = ?').run(JSON.stringify([...new Set(blocks)]), item.id);
    return { item, preflight: result.preflight, branch, commit };
  }

  // The owner accepts or dismisses a refacet. Accepting merges the reviewed branch and applies the bindings' follow-through;
  // if either fails, the pin and `main` stay where they were.
  function decide(projectId, userId, workId, decision, reason = null) {
    if (!isOwner(projectId, userId)) fail('Project owner required.', 403);
    if (!['accept', 'dismiss'].includes(decision)) fail('Accept or dismiss.');
    const row = db.prepare("SELECT id, number, state, context_json FROM layer_work_items WHERE id = ? AND project_id = ? AND json_extract(context_json, '$.routine') = 'refacet'").get(workId, projectId)
      || fail('Refacet not found.', 404);
    if (!openStates.has(row.state)) fail('This refacet is already decided.', 409);
    const context = JSON.parse(row.context_json), plan = context.refacet;
    if (decision === 'dismiss') {
      know.appendLog(workId, `Done: dismissed${reason ? ` (${reason})` : ''}`.slice(0, 500), { state: 'done', context: { ...context, decision } }, { by: { kind: 'person', id: userId } });
      return { workItemId: workId, merged: null };
    }
    const blockers = routines.changes.blockedBy(projectId, workId);
    if (blockers.length) fail('This refacet waits on other Work to finish first.', 409);
    const state = current(projectId, plan.layer);
    // Docs and spec saves move the pin all the time (LAYER-KNOWLEDGE-01). If the facets are as they were at the proposal,
    // the same change is committed again on the current pin; otherwise the proposal is stale.
    let source = { branch: plan.branch, commit: plan.commit, base: plan.base };
    if (state.commit !== plan.base) {
      const was = JSON.parse(git(state.repo, ['show', `${plan.base}:${packageRootAt(state.repo, plan.base)}layer.json`])).facets ?? null;
      if (JSON.stringify(was) !== JSON.stringify(state.manifest.facets ?? null)) fail('The layer changed since this refacet was proposed. Dismiss it and propose it again.', 409);
      const branch = `${plan.branch}-on-${state.commit.slice(0, 7)}`;
      source = { branch, commit: commitFacets(state.repo, state.commit, plan.facets, branch, `Refacet ${plan.layer} (again on ${state.commit.slice(0, 7)})`), base: state.commit };
    }
    // The facets follow from the manifest at the base and the change, so an unmoved layer gives exactly the reviewed ones;
    // the bindings' follow-through is recomputed, since Watch may have changed what they hold.
    const result = compute(state, plan.layer, plan.change);
    const reviewer = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId)?.display_name || 'Owner';
    const instance = db.prepare('SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, plan.layer)?.instance_id;
    const merge = mergeLayerBranch(db, { projectId, key: plan.layer, reviewer, workId, workRef: `#${row.number}`, catalogs: know.catalogs,
      source: { ...source, files: [{ path: `${state.root || ''}layer.json`, status: 'modified', ownerReview: true }] },
      recordsOf: kind => db.prepare('SELECT id, data_json FROM knowledge_records WHERE project_id = ? AND kind = ? AND layer_instance_id = ?').all(projectId, kind, instance)
        .map(record => ({ id: record.id, data: JSON.parse(record.data_json) })) });
    const why = `Refacet of ${plan.layer} (#${row.number}): ${describe(plan.change, result.preflight).what}`;
    try {
      for (const binding of result.bindings) {
        store.applyRefacet(projectId, userId, binding, why);
        store.logEvent(binding.id, { kind: 'refaceted', detail: { layer: plan.layer, change: plan.change.op, detached: (binding.detached || []).map(entry => entry.key) }, workItemId: workId });
      }
    } catch (error) {
      undoLayerMerge(merge);
      db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ?').run(merge.main, projectId, plan.layer);
      throw error;
    }
    settleLayerCheckout(merge);
    know.appendLog(workId, `Done: accepted; ${plan.layer} is at ${merge.commit.slice(0, 7)}`, { state: 'done', context: { ...context, decision, merged: merge.commit } }, { by: { kind: 'person', id: userId } });
    // Every live binding sees the layer's new facets at once: entries this refacet moved out may release what another
    // binding was holding for this layer.
    routines.watchProject(projectId);
    return { workItemId: workId, merged: merge.commit, preflight: result.preflight };
  }

  // A partial overlap as a chain of Work: a refacet for each side that needs one, then the binding proposal, which waits on
  // them (Work's `blocks`), so it can only be accepted once the facets it names exist.
  function chain(projectId, userId, { refacets: steps = [], binding, rationale = null }) {
    if (!binding) fail('Give the binding the chain proposes.');
    const proposal = routines.changes.propose(projectId, { change: { kind: 'create', binding }, rationale, by: { kind: 'person', id: userId } });
    const items = steps.map(step => propose(projectId, userId, step.layer, { change: step.change, rationale, blocks: [proposal.id] }).item);
    return { refacets: items, proposal };
  }

  // Open refacets of one layer, newest first, with their preflight and whether other Work blocks them.
  const pending = (projectId, key) => db.prepare(`SELECT id, number, title, state, context_json FROM layer_work_items WHERE project_id = ? AND archived_at IS NULL
    AND json_extract(context_json, '$.routine') = 'refacet' AND json_extract(context_json, '$.refacet.layer') = ? AND state <> 'done' ORDER BY number DESC`).all(projectId, key)
    .map(row => { const plan = JSON.parse(row.context_json).refacet;
      return { id: row.id, number: row.number, title: row.title, state: row.state, change: plan.change, preflight: plan.preflight, blockedBy: routines.changes.blockedBy(projectId, row.id) }; });

  return { propose, decide, chain, pending };
}
