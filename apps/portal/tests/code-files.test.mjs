// W-27 #5: what an item's code changed, for the review modal's Files view: the files at the reported commit against the
// item's base (status, line counts, renames, binaries), and one file's diff; read from the project's own repository.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentWork, initAgentWork } from '../server/agent-work.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerApi } from '../server/layer-api.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Ada', '-c', 'user.email=ada@example.com', ...args], { cwd, encoding: 'utf8' }).trim();

test('W-27 #5: the Files view reads the reported commit against the item\'s base, file by file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aludel-code-files-'));
  const old = process.env.MACHINE_DATA_DIR; process.env.MACHINE_DATA_DIR = dir;
  try {
    const db = openDatabase(join(dir, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db); initAgentWork(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flow = onboarding({ db, catalogs, secrets: openSecretStore(dir), workspaceRoot: join(dir, 'w'), assetRoot: join(dir, 'a'), createWorkspace: () => {}, know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const { token } = flow.saveDraft(null, { profile: 'planner' });
    flow.saveDraft(token, { name: 'Tool Share', pitch: 'Help neighbours share tools.' });
    const id = flow.claimDraft(token, ada, ada).project.id;
    // The project's repository: main, then the item's branch with one of each kind of change; main moves on after.
    const repo = join(dir, 'repo'); git(dir, 'init', '-q', '-b', 'main', repo);
    mkdirSync(join(repo, 'src')); writeFileSync(join(repo, 'src/list.ts'), 'export const list = [];\nexport const size = 10;\n');
    writeFileSync(join(repo, 'src/old-name.ts'), 'export const kept = "this file only moves";\n'.repeat(4)); writeFileSync(join(repo, 'NOTES.md'), 'gone soon\n');
    git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'start');
    const base = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'checkout', '-qb', 'aludel/w-1');
    writeFileSync(join(repo, 'src/list.ts'), 'export const list = [];\nexport const size = 20;\nexport const near = true;\n');
    writeFileSync(join(repo, 'src/map.ts'), 'export const map = {};\n'); writeFileSync(join(repo, 'icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 0, 3]));
    git(repo, 'mv', 'src/old-name.ts', 'src/new-name.ts'); git(repo, 'rm', '-q', 'NOTES.md');
    git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'map');
    const commit = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'checkout', '-q', 'main'); writeFileSync(join(repo, 'README.md'), 'main moved\n'); git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'readme');
    db.prepare('UPDATE project_setup SET workspace_path = ? WHERE project_id = ?').run(repo, id);

    const work = agentWork({ db, know });
    const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
    const workId = work.createGoal(ada, id, { title: 'Show the map', brief: 'A map.' }).item.id;
    work.define(agent, id, workId, { brief: 'A map.', actions: [{ layer: 'platform', goal: 'Show the map' }] });
    work.claim(ada, id, workId); work.move(ada, id, workId, 'progress');
    assert.throws(() => work.codeFiles(id, workId, null), error => error.status === 404 && /no code reported/.test(error.message));

    // Without a base, the merge base with main: main's later README isn't the item's change.
    work.recordCode(agent, id, workId, { branch: 'aludel/w-1', commit: commit.slice(0, 7), files: [] });
    const listed = work.codeFiles(id, workId, null);
    assert.equal(listed.base, base); assert.equal(listed.commit, commit);
    const by = path => listed.files.find(file => file.path === path);
    assert.deepEqual(listed.files.map(file => file.path).sort(), ['NOTES.md', 'icon.png', 'src/list.ts', 'src/map.ts', 'src/new-name.ts']);
    assert.deepEqual(by('src/list.ts'), { path: 'src/list.ts', from: null, status: 'modified', added: 2, removed: 1, binary: false });
    assert.deepEqual(by('src/map.ts'), { path: 'src/map.ts', from: null, status: 'added', added: 1, removed: 0, binary: false });
    assert.deepEqual(by('src/new-name.ts'), { path: 'src/new-name.ts', from: 'src/old-name.ts', status: 'renamed', added: 0, removed: 0, binary: false });
    assert.deepEqual(by('NOTES.md'), { path: 'NOTES.md', from: null, status: 'deleted', added: 0, removed: 1, binary: false });
    assert.equal(by('icon.png').binary, true);

    // One file's diff; a binary says so; a path the item didn't change isn't readable.
    const diff = work.codeFiles(id, workId, null, 'src/list.ts');
    assert.match(diff.diff, /^diff --git a\/src\/list\.ts b\/src\/list\.ts\n/);
    assert.match(diff.diff, /\n-export const size = 10;\n\+export const size = 20;\n\+export const near = true;\n?$/);
    assert.match(work.codeFiles(id, workId, null, 'src/new-name.ts').diff, /rename from src\/old-name\.ts\nrename to src\/new-name\.ts/);
    assert.deepEqual(work.codeFiles(id, workId, null, 'icon.png'), { ...by('icon.png'), diff: null, tooLarge: false });
    assert.throws(() => work.codeFiles(id, workId, null, 'README.md'), error => error.status === 404);
    assert.throws(() => work.codeFiles(id, workId, null, '../../etc/passwd'), error => error.status === 404);

    // A reported base is used as given; a commit Aludel doesn't have, with no GitHub to fetch it from, says so.
    work.recordCode(agent, id, workId, { branch: 'aludel/w-1', commit, base: git(repo, 'rev-parse', 'main'), files: [] });
    assert.ok(work.codeFiles(id, workId, null).files.some(file => file.path === 'README.md'), 'against the reported base');
    work.recordCode(agent, id, workId, { branch: 'aludel/w-1', commit: 'abcdef1234567', files: [] });
    assert.throws(() => work.codeFiles(id, workId, null), error => error.status === 409 && /doesn't have abcdef1 yet/.test(error.message));
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (old === undefined) delete process.env.MACHINE_DATA_DIR; else process.env.MACHINE_DATA_DIR = old;
  }
});
