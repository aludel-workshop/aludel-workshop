// JOURNEYS-01 J1 (docs/design/journeys/work-record.md): the pure contract for journey-driven Work and review. It validates
// what Code keeps in `.aludel/` (journeys, the v2 review recipe, the seams list) and the claims a Work item makes, and derives
// review steps, coverage and implement claims from them. It reads and writes nothing; the caller supplies files and results.
//
// Information is written once. A journey describes what should happen; review steps, the persona a step is entered as, the
// test that proves a step and the claims an implement item makes are derived from it, never hand-matched by position.
// Everything Aludel adds to an app lives in `.aludel/`; whatever must touch the app outside it is a declared seam.
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const own = Object.hasOwn;
const idPattern = /^[a-z][a-z0-9-]{0,63}$/;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const optional = (value, check) => value === undefined || value === null || check(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const localPath = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\x00-\x20\x7f]/.test(value) && !/%(?:2f|5c|0[ad])/i.test(value) && value.length <= 1000;
// A step's proof: one test in `.aludel/journeys/tests/`, named `<file>.spec.mjs#<test id>`.
const testRef = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}\.spec\.mjs#[a-z][a-z0-9-]{0,63}$/.test(value);

export const origins = Object.freeze(['authored', 'observed', 'replica']);
export const claimKinds = Object.freeze(['journey', 'record', 'invariant', 'note']);

// A journey: the facet entry Code keeps at `.aludel/journeys/<id>.json`. Step IDs are stable across revisions, so a test,
// a review note or a claim that names a step keeps meaning the same step when others are inserted or reordered.
export function validateJourney(journey) {
  if (!plain(journey) || journey.version !== 1) fail('A journey needs version 1.');
  if (!idPattern.test(journey.id || '')) fail('A journey needs a lowercase ID.');
  if (!text(journey.title, 200)) fail(`Journey ${journey.id} needs a title.`);
  if (!origins.includes(journey.origin)) fail(`Journey ${journey.id} is authored, observed or a replica.`);
  if (!Number.isInteger(journey.revision) || journey.revision < 1) fail(`Journey ${journey.id} needs a revision from 1.`);
  if (!optional(journey.persona, value => idPattern.test(value))) fail(`Journey ${journey.id} names its persona by ID.`);
  // A replica says which authority entry it was imported from; the others are this layer's own.
  if (journey.origin === 'replica' ? !(plain(journey.source) && idPattern.test(journey.source.layer || '') && text(journey.source.entry, 200) && Number.isInteger(journey.source.revision))
    : journey.source !== undefined && journey.source !== null) fail(`Journey ${journey.id}: only a replica names its source (layer, entry, revision).`);
  if (!Array.isArray(journey.steps) || !journey.steps.length || journey.steps.length > 40) fail(`Journey ${journey.id} needs one to forty steps.`);
  const ids = new Set();
  for (const step of journey.steps) {
    if (!plain(step) || !idPattern.test(step.id || '') || ids.has(step.id)) fail(`Journey ${journey.id}: every step needs a unique lowercase ID.`);
    ids.add(step.id);
    if (!text(step.name, 200) || !text(step.trigger, 500) || !text(step.expected, 1000)) fail(`Journey ${journey.id} step ${step.id} needs a name, a trigger and what is expected.`);
    if (!optional(step.route, localPath)) fail(`Journey ${journey.id} step ${step.id}: a route is a local path.`);
    if (!optional(step.persona, value => idPattern.test(value))) fail(`Journey ${journey.id} step ${step.id} names its persona by ID.`);
    if (!optional(step.page, value => text(value, 200)) || !optional(step.story, value => text(value, 200))) fail(`Journey ${journey.id} step ${step.id}: page and story are references.`);
    if (!optional(step.test, testRef)) fail(`Journey ${journey.id} step ${step.id}: a test is named <file>.spec.mjs#<test id>.`);
  }
  return journey;
}

const stepFields = ['name', 'page', 'route', 'persona', 'story', 'trigger', 'expected'];
// What a new revision changed, by step ID. A step's test reference is the proof, not the spec, so it isn't a change.
export function journeyChange(previous, next) {
  validateJourney(next);
  if (!previous) return { journey: next.id, from: null, to: next.revision, added: next.steps.map(step => step.id), changed: [], removed: [], unchanged: [] };
  validateJourney(previous);
  if (previous.id !== next.id) fail('A revision keeps its journey ID.');
  if (next.revision !== previous.revision + 1) fail(`Journey ${next.id} moves one revision at a time (${previous.revision} → ${previous.revision + 1}).`);
  const before = new Map(previous.steps.map(step => [step.id, step]));
  const after = new Set(next.steps.map(step => step.id));
  const same = (a, b) => stepFields.every(field => (a[field] ?? null) === (b[field] ?? null));
  return { journey: next.id, from: previous.revision, to: next.revision,
    added: next.steps.filter(step => !before.has(step.id)).map(step => step.id),
    changed: next.steps.filter(step => before.has(step.id) && !same(before.get(step.id), step)).map(step => step.id),
    removed: previous.steps.filter(step => !after.has(step.id)).map(step => step.id),
    unchanged: next.steps.filter(step => before.has(step.id) && same(before.get(step.id), step)).map(step => step.id) };
}

