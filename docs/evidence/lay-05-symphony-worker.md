---
id: lay-05-symphony-worker
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# LAY-05: direct Aludel worker boundary

## Process change applied

ADR-008 was amended after the owner confirmed that Linear/Jira should be optional synchronized views. The architecture and LAY-05 boundary note now name Aludel Work as Symphony's tracker. The implementation keeps the structured draft runner separate from coding Go, and an explicit disabled-by-default `MACHINE_SYMPHONY_DISPATCH` flag prevents the unproved adapter/workspace/result path from taking real work. This boundary was exercised through a disposable Go → poll → ID refresh flow; the upstream runner itself has not been exercised.

## Implemented and checked

- `symphony-worker.mjs` stores hashed project/profile worker tokens, captures an immutable bundle at coding Go, and serves scoped Ready/Blocked/Stopped issue snapshots. Its keyset cursor uses stable issue IDs. Live reads compare the pinned work fields, instruction revisions, project record, shared agent docs, target revisions and clean repository HEAD before returning Ready. The context endpoint serves a bundle only while that exact issue remains authorized.
- `agent-runs.mjs` stages and starts coding items only when the flag and profile connection are present. Coding Go does not call the structured provider runner; a mixed batch is refused. A project owner must press Go. Stop withdraws and restages coding work; an active Symphony batch survives portal restart.
- The Work UI receives the connected profile IDs when the flag is enabled and gates coding Stage/Go accordingly. A project owner can issue, inspect status and revoke a worker token via `/api/projects/:id/agents/symphony`; the token is returned only on issuance.
- [The host-side workspace hook](../../integrations/symphony/workspace-hook.mjs) reads the Ready issue before Codex starts, clones the local project and checks out its Go-pinned commit. A disposable test proves exact checkout, preserved retry edits and rejection of a mismatched workspace identifier.
- [The Elixir overlay](../../integrations/symphony/README.md) implements `fetch_issues_by_states`, `fetch_issues_by_ids`, `aludel_task_context`, validation and secret-environment exclusion for pinned upstream Symphony revision `be10a1b79df723d6d7612b5651c8522704dafb2e`. It is source-aligned, not compiled or run locally.

The disposable worker test checks owner-only token issuance, Go without a provider call, draft exclusion, a Ready poll and exact ID refresh, cross-project exclusion, bundle access, source-dirty Blocked state, skip/stop terminal state, rotation/revocation, and real HTTP routes across a portal process restart. Focused candidate/readiness/worker tests: **5/5 pass**. Workspace-hook test: **1/1 pass**. Full server suite: **100/101 pass**; the sole failure is the pre-existing tracked executable-bit issue for `apps/portal/tools/delete-project.mjs`. Typecheck and build pass with existing Angular optional-chain and bundle-size warnings. `git diff --check` passes. No external tracker, provider, or live Symphony calls were made.

## Remaining gate

The Elixir overlay needs compilation and conformance against the pinned upstream checkout; Elixir/Mix are not installed here, and the available local `launch-symphony` image has no `elixir` executable. The example `WORKFLOW.md` and tested host-side hook define pinned workspace preparation, but still need to be run under Symphony and reconciled with Aludel's candidate record. Aludel still lacks durable Symphony attempt/event intake, result submission, candidate validation/preview and exact-commit accept/send-back. A fake Codex App Server trial must prove restart, stop, stale input and duplicate-dispatch recovery before switching on the flag. A real Codex run remains separately authorized.

## Retrospective

The existing Work batch start path assumed every agent uses the project's structured API key. The direct tracker exposed that assumption, so coding now has an explicit path and default-off gate. The HTTP trial caught a misplaced route, and the restart trial caught a fixture that omitted agent-readable docs seeded by normal startup; both were corrected and rerun. Keyset pagination and an explicit Blocked/Stopped ID refresh were added after checking Symphony's reconciliation contract. These checks prove the local boundary, but the Elixir overlay and end-to-end result path remain hypotheses until run with upstream Symphony. LAY-05 stays active; the next step is adapter conformance and workspace/result integration, not a phase transition.
