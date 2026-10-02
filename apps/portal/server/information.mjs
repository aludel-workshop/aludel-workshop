// LAYER-KNOWLEDGE-01: a layer's information, as a spec. `layer.json` `information` is a tree of nodes, each saying what the
// information is for (`intent`), what it covers (`select`, the same clauses facets use), the form it takes (`shape`), and the
// editor tab its contents are edited in (`tab`). People read and bind nodes; facets are what the host stores once nodes are
// bound, so nobody manages them by hand. This module is pure: it validates a tree and turns ticked nodes into the one refacet
// each layer needs for a binding (declare, split, or reuse), naming any binding that is renegotiated by it.
import { contains, declaration, normalClause, overlaps, union } from './bindings.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const keyPattern = /^[a-z][a-z0-9-]{0,62}$/;
const docPattern = /^knowledge\/[a-z][a-z0-9-]*\.md$/;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const maxNodes = 60, maxDepth = 4;

function validShape(shape, key) {
  if (shape === undefined) return undefined;
  if (shape?.free === true && Object.keys(shape).length === 1) return { free: true };
  if (typeof shape?.format === 'string' && shape.format.length <= 4000 && Object.keys(shape).length === 1) return { format: shape.format };
  if (Array.isArray(shape?.fields) && Object.keys(shape).length === 1 && shape.fields.length <= 40
    && shape.fields.every(field => Array.isArray(field) && field.length === 3 && text(field[0], 60) && typeof field[1] === 'string' && field[1].length <= 60 && typeof field[2] === 'string' && field[2].length <= 300))
    return { fields: shape.fields.map(field => [...field]) };
  fail(`Information ${key}: shape is fields, a Markdown format, or free.`);
}

// The tree in normal form, or throws naming the first rule broken. `tabs` are the editor tabs the layer has (its manifest's,
// plus the host adapter's, such as Files for a Markdown layer); every node names one, since contents must be editable.
export function validateInformation(manifest, { tabs = null } = {}) {
  const tree = manifest?.information;
  if (tree === undefined) return [];
  const outputs = Array.isArray(manifest.outputs) ? manifest.outputs : [];
  const editors = new Set(tabs || (manifest.tabs || []).map(tab => tab.key));
  if (!Array.isArray(tree)) fail('Invalid layer information.');
  const keys = new Set();
  let count = 0;
  const node = (input, parent, depth) => {
    if (++count > maxNodes) fail(`A layer's information has at most ${maxNodes} parts.`);
    if (depth > maxDepth) fail(`Information nests at most ${maxDepth} deep.`);
    if (!input || !keyPattern.test(input.key || '') || keys.has(input.key)) fail(`Information needs a unique key for each part${input?.key ? ` (${input.key})` : ''}.`);
    keys.add(input.key);
    if (!text(input.title, 80)) fail(`Information ${input.key} needs a title.`);
    if (!text(input.intent, 240)) fail(`Information ${input.key} needs a one-line intent: what it is for.`);
    const raw = Array.isArray(input.select) ? input.select : input.select ? [input.select] : [];
    if (!raw.length || raw.length > 10) fail(`Information ${input.key} must say what it covers.`);
    const select = raw.map(clause => normalClause(clause, outputs, input.key));
    for (const [i, a] of select.entries()) for (const b of select.slice(i + 1)) if (overlaps(a, b)) fail(`Information ${input.key} covers ${a.kind} twice.`);
    // A part sits inside what its parent covers.
    if (parent && !select.every(part => parent.select.some(whole => contains(whole, part)))) fail(`Information ${input.key} covers more than ${parent.key} does.`);
    if (typeof input.tab !== 'string' || !editors.has(input.tab)) fail(`Information ${input.key} must name the editor tab its contents are edited in.`);
    if (input.doc !== undefined && (typeof input.doc !== 'string' || !docPattern.test(input.doc))) fail(`Information ${input.key}: doc is a knowledge/*.md file.`);
    const out = { key: input.key, title: input.title.trim(), intent: input.intent.trim(), select, tab: input.tab,
      ...(input.doc ? { doc: input.doc } : {}), ...(input.shape !== undefined ? { shape: validShape(input.shape, input.key) } : {}) };
    if (input.children !== undefined) {
      if (!Array.isArray(input.children) || !input.children.length) fail(`Information ${input.key}: children is a non-empty list.`);
      out.children = input.children.map(child => node(child, out, depth + 1));
      // Siblings don't overlap: each entry is in at most one part at each level.
      const clauses = out.children.flatMap(child => child.select.map(clause => ({ key: child.key, clause })));
      for (const [i, a] of clauses.entries()) for (const b of clauses.slice(i + 1))
        if (a.key !== b.key && overlaps(a.clause, b.clause)) fail(`Information ${a.key} and ${b.key} both cover ${a.clause.kind}${a.clause.where ? ` by ${a.clause.where.field}` : ''}.`);
    }
    return out;
  };
  const roots = tree.map(item => node(item, null, 1));
  const clauses = roots.flatMap(root => root.select.map(clause => ({ key: root.key, clause })));
  for (const [i, a] of clauses.entries()) for (const b of clauses.slice(i + 1))
    if (a.key !== b.key && overlaps(a.clause, b.clause)) fail(`Information ${a.key} and ${b.key} both cover ${a.clause.kind}${a.clause.where ? ` by ${a.clause.where.field}` : ''}.`);
  return roots;
}

