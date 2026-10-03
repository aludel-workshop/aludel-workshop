import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { reviewPreviews, reviewInputs, separability, localReviewPath } from '../server/review-previews.mjs';
import { initLayerSource } from '../server/layer-source.mjs';
import { previewImageName } from '../server/previews.mjs';
import { stepPlan } from '../server/journey-runner.mjs';

const dockerReady = spawnSync('docker', ['info'], { stdio: 'ignore', timeout: 5000 }).status === 0;
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
// JOURNEYS-01 J3: the v2 recipe maps personas to fixtures; review steps come from the journeys, whose step tests run
// black-box against the combined build. One journey has a passing, an uncovered, a failing and a then-skipped step; one
// can't be entered (its persona has no fixture); one continues past a step whose persona has none.
const recipe = { version: 2, checks: [{ name: 'Real app test', command: ['node', '--test', 'tests/app.test.mjs'] }],
  personas: { author: { fixture: 'post-v1', session: 'author' }, viewer: { fixture: 'post-v1', session: 'viewer' } } };
const step = (id, route, test, extra = {}) => ({ id, name: `Review ${id}`, route, trigger: 'Opens it', expected: `The ${id} step works.`, ...(test ? { test } : {}), ...extra });
const journeys = { journeys: [
  { version: 1, id: 'edit-post', title: 'Edit a post', origin: 'authored', revision: 1, persona: 'author', steps: [
    step('edit', '/posts/demo/edit', 'edit-post.spec.mjs#edit'), step('publish', '/posts/demo/publish'),
    step('save', '/posts/demo', 'edit-post.spec.mjs#save'), step('share', '/posts/demo/share', 'edit-post.spec.mjs#share')] },
  { version: 1, id: 'moderate', title: 'Moderate posts', origin: 'authored', revision: 1, persona: 'moderator', steps: [step('queue', '/queue', 'moderate.spec.mjs#queue')] },
  { version: 1, id: 'read', title: 'Read a post', origin: 'observed', revision: 1, persona: 'viewer', steps: [
    step('view', '/posts/demo?mode=view', 'read.spec.mjs#view'), step('admin', '/admin', 'read.spec.mjs#admin', { persona: 'admin' }), step('again', '/posts/demo', 'read.spec.mjs#again')] }] };
