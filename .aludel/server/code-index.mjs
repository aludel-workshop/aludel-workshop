// The Code layer's indexer and rules. Pure: no imports, no I/O. The host passes the output files and, because the
// manifest asks for `files.units`, the code units it parsed from the repository at the same commit.
//
// - Code units come from the host: one entry per unit, keyed by its stable ID. They are derived, never edited here.
// - Releases (outputs/releases.json) are made on purpose against one commit. What changed since the last release (stack,
//   migrations) is derived by the host at the release's commit.
// - Journeys (outputs/journeys.json) are the steps people take through the app, each with the test that proves it
//   (JOURNEYS-01). A journey is authored (signed through Work), observed (reconstructed from the code, proven by a passing
//   characterization run at a commit) or a replica of another layer's flow. Step IDs stay stable across revisions, so a
//   test, a review note or a claim that names a step keeps meaning it. An entry's ID comes from the journey's own ID.

const semver = /^(\d+)\.(\d+)\.(\d+)$/;
const sha = /^[0-9a-f]{7,40}$/;
const unitKinds = ['function', 'class', 'component', 'const', 'route', 'handler', 'table', 'test', 'other'];
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
const newer = (a, b) => { const x = semver.exec(a).slice(1).map(Number), y = semver.exec(b).slice(1).map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
const slug = /^[a-z][a-z0-9-]{0,63}$/;
const origins = ['authored', 'observed', 'replica'];
const localPath = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\x00-\x20\x7f]/.test(value) && !/%(?:2f|5c|0[ad])/i.test(value) && value.length <= 1000;
const testRef = /^[a-z][a-z0-9-]{0,63}\.spec\.mjs#[a-z][a-z0-9-]{0,63}$/;
const filled = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const optional = (value, check) => value === undefined || value === null || check(value);
export const journeyEntryId = id => `journey-${id}`;

// The journey contract, kept in step with the host's (apps/portal/server/journeys.mjs validateJourney).
function journey(data) {
  if (data.version !== 1) fail('A journey needs version 1.');
  if (!slug.test(data.id || '')) fail('A journey needs a lowercase ID.');
  if (!filled(data.title, 200)) fail(`Journey ${data.id} needs a title.`);
  if (!origins.includes(data.origin)) fail(`Journey ${data.id} is authored, observed or a replica.`);
  if (!Number.isInteger(data.revision) || data.revision < 1) fail(`Journey ${data.id} needs a revision from 1.`);
  if (!optional(data.persona, value => slug.test(value))) fail(`Journey ${data.id} names its persona by ID.`);
  const source = data.source;
  if (data.origin === 'replica' ? !(source && typeof source === 'object' && slug.test(source.layer || '') && filled(source.entry, 200) && Number.isInteger(source.revision))
    : source !== undefined && source !== null) fail(`Journey ${data.id}: only a replica names its source (layer, entry, revision).`);
  const proof = data.proof;
  if (!optional(proof, value => typeof value === 'object' && sha.test(String(value.commit || '')) && ['passed', 'failed'].includes(value.status))) fail(`Journey ${data.id}: a proof names a commit and passed or failed.`);
  if (!Array.isArray(data.steps) || !data.steps.length || data.steps.length > 40) fail(`Journey ${data.id} needs one to forty steps.`);
  const ids = new Set();
  // A journey keeps one persona: its own, or else the first one a step names.
  const persona = data.persona ?? data.steps.find(step => step && step.persona)?.persona;
  const steps = data.steps.map(step => {
    if (!step || typeof step !== 'object' || !slug.test(step.id || '') || ids.has(step.id)) fail(`Journey ${data.id}: every step needs a unique lowercase ID.`);
    ids.add(step.id);
    if (!filled(step.name, 200) || !filled(step.trigger, 500) || !filled(step.expected, 1000)) fail(`Journey ${data.id} step ${step.id} needs a name, a trigger and what is expected.`);
    if (!optional(step.route, localPath)) fail(`Journey ${data.id} step ${step.id}: a route is a local path.`);
    if (!optional(step.persona, value => slug.test(value))) fail(`Journey ${data.id} step ${step.id} names its persona by ID.`);
    if (step.persona && step.persona !== persona) fail(`Journey ${data.id} step ${step.id} is entered as ${step.persona}, but the journey is ${persona}'s. A journey keeps one persona; split a flow that crosses roles into one journey per persona.`);
    if (!optional(step.page, value => filled(value, 200)) || !optional(step.story, value => filled(value, 200))) fail(`Journey ${data.id} step ${step.id}: page and story are references.`);
    if (!optional(step.test, value => testRef.test(value))) fail(`Journey ${data.id} step ${step.id}: a test is named <file>.spec.mjs#<test id>.`);
    const out = { id: step.id, name: step.name, trigger: step.trigger, expected: step.expected };
    for (const field of ['page', 'route', 'persona', 'story', 'test']) if (step[field] !== undefined && step[field] !== null) out[field] = step[field];
    return out;
  });
  const out = { version: 1, id: data.id, title: data.title, origin: data.origin, revision: data.revision };
  if (data.persona) out.persona = data.persona;
  if (data.origin === 'replica') out.source = { layer: source.layer, entry: source.entry, revision: source.revision };
  if (proof) out.proof = { commit: proof.commit, status: proof.status };
  return { ...out, steps };
}

