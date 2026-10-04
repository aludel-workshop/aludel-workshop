// JOURNEYS-01 J8: an installed layer takes a newer template as reviewed Work. A pin bump changes only new installs; an
// existing instance gets one item per new pin, whose branch merges the template's own files three ways (base: the
// template the instance was forked from, ours: the instance, theirs: the new template) and leaves everything else alone.
// The branch is reviewed like any repository submission; accepting it moves the pin and the binding's template commit.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageAt, packageRootAt, templatePin } from './layer-package.mjs';

const identity = { GIT_AUTHOR_NAME: 'Aludel', GIT_AUTHOR_EMAIL: 'aludel@aludel.invalid', GIT_COMMITTER_NAME: 'Aludel', GIT_COMMITTER_EMAIL: 'aludel@aludel.invalid' };
const runner = repo => (args, options = {}) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options }).trimEnd();
function treeFiles(run, commit, prefix = '') {
  const listed = run(['ls-tree', '-r', '-z', '--full-tree', commit, ...(prefix ? ['--', prefix] : [])]);
  return new Map(listed.split('\0').filter(Boolean).map(line => { const [meta, path] = line.split('\t'); const [mode, , sha] = meta.split(' '); return [path.slice(prefix.length), { mode, sha }]; }));
}

// The update commit on top of `main`: each template file the new template changed is taken when the instance kept the old
// one, kept when the instance already has the new one, and merged line by line when both changed it. A file that can't
// be merged keeps conflict markers and is listed; the commit is never a guess.
export function templateMerge(repo, { main, root = '', from, to, template }) {
  const run = runner(repo);
  const base = treeFiles(run, from), theirs = treeFiles(run, to), ours = treeFiles(run, main, root);
  const changed = [], conflicts = [], updates = [];
  const blob = sha => run(['cat-file', 'blob', sha]);
  const scratch = mkdtempSync(join(repo, '.git', 'aludel-template-'));
  try {
    for (const path of [...new Set([...base.keys(), ...theirs.keys()])].sort()) {
      const b = base.get(path), t = theirs.get(path), o = ours.get(path);
      if (b?.sha === t?.sha && b?.mode === t?.mode) continue;
      if (o?.sha === t?.sha) continue;
      if (o?.sha === b?.sha) { updates.push(t ? `${t.mode} ${t.sha}\t${root}${path}` : `0 ${'0'.repeat(40)}\t${root}${path}`); changed.push(root + path); continue; }
      if (!t || !o) { conflicts.push(root + path); continue; }
      const files = ['ours', 'base', 'theirs'].map(name => join(scratch, name));
      writeFileSync(files[0], blob(o.sha)); writeFileSync(files[1], b ? blob(b.sha) : ''); writeFileSync(files[2], blob(t.sha));
      let merged, clean = true;
      try { merged = execFileSync('git', ['merge-file', '-p', '--diff3', '-L', 'this project', '-L', `template ${from.slice(0, 12)}`, '-L', `template ${to.slice(0, 12)}`, ...files], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }); }
      catch (error) { if (typeof error.status !== 'number' || error.status < 1 || error.status > 127) throw error; merged = error.stdout; clean = false; }
      const sha = run(['hash-object', '-w', '--stdin'], { input: merged });
      updates.push(`${o.mode} ${sha}\t${root}${path}`); changed.push(root + path);
      if (!clean) conflicts.push(root + path);
    }
    if (!changed.length) return { commit: null, changed, conflicts };
    const env = { ...process.env, ...identity, GIT_INDEX_FILE: join(scratch, 'index') };
    run(['read-tree', main], { env });
    run(['update-index', '--index-info'], { env, input: updates.join('\n') + '\n' });
    const tree = run(['write-tree'], { env });
    const commit = run(['commit-tree', tree, '-p', main, '-m', `Update the ${template} template to ${to.slice(0, 12)}${conflicts.length ? `\n\nConflicts to resolve: ${conflicts.join(', ')}` : ''}\n\nAludel-Template: ${template} ${to}`], { env });
    return { commit, changed, conflicts };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

// The template commit an instance was forked from. Code's install before template commits were recorded kept it in the
// install commit's trailer and in refs/aludel/template.
function forkedFrom(run, binding) {
  if (/^[0-9a-f]{40}$/.test(binding.template_commit || '')) return binding.template_commit;
  try { const trailer = /Aludel-Template: \S+ ([0-9a-f]{40})/.exec(run(['log', '--format=%B', '--grep=^Aludel-Template:', '-n', '1', binding.accepted_commit]))?.[1]; if (trailer) return trailer; } catch { /* no trailer */ }
  try { return run(['rev-parse', '--verify', 'refs/aludel/template^{commit}']); } catch { return null; }
}

export function templateUpdates({ db, know, runHistory }) {
  // Raises one item per layer whose template moved past what it was forked from. Idempotent across restarts.
  function raise(projectId) {
    const raised = [];
    const bindings = db.prepare(`SELECT b.*, i.layer_key AS key FROM layer_package_bindings b JOIN layer_instances i ON i.project_id = b.project_id AND i.instance_id = b.layer_instance_id
      WHERE b.project_id = ? AND b.template IS NOT NULL`).all(projectId);
    for (const binding of bindings) {
      const pin = templatePin(binding.key, binding.template);
      if (!pin) continue;
      const run = runner(binding.repository_path);
      const from = forkedFrom(run, binding);
      if (!from || from === pin.commit) continue;
      if (know.workList(projectId).some(item => item.context?.templateUpdate?.layer === binding.key && item.context.templateUpdate.to === pin.commit)) continue;
      run(['fetch', '--quiet', '--no-tags', pin.repo, `+${from}:refs/aludel/template-from`, `+${pin.commit}:refs/aludel/template`]);
      const main = binding.accepted_commit, root = packageRootAt(binding.repository_path, main);
      const merge = templateMerge(binding.repository_path, { main, root, from, to: pin.commit, template: binding.template });
      const update = { layer: binding.key, template: binding.template, from, to: pin.commit, base: main, commit: merge.commit, changed: merge.changed, conflicts: merge.conflicts };
      if (!merge.commit) { db.prepare('UPDATE layer_package_bindings SET template_commit = ? WHERE project_id = ? AND layer_key = ?').run(pin.commit, projectId, binding.key); continue; }
      const branch = `template/${binding.template}-${pin.commit.slice(0, 12)}`;
      run(['update-ref', `refs/heads/${branch}`, merge.commit]);
      const name = db.prepare('SELECT name FROM layer_definitions WHERE project_id = ? AND layer_key = ?').get(projectId, binding.key)?.name || binding.key;
      const files = `${merge.changed.length} template ${merge.changed.length === 1 ? 'file' : 'files'}`;
      const conflicted = merge.conflicts.length > 0;
      if (!conflicted) packageAt(binding.repository_path, merge.commit, binding.key);
      const item = know.createWork(projectId, { layer: binding.key, layerScoped: true, title: `Update ${name} to the latest ${binding.template} template`.slice(0, 160), checks: [
        conflicted ? `Resolve the template conflicts in ${merge.conflicts.join(', ')}`.slice(0, 500) : `The ${binding.template} template update keeps this project's own changes`],
        state: 'ready', context: { templateUpdate: { ...update, branch }, suggestion: conflicted
          ? `The ${binding.template} template moved from ${from.slice(0, 12)} to ${pin.commit.slice(0, 12)}. Branch ${branch} merges ${files}; ${merge.conflicts.length} still ${merge.conflicts.length === 1 ? 'has' : 'have'} conflict markers. Resolve them on that branch, commit, and submit it for review.`
          : `The ${binding.template} template moved from ${from.slice(0, 12)} to ${pin.commit.slice(0, 12)}. Branch ${branch} merges ${files} into this project; its own outputs and changes are kept.` } });
      if (!conflicted) runHistory.hostRun(projectId, item.id, { branch, commit: merge.commit, summary: `Aludel merged the ${binding.template} template's changes (${files}) from ${from.slice(0, 12)} to ${pin.commit.slice(0, 12)}.` });
      raised.push({ item: item.id, ...update, branch });
    }
    return raised;
  }
  return { raise };
}
