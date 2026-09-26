---
id: work-agents-01-host-online
kind: implementation-evidence
status: partial
updated: 2026-09-26
---

# Local Symphony hosts online

## Scope and process correction

The owner explicitly requested local Symphony activation. Before starting a host, the portal database showed no queued or running agent batches. This kept activation to authenticated polling and capacity reporting; no model turn was authorized or started. The setup check exposed two independent addresses: `ALUDEL_WORKER_URL` for the workspace hook and `tracker.provider.endpoint` for Symphony's own poller. The run procedure now calls out both. Docker Desktop's host network did not share the workspace's loopback, so the local workflow uses the portal's accepted `aludel.localhost` name through a Docker gateway alias. The Aludel adapter permits that one additional local HTTP name.

## Observed result

- The Aludel adapter and `profile-turn.patch` compiled against pinned Symphony commit `be10a1b79df723d6d7612b5651c8522704dafb2e` in the cached `elixir:1.19` image. The patched escript built successfully. The isolated Codex 0.157 CLI reported an existing ChatGPT login inside the trusted container without printing credentials.
- `aludel-symphony-browser-buddy` and `aludel-symphony-test-app` are running as the local user, each with one configured slot and Docker's `unless-stopped` restart policy. Their project source mounts and pool credential mounts are read-only; the shared isolated Symphony workspace root is writable. The Codex auth file is mounted read-only into a separate writable Codex state directory.
- At 2026-09-26 15:36 UTC, authenticated automatic polls recorded `reported_capacity=1`, `profile_overrides=1` and fresh `last_seen_at` for both `p-dfce104b06` (browser-buddy, W-4) and `p-683f3c21f7` (test-app). Browser-buddy advanced its heartbeat across multiple 30-second polling cycles. Both project databases had zero queued or running batches at activation; Symphony displayed zero active agents and zero tokens.
- The first Docker route returned connection refused. A gateway probe reached the portal, but the copied workflow still pointed to container-local `127.0.0.1`; correcting its tracker endpoint and allowing `aludel.localhost` in the adapter made automatic polls succeed. A manual authenticated API probe returned HTTP 200 before the process's own subsequent heartbeat was checked. No credential value was printed or saved to repository evidence.

## Limits at initial activation

At initial activation the running hosts used a disposable patched checkout, Mix cache and Codex 0.157 package under `/tmp`; Docker will restart the containers while those paths exist, but clearing `/tmp` requires rebuilding the local runtime. The Docker gateway address is specific to this machine. This establishes online capacity and authenticated polling, not an end-to-end agent turn or real concurrent throughput. Provider adapters other than Codex and cross-project shared scheduling remain open. The owner can now stage W-4 and deliberately press Go in Work; that action is a separate authorization to start a turn.

## Retrospective

The work was slowed by treating a running container as proof of a connected worker, and by the workflow's hard-coded tracker endpoint differing from the hook URL. The applied process change is to verify a fresh portal heartbeat after startup and again after one polling interval, with the exact host-reachable endpoint recorded. The two live pool heartbeats test that change. That activation did not yet automate host startup; the later reboot-recovery section records the implemented launcher reconciliation.

## 2026-09-26 Work readiness repair

The owner observed Deploy online while Roles still said agents could not take work and Board disabled agent assignment. Read-only inspection found that the live portal had been started from the ignored `.env` without `MACHINE_SYMPHONY_DISPATCH`, while both projects already held active Codex-compatible profiles and fresh host heartbeats. The missing local setting was added to `.env`, and the portal was rebuilt and restarted through that same env file. Its startup log now says `Symphony Work dispatch: enabled`. The obsolete manual-pairing warning was replaced, and Deploy now reports Work dispatch separately from host status.

The disposable `symphony-pool.test.mjs` HTTP regression passes with an active named Codex profile in Work's `symphonyProfiles` and `dispatchEnabled=true` in both the Work snapshot and Deploy runtime response. Portal typecheck and build pass; both hosts continued polling. An attempted live snapshot check that would have created an owner session from the database was rejected by automatic approval review because it would impersonate a portal owner. No such session was created. Live verification instead used the non-secret startup status, read-only profile/pool metadata, and the disposable HTTP regression. The remaining direct check is the owner's browser refresh of Roles and Board; no work was assigned or batch started during this repair.

The process failure was checking only worker heartbeat when declaring the system usable. Startup config, active compatible profiles, and host capacity are independent readiness inputs. The applied check is a visible Work-dispatch status in Deploy and a precise Roles message when that status is off. This was exercised in the disposable HTTP regression and local startup log; owner browser usability is still unverified.


## 2026-09-26 reboot recovery and live batch evidence

The post-reboot mismatch was reproduced: `launch-machine` started the portal with dispatch admission enabled, while both `unless-stopped` worker containers exited 127 because all executable runtime mounts under `/tmp` had been recreated as empty directories. The applied process correction is a startup contract with separate evidence for admission and execution: the launcher now reconciles configured local hosts from persistent ignored data, while Deploy continues to derive online state only from recent authenticated heartbeats. A host-start failure does not masquerade as online and does not prevent the portal from rendering queued work as Blocked.

Observed recovery:

- The manager rebuilt official Symphony commit `be10a1b79df723d6d7612b5651c8522704dafb2e` with the checked-in profile and runtime-block overlays under `.data/symphony-host`, installed isolated Codex 0.157, and recreated only `aludel-symphony-test-app` and `aludel-symphony-browser-buddy` with persistent mounts. A second invocation reused the build and both existing containers.
- Both project pools reported fresh authenticated heartbeats, capacity 1 and profile override support. `--verify` passed twice. Node 24.14 and Codex 0.157 both execute through the login-shell command path inside the Browser Buddy container.
- Existing Browser Buddy B-3 was already explicitly Go-authorized before recovery. Restoring the host moved it from Queued to Working without changing its authorization. Its item exposed the accepted run payload with phase `Draft`, activity `Preparing a review proposal`, and model `gpt-5.6-sol`. The one run submitted proposal `spr-d165d844-4b7d-4786-929e-9053d8272880`; B-3 is Done and W-4 is in Review with activity `Submitted proposal`.
- The live retry exposed two preflight contract gaps before any model turn: Symphony login shells reset PATH, and the trusted hook had not copied the adapter’s `aludel.localhost` allowance. Stable `/usr/local/bin/node` and `/usr/local/bin/codex` mounts plus the same narrow Docker-local hostname allowance corrected them. Neither failure reserved a run; the successful provider turn used run 1 of 3.
- Shell syntax and `git diff --check` pass. Portal typecheck and production build pass with the existing Angular optional-chain and bundle-size warnings. The workspace-hook test passes; the focused Symphony/output suite passed 21 of 22 tests. The security-audit fixture still fails to project its synthetic Ready issue and also fails alone; this startup change does not touch that server eligibility path, so it remains a separate regression to resolve rather than being counted as recovery proof.

Retrospective: Docker restart policy was treated as persistence even though every meaningful bind mount was volatile. The durable improvement is to content-address generated runtime inputs under application data and make launch reconcile desired hosts idempotently. The live B-3 transition tested the full result—not just container uptime—from heartbeat through item progress to a review-only output. Remaining limits are the upstream evaluation-only status, dependency advisories reported by Hex, Docker Desktop’s machine-specific gateway, the separate security-audit fixture failure, and the lack of production hardening.

- A final restart through the modified `./launch-machine` rebuilt the portal, reported both persistent workers without recreating their containers, started the portal with the clearer `Symphony Work admission` message, returned HTTP 200, and received newer authenticated heartbeats from both pools.
