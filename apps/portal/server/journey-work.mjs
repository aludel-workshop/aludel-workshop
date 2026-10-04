// JOURNEYS-01 J5 (docs/design/journeys/work-record.md): Specify, then implement. Changing what a person does in the app is
// two Work items on Code. *Specify* writes the journey: characterization tests for the steps as they work today, then the
// target steps at the journey's next revision, signed as authored. Accepting it raises *Implement*, whose claims are the
// steps the accepted app doesn't do yet. Before the first Specify, the app must be reviewable: a v2 recipe, a fixture per
// persona and the preview-only setup route. This module reads Code's accepted app repository and creates the items; the
// rules are J1's pure contract in journeys.mjs.
import { execFileSync } from 'node:child_process';
import { layerBinding, layerReview } from './layer-source.mjs';
import { codeLayer, implementClaims, journeyEntry, journeyOffer, journeyPersona, reviewableGaps, setupRoute, specifyClaims, validateJourney, validateReviewRecipe } from './journeys.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const readAt = (repo, commit, path) => { try { return git(repo, 'show', `${commit}:${path}`); } catch { return null; } };
const clip = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };

// Code's journeys at a commit. An unreadable facet reads as none, with the reason, so the offer still answers.
export function journeysAt(repo, commit) {
  const text = readAt(repo, commit, '.aludel/outputs/journeys.json');
  if (text === null) return { journeys: [], error: null };
  try {
    const journeys = JSON.parse(text).journeys;
    if (!Array.isArray(journeys)) throw new Error('it holds no journeys list');
    journeys.forEach(validateJourney);
    return { journeys, error: null };
  } catch (error) { return { journeys: [], error: `.aludel/outputs/journeys.json: ${error.message}` }; }
}
function recipeAt(repo, commit) {
  const text = readAt(repo, commit, '.aludel/review.json');
  if (text === null) return { recipe: null, error: null };
  try { return { recipe: validateReviewRecipe(JSON.parse(text)), error: null }; } catch (error) { return { recipe: null, error: error.message }; }
}
// The app implements the setup route when its own code (outside `.aludel/`) names it.
function hasSetupRoute(repo, commit) {
  try { return Boolean(git(repo, 'grep', '-l', '-F', setupRoute, commit, '--', '.', ':(exclude).aludel').trim()); } catch { return false; }
}

// J6: where a journey's spec is kept, for a follow-up that suggests changing it. A replica's authority is the layer entry it
// was imported from (a Pages flow); any other journey is Code's own. The follow-up is raised there, never on the copy.
export function journeyTarget(db, projectId, id) {
  let bound;
  try { bound = layerBinding(db, projectId, codeLayer); } catch { fail('Code has no app repository yet, so a follow-up can\'t target one of its journeys.'); }
  const { journeys, error } = journeysAt(bound.repo, bound.commit);
  if (error) fail(`Code's journeys can't be read at the accepted head: ${error}`, 409);
  const journey = journeys.find(entry => entry.id === id);
  if (!journey) fail(`A follow-up targets journey ${id}, which isn't in Code's accepted app (${journeys.map(entry => entry.id).join(', ') || 'no journeys'}).`);
  return journey.origin === 'replica'
    ? { journey: id, title: journey.title, revision: journey.revision, layer: journey.source.layer, entry: journey.source.entry, entryRevision: journey.source.revision }
    : { journey: id, title: journey.title, revision: journey.revision, layer: codeLayer, entry: journeyEntry(id), entryRevision: journey.revision };
}

