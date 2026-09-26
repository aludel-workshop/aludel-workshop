---
id: lay-05-symphony-adapter
kind: design-note
status: partial-integration
updated: 2026-09-25
---

# Symphony should read Aludel's authorized work

## Owner requirement and recommendation

The owner wants one Aludel Work experience and optional Linear/Jira connections that synchronize the same tasks without changing that experience. **Aludel is Symphony's tracker**, confirmed by the owner on 2026-09-25. Linear is not required to back an Aludel project. Keep ADR-008's durable portal records, Symphony scheduling, Codex App Server, and exact-build review; its first queue is Aludel.

| Route | Benefit | Cost against this requirement |
|---|---|---|
| Aludel → Linear → existing Symphony adapter | Uses an included adapter, giving the quickest upstream smoke test | Every project needs a Linear account and reliable two-system sync before work can run. Go/stop/stale input can race the mirror. Jira becomes a second queue mapping. |
| Symphony → Aludel tracker adapter **(recommended)** | Aludel remains the execution queue and authority; Linear/Jira can be connected or absent without changing Work | Requires a narrow addition to the reference implementation (`tracker.kind: aludel`, config, adapter and tests) and a host-authenticated Aludel worker API. Maintain this patch against upstream. |
| Reimplement Symphony in Aludel | No Elixir dependency | Recreates scheduling, Codex App Server, workspace, retry and reconciliation behavior already selected by ADR-008. |

The current [upstream tracker boundary](https://github.com/openai/symphony/blob/main/elixir/lib/symphony_elixir/tracker.ex), checked 2026-09-25, is a small adapter interface: `fetch_issues_by_states`, `fetch_issues_by_ids`, optional host-side agent tools, credential-environment filtering, and config validation. The reference adapter map currently includes Linear, GitHub, GitLab, Jira, Asana and an in-memory test adapter, but not Aludel. The [specification §11](https://github.com/openai/symphony/blob/main/SPEC.md) explicitly permits a tracker object to be a card or board entry and requires full ID refresh before dispatch/reconciliation. A direct Aludel adapter therefore fits the spec; implementing it in the reference code is an inference, not a completed integration.

## Aludel worker API contract to build

- **Identity:** a machine credential scoped to project/profile and execution operations, stored on the Symphony host. It is not a browser session or PP-01R person's editor token. The adapter declares its secret environment names so the Codex child does not inherit the worker credential.
- **Read candidates:** `GET /api/worker/issues?states=Ready,...` returns only Go-snapshotted claimed items for this profile and scope. Pagination and a stable cursor are required. `GET /api/worker/issues?ids=...` refreshes exact opaque work IDs, including eligibility and authorization changes; a missing item means it is no longer visible. A poll result is never itself an authorization.
- **Issue:** stable `projectId:workId`, globally unique project/work identifier, priority, profile label, state and `dispatchable`. Description contains only a pinned context digest and repository commit. Stage, Next and suggested backlog do not expose an active state. A batch stopped or skipped is withdrawn before the next refresh.
- **Context:** a host-side `aludel_task_context` tool retrieves the exact saved bundle and current authorization verdict. It includes project/role/action/profile instruction revisions, targets, related knowledge, feedback and allowed tools. The agent can request scoped live reads and searches through host-side tools. No full knowledge copy or credential goes into Linear/Jira or the Codex child environment.
- **Result:** a host-side `aludel_submit_candidate` tool binds a commit, changed files, test/build evidence and preview identity to the authorized attempt. A result enters Work review only after Aludel validates the pinned base and action changes. Stop, stale inputs, missing checks or failed preview leave a visible unresolved state. Human acceptance is bound to the exact candidate commit; release is separate.
- **Events and recovery:** Aludel persists attempt ID, sequence, Codex thread/turn references, block/cancel intent, last acknowledged tracker refresh and artifacts. Symphony's live dashboard is operational telemetry, not the durable record. After restart, ID refresh and portal attempt records reconcile before another dispatch.
- **Workspace:** Symphony owns the per-issue working directory. Adapt `code-candidates.mjs` to register and validate that workspace's resulting commit rather than creating a second independent worktree. The candidate's review identity remains in Aludel.

## Profile and batch routing

Start one Symphony service with concurrency one for a single coding profile and a `WORKFLOW.md` in that project's repository. A profile route is an explicit scope, not a prompt hint. If profiles need different model, command, capacity or repository, use separate configured Symphony instances with disjoint profile labels; the portal prevents two instances from claiming one work item. General Work actions can migrate later, one action at a time, after the current structured-draft runner is retired for those actions. No item may be eligible in both runners.

A running structured Work batch still accepts newly staged items. The [readiness projection](../../../apps/portal/server/symphony-readiness.mjs) rejects those outside Go’s snapshot. A Symphony coding batch is pinned at Go and keeps its running state across portal restart; a new coding item cannot be staged into that batch for execution without another Go. Mixed coding/structured batches are refused at Go. The structured runner still has its own live-join behavior.

## Proof before activation

1. Pin an upstream Symphony revision, add the narrow Aludel adapter in an isolated integration checkout, and run its adapter conformance tests with a local Aludel stand-in. No Linear/Jira account is needed.
2. Prove poll → ID refresh → Go → dispatch exactly once; then skip/stop, stale input, restart and blocked-input recovery with disposable records and a fake Codex App Server.
3. Prove one real Codex sign-in and a disposable coding task in a project workspace. This is a separately authorized provider run, with no production credentials or external tracker writes.
4. Show diff, independent checks, isolated preview and exact-commit accept/send-back in Work. Keep release promotion separate.

## Decision status

The owner accepted the direct adapter on 2026-09-25. ADR-008 records the amendment. A local worker API, Go snapshot branch, HTTP contract test and pinned Elixir overlay now exist. The Elixir overlay has not been compiled or run against Symphony in this environment; the dispatch flag stays off. Result submission, Symphony workspace registration, durable events, preview and exact-commit acceptance remain open.
