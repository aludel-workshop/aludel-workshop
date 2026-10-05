// The Code layer's indexer and rules: units come from the host, releases round-trip through their file, and the release
// rules keep the compiled layer's messages.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { entries, fromEntries, journeyEntryId, normalize } from '../server/code-index.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const files = releases => ({ 'outputs/releases.json': JSON.stringify({ releases }) });
const unit = { id: 'cu-0123456789ab', key: 'server/server.mjs#listTools', path: 'server/server.mjs', symbol: 'listTools', kind: 'handler', hash: 'abc', line: 3, end: 9, reachable: true, calls: [] };
const release = (id, version, commit = 'a1b2c3d') => ({ 'x-aludel-id': id, version, commit, notes: '', createdBy: 'Ada', createdAt: '2026-10-01T00:00:00.000Z' });

test('the current files index, with units from the host', () => {
  const current = { 'outputs/releases.json': read('outputs/releases.json'), 'outputs/journeys.json': read('outputs/journeys.json') };
  assert.deepEqual(entries(current), []);
  const listed = entries(files([release('crl-00000001', '0.1.0')]), { units: [unit] });
  assert.deepEqual(listed.map(entry => [entry.id, entry.kind, entry.title]), [['cu-0123456789ab', 'code_unit', 'listTools · server/server.mjs'], ['crl-00000001', 'code_release', 'v0.1.0']]);
  assert.equal(listed[0].data.reachable, true);
});

test('releases round-trip; units are never written', () => {
  const before = files([release('crl-00000001', '0.1.0'), release('crl-00000002', '0.2.0')]);
  const listed = entries(before, { units: [unit] });
  const after = fromEntries(listed, { files: before });
  assert.deepEqual(Object.keys(after), ['outputs/releases.json']);
  assert.deepEqual(entries(after, { units: [unit] }), listed);
  assert.throws(() => normalize('code_unit', unit), /read from the repository/);
});

test('release rules keep their messages; a release names no stories', () => {
  assert.throws(() => normalize('code_release', { version: '1.2', commit: 'a1b2c3d' }), /^Error: Use a version like 1\.2\.3\.$/);
  assert.equal(normalize('code_release', { version: 'v1.2.3', commit: 'a1b2c3d' }).data.version, '1.2.3');
  assert.throws(() => entries(files([release('crl-00000001', '0.2.0'), release('crl-00000002', '0.1.0')])), /^Error: The version must be newer than v0\.2\.0\.$/);
  assert.throws(() => entries(files([release('crl-00000001', '0.2.0'), release('crl-00000002', '0.2.0')])), /already recorded/);
  const old = normalize('code_release', { version: '0.1.0', commit: 'a1b2c3d', stories: ['st-borrow'] });
  assert.deepEqual([old.references, 'stories' in old.data], [[], false], 'a release recorded with stories keeps none');
  assert.throws(() => normalize('trace_link', {}), /Unknown Code output trace_link/);
});

test('starter docs: only missing files, cited from Library entries, and AGENTS.md maps them', async () => {
  const { seed } = await import('../server/code-index.mjs');
  const entries = [
    { ref: 'st-1', kind: 'story', revision: 2, title: 'Sign up', data: { number: 1, title: 'Someone can sign up', why: 'To borrow', acceptance: [{ given: 'a visitor', when: 'they sign up', then: 'they are in' }] } },
    { ref: 'pe-1', kind: 'persona', revision: 1, title: 'Lender', data: { name: 'Lena', role: 'Lender', note: '' } },
    { ref: 'do-1', kind: 'data_object', revision: 3, title: 'Account', data: { name: 'Account', description: 'A person', schema: { properties: { email: { type: 'string' } }, required: ['email'] } } }
  ];
  const tree = ['README.md', 'AGENTS.md', 'docs/design/DESIGN.md', 'src/main.ts', 'server/server.mjs'];
  const { files } = seed('install', { project: { name: 'Tool Share' }, entries, tree, existing: { 'AGENTS.md': '# Tool Share\n\n## Where to look\n\n- `README.md`: what it is\n' } });
  assert.ok(!files['docs/design/DESIGN.md'], 'an existing doc is never written');
  assert.match(files['docs/product/stories.md'], /\*\*S1\/1\*\* Given a visitor, when they sign up, then they are in\./);
  assert.match(files['ARCHITECTURE.md'], /\*\*Web app\*\* \(`src\/`\)/);
  const sidecar = JSON.parse(files['.aludel/doc-sources.json']);
  assert.deepEqual(sidecar['docs/product/stories.md']['S1 Someone can sign up'], [['story', 'st-1', 2]]);
  assert.deepEqual(sidecar['ARCHITECTURE.md'].Data, [['data_object', 'do-1', 3]]);
  assert.match(files['AGENTS.md'], /- `README.md`: what it is\n- `ARCHITECTURE.md`/, 'the map gains the new docs');
  assert.deepEqual(seed('look', {}).files, {});
});

