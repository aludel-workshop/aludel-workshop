---
id: evidence-r-03
kind: feasibility-evidence
status: complete
observed: 2026-09-18
packet: R-03
---

# R-03 — Local Codex adapter feasibility

## Result

A local owner-triggered process can run Codex through the existing ChatGPT sign-in, consume structured JSONL lifecycle events, report token usage, and resume a persisted thread from a later process. Process interruption cancels active work and the same thread remains resumable, but `codex exec` does not emit a terminal cancellation event when interrupted. The portal must persist the cancellation request and synthesize the terminal job state after observing the child process exit.

For M1, use the Codex SDK behind a small local worker and keep the portal's job protocol independent of Codex. Use `codex exec --json` as the initial executable fallback and contract fixture. Do not adopt App Server yet: OpenAI positions the SDK for automation and App Server for rich interactive clients, while M1 only needs deliberate dispatch and streamed progress. Reconsider App Server if mid-turn approvals, live steering, or first-class account management become requirements.

## Environment and authentication

| Item | Observed value |
|---|---|
| Codex executable | Bundled Linux executable from the installed OpenAI VS Code extension |
| Codex version | `codex-cli 0.154.0-alpha.6.2` |
| Node.js | `v18.19.1` |
| Python | `3.12.3` |
| Authentication | `codex login status` reported `Logged in using ChatGPT` |
| Test isolation | Fresh temporary directories under `/tmp`, read-only Codex sandbox, no project or external-system mutations |

No credential, token, account identifier, or auth-file content was inspected or recorded. The executable is an alpha build bundled with an editor extension, so the worker must feature-detect its protocol and pin a tested supported integration before M1 is considered stable.

## Supported surfaces

- `codex exec --json` runs a non-interactive turn and streams JSONL.
- `codex exec resume --json <session-id>` continues a persisted thread in a separate process.
- `codex app-server` is present and supports stdio by default; Unix socket and WebSocket listeners are also exposed. This CLI labels App Server experimental.
- The official Codex SDK supports starting, continuing, and resuming threads. OpenAI recommends the SDK for CI, internal tools, and application integration.

Primary references checked on 2026-09-18:

- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Codex authentication](https://learn.chatgpt.com/docs/auth)

## Reproduction and observations

The successful disposable run used this shape:

```sh
codex exec --json --sandbox read-only --skip-git-repo-check -C "$TEMP_DIRECTORY" "Reply with exactly: R03_OK"
```

It exited `0` in about 4.0 seconds and produced, in order:

```text
thread.started
turn.started
item.completed (agent_message: R03_OK)
turn.completed (usage present)
```

Reported usage was 14,129 input tokens, 12,160 cached input tokens, and 7 output tokens. These counters prove usage telemetry is available; they are not a currency-cost estimate for a ChatGPT subscription run.

A new process then ran:

```sh
codex exec resume --json --skip-git-repo-check <session-id> "Reply with exactly: R03_RESUMED"
```

It reused the same thread ID, exited `0` in about 4.4 seconds, and returned `R03_RESUMED` followed by `turn.completed` with usage. This demonstrates continuation across a process boundary.

For cancellation, a turn started a 30-second `sleep` command. After `item.started` reported the command as `in_progress`, the parent sent SIGINT. Codex exited `1` promptly and stopped the child command. It emitted diagnostic errors but no structured `turn.cancelled` or `turn.failed` event. A later `exec resume` against that thread succeeded and completed normally. The raw thread IDs were intentionally omitted because they add no reproducibility value.

Two successful runs also logged a post-terminal warning that the rollout could not be flushed because the thread was not found. The resume tests still succeeded. The adapter should treat a valid `turn.completed` plus exit `0` as success, retain stderr separately, and surface this warning for diagnosis rather than changing the completed job to failed.

## Minimum portal event contract

| Portal event | Codex evidence | Adapter responsibility |
|---|---|---|
| `accepted` | None; execution has not started | Persist the job before spawning Codex |
| `started` | `thread.started`, then `turn.started` | Store thread ID and attempt start time |
| `progress` | `item.started`, `item.updated`, `item.completed` | Normalize useful item type, status, and safe summary |
| `question` / `blocked` | No proven `exec` terminal type in this spike | Detect supported request events in the SDK; otherwise persist an explicit agent result requiring owner input |
| `completed` | `turn.completed` and process exit `0` | Reconcile both signals and store usage |
| `failed` | `turn.failed`, `error`, malformed stream, or nonzero exit | Preserve structured error and bounded stderr |
| `cancelled` | No terminal JSON event observed on SIGINT | Record intent, signal the process, await exit, then synthesize cancellation unless a stronger terminal event arrived |
| artifact references | Command/file items are progress, not an immutable manifest | Discover only declared output paths and bind review artifacts to repository/build identity |
| usage | `turn.completed.usage` | Store raw counters with model/provider context; do not infer money without pricing data |

Each event needs a portal job ID, attempt number, monotonically increasing sequence, timestamp, event type, and versioned payload. Codex thread and item IDs belong in provider metadata so another runner can implement the same portal contract.

## Failure behavior and implementation constraints

- A child process can end without a structured terminal event, so process exit and stream termination are part of reconciliation.
- JSONL belongs on stdout; human diagnostics and warnings belong on stderr. The worker must parse them separately.
- Cancellation is cooperative only at the process boundary in the tested CLI path. The worker must escalate after a bounded grace period and mark uncertainty if the process or a side effect cannot be reconciled.
- Resume requires persisted Codex thread state. The portal must store the provider thread ID but must not treat it as its own job identity.
- The high input-token count for a trivial prompt shows that loaded context and configuration matter. M1 should measure real repository turns before setting quotas.
- Questions, approvals, and artifact manifests remain unproven. They must be resolved in the runner selection and recovery packets rather than assumed from this smoke test.

## Recommendation for the next packets

R-06A should compare Symphony against this observed boundary: manual dispatch, a replaceable job protocol, structured progress, persisted provider thread IDs, explicit parent-owned cancellation, and reconciliation of process exit with terminal events. R-06B should prefer the SDK-backed local worker if Symphony adds more tracker or orchestration machinery than M1 needs; `codex exec --json` remains a useful fallback and integration-test oracle.
