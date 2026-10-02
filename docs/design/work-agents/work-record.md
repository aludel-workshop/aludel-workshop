---
id: work-agents-01-work-record
kind: work-record
status: in-progress
updated: 2026-09-26
---

# WORK-AGENTS-01: agents for Work actions across layers

## Owner direction and authorization

On 2026-09-25 the owner said that a manual LAY-05 browser review is difficult because Work cannot create arbitrary tasks, and that agents should be equipped to work on actions in every layer before the next user-story flow tests. The owner asked for a generic create-task control and a first usable setup, with UX details to be refined in later flow tests. This authorizes bounded local design, implementation and checks in Work and the agent contract. It does not authorize live provider turns, new spending, public deployment, external writes, release, or owner acceptance. Existing LAY-05 live-turn authorizations are exhausted.

## Readiness and process correction

The previous [general orchestration proposal](../lay-05/general-work-orchestration.md) put LAY-05 browser review first. The owner found that sequence impractical. The corrected order is to build manual task intake and an action-neutral execution/review contract, then use the improved Work flow to review the coding proof. The current create-task bridge is [implemented and agent-checked](../../evidence/lay-05-manual-task-creation.md); its visible browser scenario is unrun. It creates tasks for every role/action but does not run unsupported agent actions. This limitation must remain explicit in Work.

## Dependency order

1. Define enforceable action inputs, read/write capabilities, outputs, questions and review criteria using Vision edit, Data contract, code change, security audit and role review fixtures. Resolve which actions require a target and what constitutes a complete result. Preserve project-specific role/action revisions.
2. Compile a Go-pinned task manifest from action, item, profile and selected records. Use the same manifest for a person-paired Codex session and a solo agent. Reject changed inputs and unauthorized operations at the Aludel tool boundary.
3. Add durable attempt questions and typed submissions with multiple review artifacts, send-back and revision-bound acceptance. A draft alone does not complete record-changing work.
4. Run the security audit as the first non-code action through Symphony on disposable project data. Migrate the three direct-model actions after parity checks, keeping one eligible runner per action. Keep code candidates as one artifact type.
5. Add profile capacity and worker claim fencing; test two workers racing for one item before widening concurrency. Validate the Board at small and large batch sizes.
6. Return to the owner browser review of LAY-05 and the first user-story flow tests. Keep real-work dispatch gated until the owner validates the flow and its evidence.

## Acceptance evidence required

A person can create a task in each layer, pick its action and profile, see the exact runnable state, and start a bounded batch. An agent can read scoped project knowledge, ask a blocking question, submit action-appropriate evidence, and receive send-back. A reviewer can inspect and accept exact artifacts; record or code changes apply only through their checked boundary. A human-plus-Codex session can load the same task manifest. A two-worker race cannot duplicate a task. Record checks, live observations, limitations and a post-hoc before closing this packet.

## 2026-09-25 output-first clarification

The owner deferred LAY-05 browser review and reported a manually created security-audit item blocked because its agent action is not runnable. The owner proposed defining each layer by its primary outputs and the activity and internal methods that produce them, with evidence and decisions linked to artifact revisions. [Layer/output analysis](layer-output-model.md) records the proposed synthesis using SPEM, IDEF0 and PROV as reference vocabularies. The security audit is now the first non-code action fixture for contract design. This changes the next step from a generic manifest schema to an output ledger for representative actions, then the manifest. No runner or live agent capability was added in this research pass.

## 2026-09-25 session-contract scope

The owner directed WORK-AGENTS-01 to skip the deferred browser review and begin the contract definition: specify exactly what a solo agent receives on entry, its workflow, concise task guidance, and scoped knowledge-probing tools. This authorizes local design records, fixtures and checks for the contract. It does not authorize a provider turn, a new runner, external effects or real-work dispatch. The contract pass must compare the current Symphony pinned bundle and the PP-01R editor bridge, and make the security audit, Vision edit, Data contract, code change and role review distinguishable without separate task formats.

## 2026-09-25 session-contract checkpoint

