// Verify side-by-side sanitized previews without printing session credentials.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { createSession } from '../server/accounts.mjs';

const [candidatePath, currentPath, candidateOrigin, currentOrigin] = process.argv.slice(2);
if (![candidatePath, currentPath, candidateOrigin, currentOrigin].every(Boolean))
  throw new Error('Usage: node tools/lat08-preview-check.mjs CANDIDATE.sqlite CURRENT.sqlite CANDIDATE_ORIGIN CURRENT_ORIGIN');
const candidate = new DatabaseSync(candidatePath);
const current = new DatabaseSync(currentPath);
const projectIds = candidate.prepare("SELECT id FROM projects WHERE id <> 'the-machine' ORDER BY id").all().map(row => row.id);
assert.ok(projectIds.length);
assert.deepEqual(current.prepare("SELECT id FROM projects WHERE id <> 'the-machine' ORDER BY id").all().map(row => row.id), projectIds);
const candidateCookie = createSession(candidate, 'owner').split(';')[0];
const currentCookie = createSession(current, 'owner').split(';')[0];
const project = projectIds[0];
const workspace = candidate.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(project).workspace_path;
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim();
const counts = { candidateActions: candidate.prepare('SELECT COUNT(*) AS n FROM layer_action_installations').get().n,
  candidateMappedWork: candidate.prepare("SELECT COUNT(*) AS n FROM layer_work_migration WHERE disposition = 'mapped'").get().n,
  currentActionTable: current.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'layer_action_installations'").get().n };
candidate.close(); current.close();
const request = async (origin, path, cookie) => {
  const response = await fetch(new URL(path, origin), { headers: cookie ? { cookie } : {} });
  let body = null;
  try { body = await response.json(); } catch { /* the shell is HTML */ }
  return { status: response.status, body };
};
const result = { ...counts, candidate: {}, current: {} };
for (const [name, origin, cookie] of [['candidate', candidateOrigin, candidateCookie], ['current', currentOrigin, currentCookie]]) {
  const shell = await request(origin, '/', null); assert.equal(shell.status, 200);
  const projects = await request(origin, '/api/projects', cookie); assert.equal(projects.status, 200);
  assert.equal(projects.body.projects.filter(row => row.id !== 'the-machine').length, projectIds.length);
  const work = [];
  for (const id of projectIds) {
    const snapshot = await request(origin, `/api/projects/${id}/knowledge`, cookie);
    assert.equal(snapshot.status, 200, snapshot.body?.error);
    work.push(snapshot.body.knowledge.work.length);
  }
  result[name] = { shell: shell.status, projects: projects.status, knowledge: 200, work };
}
const actions = await request(candidateOrigin, `/api/projects/${project}/layer-actions/product`, candidateCookie);
assert.equal(actions.status, 200); assert.ok(actions.body.actions.length);
const source = await request(candidateOrigin, `/api/projects/${project}/layers/code/action-source?action=product.define&commit=${commit}&path=README.md`, candidateCookie);
assert.equal(source.status, 200); assert.ok(source.body.size > 0);
const secret = await request(candidateOrigin, `/api/projects/${project}/layers/code/action-source?action=product.define&commit=${commit}&path=.env`, candidateCookie);
assert.equal(secret.status, 404);
const crossoverA = await request(currentOrigin, '/api/projects', candidateCookie);
const crossoverB = await request(candidateOrigin, '/api/projects', currentCookie);
assert.equal(crossoverA.status, 401); assert.equal(crossoverB.status, 401);
assert.equal(counts.currentActionTable, 0); assert.equal(counts.candidateMappedWork, 5);
result.candidate.actions = actions.body.actions.length;
result.candidate.pinnedSource = source.status;
result.candidate.secretDenied = secret.status;
result.crossPortalSessionsDenied = [crossoverA.status, crossoverB.status];
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
