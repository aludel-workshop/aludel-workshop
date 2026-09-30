// LAYER-BASE-01 B4: a Markdown layer whose repository publishes the Markdown API keeps its folders and documents as
// layer-owned records and changes them only through that API. The editor's routes and responses stay as they were;
// a layer without an API keeps the earlier file store.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { applyOperation, layerApi } from './layer-api.mjs';
import { ensureLayerPackage } from './layer-package.mjs';
import { projectLayerDefinition } from './layer-registry.mjs';
import { hasElevated } from './layer-scope.mjs';
import { access, markdownFileCreate, markdownFileDelete, markdownFileMove, markdownFileSave, markdownFolderCreate, markdownFolderDelete, markdownFolderMove,
  markdownRead, markdownTree, physical, root, workLink } from './markdown-layer.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const sha = value => createHash('sha256').update(value).digest('hex');

export function markdownOutputs({ db, know, dataDirectory }) {
  const author = userId => db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId)?.display_name || 'Aludel';
  const rows = (projectId, key, kind) => db.prepare(`SELECT r.id, r.revision, r.data_json, r.updated_at FROM knowledge_records r
    JOIN layer_instances i ON i.project_id = r.project_id AND i.instance_id = r.layer_instance_id WHERE r.project_id = ? AND i.layer_key = ? AND r.kind = ?`).all(projectId, key, kind)
    .map(row => ({ id: row.id, revision: row.revision, updatedAt: row.updated_at, ...JSON.parse(row.data_json) }));
  const file = row => ({ id: row.id, path: row.path, revision: row.revision, content: row.content, sha: sha(row.content), updatedAt: row.updatedAt });
  const found = (projectId, key, kind, id) => rows(projectId, key, kind).find(row => row.id === id) || fail(`Markdown ${kind === 'markdown_folder' ? 'folder' : 'file'} not found.`, 404);
  const folderAt = (projectId, key, path) => rows(projectId, key, 'markdown_folder').find(row => row.path === path) || fail('Folder not found.', 404);
  function withApi(userId, projectId, key, write, legacy, apply) {
    access(db, userId, projectId, key, write);
    const api = layerApi(db, projectId, key);
    return api ? apply(api) : legacy();
  }
  const call = (api, userId, projectId, key, operationId, id, body, workId = null) => applyOperation({ db, know, api, projectId, operationId, id, body,
    elevated: hasElevated(db, userId, projectId, key), author: author(userId), workItemId: workId });
  const read = (userId, projectId, key, fileId, revision = null) => withApi(userId, projectId, key, false,
    () => markdownRead(db, dataDirectory, userId, projectId, key, fileId, revision), () => {
      const row = found(projectId, key, 'markdown_document', fileId);
      if (revision === null) return file(row);
      if (!Number.isInteger(revision) || revision < 1) fail('Choose a valid revision.');
      const past = db.prepare('SELECT data_json, created_at FROM knowledge_revisions WHERE record_id = ? AND revision = ?').get(fileId, revision) || fail('Revision not found.', 404);
      const data = JSON.parse(past.data_json);
      return { id: fileId, revision, path: data.path, content: data.content, sha: sha(data.content), updatedAt: past.created_at };
    });
  return {
    tree: (userId, projectId, key) => withApi(userId, projectId, key, false, () => markdownTree(db, dataDirectory, userId, projectId, key), () => ({
      folders: rows(projectId, key, 'markdown_folder').map(row => row.path).sort(),
      files: rows(projectId, key, 'markdown_document').map(file).map(({ content, ...rest }) => rest).sort((a, b) => a.path.localeCompare(b.path)) })),
    read,
    folderCreate: (userId, projectId, key, path) => withApi(userId, projectId, key, true, () => markdownFolderCreate(db, dataDirectory, userId, projectId, key, path),
      api => { call(api, userId, projectId, key, 'createFolder', null, { folder: { path } }); return { path }; }),
    folderMove: (userId, projectId, key, from, to) => withApi(userId, projectId, key, true, () => markdownFolderMove(db, dataDirectory, userId, projectId, key, from, to),
      api => { call(api, userId, projectId, key, 'moveFolder', folderAt(projectId, key, from).id, { changes: { path: to } }); return { from, to }; }),
    folderDelete: (userId, projectId, key, path) => withApi(userId, projectId, key, true, () => markdownFolderDelete(db, dataDirectory, userId, projectId, key, path),
      api => { call(api, userId, projectId, key, 'deleteFolder', folderAt(projectId, key, path).id, {}); return { path, deleted: true }; }),
    fileCreate: (userId, projectId, key, path, content = '', workId = null) => withApi(userId, projectId, key, true,
      () => markdownFileCreate(db, dataDirectory, userId, projectId, key, path, content, workId),
      api => read(userId, projectId, key, call(api, userId, projectId, key, 'createDocument', null, { document: { path, content } }, workLink(db, projectId, key, userId, workId)).id)),
    fileSave: (userId, projectId, key, fileId, input) => withApi(userId, projectId, key, true, () => markdownFileSave(db, dataDirectory, userId, projectId, key, fileId, input), api => {
      const current = found(projectId, key, 'markdown_document', fileId);
      if (input?.expectedRevision !== current.revision) fail('This file changed. Reload before saving.', 409);
      if (current.content === input.content) return file(current);
      call(api, userId, projectId, key, 'updateDocument', fileId, { expectedRevision: current.revision, changes: { content: input.content } }, workLink(db, projectId, key, userId, input.workId || null));
      return read(userId, projectId, key, fileId);
    }),
    fileMove: (userId, projectId, key, fileId, input) => withApi(userId, projectId, key, true, () => markdownFileMove(db, dataDirectory, userId, projectId, key, fileId, input), api => {
      const current = found(projectId, key, 'markdown_document', fileId);
      if (input?.expectedRevision !== current.revision) fail('This file changed. Reload before moving.', 409);
      if (current.path === input.path) return file(current);
      call(api, userId, projectId, key, 'updateDocument', fileId, { expectedRevision: current.revision, changes: { path: input.path } }, workLink(db, projectId, key, userId, input.workId || null));
      return read(userId, projectId, key, fileId);
    }),
    fileDelete: (userId, projectId, key, fileId, expectedRevision) => withApi(userId, projectId, key, true,
      () => markdownFileDelete(db, dataDirectory, userId, projectId, key, fileId, expectedRevision), api => {
        const current = found(projectId, key, 'markdown_document', fileId);
        call(api, userId, projectId, key, 'deleteDocument', fileId, { expectedRevision });
        return { id: fileId, deleted: true, revision: current.revision + 1 };
      })
  };
}

