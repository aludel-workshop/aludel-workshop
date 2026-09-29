import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { initActionMigration, migrateActionProject, actionGrant, workActionMigration, setProjectWorkStyle, setActionAssignee, setLayerActionGrant, setActionMethod, layerActionSettings } from '../server/lat08-migration.mjs';
import { readActionSource, checkActionEffect } from '../server/code-action-gateway.mjs';

function fixture(style = 'dreamer') {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE project_setup(project_id TEXT PRIMARY KEY, profile TEXT, created_by TEXT, workspace_path TEXT);
    CREATE TABLE project_members(project_id TEXT, user_id TEXT, role TEXT, created_at TEXT);
    CREATE TABLE layer_instances(project_id TEXT, layer_key TEXT, enabled INTEGER);
    CREATE TABLE knowledge_records(id TEXT PRIMARY KEY, project_id TEXT, kind TEXT, parent_id TEXT, revision INTEGER, data_json TEXT);
    CREATE TABLE layer_work_items(id TEXT PRIMARY KEY, project_id TEXT, action TEXT, state TEXT);`);
  db.prepare('INSERT INTO project_setup VALUES (?, ?, ?, ?)').run('p1', style, 'owner', null);
  db.prepare('INSERT INTO project_members VALUES (?, ?, ?, ?)').run('p1', 'owner', 'owner', '2026-09-29');
  db.prepare('INSERT INTO project_members VALUES (?, ?, ?, ?)').run('p1', 'lead', 'member', '2026-09-29');
  db.prepare('INSERT INTO project_members VALUES (?, ?, ?, ?)').run('p1', 'ordinary', 'member', '2026-09-29');
  for (const key of ['product', 'pages', 'platform', 'data']) db.prepare('INSERT INTO layer_instances VALUES (?, ?, 1)').run('p1', key);
  db.prepare('INSERT INTO knowledge_records VALUES (?, ?, ?, ?, ?, ?)').run('profile1', 'p1', 'agent_profile', null, 1, JSON.stringify({ key: 'default', active: true }));
  db.prepare('INSERT INTO knowledge_records VALUES (?, ?, ?, ?, ?, ?)').run('role1', 'p1', 'role', null, 3, JSON.stringify({ layer: 'product', members: [{ id: 'lead', lead: true }] }));
  db.prepare('INSERT INTO knowledge_records VALUES (?, ?, ?, ?, ?, ?)').run('role2', 'p1', 'role', null, 1, JSON.stringify({ layer: 'pages', members: [{ id: 'lead', lead: false }] }));
  db.prepare('INSERT INTO knowledge_records VALUES (?, ?, ?, ?, ?, ?)').run('legacy1', 'p1', 'work_action', 'role1', 4, JSON.stringify({ key: 'product.brief', instructions: 'Historical Vision method', assignee: { kind: 'person', id: 'owner' } }));
  db.prepare('INSERT INTO layer_work_items VALUES (?, ?, ?, ?)').run('work1', 'p1', 'product.brief', 'review');
  db.prepare('INSERT INTO layer_work_items VALUES (?, ?, ?, ?)').run('work2', 'p1', 'data.access', 'ready');
  db.prepare('INSERT INTO layer_work_items VALUES (?, ?, ?, ?)').run('work3', 'p1', 'deploy.promote', 'ready');
  return db;
}

test('migration is idempotent and keeps historical pins while blocking unsupported open work', () => {
  const db = fixture();
  const first = migrateActionProject(db, 'p1');
  assert.ok(first.installed > 0);
  assert.equal(first.mapped, 1);
  assert.equal(first.blocked, 2);
  assert.deepEqual(migrateActionProject(db, 'p1'), { projectId: 'p1', installed: 0, granted: 0, mapped: 0, blocked: 0, totalActions: first.totalActions, totalWork: 3 });
  assert.equal(workActionMigration(db, 'p1', 'work1').legacy_record_revision, 4);
  assert.throws(() => workActionMigration(db, 'p1', 'work2'), /adapter|unavailable|mapping/i);
  assert.equal(db.prepare("SELECT revision FROM knowledge_records WHERE id = 'legacy1'").get().revision, 4);
  assert.equal(db.prepare("SELECT state FROM layer_work_items WHERE id = 'work2'").get().state, 'ready');
  db.close();
});

test('layer grants separate owner, lead, ordinary member and elevated action', () => {
  const db = fixture(); migrateActionProject(db, 'p1');
  assert.equal(actionGrant(db, { id: 'owner' }, 'p1', 'product.brief').id, 'product.brief');
  assert.equal(actionGrant(db, { id: 'lead' }, 'p1', 'product.brief').id, 'product.brief');
  assert.equal(actionGrant(db, { id: 'lead' }, 'p1', 'pages.flows').id, 'pages.flows');
  assert.throws(() => actionGrant(db, { id: 'ordinary' }, 'p1', 'pages.flows'), { status: 403 });
  setLayerActionGrant(db, { id: 'owner' }, 'p1', { userId: 'ordinary', layerKey: 'pages', level: 'normal', enabled: true });
  assert.equal(actionGrant(db, { id: 'ordinary' }, 'p1', 'pages.flows').id, 'pages.flows');
  assert.throws(() => actionGrant(db, { id: 'ordinary' }, 'p1', 'product.brief'), { status: 403 });
  setLayerActionGrant(db, { id: 'owner' }, 'p1', { userId: 'ordinary', layerKey: 'pages', level: 'normal', enabled: false });
  assert.throws(() => actionGrant(db, { id: 'ordinary' }, 'p1', 'pages.flows'), { status: 403 });
  assert.throws(() => setLayerActionGrant(db, { id: 'ordinary' }, 'p1', { userId: 'ordinary', layerKey: 'product', level: 'elevated', enabled: true }), { status: 403 });
  assert.throws(() => actionGrant(db, { id: 'lead' }, 'p1', 'data.access'), { status: 409 });
  assert.throws(() => actionGrant(db, { id: 'owner' }, 'p2', 'product.brief'), { status: 409 });
  db.close();
});

test('new layer installation seeds by current style and never rewrites earlier assignments', () => {
  const db = fixture('dreamer'); migrateActionProject(db, 'p1');
  const first = db.prepare("SELECT assignee_kind, assignee_id, installed_style FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'pages.flows'").get();
  assert.deepEqual({ ...first }, { assignee_kind: 'agent', assignee_id: 'profile1', installed_style: 'dreamer' });
  setProjectWorkStyle(db, { id: 'owner' }, 'p1', 'planner');
  db.prepare("INSERT INTO layer_instances VALUES ('p1', 'design', 1)").run();
  migrateActionProject(db, 'p1');
  assert.deepEqual({ ...db.prepare("SELECT assignee_kind, assignee_id, installed_style FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'pages.flows'").get() }, { ...first });
  assert.equal(db.prepare("SELECT installed_style FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'design.audit'").get().installed_style, 'planner');
  assert.equal(db.prepare("SELECT assignee_kind FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'product.brief'").get().assignee_kind, null, 'no checked human adapter means no elevated default');
  assert.throws(() => setActionAssignee(db, { id: 'ordinary' }, 'p1', 'pages.flows', null), { status: 403 });
  assert.throws(() => setActionAssignee(db, { id: 'owner' }, 'p1', 'design.audit', { kind: 'agent', id: 'profile1' }), { status: 409 });
  setActionAssignee(db, { id: 'owner' }, 'p1', 'product.brief', { kind: 'agent', id: 'profile1' });
  assert.equal(db.prepare("SELECT assignee_kind FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'product.brief'").get().assignee_kind, 'agent');
  setActionAssignee(db, { id: 'owner' }, 'p1', 'pages.flows', null);
  assert.equal(db.prepare("SELECT assignee_id FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'pages.flows'").get().assignee_id, null);
  db.close();
});

test('Code reads exact project commit and excludes secrets, symlinks, traversal and ungranted effects', () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-lat08-'));
  const repo = join(root, 'repo'); mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try {
    git('init'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test');
    writeFileSync(join(repo, 'README.md'), 'revision one\n');
    writeFileSync(join(repo, '.env'), 'SECRET=private\n');
    writeFileSync(join(repo, '.env.example'), 'EXAMPLE=placeholder\n');
    symlinkSync('README.md', join(repo, 'link.md'));
    git('add', 'README.md', '.env', '.env.example', 'link.md'); git('commit', '-m', 'fixture');
    const commit = git('rev-parse', 'HEAD');
    writeFileSync(join(repo, 'README.md'), 'uncommitted revision\n');
    const db = fixture(); db.prepare('UPDATE project_setup SET workspace_path = ? WHERE project_id = ?').run(repo, 'p1');
    migrateActionProject(db, 'p1');
    const source = readActionSource(db, { id: 'owner' }, 'p1', 'pages.flows', commit, 'README.md');
    assert.equal(source.text, 'revision one\n'); assert.equal(source.commit, commit);
    assert.throws(() => readActionSource(db, { id: 'owner' }, 'p1', 'pages.flows', commit, '.env'), { status: 404 });
    assert.equal(readActionSource(db, { id: 'owner' }, 'p1', 'pages.flows', commit, '.env.example').text, 'EXAMPLE=placeholder\n');
    assert.throws(() => readActionSource(db, { id: 'owner' }, 'p1', 'pages.flows', commit, 'link.md'), { status: 404 });
    assert.throws(() => readActionSource(db, { id: 'owner' }, 'p1', 'pages.flows', commit, '../README.md'), { status: 404 });
    assert.throws(() => readActionSource(db, { id: 'ordinary' }, 'p1', 'pages.flows', commit, 'README.md'), { status: 403 });
    db.prepare('INSERT INTO project_setup(project_id, profile, created_by, workspace_path, work_style) VALUES (?, ?, ?, ?, ?)').run('p2', 'planner', 'other', repo, 'planner');
    db.prepare('INSERT INTO project_members VALUES (?, ?, ?, ?)').run('p2', 'other', 'owner', '2026-09-29');
    db.prepare('INSERT INTO layer_instances VALUES (?, ?, 1)').run('p2', 'pages');
    migrateActionProject(db, 'p2');
    assert.throws(() => readActionSource(db, { id: 'owner' }, 'p2', 'pages.flows', commit, 'README.md'), { status: 404 });
    assert.throws(() => readActionSource(db, { id: 'other' }, 'p2', 'pages.flows', commit, 'README.md'), { status: 409 });
    assert.throws(() => checkActionEffect(db, { id: 'owner' }, 'p1', 'pages.flows', 'commit-candidate', { path: 'README.md' }), { status: 403 });
    assert.throws(() => checkActionEffect(db, { id: 'owner' }, 'p1', 'platform.docs', 'commit-candidate', { path: 'src/other.js' }), { status: 409 });
    db.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('all three work styles seed only available performers and never fabricate a fallback', () => {
  for (const [style, expected] of [['dreamer', 'agent'], ['planner', null], ['tinkerer', 'agent']]) {
    const db = fixture(style); migrateActionProject(db, 'p1');
    assert.equal(db.prepare("SELECT assignee_kind FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'pages.flows'").get().assignee_kind, expected, style);
    assert.equal(db.prepare("SELECT assignee_kind FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'product.brief'").get().assignee_kind, null, 'elevated has no checked person adapter');
    db.close();
  }
  const db = fixture('dreamer');
  db.prepare("DELETE FROM knowledge_records WHERE id = 'profile1'").run();
  migrateActionProject(db, 'p1');
  assert.equal(db.prepare("SELECT assignee_kind FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'pages.flows'").get().assignee_kind, null);
  assert.equal(db.prepare("SELECT assignee_kind FROM layer_action_installations WHERE project_id = 'p1' AND action_id = 'data.contract'").get().assignee_kind, null);
  db.close();
});


test('layer method edits are revisioned, owner-scoped and do not rewrite historical action pins', () => {
  const db = fixture(); migrateActionProject(db, 'p1');
  const before = layerActionSettings(db, { id: 'owner' }, 'p1', 'product').find(action => action.id === 'product.brief');
  assert.equal(before.method, 'Historical Vision method');
  assert.equal(before.methodRevision, 1);
  const changed = setActionMethod(db, { id: 'owner' }, 'p1', 'product.brief', 'Review the claim basis.', 1);
  assert.equal(changed.methodRevision, 2);
  assert.throws(() => setActionMethod(db, { id: 'owner' }, 'p1', 'product.brief', 'Stale edit', 1), { status: 409 });
  assert.throws(() => setActionMethod(db, { id: 'ordinary' }, 'p1', 'product.brief', 'Unauthorized edit', 2), { status: 403 });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM layer_action_method_revisions WHERE project_id = 'p1' AND action_id = 'product.brief'").get().n, 2);
  assert.equal(JSON.parse(db.prepare("SELECT data_json FROM knowledge_records WHERE id = 'legacy1'").get().data_json).instructions, 'Historical Vision method');
  db.close();
});