// JOURNEYS-01: journeys are written in the repository (by Work, a person or an agent) with no Aludel IDs.
const onboarding = { version: 1, id: 'onboarding', title: 'New user onboarding', origin: 'observed', revision: 1, persona: 'newcomer', proof: { commit: 'a1b2c3d', status: 'passed' },
  steps: [{ id: 'sign-up', name: 'Sign up', route: '/signup', trigger: 'Opens the sign-up page', expected: 'Enters email and password', test: 'onboarding.spec.mjs#sign-up' },
    { id: 'dashboard', name: 'Dashboard', route: '/app', trigger: 'Signs up', expected: 'Lands on an empty dashboard' }] };
const replica = { version: 1, id: 'first-world', title: 'Start a first world', origin: 'replica', revision: 3, source: { layer: 'pages', entry: 'flow-first-world', revision: 3 },
  steps: [{ id: 'signup', name: 'Sign up', route: '/signup', persona: 'newcomer', trigger: 'Chooses Start', expected: 'Creates an account' }] };
const journeyFile = list => ({ 'outputs/journeys.json': JSON.stringify({ journeys: list }) });

test('journeys index with IDs from their own, and round-trip without Aludel IDs', () => {
  const listed = entries(journeyFile([onboarding, replica]));
  assert.deepEqual(listed.map(entry => [entry.id, entry.kind, entry.title]), [['journey-onboarding', 'journey', 'New user onboarding'], ['journey-first-world', 'journey', 'Start a first world']]);
  assert.equal(journeyEntryId('onboarding'), 'journey-onboarding');
  const written = fromEntries(listed, { files: journeyFile([onboarding, replica]) });
  const stored = JSON.parse(written['outputs/journeys.json']).journeys;
  assert.deepEqual(stored.map(item => item.id), ['first-world', 'onboarding'], 'written in a stable order');
  assert.ok(stored.every(item => !('x-aludel-id' in item)));
  assert.deepEqual(entries(written).sort((a, b) => a.id.localeCompare(b.id)), [...listed].sort((a, b) => a.id.localeCompare(b.id)));
  // A journey created through the host gets a host ID, which is kept.
  const created = fromEntries([{ id: 'jr-0123456789ab', kind: 'journey', data: normalize('journey', { ...onboarding, id: 'checkout' }).data }], { files: {} });
  assert.equal(JSON.parse(created['outputs/journeys.json']).journeys[0]['x-aludel-id'], 'jr-0123456789ab');
  assert.deepEqual(normalize('journey', onboarding).references, []);
});

test('journey rules: unique stable step IDs, replicas name a source, local routes and named tests', () => {
  const broken = (change, pattern) => assert.throws(() => entries(journeyFile([{ ...structuredClone(onboarding), ...change }])), pattern);
  broken({ steps: [onboarding.steps[0], { ...onboarding.steps[1], id: 'sign-up' }] }, /unique lowercase ID/);
  broken({ origin: 'replica' }, /only a replica names its source/);
  broken({ steps: [{ ...onboarding.steps[0], route: '//evil.example' }] }, /local path/);
  broken({ steps: [{ ...onboarding.steps[0], test: 'tests/onboarding.js' }] }, /spec\.mjs#/);
  broken({ proof: { commit: 'main', status: 'passed' } }, /a proof names a commit/);
  broken({ revision: 0 }, /revision from 1/);
  broken({ steps: [onboarding.steps[0], { ...onboarding.steps[0], id: 'invite', persona: 'admin' }] }, /keeps one persona/);
  broken({ persona: undefined, steps: [{ ...onboarding.steps[0], persona: 'owner' }, { ...onboarding.steps[1], persona: 'member' }] }, /keeps one persona/);
  assert.equal(entries(journeyFile([{ ...structuredClone(onboarding), steps: onboarding.steps.map(step => ({ ...step, persona: 'newcomer' })) }])).length, 1, 'a step may repeat the journey persona');
  assert.throws(() => entries(journeyFile([onboarding, onboarding])), /recorded twice/);
});
