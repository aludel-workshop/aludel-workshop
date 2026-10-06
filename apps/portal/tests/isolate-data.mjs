// Loaded with --import by the test scripts. Each test file gets its own MACHINE_DATA_DIR unless it sets one,
// so nothing a test does lands in the real apps/portal/.data. Only the per-file child acts; the runner itself is left alone.
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (process.env.NODE_TEST_CONTEXT && !process.env.MACHINE_DATA_DIR) {
  // A killed run can't clean up after itself; clear any left over from one more than an hour ago.
  for (const name of readdirSync(tmpdir()).filter(name => name.startsWith('aludel-test-data-')))
    try { if (Date.now() - statSync(join(tmpdir(), name)).mtimeMs > 60 * 60 * 1000) rmSync(join(tmpdir(), name), { recursive: true, force: true }); } catch { /* another run's, or already gone */ }
  const dir = mkdtempSync(join(tmpdir(), 'aludel-test-data-'));
  process.env.MACHINE_DATA_DIR = dir;
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
}
