---
id: process-trial-d01d-001
revision: 3
status: complete
updated: 2026-09-19
---

# D-01D — First live process trial

## Intake

**Process outcome:** demonstrate that prerequisite gaps are detected and resolved before composing a larger flow; keep review scope explicit. **Task outcome:** an owner-reviewable portal structure with journeys, page responsibilities, transitions and loose alternatives. **Class:** cross-page workflow. **Authority:** local design work under the execution packet; no product implementation or external effects.

Inputs: procedure revision 1; R-07C evidence and its source manifest; D-01C v2 Overview B selection (DEC-012); D-01B v3 feedback F-01–F-07; DEC-013–015. Read the relevant artifact content, not merely its status. The manifest freezes the audited baseline; check current inputs for changes before beginning.

## Scope and evidence state

| Scope | State / evidence | Needed work |
|---|---|---|
| BorrowBox fixture and Overview opening hierarchy | Accepted within DEC-011/012/013 scope | Retain as constraint, do not infer surrounding acceptance |
| Owner jobs and product purpose | Working baseline in product and experience foundation | Map concrete arrival situations and journeys |
| Product shell, collection/detail boundaries | Direction A accepted for D-01B, 2026-09-19 | Test in the bounded interaction experiment |
| Decision and authorization transitions | Defined and accepted for D-01B | Test predictability; Q-002 remains outside this fixture |
| Task detail | State-specific spine and navigation semantics accepted for D-01B | Test across happy and exceptional states |
| Prototype readiness | Ready for a bounded experiment | Follow the linked readiness verdict; do not expand scope silently |

## Dependency-ordered execution

1. **D-01D.1 — Journeys and boundaries:** map Decide, Authorize, Follow and Review, with page responsibilities, collection/detail distinctions and transitions. Walk zero/one/multiple tasks and failure/stale cases. Agent checks coverage against F-01–F-07. Output is a linked draft contract, not screens.
2. **D-01D.2 — Loose alternatives:** use those contracts to compare at least two shell/page systems with wireflows and component ownership. Return to .1 if composition requires an undefined responsibility. Agent checks that alternatives address the same stories.
3. **D-01D.3 — Scoped owner review:** present concrete alternatives; record selection/revision separately for structure, transitions and page responsibilities. No acceptance is presumed. Stop for owner judgment on material unresolved choices.
4. **D-01D.4 — Trial assessment/handoff:** record gaps caught before construction, gaps caught only by owner, rework and unnecessary ceremony. Reassess D-01B readiness; do not mark it ready merely because D-01D files exist.

These are substeps of one work packet, not permission to run multiple packets in parallel.

**Final verdict:** D-01D complete. The owner selected project-workspace direction A on 2026-09-19. D-01B is ready only for the [bounded local experiment](../portal-foundation/v1/prototype-readiness.md). **One next action:** D-01B.

## Live evidence and remaining gate

On 2026-09-19, procedure revision 1 was applied to D-01D.1/.2. The [structure contract](../portal-foundation/v1/structure.md) preceded composition. The [assessment](../portal-foundation/v1/assessment.md) records gaps resolved before composition, nine manual contract walks, F-01–F-07 coverage and unmeasured outcomes. [Input hashes](../portal-foundation/v1/inputs.json) preserve the intake revisions; the R-07C manifest had no changed sources at intake.

Two static alternatives and their wireflows exist; desktop/narrow browser checks passed. The prior procedure was adequate for this step, so no procedural expansion was added. The worked contracts and scoped ledger are reusable application evidence, not proof of universal effectiveness.

The owner reviewed v1 and said “A looks great, continue.” The [review record](../portal-foundation/v1/review-record.md) preserves the exact statement and scoped acceptance. The [final trial assessment](../portal-foundation/v1/assessment.md) distinguishes direction acceptance from usability evidence and records no owner-reported omissions. The process caught five gaps before composition; no procedure amendment was justified. Future interaction evidence may still invalidate a contract, in which case work returns to the earliest affected stage.