const specs = {
  'edit-post.spec.mjs': `export default {
  async edit({ page, assert, step }) { assert.equal(step.route, '/posts/demo/edit'); await page.getByText('/posts/demo/edit', { exact: true }).waitFor(); assert.match(await page.locator('p').textContent(), /demo_role=author/); },
  async save({ page }) { await page.goto('/posts/demo'); await page.getByText('Saved', { exact: true }).waitFor({ timeout: 1000 }); },
  async share() { throw new Error('a step after a failure must not run'); } };\n`,
  // The runner's only network is the candidate: the open internet is unreachable from a step test.
  'read.spec.mjs': `export default {
  async view({ page, assert }) { await page.getByText('/posts/demo', { exact: true }).waitFor(); assert.match(await page.locator('p').textContent(), /demo_role=viewer/);
    await assert.rejects(fetch('http://example.com/', { signal: AbortSignal.timeout(5000) })); },
  async again({ page, assert }) { await page.goto('/posts/demo'); assert.match(await page.locator('p').textContent(), /demo_role=viewer/); } };\n` };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-review-preview-')), repo = join(root, 'repo'); mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main'); git(repo, 'config', 'user.name', 'Fixture'); git(repo, 'config', 'user.email', 'fixture@example.invalid');
  const db = new DatabaseSync(join(root, 'db.sqlite'));
  initLayerSource(db);
  db.exec(`CREATE TABLE layer_instances (project_id TEXT, layer_key TEXT, instance_id TEXT); CREATE TABLE layer_package_bindings (project_id TEXT, layer_key TEXT, layer_instance_id TEXT, repository_path TEXT, accepted_commit TEXT); CREATE TABLE symphony_proposals (attempt_id TEXT, state TEXT)`);
  mkdirSync(join(repo, '.aludel/outputs'), { recursive: true }); mkdirSync(join(repo, '.aludel/journeys')); mkdirSync(join(repo, 'server')); mkdirSync(join(repo, 'tests'));
  writeFileSync(join(repo, '.aludel/review.json'), JSON.stringify(recipe));
  writeFileSync(join(repo, '.aludel/outputs/journeys.json'), JSON.stringify(journeys));
  writeFileSync(join(repo, '.aludel/seams.json'), JSON.stringify({ version: 1, seams: [{ path: 'server/server.mjs', kind: 'edit', purpose: 'The review setup route', remove: 'Delete the handler' }] }));
  for (const [name, text] of Object.entries(specs)) writeFileSync(join(repo, '.aludel/journeys', name), text);
  writeFileSync(join(repo, 'tests/app.test.mjs'), "import test from 'node:test'; import assert from 'node:assert/strict'; test('post identity',()=>assert.equal('demo'.length,4));\n");
  writeFileSync(join(repo, 'Dockerfile'), 'FROM node:24-bookworm-slim\nWORKDIR /app\nCOPY server server\nCOPY tests tests\nUSER node\nCMD ["node","server/server.mjs"]\n');
  // The setup call names the step's persona, fixture and session; the app never reads .aludel/. Its cookie is a preview
  // session cookie as the generated apps set it (Secure; Partitioned), which the step runner must carry.
  writeFileSync(join(repo, 'server/server.mjs'), `import {createServer} from 'node:http';
createServer(async(req,res)=>{
  if(req.url==='/api/health')return res.end('ok');
  if(req.url==='/api/__aludel/review'){
    if(req.headers.authorization!=='Bearer '+process.env.ALUDEL_REVIEW_TOKEN){res.writeHead(404);return res.end();}
    let text='';for await(const part of req)text+=part;
    const {journey,step,persona,fixture,session}=JSON.parse(text);
    if(fixture!=='post-v1'||!journey||!step||!persona){res.writeHead(409);return res.end();}
    res.setHeader('set-cookie','demo_role='+session+'; HttpOnly; SameSite=None; Secure; Partitioned; Path=/');return res.end('{}');
  }
  res.setHeader('content-type','text/html');res.end('<h1>'+new URL(req.url,'http://x').pathname+'</h1><p>'+String(req.headers.cookie||'anonymous')+'</p>');
}).listen(process.env.PORT,'0.0.0.0');`);
  git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'Fixture'); const commit = git(repo, 'rev-parse', 'HEAD');
  db.prepare('INSERT INTO layer_instances VALUES (?, ?, ?)').run('p1', 'platform', 'i1');
  db.prepare('INSERT INTO layer_package_bindings VALUES (?, ?, ?, ?, ?)').run('p1', 'platform', 'i1', repo, commit);
  function integration(id) {
    db.prepare('INSERT INTO layer_review_integrations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, `att-${id}`, 'p1', 'platform', commit, commit, commit, '{}', new Date().toISOString());
    db.prepare('INSERT INTO symphony_proposals VALUES (?, ?)').run(`att-${id}`, 'submitted');
  }
  integration('rvi-one'); integration('rvi-two'); integration('rvi-three');
  for (let index = 4; index <= 10; index++) integration(`rvi-${index}`);
  return { root, repo, db, commit };
}
const commitWith = (f, path, value) => { writeFileSync(join(f.repo, path), typeof value === 'string' ? value : JSON.stringify(value)); git(f.repo, 'add', '.'); git(f.repo, 'commit', '-qm', `Change ${path}`); return git(f.repo, 'rev-parse', 'HEAD'); };

