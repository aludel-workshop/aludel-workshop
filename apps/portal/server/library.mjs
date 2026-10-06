// DEC-059 (T03-G1): the Library is the one place layers read each other. Every enabled layer instance publishes its
// accepted outputs and its Knowledge (charter, method docs, policies) here, beside the Library's own content: research
// (sources, findings, insights) and project documents. People,
// agents and layer views search and read entries; a cross-layer reference pins an entry (ref + revision) and names the
// instance that owns it. Nothing here writes: each layer still changes its outputs only through its own API.
//
// W-10: everything is in the Library, and its search is the only search. Knowledge is what each layer's Knowledge tab
// shows (repository docs included), and Work's items come in with their actions and threads. Something new becomes
// findable by being published here, never by another search over a copy; a UI may filter these results, nothing more.
// The pool is kept in an FTS5 index per project, in parts (a layer's files, records, a layer's Knowledge, the Library's
// own content, Work); a part is rebuilt only when its fingerprint changes, checked when someone searches.
import { createHash } from 'node:crypto';
import { layerDocumentList, layerDocumentRead } from './layer-space.mjs';
import { currentFileEntries, fileEntry } from './layer-files.mjs';
import { layerPackageForProject } from './layer-package.mjs';
import { layerDocs } from './layer-docs.mjs';
import { layerBinding } from './layer-source.mjs';
import { projectLayerDefinition } from './layer-registry.mjs';
import { entryRoles } from './entry-roles.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const sha = value => createHash('sha256').update(value).digest('hex');
export const libraryKinds = ['source', 'finding', 'insight', 'doc'];
export const librarySources = ['output', 'knowledge', 'library', 'work'];
// k:<layer>:<doc key> is a Knowledge doc kept in the database; k:<layer>:<path> one in the layer's repository, at its pin.
const knowledgeRef = /^k:([a-z][a-z0-9_]{1,31}):(.+)$/;
const storedDoc = /^(?:[a-z][a-z0-9-]{0,63}|identity)$/;
const titleFields = ['title', 'name', 'label', 'operationId', 'path', 'text', 'sentence', 'summary', 'description'];
const libraryLayer = { key: 'library', name: 'Library', instanceId: null };
const workLayer = { key: 'work', name: 'Work', instanceId: null };

export function initLibraryIndex(db) {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS library_index USING fts5(title, path, heading, body,
      project_id UNINDEXED, part UNINDEXED, seq UNINDEXED, ref UNINDEXED, section UNINDEXED, anchor UNINDEXED, meta UNINDEXED,
      tokenize = 'unicode61 remove_diacritics 2');
    CREATE TABLE IF NOT EXISTS library_index_parts (project_id TEXT NOT NULL, part TEXT NOT NULL, fingerprint TEXT NOT NULL, PRIMARY KEY(project_id, part));
  `);
}

// Installed, enabled layers with the output kinds each owns.
function layers(db, projectId) {
  return db.prepare(`SELECT d.layer_key AS key, d.name, d.output_kinds_json AS outputs, i.instance_id AS instanceId FROM layer_definitions d
    JOIN layer_instances i ON i.project_id = d.project_id AND i.layer_key = d.layer_key WHERE d.project_id = ? AND i.enabled = 1 ORDER BY d.rowid`).all(projectId)
    .map(row => ({ key: row.key, name: row.name, instanceId: row.instanceId, outputs: parse(row.outputs) || [] }));
}

// The instance that owns a stored record: its own tag, or, for records written before instances were tagged, the one
// installed layer that owns the kind. Null when that is ambiguous or no installed layer owns it.
export function recordOwner(db, projectId, record) {
  const installed = layers(db, projectId);
  const instance = record.layer_instance_id ?? record.layerInstanceId ?? null;
  if (instance) return installed.find(layer => layer.instanceId === instance) || null;
  const owners = installed.filter(layer => layer.outputs.includes(record.kind));
  return owners.length === 1 ? owners[0] : null;
}

const title = data => String(titleFields.map(field => data?.[field]).find(value => typeof value === 'string' && value.trim()) || '').trim();
const words = (value, depth = 0) => depth > 4 || value === null || value === undefined ? '' : typeof value === 'string' ? value
  : Array.isArray(value) ? value.map(entry => words(entry, depth + 1)).join(' ') : typeof value === 'object' ? Object.values(value).map(entry => words(entry, depth + 1)).join(' ') : '';
const norm = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const tokens = value => norm(value).split(' ').filter(Boolean);
export const headingAnchor = heading => String(heading).toLowerCase().replace(/[`*_~[\]()]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');

