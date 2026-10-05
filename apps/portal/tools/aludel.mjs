#!/usr/bin/env node
// AGENT-WORK-01 A8: the local work style. You claim a goal item from your checkout; Claude Code (on your own subscription)
// works it through the Aludel tools in tools/editor-mcp.mjs, and you watch and answer on the item page.
//
//   node apps/portal/tools/aludel.mjs pair [portal origin]   store an editor token from Work › Team (outside the repository)
//   node apps/portal/tools/aludel.mjs list                   your goal items, and the open ones you could claim
//   node apps/portal/tools/aludel.mjs claim W-12             claim it and connect Claude Code in this folder to Aludel
//   node apps/portal/tools/aludel.mjs status W-12            where it stands: actions, what waits on you, the changeset
//   node apps/portal/tools/aludel.mjs submit W-12            report this branch's committed code to the item
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { configPath, gitReport, loadConfig, pair, request } from './aludel-client.mjs';

const adapter = new URL('./editor-mcp.mjs', import.meta.url).pathname;
const out = text => process.stdout.write(text + '\n');
const board = { draft: 'Draft', ready: 'Ready', progress: 'In progress', review: 'In review', done: 'Done' };
const actionState = { proposed: 'waits for approval', todo: 'to do', working: 'working', review: 'ready for review', done: 'done' };

async function find(config, ref) {
  if (!ref) throw new Error('Name the item, for example W-12.');
  const { goals } = await request(config, '/goals?claimable=1');
  const item = goals.find(entry => entry.ref.toLowerCase() === ref.toLowerCase() || entry.id === ref);
  if (!item) throw new Error(`${ref} isn't a goal item you have or can claim.`);
  return item;
}
// Claude Code reads project MCP servers from .mcp.json. Add Aludel's beside any others, and keep the file out of commits
// unless the repository already tracks it.
function connect(folder) {
  const file = join(folder, '.mcp.json');
  const current = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  current.mcpServers = { ...(current.mcpServers || {}), aludel: { command: process.execPath, args: [adapter] } };
  writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
  try {
    const tracked = execFileSync('git', ['ls-files', '.mcp.json'], { cwd: folder, encoding: 'utf8' }).trim();
    const exclude = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: folder, encoding: 'utf8' }).trim();
    const path = join(folder, exclude);
    const lines = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (!tracked && !lines.split('\n').includes('.mcp.json')) writeFileSync(path, lines + (lines && !lines.endsWith('\n') ? '\n' : '') + '.mcp.json\n');
  } catch { /* not a git checkout: nothing to exclude from */ }
  return file;
}

const [command, arg] = process.argv.slice(2);
try {
  if (command === 'pair') {
    const me = await pair(arg);
    out(`Connected to ${me.projectId} as ${me.user.name}. The token is stored outside the repository at ${configPath}.`);
  } else if (command === 'list') {
    const config = loadConfig();
    const { goals } = await request(config, '/goals?claimable=1');
    if (!goals.length) out('No goal items yet. Create one in Work with "Goal across layers".');
    for (const item of goals) {
      const done = item.actions.done || 0, total = Object.values(item.actions).reduce((sum, n) => sum + n, 0);
      out(`${item.ref.padEnd(6)} ${board[item.board].padEnd(12)} ${item.assignee ? 'yours' : 'open '}  ${total ? `${done}/${total} done` : 'no actions'}${item.needs ? `  ${item.needs} waiting on you` : ''}  ${item.title}`);
    }
  } else if (command === 'claim') {
    const config = loadConfig();
    const item = await find(config, arg);
    const view = await request(config, `/goals/${encodeURIComponent(item.id)}/claim`, {});
    const file = connect(process.cwd());
    out(`Claimed ${item.ref} “${item.title}” to work locally. Claude Code in this folder can reach Aludel (${file}).`);
    out(view.item.board === 'ready' ? `Start it on its page in Aludel when you're ready, then in Claude Code here say:` : `Define it with Claude Code here, then start it on its page. Say:`);
    out(`  Work on ${item.ref} (${item.id}) using the Aludel tools.`);
  } else if (command === 'status') {
    const config = loadConfig();
    const item = await find(config, arg);
    const view = await request(config, `/goals/${encodeURIComponent(item.id)}`);
    out(`${view.item.ref} ${view.item.title}: ${board[view.item.board]}`);
    for (const phase of view.phases) {
      if (view.phases.length > 1) out(`Phase ${phase.number}: ${phase.title}${phase.gated ? ' (review gate after)' : ''}`);
      for (const action of view.actions.filter(entry => entry.phase === phase.number))
        out(`  #${action.number} ${actionState[action.state]}${action.layer ? ` [${action.layer}]` : ''} ${action.goal}${action.blocked ? ` (${action.blocked.toLowerCase()})` : ''}`);
    }
    for (const need of view.needs) out(`Waiting on you: #${need.action} ${need.kind === 'approval' ? 'approve a new action' : need.text}`);
    for (const group of view.changeset) out(`Staged in ${group.layer}: ${group.changes.length} change${group.changes.length === 1 ? '' : 's'}`);
    if (view.code) out(`Code: ${view.code.branch} at ${view.code.commit.slice(0, 7)}, ${view.code.files.length} files`);
  } else if (command === 'submit') {
    const config = loadConfig();
    const item = await find(config, arg);
    const report = gitReport(process.cwd());
    if (report.dirty) throw new Error(`Commit or stash the ${report.dirty} uncommitted change${report.dirty === 1 ? '' : 's'} first; only committed work is reported.`);
    const view = await request(config, `/goals/${encodeURIComponent(item.id)}/code`, { branch: report.branch, commit: report.commit, base: report.base, files: report.files });
    out(`Reported ${report.branch} at ${report.commit.slice(0, 7)} (${report.files.length} files) to ${item.ref}.`);
    const left = view.actions.filter(action => !['review', 'done', 'proposed'].includes(action.state));
    out(left.length ? `Still open: #${left.map(action => action.number).join(', #')}.` : `Every action is ready for review; move ${item.ref} to review on its page.`);
  } else {
    out('Usage: aludel pair [origin] | list | claim W-n | status W-n | submit W-n');
    if (command && command !== 'help') process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write((error.code === 'ENOENT' && error.path === configPath ? 'Pair first: aludel pair <portal origin>' : error.message) + '\n');
  process.exitCode = 1;
}
