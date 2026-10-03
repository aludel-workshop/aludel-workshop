// Code and Deploy layers (PLATFORM-UX-01): what the repository holds, read-only. Tracked files and their source, the
// stack from the app's own manifests, the docs tree developers and agents read (AGENTS.md as the map, provenance in a
// sidecar), explicit releases recorded against a commit, and the variables the app declares in .env.example.
// Nothing here writes to GitHub. Starter docs are written into the workspace only where no file exists yet.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, posix } from 'node:path';
import { randomBytes } from 'node:crypto';
import { docChecks } from './doc-checks.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
const fileLimit = 256 * 1024;
const binary = /\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|pdf|zip|gz|sqlite|db)$/i;
export const sidecarPath = 'docs/.aludel/sources.json';

export function initCodeLayer(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS code_releases (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), version TEXT NOT NULL, commit_sha TEXT NOT NULL, notes TEXT NOT NULL,
    stories_json TEXT NOT NULL, stack_json TEXT NOT NULL, changes_json TEXT NOT NULL, migrations_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
    published_at TEXT, UNIQUE(project_id, version)
  )`);
  if (!db.prepare('PRAGMA table_info(code_releases)').all().some(column => column.name === 'url')) db.exec('ALTER TABLE code_releases ADD COLUMN url TEXT');
}

// ---- Files ----
export function trackedFiles(workspace) {
  if (!existsSync(join(workspace, '.git'))) return [];
  const result = git(workspace, ['ls-files', '-z']);
  if (result.status !== 0) return [];
  return result.stdout.split('\0').filter(Boolean).map(path => { let size = 0; try { size = statSync(join(workspace, path)).size; } catch { /* deleted in the work tree */ } return { path, size }; });
}
// Only tracked text files, inside the workspace, below the size limit. The .env file is never tracked, and never read.
export function readSource(workspace, path) {
  const clean = posix.normalize(String(path || '')).replace(/^\/+/, '');
  if (!clean || clean.startsWith('..') || /(^|\/)\.env$/.test(clean)) fail('That file is not available.', 404);
  if (!trackedFiles(workspace).some(file => file.path === clean)) fail('That file is not in the repository.', 404);
  if (binary.test(clean)) fail('That file is not text.', 415);
  const full = join(workspace, clean);
  if (!normalize(full).startsWith(normalize(workspace))) fail('That file is not available.', 404);
  const size = statSync(full).size;
  if (size > fileLimit) fail(`That file is ${Math.round(size / 1024)} KB; files over ${fileLimit / 1024} KB are not shown here.`, 413);
  return { path: clean, text: readFileSync(full, 'utf8'), size };
}

// ---- Stack: read from the app's own manifests, never typed ----
const readText = (workspace, path) => { try { return readFileSync(join(workspace, path), 'utf8'); } catch { return null; } };
export function readStack(workspace, files = trackedFiles(workspace)) {
  const pkg = parse(readText(workspace, 'package.json'), null);
  const dockerfile = readText(workspace, 'Dockerfile');
  const compose = readText(workspace, 'compose.yaml') ?? readText(workspace, 'docker-compose.yml');
  const languages = {};
  const extensions = { ts: 'TypeScript', mjs: 'JavaScript', js: 'JavaScript', html: 'HTML', scss: 'SCSS', css: 'CSS', sql: 'SQL', md: 'Markdown', json: 'JSON' };
  for (const file of files) { const language = extensions[file.path.split('.').pop()]; if (language && language !== 'JSON' && language !== 'Markdown') languages[language] = (languages[language] || 0) + file.size; }
  return {
    name: pkg?.name || null, version: pkg?.version || null, node: pkg?.engines?.node || null,
    dependencies: Object.entries(pkg?.dependencies || {}).map(([name, version]) => ({ name, version, dev: false })),
    devDependencies: Object.entries(pkg?.devDependencies || {}).map(([name, version]) => ({ name, version, dev: true })),
    scripts: Object.keys(pkg?.scripts || {}),
    images: dockerfile ? [...dockerfile.matchAll(/^FROM\s+(\S+)/gim)].map(match => match[1]) : [],
    healthcheck: dockerfile ? /^HEALTHCHECK/im.test(dockerfile) : false,
    composeServices: compose ? [...compose.matchAll(/^ {2}([a-z0-9_-]+):\s*$/gim)].map(match => match[1]) : [],
    ci: files.filter(file => file.path.startsWith('.github/workflows/')).map(file => file.path),
    languages: Object.entries(languages).sort((a, b) => b[1] - a[1]).map(([name, bytes]) => ({ name, bytes }))
  };
}

// ---- Variables the app declares: names (and container defaults) from .env.example, comments as descriptions ----
export function readVariables(workspace) {
  const text = readText(workspace, '.env.example');
  if (text === null) return { declared: false, variables: [] };
  const variables = []; let comment = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) { comment.push(trimmed.replace(/^#\s?/, '')); continue; }
    const match = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (match) { const description = comment.join(' '); variables.push({ name: match[1], value: match[2], description, secret: /secret|password|token|key/i.test(`${match[1]} ${description}`) }); }
    comment = [];
  }
  return { declared: true, variables };
}

// ---- Docs: AGENTS.md is the map, docs/ the system of record; the sidecar records where each section came from ----
const docFile = path => path === 'AGENTS.md' || path === 'ARCHITECTURE.md' || path === 'README.md' || (path.startsWith('docs/') && !path.startsWith('docs/.aludel/') && /\.(md|txt)$/.test(path));
// Docs on disk, tracked or not yet committed (a starter set is committed with the next build).
function docsOnDisk(workspace, folder = 'docs') {
  const full = join(workspace, folder);
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? docsOnDisk(workspace, `${folder}/${entry.name}`) : [`${folder}/${entry.name}`]);
}
export function readDocs(workspace, revisionOf, files = trackedFiles(workspace)) {
  const onDisk = path => existsSync(join(workspace, path));
  const paths = [...new Set([...files.map(file => file.path), ...docsOnDisk(workspace), ...['AGENTS.md', 'ARCHITECTURE.md', 'README.md'].filter(onDisk)].filter(docFile))].filter(onDisk).sort();
  const sidecar = parse(readText(workspace, sidecarPath), {});
  const agents = readText(workspace, 'AGENTS.md') || '';
  // The checks are the ones Knowledge runs on every layer's docs (doc-checks.mjs).
  const report = docChecks(paths.map(path => ({ path, text: readText(workspace, path) ?? '' })), { exists: onDisk, sidecar, mapPath: 'AGENTS.md', map: agents, revisionOf });
  const docs = report.docs.map(doc => { const text = readText(workspace, doc.path) ?? ''; return { path: doc.path, lines: text ? text.split('\n').length : 0, text: text.length > fileLimit ? text.slice(0, fileLimit) : text, sections: doc.sections, onMap: doc.onMap, broken: doc.broken }; });
  return { docs, sidecar: existsSync(join(workspace, sidecarPath)), agentsLines: agents ? agents.split('\n').length : 0,
    checks: report.checks };
}

// A starting docs tree from the layers. Developers own the docs, so an existing file is never overwritten; AGENTS.md
// only gains a "Where to look" section when it has none.
export function starterDocs(workspace, { project, stories, personas, objects, operations, tokens, components, stack }) {
  const files = {}; const sources = {};
  const cite = (path, heading, list) => { (sources[path] ||= {})[heading] = list.map(record => [record.kind, record.id, record.revision]); };
  const add = (path, title, parts) => { files[path] = `# ${title}\n\n${parts.map(([heading, body, cited]) => { cite(path, heading, cited); return `## ${heading}\n\n${body.trim()}\n`; }).join('\n')}`; cite(path, title, []); };
  const top = [['src/', 'Web app', 'what people use in the browser'], ['server/', 'API server', 'answers /api and stores records'], ['db/', 'Database migrations', 'numbered SQL that creates the tables'], ['tests/', 'Tests', 'checks run on every change']];
  const tracked = new Set(trackedFiles(workspace).map(file => file.path.split('/')[0] + '/'));
  add('ARCHITECTURE.md', 'Architecture', [
    ['Parts', top.filter(([folder]) => tracked.has(folder)).map(([folder, name, what]) => `- **${name}** (\`${folder}\`): ${what}.`).join('\n') + '\n- **Container**: `Dockerfile` builds one image; `compose.yaml` runs it anywhere.', []],
    ['Stack', [...stack.dependencies, ...stack.devDependencies].map(entry => `- ${entry.name} ${entry.version}${entry.dev ? ' (build and test)' : ''}`).join('\n') || 'Nothing declared in package.json yet.', []],
    ['Data', objects.length ? objects.map(object => `- **${object.name}**: ${object.description || 'no description yet'}`).join('\n') + '\n\nThe contracts are in `docs/data/objects.md`.' : 'No Data objects yet.', objects]]);
  add('docs/product/index.md', `${project.name}: who it is for`, [
    ['Who it is for', personas.map(persona => `- **${persona.name}**, ${persona.role}${persona.note ? `: ${persona.note}` : ''}`).join('\n') || 'No personas yet.', personas],
    ['Stories', stories.map(story => `- ${story.ref} ${story.title}`).join('\n') + '\n\nEach story\'s acceptance is in `stories.md`.', stories]]);
  add('docs/product/stories.md', 'Stories and their acceptance', stories.map(story => [`${story.ref} ${story.title}`,
    `${story.why || ''}\n\n${(story.acceptance || []).map((scenario, index) => `- **${story.ref}/${index + 1}** Given ${scenario.given}, when ${scenario.when}, then ${scenario.then}.`).join('\n') || 'No acceptance yet.'}${story.acceptance?.length ? `\n\nName a test after the scenario it checks: \`${story.ref}/1 · …\`.` : ''}`, [story]]));
  add('docs/design/DESIGN.md', 'Design', [
    ['Tokens', `Use the design tokens in \`design/tokens.json\` through the theme's CSS variables. Never hard-code a colour.`, tokens ? [tokens] : []],
    ['Components', components.map(component => `- **${component.name}** (${component.status}): ${component.purpose || ''}`).join('\n') || 'None yet.', components]]);
  add('docs/data/objects.md', 'Data objects', objects.map(object => [object.name, `${object.description || ''}\n\n${Object.entries(object.schema?.properties || {}).map(([name, field]) => `- \`${name}\`${(object.schema?.required || []).includes(name) ? ' (required)' : ''}: ${field.type || 'object'}${field.description ? `, ${field.description}` : ''}`).join('\n') || 'No fields yet.'}`, [object]]));
  add('docs/data/api.md', 'API', [['Operations', operations.map(op => `- \`${op.method} ${op.path}\` (${op.operationId}): ${op.summary}`).join('\n') || 'None yet.', operations]]);
  const written = [];
  for (const [path, body] of Object.entries(files)) {
    if (existsSync(join(workspace, path))) continue;
    mkdirSync(dirname(join(workspace, path)), { recursive: true }); writeFileSync(join(workspace, path), body); written.push(path);
  }
  // The map names every doc there is, including ones the scaffold or a developer wrote, so none is off the map.
  const described = { 'ARCHITECTURE.md': 'the parts, the stack and the data', 'docs/product/': "who it is for, and each story's acceptance", 'docs/design/DESIGN.md': 'tokens and components', 'docs/data/': 'objects and the API', 'README.md': 'what it is and how to run it' };
  const others = [...new Set([...trackedFiles(workspace).map(file => file.path), ...docsOnDisk(workspace)])].filter(docFile).filter(path => path !== 'AGENTS.md' && !Object.keys(described).some(key => key.endsWith('/') ? path.startsWith(key) : path === key)).sort();
  const map = `## Where to look\n\nThis file is the map; the docs hold the detail.\n\n${Object.entries(described).filter(([key]) => existsSync(join(workspace, key))).map(([key, what]) => `- \`${key}\`: ${what}`).join('\n')}${others.map(path => `\n- \`${path}\``).join('')}\n`;
  const agents = readText(workspace, 'AGENTS.md');
  if (agents === null) { writeFileSync(join(workspace, 'AGENTS.md'), `# ${project.name}\n\n${map}`); written.push('AGENTS.md'); }
  else if (!/^## Where to look\b/m.test(agents)) { writeFileSync(join(workspace, 'AGENTS.md'), `${agents.trimEnd()}\n\n${map}`); written.push('AGENTS.md'); }
  else {
    // The map exists (the scaffold writes one): add a line for each new doc it doesn't name yet, at the end of its list.
    const missing = written.filter(path => !agents.includes(path)).map(path => `- \`${path}\`${described[path] ? `: ${described[path]}` : ''}`);
    if (missing.length) {
      const start = agents.search(/^## Where to look\b/m); const next = agents.slice(start + 1).search(/^## /m);
      const end = next < 0 ? agents.length : start + 1 + next;
      const section = agents.slice(start, end).trimEnd(); const lastItem = section.lastIndexOf('\n- ');
      const cut = lastItem < 0 ? section.length : section.indexOf('\n', lastItem + 1) < 0 ? section.length : section.indexOf('\n', lastItem + 1);
      writeFileSync(join(workspace, 'AGENTS.md'), `${agents.slice(0, start)}${section.slice(0, cut)}\n${missing.join('\n')}${section.slice(cut)}\n\n${agents.slice(end).replace(/^\n+/, '')}`.replace(/\n{3,}/g, '\n\n'));
      written.push('AGENTS.md');
    }
  }
  const sidecar = parse(readText(workspace, sidecarPath), {});
  for (const path of written) if (sources[path]) sidecar[path] = sources[path];
  mkdirSync(dirname(join(workspace, sidecarPath)), { recursive: true }); writeFileSync(join(workspace, sidecarPath), `${JSON.stringify(sidecar, null, 2)}\n`);
  return { written };
}

// ---- Releases: made on purpose, against one commit. Publishing to GitHub (tag, Release, Packages) is a separate, authorized step ----
const semver = /^(\d+)\.(\d+)\.(\d+)$/;
const newer = (a, b) => { const x = semver.exec(a).slice(1).map(Number); const y = semver.exec(b).slice(1).map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
function packageAt(workspace, commit) { if (!commit) return {}; const result = git(workspace, ['show', `${commit}:package.json`]); const pkg = result.status === 0 ? parse(result.stdout, {}) : {}; return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }; }
// What changed between two commits: package versions and new migration files. The first release has nothing to compare.
export function releaseChanges(workspace, from, to = 'HEAD') {
  const before = packageAt(workspace, from); const after = packageAt(workspace, to);
  const changes = from ? [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().filter(name => before[name] !== after[name]).map(name => ({ name, from: before[name] || null, to: after[name] || null })) : [];
  const added = git(workspace, from ? ['diff', '--name-only', '--diff-filter=A', `${from}..${to}`] : ['ls-tree', '-r', '--name-only', to]);
  const migrations = added.status === 0 ? added.stdout.split('\n').filter(path => /(^|\/)migrations\/[^/]+\.sql$/.test(path)) : [];
  return { stack: after, changes, migrations };
}
// `releasesOf(projectId)`, newest first, replaces the table when the releases live in the Code layer's repository (T03-CODE).
export function codeReleases({ db, releasesOf = null }) {
  const row = entry => entry && { id: entry.id, version: entry.version, commit: entry.commit_sha, notes: entry.notes, stories: parse(entry.stories_json, []), stack: parse(entry.stack_json, {}), changes: parse(entry.changes_json, []),
    migrations: parse(entry.migrations_json, []), createdBy: entry.created_by, createdAt: entry.created_at, publishedAt: entry.published_at, url: entry.url || null };
  const list = projectId => (releasesOf && releasesOf(projectId)) || db.prepare('SELECT * FROM code_releases WHERE project_id = ? ORDER BY created_at DESC').all(projectId).map(row);
  // What the next release would hold: commits since the last release, stack and migration changes. The first release has
  // nothing to compare with. `stories` stays empty: releases no longer name shipped stories (code tracing was removed).
  function draft(projectId, workspace) {
    if (!existsSync(join(workspace, '.git'))) return null;
    const head = git(workspace, ['rev-parse', '--short', 'HEAD']).stdout.trim();
    if (!head) return null;
    const last = list(projectId)[0] || null;
    const range = last ? [`${last.commit}..HEAD`] : ['HEAD'];
    // Commits that only touch Aludel's own files (.aludel/: the Code layer's links, releases and definition) aren't app changes.
    const log = git(workspace, ['log', ...range, '--format=%h%x1f%s%x1f%(trailers:key=Aludel-Work,valueonly,separator=%x2C)%x1e', '--', '.', ':(exclude).aludel']);
    const commits = log.status === 0 ? log.stdout.split('\x1e').map(item => item.trim()).filter(Boolean).map(item => { const [hash, subject, work] = item.split('\x1f'); return { hash, subject, work: work.trim() || null }; }) : [];
    const { stack: after, changes, migrations } = releaseChanges(workspace, last?.commit || null);
    const base = last?.version || '0.0.0';
    const [major, minor, patch] = semver.exec(base).slice(1).map(Number);
    const suggested = !last ? '0.1.0' : migrations.length ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
    return { head, since: last ? { version: last.version, commit: last.commit } : null, commits, stories: [], changes, migrations, suggested, stack: after };
  }
  function record(projectId, workspace, { version, notes }, author) {
    const value = String(version || '').trim().replace(/^v/, '');
    if (!semver.test(value)) fail('Use a version like 1.2.3.');
    const next = draft(projectId, workspace);
    if (!next) fail('There is no repository to release from yet.', 409);
    const last = list(projectId)[0];
    if (last && !newer(value, last.version)) fail(`The version must be newer than v${last.version}.`);
    if (last && !next.commits.length) fail(`Nothing has changed since v${last.version}.`, 409);
    const id = `crl-${randomBytes(4).toString('hex')}`;
    db.prepare('INSERT INTO code_releases(id, project_id, version, commit_sha, notes, stories_json, stack_json, changes_json, migrations_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, projectId, value, next.head, String(notes || '').slice(0, 4000), JSON.stringify(next.stories), JSON.stringify(next.stack), JSON.stringify(next.changes), JSON.stringify(next.migrations), author, now());
    return row(db.prepare('SELECT * FROM code_releases WHERE id = ?').get(id));
  }
  const fullSha = (workspace, ref) => { const result = git(workspace, ['rev-parse', '--verify', `${ref}^{commit}`]); if (result.status !== 0) fail('That commit is not in the repository.', 404); return result.stdout.trim(); };
  function markPublished(projectId, version, url) {
    db.prepare('UPDATE code_releases SET published_at = ?, url = ? WHERE project_id = ? AND version = ?').run(now(), url, projectId, version);
    return list(projectId).find(entry => entry.version === version);
  }
  return { list, draft, record, fullSha, markPublished };
}
