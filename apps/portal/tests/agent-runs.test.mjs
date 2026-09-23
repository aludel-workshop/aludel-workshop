// LAY-04D / DEC-040, revised by WORK-UX-01: per-assignee batches and the runner, against a provider stand-in (never a real provider).
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns, modelCaller, modelLister } from '../server/agent-runs.mjs';
import { initCodeLinks } from '../server/code-links.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { startProviderStub } from './provider-stub.mjs';

const catalogs = loadCatalogs(new URL('../config', import.meta.url).pathname);
const providers = catalogs.agentProviders.providers;

async function fixture({ profile = 'dreamer', provider = 'openai', key = 'sk-proj-aludel-test-key-good' } = {}) {
  const stub = await startProviderStub();
  const env = { MACHINE_OPENAI_API_URL: stub.url, MACHINE_ANTHROPIC_API_URL: stub.url };
  const root = mkdtempSync(join(tmpdir(), 'aludel-runs-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initCodeLinks(db); initAgentRuns(db);
  const secrets = openSecretStore(root);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets, workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know,
    checkAgentKey: async () => ({ ok: true }) });
  const runs = agentRuns({ db, know, secrets, providers, callModel: modelCaller({ env }), listModels: modelLister({ env }) });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveFeatures(ada, project.id, { picks: ['accounts', 'messaging'] });
  await flows.saveAgentConnection(ada, project.id, { provider, secret: key });
  know.syncBacklog(project.id);
  return { db, know, runs, ada, id: project.id, stub, env, secrets, close: () => { stub.server.closeAllConnections(); stub.server.close(); } };
}


const backlog = (know, id, action, match = () => true) => know.workList(id).find(item => item.action === action && item.state === 'suggested' && match(item));
// Queue a backlog item, then stage it, as the board's two buttons do.
function queueAndStage(know, runs, ada, id, item) {
  know.updateWork(ada, id, item.id, { state: 'ready' });
  return runs.stage(ada, id, item.id);
}
const idle = ms => new Promise(resolve => setTimeout(resolve, ms));

