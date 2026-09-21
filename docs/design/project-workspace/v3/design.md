---
id: project-workspace-v3-design
kind: feature-design
status: agent-checked-owner-review-pending
updated: 2026-09-20
---

# D-03 — Work planning, history, and reconciliation design

## Scope and accepted inputs

Owner-selected structure A and planning/history-first are fixed inputs from decision `QUESTION-c7d97a79-dc0b-4de0-9665-63e157f5efa2` revision 2. The owner's question places Reviews under Work. This packet decides the first slice's collection/detail and reconciliation behavior. It does not redesign Product or Design, implement the review engine, or authorize PW-01.

Aludel's accepted MD3 foundation supplies color roles, hierarchy, status labels, conventional controls, focus behavior, and collection patterns. Reused concepts: product shell, status text, comparable rows, attention before mechanics, zero/unknown distinction, and linkable details. New incubating patterns are `work-lanes`, `plan-record-detail`, `plan-editor`, and `reconciliation-review`; they require real implementation stories before catalog promotion.

## Alternatives considered

### 1. Lifecycle lanes within Work — selected for review

Work contains Requests & proposals, Plan, Active, Reviews, and History. Each is a stable collection; a record detail shows its provenance and relationships. A plan record may later be represented by a real task, but the two identities remain distinguishable.

This matches the selected product-area structure, makes review the last stage of the build pipeline, and gives imported work a useful home without forcing it into request/task state. Its main cost is lateral movement among lanes. Shared rows, breadcrumbs, contextual links, and preserved collection state mitigate that cost.

### 2. One pipeline board

A single board presents Proposed → Planned → Active → Review → Done. It makes forward motion obvious, but treats imported historical packets, roadmap hypotheses, and executable work as if they share one state machine. It also makes cancelled/superseded evidence and source conflicts awkward.

Keep a compact pipeline summary on Overview or a Work landing page later if it helps orientation. Do not use one board as the record authority for this slice.

## Navigation and responsibilities

```text
Work
├── Requests & proposals — change intake and interpretation
├── Plan                 — prioritized intended work and dependencies
├── Active               — authorized/running/blocked executable work
├── Reviews              — exact artifacts awaiting/retaining judgment
└── History              — completed/cancelled/superseded work and assertions
```

Reviews owns the judgment stage in Work navigation. Its detail remains an independent URL and domain record because artifact identity, evidence, annotations, acceptance, and staleness outlive an execution attempt. Release remains separate authority. Design links directly into a review when an exploration is the artifact under judgment; Overview links to reviews needing attention.

Plan owns intention, prioritization, dependencies, and readiness. Active owns executable task/run state. History owns what happened or what trusted sources assert happened. Moving a plan between horizons does not authorize it. Historical import never synthesizes a request, authorization, attempt, review, or acceptance.

## Interaction contracts

- Collection URLs always show comparable rows, including with one record. Detail is a distinct URL. Reload preserves identity; visible Back returns to the originating lane. Browser Back/Forward follows the same path.
- New planning item is a full draft destination because its outcome, dependencies, provenance, and revision impact can grow. Draft text survives reload. Save creates only a plan revision; a separate action prepares executable work.
- Reconciliation is a review destination. It compares source assertion, proposed object, provenance, conflict, and action before apply. It names what will and will not be created.
- Changed source or target revision invalidates the preview and blocks apply. Conflict is preserved for judgment rather than resolved by file date alone.
- Empty explains the lane and offers its scoped creation action. Unknown/error never renders as zero. Many records report total/order and later need filter/pagination acceptance; the prototype exercises 24 rows without claiming production scale.
- Missing IDs retain the requested identity and never substitute another record. Stale details remain readable with their consumed inputs and reassessment path.
- Narrow layout moves project navigation and Work lanes above content, preserves labels, and makes wide provenance tables keyboard-scrollable.

## Representative records

- B-02: source-backed historical completion within its recorded local boundary; no invented past run.
- B-03: planned and blocked; planning does not authorize it.
- D-02: real submitted portal work linked to existing event history.
- D-03: real currently running work.
- REV-D01E: scoped design judgment; not a product build acceptance.

These records are realistic inputs. The executable prototype remains a fixture and never reads or changes the portal database.

## Scoped review questions

1. Does Work with Plan, Active, Reviews, and History match how the owner expects the request → build → review pipeline to behave?
2. Is the B-02/B-03 distinction clear enough to trust imported history and future plans?
3. Does the detail show enough provenance and lifecycle separation without sending the owner back to raw source files?
4. Is “Review imported work” an understandable checkpoint before a bounded migration?
5. Is any lane unnecessary or better expressed as a filter on one collection?

Owner selection of this interaction direction is required before PW-01 implementation. Visual polish, full review behavior, Product/Design destinations, and project creation remain outside this selection.

