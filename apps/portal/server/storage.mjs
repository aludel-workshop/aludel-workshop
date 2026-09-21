import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL,
      tagline TEXT NOT NULL DEFAULT '', accent_color TEXT NOT NULL DEFAULT '#9a5d32', hero_image_path TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_runs (
      id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL,
      documents_seen INTEGER DEFAULT 0, documents_created INTEGER DEFAULT 0,
      revisions_created INTEGER DEFAULT 0, unchanged INTEGER DEFAULT 0,
      links_seen INTEGER DEFAULT 0, unresolved_links INTEGER DEFAULT 0, error TEXT
    );
    CREATE TABLE IF NOT EXISTS source_documents (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, current_hash TEXT NOT NULL,
      current_revision_id INTEGER, imported_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS source_revisions (
      id INTEGER PRIMARY KEY, document_id TEXT NOT NULL REFERENCES source_documents(id), revision INTEGER NOT NULL,
      content_hash TEXT NOT NULL, raw_content TEXT NOT NULL, metadata_json TEXT NOT NULL,
      imported_at TEXT NOT NULL, import_run_id INTEGER NOT NULL REFERENCES import_runs(id),
      UNIQUE(document_id, content_hash), UNIQUE(document_id, revision)
    );
    CREATE TABLE IF NOT EXISTS source_links (
      id INTEGER PRIMARY KEY, source_document_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
      raw_target TEXT NOT NULL, target_path TEXT NOT NULL, target_exists INTEGER NOT NULL,
      resolved_document_id TEXT REFERENCES source_documents(id)
    );
    CREATE TABLE IF NOT EXISTS owner_requests (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), body TEXT NOT NULL,
      status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS change_proposals (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), source_request_id TEXT UNIQUE REFERENCES owner_requests(id),
      status TEXT NOT NULL, current_revision_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proposal_revisions (
      id INTEGER PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES change_proposals(id), revision INTEGER NOT NULL,
      title TEXT NOT NULL, intent TEXT NOT NULL, acceptance_json TEXT NOT NULL, assumptions_json TEXT NOT NULL,
      exclusions_json TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(proposal_id, revision)
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), proposal_id TEXT REFERENCES change_proposals(id),
      status TEXT NOT NULL, current_revision_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS decision_revisions (
      id INTEGER PRIMARY KEY, decision_id TEXT NOT NULL REFERENCES decisions(id), revision INTEGER NOT NULL,
      question TEXT NOT NULL, context TEXT NOT NULL, options_json TEXT NOT NULL, recommendation TEXT,
      answer TEXT, rationale TEXT, author TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(decision_id, revision)
    );
    CREATE TABLE IF NOT EXISTS downstream_records (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), proposal_id TEXT REFERENCES change_proposals(id),
      kind TEXT NOT NULL CHECK(kind IN ('plan', 'build')), title TEXT NOT NULL, revision INTEGER NOT NULL,
      status TEXT NOT NULL, currency TEXT NOT NULL CHECK(currency IN ('current', 'stale')),
      stale_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS record_dependencies (
      id INTEGER PRIMARY KEY, decision_id TEXT NOT NULL REFERENCES decisions(id),
      downstream_record_id TEXT NOT NULL REFERENCES downstream_records(id), required INTEGER NOT NULL,
      consumed_decision_revision INTEGER NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(decision_id, downstream_record_id)
    );
    CREATE TABLE IF NOT EXISTS auth_config (
      id INTEGER PRIMARY KEY CHECK (id = 1), salt TEXT NOT NULL, key_hash TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS repository_bindings (
      project_id TEXT PRIMARY KEY REFERENCES projects(id), provider TEXT NOT NULL,
      owner TEXT NOT NULL, name TEXT NOT NULL, html_url TEXT NOT NULL, clone_url TEXT NOT NULL,
      default_branch TEXT NOT NULL, private INTEGER NOT NULL, status TEXT NOT NULL,
      commit_sha TEXT, tracked_files INTEGER, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(provider, owner, name)
    );
    CREATE TABLE IF NOT EXISTS github_users (
      project_id TEXT PRIMARY KEY REFERENCES projects(id), access_token_encrypted TEXT,
      refresh_token_encrypted TEXT, token_expires_at TEXT, refresh_token_expires_at TEXT,
      login TEXT, user_id TEXT, oauth_state_hash TEXT UNIQUE, oauth_state_expires_at TEXT,
      oauth_code_verifier_encrypted TEXT, install_state_hash TEXT UNIQUE, install_state_expires_at TEXT,
      connected_at TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS github_installations (
      project_id TEXT NOT NULL REFERENCES projects(id), installation_id INTEGER NOT NULL,
      account_login TEXT NOT NULL, account_id TEXT NOT NULL, target_type TEXT NOT NULL,
      repository_selection TEXT NOT NULL, permissions_json TEXT NOT NULL, status TEXT NOT NULL,
      selected INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
      PRIMARY KEY(project_id, installation_id)
    );
    CREATE INDEX IF NOT EXISTS idx_documents_project ON source_documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_document ON source_revisions(document_id, revision DESC);
    CREATE INDEX IF NOT EXISTS idx_links_source ON source_links(source_document_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_project ON change_proposals(project_id);
    CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
    CREATE INDEX IF NOT EXISTS idx_dependencies_decision ON record_dependencies(decision_id);
  `);
  // Superseded per-owner app credentials are not retained after the vendor-app migration.
  db.exec('DROP TABLE IF EXISTS github_connections');
  const bindingColumns = new Set(db.prepare('PRAGMA table_info(repository_bindings)').all().map(column => column.name));
  if (!bindingColumns.has('installation_id')) db.exec('ALTER TABLE repository_bindings ADD COLUMN installation_id INTEGER');
  if (!bindingColumns.has('account_type')) db.exec('ALTER TABLE repository_bindings ADD COLUMN account_type TEXT');
  const userColumns = new Set(db.prepare('PRAGMA table_info(github_users)').all().map(column => column.name));
  if (!userColumns.has('install_state_hash')) db.exec('ALTER TABLE github_users ADD COLUMN install_state_hash TEXT');
  if (!userColumns.has('install_state_expires_at')) db.exec('ALTER TABLE github_users ADD COLUMN install_state_expires_at TEXT');
  const projectColumns = new Set(db.prepare('PRAGMA table_info(projects)').all().map(column => column.name));
  const needsProjectBrandMigration = !projectColumns.has('tagline');
  if (!projectColumns.has('tagline')) db.exec("ALTER TABLE projects ADD COLUMN tagline TEXT NOT NULL DEFAULT ''");
  if (!projectColumns.has('accent_color')) db.exec("ALTER TABLE projects ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#9a5d32'");
  if (!projectColumns.has('hero_image_path')) db.exec('ALTER TABLE projects ADD COLUMN hero_image_path TEXT');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO projects(id, slug, name, description, tagline, accent_color, hero_image_path, created_at, updated_at)
    VALUES ('the-machine', 'the-machine', 'Aludel', 'The product that turns intent into reviewed software.',
      'Turn ideas into what’s next.', '#9a5d32', '/brand/aludel-workshop.png', ?, ?)
    ON CONFLICT(id) DO NOTHING`).run(now, now);
  if (needsProjectBrandMigration) db.prepare(`UPDATE projects SET name = 'Aludel', tagline = 'Turn ideas into what’s next.',
    accent_color = '#9a5d32', hero_image_path = '/brand/aludel-workshop.png', updated_at = ? WHERE id = 'the-machine'`).run(now);
  return db;
}
