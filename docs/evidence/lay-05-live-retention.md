---
id: lay-05-live-retention
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# LAY-05 tiny live candidate retention trial

## Scope and process outcome

The owner authorized up to three further supervised Codex turns if needed, each on a very small disposable task. The first task was a `GET /api/posts` endpoint returning an empty JSON list, while preserving `/api/health`, plus one automated test. One Codex App Server process ran; no further provider turn was needed for this check. A separate one-process guard enforced the bound because Symphony's `max_turns` applies to a run, not all later continuation runs. The disposable project, worker token, logs and source repository were isolated under `/tmp`; no production project or external tracker was used.

The prior trial's process gap was checking preview before Symphony removed its workspace. This trial checked the candidate **after terminal workspace cleanup and a portal restart**, then independently checked its retained Git snapshot. The change to the trial procedure is supported by this live result; it is not evidence of owner browser review or interruption recovery.

## Observed live result

Pinned Symphony ran the Aludel adapter with isolated `codex-cli 0.157.0`. On disposable project `p-a72203198d`, Go-authorized Work `W-1` began at `42aebcc4813f7971a64c76616f515f849674dd74`. Codex called `aludel_commit_candidate`; the host submitted candidate `can-5a0870e8-cb3a-4bdc-a497-41540cdba180` at exact commit `723da6468076db47cf242f00017d30442f5d20ea`, with attempt `att-a22fdb19-c2eb-45f3-b74e-af11965d4f6d`.

After Symphony deleted its workspace, Aludel's snapshot remained and its Git HEAD matched the candidate SHA. The disposable portal restarted. Candidate detail returned HTTP 200 with a nonempty diff for `server.mjs` and `server.test.mjs`. It retained named, passed agent claims for `npm test`, `node --check server.mjs && node --check server.test.mjs`, and `git diff --check`; the independent `Docker build and /api/health` check was separately marked passed by Aludel. The isolated preview returned HTTP 200 for health and posts, and HTTP 404 for the portal session route. Work moved to review while the shared project HEAD remained at the pinned base.

An independent read-only check on the retained snapshot found a clean Git status, the exact candidate commit with an `Aludel-Work: W-1` trailer, and one passing `node --test` case. The endpoint test checks JSON `[]`, content type and unchanged health behavior. This evidence proves live snapshot retention, readable diff and named checks after Symphony cleanup and portal restart for this bounded case. The candidate was not owner accepted.

## Remaining gates and retrospective

1. The previous healthy preview hid a missing review artifact; requiring a detail read after terminal cleanup exposed that gap. This trial's small task made the artifact lifecycle easy to isolate.
2. Keep terminal cleanup and portal restart in the repeatable live trial checklist, with exact SHA, diff, check names, preview and shared HEAD checked separately.
3. Aludel-owned exact-commit storage and a strict agent-check schema now have live evidence. A durable global turn budget remains necessary before unattended dispatch because a Ready issue may schedule another Symphony run.
4. Owner browser review and live interruption recovery remain unproved. They block packet completion; dispatch stays off for real work.
5. The improved lifecycle check was applied in this live trial and passed. Recovery under an interrupted active turn remains a hypothesis; the earlier local restart and deletion tests do not prove it.
