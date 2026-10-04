// JOURNEYS-01 J1: the journey contract's pure core, on a Pages-flow replica, an observed onboarding journey specified to a
// second revision, a design-kit token and a real generated app.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { claimAt, claimGate, claimProof, claimsFromCriteria, claimText, coverage, implementClaims, journeyChange, journeyOffer, matchRoutes, reviewableGaps, repositoryAppChanged, reviewSteps, specifyClaims, standing, undeclaredSeams, validateClaims, validateJourney, validateReviewRecipe, validateSeams, nextNoteId } from '../server/journeys.mjs';
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
  // J6: one persona per journey. A step may repeat the journey's persona, never name another; a flow that crosses roles is two journeys.
  const restated = copy(cases.replica); restated.steps[0].persona = 'newcomer';
  assert.equal(validateJourney(restated).id, 'first-world');
  const crossing = copy(cases.replica); crossing.steps[3].persona = 'member';
  refuses(() => validateJourney(crossing), /entered as member, but the journey is newcomer's/);
  const stepsOnly = copy(cases.onboarding); delete stepsOnly.persona; stepsOnly.steps[0].persona = 'newcomer'; stepsOnly.steps[1].persona = 'member';
  refuses(() => validateJourney(stepsOnly), /keeps one persona/);
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
    ['first-world.marketing', 'newcomer', 'fresh', null, true, null],
    ['first-world.signup', 'newcomer', 'fresh', null, false, 'first-world.marketing'],
    ['first-world.setup', 'newcomer', 'fresh', null, false, 'first-world.signup'],
    ['first-world.world', 'newcomer', 'fresh', null, false, 'first-world.setup'],
    ['onboarding.sign-up', 'newcomer', 'fresh', null, true, null],
    ['onboarding.verify', 'newcomer', 'fresh', null, false, 'onboarding.sign-up'],
    ['onboarding.team', 'newcomer', 'fresh', null, false, 'onboarding.verify'],
    ['onboarding.dashboard', 'newcomer', 'fresh', null, false, 'onboarding.team']]);
  assert.ok(steps.every(step => step.available));
  // The defect this replaces: reordering steps must not re-point a review button. IDs follow the step, not its position.
  const reordered = copy(cases.replica); reordered.steps.reverse();
  const byId = new Map(reviewSteps(copy(cases.recipe), [reordered]).map(step => [step.id, step.path]));
  assert.equal(byId.get('first-world.signup'), '/signup');
  const unready = copy(cases.onboardingSpecified); delete unready.steps[2].route; unready.persona = 'admin';
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
    ['journeys-unchanged', 'invariant', 'Every other journey still passes its tests, as do steps sign-up, verify of New user onboarding.']]);
});

test('J5: a journey drafted from the current app claims only the steps the accepted build does not pass', () => {
  const drafted = { ...copy(cases.onboardingSpecified), revision: 1 };
  const passed = id => ({ id: `onboarding.${id}`, status: 'passed' });
  // New journey: its characterized steps passed on the accepted build, so only the new team step is claimed.
  const fresh = implementClaims(null, drafted, [passed('sign-up'), passed('verify'), passed('dashboard'), { id: 'onboarding.team', status: 'uncovered' }]);
  assert.deepEqual(fresh.claims.map(claim => [claim.id, claim.steps ?? claim.text]), [['onboarding-steps', ['team']],
    ['journeys-unchanged', 'Every other journey still passes its tests, as do steps sign-up, verify, dashboard of New user onboarding.']]);
  assert.deepEqual(fresh.change.built, ['sign-up', 'verify', 'dashboard']);
  // A changed step is claimed even when its old test still passes: that test proves the old spec.
  const revised = implementClaims(copy(cases.onboarding), copy(cases.onboardingSpecified), [passed('sign-up'), passed('verify'), passed('dashboard'), passed('team')]);
  assert.deepEqual(revised.claims[0].steps, ['dashboard']);
  // Claimed steps keep the journey's order, whichever way they were found.
  assert.deepEqual(implementClaims(null, drafted, []).claims[0].steps, ['sign-up', 'verify', 'team', 'dashboard']);
});

