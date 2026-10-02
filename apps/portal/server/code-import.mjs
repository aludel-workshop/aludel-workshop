// T03-CODE: an existing GitHub repository becomes the project's repository, and so Code's. Importing follows the same
// path as creating one (DEC-061): Code installs under .aludel/ as one commit, its starter docs are seeded, and the result
// is pushed with the App's installation token. The owner checks first: Aludel clones the repository and lists the files it
// would add, without committing anything. Confirming replaces the project's starter repository, which is moved aside,
// not deleted. Repositories whose default branch isn't main are refused for now.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gitWithToken } from './git-repository.mjs';
import { ensureProjectRepositoryLayers, projectRepositoryTemplateFiles } from './layer-package.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (repo, args) => { try { return git(repo, args); } catch { return null; } };
const clean = text => String(text || '').replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[token]').split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300);

// github: existingRepository(userId, projectId, input) → { installation, remote, token }, bindExisting(...)
// After confirming, `afterInstall(projectId)` seeds and connects Code, and `sync(projectId)` pushes.
export function codeImport({ db, github, importRoot, afterInstall = () => {}, sync = async () => null }) {
  const staging = projectId => join(importRoot, projectId.replace(/[^A-Za-z0-9_-]/g, '_'));
  async function check(userId, projectId, input) {
    const found = await github.existingRepository(userId, projectId, input);
    if (found.remote.default_branch !== 'main') fail(`${found.remote.owner}/${found.remote.name} uses ${found.remote.default_branch} as its default branch. Aludel works on main for now; rename the branch on GitHub first.`, 409);
    const target = staging(projectId);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(dirname(target), { recursive: true });
    const cloned = gitWithToken(dirname(target), ['clone', '--quiet', '--no-tags', '--branch', 'main', found.remote.clone_url, target], found.token);
    if (cloned.status !== 0) fail(`Could not clone ${found.remote.owner}/${found.remote.name}: ${clean(cloned.stderr)}`, 409);
    const files = (tryGit(target, ['ls-files']) || '').split('\n').filter(Boolean);
    const existing = files.some(path => path === '.aludel/layer.json');
    return { found, target, preview: { repository: { owner: found.remote.owner, name: found.remote.name, url: found.remote.html_url, private: found.remote.private },
      files: files.length, adds: existing ? [] : projectRepositoryTemplateFiles().map(path => `.aludel/${path}`), existing } };
  }
  // The check: what importing would do. Nothing is committed and the project's repository is untouched.
  async function preview(userId, projectId, input) { return (await check(userId, projectId, input)).preview; }
  // Confirm: the clone becomes the project's repository, Code installs into it, and the result is pushed.
  async function confirm(userId, projectId, input, workspace) {
    const { found, target } = await check(userId, projectId, input);
    if (existsSync(workspace)) renameSync(workspace, `${workspace}.before-import-${Date.now()}`);
    mkdirSync(dirname(workspace), { recursive: true });
    renameSync(target, workspace);
    github.bindExisting(projectId, found.installation, found.remote, git(workspace, ['rev-parse', 'HEAD']), git(workspace, ['ls-files']).split('\n').filter(Boolean).length);
    const installed = ensureProjectRepositoryLayers(db, projectId);
    if (!installed.length) fail('Code could not be installed into the imported repository.', 409);
    afterInstall(projectId);
    return { installed, sync: await sync(projectId) };
  }
  return { preview, confirm };
}