The [session contract](session-contract.md) now specifies Go-time compilation, a short launch card, compact `task_open` response, on-demand project knowledge discovery, common and action-specific tools, question/submit/resume semantics, and five output-ledger fixtures. Two synthetic JSON views exercise the same shape for a security finding report and a Vision revision proposal. They are design fixtures, not generated by the portal and not proof of a live agent run. Current gaps are explicit in the contract; the next implementation work is a pure compiler/validator with negative cases and parity against both existing bundle paths. Keep the security audit blocked until its report adapter and review boundary exist.

## 2026-09-25 build authorization and narrow first slice

The owner said “build it” and asked to avoid overengineering, getting the basics running and solid. This authorizes bounded local implementation and checks of the proposed session contract. The first executable slice will compile and persist a pinned task manifest, expose scoped knowledge discovery to a worker, and make the security audit produce a structured candidate report for review. Keep coding candidate behavior and existing provider-backed actions intact. Use local stand-ins and disposable project data for checks; no live provider turn, external tracker write, public deployment, release or acceptance is inferred. Do not enable real-work dispatch until this slice has local evidence and the owner can review it.

## 2026-09-25 first executable slice checkpoint

The [audit-slice evidence and retrospective](../../evidence/work-agents-01-audit-slice.md) record a local Go-pinned security-audit path with compact task card, scoped knowledge reads, blocking question, immutable report and Work review. A disposable provider stand-in path and the existing coding regression pass. This applies the process change of making each output an explicit adapter at the server boundary; the question test also found and fixed staging into an already running Go-snapshotted batch. The packet remains open: person-paired manifest parity, other layer outputs, multiple artifacts, worker claim fencing, live host compilation and owner browser validation are not yet evidenced. Real-work Symphony dispatch remains off by default.

## 2026-09-25 Vision queue correction

The owner tried to queue a Vision work item and again received the unsupported-agent message, then asked to turn that off. Read-only inspection found W-4 “write value prop”: `product.brief`, assigned to an agent, with no target. Its project has a verified agent-key connection and a clean Git workspace, but no Symphony worker pairing or process. This authorizes bounded local repair so this action can queue and run through the existing connected Work batch. For the targetless item, the output is one proposed Brief claim held for lead review; accepting must apply it once with provenance and send-back must leave the Brief unchanged. Preserve unsupported-action guards for other actions. Use a provider stand-in, not a live account turn. This is a pragmatic connected-key path; the shared Symphony/person-paired session contract remains open and must not be described as complete.

## 2026-09-25 Vision queue correction checkpoint

[Evidence and retrospective](../../evidence/work-agents-01-vision-queue.md) show that W-4 is now eligible for the connected-key Work batch and yields a review-only Brief claim proposal. Targetless creation and single-target revision both have exact, lead-gated acceptance; disposable tests pass. The local portal was rebuilt and restarted without starting an agent turn. This unblocks the owner's queue attempt but does not meet the one-orchestrator goal: Vision currently uses the older direct provider path, while code and audit use Symphony. The next packet work should unify their entry manifest and attempt/output operations rather than adding more action-specific dispatch branches.

## 2026-09-25 Symphony replacement correction

The owner corrected the Vision connected-key bridge: the stated objective is one Symphony execution system across layers, replacing the old direct-model runner. This authorizes bounded local migration of Work dispatch, task cards, worker submission and review, and the local checks needed to prove it. Review the legacy path for reusable output validation and context only; do not retain it as an eligible second runner. Preserve Go, scoped project/profile credentials, immutable attempts, and action-specific acceptance boundaries. Do not start live model turns or assume an unpaired project can run. Record remaining action adapters and owner validation honestly.

## 2026-09-26 Symphony replacement checkpoint

[Symphony swap evidence and retrospective](../../evidence/work-agents-01-symphony-swap.md) record the owner-directed replacement of live Work dispatch. Explicit action adapters now run through Go-pinned Symphony batches in every layer; only named actions are enabled, and elevated review actions submit read-only reports for lead acceptance. The connected-key runner no longer receives Go work. The local portal is running with Symphony dispatch enabled but no W-4 worker pairing or live turn. Full action coverage, host profile controls, Elixir compilation and owner browser validation remain open; the owner approved retiring mapped legacy runner tests on 2026-09-26.

