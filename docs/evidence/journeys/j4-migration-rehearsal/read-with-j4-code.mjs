// Phase B: the J4 code (root argv[2]) opens a copy of phase A's data, migrates on init, and shows what reviewers and agents see.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const [root, dir, idsFile] = process.argv.slice(2);
const ids = JSON.parse(readFileSync(idsFile, 'utf8'));
const m = async name => import(join(root, 'apps/portal/server', name));
const { initAccounts } = await m('accounts.mjs');
const { initAgentRuns } = await m('agent-runs.mjs');
const { initKnowledge, knowledge } = await m('knowledge.mjs');
const { initOnboarding, loadCatalogs } = await m('onboarding.mjs');
const { ensureProductWorkspace } = await m('product-workspace.mjs');
const { openDatabase } = await m('storage.mjs');
const { initSymphonyWorker } = await m('symphony-worker.mjs');
const { initWorkRuns, workRuns } = await m('work-runs.mjs');
const { initWorkflow } = await m('workflow.mjs');
const boot = () => { const db = openDatabase(join(dir, 'machine.sqlite')); initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db); initWorkRuns(db); return db; };
const db = boot();
const catalogs = loadCatalogs(join(root, 'apps/portal/config'));
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const history = workRuns({ db, know });
const row = db.prepare('SELECT * FROM users WHERE id = ?').get(ids.ownerId); const owner = { id: row.id, name: row.display_name, email: row.email };
const show = {};
for (const key of ['agent', 'person', 'ready']) { const item = know.workById(ids.projectId, ids[key]); show[key] = { checks: item.checks.map(c => [c.id, c.kind, c.backed, c.text, c.verdict]), log: item.log.at(-1).text }; }
const [agentRun] = history.list(ids.projectId, ids.agent), [personRun] = history.list(ids.projectId, ids.person);
show.agentRun = { criteria: agentRun.task.criteria.map(c => c.id), verdicts: agentRun.review.verdicts, evidence: agentRun.evidence.map(e => [e.claim, e.type, e.found]) };
show.personRun = { criteria: personRun.task.criteria.map(c => c.id), verdicts: personRun.review.verdicts, evidence: personRun.evidence.map(e => [e.claim, e.note]) };
console.log(JSON.stringify(show, null, 1));
assert.deepEqual(show.agent.checks.map(c => c[0]), ['note-1', 'note-2']);
assert.deepEqual(show.ready.checks.map(c => c[0]), ['note-1', 'note-2', 'note-3']);
assert.deepEqual(show.agentRun.verdicts, { 'note-1': { value: 'accept', note: '' }, 'note-2': { value: 'reject', note: 'Which user?' } });
assert.deepEqual(show.agentRun.evidence, [['note-2', 'change', true]]);
assert.deepEqual(show.personRun.verdicts, { 'note-2': { value: 'accept', note: '' } });
assert.deepEqual(show.personRun.evidence, [['note-2', 'The date is in the header.']]);
// The review continues on migrated data: a send-back names the claim, and its feedback carries the ID.
await history.sign(owner, ids.projectId, ids.agent, ids.agentAttempt, { outcome: 'reject', comment: 'Name the user.' });
assert.deepEqual(know.workById(ids.projectId, ids.agent).context.feedback.map(note => [note.claim, note.check]), [['note-2', 'It names the user']]);
const logLengths = ['agent', 'person', 'ready'].map(key => know.workById(ids.projectId, ids[key]).log.length);
db.close();
// A second restart changes nothing.
const again = boot(); const knowAgain = knowledge({ db: again, catalogs, packs: catalogs.packs });
assert.deepEqual(['agent', 'person', 'ready'].map(key => knowAgain.workById(ids.projectId, ids[key]).log.length), logLengths);
again.close();
console.log('rehearsal passed');
