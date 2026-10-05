// The connection the local Aludel tools share: the portal origin and an editor token, stored outside any repository.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const configPath = process.env.ALUDEL_EDITOR_CONFIG || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'aludel', 'editor.json');
export function validateUrl(value) {
  const url = new URL(value);
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
  return { branch, commit, base: from || null, files, dirty, checkout: git('rev-parse', '--show-toplevel') };
}
