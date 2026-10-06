#!/usr/bin/env node
// W-25: a preview a person can open, from an item container. Runs a browser journey with its portal kept up afterwards
// (tests/portal-support.mjs holdForPreview), in the background, and prints the link once the walk has passed. The link is
// a localhost port VS Code forwards to the person's machine; hand it over with update_action's preview.
// W-27 #2: with --tunnel <action>, the preview also goes through a tunnel to the portal (tools/preview-tunnel.mjs), so the
// person opens it from the action's review, whatever VS Code forwards (W27-F1). Hand over the tunnel link it prints.
// Usage (in apps/portal, after npm run build):
//   npm run preview -- <journey> [--port 4390] [--tunnel <action>]   e.g. work-board runs tests/work-board-browser.mjs
//   npm run preview -- stop                      stops every kept preview
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const portal = new URL('..', import.meta.url).pathname;
const dir = join(portal, 'test-results', 'previews');
const [name, ...rest] = process.argv.slice(2);
const usage = 'Usage: npm run preview -- <journey> [--port 4390] [--tunnel <action>] | stop';

function stop() {
  if (!existsSync(dir)) return 0;
  let stopped = 0;
  for (const file of readdirSync(dir).filter(entry => entry.endsWith('.pid'))) {
    const pid = Number(readFileSync(join(dir, file), 'utf8'));
    // The journey runs in its own process group, so its portal and browser stop with it.
    try { process.kill(-pid, 'SIGTERM'); stopped++; } catch { /* already gone */ }
    rmSync(join(dir, file), { force: true });
  }
  console.log(stopped ? `Stopped ${stopped} preview${stopped === 1 ? '' : 's'}.` : 'No preview was running.');
  return 0;
}

async function start() {
  if (!name || !/^[a-z0-9-]+$/.test(name)) { console.error(usage); return 2; }
  const journey = join(portal, 'tests', `${name}-browser.mjs`);
  if (!existsSync(journey)) { console.error(`No journey tests/${name}-browser.mjs.`); return 2; }
  if (!readFileSync(journey, 'utf8').includes('holdForPreview')) { console.error(`tests/${name}-browser.mjs doesn't keep its portal up yet: call holdForPreview (tests/portal-support.mjs) after its PASS line.`); return 2; }
  const at = rest.indexOf('--port'), port = at >= 0 ? Number(rest[at + 1]) : 4390;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) { console.error('Give --port as a number from 1024 to 65535.'); return 2; }
  mkdirSync(dir, { recursive: true });
  const log = join(dir, `${name}.log`), out = openSync(log, 'w');
  const child = spawn(process.execPath, [journey], { cwd: portal, detached: true, stdio: ['ignore', out, out],
    env: { ...process.env, JOURNEY_KEEP: '1', JOURNEY_PORT: String(port), MACHINE_LAYER_TEMPLATES_ENABLED: process.env.MACHINE_LAYER_TEMPLATES_ENABLED || '1' } });
  closeSync(out);
  writeFileSync(join(dir, `${name}.pid`), String(child.pid));
  let exited = null;
  child.once('exit', code => { exited = code ?? 1; });
  for (const deadline = Date.now() + 10 * 60 * 1000; Date.now() < deadline; await new Promise(resolve => setTimeout(resolve, 250))) {
    const text = readFileSync(log, 'utf8');
    const link = text.match(/^Preview: (\S+?)(?:\s|\.?$)(.*)$/m);
    if (link) {
      child.unref();
      console.log(`Preview of ${name}: ${link[1]}`);
      if (link[2].trim()) console.log(link[2].trim());
      const tunnelAt = rest.indexOf('--tunnel');
      if (tunnelAt < 0) { console.log(`Log: ${log}. Hand it over with update_action { preview: { url, try } }.`); return 0; }
      return tunnel(Number(rest[tunnelAt + 1]), port, new URL(link[1]));
    }
    if (exited !== null) {
      rmSync(join(dir, `${name}.pid`), { force: true });
      console.error(`The ${name} journey stopped before its preview was up (exit ${exited}); nothing to hand over. Last lines:\n${text.trim().split('\n').slice(-15).join('\n')}`);
      return 1;
    }
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
  console.error(`The ${name} journey took over ten minutes; stopped it. See ${log}.`);
  return 1;
}

// The tunnel runs beside the preview, in its own process group, and stops with it (npm run preview -- stop).
async function tunnel(action, port, local) {
  if (!Number.isInteger(action) || action < 1) { console.error('Give --tunnel the number of the action the preview is for.'); return 2; }
  const log = join(dir, `${name}-tunnel.log`), out = openSync(log, 'w');
  const child = spawn(process.execPath, [join(portal, 'tools', 'preview-tunnel.mjs'), '--action', String(action), '--port', String(port)], { cwd: portal, detached: true, stdio: ['ignore', out, out] });
  closeSync(out); writeFileSync(join(dir, `${name}-tunnel.pid`), String(child.pid));
  let exited = null; child.once('exit', code => { exited = code ?? 1; });
  for (const deadline = Date.now() + 20000; Date.now() < deadline; await new Promise(resolve => setTimeout(resolve, 250))) {
    const text = readFileSync(log, 'utf8'), up = /^Tunnel: (\S+)/m.exec(text);
    if (up) {
      child.unref();
      console.log(`Through the portal (members only): ${up[1]}${local.pathname}${local.search}`);
      console.log(`Hand that link over with update_action { preview: { url, try } } on #${action}; the review opens it for your person. Logs: ${log}.`);
      return 0;
    }
    if (exited !== null) { rmSync(join(dir, `${name}-tunnel.pid`), { force: true }); console.error(`The tunnel didn't start: ${text.trim() || `exit ${exited}`}. The preview itself is still up at ${local.href}.`); return 1; }
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
  console.error(`The tunnel didn't connect within 20 s; see ${log}. The preview itself is still up at ${local.href}.`);
  return 1;
}

process.exitCode = name === 'stop' ? stop() : await start();
