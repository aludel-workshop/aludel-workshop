// LAYER-KNOWLEDGE-01 S2: a layer's docs and spec live in its own repository, read at the instance's pin. A person who may
// manage the layer edits them in Knowledge, and Save takes at once: one commit on `main` that becomes the new pin, so every
// earlier version stays readable and comparable. Only documentation paths (`knowledge/*.md`) and the `information` tree of
// `layer.json` are written this way; anything that runs on the host still arrives as reviewed Work.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { editorTabs, packageAt } from './layer-package.mjs';
import { docChecks, sourcedSections } from './doc-checks.mjs';
import { charterFromFields, charterTemplate, projectLayerDefinition, saveLayerCharter } from './layer-registry.mjs';
import { layerBinding, refuseDirtySharedCheckout, settleLayerCheckout } from './layer-source.mjs';
import { flatten, validateInformation } from './information.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const git = (repo, args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options }).trimEnd();
const docPath = /^knowledge\/[a-z][a-z0-9-]*\.md$/;
const commitPattern = /^[0-9a-f]{40}$/;
const maxDoc = 60000;
// T03-CODE (G-CODE): docs the repository already keeps (an app's AGENTS.md and docs/), named in `knowledge.docs` by
// repository path. In Knowledge and the API they are written with a leading `/` (the repository root), so they can never be
// mistaken for the package's own `knowledge/*.md`.
const declaredDocs = manifest => manifest.knowledge?.docs || null;
const inDocs = (docs, path) => docs.paths.some(entry => entry.endsWith('/') ? path.startsWith(entry) : path === entry) || path === docs.map;
const repoDocPath = path => /^[A-Za-z0-9_][A-Za-z0-9_./-]*\.md$/.test(path) && !path.split('/').some(part => part === '..' || part.startsWith('.'));
function repositoryDocs(pkg) {
  const docs = declaredDocs(pkg.manifest);
  if (!docs) return [];
  return git(pkg.repo, ['ls-tree', '-r', '--name-only', pkg.commit]).split('\n')
    .filter(path => path && repoDocPath(path) && inDocs(docs, path) && !(pkg.root && path.startsWith(pkg.root))).sort();
}
// Where a doc lives in the repository: the package's own under its root, a repository doc at its path.
function located(pkg, path, { create = false } = {}) {
  if (docPath.test(path || '')) return pkg.root + path;
  const docs = declaredDocs(pkg.manifest);
  const inner = typeof path === 'string' && path.startsWith('/') ? path.slice(1) : null;
  if (docs && inner && repoDocPath(inner) && inDocs(docs, inner) && !(pkg.root && inner.startsWith(pkg.root)) && (create || repositoryDocs(pkg).includes(inner))) return inner;
  fail(docs ? `Choose one of this layer's docs: knowledge/*.md, or Markdown in ${[docs.map, ...docs.paths].filter(Boolean).map(entry => `/${entry}`).join(', ')}.` : 'Choose a knowledge/*.md document.');
}

