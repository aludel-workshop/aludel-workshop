// Project knowledge by layer (DEC-036/037). Record kinds and fields follow
// docs/design/portal-layers/knowledge-structures.md. One table with a kind whitelist and an explicit
// validator per kind: typed at the domain layer, not an open-ended entity store. New kinds need a
// validator here and a doc update.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireMember } from './accounts.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const text = (value, max, label, required = false) => {
  const clean = String(value ?? '').trim();
  if (required && !clean) fail(`${label} is required.`);
  if (clean.length > max) fail(`${label} must be under ${max} characters.`);
  return clean;
};
// Clarifications answered through Work (LAY-04): the question, the answer and the work item that decided it.
const resolvedList = value => (Array.isArray(value) ? value : []).map(item => ({ question: text(item?.question, 400, 'Question', true), answer: text(item?.answer, 400, 'Answer', true), work: text(item?.work, 20, 'Work item') }));
const lines = (value, max, label) => (Array.isArray(value) ? value : []).map(item => text(item, max, label)).filter(Boolean);
const ids = value => (Array.isArray(value) ? value : []).map(String).filter(item => /^[a-z]+-[a-z0-9]{6,12}$/.test(item));

export const phaseKeys = ['demo', 'mvp', 'later'];
export const visionKeys = ['statement', 'needs', 'capabilities', 'outcomes', 'principles', 'nogos'];
const visionTitles = { statement: 'Vision', needs: 'Needs and opportunities', capabilities: 'Standout capabilities', outcomes: 'Outcomes and measures', principles: 'Principles', nogos: 'No-gos' };
const pageStatuses = ['planned', 'skeleton', 'designed'];
const specStatuses = ['draft', 'in-review', 'accepted', 'superseded'];
export const workStates = ['suggested', 'ready', 'claimed', 'needs-input', 'review', 'done'];
export const workTypes = ['define', 'spec', 'plan', 'design', 'implement', 'reconcile', 'review', 'research', 'audit', 'configure'];
export const layers = ['product', 'design', 'pages', 'data', 'platform', 'work'];
// WORK-UX-01: Jira's five priorities, highest first; agent effort levels; the unnamed metal tones agent avatars use.
export const priorities = ['highest', 'high', 'medium', 'low', 'lowest'];
export const efforts = ['low', 'medium', 'high'];
export const botColors = ['#9aa3ad', '#56606b', '#7d7f95', '#4b6ea8', '#4d9585', '#b39a3d', '#c9a227', '#a8703a', '#b4633b', '#c28a7e'];
// Data layer (DEC-038): stack-neutral contracts. JSON Schema 2020-12 for objects, OpenAPI 3.1 shape for operations.
const schemaTypes = ['string', 'integer', 'number', 'boolean', 'array', 'object', 'null'];
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const effects = ['allow', 'owner', 'deny'];
const contracts = ['proposed', 'accepted'];
const identifier = (value, pattern, label, example) => {
  const clean = text(value, 60, label, true);
  if (!pattern.test(clean)) fail(`${label} “${clean}” should look like ${example}.`);
  return clean;
};

// Structural only: which keywords, which types, required names exist. Whether a contract suits the product is review's job.
function schemaNode(node, label, depth = 0) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) fail(`${label} must be a JSON Schema object.`);
  if (depth > 6) fail(`${label} is nested too deeply.`);
  if (node.$ref !== undefined) {
    if (!/^obj-[a-z0-9]{6,12}$/.test(String(node.$ref))) fail(`${label} refers to an unknown object.`);
    return { $ref: node.$ref, ...(node.description ? { description: text(node.description, 300, 'Description') } : {}) };
  }
  const type = Array.isArray(node.type) ? node.type : [node.type];
  if (!type.length || type.some(item => !schemaTypes.includes(item))) fail(`${label} needs a type: ${schemaTypes.join(', ')}.`);
  const clean = { type: Array.isArray(node.type) ? type : type[0] };
  if (node.format) clean.format = text(node.format, 40, 'Format');
  if (node.description) clean.description = text(node.description, 300, 'Description');
  if (Array.isArray(node.enum)) clean.enum = lines(node.enum, 80, 'Allowed value');
  for (const key of ['maxLength', 'minLength', 'minimum', 'maximum']) if (node[key] !== undefined) {
    if (!Number.isFinite(Number(node[key]))) fail(`${label} ${key} must be a number.`);
    clean[key] = Number(node[key]);
  }
  for (const key of ['readOnly', 'writeOnly']) if (node[key]) clean[key] = true;
  if (type.includes('array') && node.items) clean.items = schemaNode(node.items, `${label} items`, depth + 1);
  if (type.includes('object')) {
    const properties = node.properties && typeof node.properties === 'object' ? node.properties : {};
    if (Object.keys(properties).length > 60) fail(`${label} has too many fields.`);
    clean.properties = Object.fromEntries(Object.entries(properties).map(([name, value]) => [identifier(name, /^[A-Za-z_][A-Za-z0-9_]*$/, 'Field name', 'a name like startedAt'), schemaNode(value, `Field “${name}”`, depth + 1)]));
    const required = lines(node.required, 60, 'Required field');
    for (const name of required) if (!clean.properties[name]) fail(`“${name}” is required but is not a field.`);
    if (required.length) clean.required = required;
  }
  return clean;
}
const schemaRefs = node => !node || typeof node !== 'object' ? [] : [...(node.$ref ? [node.$ref] : []), ...Object.values(node.properties || {}).flatMap(schemaRefs), ...schemaRefs(node.items)];

export function loadStoryPacks(configDirectory) {
  const { packs, services = {} } = JSON.parse(readFileSync(join(configDirectory, 'story-packs.json'), 'utf8'));
  for (const [id, pack] of Object.entries(packs)) {
    for (const story of pack.stories) if (!pack.steps[story.step] || !phaseKeys.includes(story.phase) || (story.services || []).some(key => !services[key])) throw new Error(`Story pack ${id} has an invalid story.`);
    const names = new Set((pack.objects || []).map(object => object.name));
    const known = index => index >= 0 && index < pack.stories.length;
    for (const object of pack.objects || []) if (!(object.stories || []).every(known) || (object.relations || []).some(relation => !names.has(relation.target))) throw new Error(`Story pack ${id} has an invalid object ${object.name}.`);
    for (const operation of pack.operations || []) if (!(operation.stories || []).every(known) || (operation.object && !names.has(operation.object))) throw new Error(`Story pack ${id} has an invalid operation ${operation.operationId}.`);
    for (const rule of pack.access || []) if (!names.has(rule.object)) throw new Error(`Story pack ${id} has an access rule for an unknown object.`);
  }
  return packs;
}

