// PROJECT-DB-01 (DEC-056, DEC-058): one platform database plus one SQLite database per project.
// The store keeps the `prepare`/`exec` surface every module already uses and routes each statement by the tables it names:
// platform tables (identity, routing, membership, worker credentials) run on `machine.sqlite`; every other table lives in
// `projects/<id>.sqlite`. A project statement runs on the current project (withProject, set at each entry point); without
// one, a statement that binds `project_id` names its project itself. Remaining statements without a project are either
// cross-project reads and by-ID updates, which visit every project, or refused. A statement that mixes platform and
// project tables is refused.
import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const platformTables = new Set(['projects', 'users', 'sessions', 'auth_config', 'login_tickets', 'github_identities', 'github_sign_ins',
  'github_user_installations', 'github_users', 'github_installations', 'onboarding_drafts', 'project_members', 'project_setup', 'symphony_pools', 'symphony_worker_tokens', 'editor_tokens', 'import_runs',
  // The bootstrap workflow's own task list predates projects.
  'work_items', 'work_events',
  // Candidate preview runtime state is keyed by candidate, not project.
  'candidate_previews']);
// Child tables that name their parent row without a declared foreign key.
const parents = { knowledge_revisions: [['record_id', 'knowledge_records', 'id']], markdown_file_revisions: [['file_id', 'markdown_files', 'id']],
  layer_connection_revisions: [['id', 'layer_connections', 'id']], layer_run_drafts: [['attempt_id', 'symphony_attempts', 'id']] };
const keywords = new Set(['set', 'conflict', 'select', 'delete', 'update', 'insert', 'values', 'json_each', 'json_tree', 'not', 'exists', 'if', 'where', 'as', 'only']);
const strip = sql => sql.replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, '');
const fail = message => { throw Object.assign(new Error(message), { code: 'PROJECT_STORE' }); };

