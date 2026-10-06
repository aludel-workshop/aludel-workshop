// Disposable portal tests wait for health with bounded startup evidence and stop only their own child process.
export async function waitForPortal(child, origin, description = 'portal started on disposable data', timeoutMs = 60000) {
  let log = '', startError = null;
  const capture = chunk => { log = (log + chunk).slice(-3000); };
  child.stdout?.on('data', capture); child.stderr?.on('data', capture);
  child.on('error', error => { startError = error; });
  for (const deadline = Date.now() + timeoutMs; Date.now() < deadline;) {
    if (startError || child.exitCode !== null || child.signalCode !== null) throw new Error(`${description}: server exited during startup. ${startError?.message || log}`);
    try { if ((await fetch(`${origin}/api/session`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`${description}: startup exceeded ${timeoutMs / 1000}s. ${log}`);
}

export async function stopPortal(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  try { await exited; } finally { clearTimeout(timer); }
}

// W-25: a journey run for a person to look at (`npm run preview -- <journey>`) keeps its portal up in the state the walk
// left it. It prints one `Preview: <link>` line, which tools/journey-preview.mjs reads, and waits until it is stopped.
export async function holdForPreview({ port, path = '/', account = null }) {
  if (!process.env.JOURNEY_KEEP) return;
  const sign = account ? ` (sign in as ${account.email}, ${account.password})` : '';
  console.log(`Preview: http://localhost:${port}${path}${sign}. Stop it with npm run preview -- stop.`);
  await new Promise(resolve => process.once('SIGINT', resolve).once('SIGTERM', resolve));
}
