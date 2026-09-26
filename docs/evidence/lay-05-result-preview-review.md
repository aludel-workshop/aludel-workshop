---
id: lay-05-result-preview-review
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# LAY-05 local result, preview and review cycle

## Scope and process correction

The owner authorized continuing LAY-05 locally, with no live Codex/provider run, external write, public deployment, release, or real owner acceptance. The implementation had assumed Aludel owned the coding worktree, while Symphony owns its per-issue clone. This pass added a durable attempt identity and made result intake register Symphony's existing workspace. Candidate checks reported by the agent remain labeled `agent-report`; an isolated Docker build and health probe are recorded separately as Aludel evidence.

## Observed local evidence

- A Go-pinned coding item creates a durable attempt ID. The scoped worker token can poll it, register its exact workspace, append idempotent events, and submit one exact commit. Repeated submission returns the same candidate. A submitted item leaves `Ready` and returns `Submitted` on ID refresh. Dirty or moved source, forbidden files, wrong Work trailer, dirty candidate workspace and mismatched commits are rejected. Portal restart preserves the attempt and candidate.
- The host-side workspace hook clones the authorized base, records `.git/aludel-base`, registers the workspace through the worker API, and safely re-registers a reused workspace. The Elixir overlay now declares `aludel_submit_candidate` as a host-side tool. The worker bearer token is excluded from Codex child sessions by the adapter contract. The overlay compiled against pinned Symphony commit `be10a1b79df723d6d7612b5651c8522704dafb2e` in an isolated temporary checkout using Elixir 1.19; local callback checks confirmed tracker validation, both tool names and secret stripping. The example `WORKFLOW.md` parsed and validated under the pinned Symphony schema. Both host-side tool callbacks then succeeded against a disposable HTTP mock, including the worker API's HTTP 201 submission response. This comparison caught two contract details: `Submitted` must be a terminal state, and the result tool must accept HTTP 201 Created. Both were corrected before closeout.
- A submitted candidate appears on the Work item with its exact base and commit, changed files, diff summary and clearly labeled agent-reported checks. The candidate preview builds a fresh Git clone of that exact commit, removes `.git`, then uses a separate Docker image, container, preview database row and runtime data directory. It is served on a separate hostname; the test could reach its `/api/health` but not portal `/api/session` from that host. The shared Git project and project preview were not changed by submission or candidate build.
- A successful Docker build and health probe moves the candidate and Work item to review. The disposable owner accepted its checklist, then called the exact-commit acceptance route. The route required owner role, reviewed candidate ID and commit, accepted checks, a healthy preview at that commit, and a clean unchanged shared base. Only then did the shared repository fast forward to the candidate commit and the Work item close. A premature accept was rejected. A simulated interruption after Git moved but before the Work database update was retried safely at the same candidate commit. Release promotion was not invoked. A sent-back or discarded Symphony workspace can create a revised candidate without deleting that workspace.
- Focused checks: `node --test tests/symphony-worker.test.mjs`, `tests/code-candidates.test.mjs`, `tests/previews-docker.test.mjs`, and `integrations/symphony/workspace-hook.test.mjs` pass. Portal typecheck and production build pass. Full server suite: 103/104 pass; the sole failure is the pre-existing tracked executable-bit check for `apps/portal/tools/delete-project.mjs`. `git diff --check` passes.

## Remaining gates

This is a disposable local stand-in, not a Symphony/Codex run. The Elixir overlay compiled against the pinned Symphony checkout and its tool HTTP callbacks passed against a mock, but no upstream Symphony orchestrator session has polled Aludel or run an agent, and no live agent-produced code or owner-facing browser review has been proved. The dispatch flag remains off. A supervised live conformance cycle needs a separate owner authorization because it would invoke Codex/provider execution. The crash point after Git fast forward and before Work database update was simulated and retried. Host interruption during the Docker build, Symphony retries and live runner recovery remain unproved.

## Retrospective

1. The ownership mismatch between Aludel worktrees and Symphony workspaces caused avoidable rework. The pinned attempt/workspace contract made the correct boundary explicit.
2. A reusable host-side registration and result tool contract, plus separate agent-report and host-verification evidence, should make the next runner adapter easier to check.
3. Candidate preview must have its own hostname, container state and data mount. Reusing the project preview would risk applying unreviewed code to the current app and mixing runtime data.
4. The remaining question is whether Symphony's orchestrator dispatches and reconciles this adapter in a live cycle; that blocks enabling dispatch. Live interruption during build or Symphony execution and browser review remain open checks.
5. The process change was applied in code and exercised through disposable Go → poll → workspace → submit → build → review → accept tests. Live Symphony conformance and owner usability remain hypotheses, not passed gates.
