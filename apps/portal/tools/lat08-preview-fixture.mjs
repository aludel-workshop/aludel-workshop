// LAT-08 preview fixture: source opened read-only; output is a local, sanitized copy.
// Only structural identifiers, enumerations and timestamps can pass through unchanged.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const [sourcePath, outputDirectory] = process.argv.slice(2);
if (!sourcePath || !outputDirectory) throw new Error('Usage: node tools/lat08-preview-fixture.mjs SOURCE.sqlite OUTPUT_DIRECTORY');
const destination = resolve(outputDirectory);
const output = join(destination, 'machine.sqlite');
if (existsSync(output)) throw new Error('Preview database already exists; choose a new directory.');
mkdirSync(destination, { recursive: true, mode: 0o700 });
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
source.exec('BEGIN');
const target = new DatabaseSync(output);
target.exec('PRAGMA foreign_keys = OFF');
const credentialTables = new Set(['auth_config', 'sessions', 'login_tickets', 'editor_tokens', 'editor_contexts', 'onboarding_drafts',
  'project_connections', 'symphony_worker_tokens', 'symphony_pools', 'github_identities', 'github_installations',
  'github_sign_ins', 'github_user_installations', 'github_users']);
const cacheTables = new Set(['import_runs', 'source_documents', 'source_revisions', 'source_links']);
const denied = new Set([...credentialTables, ...cacheTables]);
const quoted = value => { if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('Unexpected schema identifier.'); return `"${value}"`; };
const tables = source.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
const allIds = new Set();
for (const table of tables) {
  if (denied.has(table.name)) continue;
  const cols = source.prepare(`PRAGMA table_info(${quoted(table.name)})`).all().map(column => column.name);
  for (const col of cols.filter(column => column === 'id' || /_id$/.test(column))) {
    for (const row of source.prepare(`SELECT ${quoted(col)} AS value FROM ${quoted(table.name)} WHERE ${quoted(col)} IS NOT NULL`).all())
      if (typeof row.value === 'string') allIds.add(row.value);
  }
}
const enumTokens = new Set(('dreamer planner tinkerer owner member normal elevated ready claimed review done blocked needs working queued draft running submitted stopped stopping active inactive current stale accepted rejected proposed pending useful wrong product design pages data platform work deploy vision code brief default high medium low highest lowest person agent manual utility read read-only local codex open closed false true').split(' '));
const structural = new Set(['kind', 'state', 'status', 'role', 'layer', 'layer_key', 'source_key', 'receiving_key', 'type', 'action',
  'priority', 'profile', 'assignee_kind', 'executor', 'provider', 'effort', 'origin', 'disposition', 'key', 'currency',
  'id', 'palette', 'fill', 'face', 'elevationRule', 'indicator', 'cadence']);
