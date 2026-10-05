// The layer contract, checked from inside the repository. Runs on any branch and in any fork.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const layer = JSON.parse(read('layer.json'));
const key = /^[a-z][a-z0-9_]{2,31}$/;

test('the manifest is a valid layer', () => {
  assert.equal(layer.schemaVersion, 1);
  assert.equal(layer.hostSdkVersion, 1);
  assert.match(layer.key, key);
  assert.ok(layer.name?.trim());
  assert.match(layer.path, /^\/[a-z][a-z0-9-]*$/);
  assert.ok(Array.isArray(layer.outputs) && layer.outputs.every(kind => /^[a-z][a-z0-9_]*$/.test(kind)));
  assert.equal(new Set(layer.outputs).size, layer.outputs.length);
  assert.ok(Array.isArray(layer.tabs));
  for (const path of [layer.knowledge.charter, ...layer.knowledge.documents]) assert.ok(existsSync(new URL(path, root)), `${path} exists`);
  // Each output is kept one way: as records through the layer's API, or as files in this repository.
  const fileKinds = layer.files?.kinds || [];
  if (layer.outputs.some(kind => !fileKinds.includes(kind))) assert.ok(layer.api, 'a layer with record outputs publishes an API');
});

test('the API writes only this layer\'s outputs and every operation has a handler', { skip: !layer.api }, async () => {
  const spec = JSON.parse(read(layer.api.spec));
  assert.equal(spec.openapi, '3.1.0');
  const handler = await import(new URL(layer.api.handler, root));
  assert.equal(typeof handler.normalize, 'function');
  assert.equal(typeof handler.run, 'function');
  const operations = Object.values(spec.paths).flatMap(path => Object.values(path)).filter(op => op?.operationId);
  assert.equal(new Set(operations.map(op => op.operationId)).size, operations.length, 'operation IDs are unique');
  for (const kind of layer.outputs.filter(kind => !(layer.files?.kinds || []).includes(kind))) assert.ok(spec['x-aludel-records']?.[kind], `${kind} has a record schema`);
  for (const kind of layer.files?.kinds || []) assert.ok(!spec['x-aludel-records']?.[kind], `${kind} is kept as files, not records`);
  for (const op of operations) {
    if (!op['x-aludel-output']) { assert.ok(['list', 'get', 'singleton'].includes(op['x-aludel-read']?.mode), `${op.operationId} reads or writes`); continue; }
    assert.ok(layer.outputs.includes(op['x-aludel-output']), `${op.operationId} writes a declared output`);
    assert.equal(op['x-aludel-staging'], 'record');
    assert.ok(['normal', 'elevated'].includes(op['x-aludel-access']));
    try { handler.run(op.operationId, { body: {} }, { catalogs: {}, records: {} }); }
    catch (error) { assert.doesNotMatch(error.message, /Unknown .*operation/, `${op.operationId} has a handler`); }
  }
});

// A nested package (under .aludel/) may declare repository files as output; a package at the root owns its repository.
test('repository outputs are globs inside the repository, and never secrets, Git or CI', { skip: !layer.files?.repository }, () => {
  // In a template branch the package is the checkout; installed, it sits under .aludel/ (the case this field is for).
  assert.ok(root.pathname.endsWith('/.aludel/') || !existsSync(new URL('../layer.json', root)), 'only a package under .aludel/ declares files.repository');
  assert.ok(Array.isArray(layer.files.repository) && layer.files.repository.length && layer.files.repository.length <= 20);
  for (const glob of layer.files.repository) {
    assert.match(glob, /^(?:\*\*|[A-Za-z0-9_.*-]+)(?:\/(?:\*\*|[A-Za-z0-9_.*-]+))*\/?$/, `${glob} is a repository glob`);
    assert.ok(!glob.split('/').includes('..') && !/^\.env|^\.git\b/.test(glob), `${glob} stays inside the repository and away from secrets and Git`);
  }
  if (layer.files.units) assert.ok(layer.files.kinds.length, 'units come with the kinds the indexer makes of them');
});

// Docs the repository already keeps (an app's AGENTS.md and docs/), named by repository path.
test('knowledge.docs names Markdown inside the repository', { skip: !layer.knowledge?.docs }, () => {
  const docs = layer.knowledge.docs, inside = path => typeof path === 'string' && path && !path.startsWith('/') && !path.split('/').includes('..') && !/(^|\/)\.env/.test(path);
  assert.ok(Array.isArray(docs.paths) && docs.paths.length && docs.paths.length <= 20 && docs.paths.every(path => inside(path) && (path.endsWith('/') || path.endsWith('.md'))), 'paths are Markdown files or folders');
  if (docs.map !== undefined) assert.ok(inside(docs.map) && docs.map.endsWith('.md'), 'the map is a Markdown file');
  if (docs.sources !== undefined) assert.ok(inside(docs.sources) && docs.sources.endsWith('.json'), 'the sources sidecar is a JSON file');
});

