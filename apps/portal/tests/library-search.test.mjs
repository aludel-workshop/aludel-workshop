// W-10: everything is in the Library, and its search is the only search. Body text of every layer's records, each
// layer's Knowledge as its tab lists it (repository docs included), and work items with their threads are found, the
// thing a query names comes first, and the index keeps up with changes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { agentWork, initAgentWork } from '../server/agent-work.mjs';
import { editorBridge } from '../server/editor-bridge.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initLayerApi, initSourceReviews } from '../server/layer-api.mjs';
import { initLayerContract } from '../server/layer-contract.mjs';
import { layerDocs } from '../server/layer-docs.mjs';
import { initLayerFiles } from '../server/layer-files.mjs';
import { installLayerPackageInto } from '../server/layer-package.mjs';
import { createMarkdownDefinition } from '../server/layer-registry.mjs';
import { initLayerSource } from '../server/layer-source.mjs';
import { library } from '../server/library.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { initPagesLayerApp } from '../server/pages-layer-app.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const portalRoot = new URL('..', import.meta.url).pathname;
const catalogs = loadCatalogs(join(portalRoot, 'config'));
const identity = { GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'dev@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'dev@example.com' };
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, ...identity } }).trim();

function fixture(run, { templates = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1' } = {}) {
  const data = mkdtempSync(join(tmpdir(), 'aludel-library-search-'));
  const old = { dir: process.env.MACHINE_DATA_DIR, on: process.env.MACHINE_LAYER_TEMPLATES_ENABLED };
  process.env.MACHINE_DATA_DIR = data;
  if (templates) process.env.MACHINE_LAYER_TEMPLATES_ENABLED = '1';
  try {
    const db = openDatabase(join(data, 'machine.sqlite'));
    initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db); initPagesLayerApp(db); initLayerApi(db); initAgentWork(db);
    const know = knowledge({ db, catalogs, packs: catalogs.packs });
    const flows = onboarding({ db, catalogs, secrets: openSecretStore(data), workspaceRoot: join(data, 'w'), assetRoot: join(data, 'a'), createWorkspace: () => {}, know });
    const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
    const { token } = flows.saveDraft(null, { profile: 'planner' });
    flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use.' });
    const { project } = flows.claimDraft(token, ada, ada);
    initLayerContract(db);
    know.ensurePlan(project.id); know.ensureDesign(project.id);
    run({ db, know, ada, id: project.id, data, pool: library({ db, know }) });
    db.close();
  } finally {
    rmSync(data, { recursive: true, force: true });
    for (const [name, value] of [['MACHINE_DATA_DIR', old.dir], ['MACHINE_LAYER_TEMPLATES_ENABLED', old.on]]) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}
const refs = (pool, id, user, q, options = {}) => pool.search(id, user, { q, ...options }).results.map(entry => entry.ref);

test('W-10: the body text of every layer\'s records is found, including kinds the old search skipped', () => fixture(({ know, ada, id, pool }) => {
  const created = {
    vision_section: know.insert(id, 'vision_section', { key: 'statement', body: 'Borrowing should feel like asking a quokka next door.' }),
    persona: know.insert(id, 'persona', { name: 'Rosa', role: 'Lender', note: 'Keeps her xylophone collection in the shed.' }),
    flow: know.insert(id, 'flow', { title: 'Borrow a drill', steps: [{ name: 'Arrange pickup', why: 'They agree on a marmalade jar as thanks.' }] }),
    brand_asset: know.insert(id, 'brand_asset', { name: 'Voice', type: 'text', text: 'Warm, plain, a little gondola.' }),
  };
  for (const [kind, word] of [['vision_section', 'quokka'], ['persona', 'xylophone'], ['flow', 'marmalade'], ['brand_asset', 'gondola']]) {
    const found = pool.search(id, ada.id, { q: word }).results;
    assert.deepEqual(found.map(entry => [entry.ref, entry.kind, entry.source]), [[created[kind].id, kind, 'output']], `${kind} is found by its body text`);
    assert.match(found[0].excerpt, new RegExp(word, 'i'));
  }
  const tokens = know.list(id, 'design_tokens')[0];
  assert.ok(tokens, 'the design layer keeps a token set');
  const palette = tokens.palettes?.[0]?.name;
  if (palette) assert.ok(refs(pool, id, ada.id, palette).includes(tokens.id), 'a token set is found by a palette name');

  // The index keeps up: a changed note is found by its new words and no longer by the old ones.
  know.update(id, created.persona.id, { name: 'Rosa', role: 'Lender', note: 'Lends a theodolite to surveyors.' }, { expectedRevision: created.persona.revision });
  assert.deepEqual(refs(pool, id, ada.id, 'theodolite'), [created.persona.id]);
  assert.deepEqual(refs(pool, id, ada.id, 'xylophone'), []);
  // Typing finds as you go: the last word is a prefix.
  assert.ok(refs(pool, id, ada.id, 'theodo').includes(created.persona.id));
}));

test('W-10: work items are in the Library with their brief, actions and thread, and read like any entry', () => fixture(({ db, know, ada, id, pool }) => {
  const work = agentWork({ db, know });
  const draft = work.createGoal(ada, id, { title: 'Lend a ladder', brief: 'Borrowers need a sturdy stepladder for gutters.' });
  const agent = { kind: 'agent', id: ada.id, name: "Ada's local agent" };
  work.define(agent, id, draft.item.id, { brief: 'Borrowers need a sturdy stepladder for gutters.', actions: [{ goal: 'Spec the ladder page' }] });
  work.post(agent, id, draft.item.id, { action: 1, text: 'The hinge squeaks on the second rung.' });

  const thread = pool.search(id, ada.id, { q: 'hinge squeaks' }).results;
  assert.deepEqual(thread.map(entry => [entry.ref, entry.source, entry.layer.key, entry.kind]), [[draft.item.id, 'work', 'work', 'work_item']]);
  assert.equal(thread[0].heading, 'Thread', 'the match is in the thread');
  assert.equal(refs(pool, id, ada.id, 'stepladder')[0], draft.item.id, 'and in the brief');
  assert.equal(refs(pool, id, ada.id, draft.item.ref)[0], draft.item.id, 'its W-number names it');
  assert.ok(pool.search(id, ada.id, { source: 'work' }).results.every(entry => entry.source === 'work'));

  const read = pool.read(id, ada.id, draft.item.id);
  assert.equal(read.source, 'work');
  assert.match(read.content, /hinge squeaks/);
  assert.match(read.content, /Spec the ladder page/);
  assert.throws(() => pool.read(id, ada.id, draft.item.id, 1), { status: 404 }, 'items keep no revisions');
}));

test('W-10: the Library holds every installed output and every Knowledge doc its layer\'s tab lists', () => fixture(({ db, know, ada, id, pool }) => {
  const installed = db.prepare(`SELECT d.layer_key AS key, d.output_kinds_json AS outputs FROM layer_definitions d JOIN layer_instances i ON i.project_id = d.project_id AND i.layer_key = d.layer_key
    WHERE d.project_id = ? AND i.enabled = 1`).all(id).map(row => ({ key: row.key, outputs: JSON.parse(row.outputs) }));
  for (const layer of installed) for (const kind of layer.outputs) {
    const owners = installed.filter(other => other.outputs.includes(kind)).length;
    const records = know.list(id, kind);
    if (owners !== 1 || !records.length) continue;
    const listed = new Set(pool.search(id, ada.id, { kind, limit: 100 }).results.map(entry => entry.ref));
    for (const record of records) assert.ok(listed.has(record.id), `${kind} ${record.id} is in the Library`);
  }
  const docs = layerDocs({ db });
  for (const layer of installed) {
    let tab;
    try { tab = docs.list(id, ada.id, layer.key).docs.filter(doc => doc.exists !== false); } catch { continue; } // stored Knowledge (no repository)
    const listed = new Set(pool.search(id, ada.id, { layer: layer.key, source: 'knowledge', limit: 100 }).results.map(entry => entry.ref));
    for (const doc of tab) assert.ok(listed.has(`k:${layer.key}:${doc.path}`), `${layer.key} Knowledge ${doc.path} is in the Library`);
  }
}));

test('W-10: repository docs are in the Library, and the doc a query names comes first', () => fixture(({ db, ada, id, data, pool }) => {
  initLayerSource(db); initSourceReviews(db); initLayerFiles(db);
  createMarkdownDefinition(db, ada.id, id, { name: 'Notes', template: 'base' });
  const repo = join(data, 'app');
  mkdirSync(join(repo, 'docs/design/process'), { recursive: true });
  git(data, 'init', '-q', '-b', 'main', repo);
  writeFileSync(join(repo, 'AGENTS.md'), '# Agent guide\n\nRead the [current status](docs/status.md) and follow [the operating procedure](docs/design/process/operating-procedure.md). DEC-062 moved layers to GitHub.\n');
  writeFileSync(join(repo, 'docs/status.md'), '---\nid: status-001\nkind: project-status\n---\n\n# Current project status\n\n## Next action\n\nCOLLAB-WORK-01.\n');
  writeFileSync(join(repo, 'docs/decisions.md'), `# Decision inbox\n\n## Confirmed\n\n${Array.from({ length: 30 }, (_, n) => `2026-09-${String(n % 28 + 1).padStart(2, '0')} — **DEC-${String(n + 30).padStart(3, '0')}: decision ${n}.** Text.\n`).join('\n')}\n2026-10-01 — **DEC-062: the layer-template candidate becomes main.** The owner, in chat.\n`);
  writeFileSync(join(repo, 'docs/design/process/operating-procedure.md'), '---\nid: process-operation-001\n---\n\n# From request to the next justified action\n\n## 1. Establish the task\n\nStart with the work record.\n');
  writeFileSync(join(repo, 'docs/design/handoff.md'), '# Handoff\n\nThe status of DEC-062 status status. See the operating procedure for status updates.\n');
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'Docs');
  installLayerPackageInto(db, id, 'notes', repo, { template: 'base', replace: true });
  const manifest = JSON.parse(readFileSync(join(repo, '.aludel/layer.json'), 'utf8'));
  manifest.knowledge.docs = { map: 'AGENTS.md', paths: ['docs/'] };
  writeFileSync(join(repo, '.aludel/layer.json'), JSON.stringify(manifest, null, 2) + '\n');
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'Notes names the docs');
  db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'notes'").run(git(repo, 'rev-parse', 'HEAD'), id);

  const top = q => pool.search(id, ada.id, { q }).results[0];
  assert.equal(top('status').ref, 'k:notes:/docs/status.md', 'status names docs/status.md');
  assert.equal(top('operating procedure').ref, 'k:notes:/docs/design/process/operating-procedure.md', 'its file name, though its title differs');
  const decision = top('DEC-062');
  assert.equal(decision.ref, 'k:notes:/docs/decisions.md', 'the doc that defines DEC-062, ahead of docs that cite it');
  assert.equal(decision.heading, 'Confirmed');
  assert.equal(decision.anchor, 'confirmed');
  assert.match(decision.excerpt, /DEC-062: the layer-template/);
  assert.ok(refs(pool, id, ada.id, 'DEC-062').includes('k:notes:/AGENTS.md'), 'citations are found too, after it');
  assert.ok(refs(pool, id, ada.id, 'COLLAB-WORK-01').includes('k:notes:/docs/status.md'), 'body text below a heading is found');
  assert.deepEqual(refs(pool, id, ada.id, 'status-001'), [], 'front matter is not text');

  // Read like any entry; the revision counts the commits that changed the doc, and an older one reads as it was.
  const status = pool.read(id, ada.id, 'k:notes:/docs/status.md');
  assert.equal(status.revision, 1);
  assert.match(status.content, /COLLAB-WORK-01/);
  writeFileSync(join(repo, 'docs/status.md'), '# Current project status\n\n## Next action\n\nEX-02A.\n');
  git(repo, 'commit', '-q', '-am', 'Next');
  db.prepare("UPDATE layer_package_bindings SET accepted_commit = ? WHERE project_id = ? AND layer_key = 'notes'").run(git(repo, 'rev-parse', 'HEAD'), id);
  assert.equal(pool.read(id, ada.id, 'k:notes:/docs/status.md').currentRevision, 2);
  assert.match(pool.read(id, ada.id, 'k:notes:/docs/status.md', 1).content, /COLLAB-WORK-01/);
  assert.deepEqual(refs(pool, id, ada.id, 'EX-02A'), ['k:notes:/docs/status.md'], 'a moved pin re-reads the docs');

  // Agents search the same pool through search_knowledge and read what it finds through read_record.
  const bridge = editorBridge({ db, know: null, pool, projectSetup: () => ({}), previewStatus: () => ({}) });
  const found = bridge.search(id, 'operating procedure');
  assert.equal(found[0].id, 'k:notes:/docs/design/process/operating-procedure.md');
  assert.equal(found[0].path, '/docs/design/process/operating-procedure.md');
}, { templates: true }));

// The rule, checked: nothing keeps its own text search over a copy of the knowledge. Pickers and navigation filters
// (a file tree, the token and icon pickers, the journey picker, a layer's information tree) filter what is on screen.
test('W-10: only the Library searches', () => {
  const allowed = new Set(['src/layers/code.ts', 'src/layers/design-tokens.ts', 'src/layers/layer-manage.ts', 'src/layers/work-create.ts', 'src/layers/layer-knowledge.ts']);
  const files = dir => readdirSync(join(portalRoot, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
  const own = [...files('server'), ...files('src')].filter(path => /\.(mjs|ts)$/.test(path) && path !== 'server/library.mjs' && !allowed.has(path))
    .filter(path => /\.includes\((needle|term|q|query)\)/.test(readFileSync(join(portalRoot, path), 'utf8')));
  assert.deepEqual(own, []);
  // The one exception inside Knowledge is its information tree; its docs come from the Library.
  assert.match(readFileSync(join(portalRoot, 'src/layers/layer-knowledge.ts'), 'utf8'), /librarySearch\(\{ q, layer: key, source: 'knowledge'/);
});
