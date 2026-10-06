// W-33 #5 (MULTI-REPO-ITEMS-01 §6): closing out an item whose code is in several of the project's repositories, together or
// not at all. GitHub has no transaction across repositories, so the order is what makes it hold:
//   fetch every reported branch → plan every merge (no ref moves) → check the planned set → push, referenced repositories
//   first, putting back what was pushed if a later push fails → apply locally.
// These are the steps that don't need the item's records; agent-work.mjs's closeOut drives them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitWithToken } from './git-repository.mjs';

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const said = result => String(result.stderr || result.stdout || '').trim().split('\n').filter(Boolean).pop() || `git exited ${result.status}`;
// Talks to a remote with the token it's given; a local remote (tests, a project without GitHub) needs none.
function remoteGit(handle, remote, args) {
  if (remote?.token) return gitWithToken(handle.workspace, args, remote.token);
  try { return { status: 0, stdout: handle.git(args), stderr: '' }; }
  catch (error) { return { status: error.status || 1, stdout: String(error.stdout || ''), stderr: String(error.stderr || error.message) }; }
}

// The reported branch, fetched from the repository's remote: what merges is exactly the commit that was reviewed.
export function fetchReported(handle, remote, entry, ref) {
  const present = () => handle.has(['cat-file', '-e', `${entry.commit}^{commit}`]);
  if (remote) {
    const fetched = remoteGit(handle, remote, ['fetch', '--no-tags', '--quiet', remote.url, `+refs/heads/${entry.branch}:${ref}`]);
    if (fetched.status !== 0) fail(`Aludel couldn't fetch ${entry.branch} of ${entry.repository}: ${said(fetched)}. Ask the agent to report again.`);
    const tip = handle.git(['rev-parse', ref]);
    if (!tip.startsWith(entry.commit)) fail(`${entry.branch} of ${entry.repository} is at ${tip.slice(0, 7)}, but ${entry.commit.slice(0, 7)} was reported. Report the code again so what merges is what was reviewed.`);
  } else if (!present()) fail(`Aludel doesn't have ${entry.branch} of ${entry.repository} at ${entry.commit.slice(0, 7)}, and has no remote to fetch it from.`);
  return handle.git(['rev-parse', `${entry.commit}^{commit}`]);
}

// A line in the host's copy, brought level with its remote first: missing or behind locally, it takes the remote's tip; ahead
// or diverged, close-out waits rather than push over it or lose local commits.
export function syncLine(handle, remote, repository, line) {
  const local = `refs/heads/${line}`, tracking = `refs/remotes/origin/${line}`;
  if (remote) {
    const fetched = remoteGit(handle, remote, ['fetch', '--no-tags', '--quiet', remote.url, `+refs/heads/${line}:${tracking}`]);
    if (fetched.status !== 0) fail(`Aludel couldn't fetch ${line} of ${repository}: ${said(fetched)}.`);
  }
  const has = ref => handle.has(['rev-parse', '--verify', '--quiet', ref]);
  if (!has(tracking)) { if (!has(local)) fail(`${repository} has no ${line} branch.`); return handle.git(['rev-parse', local]); }
  const theirs = handle.git(['rev-parse', tracking]);
  if (!has(local)) { handle.git(['update-ref', local, theirs]); return theirs; }
  const ours = handle.git(['rev-parse', local]);
  if (ours === theirs) return ours;
  if (handle.has(['merge-base', '--is-ancestor', ours, theirs])) {
    let head = null; try { head = handle.git(['symbolic-ref', '--quiet', 'HEAD']); } catch { /* detached */ }
    if (head === local) {
      if (handle.git(['status', '--porcelain', '--untracked-files=no'])) fail(`${repository} has uncommitted changes on ${line}. Commit or stash them, then close out.`);
      handle.git(['merge', '--ff-only', '--quiet', theirs]);
    } else handle.git(['update-ref', local, theirs, ours]);
    return theirs;
  }
  fail(`${line} of ${repository} here has commits GitHub doesn't (${ours.slice(0, 7)} against ${theirs.slice(0, 7)}). Push or drop them, then close out.`);
}

// Walks a dotted path with * for every key at that level; each entry it reaches names a branch and a commit.
function entriesAt(value, path) {
  let level = [value];
  for (const part of path.split('.')) level = level.flatMap(node => node && typeof node === 'object' ? (part === '*' ? Object.values(node) : node[part] === undefined ? [] : [node[part]]) : []);
  return level;
}
// Every pin a repository's files name must be a commit on its line, as that line will be once the set merges.
// planned(key, line) gives the tip a line will have; handles(key) the host's copy of a repository.
export function checkReferences(set, planned, handles) {
  const problems = [];
  for (const repo of set) for (const reference of repo.references || []) {
    const at = planned(repo.key, repo.lines[0]);
    let parsed;
    try { parsed = JSON.parse(handles(repo.key).git(['show', `${at}:${reference.file}`])); }
    catch { problems.push(`${repo.key} has no readable ${reference.file}`); continue; }
    const target = set.find(other => other.key === reference.repository);
    const entries = entriesAt(parsed, reference.at);
    if (!entries.length) problems.push(`${reference.file} has nothing at ${reference.at}`);
    for (const entry of entries) {
      const branch = entry?.branch, commit = entry?.commit;
      if (typeof branch !== 'string' || typeof commit !== 'string') { problems.push(`${reference.file} has an entry at ${reference.at} without a branch and a commit`); continue; }
      if (!target?.lines.includes(branch)) { problems.push(`${reference.file} pins ${branch}, which isn't one of ${reference.repository}'s lines`); continue; }
      const tip = planned(target.key, branch), copy = handles(target.key);
      if (!copy.has(['cat-file', '-e', `${commit}^{commit}`]) || !copy.has(['merge-base', '--is-ancestor', commit, tip]))
        problems.push(`${reference.file} pins ${reference.repository} ${branch} at ${commit.slice(0, 12)}, which isn't on ${branch}`);
    }
  }
  if (problems.length) fail(`Close-out stopped before changing anything: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}.`);
}