// The v2 review recipe at `.aludel/review.json`: how to build and check the app, and which fixture each persona is entered
// with. It holds no scenarios; review steps come from journeys. A v1 recipe (scenarios keyed by criterion index) is refused.
export function validateReviewRecipe(recipe) {
  if (!plain(recipe)) fail('The review recipe is a JSON object.');
  if (recipe.version === 1 || own(recipe, 'scenarios')) fail('Review recipe v1 scenarios are retired: review steps come from journeys in .aludel/journeys/, and the recipe maps personas to fixtures (version 2).');
  if (recipe.version !== 2) fail('Review recipes need version 2.');
  if (!optional(recipe.buildTarget, value => idPattern.test(value))) fail('Invalid review check build target.');
  if (!Array.isArray(recipe.checks) || !recipe.checks.length || recipe.checks.length > 10) fail('A review recipe needs one to ten checks.');
  for (const check of recipe.checks) if (!plain(check) || !text(check.name, 120) || !Array.isArray(check.command) || !check.command.length || check.command.length > 30 ||
      !check.command.every(arg => typeof arg === 'string' && arg.length <= 300 && !/[\x00\r\n]/.test(arg))) fail('Review checks need a name and an argument array.');
  if (!plain(recipe.personas) || Object.keys(recipe.personas).length > 20) fail('A review recipe maps up to twenty personas to fixtures.');
  for (const [persona, entry] of Object.entries(recipe.personas))
    if (!idPattern.test(persona) || !plain(entry) || !idPattern.test(entry.fixture || '') || !optional(entry.session, value => idPattern.test(value)))
      fail(`Persona ${persona} needs a fixture ID and, when signed in, a session ID.`);
  return recipe;
}

// The review steps a set of journeys offers, in journey order. Each opens on the candidate as its persona; the first step of
// a journey resets that persona's fixture and later ones continue it. A step that can't be opened says why instead.
export function reviewSteps(recipe, journeys) {
  validateReviewRecipe(recipe);
  const steps = [];
  for (const journey of journeys) {
    validateJourney(journey);
    let previous = null;
    for (const step of journey.steps) {
      const persona = step.persona ?? journey.persona ?? null;
      const entry = persona ? recipe.personas[persona] : null;
      const reason = !step.route ? 'This step has no route in the app yet.' : !persona ? 'This step names no persona.' : !entry ? `No fixture is declared for persona ${persona}.` : null;
      steps.push({ id: `${journey.id}.${step.id}`, journey: journey.id, revision: journey.revision, step: step.id, label: step.name, expected: step.expected, persona,
        fixture: entry?.fixture ?? null, session: entry?.session ?? null, path: step.route ?? null, after: previous, reset: previous === null, available: !reason, reason });
      previous = `${journey.id}.${step.id}`;
    }
  }
  return steps;
}

// How well a journey is proven at a build: per step, whether a test covers it and how that test ran. `results` maps a test
// reference to 'passed' or 'failed'. This is both the reviewer's evidence and the person's check before submitting.
export function coverage(journey, results = {}, recipe = null) {
  validateJourney(journey);
  const steps = journey.steps.map(step => {
    const persona = step.persona ?? journey.persona ?? null;
    const status = !step.test ? 'uncovered' : results[step.test] === 'passed' ? 'passed' : results[step.test] === 'failed' ? 'failed' : 'untested';
    return { step: step.id, test: step.test ?? null, status, fixture: recipe ? Boolean(persona && recipe.personas?.[persona]) : null };
  });
  const count = status => steps.filter(step => step.status === status).length;
  return { journey: journey.id, revision: journey.revision, steps, passed: count('passed'), failed: count('failed'), uncovered: count('uncovered'), untested: count('untested'),
    proven: steps.every(step => step.status === 'passed') };
}

// Where an entry stands: authored (a person signed it, or its authority did), observed (reconstructed from the app and
// proven at the current head), or a hypothesis (reconstructed but unproven, or proven at an older commit). Works for any
// facet entry that carries `origin` and an optional `proof: { commit, status }`: a journey's characterization run, a design
// kit token checked against the app's computed styles.
export function standing(entry, head) {
  if (entry.origin === 'authored' || entry.origin === 'replica') return entry.origin;
  if (entry.origin !== 'observed') fail('An entry is authored, observed or a replica.');
  return entry.proof?.status === 'passed' && entry.proof.commit === head ? 'observed' : 'hypothesis';
}

