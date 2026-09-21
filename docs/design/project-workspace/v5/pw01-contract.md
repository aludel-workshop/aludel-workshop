---
id: project-workspace-v5-pw01-contract
kind: implementation-readiness-contract
status: proposed-owner-review-pending
updated: 2026-09-20
---

# Revised PW-01 boundary: plan core and owner steering

PW-01 should implement the smallest coherent shared record foundation and two owner-facing projections. Intake and real Agent Operations follow as separate slices because their authorities and dependencies differ.

## PW-01A — shared plan graph, Development Plan, and Work Overview

### Domain records

- `plan_nodes`: project-scoped stable identity and kind (`phase`, `outcome`, `feature_cluster`, `work_item`), current revision, lifecycle, and currency.
- immutable `plan_node_revisions`: title, intent, horizon/phase, priority, progress basis, health assessment, and author/source.
- typed `plan_edges`: primary parent, contributes-to, depends-on, blocks, and related-to. Enforce project scope and reject cycles for hierarchical edges; dependency cycles remain representable but visibly invalid for queue eligibility.
- `foundation_bindings`: exact Product/Design/source record identity and revision consumed by a plan revision, plus scoped reassessment state and resolution.
- existing `work_items` remain the executable task authority; `plan_work_links` link identities without copying proposal, authorization, event, or attempt state.
- reconciliation batch/mapping records from the D-03 contract remain for a bounded reviewed bootstrap import.

The first read model supplies the outline, dependency projection, work detail, and Overview action/outcome/capacity summaries. It preserves work history and run history as different streams.

### API and consistency rules

All routes carry a project identity and enforce it below the UI. List/get/create/revise operations use expected revision. Normalized no-op saves create no revision. A conflict retains the owner's draft. Mutations append durable events.

Proposed routes are project-scoped plan list/get/create/revise, edge create/delete, foundation-bind/reassess, projection queries, and reconciliation preview/apply. Overview is a derived query, not a second set of records. Queue eligibility may be calculated for inspection, but PW-01A cannot claim, authorize, or start work.

Changing a Product/Design revision marks only exact consumers for reassessment. Reassessment is explicit and optimistic. Dependency projection, outline, Overview, and detail must agree on item identity and currency within one read snapshot.

### Authorization and migration

Plan editing and reconciliation preview/apply are authenticated owner product-record operations. They never authorize execution. Existing task authorization stays in the supervised workflow. No external effects, release, provider setup, or worker action is in PW-01A.

Implementation authorization may cover code, local schema migrations, and disposable tests. Applying the bounded owner-data reconciliation requires an exact reviewed manifest in the work scope or a separate authorization. The first proposed batch is B-01, B-02, B-03A/B, D-02, D-03, and D-04 only. Preserve source wording, evidence, and real task links; create no synthetic request, authorization, attempt, review, acceptance, or completion event.

### Minimum evidence

1. Two projects can reuse local keys, while cross-project node, edge, binding, and task-link operations fail.
2. Outline/map/detail/Overview preserve exact identity, selected item, collapse aggregates, reload/return, and current-vs-stale source state.
3. Native create/revise/no-op/conflict behavior and dependency-specific reassessment pass transactionally.
4. Dependency cycles are visible and excluded from an eligible queue; priority alone never creates eligibility or authorization.
5. Reconciliation preview/apply/replay/changed-source/changed-target/rollback checks preserve existing workflow counts and events.
6. Empty, one, several, 24, unknown, error, stale, keyboard, 390 px, and accessibility checks pass from the owner entry URL.

## Later authorized slices

**PW-01B — Intake and triage** adds raw signal identities, grouping/backlinks, duplicate/link/defer/archive/clarify dispositions, recurring triage due policy, and proposal creation. It may propose plan changes but cannot create or authorize tasks. It follows PW-01A because proposed changes need stable plan targets.

**B-03C — Agent Operations projection** remains under B-03 because a truthful queue and capacity view needs worker transport, configured capacity, leases/heartbeats/fencing, attempt events, recovery, and immutable candidate review. PW-01A may expose linked authorized-task state, but must not manufacture active/waiting/failure/review states from fixtures.

Product direction/roadmap authoring remains PW-02, design registry/rationale PW-03, contextual candidate inspection PW-04, and project setup PW-05. Their existing order remains, with PW-02/PW-03 consuming PW-01A foundation bindings.

## Readiness and stop conditions

PW-01A needs owner acceptance of the D-04 feature composition and a separately authorized implementation task. It is ready for implementation planning when that decision is current; code and live data changes are not authorized by D-04.

Return to design if the owner cannot distinguish outcome, feature cluster, work item, task, or attempt; if the outline/map conflict on identity; or if actions lack an authoritative return path. Stop implementation if project isolation is not enforced below the UI, scoped staleness cannot be proven, reconciliation cannot roll back, or the implementation requires inventing historical authority.