export function journeyWork({ db, know }) {
  const app = projectId => { try { return layerBinding(db, projectId, codeLayer); } catch { return null; } };
  // Code's page routes at its last index: `route /path` units. Handlers are API routes, never journey steps.
  const pageRoutes = projectId => db.prepare("SELECT symbol FROM code_units WHERE project_id = ? AND kind = 'route'").all(projectId).map(row => row.symbol.replace(/^route\s+/, ''));
  const openItem = (projectId, kind, match = () => true) => know.workList(projectId).find(item => item.state !== 'done' && item.context?.journeyWork?.kind === kind && match(item.context.journeyWork));

  // What Code offers for a task request: the routes it is about, the journeys that reach them, and whether to specify first.
  function offer(projectId, request) {
    const bound = app(projectId);
    if (!bound) return { available: false, reason: 'Code has no app repository yet.', routes: [], covered: [], uncovered: [], offer: null };
    const { journeys, error } = journeysAt(bound.repo, bound.commit);
    return { available: true, commit: bound.commit, journeysError: error, ...journeyOffer({ title: clip(request?.title, 160), brief: clip(request?.brief, 2000) }, { routes: pageRoutes(projectId), journeys }) };
  }

  // The once-per-app prerequisite, reused while it is open.
  function reviewable(user, projectId, gaps) {
    const open = openItem(projectId, 'reviewable');
    if (open) return open;
    return know.createWork(projectId, { layer: codeLayer, layerScoped: true, state: 'ready', title: 'Make the app reviewable', claims: gaps, checks: [],
      context: { journeyWork: { kind: 'reviewable' }, suggestion: 'Make this app reviewable, once, so its journeys can be walked and tested in review. ' +
        `Keep .aludel/review.json at version 2 with the checks the app passes and a fixture for each persona. Implement POST ${setupRoute} in the app: it prepares the synthetic state and session it is sent, ` +
        'and answers 404 unless ALUDEL_REVIEW_PREVIEW=1 and the Bearer ALUDEL_REVIEW_TOKEN matches. It touches sign-in, so keep it to synthetic accounts and declare it in .aludel/seams.json. ' +
        'Where a journey sends mail, give the preview an inbox stub instead.' },
      logText: `Created by ${user.name}: Specify needs the app to be reviewable` }, user.name);
  }

  // Creates the Specify item for a request, and the reviewable prerequisite that blocks it when the app isn't reviewable yet.
  function specify(user, projectId, input) {
    const bound = app(projectId);
    if (!bound) fail('Code has no app repository yet, so there is no app to specify a journey from.', 409);
    const title = clip(input?.title, 160);
    if (!title) fail('Say what the change is.');
    const brief = clip(input?.brief, 1500);
    const id = clip(input?.journey?.id, 64);
    const { journeys, error } = journeysAt(bound.repo, bound.commit);
    if (error) fail(`Code's journeys can't be read at the accepted head: ${error}`, 409);
    const existing = journeys.find(journey => journey.id === id) || null;
    const journey = { id, title: clip(input?.journey?.title, 200) || existing?.title || title, revision: existing ? existing.revision + 1 : 1 };
    const claims = specifyClaims(journey);
    if (openItem(projectId, 'specify', work => work.journey === id)) fail(`Journey ${id} is already being specified. Finish or archive that item first.`, 409);
    const personas = existing ? [journeyPersona(existing)].filter(Boolean) : clip(input?.persona, 64) ? [clip(input.persona, 64)] : [];
    const { recipe, error: recipeError } = recipeAt(bound.repo, bound.commit);
    const gaps = reviewableGaps({ recipe, recipeError, personas, setup: hasSetupRoute(bound.repo, bound.commit) });
    const what = existing ? `revise the “${journey.title}” journey (${journeyEntry(id)}, now at revision ${existing.revision})` : `draft the “${journey.title}” journey (${journeyEntry(id)}) from the app as it works today`;
    const item = know.createWork(projectId, { layer: codeLayer, layerScoped: true, title: `Specify: ${title}`.slice(0, 160), claims, checks: [],
      state: ['ready', 'suggested'].includes(input?.state) ? input.state : 'ready', ...(input?.priority ? { priority: input.priority } : {}), ...(input?.assignee ? { assignee: input.assignee } : {}),
      context: { journeyWork: { kind: 'specify', journey: id, title: journey.title, revision: journey.revision, request: { title, brief }, ...(input?.parked ? { parked: input.parked } : {}) },
        ...(input?.createdBy ? { createdBy: input.createdBy } : {}),
        suggestion: `Before “${title}” is built, ${what}. The request: ${brief || title}\n\n` +
          `1. Characterize: for each step as the app does it today, write a test in .aludel/journeys/${id}.spec.mjs that passes on the current app, and name it in the step's test.\n` +
          `2. Specify: write ${journeyEntry(id)} at revision ${journey.revision} in .aludel/outputs/journeys.json, origin authored, with the steps the request needs. Keep the IDs of steps you keep; a new step gets a new ID. A new or changed step has no test yet.\n` +
          '3. Leave the app code alone: accepting this raises the Implement item that builds it.' },
      logText: input?.createdBy ? `Created by ${input.createdBy.name} as a follow-up to ${input.createdBy.workRef || input.createdBy.workId}; accepted by ${user.name}`
        : `Created by ${user.name} to specify journey ${id} before implementing “${title}”` }, input?.createdBy?.name || user.name);
    let prerequisite = null;
    if (gaps.length) {
      prerequisite = reviewable(user, projectId, gaps);
      know.updateWork(user, projectId, prerequisite.id, { blocks: [...new Set([...prerequisite.blocks, item.id])] });
      prerequisite = know.workById(projectId, prerequisite.id);
    }
    return { specify: know.workById(projectId, item.id), prerequisite, journey, gaps };
  }

  // After a Specify run is accepted: the journey's revision is ahead of what the code builds, so raise Implement with the steps
  // the accepted build doesn't pass yet. Returns the Implement item, or null with the reason logged on the Specify item.
  function afterAccept(user, projectId, workId, attemptId) {
    const item = know.workById(projectId, workId);
    const work = item?.context?.journeyWork;
    if (work?.kind !== 'specify') return null;
    const note = text => { know.appendLog(workId, text); return null; };
    const raised = know.workList(projectId).find(entry => entry.context?.journeyWork?.kind === 'implement' && entry.context.journeyWork.specify === workId && entry.context.journeyWork.revision === work.revision);
    if (raised) return raised;
    const review = layerReview(db, projectId, attemptId);
    const bound = app(projectId);
    if (!review || !bound) return note('No Implement raised: this run had no reviewed app change.');
    const before = journeysAt(bound.repo, review.base).journeys.find(journey => journey.id === work.journey) || null;
    const after = journeysAt(bound.repo, review.commit).journeys.find(journey => journey.id === work.journey) || null;
    if (!after) return note(`No Implement raised: the accepted commit has no ${journeyEntry(work.journey)}.`);
    const walked = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'layer_review_journeys'").get()
      ? db.prepare('SELECT steps_json FROM layer_review_journeys WHERE integration_id = ? AND commit_sha = ?').get(review.id, review.commit) : null;
    let planned;
    try { planned = implementClaims(before, after, parse(walked?.steps_json, [])); } catch (error) { return note(`No Implement raised: ${error.message}`); }
    if (!planned.claims.some(claim => claim.kind === 'journey' || claim.id.endsWith('-removed')))
      return note(`No Implement raised: the accepted app already does every step of ${work.journey} at revision ${after.revision}.`);
    const request = work.request || { title: after.title, brief: '' };
    const steps = planned.claims.find(claim => claim.kind === 'journey')?.steps || [];
    // J6: a run kept as a draft waits on this spec. It becomes the Implement item, built on its own draft branch.
    const parked = work.parked ? know.workById(projectId, work.parked) : null;
    if (parked && parked.state !== 'done' && parked.context?.draft) {
      know.addWorkClaims(projectId, parked.id, planned.claims, `${item.ref} specified ${work.journey} at revision ${after.revision}; it adds ${steps.length ? `steps ${steps.join(', ')}` : 'the journey'} to what this item proves`);
      know.appendLog(workId, `Continues in ${parked.ref}, which builds ${work.journey} at revision ${after.revision} on its draft branch`, {}, { refs: [parked.id] });
      return know.workById(projectId, parked.id);
    }
    const implement = know.createWork(projectId, { layer: codeLayer, layerScoped: true, title: `Implement: ${request.title}`.slice(0, 160), claims: planned.claims, checks: [],
      state: 'ready', priority: item.priority, project: item.project || null,
      context: { journeyWork: { kind: 'implement', journey: work.journey, revision: after.revision, specify: workId, request },
        suggestion: `Build “${request.title}” as ${journeyEntry(work.journey)} revision ${after.revision} specifies it (accepted in ${item.ref}). The request: ${request.brief || request.title}\n\n` +
          `Make ${steps.length ? `steps ${steps.join(', ')}` : 'the journey'} true in the app, and turn their characterization tests into step tests that prove the new behaviour; name each test in its step. ` +
          'Every other step test must keep passing. Change the journey itself only through another Specify item.' },
      logText: `Raised by accepting ${item.ref}` }, 'Aludel');
    know.appendLog(workId, `Raised ${implement.ref} to implement ${work.journey} at revision ${after.revision}${planned.change.built.length ? `; steps ${planned.change.built.join(', ')} already pass` : ''}`, {}, { refs: [implement.id] });
    return implement;
  }

  return { offer, specify, afterAccept };
}