test('review inputs come from the commit: a v2 recipe, journeys with local routes, and declared seams', () => {
  for (const path of ['//evil.invalid', '/\\evil.invalid', '/%2fevil', '/ok\r\nLocation: evil', '/\t/evil.invalid', 'https://evil.invalid']) assert.equal(localReviewPath(path), false);
  assert.equal(localReviewPath('/posts/demo?edit=1#form'), true);
  const f = fixture();
  try {
    const inputs = reviewInputs(f.repo, f.commit);
    assert.deepEqual(inputs.steps.map(step => step.id), ['edit-post.edit', 'edit-post.publish', 'edit-post.save', 'edit-post.share', 'moderate.queue', 'read.view', 'read.admin', 'read.again']);
    assert.deepEqual(inputs.steps.filter(step => !step.available).map(step => [step.id, step.reason]),
      [['moderate.queue', 'No fixture is declared for persona moderator.'], ['read.admin', 'No fixture is declared for persona admin.']]);
    // What runs: only journeys with a test to run are entered; the rest settle without starting the runner.
    const { plan, settled } = stepPlan(inputs.journeys, inputs.steps);
    assert.deepEqual(plan.map(journey => [journey.id, journey.first.id, journey.steps.map(step => step.status || 'run')]),
      [['edit-post', 'edit-post.edit', ['run', 'uncovered', 'run', 'run']], ['read', 'read.view', ['run', 'no-fixture', 'run']]]);
    assert.deepEqual(settled.map(result => [result.id, result.status]), [['moderate.queue', 'no-fixture']]);
    const untested = structuredClone(journeys.journeys[0]); untested.steps.forEach(step => delete step.test);
    assert.deepEqual(stepPlan([untested], inputs.steps.filter(step => step.journey === 'edit-post')).plan, [], 'a journey without tests starts no runner');
    assert.deepEqual(separability(f.repo, f.commit, inputs.seams), { seamsFile: true, declared: 1, undeclared: [] });
    const coupled = commitWith(f, 'server/aludel-telemetry.mjs', 'export {};\n');
    assert.deepEqual(separability(f.repo, coupled, reviewInputs(f.repo, coupled).seams).undeclared, ['server/aludel-telemetry.mjs'], 'an undeclared coupling is found in review');
    const offsite = structuredClone(journeys); offsite.journeys[0].steps[0].route = '//evil.invalid';
    assert.throws(() => reviewInputs(f.repo, commitWith(f, '.aludel/outputs/journeys.json', offsite)), /local path/);
    commitWith(f, '.aludel/outputs/journeys.json', journeys);
    assert.throws(() => reviewInputs(f.repo, commitWith(f, '.aludel/review.json', { version: 1, checks: recipe.checks, scenarios: [] })), /v1 scenarios are retired/);
  } finally { f.db.close(); rmSync(f.root, { recursive: true, force: true }); }
});

