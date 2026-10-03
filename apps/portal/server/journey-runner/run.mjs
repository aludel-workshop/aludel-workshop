// JOURNEYS-01 J3: walks a candidate's journeys inside the journey runner container and reports a result and screenshot per
// step. Mounted read-only at /runner/run.mjs; the candidate's step tests are at /specs. The host writes the plan to stdin:
//   { target: { host, port }, journeys: [{ id, entry: { location, cookies: [Set-Cookie…] }, steps: [{ id, route, test, status?, detail? }] }] }
// and reads one JSON line from stdout. The container's only network is the candidate's preview.
//
// A step test is black box: `export default { '<test id>': async ({ page, assert, step, baseURL }) => { … } }` in
// `<file>.spec.mjs`. It drives the running app through `page` and imports nothing from the app.
import assert from 'node:assert/strict';
import { connect, createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const results = [];
const write = value => process.stdout.write(`${JSON.stringify(value)}\n`);
const message = error => String(error?.message || error).replace(/\u001b\[[0-9;]*m/g, '').slice(0, 600);
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { target, journeys, stepTimeoutMs = 30000 } = JSON.parse(input);
// The app is reached as http://localhost:<port>, a secure context, so its preview cookies (Secure; Partitioned) behave as
// they do for a reviewer. A local forwarder carries that origin to the candidate on the runner's network.
const forward = createServer(socket => {
  const upstream = connect(target.port, target.host);
  const end = () => { socket.destroy(); upstream.destroy(); };
  socket.pipe(upstream).pipe(socket); socket.on('error', end); upstream.on('error', end);
});
await new Promise((resolve, reject) => forward.once('error', reject).listen(target.port, '127.0.0.1', resolve));
const baseURL = `http://localhost:${target.port}`;
const modules = new Map();
async function testFor(reference) {
  const [file, name] = reference.split('#');
  if (!modules.has(file)) modules.set(file, import(pathToFileURL(`/specs/${file}`).href).catch(error => ({ loadError: error })));
  const loaded = await modules.get(file);
  if (loaded.loadError) throw new Error(`${file} did not load: ${message(loaded.loadError)}`);
  const run = loaded.default?.[name];
  if (typeof run !== 'function') throw new Error(`${file} has no test "${name}". Export default { '${name}': async ({ page }) => { … } }.`);
  return run;
}
// The persona's session, as the setup call's Set-Cookie headers. A cookie the call clears (Max-Age=0) isn't set.
function cookie(header) {
  const [pair, ...attributes] = header.split(';').map(part => part.trim()), at = pair.indexOf('=');
  const value = { name: pair.slice(0, at), value: pair.slice(at + 1), domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' };
  for (const attribute of attributes) {
    const [key, ...rest] = attribute.split('='), setting = rest.join('='), name = key.toLowerCase();
    if (name === 'path') value.path = setting || '/';
    else if (name === 'httponly') value.httpOnly = true;
    else if (name === 'secure') value.secure = true;
    else if (name === 'samesite') value.sameSite = { strict: 'Strict', lax: 'Lax', none: 'None' }[setting.toLowerCase()] || 'Lax';
    else if (name === 'max-age') { if (Number(setting) <= 0) return null; value.expires = Math.floor(Date.now() / 1000) + Number(setting); }
  }
  return at > 0 ? value : null;
}
const shot = page => page.screenshot({ type: 'jpeg', quality: 70, timeout: 5000 }).then(buffer => buffer.toString('base64'), () => null);
const browser = await chromium.launch();
try {
  for (const journey of journeys) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    // Entered as a reviewer is: with the persona's session cookies, at the journey's first route. (A route-fulfilled
    // redirect carrying the cookies, like the reviewer's step link, stalled about half of Chromium's navigations.)
    let blocked = null;
    try {
      const cookies = journey.entry.cookies.map(cookie).filter(Boolean);
      if (cookies.length) await context.addCookies(cookies);
      await page.goto(journey.entry.location);
    } catch (error) { blocked = `The journey could not be entered: ${message(error)}`; }
    for (const step of journey.steps) {
      const id = `${journey.id}.${step.id}`;
      if (step.status) { results.push({ id, status: step.status, detail: step.detail || null }); continue; }
      if (blocked) { results.push({ id, status: 'skipped', detail: blocked }); continue; }
      const started = Date.now();
      let timer;
      try {
        const run = await testFor(step.test);
        await Promise.race([run({ page, context, assert, baseURL, step: { id: step.id, journey: journey.id, route: step.route } }),
          new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(`The step took longer than ${stepTimeoutMs / 1000} seconds.`)), stepTimeoutMs); })]);
        results.push({ id, status: 'passed', detail: null, ms: Date.now() - started, screenshot: await shot(page) });
      } catch (error) {
        results.push({ id, status: 'failed', detail: message(error), ms: Date.now() - started, screenshot: await shot(page) });
        blocked = `Not run: step ${step.id} failed first.`;
      } finally { clearTimeout(timer); }
    }
    await context.close();
  }
} finally { await browser.close(); forward.close(); }
write({ results });
process.exit(0);
