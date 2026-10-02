// LAT-T02 local proof: only the reviewed Pages flow rule can run. This is not a
// general package server SDK; network isolation and host acceptance are separate gates.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { layerInstanceId } from './layer-contract.mjs';
import { pagesPackageForProject } from './layer-package.mjs';
import { sourceReviewed } from './layer-api.mjs';

// A source may run only once its exact bytes were reviewed (host list or an owner-accepted layer commit).
const entry = 'server/flow-change.mjs';
const child = `
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  raw += chunk;
  if (raw.length > 262144) process.exit(3);
});
process.stdin.on('end', async () => {
  try {
    const { source, operation, input } = JSON.parse(raw);
    const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const value = operation === 'propose' ? module.proposeFlowRevision(input)
      : module.reviewFlowRevision(input.change, input);
    process.stdout.write(JSON.stringify({ ok: true, value }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, message: String(error.message || error).slice(0, 240) }));
  }
});`;

export function runPagesFlowCandidate(db, projectId, operation, input) {
  if (!['propose', 'review'].includes(operation) || !input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid Pages flow operation.');
  const pkg = pagesPackageForProject(db, projectId);
  const declaration = pkg?.manifest.server?.semanticChanges?.flowRevision;
  if (declaration?.entry !== entry || declaration.schemaVersion !== 1 || declaration.mode !== 'pure-candidate')
    throw new Error('The installed Pages flow rule is unavailable.');
  const instanceId = layerInstanceId(db, projectId, 'pages');
  for (const [key, expected] of Object.entries({ projectId, layerInstanceId: instanceId, sourceCommit: pkg.commit }))
    if (input[key] != null && input[key] !== expected) throw new Error(`Pages flow ${key} does not match the installed package.`);
  const source = execFileSync('git', ['-C', pkg.repo, 'show', `${pkg.commit}:${entry}`],
    { encoding: 'utf8', maxBuffer: 65536 });
  if (!sourceReviewed(db, projectId, 'pages', entry, createHash('sha256').update(source).digest('hex')))
    throw new Error('Pages flow source has not passed host review.');
  const payload = JSON.stringify({ source, operation, input: { ...input, projectId, layerInstanceId: instanceId, sourceCommit: pkg.commit } });
  if (payload.length > 262144) throw new Error('Pages flow input is too large.');
  const result = spawnSync(process.execPath, ['--permission', '--max-old-space-size=64', '-e', child],
    { input: payload, encoding: 'utf8', timeout: 2000, maxBuffer: 262144, env: { PATH: process.env.PATH || '' } });
  if (result.error || result.status !== 0 || !result.stdout) throw new Error('Pages flow rule did not finish within its limits.');
  let response;
  try { response = JSON.parse(result.stdout); } catch { throw new Error('Pages flow rule returned an invalid result.'); }
  if (!response.ok) throw Object.assign(new Error(response.message || 'Pages flow rule rejected the change.'), { status: 409 });
  return response.value;
}
