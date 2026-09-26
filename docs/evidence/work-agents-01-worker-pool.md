---
id: work-agents-01-worker-pool
kind: implementation-evidence
status: partial
updated: 2026-09-26
---

# WORK-AGENTS-01: profiles and worker capacity separated

## Owner correction and process change

The owner rejected manual pairing as a Work setup step and clarified that profiles include provider/model/effort, while workers are reusable capacity. The prior implementation tied a token and Symphony process to one project/profile and showed the token in Work. This pass uses the [worker-pool contract](../design/work-agents/worker-pool-contract.md) to separate agent identity from capacity before changing the UI. The process lesson is to validate owner concepts before exposing an internal credential boundary as a product control. Disposable tests apply the new boundary, but a live host and owner browser flow have not yet tested its usability.

## Implemented local behavior

- Work › Agents edits profiles and project instructions; it has no worker-pairing control. Profiles now store a versioned provider. Codex model and effort are pinned per task. Named model and nondefault effort batches queue until the host reports the pinned App Server override patch. Other provider profiles remain unavailable for Go.
- A private project-pool credential is generated in ignored local data with file mode 0600 and reused across portal restarts. The browser API no longer issues worker tokens. The Symphony adapter and host workspace hook can read `ALUDEL_WORKER_TOKEN_FILE`; the credential is stripped from Codex child sessions.
- One project pool polls authorized tasks for multiple profiles. Every task card still pins its own profile and role/action revisions. A profile switch requires no new credential. Pool credentials cannot read another project's digest or attempt.
- Go pins the exact batch and requested 1–N slots. A batch queues when its full request cannot be admitted; strict authorization order prevents a later small batch from overtaking it. Admission rechecks pinned task, target, instruction and repository inputs before making it runnable. Changed inputs stop and restage the queued batch for a fresh Go.
- A running batch exposes at most its reserved number of Ready tasks to Symphony. Its occupied slots release when attempts submit or pause, before human review. Work shows free/online capacity, queue count and per-batch worker requests; Deploy › Agent runtime shows location, heartbeat, configured and host-reported capacity, active tasks and coarse progress. Deploy changes the project capacity ceiling; the host's reported concurrency remains an independent limit.

## Checks and limits

The disposable pool test queues Go while the host is offline, admits it after an authenticated heartbeat, then passes a two-slot batch and a one-slot batch together, holds a three-slot batch until all three slots are free, switches to a second profile with a named model and High effort under the same host credential, waits for the host override capability, opens its card through the real worker HTTP API, rejects an unsupported provider, and withdraws stale queued input. Focused Symphony proposal, worker and audit regressions pass **14/14**. The host workspace-hook test passes using only a private credential file. Angular typecheck and production build pass with existing warnings. The full server suite passes 109/110; its one failure is the pre-existing tracked executable-bit check for `apps/portal/tools/delete-project.mjs`, outside this packet.

A pinned Symphony checkout exists under `/tmp/aludel-symphony-conformance`, but no host is running and Elixir/Mix are unavailable, so the changed adapter cannot be compiled or exercised in a live host here. Deploy correctly reports offline/zero usable capacity. The pinned Symphony reference uses a global Codex command and concurrency setting. `profile-turn.patch` cleanly applies to that checkout and adds per-turn model/effort overrides; the adapter reports its presence. Elixir compilation and a live override turn remain unverified. Other providers need their own runtime adapter. The current pool is per project, not a cross-project scheduler; multi-host item claim fencing, automatic host installation/start, and owner browser review remain open. No live model turn or external deployment occurred.

## Retrospective

The avoidable error was treating worker credentials as if they were agent identities. Splitting pool authentication from profile-pinned attempts removed repeat pairing and made capacity queueing explicit. The 2+1/3-slot regression tests the proposed scheduling behavior, not actual three-agent throughput. The next equivalent implementation should start with a host capability/claim contract and a disposable multi-worker race before claiming scale. Codex App Server documents model and effort overrides on `turn/start`; the pinned host patch carries the profile values on each issue and the heartbeat guards against dispatch to an unpatched host. The remaining profile tier question is which provider adapter and model catalog checks to support next. Automatic host startup and browser validation remain separate, observable gaps.
