import { randomUUID } from 'node:crypto';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const parse = value => JSON.parse(value || '{}');
const cleanLines = value => Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : [];

function hydrate(row) {
  if (!row) return null;
  return { id: row.id, kind: row.kind, revision: row.revision, title: row.title, summary: row.summary,
    ...parse(row.data_json), source_path: row.source_path, author: row.author, updated_at: row.created_at };
}

function current(db, id) {
  return hydrate(db.prepare(`SELECT p.id, p.kind, r.revision, r.title, r.summary, r.data_json, r.source_path, r.author, r.created_at
    FROM product_records p JOIN product_record_revisions r ON r.id = p.current_revision_id WHERE p.id = ?`).get(id));
}

function insert(db, record, revision) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO product_records(id, project_id, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(record.id, record.projectId, record.kind, now, now);
  const result = db.prepare(`INSERT INTO product_record_revisions(record_id, revision, title, summary, data_json, source_path, author, created_at)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?)`).run(record.id, revision.title, revision.summary, JSON.stringify(revision.data), revision.sourcePath || null, revision.author, now);
  db.prepare('UPDATE product_records SET current_revision_id = ? WHERE id = ?').run(result.lastInsertRowid, record.id);
}

export function ensureProductWorkspace(db, projectId = 'the-machine') {
  if (db.prepare("SELECT id FROM product_records WHERE project_id = ? AND kind = 'direction'").get(projectId)) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    insert(db, { id: 'direction-the-machine', projectId, kind: 'direction' }, {
      title: 'Build software from durable product intent',
      summary: 'Aludel helps one owner turn an idea into deliberately authorized work and a reviewable, evidence-backed result.',
      data: {
        audience: 'One owner managing several independent software projects.',
        outcomes: ['Request a change, start it deliberately, and review a real agent-built preview.', 'Keep product intent, decisions, work, and evidence connected by stable identity.'],
        constraints: ['Local execution first; hosted execution comes later.', 'Prefer zero incremental cost and preserve generated products as independent applications.'],
        success: ['The owner can trace every result to the exact intent and authorization that produced it.', 'Providers and implementation details remain replaceable behind durable product records.']
      }, sourcePath: 'docs/product.md', author: 'repository reconciliation'
    });
    const outcomes = [
      ['outcome-first-loop', 'Request a change and review its preview', 'Complete one trustworthy request-to-review loop through the portal.', 'now', 'active', 1, 'docs/roadmap.md'],
      ['outcome-hosted-operation', 'Operate continuously without a local session', 'Move proven supervised execution into a recoverable hosted environment.', 'next', 'proposed', 2, 'docs/roadmap.md'],
      ['outcome-multiple-products', 'Manage multiple independent products', 'Reuse the operating model without coupling generated applications.', 'later', 'proposed', 3, 'docs/roadmap.md']
    ];
    for (const [id, title, summary, horizon, status, priority, sourcePath] of outcomes) insert(db, { id, projectId, kind: 'outcome' }, { title, summary, data: { horizon, status, priority }, sourcePath, author: 'repository reconciliation' });
    const features = [
      ['feature-product-intent', 'Shape durable product intent', 'Maintain project direction, outcomes, constraints and success evidence as revisioned records.', 'active', 'outcome-first-loop', 'docs/product.md'],
      ['feature-work-authorization', 'Plan and authorize work', 'Separate product priority from the explicit transition that allows execution.', 'active', 'outcome-first-loop', 'docs/product.md'],
      ['feature-candidate-review', 'Review exact candidates', 'Inspect a stable built result and record an owner verdict against it.', 'planned', 'outcome-first-loop', 'docs/product.md'],
      ['feature-independent-projects', 'Operate independent projects', 'Apply shared capability contracts while keeping each generated product independent.', 'proposed', 'outcome-multiple-products', 'docs/product.md']
    ];
    for (const [id, title, summary, status, outcomeId, sourcePath] of features) insert(db, { id, projectId, kind: 'feature' }, { title, summary, data: { status, outcome_id: outcomeId, evidence: [] }, sourcePath, author: 'repository reconciliation' });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function getProductWorkspace(db, projectId = 'the-machine') {
  const rows = db.prepare(`SELECT p.id, p.kind, r.revision, r.title, r.summary, r.data_json, r.source_path, r.author, r.created_at
    FROM product_records p JOIN product_record_revisions r ON r.id = p.current_revision_id
    WHERE p.project_id = ? ORDER BY p.kind, r.title`).all(projectId).map(hydrate);
  const direction = rows.find(item => item.kind === 'direction') || null;
  const outcomes = rows.filter(item => item.kind === 'outcome').sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
  const features = rows.filter(item => item.kind === 'feature');
  for (const outcome of outcomes) outcome.feature_count = features.filter(item => item.outcome_id === outcome.id).length;
  return { direction, outcomes, features };
}

function normalize(kind, input) {
  const title = String(input.title || '').trim();
  const summary = String(input.summary || '').trim();
  if (!title || !summary) fail('Title and summary are required.');
  if (kind === 'direction') return { title, summary, data: { audience: String(input.audience || '').trim(), outcomes: cleanLines(input.outcomes), constraints: cleanLines(input.constraints), success: cleanLines(input.success) } };
  if (kind === 'outcome') {
    if (!['now', 'next', 'later'].includes(input.horizon) || !['proposed', 'active', 'achieved', 'deferred'].includes(input.status)) fail('Choose a valid horizon and state.');
    return { title, summary, data: { horizon: input.horizon, status: input.status, priority: Math.max(1, Number(input.priority) || 1) } };
  }
  if (!['proposed', 'planned', 'active', 'available', 'retired'].includes(input.status)) fail('Choose a valid feature state.');
  return { title, summary, data: { status: input.status, outcome_id: input.outcome_id || null, evidence: cleanLines(input.evidence) } };
}

export function saveProductRecord(db, projectId, kind, id, input) {
  if (!['direction', 'outcome', 'feature'].includes(kind)) fail('Unknown product record kind.');
  const normalized = normalize(kind, input);
  const existing = id ? current(db, id) : null;
  if (id && (!existing || existing.kind !== kind)) fail('Product record not found.', 404);
  if (existing && Number(input.expectedRevision) !== existing.revision) fail('This product record changed. Refresh and review the current revision; your draft is retained.', 409);
  const sourcePath = existing?.source_path || null;
  const comparable = existing && JSON.stringify({ title: existing.title, summary: existing.summary, data: kind === 'direction'
    ? { audience: existing.audience, outcomes: existing.outcomes, constraints: existing.constraints, success: existing.success }
    : kind === 'outcome' ? { horizon: existing.horizon, status: existing.status, priority: existing.priority }
      : { status: existing.status, outcome_id: existing.outcome_id, evidence: existing.evidence } }) === JSON.stringify({ ...normalized, data: normalized.data });
  if (comparable) return { ...existing, unchanged: true };
  const recordId = id || `${kind}-${randomUUID()}`;
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!existing) db.prepare('INSERT INTO product_records(id, project_id, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(recordId, projectId, kind, now, now);
    const revision = (existing?.revision || 0) + 1;
    const result = db.prepare(`INSERT INTO product_record_revisions(record_id, revision, title, summary, data_json, source_path, author, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'owner', ?)`).run(recordId, revision, normalized.title, normalized.summary, JSON.stringify(normalized.data), sourcePath, now);
    db.prepare('UPDATE product_records SET current_revision_id = ?, updated_at = ? WHERE id = ?').run(result.lastInsertRowid, now, recordId);
    if (existing) db.prepare(`UPDATE downstream_records SET currency = 'stale', stale_reason = ?, updated_at = ? WHERE id IN
      (SELECT downstream_record_id FROM product_dependencies WHERE product_record_id = ? AND consumed_revision < ?)`)
      .run(`${kind} ${recordId} changed from revision ${existing.revision} to ${revision}`, now, recordId, revision);
    db.exec('COMMIT');
    return current(db, recordId);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