// Claims replace hand-written criteria. A claim names what a run must make true; when a layer already describes it, the
// claim references that entry at a revision. Free text is a `note` and is marked unbacked: a gap in some layer's spec.
export function validateClaims(claims) {
  if (!Array.isArray(claims) || claims.length > 40) fail('A Work item has up to forty claims.');
  const ids = new Set();
  return claims.map(claim => {
    if (!plain(claim) || !idPattern.test(claim.id || '') || ids.has(claim.id)) fail('Every claim needs a unique lowercase ID.');
    ids.add(claim.id);
    if (!claimKinds.includes(claim.kind)) fail(`Claim ${claim.id} is a journey, record, invariant or note.`);
    if (claim.kind === 'journey' && !(idPattern.test(claim.journey || '') && Number.isInteger(claim.revision) && Array.isArray(claim.steps) && claim.steps.length && claim.steps.every(step => idPattern.test(step))))
      fail(`Journey claim ${claim.id} names a journey, its revision and the steps it makes true.`);
    if (claim.kind === 'record' && !(idPattern.test(claim.layer || '') && text(claim.entry, 200) && Number.isInteger(claim.revision)))
      fail(`Record claim ${claim.id} names a layer, an entry and its revision.`);
    if (['invariant', 'note'].includes(claim.kind) && !text(claim.text, 1000)) fail(`Claim ${claim.id} says what must hold.`);
    if (!optional(claim.text, value => text(value, 1000))) fail(`Claim ${claim.id}: text is up to 1000 characters.`);
    return { ...claim, backed: claim.kind !== 'note' };
  });
}

// Accepting a Specify item leaves a journey's revision ahead of what the code builds. The implement item it raises claims
// the added and changed steps, and that every other journey still passes. Removed steps are claimed as gone.
export function implementClaims(previous, next) {
  const change = journeyChange(previous, next);
  const steps = [...change.added, ...change.changed];
  const claims = [];
  if (steps.length) claims.push({ id: `${next.id}-steps`, kind: 'journey', journey: next.id, revision: next.revision, steps });
  if (change.removed.length) claims.push({ id: `${next.id}-removed`, kind: 'invariant', text: `Steps ${change.removed.join(', ')} of ${next.title} are no longer part of the journey.` });
  claims.push({ id: 'journeys-unchanged', kind: 'invariant', text: `Every other journey still passes its tests${change.unchanged.length ? `, as do unchanged steps ${change.unchanged.join(', ')} of ${next.title}` : ''}.` });
  return { change, claims: validateClaims(claims) };
}

// Existing items' hand-written criteria become note claims, nothing lost; each is unbacked until someone references a layer.
export const claimsFromCriteria = criteria => validateClaims(criteria.map((value, index) => ({ id: `criterion-${index + 1}`, kind: 'note', text: String(value).slice(0, 1000) })));

// `.aludel/seams.json`: every place Aludel touches the app outside `.aludel/`. A file seam is Aludel's whole file; an edit
// seam is Aludel's lines in an app file. `remove` says how to take it out, so the app can leave Aludel.
export function validateSeams(seams) {
  if (!plain(seams) || seams.version !== 1 || !Array.isArray(seams.seams) || seams.seams.length > 100) fail('A seams list needs version 1 and up to a hundred seams.');
  const paths = new Set();
  for (const seam of seams.seams) {
    if (!plain(seam) || !text(seam.path, 300) || seam.path.startsWith('/') || seam.path.split('/').includes('..') || paths.has(seam.path)) fail('Every seam names a unique relative path.');
    if (seam.path === '.aludel' || seam.path.startsWith('.aludel/')) fail(`${seam.path} is inside .aludel/ and isn't a seam.`);
    paths.add(seam.path);
    if (!['file', 'edit'].includes(seam.kind) || !text(seam.purpose, 300) || !text(seam.remove, 300)) fail(`Seam ${seam.path} is a file or an edit, with its purpose and how to remove it.`);
  }
  return seams;
}

// The static half of the separability check: files outside `.aludel/` that name Aludel but aren't declared seams. The other
// half runs the app's own build and tests with `.aludel/` removed and the seams taken out (J3).
const mentionsAludel = /aludel/i;
export function undeclaredSeams(files, seams) {
  validateSeams(seams);
  const declared = new Set(seams.seams.map(seam => seam.path));
  return files.filter(file => !(file.path === '.aludel' || file.path.startsWith('.aludel/')) && !declared.has(file.path) && (mentionsAludel.test(file.path) || mentionsAludel.test(file.text ?? '')))
    .map(file => file.path).sort();
}
