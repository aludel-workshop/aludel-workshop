import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const candidate = realpathSync(join(repository, '.data', 'machine.sqlite'));
const expected = resolve(repository, '.data', 'machine.sqlite');
if (candidate !== expected) throw new Error('LAT-01 fixture requires this candidate worktree database.');

const db = new DatabaseSync(candidate);
try {
  const stamp = '2026-09-28T00:00:00.000Z';
  db.prepare(`INSERT INTO owner_requests(id, project_id, body, status, created_at, updated_at)
    VALUES (?, 'the-machine', ?, 'draft', ?, ?)
    ON CONFLICT(id) DO NOTHING`)
    .run('lat01-isolation-fixture', 'LAT-01 isolated candidate fixture; no current portal write.', stamp, stamp);
  const row = db.prepare('SELECT id, project_id, status FROM owner_requests WHERE id = ?').get('lat01-isolation-fixture');
  if (row?.project_id !== 'the-machine' || row?.status !== 'draft') throw new Error('Fixture validation failed.');
  const workspace = join(repository, '.data', 'workspaces', 'lat01-preview');
  mkdirSync(join(workspace, 'server'), { recursive: true });
  mkdirSync(join(workspace, 'dist'), { recursive: true });
  writeFileSync(join(workspace, 'dist', 'index.html'), '<!doctype html><title>LAT-01 candidate preview</title><h1>Candidate preview</h1>\n');
  writeFileSync(join(workspace, 'server', 'server.mjs'), `import { createServer } from 'node:http';
createServer((request, response) => {
  if (request.url === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    return response.end(JSON.stringify({ ok: true }));
  }
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end('<!doctype html><title>LAT-01 candidate preview</title><h1>Candidate preview</h1>');
}).listen(Number(process.env.PORT), process.env.HOST);
`);
  db.prepare(`INSERT INTO projects(id, slug, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
    .run('lat01-preview', 'lat01-preview', 'LAT-01 Preview', 'Candidate-only preview fixture', stamp, stamp);
  db.prepare(`INSERT INTO project_setup(project_id, profile, workspace_path, created_at, updated_at)
    VALUES (?, 'planner', ?, ?, ?) ON CONFLICT(project_id) DO NOTHING`)
    .run('lat01-preview', workspace, stamp, stamp);
  db.prepare(`INSERT INTO app_previews(project_id, status, commit_sha, built_at, updated_at)
    VALUES (?, 'stopped', 'lat01-fixture', ?, ?) ON CONFLICT(project_id) DO NOTHING`)
    .run('lat01-preview', stamp, stamp);
  console.log(JSON.stringify({ request: row, preview: 'lat01-preview' }));
} finally {
  db.close();
}
