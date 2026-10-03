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
// A step's proof: one test in `.aludel/journeys/<file>.spec.mjs`, named `<file>.spec.mjs#<test id>`.
const testRef = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}\.spec\.mjs#[a-z][a-z0-9-]{0,63}$/.test(value);

export const origins = Object.freeze(['authored', 'observed', 'replica']);
export const claimKinds = Object.freeze(['journey', 'record', 'invariant', 'note']);

// A journey: an entry of the facet Code keeps at `.aludel/outputs/journeys.json` (`{ journeys: [...] }`). Step IDs are stable across revisions, so a test,
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
  if (recipe.version === 1 || own(recipe, 'scenarios')) fail('Review recipe v1 scenarios are retired: review steps come from journeys in .aludel/outputs/journeys.json, and the recipe maps personas to fixtures (version 2).');
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
    // An invariant that covers the journeys is proven by every step test no journey claim names.
    if (!optional(claim.covers, value => value === 'journeys' && claim.kind === 'invariant')) fail(`Claim ${claim.id}: only an invariant covers the journeys.`);
    return { ...claim, backed: claim.kind !== 'note' };
  });
}

// JOURNEYS-01 J4: a stored criterion or claim, read as a claim. Items and runs pinned before J4 kept criteria without IDs;
// a criterion's position gives the ID the migration gave its item (`note-<position + 1>`), so a run pinned before the
// migration and its item name the same claim. Nothing is stored by position.
export function claimAt(check, index) {
  const kind = claimKinds.includes(check?.kind) ? check.kind : 'note';
  return { ...check, id: idPattern.test(check?.id || '') ? check.id : `note-${index + 1}`, kind, backed: kind !== 'note' };
}
export const claimsOf = checks => (Array.isArray(checks) ? checks : []).map(claimAt);
// A new free-text claim takes the lowest unused note number, so the others keep theirs.
export function nextNoteId(taken) {
  let number = 1;
  while (taken.has(`note-${number}`)) number++;
  return `note-${number}`;
}
// What a claim says, for the item and the reviewer. A backed claim's words come from the layer entry it references.
export function claimText(claim) {
  if (claim.text) return claim.text;
  if (claim.kind === 'journey') return `Journey ${claim.journey} at revision ${claim.revision}: ${claim.steps.length === 1 ? 'step' : 'steps'} ${claim.steps.join(', ')}`;
  if (claim.kind === 'record') return `${claim.layer} ${claim.entry} at revision ${claim.revision}`;
  return claim.id;
}

// What a run was asked to make true: its pinned criteria as claims, in order, without their review state. `index` is for display.
export const taskClaims = checks => claimsOf(checks).map((claim, index) => ({ index, id: claim.id, kind: claim.kind, backed: claim.backed, text: claimText(claim), source: claim.source || null,
  ...Object.fromEntries(['journey', 'revision', 'steps', 'layer', 'entry', 'covers'].filter(field => claim[field] !== undefined).map(field => [field, claim[field]])) }));

// The automated proof of a claim at a reviewed build, from its journeys and the step results J3 recorded there (`<journey>.<step>`
// with passed, failed, skipped, uncovered or no-fixture). A journey claim is proven when every step it names passed on a build
// whose journey is at the claimed revision. The journeys invariant holds when no step outside the journey claims failed.
// Record and note claims have no automated proof; the reviewer judges them. `journeys` is null when nothing was built.
const proofOrder = ['failed', 'no-fixture', 'uncovered', 'skipped', 'missing', 'stale', 'not-run'];
export function claimProof(claim, { journeys = null, results = [] } = {}, claims = []) {
  const byId = new Map(results.map(result => [result.id, result]));
  const stepOf = (id, fallback) => { const result = byId.get(id); return { id, status: result?.status || fallback, detail: result?.detail || null, screenshot: Boolean(result?.screenshot) }; };
  if (claim.kind === 'journey') {
    const journey = journeys?.find(entry => entry.id === claim.journey) || null;
    const known = new Set(journey?.steps.map(step => step.id) || []);
    const steps = claim.steps.map(step => journeys && !known.has(step) ? { id: `${claim.journey}.${step}`, status: 'missing', detail: `The reviewed build's journey has no step ${step}.`, screenshot: false }
      : stepOf(`${claim.journey}.${step}`, 'not-run'));
    const status = !journeys || !results.length ? 'not-run' : !journey ? 'missing' : journey.revision !== claim.revision ? 'stale'
      : steps.every(step => step.status === 'passed') ? 'passed' : proofOrder.find(value => steps.some(step => step.status === value)) || 'failed';
    const detail = status === 'missing' && !journey ? `The reviewed build has no journey ${claim.journey}.`
      : status === 'stale' ? `The reviewed build has ${claim.journey} at revision ${journey.revision}; this claim is for revision ${claim.revision}.` : null;
    return { status, detail, steps };
  }
  // J5: a record claim on a Code journey entry is proven by the reviewed build holding that journey at that revision, authored.
  if (journeyRecord(claim)) {
    const journey = journeys?.find(entry => journeyEntry(entry.id) === claim.entry) || null;
    const status = !journeys ? 'not-run' : !journey ? 'missing' : journey.revision !== claim.revision ? 'stale' : journey.origin !== 'authored' ? 'unsigned' : 'passed';
    const detail = status === 'missing' ? `The reviewed build has no ${claim.entry}.` : status === 'stale' ? `The reviewed build has ${claim.entry} at revision ${journey.revision}; this claim is for revision ${claim.revision}.`
      : status === 'unsigned' ? `The reviewed build's ${claim.entry} is ${journey.origin}; a specified journey is written as authored.` : null;
    return { status, detail, steps: [] };
  }
  if (claim.kind === 'invariant' && claim.covers === 'journeys') {
    const claimed = new Set(claims.filter(entry => entry.kind === 'journey').flatMap(entry => entry.steps.map(step => `${entry.journey}.${step}`)));
    const steps = results.filter(result => !claimed.has(result.id)).map(result => stepOf(result.id));
    const status = !journeys || !results.length ? 'not-run' : steps.some(step => step.status === 'failed') ? 'failed' : 'passed';
    return { status, detail: null, steps };
  }
  return null;
}

