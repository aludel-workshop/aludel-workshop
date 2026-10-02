// LAYER-KNOWLEDGE-01 S1: a layer's information as a spec, and ticked nodes turned into the refacet a binding needs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { facetOf, refacet } from '../server/bindings.mjs';
import { flatten, nodesToChange, validateInformation } from '../server/information.mjs';

const pages = {
  key: 'pages', outputs: ['page_map', 'page', 'flow', 'kit_item'], tabs: [{ key: 'map' }, { key: 'page' }, { key: 'flows' }, { key: 'kit' }],
  facets: [{ key: 'kit', title: 'App kit', kinds: ['kit_item'], roles: ['replica'] }],
  information: [
    { key: 'pages', title: 'Pages', intent: 'Each screen a person can reach.', select: { kind: 'page' }, tab: 'page', shape: { fields: [['label', 'string', 'Name']] } },
    { key: 'flows', title: 'Flows', intent: 'Journeys across pages.', select: { kind: 'flow' }, tab: 'flows' },
    { key: 'kit', title: 'Kit', intent: 'What pages are drawn with.', select: { kind: 'kit_item' }, tab: 'kit', children: [
      { key: 'kit-tokens', title: 'Tokens', intent: 'Colour roles and type.', select: { kind: 'kit_item', where: { field: 'group', equals: 'tokens' } }, tab: 'kit' },
      { key: 'kit-brand', title: 'Brand', intent: 'Name and mark.', select: { kind: 'kit_item', where: { field: 'group', equals: 'brand' } }, tab: 'kit' }] }]
};
const markdown = { key: 'personas', name: 'Personas', outputs: ['markdown_document', 'markdown_folder'], tabs: ['files'], facets: [],
  information: [{ key: 'documents', title: 'Documents', intent: 'Markdown documents.', select: { kind: 'markdown_document' }, tab: 'files', children: [
    { key: 'people', title: 'Personas', intent: 'One document per persona.', select: { kind: 'markdown_document', where: { field: 'folder', equals: 'personas' } }, tab: 'files', shape: { format: '# {Name}' } },
    { key: 'notes', title: 'Notes', intent: 'Loose improvement notes.', select: { kind: 'markdown_document', where: { field: 'folder', equals: 'notes' } }, tab: 'files', shape: { free: true } }] }] };
const tabsOf = layer => Array.isArray(layer.tabs) && typeof layer.tabs[0] === 'string' ? layer.tabs : layer.tabs.map(tab => tab.key);
const check = (layer, information = layer.information) => validateInformation({ ...layer, information }, { tabs: tabsOf(layer) });
const without = (layer, path, edit) => { const copy = structuredClone(layer.information); edit(path(copy)); return copy; };

test('a valid tree comes back in normal form, with its parts flattened in order', () => {
  const tree = check(pages);
  assert.deepEqual(tree[2].children[0].select, [{ kind: 'kit_item', where: { field: 'group', in: ['tokens'] } }]);
  assert.deepEqual(flatten(tree).map(node => [node.key, node.path.join('/')]), [['pages', ''], ['flows', ''], ['kit', ''], ['kit-tokens', 'kit'], ['kit-brand', 'kit']]);
  assert.deepEqual(validateInformation({ outputs: [] }), [], 'a layer without information has an empty tree');
});

test('each part says what it is for, what it covers and where it is edited, and parts nest and stay apart', () => {
  assert.throws(() => check(pages, without(pages, t => t[0], node => { delete node.intent; })), /needs a one-line intent/);
  assert.throws(() => check(pages, without(pages, t => t[0], node => { node.title = ' '; })), /needs a title/);
  assert.throws(() => check(pages, without(pages, t => t[0], node => { delete node.select; })), /must say what it covers/);
  assert.throws(() => check(pages, without(pages, t => t[0], node => { node.select = { kind: 'story' }; })), /own output kinds/);
  assert.throws(() => check(pages, without(pages, t => t[0], node => { node.select = [{ kind: 'page' }, { kind: 'page', where: { field: 'status', equals: 'built' } }]; })), /covers page twice/);
  assert.throws(() => check(pages, without(pages, t => t[0], node => { delete node.tab; })), /editor tab/);
  assert.throws(() => check(pages, without(pages, t => t[0], node => { node.tab = 'nowhere'; })), /editor tab/);
  assert.throws(() => check(pages, without(pages, t => t[1], node => { node.key = 'pages'; })), /unique key/);
  assert.throws(() => check(pages, without(pages, t => t[2].children[1], node => { node.select = { kind: 'page' }; })), /covers more than kit/);
  assert.throws(() => check(pages, without(pages, t => t[2].children[1], node => { node.select = { kind: 'kit_item', where: { field: 'group', in: ['brand', 'tokens'] } }; })), /kit-tokens and kit-brand both cover kit_item/);
  assert.throws(() => check(pages, without(pages, t => t[1], node => { node.select = { kind: 'page', where: { field: 'status', equals: 'built' } }; })), /pages and flows both cover page/);
  assert.throws(() => check(pages, without(pages, t => t[0], node => { node.doc = 'docs/pages.md'; })), /knowledge\/\*\.md/);
  assert.throws(() => check(pages, without(pages, t => t[0], node => { node.shape = { fields: 'many' }; })), /shape is fields/);
  assert.throws(() => check(pages, without(pages, t => t[2], node => { node.children = []; })), /non-empty list/);
  const deep = n => n ? { key: `d${n}`, title: 'Deep', intent: 'Deep.', select: { kind: 'page' }, tab: 'page', ...(n > 1 ? { children: [deep(n - 1)] } : {}) } : null;
  assert.throws(() => check(pages, [deep(5)]), /at most 4 deep/);
  assert.doesNotThrow(() => check(pages, [deep(4)]));
  const many = n => [{ key: 'all', title: 'All', intent: 'All.', select: { kind: 'kit_item' }, tab: 'kit', children: Array.from({ length: n }, (_, i) => ({ key: `g${i}`, title: 'G', intent: 'G.', select: { kind: 'kit_item', where: { field: 'group', equals: `g${i}` } }, tab: 'kit' })) }];
  assert.throws(() => check(pages, many(60)), /at most 60 parts/);
  assert.doesNotThrow(() => check(pages, many(59)));
});

