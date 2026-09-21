import { randomUUID } from 'node:crypto';

const now = () => new Date().toISOString();
const parse = value => JSON.parse(value || '[]');
const list = value => Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : [];

function proposalRow(db, id) {
  const row = db.prepare(`SELECT p.id, p.project_id, p.source_request_id, p.status, r.revision,
    r.title, r.intent, r.acceptance_json, r.assumptions_json, r.exclusions_json, r.author, r.created_at
    FROM change_proposals p JOIN proposal_revisions r ON r.id = p.current_revision_id WHERE p.id = ?`).get(id);
  if (!row) return null;
  return { ...row, acceptance: parse(row.acceptance_json), assumptions: parse(row.assumptions_json), exclusions: parse(row.exclusions_json) };
}

export function createProposal(db, input, actor = 'owner') {
  const request = input.requestId ? db.prepare('SELECT id, body FROM owner_requests WHERE id = ?').get(input.requestId) : null;
  if (input.requestId && !request) throw Object.assign(new Error('Source request not found.'), { status: 404 });
  const id = input.id || `PROP-${randomUUID()}`;
  const created = now();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO change_proposals(id, project_id, source_request_id, status, created_at, updated_at)
      VALUES (?, 'the-machine', ?, 'draft', ?, ?)`).run(id, input.requestId || null, created, created);
    const revision = db.prepare(`INSERT INTO proposal_revisions
      (proposal_id, revision, title, intent, acceptance_json, assumptions_json, exclusions_json, author, created_at)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, String(input.title || 'Untitled change').trim(), String(input.intent || request?.body || '').trim(),
        JSON.stringify(list(input.acceptance)), JSON.stringify(list(input.assumptions)), JSON.stringify(list(input.exclusions)), actor, created);
    db.prepare('UPDATE change_proposals SET current_revision_id = ? WHERE id = ?').run(Number(revision.lastInsertRowid), id);
    if (request) db.prepare("UPDATE owner_requests SET status = 'proposed', updated_at = ? WHERE id = ?").run(created, request.id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return proposalRow(db, id);
}