function clean(kind, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('A record needs fields.');
  if (kind === 'code_release') {
    const version = String(data.version || '').trim().replace(/^v/, '');
    if (!semver.test(version)) fail('Use a version like 1.2.3.');
    if (!sha.test(String(data.commit || ''))) fail('A release names the commit it was made from.');
    return { version, commit: data.commit, notes: text(data.notes, 4000), createdBy: text(data.createdBy, 80), createdAt: text(data.createdAt, 40) };
  }
  if (kind === 'journey') return journey(data);
  if (kind === 'code_unit') fail('Code units are read from the repository; change the code instead.');
  fail(`Unknown Code output ${kind}.`);
}
// The host's record calls: the clean record and what it points at outside this layer (nothing yet).
export function normalize(kind, data) {
  // A journey's page, story and persona are informational until the user-journeys binding maps them (LAYER-BINDINGS-01).
  return { data: clean(kind, data), references: [] };
}

const read = (files, path, field) => {
  const raw = files[path];
  if (raw === undefined || raw === null || !raw.trim()) return [];
  let value;
  try { value = JSON.parse(raw); } catch { fail(`${path} is not valid JSON.`); }
  if (!value || !Array.isArray(value[field])) fail(`${path} needs a ${field} list.`);
  return value[field];
};

export function entries(files, { units = [] } = {}) {
  const out = [];
  for (const unit of units) {
    if (!unit || typeof unit.id !== 'string' || typeof unit.key !== 'string') fail('The host returned an invalid unit.');
    out.push({ id: unit.id, kind: 'code_unit', title: `${unit.symbol} · ${unit.path}`.slice(0, 200),
      data: { key: unit.key, path: unit.path, symbol: unit.symbol, kind: unitKinds.includes(unit.kind) ? unit.kind : 'other', hash: unit.hash, line: unit.line, end: unit.end, reachable: !!unit.reachable, calls: unit.calls || [] } });
  }
  const releases = read(files, 'outputs/releases.json', 'releases');
  for (const release of releases) {
    const data = clean('code_release', release);
    out.push({ id: release['x-aludel-id'], kind: 'code_release', title: `v${data.version}`, data });
  }
  checkReleases(out.filter(entry => entry.kind === 'code_release'));
  const journeyIds = new Set();
  for (const item of read(files, 'outputs/journeys.json', 'journeys')) {
    const data = clean('journey', item || {});
    if (journeyIds.has(data.id)) fail(`Journey ${data.id} is recorded twice.`);
    journeyIds.add(data.id);
    out.push({ id: item['x-aludel-id'] || journeyEntryId(data.id), kind: 'journey', title: data.title, data });
  }
  return out;
}

// Versions are unique, and each release is newer than the one before it, in the order they were recorded.
function checkReleases(list) {
  const seen = new Set();
  list.forEach((entry, index) => {
    if (seen.has(entry.data.version)) fail(`v${entry.data.version} is already recorded.`);
    seen.add(entry.data.version);
    const last = list[index - 1];
    if (last && !newer(entry.data.version, last.data.version)) fail(`The version must be newer than v${last.data.version}.`);
  });
}

