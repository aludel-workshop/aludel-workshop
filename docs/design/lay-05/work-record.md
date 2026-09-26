---
id: lay-05-work-record
kind: work-record
status: partial
updated: 2026-09-25
---

# LAY-05 coding agents

## Authorization and scope

On 2026-09-25 the owner said “continue with lay 05,” after explicitly shelving the end-to-end feature trial until the remote-style editor connection was running. This authorizes bounded local research, design, repository edits, and checks for LAY-05. It selects LAY-05 ahead of PP-01C. It does not authorize live provider calls, new spending, GitHub writes, public deployment, release, or acceptance. Preserve the uncommitted PP-01R editor bridge work.

## Entry assessment

Existing Work batches can authorize structured knowledge drafts, but `platform.implement` is not runnable. The runner has no isolated code workspace or candidate review contract. The generated-project preview manager serves the shared workspace, so building a candidate there before review would bypass isolation. A coding run needs a pinned base commit, isolated workspace, bounded action permissions, test/build evidence, an immutable candidate identity, and an explicit review step before the project workspace changes. B-03B stale-input recovery and owner validation remain prerequisites to restoring portal-only dispatch.

## Dependency order

1. Define and test isolated candidate lifecycle, including clean-base and path restrictions, cancellation/restart behavior, evidence, and cleanup.
2. Project Go-authorized batch items into Symphony-eligible work with pinned context and profile routing. Build the gateway around upstream Symphony and Codex App Server under ADR-008; do not add a competing model/tool loop to `agent-runs.mjs`.
3. Give Symphony isolated project workspaces and a narrow Aludel context/result tool boundary; persist attempts/events outside Symphony. Expose the candidate diff, checks, preview, and accept/send-back flow in Work; keep release promotion separate.
4. Run a disposable owner-style cycle and record evidence plus retrospective before marking LAY-05 complete.

## Readiness verdict

Ready for local groundwork and implementation under chat authorization. No live coding-agent run or production effect is authorized. The current runner and preview path do not yet meet LAY-05 acceptance.

## 2026-09-25 implementation checkpoint

The isolated candidate module, authenticated read-only API, and three disposable Git lifecycle tests are in place. [Evidence and retrospective](../../evidence/lay-05-candidate-foundation.md). The path restrictions and pinned base were exercised; the full coding run and candidate preview remain unbuilt. Keep LAY-05 active and `platform.implement` gated.

## 2026-09-25 Symphony correction and renewed authorization

The owner said: “before we dive too deep in, check out openais symphony, its our basis for all of this. we're essentially using aludel to compose the rules and knowledge for the agents, and mark different batches of work ready for different agent types: then when symphony detects any ready, it can orchaestrate the agents.” This authorizes local research and design correction during the active LAY-05 build. It does not authorize an external tracker write, provider spend, or unattended live run. The interrupted turn had made no repository edits.

This restates accepted ADR-008. The earlier proposed custom container tool broker and direct provider-call loop would duplicate Symphony's orchestration and is removed from the implementation path. The candidate worktree and immutable review evidence remain useful at Aludel's artifact/review boundary; they must be integrated with Symphony's per-issue workspace lifecycle, not treated as a second scheduler.

