---
id: lay-05-live-trial-checkpoint
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# LAY-05 supervised Symphony/Codex checkpoint

## Observed result

The owner authorized one supervised Codex App Server turn on a disposable local project. A disposable portal created a clean Node repository, a blog-posts coding Work item, a project/profile worker token, and a Go-pinned bundle. Pinned Symphony commit `be10a1b79df723d6d7612b5651c8522704dafb2e` with the Aludel adapter polled the Ready issue. After a fixture-only environment correction, `after_create` cloned the exact base and registered attempt `att-ee5df243-d37c-431b-973b-5a999c689ee1` in the portal.

The Codex App Server process launched once. Symphony reported a failure before submission, retried orchestration, and the single-start wrapper refused another Codex process. At stop, `symphony_attempts` was `working` with a registered workspace; `symphony_attempt_events` contained only `workspace-ready`; `code_candidates` was empty. The isolated Git workspace was clean at its base commit. All trial processes were stopped; the real portal and repository were untouched. No preview, browser review, owner acceptance, release, or deployment occurred.

The first fixture launch omitted `ALUDEL_WORKER_URL` and `ALUDEL_SOURCE_REPOSITORY`, so the host hook correctly failed before Codex. A corrected fixture reached Codex. Installed `codex-cli 0.116.0` emitted a model-catalog decode error (`unknown variant max`) and a system bubblewrap warning. A separate no-turn JSON-RPC probe returned successful `initialize` and `thread/start` for model `gpt-6-sol`; that probe made no model turn. The exact live failure was not captured because Symphony's temporary rotating log path was unwritable and the console stream was truncated. A newer `codex-cli 0.157.0` was installed only under `/tmp`; its login check and no-turn `initialize`/`thread/start` handshake passed with the existing account and `gpt-6-sol`. This removes the old CLI from the next trial setup but does not prove a coding turn will succeed. Neither warning is proven to be the cause.

## Process outcome and remaining gate

The single-start guard limited the trial despite Symphony's retries. The host variables and writable logs must be checked before dispatch. Use the isolated newer CLI and a writable Symphony log root with a retained, redacted failure trace before another supervised turn. This checkpoint proves tracker polling and workspace registration under real Symphony; candidate submission and live preview remain unproved. The owner-authorized turn has been spent, so another live coding attempt needs new authorization.

## Retrospective

1. A fixture omission consumed a startup cycle, and unwritable logs made the later failure harder to diagnose.
2. A repeatable preflight should validate the worker URL, source repository, hook path, isolated workspace, writable log root, Codex configuration and no-turn App Server handshake before issuing Go.
3. The adapter boundary worked through poll and workspace registration, but the roadmap still needs live result intake, preview and owner review evidence before dispatch can be enabled.
4. The unresolved question is whether the installed CLI/catalog combination or another App Server turn-start condition caused the failure. It blocks the next live cycle, not local code review.
5. The process change applied now is a single-start trial guard and explicit setup guidance; the guard was observed to prevent a second Codex launch. The broader preflight remains guidance until it is automated and exercised.
