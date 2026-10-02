// LAYER-KNOWLEDGE-01 S3/S4: what a layer's Knowledge tab shows, and binding from its tree. The site joins the layer's spec
// (`information`) with what is in each part now (the Library), how each part is shared (bindings, and proposals still
// waiting), and its docs. People bind parts of the tree, not facets: a proposal names the ticked nodes of each layer, one
// lead and, for the others, whether they keep a local copy. The host turns that into each layer's refacet (information's
// nodesToChange) and the existing chain: refacets, then the binding proposal that waits on them. Accepting the proposal
// decides all of it at once.
import { execFileSync } from 'node:child_process';
import { contains, matches, validateFacets } from './bindings.mjs';
import { referencesTo } from './entry-roles.mjs';
import { flatten, nodesToChange, validateInformation } from './information.mjs';
import { editorTabs, layerPackageForProject } from './layer-package.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const openStates = new Set(['suggested', 'ready', 'claimed', 'needs-input', 'review']);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const roleWords = { authority: 'leads', replica: 'keeps a copy', ceded: 'hands over' };

export function knowledgeSite({ db, pool, store, changes, refacets, docs }) {
  const member = (projectId, userId) => db.prepare('SELECT role FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId)?.role || fail('Project not found.', 404);
  const installed = projectId => db.prepare('SELECT layer_key AS key FROM layer_instances WHERE project_id = ? AND enabled = 1 ORDER BY rowid').all(projectId).map(row => row.key);
  function layer(projectId, key) {
    const pkg = layerPackageForProject(db, projectId, key) || fail(`${key} is not installed.`, 404);
    const { manifest } = pkg;
    const tabs = editorTabs(manifest);
    return { key, name: manifest.name, icon: manifest.icon || 'layers', commit: pkg.commit, repo: pkg.repo, manifest, tabs,
      information: validateInformation(manifest, { tabs }), facets: validateFacets(manifest),
      tabLabels: Object.fromEntries([...(manifest.tabs || []).map(tab => [tab.key, tab.label]), ...(tabs.includes('files') ? [['files', 'Files']] : [])]) };
  }
  // The nodes a facet holds: the highest ones whose whole selection it covers.
  const nodesOf = (info, facet) => {
    const inside = node => node.select.every(part => facet.select.some(whole => contains(whole, part)));
    const out = [];
    const walk = nodes => { for (const node of nodes) { if (inside(node)) out.push(node.key); else walk(node.children || []); } };
    walk(info);
    return out;
  };
  const nodeBrief = (info, keys) => flatten(info).filter(node => keys.includes(node.key)).map(node => ({ key: node.key, title: node.title, intent: node.intent, path: node.path }));

  // A record schema's fields from the layer's own API document, for parts that don't state a shape.
  function fieldsFor(target, kinds) {
    const spec = target.manifest.api?.spec && (() => { try { return JSON.parse(execFileSync('git', ['-C', target.repo, 'show', `${target.commit}:${target.root || ''}${target.manifest.api.spec}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })); } catch { return null; } })();
    const follow = ref => ref.split('/').slice(1).reduce((at, part) => at?.[part], spec);
    const resolve = schema => typeof schema === 'string' ? follow(schema) : schema?.$ref ? follow(schema.$ref) : schema;
    const fields = [];
    for (const kind of kinds) {
      const schema = resolve(spec?.['x-aludel-records']?.[kind]);
      for (const [name, value] of Object.entries(schema?.properties || {})) {
        const field = resolve(value) || {};
        const type = field.type ? (field.type === 'array' ? `${resolve(field.items)?.type || 'object'}[]` : field.enum ? 'enum' : field.type) : value.$ref ? value.$ref.split('/').pop() : 'object';
        if (!fields.some(item => item[0] === name)) fields.push([name, type, field.description || (field.enum ? field.enum.join(', ') : '')]);
      }
    }
    return fields.slice(0, 40);
  }

  // Live and proposed bindings this layer takes part in, as the cards Knowledge shows: which nodes, who leads.
  function bindingCards(projectId, key, targetOf) {
    const cards = [];
    for (const binding of store.all(projectId)) {
      if (binding.lifecycle === 'retired') continue;
      const participants = binding.participants.map(p => {
        const target = targetOf(p.layer.key);
        const facet = target?.facets.find(item => item.key === p.facet);
        const nodes = target && facet ? nodesOf(target.information, facet) : [];
        return { layer: p.layer.key, name: target?.name || p.layer.key, icon: target?.icon || 'layers', role: p.role, lead: p.id === binding.authority, nodes: target ? nodeBrief(target.information, nodes) : [] };
      });
      if (!participants.some(p => p.layer === key)) continue;
      cards.push({ id: binding.id, kind: 'binding', name: binding.concept.name, statement: binding.concept.description || '', status: binding.lifecycle === 'proposed' ? 'proposed' : 'live', lifecycle: binding.lifecycle, participants });
    }
    const proposals = db.prepare(`SELECT id, state, context_json, created_at FROM layer_work_items WHERE project_id = ? AND archived_at IS NULL
      AND json_extract(context_json, '$.routine') = 'binding-change' AND json_extract(context_json, '$.change.kind') = 'create' AND json_extract(context_json, '$.knowledge') IS NOT NULL`).all(projectId);
    for (const row of proposals) {
      if (!openStates.has(row.state)) continue;
      const context = JSON.parse(row.context_json), plan = context.knowledge;
      if (!plan.participants.some(p => p.layer === key)) continue;
      cards.push({ id: row.id, kind: 'proposal', name: context.change.binding.concept.name, statement: plan.statement, status: 'proposed', since: row.created_at, effects: plan.effects,
        participants: plan.participants.map(p => { const target = targetOf(p.layer); return { layer: p.layer, name: target?.name || p.layer, icon: target?.icon || 'layers', role: p.role, lead: p.role === 'authority', nodes: target ? nodeBrief(target.information, p.nodes) : [] }; }) });
    }
    return cards;
  }
  const targets = projectId => { const cache = new Map(); return key => { if (!cache.has(key)) { try { cache.set(key, layer(projectId, key)); } catch { cache.set(key, null); } } return cache.get(key); }; };

  function site(projectId, userId, key) {
    const role = member(projectId, userId);
    const targetOf = targets(projectId), target = targetOf(key) || fail(`${key} is not installed.`, 404);
    const entries = pool.outputEntries(projectId).filter(entry => entry.layer.key === key);
    const cards = bindingCards(projectId, key, targetOf);
    const shareOf = node => cards.filter(card => card.participants.some(p => p.layer === key && p.nodes.some(item => item.key === node.key || node.path.includes(item.key))))
      .map(card => ({ id: card.id, name: card.name, status: card.status, role: card.participants.find(p => p.layer === key).role }));
    const shape = node => node.shape || { fields: fieldsFor(target, [...new Set(node.select.map(clause => clause.kind))]) };
    const tree = nodes => nodes.map(node => ({ key: node.key, title: node.title, intent: node.intent, tab: node.tab, doc: node.doc || null, select: node.select, shape: shape(node),
      count: entries.filter(entry => node.select.some(clause => matches(clause, entry))).length, shared: shareOf({ ...node, path: flatten(target.information).find(item => item.key === node.key).path }),
      ...(node.children ? { children: tree(node.children) } : {}) }));
    const refers = Array.isArray(target.manifest.refers) ? target.manifest.refers : [];
    return { layer: { key, name: target.name, icon: target.icon, commit: target.commit, tabs: target.tabLabels, refers },
      canEdit: role === 'owner', docs: docs.list(projectId, userId, key).docs, information: tree(target.information), bindings: cards,
      layers: installed(projectId).filter(other => other !== key).map(other => targetOf(other)).filter(Boolean).map(other => ({ key: other.key, name: other.name, icon: other.icon })) };
  }

  // What one node holds now, newest first, and who else points into it.
  function contents(projectId, userId, key, nodeKey) {
    member(projectId, userId);
    const target = layer(projectId, key);
    const node = flatten(target.information).find(item => item.key === nodeKey) || fail(`${target.name} has no information ${nodeKey}.`, 404);
    const all = pool.outputEntries(projectId);
    const held = all.filter(entry => entry.layer.key === key && node.select.some(clause => matches(clause, entry)))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const references = referencesTo(all, held.map(entry => entry.ref), { exceptLayer: key });
    const by = new Map();
    for (const reference of references) by.set(reference.layer, (by.get(reference.layer) || 0) + 1);
    const names = Object.fromEntries(all.map(entry => [entry.layer.key, entry.layer.name]));
    return { node: nodeKey, total: held.length, entries: held.slice(0, 100).map(entry => ({ ref: entry.ref, kind: entry.kind, title: entry.title, revision: entry.revision, updatedAt: entry.updatedAt || null })),
      referencedBy: [...by].map(([layerKey, count]) => ({ layer: layerKey, name: names[layerKey] || layerKey, count })) };
  }

  // A binding or proposal, as its page shows it.
  function binding(projectId, userId, id) {
    member(projectId, userId);
    const targetOf = targets(projectId);
    const keys = installed(projectId);
    const card = keys.flatMap(key => bindingCards(projectId, key, targetOf)).find(item => item.id === id) || fail('Binding not found.', 404);
    if (card.kind === 'binding') {
      const events = store.events(projectId, userId, id, 30).map(event => ({ at: event.createdAt || event.created_at, kind: event.kind, detail: event.detail }));
      const open = changes.pending(projectId, id);
      return { ...card, events, pending: open.map(item => ({ id: item.id, change: item.change, blocked: item.blockedBy.length > 0 })) };
    }
    const row = db.prepare('SELECT context_json FROM layer_work_items WHERE id = ?').get(id);
    return { ...card, blockedBy: changes.blockedBy(projectId, id), rationale: JSON.parse(row.context_json).rationale || null };
  }

  // ---- Binding from the tree ----
  // input: { name, statement, participants: [{ layer, nodes: [keys], lead?: bool, copy?: bool }] }
  function plan(projectId, userId, input) {
    member(projectId, userId);
    const parts = Array.isArray(input?.participants) ? input.participants : [];
    if (parts.length < 2) fail('Bind information of at least two layers.');
    if (new Set(parts.map(part => part.layer)).size !== parts.length) fail('Each layer takes part once; tick all its parts in one card.');
    if (parts.filter(part => part.lead).length !== 1) fail('Choose the one layer that leads.');
    const bindings = store.all(projectId);
    const all = pool.outputEntries(projectId);
    const steps = [], participants = [], effects = [], renegotiated = new Map();
    let leadName = '';
    for (const part of parts) {
      const target = layer(projectId, part.layer);
      const result = nodesToChange({ key: target.key, name: target.name, outputs: target.manifest.outputs, tabs: target.tabs, facets: target.manifest.facets || [], information: target.manifest.information }, part.nodes, { bindings });
      const role = part.lead ? 'authority' : part.copy === false ? 'ceded' : 'replica';
      const existing = target.facets.find(facet => facet.key === (result.change?.op === 'split' ? result.change.facet : result.facet));
      const roles = result.change?.op === 'declare' ? result.change.into.roles : existing?.roles || [];
      if (!roles.includes(role)) fail(`${target.name}'s ${result.title} can't ${roleWords[role].replace('leads', 'lead')} here: it supports ${roles.map(item => roleWords[item]).join(' or ')}.`, 409);
      if (result.change) steps.push({ layer: target.key, change: result.change });
      const shape = existing && result.change?.op !== 'split' ? existing.shape : `${target.key}.${result.facet}`;
      participants.push({ id: `${target.key}-${result.facet}`.replaceAll('_', '-').slice(0, 63), layer: { key: target.key }, facet: result.facet, role, shape });
      for (const id of result.renegotiates) renegotiated.set(id, [...(renegotiated.get(id) || []), { layer: target.name, title: result.title }]);
      if (part.lead) leadName = target.name;
      part.target = target; part.result = result; part.role = role;
    }
    for (const part of parts) {
      const what = `${part.target.name}'s ${part.result.title}`;
      if (part.role === 'authority') effects.push(`${what} lead: changes are made there.`);
      else if (part.role === 'replica') effects.push(`${what} keep a local copy of ${leadName}'s: read-only in ${part.target.name}, with Propose a change.`);
      else {
        effects.push(`${what} hand over to ${leadName}: what is there now is offered to ${leadName} once, as Work, then stays read-only, pointing to ${leadName}.`);
        const nodes = flatten(part.target.information).filter(node => part.result.nodes.includes(node.key));
        const refs = all.filter(entry => entry.layer.key === part.target.key && nodes.some(node => node.select.some(clause => matches(clause, entry)))).map(entry => entry.ref);
        const pointing = referencesTo(all, refs, { exceptLayer: part.target.key });
        const by = new Map(); for (const reference of pointing) by.set(reference.layer, (by.get(reference.layer) || 0) + 1);
        for (const [key, count] of by) effects.push(`${targets(projectId)(key)?.name || key} points at ${what} (${count} reference${count === 1 ? '' : 's'}): it gets Work to point at ${leadName} instead.`);
      }
    }
    for (const [id, leaving] of renegotiated) {
      const name = bindings.find(item => item.id === id)?.concept.name || id;
      effects.push(`Renegotiates ${name}: ${leaving.map(item => `${item.layer}'s ${item.title}`).join(' and ')} ${leaving.length > 1 ? 'leave' : 'leaves'} it for this binding. ${name} keeps the rest. One decision covers both.`);
    }
    const name = text(input.name, 120) ? input.name.trim() : fail('Name what is shared.');
    const statement = typeof input.statement === 'string' ? input.statement.trim().slice(0, 2000) : '';
    const authority = participants.find(item => item.role === 'authority').id;
    return { steps, effects, renegotiates: [...renegotiated.keys()], binding: { concept: { name, ...(statement ? { description: statement } : {}) }, authority, participants },
      knowledge: { statement, effects, participants: parts.map(part => ({ layer: part.target.key, nodes: part.result.nodes, role: part.role })) } };
  }
  const preview = (projectId, userId, input) => { const planned = plan(projectId, userId, input); return { effects: planned.effects, renegotiates: planned.renegotiates, refacets: planned.steps }; };
  function propose(projectId, userId, input) {
    const planned = plan(projectId, userId, input);
    const chain = refacets.chain(projectId, userId, { refacets: planned.steps, binding: planned.binding, rationale: planned.knowledge.statement || null });
    const row = db.prepare('SELECT context_json FROM layer_work_items WHERE id = ?').get(chain.proposal.id);
    db.prepare('UPDATE layer_work_items SET context_json = ? WHERE id = ?').run(JSON.stringify({ ...JSON.parse(row.context_json), knowledge: planned.knowledge }), chain.proposal.id);
    return { id: chain.proposal.id, refacets: chain.refacets.map(item => item.id) };
  }
  // Accepting a proposal accepts the refacets it waits on, then the binding; dismissing it dismisses them too.
  function decide(projectId, userId, id, decision) {
    const waiting = db.prepare(`SELECT id FROM layer_work_items WHERE project_id = ? AND archived_at IS NULL AND state <> 'done'
      AND json_extract(context_json, '$.routine') = 'refacet' AND EXISTS (SELECT 1 FROM json_each(blocks_json) WHERE value = ?) ORDER BY number`).all(projectId, id).map(row => row.id);
    if (decision === 'dismiss') { for (const item of waiting) refacets.decide(projectId, userId, item, 'dismiss', 'The binding was dismissed.'); return changes.decide(projectId, userId, id, 'dismiss'); }
    for (const item of waiting) refacets.decide(projectId, userId, item, 'accept');
    return changes.decide(projectId, userId, id, 'accept');
  }

  return { site, contents, binding, preview, propose, decide };
}
