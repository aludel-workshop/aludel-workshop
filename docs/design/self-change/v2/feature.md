---
id: design-borrowbox-feature-v2
status: proposed-for-owner-review
updated: 2026-09-18
packet: D-01C
---

# Feature brief — Milestone decisions

## Intent and scope

Help the owner understand which unanswered choices prevent the current milestone, resolve one in context, and keep independent work moving. The portal design includes a blocker summary on Project Overview with links to decision and work records. The BorrowBox reservation request exercises request → interpretation → bounded authorization → identified preview → review.

Three layers stay distinct: Aludel is the portal; BorrowBox is its project; the tool catalog and reservation form are the app being created. The portal feature under design is still decision visibility and the request/review workflow. The preview now shows BorrowBox, never a second copy of the portal. See the [canonical demo fixture](../../demo-app/borrowbox.md).

Sources: [product purpose and example](../../../product.md), [D-01A domain behavior](../../self-change-brief.md), [experience foundation](../../experience-foundation.md), [R-07B findings](../../../evidence/r-07b-workflow-benchmark.md), [proportional design policy](../../product-development-workflow.md). Source hashes are in [provenance.json](provenance.json). These documents are the working baseline; the product map and prior layouts have not been owner-accepted.

## Product-map placement

Retain the proposed destinations for this slice; do not infer acceptance of the entire navigation from selection of a composition.

```text
Projects → BorrowBox → Overview [V1: orient, request, find consequence]
                         ├─ Decisions → decision [V2: answer with impact]
                         ├─ Work → task [V3: refine, authorize, follow]
                         └─ Releases → artifact review [V4: try, evaluate, respond]
Global Inbox links to V2; global Reviews links to V4.
```

Overview owns summaries and entry points. Decisions owns answers and rationale. Work owns task intent and authorization. Review owns evidence and acceptance for a specific artifact. There is no new “Blockers” top-level destination. The project Releases name is inherited provisionally; a reviewable build must be labeled “Awaiting review,” not “Released.”

## Stories and acceptance

| ID | Owner story / observable result | View / components |
|---|---|---|
| S1 | Returning to a project, identify the active milestone and the decision preventing dependent work without reconstructing history | V1 / C1, C2 |
| S2 | Find independent work even while one task is blocked; an optional preference is outside the milestone-blocker count | V1 / C2, C3 |
| S3 | Read options and consequences, explicitly save an answer, or defer while seeing that dependent work remains blocked | V2 / C4, C5 |
| S4 | Submit a change request and review its interpretation, scope, and acceptance examples as a durable task before execution | V1 → V3 / C6 |
| S5 | Authorize a particular revision; understand permitted effects and the expected result | V3 / C7 |
| S6 | Distinguish waiting for input, worker unavailability, failure, and uncertain cancellation; find an appropriate next action | V3 / C8 |
| S7 | Review an identified build against intent and checks; feedback belongs to that build; acceptance does not release it | V4 / C9, C10 |
| S8 | Revisit old evidence after inputs change; understand why current acceptance is unavailable | V4 / C5, C10 |

The design question is whether the owner can do S1–S3 quickly and carry that understanding into S4–S8. Do not expand the first implementation into a generic dependency graph editor, design canvas, full tracker, release automation, or multi-user workflow.

## Fixture, separate from real project state

All board data is illustrative. The repository remains in M0. The board depicts the target M1 workflow, with one example decision and independent task to make comparison controlled. It does not assert that real Q-004/Q-005 or other gates disappeared.

| Fixture | Meaning |
|---|---|
| Current milestone | BB-M1 — Reserve a tool for pickup |
| BB-D01, unanswered | Confirm instantly or require volunteer approval? Blocks reservation implementation and its acceptance checks |
| BB-001/r1 | Request to reserve available tools and reject overlapping dates; awaits the reservation-policy decision |
| BB-002, ready | Improve tool descriptions; depends on neither BB-D01 nor reservation implementation |
| BB-D03, optional | Wording preference for tool categories; no blocking link |
| A1 | Synthetic BorrowBox catalog/reservation preview using BB-D01/r1 and BB-001/r1 |
| A2 | Later revised preview; distinct identity, not A1 overwritten |

For the board, one decision may block two tasks but contributes **one** to the decision count. Counts include only unanswered/deferred decisions with an explicit required relation to unfinished milestone work/gates; lists distinguish direct task and gate impact. Missing relation data yields “Impact unavailable,” never “No blockers.” No guessed transitive dependency engine is specified here.

## Content hierarchy and terminology

1. Project and milestone outcome.
2. What requires judgment, why, and affected work.
3. What can proceed independently.
4. Existing work/result and the route to request another change.
5. History and technical evidence on demand.

Use “Ready to authorize” for eligible work and “Queued” only after queue confirmation. “Answer saved” does not mean “Work started.” “No blocking decisions” does not mean “Milestone complete.” “Accept this build” does not mean deploy. “Stale” always names the changed input and consequence. Do not display raw job/connector states as the sole explanation.

## Assumptions to test

- RQ1: Does outcome-first context improve first orientation enough to justify space above the queue?
- RQ2: Can the owner distinguish one blocking decision, two affected tasks, and independent work?
- RQ3: Does the decision → task transition make answering and authorizing feel distinct?
- RQ4: Can the owner explain which result and inputs acceptance covers, including stale evidence?
- RQ5: Is the separate review guide sufficient without entering the proposed product UI?

These are open research questions. The owner selected B on 2026-09-18. These research questions remain to be tested in D-01B; selection alone is not a usability result.
