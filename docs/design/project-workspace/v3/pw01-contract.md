---
id: project-workspace-v3-pw01-contract
kind: implementation-readiness-contract
status: proposed
updated: 2026-09-20
---

# PW-01 project-scoped implementation contract

## Domain boundary

Add explicit relational records rather than a generic entity table:

- `plan_records(project_id, id, current_revision_id, lifecycle, currency, created_at, updated_at)` with a composite project-scoped identity;
- `plan_revisions(plan identity, revision, title, outcome, horizon, priority, readiness, author/source, created_at)`;
- `source_assertions(project_id, logical_key, source document/revision/hash, anchor, claim, confidence, recorded_at)`;
- `reconciliation_batches(project_id, id, input_digest, status, previewed_at, applied_at)` and immutable mapping rows;
- typed `plan_dependencies` and `plan_work_links`, where a link to an existing task never copies its authorization/events.

Migration specifics may adjust column names, but must retain these authorities. Existing `work_items` remain the executable workflow authority. Existing imported source revisions remain evidence. Plan lifecycle and task execution state are separate.

## API rules

All read/write routes carry an explicit project slug or ID and verify it against every target. Listing never returns another project's rows. Local keys may collide across projects. Create/revise uses expected revision; conflict retains the draft. Normalized no-op saves return unchanged and do not create a revision or stale consumers.

Proposed operations: list/get/create/revise plan; preview reconciliation; apply exact preview; list provenance/backlinks. Applying a preview checks its source hashes, target revisions, project, and digest in one transaction. Replay of the same applied digest is a no-op. A new digest is a new review. Failure commits neither partial target records nor success state.

The first production batch is B-01, B-02, B-03A, B-03 and the D-02/D-03 work links. It excludes the rest of M0, decisions, designs, prototypes, and all fabricated workflow events. Owner review confirms the exact manifest before live apply.

## Authorization boundary

Plan create/edit and reconciliation preview/apply are authenticated owner product-record operations. They do not grant execution eligibility. Preparing work still snapshots current proposal/decision inputs; authorizing it remains the existing explicit operation. Imported or linked records cannot invoke owner-only workflow operations.

No live migration runs as part of D-03. PW-01 implementation authorization permits code, local schema migration and disposable tests; applying the first batch to the owner's live database must be named in that scope or separately authorized after a reviewed preview.

## Minimum implementation evidence

1. Two projects use the same local plan ID; cross-project list/get/update/link attempts are rejected.
2. Empty, one, several, 24, unknown/error, missing and stale fixtures; list/detail/reload/return and keyboard/narrow checks.
3. Native plan creation/revision, no-op save, retained conflict draft, and dependency-specific staleness.
4. Exact reconciliation preview/apply, identical replay, changed source, changed target, duplicate logical source, conflicting completion, broken evidence, no original request, injected mid-batch failure, backup/restore.
5. B-02 appears as `recorded-complete` with evidence; B-03 appears planned/blocked; D-02 links to its existing task; counts of requests, authorizations, attempts and reviews are unchanged by import.
6. Existing proposal/decision/work deep links continue to resolve. Migration and application source/build hashes bind the evidence; Git identity remains a blocker for broader source-review claims.

## Stop conditions

Return to design if owner cannot distinguish plan/history/active/review, if imported provenance is too technical to judge, or if a lane lacks a clear primary job. Stop implementation if project scoping cannot be enforced below the UI, rollback is unproven, or source conflicts cannot remain unresolved safely. Do not extend PW-01 into the full review engine, design registry, automated runner, project scaffolding, or external provider work.