export function initKnowledge(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_records (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), kind TEXT NOT NULL,
      parent_id TEXT, position REAL NOT NULL DEFAULT 0, data_json TEXT NOT NULL, revision INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_records(project_id, kind);
    CREATE TABLE IF NOT EXISTS knowledge_revisions (
      record_id TEXT NOT NULL, revision INTEGER NOT NULL, data_json TEXT NOT NULL, author TEXT NOT NULL,
      rationale TEXT, work_item_id TEXT, created_at TEXT NOT NULL, PRIMARY KEY(record_id, revision)
    );
    CREATE TABLE IF NOT EXISTS layer_work_items (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), number INTEGER NOT NULL,
      layer TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, state TEXT NOT NULL,
      assignee_kind TEXT, assignee_label TEXT, targets_json TEXT NOT NULL, question_json TEXT,
      documents_json TEXT NOT NULL, log_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(project_id, number)
    );
    CREATE TABLE IF NOT EXISTS knowledge_counters (project_id TEXT NOT NULL, kind TEXT NOT NULL, next INTEGER NOT NULL, PRIMARY KEY(project_id, kind));
  `);
  const setupColumns = new Set(db.prepare('PRAGMA table_info(project_setup)').all().map(column => column.name));
  if (!setupColumns.has('pages_customized')) db.exec('ALTER TABLE project_setup ADD COLUMN pages_customized INTEGER NOT NULL DEFAULT 0');
  if (!setupColumns.has('story_packs_json')) db.exec("ALTER TABLE project_setup ADD COLUMN story_packs_json TEXT NOT NULL DEFAULT '[]'");
  // LAY-07C: the profile an agent item runs as and the instruction revisions it ran with; LAY-07D: reconcile context.
  db.exec(`CREATE TABLE IF NOT EXISTS routine_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id), ran_at TEXT NOT NULL, trigger TEXT NOT NULL, work_item_id TEXT
  )`);
  const workColumns = new Set(db.prepare('PRAGMA table_info(layer_work_items)').all().map(column => column.name));
  for (const column of ['profile_id', 'instructions_json', 'context_json']) if (!workColumns.has(column)) db.exec(`ALTER TABLE layer_work_items ADD COLUMN ${column} TEXT`);
  // WORK-UX-01: the action an item is for, who it is assigned to (a user id or an agent profile id), Jira-style priority,
  // the items it blocks, and the checks it is reviewed against (each with a verdict once reviewed).
  for (const column of ['action', 'assignee_id', 'priority', 'blocks_json', 'checks_json']) if (!workColumns.has(column)) db.exec(`ALTER TABLE layer_work_items ADD COLUMN ${column} TEXT`);
}

// ---- Validators: one per kind, fields per knowledge-structures.md ----
const validators = {
  vision_section: data => {
    if (!visionKeys.includes(data.key)) fail('Unknown vision section.');
    return { key: data.key, body: text(data.body, 4000, visionTitles[data.key]), items: lines(data.items, 400, visionTitles[data.key]) };
  },
  persona: data => ({ name: text(data.name, 60, 'Persona name', true), role: text(data.role, 60, 'Role'), note: text(data.note, 400, 'Persona note') }),
  phase: data => {
    if (!phaseKeys.includes(data.key)) fail('Unknown phase.');
    return { key: data.key, label: text(data.label, 30, 'Phase name', true), goal: text(data.goal, 400, 'Phase goal'), appetite: text(data.appetite, 60, 'Appetite'), exit: text(data.exit, 400, 'Exit criteria'), current: Boolean(data.current) };
  },
  activity: data => ({ title: text(data.title, 60, 'Activity', true), persona: text(data.persona, 60, 'Persona'), pack: data.pack ? text(data.pack, 40, 'Pack') : null }),
  step: data => ({ title: text(data.title, 60, 'Step', true) }),
  story: (data, catalogs) => {
    if (!phaseKeys.includes(data.phase)) fail('Choose a phase for the story.');
    const acceptance = (Array.isArray(data.acceptance) ? data.acceptance : []).map(item => ({
      given: text(item?.given, 400, 'Given'), when: text(item?.when, 400, 'When'), then: text(item?.then, 400, 'Then')
    })).filter(item => item.given || item.when || item.then);
    for (const item of acceptance) if (!item.given || !item.when || !item.then) fail('Each acceptance scenario needs Given, When and Then.');
    return { number: Number(data.number) || 0, title: text(data.title, 160, 'Story', true), phase: data.phase, why: text(data.why, 400, 'Why'), acceptance,
      edges: lines(data.edges, 300, 'Edge case'), clarifications: lines(data.clarifications, 300, 'Clarification'),
      services: lines(data.services, 40, 'Service').filter(key => catalogs.services?.[key]), resolved: resolvedList(data.resolved),
      pack: data.pack ? text(data.pack, 40, 'Pack') : null, template: Boolean(data.template) };
  },
  spec: data => {
    if (!specStatuses.includes(data.status || 'draft')) fail('Unknown spec status.');
    if (!phaseKeys.includes(data.phase || 'demo')) fail('Choose a phase for the spec.');
    return { number: Number(data.number) || 0, title: text(data.title, 120, 'Spec title', true), phase: data.phase || 'demo', status: data.status || 'draft',
      stories: ids(data.stories), problem: text(data.problem, 2000, 'Problem'), appetite: text(data.appetite, 80, 'Appetite'), solution: text(data.solution, 4000, 'Solution sketch'),
      rabbitHoles: lines(data.rabbitHoles, 400, 'Rabbit hole'), noGos: lines(data.noGos, 400, 'No-go'), requirements: lines(data.requirements, 600, 'Requirement'),
      entities: lines(data.entities, 200, 'Entity'), success: lines(data.success, 400, 'Success criterion'), assumptions: lines(data.assumptions, 400, 'Assumption'),
      clarifications: lines(data.clarifications, 400, 'Clarification'), resolved: resolvedList(data.resolved) };
  },
  research: data => ({ title: text(data.title, 120, 'Research title', true), body: text(data.body, 8000, 'Research notes'), supports: ids(data.supports) }),
  doc: data => ({ title: text(data.title, 120, 'Document title', true), template: text(data.template || 'Blank', 40, 'Template'), body: text(data.body, 40000, 'Document') }),
  page: (data, catalogs) => {
    if (!catalogs.routeIcons.includes(data.icon)) fail(`Choose an icon from the list for “${data.label}”.`);
    if (!catalogs.pageTypes[data.pageType]) fail(`Choose a page type for “${data.label}”.`);
    if (!pageStatuses.includes(data.status || 'planned')) fail('Unknown page status.');
    return { label: text(data.label, 30, 'Page name', true), icon: data.icon, pageType: data.pageType, description: text(data.description, 1000, 'Page description'),
      inNav: Boolean(data.inNav), origin: text(data.origin || 'You', 60, 'Origin'), stories: ids(data.stories), status: data.status || 'planned', notes: text(data.notes, 4000, 'Notes') };
  },
  data_object: data => {
    if (!contracts.includes(data.contract || 'proposed')) fail('Unknown contract state.');
    const schema = schemaNode({ type: 'object', properties: {}, ...data.schema, type: 'object' }, 'The object');
    const relations = (Array.isArray(data.relations) ? data.relations : []).map(relation => {
      if (!['one', 'many'].includes(relation?.cardinality)) fail('A relationship is to one or to many.');
      return { name: identifier(relation.name, /^[a-z][A-Za-z0-9]*$/, 'Relationship name', 'lender'), target: ids([relation.target])[0] || fail('Choose the object a relationship points to.'),
        cardinality: relation.cardinality, owner: Boolean(relation.owner) };
    });
    return { name: identifier(data.name, /^[A-Z][A-Za-z0-9]*$/, 'Object name', 'BorrowRequest'), description: text(data.description, 1000, 'Description'), schema, relations,
      states: lines(data.states, 200, 'Lifecycle state'), stories: ids(data.stories), specs: ids(data.specs), contract: data.contract || 'proposed',
      origin: text(data.origin || 'You', 60, 'Origin'), pack: data.pack ? text(data.pack, 40, 'Pack') : null, template: Boolean(data.template) };
  },
  data_operation: data => {
    if (!methods.includes(data.method)) fail(`Choose a method: ${methods.join(', ')}.`);
    if (!contracts.includes(data.contract || 'proposed')) fail('Unknown contract state.');
    const status = (value, label) => { const clean = String(value || '').trim(); if (!/^[1-5][0-9]{2}$/.test(clean)) fail(`${label} needs an HTTP status like 200.`); return clean; };
    const response = data.response || { status: '200', description: 'Success' };
    return { operationId: identifier(data.operationId, /^[a-z][A-Za-z0-9]*$/, 'operationId', 'listNearbyTools'), summary: text(data.summary, 160, 'Summary', true), method: data.method,
      path: identifier(data.path, /^\/[A-Za-z0-9/_{}.-]*$/, 'Path', '/tools/{toolId}'), objectId: data.objectId ? (ids([data.objectId])[0] || fail('Unknown object.')) : null,
      parameters: (Array.isArray(data.parameters) ? data.parameters : []).map(parameter => {
        if (!['path', 'query', 'header'].includes(parameter?.in)) fail('A parameter is in the path, query or header.');
        return { name: identifier(parameter.name, /^[A-Za-z_][A-Za-z0-9_-]*$/, 'Parameter', 'toolId'), in: parameter.in, required: parameter.in === 'path' || Boolean(parameter.required),
          schema: schemaNode(parameter.schema || { type: 'string' }, `Parameter “${parameter.name}”`), description: text(parameter.description, 300, 'Description') };
      }),
      request: data.request ? schemaNode(data.request, 'The request body') : null,
      response: { status: status(response.status, 'The response'), description: text(response.description, 300, 'Response description'), schema: response.schema ? schemaNode(response.schema, 'The response') : null },
      errors: (Array.isArray(data.errors) ? data.errors : []).map(error => ({ status: status(error?.status, 'An error'), description: text(error?.description, 300, 'Error description', true) })),
      roles: lines(data.roles, 40, 'Role'), stories: ids(data.stories), contract: data.contract || 'proposed', pack: data.pack ? text(data.pack, 40, 'Pack') : null, template: Boolean(data.template) };
  },
  access_rule: data => {
    if (!effects.includes(data.effect)) fail('A rule allows, allows the owner only, or denies.');
    return { role: identifier(data.role, /^[a-z][a-z0-9-]*$/, 'Role', 'member'), objectId: ids([data.objectId])[0] || fail('Choose the object this rule covers.'),
      action: identifier(data.action, /^[a-z][a-zA-Z-]*$/, 'Action', 'read, create, update, delete or approve'), effect: data.effect, sentence: text(data.sentence, 300, 'Rule', true),
      pack: data.pack ? text(data.pack, 40, 'Pack') : null };
  },
  // Work › Agents. WORK-UX-01: a profile is who does the work (model, effort, its own context and usage limits); what an
  // action allows lives on the action. A profile never authorizes a provider call or spending on its own (DEC-004).
  agent_profile: data => {
    const limits = data.limits && typeof data.limits === 'object' ? data.limits : {};
    const count = (value, fallback, max, label) => {
      const number = value === undefined || value === '' ? fallback : value === null ? null : Number(value);
      if (number !== null && (!Number.isInteger(number) || number < 0 || number > max)) fail(`${label} must be a whole number up to ${max.toLocaleString('en')}.`);
      return number;
    };
    const effort = data.effort || 'medium';
    if (!efforts.includes(effort)) fail(`Choose an effort: ${efforts.join(', ')}.`);
    const color = String(data.avatar?.color || '').toLowerCase();
    return { key: data.key ? text(data.key, 40, 'Key') : null, name: text(data.name, 40, 'Profile name', true), description: text(data.description ?? data.role, 300, 'Description'),
      avatar: { seed: text(data.avatar?.seed || data.name, 60, 'Avatar seed') || 'agent', color: botColors.includes(color) ? color : botColors[3] },
      model: text(data.model, 100, 'Model'), effort, instructions: text(data.instructions, 8000, 'Instructions'), context: ids(data.context),
      limits: { itemOutput: count(limits.itemOutput, 8000, 20000, 'Output tokens per item'), batchTokens: count(limits.batchTokens, 200000, 10000000, 'Tokens per batch run'),
        monthlyTokens: count(limits.monthlyTokens, 2000000, 1000000000, 'Tokens per month') },
      active: data.active !== false };
  },
  // WORK-UX-01: one role per layer; its instructions come before each action's own.
  role: data => {
    if (!layers.includes(data.layer)) fail('Unknown layer.');
    return { layer: data.layer, instructions: text(data.instructions, 8000, 'Role instructions') };
  },
  // Each action a role performs: who takes it by default, and the setup anyone doing it works with.
  work_action: (data, catalogs) => {
    const definition = catalogs.roles?.actions.get(data.key);
    if (!definition) fail('Unknown action.');
    const assignee = data.assignee && ['person', 'agent'].includes(data.assignee.kind) ? { kind: data.assignee.kind, id: text(data.assignee.id, 80, 'Assignee', true) } : null;
    const tools = lines(data.tools, 40, 'Tool');
    for (const tool of tools) if (!catalogs.roles.tools[tool]) fail(`Unknown tool “${tool}”.`);
    const phases = lines(data.phases, 60, 'Run phase');
    if (!phases.length || phases.length > 8) fail('An action has one to eight run phases.');
    return { key: data.key, assignee, instructions: text(data.instructions, 8000, 'Action instructions'), reads: ids(data.reads), changes: lines(data.changes, 120, 'What it may change'),
      tools: [...new Set(tools)], asks: text(data.asks, 400, 'Asks you first'), phases, checks: lines(data.checks, 300, 'Check').slice(0, 12) };
  },
  project_instructions: data => ({ body: text(data.body, 8000, 'Project instructions') }),
  // Work › Routines (LAY-04C): a definition only; runs are recorded in routine_runs, not as revisions.
  routine: data => {
    if (!layers.includes(data.layer)) fail('Unknown layer.');
    if (!workTypes.includes(data.type)) fail('Unknown work type.');
    if (!cadences.includes(data.cadence)) fail(`Choose how often: ${cadences.join(', ')}.`);
    return { key: data.key ? text(data.key, 40, 'Key') : null, title: text(data.title, 120, 'Routine', true), layer: data.layer, type: data.type, cadence: data.cadence,
      documents: lines(data.documents, 300, 'Document'), enabled: data.enabled !== false };
  }
};
export const cadences = ['weekly', 'monthly', 'before-release'];
const cadenceDays = { weekly: 7, monthly: 30 };
// Types whose output is a change to their target records, so closing them checks for a revision made from the item.
// Implement, reconcile, review and audit produce code, links or findings; LAY-05 verifies those.
const verifiedTypes = ['define', 'spec', 'plan', 'design', 'research', 'configure'];
const kinds = Object.keys(validators);
const prefixes = { vision_section: 'vis', persona: 'per', phase: 'pha', activity: 'act', step: 'stp', story: 'sto', spec: 'spc', research: 'res', doc: 'doc', page: 'pag',
  data_object: 'obj', data_operation: 'opr', access_rule: 'acc', agent_profile: 'agt', project_instructions: 'ins', routine: 'rtn', role: 'rol', work_action: 'wac' };
// Records a kind points at must exist in the same project and be of the right kind.
const references = {
  data_object: clean => [...clean.relations.map(relation => [relation.target, 'data_object']), ...clean.stories.map(id => [id, 'story']), ...clean.specs.map(id => [id, 'spec']), ...schemaRefs(clean.schema).map(id => [id, 'data_object'])],
  data_operation: clean => [...(clean.objectId ? [[clean.objectId, 'data_object']] : []), ...clean.stories.map(id => [id, 'story']), ...[clean.request, clean.response.schema].flatMap(schemaRefs).map(id => [id, 'data_object'])],
  access_rule: clean => [[clean.objectId, 'data_object']]
};
const newId = kind => `${prefixes[kind]}-${randomBytes(4).toString('hex')}`;

export function loadAgentDefaults(configDirectory) {
  const defaults = JSON.parse(readFileSync(join(configDirectory, 'agent-profiles.json'), 'utf8'));
  validators.agent_profile(defaults.defaultProfile);
  for (const layer of Object.values(defaults.legacyRoles || {})) if (!layers.includes(layer)) throw new Error(`Legacy profile maps to unknown layer ${layer}.`);
  return defaults;
}

// WORK-UX-01: one role per layer and the actions it performs (config/roles.json). Action ids are "<layer>.<key>".
export function loadRoles(configDirectory, { routines = [], styles = [] } = {}) {
  const config = JSON.parse(readFileSync(join(configDirectory, 'roles.json'), 'utf8'));
  if ([...config.roles.map(role => role.layer)].sort().join() !== [...layers].sort().join()) throw new Error('Every layer needs exactly one role.');
  const actions = new Map();
  for (const role of config.roles) for (const action of role.actions) {
    const id = `${role.layer}.${action.key}`;
    if (actions.has(id)) throw new Error(`Action ${id} is defined twice.`);
    if (!workTypes.includes(action.type)) throw new Error(`Action ${id} has an unknown work type.`);
    if ((action.tools || []).some(tool => !config.tools[tool])) throw new Error(`Action ${id} uses an unknown tool.`);
    if (!action.phases?.length || !action.checks?.length) throw new Error(`Action ${id} needs run phases and checks.`);
    if (action.routine && !routines.some(routine => routine.key === action.routine)) throw new Error(`Action ${id} names an unknown routine.`);
    actions.set(id, { ...action, id, layer: role.layer, role: role.name });
  }
  for (const routine of routines) if (![...actions.values()].some(action => action.routine === routine.key)) throw new Error(`Routine ${routine.key} has no action to take it.`);
  for (const style of styles) {
    const preset = config.presets[style];
    if (!preset || (!preset.you && !preset.agent)) throw new Error(`Working style ${style} needs a preset in roles.json.`);
    for (const id of [...(preset.you || []), ...(preset.agent || [])]) if (!actions.has(id)) throw new Error(`Preset ${style} names unknown action ${id}.`);
  }
  return { ...config, actions };
}

export function knowledge({ db, catalogs, packs, agentDefaults = catalogs.agentDefaults || { profiles: [], guidance: {}, projectInstructions: '' } }) {
  const revisionListeners = [];
  const doneListeners = [];
  const row = id => db.prepare('SELECT * FROM knowledge_records WHERE id = ?').get(id);
  const hydrate = record => record && { id: record.id, kind: record.kind, parentId: record.parent_id, position: record.position, revision: record.revision, updatedAt: record.updated_at, ...parse(record.data_json, {}) };
  const list = (projectId, kind) => db.prepare('SELECT * FROM knowledge_records WHERE project_id = ? AND kind = ? ORDER BY position, created_at').all(projectId, kind).map(hydrate);
  const counter = (projectId, kind) => {
    const current = db.prepare('SELECT next FROM knowledge_counters WHERE project_id = ? AND kind = ?').get(projectId, kind)?.next || 1;
    db.prepare('INSERT INTO knowledge_counters(project_id, kind, next) VALUES (?, ?, ?) ON CONFLICT(project_id, kind) DO UPDATE SET next = excluded.next').run(projectId, kind, current + 1);
    return current;
  };

  function insert(projectId, kind, data, { parentId = null, position, author = 'Aludel', rationale = null, workItemId = null } = {}) {
    if (!kinds.includes(kind)) fail('Unknown record kind.');
    const clean = validators[kind](data, catalogs);
    checkReferences(projectId, kind, clean);
    if ((kind === 'story' || kind === 'spec') && !clean.number) clean.number = counter(projectId, kind);
    if (parentId && !db.prepare('SELECT 1 FROM knowledge_records WHERE id = ? AND project_id = ?').get(parentId, projectId)) fail('Parent record not found.', 404);
    const id = newId(kind);
    const created = now();
    const place = position ?? ((db.prepare('SELECT MAX(position) AS max FROM knowledge_records WHERE project_id = ? AND kind = ? AND COALESCE(parent_id, \'\') = COALESCE(?, \'\')').get(projectId, kind, parentId)?.max ?? -1) + 1);
    db.prepare('INSERT INTO knowledge_records(id, project_id, kind, parent_id, position, data_json, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)')
      .run(id, projectId, kind, parentId, place, JSON.stringify(clean), created, created);
    db.prepare('INSERT INTO knowledge_revisions(record_id, revision, data_json, author, rationale, work_item_id, created_at) VALUES (?, 1, ?, ?, ?, ?, ?)')
      .run(id, JSON.stringify(clean), author, rationale, workItemId, created);
    return hydrate(row(id));
  }

  function checkReferences(projectId, kind, clean) {
    for (const [id, expected] of references[kind]?.(clean) || []) {
      const target = row(id);
      if (!target || target.project_id !== projectId || target.kind !== expected) fail(`A linked ${expected.replace('_', ' ')} was not found.`, 404);
    }
  }

  function update(projectId, id, changes, { expectedRevision, author = 'Aludel', rationale = null, workItemId = null, position, parentId } = {}) {
    const current = row(id);
    if (!current || current.project_id !== projectId) fail('Record not found.', 404);
    if (expectedRevision !== undefined && Number(expectedRevision) !== current.revision) fail('This record changed since you opened it. Reload to see the latest; your edit is kept.', 409);
    const merged = validators[current.kind]({ ...parse(current.data_json, {}), ...changes }, catalogs);
    checkReferences(projectId, current.kind, merged);
    const contentChanged = JSON.stringify(merged) !== current.data_json;
    const same = !contentChanged && position === undefined && parentId === undefined;
    if (same) return hydrate(current);
    const revision = current.revision + 1;
    const updated = now();
    db.prepare('UPDATE knowledge_records SET data_json = ?, revision = ?, updated_at = ?, position = COALESCE(?, position), parent_id = CASE WHEN ? THEN ? ELSE parent_id END WHERE id = ?')
      .run(JSON.stringify(merged), revision, updated, position ?? null, parentId !== undefined ? 1 : 0, parentId ?? null, id);
    db.prepare('INSERT INTO knowledge_revisions(record_id, revision, data_json, author, rationale, work_item_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, revision, JSON.stringify(merged), author, rationale, workItemId, updated);
    // Moving a record is not a change to what it says; only content changes reach code links (LAY-07D).
    if (contentChanged) for (const listener of revisionListeners) listener({ projectId, record: hydrate(row(id)), fromRevision: current.revision, toRevision: revision, author });
    return hydrate(row(id));
  }

  function remove(projectId, id) {
    const current = row(id);
    if (!current || current.project_id !== projectId) fail('Record not found.', 404);
    const children = db.prepare('SELECT id FROM knowledge_records WHERE parent_id = ?').all(id);
    for (const child of children) remove(projectId, child.id);
    db.prepare('DELETE FROM knowledge_records WHERE id = ?').run(id);
  }

  const history = id => db.prepare('SELECT revision, author, rationale, work_item_id AS workItemId, created_at AS createdAt FROM knowledge_revisions WHERE record_id = ? AND rationale IS NOT NULL ORDER BY revision DESC').all(id);
  const revisionData = (id, revision) => parse(db.prepare('SELECT data_json FROM knowledge_revisions WHERE record_id = ? AND revision = ?').get(id, revision)?.data_json, null);
  // The record's revision at a moment in time, for links declared by a past commit.
  const revisionAt = (id, at) => db.prepare('SELECT MAX(revision) AS revision FROM knowledge_revisions WHERE record_id = ? AND created_at <= ?').get(id, at)?.revision || null;
  const get = (projectId, id) => { const record = row(id); return record && record.project_id === projectId ? hydrate(record) : null; };

  // ---- Seeds ----
  function ensureProject(projectId, { pitch = '' } = {}) {
    if (!list(projectId, 'phase').length) {
      insert(projectId, 'phase', { key: 'demo', label: 'Demo', goal: 'A clickable core flow with sample data.', appetite: '1 week', exit: 'The core flow works end to end', current: true });
      insert(projectId, 'phase', { key: 'mvp', label: 'MVP', goal: 'Real people use it for real.', appetite: '3 weeks', exit: 'Testers complete the core flow with real data' });
      insert(projectId, 'phase', { key: 'later', label: 'Later', goal: 'Polish and growth.', appetite: '', exit: '' });
    }
    if (!list(projectId, 'vision_section').length) {
      for (const key of visionKeys) insert(projectId, 'vision_section', { key, body: key === 'statement' ? pitch : '', items: [] }, { rationale: key === 'statement' && pitch ? 'From the elevator pitch in onboarding' : null });
    }
    ensureAgents(projectId);
    ensureRoutines(projectId);
  }

  // ---- Work › Agents and Roles (WORK-UX-01) ----
  const profiles = projectId => list(projectId, 'agent_profile');
  const defaultProfile = projectId => profiles(projectId).find(profile => profile.key === 'default') || null;
  const ownerOf = projectId => db.prepare('SELECT created_by FROM project_setup WHERE project_id = ?').get(projectId)?.created_by
    || db.prepare("SELECT user_id FROM project_members WHERE project_id = ? AND role = 'owner' ORDER BY created_at LIMIT 1").get(projectId)?.user_id || null;
  const members = projectId => db.prepare(`SELECT u.id, u.display_name AS name, u.avatar_json, m.role FROM project_members m JOIN users u ON u.id = m.user_id
    WHERE m.project_id = ? ORDER BY m.role = 'owner' DESC, u.display_name`).all(projectId).map(member => ({ id: member.id, name: member.name, role: member.role, avatar: parse(member.avatar_json, null) }));

  // Idempotent; older projects get these at start-up. DEC-038's five role profiles give their edited instructions to
  // their layer's role and are deactivated; open work they held moves to the Default agent.
  function ensureAgents(projectId) {
    if (!defaultProfile(projectId)) insert(projectId, 'agent_profile', agentDefaults.defaultProfile, { rationale: 'Default profile' });
    if (!list(projectId, 'project_instructions').length) insert(projectId, 'project_instructions', { body: agentDefaults.projectInstructions }, { rationale: 'Default project instructions' });
    ensureRoles(projectId);
    const fallback = defaultProfile(projectId);
    for (const legacy of profiles(projectId).filter(profile => Array.isArray(profile.workTypes))) {
      const layer = agentDefaults.legacyRoles?.[legacy.key];
      const role = layer && list(projectId, 'role').find(entry => entry.layer === layer);
      if (role && legacy.revision > 1 && legacy.instructions && legacy.instructions !== role.instructions) update(projectId, role.id, { instructions: legacy.instructions }, { rationale: `Kept from the ${legacy.name} profile's instructions (WORK-UX-01)` });
      update(projectId, legacy.id, { active: false }, { rationale: 'Replaced by roles and the Default agent (WORK-UX-01)' });
      db.prepare("UPDATE layer_work_items SET profile_id = ?, assignee_id = ?, assignee_label = ? WHERE project_id = ? AND profile_id = ? AND state <> 'done'").run(fallback.id, fallback.id, fallback.name, projectId, legacy.id);
    }
    // Open agent work whose profile is gone, deactivated or was never recorded (from before profiles) goes to the default agent.
    const active = new Set(profiles(projectId).filter(profile => profile.active !== false).map(profile => profile.id));
    for (const row of db.prepare("SELECT id, profile_id FROM layer_work_items WHERE project_id = ? AND assignee_kind = 'agent' AND state <> 'done'").all(projectId)) {
      if (!active.has(row.profile_id)) db.prepare('UPDATE layer_work_items SET profile_id = ?, assignee_id = ?, assignee_label = ? WHERE id = ?').run(fallback.id, fallback.id, fallback.name, row.id);
    }
  }

  // Each layer's role and its actions, with who takes each action by default. The onboarding working style is only a
  // preset for those defaults (config/roles.json presets); it is not stored or shown anywhere else.
  function ensureRoles(projectId) {
    const roles = list(projectId, 'role');
    const actions = list(projectId, 'work_action');
    const style = db.prepare('SELECT profile FROM project_setup WHERE project_id = ?').get(projectId)?.profile;
    const preset = catalogs.roles.presets[style] || catalogs.roles.presets.planner;
    const owner = ownerOf(projectId);
    const agent = defaultProfile(projectId);
    for (const role of catalogs.roles.roles) {
      const record = roles.find(entry => entry.layer === role.layer) || insert(projectId, 'role', { layer: role.layer, instructions: role.instructions }, { rationale: 'Default role' });
      for (const action of role.actions) {
        const id = `${role.layer}.${action.key}`;
        if (actions.some(entry => entry.key === id)) continue;
        const toAgent = preset.you ? !preset.you.includes(id) : (preset.agent || []).includes(id);
        const assignee = toAgent && agent ? { kind: 'agent', id: agent.id } : owner ? { kind: 'person', id: owner } : null;
        insert(projectId, 'work_action', { key: id, assignee, instructions: action.instructions, reads: [], changes: action.changes, tools: action.tools, asks: action.asks, phases: action.phases, checks: action.checks },
          { parentId: record.id, rationale: 'Default action' });
      }
    }
  }
  const actionRecord = (projectId, id) => list(projectId, 'work_action').find(entry => entry.key === id) || null;
  // Which action an item is for, from its layer and work type (and whether it asks a question, or which routine made it).
  function actionIdFor(layer, type, { question = null, routineKey = null } = {}) {
    const all = [...catalogs.roles.actions.values()];
    const routed = routineKey && all.find(action => action.routine === routineKey);
    if (routed) return routed.id;
    const typed = all.filter(action => action.type === type && (type !== 'define' || (action.key === 'clarify') === Boolean(question && !question.answer)));
    return (typed.find(action => action.layer === layer && !action.routine) || typed.find(action => action.layer === layer) || typed.find(action => !action.routine) || all.find(action => action.layer === layer) || all[0]).id;
  }
  // An assignee is a project member or an active agent profile, stored by id; the label is kept for history.
  function resolveAssignee(projectId, assignee) {
    if (!assignee) return null;
    if (assignee.kind === 'template') return { kind: 'template', id: null, label: text(assignee.label, 80, 'Assignee') || 'Aludel template' };
    if (assignee.kind === 'agent') {
      const profile = profiles(projectId).find(entry => entry.id === assignee.id);
      if (!profile) fail('Agent profile not found.', 404);
      if (profile.active === false) fail(`${profile.name} is deactivated. Choose another profile.`, 409);
      return { kind: 'agent', id: profile.id, label: profile.name };
    }
    if (assignee.kind === 'person') {
      const member = members(projectId).find(entry => entry.id === assignee.id);
      if (!member) fail('That person is not a member of this project.', 404);
      return { kind: 'person', id: member.id, label: member.name };
    }
    fail('Assign the item to a person or an agent profile.');
  }
  function defaultAssignee(projectId, actionId) {
    const assignee = actionRecord(projectId, actionId)?.assignee;
    try { return resolveAssignee(projectId, assignee); } catch { return null; }
  }

  // What an agent reads, in order: product principles, project instructions, the role's, the action's, then its profile's
  // own. Pinned when a run starts, so later edits never change a run in progress.
  function instructionPins(projectId, profile, actionId) {
    const principles = list(projectId, 'vision_section').find(section => section.key === 'principles');
    const project = list(projectId, 'project_instructions')[0];
    const action = actionRecord(projectId, actionId);
    const role = action?.parentId ? get(projectId, action.parentId) : null;
    const pin = record => record ? { id: record.id, revision: record.revision } : null;
    return { principles: pin(principles), project: pin(project), role: pin(role), action: action ? { ...pin(action), key: action.key } : null, profile: pin(profile) };
  }

  // Roles with their actions as the Roles page and the runner see them: the catalog's names plus the project's setup.
  function roleView(projectId) {
    const actions = list(projectId, 'work_action');
    return catalogs.roles.roles.map(role => {
      const record = list(projectId, 'role').find(entry => entry.layer === role.layer);
      return { id: record?.id || null, layer: role.layer, name: role.name, blurb: role.blurb, instructions: record?.instructions || '', revision: record?.revision || 0,
        actions: role.actions.map(action => {
          const id = `${role.layer}.${action.key}`;
          const saved = actions.find(entry => entry.key === id);
          return { id, recordId: saved?.id || null, revision: saved?.revision || 0, name: action.name, description: action.description, type: action.type, routine: action.routine || null,
            assignee: saved?.assignee || null, instructions: saved?.instructions ?? action.instructions, reads: saved?.reads || [], changes: saved?.changes || action.changes, tools: saved?.tools || action.tools,
            asks: saved?.asks ?? action.asks, phases: saved?.phases || action.phases, checks: saved?.checks || action.checks };
        }) };
    });
  }

  function agentExport(projectId) {
    return { instructions: list(projectId, 'project_instructions')[0]?.body || '', principles: list(projectId, 'vision_section').find(section => section.key === 'principles')?.items || [],
      roles: roleView(projectId).map(role => ({ name: role.name, layer: role.layer, instructions: role.instructions,
        actions: role.actions.map(action => ({ name: action.name, instructions: action.instructions, changes: action.changes, tools: action.tools.map(tool => catalogs.roles.tools[tool]), asks: action.asks })) })) };
  }

  // ---- Pages (replace project_setup.routes_json) ----
  const pageList = projectId => list(projectId, 'page');
  function navRoutes(projectId) {
    return pageList(projectId).filter(page => !page.parentId && page.inNav).map(page => ({ id: page.id, label: page.label, icon: page.icon, pageType: page.pageType, description: page.description, origin: page.origin, stories: page.stories }));
  }

  function seedPages(projectId, feel, { force = false } = {}) {
    const setup = db.prepare('SELECT pages_customized, routes_json FROM project_setup WHERE project_id = ?').get(projectId);
    if (!setup || (setup.pages_customized && !force)) return;
    const existing = pageList(projectId);
    // Pages the person already shaped (legacy routes_json) are migrated as-is, never reseeded.
    const legacy = parse(setup.routes_json, null);
    if (legacy && !existing.length) {
      legacy.forEach((route, index) => insert(projectId, 'page', { label: route.label, icon: route.icon, pageType: route.pageType, description: route.description, inNav: true, origin: 'You' }, { position: index }));
      db.prepare('UPDATE project_setup SET pages_customized = 1 WHERE project_id = ?').run(projectId);
      return;
    }
    const seeds = catalogs.feels[feel]?.seedRoutes || [catalogs.defaultRoute];
    for (const page of existing.filter(page => page.origin === 'Starting feel' && !page.stories.length && !pageList(projectId).some(child => child.parentId === page.id))) remove(projectId, page.id);
    const packLabels = new Set(pageList(projectId).map(page => page.label.toLowerCase()));
    seeds.filter(seed => !packLabels.has(seed.label.toLowerCase())).forEach((seed, index) => insert(projectId, 'page', { label: seed.label, icon: seed.icon, pageType: seed.pageType, inNav: true, origin: 'Starting feel' }, { position: index - 100 }));
    renumberNav(projectId);
  }

  function renumberNav(projectId) {
    pageList(projectId).filter(page => !page.parentId).forEach((page, index) => db.prepare('UPDATE knowledge_records SET position = ? WHERE id = ?').run(index, page.id));
  }

  // The onboarding and Pages editor save the whole navigation. Deleting a page that realises stories needs
  // somewhere for those stories to go; the caller passes reassign: { [deletedId]: targetId }.
  function saveNavRoutes(projectId, routes, { reassign = {}, author = 'You' } = {}) {
    if (!Array.isArray(routes) || routes.length < 1 || routes.length > 5) fail('Keep between one and five pages in the navigation.');
    const labels = new Set();
    for (const route of routes) {
      const label = String(route?.label || '').trim().toLowerCase();
      if (labels.has(label)) fail(`Two pages are both called “${route.label}”. Give each page its own name.`);
      labels.add(label);
    }
    const current = pageList(projectId).filter(page => !page.parentId && page.inNav);
    const keep = new Set(routes.map(route => route.id).filter(Boolean));
    const removed = current.filter(page => !keep.has(page.id));
    for (const page of removed) {
      if (page.stories.length && !reassign[page.id]) fail(`“${page.label}” realises ${page.stories.length} ${page.stories.length === 1 ? 'story' : 'stories'}. Choose which page takes them before deleting it.`, 409);
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const saved = routes.map((route, index) => {
        const existing = current.find(page => page.id === route.id);
        const data = { label: route.label, icon: route.icon, pageType: route.pageType, description: route.description, inNav: true };
        return existing ? update(projectId, existing.id, data, { position: index, author }) : insert(projectId, 'page', { ...data, origin: 'You' }, { position: index, author });
      });
      for (const page of removed) {
        const target = saved.find(item => item.id === reassign[page.id]) || pageList(projectId).find(item => item.id === reassign[page.id]);
        if (page.stories.length) {
          if (!target) fail('Choose an existing page to take the stories.', 400);
          update(projectId, target.id, { stories: [...new Set([...target.stories, ...page.stories])] }, { author, rationale: `Took the stories of “${page.label}” when it was deleted` });
        }
        remove(projectId, page.id);
      }
      db.prepare('UPDATE project_setup SET pages_customized = 1 WHERE project_id = ?').run(projectId);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    renumberNav(projectId);
    return navRoutes(projectId);
  }

  // ---- Story packs: seed ordinary stories; unselecting removes only untouched pack records ----
  function applyPacks(projectId, selected, { customIdeas = [] } = {}) {
    for (const id of selected) if (!packs[id]) fail('Choose story packs from the list.');
    const previous = parse(db.prepare('SELECT story_packs_json FROM project_setup WHERE project_id = ?').get(projectId)?.story_packs_json, []);
    const activities = list(projectId, 'activity');
    for (const id of previous.filter(id => !selected.includes(id))) {
      const activity = activities.find(item => item.pack === packs[id].label);
      if (!activity) continue;
      const steps = list(projectId, 'step').filter(step => step.parentId === activity.id);
      const stories = list(projectId, 'story').filter(story => steps.some(step => step.id === story.parentId));
      if (activity.revision === 1 && stories.every(story => story.revision === 1)) {
        const storyIds = new Set(stories.map(story => story.id));
        for (const page of pageList(projectId)) {
          if (page.origin === `${packs[id].label} pack` && page.revision === 1) remove(projectId, page.id);
          else if (page.stories.some(story => storyIds.has(story))) update(projectId, page.id, { stories: page.stories.filter(story => !storyIds.has(story)) });
        }
        remove(projectId, activity.id);
        for (const kind of ['access_rule', 'data_operation', 'data_object']) for (const record of list(projectId, kind)) if (record.pack === packs[id].label && record.revision === 1) remove(projectId, record.id);
      }
    }
    for (const id of selected.filter(id => !previous.includes(id))) seedPack(projectId, id);
    for (const idea of customIdeas) {
      const title = text(idea?.title, 160, 'Story idea');
      if (!title) continue;
      let activity = list(projectId, 'activity').find(item => item.title === 'Ideas to place');
      if (!activity) activity = insert(projectId, 'activity', { title: 'Ideas to place', persona: '' });
      let step = list(projectId, 'step').find(item => item.parentId === activity.id);
      if (!step) step = insert(projectId, 'step', { title: 'Unsorted' }, { parentId: activity.id });
      insert(projectId, 'story', { title, why: text(idea?.summary, 400, 'Why'), phase: 'demo' }, { parentId: step.id, author: 'You' });
    }
    db.prepare('UPDATE project_setup SET story_packs_json = ? WHERE project_id = ?').run(JSON.stringify(selected), projectId);
  }

  function seedPack(projectId, packId) {
    const pack = packs[packId];
    const activity = insert(projectId, 'activity', { title: pack.activity.title, persona: pack.activity.persona, pack: pack.label }, { rationale: `Seeded by the ${pack.label} story pack` });
    const steps = pack.steps.map(title => insert(projectId, 'step', { title }, { parentId: activity.id }));
    const stories = pack.stories.map(story => insert(projectId, 'story', {
      title: story.title, phase: story.phase, acceptance: story.acceptance || [], clarifications: story.clarifications || [], services: story.services || [], pack: pack.label, template: Boolean(story.template)
    }, { parentId: steps[story.step].id, rationale: `Seeded by the ${pack.label} story pack` }));
    const existing = pageList(projectId);
    const placePage = (page, parentId) => {
      const storyIds = (page.stories || []).map(index => stories[index].id);
      const match = !parentId && existing.find(item => !item.parentId && item.label.toLowerCase() === page.label.toLowerCase());
      if (match) {
        const merged = update(projectId, match.id, { stories: [...new Set([...match.stories, ...storyIds])] }, { rationale: `${pack.label} pack stories placed on the existing “${match.label}” page` });
        for (const child of page.children || []) placePage(child, merged.id);
        return merged;
      }
      const navCount = pageList(projectId).filter(item => !item.parentId && item.inNav).length;
      const inNav = Boolean(page.inNav) && !parentId && navCount < 5;
      const created = insert(projectId, 'page', { label: page.label, icon: page.icon, pageType: page.pageType, inNav, origin: `${pack.label} pack`, stories: storyIds }, { parentId, rationale: `Proposed by the ${pack.label} story pack` });
      for (const child of page.children || []) placePage(child, created.id);
      return created;
    };
    for (const page of pack.pages) placePage(page, null);
    seedPackData(projectId, packId, stories);
  }

  // A pack's Data contract: objects, then operations and access rules that refer to them by name. Template packs arrive
  // accepted, because the template is the contract; everything else is proposed until someone accepts it.
  function seedPackData(projectId, packId, stories = null) {
    const pack = packs[packId];
    if (!pack.objects?.length && !pack.operations?.length) return;
    if (list(projectId, 'data_object').some(object => object.pack === pack.label) || list(projectId, 'data_operation').some(operation => operation.pack === pack.label)) return;
    const storyIds = stories ? stories.map(story => story.id) : pack.stories.map(item => list(projectId, 'story').find(story => story.pack === pack.label && story.title === item.title)?.id || null);
    const pick = indexes => (indexes || []).map(index => storyIds[index]).filter(Boolean);
    const rationale = `Seeded by the ${pack.label} story pack`;
    const byName = new Map(list(projectId, 'data_object').map(object => [object.name, object.id]));
    const refs = node => node && JSON.parse(JSON.stringify(node), (key, value) => key === '$ref' ? (byName.get(value) || fail(`Pack ${packId} refers to an unknown object ${value}.`)) : value);
    const created = [];
    for (const object of pack.objects || []) {
      if (byName.has(object.name)) continue;
      const record = insert(projectId, 'data_object', { name: object.name, description: object.description, schema: object.schema, relations: [], states: object.states || [], stories: pick(object.stories),
        contract: object.template ? 'accepted' : 'proposed', origin: `${pack.label} pack`, pack: pack.label, template: Boolean(object.template) }, { rationale });
      byName.set(object.name, record.id); created.push([record, object]);
    }
    // Relations and $refs need every object in place first.
    for (const [record, object] of created) {
      const relations = (object.relations || []).filter(relation => byName.has(relation.target)).map(relation => ({ ...relation, target: byName.get(relation.target) }));
      const schema = refs(object.schema);
      if (!relations.length && JSON.stringify(schema) === JSON.stringify(record.schema)) continue;
      const data = JSON.stringify(validators.data_object({ ...record, relations, schema }));
      // Still the record's first revision: it is completed, not changed.
      db.prepare('UPDATE knowledge_records SET data_json = ? WHERE id = ?').run(data, record.id);
      db.prepare('UPDATE knowledge_revisions SET data_json = ? WHERE record_id = ? AND revision = 1').run(data, record.id);
    }
    const templatePack = Boolean(pack.objects?.some(object => object.template));
    for (const operation of pack.operations || []) {
      const template = operation.template ?? templatePack;
      insert(projectId, 'data_operation', { ...operation, objectId: operation.object ? byName.get(operation.object) : null, request: refs(operation.request), response: refs(operation.response),
        stories: pick(operation.stories), contract: template ? 'accepted' : 'proposed', pack: pack.label, template }, { rationale });
    }
    for (const rule of pack.access || []) insert(projectId, 'access_rule', { ...rule, objectId: byName.get(rule.object), pack: pack.label }, { rationale });
  }

  // ---- Work items ----
  // Status as people see it (WORK-UX-01): backlog, queued, staged (in an agent's batch or a person's list), working,
  // needs you, review, done. The stored states stay as they were.
  // A running batch locks all its items in (claimed); only the one the runner has started is working, the rest wait staged.
  const statusOf = (state, context) => state === 'suggested' ? 'backlog' : state === 'ready' ? (context?.batch || context?.staged ? 'staged' : 'queued')
    : state === 'claimed' ? (context?.run?.startedAt && !context.run.done ? 'working' : 'staged') : state === 'needs-input' ? 'needs' : state;
  const workRow = item => {
    if (!item) return null;
    const context = parse(item.context_json, null);
    return { id: item.id, number: item.number, ref: `W-${item.number}`, layer: item.layer, type: item.type, action: item.action || null, title: item.title, state: item.state,
      status: statusOf(item.state, context), priority: priorities.includes(item.priority) ? item.priority : 'medium',
      assignee: item.assignee_kind ? { kind: item.assignee_kind, id: item.assignee_id || (item.assignee_kind === 'agent' ? item.profile_id : null), label: item.assignee_label } : null,
      targets: parse(item.targets_json, []), question: parse(item.question_json, null), documents: parse(item.documents_json, []), log: parse(item.log_json, []),
      createdAt: item.created_at, updatedAt: item.updated_at, profileId: item.profile_id || null, instructions: parse(item.instructions_json, null), context,
      blocks: parse(item.blocks_json, []), checks: parse(item.checks_json, []) };
  };
  const workById = (projectId, id) => workRow(db.prepare('SELECT * FROM layer_work_items WHERE id = ? AND project_id = ?').get(id, projectId));
  function workList(projectId) {
    const rows = db.prepare('SELECT * FROM layer_work_items WHERE project_id = ? ORDER BY number DESC').all(projectId).map(workRow);
    // Jira's "is blocked by": the open items that list this one in their blocks.
    for (const item of rows) item.blockedBy = rows.filter(other => other.state !== 'done' && other.blocks.includes(item.id)).map(other => other.id);
    return rows;
  }
  const blockersOf = (projectId, id) => workList(projectId).find(item => item.id === id)?.blockedBy || [];
  const checkList = (texts, targets) => (texts || []).map(entry => ({ text: text(entry, 300, 'Check'), source: targets[0] ? { id: targets[0].id } : null, verdict: null, note: '' })).filter(check => check.text);

  // A starting priority: work on the current phase's stories comes first, later phases last (people change it freely).
  function priorityLevel(projectId, type, targets) {
    if (type === 'reconcile') return 'high';
    const phases = list(projectId, 'phase');
    const current = phases.find(phase => phase.current)?.key;
    const stories = list(projectId, 'story');
    const linked = targets.flatMap(target => {
      const record = get(projectId, target.id);
      if (!record) return [];
      if (record.kind === 'story') return [record];
      return (record.stories || []).map(id => stories.find(story => story.id === id)).filter(Boolean);
    });
    if (!linked.length) return 'medium';
    if (linked.some(story => story.phase === current)) return ['define', 'plan'].includes(type) ? 'high' : 'medium';
    return 'low';
  }

  function createWork(projectId, input, author = 'Aludel') {
    const targets = (Array.isArray(input.targets) ? input.targets : []).map(target => {
      const record = row(target.id);
      if (!record || record.project_id !== projectId) fail('A work target was not found.', 404);
      return { id: record.id, kind: record.kind, label: text(target.label, 160, 'Target') || record.kind };
    });
    const question = input.question ? { text: text(input.question.text, 400, 'Question', true), options: lines(input.question.options, 200, 'Option') } : null;
    const actionId = catalogs.roles.actions.has(input.action) ? input.action : actionIdFor(input.layer, input.type, { question, routineKey: input.routineKey });
    const definition = catalogs.roles.actions.get(actionId);
    const layer = input.layer ?? definition.layer;
    const type = input.type ?? definition.type;
    if (!layers.includes(layer)) fail('Unknown layer.');
    if (!workTypes.includes(type)) fail('Unknown work type.');
    if (!workStates.includes(input.state || 'ready')) fail('Unknown work state.');
    if (input.priority !== undefined && !priorities.includes(input.priority)) fail(`Choose a priority: ${priorities.join(', ')}.`);
    const number = counter(projectId, 'work');
    const id = `wrk-${randomBytes(4).toString('hex')}`;
    const created = now();
    const assignee = input.assignee ? resolveAssignee(projectId, input.assignee) : defaultAssignee(projectId, actionId);
    const checks = checkList(input.checks?.length ? input.checks : actionRecord(projectId, actionId)?.checks || definition.checks, targets);
    db.prepare(`INSERT INTO layer_work_items(id, project_id, number, layer, type, title, state, assignee_kind, assignee_label, targets_json, question_json, documents_json, log_json, created_at, updated_at,
      context_json, action, assignee_id, profile_id, priority, blocks_json, checks_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, number, layer, type, text(input.title, 160, 'Work title', true), input.state || 'ready',
        assignee?.kind || null, assignee?.label || null, JSON.stringify(targets), question ? JSON.stringify(question) : null,
        JSON.stringify(lines(input.documents, 300, 'Document')), JSON.stringify([{ at: created, text: input.logText || `Created by ${author}`, refs: targets.map(target => target.id) }]), created, created,
        input.context && typeof input.context === 'object' ? JSON.stringify(input.context) : null, actionId, assignee?.id || null, assignee?.kind === 'agent' ? assignee.id : null,
        input.priority || priorityLevel(projectId, type, targets), '[]', JSON.stringify(checks));
    return workById(projectId, id);
  }

  // Blocking links (Jira's "blocks" / "is blocked by"): same project, never itself, never a cycle.
  function validBlocks(projectId, item, blocks) {
    const clean = [...new Set((Array.isArray(blocks) ? blocks : []).map(String))];
    const all = workList(projectId);
    for (const id of clean) {
      if (id === item.id) fail(`${item.ref} can't block itself.`);
      if (!all.some(other => other.id === id)) fail('A linked work item was not found.', 404);
    }
    const next = new Map(all.map(other => [other.id, other.id === item.id ? clean : other.blocks]));
    const reaches = (from, goal, seen = new Set()) => (next.get(from) || []).some(id => id === goal || (!seen.has(id) && (seen.add(id), reaches(id, goal, seen))));
    for (const id of clean) if (reaches(id, item.id)) fail(`That link would make ${item.ref} block itself through ${all.find(other => other.id === id)?.ref}.`, 409);
    return clean;
  }

  function updateWork(user, projectId, workId, input) {
    const { state, assignee, answer, rationale, documents, priority, blocks, verdict, sendBack } = input;
    const item = workById(projectId, workId);
    if (!item) fail('Work item not found.', 404);
    const log = [...item.log];
    const by = { kind: 'person', id: user.id };
    const entry = (textValue, extra = {}) => log.push({ at: now(), text: textValue, by, ...extra });
    let outputs = item.documents;
    let question = item.question;
    let nextState = item.state;
    let checks = item.checks;
    let context = item.context;
    let answered = false;
    if (documents !== undefined) { outputs = lines(documents, 300, 'Document'); entry('Updated what this work will document'); }
    if (priority !== undefined && priority !== item.priority) {
      if (!priorities.includes(priority)) fail(`Choose a priority: ${priorities.join(', ')}.`);
      db.prepare('UPDATE layer_work_items SET priority = ? WHERE id = ?').run(priority, workId);
      entry(`Set priority to ${priority}`);
    }
    if (blocks !== undefined) {
      const clean = validBlocks(projectId, item, blocks);
      db.prepare('UPDATE layer_work_items SET blocks_json = ? WHERE id = ?').run(JSON.stringify(clean), workId);
      entry(clean.length ? 'Updated what this blocks' : 'Blocks nothing now', { refs: clean });
    }
    if (answer !== undefined) {
      if (!question) fail('This work item has no open question.');
      const chosen = text(answer, 400, 'Answer', true);
      question = { ...question, answer: chosen, rationale: text(rationale, 1000, 'Reason'), answeredBy: user.name, answeredAt: now() };
      entry(`Answered: ${chosen}`);
      answered = true;
    }
    if (assignee !== undefined) {
      if (item.state === 'claimed' || item.state === 'review') fail(`${item.ref} is ${item.state === 'review' ? 'ready for review' : 'being worked on'}; it can't be reassigned now.`, 409);
      const next = assignee === null ? null : resolveAssignee(projectId, assignee);
      db.prepare('UPDATE layer_work_items SET assignee_kind = ?, assignee_label = ?, assignee_id = ?, profile_id = ? WHERE id = ?')
        .run(next?.kind || null, next?.label || null, next?.id || null, next?.kind === 'agent' ? next.id : null, workId);
      entry(next ? `Assigned to ${next.label}` : 'Unassigned');
    }
    if (verdict !== undefined) {
      if (item.state !== 'review') fail(`${item.ref} isn't waiting for review.`, 409);
      const index = Number(verdict?.index);
      if (!Number.isInteger(index) || !checks[index]) fail('Unknown check.');
      if (![null, 'accept', 'reject'].includes(verdict.value ?? null)) fail('A check is accepted or rejected.');
      checks = checks.map((check, position) => position === index ? { ...check, verdict: verdict.value ?? null, note: text(verdict.note ?? check.note, 1000, 'Note'), by: verdict.value ? user.name : null, at: verdict.value ? now() : null } : check);
    }
    if (sendBack) {
      if (item.state !== 'review') fail(`${item.ref} isn't waiting for review.`, 409);
      const rejected = checks.filter(check => check.verdict === 'reject');
      if (!rejected.length) fail('Reject at least one check, with a note, to send it back.', 409);
      if (rejected.some(check => !check.note)) fail('Say what is wrong with each rejected check.', 409);
      const { batch, staged, ...rest } = context || {};
      context = { ...rest, feedback: rejected.map(check => ({ check: check.text, note: check.note, by: user.name, at: now() })) };
      entry(`Sent back: ${rejected.map(check => `“${check.text}”: ${check.note}`).join('; ')}`.slice(0, 1000));
      checks = checks.map(check => ({ ...check, verdict: null, note: '', by: null, at: null }));
      nextState = 'ready';
    }
    if (state !== undefined) {
      if (!workStates.includes(state)) fail('Unknown work state.');
      if (state === 'done') {
        if (!outputs.length && !checks.length) fail('Name what this work checks or documents before closing it (DEC-036: logs are not documentation).', 409);
        if (item.state === 'review' && checks.some(check => check.verdict !== 'accept')) fail('Accept every check before accepting the work, or send it back.', 409);
        if (verifiedTypes.includes(item.type) && item.assignee?.kind !== 'template') {
          const missing = item.targets.filter(target => !db.prepare('SELECT 1 FROM knowledge_revisions WHERE record_id = ? AND work_item_id = ?').get(target.id, item.id));
          if (missing.length) fail(`${missing.map(target => `“${target.label}”`).join(', ')} ${missing.length === 1 ? 'has' : 'have'} no change from ${item.ref} yet. Edit ${missing.length === 1 ? 'it' : 'them'} from this item (or apply the answer), then close it.`, 409);
        }
      }
      nextState = state;
      const moved = { done: item.state === 'review' ? 'Accepted it' : 'Marked it done', ready: item.state === 'suggested' ? 'Queued it' : 'Moved it back to the queue', suggested: 'Moved it to the backlog' };
      entry(moved[state] || `Moved it to ${state}`);
    }
    db.prepare('UPDATE layer_work_items SET state = ?, question_json = ?, documents_json = ?, log_json = ?, checks_json = ?, context_json = ?, updated_at = ? WHERE id = ?')
      .run(nextState, question ? JSON.stringify(question) : null, JSON.stringify(outputs), JSON.stringify(log), JSON.stringify(checks), context ? JSON.stringify(context) : null, now(), workId);
    // An answer lands in the records it changes (DEC-036); once it has, the question's work is done.
    if (answered) {
      const applicable = item.targets.filter(target => ['story', 'spec', 'page'].includes(target.kind));
      for (const target of applicable) applyAnswer(user, projectId, workId, target.id);
      if (applicable.length) {
        const current = workById(projectId, workId);
        const { batch, staged, ...rest } = current.context || {};
        db.prepare("UPDATE layer_work_items SET state = 'done', checks_json = ?, context_json = ?, log_json = ?, updated_at = ? WHERE id = ?")
          .run(JSON.stringify(current.checks.map(check => ({ ...check, verdict: 'accept', by: user.name, at: now() }))), JSON.stringify(rest),
            JSON.stringify([...current.log, { at: now(), text: 'Done: the answer is applied', by }]), now(), workId);
        nextState = 'done';
      }
    }
    const saved = workById(projectId, workId);
    if (nextState === 'done' && item.state !== 'done') for (const listener of doneListeners) listener({ projectId, item: saved, author: user.name });
    return saved;
  }

  // Log entries can name the records and files they touched (refs) and who made them (by).
  function appendLog(workId, entryText, changes = {}, { refs = [], by = null } = {}) {
    const item = workRow(db.prepare('SELECT * FROM layer_work_items WHERE id = ?').get(workId));
    if (!item) return null;
    const entry = { at: now(), text: entryText, ...(refs.length ? { refs } : {}), ...(by ? { by } : {}) };
    db.prepare('UPDATE layer_work_items SET log_json = ?, state = COALESCE(?, state), context_json = COALESCE(?, context_json), updated_at = ? WHERE id = ?')
      .run(JSON.stringify([...item.log, entry]), changes.state || null, changes.context ? JSON.stringify(changes.context) : null, now(), workId);
    return workRow(db.prepare('SELECT * FROM layer_work_items WHERE id = ?').get(workId));
  }
  const setWorkContext = (workId, context) => db.prepare('UPDATE layer_work_items SET context_json = ?, updated_at = ? WHERE id = ?').run(context ? JSON.stringify(context) : null, now(), workId);

  // What an item changed: every revision made from it, as field differences against the revision before (WORK-UX-01).
  function workChanges(projectId, workId) {
    const item = workById(projectId, workId);
    if (!item) fail('Work item not found.', 404);
    return db.prepare('SELECT record_id AS recordId, revision, author, rationale, created_at AS createdAt FROM knowledge_revisions WHERE work_item_id = ? ORDER BY created_at').all(workId).map(entry => {
      const record = row(entry.recordId);
      const after = revisionData(entry.recordId, entry.revision) || {};
      const before = entry.revision > 1 ? revisionData(entry.recordId, entry.revision - 1) || {} : {};
      const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
        .map(field => ({ field, before: before[field] ?? null, after: after[field] ?? null }));
      return { ...entry, kind: record?.kind || null, exists: Boolean(record), fields };
    });
  }

  // An edit made "from" a work item carries its id, so closing the item can verify the change happened (LAY-04A).
  function openWorkItem(projectId, workItemId) {
    if (!workItemId) return null;
    const item = workRow(db.prepare('SELECT * FROM layer_work_items WHERE id = ? AND project_id = ?').get(workItemId, projectId));
    if (!item) fail('Work item not found.', 404);
    if (item.state === 'done') fail(`${item.ref} is done; reopen it to record more changes against it.`, 409);
    return item;
  }

  // The answer lands in the record it changes, with the reason, as a revision linked to the item (DEC-036).
  function applyAnswer(user, projectId, workId, targetId) {
    const item = workRow(db.prepare('SELECT * FROM layer_work_items WHERE id = ? AND project_id = ?').get(workId, projectId));
    if (!item) fail('Work item not found.', 404);
    if (!item.question?.answer) fail('Answer the question before applying it.', 409);
    if (!item.targets.some(target => target.id === targetId)) fail('That record is not a target of this work item.');
    if (item.question.applied?.includes(targetId)) return item;
    const record = get(projectId, targetId);
    if (!record) fail('Record not found.', 404);
    const { text: question, answer, rationale } = item.question;
    const reason = `${question} → ${answer}${rationale ? `. ${rationale}` : ''}`.slice(0, 1000);
    let changes;
    if (record.kind === 'story' || record.kind === 'spec') {
      changes = { clarifications: record.clarifications.filter(entry => entry.trim() !== question.trim()), resolved: [...(record.resolved || []), { question, answer, work: item.ref }] };
    } else if (record.kind === 'page') {
      changes = { notes: `${record.notes ? `${record.notes}\n\n` : ''}Decided in ${item.ref}: ${question} ${answer}`.slice(0, 4000) };
    } else fail('Apply this answer by editing the record from this item.', 409);
    const saved = update(projectId, record.id, changes, { author: user.name, rationale: reason, workItemId: item.id });
    const applied = [...new Set([...(item.question.applied || []), record.id])];
    const log = [...item.log, { at: now(), text: `Applied the answer to ${target(item, record.id)} (revision ${saved.revision})` }];
    db.prepare('UPDATE layer_work_items SET question_json = ?, log_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify({ ...item.question, applied }), JSON.stringify(log), now(), item.id);
    return workRow(db.prepare('SELECT * FROM layer_work_items WHERE id = ?').get(item.id));
  }
  const target = (item, id) => item.targets.find(entry => entry.id === id)?.label || id;

  // ---- Suggestions: gaps each layer knows about (LAY-04B moved them to the server so automation can act on them) ----
  function suggestions(projectId, { stories, pages, work }) {
    const open = new Set(work.filter(item => item.state !== 'done').flatMap(item => item.targets.map(entry => `${item.type}:${entry.id}`)));
    const found = [];
    for (const story of stories) {
      const ref = `S${story.number}`;
      if (!story.acceptance.length && !open.has(`define:${story.id}`)) found.push({ key: `define:${story.id}`, layer: 'product', type: 'define', title: `Write acceptance for “${story.title}”`, targets: [{ id: story.id, kind: 'story', label: story.title }], documents: [`Product › ${ref} acceptance`] });
      for (const question of story.clarifications) if (!open.has(`define:${story.id}`)) found.push({ key: `clarify:${story.id}:${question}`, layer: 'product', type: 'define', title: `Clarify: ${question}`.slice(0, 160), targets: [{ id: story.id, kind: 'story', label: story.title }], question: { text: question, options: [] }, documents: [`Product › ${ref} (clarified)`] });
    }
    for (const page of pages) {
      if (page.status !== 'designed' && page.stories.length && !open.has(`design:${page.id}`)) found.push({ key: `design:${page.id}`, layer: 'pages', type: 'design', title: `Design the ${page.label} page`, targets: [{ id: page.id, kind: 'page', label: `${page.label} page` }], documents: [`Pages › ${page.label} (designed revision)`] });
    }
    // A proposed object that a Demo or MVP story needs gets its contract written (the Architect's plan work).
    const needed = new Set(stories.filter(story => story.phase !== 'later').map(story => story.id));
    for (const object of list(projectId, 'data_object')) {
      if (object.contract !== 'accepted' && object.stories.some(id => needed.has(id)) && !open.has(`plan:${object.id}`)) found.push({ key: `plan:${object.id}`, layer: 'data', type: 'plan', title: `Write the ${object.name} contract`, targets: [{ id: object.id, kind: 'data_object', label: `${object.name} object` }], documents: [`Data › ${object.name} (accepted contract)`] });
    }
    return found;
  }

  // ---- Backlog (WORK-UX-01, DEC-041): each gap a layer finds becomes an ordinary backlog item, assigned by its action ----
  const layerNames = { product: 'Product', design: 'Design', pages: 'Pages', data: 'Data', platform: 'Platform', work: 'Work' };
  function syncBacklog(projectId) {
    const work = workList(projectId);
    const gaps = suggestions(projectId, { stories: list(projectId, 'story'), pages: pageList(projectId), work: [] });
    const current = new Set(gaps.map(gap => gap.key));
    const covered = new Set(work.filter(item => item.state !== 'done').flatMap(item => [item.context?.suggestion, ...item.targets.map(target => `${item.action}:${target.id}`)]).filter(Boolean));
    const created = [];
    for (const gap of gaps) {
      const actionId = actionIdFor(gap.layer, gap.type, { question: gap.question });
      if (covered.has(gap.key) || (!gap.question && gap.targets.some(target => covered.has(`${actionId}:${target.id}`)))) continue;
      created.push(createWork(projectId, { ...gap, action: actionId, state: 'suggested', context: { suggestion: gap.key }, logText: `Created by the ${layerNames[gap.layer]} layer` }));
      covered.add(gap.key);
    }
    // A gap filled some other way closes its backlog item: removed if nobody touched it, otherwise marked done.
    for (const item of work.filter(entry => entry.state === 'suggested' && entry.context?.suggestion && !current.has(entry.context.suggestion))) {
      const touched = item.log.length > 1 || db.prepare('SELECT 1 FROM knowledge_revisions WHERE work_item_id = ?').get(item.id);
      if (!touched) db.prepare('DELETE FROM layer_work_items WHERE id = ?').run(item.id);
      else appendLog(item.id, 'Done: the gap was filled outside this item', { state: 'done' });
    }
    return created;
  }

  // One-time (WORK-UX-01): items from before actions get an action, a priority, checks, an assignee id and, if a person
  // held them, a place in that person's list.
  function migrateWork(projectId) {
    const owner = ownerOf(projectId);
    const people = members(projectId);
    const routineKeys = new Map(list(projectId, 'routine').map(routine => [routine.id, routine.key]));
    for (const item of workList(projectId).filter(entry => !entry.action)) {
      const actionId = actionIdFor(item.layer, item.type, { question: item.question, routineKey: routineKeys.get(item.context?.routine) });
      const person = item.assignee?.kind === 'person' ? (people.find(member => member.name === item.assignee.label)?.id || owner) : null;
      const context = item.state === 'claimed' && item.assignee?.kind === 'person' ? { ...(item.context || {}), staged: true } : item.context;
      const checks = item.state === 'done' ? [] : checkList(actionRecord(projectId, actionId)?.checks || catalogs.roles.actions.get(actionId).checks, item.targets);
      db.prepare(`UPDATE layer_work_items SET action = ?, priority = ?, blocks_json = '[]', checks_json = ?, assignee_id = COALESCE(assignee_id, ?), context_json = ?,
        state = CASE WHEN state = 'claimed' AND assignee_kind = 'person' THEN 'ready' ELSE state END WHERE id = ?`)
        .run(actionId, priorityLevel(projectId, item.type, item.targets), JSON.stringify(checks), person || item.profileId || null, context ? JSON.stringify(context) : null, item.id);
    }
  }

  // ---- Routines (LAY-04C) ----
  function ensureRoutines(projectId) {
    if (list(projectId, 'routine').length) return;
    for (const routine of catalogs.routines || []) insert(projectId, 'routine', routine, { rationale: 'Default routine' });
  }
  const lastRun = routineId => db.prepare('SELECT * FROM routine_runs WHERE routine_id = ? ORDER BY id DESC LIMIT 1').get(routineId) || null;
  function nextRunAt(routine) {
    if (!routine.enabled || routine.cadence === 'before-release') return null;
    const from = lastRun(routine.id)?.ran_at || db.prepare('SELECT created_at FROM knowledge_records WHERE id = ?').get(routine.id).created_at;
    return new Date(Date.parse(from) + cadenceDays[routine.cadence] * 86400000).toISOString();
  }
  // Runs what is due (schedule), every before-release routine (release) or one routine now (manual). One open item per routine.
  function runRoutines(projectId, { trigger = 'schedule', at = now(), routineId = null } = {}) {
    const created = [];
    for (const routine of list(projectId, 'routine')) {
      if (routineId ? routine.id !== routineId : !routine.enabled) continue;
      if (!routineId && trigger === 'schedule' && (routine.cadence === 'before-release' || nextRunAt(routine) > at)) continue;
      if (!routineId && trigger === 'release' && routine.cadence !== 'before-release') continue;
      const open = workList(projectId).find(item => item.context?.routine === routine.id && item.state !== 'done');
      if (open) { if (routineId) fail(`${open.ref} from this routine is still open.`, 409); continue; }
      const item = createWork(projectId, { layer: routine.layer, type: routine.type, state: 'ready', title: `${routine.title} · ${at.slice(0, 10)}`, targets: [], documents: routine.documents,
        context: { routine: routine.id }, routineKey: routine.key, logText: `Created by the “${routine.title}” routine (${trigger === 'schedule' ? routine.cadence : trigger})` });
      db.prepare('INSERT INTO routine_runs(routine_id, project_id, ran_at, trigger, work_item_id) VALUES (?, ?, ?, ?, ?)').run(routine.id, projectId, at, trigger, item.id);
      created.push(item);
    }
    return created;
  }
  const routineView = projectId => list(projectId, 'routine').map(routine => {
    const run = lastRun(routine.id);
    return { ...routine, nextRunAt: nextRunAt(routine), lastRunAt: run?.ran_at || null, lastWorkId: run?.work_item_id || null, history: history(routine.id) };
  });

  // After a template build: template stories are built (a done work item says so) and every page has a skeleton.
  function recordBuild(projectId, commit, { auth }) {
    const templateStories = list(projectId, 'story').filter(story => story.template);
    const already = workList(projectId).some(item => item.assignee?.kind === 'template' && item.state === 'done');
    if (auth && templateStories.length && !already) {
      createWork(projectId, { layer: 'product', type: 'implement', state: 'done', title: 'Accounts: sign up, sign in and sign out', assignee: { kind: 'template', label: 'Aludel template' },
        targets: templateStories.map(story => ({ id: story.id, label: story.title })), documents: templateStories.map(story => `Product › “${story.title}” built`).concat([`Platform › build ${String(commit || '').slice(0, 7)}`]),
        logText: `Built by the aludel-web-v1 template (${String(commit || '').slice(0, 7)})` });
    }
    // A status change, not a decision: the build itself is documented once, by the template work item.
    for (const page of pageList(projectId)) if (page.status === 'planned') update(projectId, page.id, { status: 'skeleton' }, { author: 'Aludel template' });
  }

  // ---- Derived story status: never set by hand ----
  function storyStatus(story, pages, work) {
    const done = type => work.some(item => item.state === 'done' && item.type === type && item.targets.some(target => target.id === story.id));
    if (done('implement')) return 'built';
    if (pages.some(page => page.status === 'designed' && page.stories.includes(story.id)) || done('design')) return 'designed';
    if (story.acceptance.length) return 'defined';
    return 'proposed';
  }

  // proposed (named) → contracted (accepted) → built (linked code) → shipped (in a production release; none locally yet).
  const dataStatus = (record, built) => built?.shipped ? 'shipped' : built?.units ? 'built' : record.contract === 'accepted' ? 'contracted' : 'proposed';

  function view(user, projectId, { builtBy = new Map() } = {}) {
    requireMember(db, user, projectId);
    const work = workList(projectId);
    const pages = pageList(projectId);
    const stories = list(projectId, 'story').map(story => ({ ...story, ref: `S${story.number}`, status: storyStatus(story, pages, work),
      pages: pages.filter(page => page.stories.includes(story.id)).map(page => page.id), work: work.filter(item => item.targets.some(target => target.id === story.id)).map(item => item.id),
      history: history(story.id) }));
    const steps = list(projectId, 'step');
    const activities = list(projectId, 'activity').map(activity => ({ ...activity, steps: steps.filter(step => step.parentId === activity.id).map(step => ({ ...step, stories: stories.filter(story => story.parentId === step.id).map(story => story.id) })) }));
    const vision = Object.fromEntries(list(projectId, 'vision_section').map(section => [section.key, { ...section, title: visionTitles[section.key] }]));
    return {
      vision, personas: list(projectId, 'persona'), phases: list(projectId, 'phase'), activities, stories,
      specs: list(projectId, 'spec').map(spec => ({ ...spec, ref: `SPEC-${String(spec.number).padStart(2, '0')}` })),
      research: list(projectId, 'research'), docs: list(projectId, 'doc'),
      pages: pages.map(page => ({ ...page, history: history(page.id) })), work,
      packs: Object.fromEntries(Object.entries(packs).map(([id, pack]) => [id, { label: pack.label, summary: pack.summary, icon: pack.icon, stories: pack.stories.length, template: pack.stories.filter(story => story.template).length }])),
      selectedPacks: parse(db.prepare('SELECT story_packs_json FROM project_setup WHERE project_id = ?').get(projectId)?.story_packs_json, []),
      objects: list(projectId, 'data_object').map(object => ({ ...object, status: dataStatus(object, builtBy.get(object.id)), history: history(object.id) })),
      operations: list(projectId, 'data_operation').map(operation => ({ ...operation, status: dataStatus(operation, builtBy.get(operation.id)), history: history(operation.id) })),
      access: list(projectId, 'access_rule'),
      profiles: profiles(projectId).map(({ workTypes: legacyTypes, writes, approvalRequired, budget, icon, role, accountId, ...profile }) => ({ ...profile, history: history(profile.id) })),
      projectInstructions: list(projectId, 'project_instructions')[0] || null,
      roles: roleView(projectId), members: members(projectId), workTypes, routines: routineView(projectId),
      services: Object.entries(catalogs.services || {}).map(([key, service]) => ({ key, ...service, stories: stories.filter(story => story.services.includes(key)).map(story => story.id) }))
    };
  }

  // The Data layer as one OpenAPI 3.1 document; object ids become component references.
  function openApi(projectId, { title = 'App', version = '0.1.0' } = {}) {
    const objects = list(projectId, 'data_object');
    const names = new Map(objects.map(object => [object.id, object.name]));
    const convert = node => node && JSON.parse(JSON.stringify(node), (key, value) => key === '$ref' ? `#/components/schemas/${names.get(value) || value}` : value);
    const paths = {};
    for (const operation of list(projectId, 'data_operation')) {
      const content = schema => schema ? { content: { 'application/json': { schema: convert(schema) } } } : {};
      paths[operation.path] ||= {};
      paths[operation.path][operation.method.toLowerCase()] = {
        operationId: operation.operationId, summary: operation.summary, tags: [names.get(operation.objectId) || 'General'],
        ...(operation.parameters.length ? { parameters: operation.parameters.map(({ name, in: where, required, schema, description }) => ({ name, in: where, required, schema: convert(schema), ...(description ? { description } : {}) })) } : {}),
        ...(operation.request ? { requestBody: { required: true, ...content(operation.request) } } : {}),
        responses: { [operation.response.status]: { description: operation.response.description || 'Success', ...content(operation.response.schema) },
          ...Object.fromEntries(operation.errors.map(error => [error.status, { description: error.description }])) },
        'x-aludel-roles': operation.roles, 'x-aludel-contract': operation.contract, 'x-aludel-revision': operation.revision
      };
    }
    const schemas = Object.fromEntries(objects.map(object => [object.name, { ...convert(object.schema), ...(object.description ? { description: object.description } : {}),
      ...(object.relations.length ? { 'x-aludel-relations': object.relations.map(relation => ({ ...relation, target: `#/components/schemas/${names.get(relation.target)}` })) } : {}),
      ...(object.states.length ? { 'x-aludel-states': object.states } : {}), 'x-aludel-contract': object.contract, 'x-aludel-revision': object.revision }]));
    return { openapi: '3.1.0', info: { title, version }, jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema', paths, components: { schemas } };
  }

  // Deleting a record others point at would leave dangling contracts; name what still uses it.
  function referrers(projectId, id) {
    return ['data_object', 'data_operation', 'access_rule'].flatMap(kind => list(projectId, kind).filter(record => record.id !== id && (references[kind]?.(record) || []).some(([target]) => target === id)))
      .map(record => record.name || record.operationId || record.sentence);
  }

  // Start-up: projects that chose packs before LAY-07 get their Data contract and runtime-service needs.
  function ensurePackData(projectId) {
    const selected = parse(db.prepare('SELECT story_packs_json FROM project_setup WHERE project_id = ?').get(projectId)?.story_packs_json, []);
    for (const packId of selected.filter(id => packs[id])) {
      seedPackData(projectId, packId);
      for (const item of packs[packId].stories.filter(entry => entry.services?.length)) {
        const story = list(projectId, 'story').find(entry => entry.pack === packs[packId].label && entry.title === item.title);
        // Only stories saved before services existed: an empty list someone chose stays empty.
        if (story && story.services === undefined) update(projectId, story.id, { services: item.services }, { rationale: `Needs ${item.services.join(', ')} (from the ${packs[packId].label} pack)` });
      }
    }
  }

  return { ensureProject, ensureAgents, ensureRoles, ensurePackData, insert, update, remove, list, get, view, navRoutes, seedPages, saveNavRoutes, applyPacks, createWork, updateWork, appendLog,
    setWorkContext, workList, workById, blockersOf, workChanges, recordBuild, history, revisionData, revisionAt, kinds, openApi, referrers, openWorkItem, applyAnswer, suggestions, syncBacklog,
    migrateWork, ensureRoutines, runRoutines, instructionPins, actionRecord, actionIdFor, roleView, resolveAssignee, defaultProfile, members, agentExport,
    onRevision: listener => revisionListeners.push(listener), onWorkDone: listener => doneListeners.push(listener) };
}
