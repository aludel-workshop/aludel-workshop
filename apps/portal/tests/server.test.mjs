import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { importCorpus } from '../server/importer.mjs';
import { openDatabase } from '../server/storage.mjs';

test('Markdown import is idempotent and preserves changed source revisions', () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-import-'));
  const docs = join(root, 'docs');
  mkdirSync(docs);
  writeFileSync(join(docs, 'a.md'), '---\nid: a-001\nkind: note\nstatus: active\n---\n# A\n\nSee [B](b.md).\n');
  writeFileSync(join(docs, 'b.md'), '---\nid: b-001\nkind: note\nstatus: active\n---\n# B\n');
  const db = openDatabase(join(root, 'data', 'test.sqlite'));

  const first = importCorpus(db, { root, docsDirectory: docs });
  assert.equal(first.documents_created, 2);
  assert.equal(first.revisions_created, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM source_revisions').get().count, 2);
  assert.equal(db.prepare('SELECT resolved_document_id FROM source_links').get().resolved_document_id, 'b-001');

  const second = importCorpus(db, { root, docsDirectory: docs });
  assert.equal(second.revisions_created, 0);
  assert.equal(second.unchanged, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM source_revisions').get().count, 2);

  writeFileSync(join(docs, 'a.md'), '---\nid: a-001\nkind: note\nstatus: active\n---\n# A revised\n\nSee [B](b.md).\n');
  const third = importCorpus(db, { root, docsDirectory: docs });
  assert.equal(third.revisions_created, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM source_revisions WHERE document_id = 'a-001'").get().count, 2);
  assert.equal(db.prepare("SELECT title FROM source_documents WHERE id = 'a-001'").get().title, 'A revised');
  db.close();
});
