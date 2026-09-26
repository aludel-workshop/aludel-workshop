---
id: lay-05-live-interruption-recovery
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# LAY-05 live interruption recovery

## Scope and process correction

The owner authorized up to three additional very small supervised Codex turns. The candidate-retention trial used one. This trial used the remaining two to interrupt a tiny `GET /api/ping` change after its first file edit, restart Symphony, and allow one recovery turn on the same disposable workspace. A separate two-start wrapper bounded Codex independently of Symphony retries. No candidate was accepted or deployed.

The first fixture exposed a preflight defect before any model turn: pinned Symphony's default approval value was `reject`, which Codex CLI 0.157 rejects at `thread/start`. Two App Server processes failed there and the wrapper blocked more starts. Aludel conservatively consumed three run reservations, including the guarded retry, but no model turn or file edit occurred. `WORKFLOW.example.md` now explicitly sets `approval_policy: never` and retains `thread_sandbox: workspace-write`. A no-turn `initialize` and `thread/start` probe passed before the fresh retry. This adds the loaded approval policy to the live preflight contract.

## Observed live recovery

On fresh disposable project `p-f7fa2c4a36`, Work `wrk-b6b7aec2` began at Git commit `a831c7cb65dc9b248f74bc57bf22e02edc39fcfd`. The first real Codex turn reserved run 1, created `server.test.mjs`, and was then interrupted by terminating the disposable Symphony process group before candidate submission. The attempt remained working, its workspace retained the test file, and no candidate existed.

Pinned Symphony restarted against the same workspace. The second and final permitted model turn reserved run 2, resumed the partial implementation, and called Aludel's commit tool. Aludel recorded submitted candidate `can-802d6ec1-7229-4b1a-9677-722a43311bff` at exact commit `fc14de5c9554f23bfd36f0a4ae8e562e9e6b0898`. The attempt moved to Submitted with `runs_started = 2` of 3. The shared project HEAD remained at the Go-pinned base.

The retained Aludel snapshot contains only `server.mjs` and `server.test.mjs`, is clean at the candidate SHA, and independently passes its one Node test. The agent claims `npm test` and `git diff --check` passed; it marked direct socket acceptance checks skipped because the sandbox denied binding. This proves resumption from a preserved, partially edited workspace through candidate submission. The earlier live-retention trial separately proves review data and preview survive terminal workspace cleanup and portal restart.

## Checks and limits

- Focused worker and workspace-hook tests pass 3/3, including portal restart, persisted run counts, fail-closed migration, exhaustion, owner-only exact-limit reauthorization, and final candidate submission.
- Angular typecheck passes with two existing warnings in `src/layers/code.ts`.
- The pinned Elixir overlay compiles; it accepts one turn per run and rejects multi-turn workflow configuration.
- The corrected no-turn App Server handshake passes with `approval_policy: never` and `workspace-write` sandboxing.
- The recovered candidate's independent `node --test` passes 1/1.

This does not constitute owner browser review, candidate acceptance, public deployment, a token/dollar spending cap, or proof of recovery from host loss. Real-work dispatch remains off.

## Retrospective

1. A schema-valid Symphony default was incompatible with the installed Codex protocol. Testing only login and model availability missed it; preflight must exercise the exact loaded thread policy.
2. Run reservation before App Server startup correctly failed closed: even a pre-turn protocol failure consumed allowance. This is conservative and visible, and the explicit owner continuation path handles it without silently retrying.
3. Persistent workspaces plus Aludel-owned run counts are sufficient for process interruption recovery in this case. Host-loss recovery and off-host workspace retention remain later infrastructure concerns.
4. Live interruption recovery is now proved for a tiny partial edit. Owner browser review is the remaining LAY-05 acceptance gate.
5. The process correction was applied immediately: explicit approval policy, no-turn handshake, fresh disposable retry, deterministic interrupt after the first edit, and an independent exact-snapshot test all passed.
