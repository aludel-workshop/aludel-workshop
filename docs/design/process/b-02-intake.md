---
id: b-02-intake
kind: implementation-readiness
status: ready
updated: 2026-09-20
packet: B-02
---

# B-02 proposals, decisions, and dependencies intake

## Outcome and scope

Turn a saved owner request into a versioned proposal; represent consequential questions as versioned decisions; bind downstream plan/build records to the exact decision revision they consumed; and make a changed answer stale only the linked dependents. This packet does not authorize or model execution attempts, external connectors, previews, review acceptance, or release.

The established project navigation, decision-detail hierarchy, affected-work summary, explicit-save semantics, and retained history are accepted inputs. B-02 adds Decisions as a real destination and uses the existing Work destination only to inspect dependency state; B-03 will add executable task authorization.

## Record boundary

| Record | Mutable identity | Immutable revisions / relationships |
|---|---|---|
| Change proposal | project, current revision pointer, lifecycle status | title, intent, acceptance examples, assumptions, exclusions, source request |
| Decision | project, current revision pointer, open/answered status | question, context, options, recommendation, answer, rationale, author and timestamp |
| Downstream record | project, kind (`plan` or `build`), currency | revision and status; explicit dependency bindings |
| Dependency | decision → downstream record | required flag and exact decision revision consumed by the downstream record |

A decision answer is never updated in place. Saving creates the next decision revision in one transaction, updates the decision pointer, and marks only dependencies bound to an older decision revision stale. Unlinked records do not change. A stale record stays inspectable and names the decision/revision mismatch. Reassessment is explicit and records the new consumed revision; it is not automatic approval.

## Representative fixture

Aludel has one native proposal for moving mutable product records into the portal, one consequential storage-authority decision, one linked B-02 plan, and one unrelated B-03 groundwork plan. The fixture is created idempotently on startup only when absent. It is product data for exercising the real information-system behavior, not evidence of an owner answer to an unresolved external-effect question.

## Acceptance checks

1. A saved owner request can create proposal revision 1 without starting work.
2. Editing a proposal creates revision 2 and retains revision 1.
3. Answering or changing a decision creates a new immutable revision with author/rationale and stays on the decision detail.
4. The linked plan becomes stale and names the old/new decision revisions; the unrelated plan stays current.
5. Explicit reassessment binds the linked plan to the current decision revision and restores currency without starting execution.
6. Conflict-safe writes reject a stale expected decision revision and preserve the submitted draft in the UI.
7. State survives server restart; desktop/narrow browser flows and scoped axe checks pass.

## Stop condition

Stop when these records and checks work through the authenticated local portal. Route exact Go scope, preview evidence sufficiency, provider reconciliation, attempts, artifacts, and review controls to B-03.
