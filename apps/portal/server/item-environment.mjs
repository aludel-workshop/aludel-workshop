// What an item container needs beyond its clone (W-8 attempt 2, E1), served by the portal so the container needs no
// GitHub credentials of its own: a person's container has only what VS Code forwards, and a headless one (A2) has none.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const portal = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 }).trim();

// The layer templates at the commits an item's branch pins (its own config/layer-templates.json, which may differ from the
// portal's), as a Git bundle with one branch per pin. The bundle is made in a scratch repository that borrows the template
// repository's objects, so the person's own checkout never gets temporary refs.
export function templateBundle(pins, source = resolve(portal, '../..', JSON.parse(readFileSync(join(portal, 'config/layer-templates.json'), 'utf8')).repo)) {
  if (!Array.isArray(pins) || !pins.length || pins.length > 20) fail('Ask for 1 to 20 template pins.');
  for (const pin of pins) if (!/^[a-z][a-z0-9-]{0,39}$/.test(pin?.branch || '') || !/^[0-9a-f]{40}$/.test(pin?.commit || '')) fail('A template pin is a branch name and a full commit.');
  let objects;
  try { objects = git(source, ['rev-parse', '--path-format=absolute', '--git-common-dir']) + '/objects'; }
  catch { fail('This portal has no layer template repository to serve.', 404); }
  const scratch = mkdtempSync(join(tmpdir(), 'aludel-templates-'));
  try {
    git(scratch, ['init', '--quiet', '--bare']);
    writeFileSync(join(scratch, 'objects/info/alternates'), objects + '\n');
    const named = new Map();
    for (const { branch, commit } of pins) {
      let type = '';
      try { type = git(scratch, ['cat-file', '-t', commit]); } catch { /* missing */ }
      if (type !== 'commit') fail(`The layer templates have no commit ${commit.slice(0, 12)} (${branch}). Pull layer-base on the portal's machine.`, 404);
      // Two pins on one branch at different commits keep both, the second under its commit.
      const name = !named.has(branch) || named.get(branch) === commit ? branch : `${branch}-${commit.slice(0, 7)}`;
      named.set(name, commit);
      git(scratch, ['update-ref', `refs/heads/${name}`, commit]);
    }
    git(scratch, ['bundle', 'create', '--quiet', join(scratch, 'templates.bundle'), '--branches']);
    return readFileSync(join(scratch, 'templates.bundle'));
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

// The name and email an item container commits as (F11), per person: their GitHub noreply address when they've signed in
// with GitHub, so commits link to their profile without publishing their email; otherwise their portal email.
export function gitIdentity(db, userId) {
  const github = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'github_identities'").get();
  const row = db.prepare(`SELECT u.display_name AS name, u.email, ${github ? 'g.login, g.github_user_id' : 'NULL AS login, NULL AS github_user_id'}
    FROM users u ${github ? 'LEFT JOIN github_identities g ON g.user_id = u.id' : ''} WHERE u.id = ?`).get(userId);
  if (!row) return null;
  const email = row.login && row.github_user_id ? `${row.github_user_id}+${row.login}@users.noreply.github.com` : row.email;
  return email ? { name: row.name, email } : null;
}

// E2: an item's container volumes (Go names them aludel-<project>-<ref>-<base commit>, one per base its branch started
// from) are removed once the item is closed, with their stopped containers. A container still running (its VS Code window
// is open) keeps its volume until a later sweep: closing the window stops it (Dev Containers' default). Volumes of open
// items are never touched, since they may hold work that isn't pushed yet. Without Docker there's nothing to sweep.
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }).trim();
export function sweepItemVolumes(slug, isClosed, run = docker) {
  const pattern = new RegExp(`^aludel-${slug.replace(/[^a-z0-9-]/g, '')}-(w-\\d+)(?:-[0-9a-f]{7})?$`);
  let names;
  try { names = run(['volume', 'ls', '--quiet']).split('\n').filter(Boolean); } catch { return { removed: [], kept: [] }; }
  const removed = [], kept = [];
  for (const volume of names) {
    const ref = pattern.exec(volume)?.[1];
    if (!ref || !isClosed(ref.toUpperCase())) continue;
    try {
      const containers = run(['ps', '--all', '--filter', `volume=${volume}`, '--format', '{{.ID}} {{.State}}']).split('\n').filter(Boolean).map(line => line.split(' '));
      if (containers.some(([, state]) => state === 'running')) { kept.push({ volume, reason: 'its container is still running' }); continue; }
      if (containers.length) run(['rm', ...containers.map(([id]) => id)]);
      run(['volume', 'rm', volume]);
      removed.push(volume);
    } catch (error) { kept.push({ volume, reason: String(error.stderr || error.message).trim().split('\n').pop() }); }
  }
  return { removed, kept };
}
