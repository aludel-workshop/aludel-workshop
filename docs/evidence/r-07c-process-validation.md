---
id: evidence-r-07c
packet: R-07C
status: complete-with-trial-limitations
updated: 2026-09-19
---

# R-07C — Process operationalization

## Finding

The existing workflow already called for stories, page briefs, alternatives, scoped review and traceability. Later artifacts supplied many of those headings. The missing operational control was an explicit assessment of whether their contents and acceptance covered the full proposed construction scope. This is a diagnosis from the repository trail, not a claim about the prior agent's internal reasoning.

The [v2 selection record](../design/self-change/v2/review-record.md) explicitly limits acceptance to Overview B. The [feature brief](../design/self-change/v2/feature.md) acknowledges unaccepted product structure, while the [view contracts](../design/self-change/v2/views-and-components.md) propose V2–V4. The [D-01B report](d-01b-prototype-review.md) records construction and passing checks across that flow, followed by rejection of its structure. Thus “instructions absent” is an incomplete explanation.

## Failure audit

| Finding / source | Existing guidance or artifact | Failure classification and inferred mechanism | Earlier detection and corrective mechanism |
|---|---|---|---|
| v1 lacked stories, product structure and review frame | Historical v1 feedback in D-01B report | Missing groundwork observed; current workflow was added afterward, so do not retroactively claim all present instructions were violated | Intake classification and prototype readiness require parent structure, stories and external review tasks |
| v2 repeated the recursive gap | v2 feedback asks for feature/page/component rationale | Inadequate evidence: naming a design layer did not demonstrate its adequacy | Inspect actual content and trace proposed scope before moving stages |
| F-01 ambiguous post-decision state | V2 says return to origin or inspect ready task; state matrix names confirmation | Underspecified instruction/transition; possible destinations were left unresolved | Require complete transition tuple and empty/one/many-record walkthrough before composition |
| F-02 summary jumps to one task | V1 summarizes; V3 is a detail, with no collection contract | Missing collection requirement in scoped design | Verify summary cardinality and destination scope, including multiple records |
| F-03 task has no clear story spine | S4–S6 and V3 list intent/readiness/progress | Inadequate evidence despite story IDs | Page needs actor arrival, owned question and primary action by state; inspect a walkthrough |
| F-04 faux tabs jump to sections | Contracts require real links but do not choose task navigation semantics | Missing explicit navigation behavior decision | Contract navigation semantics; compare visual promise with actual destination before prototype |
| F-05 unrelated work on detail | C3 maps to V1; foundation says detail investigates one record | Guidance not enforced; layout allowed scope leakage | Component-to-page ownership review, including explicit exclusions |
| F-06 unreviewed shell/layout | Feature brief says map unaccepted; selection record limits approval | Scoped approval applied too broadly in subsequent construction | Acceptance ledger by artifact revision, scope and permitted next stage |
| F-07 repeated rush to functionality | Existing workflow requires earlier design gates | Stage gate not evidenced in routing; likely artifact-presence substitution | Write readiness verdict before construction; missing/stale evidence routes to groundwork |

F-01–F-07 refer to [owner feedback](../design/portal-foundation/feedback-2026-09-19.md). These mechanisms make omissions detectable; they do not guarantee a good design.

## Changes made

- Added a [six-step operating procedure](../design/process/operating-procedure.md) for intake, evidence assessment, dependency ordering, stage execution, readiness and handoff.
- Added a [reusable work record](../design/process/work-record-template.md) carrying scoped acceptance, invalidation, process outcome and task outcome. Small tasks may use a paragraph.
- Connected the procedure to AGENTS.md and the existing workflow rather than replacing the artifact guidance with another disconnected checklist.
- Corrected active instructions that implied the historical D-01C selection was still sufficient to resume D-01B. Historical versions remain available as evidence.
- Kept the procedure as a trial. No workflow engine, prototype, external service or product implementation was added.

## Observed desk exercises

The [three worked records](../design/process/r-07c-dry-runs.md) contain inputs, generated packet sequences, verdicts, stopping points and counterexamples.

| Case | Actual output | Counterexample result |
|---|---|---|
| Known D-01B flow | Needs structural groundwork; next D-01D, with owner selection after alternatives | Overview-only approval cannot permit the whole flow; missing structural evidence is detectable from pre-feedback artifacts |
| New BenchShare brief | Discovery and policy comparison precede journeys and screens | A calendar image or appearance approval does not settle actor/policy questions |
| Established-pattern copy change | Ready for bounded edit under an explicit accepted-baseline premise | Missing state evidence triggers targeted inspection; new automatic behavior increases scope |

These are manual applications of the procedure, not software-test results. No external research was necessary: claims here concern supplied repository evidence and proposed local process. No new vendor claims are made.

## Limits and next live trial

R-07C's bounded outputs are complete; process effectiveness remains unproven in live use. The author knows the historical defects, fictional cases have no real users, and a same-author handoff rehearsal is not independent replication. No usability improvement or future agent compliance is claimed.

The next live trial is D-01D, starting with its scoped [work record](../design/process/d-01d-work-record.md). Evaluate the process first: does it expose missing parent decisions before composition, preserve the limited Overview acceptance, and return to groundwork when alternatives reveal a gap? Then evaluate the resulting product structure with the owner. Do not construct the interaction prototype until the scoped gate passes.

Open process questions: does one compact record suffice as scope grows, how much review can be batched without losing acceptance boundaries, and will fresh sessions follow the procedure? Proposed trial defaults are one record per bounded packet, batched owner review of explicit scopes, and the next session using the linked handoff. These are reversible operating choices, not new owner approvals. Revisit if the live trial adds ceremony without earlier detection or repeats a known omission.

The future portal should store these readiness/acceptance/dependency records and supply current scoped evidence in task bundles, consistent with the knowledge strategy. Mechanical completeness can be checked automatically; adequacy and product judgment still need review. Designing or building that machinery is outside this packet.

## Repository verification

Local link targets were checked in 12 changed/new documents with no missing targets. The status contains exactly one `next_action`, D-01D, matching an execution-plan packet. The [source manifest](r-07c-source-manifest.json) records SHA-256 identities for 15 input/procedure files at handoff; this workspace has no Git metadata. These checks establish document integrity and routing consistency, not process effectiveness. No application tests were run because this packet changes documentation and operating guidance only.
