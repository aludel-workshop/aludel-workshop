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
const lines = (value, max, label) => (Array.isArray(value) ? value : []).map(item => text(item, max, label)).filter(Boolean);
const ids = value => (Array.isArray(value) ? value : []).map(String).filter(item => /^[a-z]+-[a-z0-9]{6,12}$/.test(item));

export const phaseKeys = ['demo', 'mvp', 'later'];
export const visionKeys = ['statement', 'needs', 'capabilities', 'outcomes', 'principles', 'nogos'];
const visionTitles = { statement: 'Vision', needs: 'Needs and opportunities', capabilities: 'Standout capabilities', outcomes: 'Outcomes and measures', principles: 'Principles', nogos: 'No-gos' };
const pageStatuses = ['planned', 'skeleton', 'designed'];
const specStatuses = ['draft', 'in-review', 'accepted', 'superseded'];
export const workStates = ['suggested', 'ready', 'claimed', 'needs-input', 'review', 'done'];
export const workTypes = ['define', 'spec', 'plan', 'design', 'implement', 'review', 'research', 'audit', 'configure'];
const layers = ['product', 'design', 'pages', 'platform', 'work'];

export function loadStoryPacks(configDirectory) {
  const { packs } = JSON.parse(readFileSync(join(configDirectory, 'story-packs.json'), 'utf8'));
  for (const [id, pack] of Object.entries(packs)) {
    for (const story of pack.stories) if (!pack.steps[story.step] || !phaseKeys.includes(story.phase)) throw new Error(`Story pack ${id} has an invalid story.`);
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
  story: data => {
    if (!phaseKeys.includes(data.phase)) fail('Choose a phase for the story.');
    const acceptance = (Array.isArray(data.acceptance) ? data.acceptance : []).map(item => ({
      given: text(item?.given, 400, 'Given'), when: text(item?.when, 400, 'When'), then: text(item?.then, 400, 'Then')
    })).filter(item => item.given || item.when || item.then);
    for (const item of acceptance) if (!item.given || !item.when || !item.then) fail('Each acceptance scenario needs Given, When and Then.');
    return { number: Number(data.number) || 0, title: text(data.title, 160, 'Story', true), phase: data.phase, why: text(data.why, 400, 'Why'), acceptance,
      edges: lines(data.edges, 300, 'Edge case'), clarifications: lines(data.clarifications, 300, 'Clarification'),
      pack: data.pack ? text(data.pack, 40, 'Pack') : null, template: Boolean(data.template) };
  },
  spec: data => {
    if (!specStatuses.includes(data.status || 'draft')) fail('Unknown spec status.');
    if (!phaseKeys.includes(data.phase || 'demo')) fail('Choose a phase for the spec.');
    return { number: Number(data.number) || 0, title: text(data.title, 120, 'Spec title', true), phase: data.phase || 'demo', status: data.status || 'draft',
      stories: ids(data.stories), problem: text(data.problem, 2000, 'Problem'), appetite: text(data.appetite, 80, 'Appetite'), solution: text(data.solution, 4000, 'Solution sketch'),
      rabbitHoles: lines(data.rabbitHoles, 400, 'Rabbit hole'), noGos: lines(data.noGos, 400, 'No-go'), requirements: lines(data.requirements, 600, 'Requirement'),
      entities: lines(data.entities, 200, 'Entity'), success: lines(data.success, 400, 'Success criterion'), assumptions: lines(data.assumptions, 400, 'Assumption'),
      clarifications: lines(data.clarifications, 400, 'Clarification') };
  },
  research: data => ({ title: text(data.title, 120, 'Research title', true), body: text(data.body, 8000, 'Research notes'), supports: ids(data.supports) }),
  doc: data => ({ title: text(data.title, 120, 'Document title', true), template: text(data.template || 'Blank', 40, 'Template'), body: text(data.body, 40000, 'Document') }),
  page: (data, catalogs) => {
    if (!catalogs.routeIcons.includes(data.icon)) fail(`Choose an icon from the list for “${data.label}”.`);
    if (!catalogs.pageTypes[data.pageType]) fail(`Choose a page type for “${data.label}”.`);
    if (!pageStatuses.includes(data.status || 'planned')) fail('Unknown page status.');
    return { label: text(data.label, 30, 'Page name', true), icon: data.icon, pageType: data.pageType, description: text(data.description, 1000, 'Page description'),
      inNav: Boolean(data.inNav), origin: text(data.origin || 'You', 60, 'Origin'), stories: ids(data.stories), status: data.status || 'planned', notes: text(data.notes, 4000, 'Notes') };
  }
};
const kinds = Object.keys(validators);
const prefixes = { vision_section: 'vis', persona: 'per', phase: 'pha', activity: 'act', step: 'stp', story: 'sto', spec: 'spc', research: 'res', doc: 'doc', page: 'pag' };
const newId = kind => `${prefixes[kind]}-${randomBytes(4).toString('hex')}`;

export function knowledge({ db, catalogs, packs }) {
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

  function update(projectId, id, changes, { expectedRevision, author = 'Aludel', rationale = null, workItemId = null, position, parentId } = {}) {
    const current = row(id);
    if (!current || current.project_id !== projectId) fail('Record not found.', 404);
    if (expectedRevision !== undefined && Number(expectedRevision) !== current.revision) fail('This record changed since you opened it. Reload to see the latest; your edit is kept.', 409);
    const merged = validators[current.kind]({ ...parse(current.data_json, {}), ...changes }, catalogs);
    const same = JSON.stringify(merged) === current.data_json && position === undefined && parentId === undefined;
    if (same) return hydrate(current);
    const revision = current.revision + 1;
    const updated = now();
    db.prepare('UPDATE knowledge_records SET data_json = ?, revision = ?, updated_at = ?, position = COALESCE(?, position), parent_id = CASE WHEN ? THEN ? ELSE parent_id END WHERE id = ?')
      .run(JSON.stringify(merged), revision, updated, position ?? null, parentId !== undefined ? 1 : 0, parentId ?? null, id);
    db.prepare('INSERT INTO knowledge_revisions(record_id, revision, data_json, author, rationale, work_item_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, revision, JSON.stringify(merged), author, rationale, workItemId, updated);
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
      title: story.title, phase: story.phase, acceptance: story.acceptance || [], clarifications: story.clarifications || [], pack: pack.label, template: Boolean(story.template)
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
  }

  // ---- Work items ----
  const workRow = item => item && { id: item.id, number: item.number, ref: `W-${item.number}`, layer: item.layer, type: item.type, title: item.title, state: item.state,
    assignee: item.assignee_kind ? { kind: item.assignee_kind, label: item.assignee_label } : null, targets: parse(item.targets_json, []), question: parse(item.question_json, null),
    documents: parse(item.documents_json, []), log: parse(item.log_json, []), createdAt: item.created_at, updatedAt: item.updated_at };
  const workList = projectId => db.prepare('SELECT * FROM layer_work_items WHERE project_id = ? ORDER BY number DESC').all(projectId).map(workRow);

  function createWork(projectId, input, author = 'Aludel') {
    if (!layers.includes(input.layer)) fail('Unknown layer.');
    if (!workTypes.includes(input.type)) fail('Unknown work type.');
    if (!workStates.includes(input.state || 'ready')) fail('Unknown work state.');
    const targets = (Array.isArray(input.targets) ? input.targets : []).map(target => {
      const record = row(target.id);
      if (!record || record.project_id !== projectId) fail('A work target was not found.', 404);
      return { id: record.id, kind: record.kind, label: text(target.label, 160, 'Target') || record.kind };
    });
    const number = counter(projectId, 'work');
    const id = `wrk-${randomBytes(4).toString('hex')}`;
    const created = now();
    const assignee = input.assignee || null;
    db.prepare(`INSERT INTO layer_work_items(id, project_id, number, layer, type, title, state, assignee_kind, assignee_label, targets_json, question_json, documents_json, log_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, projectId, number, input.layer, input.type, text(input.title, 160, 'Work title', true), input.state || 'ready',
      assignee?.kind || null, assignee?.label || null, JSON.stringify(targets), input.question ? JSON.stringify(input.question) : null,
      JSON.stringify(lines(input.documents, 300, 'Document')), JSON.stringify([{ at: created, text: input.logText || `Created by ${author}` }]), created, created);
    return workRow(db.prepare('SELECT * FROM layer_work_items WHERE id = ?').get(id));
  }

  function updateWork(user, projectId, workId, { state, assignee, answer, rationale, documents }) {
    const item = workRow(db.prepare('SELECT * FROM layer_work_items WHERE id = ? AND project_id = ?').get(workId, projectId));
    if (!item) fail('Work item not found.', 404);
    const log = [...item.log];
    let outputs = item.documents;
    if (documents !== undefined) { outputs = lines(documents, 300, 'Document'); log.push({ at: now(), text: 'Updated what this work will document' }); }
    let question = item.question;
    let nextState = item.state;
    if (answer !== undefined) {
      if (!question) fail('This work item has no open question.');
      const chosen = text(answer, 400, 'Answer', true);
      question = { ...question, answer: chosen, rationale: text(rationale, 1000, 'Reason'), answeredBy: user.name, answeredAt: now() };
      log.push({ at: now(), text: `${user.name} answered: ${chosen}` });
      if (item.state === 'needs-input') nextState = item.assignee?.kind === 'agent' ? 'claimed' : 'ready';
    }
    if (assignee !== undefined) {
      if (assignee !== null && !['agent', 'person'].includes(assignee.kind)) fail('Assign the item to an agent or a person.');
      const label = assignee === null ? null : assignee.kind === 'person' ? user.name : text(assignee.label || 'Agent', 60, 'Agent');
      db.prepare('UPDATE layer_work_items SET assignee_kind = ?, assignee_label = ? WHERE id = ?').run(assignee?.kind || null, label, workId);
      log.push({ at: now(), text: assignee === null ? 'Unassigned' : `Assigned to ${label}` });
      if (nextState === 'ready' && assignee) nextState = 'claimed';
    }
    if (state !== undefined) {
      if (!workStates.includes(state)) fail('Unknown work state.');
      if (state === 'done' && !outputs.length) fail('Name what this work documented before closing it (DEC-036: logs are not documentation).', 409);
      nextState = state;
      log.push({ at: now(), text: `State: ${state}` });
    }
    db.prepare('UPDATE layer_work_items SET state = ?, question_json = ?, documents_json = ?, log_json = ?, updated_at = ? WHERE id = ?').run(nextState, question ? JSON.stringify(question) : null, JSON.stringify(outputs), JSON.stringify(log), now(), workId);
    return workRow(db.prepare('SELECT * FROM layer_work_items WHERE id = ?').get(workId));
  }

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

  function view(user, projectId) {
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
      selectedPacks: parse(db.prepare('SELECT story_packs_json FROM project_setup WHERE project_id = ?').get(projectId)?.story_packs_json, [])
    };
  }

  return { ensureProject, insert, update, remove, list, view, navRoutes, seedPages, saveNavRoutes, applyPacks, createWork, updateWork, workList, recordBuild, history, kinds };
}
