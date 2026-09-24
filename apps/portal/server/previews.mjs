// Local previews for generated projects (DEC-033): build the app, run its own server on a private loopback port,
// and reverse-proxy <slug>.<base> to it. Generated code here comes from the deterministic preset, not an agent;
// agent-modified code needs the isolated workspace boundary (B-03B).
// PLATFORM-PIPELINE-01: with the 'docker' runtime each app builds from its own Dockerfile and dependencies and runs in
// one container under the host's limits, the same way it would run anywhere else. The 'process' runtime (the preset
// toolchain and a child process) remains for machines without Docker and for the test suite.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, symlinkSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { join } from 'node:path';

const now = () => new Date().toISOString();
const freePort = () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolvePort(port)); });
});

// The host's guards for every preview container (work record §7-§8). The app never sets its own limits.
export const containerLimits = { memory: '256m', cpus: '0.5', pids: 64, tmp: '16m' };
const containerPort = 3000;

// Docker is used when its daemon answers; MACHINE_PREVIEW_RUNTIME=process|docker overrides the check.
export function previewRuntime(environment = process.env, docker = 'docker') {
  const chosen = environment.MACHINE_PREVIEW_RUNTIME;
  if (chosen === 'process' || chosen === 'docker') return chosen;
  return spawnSync(docker, ['info', '--format', '{{.ServerVersion}}'], { stdio: 'ignore', timeout: 5000 }).status === 0 ? 'docker' : 'process';
}

