// Additive review scope is an explicit run record; the original Go bundle stays immutable.
import { validateClaims } from './journeys.mjs';
const fail = message => { throw Object.assign(new Error(message), { status: 409 }); };
export function augmentJourneyClaims(held, assessment, journeys) {
  if (!assessment || typeof assessment.reason !== 'string' || !assessment.reason.trim() || assessment.reason.length > 1000 || !Array.isArray(assessment.journeys) || assessment.journeys.length > 40)
    fail('Assess affected journeys with a reason and a bounded journeys list (which may be empty).');
  const claims = [], reasons = [], taken = new Set(held.map(claim => claim.id));
  for (const ref of assessment.journeys) {
    const journey = journeys.find(entry => entry.id === ref?.journey);
    if (!journey || ref.revision !== journey.revision || !Array.isArray(ref.steps) || !ref.steps.length || ref.steps.some(id => !journey.steps.some(step => step.id === id)) || typeof ref.why !== 'string' || !ref.why.trim() || ref.why.length > 1000)
      fail('Each assessed journey names its current revision, valid steps and why it is affected.');
    const covered = new Set([...held, ...claims].filter(claim => claim.kind === 'journey' && claim.journey === journey.id && claim.revision === journey.revision).flatMap(claim => claim.steps));
    const steps = [...new Set(ref.steps)].filter(id => !covered.has(id));
    reasons.push({ journey: journey.id, revision: journey.revision, why: ref.why.trim() });
    if (!steps.length) continue;
    let number = 1; while (taken.has(`impact-${number}`)) number++;
    const id = `impact-${number}`; taken.add(id);
    claims.push({ id, kind: 'journey', journey: journey.id, revision: journey.revision, steps });
  }
  if (held.length + claims.length > 40) fail('A run has up to forty claims.');
  return { claims: validateClaims(claims), reason: assessment.reason.trim(), journeys: reasons };
}
export function assessedRunClaims(db, attemptId, held = []) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'work_run_steps'").get()) return held;
  const row = db.prepare("SELECT payload_json FROM work_run_steps WHERE attempt_id = ? AND kind = 'journey-assessment' ORDER BY seq LIMIT 1").get(attemptId);
  return row ? [...held, ...JSON.parse(row.payload_json).claims] : held;
}
