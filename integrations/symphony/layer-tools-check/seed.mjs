// LAYER-TOOLS-01: a disposable portal for testing the Symphony layer tools over real HTTP.
// Seeds a project with Pages from its template, two pages, and two layer-scoped Pages tasks. Task A is Go-authorized
// (for the scripted adapter check); task B is ready for the live turn.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const P = new URL('../../../apps/portal/server/', import.meta.url).pathname;
const imp = name => import(P + name);
const { createUser, initAccounts } = await imp('accounts.mjs');
const { agentRuns, initAgentRuns } = await imp('agent-runs.mjs');
const { initKnowledge, knowledge } = await imp('knowledge.mjs');
const { initLayerContract } = await imp('layer-contract.mjs');
const { initLayerScope } = await imp('layer-scope.mjs');
const { initOnboarding, loadCatalogs, onboarding } = await imp('onboarding.mjs');
const { initPagesLayerApp } = await imp('pages-layer-app.mjs');
const { ensureProductWorkspace } = await imp('product-workspace.mjs');
const { openSecretStore } = await imp('secret-store.mjs');
const { openDatabase } = await imp('storage.mjs');
const { initSymphonyWorker, symphonyWorker } = await imp('symphony-worker.mjs');
const { initWorkRuns } = await imp('work-runs.mjs');
const { initWorkflow } = await imp('workflow.mjs');

const root = process.env.MACHINE_DATA_DIR;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
const db = openDatabase(join(root, 'machine.sqlite'));
initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initLayerContract(db); initPagesLayerApp(db);
initAgentRuns(db); initSymphonyWorker(db); initWorkRuns(db); initLayerScope(db);
const catalogs = loadCatalogs(P.replace('server/', 'config'));
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
const owner = createUser(db, { email: 'owner@example.com', name: 'Charles', password: process.env.SEED_PASSWORD });
const { token } = flows.saveDraft(null, { profile: 'planner' });
flows.saveDraft(token, { name: 'Tool Library', pitch: 'Neighbours borrow tools from each other instead of buying them.' });
const project = flows.claimDraft(token, owner, owner).project;
const projectId = project.id;
initLayerContract(db);
know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q');
writeFileSync(join(workspace, 'README.md'), '# Tool Library\n'); git(workspace, 'add', '.');
git(workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
const profile = know.defaultProfile(projectId);
know.update(projectId, profile.id, { model: '', effort: 'medium' }, { rationale: 'Layer tools trial' });
const worker = symphonyWorker({ db, know, workspaceRoot: process.env.MACHINE_SYMPHONY_WORKSPACE_ROOT });
const runs = agentRuns({ db, know, secrets: openSecretStore(root), providers: catalogs.agentProviders.providers, worker, symphonyDispatch: true, callModel: async () => { throw new Error('No model'); } });

const browse = know.insert(projectId, 'page', { label: 'Browse tools', icon: 'article', pageType: 'list', status: 'planned' });
const detail = know.insert(projectId, 'page', { label: 'Tool detail', icon: 'article', pageType: 'detail', status: 'planned' });
const agent = { kind: 'agent', id: profile.id };
const make = (title, suggestion, checks) => {
  const task = know.createWork(projectId, { layer: 'pages', title, suggestion, checks, assignee: agent }, owner.name);
  if (task.state === 'suggested') know.updateWork(owner, projectId, task.id, { state: 'ready' });
  return know.workById(projectId, task.id);
};
const a = make('Scripted adapter check', 'Scripted: no model turn.', ['The flow exists']);
// Task B is for a live agent turn, when one is authorized: the same changes, asked for in words.
const b = make('Map how a neighbour borrows a tool',
  'Add a flow for how a neighbour finds a tool and asks to borrow it, from Browse tools to Tool detail. Give Tool detail a one-sentence description. ' +
  'Also add a short rule to the layer’s flow method (knowledge/flow-method.md in its repository): a flow names its goal before its first step. Run the layer tests before committing.',
  ['A Borrow a tool flow goes from Browse tools to Tool detail', 'Tool detail has a one-sentence description', 'The flow method says to name the goal first, and the layer tests pass']);
// Task C needs a small change the layer does not already have (its method says nothing about step names), plus one record edit.
const c = make('Name flow steps with verbs',
  'Add a rule to the layer’s flow method (knowledge/flow-method.md in its repository): each step name starts with a verb, for example “Browse tools” or “Open the tool detail”. ' +
  'Keep it to one or two sentences and run the layer tests before committing. Also give Tool detail a one-sentence description.',
  ['knowledge/flow-method.md says each step name starts with a verb, with an example', 'Tool detail has a one-sentence description', 'The layer tests pass on the committed branch']);
// SEED_GO picks which task is Go-authorized: a (scripted check, the default), or b or c (a live agent turn).
runs.stage(owner, projectId, { b: b.id, c: c.id }[process.env.SEED_GO] || a.id);
runs.start(owner, projectId, runs.view(projectId).find(value => value.state === 'draft').id);
db.close();
console.log(JSON.stringify({ projectId, slug: project.slug, workA: a.id, workB: b.id, refB: b.ref, workC: c.id, pages: { browse: browse.id, detail: detail.id }, workspace }));
