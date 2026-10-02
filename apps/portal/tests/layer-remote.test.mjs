// T03-CODE (G-CODE): a layer instance's repository stays in sync with a remote (the owner's GitHub), against a fake GitHub in
// its own process that serves real Git over smart-HTTP and accepts only installation tokens. Checked on a plain repository
// with a base-template layer under .aludel/, so the sync is shown to be general rather than Code's.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerDocs } from '../server/layer-docs.mjs';
import { installLayerPackageInto } from '../server/layer-package.mjs';
import { initLayerRemotes, layerRemotes } from '../server/layer-remote.mjs';
import { initLayerSource } from '../server/layer-source.mjs';
import { createMarkdownDefinition } from '../server/layer-registry.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const portalRoot = new URL('..', import.meta.url).pathname;
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const identity = { GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'dev@example.com' };
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, ...identity }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

test('G-CODE: a layer repository syncs with its remote using only the installation token', async () => {
  const data = mkdtempSync(join(tmpdir(), 'aludel-layer-remote-'));
  const old = { dir: process.env.MACHINE_DATA_DIR, on: process.env.MACHINE_LAYER_TEMPLATES_ENABLED, config: process.env.GIT_CONFIG_GLOBAL };
  process.env.MACHINE_DATA_DIR = data; process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
  // The person's own git config has a helper (like `gh auth git-credential`) that would answer with their login.
  const marker = join(data, 'helper-used');
  writeFileSync(join(data, 'gitconfig'), `[credential]\n\thelper = "!f() { echo used > '${marker}'; echo username=person; echo password=personal-token; }; f"\n`);
  process.env.GIT_CONFIG_GLOBAL = join(data, 'gitconfig');
  const github = join(data, 'github');
  mkdirSync(join(github, 'octo'), { recursive: true });
  writeFileSync(join(github, 'tokens.json'), JSON.stringify(['ghs_installation-1']));
  const server = spawn(process.execPath, [join(portalRoot, 'tests/fake-github-git.mjs'), github], { stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    const port = await new Promise(resolve => server.stdout.once('data', chunk => resolve(Number(String(chunk).trim()))));
    const db = openDatabase(join(data, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(data), workspaceRoot: join(data, 'w'), assetRoot: join(data, 'a'), createWorkspace: () => {}, know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const { token: draft } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(draft, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
    const { project } = flows.claimDraft(draft, ada, ada);
    const id = project.id;
    initLayerContract(db); initLayerSource(db); initLayerRemotes(db);
    createMarkdownDefinition(db, ada.id, id, { name: 'Notes', template: 'base' });

    // The owner's repository on GitHub, made outside Aludel, and Aludel's working clone of it with the layer installed.
    const repo = join(data, 'app');
    mkdirSync(join(repo, 'src'), { recursive: true });
    git(data, 'init', '-q', '-b', 'main', repo);
    writeFileSync(join(repo, 'README.md'), '# Tool Share\n'); writeFileSync(join(repo, 'src/app.ts'), 'export const app = 1;\n');
    git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'The app');
    installLayerPackageInto(db, id, 'notes', repo, { template: 'base', replace: true });
    const bare = join(github, 'octo', 'app.git');
    git(data, 'clone', '-q', '--bare', repo, bare);
    const pin = () => db.prepare("SELECT accepted_commit AS commit_ FROM layer_package_bindings WHERE project_id = ? AND layer_key = 'notes'").get(id).commit_;
    // Someone else working on GitHub directly (pushing to the bare repository, not through Aludel).
    const other = join(data, 'other');
    git(data, 'clone', '-q', bare, other);
    const theyCommit = (path, content, message) => { git(other, 'pull', '-q', '--ff-only'); mkdirSync(join(other, path, '..'), { recursive: true }); writeFileSync(join(other, path), content); git(other, 'add', '-A'); git(other, 'commit', '-q', '-m', message); git(other, 'push', '-q', 'origin', 'main'); return git(other, 'rev-parse', 'HEAD'); };

    let token = 'ghs_installation-1';
    const held = [], diverged = [], advanced = [];
    const remotes = layerRemotes({ db, tokenFor: async () => { if (token instanceof Error) throw token; return token; },
      onHeld: (projectId, key, change) => held.push(change), onDiverged: (projectId, key, change) => diverged.push(change), onAdvance: (projectId, key, change) => advanced.push(change) });
    assert.throws(() => remotes.connect(id, 'notes', { owner: 'octo', name: 'app', cloneUrl: `http://x-access-token:ghs_secret@127.0.0.1:${port}/octo/app.git` }), /without credentials/);
    remotes.connect(id, 'notes', { owner: 'octo', name: 'app', cloneUrl: `http://127.0.0.1:${port}/octo/app.git`, htmlUrl: 'https://github.com/octo/app', source: 'project-repository' });
    assert.equal((await remotes.fetch(id, 'notes')).state, 'in-sync');

    // A person's change in Aludel: one commit on main, then a push.
    const docs = layerDocs({ db });
    const before = pin();
    const saved = docs.save(id, ada.id, 'notes', { path: 'knowledge/charter.md', content: '# Notes\n\nAbout the app.\n', base: before });
    assert.equal((await remotes.fetch(id, 'notes')).state, 'ahead');
    const pushed = await remotes.sync(id, 'notes');
    assert.equal(pushed.state, 'in-sync');
    assert.equal(git(bare, 'rev-parse', 'main'), saved.commit, 'GitHub has the save');

    // Someone pushes app code to GitHub: Aludel fast-forwards its copy and the pin.
    const theirs = theyCommit('src/app.ts', 'export const app = 2;\n', 'Bump the app');
    const picked = await remotes.fetch(id, 'notes');
    assert.equal(picked.state, 'in-sync');
    assert.equal(pin(), theirs);
    assert.equal(readFileSync(join(repo, 'src/app.ts'), 'utf8'), 'export const app = 2;\n', 'the working copy follows');
    assert.deepEqual(advanced, [{ from: saved.commit, to: theirs }]);

    // A change on GitHub to what the layer runs is held for a person; the pin stays on the reviewed commit.
    const handler = theyCommit('.aludel/server/rules.mjs', 'export function normalize() {}\n', 'Change the layer\'s rules');
    const holding = await remotes.fetch(id, 'notes');
    assert.equal(holding.state, 'held');
    assert.match(holding.detail, /\.aludel\/server\/rules\.mjs/);
    assert.equal(pin(), theirs);
    assert.equal((await remotes.fetch(id, 'notes')).state, 'held');
    assert.equal(held.length, 1, 'held once, however often it is fetched');
    const reviewed = [];
    const accepted = await remotes.acceptHeld(id, 'notes', 'Ada', { review: (repository, commit, reviewer) => reviewed.push([commit, reviewer]) });
    assert.equal(accepted.state, 'in-sync');
    assert.equal(pin(), handler);
    assert.deepEqual(reviewed, [[handler, 'Ada']]);

    // Both sides move: no automatic merge, and nothing is pushed until a person resolves it.
    const mine = docs.save(id, ada.id, 'notes', { path: 'knowledge/charter.md', content: '# Notes\n\nAbout the app, again.\n', base: pin() });
    const theirsAgain = theyCommit('README.md', '# Tool Share\n\nLend tools.\n', 'Describe it');
    const split = await remotes.sync(id, 'notes');
    assert.equal(split.state, 'diverged');
    assert.deepEqual(diverged, [{ pin: mine.commit, remote: theirsAgain }]);
    assert.equal(git(bare, 'rev-parse', 'main'), theirsAgain, 'GitHub is left as it was');
    assert.equal((await remotes.push(id, 'notes')).state, 'diverged', 'a push is refused and settles as diverged');
    assert.equal(diverged.length, 1);

    // Unavailable: the token expired, the App lost access, or the repository is gone. The layer keeps working locally.
    token = Object.assign(new Error('The GitHub authorization expired. Reconnect GitHub.'), { code: 'expired' });
    const expired = await remotes.fetch(id, 'notes');
    assert.equal(expired.state, 'unavailable'); assert.match(expired.detail, /^expired: /);
    token = 'ghs_revoked';
    const refused = await remotes.fetch(id, 'notes');
    assert.equal(refused.state, 'unavailable'); assert.match(refused.detail, /fetch failed/);
    token = 'ghs_installation-1';
    renameSync(bare, `${bare}.deleted`);
    assert.equal((await remotes.push(id, 'notes')).state, 'unavailable');
    const local = docs.save(id, ada.id, 'notes', { path: 'knowledge/charter.md', content: '# Notes\n\nStill editable.\n', base: pin() });
    assert.equal(local.changed, true);

    // Only installation tokens went to GitHub; the person's helper was never asked; no token is stored.
    assert.equal(existsSync(marker), false, 'the person\'s credential helper is never used');
    assert.deepEqual([...new Set(readFileSync(join(github, 'seen.txt'), 'utf8').trim().split('\n'))].sort(), ['x-access-token:ghs_installation-1', 'x-access-token:ghs_revoked']);
    const stored = JSON.stringify(db.prepare('SELECT * FROM layer_remotes').all());
    assert.doesNotMatch(stored, /ghs_/);
    db.close();
  } finally {
    server.kill();
    rmSync(data, { recursive: true, force: true });
    for (const [name, value] of [['MACHINE_DATA_DIR', old.dir], ['MACHINE_LAYER_TEMPLATES_ENABLED', old.on], ['GIT_CONFIG_GLOBAL', old.config]]) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
