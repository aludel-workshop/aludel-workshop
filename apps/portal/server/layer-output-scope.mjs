// Additive Pages scope bridge for the legacy typed store. The project database
// remains the accepted writer until a separately checked authority cutover.
const pagesKinds = "('page_map','page','flow')";
const fail = message => { throw new Error(message); };
const hasTable = (db, name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
const hasColumn = (db, table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column);
const addScope = (db, table) => {
  if (hasTable(db, table) && !hasColumn(db, table, 'layer_instance_id'))
    db.exec(`ALTER TABLE ${table} ADD COLUMN layer_instance_id TEXT`);
};

export function pagesInstanceId(db, projectId) {
  if (!hasTable(db, 'layer_instances')) return null; // Pre-layer legacy fixtures only.
  const row = db.prepare("SELECT instance_id FROM layer_instances WHERE project_id=? AND layer_key='pages'").get(projectId);
  if (!row?.instance_id) fail('Pages instance is not installed in this project.');
  return row.instance_id;
}

export function backfillPagesOutputScope(db) {
  if (!hasTable(db, 'knowledge_records')) return { records: 0, revisions: 0, deletions: 0 };
  for (const table of ['knowledge_records', 'knowledge_revisions', 'knowledge_deletions']) addScope(db, table);
  const expected = (alias) => `(SELECT i.instance_id FROM layer_instances i WHERE i.project_id=${alias}.project_id AND i.layer_key='pages')`;
  const mismatch = db.prepare(`SELECT r.id FROM knowledge_records r WHERE r.kind IN ${pagesKinds}
    AND (SELECT i.instance_id FROM layer_instances i WHERE i.project_id=r.project_id AND i.layer_key='pages') IS NULL
    LIMIT 1`).get();
  if (mismatch) fail(`Pages output ${mismatch.id} has no matching instance.`);
  const wrong = db.prepare(`SELECT r.id FROM knowledge_records r WHERE r.kind IN ${pagesKinds}
    AND r.layer_instance_id IS NOT NULL AND r.layer_instance_id <> ${expected('r')} LIMIT 1`).get();
  if (wrong) fail(`Pages output ${wrong.id} belongs to a different instance.`);
  const records = db.prepare(`UPDATE knowledge_records SET layer_instance_id=${expected('knowledge_records')}
    WHERE kind IN ${pagesKinds} AND layer_instance_id IS NULL`).run().changes;
  let deletions = 0;
  if (hasTable(db, 'knowledge_deletions')) {
    const missing = db.prepare(`SELECT d.record_id FROM knowledge_deletions d WHERE d.kind IN ${pagesKinds}
      AND ${expected('d')} IS NULL LIMIT 1`).get();
    if (missing) fail(`Pages deletion ${missing.record_id} has no matching instance.`);
    const wrongDelete = db.prepare(`SELECT d.record_id FROM knowledge_deletions d WHERE d.kind IN ${pagesKinds}
      AND d.layer_instance_id IS NOT NULL AND d.layer_instance_id <> ${expected('d')} LIMIT 1`).get();
    if (wrongDelete) fail(`Pages deletion ${wrongDelete.record_id} belongs to a different instance.`);
    deletions = db.prepare(`UPDATE knowledge_deletions SET layer_instance_id=${expected('knowledge_deletions')}
      WHERE kind IN ${pagesKinds} AND layer_instance_id IS NULL`).run().changes;
  }
  let revisions = 0;
  if (hasTable(db, 'knowledge_revisions')) {
    const source = `(SELECT r.layer_instance_id FROM knowledge_records r WHERE r.id=knowledge_revisions.record_id AND r.kind IN ${pagesKinds})`;
    const deleted = hasTable(db, 'knowledge_deletions')
      ? `(SELECT d.layer_instance_id FROM knowledge_deletions d WHERE d.record_id=knowledge_revisions.record_id AND d.kind IN ${pagesKinds})`
      : 'NULL';
    const target = `COALESCE(${source},${deleted})`;
    const wrongRevision = db.prepare(`SELECT record_id FROM knowledge_revisions WHERE layer_instance_id IS NOT NULL
      AND ${target} IS NOT NULL AND layer_instance_id <> ${target} LIMIT 1`).get();
    if (wrongRevision) fail(`Pages revision ${wrongRevision.record_id} belongs to a different instance.`);
    revisions = db.prepare(`UPDATE knowledge_revisions SET layer_instance_id=${target}
      WHERE layer_instance_id IS NULL AND ${target} IS NOT NULL`).run().changes;
  }
  const work = backfillPagesWorkScope(db);
  return { records, revisions, deletions, ...work };
}

function backfillPagesWorkScope(db) {
  if (!hasTable(db, 'layer_work_items') || !hasColumn(db, 'layer_work_items', 'layer') || !hasColumn(db, 'layer_work_items', 'targets_json'))
    return { workItems: 0, targets: 0, unresolvedTargets: 0 };
  addScope(db, 'layer_work_items');
  const rows = db.prepare('SELECT id,project_id,layer,layer_instance_id,targets_json FROM layer_work_items').all();
  const record = db.prepare('SELECT kind,layer_instance_id FROM knowledge_records WHERE id=? AND project_id=?');
  const deleted = hasTable(db, 'knowledge_deletions')
    ? db.prepare('SELECT kind,layer_instance_id FROM knowledge_deletions WHERE record_id=? AND project_id=?') : null;
  const update = db.prepare('UPDATE layer_work_items SET layer_instance_id=?, targets_json=? WHERE id=? AND project_id=?');
  let workItems = 0, targets = 0, unresolvedTargets = 0;
  for (const row of rows) {
    const receivingId = row.layer === 'pages' ? pagesInstanceId(db, row.project_id) : null;
    if (receivingId && row.layer_instance_id && row.layer_instance_id !== receivingId)
      fail(`Pages Work item ${row.id} belongs to a different instance.`);
    let parsed;
    try { parsed = JSON.parse(row.targets_json); } catch { fail(`Work item ${row.id} has invalid targets.`); }
    if (!Array.isArray(parsed)) fail(`Work item ${row.id} has invalid targets.`);
    let changed = false;
    const next = parsed.map(target => {
      if (!target || typeof target.id !== 'string') return target;
      const source = record.get(target.id,row.project_id) || deleted?.get(target.id,row.project_id);
      if (!source || !['page_map','page','flow'].includes(source.kind)) {
        if (['page_map','page','flow'].includes(target.kind)) {
          const expected = pagesInstanceId(db, row.project_id);
          if (target.layerInstanceId && target.layerInstanceId !== expected)
            fail(`Pages Work target ${target.id} belongs to a different instance.`);
          if (!target.layerInstanceId) unresolvedTargets++;
        }
        return target;
      }
      if (target.layerInstanceId && target.layerInstanceId !== source.layer_instance_id)
        fail(`Pages Work target ${target.id} belongs to a different instance.`);
      if (target.layerInstanceId === source.layer_instance_id) return target;
      targets++; changed = true;
      return { ...target, layerInstanceId: source.layer_instance_id };
    });
    if (receivingId && !row.layer_instance_id || changed) {
      update.run(receivingId || row.layer_instance_id, JSON.stringify(next), row.id, row.project_id);
      if (receivingId && !row.layer_instance_id) workItems++;
    }
  }
  return { workItems, targets, unresolvedTargets };
}
