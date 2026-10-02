// A stand-in for GitHub's Git smart-HTTP endpoint (T03-CODE, the PP-01B fake-endpoint pattern): bare repositories under
// <root>/<owner>/<name>.git served by `git http-backend`. It answers only Basic credentials of `x-access-token:<token>` for a
// token listed in <root>/tokens.json, and appends every credential it receives to <root>/seen.txt, so a test can check that
// only installation tokens were sent. A missing repository is a 404, as GitHub's is. Run as its own process:
//   node tests/fake-github-git.mjs <root>   → prints the port.
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const root = process.argv[2];
const backend = join(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), 'git-http-backend');
const tokens = () => { try { return JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8')); } catch { return []; } };

createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const auth = request.headers.authorization;
  const credential = auth ? Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString() : null;
  if (credential) appendFileSync(join(root, 'seen.txt'), credential + '\n');
  const [user, token] = (credential || '').split(':');
  if (user !== 'x-access-token' || !tokens().includes(token)) { response.writeHead(401, { 'www-authenticate': 'Basic realm="GitHub"' }); return response.end(); }
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
}).listen(0, '127.0.0.1', function () { console.log(this.address().port); });
