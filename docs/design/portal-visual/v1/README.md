---
id: portal-visual-v1
kind: composition-baseline
status: operability-verified-pending-owner-and-visual-review
updated: 2026-09-20
packet: D-01E
---

# D-01E task and candidate-review compositions

## Readiness and scope

Verdict before visual generation: **ready for bounded composition alternatives**. DEC-025 supplies the accepted MD3-informed foundation, Overview, left navigation, MP1–MP9 and four incubating catalog patterns. V05–V08 plus D-01D's task/review contracts supply the task-to-candidate journey. The experiment may vary task/review hierarchy, page boundary and placement while preserving candidate identity, release separation, return paths and uncertainty. It must not redesign Overview or settle Q-002, Q-005, Q-006 or Q-008.

The review threshold in Q-005 remains open. These alternatives deliberately expose checks and gaps; selecting a composition does not decide which evidence is mandatory for acceptance.

## Alternatives and selection

All three generated options use the accepted light foundation and 1487×1058 review frame. Displayed order is authoritative.

| Displayed option | Composition question | Artifact | SHA-256 | Outcome |
|---|---|---|---|---|
| 1 — Candidate workspace | Can a large interactive preview plus a supporting evaluation pane make the exact candidate and next response clearest? | [selected direction](selected-direction.png) | `55aed70b21bf1967c3be4fbacfa4c9742c71fb29e82fcf1fde71db6aa7fec0b5` | Owner selected: “go go option 1” |
| 2 — Task continuity | Should the task remain primary while a candidate pane routes into review? | [alternative 2](alternative-2.png) | `82079db941e9340f0f320d9ba161a0d671183be283dce8cf017649767fb8c686` | Not selected |
| 3 — Evidence-led review | Should required evidence precede and gate the response rail? | [alternative 3](alternative-3.png) | `8d57ce1c204c833ba45aea26d4cbf713facb081dff64348eab0a3b9c59ee31c1` | Not selected |

Common constraints: preserve accepted Overview and labelled left navigation; use spacing/type/dividers before containment; keep A1 and its currency visible; make the embedded BorrowBox product distinct from Aludel; show task intent, things to try, checks and known gaps; separate acceptance from release; avoid dashboards, metrics, nested cards, progress percentages and screenshot carousels.

## Selected composition contract

- Overview remains the accepted reference and routes to named work or review records; it is not reopened.
- Task BB-001 owns why, success criteria, authorized scope, current result and history. Candidate A1 is a named result link, not an inline acceptance surface.
- Candidate review owns the interactive preview, exact candidate/currency, task context, test prompts, checks/gaps, draft feedback and accept/revise response.
- Desktop uses preview-primary with a supporting evaluation pane. Narrow order is identity/currency → preview → evidence/context → feedback/response; the left project navigation adapts using the accepted foundation.
- Back from A1 returns to BB-001. Reviews collection and direct links identify A1 independently of navigation history.
- Missing preview retains A1 and evidence with an unavailable state. Stale A1 remains inspectable but cannot be accepted. No newer candidate is substituted.
- Feedback is preserved. Revision request stays bound to A1 and starts no new run. Acceptance stays on A1 and does not release it.

## Implementation

The versioned derivative is [prototypes/d-01e](../../../../prototypes/d-01e/README.md). It preserves the D-01F Overview and implements task, review, current/stale/unavailable, feedback, revision and acceptance states. The generated unbranded drill asset is project-local and its source hash is recorded in the [work record](work-record.md).

The [outer review entry](http://localhost:4175/review.html) supplies scenario/reset controls, instructions and local notes. [Browser validation](browser-validation.json) and [owner-entry validation](harness-validation.json) passed. Full image-fidelity QA and owner acceptance remain required before implementation handoff. The [retrospective](review-harness-retrospective.md) records the 70/30 boundary and future vision.
