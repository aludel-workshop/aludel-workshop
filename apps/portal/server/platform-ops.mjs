// Platform operations for a project's local preview (LAY-07B, DEC-038): releases, the preview database and commits.
// Everything here is local and read-mostly. The database is opened read-only except for restore, which stops the
// preview and takes a fresh backup first. Columns that hold secrets are never returned, and queries cannot name them.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { backup as sqliteBackup, DatabaseSync } from 'node:sqlite';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
export const secretColumn = name => /hash|salt|token|secret|password/i.test(String(name || ''));
const rowLimit = 200;
const browseLimit = 50;

export function initPlatformOps(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS releases (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), number INTEGER NOT NULL, commit_sha TEXT, environment TEXT NOT NULL,
    state TEXT NOT NULL, checks_json TEXT NOT NULL, stories_json TEXT NOT NULL, backup TEXT, started_at TEXT NOT NULL, finished_at TEXT,
    UNIQUE(project_id, number)
  )`);
  // A portal restart interrupts any build in progress; its release did not finish.
  db.prepare("UPDATE releases SET state = 'failed', finished_at = ? WHERE state = 'building'").run(now());
}

export function platformOps({ db, backupRoot }) {
  const databasePath = workspace => join(workspace, '.data', 'app.sqlite');
  const backupDirectory = projectId => join(backupRoot, projectId);
  const open = workspace => {
    const path = databasePath(workspace);
    if (!existsSync(path)) return null;
    return new DatabaseSync(path, { readOnly: true });
  };
  const tableNames = connection => connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
  const quote = name => `"${String(name).replace(/"/g, '""')}"`;
  // Values in secret columns are dropped before they leave this module, not hidden in the UI.
  function rows(statement, params = []) {
    const columns = statement.columns();
    const masked = columns.map(column => secretColumn(column.name) || secretColumn(column.column));
    const out = [];
    for (const row of statement.iterate(...params)) {
      out.push(columns.map((column, index) => masked[index] ? null : row[column.name]));
      if (out.length >= rowLimit) break;
    }
    return { columns: columns.map(column => column.name), masked: columns.map(column => column.name).filter((_, index) => masked[index]), rows: out };
  }

  // ---- Releases: one per preview build ----
  const releaseRow = row => row && { id: row.id, number: row.number, commit: row.commit_sha, environment: row.environment, state: row.state, checks: parse(row.checks_json, []),
    stories: parse(row.stories_json, []), backup: row.backup, startedAt: row.started_at, finishedAt: row.finished_at };
  const releases = {
    start(projectId, { commit, stories = [], backup = null }) {
      const number = (db.prepare('SELECT MAX(number) AS max FROM releases WHERE project_id = ?').get(projectId)?.max || 0) + 1;
      const id = `rel-${projectId.slice(0, 8)}-${number}`;
      db.prepare('INSERT INTO releases(id, project_id, number, commit_sha, environment, state, checks_json, stories_json, backup, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, projectId, number, commit || null, 'preview', 'building', JSON.stringify([{ name: 'Build', state: 'running' }, { name: 'Health check', state: 'waiting' }]), JSON.stringify(stories), backup, now());
      return releaseRow(db.prepare('SELECT * FROM releases WHERE id = ?').get(id));
    },
    // The preview result decides the checks: built during this release, then healthy (running) or not.
    finish(id, preview) {
      const release = releaseRow(db.prepare('SELECT * FROM releases WHERE id = ?').get(id));
      if (!release) return null;
      const healthy = preview?.status === 'running';
      const built = healthy || Boolean(preview?.builtAt && preview.builtAt >= release.startedAt);
      const checks = [{ name: 'Build', state: built ? 'passed' : 'failed' }, { name: 'Health check', state: healthy ? 'passed' : built ? 'failed' : 'skipped' }];
      db.prepare('UPDATE releases SET state = ?, checks_json = ?, finished_at = ? WHERE id = ?').run(healthy ? 'passed' : 'failed', JSON.stringify(checks), now(), id);
      return releaseRow(db.prepare('SELECT * FROM releases WHERE id = ?').get(id));
    },
    list: projectId => db.prepare('SELECT * FROM releases WHERE project_id = ? ORDER BY number DESC LIMIT 30').all(projectId).map(releaseRow)
  };

  // ---- Database (the preview environment's SQLite file) ----
  function health(workspace) {
    const path = databasePath(workspace);
    const connection = open(workspace);
    if (!connection) return { exists: false, engine: 'SQLite', path: '.data/app.sqlite' };
    try {
      const integrity = connection.prepare('PRAGMA integrity_check').all().map(row => Object.values(row)[0]);
      const tables = tableNames(connection).map(name => ({ name, rows: connection.prepare(`SELECT COUNT(*) AS count FROM ${quote(name)}`).get().count }));
      return { exists: true, engine: 'SQLite', path: '.data/app.sqlite', size: statSync(path).size, integrity: integrity.length === 1 && integrity[0] === 'ok' ? 'ok' : integrity.slice(0, 5).join('; '), tables, checkedAt: now() };
    } finally { connection.close(); }
  }

  function schema(workspace) {
    const connection = open(workspace);
    if (!connection) return [];
    try { return connection.prepare("SELECT type, name, tbl_name AS tableName, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type DESC, name").all(); }
    finally { connection.close(); }
  }

  function browse(workspace, table) {
    const connection = open(workspace);
    if (!connection) fail('The preview has no database yet. It appears after the app first stores something.', 404);
    try {
      if (!tableNames(connection).includes(table)) fail('Unknown table.', 404);
      return { table, limit: browseLimit, ...rows(connection.prepare(`SELECT * FROM ${quote(table)} LIMIT ${browseLimit}`)) };
    } finally { connection.close(); }
  }

  // One SELECT, read-only connection, at most 200 rows, and no statement that names a secret column.
  function query(workspace, input) {
    const sql = String(input || '').trim().replace(/;\s*$/, '');
    if (!sql) fail('Write a SELECT query.');
    if (sql.length > 4000) fail('That query is too long.');
    if (sql.includes(';')) fail('Run one statement at a time.');
    if (!/^select\b/i.test(sql)) fail('Only SELECT queries run here. The database is opened read-only.');
    if (/[A-Za-z_]*(hash|salt|token|secret|password)[A-Za-z_]*/i.test(sql.replace(/'[^']*'/g, "''"))) fail('Queries cannot name secret columns (hashes, salts, tokens, passwords).');
    const connection = open(workspace);
    if (!connection) fail('The preview has no database yet.', 404);
    const started = process.hrtime.bigint();
    try {
      const result = rows(connection.prepare(sql));
      return { ...result, limit: rowLimit, truncated: result.rows.length >= rowLimit, ms: Number((process.hrtime.bigint() - started) / 1000000n) };
    } catch (error) {
      if (error.status) throw error;
      fail(`The database said: ${String(error.message || error).replace(/^.*?: /, '')}`);
    } finally { connection.close(); }
  }

  function listBackups(projectId) {
    const directory = backupDirectory(projectId);
    if (!existsSync(directory)) return [];
    return readdirSync(directory).filter(name => name.endsWith('.sqlite')).sort().reverse().map(name => {
      const [stamp, ...reason] = name.replace(/\.sqlite$/, '').split('--');
      return { name, at: stamp.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, '$1T$2:$3:$4.$5Z'), reason: reason.join('--').replace(/-/g, ' ') || 'manual', size: statSync(join(directory, name)).size };
    });
  }

  async function backup(projectId, workspace, reason = 'manual') {
    const source = databasePath(workspace);
    if (!existsSync(source)) return null;
    mkdirSync(backupDirectory(projectId), { recursive: true });
    const name = `${now().replace(/[:.]/g, '-')}--${String(reason).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'manual'}.sqlite`;
    const connection = new DatabaseSync(source, { readOnly: true });
    try { await sqliteBackup(connection, join(backupDirectory(projectId), name)); } finally { connection.close(); }
    return listBackups(projectId).find(item => item.name === name);
  }

  // Restore replaces the preview database. The caller stops the preview; a fresh backup is taken first.
  async function restore(projectId, workspace, name, { confirm, stopPreview }) {
    if (confirm !== true) fail('Confirm the restore first. It replaces the preview database.', 409);
    if (!/^[0-9TZ-]+--[a-z0-9-]+\.sqlite$/.test(String(name)) || !listBackups(projectId).some(item => item.name === name)) fail('Backup not found.', 404);
    const safety = await backup(projectId, workspace, 'before restore');
    await stopPreview();
    const target = databasePath(workspace);
    mkdirSync(join(workspace, '.data'), { recursive: true });
    for (const suffix of ['-wal', '-shm', '-journal']) rmSync(`${target}${suffix}`, { force: true });
    copyFileSync(join(backupDirectory(projectId), name), target);
    return { restored: name, safety: safety?.name || null };
  }

  // ---- Repository: commits with their work-item trailers ----
  function commits(workspace) {
    if (!existsSync(join(workspace, '.git'))) return { branches: [], commits: [] };
    const run = args => spawnSync('git', args, { cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const log = run(['log', '-n', '20', '--format=%h%x1f%s%x1f%cI%x1f%(trailers:key=Aludel-Work,valueonly,separator=%x2C)%x1f%(trailers:key=Implements,valueonly,separator=%x2C)%x1e']);
    const branches = run(['branch', '--format=%(refname:short)']);
    return {
      branches: branches.status === 0 ? branches.stdout.split('\n').map(item => item.trim()).filter(Boolean) : [],
      commits: log.status === 0 ? log.stdout.split('\x1e').map(item => item.trim()).filter(Boolean).map(item => {
        const [hash, subject, at, work, implementsRefs] = item.split('\x1f');
        return { hash, subject, at, work: work.trim() || null, implements: implementsRefs.trim() || null };
      }) : []
    };
  }

  return { releases, health, schema, browse, query, listBackups, backup, restore, commits };
}
