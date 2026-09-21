// Trusted local bridge. Never reads owner credentials or impersonates browser authorization.
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { openDatabase } from './storage.mjs';
import { initWorkflow, workList, workOperation } from './workflow.mjs';
import { createProposal, listProposals } from './product-records.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const db = openDatabase(resolve(process.env.MACHINE_DATA_DIR || resolve(root, '.data'), 'machine.sqlite'));
initWorkflow(db);
try {
  const [action = 'inbox', inputPath] = process.argv.slice(2);
  const input = inputPath ? JSON.parse(readFileSync(inputPath, 'utf8')) : {};
  let result;
  if (action === 'inbox') result = { protocol: 'supervised-local-v1', requests: db.prepare('SELECT id, body, status FROM owner_requests ORDER BY created_at').all(), proposals: listProposals(db), tasks: workList(db) };
  else if (action === 'ask') {
    if (!input.proposalId || !input.question?.trim() || !input.context?.trim() || !Array.isArray(input.options) || input.options.length < 2 || input.options.some(v => typeof v !== 'string' || !v.trim())) throw new Error('Question needs proposalId, question, context, and at least two options.');
    const id = `QUESTION-${randomUUID()}`, now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare("INSERT INTO decisions(id, project_id, proposal_id, status, created_at, updated_at) VALUES (?, 'the-machine', ?, 'open', ?, ?)").run(id, input.proposalId, now, now);
      const revision = db.prepare("INSERT INTO decision_revisions(decision_id, revision, question, context, options_json, recommendation, author, created_at) VALUES (?, 1, ?, ?, ?, ?, 'operator', ?)").run(id,input.question,input.context,JSON.stringify(input.options),input.recommendation || null,now);
      db.prepare('UPDATE decisions SET current_revision_id = ? WHERE id = ?').run(Number(revision.lastInsertRowid),id);
      db.exec('COMMIT'); result={id, state:'open', path:`/#/the-machine/decisions/${id}`};
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  else if (action === 'propose') result = createProposal(db, input, 'operator');
  else result = workOperation(db, 'operator', action, input);
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { db.close(); }