## 2026-09-26 worker/profile correction

The owner rejected manual project/profile worker pairing as a Work UX and clarified that profiles include provider and model configuration as well as instructions. A worker is shared execution capacity, not a profile. The owner wants Work to authorize a profile-and-role batch with requested concurrency, queue it if capacity is unavailable, and show worker progress; Deploy should own host placement, capacity and status. This authorizes a bounded contract correction, not a live worker or provider turn. [Worker-pool contract](worker-pool-contract.md) defines the target and records current implementation gaps. The process correction is to validate owner-facing concepts before exposing an internal credential boundary as a setup control. It is not yet tested in a live flow.

## 2026-09-26 worker-pool build authorization

The owner said “go ahead and sort this out” after specifying automatic worker credentials, shared capacity, profile-pinned provider/model/effort, per-batch worker counts and queueing, Work status, and Deploy runtime controls. This authorizes bounded local implementation, documentation and disposable checks of that model. It does not authorize a live provider turn, installation or spending, external deployment, or owner acceptance. Preserve the existing runner boundary while migrating and do not claim worker capacity that the local host has not reported.

## 2026-09-26 worker-pool implementation checkpoint

[Worker-pool evidence and retrospective](../../evidence/work-agents-01-worker-pool.md) record the owner-directed correction. Work no longer shows a pairing control; the portal manages a private per-project pool credential; Go can queue exact batches for requested slots; one pool can serve different profile-pinned tasks; Deploy shows real capacity and status. Disposable capacity, stale-input and HTTP scope checks pass. The local Symphony host is absent and cannot be compiled here; named Codex model and effort profiles now queue until a host reports the per-turn override patch, while other providers remain gated. Automatic host startup, Elixir/live-turn verification, multi-host claim fencing and owner browser review remain open.

## 2026-09-26 local Symphony host activation

The owner explicitly asked to get Symphony online. Scope: bring up the pinned local host using the existing Docker Elixir image, private project-pool credential files, and Aludel tracker overlay; verify authenticated heartbeat, reported capacity and safe polling. The live host may dispatch only already Go-authorized items. There are no queued or running batches at activation, so this step starts no model turn. Record actual project coverage, runtime process, failures and restart instructions. No provider turn, external deployment, spending or owner acceptance is inferred from this request.

## 2026-09-26 local Symphony host activation checkpoint

The pinned Aludel adapter and per-turn profile patch compiled in a disposable Docker Elixir 1.19 runtime. The first host failed to poll because Docker Desktop's host network did not share the portal's loopback; an authenticated Docker gateway probe found the route, and the workflow's independent tracker endpoint also needed correction. The adapter now permits only the additional local `aludel.localhost` HTTP name. Both configured project pools subsequently reported one slot and the profile override capability through automatic polls; no batch or model turn started. The local containers use Docker restart policy, while their build and Codex CLI paths remain under `/tmp`, so a machine cleanup may require reprovisioning. [Activation evidence](../../evidence/work-agents-01-host-online.md).

## 2026-09-26 Work readiness repair

The owner reported that Deploy showed an online host while Roles still said agents could not take work and Board disabled assignment. The live portal process had been restarted from the local `.env` without `MACHINE_SYMPHONY_DISPATCH`, while both project pools had fresh heartbeats and active Codex-compatible profiles. Scope: persist the already owner-authorized local Symphony dispatch setting, restart the portal, correct the obsolete pairing copy, and verify the Work snapshot/assignment gate without starting a batch. This is a startup/readiness consistency repair, not a model turn authorization.

## 2026-09-26 Work readiness repair checkpoint

