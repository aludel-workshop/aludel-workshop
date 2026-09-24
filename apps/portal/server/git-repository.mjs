import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sensitivePath = /(^|\/)(\.env(?:\.|$)|[^/]+\.(?:pem|key|p12|sqlite|sqlite3|db)$|\.data(?:\/|$))/i;

// Pushes authenticate only with the short-lived installation token. An empty credential.helper clears every helper from the
// user's and system git config (for example the gh CLI's), which git would otherwise try first, pushing as that person.
const tokenOnly = ['-c', 'credential.helper='];
const tokenEnvironment = token => ({ GIT_ASKPASS: fileURLToPath(new URL('./git-askpass.mjs', import.meta.url)),
  GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', MACHINE_GITHUB_PUSH_TOKEN: token });

function git(repository, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0 && !options.allowFailure) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`Git ${args[0]} failed${detail ? `: ${detail}` : '.'}`);
  }
  return result;
}

export function loadGitProfile(configPath, projectId) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (config.schemaVersion !== 1) throw new Error('Unsupported project setup configuration.');
  const project = config.projects?.[projectId];
  if (!project) throw new Error(`Project ${projectId} has no setup configuration.`);
  const profileId = project.sourceControlProfile || config.defaultSourceControlProfile;
  const profile = config.sourceControlProfiles?.[profileId];
  if (!profile || profile.provider !== 'git') throw new Error(`Git profile ${profileId} is unavailable.`);
  return { repository: resolve(dirname(configPath), project.repositoryPath), profile, profileId };
}

// A folder is a repository only if it is the top of its own. Project workspaces live inside Aludel's repository (in the
// ignored .data folder); without this check git ran in the parent, so starting a project committed and could push Aludel itself.
function ownRepository(repository) {
  if (!existsSync(repository)) return false;
  const top = git(repository, ['rev-parse', '--show-toplevel'], { allowFailure: true, quiet: true });
  return top.status === 0 && realpathSync(top.stdout.trim()) === realpathSync(repository);
}

export function inspectGitRepository(repository) {
  if (!ownRepository(repository)) return { initialized: false, committed: false, remote: null, branch: null };
  const head = git(repository, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true, quiet: true });
  const branch = git(repository, ['branch', '--show-current'], { allowFailure: true, quiet: true }).stdout.trim() || null;
  const remote = git(repository, ['remote', 'get-url', 'origin'], { allowFailure: true, quiet: true });
  return { initialized: true, committed: head.status === 0, remote: remote.status === 0 ? remote.stdout.trim() : null, branch };
}

function writePolicy(repository, profile) {
  writeFileSync(resolve(repository, '.gitignore'), `${profile.gitignore.join('\n')}\n`, { encoding: 'utf8' });
  writeFileSync(resolve(repository, '.gitattributes'), `${profile.gitattributes.join('\n')}\n`, { encoding: 'utf8' });
}

export function initializeAndPush({ repository, profile, remoteUrl, login, userId, token }) {
  const before = inspectGitRepository(repository);
  if (before.committed) throw new Error('This workspace already has Git history. Link it through an existing-repository flow instead.');
  writePolicy(repository, profile);
  git(repository, ['init', '-b', profile.initialBranch]);
  git(repository, ['config', 'user.name', login]);
  git(repository, ['config', 'user.email', `${userId}+${login}@users.noreply.github.com`]);
  git(repository, ['add', '-A']);
  const tracked = git(repository, ['diff', '--cached', '--name-only', '-z']).stdout.split('\0').filter(Boolean);
  const blocked = tracked.filter(path => sensitivePath.test(path) && path !== '.env.example');
  if (blocked.length) {
    git(repository, ['reset'], { allowFailure: true, quiet: true });
    throw new Error(`Sensitive local files would be committed: ${blocked.join(', ')}`);
  }
  if (!tracked.length) throw new Error('No project files are available for the initial commit.');
  git(repository, ['commit', '-m', profile.initialCommitMessage]);
  git(repository, ['remote', 'add', 'origin', remoteUrl]);
  git(repository, [...tokenOnly, 'push', '--set-upstream', 'origin', profile.initialBranch], { env: tokenEnvironment(token) });
  const head = git(repository, ['rev-parse', 'HEAD']).stdout.trim();
  return { branch: profile.initialBranch, commit: head, trackedFiles: tracked.length };
}

function trackedPaths(repository) {
  return git(repository, ['diff', '--cached', '--name-only', '-z']).stdout.split('\0').filter(Boolean);
}

// Generated project workspaces commit locally first and publish to a remote later, so onboarding never depends on GitHub being reachable.
// trailers (LAY-07D): { 'Aludel-Work': 'W-12', Implements: 'S4, SPEC-02/FR-001' } end the message so code links can be declared without tags.
export function commitWorkspace({ repository, profile, message, name, email, trailers = null }) {
  const before = inspectGitRepository(repository);
  if (!before.initialized) git(repository, ['init', '-b', profile.initialBranch]);
  if (!ownRepository(repository)) throw new Error('Refusing to commit: the workspace is not its own repository.');
  git(repository, ['config', 'user.name', name]);
  git(repository, ['config', 'user.email', email]);
  git(repository, ['add', '-A']);
  const staged = trackedPaths(repository);
  const blocked = staged.filter(path => sensitivePath.test(path) && path !== '.env.example');
  if (blocked.length) {
    git(repository, ['reset'], { allowFailure: true, quiet: true });
    throw new Error(`Sensitive local files would be committed: ${blocked.join(', ')}`);
  }
  const changed = git(repository, ['diff', '--cached', '--quiet'], { allowFailure: true, quiet: true }).status !== 0;
  const trailerLines = Object.entries(trailers || {}).filter(([key, value]) => /^[A-Za-z-]+$/.test(key) && String(value || '').trim()).map(([key, value]) => `${key}: ${String(value).replace(/\s+/g, ' ').trim()}`);
  if (changed) git(repository, ['commit', '-m', message, ...(trailerLines.length ? ['-m', trailerLines.join('\n')] : [])]);
  const head = git(repository, ['rev-parse', 'HEAD']).stdout.trim();
  const trackedFiles = git(repository, ['ls-files', '-z']).stdout.split('\0').filter(Boolean).length;
  return { branch: profile.initialBranch, commit: head, trackedFiles, changed };
}

export function pushWorkspace({ repository, remoteUrl, token, branch }) {
  if (!ownRepository(repository)) throw new Error('Refusing to push: the workspace is not its own repository.');
  const current = git(repository, ['remote', 'get-url', 'origin'], { allowFailure: true, quiet: true });
  if (current.status !== 0) git(repository, ['remote', 'add', 'origin', remoteUrl]);
  else if (current.stdout.trim() !== remoteUrl) git(repository, ['remote', 'set-url', 'origin', remoteUrl]);
  git(repository, [...tokenOnly, 'push', '--set-upstream', 'origin', branch], { env: tokenEnvironment(token) });
  const head = git(repository, ['rev-parse', 'HEAD']).stdout.trim();
  const trackedFiles = git(repository, ['ls-files', '-z']).stdout.split('\0').filter(Boolean).length;
  return { branch, commit: head, trackedFiles };
}
