// EX-02A (from T03-CODE's import): a project created by connecting an existing GitHub repository. Nothing about the app is
// assumed: the check clones the repository and changes nothing; the person chooses where the code is; connecting creates
// the project, makes the clone its repository, installs Code under .aludel/ as one commit with those code paths, and
// pushes it. No starter docs are seeded into a connected repository (its docs are its own), and no project exists until
// the person connects, so an abandoned check leaves nothing behind but a staging clone that the next check replaces.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { countReads, detectCodeFolders } from './code-detect.mjs';
import { gitWithToken } from './git-repository.mjs';
import { ensureProjectRepositoryLayers, projectRepositoryInstallPlan, unitGlobs } from './layer-package.mjs';
import { treeAt } from './source-units.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const clean = text => String(text || '').replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[token]').split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300);

// github: installationRepositories, existingRepository, bindExisting. afterInstall(projectId) refreshes Code; sync(projectId) pushes.
export function codeImport({ db, github, importRoot, afterInstall = () => {}, sync = async () => null }) {
  const staging = key => join(importRoot, String(key).replace(/[^A-Za-z0-9_-]/g, '_'));

  async function clone(userId, key, input) {
    const found = await github.existingRepository(userId, null, input);
    const target = staging(key);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(dirname(target), { recursive: true });
    if (found.remote.default_branch !== 'main') return { found, target, blocked: { branch: found.remote.default_branch } };
    const cloned = gitWithToken(dirname(target), ['clone', '--quiet', '--no-tags', '--branch', 'main', found.remote.clone_url, target], found.token);
    if (cloned.status !== 0) fail(`Could not clone ${found.remote.owner}/${found.remote.name}: ${clean(cloned.stderr)}`, 409);
    return { found, target, commit: git(target, ['rev-parse', 'HEAD']) };
  }

  // What connecting would do, read from a fresh clone: nothing is committed and no project is made.
  async function check(userId, key, input) {
    const { found, target, blocked, commit } = await clone(userId, key, input);
    const repository = { owner: found.remote.owner, name: found.remote.name, url: found.remote.html_url, private: found.remote.private, defaultBranch: found.remote.default_branch };
    if (blocked) return { repository, blocked, message: `${repository.owner}/${repository.name} uses ${blocked.branch} as its default branch. Aludel works on main for now: rename the branch on GitHub, then check again.` };
    const detected = detectCodeFolders(target, commit);
    const plan = detected.existing ? { adds: [], kept: [], conflicts: [] } : projectRepositoryInstallPlan(target);
    return { repository, commit, ...detected, ...plan };
  }

  // What Code would read for edited paths, in the last checked clone.
  function count(key, globs) {
    const target = staging(key);
    if (!existsSync(join(target, '.git'))) fail('Check the repository again.', 409);
    return countReads(treeAt(target, 'HEAD'), unitGlobs(globs));
  }

  // Connect: check again (so what is committed is what was shown), then make the project and install Code into its repository.
  // `createProject()` makes the project and returns { projectId, workspace }; it runs only once everything checks out.
  async function connect(userId, key, { installationId, name, commit: seen, units }, createProject) {
    const { found, target, blocked, commit } = await clone(userId, key, { installationId, name });
    if (blocked) fail(`${found.remote.owner}/${found.remote.name} uses ${blocked.branch} as its default branch. Aludel works on main for now.`, 409);
    if (seen && seen !== commit) fail(`main on ${found.remote.owner}/${found.remote.name} moved since the check (now ${commit.slice(0, 7)}). Check it again.`, 409);
    const detected = detectCodeFolders(target, commit);
    // A repository that already has .aludel/ says where its code is itself.
    const paths = detected.existing ? null : unitGlobs(units);
    const reads = countReads(treeAt(target, commit), paths || detected.existing.units);
    if (reads.over) fail(`These paths cover ${reads.reads} source files; Code reads up to ${reads.limit}. Choose narrower paths.`, 413);
    if (!detected.existing && projectRepositoryInstallPlan(target).conflicts.length) fail('The repository has its own version of Aludel\'s files in .aludel/. Move or remove them, then check again.', 409);
    const { projectId, workspace } = createProject({ repository: found.remote });
    if (existsSync(workspace)) renameSync(workspace, `${workspace}.before-connect-${Date.now()}`);
    mkdirSync(dirname(workspace), { recursive: true });
    renameSync(target, workspace);
    github.bindExisting(projectId, found.installation, found.remote, commit, git(workspace, ['ls-files']).split('\n').filter(Boolean).length);
    const installed = ensureProjectRepositoryLayers(db, projectId, { units: paths });
    if (!installed.includes('platform')) fail('Code could not be installed into the repository.', 409);
    // A connected repository's docs are its own: Code's starter docs are never seeded into it.
    db.prepare("UPDATE layer_package_bindings SET seeded_at = ? WHERE project_id = ? AND layer_key = 'platform' AND seeded_at IS NULL").run(new Date().toISOString(), projectId);
    afterInstall(projectId);
    return { projectId, installed, reads: reads.reads, sync: await sync(projectId) };
  }

  return { repositories: (userId, installationId) => github.installationRepositories(userId, installationId), check, count, connect };
}