The ignored `.env` now persists the local `MACHINE_SYMPHONY_DISPATCH=1` authorization across ordinary portal starts. The restarted portal logged `Symphony Work dispatch: enabled`; disposable HTTP checks show the named Codex profile in the Work assignment list and `dispatchEnabled=true` in both Work and Deploy responses. Roles and Deploy distinguish a disabled dispatch path from an offline host. Typecheck, build and the pool regression pass. The live owner-session probe was blocked by automatic approval review; no owner session was created. [Evidence](../../evidence/work-agents-01-host-online.md#2026-09-26-work-readiness-repair).

## 2026-09-26 first-run usability repair authorization

The owner tried two Browser Buddy batches from Work › Board and asked for a rough end-to-end Symphony path that can run ordinary adapted tasks. They selected GPT-5.6-Sol for the Default agent, requested provider-supplied model choices instead of free text, durable blocked state whenever Go cannot start an item, and item-level running/progress/activity feedback. They also reported concern that recent silent UX changes may have displaced previously agreed status UI. This authorizes bounded local implementation, local runtime configuration, disposable checks and restart of the existing local portal/hosts. It does not authorize a public deployment, external writes, release, acceptance, new spending, or an agent turn beyond a batch the owner explicitly starts with Go.

Read-only diagnosis found that B-1 and B-2 reached `running` but were manually stopped after 13 seconds and 6 seconds, before the host's 30-second poll. Both attempts remained `authorized`, with no workspace, run reservation or provider turn. The Board nevertheless displayed “needs a supported profile and Symphony action adapter” because that warning used `!canGo` even while the batch was already running. The existing item progress UI appears only after a run context is created, currently at the later run-reservation hook. The process correction for this pass is to test the owner-visible lifecycle at every boundary—Go accepted, waiting for host, provider working, blocked, and submitted—rather than treating host heartbeat plus a `running` batch as sufficient readiness.


## 2026-09-26 accepted-UX alignment and first-run repair checkpoint

The owner clarified that the accepted Work v2 prototype is the UX contract and that no replacement lifecycle UI should be invented silently. Inspection confirmed that the built card and item detail still implement the accepted B8-B10 behavior: an unclaimed staged item says that its run has not started; a claimed item shows Working, a thin action-phase bar, current activity, elapsed time and model; dependency blockage remains Blocked by a named work item. The speculative execution-state UI from this pass was removed. The process correction is to trace a reported screenshot against the accepted prototype and actual attempt boundary before changing composition.

B-1 and B-2 were stopped after 13 and 6 seconds, before the configured 30-second Symphony poll, so their attempts remained authorized with no workspace, run reservation or provider activity to display. Local workflows and the checked-in example now poll every 2 seconds; the live Browser Buddy host reports a 2-second refresh. The false unsupported-adapter warning is suppressed once a batch is running. The existing progress UI was not overwritten.

Work Agents now loads the model select from the installed Codex provider catalog instead of accepting free text. The catalog returned seven models and confirmed gpt-5.6-sol; both existing Default agent profiles are revisioned to codex / gpt-5.6-sol / medium. The migration applies only to untouched revision-1 defaults so a later owner choice of Provider default persists. The rebuilt portal is healthy with Symphony dispatch enabled. Typecheck and build pass; the focused Symphony suite passes 13/13 after fixtures were separated into override-capable pool hosts and legacy profile-scoped hosts.

The runtime-blocked visual contract remains unresolved rather than silently invented. WORK-UX-01 uses Blocked only for dependency relationships, while host/configuration failures need a reason and a recovery action without a fake Blocked by record. Owner direction is required on whether runtime failure extends the same Blocked status with a reason, or uses a distinct Needs you path. This decision blocks only the runtime-failure presentation and transition; provider selection, fast pickup, the existing Working progress display and local dispatch are running.


## 2026-09-26 runtime-blocked UX implementation checkpoint

Owner approval extended the accepted Work v2 status language without changing its composition. `Blocked by W-n` remains dependency-specific. Execution inability now uses a typed `executionBlock` with a concise reason and one recovery route. Offline dispatch hosts and hosts lacking profile override support project Blocked while an authorized batch waits and clear automatically when readiness returns. Changed Go inputs and trusted Symphony hook/runtime `blocked` or `error` events persist Blocked on the item. Cards show the reason and expose Open Deploy, Manage agent, Open batch, or Stage again as appropriate; item detail uses the same status, reason and recovery action. Healthy capacity contention remains Queued.

Observed evidence: provider and portal typecheck and production build pass; focused Symphony plus workspace-hook tests pass 15/15. The tests cover stale-input Blocked, a runtime error reason, idempotent event handling, and explicit Go clearing the old block. The rebuilt local portal returns HTTP 200 with Symphony dispatch enabled, and the Browser Buddy host continues its two-second poll with no active work. No provider turn was started.

Retrospective: the task was made error-prone by status being derived at three boundaries: stored Work state, batch admission, and external host state. The reusable improvement is the explicit execution-block contract plus a snapshot projection for transient host health, rather than adding more stored lifecycle states. Applying it exposed two separate recovery classes and preserved Queue for ordinary capacity waiting. The pinned overlay now includes an optional tracker callback, so Symphony core Codex failures and trusted hook failures both post the same error event. The callback compiled with warnings as errors and the focused upstream orchestrator/core suite passed 95/95. Restarting exposed a stale Docker Desktop per-file WSL bind mount; both idle hosts were recreated with the integration directory mounted read-only, returned to two-second polling, and now have restartable container definitions. This operational repair is evidence that runtime mounts should use stable directories rather than ephemeral per-file aliases.


## 2026-09-26 reboot recovery authorization

After restarting the computer, the owner reported that `./launch-machine` said Symphony Work dispatch was enabled while Deploy › Agents showed the runtime was not running. Read-only diagnosis found both configured worker containers stopped with exit 127. Their restart definitions survived, but their Symphony checkout, built executable, workflows, Mix cache, isolated Codex CLI and writable Codex home were all bind-mounted from reboot-volatile `/tmp` paths. The launcher only starts the portal and reports its dispatch-admission flag; it neither restores workers nor verifies a heartbeat. Browser Buddy batch B-3 remains explicitly Go-authorized and queued, so restoring that project host may start it; this repair does not create, cancel or replace authorization.

This owner report authorizes a bounded local repair: move generated host runtime state under ignored portal data, add an idempotent pinned build/start command, invoke it from `./launch-machine` when local Symphony dispatch is enabled, and verify container restart plus fresh authenticated pool heartbeats. Preserve the official pinned source and checked-in overlays, existing private token files, accepted Work progress UI and current batch state. Do not print or copy credentials, start a new batch, change provider configuration, deploy externally or infer owner acceptance.


## 2026-09-26 reboot recovery checkpoint

The reboot failure is repaired. `launch-machine` now reconciles configured local Symphony hosts through the new idempotent `integrations/symphony/local-hosts` command when dispatch is enabled. Generated checkout, build, isolated Codex CLI, workflows, logs and writable state live under ignored portal data instead of `/tmp`; private credentials remain read-only mounts. Both existing project pools returned fresh authenticated heartbeats after recreation, and a second verification reused the same build and containers. If Docker or provisioning fails, the portal still starts and its existing execution-block projection keeps authorized work visibly Blocked instead of conflating dispatch admission with host health.

The already Go-authorized Browser Buddy B-3 provided end-to-end application evidence. It advanced to Working with the accepted phase/activity/model payload, used one GPT-5.6-Sol run, submitted a review-only value proposition, and completed with W-4 in Review. The live preflight found and fixed login-shell command lookup and the missing trusted-hook allowance for the same narrow `aludel.localhost` name already allowed by the adapter. Typecheck, build, workspace-hook test, syntax, diff and heartbeat checks pass; 21/22 broader focused tests pass, with the independently reproducible security-audit Ready-fixture failure left open. [Updated host evidence and retrospective](../../evidence/work-agents-01-host-online.md#2026-09-26-reboot-recovery-and-live-batch-evidence).

## 2026-09-28 layer-app completion authorization and readiness

The owner asked in this chat to complete WORK-AGENTS-01 in the context of LAT: modular layer apps originate work, and the shared Work layer collects it. This authorizes bounded local contract, repository implementation, disposable checks, evidence and status updates for this packet. It does not authorize a new provider turn, external write, spend, public deployment, release, or owner acceptance. The current portal and isolated LAT candidate remain separate; candidate agent dispatch stays disabled.

**Process assessment:** action eligibility must be derived from a declared output contract and checked at the Work boundary, while layer apps supply exact origin, inputs and desired artifact. A routine trigger may create or suggest an item but never grant Go. LAT-05's utility path has exact receipts and a stable Pages gap; its agent path lacks a compatible manifest/output adapter. First test the contract against that real path, then update the implementation and evidence. Preserve the accepted Work review and worker recovery gates. **Readiness:** repository-level adapter and disposable tests are ready; a real agent turn and owner browser acceptance are separate gates.

## 2026-09-28 LAT Pages adapter checkpoint

The isolated candidate at `2983b53` now has a [tested Pages-origin Work adapter](../../../../aludel-layer-model/docs/evidence/work-agents-01-lat-adapter.md). Reviewed policy, story, receipt and gap origin enter the Go-pinned card; the Pages agent submits a read-only flow proposal; Work checks exact inputs and creates the flow only after human checklist acceptance. Disposable focused tests and the 133-test candidate server suite passed. This applies the process correction of testing a real layer output against Work's admission and acceptance boundaries; the first test exposed and fixed Work's assumption that completing design work must revise the target story. The packet remains **in progress**: person-paired parity, two-host claim fencing, live agent/browser proof and owner acceptance are unverified. Do not enable candidate dispatch or mark LAT-05 complete from this checkpoint alone.

## 2026-09-28 person-paired read-card checkpoint

The isolated candidate through `f9c62bc` now compiles the same task-card schema for person-assigned adapted work in the editor bridge. The editor token remains member/project-scoped and context-only, and unsupported personal actions still return readable context. Focused editor/manifest tests and a 133/133 full candidate server run passed. This resolves the read-card parity part of dependency step 2. It does not provide person-side typed submission, a live paired Codex turn, or a two-host claim fence. [Candidate evidence](../../../../aludel-layer-model/docs/evidence/work-agents-01-lat-adapter.md).

## 2026-09-28 host claim fence checkpoint

The isolated candidate at `5ff5433` now binds each Symphony attempt to one stable trusted-host ID at workspace registration and rechecks it at run reservation. A disposable two-host race with a shared workspace path gave one owner and one 409; the loser did not block the winner. Existing attempts migrate to first-host claim. The full candidate server suite passed 134/134; host-hook and typecheck checks passed. This addresses the worker-claim process gap at the domain/hook boundary. It does not prove a live two-container run, person-side typed submission, or owner browser acceptance. [Candidate evidence](../../../../aludel-layer-model/docs/evidence/work-agents-01-lat-adapter.md).

## 2026-09-28 completion gate and proposed owner trial

The acceptance criterion for a person-paired session is loading the same semantic manifest. The context-only editor card meets that read criterion; person-side typed submission remains a possible later expansion, not a new packet blocker. The two-host race passed at the server and hook boundary; a live multi-container run would add operational confidence but is not substituted for the checked race. The **remaining WORK-AGENTS-01 gate** is an authorized real agent journey plus owner browser review. Proposed bounded trial: on the isolated LAT candidate only, create a disposable Pages project with a reviewed Vision → Pages connection, one story and one existing page; run the coverage utility, queue its single `pages.flows` suggestion, assign an existing Codex profile, and have the owner Go one batch of one item for one turn. Review the exact story/page/policy pins, proposal, checks, send-back and acceptance; verify that only checked acceptance creates a flow and the original portal remains untouched. This requires separate owner authorization for candidate dispatch and the provider turn. No such authorization is inferred from the current request; candidate dispatch remains disabled. Record the owner result before changing this packet to complete or LAT-05 to complete.

## 2026-09-28 owner authorization for isolated candidate trial

The owner replied “go for it” to the concrete proposal for **one disposable, candidate-only Pages flow task with one Codex turn, followed by review of its proposal and resulting flow**. This authorizes temporary candidate dispatch and use of the already configured local Codex account for that bounded turn. It does not authorize copying current portal data or secrets, sending external messages, public deployment, accepting the agent's proposal on the owner's behalf, promoting the candidate, or another agent turn. Record the project/work/batch/attempt IDs, pinned inputs, run result, review outcome, current-portal isolation and any failure before deciding packet completion.

**Readiness check:** start from isolated candidate commit `5ff5433`; inspect candidate DB, worker and auth availability by metadata only. Create a disposable Pages fixture if no suitable isolated fixture exists. The launcher hard-codes dispatch off, so an explicit trial-only start and stop procedure is required. A provider turn may start only after exactly one candidate Go and a verified candidate worker heartbeat. Owner review remains a separate acceptance step even if agent and automated checks pass.

### Candidate worker-host route correction

The fresh disposable candidate server on port 4312 and the current 4310 portal both returned 200, but a bounded worker-route probe using the current `aludel.localhost` Docker alias returned 421 from the candidate. The server correctly enforces its `layers.localhost` host boundary. Before provisioning a worker, set the trusted local host alias from the candidate base domain and extend the pinned adapter/hook allowlist only for `aludel.layers.localhost`. Recheck the route; no batch or model turn has started. This is an observed prerequisite, not permission to weaken the host boundary generally.

### One-turn admission bound

The candidate's pinned Symphony host compiled and reported one slot for only the disposable project. Before Go, inspection found the server's default attempt allowance was three turns. The owner authorized one turn, so the trial server must set `MACHINE_SYMPHONY_RUN_LIMIT=1` and verify that a Go-pinned attempt stores `run_limit=1`. This is a hard boundary against an automatic retry consuming a second provider turn. No batch has started yet.

## 2026-09-28 one-turn Pages trial checkpoint

The authorized disposable candidate Go started exactly one `pages.flows` Codex turn on one project. Its story, reviewed policy, receipt and repository base were pinned, and Work assigned the default `codex / gpt-5.6-sol / medium` profile. The runner stopped the turn before a plan or proposal because the one-run allowance withdrew its active issue from Symphony polling. The attempt consumed 1/1 turns and is durably Blocked; the disposable host is stopped. No flow or Work acceptance occurred and the current portal remained separate. [Trial trace, correction and retrospective](../../../../aludel-layer-model/docs/evidence/work-agents-01-lat-adapter.md#2026-09-28-one-turn-pages-trial-and-recovery-checkpoint).

The isolated candidate now keeps the final reserved turn routed until its trusted `after_run` completion event. Regression tests cover active refresh, final withdrawal and the hook without another reservation; full candidate server tests pass 134/134. This corrects the local process gap found by the live trial, but a successful live Pages proposal and owner browser review are still required for WORK-AGENTS-01 completion. A second provider turn was not authorized by the original one-turn Go.

## 2026-09-28 authorization for one corrected candidate retry

The owner said “go” after reviewing the first disposable Pages turn’s route-cancellation failure and candidate fix `cef7a5c`. This authorizes one additional disposable, candidate-only Pages flow Go and one Codex turn to verify the corrected Symphony path, followed by inspection of the proposal and Work review state. It does not authorize further turns, proposal acceptance, current-portal changes or data copy, external writes, public deployment, promotion or spending. Stop the isolated host and server after observation and record the exact attempt, inputs, run result and retrospective.

## 2026-09-28 corrected retry checkpoint

The single newly authorized candidate Go used disposable project `p-3508d9eff9`, Pages W-2, batch `bat-3508d9ef-1` and attempt `att-41facdf8-4eb4-4a53-ac12-389c60438620`. Its one permitted Codex turn produced a read-only `pages.flows` proposal `spr-d9882774-4b4f-48ba-9a7e-cead8b72086f`; Work is in Review and no flow exists. The reviewed policy r2, story r1, existing page r1 and source receipt were pinned. The issue stayed routed through execution, so the first trial's route-cancellation failure did not recur. The disposable host and server were stopped. [Proposal, checks and retrospective](../../../../aludel-layer-model/docs/evidence/work-agents-01-lat-adapter.md#2026-09-28-corrected-one-turn-pages-retry).

This proves the layer-origin → shared Work Go → one Symphony turn → review-only proposal path. It does not prove usefulness of a real flow: the disposable story had no activity detail, and the proposal contains one direct step. The owner has not reviewed the result or signed its checklist, and no acceptance was performed. The packet remains in progress pending owner review; no further turn is authorized.

## 2026-09-29 owner correction: layer-owned actions without Work roles

The owner accepted the layer-origin/Work-collection direction and directed a new groundwork pass. Each layer must define and own its own actions; the existing role-owned action catalog is not the new inventory. Remove Work roles as a domain concept because a role per layer duplicated the layer boundary. Preserve explicit permissions, including elevated actions with narrower or wider file/read/effect access. The action's owning layer supplies its context. Work keeps the default assignee and the shared task, Go, run and review machinery. The project work style (Dreamer, Planner, Tinkerer) must remain an editable setting that seeds the initial human/agent assignment for actions in newly added layers. Later LAT layer-conversion packets recreate and review each built-in layer's action set. This pass is authorized to establish the reusable contract, validation and migration handoff locally; it does not authorize replacing all actions in the running portal, new provider turns, external writes, deployment or proposal acceptance.

**Readiness/process finding:** the current `roles.json` simultaneously names layer actions, lead permissions, style presets and action setup; Work also derives action ownership from role parent IDs. Directly deleting role records would orphan historical work and could broaden elevated access. First make a layer/action declaration reject missing output ownership and unsupported effects, specify stable IDs and default-assignee seeding, then migrate each layer with explicit old-action mapping and permission checks. The already submitted disposable Pages proposal remains in Review and is not accepted by this correction.

## 2026-09-29 layer-owned action groundwork checkpoint

[DEC-051](../../decisions.md#confirmed) and the [layer-owned action contract](layer-owned-actions.md) now replace one-role-per-layer as the LAT target. Work remains the control plane for assignment, Go, runs and review; a layer owns its action inventory, output adapter and method context. The contract preserves explicit elevated permissions and scoped file/record/effect grants, keeps project work style as an editable setting for newly installed layers, and prohibits a style change from silently redistributing existing work. The isolated candidate adds a pure declaration/assignment validator; [evidence and retrospective](../../../../aludel-layer-model/docs/evidence/work-agents-01-layer-actions-groundwork.md) show 3/3 focused tests. LAT-06/07 now own action recreation for built-in layers; LAT-08 owns historical role/action data, grants, settings and UI migration.

This is applied process groundwork, not a runtime role removal. The existing candidate action catalog and Work permissions still use roles, and the previous disposable Pages proposal remains submitted in Review with no owner verdict. The new validator is not an authorization gateway. Before a layer action becomes runnable, its LAT packet must prove exact output and permission enforcement, style seeding, historical mapping and reviewer acceptance. WORK-AGENTS-01 remains open for owner review of the Pages trial and downstream live integration evidence.

## 2026-09-29 owner closeout and LAT handoff

After reviewing DEC-051's layer-owned action groundwork and the bounded Pages Work trial, the owner said “let's call this action clear” and asked for the next LAT task. Treat that as acceptance of **WORK-AGENTS-01's foundation and handoff scope**: one Pages-origin item reached a Go-pinned, one-turn read-only proposal in shared Work; the common task-card read path and host claim fence have checks; the new layer-action declaration contract has focused validation. [Runtime evidence and retrospective](../../../../aludel-layer-model/docs/evidence/work-agents-01-lat-adapter.md) · [layer-action groundwork evidence](../../../../aludel-layer-model/docs/evidence/work-agents-01-layer-actions-groundwork.md).

This closeout does not accept the disposable flow proposal or its unchecked “Every activity” criterion. That review record remains in Review with zero flows. It also does not claim the old role-backed runtime implements DEC-051, that every layer's action inventory exists, or that an arbitrary layer can run. The owner assigned action recreation to LAT-06/07 and role/permission/style migration to LAT-08. The process change tested here was to compile a layer-output/action declaration and inspect one real Go → proposal boundary before widening the action model. The later action inventories and UI remain hypotheses to prove in their LAT packets. WORK-AGENTS-01 is complete as the bounded foundation; LAT-05 closes with combined utility and Work handoff evidence, making LAT-06 the next LAT packet.
