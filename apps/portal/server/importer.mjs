import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const unix = value => value.split(sep).join('/');

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : extname(entry.name).toLowerCase() === '.md' ? [path] : [];
  });
}

function frontmatter(source) {
  if (!source.startsWith('---\n')) return {};
  const end = source.indexOf('\n---\n', 4);
  if (end < 0) return {};
  return Object.fromEntries(source.slice(4, end).split('\n').flatMap(line => {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*?)\s*$/);
    if (!match) return [];
    let value = match[2].replace(/^['"]|['"]$/g, '');
    return [[match[1], value]];
  }));
}

function heading(source, fallback) {
  return source.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

function localLinks(source) {
  return [...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map(match => match[1].trim().replace(/^<|>$/g, ''))
    .filter(target => target && !/^(?:https?:|mailto:|app:|#)/i.test(target));
}

export function importCorpus(db, { root, docsDirectory = join(root, 'docs') }) {
  const startedAt = new Date().toISOString();
  const run = db.prepare('INSERT INTO import_runs(started_at, status) VALUES (?, ?)').run(startedAt, 'running');
  const runId = Number(run.lastInsertRowid);
  const files = markdownFiles(docsDirectory).sort();
  let created = 0;
  let unchanged = 0;
  let revisions = 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const absolutePath of files) {
      const path = unix(relative(root, absolutePath));
      const source = readFileSync(absolutePath, 'utf8');
      const meta = frontmatter(source);
      const id = meta.id || `source:${path}`;
      const title = heading(source, path.split('/').at(-1).replace(/\.md$/i, ''));
      const hash = sha256(source);
      const existing = db.prepare('SELECT id, current_hash FROM source_documents WHERE path = ?').get(path);
      if (!existing) {
        db.prepare(`INSERT INTO source_documents
          (id, project_id, path, title, kind, status, current_hash, imported_at)
          VALUES (?, 'the-machine', ?, ?, ?, ?, ?, ?)`)
          .run(id, path, title, meta.kind || 'source-document', meta.status || 'unclassified', hash, startedAt);
        created++;
      }
      const document = db.prepare('SELECT id, current_hash FROM source_documents WHERE path = ?').get(path);
      if (document.current_hash === hash && existing) {
        unchanged++;
      } else {
        const nextRevision = (db.prepare('SELECT COALESCE(MAX(revision), 0) AS revision FROM source_revisions WHERE document_id = ?').get(document.id).revision || 0) + 1;
        const revision = db.prepare(`INSERT INTO source_revisions
          (document_id, revision, content_hash, raw_content, metadata_json, imported_at, import_run_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(document.id, nextRevision, hash, source, JSON.stringify(meta), startedAt, runId);
        db.prepare(`UPDATE source_documents SET title = ?, kind = ?, status = ?, current_hash = ?,
          current_revision_id = ?, imported_at = ? WHERE id = ?`)
          .run(title, meta.kind || 'source-document', meta.status || 'unclassified', hash, Number(revision.lastInsertRowid), startedAt, document.id);
        revisions++;
      }

      db.prepare('DELETE FROM source_links WHERE source_document_id = ?').run(document.id);
      for (const rawTarget of localLinks(source)) {
        const withoutFragment = rawTarget.split('#')[0].split('?')[0];
        if (!withoutFragment) continue;
        const targetAbsolute = resolve(dirname(absolutePath), withoutFragment);
        const insideRoot = targetAbsolute === root || targetAbsolute.startsWith(root + sep);
        const targetPath = insideRoot ? unix(relative(root, targetAbsolute)) : rawTarget;
        const exists = insideRoot && (() => { try { return statSync(targetAbsolute).isFile(); } catch { return false; } })();
        const resolvedDocument = exists && extname(targetAbsolute).toLowerCase() === '.md'
          ? db.prepare('SELECT id FROM source_documents WHERE path = ?').get(targetPath)
          : null;
        db.prepare(`INSERT INTO source_links
          (source_document_id, raw_target, target_path, target_exists, resolved_document_id)
          VALUES (?, ?, ?, ?, ?)`)
          .run(document.id, rawTarget, targetPath, exists ? 1 : 0, resolvedDocument?.id || null);
      }
    }

    // A second pass resolves forward links after every document identity exists.
    db.prepare(`UPDATE source_links SET resolved_document_id = (
      SELECT id FROM source_documents WHERE source_documents.path = source_links.target_path
    ) WHERE target_exists = 1 AND resolved_document_id IS NULL`).run();

    const linkCounts = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN target_exists = 0 THEN 1 ELSE 0 END) AS unresolved
      FROM source_links`).get();
    db.prepare(`UPDATE import_runs SET completed_at = ?, status = 'complete', documents_seen = ?,
      documents_created = ?, revisions_created = ?, unchanged = ?, links_seen = ?, unresolved_links = ? WHERE id = ?`)
      .run(new Date().toISOString(), files.length, created, revisions, unchanged, linkCounts.total || 0, linkCounts.unresolved || 0, runId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.prepare("UPDATE import_runs SET completed_at = ?, status = 'failed', error = ? WHERE id = ?")
      .run(new Date().toISOString(), String(error), runId);
    throw error;
  }
  return db.prepare('SELECT * FROM import_runs WHERE id = ?').get(runId);
}