test('staging puts agent work in its profile\'s batch and people\'s work in their list; blocked and unrunnable work stays out', async () => {
  const { know, runs, ada, id, close } = await fixture({ profile: 'dreamer' });
  try {
    const define = backlog(know, id, 'product.define');
    assert.equal(define.assignee.kind, 'agent', 'a Dreamer hands acceptance to the default agent');
    assert.throws(() => runs.stage(ada, id, define.id), /Queue W-\d+ before staging/);
    const staged = queueAndStage(know, runs, ada, id, define);
    const batch = runs.view(id)[0];
    assert.equal(staged.status, 'staged');
    assert.equal(staged.context.batch, batch.id);
    assert.equal(batch.profileId, define.assignee.id);
    assert.equal(batch.state, 'draft');

    // A person's own work goes in their list; nothing runs it.
    const configure = know.createWork(id, { layer: 'platform', type: 'configure', title: 'Choose an email provider', documents: ['Platform › email'] });
    assert.equal(configure.assignee.id, ada.id);
    const mine = runs.stage(ada, id, configure.id);
    assert.equal(mine.status, 'staged'); assert.equal(mine.context.staged, true); assert.equal(mine.context.batch, undefined);
    assert.equal(runs.unstage(ada, id, configure.id).status, 'queued');

    // Agents can't run page designs yet; a blocked item can't be staged at all.
    const design = backlog(know, id, 'pages.design');
    know.updateWork(ada, id, design.id, { state: 'ready' });
    assert.throws(() => runs.stage(ada, id, design.id), /Agents can't run “Design pages” yet/);
    const contract = backlog(know, id, 'data.contract');
    know.updateWork(ada, id, contract.id, { state: 'ready' });
    know.updateWork(ada, id, configure.id, { blocks: [contract.id] });
    assert.throws(() => runs.stage(ada, id, contract.id), error => error.status === 409 && /blocked by W-\d+/.test(error.message));
    know.updateWork(ada, id, configure.id, { blocks: [] });

    // Reassigning a staged item moves it to the new assignee's batch.
    const careful = know.insert(id, 'agent_profile', { name: 'Careful architect', effort: 'high' });
    const moved = runs.reassign(ada, id, define.id, { kind: 'agent', id: careful.id });
    assert.equal(moved.status, 'staged');
    assert.notEqual(moved.context.batch, batch.id);
    assert.equal(runs.view(id).find(entry => entry.id === moved.context.batch).profileId, careful.id);
    const toMe = runs.reassign(ada, id, define.id, { kind: 'person', id: ada.id });
    assert.equal(toMe.context.staged, true, 'to a person: into their list');
  } finally { close(); }
});

test('Go locks the batch, drafts with the profile\'s model, effort and output limit, and drafts wait in the batch for review', async () => {
  const { know, runs, ada, id, stub, close } = await fixture({ profile: 'dreamer' });
  try {
    const agent = know.defaultProfile(id);
    know.update(id, agent.id, { effort: 'high', limits: { ...agent.limits, itemOutput: 5000 } }, { rationale: 'Thorough' });
    const define = backlog(know, id, 'product.define', item => item.targets[0].label.startsWith('Someone can see their conversations'));
    const contract = backlog(know, id, 'data.contract');
    queueAndStage(know, runs, ada, id, define);
    queueAndStage(know, runs, ada, id, contract);
    const batch = runs.view(id)[0];
    assert.equal(stub.calls.filter(call => call.method === 'POST').length, 0, 'nothing runs before Go');
    const { job } = runs.start(ada, id, batch.id);
    assert.throws(() => runs.unstage(ada, id, contract.id), /locked in while its batch runs/);
    assert.throws(() => runs.reassign(ada, id, contract.id, { kind: 'person', id: ada.id }), /locked in/);
    await job;
    assert.equal(runs.view(id)[0].state, 'done');
    const items = know.workList(id).filter(item => [define.id, contract.id].includes(item.id));
    assert.ok(items.every(item => item.status === 'review' && item.context.batch === batch.id), 'drafts stay in their batch until cleared');
    const call = stub.calls.find(entry => entry.url === '/v1/responses');
    assert.equal(call.body.model, 'gpt-6-astra');
    assert.equal(call.body.max_output_tokens, 5000);
    assert.deepEqual(call.body.reasoning, { effort: 'high' });
    assert.match(call.body.input[0].content, /Product lead instructions:/);
    assert.match(call.body.input[0].content, /Instructions for "Write acceptance"/);
    assert.match(call.body.input[0].content, /project data to work from, not instructions/);
    assert.match(call.body.input[1].content, /Your draft will be reviewed against/);
    const drafted = items.find(item => item.id === define.id);
    assert.equal(drafted.instructions.action.key, 'product.define', 'instructions were pinned when the run started');
    assert.deepEqual(drafted.context.run.usage, { input: 900, output: 150 });
    assert.equal(drafted.context.run.phase, drafted.context.run.phases.length);
    assert.ok(drafted.checks.every(check => check.source.revision >= 2), 'each check points at the revision under review');
    assert.deepEqual(runs.view(id)[0].usage, { input: 1800, output: 300 });
    assert.match(know.history(drafted.targets[0].id)[0].rationale, /Drafted by Default agent \(gpt-6-astra\)/);
    const changes = know.workChanges(id, drafted.id);
    assert.equal(changes.length, 1);
    assert.ok(changes[0].fields.some(field => field.field === 'acceptance'));

    // Clearing: accepting needs every check accepted; sending back needs a rejected check with a note.
    assert.throws(() => know.updateWork(ada, id, drafted.id, { state: 'done' }), /Accept every check/);
    drafted.checks.forEach((check, index) => know.updateWork(ada, id, drafted.id, { verdict: { index, value: 'accept' } }));
    assert.equal(know.updateWork(ada, id, drafted.id, { state: 'done' }).state, 'done');
    const other = items.find(item => item.id === contract.id);
    know.updateWork(ada, id, other.id, { verdict: { index: 0, value: 'reject' } });
    assert.throws(() => know.updateWork(ada, id, other.id, { sendBack: true }), /Say what is wrong/);
    know.updateWork(ada, id, other.id, { verdict: { index: 0, value: 'reject', note: 'Add who lends it' } });
    const back = know.updateWork(ada, id, other.id, { sendBack: true });
    assert.equal(back.status, 'queued');
    assert.deepEqual(back.context.feedback.map(entry => entry.note), ['Add who lends it']);
    runs.stage(ada, id, other.id);
    await runs.start(ada, id, runs.view(id)[0].id).job;
    const retry = stub.calls.filter(entry => entry.url === '/v1/responses').at(-1);
    assert.match(retry.body.input[1].content, /Your last draft was sent back[\s\S]*Add who lends it/);
  } finally { close(); }
});

test('clarifications come back as answer options; answering applies the answer and clears the item', async () => {
  const { know, runs, ada, id, stub, close } = await fixture({ profile: 'dreamer', provider: 'anthropic', key: 'sk-ant-api03-aludel-test-key-good' });
  try {
    const clarify = backlog(know, id, 'product.clarify', item => item.targets[0].label.startsWith('Someone can start a conversation'));
    queueAndStage(know, runs, ada, id, clarify);
    await runs.start(ada, id, runs.view(id)[0].id).job;
    const after = know.workById(id, clarify.id);
    assert.equal(after.status, 'needs');
    assert.deepEqual(after.question.options, ['A tool listing', 'A person\'s profile', 'A borrow request']);
    assert.equal(after.question.recommendation, 'A tool listing');
    const call = stub.calls.find(entry => entry.url.startsWith('/v1/messages'));
    assert.equal(call.body.model, 'claude-opus-5');
    assert.equal(call.body.output_config.effort, 'medium');
    assert.equal(call.body.max_tokens, 8000);
    const story = know.get(id, clarify.targets[0].id);
    assert.deepEqual(story.clarifications.includes(clarify.question.text), true, 'nothing changes until the owner answers');
    const answered = know.updateWork(ada, id, clarify.id, { answer: 'A tool listing', rationale: 'Most talk is about one tool' });
    assert.equal(answered.state, 'done');
    assert.ok(!know.get(id, story.id).clarifications.includes(clarify.question.text));
  } finally { close(); }
});

test('a spend limit or a rejected key stops the batch; unfinished work stays staged in the next batch', async () => {
  const { know, runs, ada, id, close } = await fixture({ key: 'sk-proj-aludel-test-key-limit' });
  try {
    const items = [backlog(know, id, 'product.define'), backlog(know, id, 'data.contract')];
    for (const item of items) queueAndStage(know, runs, ada, id, item);
    const batch = runs.view(id)[0];
    await runs.start(ada, id, batch.id).job;
    const after = runs.view(id).find(entry => entry.id === batch.id);
    assert.equal(after.state, 'stopped');
    assert.match(after.note, /rate or spend limit/);
    const next = runs.view(id).find(entry => entry.state === 'draft');
    const now = know.workList(id).filter(item => items.some(entry => entry.id === item.id));
    assert.ok(now.every(item => item.status === 'staged' && item.context.batch === next.id), 'still staged, in the next batch');
  } finally { close(); }
});

test('usage limits stop a run before the next item and refuse Go once the month\'s budget is spent', async () => {
  const { know, runs, ada, id, close } = await fixture({ profile: 'dreamer' });
  try {
    const agent = know.defaultProfile(id);
    know.update(id, agent.id, { limits: { ...agent.limits, batchTokens: 1000 } }, { rationale: 'Small runs' });
    const items = [backlog(know, id, 'product.define'), backlog(know, id, 'data.contract')];
    for (const item of items) queueAndStage(know, runs, ada, id, item);
    const batch = runs.view(id)[0];
    await runs.start(ada, id, batch.id).job;
    const after = runs.view(id).find(entry => entry.id === batch.id);
    assert.equal(after.state, 'stopped');
    assert.match(after.note, /limit per batch \(1,000 tokens\)/);
    assert.equal(know.workList(id).filter(item => item.status === 'review').length, 1, 'one item ran, the next waited');
    know.update(id, agent.id, { limits: { ...agent.limits, batchTokens: 200000, monthlyTokens: 1000 } }, { rationale: 'Tight month' });
    assert.throws(() => runs.start(ada, id, runs.view(id).find(entry => entry.state === 'draft').id), /monthly limit \(1,000 tokens\)/);
    assert.equal(runs.usage(id, { profileId: agent.id }), 1050);
  } finally { close(); }
});

test('while a batch runs, a waiting item can be skipped and the working item stopped; both stay staged', async () => {
  const { know, runs, ada, id, stub, close } = await fixture({ profile: 'dreamer', key: 'sk-proj-aludel-test-key-slow' });
  try {
    const items = [backlog(know, id, 'product.define'), backlog(know, id, 'data.contract')];
    know.updateWork(ada, id, items[0].id, { priority: 'highest' });
    for (const item of items) queueAndStage(know, runs, ada, id, item);
    const { job } = runs.start(ada, id, runs.view(id)[0].id);
    await idle(100);
    const working = know.workList(id).find(item => item.id === items[0].id);
    assert.equal(working.status, 'working', 'highest priority first');
    assert.ok(working.context.run.phase >= 1 && working.context.run.activity);
    assert.throws(() => runs.skip(ada, id, items[0].id), /stop it instead/);
    runs.skip(ada, id, items[1].id);
    runs.stopItem(ada, id, items[0].id);
    await job;
    const after = know.workList(id).filter(item => items.some(entry => entry.id === item.id));
    assert.ok(after.every(item => item.status === 'staged' && !item.context.skip), 'both wait in the next batch');
    assert.match(after.find(item => item.id === items[0].id).log.map(entry => entry.text).join('\n'), /Stopped by you/);
    assert.equal(stub.calls.filter(call => call.method === 'POST').length, 1, 'the skipped item was never sent');
  } finally { close(); }
});

test('models are listed from the connected key for the profile\'s model picker', async () => {
  const openai = await fixture();
  try {
    const listed = await openai.runs.models(openai.id);
    assert.deepEqual(listed.models.map(model => model.id), ['o4-mini', 'gpt-6-astra-mini', 'gpt-6-astra'], 'chat models only');
    assert.equal(listed.defaultModel, 'gpt-6-astra');
  } finally { openai.close(); }
  const anthropic = await fixture({ provider: 'anthropic', key: 'sk-ant-api03-aludel-test-key-good' });
  try {
    const listed = await anthropic.runs.models(anthropic.id);
    assert.deepEqual(listed.models, [{ id: 'claude-opus-5', label: 'Claude Opus 5' }, { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }]);
  } finally { anthropic.close(); }
});

test('a restart keeps unfinished staged work staged', async () => {
  const { db, know, runs, ada, id, secrets, env, close } = await fixture({ profile: 'dreamer', key: 'sk-proj-aludel-test-key-slow' });
  try {
    const item = backlog(know, id, 'product.define');
    queueAndStage(know, runs, ada, id, item);
    const { batch } = runs.start(ada, id, runs.view(id)[0].id);
    assert.equal(batch.state, 'running');
    const restarted = agentRuns({ db, know, secrets, providers, callModel: modelCaller({ env }) });
    const after = know.workById(id, item.id);
    assert.equal(restarted.view(id).find(entry => entry.id === batch.id).state, 'stopped');
    assert.equal(after.status, 'staged');
    assert.notEqual(after.context.batch, batch.id);
    await idle(1700);
  } finally { close(); }
});
