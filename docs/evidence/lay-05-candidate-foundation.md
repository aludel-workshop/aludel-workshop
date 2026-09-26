---
id: lay-05-candidate-foundation
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# LAY-05: isolated candidate foundation

## Observed result

`code-candidates.mjs` creates a detached Git worktree at a pinned clean project commit. It stores the candidate separately from the shared project repository, pins the action's `changes` permission at candidate creation and checks changed paths against it, blocks sensitive and ignored secret paths, tracked symlinks and submodules, commits with `Aludel-Work` and `Implements` trailers, and records a commit ID, changed files, and supplied check reports. A portal restart marks unfinished candidates `interrupted`; discarding removes the worktree. The authenticated project API can list candidates for a work item and inspect a candidate's diff summary. It offers no write or promotion route.

The existing `platform.implement` action remains unavailable in agent batches. No provider call, coding agent, candidate preview, or owner acceptance was exercised. Recorded check reports are input data; they are not independently verified test results. This is a foundation, not LAY-05 completion or B-03B acceptance evidence.

## Checks

- Focused candidate tests: 3/3 pass. They prove source HEAD and files stay unchanged through candidate commit, trailers and evidence are durable, project scope holds, a dirty or moved base is rejected, concurrent runs are refused, both tracked and ignored secret paths and a finish-time permission widening are rejected, and restart leaves work interrupted.
- Portal typecheck and build pass. Existing Angular optional-chain and bundle-size warnings remain.
- Full server suite: 98/99 pass. The sole failure is the previously recorded tracked-mode mismatch for `apps/portal/tools/delete-project.mjs` in `github-integration.test.mjs`.
- The startup table migration passed on a temporary copy of the existing portal database (including its WAL and SHM files).
- `git diff --check` passes.

## Process outcome and retrospective

The required process change is an explicit candidate boundary before enabling a coding action. The focused tests exercised the boundary with a real disposable Git repository. The first run revealed that trimming Git porcelain output removed a leading status space and corrupted a filename; preserving leading bytes fixed it and the full focused suite passed.

The larger cycle remains unproven. The next equivalent task needs a container-bound executor with a credential and usage contract, pinned knowledge input, independent test/build evidence, a candidate preview, review UX, and a separate acceptance operation. Those dependencies keep `platform.implement` gated. This work also confirms that the shared preview manager cannot stand in for a candidate preview because it builds from the project workspace. No roadmap change beyond the existing LAY-05/B-03B scope is warranted. The newly important question is how the server coding agent authenticates and meters usage without placing the portal's project API key in agent-controlled code; it blocks executor activation, not local candidate groundwork.

The coding runner design should follow the existing project-connected key and profile limits, with provider calls on the trusted server and file/test tools behind an isolated container broker. [OpenAI’s function-calling contract](https://developers.openai.com/api/docs/guides/function-calling) documents the tool-call/output loop (accessed 2026-09-25); this is capability evidence, not proof of a working Aludel runner.