// Every node of a validated tree, with its ancestors' keys.
export function flatten(tree, path = []) {
  return tree.flatMap(node => [{ ...node, path }, ...flatten(node.children || [], [...path, node.key])]);
}

// Ticked nodes of one layer → the refacet that makes them exactly one facet, for a binding.
//   layer: { key, outputs, tabs, facets, information }   nodes: [keys]   bindings: the project's bindings
// Returns { facet, title, change, renegotiates }: `change` is null when an unbound facet already holds exactly these nodes;
// otherwise a declare (nothing holds them yet) or a split of the one facet that holds more (whose bindings then let them go:
// the renegotiation). Selections that span several facets, or a whole facet already shared elsewhere, are refused with how
// to proceed, since one binding takes one facet of each layer.
export function nodesToChange(layer, nodeKeys, { bindings = [] } = {}) {
  const outputs = layer.outputs || [];
  const all = flatten(validateInformation({ outputs, information: layer.information }, { tabs: (layer.tabs || []).map(tab => typeof tab === 'string' ? tab : tab.key) }));
  if (!Array.isArray(nodeKeys) || !nodeKeys.length) fail(`Choose some of ${layer.name || layer.key}'s information.`);
  const picked = nodeKeys.map(key => all.find(node => node.key === key) || fail(`${layer.name || layer.key} has no information ${key}.`, 404));
  // A ticked part of a ticked node comes with it already.
  const nodes = picked.filter(node => !picked.some(other => other !== node && node.path.includes(other.key)));
  for (const [i, a] of nodes.entries()) for (const b of nodes.slice(i + 1))
    if (a.select.some(x => b.select.some(y => overlaps(x, y)))) fail(`${a.title} and ${b.title} overlap.`);
  const clauses = nodes.reduce((sum, node) => union(sum, node.select), []);
  const facets = (layer.facets || []).map(facet => declaration(facet, outputs));
  const live = bindings.filter(binding => binding.lifecycle !== 'retired');
  const boundIn = key => live.filter(binding => binding.participants.some(p => p.layer.key === layer.key && p.facet === key)).map(binding => binding.id);
  const groups = new Map();
  for (const clause of clauses) {
    const touching = facets.filter(facet => facet.select.some(other => overlaps(other, clause)));
    const holder = touching.length === 1 && touching[0].select.some(whole => contains(whole, clause)) ? touching[0] : null;
    if (touching.length && !holder) fail(`${layer.name || layer.key}'s ${nodes.map(node => node.title).join(', ')} are kept in ${touching.map(facet => facet.title).join(' and ')} differently. Choose parts that sit within one of them.`, 409);
    const key = holder?.key ?? '';
    groups.set(key, [...(groups.get(key) || []), clause]);
  }
  if (groups.size > 1) {
    const names = [...groups.keys()].map(key => key ? facets.find(facet => facet.key === key).title : 'unshared information');
    fail(`${layer.name || layer.key} keeps these parts apart (${names.join(' and ')}). Bind them separately.`, 409);
  }
  const [[holderKey, take]] = groups;
  const title = nodes.map(node => node.title).join(' and ').slice(0, 80);
  const fresh = () => { let key = nodes[0].key, n = 1; while (facets.some(facet => facet.key === key)) key = `${nodes[0].key}-${++n}`; return key; };
  if (!holderKey) {
    const key = fresh();
    return { facet: key, title, nodes: nodes.map(node => node.key), renegotiates: [],
      change: { op: 'declare', into: { key, title, take, roles: ['authority', 'replica', 'ceded'] } } };
  }
  const holder = facets.find(facet => facet.key === holderKey);
  const exact = holder.select.every(whole => take.some(part => contains(part, whole)));
  if (exact) {
    const shared = boundIn(holder.key);
    if (shared.length) fail(`${layer.name || layer.key}'s ${title} is already shared as a whole in ${shared.join(', ')}. Change that binding instead.`, 409);
    return { facet: holder.key, title: holder.title, nodes: nodes.map(node => node.key), renegotiates: [], change: null };
  }
  const key = fresh();
  return { facet: key, title, nodes: nodes.map(node => node.key), renegotiates: boundIn(holder.key),
    change: { op: 'split', facet: holder.key, into: { key, title, take, roles: [...holder.roles] } } };
}
