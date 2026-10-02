// LAYER-BINDINGS-01: the binding record, a project-level contract per shared concept, kept by Work with exact revisions and
// shown in Library › Bindings. Its rules are the pure ones in bindings.mjs; this module stores it and checks it against the
// installed layers: every participant names an installed layer's declared facet, in a role that facet supports. Changing a
// binding never changes a layer's output; routines that act on bindings create Work in the layer that should change.
import { randomBytes } from 'node:crypto';
import { join as joinBinding, transfer as transferBinding, transition, validateBinding, validateFacets } from './bindings.mjs';
import { layerPackageForProject } from './layer-package.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
// Fields a plain update may change. Participants and authority change only by join and transfer, each reviewed as its own revision.
const editable = ['concept', 'policy', 'adapters'];
// What the routines keep current (which entries correspond, and the last agreed sync) is sync state, not the contract: it is
// stored beside the binding, unrevisioned, and every automatic change is logged as an event instead.
const syncFields = ['correspondence', 'baseline', 'detached'];

export function initBindings(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_bindings (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), concept TEXT NOT NULL,
    lifecycle TEXT NOT NULL CHECK(lifecycle IN ('proposed','reconciling','active','paused','retired')),
    state_json TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS layer_bindings_project ON layer_bindings(project_id);
    CREATE TABLE IF NOT EXISTS layer_binding_revisions (
    id TEXT NOT NULL REFERENCES layer_bindings(id), revision INTEGER NOT NULL, state_json TEXT NOT NULL,
    author_id TEXT NOT NULL, rationale TEXT, created_at TEXT NOT NULL, PRIMARY KEY(id, revision));
    CREATE TABLE IF NOT EXISTS layer_binding_sync (
    id TEXT PRIMARY KEY REFERENCES layer_bindings(id), correspondence_json TEXT NOT NULL, baseline_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS layer_binding_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, binding_id TEXT NOT NULL REFERENCES layer_bindings(id), action_id TEXT, kind TEXT NOT NULL,
    entry TEXT, target TEXT, detail_json TEXT NOT NULL, work_item_id TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS layer_binding_events_binding ON layer_binding_events(binding_id, seq);`);
  // Step 3: entries a refacet took out of a participant's facet, held until no participant still publishes them.
  if (!db.prepare('PRAGMA table_info(layer_binding_sync)').all().some(column => column.name === 'detached_json'))
    db.exec("ALTER TABLE layer_binding_sync ADD COLUMN detached_json TEXT NOT NULL DEFAULT '[]'");
}

// The facets an installed layer declares in its accepted manifest; null when the layer is not installed and enabled.
export function installedFacets(db, projectId, layerKey) {
  if (!db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId, layerKey)) return null;
  try { return validateFacets(layerPackageForProject(db, projectId, layerKey)?.manifest || {}); } catch { return []; }
}

export function bindingRecords({ db, facetsFor = (projectId, key) => installedFacets(db, projectId, key) }) {
  const member = (projectId, userId, owner = false) => {
    const row = db.prepare('SELECT role FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId);
    if (!row) fail('Project not found.', 404);
    if (owner && row.role !== 'owner') fail('Project owner required.', 403);
  };
  // Every participant is a declared facet of an installed layer, in a role it supports, and takes part in no other live
  // binding: a facet that would straddle two is refaceted, so each part has one.
  const checkParticipants = (projectId, binding) => {
    if (binding.lifecycle !== 'retired') for (const participant of binding.participants) {
      const other = db.prepare("SELECT id, state_json FROM layer_bindings WHERE project_id = ? AND id <> ? AND lifecycle <> 'retired'").all(projectId, binding.id)
        .find(row => JSON.parse(row.state_json).participants.some(p => p.layer.key === participant.layer.key && p.facet === participant.facet));
      if (other) fail(`${participant.layer.key}'s ${participant.facet} already takes part in ${other.id}. Refacet it so each part has one binding.`, 409);
    }
    return { ...binding, participants: binding.participants.map(participant => {
      const facets = facetsFor(projectId, participant.layer.key);
      if (!facets) fail(`${participant.layer.key} is not installed in this project.`, 409);
      const facet = facets.find(item => item.key === participant.facet);
      if (!facet) fail(`${participant.layer.key} does not declare a ${participant.facet} facet.`, 409);
      if (!facet.roles.includes(participant.role)) fail(`${participant.layer.key}'s ${facet.title} cannot be ${participant.role === 'authority' ? 'an authority' : participant.role === 'ceded' ? 'ceded' : 'a replica'}.`, 409);
      if (facet.readOnly) participant = { ...participant, readOnly: true };
      const instanceId = db.prepare('SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, participant.layer.key)?.instance_id || null;
      return { ...participant, layer: { key: participant.layer.key, instanceId } };
    }) };
  };
  const row = (projectId, id) => db.prepare('SELECT * FROM layer_bindings WHERE project_id = ? AND id = ?').get(projectId, id) || fail('Binding not found.', 404);
  const sync = id => db.prepare('SELECT correspondence_json, baseline_json, detached_json FROM layer_binding_sync WHERE id = ?').get(id);
  const view = record => { const state = sync(record.id);
    return { ...JSON.parse(record.state_json), correspondence: state ? JSON.parse(state.correspondence_json) : [], baseline: state ? JSON.parse(state.baseline_json) : {},
      detached: state ? JSON.parse(state.detached_json) : [],
      id: record.id, lifecycle: record.lifecycle, revision: record.revision, updatedAt: record.updated_at }; };
  const text = (value, max, name) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || value.length > max) fail(`${name} must be text under ${max} characters.`);
    return value.trim() || null;
  };
  function save(projectId, userId, id, next, { revision, rationale, created = null }) {
    const binding = checkParticipants(projectId, validateBinding({ ...next, id }));
    const state = { ...binding };
    for (const field of ['id', 'revision', 'updatedAt', ...syncFields]) delete state[field];
    const at = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (created) {
        db.prepare('INSERT INTO layer_bindings(id,project_id,concept,lifecycle,state_json,revision,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
          .run(id, projectId, binding.concept.name, binding.lifecycle, JSON.stringify(state), at, at);
        db.prepare("INSERT INTO layer_binding_sync(id,correspondence_json,baseline_json,updated_at) VALUES (?,'[]','{}',?)").run(id, at);
      }
      else if (!db.prepare('UPDATE layer_bindings SET concept=?, lifecycle=?, state_json=?, revision=?, updated_at=? WHERE id=? AND project_id=? AND revision=?')
        .run(binding.concept.name, binding.lifecycle, JSON.stringify(state), revision + 1, at, id, projectId, revision).changes) fail('This binding changed. Reload before saving.', 409);
      db.prepare('INSERT INTO layer_binding_revisions(id,revision,state_json,author_id,rationale,created_at) VALUES (?,?,?,?,?,?)')
        .run(id, created ? 1 : revision + 1, JSON.stringify(state), userId, rationale, at);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return view(row(projectId, id));
  }
  const current = (projectId, userId, id, expectedRevision) => {
    member(projectId, userId, true);
    const record = row(projectId, id);
    if (expectedRevision !== record.revision) fail('This binding changed. Reload before saving.', 409);
    return { record, binding: view(record) };
  };

  return {
    list(projectId, userId) {
      member(projectId, userId);
      return db.prepare('SELECT * FROM layer_bindings WHERE project_id = ? ORDER BY created_at, id').all(projectId).map(view);
    },
    read(projectId, userId, id, revision = null) {
      member(projectId, userId);
      const record = row(projectId, id);
      if (revision === null) return view(record);
      if (!Number.isInteger(revision) || revision < 1) fail('Choose a valid revision.');
      const past = db.prepare('SELECT state_json, author_id, rationale, created_at FROM layer_binding_revisions WHERE id = ? AND revision = ?').get(id, revision) || fail('Revision not found.', 404);
      return { ...JSON.parse(past.state_json), id, revision, currentRevision: record.revision, author: past.author_id, rationale: past.rationale, updatedAt: past.created_at };
    },
    history(projectId, userId, id) {
      member(projectId, userId);
      row(projectId, id);
      return db.prepare('SELECT revision, author_id AS author, rationale, created_at AS createdAt FROM layer_binding_revisions WHERE id = ? ORDER BY revision').all(id);
    },
    // A new binding is always proposed: Discover, a person or an agent suggests it, and the owner accepts it by moving it on.
    create(projectId, userId, input) {
      member(projectId, userId, true);
      const id = `bnd-${randomBytes(6).toString('hex')}`;
      const { rationale, ...binding } = input || {};
      return save(projectId, userId, id, { ...binding, lifecycle: 'proposed', correspondence: [], baseline: {} }, { created: true, rationale: text(rationale, 2000, 'Rationale') });
    },
    // Discover proposes as Aludel. The owner still accepts it by moving its lifecycle on.
    propose(projectId, binding, rationale) {
      const id = `bnd-${randomBytes(6).toString('hex')}`;
      return save(projectId, 'aludel', id, { ...binding, lifecycle: 'proposed', correspondence: [], baseline: {} }, { created: true, rationale });
    },
    // Reconcile is done: nothing pending and no open Work. The routine moves the binding on as Aludel, with that reason.
    activate(projectId, id) {
      const record = row(projectId, id), binding = view(record);
      if (binding.lifecycle !== 'reconciling') return binding;
      return save(projectId, 'aludel', id, transition(binding, 'active'), { revision: record.revision, rationale: 'First reconcile complete: every entry matched and no Work open.' });
    },
    // The routines' view of every binding, without a person's membership check.
    all(projectId) { return db.prepare('SELECT * FROM layer_bindings WHERE project_id = ? ORDER BY created_at, id').all(projectId).map(view); },
    // Watch keeps the sync state current; it never changes the contract.
    saveSync(id, { correspondence, baseline, detached = [] }) {
      db.prepare('UPDATE layer_binding_sync SET correspondence_json = ?, baseline_json = ?, detached_json = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(correspondence), JSON.stringify(baseline), JSON.stringify(detached), now(), id);
    },
    // An accepted refacet's follow-through, applied as part of its Work: moved entries detach (sync state), and a split-off
    // facet that joins this binding is a new revision of the contract.
    applyRefacet(projectId, userId, next, rationale) {
      const record = row(projectId, next.id), binding = view(record);
      const joined = next.participants.filter(p => !binding.participants.some(q => q.id === p.id));
      if (joined.length) save(projectId, userId, next.id, { ...binding, participants: next.participants }, { revision: record.revision, rationale });
      this.saveSync(next.id, next);
      return view(row(projectId, next.id));
    },
    logEvent(id, { actionId = null, kind, entry = null, target = null, detail = {}, workItemId = null }) {
      db.prepare('INSERT INTO layer_binding_events(binding_id,action_id,kind,entry,target,detail_json,work_item_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(id, actionId, kind, entry, target, JSON.stringify(detail), workItemId, now());
    },
    events(projectId, userId, id, limit = 50) {
      member(projectId, userId);
      row(projectId, id);
      return db.prepare(`SELECT seq, action_id AS actionId, kind, entry, target, detail_json AS detail, work_item_id AS workItemId, created_at AS createdAt
        FROM layer_binding_events WHERE binding_id = ? ORDER BY seq DESC LIMIT ?`).all(id, Math.min(Math.max(Number(limit) || 50, 1), 200)).map(event => ({ ...event, detail: JSON.parse(event.detail) }));
    },
    update(projectId, userId, id, input) {
      const { record, binding } = current(projectId, userId, id, input?.expectedRevision);
      const changes = input?.changes;
      if (!changes || typeof changes !== 'object' || !Object.keys(changes).length || Object.keys(changes).some(field => !editable.includes(field)))
        fail(`Change ${editable.join(', ')}; participants and authority change by join and transfer.`);
      return save(projectId, userId, id, { ...binding, ...changes }, { revision: record.revision, rationale: text(input.rationale, 2000, 'Rationale') });
    },
    join(projectId, userId, id, input) {
      const { record, binding } = current(projectId, userId, id, input?.expectedRevision);
      const next = joinBinding(binding, input?.participant, { policy: input?.policy || null, adapters: input?.adapters || [] });
      return save(projectId, userId, id, next, { revision: record.revision, rationale: text(input.rationale, 2000, 'Rationale') });
    },
    transfer(projectId, userId, id, input) {
      const { record, binding } = current(projectId, userId, id, input?.expectedRevision);
      const rationale = text(input?.rationale, 2000, 'Rationale') || fail('Record why authority moves.');
      return save(projectId, userId, id, transferBinding(binding, input?.change || {}), { revision: record.revision, rationale });
    },
    lifecycle(projectId, userId, id, input) {
      const { record, binding } = current(projectId, userId, id, input?.expectedRevision);
      return save(projectId, userId, id, transition(binding, input?.lifecycle), { revision: record.revision, rationale: text(input.rationale, 2000, 'Rationale') });
    }
  };
}
