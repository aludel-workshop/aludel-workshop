// The connection the local Aludel tools share: the portal origin and an editor token, stored outside any repository.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const configPath = process.env.ALUDEL_EDITOR_CONFIG || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'aludel', 'editor.json');
export function validateUrl(value) {
  const url = new URL(value);
  // The portal's own address (aludel.localhost) is loopback, but Node doesn't resolve *.localhost names: use 127.0.0.1.
  if (url.protocol === 'http:' && url.hostname.endsWith('.localhost')) url.hostname = '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS or a loopback SSH tunnel.');
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
  const response = await fetch(config.url + '/api/editor' + path, { method: payload ? 'POST' : 'GET', body: payload ? JSON.stringify(payload) : undefined,
    headers: { authorization: 'Bearer ' + config.token, ...(payload ? { 'content-type': 'application/json' } : {}) }, signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Aludel returned ' + response.status);
  return body;
}
export function loadConfig() {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.url = validateUrl(config.url);
  return config;
}
// Pairs this machine with the portal: checks the token, then stores it readable only by you.
export async function pair(origin) {
  const url = validateUrl(origin || 'http://127.0.0.1:4310');
  const token = await readToken();
  if (!token) throw new Error('No token supplied.');
  const config = { url, token };
  const me = await request(config, '/me');
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  chmodSync(configPath, 0o600);
  return me;
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
  has('fetch', '--quiet', 'origin', 'main');
  const base = ['origin/main', 'main', 'origin/master', 'master'].find(name => has('rev-parse', '--verify', '--quiet', name));
  if (!base) throw new Error('This checkout has no main branch to start from.');
  git('checkout', '--quiet', '-b', branch, base);
  return { branch, created: true, base };
}
