// A layer installation changes the neighbor graph. Each receiving layer gets
// its own reviewable Work item; this utility never starts an agent or accepts
// a connection policy.
import { createHash } from 'node:crypto';
import { layerDeclarations } from './layer-contract.mjs';
import { projectLayerDefinition } from './layer-registry.mjs';

export function initLayerDiscovery(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS layer_discovery_receipts (
    project_id TEXT NOT NULL REFERENCES projects(id), receiving_key TEXT NOT NULL,
    topology_digest TEXT NOT NULL, source_keys_json TEXT NOT NULL, work_id TEXT NOT NULL,
    created_at TEXT NOT NULL, PRIMARY KEY(project_id, receiving_key, topology_digest)
  )`);
}

export function stageLayerDiscovery(db, know, projectId) {
  initLayerDiscovery(db);
  const installed = db.prepare(`SELECT layer_key AS key, descriptor_version AS version FROM layer_instances
    WHERE project_id = ? AND enabled = 1 ORDER BY layer_key`).all(projectId);
  if (installed.length < 2) return [];
  const digest = createHash('sha256').update(JSON.stringify(installed)).digest('hex');
  const created = [];
  for (const receiver of installed) {
    if (db.prepare(`SELECT 1 FROM layer_discovery_receipts WHERE project_id = ? AND receiving_key = ? AND topology_digest = ?`)
      .get(projectId, receiver.key, digest)) continue;
    const sources = installed.filter(item => item.key !== receiver.key);
    const receiverName = projectLayerDefinition(db,projectId,receiver.key)?.name || receiver.key;
    const names = sources.map(item => projectLayerDefinition(db,projectId,item.key)?.name || item.key);
    const item = know.createWork(projectId, {
      action: `${receiver.key}.discover`, layer: receiver.key, type: 'audit', state: 'ready',
      title: `Explore ${names.join(', ')} for ${receiverName}`.slice(0, 160),
      context: { discovery: { receivingKey: receiver.key, sourceKeys: sources.map(item => item.key),
        topologyDigest: digest, descriptorVersions: Object.fromEntries(installed.map(item => [item.key, item.version])) },
        routine: 'layer-neighbor-discovery' },
      logText: `Staged by ${receiverName} neighbor discovery after the installed layer set changed. Review and Go are separate.`
    }, 'Layer neighbor discovery');
    db.prepare(`INSERT INTO layer_discovery_receipts(project_id,receiving_key,topology_digest,source_keys_json,work_id,created_at)
      VALUES (?,?,?,?,?,?)`).run(projectId,receiver.key,digest,JSON.stringify(sources.map(item=>item.key)),item.id,new Date().toISOString());
    created.push(item);
  }
  return created;
}

export function layerDiscoveryStatus(db,userId,projectId,receivingKey) {
  if (!db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId,userId))
    throw Object.assign(new Error('Project not found.'),{status:404});
  if (!db.prepare('SELECT 1 FROM layer_instances WHERE project_id = ? AND layer_key = ? AND enabled = 1').get(projectId,receivingKey))
    throw Object.assign(new Error('Layer not installed.'),{status:404});
  const rows = db.prepare(`SELECT source_keys_json AS sourceKeysJson, work_id AS workId, created_at AS createdAt
    FROM layer_discovery_receipts WHERE project_id = ? AND receiving_key = ? ORDER BY created_at DESC`).all(projectId,receivingKey);
  return rows.map(row => ({ sourceKeys: JSON.parse(row.sourceKeysJson), workId: row.workId, createdAt: row.createdAt }));
}

const projectionTables = { code_unit:'code_units', trace_link:'trace_links', code_release:'code_releases', code_route_observation:'code_route_observations', release:'releases' };
// Identity/revision manifest for each source output. The fingerprint covers every
// row, including records beyond the short task preview, so a changed source
// withdraws the Go snapshot before submission or acceptance.
export function discoverySourceSnapshot(db,projectId,sourceKeys) {
  return sourceKeys.map(key => {
    const declaration=projectLayerDefinition(db,projectId,key) || layerDeclarations.find(layer => layer.key===key);
    if (!declaration) throw Object.assign(new Error('Unknown source layer.'),{status:409});
    const kinds=declaration.outputs.map(kind => {
      const table=projectionTables[kind];
      const rows=kind==='markdown_document' ? db.prepare('SELECT f.id,f.path,f.revision,f.content_sha,(SELECT r.content FROM markdown_file_revisions r WHERE r.file_id=f.id AND r.revision=f.revision) AS content FROM markdown_files f WHERE f.project_id=? AND f.layer_key=? AND f.deleted=0 ORDER BY f.path').all(projectId,key)
        : table && db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)
        ? db.prepare(`SELECT * FROM ${table} WHERE project_id=? ORDER BY id`).all(projectId)
        : !table ? db.prepare('SELECT id,revision,data_json FROM knowledge_records WHERE project_id=? AND kind=? ORDER BY id').all(projectId,kind) : [];
      const records=rows.map(row => ({ id:row.id, revision:kind==='markdown_document' ? row.revision : table ? createHash('sha256').update(JSON.stringify(row)).digest('hex') : row.revision,
        summary:kind==='markdown_document' ? row.path : table ? '' : String((() => {try { const data=JSON.parse(row.data_json);return data.title||data.name||data.label||data.text||data.description||kind;}catch{return kind;}})()).slice(0,160) }));
      return { kind, count:records.length, records:records.slice(0,100).map((record,index)=>kind==='markdown_document' ? {...record,excerpt:String(rows[index].content||'').slice(0,2000),truncated:String(rows[index].content||'').length>2000} : record), fingerprint:createHash('sha256').update(JSON.stringify(records)).digest('hex') };
    });
    return { key, kinds };
  });
}
