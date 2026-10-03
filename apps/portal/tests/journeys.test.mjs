// JOURNEYS-01 J1: the journey contract's pure core, on a Pages-flow replica, an observed onboarding journey specified to a
// second revision, a design-kit token and a real generated app.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { claimAt, claimGate, claimProof, claimsFromCriteria, claimText, coverage, implementClaims, journeyChange, reviewSteps, standing, undeclaredSeams, validateClaims, validateJourney, validateReviewRecipe, validateSeams, nextNoteId } from '../server/journeys.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { loadScaffoldSources, skeletonFiles } from '../server/scaffold.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';

const cases = JSON.parse(readFileSync(new URL('./fixtures/journey-cases.json', import.meta.url), 'utf8'));
const copy = value => structuredClone(value);
const refuses = (fn, pattern) => assert.throws(fn, error => pattern.test(error.message), `expected ${pattern}`);

test('journeys validate as authored, observed or replica, with unique stable step IDs', () => {
  for (const journey of [cases.replica, cases.onboarding, cases.onboardingSpecified]) assert.equal(validateJourney(copy(journey)).id, journey.id);
  const duplicate = copy(cases.onboarding); duplicate.steps[1].id = 'sign-up';
  refuses(() => validateJourney(duplicate), /unique lowercase ID/);
  const orphan = copy(cases.replica); delete orphan.source;
  refuses(() => validateJourney(orphan), /only a replica names its source/);
  const claimed = copy(cases.onboarding); claimed.source = cases.replica.source;
  refuses(() => validateJourney(claimed), /only a replica names its source/);
  const offsite = copy(cases.onboarding); offsite.steps[0].route = '//evil.example/signup';
  refuses(() => validateJourney(offsite), /local path/);
  const loose = copy(cases.onboarding); loose.steps[0].test = 'tests/onboarding.js';
  refuses(() => validateJourney(loose), /spec\.mjs#/);
});

test('a revision is compared by step ID: added, changed, removed and unchanged steps', () => {
  assert.deepEqual(journeyChange(copy(cases.onboarding), copy(cases.onboardingSpecified)), {
    journey: 'onboarding', from: 1, to: 2, added: ['team'], changed: ['dashboard'], removed: ['welcome', 'tour'], unchanged: ['sign-up', 'verify'] });
  // Only the proof moved: a step's test is not part of its spec.
  const retested = copy(cases.onboarding); retested.revision = 2; retested.steps[2].test = 'onboarding.spec.mjs#welcome-v2';
  assert.deepEqual(journeyChange(copy(cases.onboarding), retested).changed, []);
  const skipped = copy(cases.onboardingSpecified); skipped.revision = 3;
  refuses(() => journeyChange(copy(cases.onboarding), skipped), /one revision at a time/);
  assert.deepEqual(journeyChange(null, copy(cases.replica)).added, ['marketing', 'signup', 'setup', 'world']);
});

test('the v2 recipe maps personas to fixtures; Codex\'s v1 criterion-indexed scenarios are refused', () => {
  assert.equal(validateReviewRecipe(copy(cases.recipe)).version, 2);
  refuses(() => validateReviewRecipe(copy(cases.codexV1Recipe)), /v1 scenarios are retired/);
  refuses(() => validateReviewRecipe({ ...copy(cases.recipe), scenarios: [] }), /v1 scenarios are retired/);
  refuses(() => validateReviewRecipe({ ...copy(cases.recipe), personas: { author: { fixture: 'Post V2' } } }), /fixture ID/);
  refuses(() => validateReviewRecipe({ ...copy(cases.recipe), checks: [{ name: 'Shell', command: 'npm test' }] }), /argument array/);
});

test('review steps come from journeys: personas, resets and ordering are derived, and unavailable steps say why', () => {
  const steps = reviewSteps(copy(cases.recipe), [copy(cases.replica), copy(cases.onboardingSpecified)]);
  assert.deepEqual(steps.map(step => [step.id, step.persona, step.fixture, step.session, step.reset, step.after]), [
    ['first-world.marketing', 'visitor', 'empty', null, true, null],
    ['first-world.signup', 'newcomer', 'fresh', null, false, 'first-world.marketing'],
    ['first-world.setup', 'newcomer', 'fresh', null, false, 'first-world.signup'],
    ['first-world.world', 'member', 'populated', 'member', false, 'first-world.setup'],
    ['onboarding.sign-up', 'newcomer', 'fresh', null, true, null],
    ['onboarding.verify', 'newcomer', 'fresh', null, false, 'onboarding.sign-up'],
    ['onboarding.team', 'newcomer', 'fresh', null, false, 'onboarding.verify'],
    ['onboarding.dashboard', 'newcomer', 'fresh', null, false, 'onboarding.team']]);
  assert.ok(steps.every(step => step.available));
  // The defect this replaces: reordering steps must not re-point a review button. IDs follow the step, not its position.
  const reordered = copy(cases.replica); reordered.steps.reverse();
  const byId = new Map(reviewSteps(copy(cases.recipe), [reordered]).map(step => [step.id, step.path]));
  assert.equal(byId.get('first-world.signup'), '/signup');
  const unready = copy(cases.onboardingSpecified); delete unready.steps[2].route; unready.steps[3].persona = 'admin';
  const [, , team, dashboard] = reviewSteps(copy(cases.recipe), [unready]);
  assert.deepEqual([team.available, team.reason], [false, 'This step has no route in the app yet.']);
  assert.deepEqual([dashboard.available, dashboard.reason], [false, 'No fixture is declared for persona admin.']);
});

test('coverage reports each step as passed, failed, untested or uncovered, and whether its persona has a fixture', () => {
  const result = coverage(copy(cases.onboardingSpecified), { 'onboarding.spec.mjs#sign-up': 'passed', 'onboarding.spec.mjs#verify': 'failed' }, copy(cases.recipe));
  assert.deepEqual(result.steps.map(step => [step.step, step.status, step.fixture]), [['sign-up', 'passed', true], ['verify', 'failed', true], ['team', 'uncovered', true], ['dashboard', 'untested', true]]);
  assert.deepEqual([result.passed, result.failed, result.uncovered, result.untested, result.proven], [1, 1, 1, 1, false]);
  const all = Object.fromEntries(cases.replica.steps.filter(step => step.test).map(step => [step.test, 'passed']));
  assert.equal(coverage(copy(cases.replica), all).proven, false, 'the world step has no test yet');
});

test('standing is general: an observed journey and an observed design-kit token are hypotheses until proven at the head', () => {
  for (const entry of [cases.onboarding, cases.token]) {
    assert.equal(standing(entry, 'a1b2c3d'), 'observed');
    assert.equal(standing(entry, 'e4f5a6b'), 'hypothesis', 'proven at an older commit');
    assert.equal(standing({ ...entry, proof: { ...entry.proof, status: 'failed' } }, 'a1b2c3d'), 'hypothesis');
    assert.equal(standing({ ...entry, origin: 'authored' }, 'e4f5a6b'), 'authored');
  }
  assert.equal(standing(cases.replica, 'a1b2c3d'), 'replica');
});

test('claims reference layers where they can; free text is an unbacked note', () => {
  const claims = validateClaims([
    { id: 'onboarding-steps', kind: 'journey', journey: 'onboarding', revision: 2, steps: ['team'] },
    { id: 'copy', kind: 'record', layer: 'pages', entry: 'page-signup', revision: 4 },
    { id: 'fast', kind: 'invariant', text: 'Sign-up responds within 300 ms.' },
    { id: 'tone', kind: 'note', text: 'It should feel welcoming.' }]);
  assert.deepEqual(claims.map(claim => claim.backed), [true, true, true, false]);
  refuses(() => validateClaims([{ id: 'a', kind: 'journey', journey: 'onboarding', revision: 2, steps: [] }]), /names a journey/);
  refuses(() => validateClaims([{ id: 'a', kind: 'note', text: 'x' }, { id: 'a', kind: 'note', text: 'y' }]), /unique/);
  refuses(() => validateClaims([{ id: 'a', kind: 'criterion', text: 'x' }]), /journey, record, invariant or note/);
  assert.deepEqual(claimsFromCriteria(['Signup works', 'Tour removed']).map(claim => [claim.id, claim.kind, claim.backed]), [['note-1', 'note', false], ['note-2', 'note', false]]);
  refuses(() => validateClaims([{ id: 'a', kind: 'note', text: 'x', covers: 'journeys' }]), /only an invariant covers/);
});

test('J4: criteria pinned before claims read by position as the IDs the migration gives them', () => {
  const legacy = [{ text: 'Signup works', verdict: null }, { text: 'Tour removed', verdict: 'accept' }];
  assert.deepEqual(legacy.map(claimAt).map(claim => [claim.id, claim.kind, claim.backed, claim.verdict]), [['note-1', 'note', false, null], ['note-2', 'note', false, 'accept']]);
  assert.deepEqual(legacy.map(claimAt).map(claim => claim.id), claimsFromCriteria(legacy.map(claim => claim.text)).map(claim => claim.id));
  // A stored claim keeps its own ID and kind wherever it sits.
  const claim = claimAt({ id: 'onboarding-steps', kind: 'journey', journey: 'onboarding', revision: 2, steps: ['team'] }, 5);
  assert.deepEqual([claim.id, claim.backed, claimText(claim)], ['onboarding-steps', true, 'Journey onboarding at revision 2: step team']);
  assert.equal(nextNoteId(new Set(['note-1', 'note-3'])), 'note-2');
});

test('J4: a journey claim is proven by its steps on a build at the claimed revision', () => {
  const { claims } = implementClaims(copy(cases.onboarding), copy(cases.onboardingSpecified));
  const [steps, , unchanged] = claims;
  const built = { journeys: [copy(cases.onboardingSpecified), copy(cases.replica)] };
  const result = (id, status) => ({ id, status, detail: status === 'failed' ? 'expected the team form' : null, screenshot: status !== 'uncovered' });
  const replicaSteps = cases.replica.steps.map(step => result(`${cases.replica.id}.${step.id}`, 'passed'));
  const passing = [...['sign-up', 'verify', 'team', 'dashboard'].map(step => result(`onboarding.${step}`, 'passed')), ...replicaSteps];
  assert.deepEqual(claimProof(steps, { ...built, results: passing }).steps.map(step => step.status), ['passed', 'passed']);
  assert.equal(claimProof(steps, { ...built, results: passing }).status, 'passed');
  assert.equal(claimProof(unchanged, { ...built, results: passing }, claims).status, 'passed');
  // A failing claimed step fails the claim, not the invariant; a failing unclaimed step fails the invariant.
  const failing = passing.map(entry => entry.id === 'onboarding.team' ? result(entry.id, 'failed') : entry);
  const failed = claimProof(steps, { ...built, results: failing });
  assert.deepEqual([failed.status, failed.steps[0].detail], ['failed', 'expected the team form']);
  assert.equal(claimProof(unchanged, { ...built, results: failing }, claims).status, 'passed');
  const regressed = passing.map(entry => entry.id === replicaSteps[0].id ? result(entry.id, 'failed') : entry);
  assert.equal(claimProof(unchanged, { ...built, results: regressed }, claims).status, 'failed');
  // No test for a claimed step, no build at all, the journey still at revision 1, or the journey gone.
  assert.equal(claimProof(steps, { ...built, results: passing.map(entry => entry.id === 'onboarding.dashboard' ? result(entry.id, 'uncovered') : entry) }).status, 'uncovered');
  assert.equal(claimProof(steps, {}).status, 'not-run');
  assert.match(claimProof(steps, { journeys: [copy(cases.onboarding)], results: passing }).detail, /revision 1; this claim is for revision 2/);
  assert.equal(claimProof(steps, { journeys: [copy(cases.replica)], results: replicaSteps }).status, 'missing');
  assert.equal(claimProof({ id: 'tone', kind: 'note', text: 'Welcoming' }, { ...built, results: passing }), null);
  // The gate names every claim whose proof isn't passing, with a person's stated reason where one was given.
  const proofs = { [steps.id]: failed, [unchanged.id]: claimProof(unchanged, { ...built, results: failing }, claims), tone: null };
  assert.deepEqual(claimGate([...claims, { id: 'tone', kind: 'note', text: 'Welcoming' }], proofs, { [steps.id]: 'The team form ships next week.' }),
    [{ claim: steps.id, text: claimText(steps), status: 'failed', reason: 'The team form ships next week.' }]);
});

test('accepting a Specify item raises implement claims for the added and changed steps', () => {
  const { claims } = implementClaims(copy(cases.onboarding), copy(cases.onboardingSpecified));
  assert.deepEqual(claims.map(claim => [claim.id, claim.kind, claim.steps ?? claim.text]), [
    ['onboarding-steps', 'journey', ['team', 'dashboard']],
    ['onboarding-removed', 'invariant', 'Steps welcome, tour of New user onboarding are no longer part of the journey.'],
    ['journeys-unchanged', 'invariant', 'Every other journey still passes its tests, as do unchanged steps sign-up, verify of New user onboarding.']]);
});

function generatedApp() {
  const configDirectory = new URL('../config', import.meta.url).pathname;
  const catalogs = loadCatalogs(configDirectory);
  const gitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(join(configDirectory, 'project-setup.json'), 'utf8')));
  const root = mkdtempSync(join(tmpdir(), 'aludel-journeys-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use. No buying needed.' });
  const { project } = flows.claimDraft(token, ada, ada);
  const setup = { ...flows.projectSetup(ada, project.id), data: { objects: [], operations: [] }, agents: know.agentExport(project.id) };
  const { files } = skeletonFiles(setup, catalogs, gitProfile, { portal: 'http://aludel.localhost', app: 'http://tool-share.localhost' }, [], loadScaffoldSources(new URL('..', import.meta.url).pathname));
  return Object.entries(files).map(([path, text]) => ({ path, text: typeof text === 'string' ? text : '' }));
}

