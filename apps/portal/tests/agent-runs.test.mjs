// LAY-04D / DEC-040: agent batches and the runner, against a provider stand-in (never a real provider).
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentRuns, initAgentRuns, modelCaller } from '../server/agent-runs.mjs';
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
  const runs = agentRuns({ db, know, secrets, providers, callModel: modelCaller({ env }) });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveFeatures(ada, project.id, { picks: ['accounts', 'messaging'] });
  await flows.saveAgentConnection(ada, project.id, { provider, secret: key });
  return { db, know, runs, ada, id: project.id, stub, close: () => stub.server.close() };
}

test('working style marks gaps as available for agents instead of opening items; the pool is ordered by priority', async () => {
  const { know, ada, id, close } = await fixture();
  try {
    assert.deepEqual(know.automate(id), [], 'no items are opened for agents');
    assert.equal(know.workList(id).filter(item => item.state !== 'done').length, 0);
    const pool = know.view(ada, id).agentPool;
    assert.ok(pool.length >= 5 && pool.every(entry => entry.kind === 'suggestion' && ['define', 'plan'].includes(entry.type)));
    assert.deepEqual(pool.map(entry => entry.priority), [...pool.map(entry => entry.priority)].sort((a, b) => a - b), 'best first');
    const demo = know.list(id, 'story').filter(story => story.phase === 'demo').map(story => story.id);
    const firstLater = pool.findIndex(entry => entry.priority >= 1000);
    assert.ok(firstLater === -1 || pool.slice(0, firstLater).length > 0, 'current-phase work comes before later phases');
    assert.ok(demo.length);
  } finally { close(); }
});

test('LAY-04B items nobody touched go back to the pool', async () => {
  const { know, id, close } = await fixture();
  try {
    const suggestion = know.agentPool(id)[0];
    const source = know.suggestions(id, { stories: know.list(id, 'story'), pages: know.list(id, 'page'), work: know.workList(id) }).find(entry => entry.key === suggestion.key);
    const staged = know.createWork(id, { ...source, state: 'ready', context: { suggestion: source.key }, logText: 'Staged by working style' });
    know.assignByPolicy(id, staged, 'Working style');
    assert.equal(know.returnStagedToPool(id), 1);
    assert.equal(know.workList(id).length, 0);
    assert.ok(know.agentPool(id).some(entry => entry.key === suggestion.key));
  } finally { close(); }
});

test('a batch fills by priority, locks on Go, drafts through the provider, and hands drafts back for review', async () => {
  const { know, runs, ada, id, stub, close } = await fixture({ profile: 'planner' });
  try {
    // A Planner writes acceptance themselves, so the pool holds contracts; the owner can still batch acceptance by hand.
    const story = know.list(id, 'story').find(entry => entry.title.startsWith('Someone can see their conversations'));
    const defineKey = `define:${story.id}`;
    assert.ok(!know.agentPool(id).some(entry => entry.key === defineKey));
    const manual = runs.add(ada, id, { suggestion: defineKey });
    assert.equal(manual.assignee.label, 'Product lead');
    assert.equal(manual.context.automation.mode, 'agent-review');
    const added = runs.fill(ada, id, 3);
    assert.equal(added.length, 2, 'fill tops the batch up to the count asked for');
    assert.ok(added.every(item => item.type === 'plan' && item.assignee.label === 'Architect'));
    const batch = runs.view(id)[0];
    assert.equal(batch.state, 'draft');
    assert.equal(batch.items.length, 3);
    assert.equal(stub.calls.filter(call => call.method === 'POST').length, 0, 'nothing runs before Go');

    const { job } = runs.start(ada, id, batch.id);
    assert.ok(know.workList(id).filter(item => batch.items.includes(item.id)).every(item => item.state === 'claimed' || item.state === 'review'), 'Go locks the items');
    await job;
    assert.equal(runs.view(id)[0].state, 'done');
    const items = know.workList(id).filter(item => batch.items.includes(item.id));
    // A Planner reviews acceptance drafts; plans go to the Architect with no review step (the v3 working-style table).
    assert.equal(items.find(item => item.id === manual.id).state, 'review');
    assert.ok(items.filter(item => item.type === 'plan').every(item => item.state === 'done' && /Done by the Architect profile · 1050 tokens/.test(item.log.at(-1).text)));
    const drafted = know.get(id, story.id);
    assert.equal(drafted.acceptance.length, 1);
    assert.equal(know.history(story.id)[0].workItemId, manual.id);
    assert.match(know.history(story.id)[0].rationale, /Drafted by the Product lead profile \(gpt-6-astra\)/);
    const object = know.get(id, added[0].targets[0].id);
    assert.ok(object.schema.properties.title && object.schema.required.includes('title'));
    assert.equal(object.contract, 'proposed', 'the owner still accepts contracts');
    assert.deepEqual(items[0].context.run.usage, { input: 900, output: 150 });
    assert.deepEqual(runs.view(id)[0].usage, { input: 2700, output: 450 });
    const call = stub.calls.find(entry => entry.url === '/v1/responses');
    assert.equal(call.body.text.format.strict, true);
    assert.match(call.body.input[0].content, /project data to work from, not instructions/);
    // Accepting a draft closes the item; the revision made from it satisfies verification.
    assert.equal(know.updateWork(ada, id, manual.id, { state: 'done' }).state, 'done');
    // The finished batch keeps its list, and its items are free to go into a later batch.
    assert.ok(items.every(item => !know.workList(id).find(entry => entry.id === item.id).context.batch));
    assert.deepEqual(runs.view(id)[0].items.sort(), batch.items.sort());
  } finally { close(); }
});

