import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sensitivePath = /(^|\/)(\.env(?:\.|$)|[^/]+\.(?:pem|key|p12|sqlite|sqlite3|db)$|\.data(?:\/|$))/i;

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

export function inspectGitRepository(repository) {
  const inside = git(repository, ['rev-parse', '--is-inside-work-tree'], { allowFailure: true, quiet: true });
  if (inside.status !== 0) return { initialized: false, committed: false, remote: null, branch: null };
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
  const askpass = fileURLToPath(new URL('./git-askpass.mjs', import.meta.url));
  git(repository, ['push', '--set-upstream', 'origin', profile.initialBranch], {
    env: { GIT_ASKPASS: askpass, GIT_ASKPASS_REQUIRE: 'force', GIT_TERMINAL_PROMPT: '0', MACHINE_GITHUB_PUSH_TOKEN: token }
  });
  const head = git(repository, ['rev-parse', 'HEAD']).stdout.trim();
  return { branch: profile.initialBranch, commit: head, trackedFiles: tracked.length };
}

function trackedPaths(repository) {
  return git(repository, ['diff', '--cached', '--name-only', '-z']).stdout.split('\0').filter(Boolean);
}

// Generated project workspaces commit locally first and publish to a remote later, so onboarding never depends on GitHub being reachable.
export function commitWorkspace({ repository, profile, message, name, email }) {
  const before = inspectGitRepository(repository);
  if (!before.initialized) git(repository, ['init', '-b', profile.initialBranch]);
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
  if (changed) git(repository, ['commit', '-m', message]);
  const head = git(repository, ['rev-parse', 'HEAD']).stdout.trim();
  const trackedFiles = git(repository, ['ls-files', '-z']).stdout.split('\0').filter(Boolean).length;
  return { branch: profile.initialBranch, commit: head, trackedFiles, changed };
}

export function pushWorkspace({ repository, remoteUrl, token, branch }) {
  const current = git(repository, ['remote', 'get-url', 'origin'], { allowFailure: true, quiet: true });
  if (current.status !== 0) git(repository, ['remote', 'add', 'origin', remoteUrl]);
  else if (current.stdout.trim() !== remoteUrl) git(repository, ['remote', 'set-url', 'origin', remoteUrl]);
  const askpass = fileURLToPath(new URL('./git-askpass.mjs', import.meta.url));
  git(repository, ['push', '--set-upstream', 'origin', branch], {
    env: { GIT_ASKPASS: askpass, GIT_ASKPASS_REQUIRE: 'force', GIT_TERMINAL_PROMPT: '0', MACHINE_GITHUB_PUSH_TOKEN: token }
  });
  const head = git(repository, ['rev-parse', 'HEAD']).stdout.trim();
  const trackedFiles = git(repository, ['ls-files', '-z']).stdout.split('\0').filter(Boolean).length;
  return { branch, commit: head, trackedFiles };
}
