---
id: lay-05-agent-submission-snapshot
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# LAY-05 direct agent submission and candidate retention

## Scope and process lesson

The owner authorized one more supervised Codex turn on a disposable project to prove direct agent use of `aludel_commit_candidate`. A local one-process wrapper bounded the turn because Symphony can schedule continuation runs after `agent.max_turns` is reached. The portal, worker token, source repository and logs were isolated under `/tmp`; the Aludel project and user Codex configuration were unchanged. The pinned Symphony checkout exposed the current Aludel adapter, and isolated `codex-cli 0.157.0` reported an existing login before Go.

The earlier local result test had assumed Symphony's registered workspace would remain available after submission. The live turn revealed that Symphony deletes a terminal issue workspace quickly. A candidate record pointing at that workspace can build a preview before deletion yet cannot provide its diff or later acceptance afterward. Candidate ownership therefore requires Aludel to snapshot the exact Git commit before acknowledging submission. The agent tool also needs a strict check schema: permissive check objects silently converted passed agent claims into unnamed `skipped` entries.

## Observed live turn

Symphony polled a Go-authorized disposable blog API item at base `329b39accbb34afd92d571f0ab532b2317812765`. The Codex trace records calls to `aludel_task_context` and **`aludel_commit_candidate`** from the agent itself. The host committed `d1cca3cc36c01f15a0d823dd8020a23cb6264927` in the registered workspace and Aludel recorded candidate `can-1a0a743a-8b10-4250-8da0-130108331c30`, attempt `att-f58eb335-7c9d-46c4-84a0-304ba6505a7b`, and a `submitted` event. No operator assisted with this submission, and no second Codex process launched.

Aludel built an isolated Docker preview from that commit. Health and initial post-list requests returned 200; creating a post returned 201; the later list returned 200; invalid input returned 400. The candidate host returned 404 for portal `/api/session`. The Work item moved to review and the shared project HEAD remained at the pinned base. These observations prove agent-initiated commit/submission and isolated preview for this disposable item. They do not prove reviewability after Symphony cleanup.

Immediately afterward, candidate detail returned 409. The candidate's `worktree_path` pointed to Symphony's deleted clone. The preview's Docker image had source files but did not preserve the Git commit needed for diff and exact-commit acceptance. The candidate was therefore **not reviewable** despite its healthy preview. The live candidate was created before the snapshot correction and was not accepted.

The agent supplied check objects shaped as `command`/`result`/`note`. The old dynamic tool schema permitted arbitrary objects, and Aludel stored three unnamed `skipped` agent claims; its own Docker build/health check was recorded separately as `passed`. The live turn cannot be used as evidence that agent-reported checks were preserved correctly.

## Correction and application

`codeCandidates.registerExternal` now validates the registered workspace and its allowed diff, fetches the exact submitted SHA into an independent Aludel Git snapshot, checks out that commit, verifies the snapshot is clean, and only then inserts the candidate and acknowledges the worker. The record retains the origin workspace path for idempotency while `worktree_path` points to the Aludel snapshot. Discard removes the snapshot without deleting Symphony's workspace. The fetch uses the SHA directly because Symphony commonly commits from a detached HEAD; a branch-only clone could omit the commit.

The Symphony adapter now requires `name` and `status` (`passed`, `failed`, or `skipped`) in each check object and permits an optional `detail`. The worker rejects malformed claims before making a host Git commit. The example workflow gives agents that shape explicitly. The adapter compiled against pinned Symphony commit `be10a1b79df723d6d7612b5651c8522704dafb2e`; schema inspection confirmed the required fields and enum. Focused Node tests pass 7/7. They now delete the Symphony clone after submission, restart the portal, fetch candidate detail and diff, build an isolated Docker preview, and exercise exact-commit acceptance from the retained Aludel snapshot. They also verify rejection of malformed checks before host Git writes. `git diff --check` passes.

The corrected snapshot and check schema have **local test evidence only**. The authorized live turn had already completed when they were applied. A later live candidate must prove these corrections under actual Symphony cleanup before LAY-05 can close.

## Remaining gates and retrospective

1. The missing lifetime contract between Symphony's disposable workspace and Aludel's review artifact made a healthy preview misleading. The live 409 exposed it; a snapshot-before-acknowledgement contract would have prevented it.
2. A repeatable trial should request candidate detail after Symphony reaches a terminal state, not only immediately after submission. A structured dynamic tool schema should be checked against actual agent arguments before treating claims as evidence.
3. The architecture now requires Aludel-owned exact-commit storage for review and acceptance, independent of Symphony's workspace. `max_turns` remains per run; a durable global turn budget is still needed before unattended dispatch.
4. The next live question is whether the corrected snapshot survives real terminal cleanup and retains meaningful agent checks. Owner browser review and interruption recovery remain unproved and block packet completion.
5. The process correction was applied in code and tested with clone deletion, portal restart, preview and acceptance in a disposable fixture. Its live behavior is still a hypothesis. The one authorized provider turn was consumed; another live turn needs renewed owner authorization.
