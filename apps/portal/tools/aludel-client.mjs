// The connection the local Aludel tools share: the portal origin and an editor token, stored outside any repository.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';

export const configPath = process.env.ALUDEL_EDITOR_CONFIG || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'aludel', 'editor.json');
export function validateUrl(value) {
  const url = new URL(value);
  // The portal's own address (aludel.localhost) is loopback, but Node doesn't resolve *.localhost names: use 127.0.0.1.
  if (url.protocol === 'http:' && url.hostname.endsWith('.localhost')) url.hostname = '127.0.0.1';
  // host.docker.internal is the person's own machine, seen from an item container.
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]', 'host.docker.internal'].includes(url.hostname))) throw new Error('Use HTTPS or a loopback SSH tunnel.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Use the Aludel portal origin only.');
  return url.origin;
}
export async function readToken() {
  if (!process.stdin.isTTY) return (await new Promise(resolve => {
    let value = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { value += chunk; }); process.stdin.on('end', () => resolve(value));
  })).trim();
  process.stderr.write('Paste the editor token from Work > Team, then press Enter: ');
  const input = process.stdin;
  input.setRawMode(true); input.resume(); input.setEncoding('utf8');
  return new Promise(resolve => {
    let value = '';
    const onData = chunk => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') { input.off('data', onData); input.setRawMode(false); input.pause(); process.stderr.write('\n'); resolve(value.trim()); return; }
        if (char === '\u0003') process.exit(130);
        if (char === '\u007f') value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on('data', onData);
  });
}
export async function request(config, path, payload) {
  let response;
  try {
    response = await fetch(config.url + '/api/editor' + path, { method: payload ? 'POST' : 'GET', body: payload ? JSON.stringify(payload) : undefined,
      headers: { authorization: 'Bearer ' + config.token, ...(payload ? { 'content-type': 'application/json' } : {}) }, signal: AbortSignal.timeout(8000) });
  } catch (error) {
    // W-8 F12: say which way it failed: no answer in time (often a busy portal; retry) or no connection at all.
    if (error.name === 'TimeoutError') throw new Error(`Aludel at ${config.url} didn't answer within 8 s; it may be busy. Try again in a minute, and if it keeps happening, tell your person.`);
    throw new Error(`Couldn't reach Aludel at ${config.url} (${error.cause?.code || error.message}). Ask your person whether the portal is running.`);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Aludel returned ' + response.status);
  return body;
}
export function loadConfig() {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.url = validateUrl(config.url);
  return config;
}
function saveConfig(config) {
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  chmodSync(configPath, 0o600);
}
// Pairs this machine with the portal: checks the token, then stores it readable only by you.
export async function pair(origin) {
  const url = validateUrl(origin || process.env.ALUDEL_URL || 'http://127.0.0.1:4310');
  const token = await readToken();
  if (!token) throw new Error('No token supplied.');
  const config = { url, token };
  const me = await request(config, '/me');
  saveConfig(config);
  return me;
}
async function post(url, path, payload) {
  const response = await fetch(url + path, { method: 'POST', body: JSON.stringify(payload), headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Aludel returned ' + response.status);
  return body;
}
// COLLAB-WORK-01: an item container connects itself, as `gh auth login` does. It asks Aludel for a code for its item (found
// from its repository and branch), its person presses Connect beside that code on the item's page, and it collects a token
// for that one item. `said` reports the code to show; resolves once connected.
export async function connectContainer(cwd, { origin, said = () => {}, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const url = validateUrl(origin || process.env.ALUDEL_URL || 'http://127.0.0.1:4310');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const asked = await post(url, '/api/editor/connect', { repository: git('remote', 'get-url', 'origin'), branch: git('rev-parse', '--abbrev-ref', 'HEAD') });
  said(asked);
  for (;;) {
    await wait((asked.interval || 2) * 1000);
    const polled = await post(url, '/api/editor/connect/poll', { deviceCode: asked.deviceCode });
    if (polled.status === 'connected') {
      saveConfig({ url, token: polled.token, workId: polled.workId });
      // F11: commit as the person who connected it, in this clone only.
      if (polled.identity) { git('config', 'user.name', polled.identity.name); git('config', 'user.email', polled.identity.email); }
      // Cloned on main, the container now knows its item: switch to the item's branch.
      const started = polled.item ? startBranch(cwd, polled.item.ref) : null;
      return { ...asked, ...polled, item: polled.item || asked.item, started, token: undefined };
    }
  }
}
// Where the local checkout's work is: its branch, head, and the files changed since it left the base.
export function gitReport(cwd, base = null) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch === 'HEAD') throw new Error('Check out a branch for this work first.');
  const commit = git('rev-parse', 'HEAD');
  let from = base;
  if (!from) for (const candidate of ['origin/main', 'main', 'origin/master', 'master']) {
    try { from = git('merge-base', 'HEAD', candidate); break; } catch { /* try the next */ }
  }
  const statuses = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed' };
  const files = from && from !== commit ? git('diff', '--name-status', '--find-renames', `${from}..${commit}`).split('\n').filter(Boolean).map(line => {
    const [code, ...paths] = line.split('\t');
    return { path: paths.at(-1), status: statuses[code[0]] || 'modified' };
  }) : [];
  const dirty = git('status', '--porcelain').split('\n').filter(Boolean).length;
  return { branch, commit, base: from || null, files, dirty };
}
// COLLAB-WORK-01 CW-1: committed work reaches Aludel through the project's GitHub repository, never a folder path. Push the
// branch to origin with the person's own git credentials (never Aludel's), then report it. Main only changes at close-out.
// The item's branch is rewritten by a rebase after a conflict, so the push is forced, but only over what this checkout last
// saw there (--force-with-lease); close-out merges exactly the reported commit, so nothing else can slip in.
export function pushReport(cwd, base = null) {
  const report = gitReport(cwd, base);
  if (report.dirty) throw new Error(`Commit or stash the ${report.dirty} uncommitted change${report.dirty === 1 ? '' : 's'} first; only committed work is reported.`);
  if (['main', 'master'].includes(report.branch)) throw new Error(`Work on a branch named for the item, not ${report.branch}: main only changes when your person closes the item out.`);
  try { execFileSync('git', ['push', '--quiet', '--force-with-lease', 'origin', `HEAD:refs/heads/${report.branch}`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }); }
  catch (error) {
    const said = String(error.stderr || error.message).trim().split('\n').slice(-2).join(' ');
    throw new Error(`Couldn't push ${report.branch} to origin: ${said}${/stale info|rejected/.test(said) ? ' (someone else pushed to it: fetch origin and look before pushing again)' : ''}`);
  }
  const { dirty, ...reported } = report;
  return reported;
}
// In an item container (COLLAB-WORK-01): the container is the place, so there's no folder to report or .mcp.json to write.
export const inContainer = () => process.env.ALUDEL_CONTAINER === '1';
// The item a checkout is on, from its branch (aludel/w-12 → W-12), or null.
export function branchItem(cwd) {
  try { const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); return /^aludel\/(w-\d+)$/i.exec(branch)?.[1].toUpperCase() || null; }
  catch { return null; }
}
// Where this checkout is, for the item page's Open links: its top folder, and the WSL distribution when it runs in one.
export function checkoutInfo(cwd) {
  const path = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return { path, distro: process.env.WSL_DISTRO_NAME || null };
}
// Starting work on an item: its own branch, named for it, from the latest main. Already on it: nothing changes. Moving off
// another branch needs a clean checkout, so nothing uncommitted is carried into the item.
export function startBranch(cwd, ref) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).trim();
  const has = (...args) => { try { git(...args); return true; } catch { return false; } };
  const branch = `aludel/${String(ref).toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`;
  if (git('rev-parse', '--abbrev-ref', 'HEAD') === branch) return { branch, created: false, base: null };
  const dirty = git('status', '--porcelain', '--untracked-files=no').split('\n').filter(Boolean).length;
  if (dirty) throw new Error(`Commit or stash the ${dirty} uncommitted change${dirty === 1 ? '' : 's'} here first, then start ${ref} again.`);
  if (has('rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)) { git('checkout', '--quiet', branch); return { branch, created: false, base: null }; }
  // The item's branch may already be on GitHub (Go makes it there, and an item container clones main): take it.
  if (has('fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`)) {
    git('checkout', '--quiet', '-b', branch, '--track', `origin/${branch}`);
    return { branch, created: false, base: `origin/${branch}` };
  }
  has('fetch', '--quiet', 'origin', 'main');
  const base = ['origin/main', 'main', 'origin/master', 'master'].find(name => has('rev-parse', '--verify', '--quiet', name));
  if (!base) throw new Error('This checkout has no main branch to start from.');
  git('checkout', '--quiet', '-b', branch, base);
  return { branch, created: true, base };
}
// W-8 attempt 2, E1: the layer templates this checkout's branch pins (a catalog like apps/portal/config/layer-templates.json),
// from the portal as a Git bundle, into the catalog's repository folder beside the checkout's top. A fresh folder gets the
// pins as its branches; an existing one (a person's own layer-base) only gains the commits, under refs/remotes/aludel/*.
export async function fetchTemplates(cwd, catalogPath, config = loadConfig()) {
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const catalog = JSON.parse(readFileSync(resolve(cwd, catalogPath), 'utf8'));
  if (typeof catalog.repo !== 'string' || !catalog.templates) throw new Error(`${catalogPath} isn't a layer template catalog.`);
  const target = resolve(top, catalog.repo);
  const pins = Object.values(catalog.templates).map(({ branch, commit }) => ({ branch, commit }));
  const git = (...args) => execFileSync('git', ['-C', target, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const has = commit => { try { return git('cat-file', '-t', commit) === 'commit'; } catch { return false; } };
  const fresh = !existsSync(join(target, '.git'));
  if (!fresh && pins.every(pin => has(pin.commit))) return { target, fetched: 0, fresh };
  const query = pins.map(pin => 'pin=' + encodeURIComponent(`${pin.branch}@${pin.commit}`)).join('&');
  const response = await fetch(`${config.url}/api/editor/templates?${query}`, { headers: { authorization: 'Bearer ' + config.token }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Aludel returned ' + response.status);
  const scratch = mkdtempSync(join(tmpdir(), 'aludel-templates-'));
  try {
    const bundle = join(scratch, 'templates.bundle');
    writeFileSync(bundle, Buffer.from(await response.arrayBuffer()));
    if (fresh) { mkdirSync(target, { recursive: true }); git('init', '--quiet'); }
    git('fetch', '--quiet', bundle, fresh ? '+refs/heads/*:refs/heads/*' : '+refs/heads/*:refs/remotes/aludel/*');
    if (fresh) git('checkout', '--quiet', pins.some(pin => pin.branch === 'main') ? 'main' : pins[0].branch);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  const missing = pins.filter(pin => !has(pin.commit));
  if (missing.length) throw new Error(`Still missing ${missing.map(pin => pin.branch).join(', ')} after fetching from Aludel.`);
  return { target, fetched: pins.length, fresh };
}

// W-33 (MULTI-REPO-ITEMS-01): the project's other repositories, side by side with this checkout at the folders its settings
// name. Git reaches them with the person's own credentials (in an item container, the helper VS Code forwards), never
// Aludel's, and no credential is written anywhere: the remotes are the plain clone URLs.
const quietGit = (cwd, args, timeout = 300000) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).trim();
const gitSaid = error => String(error.stderr || error.message).trim().split('\n').slice(-2).join(' ');
function companionFolder(top, repo) {
  const target = resolve(top, repo.path);
  if (target === top || !target.startsWith(top + '/')) throw new Error(`${repo.key}'s folder ${repo.path} isn't inside this checkout.`);
  return target;
}
export function checkoutRepositories(cwd, repositories) {
  const top = quietGit(cwd, ['rev-parse', '--show-toplevel']);
  const identity = ['user.name', 'user.email'].map(key => { try { return [key, quietGit(top, ['config', key])]; } catch { return null; } }).filter(Boolean);
  const done = [];
  for (const repo of repositories.filter(entry => !entry.primary)) {
    const target = companionFolder(top, repo), [line] = repo.lines;
    let state;
    try {
      if (!existsSync(join(target, '.git'))) {
        mkdirSync(dirname(target), { recursive: true });
        quietGit(top, ['clone', '--quiet', '--no-tags', '--branch', line, repo.url, target]);
        state = 'cloned';
      } else {
        let origin = null;
        try { origin = quietGit(target, ['remote', 'get-url', 'origin']); } catch { /* none yet, as a folder from the old template bundle */ }
        if (origin && origin !== repo.url) throw new Error(`its origin is ${origin}, not ${repo.url}. Point it there (git -C ${repo.path} remote set-url origin ${repo.url}) or move it aside.`);
        if (!origin) quietGit(target, ['remote', 'add', 'origin', repo.url]);
        quietGit(target, ['fetch', '--quiet', '--no-tags', '--prune', 'origin']);
        state = 'updated';
      }
    } catch (error) { done.push({ key: repo.key, path: repo.path, state: 'failed', detail: error.stderr ? gitSaid(error) : error.message }); continue; }
    for (const [key, value] of identity) quietGit(target, ['config', key, value]);
    const missing = repo.lines.filter(name => { try { quietGit(target, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${name}`]); return false; } catch { return true; } });
    done.push({ key: repo.key, path: repo.path, state, missing });
  }
  return done;
}
export async function fetchRepositories(cwd, config = loadConfig()) {
  const { repositories } = await request(config, '/repositories');
  return checkoutRepositories(cwd, repositories);
}
// The item's branch on one line of a repository: aludel/w-n on its default line, aludel/w-n--<line> on any other, so both
// can exist in one repository and the item is still read from the name. Made from origin's line, or taken up from origin
// when it's there already (a container opened again). Switching needs a clean folder.
export function lineBranch(ref, repo, line) {
  const base = `aludel/${String(ref).toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`;
  return line === repo.lines[0] ? base : `${base}--${line.replace(/[^A-Za-z0-9._-]+/g, '-')}`;
}
export function startLine(cwd, repositories, key, line) {
  const top = quietGit(cwd, ['rev-parse', '--show-toplevel']);
  const ref = branchItem(top);
  if (!ref) throw new Error('This checkout is not on an item’s branch; start the item first.');
  const repo = repositories.find(entry => entry.key === key);
  if (!repo) throw new Error(`${key} isn't one of the project's repositories (${repositories.map(entry => entry.key).join(', ')}).`);
  if (repo.primary) throw new Error(`${key} is this checkout; start_work puts it on the item's branch.`);
  if (!repo.lines.includes(line)) throw new Error(`${line} isn't one of ${key}'s lines (${repo.lines.join(', ')}). Lines are set in the project's settings.`);
  const target = companionFolder(top, repo);
  if (!existsSync(join(target, '.git'))) throw new Error(`${key} isn't checked out at ${repo.path} yet. Run: aludel repositories`);
  const git = args => quietGit(target, args);
  const has = name => { try { git(['rev-parse', '--verify', '--quiet', name]); return true; } catch { return false; } };
  const branch = lineBranch(ref, repo, line);
  if (git(['rev-parse', '--abbrev-ref', 'HEAD']) === branch) return { repository: key, line, branch, path: repo.path, created: false };
  if (git(['status', '--porcelain'])) throw new Error(`${repo.path} has uncommitted changes. Commit or stash them before switching it to ${branch}.`);
  try { git(['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${line}:refs/remotes/origin/${line}`]); } catch (error) { throw new Error(`Couldn't fetch ${line} of ${key}: ${gitSaid(error)}`); }
  try { git(['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]); } catch { /* not on origin yet */ }
  if (has(`refs/heads/${branch}`)) { git(['checkout', '--quiet', branch]); return { repository: key, line, branch, path: repo.path, created: false }; }
  const from = has(`refs/remotes/origin/${branch}`) ? `origin/${branch}` : `origin/${line}`;
  git(['checkout', '--quiet', '--no-track', '-b', branch, from]);
  return { repository: key, line, branch, path: repo.path, created: from === `origin/${line}`, from };
}