// Which claims stop acceptance: those with an automated proof that isn't passing. A person who submitted with a stated reason
// for a claim is excused; the reviewer sees the failure and the reason first. An agent run is never excused.
export function claimGate(claims, proofs, reasons = {}) {
  return claims.filter(claim => proofs[claim.id] && proofs[claim.id].status !== 'passed')
    .map(claim => ({ claim: claim.id, text: claimText(claim), status: proofs[claim.id].status, reason: reasons[claim.id] || null }));
}

// Accepting a Specify item leaves a journey's revision ahead of what the code builds. The implement item it raises claims
// the added and changed steps, and that every other journey still passes. Removed steps are claimed as gone.
// J5: with the accepted build's step results, an added step whose characterization test already passed is built, not
// claimed: a new journey drafted from the current app claims only what the app doesn't do yet. A changed step is always
// claimed, because a test that still passes proves the old spec.
export function implementClaims(previous, next, results = null) {
  const change = journeyChange(previous, next);
  const passed = new Set((results || []).filter(result => result.status === 'passed').map(result => result.id));
  const built = change.added.filter(step => passed.has(`${next.id}.${step}`));
  const steps = [...change.added.filter(step => !built.includes(step)), ...change.changed];
  const kept = [...change.unchanged, ...built];
  const claims = [];
  if (steps.length) claims.push({ id: `${next.id}-steps`, kind: 'journey', journey: next.id, revision: next.revision, steps: next.steps.map(step => step.id).filter(step => steps.includes(step)) });
  if (change.removed.length) claims.push({ id: `${next.id}-removed`, kind: 'invariant', text: `Steps ${change.removed.join(', ')} of ${next.title} are no longer part of the journey.` });
  claims.push({ id: 'journeys-unchanged', kind: 'invariant', covers: 'journeys', text: `Every other journey still passes its tests${kept.length ? `, as do steps ${kept.join(', ')} of ${next.title}` : ''}.` });
  return { change: { ...change, built }, claims: validateClaims(claims) };
}

// ---- JOURNEYS-01 J5: Specify, then implement ----
// Code keeps a journey as the entry `journey-<id>` of its journeys facet; a Specify item's record claim names it. Code's layer
// key is `platform` (DEC-049 named the Platform layer Code; the `code` template installs under it).
export const codeLayer = 'platform';
export const journeyEntry = id => `journey-${id}`;
export const journeyRecord = claim => claim?.kind === 'record' && claim.layer === codeLayer && /^journey-/.test(claim.entry || '');
// The preview-only setup route a reviewable app implements (see the agent card's reviewPreparation).
export const setupRoute = '/api/__aludel/review';