test('J5: the offer matches a request to routes and offers to draft or revise a journey first', () => {
  const journeys = [copy(cases.onboarding)];
  const routes = ['/', '/settings', '/settings/billing', '/team/:id', '/app'];
  assert.deepEqual(matchRoutes('Let people invite their teams from /settings', routes), ['/settings', '/settings/billing', '/team/:id']);
  assert.deepEqual(matchRoutes('Fix the typo in the footer', routes), [], 'no route: a trivial change gets no offer');
  assert.deepEqual(matchRoutes('Add a /pricing page', routes), ['/pricing'], 'a path the app does not have yet still counts');
  const draft = journeyOffer({ title: 'Invite teammates', brief: 'From /settings, invite people by email.' }, { routes, journeys });
  assert.deepEqual([draft.offer.kind, draft.offer.journey, draft.offer.routes], ['draft', { id: 'invite-teammates', title: 'Invite teammates', revision: 1 }, ['/settings', '/settings/billing', '/team/:id']]);
  const revise = journeyOffer({ title: 'Shorten sign up', brief: 'Drop the verify step after /signup.' }, { routes, journeys });
  assert.deepEqual([revise.offer.kind, revise.offer.journey, revise.uncovered], ['revise', { id: 'onboarding', title: 'New user onboarding', revision: 2 }, []]);
  assert.equal(journeyOffer({ title: 'Fix the footer typo' }, { routes, journeys }).offer, null);
  // A drafted ID never takes an existing journey's.
  assert.equal(journeyOffer({ title: 'Onboarding', brief: 'A new /welcome-back page' }, { routes, journeys }).offer.journey.id, 'onboarding-2');
});

test('J5: Specify claims the journey at its next revision, proven only when the build holds it authored', () => {
  const [spec, unchanged] = specifyClaims({ id: 'onboarding', revision: 2 });
  assert.deepEqual([spec.kind, spec.layer, spec.entry, spec.revision, unchanged.covers], ['record', 'platform', 'journey-onboarding', 2, 'journeys']);
  assert.equal(claimProof(spec, { journeys: null, results: [] }).status, 'not-run');
  assert.equal(claimProof(spec, { journeys: [copy(cases.onboardingSpecified)], results: [] }).status, 'passed');
  assert.match(claimProof(spec, { journeys: [copy(cases.onboarding)], results: [] }).detail, /revision 1; this claim is for revision 2/);
  assert.equal(claimProof(spec, { journeys: [{ ...copy(cases.onboardingSpecified), origin: 'observed' }], results: [] }).status, 'unsigned');
  assert.equal(claimProof(spec, { journeys: [copy(cases.replica)], results: [] }).status, 'missing');
  // A record claim on another layer has no automated proof: the reviewer judges it.
  assert.equal(claimProof({ id: 'x', kind: 'record', layer: 'data', entry: 'object-1', revision: 2 }, { journeys: [], results: [] }), null);
  assert.deepEqual(claimGate([spec], { 'journey-spec': claimProof(spec, { journeys: [copy(cases.onboarding)], results: [] }) }).map(entry => entry.status), ['stale']);
});

test('J5: an app is reviewable with a v2 recipe, a fixture per persona and the setup route', () => {
  assert.deepEqual(reviewableGaps({ recipe: copy(cases.recipe), personas: Object.keys(cases.recipe.personas), setup: true }), []);
  assert.deepEqual(reviewableGaps({ recipe: null, setup: false }).map(gap => gap.id), ['review-recipe', 'setup-route']);
  assert.deepEqual(reviewableGaps({ recipe: copy(cases.recipe), personas: ['auditor'], setup: true }).map(gap => [gap.id, gap.kind]), [['persona-auditor', 'invariant']]);
  assert.match(reviewableGaps({ recipeError: 'Review recipes need version 2.', setup: true })[0].text, /readable as version 2 \(now: Review recipes need version 2\.\)/);
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
    journey => { journey.steps = []; },
    journey => { journey.steps[1].persona = 'member'; }];
  for (const change of variants) {
    const journey = copy(cases.onboarding); change(journey);
    assert.throws(() => validateJourney(copy(journey)), 'the host refuses');
    assert.throws(() => index(journey), 'and so does the template');
  }
});


test('empty journey registry bootstrap needs no app recipe; substantive review and app changes still do', () => {
  const seed = { path: '.aludel/outputs/journeys.json', status: 'added', diff: 'diff --git a/x b/x\n--- /dev/null\n+++ b/x\n@@ -0,0 +1,3 @@\n+{\n+  "journeys": []\n+}\n' };
  const changed = (...files) => repositoryAppChanged({ files }, '.aludel/');
  assert.equal(changed(seed, { path: '.aludel/ui/code.ts' }), false);
  assert.equal(changed({ ...seed, diff: seed.diff.replace('[]', '[{"id":"signup"}]') }), true);
  assert.equal(changed({ ...seed, status: 'modified' }), true);
  assert.equal(changed({ ...seed, status: 'deleted' }), true);
  assert.equal(changed({ ...seed, diff: undefined }), true);
  assert.equal(changed({ ...seed, diff: '+{"journeys":[],"other":true}' }), true);
  for (const path of ['.aludel/review.json', '.aludel/seams.json', '.aludel/journeys/signup.spec.mjs', 'src/app.ts'])
    assert.equal(changed(seed, { path }), true, path);
  assert.equal(changed({ path: 'docs/product.md' }), false);
});
