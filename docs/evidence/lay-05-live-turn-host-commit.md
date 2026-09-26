---
id: lay-05-live-turn-host-commit
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# LAY-05 second supervised turn and host commit correction

## Authorization and process change

The owner authorized one additional supervised Codex App Server turn on a disposable local project. The installed global CLI and owner configuration were not changed. The trial used isolated `codex-cli 0.157.0`, an explicit one-process launch guard, a writable Symphony log root, and a clean Go-pinned Node repository. Host variables, CLI login, and the source/hook paths were checked before Go. The first fixture startup stopped on a login-status parsing mistake before dispatch: this CLI wrote its success message to stderr. The fixture was corrected; that attempt consumed no Codex turn.

The observed Codex sandbox permitted edits to the registered Symphony workspace but made `.git` read only. The agent could write source and tests, but could not commit there. This changes the integration contract: the trusted host must commit action-permitted files in the registered workspace. Asking the agent to make an alternate clone breaks the workspace identity check. Symphony's `agent.max_turns: 1` bounds turns within one run, but its orchestrator schedules another run when the issue remains Ready. The independent launch guard prevented that second turn in this trial.

## Observed live turn

Pinned Symphony `be10a1b79df723d6d7612b5651c8522704dafb2e` polled the disposable Aludel Ready item, cloned base `9358c51ede6f0b9b56d0a99f50e7a01d6239d544`, registered attempt `att-836f0d08-4713-49aa-816b-1ec0a62bffec`, and started a real Codex App Server session with the Aludel context tool. Codex edited `server.mjs`, added `server.test.mjs`, and ran four tests for list, create, invalid input, and health; all four passed. Its attempt to commit failed because `.git` was read only. It made a commit in another temporary clone, but `aludel_submit_candidate` returned HTTP 409 because that hash was not the registered workspace HEAD. This rejection is the intended candidate boundary. The turn then completed normally at 1/1 while the issue was still Ready. Symphony attempted a continuation run; the launch guard returned exit 78 before a second Codex process could start. No live agent submission occurred.

The agent's workspace contained only the two source changes; the shared project remained at the pinned base. The retained log exposed the turn lifecycle and the guard result. The Codex session's final message stated the Git write blocker. The alternate clone and all trial processes were disposable; no real project, external tracker, public deployment, release, or owner acceptance was touched.

## Correction and local application

`codeCandidates.commitExternal` now commits only a registered Symphony workspace under its configured root. It checks a clean unchanged shared base, ancestry, ignored sensitive paths, symlinks/submodules, and the action's allowed file surface before staging. The trusted Git process disables hooks and writes the Work trailer. A clean committed HEAD can be retried after an interrupted response. `symphonyWorker.commitCandidate` then invokes the existing exact-commit `registerExternal` validator and moves the attempt to Submitted. The scoped worker API exposes `POST /api/worker/attempts/:id/commit`; the pinned adapter exposes `aludel_commit_candidate`; `WORKFLOW.example.md` now directs agents to that host-side tool. The existing `aludel_submit_candidate` remains for a valid commit already in the registered workspace. Bounded HTTP validation errors now reach the agent tool result.

Focused Node tests pass 7/7, including forbidden `.env`, recovery of a committed HEAD, shared-base isolation, worker submission, and route idempotency after portal restart. The updated Elixir overlay compiled against the pinned Symphony checkout; a local HTTP mock verified that `aludel_commit_candidate` sends the scoped POST and accepts HTTP 201. `git diff --check` passed.

To exercise the real agent output without another model turn, a local operator invoked the new host service on the existing disposable workspace. It committed hash `38b33191e1e7d2830e7496f9789f2cabd8dd9da3` and registered candidate `can-a8bc34ed-0f62-4529-9f97-381a5c113fb3`. The shared project HEAD stayed at `9358c51ede6f0b9b56d0a99f50e7a01d6239d544`. An isolated Docker candidate preview built and served `/api/health` (200), initial `/api/posts` (200), create (201), later list (200), and invalid input (400). The candidate hostname returned 404 for portal `/api/session`. The Work item moved to review. This was **operator-assisted submission** of agent-produced files; it does not prove a future Codex turn will call the new tool correctly. No checklist acceptance or release was performed.

## Remaining gates

Keep coding dispatch off by default. One more supervised live turn is needed to prove agent use of `aludel_commit_candidate` and direct submission. Owner browser review and live interruption recovery remain open. The one additional turn authorized for this trial has been consumed; a further provider-backed turn needs renewed owner authorization.

## Retrospective

1. The live sandbox's read-only `.git` policy was the hidden prerequisite. The first run had ended before edits, so the earlier no-turn App Server handshake could not reveal it. The second run made the failure observable.
2. Future coding integrations need a host-side commit capability that validates the agent's workspace and action surface. A no-turn handshake and writable log root remain useful preflight but cannot substitute for a real turn.
3. `max_turns` alone does not bound total provider turns because Symphony may continue an active issue in a new run. The gateway needs a durable global attempt/turn budget before dispatch is enabled for real work; the temporary one-process guard is evidence for the boundary, not the final product mechanism.
4. The next question is whether the updated workflow reliably calls the host commit tool in a live turn. It blocks claiming the agent submission loop complete. Browser review and interruption recovery remain separate gates.
5. The host commit correction was applied and tested with focused security tests, a compiled adapter/mock POST, and operator-assisted submission plus Docker preview of actual agent output. Agent-initiated use of the new tool remains a hypothesis.
