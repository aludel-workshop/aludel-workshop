// Local previews for generated projects (DEC-033): build with the preset toolchain, run the app's own server
// on a private loopback port, and reverse-proxy <slug>.<base> to it. Generated code here comes from the
// deterministic preset, not an agent; agent-modified code needs the isolated workspace boundary (B-03B).
import { spawn } from 'node:child_process';
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

export function previewManager({ db, portalRoot, workspaceRoot, logRoot }) {
  db.exec(`CREATE TABLE IF NOT EXISTS app_previews (
    project_id TEXT PRIMARY KEY REFERENCES projects(id), status TEXT NOT NULL, commit_sha TEXT, port INTEGER,
    last_error TEXT, built_at TEXT, updated_at TEXT NOT NULL
  )`);
  // Nothing survives a portal restart: previews come back on demand from their last build.
  db.prepare("UPDATE app_previews SET status = CASE WHEN built_at IS NULL THEN 'failed' ELSE 'stopped' END, port = NULL WHERE status IN ('building', 'starting', 'running')").run();
  mkdirSync(workspaceRoot, { recursive: true });
  mkdirSync(logRoot, { recursive: true });
  // Workspaces resolve the preset's packages through this parent link, so nothing is linked inside a project repository.
  const sharedModules = join(workspaceRoot, 'node_modules');
  if (!existsSync(sharedModules)) symlinkSync(join(portalRoot, 'node_modules'), sharedModules, 'dir');
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
      child.on('exit', code => code === 0 ? resolveRun() : reject(new Error(`${args.at(-1)} exited with code ${code}. See the build log.`)));
    });
  }

  async function waitForHealth(port, child) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error('The app server stopped during start-up. See the build log.');
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

  async function start(projectId, workspacePath) {
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
      await waitForHealth(port, child);
      update(projectId, { status: 'running', port });
    } catch (error) {
      child.kill();
      update(projectId, { status: 'failed', port: null, last_error: error.message });
      throw error;
    }
  }

  function stop(projectId) {
    const child = processes.get(projectId);
    if (child) { processes.delete(projectId); child.kill(); }
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
        log.write(`[${now()}] building ${commit || 'workspace'} with the aludel-web-v1 toolchain\n`);
        try {
          await run(process.execPath, [join(portalRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: workspacePath, env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_NO_WARNINGS: '1' } }, log);
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
      if (!value?.built_at || !existsSync(join(workspacePath, 'dist', 'index.html'))) return null;
      if (!pending.has(`start:${projectId}`)) pending.set(`start:${projectId}`, start(projectId, workspacePath).finally(() => pending.delete(`start:${projectId}`)));
      try { await pending.get(`start:${projectId}`); } catch { return null; }
      return row(projectId)?.port || null;
    },

    proxy(request, response, port) {
      const upstream = httpRequest({ host: '127.0.0.1', port, method: request.method, path: request.url,
        headers: { ...request.headers, 'x-forwarded-host': request.headers.host, 'x-forwarded-proto': 'http' } }, upstreamResponse => {
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      });
      upstream.on('error', () => {
        if (!response.headersSent) { response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }); response.end('The app preview is not responding.'); }
        else response.end();
      });
      request.pipe(upstream);
    },

    stopAll() { for (const projectId of [...processes.keys()]) stop(projectId); }
  };
  return api;
}