test('combined previews walk journey step tests, retain image identity, isolate steps, cap runtime, restart, reject stale bases and retire only closed artifacts', { skip: !dockerReady && 'Docker unavailable', timeout: 600000 }, async () => {
  const f = fixture(); const manager = reviewPreviews({ db: f.db, portalRoot: new URL('..', import.meta.url).pathname, dataDirectory: f.root, appOrigin: host => `http://${host}`, maxRunning: 2 });
  const bridge = createServer(async (req, res) => { try { await manager.serve('rvi-one', req, res); } catch (error) { res.writeHead(error.status || 500); res.end(error.message); } });
  await new Promise(resolve => bridge.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${bridge.address().port}`;
  try {
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM layer_review_integrations').get().n, 10);
    assert.equal(manager.status('rvi-10').status, 'not-built', 'ten waiting reviews do not prebuild images');
    const one = await manager.build('rvi-one');
    assert.equal(one.commit, f.commit); assert.equal(one.status, 'running'); assert.ok(one.checks.every(check => check.status === 'passed'));
    assert.match(one.imageDigest, /^sha256:[a-f0-9]{64}$/);
    // Every step's test ran black-box against this build, and each result says what it is.
    const results = Object.fromEntries(one.steps.map(step => [step.id, step.result?.status]));
    assert.deepEqual(results, { 'edit-post.edit': 'passed', 'edit-post.publish': 'uncovered', 'edit-post.save': 'failed', 'edit-post.share': 'skipped',
      'moderate.queue': 'no-fixture', 'read.view': 'passed', 'read.admin': 'no-fixture', 'read.again': 'passed' }, JSON.stringify(one.steps.map(step => [step.id, step.result])));
    const byId = new Map(one.steps.map(step => [step.id, step]));
    assert.match(byId.get('edit-post.save').result.detail, /Saved/, 'a failing step says why');
    assert.match(byId.get('edit-post.share').result.detail, /step save failed/);
    assert.match(byId.get('moderate.queue').result.detail, /can't be entered: no fixture is declared for persona moderator/);
    assert.deepEqual(one.journeys.map(journey => journey.id), ['edit-post', 'moderate', 'read']);
    assert.deepEqual(one.separability, { seamsFile: true, declared: 1, undeclared: [] });
    const shot = readFileSync(manager.stepScreenshot('rvi-one', 'edit-post.save'));
    assert.deepEqual([...shot.subarray(0, 3)], [0xff, 0xd8, 0xff], 'a failing step keeps a JPEG screenshot');
    assert.throws(() => manager.stepScreenshot('rvi-one', 'edit-post.publish'), /No screenshot/, 'an uncovered step has none');
    await assert.rejects(manager.openStep('rvi-one', 'moderate.queue'), /No fixture is declared for persona moderator/);
    await assert.rejects(manager.openStep('rvi-one', 'edit-post.publish'), /preceding/);
    const step = await manager.openStep('rvi-one', 'edit-post.edit');
    const response = await fetch(origin + new URL(step.url).pathname, { redirect: 'manual' });
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/posts/demo/edit');
    assert.match(response.headers.get('set-cookie'), /demo_role=author/);
    assert.equal((await fetch(origin + new URL(step.url).pathname, { redirect: 'manual' })).status, 410, 'step tickets are one use');
    await manager.openStep('rvi-one', 'edit-post.publish');
    const viewer = await manager.openStep('rvi-one', 'read.view');
    const viewerResponse = await fetch(origin + new URL(viewer.url).pathname, { redirect: 'manual' });
    assert.match(viewerResponse.headers.get('set-cookie'), /demo_role=viewer/);
    assert.equal((await fetch(origin + '/api/__aludel/review', { method: 'POST' })).status, 403);
    const two = await manager.build('rvi-two');
    await assert.rejects(manager.build('rvi-three'), /Two previews/);
    await manager.close('rvi-one');
    const restarted = await manager.build('rvi-one'); assert.equal(restarted.imageDigest, one.imageDigest);
    assert.equal(restarted.checkedAt, one.checkedAt);
    assert.equal(restarted.stepsRanAt, one.stepsRanAt, 'a cached build keeps its step evidence');
    await assert.rejects(manager.retire('rvi-one'), /open review/);
    await manager.stopIdle(Date.now() + 11 * 60 * 1000);
    assert.equal(manager.status('rvi-one').status, 'stopped');
    assert.equal(manager.status('rvi-two').status, 'stopped');
    assert.equal((await manager.build('rvi-one')).imageDigest, one.imageDigest);
    await manager.build('rvi-two');
    git(f.repo, 'commit', '--allow-empty', '-qm', 'Accepted head moved');
    f.db.prepare('UPDATE layer_package_bindings SET accepted_commit = ?').run(git(f.repo, 'rev-parse', 'HEAD'));
    assert.throws(() => manager.assertBuilt('rvi-one'), /Refresh/);
    await manager.close('rvi-one');
    f.db.prepare("UPDATE symphony_proposals SET state = 'accepted' WHERE attempt_id = 'att-rvi-one'").run();
    const retiredAt = Date.now(); await manager.sweep(retiredAt);
    assert.equal(manager.status('rvi-one').status, 'stopped', 'closed artifacts retain their grace period');
    await manager.sweep(retiredAt + 8 * 24 * 60 * 60 * 1000);
    assert.equal(manager.status('rvi-one').status, 'retired');
    assert.equal(manager.status('rvi-two').status, 'running', 'cleanup does not retire another open review');
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM layer_review_integrations WHERE id = 'rvi-one'").get().n, 1, 'source identity survives artifact cleanup');
  } finally {
    manager.stopAll(); bridge.closeAllConnections(); await new Promise(resolve => bridge.close(resolve));
    for (const id of ['rvi-one', 'rvi-two', 'rvi-three']) spawnSync('docker', ['image', 'rm', previewImageName(join(f.root, 'review-workspaces'), 'review', id)], { stdio: 'ignore' });
    f.db.close(); rmSync(f.root, { recursive: true, force: true });
  }
});
