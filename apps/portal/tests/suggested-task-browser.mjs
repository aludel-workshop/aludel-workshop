// Suggested-task review: shared editable composer, short-screen layout, isolated drafts and atomic confirmation.
// Usage: PLAYWRIGHT_MODULE=<…/playwright/index.mjs> MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/suggested-task-browser.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { initLayerScope, layerWorkScope } from '../server/layer-scope.mjs';
import { ensureProjectRepositoryLayers } from '../server/layer-package.mjs';
import { codeRepository, initCodeRepository } from '../server/code-repository.mjs';
import { codeUnits, initCodeUnits } from '../server/code-units.mjs';
import { initCodeLayer } from '../server/code-layer.mjs';
import { initAgentRuns, agentRuns } from '../server/agent-runs.mjs';
import { initSymphonyWorker, symphonyWorker } from '../server/symphony-worker.mjs';
import { initCodeCandidates } from '../server/code-candidates.mjs';
import { initWorkRuns, workRuns } from '../server/work-runs.mjs';
import { skeletonFiles, loadScaffoldSources } from '../server/scaffold.mjs';
import { previewImageName } from '../server/previews.mjs';
import { chromium } from './browser-support.mjs';

const out = 'test-results/suggested-tasks';
mkdirSync(out, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-journey-work-'));
process.env.MACHINE_DATA_DIR = root;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
const commit = (cwd, message) => { git(cwd, 'add', '.'); git(cwd, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', message); return git(cwd, 'rev-parse', 'HEAD'); };
const password = 'correct-horse-battery';

// A disposable project whose app was imported: the generated server (with its preview-only setup route), a v2 recipe,
// two routes Code detects, and no journeys.
const db = openDatabase(join(root, 'machine.sqlite'));
initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db); initCodeCandidates(db); initWorkRuns(db); initLayerScope(db);
const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const know = knowledge({ db, catalogs, packs: catalogs.packs });
const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
const owner = createUser(db, { email: 'owner@example.com', name: 'Charles', password });
const { token } = flows.saveDraft(null, { profile: 'planner' });
flows.saveDraft(token, { name: 'Biome', pitch: 'A disposable signup and first-world trial fixture.' });
const project = flows.claimDraft(token, owner, owner).project;
const projectId = project.id;
know.ensureAgents(projectId); know.ensurePackData(projectId); know.ensureRoutines(projectId); know.migrateWork(projectId);
know.ensureBrief(projectId); know.ensureLibrary(projectId); know.ensurePlan(projectId); know.ensureDesign(projectId);
const workspace = db.prepare('SELECT workspace_path FROM project_setup WHERE project_id = ?').get(projectId).workspace_path;
mkdirSync(workspace, { recursive: true }); git(workspace, 'init', '-q', '-b', 'main');
for (const directory of ['server', 'src', 'tests', '.aludel']) mkdirSync(join(workspace, directory));
const setup = flows.projectSetup(owner, projectId);
setup.stack = { ...setup.stack, options: { ...setup.stack.options, auth: true } };
const generated = skeletonFiles(setup, catalogs, catalogs.sourceControlProfiles?.[catalogs.defaultSourceControlProfile] || { gitignore: ['node_modules/'], gitattributes: [] }, { portal: 'http://aludel.localhost', app: 'http://demo.localhost' }, [], loadScaffoldSources(new URL('../', import.meta.url).pathname));
writeFileSync(join(workspace, 'README.md'), 'Team Notes\n');
writeFileSync(join(workspace, 'server/server.mjs'), generated.files['server/server.mjs']);
writeFileSync(join(workspace, 'Dockerfile'), 'FROM node:24-bookworm-slim\nWORKDIR /app\nCOPY . .\nRUN mkdir -p dist && cp src/page.html dist/index.html\nUSER node\nCMD ["node", "server/server.mjs"]\n');
writeFileSync(join(workspace, 'src/page.html'), `<!doctype html><html lang="en"><head><title>Team Notes</title></head><body><h1>Team Notes</h1><p id="route"></p><p id="role"></p><script>document.querySelector('#route').textContent=location.pathname; fetch('/api/session').then(r=>r.json()).then(v=>document.querySelector('#role').textContent=v.account?.email||'anonymous');</script></body></html>`);
writeFileSync(join(workspace, 'src/routes.ts'), "export const routes = [\n  { path: '/notes', label: 'Notes' },\n  { path: '/settings', label: 'Settings' }\n];\n");
writeFileSync(join(workspace, 'tests/app.test.mjs'), "import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';\ntest('the page reads its session from the app', () => assert.ok(readFileSync('src/page.html', 'utf8').includes(\"fetch('/api/session')\")));\n");
writeFileSync(join(workspace, '.aludel/review.json'), JSON.stringify({ version: 2, checks: [{ name: 'App tests', command: ['node', '--test', 'tests/app.test.mjs'] }],
  personas: { member: { fixture: 'starter', session: 'author' } } }));
const base = commit(workspace, 'imported app');
initLayerContract(db); initCodeUnits(db); initCodeLayer(db); initCodeRepository(db);
ensureProjectRepositoryLayers(db, projectId);
assert.ok(layerWorkScope(db, projectId, 'platform'), 'Code runs from its template as a layer-scoped layer');
const codeRepo = codeRepository({ db, units: codeUnits({ db }) }); codeRepo.adopt(projectId); codeRepo.seed(projectId, () => []);
const routeUnits = db.prepare("SELECT symbol FROM code_units WHERE project_id = ? AND kind = 'route' ORDER BY symbol").all(projectId).map(row => row.symbol);
assert.deepEqual(routeUnits, ['route /notes', 'route /settings'], 'Code indexed the app\'s routes');
const freePort = async () => { const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve)); return port; };
const items = () => db.withProject(projectId, () => know.workList(projectId));