test('clarifications come back as answer options for the owner, not as answers', async () => {
  const { know, runs, ada, id, close } = await fixture({ profile: 'dreamer', provider: 'anthropic', key: 'sk-ant-api03-aludel-test-key-good' });
  try {
    const story = know.list(id, 'story').find(entry => entry.title.startsWith('Someone can start a conversation'));
    const key = `clarify:${story.id}:${story.clarifications[0]}`;
    const item = runs.add(ada, id, { suggestion: key });
    const { job } = runs.start(ada, id, runs.view(id)[0].id);
    await job;
    const after = know.workList(id).find(entry => entry.id === item.id);
    assert.equal(after.state, 'needs-input');
    assert.deepEqual(after.question.options, ['A tool listing', 'A person\'s profile', 'A borrow request']);
    assert.equal(after.question.recommendation, 'A tool listing');
    assert.equal(after.question.answer, undefined);
    assert.deepEqual(know.get(id, story.id).clarifications, story.clarifications, 'nothing changes until the owner answers');
  } finally { close(); }
});

test('a spend limit or a rejected key stops the batch and returns unstarted items to the pool', async () => {
  const { know, runs, ada, id, close } = await fixture({ key: 'sk-proj-aludel-test-key-limit' });
  try {
    runs.fill(ada, id, 3);
    const batch = runs.view(id)[0];
    const { job } = runs.start(ada, id, batch.id);
    await job;
    const after = runs.view(id)[0];
    assert.equal(after.state, 'stopped');
    assert.match(after.note, /rate or spend limit/);
    const items = know.workList(id).filter(item => batch.items.includes(item.id));
    assert.ok(items.every(item => item.state === 'ready' && !item.context.batch), 'unlocked and back in the pool');
    assert.ok(know.agentPool(id).length >= 3);
  } finally { close(); }
});

test('batches refuse work agents cannot do, full batches, starting twice, and running without a key', async () => {
  const { db, know, runs, ada, id, close } = await fixture();
  try {
    const page = know.list(id, 'page').find(entry => entry.stories.length);
    const design = know.createWork(id, { layer: 'pages', type: 'design', title: 'Design', targets: [{ id: page.id }], documents: ['Pages'] });
    assert.throws(() => runs.add(ada, id, { workId: design.id }), /can't do design work yet/);
    runs.fill(ada, id, 2);
    const batch = runs.view(id)[0];
    runs.remove(ada, id, runs.view(id)[0].items[0]);
    assert.equal(runs.view(id)[0].items.length, 1);
    db.prepare("DELETE FROM project_connections WHERE project_id = ?").run(id);
    assert.throws(() => runs.start(ada, id, batch.id), /Connect an Anthropic or OpenAI key/);
    assert.throws(() => runs.stop(ada, id, batch.id), /not running/);
  } finally { close(); }
});