export function reviseProposal(db, id, input) {
  const current = proposalRow(db, id);
  if (!current) throw Object.assign(new Error('Proposal not found.'), { status: 404 });
  if (Number(input.expectedRevision) !== current.revision) throw Object.assign(new Error(`Proposal changed to revision ${current.revision}. Review it before saving.`), { status: 409, currentRevision: current.revision });
  const created = now();
  db.exec('BEGIN IMMEDIATE');
  try {
    const revision = db.prepare(`INSERT INTO proposal_revisions
      (proposal_id, revision, title, intent, acceptance_json, assumptions_json, exclusions_json, author, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'owner', ?)`)
      .run(id, current.revision + 1, String(input.title || current.title).trim(), String(input.intent || current.intent).trim(),
        JSON.stringify(list(input.acceptance)), JSON.stringify(list(input.assumptions)), JSON.stringify(list(input.exclusions)), created);
    db.prepare('UPDATE change_proposals SET current_revision_id = ?, updated_at = ? WHERE id = ?').run(Number(revision.lastInsertRowid), created, id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return proposalRow(db, id);
}

export function listProposals(db) {
  return db.prepare(`SELECT p.id, p.status, p.source_request_id, r.revision, r.title, r.intent, r.created_at
    FROM change_proposals p JOIN proposal_revisions r ON r.id = p.current_revision_id
    ORDER BY p.updated_at DESC`).all();
}

export function getProposal(db, id) {
  const proposal = proposalRow(db, id);
  if (!proposal) return null;
  proposal.revisions = db.prepare(`SELECT revision, title, intent, acceptance_json, assumptions_json, exclusions_json, author, created_at
    FROM proposal_revisions WHERE proposal_id = ? ORDER BY revision DESC`).all(id).map(row => ({ ...row, acceptance: parse(row.acceptance_json), assumptions: parse(row.assumptions_json), exclusions: parse(row.exclusions_json) }));
  proposal.decisions = db.prepare(`SELECT d.id, d.status, r.revision, r.question, r.answer
    FROM decisions d JOIN decision_revisions r ON r.id = d.current_revision_id WHERE d.proposal_id = ? ORDER BY d.id`).all(id);
  return proposal;
}

function decisionRow(db, id) {
  const row = db.prepare(`SELECT d.id, d.project_id, d.proposal_id, d.status, r.revision, r.question,
    r.context, r.options_json, r.recommendation, r.answer, r.rationale, r.author, r.created_at
    FROM decisions d JOIN decision_revisions r ON r.id = d.current_revision_id WHERE d.id = ?`).get(id);
  return row ? { ...row, options: parse(row.options_json) } : null;
}

export function listDecisions(db) {
  return db.prepare(`SELECT d.id, d.status, r.revision, r.question, r.context, r.recommendation, r.answer,
    (SELECT COUNT(*) FROM record_dependencies x WHERE x.decision_id = d.id) AS affected_count
    FROM decisions d JOIN decision_revisions r ON r.id = d.current_revision_id ORDER BY CASE d.status WHEN 'open' THEN 0 ELSE 1 END, d.updated_at DESC`).all();
}

export function getDecision(db, id) {
  const decision = decisionRow(db, id);
  if (!decision) return null;
  decision.revisions = db.prepare(`SELECT revision, question, recommendation, answer, rationale, author, created_at
    FROM decision_revisions WHERE decision_id = ? ORDER BY revision DESC`).all(id);
  decision.affected = db.prepare(`SELECT r.id, r.kind, r.title, r.revision, r.status, r.currency, r.stale_reason,
    x.required, x.consumed_decision_revision FROM record_dependencies x
    JOIN downstream_records r ON r.id = x.downstream_record_id WHERE x.decision_id = ? ORDER BY r.id`).all(id);
  return decision;
}

export function answerDecision(db, id, input) {
  const current = decisionRow(db, id);
  if (!current) throw Object.assign(new Error('Decision not found.'), { status: 404 });
  if (Number(input.expectedRevision) !== current.revision) throw Object.assign(new Error(`This decision changed to revision ${current.revision}. Your draft is kept; review the current revision before saving.`), { status: 409, currentRevision: current.revision });
  if (!current.options.includes(input.answer)) throw Object.assign(new Error('Choose one of the recorded options.'), { status: 400 });
  const created = now();
  const nextRevision = current.revision + 1;
  db.exec('BEGIN IMMEDIATE');
  try {
    const revision = db.prepare(`INSERT INTO decision_revisions
      (decision_id, revision, question, context, options_json, recommendation, answer, rationale, author, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'owner', ?)`)
      .run(id, nextRevision, current.question, current.context, JSON.stringify(current.options), current.recommendation,
        String(input.answer), String(input.rationale || '').trim(), created);
    db.prepare("UPDATE decisions SET current_revision_id = ?, status = 'answered', updated_at = ? WHERE id = ?")
      .run(Number(revision.lastInsertRowid), created, id);
    const affected = db.prepare('SELECT downstream_record_id, consumed_decision_revision FROM record_dependencies WHERE decision_id = ?').all(id);
    for (const dependency of affected) {
      if (dependency.consumed_decision_revision !== nextRevision) {
        db.prepare(`UPDATE downstream_records SET currency = 'stale', stale_reason = ?, updated_at = ? WHERE id = ?`)
          .run(`${id} changed from revision ${dependency.consumed_decision_revision} to ${nextRevision}.`, created, dependency.downstream_record_id);
      }
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getDecision(db, id);
}

export function listDownstreamRecords(db) {
  return db.prepare(`SELECT r.*,
    (SELECT COUNT(*) FROM record_dependencies x WHERE x.downstream_record_id = r.id) AS dependency_count
    FROM downstream_records r ORDER BY CASE r.currency WHEN 'stale' THEN 0 ELSE 1 END, r.id`).all();
}

export function reassessRecord(db, id) {
  const record = db.prepare('SELECT * FROM downstream_records WHERE id = ?').get(id);
  if (!record) throw Object.assign(new Error('Downstream record not found.'), { status: 404 });
  const created = now();
  db.exec('BEGIN IMMEDIATE');
  try {
    const dependencies = db.prepare(`SELECT x.id, d.status, r.revision FROM record_dependencies x
      JOIN decisions d ON d.id = x.decision_id JOIN decision_revisions r ON r.id = d.current_revision_id
      WHERE x.downstream_record_id = ?`).all(id);
    if (dependencies.some(item => item.status !== 'answered')) throw Object.assign(new Error('A required decision is still open.'), { status: 409 });
    for (const dependency of dependencies) db.prepare('UPDATE record_dependencies SET consumed_decision_revision = ? WHERE id = ?').run(dependency.revision, dependency.id);
    db.prepare("UPDATE downstream_records SET revision = revision + 1, currency = 'current', stale_reason = NULL, updated_at = ? WHERE id = ?").run(created, id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return db.prepare('SELECT * FROM downstream_records WHERE id = ?').get(id);
}

export function ensureB02Fixture(db) {
  if (db.prepare("SELECT id FROM change_proposals WHERE id = 'PROP-MACHINE-001'").get()) return;
  const created = now();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO change_proposals(id, project_id, status, created_at, updated_at)
      VALUES ('PROP-MACHINE-001', 'the-machine', 'accepted', ?, ?)`).run(created, created);
    const proposalRevision = db.prepare(`INSERT INTO proposal_revisions
      (proposal_id, revision, title, intent, acceptance_json, assumptions_json, exclusions_json, author, created_at)
      VALUES ('PROP-MACHINE-001', 1, ?, ?, ?, ?, ?, 'owner', ?)`)
      .run('Move mutable product records into Aludel', 'Use the approved local portal as the authoritative home for mutable product work while preserving repository-owned sources.',
        JSON.stringify(['Requests and decisions survive restart.', 'Changed decisions stale only linked downstream records.']),
        JSON.stringify(['One owner and loopback access for the bootstrap.']), JSON.stringify(['Agent execution and external deployment.']), created);
    db.prepare("UPDATE change_proposals SET current_revision_id = ? WHERE id = 'PROP-MACHINE-001'").run(Number(proposalRevision.lastInsertRowid));
    db.prepare(`INSERT INTO decisions(id, project_id, proposal_id, status, created_at, updated_at)
      VALUES ('DEC-MACHINE-DATA', 'the-machine', 'PROP-MACHINE-001', 'answered', ?, ?)`).run(created, created);
    const decisionRevision = db.prepare(`INSERT INTO decision_revisions
      (decision_id, revision, question, context, options_json, recommendation, answer, rationale, author, created_at)
      VALUES ('DEC-MACHINE-DATA', 1, ?, ?, ?, ?, ?, ?, 'owner', ?)`)
      .run('Where should mutable product records live during the local bootstrap?',
        'The Markdown corpus is useful evidence but cannot safely coordinate mutable requests, decisions, and dependency state.',
        JSON.stringify(['Portal database with repository sources', 'Continue using hand-edited Markdown']),
        'Portal database with repository sources', 'Portal database with repository sources',
        'Begin the information-system transition locally while retaining code-adjacent repository authority.', created);
    db.prepare("UPDATE decisions SET current_revision_id = ? WHERE id = 'DEC-MACHINE-DATA'").run(Number(decisionRevision.lastInsertRowid));
    db.prepare(`INSERT INTO downstream_records(id, project_id, proposal_id, kind, title, revision, status, currency, created_at, updated_at)
      VALUES ('PLAN-B02', 'the-machine', 'PROP-MACHINE-001', 'plan', 'B-02 information-system plan', 1, 'active', 'current', ?, ?),
             ('PLAN-B03', 'the-machine', NULL, 'plan', 'B-03 execution groundwork', 1, 'blocked', 'current', ?, ?)`)
      .run(created, created, created, created);
    db.prepare(`INSERT INTO record_dependencies(decision_id, downstream_record_id, required, consumed_decision_revision, created_at)
      VALUES ('DEC-MACHINE-DATA', 'PLAN-B02', 1, 1, ?)`).run(created);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
