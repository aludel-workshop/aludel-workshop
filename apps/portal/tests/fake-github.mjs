// A stand-in for GitHub for browser journeys (EX-02A C1): the API, the OAuth and App-install pages, and Git smart-HTTP,
// in one process the portal reaches through MACHINE_GITHUB_API_URL (`<origin>/api`) and MACHINE_GITHUB_WEB_URL (`<origin>`).
// Repositories are bare repositories under <root>/<owner>/<name>.git, served by `git http-backend`; Git answers only Basic
// credentials of `x-access-token:<token>` for an installation token this server minted. <root>/github.json says who the
// person is, which installations they have and the App's setup URL:
//   { "user": { "login", "id", "name" }, "installations": [{ "id", "account": { "login", "id" }, "target_type",
//     "repository_selection", "permissions" }], "setupUrl": "<portal>/api/integrations/github/installed" }
// Every request is appended to <root>/requests.txt (method and path, never a credential), so a journey can check what the
// portal asked for. Run as its own process: node tests/fake-github.mjs <root>   → prints the port.
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const root = process.argv[2];
const backend = join(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), 'git-http-backend');
const config = () => JSON.parse(readFileSync(join(root, 'github.json'), 'utf8'));
const minted = new Set();
let origin = '';

const send = (response, status, value) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
const redirect = (response, location) => { response.writeHead(302, { location }); response.end(); };
const body = request => new Promise(resolve => { let raw = ''; request.on('data', chunk => raw += chunk); request.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } }); });
const repoDir = (owner, name) => join(root, owner, `${name}.git`);
const defaultBranch = dir => { try { return execFileSync('git', ['-C', dir, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'main'; } };
const repoView = (owner, name) => {
  const dir = repoDir(owner, name);
  return { name, owner: { login: owner }, private: true, html_url: `${origin}/${owner}/${name}`, clone_url: `${origin}/${owner}/${name}.git`,
    default_branch: defaultBranch(dir), description: '', pushed_at: statSync(dir).mtime.toISOString() };
};

function git(request, response, url) {
  const auth = request.headers.authorization;
  const credential = auth ? Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString() : '';
  const [user, token] = credential.split(':');
  if (user !== 'x-access-token' || !minted.has(token)) { response.writeHead(401, { 'www-authenticate': 'Basic realm="GitHub"' }); return response.end(); }
  const repo = /^\/([^/]+)\/([^/]+\.git)\//.exec(url.pathname);
  if (!repo || !existsSync(join(root, repo[1], repo[2]))) { response.writeHead(404); return response.end('Repository not found.'); }
  const cgi = spawn(backend, [], { env: { GIT_PROJECT_ROOT: root, GIT_HTTP_EXPORT_ALL: '1', PATH_INFO: url.pathname, REQUEST_METHOD: request.method,
    QUERY_STRING: url.search.slice(1), CONTENT_TYPE: request.headers['content-type'] || '', REMOTE_USER: 'x-access-token', REMOTE_ADDR: '127.0.0.1',
    HTTP_CONTENT_ENCODING: request.headers['content-encoding'] || '', GIT_HTTP_MAX_REQUEST_BUFFER: '100M', PATH: process.env.PATH } });
  request.pipe(cgi.stdin);
  let head = Buffer.alloc(0), started = false;
  cgi.stdout.on('data', chunk => {
    if (started) return response.write(chunk);
    head = Buffer.concat([head, chunk]);
    const end = head.indexOf('\r\n\r\n');
    if (end < 0) return;
    const headers = {}; let status = 200;
    for (const line of head.subarray(0, end).toString().split('\r\n')) {
      const at = line.indexOf(':'); const name = line.slice(0, at).trim(), value = line.slice(at + 1).trim();
      if (/^status$/i.test(name)) status = Number(value.split(' ')[0]); else headers[name] = value;
    }
    response.writeHead(status, headers); started = true;
    response.write(head.subarray(end + 4));
  });
  cgi.on('close', () => response.end());
}

createServer(async (request, response) => {
  const url = new URL(request.url, origin || 'http://127.0.0.1');
  appendFileSync(join(root, 'requests.txt'), `${request.method} ${url.pathname}\n`);
  const { user, installations, setupUrl } = config();
  const path = url.pathname;
  // Web: OAuth (approve at once) and installing the App (installed at once, on the first installation).
  if (path === '/login/oauth/authorize') {
    const back = new URL(url.searchParams.get('redirect_uri'));
    back.searchParams.set('code', 'fake-code'); back.searchParams.set('state', url.searchParams.get('state'));
    return redirect(response, back.toString());
  }
  if (path === '/login/oauth/access_token' && request.method === 'POST') { await body(request); return send(response, 200, { access_token: 'user-token', token_type: 'bearer' }); }
  const install = /^\/apps\/[^/]+\/installations\/new$/.exec(path);
  if (install) { const back = new URL(setupUrl); back.searchParams.set('installation_id', String(installations[0]?.id || 1)); back.searchParams.set('state', url.searchParams.get('state') || ''); back.searchParams.set('setup_action', 'install'); return redirect(response, back.toString()); }
  // API.
  if (path === '/api/user') return send(response, 200, user);
  if (path === '/api/user/installations') return send(response, 200, { total_count: installations.length, installations });
  const token = /^\/api\/app\/installations\/(\d+)\/access_tokens$/.exec(path);
  if (token && request.method === 'POST') {
    await body(request);
    if (!installations.some(item => String(item.id) === token[1])) return send(response, 404, { message: 'Not Found' });
    const value = `ghs_installation-${token[1]}-${minted.size + 1}`; minted.add(value);
    return send(response, 201, { token: value, expires_at: new Date(Date.now() + 3600_000).toISOString() });
  }
  if (path === '/api/installation/repositories') {
    const bearer = String(request.headers.authorization || '').replace(/^Bearer /, '');
    const id = bearer.split('-')[1];
    const account = installations.find(item => String(item.id) === id)?.account.login;
    const names = account && existsSync(join(root, account)) ? readdirSync(join(root, account)).filter(name => name.endsWith('.git')).map(name => name.slice(0, -4)) : [];
    return send(response, 200, { total_count: names.length, repositories: names.map(name => repoView(account, name)) });
  }
  const repo = /^\/api\/repos\/([^/]+)\/([^/]+)$/.exec(path);
  if (repo && request.method === 'GET') return existsSync(repoDir(repo[1], repo[2])) ? send(response, 200, repoView(repo[1], repo[2])) : send(response, 404, { message: 'Not Found' });
  if (/\.git\//.test(path)) return git(request, response, url);
  return send(response, 404, { message: 'Not Found' });
}).listen(0, '127.0.0.1', function () { origin = `http://127.0.0.1:${this.address().port}`; console.log(this.address().port); });
