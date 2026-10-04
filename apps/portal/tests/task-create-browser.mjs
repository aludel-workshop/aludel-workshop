// Task composer: optional/multiple journeys, recoverable drafts, short-screen scrolling and agent staging on disposable data.
// Usage: PLAYWRIGHT_MODULE=<…/playwright/index.mjs> MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/task-create-browser.mjs
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
import { layerWorkScope } from '../server/layer-scope.mjs';
import { ensureProjectRepositoryLayers } from '../server/layer-package.mjs';
import { codeRepository, initCodeRepository } from '../server/code-repository.mjs';
import { codeUnits, initCodeUnits } from '../server/code-units.mjs';
import { initCodeLayer } from '../server/code-layer.mjs';
import { initAgentRuns } from '../server/agent-runs.mjs';
import { initSymphonyWorker, symphonyWorker } from '../server/symphony-worker.mjs';
import { initCodeCandidates } from '../server/code-candidates.mjs';
import { initWorkRuns } from '../server/work-runs.mjs';
import { skeletonFiles, loadScaffoldSources } from '../server/scaffold.mjs';
import { previewImageName } from '../server/previews.mjs';
import { chromium } from './browser-support.mjs';

const out = 'test-results/task-create';
mkdirSync(out, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'aludel-journey-work-'));
process.env.MACHINE_DATA_DIR = root;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
const commit = (cwd, message) => { git(cwd, 'add', '.'); git(cwd, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', message); return git(cwd, 'rev-parse', 'HEAD'); };
const password = 'correct-horse-battery';

// A disposable project whose app was imported: the generated server (with its preview-only setup route), a v2 recipe,
// two routes Code detects, and no journeys.
const db = openDatabase(join(root, 'machine.sqlite'));
initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initAgentRuns(db); initSymphonyWorker(db); initCodeCandidates(db); initWorkRuns(db);
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
const port = await freePort();
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, MACHINE_DATA_DIR: root, MACHINE_PORT: String(port), MACHINE_SYMPHONY_DISPATCH: '1', MACHINE_LAYER_TEMPLATES_ENABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', chunk => serverLog += chunk); server.stderr.on('data', chunk => serverLog += chunk);
const portal = `http://aludel.localhost:${port}`, errors = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/home/henry/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome' });
try {
 for (const deadline=Date.now()+60000; !/listening|http:\/\//i.test(serverLog)&&Date.now()<deadline;) await new Promise(r=>setTimeout(r,100));
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 assert.ok((await context.request.post(`${portal}/api/sign-in`,{data:{email:'owner@example.com',password}})).ok());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const dest='test-results/task-create/';mkdirSync(dest,{recursive:true});
 const createUrl=`${portal}/p/${project.slug}/code/tasks/create`;
 const shot=async name=>page.screenshot({path:dest+name+'.png',fullPage:false});
 const open=async()=>{await page.goto(createUrl);await page.getByRole('dialog',{name:'Create task',exact:true}).waitFor();};
 await open();
 await page.setViewportSize({width:1280,height:600});
 for(let i=0;i<8;i++) await page.getByRole('button',{name:'Add criterion',exact:true}).click();
 const geometry=await page.evaluate(()=>{const content=document.querySelector('.wc-content'),footer=document.querySelector('.wc-footer').getBoundingClientRect();return {scrolls:content.scrollHeight>content.clientHeight,footerBottom:footer.bottom,viewport:innerHeight};});
 assert.ok(geometry.scrolls,'Short desktop body must scroll');assert.ok(geometry.footerBottom<=geometry.viewport,'Footer must remain inside the short viewport');
 await shot('07-short-desktop');
 for(let i=8;i>0;i--) await page.getByRole('button',{name:`Remove criterion ${i}`,exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});await shot('01-blank');
 await page.getByLabel('Title',{exact:true}).fill('A new member signs up and sets up their first world.');
 await page.getByLabel('Description',{exact:true}).fill('Keep the request easy to review.');
 await page.getByLabel('Assignee',{exact:true}).selectOption({label:'You'});await page.getByLabel('Priority',{exact:true}).selectOption('high');await shot('02-request');
 await page.getByRole('button',{name:'Minimize draft'}).click();await page.getByRole('button',{name:/Resume/}).click();
 assert.equal(await page.getByLabel('Description',{exact:true}).inputValue(),'Keep the request easy to review.');
 await page.reload();await page.getByRole('dialog',{name:'Create task'}).waitFor();assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'A new member signs up and sets up their first world.');
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.waitForURL(/\/work\/item\//);
 const plain=items().find(e=>e.title==='A new member signs up and sets up their first world.');assert.deepEqual(plain.checks,[]);assert.equal(plain.context.suggestion,'Keep the request easy to review.');assert.equal(plain.priority,'high');assert.equal(plain.assignee.id,owner.id);
 await open();await page.getByLabel('Title',{exact:true}).fill('Improve invitations on both sides');
 await page.getByRole('button',{name:'Add criterion',exact:true}).click();await page.getByLabel('Criterion 1',{exact:true}).fill('Invitation errors explain how to retry.');
 await page.getByRole('button',{name:'Attach journey',exact:true}).click();await page.getByLabel('Search journeys',{exact:true}).fill('zzz');await page.getByText('No matching journeys',{exact:true}).waitFor();
 await page.getByLabel('Search journeys',{exact:true}).fill('');await page.getByLabel('Send invitation',{exact:true}).check();await page.getByLabel('Accept invitation',{exact:true}).check();await page.getByRole('button',{name:'Attach steps',exact:true}).click();
 await page.getByRole('button',{name:'Add criterion',exact:true}).click();await page.getByRole('button',{name:'Remove criterion 2',exact:true}).click();
 await shot('03-multiple-journeys');
 await page.route('**/api/projects/*/work',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Disposable simulated save failure'})}));
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('alert').filter({hasText:'Your draft is intact'}).waitFor();await shot('04-save-failure');
 assert.equal(await page.getByLabel('Criterion 1',{exact:true}).inputValue(),'Invitation errors explain how to retry.');
 await page.unroute('**/api/projects/*/work');
 await page.getByRole('button',{name:'Close composer'}).click();await page.getByText('Discard this draft?',{exact:true}).waitFor();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await shot('05-phone');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Attach journey',exact:true}).click();await page.getByLabel('Search journeys',{exact:true}).waitFor();await shot('06-phone-picker');await page.keyboard.press('Escape');
 await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js','utf8'));
 assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document.querySelector('.wc-composer'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))),[]);
 await page.setViewportSize({width:1440,height:1000});await page.keyboard.press('Control+Enter');await page.waitForURL(/\/work\/item\//);
 const linked=items().find(e=>e.title==='Improve invitations on both sides');assert.deepEqual(linked.checks.filter(c=>c.kind==='journey').map(c=>[c.journey,c.revision,c.steps]),[['send-invite',2,['send']],['receive-invite',1,['accept']]]);assert.equal(linked.checks.find(c=>c.kind==='note').text,'Invitation errors explain how to retry.');
 const stale=await context.request.post(`${portal}/api/projects/${projectId}/work`,{data:{layer:'platform',title:'Stale attachment',checks:[],claims:[{id:'stale',kind:'journey',journey:'send-invite',revision:1,steps:['send']}]}});assert.equal(stale.status(),409);
 await open();await page.getByLabel('Title',{exact:true}).fill('Agent-assigned Code request');
 await page.getByLabel('Assignee',{exact:true}).selectOption(`agent:${agentProfile.id}`);
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.waitForURL(/\/work\/item\//);
 const agentTask=items().find(e=>e.title==='Agent-assigned Code request');assert.equal(agentTask.scope,'layer');assert.equal(agentTask.action,null);
 const stage=page.getByRole('button',{name:/Stage in .*batch/});await stage.waitFor();assert.equal(await stage.isEnabled(),true,'Layer-scoped agent task must be stageable without a legacy action');
 await stage.click();await page.getByRole('button',{name:'Unstage',exact:true}).waitFor();
 assert.ok(items().find(e=>e.id===agentTask.id).context.batch,'Server accepted staging into a draft agent batch');
 await shot('08-agent-staged');
 assert.equal(db.withProject(projectId, () => db.prepare("SELECT count(*) AS n FROM symphony_attempts").get().n),0,'Staging must not launch a model turn');
 await page.getByRole('button',{name:'Unstage',exact:true}).click();
 // An ineligible profile must still be blocked, with an accurate message rather than a legacy design label.
 await page.route('**/api/projects/*/knowledge',async route=>{const response=await route.fetch();const body=await response.json();body.knowledge.symphonyProfiles=[];await route.fulfill({response,json:body});});
 await page.reload();await page.getByText('This agent is not enabled for Symphony work. Check Work › Agents.',{exact:true}).first().waitFor();
 assert.equal(await page.getByRole('button',{name:/Stage in .*batch/}).isEnabled(),false,'Ineligible profiles remain blocked');
 assert.deepEqual(errors,[]);console.log('Task composer: direct creation, persisted draft, metadata, criteria, sender/recipient attachments, failed-save preservation, dirty close, keyboard, stale revisions, 390px, short desktop scroll/footer, agent creation/staging without Go, ineligible-profile guard, and axe passed.');
} finally {
 await browser.close();server.kill();if(server.exitCode===null && server.signalCode===null)await new Promise(resolve=>server.once('exit',resolve));db.close();rmSync(root,{recursive:true,force:true});
}
