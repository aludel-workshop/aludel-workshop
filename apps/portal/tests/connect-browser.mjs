// EX-02A C3: New project → Connect an existing repository, in a browser against a fake GitHub (tests/fake-github.mjs, the
// C1 harness): sign in with GitHub, pick the repository, see a repository whose default branch isn't main refused, choose
// where a monorepo's code is, choose layers, connect. Then checks what landed on GitHub (one .aludel/ commit with the chosen
// code paths, the repository's own AGENTS.md untouched, no starter docs), that Code reads the app's code, and that a goal
// item's branch pushed to GitHub closes out into the connected repository's main (COLLAB-WORK-01 CW-1). axe and no sideways
// scroll on every screen, at 1440 and 390 px.
// Usage: npm run build, then CHROMIUM_PATH=<…> PLAYWRIGHT_MODULE=<…/playwright/index.mjs> node tests/connect-browser.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const portalDir = new URL('..', import.meta.url).pathname;
const dest = join(portalDir, 'test-results/connect/'); mkdirSync(dest, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-connect-'));
const identity = { GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'dev@example.com' };
writeFileSync(join(root, 'gitconfig'), '');
const gitEnv = { ...process.env, ...identity, GIT_CONFIG_GLOBAL: join(root, 'gitconfig') };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (base, files) => { for (const [path, text] of Object.entries(files)) { mkdirSync(join(base, path, '..'), { recursive: true }); writeFileSync(join(base, path), text); } };
const freePort = async () => { const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r)); return port; };

// Fake GitHub: an organization `octo` with a monorepo (its app in apps/web) and an old repository on master.
const github = join(root, 'github'); mkdirSync(join(github, 'octo'), { recursive: true });
const made = join(root, 'made');
git(root, 'init', '-q', '-b', 'main', made);
write(made, {
  'README.md': '# Tool Share\n', 'AGENTS.md': '# Tool Share\n\nOur own guide for agents.\n', 'docs/notes.md': '# Notes\n',
  'apps/web/package.json': JSON.stringify({ name: 'web', dependencies: { express: '4' } }),
  'apps/web/src/lend.ts': 'export function lend(tool: string) { return `Lent ${tool}`; }\n',
  'apps/web/server/routes.mjs': "import { lend } from '../src/lend.ts';\nexport const routes = { '/lend': lend };\n",
  'apps/web/tests/lend.test.mjs': "import { lend } from '../src/lend.ts';\nlend('ladder');\n",
  'scripts/tool/package.json': JSON.stringify({ name: 'tool' }), 'scripts/tool/index.mjs': 'export const tool = 1;\n'
});
git(made, 'add', '-A'); git(made, 'commit', '-qm', 'Their app');
git(root, 'clone', '-q', '--bare', made, join(github, 'octo', 'tool-share.git'));
const old = join(root, 'old'); git(root, 'init', '-q', '-b', 'master', old); write(old, { 'index.js': 'console.log(1);\n' }); git(old, 'add', '-A'); git(old, 'commit', '-qm', 'Old');
git(root, 'clone', '-q', '--bare', old, join(github, 'octo', 'old-blog.git'));

const port = await freePort();
const portal = `http://aludel.localhost:${port}`;
writeFileSync(join(github, 'github.json'), JSON.stringify({ user: { login: 'octo', id: 7, name: 'Octo' }, setupUrl: `${portal}/api/integrations/github/installed`,
  installations: [{ id: 44, account: { login: 'octo', id: 70 }, target_type: 'Organization', repository_selection: 'all', permissions: { administration: 'write', contents: 'write', metadata: 'read' } }] }));
const fake = spawn(process.execPath, [join(portalDir, 'tests/fake-github.mjs'), github], { stdio: ['ignore', 'pipe', 'inherit'] });
const fakePort = await new Promise(resolve => fake.stdout.once('data', chunk => resolve(Number(String(chunk).trim()))));
const keyPath = join(root, 'app.pem');
writeFileSync(keyPath, generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }));