// Commits `files` ({ path: content }) on top of `base` without touching any checkout; returns the commit.
function commitFiles(repo, base, files, message, author) {
  const scratch = mkdtempSync(join(tmpdir(), 'aludel-docs-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(scratch, 'index'), GIT_AUTHOR_NAME: author, GIT_AUTHOR_EMAIL: 'person@aludel.invalid', GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' };
    git(repo, ['read-tree', base], { env });
    for (const [path, content] of Object.entries(files)) {
      const blob = git(repo, ['hash-object', '-w', '--stdin'], { input: content });
      git(repo, ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
    }
    return git(repo, ['commit-tree', git(repo, ['write-tree'], { env }), '-p', base, '-m', message], { env });
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
const show = (repo, commit, path) => { try { return git(repo, ['show', `${commit}:${path}`]); } catch { return null; } };

export function layerDocs({ db, onSpecChange = () => {}, revisionOf = () => null }) {
  const member = (projectId, userId) => db.prepare('SELECT role FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId)?.role || fail('Project not found.', 404);
  const editor = (projectId, userId) => member(projectId, userId) === 'owner' || fail('Only the project owner edits a layer\'s docs.', 403);
  const custom = (projectId, key) => { const definition = projectLayerDefinition(db, projectId, key); return definition && !definition.builtIn ? definition : null; };
  const author = userId => db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId)?.display_name || 'Owner';
  const current = (projectId, key) => { const { repo, commit } = layerBinding(db, projectId, key); return { repo, commit, ...packageAt(repo, commit, key) }; };

  // Moves `main` and the pin from `base` to `next`, refusing if either moved meanwhile.
  function advance(projectId, key, repo, base, next, root = '') {
    const main = git(repo, ['rev-parse', 'refs/heads/main']);
    if (main !== base) fail('The layer repository\'s main branch is not at its pin; reconcile it first.', 409);
    refuseDirtySharedCheckout(repo, root);
    const clean = !git(repo, ['status', '--porcelain']);
    const moved = db.prepare('UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = ? AND accepted_commit = ?').run(next, projectId, key, base);
    if (!moved.changes) fail('The layer changed while saving. Reload and save again.', 409);
    git(repo, ['update-ref', 'refs/heads/main', next, base]);
    settleLayerCheckout({ clean, repo });
  }

  // Docs, by where they sit in Knowledge: the charter, method and other docs, each part's doc, and each editor tab's doc
  // (`knowledge/tab-<key>.md`, which may not exist yet: saving it creates it).
  function list(projectId, userId, key) {
    member(projectId, userId);
    const pkg = current(projectId, key);
    const { manifest } = pkg;
    const nodes = flatten(validateInformation(manifest, { tabs: editorTabs(manifest) }));
    const nodeDocs = new Set(nodes.map(node => node.doc).filter(Boolean));
    const titleOf = path => (show(pkg.repo, pkg.commit, pkg.root + path) || '').match(/^#\s+(.+)$/m)?.[1]?.trim() || path.slice(10, -3).replaceAll('-', ' ');
    const docs = [{ path: manifest.knowledge.charter, title: 'Charter', group: null, charter: true }];
    for (const path of manifest.knowledge.documents) if (!nodeDocs.has(path) && path !== manifest.knowledge.charter)
      docs.push({ path, title: titleOf(path), group: /-method\.md$/.test(path) ? 'Methods' : 'Docs' });
    const tabs = [...(manifest.tabs || []), ...(manifest.editorAdapter === 'markdown-editor' ? [{ key: 'files', label: 'Files' }] : [])];
    for (const tab of tabs) {
      const path = `knowledge/tab-${tab.key}.md`;
      docs.push({ path, title: tab.label, group: 'Editor tabs', tab: tab.key, exists: show(pkg.repo, pkg.commit, pkg.root + path) !== null,
        edits: nodes.filter(node => node.tab === tab.key).map(node => node.key) });
    }
    // Docs the repository keeps, then the checks over every doc that exists (T03-CODE G-CODE).
    const declared = declaredDocs(manifest);
    for (const path of repositoryDocs(pkg)) docs.push({ path: `/${path}`, title: (show(pkg.repo, pkg.commit, path) || '').match(/^#\s+(.+)$/m)?.[1]?.trim() || path,
      group: 'In the repository', map: path === declared.map });
    const report = check(projectId, pkg, docs.filter(doc => doc.exists !== false));
    for (const doc of docs) { const found = report.docs.find(item => item.path === doc.path); if (found) Object.assign(doc, { onMap: found.onMap, broken: found.broken.length, refresh: found.refresh }); }
    return { commit: pkg.commit, docs, checks: report.checks, ...(declared ? { repositoryDocs: { map: declared.map ? `/${declared.map}` : null, sources: declared.sources || null } } : {}) };
  }

  // Generic doc checks (doc-checks.mjs) for one layer at its pin: links resolve in the repository, sections with recorded
  // sources are current, and, when the layer declares a map, every repository doc is on it. Paths in and out are Knowledge
  // paths; links are resolved in the repository.
  const sidecars = new Map();
  function check(projectId, pkg, docs) {
    const tree = new Set(git(pkg.repo, ['ls-tree', '-r', '--name-only', pkg.commit]).split('\n'));
    const folders = new Set([...tree].flatMap(path => path.split('/').slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join('/'))));
    const declared = declaredDocs(pkg.manifest);
    const sidecarKey = `${pkg.repo}@${pkg.commit}`;
    if (!sidecars.has(sidecarKey)) { let value = null; try { value = declared?.sources ? JSON.parse(show(pkg.repo, pkg.commit, declared.sources) || 'null') : null; } catch { value = null; } sidecars.set(sidecarKey, value); }
    const sidecar = sidecars.get(sidecarKey);
    const repoPath = path => path.startsWith('/') ? path.slice(1) : pkg.root + path;
    const list = docs.map(doc => ({ path: repoPath(doc.path), text: show(pkg.repo, pkg.commit, repoPath(doc.path)) || '' }));
    const result = docChecks(list, { exists: path => tree.has(path) || folders.has(path.replace(/\/$/, '')), sidecar,
      mapPath: declared?.map || null, map: declared?.map ? show(pkg.repo, pkg.commit, declared.map) || '' : null, revisionOf: id => revisionOf(projectId, id) });
    // Only repository docs are held to the map; the package's own Knowledge is listed by the manifest.
    const back = path => pkg.root && path.startsWith(pkg.root) ? path.slice(pkg.root.length) : docPath.test(path) && !pkg.root ? path : `/${path}`;
    const checked = result.docs.map(doc => ({ ...doc, path: back(doc.path), onMap: back(doc.path).startsWith('/') ? doc.onMap : true }));
    return { docs: checked, checks: { offMap: checked.filter(doc => !doc.onMap).map(doc => doc.path), broken: checked.flatMap(doc => doc.broken.map(target => `${doc.path} → ${target}`)),
      refresh: result.checks.refresh } };
  }

  // One doc at the pin, or at an earlier commit of the layer's history.
  function read(projectId, userId, key, path, at = null) {
    member(projectId, userId);
    const pkg = current(projectId, key);
    const where = located(pkg, path);
    if (at !== null) {
      if (!commitPattern.test(at)) fail('Choose a version.');
      try { git(pkg.repo, ['merge-base', '--is-ancestor', at, pkg.commit]); } catch { fail('That version is not in this layer\'s history.', 404); }
    }
    const commit = at || pkg.commit;
    let content = show(pkg.repo, commit, where);
    const definition = custom(projectId, key);
    // A custom layer's charter is also its identity, which activation and discovery read; until the first save in
    // Knowledge, the identity is the charter (a new one starts from the charter's prompted headings).
    if (path === pkg.manifest.knowledge.charter && definition && at === null && !history(projectId, userId, key, path).versions.some(version => version.saved))
      content = definition.identity?.markdown || (definition.identity ? charterFromFields(definition.name, definition.identity) : charterTemplate(definition.name));
    if (content === null) return { path, commit, content: '', exists: false };
    // A repository doc shows where each section came from, when the layer keeps a sources sidecar.
    if (path.startsWith('/')) {
      const sources = declaredDocs(pkg.manifest).sources;
      let sidecar = {};
      try { sidecar = sources ? JSON.parse(show(pkg.repo, commit, sources) || '{}') : {}; } catch { sidecar = {}; }
      return { path, commit, content, exists: true, sections: sourcedSections(content, sidecar[where] || {}, id => revisionOf(projectId, id)) };
    }
    return { path, commit, content, exists: true };
  }

  // The commits that changed a doc, newest first.
  function history(projectId, userId, key, path) {
    member(projectId, userId);
    const pkg = current(projectId, key);
    const where = path === 'layer.json' ? pkg.root + path : located(pkg, path, { create: true });
    const out = git(pkg.repo, ['log', '--format=%H%x09%an%x09%aI%x09%s', pkg.commit, '--', where]);
    // A save in Knowledge is marked by its subject; anything else came with the template or through reviewed Work.
    const versions = out ? out.split('\n').map(line => { const [commit, name, at, subject] = line.split('\t');
      return { commit, by: name, at, subject, saved: subject.startsWith('Knowledge:') }; }) : [];
    return { path, versions };
  }

  // Save: a commit on `main` that becomes the pin. `base` is the commit the editor read; if the layer moved since but this
  // doc didn't, the save still takes on top of the new pin.
  function save(projectId, userId, key, { path, content, base } = {}) {
    editor(projectId, userId);
    if (typeof content !== 'string' || !content.trim()) fail('A document needs content.');
    if (content.length > maxDoc) fail(`Keep a document under ${maxDoc} characters.`);
    const pkg = current(projectId, key);
    const where = located(pkg, path, { create: true });
    if (!commitPattern.test(base || '')) fail('Say which version you edited.');
    if (base !== pkg.commit && show(pkg.repo, base, where) !== show(pkg.repo, pkg.commit, where)) fail('Someone changed this document since you opened it. Reload to see their version.', 409);
    const text = content.endsWith('\n') ? content : `${content}\n`;
    if (show(pkg.repo, pkg.commit, where) === text.trimEnd()) return { path, commit: pkg.commit, changed: false };
    const definition = custom(projectId, key);
    if (path === pkg.manifest.knowledge.charter && definition)
      saveLayerCharter(db, userId, projectId, key, { content: text, expectedRevision: definition.identityRevision });
    const next = commitFiles(pkg.repo, pkg.commit, { [where]: text }, `Knowledge: ${path.startsWith('/') ? where : path.slice(10)}`, author(userId));
    try { packageAt(pkg.repo, next, key); } catch (error) { fail(`That would make the layer invalid: ${error.message}`); }
    advance(projectId, key, pkg.repo, pkg.commit, next, pkg.root);
    return { path, commit: next, changed: true };
  }

  // The spec: `information` in layer.json, replaced whole. A change raises Compare specs (onSpecChange).
  function saveInformation(projectId, userId, key, { information, base } = {}) {
    editor(projectId, userId);
    const pkg = current(projectId, key);
    if (base !== pkg.commit && show(pkg.repo, base, pkg.root + 'layer.json') !== show(pkg.repo, pkg.commit, pkg.root + 'layer.json')) fail('This layer\'s spec changed since you opened it. Reload to see it.', 409);
    // The package check below validates the spec, as it does for any commit.
    const ordered = {};
    for (const [field, value] of Object.entries(pkg.manifest)) { if (field !== 'information') ordered[field] = value; if (field === 'outputs') ordered.information = information; }
    if (!('information' in ordered)) ordered.information = information;
    if (JSON.stringify(pkg.manifest.information ?? null) === JSON.stringify(information)) return { commit: pkg.commit, changed: false };
    const next = commitFiles(pkg.repo, pkg.commit, { [pkg.root + 'layer.json']: `${JSON.stringify(ordered, null, 2)}\n` }, 'Knowledge: information', author(userId));
    try { packageAt(pkg.repo, next, key); } catch (error) { fail(`That would make the layer invalid: ${error.message}`); }
    advance(projectId, key, pkg.repo, pkg.commit, next, pkg.root);
    onSpecChange(projectId, key);
    return { commit: next, changed: true };
  }

  return { list, read, history, save, saveInformation };
}