const iso = /^\d{4}-\d\d-\d\d(?:T\d\d:\d\d:\d\d(?:\.\d+)?Z)?$/;
const safeToken = /^[a-z][a-z0-9_.:-]{0,39}$/;
const digest = value => createHash('sha256').update('lat08-preview:' + value).digest('hex');
let rewritten = 0, structuralKept = 0, copied = 0;
const rewrittenOriginals = new Set();
const recordRewrite = value => { if (value.length >= 18 && /[^a-z0-9_.:-]/i.test(value)) rewrittenOriginals.add(value); rewritten++; };
function scrubString(value, key = '') {
  if (!value) return value;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) { recordRewrite(value); return '#5f6d7a'; }
  if (allIds.has(value)) { structuralKept++; if (/^[A-Za-z0-9._:-]{1,128}$/.test(value)) return value; recordRewrite(value); return `id-${digest(value).slice(0, 24)}`; }
  if (iso.test(value)) { structuralKept++; return value; }
  if ((enumTokens.has(value) || structural.has(key) && safeToken.test(value) && !/secret|token|password|credential|auth|private/.test(value))) { structuralKept++; return value; }
  if (/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value) && /commit|blob|hash|digest/.test(key)) { recordRewrite(value); return digest(value).slice(0, value.length); }
  recordRewrite(value); return 'Sample';
}
function scrubJson(value, key = '') {
  if (typeof value === 'string') return scrubString(value, key);
  if (Array.isArray(value)) return value.map(item => scrubJson(item, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, scrubJson(item, name)]));
  return value;
}
const projectRows = source.prepare("SELECT id FROM projects WHERE id <> 'the-machine' ORDER BY created_at, id").all();
const projectIndex = new Map(projectRows.map((row, index) => [row.id, index + 1]));
const workspacePaths = new Map();
for (const [id, index] of projectIndex) {
  const path = join(destination, 'workspaces', `project-${index}`);
  mkdirSync(path, { recursive: true, mode: 0o700 });
  writeFileSync(join(path, 'README.md'), `# Preview project ${index}\n\nSanitized LAT-08 fixture.\n`);
  writeFileSync(join(path, 'src.txt'), 'Sample source for the local preview.\n');
  execFileSync('git', ['init', '-q'], { cwd: path });
  execFileSync('git', ['add', '.'], { cwd: path });
  execFileSync('git', ['-c', 'user.name=LAT-08 Preview', '-c', 'user.email=preview@example.invalid', 'commit', '-qm', 'Sanitized preview fixture'], { cwd: path });
  workspacePaths.set(id, path);
}
const tableCounts = {};
for (const table of tables) {
  target.exec(table.sql);
  const columns = source.prepare(`PRAGMA table_info(${quoted(table.name)})`).all().map(column => column.name);
  const rows = source.prepare(`SELECT ${columns.map(quoted).join(', ')} FROM ${quoted(table.name)}`).all();
  const uniqueColumns = new Set(source.prepare(`PRAGMA index_list(${quoted(table.name)})`).all().filter(index => index.unique)
    .flatMap(index => source.prepare(`PRAGMA index_info(${quoted(index.name)})`).all().map(info => info.name)).filter(Boolean));
  tableCounts[table.name] = { source: rows.length, copied: 0, exclusion: credentialTables.has(table.name) ? 'credential or session data' : cacheTables.has(table.name) ? 'reimported corpus cache' : null };
  if (denied.has(table.name)) continue;
  const insert = target.prepare(`INSERT INTO ${quoted(table.name)} (${columns.map(quoted).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
  for (const row of rows) {
    const values = columns.map(column => {
      const value = row[column];
      if (value === null || typeof value === 'number' || typeof value === 'bigint') return value;
      if (table.name === 'users' && ['password_salt', 'password_hash'].includes(column)) return null;
      if (table.name === 'users' && column === 'email') return row.id === 'owner' ? 'preview-owner@example.invalid' : `preview-${digest(row.id).slice(0, 8)}@example.invalid`;
      if (table.name === 'users' && column === 'display_name') return row.id === 'owner' ? 'Preview Owner' : 'Preview Member';
      if (table.name === 'projects' && column === 'slug') return row.id === 'the-machine' ? 'the-machine' : `preview-project-${projectIndex.get(row.id)}`;
      if (table.name === 'projects' && column === 'name') return row.id === 'the-machine' ? 'Aludel preview' : `Preview project ${projectIndex.get(row.id)}`;
      if (table.name === 'project_setup' && column === 'workspace_path') return workspacePaths.get(row.project_id) || null;
      if (column === 'id' || /_id$/.test(column)) return scrubString(String(value), column);
      if (column.endsWith('_json') || column === 'json') {
        try { return JSON.stringify(scrubJson(JSON.parse(value), column)); } catch { rewritten++; return '{}'; }
      }
      if (typeof value === 'string') {
        const safe = scrubString(value, column);
        if (safe === 'Sample' && uniqueColumns.has(column)) return /path|route/.test(column) ? `sample-${digest(value).slice(0, 16)}.txt` : `sample-${digest(value).slice(0, 16)}`;
        return safe;
      }
      if (ArrayBuffer.isView(value)) { rewritten++; return new Uint8Array(); }
      rewritten++; return null;
    });
    insert.run(...values);
    tableCounts[table.name].copied++;
    copied++;
  }
}
// The original portal owner is added only to this preview so local setup can expose both sampled projects.
const previewMemberships = target.prepare("SELECT id FROM users WHERE id = 'owner'").get() ? projectRows.length : 0;
if (previewMemberships) for (const row of projectRows) target.prepare(
  "INSERT OR IGNORE INTO project_members(project_id, user_id, role, created_at) VALUES (?, 'owner', 'owner', ?)")
  .run(row.id, new Date().toISOString());
// The source must not be changed and the preview must remain structurally sound.
const integrity = target.prepare('PRAGMA integrity_check').get().integrity_check;
const foreignKeyViolations = target.prepare('PRAGMA foreign_key_check').all().length;
if (foreignKeyViolations) throw new Error('Preview foreign-key check failed.');
const suspect = [/sk-[A-Za-z0-9_-]{15,}/, /gh[psu]_[A-Za-z0-9_]{12,}/, /@gmail\.com/i, /-----BEGIN [A-Z ]+PRIVATE KEY-----/];
for (const table of tables) for (const row of target.prepare(`SELECT * FROM ${quoted(table.name)}`).all())
  for (const value of Object.values(row)) if (typeof value === 'string') for (const original of rewrittenOriginals)
    if (value.includes(original)) throw new Error('Preview retained a rewritten source string.');
for (const table of tables) for (const row of target.prepare(`SELECT * FROM ${quoted(table.name)}`).all())
  for (const value of Object.values(row)) if (typeof value === 'string' && suspect.some(pattern => pattern.test(value)))
    throw new Error('Preview secret-pattern check failed.');
if (integrity !== 'ok') throw new Error('Preview integrity check failed.');
for (const table of denied) if (target.prepare(`SELECT COUNT(*) AS n FROM ${quoted(table)}`).get().n) throw new Error('Excluded table was populated.');
for (const row of target.prepare('SELECT id, password_salt, password_hash FROM users').all())
  if (row.password_salt || row.password_hash) throw new Error('An original user credential remained.');
source.exec('COMMIT'); source.close(); target.close();
process.stdout.write(JSON.stringify({ tableCounts, projects: projectRows.length, copiedRows: copied, rewrittenStrings: rewritten,
  structuralStringsKept: structuralKept, excludedCredentialTables: credentialTables.size, excludedCacheTables: cacheTables.size,
  previewMemberships, foreignKeyViolations, secretPatternMatches: 0, integrity, output }, null, 2) + '\n');