// A Markdown doc in parts, one per heading, so a match can open at its section. Front matter is metadata, not text.
function sections(markdown) {
  const out = []; let heading = null, lines = [], fence = false;
  const flush = () => { const body = lines.join('\n').trim(); if (body || heading) out.push({ heading, anchor: heading ? headingAnchor(heading) : null, body }); };
  for (const line of String(markdown).replace(/^---\n[\s\S]*?\n---\n/, '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const match = !fence && /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) { flush(); heading = match[1]; lines = []; } else lines.push(line);
  }
  flush();
  return out.length ? out : [{ heading: null, anchor: null, body: '' }];
}

// The FTS5 query for what a person typed: every word must match (the last as a prefix, for search as you type); a word
// joined by punctuation (DEC-062, operating-procedure) is a phrase; a quoted query is one phrase.
function expression(query) {
  const quoted = /^"(.+)"$/.exec(query.trim());
  const groups = quoted ? [tokens(quoted[1])] : query.trim().split(/\s+/).map(tokens).filter(group => group.length);
  if (!groups.length || !groups.flat().length) return null;
  return groups.map((group, index) => `"${group.join(' ')}"${!quoted && index === groups.length - 1 ? '*' : ''}`).join(' AND ');
}

const excerpt = (text, query) => {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  // Around the whole query where it appears, else the first word that does.
  const whole = lower.indexOf(query.toLowerCase().replace(/^"|"$/g, ''));
  const positions = tokens(query).map(word => lower.indexOf(word)).filter(at => at >= 0);
  const at = whole >= 0 ? whole : positions.length ? Math.min(...positions) : -1;
  const start = at > 60 ? at - 60 : 0;
  return (start ? '…' : '') + flat.slice(start, start + 200) + (flat.length > start + 200 ? '…' : '');
};

export function library({ db, know }) {
  initLibraryIndex(db);
  const docs = layerDocs({ db, revisionOf: (projectId, id) => know.get(projectId, id)?.revision });
  // Knowledge is read as the project owner: the Library is project-wide (DEC-054), and membership is checked on the way in.
  const reader = projectId => db.prepare("SELECT user_id FROM project_members WHERE project_id = ? AND role = 'owner' ORDER BY rowid LIMIT 1").get(projectId)?.user_id;
  const member = (projectId, userId) => { if (userId && !db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId)) fail('Project not found.', 404); };
  const hasTable = name => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  // A layer installed from a repository keeps its Knowledge there; one without keeps it in layer_documents.
  const pinned = (projectId, key) => { try { return layerBinding(db, projectId, key).commit; } catch { return null; } };

  const outputEntry = (layer, record, text) => ({ ref: record.id, source: 'output', layer: { key: layer.key, name: layer.name, instanceId: layer.instanceId },
    kind: record.kind, title: title(record) || record.id, revision: record.revision, updatedAt: record.updatedAt || null, text, data: record });

  // Kinds a layer keeps as repository files (T03-G2), which the index reads from its pinned files instead of records.
  const fileKinds = (projectId, key) => { try { return layerPackageForProject(db, projectId, key)?.manifest?.files?.kinds || []; } catch { return []; } };
  const fileOutputs = (projectId, layer) => currentFileEntries(db, projectId, layer.key).map(entry => ({ ref: entry.id, source: 'output',
    layer: { key: layer.key, name: layer.name, instanceId: layer.instanceId }, kind: entry.kind, title: entry.title, revision: entry.revision, updatedAt: entry.updatedAt,
    text: `${entry.title}\n${words(entry.data)}`, data: entry.data }));
  function recordOutputs(projectId, installed) {
    const entries = [];
    for (const layer of installed) for (const kind of layer.outputs) {
      if (fileKinds(projectId, layer.key).includes(kind)) continue;
      // A kind several installed layers own is told apart by instance; untagged legacy rows go to its only owner.
      const sole = installed.filter(other => other.outputs.includes(kind)).length === 1;
      const rows = db.prepare(`SELECT id FROM knowledge_records WHERE project_id = ? AND kind = ? AND (layer_instance_id = ? OR (layer_instance_id IS NULL AND ?))
        ORDER BY position, created_at`).all(projectId, kind, layer.instanceId, sole ? 1 : 0);
      for (const { id } of rows) { const record = know.get(projectId, id); if (record) entries.push(outputEntry(layer, record, words(record))); }
    }
    return entries;
  }
  function outputs(projectId, installed) {
    const files = installed.filter(layer => fileKinds(projectId, layer.key).length).flatMap(layer => fileOutputs(projectId, layer));
    return withRoles(projectId, [...files, ...recordOutputs(projectId, installed)]);
  }
  // LAYER-BINDINGS-01 R3: an entry whose facet takes part in a binding in force says what it is there, and where its
  // authority is, so a reader knows where a change belongs.
  function withRoles(projectId, entries) {
    const roles = entryRoles(db).resolver(projectId);
    if (!roles.live.length) return entries;
    return entries.map(entry => { if (entry.source !== 'output') return entry; const role = roles.of(entry.layer.key, { kind: entry.kind, data: entry.data }); return role?.role ? { ...entry, role } : entry; });
  }
  function knowledge(projectId, layer) {
    const ref = { key: layer.key, name: layer.name, instanceId: layer.instanceId };
    if (pinned(projectId, layer.key)) return docs.indexable(projectId, layer.key).docs.map(doc => ({ ref: `k:${layer.key}:${doc.path}`, source: 'knowledge', layer: ref,
      kind: doc.group || 'charter', title: doc.title, revision: null, updatedAt: null, path: doc.path, markdown: doc.content }));
    if (!hasTable('layer_documents')) return [];
    let documents;
    try { documents = layerDocumentList(db, reader(projectId), projectId, layer.key); } catch (error) { if (error.status === 404) return []; throw error; }
    return documents.map(doc => ({ ref: `k:${layer.key}:${doc.key}`, source: 'knowledge', layer: ref, kind: doc.groupName, title: doc.title, revision: doc.revision,
      updatedAt: doc.updatedAt || null, markdown: layerDocumentRead(db, reader(projectId), projectId, layer.key, doc.key).content || '' }));
  }
  const own = projectId => libraryKinds.flatMap(kind => know.list(projectId, kind)).map(record => ({ ref: record.id, source: 'library',
    layer: libraryLayer, kind: record.kind, title: title(record) || record.id, revision: record.revision, updatedAt: record.updatedAt || null, text: words(record), data: record }));

  // Work's items, each with its brief, actions and thread (what people and agents said; status logs are left out).
  const workText = (projectId, row) => {
    const brief = parse(row.context_json)?.goal?.brief || '';
    const actions = hasTable('work_goal_actions') ? db.prepare('SELECT number, goal, summary FROM work_goal_actions WHERE project_id = ? AND work_id = ? ORDER BY number').all(projectId, row.id) : [];
    const thread = hasTable('work_goal_events') ? db.prepare("SELECT kind, author_json, body_json FROM work_goal_events WHERE project_id = ? AND work_id = ? AND kind <> 'log' ORDER BY id").all(projectId, row.id) : [];
    const question = parse(row.question_json);
    return [brief, question ? words(question) : '',
      actions.length ? `## Actions\n\n${actions.map(action => `- #${action.number} ${action.goal}${action.summary ? `: ${action.summary}` : ''}`).join('\n')}` : '',
      thread.length ? `## Thread\n\n${thread.map(event => `- ${parse(event.author_json)?.name || 'Someone'}: ${words(parse(event.body_json))}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
  };
  const workRows = (projectId, id = null) => db.prepare(`SELECT id, number, title, state, layer, question_json, context_json, updated_at FROM layer_work_items
    WHERE project_id = ? AND archived_at IS NULL${id ? ' AND id = ?' : ''} ORDER BY number DESC`).all(...[projectId, id].filter(Boolean));
  const workEntry = (projectId, row) => ({ ref: row.id, source: 'work', layer: workLayer, kind: 'work_item', title: `W-${row.number} ${row.title}`, revision: null,
    updatedAt: row.updated_at, state: row.state, markdown: workText(projectId, row) });
  const work = projectId => hasTable('layer_work_items') ? workRows(projectId).map(row => workEntry(projectId, row)) : [];

  // ---- The index ----
  const aggregate = (table, projectId, columns) => hasTable(table) ? JSON.stringify(db.prepare(`SELECT ${columns} FROM ${table} WHERE project_id = ?`).get(projectId)) : '';
  // The parts of a project's pool in the order an unfiltered listing shows them, each with what says it changed.
  function plan(projectId) {
    const installed = layers(db, projectId);
    const records = aggregate('knowledge_records', projectId, 'count(*) AS n, max(updated_at) AS at, total(revision) AS r');
    const shape = JSON.stringify(installed.map(layer => [layer.key, layer.instanceId, layer.outputs, fileKinds(projectId, layer.key)]));
    const parts = [];
    for (const layer of installed) if (fileKinds(projectId, layer.key).length)
      parts.push({ name: `files:${layer.key}`, fingerprint: `${layer.instanceId}@${pinned(projectId, layer.key)}`, build: () => withRoles(projectId, fileOutputs(projectId, layer)) });
    parts.push({ name: 'records', fingerprint: sha(shape + records), build: () => withRoles(projectId, recordOutputs(projectId, installed)) });
    for (const layer of installed) {
      const commit = pinned(projectId, layer.key);
      const fingerprint = commit ? `${commit}:${sha(JSON.stringify(projectLayerDefinition(db, projectId, layer.key)?.identity ?? null))}`
        : (() => { try { return sha(JSON.stringify(layerDocumentList(db, reader(projectId), projectId, layer.key))); } catch { return 'none'; } })();
      parts.push({ name: `knowledge:${layer.key}`, fingerprint: `${layer.name}:${fingerprint}`, build: () => knowledge(projectId, layer) });
    }
    parts.push({ name: 'library', fingerprint: records, build: () => own(projectId) });
    parts.push({ name: 'work', fingerprint: [aggregate('layer_work_items', projectId, 'count(*) AS n, max(updated_at) AS at'),
      aggregate('work_goal_actions', projectId, 'count(*) AS n, max(updated_at) AS at'), aggregate('work_goal_events', projectId, 'max(id) AS id, count(resolved_at) AS resolved')].join('|'), build: () => work(projectId) });
    return parts;
  }
  const insert = () => db.prepare('INSERT INTO library_index(title, path, heading, body, project_id, part, seq, ref, section, anchor, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  function refresh(projectId) {
    const parts = plan(projectId);
    const stored = new Map(db.prepare('SELECT part, fingerprint FROM library_index_parts WHERE project_id = ?').all(projectId).map(row => [row.part, row.fingerprint]));
    const stale = parts.filter(part => stored.get(part.name) !== part.fingerprint);
    const gone = [...stored.keys()].filter(name => !parts.some(part => part.name === name));
    if (!stale.length && !gone.length) return parts.map(part => part.name);
    // Read outside the transaction (git, layer docs); write each part whole.
    const built = stale.map(part => ({ ...part, entries: part.build() }));
    const own = !db.isTransaction;
    if (own) db.exec('BEGIN IMMEDIATE');
    try {
      for (const name of [...gone, ...stale.map(part => part.name)]) {
        db.prepare('DELETE FROM library_index WHERE project_id = ? AND part = ?').run(projectId, name);
        db.prepare('DELETE FROM library_index_parts WHERE project_id = ? AND part = ?').run(projectId, name);
      }
      for (const part of built) {
        part.entries.forEach((entry, seq) => {
          const { text, markdown, data, ...rest } = entry;
          const pieces = markdown !== undefined ? sections(markdown) : [{ heading: null, anchor: null, body: text || '' }];
          pieces.forEach((piece, section) => insert().run(section ? '' : entry.title, section ? '' : entry.path || '', piece.heading || '', piece.body, projectId, part.name, seq,
            entry.ref, section, piece.anchor, JSON.stringify(section ? rest : { ...rest, data })));
        });
        db.prepare('INSERT INTO library_index_parts(project_id, part, fingerprint) VALUES (?, ?, ?)').run(projectId, part.name, part.fingerprint);
      }
      if (own) db.exec('COMMIT');
    } catch (error) { if (own) db.exec('ROLLBACK'); throw error; }
    return parts.map(part => part.name);
  }

  // How well an entry answers the query: 1 it is what the query names (its title or file name, or for an ID such as
  // DEC-062 the heading or bold lead that defines it), 2 every word is in its title, path or a heading, 3 the text.
  function tier(query, meta, hit) {
    const wanted = norm(query.replace(/^"|"$/g, ''));
    const file = meta.path ? norm(meta.path.split('/').pop().replace(/\.[a-z]+$/i, '')) : '';
    if (norm(meta.title) === wanted || file === wanted) return 1;
    if (/^[\p{L}]+-\d+$/u.test(query.trim())) {
      const id = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (norm(meta.title).startsWith(`${wanted} `) || norm(hit.heading).startsWith(wanted) || new RegExp(`(^|\\n)\\s*(\\S+\\s+[—-]\\s+)?\\*\\*${id}\\b`, 'i').test(hit.body)) return 1;
    }
    const named = tokens(`${meta.title} ${meta.path || ''} ${hit.heading}`);
    return tokens(query).every(word => named.some(token => token.startsWith(word))) ? 2 : 3;
  }

  // Search the pool. Every filter is optional; with a query of two or more characters, results come best first.
  // `withData` returns each output or Library entry's current content too, so a reader can take a whole kind in one call
  // (Pages reads the app kit this way, T03-DESIGN); Knowledge and Work are read one at a time.
  function search(projectId, userId, { q = '', layer = null, kind = null, kinds = null, source = null, cursor = 0, limit = 50, withData = false } = {}) {
    const needle = String(q || '').trim();
    if (needle.length === 1 || needle.length > 100 || !Number.isInteger(cursor) || cursor < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('Invalid Library search.');
    if (source && !librarySources.includes(source)) fail('Choose outputs, knowledge, work or the Library\'s own content.');
    member(projectId, userId);
    const order = new Map(refresh(projectId).map((name, index) => [name, index]));
    const keep = meta => (!layer || meta.layer.key === layer) && (!kind || meta.kind === kind) && (!kinds || kinds.includes(meta.kind)) && (!source || meta.source === source);
    let matches;
    if (!needle) {
      matches = db.prepare('SELECT part, seq, ref, meta FROM library_index WHERE project_id = ? AND section = 0').all(projectId)
        .map(row => ({ row, meta: parse(row.meta) })).filter(match => keep(match.meta))
        .sort((a, b) => order.get(a.row.part) - order.get(b.row.part) || a.row.seq - b.row.seq).map(match => ({ ...match, hit: match.row, excerpt: '' }));
    } else {
      const match = expression(needle);
      const hits = match ? db.prepare(`SELECT part, seq, ref, section, anchor, meta, heading, body, bm25(library_index, 10, 5, 3, 1) AS score FROM library_index
        WHERE library_index MATCH ? AND project_id = ?`).all(match, projectId) : [];
      const best = new Map();
      for (const hit of hits) {
        const meta = parse(hit.meta);
        if (!keep(meta)) continue;
        const rank = [tier(needle, meta, hit), hit.score];
        const current = best.get(hit.ref);
        if (!current || rank[0] < current.rank[0] || rank[0] === current.rank[0] && rank[1] < current.rank[1]) best.set(hit.ref, { row: hit, hit, meta, rank });
      }
      matches = [...best.values()].sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1])
        .map(entry => ({ ...entry, excerpt: excerpt(entry.hit.body || entry.meta.title, needle) }));
    }
    const page = matches.slice(cursor, cursor + limit);
    const first = ref => parse(db.prepare('SELECT meta FROM library_index WHERE project_id = ? AND ref = ? AND section = 0').get(projectId, ref)?.meta) || {};
    return { results: page.map(({ meta, hit, excerpt: text }) => {
      const { data, ...entry } = hit.section ? { ...first(hit.ref), ...meta } : meta;
      return { ...entry, heading: hit.heading || null, anchor: hit.anchor || null, excerpt: text, data: withData && data !== undefined ? data : undefined };
    }), total: matches.length, nextCursor: matches.length > cursor + limit ? cursor + limit : null };
  }

  // One entry, current or at a revision, with its owner and content. `currentRevision` lets a reader see a pin went stale.
  function read(projectId, userId, ref, revision = null) {
    member(projectId, userId);
    if (revision !== null && (!Number.isInteger(revision) || revision < 1)) fail('Choose a valid revision.');
    const installed = layers(db, projectId);
    const doc = knowledgeRef.exec(String(ref || ''));
    if (doc) {
      const layer = installed.find(entry => entry.key === doc[1]) || fail('Library entry not found.', 404);
      const owner = { key: layer.key, name: layer.name, instanceId: layer.instanceId };
      if (!storedDoc.test(doc[2])) {
        // A doc at the layer's pin; its revision counts the commits that changed it.
        if (!pinned(projectId, layer.key)) fail('Library entry not found.', 404);
        const found = docs.indexable(projectId, layer.key).docs.find(entry => entry.path === doc[2]) || fail('Library entry not found.', 404);
        const { commits } = docs.revisions(projectId, layer.key, doc[2]);
        const current = Math.max(commits.length, 1);
        if (revision !== null && revision > current) fail('Revision not found.', 404);
        const at = revision === null || revision === current ? null : commits[revision - 1];
        return { ref, source: 'knowledge', layer: owner, kind: found.group || 'charter', title: found.title, path: found.path, revision: revision ?? current, currentRevision: current,
          content: at ? docs.read(projectId, reader(projectId), layer.key, doc[2], at).content : found.content };
      }
      const as = reader(projectId);
      const current = layerDocumentRead(db, as, projectId, layer.key, doc[2]);
      const at = revision === null ? current : layerDocumentRead(db, as, projectId, layer.key, doc[2], revision);
      return { ref, source: 'knowledge', layer: owner, kind: current.groupName, title: current.title, revision: at.revision, currentRevision: current.revision, content: at.content };
    }
    const row = db.prepare('SELECT id, kind, project_id, layer_instance_id FROM knowledge_records WHERE id = ?').get(String(ref || ''));
    if (!row || row.project_id !== projectId) {
      // A work item: its brief, actions and thread as they are now (items keep no revisions).
      const item = hasTable('layer_work_items') && /^wrk-/.test(String(ref || '')) ? workRows(projectId, String(ref))[0] : null;
      if (item) {
        if (revision !== null) fail('Revision not found.', 404);
        const entry = workEntry(projectId, item);
        return { ref: entry.ref, source: 'work', layer: workLayer, kind: entry.kind, title: entry.title, state: entry.state, revision: null, currentRevision: null, content: entry.markdown };
      }
      // A repository-mode output (T03-G2): an entry of an installed layer's pinned files.
      const file = fileEntry(db, projectId, String(ref || ''), revision);
      const layer = file && installed.find(entry => entry.instanceId === file.instanceId);
      if (!file || !layer || file.currentRevision === null && revision === null) fail(revision === null ? 'Library entry not found.' : 'Revision not found.', 404);
      return { ref: file.id, source: 'output', layer: { key: layer.key, name: layer.name, instanceId: layer.instanceId }, kind: file.kind, title: file.title,
        revision: file.revision, currentRevision: file.currentRevision, data: file.data, commit: file.commit };
    }
    const record = know.get(projectId, row.id) || fail('Library entry not found.', 404);
    const owner = libraryKinds.includes(row.kind) ? libraryLayer : recordOwner(db, projectId, row);
    if (!owner) fail('Library entry not found.', 404);
    const data = revision === null ? record : know.revisionData(row.id, revision);
    if (!data || revision !== null && revision > record.revision) fail('Revision not found.', 404);
    const [entry] = withRoles(projectId, [{ ref: row.id, source: owner.key === 'library' ? 'library' : 'output', layer: { key: owner.key, name: owner.name, instanceId: owner.instanceId },
      kind: row.kind, title: title(data) || row.id, revision: revision ?? record.revision, currentRevision: record.revision, data }]);
    return entry;
  }

  // A pin for a cross-layer reference: which instance owns the entry, at which revision.
  const pin = (projectId, ref) => { const entry = read(projectId, null, ref); return { ref: entry.ref, kind: entry.kind, layerInstanceId: entry.layer.instanceId, revision: entry.currentRevision }; };
  // Every installed layer's published outputs only, with content: what binding routines compare (LAYER-BINDINGS-01).
  // Read directly rather than from the index, since bindings run inside writes.
  const outputEntries = projectId => outputs(projectId, layers(db, projectId));
  return { search, read, pin, outputEntries };
}