// Information: the layer's spec. Each part has a unique key, a title, a one-line intent, what it covers, and the tab it is
// edited in; parts sit inside their parent and siblings don't overlap. (The host's own check is stricter about clauses.)
const editors = new Set([...layer.tabs.map(tab => tab.key), ...(layer.editorAdapter === 'markdown-editor' ? ['files'] : [])]);
const covers = node => (Array.isArray(node.select) ? node.select : [node.select]).map(clause => ({ kind: clause?.kind, field: clause?.where?.field,
  values: clause?.where ? clause.where.equals !== undefined ? [clause.where.equals] : clause.where.in || clause.where.notIn : null, not: !!clause?.where?.notIn }));
const meets = (a, b) => a.kind === b.kind && (!a.field || !b.field || a.field !== b.field || a.not || b.not || a.values.some(value => b.values.includes(value)));
const within = (part, whole) => part.kind === whole.kind && (!whole.field || part.field === whole.field && !part.not && !whole.not && part.values.every(value => whole.values.includes(value)));
test('information says what each part is for, covers this layer\'s outputs, and names where it is edited', { skip: !layer.information }, () => {
  const keys = new Set();
  const visit = (nodes, parent) => {
    assert.ok(Array.isArray(nodes) && nodes.length);
    for (const node of nodes) {
      assert.match(node.key, /^[a-z][a-z0-9-]{0,62}$/);
      assert.ok(!keys.has(node.key), `${node.key} is unique`); keys.add(node.key);
      assert.ok(node.title?.trim() && node.title.length <= 80, `${node.key} has a title`);
      assert.ok(node.intent?.trim() && node.intent.length <= 240, `${node.key} says what it is for`);
      const clauses = covers(node);
      assert.ok(clauses.every(clause => layer.outputs.includes(clause.kind)), `${node.key} covers this layer's outputs`);
      if (parent) assert.ok(clauses.every(part => covers(parent).some(whole => within(part, whole))), `${node.key} sits inside ${parent.key}`);
      assert.ok(editors.has(node.tab), `${node.key} names the tab it is edited in`);
      if (node.doc) assert.ok(/^knowledge\/[a-z][a-z0-9-]*\.md$/.test(node.doc) && existsSync(new URL(node.doc, root)), `${node.key}'s doc exists`);
      if (node.children) visit(node.children, node);
    }
    const all = nodes.flatMap(node => covers(node).map(clause => ({ key: node.key, clause })));
    for (const [i, a] of all.entries()) for (const b of all.slice(i + 1)) assert.ok(a.key === b.key || !meets(a.clause, b.clause), `${a.key} and ${b.key} don't overlap`);
  };
  visit(layer.information, null);
});

// Facets: distinct slices of what this layer maintains and publishes, and the roles each can take in a project's bindings.
// A facet selects whole kinds, or one kind narrowed by one field (`where`: equals, in or notIn); no entry is in two facets.
const clausesOf = facet => (facet.select || (facet.kinds || []).map(kind => ({ kind }))).map(clause => {
  const where = clause.where;
  if (!where) return { kind: clause.kind };
  return { kind: clause.kind, field: where.field, values: 'equals' in where ? [where.equals] : where.in || where.notIn, not: 'notIn' in where };
});
const overlaps = (a, b) => a.kind === b.kind && (!a.field || !b.field || a.field !== b.field || (a.not && b.not)
  || (!a.not && !b.not ? a.values.some(value => b.values.includes(value)) : (a.not ? b : a).values.some(value => !(a.not ? a : b).values.includes(value))));
