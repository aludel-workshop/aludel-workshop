// LAYER-BASE-01 B6: each installed layer's own views are built from its repository's pinned `main` and served from a
// separate origin into a sandboxed frame. A build is keyed by what it compiles (the manifest's ui declaration and the
// bytes of its files), the layer key and the portal's frame SDK, so instances with the same views share it, and a commit
// that changes only docs or the spec (LAYER-KNOWLEDGE-01) reuses the build. The frame has no network and no portal session: the portal page carries the
// calls it allows (see frameAllows) with the person's session.
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layerPackageForProject } from './layer-package.mjs';

const portal = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdkFiles = ['src/frame/frame-context.ts', 'src/frame/frame-main.ts', 'src/frame/index.html', 'src/layers/context.ts', 'src/layers/built-by.ts', 'src/layers/design-components.ts',
  'src/layers/design-state.ts', 'src/layers/evidence.ts', 'src/layers/work-shared.ts', 'src/avatars.ts', 'src/page-blocks.ts', 'src/design-tokens.js', 'src/color.js', 'src/app-kit/index.ts', 'src/app-kit/kit.ts',
  'src/app-kit/kit-render.ts', 'src/app-kit/theme-scope.ts', 'src/layers/doc-view.ts', 'src/layers/markdown.ts', 'src/styles.scss', 'src/layers/host-theme.scss', 'tools/build-layer-ui.mjs'];
const sdkDigest = createHash('sha256').update(sdkFiles.map(path => readFileSync(join(portal, path))).join('\0')).digest('hex').slice(0, 16);
const building = new Map(), failed = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };

