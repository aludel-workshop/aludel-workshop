// Repository-defined, revision-bound review scenarios. No project credentials or portal cookies enter a preview.
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { previewManager, previewImageName } from './previews.mjs';
import { layerBinding } from './layer-source.mjs';

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] });
export const reviewHost = id => `review-${createHash('sha256').update(id).digest('hex').slice(0, 12)}`;
export const localReviewPath = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\x00-\x20\x7f]/.test(value) && !/%(?:2f|5c|0[ad])/i.test(value) && value.length <= 1000;

export function reviewRecipe(repo, commit) {
  let text;
  try { text = git(repo, 'show', `${commit}:.aludel/review.json`); } catch { return null; }
  if (text.length > 64000) fail('The review recipe is too large.');
  let recipe;
  try { recipe = JSON.parse(text); } catch { fail('The review recipe is not valid JSON.'); }
  if (recipe.version !== 1 || !Array.isArray(recipe.scenarios) || recipe.scenarios.length > 40 || !Array.isArray(recipe.checks) || !recipe.checks.length || recipe.checks.length > 10)
    fail('Review recipes need version 1, checks and up to forty scenarios.');
  if (recipe.buildTarget !== undefined && !/^[a-z][a-z0-9-]{0,63}$/.test(recipe.buildTarget)) fail('Invalid review check build target.');
  const ids = new Set();
  for (const step of recipe.scenarios) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(step.id || '') || ids.has(step.id) || !Number.isInteger(step.criterion) || step.criterion < 0 || step.criterion > 39 ||
        typeof step.label !== 'string' || !step.label.trim() || step.label.length > 200 || typeof step.expected !== 'string' || !step.expected.trim() || step.expected.length > 1000 ||
        !localReviewPath(step.path) || typeof step.fixture !== 'string' || !step.fixture.trim() || step.fixture.length > 100 || typeof step.role !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(step.role) ||
        step.after !== undefined && (!ids.has(step.after))) fail('A review scenario needs a unique ID, criterion, label, expected result, fixture, role, local path and an earlier prerequisite if ordered.');
    ids.add(step.id);
  }
  for (const check of recipe.checks) if (!check || typeof check.name !== 'string' || !check.name.trim() || check.name.length > 120 || !Array.isArray(check.command) || !check.command.length || check.command.length > 30 ||
      !check.command.every(arg => typeof arg === 'string' && arg.length <= 300 && !/[\x00\r\n]/.test(arg))) fail('Review checks need a name and an argument array.');
  return recipe;
}