const step = (id, name, route) => ({ id, name, route, trigger: 'Opens the page', expected: name });
writeFileSync(join(workspace, '.aludel/outputs/journeys.json'), JSON.stringify({ journeys: [
 { version: 1, id: 'send-invite', title: 'Send an invitation', origin: 'authored', revision: 2, persona: 'sender', steps: [step('send', 'Send invitation', '/invite')] },
 { version: 1, id: 'receive-invite', title: 'Receive and accept an invitation', origin: 'authored', revision: 1, persona: 'recipient', steps: [step('accept', 'Accept invitation', '/accept')] }
] }));
const journeyCommit = commit(workspace, 'Seed disposable sender and recipient journeys');
db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'platform'").run(journeyCommit, projectId);
// A synthetic connected profile enables real staging; never start a provider turn.
const agentProfile = know.defaultProfile(projectId);
symphonyWorker({ db, know, workspaceRoot: join(root, 'worker') }).issueToken(owner, projectId, agentProfile.id);

know.update(projectId, agentProfile.id, {model:'',effort:'medium'}, {rationale:'Disposable profile-scoped worker; no model turn'});
const workerRoot=join(root,'worker');mkdirSync(workerRoot,{recursive:true});
const worker=symphonyWorker({db,know,workspaceRoot:workerRoot});
const scope=worker.authenticate('Bearer '+worker.issueToken(owner,projectId,agentProfile.id).token);
const runs=agentRuns({db,know,secrets:openSecretStore(root),providers:catalogs.agentProviders.providers,worker,symphonyDispatch:true,callModel:async()=>{throw new Error('No provider turn');}});
const work=know.createWork(projectId,{layer:'platform',title:'Build signup and first world',assignee:{kind:'agent',id:agentProfile.id},checks:[]},owner.name);
runs.stage(owner,projectId,work.id);const batch=runs.view(projectId).find(v=>v.state==='draft');runs.start(owner,projectId,batch.id);
const issue=worker.issues(scope,{states:['Ready']}).issues.find(v=>v.native_ref.work_id===work.id);
const clone=join(workerRoot,issue.identifier);git(root,'clone',workspace,clone);git(clone,'checkout','--detach',issue.native_ref.repository_commit);writeFileSync(join(clone,'.git','aludel-base'),issue.native_ref.repository_commit+'\n');
worker.registerWorkspace(scope,{attemptId:issue.native_ref.attempt_id,path:clone});worker.reserveRun(scope,{attemptId:issue.native_ref.attempt_id});
const history=workRuns({db,know});history.reportPlan(projectId,issue.native_ref.attempt_id,['Assess signup journey'],{reason:'The accepted flow does not yet specify signup and first-world behavior. '+ 'Review the relevant records before implementing. '.repeat(12),journeys:[]});
worker.submitProposal(scope,{attemptId:issue.native_ref.attempt_id,proposal:{summary:'Specification needs clarification before implementation.',content:{notes:'Reviewed the accepted Pages flow and four pages. '+ 'No Code change was made. '.repeat(30)},followUps:[{layer:'pages',title:'Specify signup and first-world behavior',brief:'Define the member persona, signup steps and first-world data. '+ 'Clarify the visible completion result. '.repeat(12),why:'The accepted page labels are insufficient to implement this feature.'},{layer:'platform',title:'Add invitation feedback',brief:'Show invitation delivery and acceptance feedback.',why:'Sender and recipient both need visible confirmation.'}]}});
const reviewRun=history.list(projectId,work.id)[0];
const port=await freePort();
const server=spawn(process.execPath,['server/server.mjs'],{env:{...process.env,MACHINE_DATA_DIR:root,MACHINE_PORT:String(port),MACHINE_SYMPHONY_DISPATCH:'1',MACHINE_LAYER_TEMPLATES_ENABLED:'1'},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',c=>serverLog+=c);server.stderr.on('data',c=>serverLog+=c);
const portal=`http://aludel.localhost:${port}`;const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/home/henry/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'});
try{
 for(const deadline=Date.now()+60000;!/listening|http:\/\//i.test(serverLog)&&Date.now()<deadline;)await new Promise(r=>setTimeout(r,100));
 const context=await browser.newContext({viewport:{width:1280,height:600}});assert.ok((await context.request.post(`${portal}/api/sign-in`,{data:{email:'owner@example.com',password}})).ok());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${portal}/p/${project.slug}/work/item/${work.id}/review/${reviewRun.number}`);
 await page.locator('.wr').waitFor();
 await page.screenshot({path:out+(process.env.CAPTURE_ONLY==='1'?'/00-before.png':'/01-stack-desktop.png')});
 if(process.env.CAPTURE_ONLY!=='1'){
 await page.locator('aludel-work-create').nth(1).waitFor();
 const forms=page.locator('aludel-work-create');let first=forms.nth(0),second=forms.nth(1);
 assert.equal(await forms.count(),2);assert.equal(await page.locator('.wr > .lay-card').count(),0);
 assert.ok(await page.locator('.wr-right summary').filter({hasText:'Journey assessment'}).count());
 assert.ok(await page.evaluate(()=>document.querySelector('.wr').getBoundingClientRect().bottom<=innerHeight));
 assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);}),[],'Stacked forms have unique labels and focus targets');
 await first.getByLabel('Title',{exact:true}).fill('Clarify signup and first-world completion');
 await first.getByLabel('Description',{exact:true}).fill('Define required member inputs and a visible completion result.');
 await first.getByLabel('Assignee',{exact:true}).selectOption('unassigned');await first.getByLabel('Priority',{exact:true}).selectOption('high');await first.getByLabel('Place in',{exact:true}).selectOption('suggested');
 await first.getByRole('button',{name:'Add criterion',exact:true}).click();await first.getByLabel('Criterion 1',{exact:true}).fill('The first-world completion result is explicit.');
 await second.getByRole('button',{name:'Attach journey',exact:true}).click();await second.getByLabel('Send invitation',{exact:true}).check();await second.getByLabel('Accept invitation',{exact:true}).check();await second.getByRole('button',{name:'Attach steps',exact:true}).click();
 await page.reload();await forms.nth(1).waitFor();first=forms.nth(0);second=forms.nth(1);
 assert.equal(await first.getByLabel('Title',{exact:true}).inputValue(),'Clarify signup and first-world completion');assert.equal(await first.getByLabel('Criterion 1',{exact:true}).inputValue(),'The first-world completion result is explicit.');
 assert.equal(await second.locator('.wc-claim').count(),2,'Each suggestion draft survives refresh independently');
 await page.setViewportSize({width:390,height:844});await first.getByRole('button',{name:'Create task',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/04-phone-editing.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js','utf8'));assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document.querySelector('.wr'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))),[]);
 await page.setViewportSize({width:1280,height:600});
 await page.route('**/work/*/follow-ups/*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Disposable simulated failure. '+ 'The service is temporarily unavailable; your draft should remain intact. '.repeat(5)})}));
 await first.getByRole('button',{name:'Create task',exact:true}).click();await first.getByRole('alert').waitFor();
 assert.equal(await first.getByLabel('Description',{exact:true}).inputValue(),'Define required member inputs and a visible completion result.');
 assert.ok(await page.evaluate(()=>document.querySelector('.wr').getBoundingClientRect().bottom<=innerHeight),'Long save errors must not push review actions below the viewport');
 await first.getByRole('button',{name:'Create task',exact:true}).scrollIntoViewIfNeeded();
 assert.ok(await first.getByRole('button',{name:'Create task',exact:true}).evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight),'Create is reachable inside the short review viewport');
 await page.screenshot({path:out+'/02-edited-failure.png'});await page.unroute('**/work/*/follow-ups/*');
 const originalFirst=reviewRun.followUps[0],originalSecond=reviewRun.followUps[1];
 const stale=await context.request.post(`${portal}/api/projects/${projectId}/work/${work.id}/follow-ups/${originalSecond.id}`,{data:{decision:'create',task:{title:'Stale coverage',checks:[],claims:[{id:'stale',kind:'journey',journey:'send-invite',revision:1,steps:['send']}]}}});assert.equal(stale.status(),409);
 await first.getByRole('button',{name:'Create task',exact:true}).click();await page.locator('.wr-suggestion-done').waitFor();
 const created=items().find(e=>e.title==='Clarify signup and first-world completion');assert.ok(created);assert.equal(created.priority,'high');assert.equal(created.state,'suggested');assert.equal(created.assignee,null);assert.equal(created.context.suggestion,'Define required member inputs and a visible completion result.');assert.equal(created.checks[0].text,'The first-world completion result is explicit.');assert.equal(created.context.createdBy.followUpId,originalFirst.id);
 const retry=await context.request.post(`${portal}/api/projects/${projectId}/work/${work.id}/follow-ups/${originalFirst.id}`,{data:{decision:'create',task:{title:'Duplicate',checks:[]}}});assert.equal((await retry.json()).work.id,created.id,'Confirmation retry returns the same task');
 assert.equal(new URL(page.url()).pathname,`/p/${project.slug}/work/item/${work.id}/review/${reviewRun.number}`,'Confirming a suggestion retains the review');
 second=forms.first();await second.getByRole('button',{name:'Create task',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('aludel-work-create').length===0);
 const attached=items().find(e=>e.title==='Add invitation feedback');assert.deepEqual(attached.checks.filter(c=>c.kind==='journey').map(c=>c.journey),['send-invite','receive-invite']);
 assert.equal(items().find(e=>e.id===work.id).state,'review','Creating suggestions does not accept the original run');
 know.syncBacklog(projectId);know.syncBacklog(projectId);
 for(const task of [created,attached]){assert.equal(items().find(e=>e.id===task.id)?.state,'suggested','Confirmed follow-ups survive periodic backlog maintenance');}
 const signed=await context.request.post(`${portal}/api/projects/${projectId}/work/${work.id}/runs/${reviewRun.id}/sign`,{data:{outcome:'accept',comment:'Accept this disposable notes-only assessment.'}});
 assert.equal(signed.status(),200,await signed.text());assert.equal(items().find(e=>e.id===work.id).state,'done','Explicit signing accepts a zero-claim layer proposal');
 await page.screenshot({path:out+'/03-confirmed.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/04-phone.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js','utf8'));assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document.querySelector('.wr'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))),[]);

 await page.goto(`${portal}/p/${project.slug}/pages/tasks/board`);
 // W-8: placed in Draft, it shows in the Board's Draft column (the Backlog tab and its assignee buttons went with the old board).
 const draftCol=page.locator('aludel-work-board .lay-kb-col[data-col="draft"]');
 await draftCol.getByText(created.title,{exact:true}).waitFor();
 await page.reload();await draftCol.getByText(created.title,{exact:true}).waitFor();
 await page.screenshot({path:out+'/05-pages-backlog.png'});
 }
 assert.deepEqual(errors,[]);
 console.log('Suggested-task review browser passed.');
}finally{await browser.close();server.kill();if(server.exitCode===null&&server.signalCode===null)await new Promise(r=>server.once('exit',r));db.close();rmSync(root,{recursive:true,force:true});}