test('separability: every place a generated app names Aludel outside .aludel/ is a declared seam', () => {
  const files = generatedApp();
  const seams = validateSeams(copy(cases.generatedSeams));
  assert.deepEqual(undeclaredSeams(files, seams), [], 'the fixture lists exactly the generated app\'s seams');
  assert.deepEqual(undeclaredSeams(files, { version: 1, seams: [] }).length, seams.seams.length, 'and every declared seam is real');
  // An agent adds an Aludel coupling without declaring it.
  assert.deepEqual(undeclaredSeams([...files, { path: 'src/aludel-telemetry.ts', text: 'export {}' }, { path: 'src/feature.ts', text: "fetch('/api/__aludel/review')" }], seams),
    ['src/aludel-telemetry.ts', 'src/feature.ts']);
  // J3: the generated app declares those seams itself, carries a v2 recipe, and nothing it runs reads .aludel/.
  const file = path => files.find(entry => entry.path === path).text;
  assert.deepEqual(JSON.parse(file('.aludel/seams.json')), cases.generatedSeams);
  assert.equal(validateReviewRecipe(JSON.parse(file('.aludel/review.json'))).version, 2);
  assert.doesNotMatch(file('Dockerfile'), /\.aludel/, 'the runtime image copies nothing from .aludel/');
  assert.match(file('.dockerignore'), /^\.aludel$/m, 'and the build never sees it, so every preview build is a build without .aludel/');
  assert.doesNotMatch(file('server/server.mjs'), /\.aludel\//, 'the app reads no recipe at runtime');
  refuses(() => validateSeams({ version: 1, seams: [{ path: '.aludel/review.json', kind: 'file', purpose: 'x', remove: 'y' }] }), /inside \.aludel/);
  refuses(() => validateSeams({ version: 1, seams: [{ path: '../outside', kind: 'file', purpose: 'x', remove: 'y' }] }), /relative path/);
});

// J2: the Code template keeps its own copy of the journey contract (template code imports nothing). Both must accept and
// refuse the same journeys, so this checks the pinned template's indexer against the host's contract.
const templates = JSON.parse(readFileSync(new URL('../config/layer-templates.json', import.meta.url), 'utf8'));
const templateRepo = new URL(`../../../${templates.repo}`, import.meta.url).pathname;
test('the pinned Code template accepts and refuses journeys as the host contract does', { skip: !existsSync(templateRepo) && 'no local layer-base' }, async () => {
  const source = execFileSync('git', ['-C', templateRepo, 'show', `${templates.templates.code.commit}:server/code-index.mjs`], { encoding: 'utf8' });
  const file = join(mkdtempSync(join(tmpdir(), 'aludel-code-index-')), 'code-index.mjs');
  writeFileSync(file, source);
  const { entries } = await import(file);
  const index = journey => entries({ 'outputs/journeys.json': JSON.stringify({ journeys: [journey] }) })[0];
  const valid = [cases.replica, cases.onboarding, cases.onboardingSpecified].map(copy);
  for (const journey of valid) {
    const entry = index(journey);
    assert.equal(entry.id, `journey-${journey.id}`);
    assert.equal(validateJourney(entry.data).id, journey.id, 'what the template stores is a valid host journey');
  }
  const variants = [
    journey => { journey.steps[1].id = journey.steps[0].id; },
    journey => { journey.source = { layer: 'pages', entry: 'x', revision: 1 }; },
    journey => { journey.steps[0].route = '//evil.example'; },
    journey => { journey.steps[0].test = 'tests/onboarding.js'; },
    journey => { journey.revision = 0; },
    journey => { journey.origin = 'imported'; },
    journey => { journey.steps = []; }];
  for (const change of variants) {
    const journey = copy(cases.onboarding); change(journey);
    assert.throws(() => validateJourney(copy(journey)), 'the host refuses');
    assert.throws(() => index(journey), 'and so does the template');
  }
});