// Writes releases and journeys back to their files, in a stable order. Units are never written.
export function fromEntries(list, { files = {} } = {}) {
  if (list.some(entry => entry.kind === 'code_unit' && entry.changed)) fail('Code units are read from the repository; change the code instead.');
  const releases = list.filter(entry => entry.kind === 'code_release').map(entry => ({ id: entry.id, data: clean('code_release', entry.data) }));
  checkReleases(releases);
  const out = {};
  const write = (path, field, items) => { const next = `${JSON.stringify({ [field]: items }, null, 2)}\n`; if (items.length || files[path]) out[path] = next; };
  write('outputs/releases.json', 'releases', releases.map(entry => ({ 'x-aludel-id': entry.id, ...entry.data })));
  // A journey written in the repository needs no Aludel ID; one is kept only when it differs from the journey's own.
  const journeys = list.filter(entry => entry.kind === 'journey').map(entry => ({ id: entry.id, data: clean('journey', entry.data) })).sort((a, b) => a.data.id.localeCompare(b.data.id));
  if (new Set(journeys.map(entry => entry.data.id)).size !== journeys.length) fail('Each journey ID is recorded once.');
  write('outputs/journeys.json', 'journeys', journeys.map(entry => entry.id === journeyEntryId(entry.data.id) ? entry.data : { 'x-aludel-id': entry.id, ...entry.data }));
  return out;
}

// ---- Starter docs (seed 'install'): a first docs tree from what the other layers publish ----
// The adapter: this layer reads other layers only through Library entries, by the shape it understands (kind and fields),
// never by which layer published them. Anything missing just leaves its section saying so.
export function adapt(entries) {
  const of = kind => entries.filter(entry => entry.kind === kind);
  const cite = entry => [entry.kind, entry.ref, entry.revision];
  return {
    stories: of('story').map(entry => ({ ...entry, label: `S${entry.data.number}`, title: entry.data.title || entry.title, why: entry.data.why || '', acceptance: entry.data.acceptance || [] })),
    personas: of('persona').map(entry => ({ ...entry, name: entry.data.name || entry.title, role: entry.data.role || '', note: entry.data.note || '' })),
    objects: of('data_object').map(entry => ({ ...entry, name: entry.data.name || entry.title, description: entry.data.description || '', schema: entry.data.schema || {} })),
    operations: of('data_operation').map(entry => ({ ...entry, method: entry.data.method, path: entry.data.path, operationId: entry.data.operationId, summary: entry.data.summary || '' })),
    tokens: of('design_tokens')[0] || null,
    components: of('component').map(entry => ({ ...entry, name: entry.data.name || entry.title, status: entry.data.status || 'proposed', purpose: entry.data.purpose || '' })),
    cite
  };
}