// The project's own checks, run over the planned set in a sealed container: no network, no credentials, read-only. The
// workspace has the project's repository as files at its merged commit, and each other repository at its folder as a git
// clone whose lines are at their merged tips, on its default line.
export function sealedCheck({ dir, run, timeout = 180000, image = process.env.MACHINE_CHECK_IMAGE || 'node:24-bookworm' }) {
  try {
    execFileSync('docker', ['run', '--rm', '--network', 'none', '--memory', '1g', '--cpus', '1', '--pids-limit', '256', '--read-only',
      '--tmpfs', '/tmp:size=64m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', 'node',
      '--env', 'HOME=/tmp', '--env', 'GIT_CONFIG_COUNT=1', '--env', 'GIT_CONFIG_KEY_0=safe.directory', '--env', 'GIT_CONFIG_VALUE_0=*',
      '--volume', `${dir}:/work:ro`, '--workdir', '/work', image, 'sh', '-c', run], { timeout, maxBuffer: 4 * 1024 * 1024, stdio: 'pipe', encoding: 'utf8' });
    return { ok: true, output: '' };
  } catch (error) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`.trim();
    if (error.code === 'ENOENT') return { ok: false, output: 'Docker isn’t available on the machine running Aludel, so the sealed check couldn’t run.' };
    return { ok: false, output: output || String(error.message) };
  }
}
export function runProjectChecks(set, plans, handles, runCheck = sealedCheck) {
  const checks = set.flatMap(repo => (repo.checks || []).map(check => ({ ...check, repository: repo.key })));
  if (!checks.length) return [];
  const dir = mkdtempSync(join(tmpdir(), 'aludel-close-checks-'));
  const temporary = [];
  try {
    for (const repo of set) {
      const copy = handles(repo.key);
      const lines = repo.primary ? [repo.lines[0]] : repo.lines;
      const tips = lines.map(line => [line, plans.tip(repo.key, line)]);
      if (repo.primary) {
        const archive = execFileSync('git', ['archive', '--format=tar', tips[0][1]], { cwd: copy.workspace, maxBuffer: 512 * 1024 * 1024 });
        execFileSync('tar', ['-x', '-C', dir], { input: archive });
        continue;
      }
      // A merge commit close-out wrote isn't on any branch yet: name each planned tip for the clone, then clean up.
      for (const [line, tip] of tips) { const ref = `refs/aludel/close-out/${line}`; copy.git(['update-ref', ref, tip]); temporary.push([copy, ref]); }
      const target = join(dir, repo.path); mkdirSync(join(target, '..'), { recursive: true });
      execFileSync('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', copy.workspace, target], { stdio: 'pipe' });
      execFileSync('git', ['-C', target, 'fetch', '--quiet', '--update-head-ok', 'origin', '+refs/aludel/close-out/*:refs/heads/*'], { stdio: 'pipe' });
      execFileSync('git', ['-C', target, 'checkout', '--quiet', '--force', repo.lines[0]], { stdio: 'pipe' });
    }
    const results = [];
    for (const check of checks) {
      const result = runCheck({ dir, run: check.run, name: check.name });
      results.push({ name: check.name, repository: check.repository, ok: result.ok });
      if (!result.ok) fail(`Close-out stopped before changing anything: the check “${check.name}” failed. ${String(result.output).trim().split('\n').slice(-6).join(' ').slice(0, 600)}`);
    }
    return results;
  } finally {
    for (const [copy, ref] of temporary) { try { copy.git(['update-ref', '-d', ref]); } catch { /* already gone */ } }
    rmSync(dir, { recursive: true, force: true });
  }
}

// Pushes each planned merge to its remote, only over the tip the plan was made from. If one fails, the ones already pushed
// are put back to where they were (again only over what was just pushed), and close-out stops with nothing applied.
export function pushPlans(steps) {
  const pushed = [];
  for (const step of steps) {
    if (step.plan.to === step.plan.tip || !step.remote) continue;
    const result = remoteGit(step.handle, step.remote, ['push', '--quiet', '--atomic', `--force-with-lease=refs/heads/${step.line}:${step.plan.tip}`, step.remote.url, `${step.plan.to}:refs/heads/${step.line}`]);
    if (result.status === 0) { pushed.push(step); continue; }
    const back = [], stuck = [];
    for (const done of pushed.reverse()) {
      const undo = remoteGit(done.handle, done.remote, ['push', '--quiet', `--force-with-lease=refs/heads/${done.line}:${done.plan.to}`, done.remote.url, `${done.plan.tip}:refs/heads/${done.line}`]);
      (undo.status === 0 ? back : stuck).push(`${done.repository} ${done.line}`);
    }
    fail(`Close-out stopped: pushing ${step.line} of ${step.repository} failed (${said(result)}).${back.length ? ` Put back ${back.join(', ')}.` : ''}${stuck.length ? ` Couldn't put back ${stuck.join(', ')}: they have the merge on GitHub; close out again once the push can go through.` : ''} Nothing was applied here.`);
  }
  return pushed;
}