const data = join(root, 'data');
const server = spawn(process.execPath, ['server/server.mjs'], { cwd: portalDir, stdio: ['ignore', 'pipe', 'pipe'], env: { ...gitEnv, MACHINE_DATA_DIR: data, MACHINE_PORT: String(port),
  MACHINE_LAYER_TEMPLATES_ENABLED: '1', MACHINE_PREVIEW_RUNTIME: 'process', MACHINE_PUBLIC_BASE_URL: portal,
  MACHINE_GITHUB_API_URL: `http://127.0.0.1:${fakePort}/api`, MACHINE_GITHUB_WEB_URL: `http://127.0.0.1:${fakePort}`,
  MACHINE_GITHUB_APP_ID: '24680', MACHINE_GITHUB_APP_SLUG: 'aludel-test', MACHINE_GITHUB_CLIENT_ID: 'Iv1234567890', MACHINE_GITHUB_CLIENT_SECRET: 'a-very-long-test-client-secret', MACHINE_GITHUB_PRIVATE_KEY_PATH: keyPath } });
let serverLog = ''; server.stdout.on('data', chunk => serverLog += chunk); server.stderr.on('data', chunk => serverLog += chunk);
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const errors = [];
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${portal.replace('aludel.localhost', '127.0.0.1')}/api/session`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 500)); }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const check = async name => {
    await page.waitForTimeout(150);
    await page.evaluate(axe);
    const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main') || document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(' ')}`));
    assert.deepEqual(violations, [], `axe: ${name}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll: ${name}`);
    await page.screenshot({ path: `${dest}${name}.png`, fullPage: true });
  };
  const narrow = async name => { await page.setViewportSize({ width: 390, height: 844 }); await check(`${name}-390`); await page.setViewportSize({ width: 1440, height: 1000 }); };

  // Start: the landing's Get started asks whether there's code already.
  await page.goto(portal + '/');
  await page.getByRole('link', { name: 'Get started' }).click();
  await page.getByRole('heading', { name: 'Do you have code already?' }).waitFor();
  await check('01-start'); await narrow('01-start');
  await page.getByRole('radio', { name: /Connect an existing repository/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'How do you want to work?' }).waitFor();
  await page.getByRole('radio', { name: /^Planner/ }).check();
  await check('02-style');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'Sign in with GitHub' }).waitFor();
  await check('03-account');
  // GitHub (the fake) approves at once and comes back: signed in, identity connected, installations synced.
  await page.getByRole('button', { name: 'Continue with GitHub' }).click();
  await page.waitForURL(/\/connect\/account/);
  await page.getByText('Signed in as octo').waitFor();
  await check('04-account-connected');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'Which repository?' }).waitFor();
  await page.getByRole('option', { name: /octo\/tool-share/ }).waitFor();
  await check('05-repository'); await narrow('05-repository');

  // A repository on master is checked and refused, with what to do.
  await page.getByRole('option', { name: /octo\/old-blog/ }).click();
  await page.getByRole('button', { name: 'Check repository' }).click();
  await page.getByText(/uses master as its default branch/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Continue' }).isEnabled(), false, 'master is refused');
  await check('06-code-master');
  await page.getByRole('link', { name: 'Back' }).click();

  // The monorepo: apps/web is suggested; the root and the script folder are offered.
  await page.getByRole('option', { name: /octo\/tool-share/ }).click();
  await page.getByRole('button', { name: 'Check repository' }).click();
  await page.getByRole('heading', { name: 'Where is the code?' }).waitFor();
  await page.getByText('Code will read 3 files.').waitFor();
  const folders = page.locator('.pub-folder-list label');
  assert.deepEqual(await folders.locator('code').allTextContents(), ['tool-share (root)', 'apps/web', 'scripts/tool']);
  assert.ok(await folders.nth(1).locator('input').isChecked(), 'apps/web is chosen');
  assert.deepEqual(await page.locator('.pub-path-chips code').allTextContents(), ['apps/web/src/**', 'apps/web/server/**', 'apps/web/tests/**']);
  await check('07-code'); await narrow('07-code');
  // Edited paths are counted again.
  await page.getByText('Edit paths').click();
  await page.getByLabel('Paths Code reads, one per line').fill('apps/web/src/**');
  await page.getByText('Code will read 1 files.').waitFor();
  await page.getByLabel('Paths Code reads, one per line').fill('apps/web/src/**\napps/web/server/**\napps/web/tests/**');
  await page.getByText('Code will read 3 files.').waitFor();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'Which layers?' }).waitFor();
  assert.ok(await page.getByRole('checkbox', { name: /Code/ }).isDisabled(), 'Code stays on');
  await check('08-layers');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'Ready to connect' }).waitFor();
  assert.equal(await page.getByLabel('Project name').inputValue(), 'Tool Share');
  await page.getByText(/^The 17 files$/).click();
  await check('09-finish'); await narrow('09-finish');
  const before = git(join(github, 'octo', 'tool-share.git'), 'rev-parse', 'main');
  await page.getByRole('button', { name: 'Connect and push' }).click();
  await page.getByRole('heading', { name: 'Tool Share is connected' }).waitFor({ timeout: 60000 });
  await page.getByText('Code read 3 files').waitFor();
  await check('10-connected');

  // GitHub got exactly one commit: .aludel/ with the chosen paths. The repository's own files are as they were.
  const bare = join(github, 'octo', 'tool-share.git');
  assert.equal(git(bare, 'rev-parse', 'main^'), before, 'one commit on top of theirs');
  const added = git(bare, 'diff', '--name-only', before, 'main').split('\n');
  assert.ok(added.length === 17 && added.every(path => path.startsWith('.aludel/')), `only .aludel/ was added: ${added.join(', ')}`);
  assert.deepEqual([...JSON.parse(git(bare, 'show', 'main:.aludel/layer.json')).files.units].sort(), ['apps/web/server/**', 'apps/web/src/**', 'apps/web/tests/**']);
  assert.equal(git(bare, 'show', 'main:AGENTS.md'), '# Tool Share\n\nOur own guide for agents.', 'their AGENTS.md is untouched');
  assert.ok(!git(bare, 'ls-tree', '-r', '--name-only', 'main').split('\n').some(path => ['ARCHITECTURE.md', 'docs/product/index.md'].includes(path)), 'no starter docs');
  const requests = readFileSync(join(github, 'requests.txt'), 'utf8');
  assert.ok(/POST \/api\/app\/installations\/44\/access_tokens/.test(requests) && /GET \/api\/installation\/repositories/.test(requests));

  // API calls go through the page: the browser resolves aludel.localhost, Node doesn't.
  const call = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const result = await page.evaluate(async ([path, method, body, headers]) => {
      const response = await fetch(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { ok: response.ok, value: await response.json().catch(() => ({})) };
    }, [path, method, body, headers]);
    if (!result.ok) throw new Error(`${path}: ${result.value.error}`);
    return result.value;
  };
  // The project opens on its own address, and Code reads the app's code under apps/web.
  const project = (await call('/api/projects')).projects.find(item => item.name === 'Tool Share');
  assert.ok(project, 'the project exists');
  const code = await call(`/api/projects/${project.id}/library?kind=code_unit&data=1&limit=100`);
  const symbols = JSON.stringify(code);
  assert.ok(/lend/.test(symbols) && !/scripts\/tool/.test(symbols), 'Code reads apps/web only');

  // CW-1 against GitHub: a goal item's branch, pushed to GitHub from someone's own clone, closes out into main.
  const goal = (path, body) => call(`/api/projects/${project.id}/goals${path}`, { method: 'POST', body });
  const workId = (await goal('', { title: 'Lend says who' })).item.id;
  await goal(`/${workId}/define`, { brief: 'Lend says who lent it.', actions: [{ goal: 'Name the lender' }] });
  await goal(`/${workId}/claim`, {});
  const editorToken = (await call(`/api/projects/${project.id}/editor`, { method: 'POST', body: {} })).token;
  const agent = (path, body) => call(`/api/editor/goals/${encodeURIComponent(workId)}${path}`, { method: 'POST', body, headers: { authorization: `Bearer ${editorToken}` } });
  await goal(`/${workId}/move`, { to: 'progress' });
  const clone = join(root, 'elsewhere');
  git(root, 'clone', '-q', bare, clone); git(clone, 'checkout', '-q', '-b', 'aludel/lend-who');
  writeFileSync(join(clone, 'apps/web/src/lend.ts'), 'export function lend(tool: string, who = "a neighbour") { return `${who} lent ${tool}`; }\n');
  git(clone, 'commit', '-qam', 'Lend says who'); git(clone, 'push', '-q', 'origin', 'aludel/lend-who');
  await agent('/actions/1', { state: 'working' }); await agent('/actions/1', { state: 'review', summary: 'Lend names the lender' });
  await agent('/code', { branch: 'aludel/lend-who', commit: git(clone, 'rev-parse', 'HEAD'), files: [{ path: 'apps/web/src/lend.ts', status: 'modified' }] });
  await goal(`/${workId}/move`, { to: 'review' });
  await goal(`/${workId}/review/1`, { verdict: 'approve' });
  // Meanwhile main moves on GitHub (a pull request merged there): close-out takes it first and merges onto it.
  const merger = join(root, 'merger');
  git(root, 'clone', '-q', bare, merger); writeFileSync(join(merger, 'README.md'), '# Tool Share\n\nMerged on GitHub.\n');
  git(merger, 'commit', '-qam', 'A pull request merged on GitHub'); git(merger, 'push', '-q', 'origin', 'main');
  const closed = await goal(`/${workId}/close`, {});
  assert.equal(closed.item.board, 'done');
  assert.deepEqual(git(bare, 'log', '-1', '--format=%P', 'main').split(' '), [git(merger, 'rev-parse', 'HEAD'), git(clone, 'rev-parse', 'HEAD')], 'main on GitHub merges the reviewed commit onto what GitHub had');
  assert.ok(closed.events.some(event => /Pushed main to GitHub \(octo\/tool-share\)/.test(event.text)));

  // COLLAB-WORK-01 item containers: Go makes the item's branch on GitHub and hands VS Code a Dev Containers link; the
  // container (here, a clone of that branch) connects itself to its item when its person presses Connect beside its code.
  const next = (await goal('', { title: 'Lend shows the due date' })).item;
  await goal(`/${next.id}/assign`, { assignee: { kind: 'person', id: (await call('/api/session')).user.id } });
  // The container is built from the repository's dev container: none on main, nothing to open (not VS Code's template picker).
  await assert.rejects(goal(`/${next.id}/container`, {}), /main has no \.devcontainer\/devcontainer\.json/);
  const mover = join(root, 'mover'); git(root, 'clone', '-q', bare, mover);
  write(mover, { '.devcontainer/devcontainer.json': '{ "image": "node:24" }\n' });
  git(mover, 'add', '-A'); git(mover, 'commit', '-qm', 'A dev container lands on main'); git(mover, 'push', '-q', 'origin', 'main');
  const opened = await goal(`/${next.id}/container`, {});
  const branch = `aludel/${next.ref.toLowerCase()}`;
  assert.equal(opened.branch, branch);
  assert.equal(git(bare, 'rev-parse', branch), git(bare, 'rev-parse', 'main'), 'the item\'s branch starts at main on GitHub');
  // Dev Containers checks the link's url with `git ls-remote` as given, so it is the plain repository (the clone starts on main).
  const firstVolume = `aludel-${project.slug}-${next.ref.toLowerCase()}-${git(bare, 'rev-parse', 'main').slice(0, 7)}`;
  assert.equal(opened.link, 'vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=' + encodeURIComponent(`http://127.0.0.1:${fakePort}/octo/tool-share.git`)
    + '&volume=' + encodeURIComponent(firstVolume));
  // Main moves on GitHub; opening it again moves the item's branch up with it, since it has no work of its own yet.
  writeFileSync(join(mover, 'CHANGELOG.md'), '# Changes\n');
  git(mover, 'add', '-A'); git(mover, 'commit', '-qm', 'Changes on main'); git(mover, 'push', '-q', 'origin', 'main');
  const again = await goal(`/${next.id}/container`, {});
  assert.deepEqual([again.created, again.caughtUp, git(bare, 'rev-parse', branch)], [false, true, git(bare, 'rev-parse', 'main')], 'the item branch follows main until it has work');
  assert.notEqual(again.volume, firstVolume, 'a branch that moved up gets a fresh clone, not the volume cloned before it');
  // Once the branch has work, its start stays put, so reopening it reuses its container.
  const worker = join(root, 'worker'); git(root, 'clone', '-q', '--branch', branch, bare, worker);
  writeFileSync(join(worker, 'due.txt'), 'due\n'); git(worker, 'add', '-A'); git(worker, 'commit', '-qm', 'Work on the item'); git(worker, 'push', '-q', 'origin', branch);
  const reopened = await goal(`/${next.id}/container`, {});
  assert.deepEqual([reopened.caughtUp, reopened.volume], [false, again.volume], 'an item with work reopens in the same container');
  git(bare, 'update-ref', `refs/heads/${branch}`, git(bare, 'rev-parse', 'main'));
  const box = join(root, 'container');
  // Dev Containers clones with the person's own git credentials; the fake GitHub only serves tokens it minted, so the
  // stand-in clones the bare repository on main and keeps GitHub's address as its origin, as that clone would.
  git(root, 'clone', '-q', bare, box);
  git(box, 'remote', 'set-url', 'origin', `http://127.0.0.1:${fakePort}/octo/tool-share.git`);
  const boxEnv = { ...gitEnv, ALUDEL_URL: `http://127.0.0.1:${port}`, ALUDEL_CONTAINER: '1', ALUDEL_EDITOR_CONFIG: join(root, 'box-editor.json') };
  const connecting = spawn(process.execPath, [join(portalDir, 'tools/aludel.mjs'), 'connect'], { cwd: box, env: boxEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let said = ''; connecting.stdout.on('data', chunk => said += chunk); connecting.stderr.on('data', chunk => said += chunk);
  const exited = new Promise(resolve => connecting.on('exit', resolve));
  for (let tries = 0; !/press Connect beside [A-Z0-9]{4}-[A-Z0-9]{4}/.test(said) && tries < 100; tries++) await page.waitForTimeout(100);
  assert.match(said, /Connect this container to its item: on the item's page/, 'on main, it doesn\'t know its item yet');
  const shown = /beside ([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(said)?.[1];
  assert.ok(shown, `the container shows a code: ${said}`);
  await page.goto(`${portal}/p/${project.slug}/work/item/${encodeURIComponent(next.id)}`);
  const asking = page.getByRole('status').filter({ hasText: 'A container is asking to connect' });
  await asking.waitFor();
  assert.match(await asking.innerText(), new RegExp(shown));
  await check('container-asking');
  await page.getByRole('button', { name: `Connect the container showing ${shown} to ${next.ref}` }).click();
  assert.equal(await exited, 0, said);
  assert.match(said, new RegExp(`Connected to ${next.ref}, on ${branch}`));
  assert.equal(git(box, 'rev-parse', '--abbrev-ref', 'HEAD'), branch, 'connected from the item, the container switched to its branch');
  assert.equal(git(box, 'rev-parse', 'HEAD'), git(bare, 'rev-parse', 'main'));
  await asking.waitFor({ state: 'detached' });
  // The container's token works for its own item, and only that one.
  const boxToken = JSON.parse(readFileSync(join(root, 'box-editor.json'), 'utf8')).token;
  const asBox = async path => { const response = await fetch(`http://127.0.0.1:${port}/api/editor${path}`, { headers: { authorization: `Bearer ${boxToken}` } }); return { status: response.status, value: await response.json() }; };
  assert.deepEqual((await asBox('/goals')).value.goals.map(item => item.id), [next.id]);
  assert.equal((await asBox(`/goals/${next.id}`)).status, 200);
  assert.equal((await asBox(`/goals/${workId}`)).status, 404, 'not the other items');
  // The portal answers an item container at host.docker.internal on the editor API only.
  const asHost = (path, headers = {}) => new Promise(resolve => import('node:http').then(({ request }) => request({ host: '127.0.0.1', port, path, headers: { host: 'host.docker.internal', ...headers } }, res => resolve(res.statusCode)).end()));
  assert.equal(await asHost('/api/editor/goals', { authorization: `Bearer ${boxToken}` }), 200);
  assert.equal(await asHost('/api/session'), 421);
  assert.equal(await asHost('/api/editor/tools/editor-mcp.mjs'), 200, 'the tools are served for container setup');
  assert.deepEqual(errors, []);
  console.log('PASS connect: start choice, working style, GitHub sign-in on the fake, repository list, master refused, monorepo code paths suggested and edited, layers, one .aludel/ commit pushed with the chosen paths, their AGENTS.md untouched and no starter docs, Code reads apps/web, a goal item closes out from GitHub onto a main that moved there, an item container’s branch and link, and the container connecting itself to its one item; axe at 1440 and 390 px.');
} catch (error) {
  console.error(serverLog.split('\n').slice(-30).join('\n'));
  throw error;
} finally {
  await browser.close(); server.kill(); fake.kill();
  rmSync(root, { recursive: true, force: true });
}