// Each instance's views are served from `i-<instance>.layers.<base>`: a real origin of their own, so a nested app preview
// keeps its origin and one layer's browser storage never meets another's; the portal's session cookie is host-only.
export const frameLabel = instanceId => `i-${String(instanceId).replace(/-/g, '')}`;
export function layerUi({ dataDirectory, layerOrigin, portalOrigin, portalOrigins = [portalOrigin], layerOriginsPattern = null, appOriginFor = () => null }) {
  const cacheRoot = resolve(dataDirectory, 'layer-ui');
  const sources = new Map();
  const viewsDigest = (repo, commit, ui, root = '') => {
    const cached = sources.get(`${repo}@${commit}`);
    if (cached) return cached;
    const blobs = execFileSync('git', ['-C', repo, 'rev-parse', ...ui.files.map(path => `${commit}:${root}${path}`)], { encoding: 'utf8' }).trim();
    const value = createHash('sha256').update(`${JSON.stringify(ui)}\0${blobs}`).digest('hex');
    sources.set(`${repo}@${commit}`, value);
    return value;
  };
  const buildKey = (pkg, key) => createHash('sha256').update(`${viewsDigest(pkg.repo, pkg.commit, pkg.manifest.ui, pkg.root)}\0${key}\0${sdkDigest}`).digest('hex').slice(0, 32);

  function start(repo, commit, key, id) {
    if (building.has(id)) return building.get(id);
    const out = join(cacheRoot, id), staging = `${out}.building`;
    const job = new Promise(resolveJob => {
      rmSync(staging, { recursive: true, force: true });
      const child = spawn(process.execPath, [join(portal, 'tools/build-layer-ui.mjs'), repo, commit, key, staging], { cwd: portal, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('close', status => {
        building.delete(id);
        if (status === 0 && existsSync(join(staging, 'index.html'))) { rmSync(out, { recursive: true, force: true }); renameSync(staging, out); failed.delete(id); }
        else { rmSync(staging, { recursive: true, force: true }); failed.set(id, stderr.split('\n').filter(line => /error/i.test(line)).slice(0, 3).join(' ').slice(0, 400) || 'The layer views did not build.'); }
        resolveJob();
      });
    });
    building.set(id, job);
    return job;
  }

  // The views of this layer instance at its pinned commit: ready (with the frame URL), building, failed, or none.
  function status(db, projectId, key, { build = true } = {}) {
    let pkg;
    try { pkg = layerPackageForProject(db, projectId, key); } catch { return { status: 'none' }; }
    if (!pkg?.manifest?.ui?.entry) return { status: 'none' };
    const id = buildKey(pkg, key);
    const instance = db.prepare('SELECT instance_id FROM layer_instances WHERE project_id = ? AND layer_key = ?').get(projectId, key)?.instance_id;
    if (existsSync(join(cacheRoot, id, 'index.html'))) return { status: 'ready', url: `${layerOrigin(frameLabel(instance))}/${id}/index.html`, commit: pkg.commit };
    if (failed.has(id) && !building.has(id)) return { status: 'failed', error: failed.get(id), commit: pkg.commit };
    if (build) void start(pkg.repo, pkg.commit, key, id);
    return { status: 'building', commit: pkg.commit, id };
  }
  const settle = (db, projectId, key) => { const value = status(db, projectId, key); return value.status === 'building' ? building.get(value.id) : Promise.resolve(); };

  // The layers origin serves only built views, sandboxed even when opened directly, and loadable from an opaque origin.
  function serve(request, response, pathname, label) {
    const match = /^\/([0-9a-f]{32})\/(.+)$/.exec(pathname);
    const base = match && resolve(cacheRoot, match[1]);
    const file = match && resolve(base, normalize(match[2]));
    if (!match || !file.startsWith(base + sep) || !existsSync(file) || !statSync(file).isFile() || request.method !== 'GET') {
      response.writeHead(404, { 'content-type': 'text/plain' }); return response.end('Not found');
    }
    const ext = extname(file), body = readFileSync(file);
    const headers = { 'content-type': types[ext] || 'application/octet-stream', 'content-length': body.length, 'x-content-type-options': 'nosniff',
      'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' };
    // Sandboxed even when opened directly; no network, forms or top navigation; may embed only its own project's app.
    const app = appOriginFor(label);
    if (ext === '.html') headers['content-security-policy'] = `sandbox allow-scripts allow-forms allow-same-origin allow-downloads; default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; ` +
      `font-src 'self'; img-src blob: data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'self'${app ? ` ${app}` : ''}; frame-ancestors ${portalOrigins.join(' ')}`;
    response.writeHead(200, headers);
    response.end(body);
  }
  // W-29 (DEC-070): a stage for a file the layer published, on the layer instance's own origin, so the portal (or the layer's
  // own views) can frame it under the same sandbox as the views. The digest names one version of the file; the stage loads it
  // and nothing else, with no network. `file` is { body, type } for this instance's project, or null.
  function servePublished(request, response, pathname, label, fileFor) {
    const match = /^\/published\/([0-9a-f]{20})\/(stage\.html|[a-z][a-z0-9-]*\.js)$/.exec(pathname);
    const url = new URL(request.url, 'http://x');
    const name = match?.[2] === 'stage.html' ? url.searchParams.get('src') || '' : match?.[2];
    const file = match && request.method === 'GET' && /^[a-z][a-z0-9-]*\.js$/.test(name || '') ? fileFor(label, name, match[1]) : null;
    if (!file) { response.writeHead(404, { 'content-type': 'text/plain' }); return response.end('Not found'); }
    const ancestors = `${portalOrigins.join(' ')} ${layerOriginsPattern || ''}`.trim();
    if (match[2] !== 'stage.html') {
      response.writeHead(200, { 'content-type': file.type, 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin', 'cache-control': 'private, max-age=31536000, immutable' });
      return response.end(file.body);
    }
    const body = `<!doctype html>\n<html lang="en" data-kit-stage><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Stage</title>`
      + `<style>body{margin:0;padding:16px;background:var(--mat-sys-surface,#fff);color:var(--mat-sys-on-surface,#111);font:var(--mat-sys-body-medium,14px system-ui)}`
      + `.stage-grid{display:grid;gap:12px 16px;align-items:center}.stage-label{font:var(--mat-sys-label-medium,12px system-ui);color:var(--mat-sys-on-surface-variant,#555)}</style>`
      + `<script src="${name}"></script></head><body></body></html>\n`;
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache',
      'content-security-policy': `sandbox allow-scripts allow-same-origin; default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors ${ancestors}` });
    return response.end(body);
  }
  return { status, settle, serve, servePublished, buildKey };
}

// Host features a layer's views may ask for by name (`hostCalls` in layer.json), each fixed to its routes here. A layer
// cannot add a route: it can only request a feature the host defines, and the manifest change is reviewed like any other.
export const hostFeatures = Object.freeze({
  pageChanges: [['POST', /^\/pages\/change$/], ['POST', /^\/pages\/review$/]],
  skeleton: [['POST', /^\/skeleton$/]],
  documents: [['POST', /^\/docs(?:\/[^/]+)?$/]],
  // T03-DESIGN: uploading an image the layer's records point at.
  uploads: [['POST', /^\/assets$/]],
  // The Library's own records a layer's views may write through the generic record routes: shared documents and the links
  // that reference a source or finding from a record. The kinds are fixed here; a layer can only ask for the feature.
  libraryRecords: [],
  // T03-CODE: a layer whose repository is a codebase. Reading its tracked source at the pin, settling with the repository
  // (a build's newer commit, or GitHub's), drafting and recording releases, publishing one to GitHub, the CI results for a
  // commit, and route observations (host data until LAYER-BINDINGS-01 step 4).
  repositorySource: [['GET', /^\/code\/files$/], ['GET', /^\/code\/file$/]],
  repositorySync: [['GET', /^\/layers\/[a-z][a-z0-9_]*\/sync$/], ['POST', /^\/layers\/[a-z][a-z0-9_]*\/sync$/]],
  releaseDrafts: [['GET', /^\/code\/releases$/], ['POST', /^\/code\/releases$/]],
  releasePublishing: [['POST', /^\/code\/releases-publish$/]],
  ciResults: [['GET', /^\/code\/ci$/]],
  routeObservations: [['GET', /^\/layers\/code\/route-observations$/], ['POST', /^\/layers\/code\/route-observations$/]]
});
export const hostRecordFeatures = Object.freeze({ libraryRecords: Object.freeze(['doc', 'evidence_link']) });
// What the portal page may do for a layer's frame, checked on the server for every call it carries. Reads of the project
// the person can already see, including the Library (DEC-059); this layer's own API, records and output files; creating
// Work; and the host features this layer's manifest requests. Everything else is refused.
export function frameAllows({ key, projectId, method, pathname, features = [] }) {
  const project = `/api/projects/${encodeURIComponent(projectId)}`;
  if (!pathname.startsWith(project + '/')) return false;
  const rest = pathname.slice(project.length);
  // LAYER-BINDINGS-01 R4: the roles of this layer's own facets (the server reads the layer from the frame), and proposing
  // a change to a replica or ceded entry, which becomes Work in the authority's layer.
  if (method === 'POST' && rest === '/roles/propose') return true;
  // Reads, plus this layer's own Knowledge docs (T03-CODE: Code's Overview counts the app's docs and their checks).
  if (method === 'GET' && (rest === '/roles' || rest === '/knowledge' || rest === '/layer-instances' || rest === '/library' || rest === '/library/entry' || /^\/assets\/[^/]+$/.test(rest)
    || rest === `/layers/${key}/api` || rest === `/layers/${key}/files` || rest === `/layers/${key}/knowledge/docs`
    // W-29: the files this layer publishes from its records, and where its stage shows them.
    || new RegExp(`^/layers/${key}/publish/[a-z][a-z0-9-]*\\.(?:js|css|json)(?:/stage)?$`).test(rest))) return true;
  if (/^\/records(?:\/[^/]+)?$/.test(rest)) return ['POST', 'PUT', 'DELETE'].includes(method);
  if (method === 'POST' && new RegExp(`^/layers/${key}/api/[A-Za-z][A-Za-z0-9]*$`).test(rest)) return true;
  if (method === 'POST' && rest === '/work') return true;
  // T03-G2: this layer's own output files, read and edited by the person using its views.
  if (method === 'PUT' && rest === `/layers/${key}/files`) return true;
  for (const name of features) for (const [allowed, pattern] of hostFeatures[name] || []) if (method === allowed && pattern.test(rest) && (!/^\/layers\/[^/]+\/sync$/.test(rest) || rest === `/layers/${key}/sync`)) return true;
  return false;
}
