// DEC-059 (T03-G1): the Library is the one place layers read each other. Every enabled layer instance publishes its
// accepted outputs and its Knowledge (charter, method docs, policies) here, beside the Library's own content: research
// (sources, findings, insights) and project documents. People,
// agents and layer views search and read entries; a cross-layer reference pins an entry (ref + revision) and names the
// instance that owns it. Nothing here writes: each layer still changes its outputs only through its own API.
import { layerDocumentList, layerDocumentRead } from './layer-space.mjs';
import { currentFileEntries, fileEntry } from './layer-files.mjs';
import { layerPackageForProject } from './layer-package.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
export const libraryKinds = ['source', 'finding', 'insight', 'doc'];
const knowledgeRef = /^k:([a-z][a-z0-9_]{1,31}):([a-z][a-z0-9-]{0,63}|identity)$/;
const titleFields = ['title', 'name', 'label', 'operationId', 'path', 'text', 'sentence', 'summary', 'description'];

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
const excerpt = (text, needle) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = needle ? flat.toLowerCase().indexOf(needle) : -1;
  const start = at > 60 ? at - 60 : 0;
  return (start ? '…' : '') + flat.slice(start, start + 200) + (flat.length > start + 200 ? '…' : '');
};

export function library({ db, know }) {
  // Knowledge reads go through the layer's own document access checks, as the person asking (or, for an agent, as the
  // project owner, since a Work run reads project-wide under DEC-054 and never writes here).
  const reader = (projectId, userId) => userId || db.prepare("SELECT user_id FROM project_members WHERE project_id = ? AND role = 'owner' ORDER BY rowid LIMIT 1").get(projectId)?.user_id;
  const member = (projectId, userId) => { if (userId && !db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId)) fail('Project not found.', 404); };

  const outputEntry = (layer, record, text) => ({ ref: record.id, source: 'output', layer: { key: layer.key, name: layer.name, instanceId: layer.instanceId },
    kind: record.kind, title: title(record) || record.id, revision: record.revision, updatedAt: record.updatedAt || null, text, data: record });

  // Kinds a layer keeps as repository files (T03-G2), which the index reads from its pinned files instead of records.
  const fileKinds = (projectId, key) => { try { return layerPackageForProject(db, projectId, key)?.manifest?.files?.kinds || []; } catch { return []; } };
  function outputs(projectId, installed) {
    const entries = [];
    for (const layer of installed) {
      if (!fileKinds(projectId, layer.key).length) continue;
      for (const entry of currentFileEntries(db, projectId, layer.key))
        entries.push({ ref: entry.id, source: 'output', layer: { key: layer.key, name: layer.name, instanceId: layer.instanceId }, kind: entry.kind, title: entry.title,
          revision: entry.revision, updatedAt: entry.updatedAt, text: `${entry.title}\n${words(entry.data)}`, data: entry.data });
    }
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
  function knowledge(projectId, userId, installed) {
    const as = reader(projectId, userId);
    return installed.flatMap(layer => {
      let documents;
      try { documents = layerDocumentList(db, as, projectId, layer.key); } catch (error) { if (error.status === 404) return []; throw error; }
      return documents.map(doc => {
        const full = layerDocumentRead(db, as, projectId, layer.key, doc.key);
        return { ref: `k:${layer.key}:${doc.key}`, source: 'knowledge', layer: { key: layer.key, name: layer.name, instanceId: layer.instanceId },
          kind: doc.groupName, title: doc.title, revision: doc.revision, updatedAt: doc.updatedAt || null, text: `${doc.title}\n${full.content || ''}` };
      });
    });
  }
  const own = projectId => libraryKinds.flatMap(kind => know.list(projectId, kind)).map(record => ({ ref: record.id, source: 'library',
    layer: { key: 'library', name: 'Library', instanceId: null }, kind: record.kind, title: title(record) || record.id, revision: record.revision, updatedAt: record.updatedAt || null, text: words(record), data: record }));

  function entries(projectId, userId = null) {
    member(projectId, userId);
    const installed = layers(db, projectId);
    return [...outputs(projectId, installed), ...knowledge(projectId, userId, installed), ...own(projectId)];
  }

  // Search the pool. Every filter is optional; a query of two or more characters matches titles first, then content.
  // `withData` returns each output or Library entry's current content too, so a reader can take a whole kind in one call
  // (Pages reads the app kit this way, T03-DESIGN); Knowledge documents are still read one at a time.
  function search(projectId, userId, { q = '', layer = null, kind = null, source = null, cursor = 0, limit = 50, withData = false } = {}) {
    const needle = String(q || '').trim().toLowerCase();
    if (needle.length === 1 || needle.length > 100 || !Number.isInteger(cursor) || cursor < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('Invalid Library search.');
    if (source && !['output', 'knowledge', 'library'].includes(source)) fail('Choose outputs, knowledge or the Library\'s own content.');
    const matches = entries(projectId, userId).filter(entry => (!layer || entry.layer.key === layer) && (!kind || entry.kind === kind) && (!source || entry.source === source))
      .map(entry => ({ entry, rank: !needle ? 0 : entry.title.toLowerCase().includes(needle) ? 1 : entry.text.toLowerCase().includes(needle) ? 2 : 3 }))
      .filter(match => match.rank < 3).sort((a, b) => a.rank - b.rank);
    return { results: matches.slice(cursor, cursor + limit).map(({ entry }) => ({ ...entry, text: undefined, data: withData ? entry.data : undefined, excerpt: excerpt(entry.text, needle) })),
      total: matches.length, nextCursor: matches.length > cursor + limit ? cursor + limit : null };
  }

  // One entry, current or at a revision, with its owner and content. `currentRevision` lets a reader see a pin went stale.
  function read(projectId, userId, ref, revision = null) {
    member(projectId, userId);
    if (revision !== null && (!Number.isInteger(revision) || revision < 1)) fail('Choose a valid revision.');
    const installed = layers(db, projectId);
    const doc = knowledgeRef.exec(String(ref || ''));
    if (doc) {
      const layer = installed.find(entry => entry.key === doc[1]) || fail('Library entry not found.', 404);
      const as = reader(projectId, userId);
      const current = layerDocumentRead(db, as, projectId, layer.key, doc[2]);
      const at = revision === null ? current : layerDocumentRead(db, as, projectId, layer.key, doc[2], revision);
      return { ref, source: 'knowledge', layer: { key: layer.key, name: layer.name, instanceId: layer.instanceId }, kind: current.groupName, title: current.title,
        revision: at.revision, currentRevision: current.revision, content: at.content };
    }
    const row = db.prepare('SELECT id, kind, project_id, layer_instance_id FROM knowledge_records WHERE id = ?').get(String(ref || ''));
    if (!row || row.project_id !== projectId) {
      // A repository-mode output (T03-G2): an entry of an installed layer's pinned files.
      const file = fileEntry(db, projectId, String(ref || ''), revision);
      const layer = file && installed.find(entry => entry.instanceId === file.instanceId);
      if (!file || !layer || file.currentRevision === null && revision === null) fail(revision === null ? 'Library entry not found.' : 'Revision not found.', 404);
      return { ref: file.id, source: 'output', layer: { key: layer.key, name: layer.name, instanceId: layer.instanceId }, kind: file.kind, title: file.title,
        revision: file.revision, currentRevision: file.currentRevision, data: file.data, commit: file.commit };
    }
    const record = know.get(projectId, row.id) || fail('Library entry not found.', 404);
    const owner = libraryKinds.includes(row.kind) ? { key: 'library', name: 'Library', instanceId: null } : recordOwner(db, projectId, row);
    if (!owner) fail('Library entry not found.', 404);
    const data = revision === null ? record : know.revisionData(row.id, revision);
    if (!data || revision !== null && revision > record.revision) fail('Revision not found.', 404);
    return { ref: row.id, source: owner.key === 'library' ? 'library' : 'output', layer: { key: owner.key, name: owner.name, instanceId: owner.instanceId },
      kind: row.kind, title: title(data) || row.id, revision: revision ?? record.revision, currentRevision: record.revision, data };
  }

  // A pin for a cross-layer reference: which instance owns the entry, at which revision.
  const pin = (projectId, ref) => { const entry = read(projectId, null, ref); return { ref: entry.ref, kind: entry.kind, layerInstanceId: entry.layer.instanceId, revision: entry.currentRevision }; };
  // Every installed layer's published outputs only, with content: what binding routines compare (LAYER-BINDINGS-01).
  // Cheaper than a search, which also reads every layer's Knowledge.
  const outputEntries = projectId => outputs(projectId, layers(db, projectId));
  return { entries, search, read, pin, outputEntries };
}
