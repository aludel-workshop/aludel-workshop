// Rehearse LAT-08 against current records in process memory only. The source is
// read-only. Credential tables are excluded, user password fields are scrubbed,
// and no source value or database image is written to disk or stdout.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { initLayerContract } from '../server/layer-contract.mjs';
import { initActionMigration, migrateActionProject } from '../server/lat08-migration.mjs';

const path = process.argv[2];
if (!path) { process.stderr.write('Usage: node tools/lat08-memory-rehearsal.mjs /path/to/source.sqlite\n'); process.exit(2); }
const source = new DatabaseSync(path, { readOnly: true });
source.exec('BEGIN'); // one consistent WAL snapshot while the running portal stays online
const target = new DatabaseSync(':memory:');
target.exec('PRAGMA foreign_keys = OFF');
const excluded = new Map([
  ['auth_config', 'owner credential hash'], ['sessions', 'browser session tokens'], ['login_tickets', 'login tokens'],
  ['editor_tokens', 'editor credentials'], ['editor_contexts', 'editor scoped context'],
  ['onboarding_drafts', 'unclaimed draft token hashes'], ['project_connections', 'encrypted integration credentials'],
  ['symphony_worker_tokens', 'worker credentials'], ['symphony_pools', 'worker pool credential hashes'],
  ['github_identities', 'provider identity and tokens'], ['github_installations', 'provider installation credentials'],
  ['github_sign_ins', 'provider sign-in state'], ['github_user_installations', 'provider installation mappings'],
  ['github_users', 'provider identity and tokens']
]);
const tables = source.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
const quoted = name => { if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Unexpected table name.'); return `"${name}"`; };
const tally = {};
const copy = [];
const digest = (db, table, columns) => {
  const hash = createHash('sha256');
  for (const row of db.prepare(`SELECT ${columns.map(quoted).join(',')} FROM ${quoted(table)} ORDER BY rowid`).all())
    hash.update(JSON.stringify(row, (_, value) => typeof value === 'bigint' ? value.toString() : value));
  return hash.digest('hex');
};
for (const table of tables) {
  target.exec(table.sql);
  const columns = source.prepare(`PRAGMA table_info(${quoted(table.name)})`).all().map(column => column.name);
  const sourceRows = source.prepare(`SELECT ${columns.map(quoted).join(',')} FROM ${quoted(table.name)}`).all();
  tally[table.name] = sourceRows.length;
  if (excluded.has(table.name)) continue;
  const insert = target.prepare(`INSERT INTO ${quoted(table.name)}(${columns.map(quoted).join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
  for (const row of sourceRows) {
    const values = columns.map(column => table.name === 'users' && ['password_salt', 'password_hash'].includes(column) ? '' : row[column]);
    insert.run(...values);
  }
  copy.push({ name: table.name, columns, before: digest(target, table.name, columns), count: sourceRows.length });
}
const layers = initLayerContract(target);
initActionMigration(target);
const projects = target.prepare("SELECT project_id FROM project_setup WHERE project_id <> 'the-machine'").all();
const migrations = projects.map(row => migrateActionProject(target, row.project_id));
const second = projects.map(row => migrateActionProject(target, row.project_id));
const changed = copy.filter(table => table.count !== target.prepare(`SELECT COUNT(*) AS n FROM ${quoted(table.name)}`).get().n ||
  table.before !== digest(target, table.name, table.columns)).map(table => table.name);
const integrity = target.prepare('PRAGMA integrity_check').get().integrity_check;
if (changed.length || integrity !== 'ok' || second.some(pass => pass.installed || pass.granted || pass.mapped || pass.blocked))
  throw new Error('Migration rehearsal changed original records, failed integrity, or was not idempotent.');
const actionRows = target.prepare('SELECT disposition, COUNT(*) AS n FROM layer_work_migration GROUP BY disposition').all();
const knowledgeKinds = source.prepare('SELECT kind, COUNT(*) AS count, SUM(revision) AS revisionSum FROM knowledge_records GROUP BY kind ORDER BY kind').all();
process.stdout.write(JSON.stringify({ sourceTables: tables.length, tableCounts: tally, preservedTables: copy.length, preservedRows: copy.reduce((sum, table) => sum + table.count, 0),
  excluded: [...excluded].filter(([name]) => tally[name] !== undefined).map(([table, reason]) => ({ table, count: tally[table], reason })),
  scrubbed: ['users.password_salt', 'users.password_hash'], knowledgeKinds, layers,
  migrations: migrations.map(pass => ({ installed: pass.installed, grants: pass.granted, mapped: pass.mapped, blocked: pass.blocked })),
  workDispositions: actionRows, repeatedPassChanges: second.reduce((sum, pass) => sum + pass.installed + pass.granted + pass.mapped + pass.blocked, 0),
  originalRowsUnchanged: true, integrity }, null, 2) + '\n');
source.exec('COMMIT'); source.close(); target.close();
