---
id: pw-01a-work-implementation
kind: implementation-evidence-retrospective
status: complete
updated: 2026-09-21
packet: PW-01A
---

# Accepted Work composition implementation

## Implemented

The owner accepted v9 and authorized a bounded local portal build in [the selection record](../design/project-workspace/v9/selection.md). The Angular portal now provides four Work routes over existing portal records:

- Work Overview derives its attention stack and compact counts from real work items and requests.
- Development Plan uses the selected milestone-scoped table and links each row to the authoritative work-item detail. Existing downstream decision dependencies remain available below the table.
- Agent Operations sorts real work items into review, problem, running, queued, blocked and ready semantics. Cancelled work is hidden by default.
- Intake provides a real request list/detail view with optimistic-status checks for defer and return-to-untriaged actions.

The UI does not promote v9 fixture numbers into live claims. Agent connection state and server health render as unavailable; spend shows the repository's `$0` incremental-spend policy and says provider enforcement is unavailable.

The worker workflow now exposes input currency for every work item. A ready item with changed inputs offers **Refresh inputs**. Refresh captures the current proposal and answered decisions, increments the work-item version and returns it for renewed review; it does not authorize or start work. Open decisions route to Decisions and continue to block refresh. This replaces the terminal “prepare a new work item” experience for compatible changed inputs.

## Evidence

- Production build: passed under Node 24.
- Angular typecheck: passed without diagnostics.
- Server/domain suite: 3 files passed, including a new changed-input → refresh → re-review → authorize regression.
- Product-system check: 24 capabilities and 2 projects passed; no operational readiness inferred.
- Authenticated browser suite: passed all four Work routes, request → prepare → authorize → claim → question → answer → resume → submit, changed-input refresh without authorization, Intake deferral, wide/narrow axe checks, 390 px overflow and page-error monitoring.
- [Design QA](../../apps/portal/design-qa.md): passed after a combined source/implementation comparison found and corrected one P2 blocked-card token collision. Five final route/viewport pairs have screenshot evidence.

## Retrospective

1. **Friction:** the accepted mock used synthetic operations data while the running product has work/request/decision records but no milestone, capacity, server-health or provider-budget contracts. The earlier workflow could detect changed inputs but offered no safe in-place recovery.
2. **Next equivalent task:** classify every visible value as authoritative, derived, policy or unavailable before implementation. Pair stale detection with a safe repair transition in the domain contract, not only an error string.
3. **Downstream change:** milestone records and worker/server telemetry remain separate implementation work. The timeline projection stays deferred until authoritative dates exist. B-03 should reuse the input-currency and refresh semantics.
4. **Questions:** browser evidence must determine whether the implemented density and responsive composition preserve v9. Milestone progress denominators, connected-agent freshness, queue eligibility and enforced spend limits remain unresolved data contracts.
5. **Applied versus hypothetical:** truthful unavailable states, safe refresh, all primary interactions, responsive layout, accessibility and source-to-implementation visual fidelity are implemented and agent-checked. Owner usability and acceptance remain for owner review.

PW-01A is complete for its local implementation boundary. B-03B remains the next dependency for live worker transport, leases, recovery and immutable candidate review. Owner review may still create a bounded visual or interaction revision.