test('a folder of Markdown documents is a part: `folder` comes from each document\'s path', () => {
  const tree = check(markdown);
  const people = flatten(tree).find(node => node.key === 'people');
  const facets = [{ key: 'people', select: people.select }];
  assert.equal(facetOf(facets, { kind: 'markdown_document', data: { path: 'personas/borrower.md' } }), 'people');
  assert.equal(facetOf(facets, { kind: 'markdown_document', data: { path: 'notes/deposits.md' } }), null);
  assert.equal(facetOf(facets, { kind: 'markdown_document', data: { path: 'personas.md' } }), null, 'a top-level file is in folder ""');
  assert.equal(facetOf(facets, { kind: 'markdown_document', data: { path: 'x.md', folder: 'personas' } }), 'people', 'a folder field of its own wins');
});

const binding = (id, lifecycle, participants) => ({ id, lifecycle, participants: participants.map(([layer, facet]) => ({ id: `${layer}-${facet}`, layer: { key: layer }, facet })) });

test('ticked parts nothing holds yet are declared as a new facet', () => {
  const result = nodesToChange(markdown, ['people']);
  assert.equal(result.facet, 'people');
  assert.deepEqual(result.change, { op: 'declare', into: { key: 'people', title: 'Personas', take: [{ kind: 'markdown_document', where: { field: 'folder', in: ['personas'] } }], roles: ['authority', 'replica', 'ceded'] } });
  const entries = [{ ref: 'a', kind: 'markdown_document', data: { path: 'personas/a.md' } }, { ref: 'b', kind: 'markdown_document', data: { path: 'notes/b.md' } }];
  const applied = refacet({ key: 'personas', outputs: markdown.outputs, facets: [] }, result.change, { entries });
  assert.deepEqual(applied.preflight.records.map(item => item.ref), ['a'], 'the refacet accepts the change and moves just the folder');
  assert.deepEqual(nodesToChange(markdown, ['people', 'notes']).change.into.take, [{ kind: 'markdown_document', where: { field: 'folder', in: ['notes', 'personas'] } }]);
});

test('part of a facet is split off; when that facet is bound, its binding is renegotiated in the same decision', () => {
  const unbound = nodesToChange(pages, ['kit-brand']);
  assert.deepEqual(unbound, { facet: 'kit-brand', title: 'Brand', nodes: ['kit-brand'], renegotiates: [],
    change: { op: 'split', facet: 'kit', into: { key: 'kit-brand', title: 'Brand', take: [{ kind: 'kit_item', where: { field: 'group', in: ['brand'] } }], roles: ['replica'] } } });
  const bound = nodesToChange(pages, ['kit-brand'], { bindings: [binding('design-system', 'active', [['design', 'kit'], ['pages', 'kit']]), binding('old', 'retired', [['pages', 'kit']])] });
  assert.deepEqual(bound.renegotiates, ['design-system'], 'only live bindings are renegotiated');
  const entries = [{ ref: 'k1', kind: 'kit_item', data: { group: 'brand' } }, { ref: 'k2', kind: 'kit_item', data: { group: 'tokens' } }];
  assert.deepEqual(refacet(pages, bound.change, { entries }).preflight.records.map(item => item.ref), ['k1']);
  // A new facet's key never clashes with one the layer has.
  const clash = nodesToChange({ ...pages, facets: [...pages.facets, { key: 'kit-brand', title: 'Old', kinds: ['page'], roles: ['authority'] }] }, ['kit-brand']);
  assert.equal(clash.facet, 'kit-brand-2');
});

test('a facet that holds exactly the ticked parts is reused, unless it is already shared as a whole', () => {
  assert.deepEqual(nodesToChange(pages, ['kit']), { facet: 'kit', title: 'App kit', nodes: ['kit'], renegotiates: [], change: null });
  assert.deepEqual(nodesToChange(pages, ['kit', 'kit-brand']).nodes, ['kit'], 'a ticked part of a ticked node comes with it');
  assert.throws(() => nodesToChange(pages, ['kit'], { bindings: [binding('design-system', 'active', [['pages', 'kit']])] }), /already shared as a whole in design-system/);
  assert.doesNotThrow(() => nodesToChange(pages, ['kit'], { bindings: [binding('design-system', 'retired', [['pages', 'kit']])] }));
});

test('parts kept apart, or kept differently, are bound separately', () => {
  assert.throws(() => nodesToChange(pages, ['pages', 'kit-brand']), /keeps these parts apart \(unshared information and App kit\)/);
  const two = { ...pages, facets: [{ key: 'kit', title: 'App kit', select: [{ kind: 'kit_item', where: { field: 'group', in: ['brand', 'other'] } }], roles: ['replica'] },
    { key: 'rest', title: 'Rest', select: [{ kind: 'kit_item', where: { field: 'group', notIn: ['brand', 'other'] } }], roles: ['replica'] }] };
  assert.throws(() => nodesToChange(two, ['kit']), /kept in App kit and Rest differently/);
  assert.throws(() => nodesToChange(pages, []), /Choose some/);
  assert.throws(() => nodesToChange(pages, ['nope']), /has no information nope/);
});