export function reviewPreviews({ db, portalRoot, dataDirectory, appOrigin, docker = 'docker', idleMs = 10 * 60 * 1000, maxRunning = 2, retentionMs = 7 * 24 * 60 * 60 * 1000 }) {
  const root = join(dataDirectory, 'review-workspaces'), tokens = new Map(), activity = new Map(), tickets = new Map(), visits = new Map(), pending = new Map();
  let buildTail = Promise.resolve(), sweeping = false;
  mkdirSync(root, { recursive: true });
  db.exec(`CREATE TABLE IF NOT EXISTS layer_review_builds (integration_id TEXT PRIMARY KEY REFERENCES layer_review_integrations(id), commit_sha TEXT NOT NULL, image_digest TEXT NOT NULL, checks_json TEXT NOT NULL, checked_at TEXT NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS layer_review_retention (integration_id TEXT PRIMARY KEY REFERENCES layer_review_integrations(id), eligible_at TEXT NOT NULL)`);
  const checkTag = id => `${previewImageName(root, 'review', id)}-checks`;
  const tokenFor = id => { if (!tokens.has(id)) tokens.set(id, randomBytes(32).toString('base64url')); return tokens.get(id); };
  const runtime = previewManager({ db, portalRoot, workspaceRoot: root, logRoot: join(dataDirectory, 'review-logs'), dataRoot: join(dataDirectory, 'review-data'), kind: 'review', runtime: 'docker', docker,
    extraEnvironment: id => ({ ALUDEL_REVIEW_PREVIEW: '1', ALUDEL_REVIEW_TOKEN: tokenFor(id) }) });
  function record(id) { return db.prepare('SELECT * FROM layer_review_integrations WHERE id = ?').get(id) || fail('Review candidate not found.', 404); }
  function current(row) {
    const binding = layerBinding(db, row.project_id, row.layer_key);
    if (binding.commit !== row.base_commit || git(binding.repo, 'rev-parse', 'main').trim() !== row.base_commit) fail('The accepted repository changed. Refresh this review against latest.');
    return binding;
  }
  function status(id) {
    const row = record(id), binding = layerBinding(db, row.project_id, row.layer_key);
    const recipe = reviewRecipe(binding.repo, row.commit_sha);
    const build = db.prepare('SELECT * FROM layer_review_builds WHERE integration_id = ?').get(id);
    return { ...runtime.status(id), url: appOrigin(reviewHost(id)), scenarios: recipe?.scenarios || [], fixtureCommit: row.commit_sha,
      checks: build ? JSON.parse(build.checks_json) : [], checkedAt: build?.checked_at || null, available: Boolean(recipe), reason: recipe ? null : 'This app has no .aludel/review.json scenario and check recipe.' };
  }
  async function room(id) {
    if (!activity.has(id) && activity.size >= maxRunning) fail('Two previews are already open. Close one before opening another.');
    activity.set(id, Date.now());
  }
  async function build(id) {
    if (pending.has(id)) return pending.get(id);
    const job = buildTail.then(async () => {
      const row = record(id), { repo } = current(row), recipe = reviewRecipe(repo, row.commit_sha);
      if (!recipe) return status(id);
      await room(id);
      const workspace = join(root, id);
      let cached = db.prepare('SELECT * FROM layer_review_builds WHERE integration_id = ?').get(id);
      if (cached && cached.commit_sha === row.commit_sha && !JSON.parse(cached.checks_json).some(check => check.status !== 'passed')) {
        const port = await runtime.ensureRunning(id, workspace);
        if (port) return status(id);
        fail('The reviewed build expired or cannot restart. Rebuild it as new evidence.');
      }
      rmSync(workspace, { recursive: true, force: true });
      if (git(repo, 'ls-tree', '-r', row.commit_sha).split('\n').some(line => /^(120000|160000) /.test(line))) fail('Review snapshots cannot contain symlinks or submodules.');
      execFileSync('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', '--', repo, workspace], { timeout: 30000, stdio: 'pipe' });
      git(workspace, 'checkout', '--detach', row.commit_sha);
      rmSync(join(workspace, '.git'), { recursive: true, force: true }); // Build only the pinned files, without other submissions or Git credentials.
      if (!existsSync(join(workspace, 'Dockerfile'))) fail('This app has no Dockerfile for a review preview.');
      const preview = await runtime.build(id, workspace, row.commit_sha);
      const checks = [{ name: 'Exact combined image build and health', status: preview.status === 'running' ? 'passed' : 'failed', source: 'aludel', detail: row.commit_sha }];
      let checkImage = preview.imageDigest;
      if (preview.status === 'running' && recipe.buildTarget) {
        const tag = checkTag(id);
        try {
          execFileSync(docker, ['build', '--target', recipe.buildTarget, '--tag', tag, workspace], { timeout: 120000, stdio: 'pipe', maxBuffer: 1024 * 1024 });
          checkImage = execFileSync(docker, ['image', 'inspect', '--format', '{{.Id}}', tag], { encoding: 'utf8', timeout: 30000 }).trim();
        } catch { checks.push({ name: 'Review check environment', status: 'failed', source: 'aludel', detail: 'The app-defined check target did not build.' }); checkImage = null; }
      }
      if (preview.status === 'running' && checkImage) for (const check of recipe.checks) {
        const container = `aludel-review-check-${randomBytes(12).toString('hex')}`;
        try {
          execFileSync(docker, ['run', '--rm', '--name', container, '--network', 'none', '--memory', '256m', '--memory-swap', '256m', '--cpus', '0.5', '--pids-limit', '64', '--read-only', '--tmpfs', '/tmp:size=16m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--entrypoint', check.command[0], checkImage, ...check.command.slice(1)],
            { timeout: 120000, stdio: 'pipe', maxBuffer: 1024 * 1024 });
          checks.push({ name: check.name, status: 'passed', source: 'aludel', detail: `Run in an isolated container at ${checkImage}.` });
        } catch { checks.push({ name: check.name, status: 'failed', source: 'aludel', detail: 'The combined-image check failed or exceeded its time/output limit.' }); }
        finally { try { execFileSync(docker, ['rm', '-f', container], { timeout: 10000, stdio: 'ignore' }); } catch { /* already removed */ } }
      }
      if (preview.imageDigest) db.prepare('INSERT OR REPLACE INTO layer_review_builds VALUES (?, ?, ?, ?, ?)').run(id, row.commit_sha, preview.imageDigest, JSON.stringify(checks), new Date().toISOString());
      current(row);
      return status(id);
    }).catch(async error => { await runtime.stop(id); activity.delete(id); throw error; }).finally(() => pending.delete(id));
    buildTail = job.catch(() => {});
    pending.set(id, job); return job;
  }
  function assertBuilt(id) {
    const row = record(id); current(row);
    const recipe = reviewRecipe(layerBinding(db, row.project_id, row.layer_key).repo, row.commit_sha);
    if (!recipe) fail('This runnable change needs a review recipe before acceptance.');
    const build = db.prepare('SELECT * FROM layer_review_builds WHERE integration_id = ?').get(id);
    if (!build || build.commit_sha !== row.commit_sha || build.image_digest !== runtime.status(id).imageDigest || JSON.parse(build.checks_json).some(check => check.status !== 'passed')) fail('Build and pass the combined preview checks before acceptance.');
  }
  async function openStep(id, stepId) {
    assertBuilt(id);
    const value = await build(id), step = value.scenarios.find(step => step.id === stepId);
    if (!step) fail('Review step not found.', 404);
    if (step.after && !visits.get(id)?.has(step.after)) fail('Open the preceding review step first.');
    const ticket = randomBytes(32).toString('base64url');
    tickets.set(ticket, { id, step, expires: Date.now() + 60000 });
    return { url: `${value.url}/__aludel/review-step/${ticket}`, expected: step.expected };
  }
  async function enterStep(id, ticket, response) {
    const grant = tickets.get(ticket); tickets.delete(ticket);
    if (!grant || grant.id !== id || grant.expires < Date.now()) fail('This review step link expired. Open the step again.', 410);
    assertBuilt(id);
    const port = await runtime.ensureRunning(id, join(root, id));
    if (!port) fail('The preview could not start.');
    const result = await fetch(`http://127.0.0.1:${port}/api/__aludel/review`, { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${tokenFor(id)}` },
      body: JSON.stringify({ scenario: grant.step.id, reset: !grant.step.after }), signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!result.ok) fail('The app could not prepare this review scenario. Its preview adapter may be missing or failed.');
    // Copy only host-only app cookies, never an app-supplied Domain or other response headers.
    const cookies = result.headers.getSetCookie();
    if (cookies.some(cookie => /(?:^|;)\s*domain\s*=/i.test(cookie))) fail('Review sessions must use host-only cookies.');
    if (!visits.has(id) || !grant.step.after) visits.set(id, new Set());
    visits.get(id).add(grant.step.id); activity.set(id, Date.now());
    response.writeHead(303, { location: grant.step.path, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...(cookies.length ? { 'set-cookie': cookies } : {}) }); response.end();
  }
  async function close(id) { if (pending.has(id)) fail('This preview is still preparing.'); await runtime.stop(id); activity.delete(id); }
  function openSubmission(row) {
    if (String(row.attempt_id).startsWith('person-run-')) {
      const person = db.prepare('SELECT state FROM work_person_runs WHERE id = ?').get(row.attempt_id);
      return person?.state === 'review';
    }
    return db.prepare('SELECT state FROM symphony_proposals WHERE attempt_id = ?').get(row.attempt_id)?.state === 'submitted';
  }
  async function retire(id) {
    const row = record(id);
    const open = openSubmission(row);
    const latest = db.prepare('SELECT id FROM layer_review_integrations WHERE attempt_id = ? ORDER BY rowid DESC LIMIT 1').get(row.attempt_id);
    if (open && latest?.id === id) fail('An open review keeps its artifact until it is closed or superseded.');
    if (activity.has(id) || pending.has(id)) fail('Close this preview before retiring its artifact.');
    await runtime.retire(id);
    try { execFileSync(docker, ['image', 'rm', checkTag(id)], { timeout: 30000, stdio: 'ignore' }); } catch { /* a check image may never have been built */ }
    rmSync(join(root, id), { recursive: true, force: true });
    rmSync(join(dataDirectory, 'review-data', id), { recursive: true, force: true });
    rmSync(join(dataDirectory, 'review-logs', `${id}.log`), { force: true });
    tokens.delete(id); visits.delete(id);
  }
  async function sweep(at = Date.now()) {
    if (sweeping) return; sweeping = true;
    try {
      for (const row of db.prepare('SELECT * FROM layer_review_integrations').all()) {
        const open = openSubmission(row);
        const latest = db.prepare('SELECT id FROM layer_review_integrations WHERE attempt_id = ? ORDER BY rowid DESC LIMIT 1').get(row.attempt_id);
        if (open && latest?.id === row.id) continue;
        if (activity.has(row.id) && !pending.has(row.id)) await close(row.id);
        if (runtime.status(row.id).status === 'retired') continue;
        db.prepare('INSERT OR IGNORE INTO layer_review_retention VALUES (?, ?)').run(row.id, new Date(at).toISOString());
        const eligible = db.prepare('SELECT eligible_at FROM layer_review_retention WHERE integration_id = ?').get(row.id);
        if (at - Date.parse(eligible.eligible_at) >= retentionMs && !activity.has(row.id) && !pending.has(row.id)) await retire(row.id);
      }
    } finally { sweeping = false; }
  }
  async function stopIdle(at = Date.now()) {
    for (const [id, last] of activity) if (!pending.has(id) && at - last > idleMs) await close(id);
  }
  const timer = setInterval(() => {
    void stopIdle().catch(() => {});
    for (const [ticket, grant] of tickets) if (grant.expires < Date.now()) tickets.delete(ticket);
    void sweep().catch(() => {}); // Failed scoped cleanup retries; no global Docker pruning.
  }, Math.min(idleMs, 30000)); timer.unref();
  return { status, build, retire, sweep, stopIdle, assertBuilt, openStep, enterStep, close, async serve(id, request, response) {
    const row = record(id); current(row); await room(id);
    const match = /^\/__aludel\/review-step\/([a-zA-Z0-9_-]+)$/.exec(new URL(request.url, 'http://preview.local').pathname);
    if (match) { if (request.method !== 'GET') fail('Method not allowed.', 405); return enterStep(id, match[1], response); }
    if (new URL(request.url, 'http://preview.local').pathname.startsWith('/api/__aludel/')) fail('Review setup is only available through a review step.', 403);
    const port = await runtime.ensureRunning(id, join(root, id)); if (!port) fail('Open this preview from its review first.');
    activity.set(id, Date.now()); return runtime.proxy(request, response, port, id);
  }, stopAll() { clearInterval(timer); runtime.stopAll(); } };
}