// The tables a statement names, not counting CTE names, aliases after ON, or keywords.
export function tablesOf(sql) {
  const text = strip(sql);
  const ctes = new Set([...text.matchAll(/(?:\bWITH(?:\s+RECURSIVE)?|,)\s+([a-z_][a-z0-9_]*)\s+AS\s*\(/gi)].map(match => match[1].toLowerCase()));
  const found = new Set();
  for (const match of text.matchAll(/(?:\b(?:FROM|JOIN|INTO|UPDATE|TABLE(?:\s+IF\s+(?:NOT\s+)?EXISTS)?|ON)\s+|\btable_info\s*\(\s*)([a-z_][a-z0-9_]*)\b(?!\s*\.)/gi)) {
    const name = match[1].toLowerCase();
    if (!keywords.has(name) && !ctes.has(name)) found.add(name);
  }
  return found;
}
export function classify(sql) {
  const text = strip(sql);
  if (/\bsqlite_master\b|\bsqlite_schema\b/i.test(text)) return 'schema';
  const tables = tablesOf(sql);
  if (!tables.size) return /^\s*PRAGMA\b/i.test(text) ? 'pragma' : 'none';
  const kinds = new Set([...tables].map(name => platformTables.has(name) ? 'platform' : 'project'));
  return kinds.size > 1 ? 'mixed' : [...kinds][0];
}

// Splits a batch of SQL into statements, keeping CREATE TRIGGER … BEGIN … END together.
export function statements(batch) {
  const out = []; let current = ''; let quote = null; let depth = 0;
  for (let i = 0; i < batch.length; i++) {
    const char = batch[i];
    current += char;
    if (quote) { if (char === quote) quote = null; continue; }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (/[A-Za-z]/.test(char) && !/[A-Za-z0-9_]/.test(batch[i - 1] || '')) {
      const word = /^[A-Za-z_]+/.exec(batch.slice(i))[0].toUpperCase();
      if (word === 'BEGIN' && /CREATE\s+TRIGGER/i.test(current)) depth++;
      else if (word === 'END' && depth > 0 && /^END\b/i.test(batch.slice(i))) depth--;
    }
    if (char === ';' && depth === 0) { if (current.trim() !== ';') out.push(current.trim()); current = ''; }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

// What a statement binds to `column`: { index } of its positional parameter, { value } of a literal, or null.
function binding(sql, column, columnsOf) {
  const text = sql.replace(/--[^\n]*/g, '');
  const insert = /^\s*INSERT(?:\s+OR\s+\w+)?\s+INTO\s+([a-z_][a-z0-9_]*)\s*(\(([^)]*)\))?\s*VALUES\s*\(/i.exec(text);
  if (insert) {
    const columns = insert[3] ? insert[3].split(',').map(value => value.trim().toLowerCase()) : columnsOf(insert[1].toLowerCase());
    const position = columns.indexOf(column);
    if (position < 0) return null;
    const values = []; let depth = 0, item = '', quote = false;
    for (const char of text.slice(insert.index + insert[0].length)) {
      if (char === "'") quote = !quote;
      if (!quote && char === '(') depth++;
      if (!quote && char === ')' && depth-- === 0) { values.push(item); break; }
      if (!quote && char === ',' && depth === 0) { values.push(item); item = ''; } else item += char;
    }
    const value = values[position]?.trim();
    if (value === '?') return { index: strip(values.slice(0, position).join(',')).split('?').length - 1 };
    const literal = /^'((?:[^']|'')*)'$/.exec(value || '');
    return literal ? { value: literal[1].replace(/''/g, "'") } : null;
  }
  const stripped = strip(text);
  const where = new RegExp(`\\b(?:[a-z_]+\\.)?${column}\\s*=\\s*(\\?|'((?:[^']|'')*)')`, 'i').exec(text);
  if (!where) return null;
  if (where[1] === '?') return { index: strip(text.slice(0, where.index)).split('?').length - 1 };
  return stripped.includes(where[0].replace(/'(?:[^']|'')*'/g, "''")) ? { value: where[2] } : null;
}
const bound = (found, params) => found ? ('value' in found ? found.value : typeof params[found.index] === 'string' || typeof params[found.index] === 'number' ? params[found.index] : null) : null;
// Visiting every project cannot merge aggregates; `all` also cannot honour a LIMIT (a `get` can: the first match wins).
const aggregate = (sql, method) => /\b(count|sum|max|min|avg|group_concat|total)\s*\(|\bGROUP\s+BY\b/i.test(strip(sql)) || method !== 'get' && /\bLIMIT\b/i.test(strip(sql));

export function openProjectStore(path, { projectDirectory = join(dirname(path), 'projects') } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  const platform = new DatabaseSync(path);
  platform.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  // The project schema as the modules declare it; every project database is brought to it when it opens.
  const template = new DatabaseSync(':memory:');
  const ddl = [];
  const connections = new Map();
  const context = new AsyncLocalStorage();
  const cache = new Map();
  let pending = false; const open = new Set();
  let closed = false;

  const localDdl = sql => sql.replace(/\s+REFERENCES\s+([a-z_][a-z0-9_]*)\s*(?:\([^)]*\))?(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))*/gi,
    (match, table) => platformTables.has(table.toLowerCase()) ? '' : match);
  const platformDdl = sql => sql.replace(/\s+REFERENCES\s+([a-z_][a-z0-9_]*)\s*(?:\([^)]*\))?(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))*/gi,
    (match, table) => platformTables.has(table.toLowerCase()) ? match : '');
  const replay = (connection, sql) => {
    try { connection.exec(sql); }
    catch (error) { if (!/duplicate column name|already exists/i.test(error.message)) throw error; }
  };
  const knownProject = id => typeof id === 'string' && !!platform.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
  function connection(projectId) {
    if (connections.has(projectId)) return connections.get(projectId);
    if (!knownProject(projectId)) fail(`Unknown project ${projectId}.`);
    mkdirSync(projectDirectory, { recursive: true });
    const database = new DatabaseSync(join(projectDirectory, `${projectId}.sqlite`));
    database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    for (const sql of ddl) replay(database, sql);
    connections.set(projectId, database);
    if (pending) { database.exec('BEGIN IMMEDIATE'); open.add(database); }
    return database;
  }
  const projectIds = () => platform.prepare('SELECT id FROM projects ORDER BY created_at, id').all().map(row => row.id);
  const current = () => context.getStore()?.projectId || null;
  const inTransaction = database => { if (pending && !open.has(database)) { database.exec('BEGIN IMMEDIATE'); open.add(database); } return database; };
  const statementOn = (database, sql) => {
    let map = cache.get(database); if (!map) cache.set(database, map = new Map());
    let statement = map.get(sql); if (!statement) map.set(sql, statement = database.prepare(sql));
    return statement;
  };
  const columnsOf = table => template.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);

  // The project databases a project statement runs on, given its parameters.
  function targets(sql, params, method) {
    const explicit = current();
    const named = bound(binding(sql, 'project_id', columnsOf), params);
    if (explicit) {
      if (named && named !== explicit) fail(`A ${explicit} request reached ${named} data.`);
      return [connection(explicit)];
    }
    // A read about a project that does not exist finds nothing, as it did in one database; a write to one is refused.
    if (named) return knownProject(named) || method === 'run' ? [connection(named)] : [];
    const verb = /^\s*(\w+)/.exec(strip(sql))[1].toUpperCase();
    // A row whose table has no project_id belongs to the project of the parent row its foreign key names; a statement
    // about one row (by its id) belongs to the project holding that row.
    const table = /\b(?:INTO|UPDATE|FROM)\s+([a-z_][a-z0-9_]*)/i.exec(strip(sql))?.[1].toLowerCase();
    if (table && !platformTables.has(table)) {
      const keys = [...template.prepare(`PRAGMA foreign_key_list(${table})`).all(), ...(parents[table] || []).map(([from, parent, to]) => ({ from, table: parent, to })),
        { from: 'id', table, to: 'id' }];
      for (const key of keys) {
        if (platformTables.has(key.table)) continue;
        const value = bound(binding(sql, key.from.toLowerCase(), columnsOf), params);
        if (value === null) continue;
        const owner = projectIds().find(id => connection(id).prepare(`SELECT 1 FROM ${key.table} WHERE ${key.to || 'id'} = ?`).get(value));
        if (owner) return [connection(owner)];
      }
    }
    // INSERT … SELECT copies within each project's own rows, so it runs in each project too.
    const crossProject = (verb === 'SELECT' || verb === 'WITH') && method !== 'run' && !aggregate(sql, method) || verb === 'UPDATE' || verb === 'DELETE' ||
      verb === 'INSERT' && !/\bVALUES\b/i.test(strip(sql)) && /\bSELECT\b/i.test(strip(sql));
    if (!crossProject) fail(`Project data needs a project: ${sql.replace(/\s+/g, ' ').slice(0, 160)}`);
    return projectIds().map(connection);
  }
  const project = sql => ({
    run: (...params) => {
      const results = targets(sql, params, 'run').map(database => statementOn(inTransaction(database), sql).run(...params));
      return results.length === 1 ? results[0] : { changes: results.reduce((sum, value) => sum + Number(value.changes), 0), lastInsertRowid: 0 };
    },
    get: (...params) => { for (const database of targets(sql, params, 'get')) { const value = statementOn(inTransaction(database), sql).get(...params); if (value !== undefined) return value; } return undefined; },
    all: (...params) => targets(sql, params, 'all').flatMap(database => statementOn(inTransaction(database), sql).all(...params)),
    iterate: (...params) => targets(sql, params, 'all').flatMap(database => statementOn(inTransaction(database), sql).all(...params))[Symbol.iterator](),
    columns: () => template.prepare(sql).columns(),
    get sourceSQL() { return sql; },
  });
  // Schema questions ("does this table or column exist") are answered from the platform and the project template.
  const schema = sql => ({
    run: () => fail('Schema tables are read-only.'),
    get: (...params) => statementOn(platform, sql).get(...params) ?? statementOn(template, sql).get(...params),
    all: (...params) => [...statementOn(platform, sql).all(...params), ...statementOn(template, sql).all(...params)],
    iterate: (...params) => [...statementOn(platform, sql).all(...params), ...statementOn(template, sql).all(...params)][Symbol.iterator](),
    columns: () => platform.prepare(sql).columns(),
    get sourceSQL() { return sql; },
  });

  function prepare(sql) {
    if (closed) fail('The database is closed.');
    const kind = classify(sql);
    if (kind === 'mixed') fail(`A statement names platform and project tables; split it: ${[...tablesOf(sql)].join(', ')}`);
    if (kind === 'schema') return schema(sql);
    if (kind === 'project') {
      if (/^\s*PRAGMA\b/i.test(strip(sql))) return { all: (...params) => template.prepare(sql).all(...params), get: (...params) => template.prepare(sql).get(...params), run: () => fail('Use exec for PRAGMA changes.') };
      return project(sql);
    }
    return platformStatement(sql);
  }
  // Platform statements join an open transaction when they run, not when they are prepared.
  const platformStatement = sql => ({
    run: (...params) => statementOn(inTransaction(platform), sql).run(...params),
    get: (...params) => statementOn(inTransaction(platform), sql).get(...params),
    all: (...params) => statementOn(inTransaction(platform), sql).all(...params),
    iterate: (...params) => statementOn(inTransaction(platform), sql).iterate(...params),
    columns: () => statementOn(platform, sql).columns(),
    get sourceSQL() { return sql; },
  });
  function exec(batch) {
    for (const sql of statements(batch)) {
      const text = strip(sql).trim();
      const verb = /^(\w+)/.exec(text)?.[1].toUpperCase();
      if (['BEGIN', 'COMMIT', 'END', 'ROLLBACK'].includes(verb)) { transaction(verb); continue; }
      if (verb === 'PRAGMA') { platform.exec(sql); template.exec(sql); for (const database of connections.values()) database.exec(sql); continue; }
      const kind = classify(sql);
      if (kind === 'mixed') fail(`A statement names platform and project tables; split it: ${[...tablesOf(sql)].join(', ')}`);
      if (['CREATE', 'ALTER', 'DROP'].includes(verb)) {
        if (kind === 'platform' || kind === 'none') { platform.exec(platformDdl(sql)); continue; }
        const local = localDdl(sql);
        template.exec(local);
        ddl.push(local);
        for (const database of connections.values()) replay(database, local);
        continue;
      }
      if (kind === 'project') { prepare(sql).run(); continue; }
      platform.exec(sql);
    }
  }
  function transaction(verb) {
    if (verb === 'BEGIN') {
      if (pending) fail('A transaction is already open.');
      pending = true;
      return;
    }
    const databases = [...open];
    pending = false; open.clear();
    if (verb === 'ROLLBACK') { for (const database of databases) if (database.isTransaction) database.exec('ROLLBACK'); return; }
    for (const database of databases) database.exec('COMMIT');
  }

  // One-time move of a single-database install: every project table in machine.sqlite moves, with its own definition,
  // indexes and triggers, into each project's database with that project's rows (children follow their parents). Runs at
  // open, before the modules declare their schema, so their later migrations and backfills apply to the moved data.
  // The original file is kept as a backup; rows that belong to no project are kept in legacy_<table> and reported.
  function migrateLegacy() {
    const legacy = platform.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()
      .filter(row => !platformTables.has(row.name) && !row.name.startsWith('legacy_'));
    if (!legacy.length) return null;
    const backup = `${path}.pre-project-db-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    platform.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
    const names = new Set(legacy.map(row => row.name));
    const columns = table => platform.prepare(`PRAGMA table_info("${table}")`).all().map(column => column.name);
    // The rows of `table` that belong to a project, as a WHERE clause on it with one parameter per `?`.
    const owned = (table, seen = new Set()) => {
      if (columns(table).includes('project_id')) return { where: 'project_id = ?', params: 1 };
      if (seen.has(table)) return null;
      // A required reference decides ownership before an optional one (a link's source, not its resolved target).
      const required = new Set(platform.prepare(`PRAGMA table_info("${table}")`).all().filter(column => column.notnull).map(column => column.name));
      const keys = [...platform.prepare(`PRAGMA foreign_key_list("${table}")`).all(), ...(parents[table] || []).map(([from, parent, to]) => ({ from, table: parent, to }))]
        .sort((a, b) => Number(required.has(b.from)) - Number(required.has(a.from)));
      for (const key of keys) {
        if (!names.has(key.table)) continue;
        const parent = owned(key.table, new Set([...seen, table]));
        if (parent) return { where: `"${key.from}" IN (SELECT "${key.to || 'id'}" FROM "${key.table}" WHERE ${parent.where})`, params: parent.params };
      }
      return null;
    };
    const report = { backup, tables: {}, unowned: {} };
    const projects = projectIds();
    mkdirSync(projectDirectory, { recursive: true });
    platform.exec('PRAGMA foreign_keys = OFF');
    for (const projectId of projects) {
      const file = join(projectDirectory, `${projectId}.sqlite`);
      platform.exec(`ATTACH DATABASE '${file.replace(/'/g, "''")}' AS target`);
      try {
        platform.exec('BEGIN IMMEDIATE');
        for (const table of legacy) platform.exec(localDdl(table.sql).replace(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?)([a-z_][a-z0-9_]*)\1/i, 'CREATE TABLE IF NOT EXISTS target."$2"'));
        for (const table of legacy) {
          const rule = owned(table.name);
          if (!rule) continue;
          const list = columns(table.name).map(name => `"${name}"`).join(', ');
          const moved = platform.prepare(`INSERT INTO target."${table.name}" (${list}) SELECT ${list} FROM main."${table.name}" WHERE ${rule.where}`)
            .run(...Array(rule.params).fill(projectId)).changes;
          report.tables[table.name] = (report.tables[table.name] || 0) + Number(moved);
        }
        for (const index of platform.prepare("SELECT sql FROM main.sqlite_master WHERE type IN ('index', 'trigger') AND sql IS NOT NULL").all()
          .map(row => row.sql).filter(sql => names.has(/\bON\s+"?([a-z_][a-z0-9_]*)/i.exec(sql)?.[1]))) {
          platform.exec(localDdl(index).replace(/^(\s*CREATE\s+(?:UNIQUE\s+)?(?:INDEX|TRIGGER)\s+(?:IF\s+NOT\s+EXISTS\s+)?)("?)([a-z_][a-z0-9_]*)\2/i, '$1target."$3"'));
        }
        platform.exec('COMMIT');
      } catch (error) { if (platform.isTransaction) platform.exec('ROLLBACK'); platform.exec('DETACH DATABASE target'); platform.exec('PRAGMA foreign_keys = ON'); throw error; }
      platform.exec('DETACH DATABASE target');
    }
    platform.exec('BEGIN IMMEDIATE');
    for (const table of legacy) {
      const total = Number(platform.prepare(`SELECT count(*) AS n FROM "${table.name}"`).get().n);
      const moved = report.tables[table.name] || 0;
      if (moved !== total) {
        report.unowned[table.name] = total - moved;
        platform.exec(`CREATE TABLE IF NOT EXISTS "legacy_${table.name}" AS SELECT * FROM "${table.name}" WHERE 0`);
        const rule = owned(table.name);
        platform.prepare(`INSERT INTO "legacy_${table.name}" SELECT * FROM "${table.name}"${rule ? ` WHERE NOT (${rule.where.replace(/= \?/g, `IN (${projects.map(() => '?').join(',') || 'NULL'})`)})` : ''}`)
          .run(...(rule ? Array(rule.params).fill(projects).flat() : []));
      }
      platform.exec(`DROP TABLE "${table.name}"`);
    }
    // A platform cache that pointed at project rows is rebuilt by its module.
    platform.exec('DROP TABLE IF EXISTS candidate_previews');
    platform.exec('COMMIT');
    platform.exec('PRAGMA foreign_keys = ON');
    return report;
  }
  const migration = migrateLegacy();

  const store = {
    migration,
    prepare, exec,
    get isTransaction() { return pending; },
    get isOpen() { return !closed; },
    close() { if (closed) return; closed = true; platform.close(); template.close(); for (const database of connections.values()) database.close(); connections.clear(); },
    // Runs fn with `projectId` as the current project; project statements go to its database.
    withProject(projectId, fn) { return projectId ? context.run({ projectId }, fn) : context.run({ projectId: null }, fn); },
    // Makes `projectId` the current project for the rest of this execution (entry points and test fixtures).
    useProject(projectId) { context.enterWith({ projectId: projectId || null }); },
    get currentProject() { return current(); },
    projectIds,
    projectPath: projectId => join(projectDirectory, `${projectId}.sqlite`),
    projectDatabase: connection,
    platform,
    hasProjectDatabase: projectId => existsSync(join(projectDirectory, `${projectId}.sqlite`)),
    // Removes a project's database (the platform row is deleted separately).
    dropProject(projectId) { connections.get(projectId)?.close(); connections.delete(projectId); return join(projectDirectory, `${projectId}.sqlite`); },
  };
  return store;
}
