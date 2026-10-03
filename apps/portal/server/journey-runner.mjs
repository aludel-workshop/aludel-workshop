// JOURNEYS-01 J3: runs a candidate's journey step tests black-box against its running review preview, in a container
// whose only network is that preview. Step tests are agent- or person-written code, so they never run on the host: the
// runner image holds a browser and Playwright, and the host mounts its runner script and the candidate's
// `.aludel/journeys/` read-only. The preview's setup token never enters the container; the host prepares each journey's
// persona through the setup call itself and hands the runner only the session cookies, as a reviewer's step link does.
import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = new URL('./journey-runner/', import.meta.url).pathname;
const exec = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = execFile(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options }, (error, stdout, stderr) => error ? reject(Object.assign(error, { stdout, stderr })) : resolve(stdout));
  if (options.input !== undefined) child.stdin.end(options.input);
});

// The image is named by its Dockerfile's digest and built once per machine. MACHINE_JOURNEY_RUNNER_IMAGE names a prebuilt
// image instead (an environment whose Docker builds can't reach the npm registry builds it out of band).
export async function journeyRunnerImage({ docker = 'docker', environment = process.env } = {}) {
  if (environment.MACHINE_JOURNEY_RUNNER_IMAGE) return environment.MACHINE_JOURNEY_RUNNER_IMAGE;
  const tag = `aludel-journey-runner:${createHash('sha256').update(readFileSync(join(here, 'Dockerfile'))).digest('hex').slice(0, 12)}`;
  try { await exec(docker, ['image', 'inspect', '--format', '{{.Id}}', tag], { timeout: 30000 }); return tag; } catch { /* not built yet */ }
  try { await exec(docker, ['build', '--tag', tag, here], { timeout: 15 * 60 * 1000 }); }
  catch { throw new Error('The journey runner image did not build. It needs Docker to pull mcr.microsoft.com/playwright and npm install playwright-core.'); }
  return tag;
}

// What the host decides before anything runs: which journeys can be entered, and which steps have no test or no fixture.
// `steps` are reviewSteps(recipe, journeys); a journey is entered as its first step's persona.
export function stepPlan(journeys, steps) {
  const plan = [], settled = [];
  for (const journey of journeys) {
    const own = steps.filter(step => step.journey === journey.id), first = own[0];
    const byId = new Map(journey.steps.map(step => [step.id, step]));
    const start = !first.persona ? 'The journey can\'t be entered: its first step names no persona.'
      : !first.fixture ? `The journey can't be entered: no fixture is declared for persona ${first.persona}.` : null;
    if (start) { for (const step of own) settled.push({ id: step.id, status: byId.get(step.step).test ? 'no-fixture' : 'uncovered', detail: start }); continue; }
    const planned = own.map(step => {
      const test = byId.get(step.step).test ?? null;
      const status = !test ? 'uncovered' : step.persona && !step.fixture ? 'no-fixture' : null;
      return { id: step.step, route: step.path, test, ...(status ? { status, detail: status === 'no-fixture' ? `No fixture is declared for persona ${step.persona}.` : null } : {}) };
    });
    // A journey with nothing to run is settled here, without entering it or starting the runner.
    if (planned.every(step => step.status)) settled.push(...planned.map(step => ({ id: `${journey.id}.${step.id}`, status: step.status, detail: step.detail })));
    else plan.push({ id: journey.id, first, steps: planned });
  }
  return { plan, settled };
}

// Runs the plan. `enter(first)` performs the setup call for a journey's first step and returns { location, cookies }.
export async function runJourneySteps({ docker = 'docker', image, container, containerPort, specs, journeys, enter, timeoutMs = 5 * 60 * 1000 }) {
  const input = [];
  for (const journey of journeys) {
    let entry;
    try { entry = await enter(journey.first); } catch (error) {
      for (const step of journey.steps) input.push({ standalone: true, id: `${journey.id}.${step.id}`, status: step.status || 'skipped', detail: step.status ? step.detail : `The journey could not be prepared: ${error.message}` });
      continue;
    }
    input.push({ id: journey.id, entry, steps: journey.steps });
  }
  const runnable = input.filter(entry => !entry.standalone), early = input.filter(entry => entry.standalone).map(({ standalone, ...result }) => result);
  if (!runnable.length) return early;
  const network = `aludel-steps-${randomBytes(8).toString('hex')}`, name = `aludel-step-runner-${randomBytes(8).toString('hex')}`;
  try {
    // An internal network: the runner reaches the preview as `candidate` and nothing else, not even the internet.
    await exec(docker, ['network', 'create', '--internal', '--label', 'aludel.steps=1', network], { timeout: 30000 });
    await exec(docker, ['network', 'connect', '--alias', 'candidate', network, container], { timeout: 30000 });
    const stdout = await exec(docker, ['run', '--rm', '-i', '--name', name, '--network', network, '--memory', '1g', '--memory-swap', '1g', '--cpus', '1', '--pids-limit', '512',
      '--read-only', '--tmpfs', '/tmp:size=256m', '--shm-size', '256m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--env', 'HOME=/tmp',
      '--volume', `${join(here, 'run.mjs')}:/runner/run.mjs:ro`, ...(existsSync(specs) ? ['--volume', `${specs}:/specs:ro`] : []),
      '--entrypoint', 'node', image, '/runner/run.mjs'], { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, input: JSON.stringify({ target: { host: 'candidate', port: containerPort }, journeys: runnable }) });
    // The report comes from the process that ran the candidate's own tests, so only planned steps and bounded fields count.
    const reported = new Map((JSON.parse(stdout.trim().split('\n').at(-1)).results || []).map(result => [result?.id, result]));
    return [...early, ...runnable.flatMap(journey => journey.steps.map(step => {
      const id = `${journey.id}.${step.id}`, result = reported.get(id);
      if (step.status) return { id, status: step.status, detail: step.detail };
      if (!result || !['passed', 'failed', 'skipped'].includes(result.status)) return { id, status: 'failed', detail: 'The runner reported no result for this step.' };
      return { id, status: result.status, detail: typeof result.detail === 'string' ? result.detail.slice(0, 600) : null, ...(Number.isFinite(result.ms) ? { ms: result.ms } : {}),
        ...(typeof result.screenshot === 'string' && result.screenshot.length <= 4 * 1024 * 1024 && /^[A-Za-z0-9+/=]+$/.test(result.screenshot) ? { screenshot: result.screenshot } : {}) };
    }))];
  } catch (error) {
    const detail = error.killed ? 'The journey tests exceeded their time limit.' : 'The journey runner failed before reporting results.';
    return [...early, ...runnable.flatMap(journey => journey.steps.map(step => ({ id: `${journey.id}.${step.id}`, status: step.status || 'failed', detail: step.status ? step.detail : detail })))];
  } finally {
    await exec(docker, ['rm', '-f', name], { timeout: 30000 }).catch(() => {});
    await exec(docker, ['network', 'disconnect', '--force', network, container], { timeout: 30000 }).catch(() => {});
    await exec(docker, ['network', 'rm', network], { timeout: 30000 }).catch(() => {});
  }
}
