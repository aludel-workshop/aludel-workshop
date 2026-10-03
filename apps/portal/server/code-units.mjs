// Code units (LAY-07D): the functions, components, handlers, tables and tests a project's code is made of, read from the
// workspace with the TypeScript parser, with their references and whether anything reaches them. Code links to knowledge
// records were removed on 2026-10-02 (docs/design/code-tracing/deferred.md); units are code structure, not tracing.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { indexSources } from './source-units.mjs';

const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const sourceDirectories = ['src', 'server', 'tests'];
const entryFiles = ['src/main.ts', 'server/server.mjs'];
const isTestFile = path => /(^|\/)tests?\/|\.(test|spec)\.[cm]?[jt]s$/.test(path);
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });

export function initCodeUnits(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_units (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), unit_key TEXT NOT NULL, path TEXT NOT NULL, symbol TEXT NOT NULL,
      kind TEXT NOT NULL, hash TEXT NOT NULL, reachable INTEGER NOT NULL, last_commit TEXT, line INTEGER, calls_json TEXT NOT NULL,
      indexed_at TEXT NOT NULL, UNIQUE(project_id, unit_key)
    );
    DROP TABLE IF EXISTS trace_links;
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
// The parsing itself is the host's index library (source-units.mjs), which also indexes a commit for a layer's indexer.
export function indexWorkspace(root) {
  return indexSources(Object.fromEntries(sourceFiles(root).map(path => [path, readFileSync(join(root, path), 'utf8')])), { entries: entryFiles });
}

export function codeUnits({ db }) {
  const unitRows = projectId => db.prepare('SELECT * FROM code_units WHERE project_id = ? ORDER BY path, line').all(projectId);
  const unitId = (projectId, key) => `cu-${hash(`${projectId}:${key}`).slice(0, 12)}`;

  // Stores the units read from a workspace (or, with Code as a template, the units the host parsed at the layer's pin).
  function index(projectId, root, { units = indexWorkspace(root) } = {}) {
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
    for (const stale of unitRows(projectId).filter(row => !keep.has(row.id))) db.prepare('DELETE FROM code_units WHERE id = ?').run(stale.id);
    return { units: units.length, indexedAt: indexed };
  }

  // The units with who calls them. `state` and `links` stay in the shape views compiled before tracing was removed expect:
  // a unit is current when something reaches it and unused when nothing does, and it has no links.
  function snapshot(projectId) {
    const units = unitRows(projectId);
    const calledBy = new Map();
    for (const unit of units) for (const callee of parse(unit.calls_json, [])) calledBy.set(callee, [...(calledBy.get(callee) || []), unit.id]);
    return {
      indexedAt: units[0]?.indexed_at || null,
      units: units.map(unit => ({ id: unit.id, path: unit.path, symbol: unit.symbol, kind: unit.kind, line: unit.line, endLine: unit.end_line ?? unit.line, reachable: Boolean(unit.reachable),
        lastCommit: unit.last_commit, calls: parse(unit.calls_json, []), calledBy: calledBy.get(unit.id) || [], state: unit.reachable ? 'healthy' : 'dead', links: [] }))
    };
  }

  return { index, snapshot, unitId };
}

export const workspaceIsIndexable = root => existsSync(root) && statSync(root).isDirectory() && sourceDirectories.some(directory => existsSync(join(root, directory)));