const sourcesPath = '.aludel/doc-sources.json';
// Files that don't exist yet, plus the map (AGENTS.md gains a "Where to look" section) and the sources sidecar, which it is
// given and extends. Developers own the docs: the host never writes over an existing doc.
export function seed(event, { project = {}, entries = [], tree = [], existing = {}, stack = null } = {}) {
  if (event !== 'install') return { files: {} };
  const { stories, personas, objects, operations, tokens, components, cite } = adapt(entries);
  const files = {}, sources = {};
  const add = (path, title, parts) => {
    sources[path] = { [title]: [] };
    files[path] = `# ${title}\n\n${parts.map(([heading, body, cited]) => { sources[path][heading] = cited.map(cite); return `## ${heading}\n\n${body.trim()}\n`; }).join('\n')}`;
  };
  const folders = new Set(tree.map(path => path.split('/')[0] + '/'));
  const top = [['src/', 'Web app', 'what people use in the browser'], ['server/', 'API server', 'answers /api and stores records'], ['db/', 'Database migrations', 'numbered SQL that creates the tables'], ['tests/', 'Tests', 'checks run on every change']];
  const deps = stack ? [...Object.entries(stack.dependencies || {}).map(([name, version]) => `- ${name} ${version}`), ...Object.entries(stack.devDependencies || {}).map(([name, version]) => `- ${name} ${version} (build and test)`)] : [];
  add('ARCHITECTURE.md', 'Architecture', [
    ['Parts', top.filter(([folder]) => folders.has(folder)).map(([folder, name, what]) => `- **${name}** (\`${folder}\`): ${what}.`).join('\n') + '\n- **Container**: `Dockerfile` builds one image; `compose.yaml` runs it anywhere.', []],
    ['Stack', deps.join('\n') || 'Nothing declared in package.json yet.', []],
    ['Data', objects.length ? objects.map(object => `- **${object.name}**: ${object.description || 'no description yet'}`).join('\n') + '\n\nThe contracts are in `docs/data/objects.md`.' : 'No Data objects yet.', objects]]);
  add('docs/product/index.md', `${project.name || 'The app'}: who it is for`, [
    ['Who it is for', personas.map(persona => `- **${persona.name}**, ${persona.role}${persona.note ? `: ${persona.note}` : ''}`).join('\n') || 'No personas yet.', personas],
    ['Stories', stories.map(story => `- ${story.label} ${story.title}`).join('\n') + '\n\nEach story\'s acceptance is in `stories.md`.', stories]]);
  add('docs/product/stories.md', 'Stories and their acceptance', stories.map(story => [`${story.label} ${story.title}`,
    `${story.why}\n\n${story.acceptance.map((scenario, index) => `- **${story.label}/${index + 1}** Given ${scenario.given}, when ${scenario.when}, then ${scenario.then}.`).join('\n') || 'No acceptance yet.'}${story.acceptance.length ? `\n\nName a test after the scenario it checks: \`${story.label}/1 · …\`.` : ''}`, [story]]));
  add('docs/design/DESIGN.md', 'Design', [
    ['Tokens', 'Use the design tokens in `design/tokens.json` through the theme\'s CSS variables. Never hard-code a colour.', tokens ? [tokens] : []],
    ['Components', components.map(component => `- **${component.name}** (${component.status}): ${component.purpose}`).join('\n') || 'None yet.', components]]);
  add('docs/data/objects.md', 'Data objects', objects.map(object => [object.name, `${object.description}\n\n${Object.entries(object.schema.properties || {}).map(([name, field]) => `- \`${name}\`${(object.schema.required || []).includes(name) ? ' (required)' : ''}: ${field.type || 'object'}${field.description ? `, ${field.description}` : ''}`).join('\n') || 'No fields yet.'}`, [object]]));
  add('docs/data/api.md', 'API', [['Operations', operations.map(op => `- \`${op.method} ${op.path}\` (${op.operationId}): ${op.summary}`).join('\n') || 'None yet.', operations]]);
  const has = path => tree.includes(path);
  const written = Object.keys(files).filter(path => !has(path));
  const out = Object.fromEntries(written.map(path => [path, files[path]]));
  // The map names every doc there is, so none is off the map.
  const described = { 'ARCHITECTURE.md': 'the parts, the stack and the data', 'docs/product/': "who it is for, and each story's acceptance", 'docs/design/DESIGN.md': 'tokens and components', 'docs/data/': 'objects and the API', 'README.md': 'what it is and how to run it' };
  const exists = key => key.endsWith('/') ? [...tree, ...written].some(path => path.startsWith(key)) : has(key) || written.includes(key);
  const docFile = path => path === 'ARCHITECTURE.md' || path === 'README.md' || path.startsWith('docs/') && !path.startsWith('docs/.aludel/') && /\.(md|txt)$/.test(path);
  const others = [...new Set([...tree, ...written])].filter(docFile).filter(path => !Object.keys(described).some(key => key.endsWith('/') ? path.startsWith(key) : path === key)).sort();
  const map = `## Where to look\n\nThis file is the map; the docs hold the detail.\n\n${Object.entries(described).filter(([key]) => exists(key)).map(([key, what]) => `- \`${key}\`: ${what}`).join('\n')}${others.map(path => `\n- \`${path}\``).join('')}\n`;
  const agents = existing['AGENTS.md'];
  if (agents === undefined || agents === null) out['AGENTS.md'] = `# ${project.name || 'The app'}\n\n${map}`;
  else if (!/^## Where to look\b/m.test(agents)) out['AGENTS.md'] = `${agents.trimEnd()}\n\n${map}`;
  else {
    const missing = written.filter(path => !agents.includes(path)).map(path => `- \`${path}\`${described[path] ? `: ${described[path]}` : ''}`);
    if (missing.length) {
      const start = agents.search(/^## Where to look\b/m), next = agents.slice(start + 1).search(/^## /m), end = next < 0 ? agents.length : start + 1 + next;
      out['AGENTS.md'] = `${agents.slice(0, start)}${agents.slice(start, end).trimEnd()}\n${missing.join('\n')}\n\n${agents.slice(end).replace(/^\n+/, '')}`.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
    }
  }
  // The sidecar is Aludel's, so it lives in .aludel/ beside the package (layer.json knowledge.docs.sources), not among the app's docs.
  let sidecar = {};
  try { sidecar = existing[sourcesPath] ? JSON.parse(existing[sourcesPath]) : {}; } catch { sidecar = {}; }
  if (written.length) { for (const path of written) sidecar[path] = sources[path]; out[sourcesPath] = `${JSON.stringify(sidecar, null, 2)}\n`; }
  return { files: out };
}