// Gives a custom Markdown layer created before layer repositories its own repository, forked from the Markdown template,
// with its current charter, and moves its files into layer records through the API. Earlier file revisions stay in the
// old tables; a map records each file's new record ID.
export function adoptMarkdownLayer({ db, know, dataDirectory, projectId, key }) {
  const definition = projectLayerDefinition(db, projectId, key);
  if (!definition || definition.outputProvider !== 'markdown-files' || definition.builtIn) return null;
  db.exec(`CREATE TABLE IF NOT EXISTS markdown_adoptions (project_id TEXT NOT NULL, layer_key TEXT NOT NULL, file_id TEXT NOT NULL, record_id TEXT NOT NULL,
    PRIMARY KEY(project_id, layer_key, file_id))`);
  const pkg = ensureLayerPackage(db, projectId, key, { template: 'markdown', name: definition.name, charter: definition.identity?.markdown || null });
  if (!pkg) return null;
  syncDefinition(db, projectId, key, pkg);
  const hasTable = name => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  if (!hasTable('markdown_files') || db.prepare('SELECT 1 FROM markdown_adoptions WHERE project_id = ? AND layer_key = ? LIMIT 1').get(projectId, key)) return pkg;
  const api = layerApi(db, projectId, key);
  const options = { author: 'Aludel', rationale: 'Moved into the layer repository (LAYER-BASE-01)' };
  const folders = db.prepare('SELECT path FROM markdown_folders WHERE project_id = ? AND layer_key = ?').all(projectId, key).map(row => row.path)
    .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  const files = db.prepare('SELECT id, path, content_sha FROM markdown_files WHERE project_id = ? AND layer_key = ? AND deleted = 0 ORDER BY path').all(projectId, key);
  const base = root(dataDirectory, projectId, key);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const path of folders) applyOperation({ db, know, api, projectId, operationId: 'createFolder', body: { folder: { path } }, ...options });
    for (const row of files) {
      const target = physical(base, row.path);
      const content = existsSync(target) ? readFileSync(target, 'utf8') : fail(`${row.path} is missing from the layer's files.`, 409);
      if (sha(content) !== row.content_sha) fail(`${row.path} changed outside the editor; reconcile it before moving the layer.`, 409);
      const created = applyOperation({ db, know, api, projectId, operationId: 'createDocument', body: { document: { path: row.path, content } }, ...options });
      db.prepare('INSERT INTO markdown_adoptions VALUES (?, ?, ?, ?)').run(projectId, key, row.id, created.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return pkg;
}

// The definition shows what the installed repository declares.
export function syncDefinition(db, projectId, key, pkg) {
  db.prepare('UPDATE layer_definitions SET output_kinds_json = ?, output_tabs_json = ?, package_commit = ? WHERE project_id = ? AND layer_key = ?')
    .run(JSON.stringify(pkg.manifest.outputs), JSON.stringify(pkg.manifest.tabs), pkg.commit, projectId, key);
}
