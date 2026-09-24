// PLATFORM-PIPELINE-01 (PP-01A): a generated app builds from its own Dockerfile and runs in one limited container.
// Needs a reachable Docker daemon; skipped otherwise. The first run pulls node:24-bookworm-slim and installs the preset.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { containerLimits, previewManager, previewRuntime } from '../server/previews.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { copyMedia, loadScaffoldSources, skeletonFiles, writeBinaries, writeFiles } from '../server/scaffold.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const dockerReady = previewRuntime({}) === 'docker';
const configDirectory = new URL('../config', import.meta.url).pathname;
const catalogs = loadCatalogs(configDirectory);
const gitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(join(configDirectory, 'project-setup.json'), 'utf8')));
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });
const post = (port, path, body) => new Promise((resolve, reject) => {
  const payload = JSON.stringify(body);
  const call = request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } }, response => {
    let text = ''; response.on('data', chunk => { text += chunk; }); response.on('end', () => resolve({ status: response.statusCode, body: text }));
  });
  call.on('error', reject); call.end(payload);
});

// A signed-in Tool Share skeleton, generated exactly as onboarding generates one.
function generatedApp(root) {
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'),
    createWorkspace: () => {}, know, checkAgentKey: async () => ({ ok: true }) });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'dreamer' });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  const setup = flows.projectSetup(ada, project.id);
  const workspace = join(root, 'workspaces', project.id);
  mkdirSync(workspace, { recursive: true });
  const generated = skeletonFiles(setup, catalogs, gitProfile, { portal: 'http://aludel.localhost:4310', app: 'http://tool-share.localhost:4310' }, [], loadScaffoldSources(new URL('..', import.meta.url).pathname));
  writeFiles(workspace, generated.files); writeBinaries(workspace, generated.binaries); copyMedia(workspace, generated.media);
  return { db, project, workspace, auth: Boolean(setup.stack.options?.auth), files: generated.files };
}

test('the skeleton declares how it runs, without setting its own limits', () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-container-files-'));
  try {
    const { files } = generatedApp(root);
    assert.match(files.Dockerfile, /^FROM node:24-bookworm-slim AS build$/m);
    assert.match(files.Dockerfile, /^USER node$/m, 'the app runs as a non-root user');
    assert.match(files.Dockerfile, /npm (ci|install)/, 'dependencies are the app\'s own, installed from its package.json');
    assert.doesNotMatch(files.Dockerfile + files['compose.yaml'], /memory|cpus|pids/i, 'limits belong to the host');
    assert.match(files['.dockerignore'], /^\.data$/m, 'runtime data never enters the image');
    assert.match(files['.env.example'], /^DATA_DIR=/m);
    assert.match(files['AGENTS.md'], /docker compose up --build/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a preview builds from the app\'s Dockerfile and runs in one limited container', { skip: !dockerReady && 'Docker is not reachable', timeout: 600_000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-container-'));
  const { db, project, workspace, auth } = generatedApp(root);
  const previews = previewManager({ db, portalRoot: new URL('..', import.meta.url).pathname, workspaceRoot: join(root, 'workspaces'), logRoot: join(root, 'logs'), runtime: 'docker' });
  // A second portal has its own database and workspaces, as a test run or another checkout would.
  const otherDb = openDatabase(join(root, 'other.sqlite'));
  const other = previewManager({ db: otherDb, portalRoot: new URL('..', import.meta.url).pathname, workspaceRoot: join(root, 'other-portal'), logRoot: join(root, 'other-logs'), runtime: 'docker' });
  try {
    assert.equal(existsSync(join(root, 'workspaces', 'node_modules')), false, 'containers never borrow the portal\'s packages');
    const status = await previews.build(project.id, workspace, 'test');
    assert.equal(status.status, 'running', status.log);
    const port = await previews.ensureRunning(project.id, workspace);
    assert.ok((await previews.probe(project.id)).ok);

    const container = docker('ps', '-q', '--filter', `label=aludel.project=${project.id}`).stdout.trim();
    assert.ok(container, 'one running container for the project');
    const [inspected] = JSON.parse(docker('inspect', container).stdout);
    const host = inspected.HostConfig;
    assert.equal(host.Memory, 256 * 1024 * 1024); assert.equal(host.MemorySwap, host.Memory, 'no swap beyond the memory limit');
    assert.equal(host.NanoCpus, Number(containerLimits.cpus) * 1e9); assert.equal(host.PidsLimit, containerLimits.pids);
    assert.equal(host.ReadonlyRootfs, true); assert.deepEqual(host.CapDrop, ['ALL']); assert.ok(host.SecurityOpt.includes('no-new-privileges'));
    assert.equal(inspected.Config.User, 'node');
    assert.ok(Object.values(host.PortBindings).flat().every(binding => binding.HostIp === '127.0.0.1'), 'the port is published on loopback only');

    assert.ok(auth, 'the default skeleton has sign-in, so it has a database to keep');
    {
      assert.equal((await post(port, '/api/sign-up', { email: 'a@b.co', name: 'A', password: 'longenough1' })).status, 201);
      assert.ok(existsSync(join(workspace, '.data', 'app.sqlite')), 'app data lands in the workspace, where backups and the Database view read it');
    }

    // Another portal instance starting up leaves this one's containers alone.
    previewManager({ db: otherDb, portalRoot: new URL('..', import.meta.url).pathname, workspaceRoot: join(root, 'other-portal'), logRoot: join(root, 'other-logs'), runtime: 'docker' });
    assert.ok((await previews.probe(project.id)).ok);

    // Restarting gets a new published port; the data survives.
    await previews.stop(project.id);
    assert.equal(docker('ps', '-aq', '--filter', `label=aludel.project=${project.id}`).stdout.trim(), '', 'stopping removes the container');
    const again = await previews.ensureRunning(project.id, workspace);
    assert.ok(again);
    assert.equal((await post(again, '/api/sign-in', { email: 'a@b.co', password: 'longenough1' })).status, 200);
  } finally {
    previews.stopAll(); other.stopAll();
    docker('image', 'rm', '-f', `aludel-preview/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
