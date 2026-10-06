#!/usr/bin/env node
// W-27 (A7) #2: the container's side of the preview tunnel. Opens a tunnel for one action of this checkout's item, then
// keeps a few connections dialled out to the portal (HTTP upgrades with the item's editor token). Each carries one browser
// connection to the preview running here, byte for byte. Nothing listens in the container for the outside; the portal
// can't reach in. Prints `Tunnel: <url>` once the first connection is up.
// Usage (in apps/portal): node tools/preview-tunnel.mjs --action 4 --port 4390 [--item W-27]
//   The item defaults to this checkout's branch (aludel/w-27). `npm run preview -- <journey> --tunnel <action>` runs it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect } from 'node:net';
import { configPath, request } from './aludel-client.mjs';

export const tunnelProtocol = 'aludel-tunnel';

export async function runTunnel({ config, item, action, port, pool = 6, log = console.log, signal = null }) {
  const opened = await request(config, `/goals/${encodeURIComponent(item)}/tunnels`, { action }).catch(error => {
    // An Aludel from before W-27 has no tunnels: say so, rather than a bare "Not found".
    throw error.message === 'Not found.' ? new Error(`The portal at ${config.url} has no preview tunnels yet (they came with W-27). Hand over the preview link instead.`) : error;
  });
  const base = new URL(config.url), send = base.protocol === 'https:' ? httpsRequest : httpRequest;
  let live = 0, announced = false, stopped = false, failures = 0;
  const sockets = new Set();
  const dial = () => {
    if (stopped) return;
    live++;
    const call = send({ host: base.hostname, port: base.port || (base.protocol === 'https:' ? 443 : 80), method: 'GET',
      path: `/api/editor/goals/${encodeURIComponent(item)}/tunnels/${opened.id}/dial`,
      headers: { authorization: `Bearer ${config.token}`, connection: 'Upgrade', upgrade: tunnelProtocol } });
    const again = delay => { live--; if (!stopped) setTimeout(dial, delay); };
    call.on('upgrade', (_response, socket, head) => {
      failures = 0; sockets.add(socket);
      if (!announced) { announced = true; log(`Tunnel: ${opened.url} (#${action}, to localhost:${port})`); }
      // Idle until the portal hands it a browser connection; then it's that connection's, and a fresh one replaces it.
      let taken = false;
      socket.once('data', first => {
        taken = true; live--; dial();
        socket.pause();
        const local = connect(port, '127.0.0.1', () => { local.write(head?.length ? Buffer.concat([head, first]) : first); socket.pipe(local).pipe(socket); socket.resume(); });
        const end = () => { socket.destroy(); local.destroy(); };
        local.on('error', end); local.on('close', end); socket.on('close', end);
      });
      socket.on('error', () => socket.destroy());
      // An idle socket the portal dropped (it restarted, or closed the tunnel): dial again after a moment.
      socket.once('close', () => { sockets.delete(socket); if (!taken) again(1000); });
    });
    call.on('response', response => { response.resume(); failures++;
      if ([401, 404, 410].includes(response.statusCode)) { stopped = true; log(`The portal closed this tunnel (${response.statusCode}).`); return; }
      again(Math.min(30000, 500 * 2 ** failures)); });
    call.on('error', () => { failures++; again(Math.min(30000, 500 * 2 ** failures)); });
    call.end();
  };
  for (let n = 0; n < pool; n++) dial();
  signal?.addEventListener('abort', () => { stopped = true; for (const socket of sockets) socket.destroy(); });
  return opened;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), arg = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : null; };
  const action = Number(arg('action')), port = Number(arg('port') || 4390);
  let item = arg('item');
  if (!item) { const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim(); item = /^aludel\/(w-\d+)$/i.exec(branch)?.[1]?.toUpperCase() || null; }
  if (!item || !Number.isInteger(action) || action < 1 || !Number.isInteger(port)) { console.error('Usage: node tools/preview-tunnel.mjs --action <n> [--port 4390] [--item W-n]'); process.exit(2); }
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  try { await runTunnel({ config, item, action, port }); }
  catch (error) { console.error(error.message); process.exit(1); }
}
