// LAYER-KNOWLEDGE-01 S2: a layer's docs and spec live in its own repository, read at the instance's pin. A person who may
// manage the layer edits them in Knowledge, and Save takes at once: one commit on `main` that becomes the new pin, so every
// earlier version stays readable and comparable. Only documentation paths (`knowledge/*.md`) and the `information` tree of
// `layer.json` are written this way; anything that runs on the host still arrives as reviewed Work.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { editorTabs, packageAt } from './layer-package.mjs';
import { projectLayerDefinition, saveLayerCharter } from './layer-registry.mjs';
import { layerBinding, settleLayerCheckout } from './layer-source.mjs';
import { flatten, validateInformation } from './information.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const git = (repo, args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options }).trimEnd();
const docPath = /^knowledge\/[a-z][a-z0-9-]*\.md$/;
const commitPattern = /^[0-9a-f]{40}$/;
const maxDoc = 60000;

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

export function layerDocs({ db, onSpecChange = () => {} }) {
  const member = (projectId, userId) => db.prepare('SELECT role FROM project_members WHERE user_id = ? AND project_id = ?').get(userId, projectId)?.role || fail('Project not found.', 404);
  const editor = (projectId, userId) => member(projectId, userId) === 'owner' || fail('Only the project owner edits a layer\'s docs.', 403);
  const custom = (projectId, key) => { const definition = projectLayerDefinition(db, projectId, key); return definition && !definition.builtIn ? definition : null; };
  const author = userId => db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId)?.display_name || 'Owner';
  const current = (projectId, key) => { const { repo, commit } = layerBinding(db, projectId, key); return { repo, commit, ...packageAt(repo, commit, key) }; };

  // Moves `main` and the pin from `base` to `next`, refusing if either moved meanwhile.
  function advance(projectId, key, repo, base, next) {
    const main = git(repo, ['rev-parse', 'refs/heads/main']);
    if (main !== base) fail('The layer repository\'s main branch is not at its pin; reconcile it first.', 409);
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
    const titleOf = path => (show(pkg.repo, pkg.commit, path) || '').match(/^#\s+(.+)$/m)?.[1]?.trim() || path.slice(10, -3).replaceAll('-', ' ');
    const docs = [{ path: manifest.knowledge.charter, title: 'Charter', group: null, charter: true }];
    for (const path of manifest.knowledge.documents) if (!nodeDocs.has(path) && path !== manifest.knowledge.charter)
      docs.push({ path, title: titleOf(path), group: /-method\.md$/.test(path) ? 'Methods' : 'Docs' });
    const tabs = [...(manifest.tabs || []), ...(manifest.editorAdapter === 'markdown-editor' ? [{ key: 'files', label: 'Files' }] : [])];
    for (const tab of tabs) {
      const path = `knowledge/tab-${tab.key}.md`;
      docs.push({ path, title: tab.label, group: 'Editor tabs', tab: tab.key, exists: show(pkg.repo, pkg.commit, path) !== null,
        edits: nodes.filter(node => node.tab === tab.key).map(node => node.key) });
    }
    return { commit: pkg.commit, docs };
  }

  // One doc at the pin, or at an earlier commit of the layer's history.
  function read(projectId, userId, key, path, at = null) {
    member(projectId, userId);
    if (!docPath.test(path || '')) fail('Choose a knowledge/*.md document.');
    const pkg = current(projectId, key);
    if (at !== null) {
      if (!commitPattern.test(at)) fail('Choose a version.');
      try { git(pkg.repo, ['merge-base', '--is-ancestor', at, pkg.commit]); } catch { fail('That version is not in this layer\'s history.', 404); }
    }
    const commit = at || pkg.commit;
    let content = show(pkg.repo, commit, path);
    const definition = custom(projectId, key);
    // A custom layer's charter is also its identity, which activation and discovery read; until the first save in
    // Knowledge, the identity is the charter.
    if (path === pkg.manifest.knowledge.charter && definition && at === null && !history(projectId, userId, key, path).versions.some(version => version.saved))
      content = definition.identity?.markdown ?? content;
    if (content === null) return { path, commit, content: '', exists: false };
    return { path, commit, content, exists: true };
  }

  // The commits that changed a doc, newest first.
  function history(projectId, userId, key, path) {
    member(projectId, userId);
    if (!docPath.test(path || '') && path !== 'layer.json') fail('Choose a knowledge/*.md document.');
    const pkg = current(projectId, key);
    const out = git(pkg.repo, ['log', '--format=%H%x09%an%x09%aI%x09%s', pkg.commit, '--', path]);
    // A save in Knowledge is marked by its subject; anything else came with the template or through reviewed Work.
    const versions = out ? out.split('\n').map(line => { const [commit, name, at, subject] = line.split('\t');
      return { commit, by: name, at, subject, saved: subject.startsWith('Knowledge:') }; }) : [];
    return { path, versions };
  }

  // Save: a commit on `main` that becomes the pin. `base` is the commit the editor read; if the layer moved since but this
  // doc didn't, the save still takes on top of the new pin.
  function save(projectId, userId, key, { path, content, base } = {}) {
    editor(projectId, userId);
    if (!docPath.test(path || '')) fail('Choose a knowledge/*.md document.');
    if (typeof content !== 'string' || !content.trim()) fail('A document needs content.');
    if (content.length > maxDoc) fail(`Keep a document under ${maxDoc} characters.`);
    const pkg = current(projectId, key);
    if (!commitPattern.test(base || '')) fail('Say which version you edited.');
    if (base !== pkg.commit && show(pkg.repo, base, path) !== show(pkg.repo, pkg.commit, path)) fail('Someone changed this document since you opened it. Reload to see their version.', 409);
    const text = content.endsWith('\n') ? content : `${content}\n`;
    if (show(pkg.repo, pkg.commit, path) === text.trimEnd()) return { path, commit: pkg.commit, changed: false };
    const definition = custom(projectId, key);
    if (path === pkg.manifest.knowledge.charter && definition)
      saveLayerCharter(db, userId, projectId, key, { content: text, expectedRevision: definition.identityRevision });
    const next = commitFiles(pkg.repo, pkg.commit, { [path]: text }, `Knowledge: ${path.slice(10)}`, author(userId));
    try { packageAt(pkg.repo, next, key); } catch (error) { fail(`That would make the layer invalid: ${error.message}`); }
    advance(projectId, key, pkg.repo, pkg.commit, next);
    return { path, commit: next, changed: true };
  }

  // The spec: `information` in layer.json, replaced whole. A change raises Compare specs (onSpecChange).
  function saveInformation(projectId, userId, key, { information, base } = {}) {
    editor(projectId, userId);
    const pkg = current(projectId, key);
    if (base !== pkg.commit && show(pkg.repo, base, 'layer.json') !== show(pkg.repo, pkg.commit, 'layer.json')) fail('This layer\'s spec changed since you opened it. Reload to see it.', 409);
    const manifest = { ...pkg.manifest, information };
    validateInformation(manifest, { tabs: editorTabs(manifest) });
    const ordered = {};
    for (const [field, value] of Object.entries(pkg.manifest)) { if (field !== 'information') ordered[field] = value; if (field === 'outputs') ordered.information = information; }
    if (!('information' in ordered)) ordered.information = information;
    if (JSON.stringify(pkg.manifest.information ?? null) === JSON.stringify(information)) return { commit: pkg.commit, changed: false };
    const next = commitFiles(pkg.repo, pkg.commit, { 'layer.json': `${JSON.stringify(ordered, null, 2)}\n` }, 'Knowledge: information', author(userId));
    try { packageAt(pkg.repo, next, key); } catch (error) { fail(`That would make the layer invalid: ${error.message}`); }
    advance(projectId, key, pkg.repo, pkg.commit, next);
    onSpecChange(projectId, key);
    return { commit: next, changed: true };
  }

  return { list, read, history, save, saveInformation };
}
