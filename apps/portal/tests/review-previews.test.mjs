import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { reviewPreviews, reviewRecipe, localReviewPath } from '../server/review-previews.mjs';
import { initLayerSource } from '../server/layer-source.mjs';
import { previewImageName } from '../server/previews.mjs';

const dockerReady = spawnSync('docker', ['info'], { stdio: 'ignore', timeout: 5000 }).status === 0;
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
const recipe = { version: 1, checks: [{ name: 'Real app test', command: ['node', '--test', 'tests/app.test.mjs'] }], scenarios: [
  { id: 'edit', criterion: 0, label: 'Review the editor', expected: 'Edit the seeded record as an author.', path: '/posts/demo/edit', fixture: 'post-v1', role: 'author' },
  { id: 'save', criterion: 0, label: 'Review save', expected: 'The saved post appears.', path: '/posts/demo', fixture: 'post-v1', role: 'author', after: 'edit' },
  { id: 'view', criterion: 1, label: 'Review viewer permissions', expected: 'The viewer cannot edit.', path: '/posts/demo?mode=view', fixture: 'post-v1', role: 'viewer' }
] };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aludel-review-preview-')), repo = join(root, 'repo'); mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main'); git(repo, 'config', 'user.name', 'Fixture'); git(repo, 'config', 'user.email', 'fixture@example.invalid');
  const db = new DatabaseSync(join(root, 'db.sqlite'));
  initLayerSource(db);
  db.exec(`CREATE TABLE layer_instances (project_id TEXT, layer_key TEXT, instance_id TEXT); CREATE TABLE layer_package_bindings (project_id TEXT, layer_key TEXT, layer_instance_id TEXT, repository_path TEXT, accepted_commit TEXT); CREATE TABLE symphony_proposals (attempt_id TEXT, state TEXT)`);
  mkdirSync(join(repo, '.aludel')); mkdirSync(join(repo, 'server')); mkdirSync(join(repo, 'tests'));
  writeFileSync(join(repo, '.aludel/review.json'), JSON.stringify(recipe));
  writeFileSync(join(repo, 'tests/app.test.mjs'), "import test from 'node:test'; import assert from 'node:assert/strict'; test('post identity',()=>assert.equal('demo'.length,4));\n");
  writeFileSync(join(repo, 'Dockerfile'), 'FROM node:24-bookworm-slim\nWORKDIR /app\nCOPY . .\nUSER node\nCMD ["node","server/server.mjs"]\n');
  writeFileSync(join(repo, 'server/server.mjs'), `import {createServer} from 'node:http';
createServer(async(req,res)=>{
  if(req.url==='/api/health')return res.end('ok');
  if(req.url==='/api/__aludel/review'){
    if(req.headers.authorization!=='Bearer '+process.env.ALUDEL_REVIEW_TOKEN){res.writeHead(404);return res.end();}
    let text='';for await(const part of req)text+=part;
    const {scenario}=JSON.parse(text);res.setHeader('set-cookie','demo_role='+(scenario==='view'?'viewer':'author')+'; HttpOnly; SameSite=Lax; Path=/');return res.end('{}');
  }
  res.setHeader('content-type','text/html');res.end('<h1>'+req.url+'</h1><p>'+String(req.headers.cookie||'anonymous')+'</p>');
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

test('review destinations and recipe checks reject cross-origin navigation and malformed scenarios', () => {
  for (const path of ['//evil.invalid', '/\\evil.invalid', '/%2fevil', '/ok\r\nLocation: evil', '/\t/evil.invalid', 'https://evil.invalid']) assert.equal(localReviewPath(path), false);
  assert.equal(localReviewPath('/posts/demo?edit=1#form'), true);
  const f = fixture();
  try {
    assert.equal(reviewRecipe(f.repo, f.commit).scenarios.length, 3);
    writeFileSync(join(f.repo, '.aludel/review.json'), JSON.stringify({ ...recipe, scenarios: [{ ...recipe.scenarios[0], path: '//evil.invalid' }] }));
    git(f.repo, 'add', '.'); git(f.repo, 'commit', '-qm', 'Bad destination');
    assert.throws(() => reviewRecipe(f.repo, git(f.repo, 'rev-parse', 'HEAD')), /local path/);
  } finally { f.db.close(); rmSync(f.root, { recursive: true, force: true }); }
});

test('combined previews retain image identity, isolate scenarios, cap runtime, restart, reject stale bases and retire only closed artifacts', { skip: !dockerReady && 'Docker unavailable', timeout: 180000 }, async () => {
  const f = fixture(); const manager = reviewPreviews({ db: f.db, portalRoot: new URL('..', import.meta.url).pathname, dataDirectory: f.root, appOrigin: host => `http://${host}`, maxRunning: 2 });
  const bridge = createServer(async (req, res) => { try { await manager.serve('rvi-one', req, res); } catch (error) { res.writeHead(error.status || 500); res.end(error.message); } });
  await new Promise(resolve => bridge.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${bridge.address().port}`;
  try {
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM layer_review_integrations').get().n, 10);
    assert.equal(manager.status('rvi-10').status, 'not-built', 'ten waiting reviews do not prebuild images');
    const one = await manager.build('rvi-one');
    assert.equal(one.commit, f.commit); assert.equal(one.status, 'running'); assert.ok(one.checks.every(check => check.status === 'passed'));
    assert.match(one.imageDigest, /^sha256:[a-f0-9]{64}$/);
    await assert.rejects(manager.openStep('rvi-one', 'save'), /preceding/);
    const step = await manager.openStep('rvi-one', 'edit');
    const response = await fetch(origin + new URL(step.url).pathname, { redirect: 'manual' });
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/posts/demo/edit');
    assert.match(response.headers.get('set-cookie'), /demo_role=author/);
    assert.equal((await fetch(origin + new URL(step.url).pathname, { redirect: 'manual' })).status, 410, 'step tickets are one use');
    await manager.openStep('rvi-one', 'save');
    const viewer = await manager.openStep('rvi-one', 'view');
    const viewerResponse = await fetch(origin + new URL(viewer.url).pathname, { redirect: 'manual' });
    assert.match(viewerResponse.headers.get('set-cookie'), /demo_role=viewer/);
    assert.equal((await fetch(origin + '/api/__aludel/review', { method: 'POST' })).status, 403);
    const two = await manager.build('rvi-two');
    await assert.rejects(manager.build('rvi-three'), /Two previews/);
    await manager.close('rvi-one');
    const restarted = await manager.build('rvi-one'); assert.equal(restarted.imageDigest, one.imageDigest);
    assert.equal(restarted.checkedAt, one.checkedAt);
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
