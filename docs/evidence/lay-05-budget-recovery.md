---
id: lay-05-budget-recovery
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# LAY-05 durable run allowance and local recovery

## Scope and reference comparison

The owner asked to continue LAY-05 and compare the sibling `launch-lms-infra` Symphony setup. The sibling checkout's `main` was `bf270ce8c50ea3e99342819724510b56e4ae754b`, before its Symphony setup. Its locally cached `origin/main` at `dc2319105dd6ebf161bb3f9d47ce2a309195fedc` was inspected read-only, without fetching. At that revision, `symphony/WORKFLOW.md` sets one concurrent agent and 30 turns per run, retains workpads/workspaces across retries, and routes reviewed work through a SHA-bound owner gate. `symphony/README.md` explicitly says those bounds are **not a dollar budget**; pause persists through a marker and restart. `symphony/supervise.py` stops the orchestrator and evidence uploader together. These are code/documentation observations from that exact revision, not execution proof in this environment.

The transferable process improvement is to inspect a pinned revision and separate four limits before adopting a runner: concurrency, turns within one Symphony run, total runs for one authorization, and provider spend. Aludel already binds review to an exact SHA and owns the candidate snapshot. This pass adds a durable per-item run allowance and an explicit restart check. The reference's Jira authority, funded API key, merge/deploy workflow and host operations do not transfer to Aludel's local direct-tracker path.

## Implemented boundary

At coding Go, Aludel stores a default allowance of **three runs** with the attempt, across portal restarts. The trusted `before_run` hook reserves one run atomically before Codex starts. A failed or uncertain start still consumes its reservation; it cannot replay for free. `after_create` prepares and registers the workspace without consuming a run. An exhausted item leaves the Ready poll and appears Blocked on ID refresh, while its final reserved turn keeps access to the pinned bundle and candidate submission. Attempt status exposes `runsStarted` and `runLimit`. The owner candidate API includes a non-secret attempt summary, and the Work item shows reserved turns, an exhaustion message, and a deliberate continuation button when eligible.

The checked-in Symphony example sets `agent.max_turns: 1`. The Aludel tracker adapter rejects polling and ID refresh under any other value, so each reserved run can launch at most one Codex turn. This is a **turn-count ceiling**, not a token or dollar cap. The default of three is a conservative local implementation value, not an owner-selected product policy. An owner can now grant three more turns on the same pinned attempt, up to 12 total, while its workspace and inputs still match. The exact expected limit prevents duplicate clicks or stale requests; a person-authored Work log records the grant. Real-work dispatch stays off pending a live interruption trial and owner browser review.

## Checks and observed limits

- Disposable worker test: first reservation leaves the issue Ready; the second reservation is made through a restarted portal process while unfinished workspace edits remain; the third reservation withdraws Ready; a fourth returns 409; the final reserved run can still read its bundle and submit its candidate. The attempt count survives another portal restart.
- Existing attempt rows with unknown usage migrate as exhausted (`runs_started = run_limit = 3`); new Go-pinned attempts start at zero.
- Host-hook test: `prepare` registers without reservation; `start-run` reserves once and preserves edits in a reused workspace; an unrelated workspace is rejected.
- Focused Node tests pass 3/3, including the owner API summary before and after candidate submission, owner-only exact-limit reauthorization, and resumed dispatch on the same workspace. Angular typecheck passes with two existing unrelated warnings. Pinned Elixir overlay compiles. A no-network adapter check returns `{:ok, []}` with one turn per run and `{:error, :aludel_requires_one_turn_per_run}` with two.

This proves the local persistence and hook/adapter contract. It does not prove that a real interrupted Codex turn resumes safely under Symphony, that spend is bounded, or that the owner can review the result in a browser.

## Retrospective

1. The reference's 30-turn limit and our own live continuation showed how easily a per-run value can be mistaken for a global authorization limit. The confusing unit was the main source of risk.
2. A repeatable preflight should inspect the actual loaded workflow and require one turn per run; the adapter now enforces this on every tracker read. Keep the run reservation and workspace edit checks in the disposable regression.
3. A persistent allowance belongs to Aludel's Go-pinned attempt, not Symphony's transient run. This changes the remaining roadmap from “invent a global turn counter” to “prove interrupted live continuation and owner review of the reauthorization experience.”
4. A killed in-flight model turn may have an uncertain outcome. The next live trial must use a very small disposable task, preserve its workspace, and count any interrupted run as spent; owner browser review remains a separate gate.
5. The process change was applied to this pass: revision-pinned comparison led to the explicit four-limit checklist and the test killed/restarted the portal mid-attempt. The successful local test supports the persistence contract. Real Symphony/Codex recovery remains a hypothesis until a supervised live interruption trial.
