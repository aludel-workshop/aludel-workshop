// W-27 (A7) #2: the preview tunnel. An item's agent runs its preview in its own container, which the portal can't reach
// into. So the container dials out: it opens a few HTTP upgrades to the portal with the item's editor token, each one a
// raw byte pipe the portal can hand one browser connection to. The portal serves the preview at review-<id>.<base>, adds
// the J6 walk script to its pages and lets the portal frame it; the agent's code runs only in the container, and the
// portal relays bytes.
// Members only: the portal mints a one-time ticket for a signed-in member, and the preview host swaps it for its own
// host-only cookie (CHIPS-partitioned, so it works in the portal's frame). That cookie is stripped before anything is
// relayed, and portal cookies never exist on app hosts.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { injectWalk, walkPath, walkScript } from './review-walk.mjs';

export const tunnelProtocol = 'aludel-tunnel';
const accessCookie = 'aludel_review';
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const hostLabel = id => `review-${id}`;

export function previewTunnels({ portalOrigins, appOrigin, now = () => Date.now(), waitMs = 5000, ticketMs = 60000 }) {
  const tunnels = new Map();   // id -> { id, projectId, workId, action, idle: Set<socket>, waiters: [], sessions: Set<string>, opened, seen }
  const tickets = new Map();   // ticket -> { id, path, expires }
  const byLabel = label => { const match = /^review-([a-f0-9]{12})$/.exec(label); return match ? tunnels.get(match[1]) || null : null; };

  function open({ projectId, workId, action }) {
    // One tunnel per action: a fresh handover replaces it (its old sockets close with it).
    for (const tunnel of tunnels.values()) if (tunnel.projectId === projectId && tunnel.workId === workId && tunnel.action === action) close(tunnel.id);
    const id = randomBytes(6).toString('hex');
    tunnels.set(id, { id, projectId, workId, action, idle: new Set(), waiters: [], sessions: new Set(), opened: now(), seen: null });
    return describe(id);
  }
  function describe(id) {
    const tunnel = tunnels.get(id); if (!tunnel) return null;
    return { id, host: hostLabel(id), url: appOrigin(hostLabel(id)), action: tunnel.action, connected: tunnel.idle.size > 0, seen: tunnel.seen ? new Date(tunnel.seen).toISOString() : null };
  }
  function find({ projectId, workId, action = null }) {
    return [...tunnels.values()].filter(tunnel => tunnel.projectId === projectId && tunnel.workId === workId && (action === null || tunnel.action === action)).map(tunnel => describe(tunnel.id));
  }
  function close(id) {
    const tunnel = tunnels.get(id); if (!tunnel) return;
    tunnels.delete(id);
    for (const socket of tunnel.idle) socket.destroy();
    for (const waiter of tunnel.waiters) waiter.reject(Object.assign(new Error('This preview closed.'), { status: 410 }));
  }
  // The item closed: its previews close with it.
  function closeItem(projectId, workId) { for (const tunnel of [...tunnels.values()]) if (tunnel.projectId === projectId && tunnel.workId === workId) close(tunnel.id); }

  // The container's side: an upgraded socket joins the tunnel's idle pool until a browser connection takes it.
  function dial(id, { projectId, workId }, socket) {
    const tunnel = tunnels.get(id);
    if (!tunnel || tunnel.projectId !== projectId || tunnel.workId !== workId) {
      socket.end('HTTP/1.1 404 Not Found\r\nconnection: close\r\ncontent-length: 0\r\n\r\n'); return false;
    }
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nupgrade: ${tunnelProtocol}\r\nconnection: Upgrade\r\n\r\n`);
    socket.setKeepAlive(true, 15000); socket.setNoDelay(true);
    tunnel.seen = now();
    const waiter = tunnel.waiters.shift();
    if (waiter) { waiter.resolve(socket); return true; }
    tunnel.idle.add(socket);
    const drop = () => tunnel.idle.delete(socket);
    socket.once('close', drop); socket.once('error', drop);
    return true;
  }
  function take(tunnel) {
    for (const socket of tunnel.idle) {
      tunnel.idle.delete(socket); socket.removeAllListeners('close'); socket.removeAllListeners('error');
      if (!socket.destroyed) return Promise.resolve(socket);
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve: socket => { clearTimeout(timer); resolve(socket); }, reject: error => { clearTimeout(timer); reject(error); } };
      const timer = setTimeout(() => { tunnel.waiters.splice(tunnel.waiters.indexOf(waiter), 1); reject(Object.assign(new Error('The agent\'s preview isn\'t connected. Ask the agent to run it again.'), { status: 503 })); }, waitMs);
      tunnel.waiters.push(waiter);
    });
  }

  // A signed-in member opens a preview: a one-time link that sets the preview host's own access cookie.
  function ticket(id, path = '/') {
    if (!tunnels.has(id)) fail('This preview closed. Ask the agent to run it again.', 410);
    const value = randomBytes(24).toString('base64url');
    tickets.set(value, { id, path: /^\/(?!\/)/.test(path) ? path : '/', expires: now() + ticketMs });
    return `${appOrigin(hostLabel(id))}/__aludel/enter/${value}`;
  }
  function sweep() { for (const [value, grant] of tickets) if (grant.expires < now()) tickets.delete(value); }

  const cookieOf = request => { for (const part of String(request.headers.cookie || '').split(';')) { const [name, ...rest] = part.trim().split('='); if (name === accessCookie) return rest.join('='); } return null; };
  const allowed = (tunnel, request) => { const value = cookieOf(request); if (!value) return false;
    for (const session of tunnel.sessions) if (session.length === value.length && timingSafeEqual(Buffer.from(session), Buffer.from(value))) return true; return false; };
  // Everything but the access cookie goes on to the app; Host becomes the container's own, so the app answers as itself.
  function forwardHeaders(request) {
    const headers = { ...request.headers, 'x-forwarded-host': request.headers.host, 'x-forwarded-proto': 'http' };
    const cookies = String(request.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part && !part.startsWith(accessCookie + '='));
    if (cookies.length) headers.cookie = cookies.join('; '); else delete headers.cookie;
    headers.host = 'localhost';
    return headers;
  }
  // The portal frames the preview: its frame-ancestors become the portal's, and cookies the app sets stay usable inside
  // that (cross-site) frame.
  function framedHeaders(headers) {
    const out = { ...headers }; delete out['x-frame-options'];
    const ancestors = `frame-ancestors 'self' ${portalOrigins.join(' ')}`;
    const policy = out['content-security-policy'];
    if (policy) out['content-security-policy'] = /frame-ancestors[^;]*/i.test(policy) ? String(policy).replace(/frame-ancestors[^;]*/i, ancestors) : `${policy}; ${ancestors}`;
    if (out['set-cookie']) out['set-cookie'] = [].concat(out['set-cookie']).map(cookie => /;\s*domain\s*=/i.test(cookie) ? null : cookie.replace(/;\s*samesite\s*=\s*\w+/i, '').replace(/;\s*secure\b/i, '') + '; SameSite=None; Secure; Partitioned').filter(Boolean);
    return out;
  }

  async function serve(label, request, response) {
    const tunnel = byLabel(label); if (!tunnel) fail('Open this preview from its review.', 404);
    const path = new URL(request.url, 'http://preview.local').pathname;
    const enter = /^\/__aludel\/enter\/([A-Za-z0-9_-]+)$/.exec(path);
    if (enter) {
      const grant = tickets.get(enter[1]); tickets.delete(enter[1]);
      if (!grant || grant.id !== tunnel.id || grant.expires < now()) fail('This preview link expired. Open the preview again from its review.', 410);
      const session = randomBytes(24).toString('base64url'); tunnel.sessions.add(session);
      response.writeHead(303, { location: grant.path, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
        'set-cookie': `${accessCookie}=${session}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned` });
      return response.end();
    }
    if (!allowed(tunnel, request)) fail('Open this preview from its review in Aludel.', 403);
    if (path === walkPath) {
      const body = walkScript(portalOrigins);
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      return response.end(body);
    }
    const socket = await take(tunnel);
    const page = request.method === 'GET' && /text\/html/i.test(String(request.headers.accept || ''));
    const headers = forwardHeaders(request); if (page) headers['accept-encoding'] = 'identity';
    await new Promise(resolve => {
      const upstream = httpRequest({ createConnection: () => socket, method: request.method, path: request.url, headers }, reply => {
        const type = String(reply.headers['content-type'] || ''), replyHeaders = framedHeaders(reply.headers);
        if (page && /^text\/html/i.test(type) && !reply.headers['content-encoding']) {
          const chunks = []; reply.on('data', chunk => chunks.push(chunk));
          reply.on('end', () => { const body = Buffer.from(injectWalk(Buffer.concat(chunks).toString('utf8')), 'utf8');
            const { 'content-length': _length, etag: _etag, ...rest } = replyHeaders;
            response.writeHead(reply.statusCode || 502, { ...rest, 'content-length': body.length, 'cache-control': 'no-store' }); response.end(body); resolve(); });
          return;
        }
        response.writeHead(reply.statusCode || 502, replyHeaders); reply.pipe(response); reply.on('end', resolve); reply.on('error', resolve);
      });
      upstream.on('error', () => { if (!response.headersSent) { response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }); response.end('The agent\'s preview is not responding.'); } else response.end(); resolve(); });
      request.pipe(upstream);
    });
  }
  // A WebSocket (or any upgrade) from the browser: the request head goes down a tunnel socket as it came, then bytes flow
  // both ways untouched.
  async function upgrade(label, request, socket, head) {
    const tunnel = byLabel(label);
    if (!tunnel || !allowed(tunnel, request)) { socket.end('HTTP/1.1 403 Forbidden\r\nconnection: close\r\ncontent-length: 0\r\n\r\n'); return; }
    let pipe;
    try { pipe = await take(tunnel); } catch { socket.end('HTTP/1.1 503 Service Unavailable\r\nconnection: close\r\ncontent-length: 0\r\n\r\n'); return; }
    const headers = forwardHeaders(request);
    const lines = [`${request.method} ${request.url} HTTP/1.1`];
    for (const [name, value] of Object.entries(headers)) for (const entry of [].concat(value)) lines.push(`${name}: ${entry}`);
    pipe.write(lines.join('\r\n') + '\r\n\r\n'); if (head?.length) pipe.write(head);
    socket.pipe(pipe).pipe(socket);
    const end = () => { socket.destroy(); pipe.destroy(); };
    socket.on('error', end); pipe.on('error', end); socket.on('close', end); pipe.on('close', end);
  }

  const timer = setInterval(sweep, 30000); timer.unref();
  return { open, describe, find, close, closeItem, dial, ticket, serve, upgrade, owns: label => Boolean(byLabel(label)), stopAll() { clearInterval(timer); for (const id of [...tunnels.keys()]) close(id); } };
}