const routePath = value => String(value).split(/[?#]/)[0].replace(/\/+$/, '') || '/';
const segments = path => path.split('/').filter(part => part && !/^[:{[*]/.test(part)).map(part => part.toLowerCase());
// Which of the app's routes a request is about. A path the request names matches itself (and the routes under it), even
// when the app doesn't have it yet; a word of four letters or more matches a route segment that starts with it, or that
// it starts with ("teams" and /team). API routes are never journey steps, so callers pass page routes and step routes only.
export function matchRoutes(request, routes) {
  const said = String(request || '');
  const known = [...new Set(routes.filter(localPath).map(routePath))];
  const named = [...said.matchAll(/(?:^|[\s(`'"])(\/[a-z0-9][a-z0-9/_-]*)/gi)].map(match => routePath(match[1].toLowerCase())).filter(localPath);
  const words = [...new Set(said.replace(/\/[a-z0-9/_-]*/gi, ' ').toLowerCase().match(/[a-z]{4,}/g) || [])];
  const byWord = known.filter(route => segments(route).some(part => part.length >= 3 && words.some(word => part.startsWith(word) || part.length >= 4 && word.startsWith(part))));
  const byPath = named.flatMap(path => { const under = known.filter(route => route === path || route.startsWith(`${path}/`)); return under.length ? under : [path]; });
  return [...new Set([...byPath, ...byWord])].sort();
}

const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+|-+$/g, '').slice(0, 48).replace(/-+$/, '') || 'journey';
// What Code offers when a task is created: the routes the request is about and the journeys that reach them. When a
// matched route has no journey, it offers to draft one from the current app first (Specify); when one journey reaches
// every matched route, it offers to revise that journey first. No match means a trivial change, and no offer.
export function journeyOffer(request, { routes = [], journeys = [] } = {}) {
  journeys.forEach(validateJourney);
  const matched = matchRoutes(`${request?.title || ''}\n${request?.brief || ''}`, [...routes, ...journeys.flatMap(journey => journey.steps.map(step => step.route).filter(Boolean))]);
  const reaching = route => journeys.filter(journey => journey.steps.some(step => step.route && routePath(step.route) === route)).map(journey => journey.id);
  const covered = matched.map(route => ({ route, journeys: reaching(route) }));
  const uncovered = covered.filter(entry => !entry.journeys.length).map(entry => entry.route);
  if (!matched.length) return { routes: [], covered, uncovered, offer: null };
  if (uncovered.length) {
    const taken = new Set(journeys.map(journey => journey.id));
    const base = slug(request?.title || uncovered[0]);
    let id = base, number = 2;
    while (taken.has(id)) id = `${base.slice(0, 44)}-${number++}`;
    return { routes: matched, covered, uncovered, offer: { kind: 'draft', journey: { id, title: String(request?.title || uncovered[0]).trim().slice(0, 200), revision: 1 }, routes: uncovered } };
  }
  const shared = journeys.find(journey => covered.every(entry => entry.journeys.includes(journey.id)));
  return { routes: matched, covered, uncovered, offer: shared ? { kind: 'revise', journey: { id: shared.id, title: shared.title, revision: shared.revision + 1 }, routes: matched } : null };
}

// A Specify item's claims: the journey written at its next revision (proven by the reviewed build holding it, authored),
// and every existing step test, the new characterization tests included, passing on that build.
export function specifyClaims(journey) {
  if (!idPattern.test(journey?.id || '') || !Number.isInteger(journey.revision) || journey.revision < 1) fail('Specify names a journey and the revision it writes.');
  return validateClaims([
    { id: 'journey-spec', kind: 'record', layer: codeLayer, entry: journeyEntry(journey.id), revision: journey.revision,
      text: `Journey ${journey.id} at revision ${journey.revision}: the steps as the app works today, each proven by a characterization test, then the target steps, signed as authored` },
    { id: 'journeys-unchanged', kind: 'invariant', covers: 'journeys', text: 'Every step test passes on the current app, the new characterization tests included.' }]);
}

// What stops an app's journeys being walked in review (once per app): a readable v2 recipe, a fixture for each persona the
// journey is entered as, and the preview-only setup route. Each gap is an invariant claim for the prerequisite item.
export function reviewableGaps({ recipe = null, recipeError = null, personas = [], setup = false }) {
  const gaps = [];
  if (recipeError || !recipe) gaps.push({ id: 'review-recipe', kind: 'invariant', text: recipeError ? `.aludel/review.json is readable as version 2 (now: ${recipeError})`.slice(0, 1000) : '.aludel/review.json exists as version 2, with the checks the app passes and a fixture for each persona' });
  for (const persona of personas) if (recipe && !recipeError && !recipe.personas?.[persona]) gaps.push({ id: `persona-${persona}`.slice(0, 64), kind: 'invariant', text: `Persona ${persona} has a fixture (and a synthetic session when signed in), so review can enter the app as ${persona}` });
  if (!setup) gaps.push({ id: 'setup-route', kind: 'invariant', text: `POST ${setupRoute} prepares the fixture and session it is sent, answers 404 unless ALUDEL_REVIEW_PREVIEW=1 with the review token, and is declared in .aludel/seams.json` });
  return validateClaims(gaps);
}

// Existing items' hand-written criteria become note claims, nothing lost; each is unbacked until someone references a layer.
export const claimsFromCriteria = criteria => validateClaims(criteria.map((value, index) => ({ id: `note-${index + 1}`, kind: 'note', text: String(value).slice(0, 1000) })));

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
// The `.aludel/` files that change what a review builds, runs or walks. A change to only these still needs the combined build.
export const reviewInputPath = path => /^\.aludel\/(?:review\.json|seams\.json|outputs\/journeys\.json|journeys\/[a-z][a-z0-9-]{0,63}\.spec\.mjs)$/.test(path);
export function undeclaredSeams(files, seams) {
  validateSeams(seams);
  const declared = new Set(seams.seams.map(seam => seam.path));
  return files.filter(file => !(file.path === '.aludel' || file.path.startsWith('.aludel/')) && !declared.has(file.path) && (mentionsAludel.test(file.path) || mentionsAludel.test(file.text ?? '')))
    .map(file => file.path).sort();
}
