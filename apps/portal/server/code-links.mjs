// Code links (LAY-07D, DEC-038): why each piece of a project's code exists, anchored to knowledge-record revisions.
// Declared links come from the scaffold's generation manifest, commit trailers and test names, never from tags in the
// code. Derived structure (units, references, reachability) is read from the workspace with the TypeScript parser.
// A new revision of a linked record makes its links suspect and opens one Reconcile work item for that record.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';

const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const sourceDirectories = ['src', 'server', 'tests'];
const entryFiles = ['src/main.ts', 'server/server.mjs'];
const isTestFile = path => /(^|\/)tests?\/|\.(test|spec)\.[cm]?[jt]s$/.test(path);
const declarationKinds = new Set(['function', 'class', 'component', 'const']);
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });

export function initCodeLinks(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_units (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), unit_key TEXT NOT NULL, path TEXT NOT NULL, symbol TEXT NOT NULL,
      kind TEXT NOT NULL, hash TEXT NOT NULL, reachable INTEGER NOT NULL, last_commit TEXT, line INTEGER, calls_json TEXT NOT NULL,
      indexed_at TEXT NOT NULL, UNIQUE(project_id, unit_key)
    );
    CREATE TABLE IF NOT EXISTS trace_links (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), record_id TEXT NOT NULL, record_revision INTEGER NOT NULL,
      unit_id TEXT NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL, state TEXT NOT NULL, work_ref TEXT, derived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(record_id, unit_id, kind, source)
    );
    CREATE INDEX IF NOT EXISTS idx_trace_links_record ON trace_links(project_id, record_id);
  `);
  // PLATFORM-UX-01: where each unit ends, so Code › Explorer can highlight the whole chunk.
  if (!db.prepare('PRAGMA table_info(code_units)').all().some(column => column.name === 'end_line')) db.exec('ALTER TABLE code_units ADD COLUMN end_line INTEGER');
}

// ---- Structure: units and references from one file ----
// Units: top-level functions, classes (Angular components marked), consts; route entries ({ path, label } objects);
// HTTP handlers (`if (pathname === '/api/x' && request.method === 'POST')`); tables (CREATE TABLE); tests (test('…')).
export function extractUnits(path, source) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const units = [];
  const imports = new Map();
  const line = position => file.getLineAndCharacterOfPosition(position).line + 1;
  const add = (symbol, kind, start, end, extra = {}) => units.push({ symbol, kind, start, end, startLine: line(start), endLine: line(end), ...extra });
  const literalText = node => ts.isStringLiteralLike(node) ? node.text : ts.isTemplateExpression(node) ? [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join(' ') : null;

  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.startsWith('.')) {
      for (const element of statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) ? statement.importClause.namedBindings.elements : []) {
        imports.set(element.name.text, { from: statement.moduleSpecifier.text, name: (element.propertyName || element.name).text });
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      add(statement.name.text, 'function', statement.getStart(file), statement.getEnd(), { name: statement.name.text });
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const component = (ts.getDecorators(statement) || []).some(decorator => ts.isCallExpression(decorator.expression) && decorator.expression.expression.getText(file) === 'Component');
      add(statement.name.text, component ? 'component' : 'class', statement.getStart(file), statement.getEnd(), { name: statement.name.text });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const initializer = declaration.initializer;
        const kind = initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) ? 'function' : 'const';
        add(declaration.name.text, kind, declaration.getStart(file), declaration.getEnd(), { name: declaration.name.text });
      }
    }
  }

  const visit = node => {
    if (ts.isIfStatement(node)) {
      const condition = node.expression.getText(file);
      const route = /pathname\s*===\s*['"`](\/[^'"`]+)['"`]/.exec(condition);
      if (route) {
        const method = /request\.method\s*===\s*['"]([A-Z]+)['"]/.exec(condition)?.[1];
        add(`${method ? `${method} ` : ''}${route[1]}`, 'handler', node.getStart(file), node.thenStatement.getEnd());
      }
    }
    const literal = literalText(node);
    if (literal) for (const match of literal.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([A-Za-z_]\w*)/gi)) add(`table ${match[1]}`, 'table', node.getStart(file), node.getEnd(), { table: match[1] });
    if (ts.isObjectLiteralExpression(node)) {
      const value = key => { const property = node.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(file).replace(/['"]/g, '') === key); return property && ts.isStringLiteral(property.initializer) ? property.initializer.text : null; };
      const routePath = value('path');
      if (routePath?.startsWith('/') && value('label') !== null) add(`route ${routePath}`, 'route', node.getStart(file), node.getEnd());
    }
    if (isTestFile(path) && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['test', 'it'].includes(node.expression.text) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      add(node.arguments[0].text, 'test', node.getStart(file), node.getEnd());
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  // Innermost enclosing unit is the parent; a unit's references exclude the spans of its children.
  units.forEach((unit, index) => {
    let parent = null;
    units.forEach((other, otherIndex) => {
      // Strictly larger only: two tables created by one SQL string share a span and are siblings, not nested.
      if (otherIndex !== index && other.start <= unit.start && other.end >= unit.end && other.end - other.start > unit.end - unit.start
        && (parent === null || other.end - other.start < units[parent].end - units[parent].start)) parent = otherIndex;
    });
    unit.parent = parent;
  });
  const children = index => units.filter(unit => unit.parent === index);
  const collect = (start, end, excluded) => {
    const names = new Set(); const sql = new Set();
    const walk = node => {
      if (node.getEnd() <= start || node.getStart(file) >= end) return;
      if (excluded.some(span => node.getStart(file) >= span.start && node.getEnd() <= span.end)) return;
      if (ts.isIdentifier(node)) names.add(node.text);
      const literal = literalText(node);
      if (literal) for (const match of literal.matchAll(/\b(?:FROM|INTO|JOIN|UPDATE)\s+([A-Za-z_]\w*)/gi)) sql.add(match[1]);
      ts.forEachChild(node, walk);
    };
    walk(file);
    return { names, sql };
  };
  units.forEach((unit, index) => {
    const { names, sql } = collect(unit.start, unit.end, children(index));
    if (unit.name) names.delete(unit.name);
    unit.refs = names; unit.sql = sql;
  });
  const residual = collect(0, file.getEnd(), units.filter(unit => unit.parent === null));
  const text = unit => source.slice(unit.start, unit.end);
  return { units: units.map(unit => ({ ...unit, hash: hash(text(unit)).slice(0, 12) })), imports, residual };
}

function sourceFiles(root) {
  const found = [];
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.data', '.git'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|mjs|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) found.push(relative(root, path).split('\\').join('/'));
    }
  };
  for (const directory of sourceDirectories) if (existsSync(join(root, directory))) walk(join(root, directory));
  return found.sort();
}

// The whole workspace: units with stable keys, resolved references, and reachability from the entry points and tests.
export function indexWorkspace(root) {
  const files = sourceFiles(root);
  const parsed = new Map(files.map(path => [path, extractUnits(path, readFileSync(join(root, path), 'utf8'))]));
  const all = [];
  for (const [path, { units }] of parsed) {
    const seen = new Map();
    for (const unit of units) {
      const count = (seen.get(unit.symbol) || 0) + 1; seen.set(unit.symbol, count);
      unit.key = `${path}#${unit.symbol}${count > 1 ? ` (${count})` : ''}`; unit.path = path;
      all.push(unit);
    }
  }
  const resolve = (from, specifier) => {
    const base = join(dirname(from), specifier).split('\\').join('/');
    return [base, `${base}.ts`, `${base}.mjs`, `${base}.js`, `${base}/index.ts`, base.replace(/\.js$/, '.ts')].find(candidate => parsed.has(candidate)) || null;
  };
  const topLevel = (path, name) => parsed.get(path)?.units.find(unit => unit.parent === null && unit.name === name && declarationKinds.has(unit.kind)) || null;
  const tables = new Map(all.filter(unit => unit.kind === 'table').map(unit => [unit.table.toLowerCase(), unit]));
  const target = (path, name) => {
    const local = topLevel(path, name);
    if (local) return local;
    const imported = parsed.get(path).imports.get(name);
    const file = imported && resolve(path, imported.from);
    return file ? topLevel(file, imported.name) : null;
  };
  const edges = unit => {
    const out = new Set();
    for (const name of unit.refs) { const found = target(unit.path, name); if (found && found !== unit) out.add(found); }
    for (const name of unit.sql) { const found = tables.get(name.toLowerCase()); if (found && found !== unit) out.add(found); }
    for (const child of parsed.get(unit.path).units.filter(item => item.parent !== null && parsed.get(unit.path).units[item.parent] === unit)) out.add(child);
    return [...out];
  };
  for (const unit of all) unit.calls = edges(unit);
  // Roots: file-level code of entry files (and what it references), file-level non-declarations there, and every test.
  const roots = new Set();
  for (const path of files) {
    const entry = entryFiles.includes(path) || isTestFile(path);
    if (!entry) continue;
    const { units, residual } = parsed.get(path);
    for (const unit of units) if (unit.parent === null && (!declarationKinds.has(unit.kind) || unit.kind === 'test')) roots.add(unit);
    for (const unit of units) if (unit.kind === 'test') roots.add(unit);
    for (const name of residual.names) { const found = target(path, name); if (found) roots.add(found); }
  }
  const reachable = new Set();
  const queue = [...roots];
  while (queue.length) { const unit = queue.pop(); if (reachable.has(unit)) continue; reachable.add(unit); queue.push(...unit.calls); }
  return all.map(unit => ({ key: unit.key, path: unit.path, symbol: unit.symbol, kind: unit.kind, hash: unit.hash, line: unit.startLine, end: unit.endLine, reachable: reachable.has(unit), calls: unit.calls.map(item => item.key) }));
}

// ---- Commit trailers: `Aludel-Work: W-12` and `Implements: S4, SPEC-02/FR-001` on a commit link the units it changed ----
export function readTrailerCommits(root) {
  const log = git(root, ['log', '--format=%H%x1f%cI%x1f%(trailers:key=Aludel-Work,valueonly,separator=%x2C)%x1f%(trailers:key=Implements,valueonly,separator=%x2C)%x1e']);
  if (log.status !== 0) return [];
  return log.stdout.split('\x1e').map(entry => entry.trim()).filter(Boolean).map(entry => {
    const [commit, committedAt, work, implementsRefs] = entry.split('\x1f');
    return { commit, committedAt: new Date(committedAt).toISOString(), work: work.trim() || null, refs: implementsRefs.split(/[,\s]+/).map(item => item.trim()).filter(Boolean) };
  }).filter(entry => entry.refs.length).map(entry => ({ ...entry, units: changedUnits(root, entry.commit) }));
}

function changedUnits(root, commit) {
  const diff = git(root, ['show', '--format=', '--unified=0', '--no-color', '--no-ext-diff', commit]);
  if (diff.status !== 0) return [];
  const ranges = new Map(); let path = null;
  for (const text of diff.stdout.split('\n')) {
    if (text.startsWith('+++ ')) { path = text === '+++ /dev/null' ? null : text.slice(6); continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(text);
    if (hunk && path) { const start = Number(hunk[1]); const size = hunk[2] === undefined ? 1 : Number(hunk[2]); ranges.set(path, [...(ranges.get(path) || []), [start, start + Math.max(size, 1) - 1]]); }
  }
  const keys = new Set();
  for (const [file, spans] of ranges) {
    if (!/\.(ts|mjs|js)$/.test(file) || file.endsWith('.d.ts') || !sourceDirectories.some(directory => file.startsWith(`${directory}/`))) continue;
    const shown = git(root, ['show', `${commit}:${file}`]);
    if (shown.status !== 0) continue;
    const { units } = extractUnits(file, shown.stdout);
    const seen = new Map();
    const keyed = units.map(unit => { const count = (seen.get(unit.symbol) || 0) + 1; seen.set(unit.symbol, count); return { ...unit, key: `${file}#${unit.symbol}${count > 1 ? ` (${count})` : ''}` }; });
    for (const [from, to] of spans) {
      // The innermost units touching each changed range: a handler rather than the whole server function.
      const touched = keyed.map((unit, index) => ({ unit, index })).filter(({ unit }) => unit.startLine <= to && unit.endLine >= from);
      for (const { unit, index } of touched) if (!touched.some(other => other.unit.parent === index)) keys.add(unit.key);
    }
  }
  return [...keys];
}

// ---- Stored links and propagation ----
export function codeLinks({ db, know }) {
  const unitRows = projectId => db.prepare('SELECT * FROM code_units WHERE project_id = ? ORDER BY path, line').all(projectId);
  const linkRows = projectId => db.prepare('SELECT * FROM trace_links WHERE project_id = ?').all(projectId);
  const unitId = (projectId, key) => `cu-${hash(`${projectId}:${key}`).slice(0, 12)}`;
  const recordLabel = record => record.kind === 'story' ? `S${record.number} ${record.title}` : record.kind === 'spec' ? `SPEC-${String(record.number).padStart(2, '0')} ${record.title}`
    : record.kind === 'data_operation' ? `${record.operationId} operation` : record.kind === 'data_object' ? `${record.name} object` : record.kind === 'page' ? `${record.label} page` : record.kind;

  function link(projectId, recordId, unit, { kind, source, revision = null, workRef = null, derived = false }) {
    const record = know.get(projectId, recordId);
    if (!record) return null;
    const anchored = revision || record.revision;
    const existing = db.prepare('SELECT * FROM trace_links WHERE record_id = ? AND unit_id = ? AND kind = ? AND source = ?').get(recordId, unit, kind, source);
    const updated = now();
    if (existing) {
      // Regenerated from the record itself (a page), so it is current at the revision it was generated from.
      if (derived && anchored > existing.record_revision) db.prepare("UPDATE trace_links SET record_revision = ?, state = 'current', updated_at = ? WHERE id = ?").run(anchored, updated, existing.id);
      return existing.id;
    }
    const state = anchored < record.revision ? 'suspect' : 'current';
    const id = `tl-${hash(`${recordId}:${unit}:${kind}:${source}`).slice(0, 12)}`;
    db.prepare('INSERT INTO trace_links(id, project_id, record_id, record_revision, unit_id, kind, source, state, work_ref, derived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, projectId, recordId, anchored, unit, kind, source, state, workRef, derived ? 1 : 0, updated, updated);
    if (state === 'suspect') ensureReconcile(projectId, record, anchored);
    return id;
  }

  // One open Reconcile item per record. Its context names the revisions; the diff, units, callers and tests are read live.
  function ensureReconcile(projectId, record, fromRevision) {
    const open = know.workList(projectId).find(item => item.type === 'reconcile' && item.state !== 'done' && item.context?.reconcile?.recordId === record.id);
    if (open) {
      if (open.context.reconcile.toRevision !== record.revision) know.appendLog(open.id, `${recordLabel(record)} moved to revision ${record.revision}`, { context: { reconcile: { ...open.context.reconcile, toRevision: record.revision } } });
      return open;
    }
    const label = recordLabel(record);
    return know.createWork(projectId, {
      layer: 'platform', type: 'reconcile', state: 'ready', title: `Reconcile ${label.slice(0, 120)} with its code`,
      targets: [{ id: record.id, label: label.slice(0, 160) }], documents: [`Platform › Code: links for ${label.slice(0, 200)} current at the new revision`],
      context: { reconcile: { recordId: record.id, fromRevision, toRevision: record.revision } },
      logText: `Created because ${label} changed from revision ${fromRevision} to ${record.revision}`
    });
  }

  know.onRevision(({ projectId, record, toRevision }) => {
    const links = db.prepare('SELECT * FROM trace_links WHERE project_id = ? AND record_id = ?').all(projectId, record.id);
    if (!links.length) return;
    db.prepare("UPDATE trace_links SET state = 'suspect', updated_at = ? WHERE record_id = ? AND record_revision < ? AND state = 'current'").run(now(), record.id, toRevision);
    ensureReconcile(projectId, record, Math.min(...links.map(item => item.record_revision)));
  });

  // Closing a Reconcile item relinks against the revision it reconciled.
  know.onWorkDone(({ projectId, item }) => {
    const recordId = item.type === 'reconcile' && item.context?.reconcile?.recordId;
    const record = recordId && know.get(projectId, recordId);
    if (!record) return;
    db.prepare("UPDATE trace_links SET record_revision = ?, state = 'current', updated_at = ? WHERE project_id = ? AND record_id = ?").run(record.revision, now(), projectId, record.id);
    know.appendLog(item.id, `Relinked ${recordLabel(record)} at revision ${record.revision}`);
  });

  // Rebuilding regenerates derived code; a record whose links are all current again needs no reconcile.
  function closeResolved(projectId, commit) {
    for (const item of know.workList(projectId).filter(entry => entry.type === 'reconcile' && entry.state !== 'done')) {
      const recordId = item.context?.reconcile?.recordId;
      const suspect = db.prepare("SELECT COUNT(*) AS count FROM trace_links WHERE project_id = ? AND record_id = ? AND state = 'suspect'").get(projectId, recordId).count;
      if (!suspect) know.appendLog(item.id, `Resolved by regenerating the code in ${String(commit || '').slice(0, 7)}`, { state: 'done' });
    }
  }

  function index(projectId, root) {
    const units = indexWorkspace(root);
    const indexed = now();
    const lastCommit = new Map();
    for (const path of new Set(units.map(unit => unit.path))) {
      const result = git(root, ['log', '-1', '--format=%h', '--', path]);
      lastCommit.set(path, result.status === 0 ? result.stdout.trim() || null : null);
    }
    const keep = new Set();
    for (const unit of units) {
      const id = unitId(projectId, unit.key); keep.add(id);
      db.prepare(`INSERT INTO code_units(id, project_id, unit_key, path, symbol, kind, hash, reachable, last_commit, line, calls_json, indexed_at, end_line) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, unit_key) DO UPDATE SET hash = excluded.hash, kind = excluded.kind, reachable = excluded.reachable, last_commit = excluded.last_commit, line = excluded.line, end_line = excluded.end_line, calls_json = excluded.calls_json, indexed_at = excluded.indexed_at`)
        .run(id, projectId, unit.key, unit.path, unit.symbol, unit.kind, unit.hash, unit.reachable ? 1 : 0, lastCommit.get(unit.path), unit.line, JSON.stringify(unit.calls.map(key => unitId(projectId, key))), indexed, unit.end ?? unit.line);
    }
    for (const stale of unitRows(projectId).filter(row => !keep.has(row.id))) {
      db.prepare('DELETE FROM trace_links WHERE unit_id = ?').run(stale.id);
      db.prepare('DELETE FROM code_units WHERE id = ?').run(stale.id);
    }
    // Test names: "S4 · Given …" links the test to story S4.
    const stories = know.list(projectId, 'story');
    const specs = know.list(projectId, 'spec');
    for (const unit of units.filter(item => item.kind === 'test')) {
      const number = /^S(\d+)\b/.exec(unit.symbol)?.[1];
      const story = number && stories.find(item => item.number === Number(number));
      if (story) link(projectId, story.id, unitId(projectId, unit.key), { kind: 'tests', source: 'test' });
    }
    // Trailers: linked at the record's revision when the commit was made, so later changes show as suspect.
    const resolveRef = ref => {
      const story = /^S(\d+)$/.exec(ref); if (story) return stories.find(item => item.number === Number(story[1]));
      const spec = /^SPEC-(\d+)(?:\/.*)?$/.exec(ref); if (spec) return specs.find(item => item.number === Number(spec[1]));
      return null;
    };
    for (const commit of readTrailerCommits(root)) {
      for (const ref of commit.refs) {
        const record = resolveRef(ref);
        if (!record) continue;
        for (const key of commit.units) if (keep.has(unitId(projectId, key))) link(projectId, record.id, unitId(projectId, key), { kind: 'implements', source: 'trailer', revision: know.revisionAt(record.id, commit.committedAt) || record.revision, workRef: commit.work });
      }
    }
    return { units: units.length, indexedAt: indexed };
  }

  // The scaffold's manifest: { path, symbol, recordIds, derived } for everything it generated.
  function recordManifest(projectId, manifest, commit) {
    const missing = [];
    for (const entry of manifest) {
      const unit = db.prepare('SELECT id FROM code_units WHERE project_id = ? AND unit_key = ?').get(projectId, `${entry.path}#${entry.symbol}`);
      if (!unit) { missing.push(`${entry.path}#${entry.symbol}`); continue; }
      for (const recordId of entry.recordIds) link(projectId, recordId, unit.id, { kind: 'generated', source: 'manifest', derived: Boolean(entry.derived) });
    }
    closeResolved(projectId, commit);
    return { missing };
  }

  // healthy: reachable and traced · suspect: an upstream record changed · untraced: reachable, no link · dead: unreachable, no live link
  function snapshot(projectId) {
    const units = unitRows(projectId);
    const links = linkRows(projectId);
    const calledBy = new Map();
    for (const unit of units) for (const callee of parse(unit.calls_json, [])) calledBy.set(callee, [...(calledBy.get(callee) || []), unit.id]);
    const revisions = new Map();
    const current = id => { if (!revisions.has(id)) revisions.set(id, know.get(projectId, id)?.revision ?? null); return revisions.get(id); };
    return {
      indexedAt: units[0]?.indexed_at || null,
      units: units.map(unit => {
        const own = links.filter(item => item.unit_id === unit.id).map(item => ({ recordId: item.record_id, revision: item.record_revision, currentRevision: current(item.record_id), kind: item.kind, source: item.source, state: item.state, workRef: item.work_ref }));
        const state = own.some(item => item.state === 'suspect') ? 'suspect' : own.length ? 'healthy' : unit.reachable ? 'untraced' : 'dead';
        return { id: unit.id, path: unit.path, symbol: unit.symbol, kind: unit.kind, line: unit.line, endLine: unit.end_line ?? unit.line, reachable: Boolean(unit.reachable), lastCommit: unit.last_commit, calls: parse(unit.calls_json, []), calledBy: calledBy.get(unit.id) || [], state, links: own };
      })
    };
  }

  // "Built by" for the layers above Platform: counts only.
  function builtBy(projectId) {
    const summary = new Map();
    const kinds = new Map(unitRows(projectId).map(unit => [unit.id, unit.kind]));
    for (const item of linkRows(projectId)) {
      const entry = summary.get(item.record_id) || { units: 0, tests: 0, suspect: false, shipped: false };
      if (kinds.get(item.unit_id) === 'test') entry.tests++; else entry.units++;
      if (item.state === 'suspect') entry.suspect = true;
      summary.set(item.record_id, entry);
    }
    return summary;
  }

  function reconcileContext(projectId, item) {
    const reconcile = item.context?.reconcile;
    if (!reconcile) return null;
    const before = know.revisionData(reconcile.recordId, reconcile.fromRevision) || {};
    const after = know.revisionData(reconcile.recordId, reconcile.toRevision) || {};
    const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map(key => ({ field: key, before: before[key] ?? null, after: after[key] ?? null }));
    const code = snapshot(projectId).units;
    const linked = code.filter(unit => unit.links.some(entry => entry.recordId === reconcile.recordId));
    const byId = new Map(code.map(unit => [unit.id, unit]));
    const name = id => byId.get(id) ? `${byId.get(id).symbol} (${byId.get(id).path})` : id;
    return { ...reconcile, changes, units: linked.map(unit => ({ id: unit.id, symbol: unit.symbol, path: unit.path, kind: unit.kind, calls: unit.calls.map(name), calledBy: unit.calledBy.map(name) })),
      tests: code.filter(unit => unit.kind === 'test' && (unit.links.some(entry => entry.recordId === reconcile.recordId) || unit.calls.some(id => linked.some(other => other.id === id)))).map(unit => unit.symbol) };
  }

  return { index, recordManifest, snapshot, builtBy, reconcileContext, link };
}

export const workspaceIsIndexable = root => existsSync(root) && statSync(root).isDirectory() && sourceDirectories.some(directory => existsSync(join(root, directory)));