export function previewManager({ db, portalRoot, workspaceRoot, logRoot, runtime = 'process', docker = 'docker', limits = containerLimits }) {
  db.exec(`CREATE TABLE IF NOT EXISTS app_previews (
    project_id TEXT PRIMARY KEY REFERENCES projects(id), status TEXT NOT NULL, commit_sha TEXT, port INTEGER,
    last_error TEXT, built_at TEXT, updated_at TEXT NOT NULL
  )`);
  // Nothing survives a portal restart: previews come back on demand from their last build.
  db.prepare("UPDATE app_previews SET status = CASE WHEN built_at IS NULL THEN 'failed' ELSE 'stopped' END, port = NULL WHERE status IN ('building', 'starting', 'running')").run();
  mkdirSync(workspaceRoot, { recursive: true });
  mkdirSync(logRoot, { recursive: true });
  // Process runtime: workspaces resolve the preset's packages through this parent link, so nothing is linked inside a
  // project repository. Containers install each app's own dependencies instead.
  const sharedModules = join(workspaceRoot, 'node_modules');
  if (runtime === 'process' && !existsSync(sharedModules)) symlinkSync(join(portalRoot, 'node_modules'), sharedModules, 'dir');
  // Containers carry the portal instance they belong to, so a second portal (tests, another checkout) never touches them.
  const instance = createHash('sha256').update(workspaceRoot).digest('hex').slice(0, 12);
  const containerName = projectId => `aludel-${instance}-${projectId}`;
  const imageName = projectId => `aludel-preview/${projectId}`;
  const dockerSync = args => spawnSync(docker, args, { encoding: 'utf8', timeout: 30000 });
  // Like child processes, containers don't outlive the portal: previews come back on demand from their last image.
  if (runtime === 'docker') {
    const stale = dockerSync(['ps', '-aq', '--filter', `label=aludel.preview=${instance}`]).stdout?.trim().split('\n').filter(Boolean) || [];
    if (stale.length) dockerSync(['rm', '-f', ...stale]);
  }
  // projectId → the running child process, or { container } for the docker runtime.
  const processes = new Map();
  const pending = new Map();

  const row = projectId => db.prepare('SELECT * FROM app_previews WHERE project_id = ?').get(projectId);
  const logPath = projectId => join(logRoot, `${projectId}.log`);
  function update(projectId, values) {
    const current = row(projectId);
    const next = { status: 'stopped', commit_sha: null, port: null, last_error: null, built_at: null, ...current, ...values, updated_at: now() };
    db.prepare(`INSERT INTO app_previews(project_id, status, commit_sha, port, last_error, built_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET status=excluded.status, commit_sha=excluded.commit_sha, port=excluded.port,
      last_error=excluded.last_error, built_at=excluded.built_at, updated_at=excluded.updated_at`)
      .run(projectId, next.status, next.commit_sha, next.port, next.last_error, next.built_at, next.updated_at);
  }

  function run(command, args, options, log) {
    return new Promise((resolveRun, reject) => {
      const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolveRun() : reject(new Error(`The build exited with code ${code}. See the build log.`)));
    });
  }

  async function waitForHealth(port, stopped) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (stopped()) throw new Error('The app server stopped during start-up. See the build log.');
      const healthy = await new Promise(resolveHealth => {
        const probe = httpRequest({ host: '127.0.0.1', port, path: '/api/health', timeout: 500 }, response => { response.resume(); resolveHealth(response.statusCode === 200); });
        probe.on('error', () => resolveHealth(false)); probe.on('timeout', () => { probe.destroy(); resolveHealth(false); });
        probe.end();
      });
      if (healthy) return;
      await new Promise(resolveWait => setTimeout(resolveWait, 100));
    }
    throw new Error('The app server did not become healthy within 10 seconds.');
  }

  async function startContainer(projectId, workspacePath) {
    stop(projectId);
    const name = containerName(projectId);
    dockerSync(['rm', '-f', name]);
    update(projectId, { status: 'starting', port: null, last_error: null });
    // Locally the data folder is a bind mount of the workspace's .data, so backups, restore and the Database view
    // read the same file the process runtime used. A server would use a named volume.
    const dataDirectory = join(workspacePath, '.data');
    mkdirSync(dataDirectory, { recursive: true });
    const log = createWriteStream(logPath(projectId), { flags: 'a' });
    const run = dockerSync(['run', '-d', '--name', name, '--label', `aludel.preview=${instance}`, '--label', `aludel.project=${projectId}`,
      '--memory', limits.memory, '--memory-swap', limits.memory, '--cpus', limits.cpus, '--pids-limit', String(limits.pids),
      '--read-only', '--tmpfs', `/tmp:size=${limits.tmp}`, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--env', `PORT=${containerPort}`, '--env', 'HOST=0.0.0.0', '--env', 'DATA_DIR=/data',
      '--volume', `${dataDirectory}:/data`, '--publish', `127.0.0.1::${containerPort}`, imageName(projectId)]);
    if (run.status !== 0) {
      log.end(`[${now()}] container did not start: ${run.stderr}\n`);
      update(projectId, { status: 'failed', last_error: 'The app container did not start. See the build log.' });
      throw new Error('The app container did not start.');
    }
    processes.set(projectId, { container: name });
    // The published port is chosen by Docker and changes on every start, so it's read back each time.
    const port = Number(/:(\d+)\s*$/m.exec(dockerSync(['port', name, `${containerPort}/tcp`]).stdout || '')?.[1]);
    log.end(`[${now()}] started container ${name} on 127.0.0.1:${port} (memory ${limits.memory}, cpus ${limits.cpus}, pids ${limits.pids})\n`);
    const running = () => dockerSync(['inspect', '-f', '{{.State.Running}}', name]).stdout?.trim() === 'true';
    try {
      if (!port) throw new Error('Docker did not publish the app port.');
      await waitForHealth(port, () => !running());
      update(projectId, { status: 'running', port });
    } catch (error) {
      const logs = dockerSync(['logs', '--tail', '50', name]);
      createWriteStream(logPath(projectId), { flags: 'a' }).end(`${logs.stdout || ''}${logs.stderr || ''}`);
      stop(projectId);
      update(projectId, { status: 'failed', port: null, last_error: error.message });
      throw error;
    }
  }

  async function start(projectId, workspacePath) {
    if (runtime === 'docker') return startContainer(projectId, workspacePath);
    stop(projectId);
    const port = await freePort();
    update(projectId, { status: 'starting', port: null, last_error: null });
    const log = createWriteStream(logPath(projectId), { flags: 'a' });
    log.write(`\n[${now()}] starting preview server on 127.0.0.1:${port}\n`);
    const child = spawn(process.execPath, ['server/server.mjs'], {
      cwd: workspacePath, stdio: ['ignore', 'pipe', 'pipe'],
      // The app gets only what it needs to run; portal secrets and configuration are not inherited.
      env: { PATH: process.env.PATH, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: join(workspacePath, '.data'), NODE_NO_WARNINGS: '1' }
    });
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    processes.set(projectId, child);
    child.on('exit', code => {
      if (processes.get(projectId) !== child) return;
      processes.delete(projectId);
      update(projectId, { status: code === 0 || code === null ? 'stopped' : 'failed', port: null, last_error: code ? `The app server exited with code ${code}.` : null });
    });
    try {
      await waitForHealth(port, () => child.exitCode !== null);
      update(projectId, { status: 'running', port });
    } catch (error) {
      child.kill();
      update(projectId, { status: 'failed', port: null, last_error: error.message });
      throw error;
    }
  }

  function stop(projectId) {
    const child = processes.get(projectId);
    if (!child) return;
    processes.delete(projectId);
    if (child.container) dockerSync(['rm', '-f', child.container]);
    else child.kill();
  }

  const api = {
    status(projectId) {
      const value = row(projectId);
      if (!value) return { status: 'not-built', running: false };
      let log = '';
      try {
        const path = logPath(projectId);
        const size = statSync(path).size;
        log = readFileSync(path, 'utf8').slice(Math.max(0, size - 6000));
      } catch { /* No log yet. */ }
      return { status: value.status, commit: value.commit_sha, builtAt: value.built_at, error: value.last_error, running: processes.has(projectId) && value.status === 'running', log };
    },

    // Serialised per project: a second request while one build runs joins it rather than starting another.
    build(projectId, workspacePath, commit) {
      if (pending.has(projectId)) return pending.get(projectId);
      const job = (async () => {
        stop(projectId);
        update(projectId, { status: 'building', commit_sha: commit, last_error: null, port: null });
        const log = createWriteStream(logPath(projectId), { flags: 'w' });
        try {
          if (runtime === 'docker') {
            log.write(`[${now()}] building ${commit || 'workspace'} from the app's Dockerfile\n`);
            await run(docker, ['build', '--label', `aludel.preview=${instance}`, '--label', `aludel.project=${projectId}`, '--tag', imageName(projectId), workspacePath], { env: process.env }, log);
          } else {
            log.write(`[${now()}] building ${commit || 'workspace'} with the aludel-web-v1 toolchain\n`);
            await run(process.execPath, [join(portalRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: workspacePath, env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_NO_WARNINGS: '1' } }, log);
          }
          update(projectId, { built_at: now() });
          await start(projectId, workspacePath);
        } catch (error) {
          update(projectId, { status: 'failed', last_error: error.message });
        } finally { log.end(); pending.delete(projectId); }
        return api.status(projectId);
      })();
      pending.set(projectId, job);
      return job;
    },

    async ensureRunning(projectId, workspacePath) {
      const value = row(projectId);
      if (processes.has(projectId) && value?.status === 'running') return value.port;
      if (pending.has(projectId)) { await pending.get(projectId); return row(projectId)?.port || null; }
      const built = runtime === 'docker' ? dockerSync(['image', 'inspect', '--format', '{{.Id}}', imageName(projectId)]).status === 0
        : existsSync(join(workspacePath, 'dist', 'index.html'));
      if (!value?.built_at || !built) return null;
      if (!pending.has(`start:${projectId}`)) pending.set(`start:${projectId}`, start(projectId, workspacePath).finally(() => pending.delete(`start:${projectId}`)));
      try { await pending.get(`start:${projectId}`); } catch { return null; }
      return row(projectId)?.port || null;
    },

    // A failed connection forgets the preview, so the next request starts it again (a container can stop on its own).
    proxy(request, response, port, projectId = null) {
      const upstream = httpRequest({ host: '127.0.0.1', port, method: request.method, path: request.url,
        headers: { ...request.headers, 'x-forwarded-host': request.headers.host, 'x-forwarded-proto': 'http' } }, upstreamResponse => {
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      });
      upstream.on('error', () => {
        if (projectId && processes.get(projectId)?.container) { stop(projectId); update(projectId, { status: 'stopped', port: null }); }
        if (!response.headersSent) { response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }); response.end('The app preview is not responding.'); }
        else response.end();
      });
      request.pipe(upstream);
    },

    // Stops the preview and waits for it to exit, so its database file can be replaced safely.
    async stop(projectId) {
      const child = processes.get(projectId);
      if (!child) return;
      if (child.container) return stop(projectId);
      const exited = new Promise(resolveExit => child.once('exit', resolveExit));
      stop(projectId);
      await Promise.race([exited, new Promise(resolveWait => setTimeout(resolveWait, 3000))]);
    },

    // A live GET /api/health against the running preview, with its response time.
    async probe(projectId) {
      const value = row(projectId);
      if (!processes.has(projectId) || value?.status !== 'running' || !value.port) return { ok: false, status: null, ms: null, checkedAt: now() };
      const started = Date.now();
      const status = await new Promise(resolveProbe => {
        const probe = httpRequest({ host: '127.0.0.1', port: value.port, path: '/api/health', timeout: 2000 }, response => { response.resume(); resolveProbe(response.statusCode); });
        probe.on('error', () => resolveProbe(null)); probe.on('timeout', () => { probe.destroy(); resolveProbe(null); });
        probe.end();
      });
      return { ok: status === 200, status, ms: Date.now() - started, checkedAt: now() };
    },

    runtime,
    stopAll() { for (const projectId of [...processes.keys()]) stop(projectId); }
  };
  return api;
}
