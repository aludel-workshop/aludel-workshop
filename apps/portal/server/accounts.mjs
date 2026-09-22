import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export const ownerUserId = 'owner';
export const aludelProjectId = 'the-machine';
const sessionMaxAge = 60 * 60 * 24 * 30;
const digest = value => createHash('sha256').update(value).digest('hex');
const hash = (secret, salt) => scryptSync(secret, Buffer.from(salt, 'hex'), 32).toString('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();

export function initAccounts(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, display_name TEXT NOT NULL,
      password_salt TEXT, password_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK(role IN ('owner', 'member')), created_at TEXT NOT NULL,
      PRIMARY KEY(project_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id);
    CREATE TABLE IF NOT EXISTS login_tickets (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL
    );
  `);
  const sessionColumns = new Set(db.prepare('PRAGMA table_info(sessions)').all().map(column => column.name));
  // Sessions created before accounts existed all belonged to the single local owner.
  if (!sessionColumns.has('user_id')) db.exec(`ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT '${ownerUserId}'`);
  const created = now();
  db.prepare(`INSERT INTO users(id, email, display_name, created_at, updated_at) VALUES (?, NULL, 'Owner', ?, ?)
    ON CONFLICT(id) DO NOTHING`).run(ownerUserId, created, created);
  db.prepare(`INSERT INTO project_members(project_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)
    ON CONFLICT(project_id, user_id) DO NOTHING`).run(aludelProjectId, ownerUserId, created);
}

const publicUser = row => row && ({ id: row.id, email: row.email, name: row.display_name, owner: row.id === ownerUserId });

export function createUser(db, { email, name, password }) {
  const normalized = String(email || '').trim().toLowerCase();
  const displayName = String(name || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) fail('Enter a valid email address.');
  if (!displayName || displayName.length > 80) fail('Enter your name (up to 80 characters).');
  if (String(password || '').length < 12) fail('Use at least 12 characters for your password.');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)) fail('An account already uses that email. Sign in instead.', 409);
  const salt = randomBytes(16).toString('hex');
  const id = `user-${randomUUID()}`;
  const created = now();
  db.prepare(`INSERT INTO users(id, email, display_name, password_salt, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, normalized, displayName, salt, hash(String(password), salt), created, created);
  return getUser(db, id);
}

// Accounts created through an identity provider have no Aludel password; the provider is how they sign in.
export function createExternalUser(db, { email, name }) {
  const normalized = email ? String(email).trim().toLowerCase() : null;
  const displayName = String(name || '').trim().slice(0, 80) || 'New user';
  // Never attach a provider identity to an existing password account by matching email; that would let
  // whoever controls the provider email take over the account. The person signs in and connects instead.
  if (normalized && db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)) {
    fail(`An Aludel account already uses ${normalized}. Sign in with your email and password, then connect GitHub from there.`, 409);
  }
  const id = `user-${randomUUID()}`;
  const created = now();
  db.prepare('INSERT INTO users(id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, normalized, displayName, created, created);
  return getUser(db, id);
}

// A short-lived, single-use hand-off from the OAuth callback host to the portal host, where the session cookie lives.
export function createLoginTicket(db, userId) {
  const token = randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM login_tickets WHERE expires_at < ?').run(now());
  db.prepare('INSERT INTO login_tickets(token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(digest(token), userId, new Date(Date.now() + 2 * 60_000).toISOString());
  return token;
}

export function redeemLoginTicket(db, token) {
  const row = db.prepare('SELECT user_id, expires_at FROM login_tickets WHERE token_hash = ?').get(digest(String(token || '')));
  db.prepare('DELETE FROM login_tickets WHERE token_hash = ?').run(digest(String(token || '')));
  if (!row || row.expires_at < now()) fail('That sign-in link has expired. Try signing in with GitHub again.', 401);
  return getUser(db, row.user_id);
}

export function verifyUser(db, { email, password }) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  // Hash even for unknown accounts so response timing does not reveal which emails exist.
  const salt = row?.password_salt || '00'.repeat(16);
  const candidate = Buffer.from(hash(String(password || ''), salt), 'hex');
  const expected = Buffer.from(row?.password_hash || '00'.repeat(32), 'hex');
  if (!row?.password_hash || !timingSafeEqual(candidate, expected)) fail('That email and password do not match an account.', 401);
  return publicUser(row);
}

export function getUser(db, id) {
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const created = new Date();
  const expires = new Date(created.getTime() + sessionMaxAge * 1000);
  db.prepare('INSERT INTO sessions(token_hash, created_at, expires_at, user_id) VALUES (?, ?, ?, ?)')
    .run(digest(token), created.toISOString(), expires.toISOString(), userId);
  return `machine_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionMaxAge}`;
}

export function sessionUser(db, token) {
  if (!token) return null;
  const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(digest(token));
  if (!session || session.expires_at <= now()) return null;
  return getUser(db, session.user_id);
}

export function endSession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
  return 'machine_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
}

export function isMember(db, userId, projectId) {
  return Boolean(userId && db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId));
}

export function requireMember(db, user, projectId) {
  if (!user) fail('Sign in to continue.', 401);
  // Report a missing project and a project the user cannot see identically, so ids cannot be probed.
  if (!isMember(db, user.id, projectId)) fail('Project not found.', 404);
}

export function userProjects(db, userId) {
  return db.prepare(`SELECT p.id, p.slug, p.name, p.description, p.accent_color, m.role, p.updated_at
    FROM project_members m JOIN projects p ON p.id = m.project_id WHERE m.user_id = ? ORDER BY p.updated_at DESC`).all(userId);
}