test('facets select this layer\'s own outputs, never overlap, and name the roles they support', { skip: !layer.facets }, () => {
  const tabs = new Set(layer.tabs.map(tab => tab.key)), taken = [];
  assert.ok(Array.isArray(layer.facets));
  assert.equal(new Set(layer.facets.map(facet => facet.key)).size, layer.facets.length, 'facet keys are unique');
  for (const facet of layer.facets) {
    assert.match(facet.key, /^[a-z][a-z0-9-]{0,62}$/);
    assert.ok(facet.title?.trim(), `${facet.key} has a title`);
    assert.ok(!(facet.select && facet.kinds), `${facet.key} names select or kinds, not both`);
    const clauses = clausesOf(facet);
    assert.ok(clauses.length && clauses.every(clause => layer.outputs.includes(clause.kind)), `${facet.key} selects this layer's outputs`);
    for (const clause of clauses) {
      if (clause.field) assert.ok(/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(clause.field) && Array.isArray(clause.values) && clause.values.length, `${facet.key} narrows ${clause.kind} by one field`);
      const clash = taken.find(other => overlaps(other.clause, clause));
      assert.ok(!clash, `${facet.key} and ${clash?.facet} both select ${clause.kind}: each entry belongs to one facet`);
      taken.push({ facet: facet.key, clause });
    }
    assert.ok(facet.roles?.length && facet.roles.every(role => ['authority', 'replica', 'ceded'].includes(role)), `${facet.key} names supported roles`);
    assert.ok(!facet.readOnly || (facet.roles.length === 1 && facet.roles[0] === 'authority'), `${facet.key} is read-only, so it can only be an authority`);
    assert.ok((facet.views || []).every(view => tabs.has(view)), `${facet.key}'s views are tabs`);
  }
});

test('refers names the kinds this layer\'s references can point at', { skip: !layer.refers }, () => {
  assert.ok(Array.isArray(layer.refers) && layer.refers.length && (layer.refers.length === 1 && layer.refers[0] === '*' || layer.refers.every(kind => /^[a-z][a-z0-9_]*$/.test(kind))));
});

// A facet's views show its role: read-only with "Propose a change" as a replica, a pointer when ceded. They use the host's
// roles module for that, since the host refuses writes to replica and ceded entries whatever a view does.
test('views that edit a facet use the host\'s roles module', { skip: !layer.facets?.some(facet => facet.views?.length) }, () => {
  assert.ok(layer.ui?.hostSdk?.includes('roles'), 'ui.hostSdk lists roles');
  const sources = (layer.ui.files || []).filter(path => path.endsWith('.ts')).map(read);
  assert.ok(sources.some(source => source.includes("from '@aludel/host/roles'")), 'a view imports @aludel/host/roles');
});

// .aludel/outputs/<kind>.json is the copy of current outputs a run's sandbox receives; the rules must still accept them.
const outputs = new URL('.aludel/outputs/', root);
test('the handler still accepts every current output in the sandbox copy', { skip: !layer.api || !existsSync(outputs) }, async () => {
  const handler = await import(new URL(layer.api.handler, root));
  const catalogs = existsSync(new URL('catalogs.json', outputs)) ? JSON.parse(readFileSync(new URL('catalogs.json', outputs), 'utf8')) : {};
  for (const file of readdirSync(outputs).filter(name => name.endsWith('.json') && name !== 'catalogs.json')) {
    const kind = file.slice(0, -5);
    for (const record of JSON.parse(readFileSync(new URL(file, outputs), 'utf8')))
      assert.doesNotThrow(() => handler.normalize(kind, record.data, { catalogs }), `${kind} ${record.id}`);
  }
});

// Repository-mode outputs: the files under outputs/ index into entries with stable IDs; a layer that also writes its files
// from entries must round-trip them unchanged.
test('output files index into entries, and entries write back to the same files', { skip: !layer.files }, async () => {
  const { paths, kinds, indexer } = layer.files;
  assert.ok(paths.length && paths.every(path => /^outputs\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\.(?:json|md|ya?ml)$/.test(path)), 'output files live under outputs/');
  assert.ok(kinds.length && kinds.every(kind => layer.outputs.includes(kind)), 'file kinds are this layer\'s outputs');
  const module = await import(new URL(indexer, root));
  assert.equal(typeof module.entries, 'function');
  const files = Object.fromEntries(paths.filter(path => existsSync(new URL(path, root))).map(path => [path, read(path)]));
  const entries = module.entries(files, { kinds });
  assert.ok(Array.isArray(entries));
  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length, 'entry IDs are unique');
  for (const entry of entries) {
    assert.match(entry.id, /^[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]{1,62}$/);
    assert.ok(kinds.includes(entry.kind) && entry.title?.trim() && entry.data && typeof entry.data === 'object', `${entry.id} is a valid entry`);
  }
  if (typeof module.fromEntries === 'function') assert.deepEqual(module.entries(module.fromEntries(entries, { files }), { kinds }), entries, 'entries round-trip through the files');
});
