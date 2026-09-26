---
id: lay-05-symphony-alignment
kind: design-evidence
status: partial
updated: 2026-09-25
---

# LAY-05: align coding runs with Symphony

## Finding

The owner's Symphony clarification matches the accepted [ADR-008](../decisions.md#adr-008--task-driven-m1-with-a-symphony-worker-and-aludel-queue). The preceding proposal for an Aludel-owned coding-agent tool loop would duplicate the selected orchestrator. No such loop was built. The existing detached candidate worktree remains an Aludel review artifact boundary; Symphony's per-issue workspace and Codex App Server session must be the execution boundary.

The upstream [specification](https://github.com/openai/symphony/blob/main/SPEC.md), checked 2026-09-25, assigns issue polling, bounded dispatch, workspace lifecycle, retries and reconciliation to Symphony. Its issue adapter reads active-state candidates and refreshes issue IDs before dispatch and during reconciliation. The current [Elixir reference README](https://github.com/openai/symphony/blob/main/elixir/README.md), checked the same day, lists Linear, GitHub Issues, Jira Cloud, Asana and GitLab adapters; it does not list Aludel. The reference implementation calls itself evaluation-only. The prior pinned [R-06A inspection](r-06a-symphony-inspection.md) identifies missing portal-owned durable events, candidate preview and exact-build review. These are source-backed capabilities and gaps, not a live integration test in this environment.

## Applied boundary and check

`server/symphony-readiness.mjs` projects an authorized work item to Symphony's normalized Issue shape. It requires a Go-snapshotted running batch, a claimed and unskipped item, no blockers or open question, the matching agent profile and coding action, a pinned Aludel context bundle and matching repository commit. Its description exposes stable IDs and digests, not a copy of private knowledge. It has no tracker writer or dispatch effect.

The focused test passes (1/1) and checks that draft/stopped batches, live additions outside the Go snapshot, skipped or blocked work, a mismatched profile, missing action permission, stale repository base, and missing action revision cannot become eligible. This is an applied contract check. It does not prove Symphony consumed an issue, authenticated through Codex, or produced a candidate.

## Next integration proof

1. The owner clarified that Linear/Jira should be optional synchronized views. The [adapter note](../design/lay-05/symphony-adapter.md) recommends an Aludel tracker adapter, now accepted in ADR-008. Aludel remains authoritative for Go and readiness.
2. Prepare a versioned `WORKFLOW.md` and an agent-scoped context/result tool. The existing PP-01R editor bridge is person-scoped and read-only; it cannot yet serve solo agent work.
3. On a disposable project, prove a Go-authorized issue is detected once, a withdrawn issue stops, a restarted Symphony reconciles without duplicate acceptance, and a Codex-produced commit appears as a candidate for human review.
4. Add preview/check evidence and exact-commit acceptance before enabling live batches. No external tracker account, provider call, or deployment was used in this checkpoint.

## Retrospective

The harder part was an assumption mismatch: the candidate foundation invited a new coding executor even though the accepted architecture had selected Symphony. Checking the decision register before implementing the runner exposed it. The process change applied now is to require an orchestration-boundary check before adding an agent action; the provider-neutral projection test exercises the first boundary. Whether the complete gateway avoids duplicate dispatch and preserves review identity remains a hypothesis until the disposable Symphony trial. The queue choice is resolved: Aludel is authoritative and Linear/Jira are optional. Live adapter conformance and dispatch/recovery evidence remain open. No further roadmap change is needed beyond the corrected LAY-05 handoff.
