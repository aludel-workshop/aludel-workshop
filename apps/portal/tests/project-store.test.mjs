// PROJECT-DB-01: one platform database plus one database per project, behind the same prepare/exec surface.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { classify, openProjectStore, statements } from '../server/project-store.mjs';

const fixture = fn => async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-store-'));
  const db = openProjectStore(join(root, 'machine.sqlite'));
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS note_revisions (note_id TEXT NOT NULL REFERENCES notes(id), revision INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS notes_body BEFORE INSERT ON notes WHEN NEW.body = '' BEGIN SELECT RAISE(ABORT, 'empty'); END;`);
    for (const [id, at] of [['p-a', '1'], ['p-b', '2']]) db.prepare('INSERT INTO projects VALUES (?, ?, ?)').run(id, id, at);
    await fn(db, root);
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
};

test('statements are classified by the tables they name', () => {
  assert.equal(classify('SELECT * FROM projects WHERE id = ?'), 'platform');
  assert.equal(classify('SELECT n.* FROM notes n JOIN note_revisions r ON r.note_id = n.id'), 'project');
  assert.equal(classify('SELECT p.slug FROM notes n JOIN projects p ON p.id = n.project_id'), 'mixed');
  assert.equal(classify("INSERT INTO projects(id) VALUES ('x') ON CONFLICT(id) DO UPDATE SET slug = excluded.slug"), 'platform');
  assert.equal(classify("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'notes'"), 'schema');
  assert.equal(classify("SELECT 'FROM notes' AS text FROM projects"), 'platform', 'text in strings is not a table');
  assert.equal(statements("CREATE TABLE a(x); CREATE TRIGGER t BEFORE INSERT ON a BEGIN SELECT 1; SELECT 2; END; SELECT ';'").length, 3);
});

test('each project has its own database; platform rows stay in the platform database', fixture((db, root) => {
  db.withProject('p-a', () => db.prepare('INSERT INTO notes VALUES (?, ?, ?)').run('n-1', 'p-a', 'Alpha'));
  db.prepare('INSERT INTO notes VALUES (?, ?, ?)').run('n-2', 'p-b', 'Beta');
  assert.ok(existsSync(join(root, 'projects', 'p-a.sqlite')) && existsSync(join(root, 'projects', 'p-b.sqlite')));
  const raw = new DatabaseSync(join(root, 'projects', 'p-a.sqlite'), { readOnly: true });
  assert.deepEqual(raw.prepare('SELECT id FROM notes').all().map(row => row.id), ['n-1']);
  raw.close();
  const platform = new DatabaseSync(join(root, 'machine.sqlite'), { readOnly: true });
  assert.equal(platform.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'notes'").get().n, 0, 'no project table in the platform database');
  platform.close();
  // A project request reads only its project; a statement binding another project is refused.
  assert.deepEqual(db.withProject('p-b', () => db.prepare('SELECT id FROM notes').all().map(row => row.id)), ['n-2']);
  assert.throws(() => db.withProject('p-a', () => db.prepare('SELECT * FROM notes WHERE project_id = ?').all('p-b')), /p-a request reached p-b/);
  // Without a project: reads and by-ID updates visit every project; inserts that name none are refused.
  assert.deepEqual(db.prepare('SELECT id FROM notes ORDER BY id').all().map(row => row.id), ['n-1', 'n-2']);
  assert.equal(db.prepare('UPDATE notes SET body = ? WHERE id = ?').run('Bravo', 'n-2').changes, 1);
  // A child row goes to the project of the parent its foreign key names; a row with neither is refused.
  db.prepare('INSERT INTO note_revisions VALUES (?, 1, ?)').run('n-1', 'x');
  assert.equal(db.withProject('p-a', () => db.prepare('SELECT count(*) AS n FROM note_revisions').get().n), 1);
  db.exec('CREATE TABLE IF NOT EXISTS loose (value TEXT)');
  assert.throws(() => db.prepare('INSERT INTO loose VALUES (?)').run('x'), /needs a project/);
  db.prepare("INSERT INTO notes(id, project_id, body) VALUES ('n-5', 'p-b', 'Literal')").run();
  assert.equal(db.withProject('p-b', () => db.prepare("SELECT body FROM notes WHERE id = 'n-5'").get().body), 'Literal');
  assert.throws(() => db.prepare('SELECT count(*) AS n FROM notes').get(), /needs a project/);
  assert.throws(() => db.prepare('SELECT p.slug FROM notes n JOIN projects p ON p.id = n.project_id').all(), /split it/);
  assert.throws(() => db.prepare('INSERT INTO notes VALUES (?, ?, ?)').run('n-3', 'p-missing', 'x'), /Unknown project/);
  // Project schema (including triggers) applies to every project database, and schema questions see it.
  assert.throws(() => db.prepare('INSERT INTO notes VALUES (?, ?, ?)').run('n-4', 'p-a', ''), /empty/);
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'notes'").get());
  db.exec('ALTER TABLE notes ADD COLUMN tag TEXT');
  assert.ok(db.prepare('PRAGMA table_info(notes)').all().some(column => column.name === 'tag'));
  assert.equal(db.withProject('p-b', () => db.prepare('SELECT tag FROM notes').get()).tag, null);
}));

test('a transaction spans every database it touches and rolls back together', fixture(db => {
  db.useProject('p-a');
  db.exec('BEGIN IMMEDIATE');
  db.prepare('INSERT INTO notes VALUES (?, ?, ?)').run('n-9', 'p-a', 'Draft');
  db.prepare('UPDATE projects SET slug = ? WHERE id = ?').run('renamed', 'p-a');
  assert.equal(db.isTransaction, true);
  db.exec('ROLLBACK');
  assert.equal(db.prepare('SELECT count(*) AS n FROM notes').get().n, 0);
  assert.equal(db.prepare('SELECT slug FROM projects WHERE id = ?').get('p-a').slug, 'p-a');
  db.exec('BEGIN');
  db.prepare('INSERT INTO notes VALUES (?, ?, ?)').run('n-9', 'p-a', 'Kept');
  db.prepare('INSERT INTO note_revisions VALUES (?, 1, ?)').run('n-9', 'Kept');
  db.exec('COMMIT');
  assert.equal(db.prepare('SELECT count(*) AS n FROM note_revisions').get().n, 1);
}));

test('a project database opened later is brought up to the current schema', fixture((db, root) => {
  db.exec('ALTER TABLE notes ADD COLUMN tag TEXT');
  db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?)').run('n-1', 'p-a', 'Alpha', 'x');
  db.close();
  const again = openProjectStore(join(root, 'machine.sqlite'));
  again.exec(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), body TEXT NOT NULL);
    ALTER TABLE notes ADD COLUMN tag TEXT; ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  assert.deepEqual({ ...again.withProject('p-a', () => again.prepare('SELECT id, tag, pinned FROM notes').get()) }, { id: 'n-1', tag: 'x', pinned: 0 });
  again.close();
}));

test('a single-database install moves each project’s rows into its own database, keeping a backup', () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-store-legacy-'));
  try {
    const path = join(root, 'machine.sqlite');
    const old = new DatabaseSync(path, { enableForeignKeyConstraints: false });
    old.exec(`CREATE TABLE projects (id TEXT PRIMARY KEY, slug TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE notes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), body TEXT NOT NULL);
      CREATE INDEX idx_notes_project ON notes(project_id);
      CREATE TABLE note_revisions (note_id TEXT NOT NULL REFERENCES notes(id), revision INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE knowledge_revisions (record_id TEXT NOT NULL, revision INTEGER NOT NULL);
      CREATE TABLE knowledge_records (id TEXT PRIMARY KEY, project_id TEXT NOT NULL);
      CREATE TRIGGER notes_body BEFORE INSERT ON notes WHEN NEW.body = '' BEGIN SELECT RAISE(ABORT, 'empty'); END;
      INSERT INTO projects VALUES ('p-a', 'a', '1'), ('p-b', 'b', '2');
      INSERT INTO notes VALUES ('n-1', 'p-a', 'Alpha'), ('n-2', 'p-b', 'Beta'), ('n-x', 'p-gone', 'Orphan');
      INSERT INTO note_revisions VALUES ('n-1', 1, 'Alpha'), ('n-2', 1, 'Beta'), ('n-2', 2, 'Beta 2');
      INSERT INTO knowledge_records VALUES ('k-1', 'p-b'); INSERT INTO knowledge_revisions VALUES ('k-1', 1);`);
    old.close();
    const db = openProjectStore(path);
    assert.deepEqual(db.migration.tables, { notes: 2, note_revisions: 3, knowledge_revisions: 1, knowledge_records: 1 });
    assert.deepEqual(db.migration.unowned, { notes: 1 });
    assert.ok(existsSync(db.migration.backup));
    db.exec(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS note_revisions (note_id TEXT NOT NULL REFERENCES notes(id), revision INTEGER NOT NULL, body TEXT NOT NULL)`);
    assert.deepEqual(db.withProject('p-b', () => db.prepare('SELECT note_id, revision FROM note_revisions ORDER BY revision').all().map(row => `${row.note_id}@${row.revision}`)), ['n-2@1', 'n-2@2']);
    assert.throws(() => db.withProject('p-a', () => db.prepare('INSERT INTO notes VALUES (?, ?, ?)').run('n-3', 'p-a', '')), /empty/, 'triggers move with their table');
    const platform = new DatabaseSync(path, { readOnly: true });
    assert.equal(platform.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'notes'").get().n, 0);
    assert.equal(platform.prepare('SELECT id FROM legacy_notes').get().id, 'n-x', 'rows of no project are kept aside');
    platform.close();
    db.close();
    assert.equal(openProjectStore(path).migration, null, 'the move runs once');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('no server statement names both platform and project tables', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const directory = new URL('../server/', import.meta.url).pathname;
  const mixed = [];
  for (const file of readdirSync(directory).filter(name => name.endsWith('.mjs'))) {
    for (const literal of readFileSync(join(directory, file), 'utf8').match(/`[^`]*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g) || []) {
      const sql = literal.slice(1, -1);
      if (/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql) && !sql.includes('${') && classify(sql) === 'mixed') mixed.push(`${file}: ${sql.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
  }
  assert.deepEqual(mixed, []);
});