Current upstream [Symphony specification](https://github.com/openai/symphony/blob/main/SPEC.md) and [Elixir reference README](https://github.com/openai/symphony/blob/main/elixir/README.md), checked 2026-09-25, confirm tracker polling, active-state eligibility, per-issue workspaces, Codex App Server turns, repository-owned `WORKFLOW.md`, retries and reconciliation. The implementation includes Linear, GitHub Issues, Jira Cloud, Asana and GitLab adapters. A direct Aludel tracker adapter is permitted by the specification but is not included in the reference implementation. Symphony does not own Aludel's authorization, durable attempt/event history, candidate preview, or exact-commit acceptance; those stay in Aludel. Its reference implementation describes itself as evaluation-only software, so deployment isolation and recovery still require local proof.

### Proposed boundary to test

1. **Aludel owns readiness:** a queued or staged item is not execution eligible. Go snapshots and authorizes a batch; only its claimed, unskipped, unblocked items are projected as active. Stopping, skipping, changed inputs or loss of authorization withdraw eligibility. A provider-neutral projection is the contract before a tracker adapter is chosen.
2. **Symphony owns orchestration:** it detects eligible work through its tracker adapter, schedules by profile capacity, manages Codex App Server sessions and per-issue workspaces, and reconciles state. One profile route must not race another for the same work item. The existing short structured-draft runner remains separate until a deliberate migration prevents dual dispatch.
3. **Aludel supplies context and rules:** the issue carries a stable work identity and a pinned bundle reference, not a full copy of private knowledge. `WORKFLOW.md` supplies the versioned general workflow; a scoped Aludel tool/bundle supplies current project, role, action, profile, story, data and feedback context. The existing editor bridge is person-scoped read-only and does not yet grant a solo agent this access.
4. **Aludel owns results:** the gateway persists attempt and event identity, validates the candidate commit/checks/preview, and moves the work to review. Symphony's live status or a tracker transition alone never constitutes acceptance. Review binds to an exact candidate commit; release remains separate.

The owner wants optional Linear/Jira synchronization without changing Aludel Work. The [adapter note](symphony-adapter.md) recommends that Symphony poll Aludel directly, while retaining the rest of ADR-008. The owner subsequently accepted this amendment. The provider-neutral readiness projection and contract tests cover Go, skip, stop, stale input and profile routing; no provider-specific write path has been built.

The [Symphony alignment evidence](../../evidence/lay-05-symphony-alignment.md) records the provider-neutral readiness projection and focused test.

## 2026-09-25 owner decision and build authorization

The owner answered “yep, go” to the concrete proposal to amend ADR-008 so Aludel is Symphony's tracker and to build that adapter. This authorizes the bounded local ADR, worker API, adapter, contract tests, and disposable trial. Linear/Jira remain optional synchronization connections. No live Codex run, provider spend, external tracker write, or public deployment is authorized by this answer. Preserve the existing uncommitted PP-01R and LAY-05 changes.

## 2026-09-25 direct tracker checkpoint

ADR-008 and architecture now accept Aludel as Symphony's tracker. A project owner can issue or revoke a one-time project/profile worker token; only its hash is stored. The portal serves eligible issues, ID refresh and active pinned bundles under that token. Coding stage/Go is separate from the structured provider runner and is disabled unless `MACHINE_SYMPHONY_DISPATCH=1` plus a paired profile. At Go it snapshots the batch and context/repository commit. Changed work, guidance, shared docs, source revisions or repository state withdraws Ready; ID refresh returns a non-dispatchable Blocked/Stopped issue for Symphony reconciliation. Active Symphony batches survive portal restart. A pinned Elixir adapter overlay and tested host-side workspace hook are in `integrations/symphony`; the adapter cannot yet be compiled here. [Evidence and retrospective](../../evidence/lay-05-symphony-worker.md).

The flag stays off: no live Symphony/Codex run, workspace attachment, durable result intake, candidate preview or exact-commit review was proved. These remain the next LAY-05 work, not a completed packet.

## 2026-09-25 continuation: result boundary

The owner asked whether anything is needed before continuing. The earlier LAY-05 chat authorization covers the next bounded local pass: durable attempt/event intake, binding Symphony's existing workspace to a review candidate, and disposable checks. This pass will keep the dispatch flag off and will not invoke Codex, an external tracker, a public preview or release. The process gap to address first is that the current candidate module assumes Aludel created a second worktree, while Symphony owns its own workspace; result intake must validate and register that workspace without mutating the shared repository or accepting agent claims as verification.

## 2026-09-25 local result and review checkpoint

The owner instructed continuing until complete or blocked. The result boundary, independent candidate Docker preview and exact-commit Work acceptance path were built and checked with a disposable owner-style cycle. [Evidence and retrospective](../../evidence/lay-05-result-preview-review.md). The check distinguishes Symphony's workspace, the agent's reported checks, Aludel's independent build/health evidence and owner acceptance. The shared project moves only on explicit candidate acceptance; release remains separate. LAY-05 remains partial because the compiled pinned Elixir overlay has not run under Symphony, a real Codex run is not authorized, and live interruption/browser review need proof. Keep `MACHINE_SYMPHONY_DISPATCH` off.

### Current blocker for completion

The remaining meaningful proof requires starting pinned Symphony with `MACHINE_SYMPHONY_DISPATCH=1` on a disposable project and allowing a supervised Codex App Server turn. Earlier owner authorization explicitly excluded live provider calls and real owner acceptance, so this execution cannot be inferred from the local build instruction. The exact next trial is one Go-authorized coding item, one agent turn, submission, isolated preview, owner browser review, then stop/restart recovery; keep external deployment and release out of scope. The adapter itself now compiles under the pinned upstream revision, its example workflow validates, and both host-side tools pass a local HTTP mock. No further local-only prerequisite has been identified.

## 2026-09-25 supervised live trial authorization

After reviewing the local result, the owner replied “go” to the specific request for **one supervised Codex App Server turn on a disposable project** to test real Symphony dispatch and submission. This authorizes that single provider-backed local trial and its necessary disposable portal/Symphony setup, observations, local checks, and cleanup. It does not authorize a second agent turn, provider billing changes, real-project acceptance, external tracker writes, public deployment, release, or production credential movement. Record only metadata and redacted outcomes; never print or persist worker/Codex credentials in repository evidence. Keep the shared Aludel project and current uncommitted edits out of the agent workspace. The trial must stop if the intended single turn is reached or the owner-scope guard is lost.

Preflight finding: the installed `codex-cli 0.116.0` rejects the current user configuration before `codex login status` because `service_tier = "default"` is not accepted by that CLI version. Use an isolated temporary Codex configuration override or a compatible CLI version for the trial; do not edit the owner's global configuration. This is a reusable preflight check for future Symphony host setup.

## 2026-09-25 supervised trial checkpoint

The authorized disposable run created a clean Git project and Go-authorized `W-1`, then started pinned Symphony with the Aludel tracker. The first startup attempt stopped in `after_create` because the disposable harness omitted `ALUDEL_WORKER_URL` and `ALUDEL_SOURCE_REPOSITORY`; no Codex process had started. The harness was corrected and rerun. Symphony polled the issue, the host hook cloned the pinned commit and registered the durable attempt, and Codex App Server started once. Symphony then failed before any candidate submission. The workspace stayed clean at the pinned base; the attempt has only `workspace-ready`, no turn event or candidate. The single-start guard stopped any retry from launching a second Codex App Server process, and all trial processes were stopped. No shared project commit moved. The owner-authorized live trial is therefore spent; do not infer another coding turn from it.

The installed `codex-cli 0.116.0` reported a model-catalog decode error (`unknown variant max`) during App Server startup and a missing system bubblewrap warning. A separate no-turn protocol check returned successful `initialize` and `thread/start` responses with model `gpt-6-sol`; it did not prove `turn/start` or model execution. The exact run failure was not retained because the temporary Symphony checkout's rotating log path was unwritable, and the terminal output was truncated. Treat CLI/catalog compatibility and log capture as preflight gaps, not as proven root cause. The next safe work is to make those checks and diagnostics repeatable without another provider turn; a further live coding turn requires renewed owner authorization.

A later read-only package check found `@openai/codex` 0.157.0. It was installed in `/tmp` without changing the owner CLI or configuration. Login status and a no-turn App Server `initialize`/`thread/start` handshake passed using the existing account and `gpt-6-sol`. This improves the next setup but does not authorize or prove a second coding turn.

## 2026-09-25 second supervised turn authorization

The owner replied “go” to the concrete request for **one additional supervised Codex turn on a disposable project**, using the isolated newer CLI and writable retained logs to diagnose or complete submission. This authorizes that one local provider-backed retry and its setup, inspection, independent checks, and cleanup. It does not authorize further agent turns, real-project acceptance, public deployment, release, external tracker writes, or billing changes. Preserve the Aludel working tree and credentials. Stop once the single turn finishes or fails; Symphony retries must not launch another Codex turn. Record redacted observations only.

## 2026-09-25 second supervised turn result and correction

The one additional authorized Codex turn ran under pinned Symphony and isolated `codex-cli 0.157.0`. Codex received the pinned context, edited a disposable blog API, and passed four tests. Its sandbox made `.git` read only, so it could not commit in Symphony's registered clone. An alternate clone's commit was correctly rejected by Aludel (HTTP 409). Symphony completed turn 1/1 and then scheduled a new run because the issue remained Ready; the independent launch guard prevented another Codex process. The retained log and Codex final message identified this boundary. [Evidence and retrospective](../../evidence/lay-05-live-turn-host-commit.md).

The local correction adds `aludel_commit_candidate`: the trusted host validates changed paths and the pinned base, commits in the registered workspace, then uses the existing exact-commit submission validator. Focused tests, pinned Elixir compilation, a tool HTTP mock, and operator-assisted submission of the real agent files to an isolated Docker preview passed. This proves the correction's local path and the preview, not agent use of the new tool. The authorized live turn is spent. Keep LAY-05 active and dispatch off until direct agent submission, owner browser review, and interruption recovery have live evidence. The next live provider turn requires renewed owner authorization.

## 2026-09-25 third supervised turn authorization

The owner replied “go” to the concrete request for **one further supervised Codex turn on a disposable project** to prove direct agent use of `aludel_commit_candidate` after the host-side correction. This authorizes the single local provider-backed turn, necessary disposable portal/Symphony setup, candidate/preview checks, redacted observation and cleanup. It does not authorize another turn if the issue remains Ready, owner acceptance, external tracker writes, public deployment, release, billing changes or real-project credential movement. Use the independent one-process guard because Symphony's `max_turns` does not cap continuation runs. Preserve all existing repository edits and keep the agent in its disposable clone.

## 2026-09-25 third supervised turn result and retention correction

The authorized single Codex turn called `aludel_task_context` and `aludel_commit_candidate` itself. The host committed the disposable blog API in Symphony's registered workspace; Aludel recorded the candidate and a submitted attempt. An isolated Docker preview passed health, list, create, invalid-input, and portal-host isolation probes, while the shared source HEAD stayed at the Go-pinned base. This proves direct agent-initiated submission. [Evidence and retrospective](../../evidence/lay-05-agent-submission-snapshot.md).

The trial then exposed a separate review failure: Symphony deleted its terminal workspace, so the candidate detail route returned 409 from a missing Git path even though its preview was healthy. The candidate was not accepted. The agent's three test claims also became unnamed `skipped` entries because the dynamic tool schema permitted arbitrary check objects. Aludel now stores an exact-commit Git snapshot before acknowledging submission, and the tool/worker require named status-bearing check objects. Focused tests delete the Symphony clone after submission, restart the portal, and exercise detail, preview, and exact-commit acceptance from Aludel's retained snapshot. The updated Elixir schema compiles against the pinned checkout. These corrections are locally checked but were made after the authorized live turn; their real Symphony behavior still needs proof. Keep LAY-05 active and dispatch off. Owner browser review, interruption recovery, and a durable global turn budget remain open.

## 2026-09-25 bounded tiny live retest authorization

The owner said “go” and explicitly authorized **up to three further supervised Codex turns if needed**, provided each task is very small. Use a disposable project and begin with one tiny `GET /api/posts` endpoint change. Use any additional turn only when a concrete remaining LAY-05 live check needs it, and keep each task very small. This authorization includes local Symphony/portal setup, scoped agent execution, retained-candidate review/preview checks, redacted evidence and cleanup. It does not authorize public deployment, release, real-project acceptance, external tracker writes, billing changes, or moving production credentials. Record the actual turn count. Keep an independent one-process guard for each run because Symphony can schedule continuation runs after `max_turns`. Preserve all existing repository edits and keep agent writes in disposable clones.

## 2026-09-25 tiny live retest result

One of the three permitted tiny turns ran. Codex used `aludel_commit_candidate` to submit a `GET /api/posts` change on a disposable project. After Symphony deleted its workspace and the portal restarted, Aludel's exact-commit snapshot still supplied candidate detail and diff, named passed agent checks, and an isolated preview. The shared project HEAD did not move; Work reached review. An independent test of the retained snapshot passed. [Evidence and retrospective](../../evidence/lay-05-live-retention.md). This resolves the live retention and structured-check gaps. Owner browser review, live interruption recovery, and a durable global turn budget remain; keep LAY-05 partial and dispatch off for real work. No further provider turn is needed for the retention check.

## 2026-09-25 Launch LMS infra comparison and continuation authorization

The owner asked to keep going and specifically compare the sibling `launch-lms-infra` Symphony setup. This authorizes read-only comparison of that repository and bounded local LAY-05 process, design, code, and test changes. Do not edit the sibling repository, fetch its secrets, deploy, or start a new provider-backed turn merely to make the comparison. Its checked-out `main` is `bf270ce8c50ea3e99342819724510b56e4ae754b` and does not contain Symphony; its locally cached `origin/main` is `dc2319105dd6ebf161bb3f9d47ce2a309195fedc` and contains Symphony. Cite the exact inspected revision. Assess the workflow and failure boundaries before adopting any pattern. Continue LAY-05's durable budget and recovery work using the smallest fitting contract.

## 2026-09-25 local budget and reference checkpoint

The current cached `launch-lms-infra` revision confirms persistent Symphony workspaces and an exact-SHA owner gate, and explicitly distinguishes its per-run turn setting from spend control. Aludel now reserves a default three one-turn runs durably at the trusted `before_run` boundary; the adapter refuses multi-turn workflow config. Focused tests cover exhaustion, submission from the last reserved run, database migration and portal restart with unfinished workspace edits. [Evidence and retrospective](../../evidence/lay-05-budget-recovery.md). This is local evidence, not a live interrupted Codex recovery or dollar budget. The owner Work view now shows the reserved turn count and exhaustion message. Its explicit continuation control adds three turns to the same pinned attempt, up to 12, with an expected-limit conflict check and retained workspace verification; owner-only HTTP and replay tests pass. The next LAY-05 step is a supervised tiny interruption/restart trial, followed by owner browser review. Keep real-work dispatch off.

## 2026-09-25 bounded live interruption trial scope

The earlier authorization allowed up to three very small supervised Codex turns; the retention retest used one. Two remain. The renewed “keep going” instruction selects live interruption recovery as the next LAY-05 check. Use only a disposable project and at most two additional Codex starts, each guarded independently of Symphony's retry loop. Interrupt the first after detecting a small workspace edit, then restart Symphony and allow one recovery turn. Stop if preflight fails, the workspace/input pin changes, a candidate is submitted before interruption, or the two-start guard is reached. Record redacted observations, do not accept or deploy, and keep real-work dispatch off.

## 2026-09-25 interruption preflight failure and retry scope

The first interruption fixture launched two Codex App Server processes, but both failed at `thread/start` before any model turn or file edit: the pinned Symphony schema supplied default approval `reject`, which isolated Codex CLI 0.157 rejects. The separate two-start guard blocked further Codex launches; three Aludel run reservations were conservatively consumed, and all processes were stopped. No candidate or model turn resulted. This is a preflight failure, not interruption-recovery evidence. `WORKFLOW.example.md` now explicitly uses accepted `approval_policy: never` with `thread_sandbox: workspace-write`; a no-turn `initialize`/`thread/start` handshake passed. The owner's allowance is measured in model turns, so two tiny turns remain unused. Retry on a fresh disposable project with a fresh two-start guard, stop at the first small edit, and permit at most one resumed turn.

## 2026-09-25 live interruption recovery result

The fresh retry used the remaining two permitted tiny turns. The first created a test file and was interrupted before submission. After Symphony restarted, the second resumed the preserved workspace, finished the tiny ping route, and submitted an exact-commit candidate through Aludel. The durable attempt recorded two of three runs, the retained snapshot independently passed its test, and the shared project stayed on the Go-pinned base. [Evidence and retrospective](../../evidence/lay-05-live-interruption-recovery.md). This resolves the live process-interruption gate. No authorized model turns remain. Owner browser review is the remaining LAY-05 acceptance gate; real-work dispatch stays off until that review.

## 2026-09-25 general work orchestration reassessment

The owner asked in chat for a design assessment before further coding: inspect the Symphony proof, Aludel's role/action/profile/batch model, the Work board, agent questions and review, scale, and an interactive human-plus-Codex path. This authorizes local inspection and a planning note only; it does not authorize implementation, another provider turn, real-work dispatch, external writes, or acceptance. The resulting [general work orchestration proposal](general-work-orchestration.md) is for owner review, not a change to LAY-05's current gate.

## 2026-09-25 manual task creation bridge

The owner explained that missing manual Work creation blocks useful user-flow review and asked for a generic task button with role/action and a manually written brief while preparing agents for every layer. This authorizes bounded local Work UI/domain edits, checks and documentation. The first pass must preserve the selected action as the permission boundary: a manual brief and checklist may add task intent and review criteria, but cannot grant tools or make an unsupported action runnable. This pass does not authorize another model turn, broad unattended dispatch, deployment or acceptance. Agent execution across all layers remains a separate contract and runtime milestone in the general orchestration proposal.
