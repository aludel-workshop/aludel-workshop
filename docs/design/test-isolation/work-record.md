# TEST-ISOLATION-01: tests must not write to the real portal data

## Authorization

2026-10-06, owner in chat: "go ahead, 1-3" on the proposal below. Scope: local only.

1. Add `.vscode/settings.json` excluding `.data`, `node_modules` and `test-results` from file watching and search; delete the `apps/portal/.data/layer-repos` directories that match no project in `machine.sqlite`.
2. Give every test file its own temporary `MACHINE_DATA_DIR` unless it sets one, and remove it when the file finishes.
3. Under the test runner, refuse the fallback to the real `apps/portal/.data`.

## Finding

Memory was heavy and did not drop after the full suite. The VS Code file watcher held 10.7 GB RSS. Five test files (`work-runs`, `lay-07`, `journeys`, `connect`, `pages-reconciliation`) use a temporary database but leave `MACHINE_DATA_DIR` unset, so `server/layer-package.mjs` wrote each test project's layer repo (about 3,800 files) into the real `apps/portal/.data/layer-repos`. Measured per file: 21, 8, 1, 1, 1 new directories, about 32 per suite run and never removed. 3,528 directories had built up there (about 13 million files); 4 belonged to the 5 live projects. Nothing excluded `.data` from watching. `security-audit-worker` leaks the same way: it sets `MACHINE_DATA_DIR` only for the server it spawns, not for its own in-process calls.

Found while checking the fix: layer view builds (`tools/build-layer-ui.mjs`, about 1.1 GB each) start fire-and-forget from `layer-ui.mjs` `status()`. When a test process exits mid-build, the builders are re-parented to init and run to completion, so memory stays held after the suite has ended. Four were observed still running after a single test file had exited. This was fixed under the same authorization ("memory not released after the suite").

## Changes

- `.vscode/settings.json` (local; `.vscode/` is gitignored): `files.watcherExclude` for `.data`, `.layer-ui-src-*`, `node_modules`, `test-results`, `storybook-static` and `dist`, plus a `search.exclude`. The window must be reloaded to take effect.
- Deleted 3,524 orphaned `layer-repos` directories, plus one more created by a baseline run during this check. The 4 directories matching a live project ID (sha256 of `projects.id`) were kept.
- `apps/portal/tests/isolate-data.mjs`, loaded through `--import` by `test:server`, `test:server:templates` and `tools/test-affected.mjs`: in each per-file child (`NODE_TEST_CONTEXT`) without `MACHINE_DATA_DIR`, it sets a fresh temp directory and removes it on exit.
- `server/layer-package.mjs`: under the test runner (`NODE_TEST_CONTEXT` or a `*.test.mjs` entry), the fallback to `apps/portal/.data` throws, telling the developer to set `MACHINE_DATA_DIR`.
- `tools/build-layer-ui.mjs`: exits, and removes its scratch directory, once its parent process is gone (checked each second). Because this file is part of the frame SDK digest, a running portal rebuilds each layer's views once after restarting on this change.

## Evidence (2026-10-06)

- Leak per file before the change, templates on: work-runs +21, lay-07 +8, journeys +1, connect +1, pages-reconciliation +1, review-previews +0.
- Guard: `node --test tests/connect.test.mjs` without the preload fails one test with the guard's message, and `layer-repos` is unchanged.
- Preload: those five files with `--import ./tests/isolate-data.mjs` give 57 pass, 0 fail, `layer-repos` unchanged and 0 temp directories left.
- Full templates gate at concurrency 4 (before the builder change): 359 pass, 1 fail, 7 skipped, `layer-repos` unchanged, 0 temp directories left. The failure was `security-audit-worker`: "disposable portal started", a timing wait on a spawned portal under load. That file sets its own data directory for the spawned portal; alone, it passes with the change and failed once without it, so the failure is pre-existing.
- Builder: a real `pages` view build was spawned and its parent SIGKILLed. The builder exited about 5 s later with no output and no scratch directory left.
- First rerun after the builder change was cut off when the agent session ended: 98 of 367 tests ran, and 7 temp directories were left because a killed process skips its exit handler. The preload now removes `aludel-test-data-*` directories older than an hour. Long jobs are now started with `nohup`, so they survive the session.
- Full templates gate with every change, concurrency 4, detached: 358 pass, 2 fail, 7 skipped. 15 s after it exited: 0 layer view builders running, 0 temp directories, 0 scratch directories, `layer-repos` still 4, 5.7 GiB used. Failures: `security-audit-worker` (as above) and `data-layer` ("The layer API handler did not finish within its limits", in `runPure`), both under load average around 20 with item containers running. Run alone together, both pass (7 pass, 0 fail).
- After the window reload, used memory was 4.6 GiB (16 GiB before), and the watcher no longer appeared among the top processes.
- VS Code watcher RSS: 10.7 GB before. 6.2 GB once the orphans were moved out of `layer-repos`, before the window reload.

## Retrospective

1. **Harder than necessary:** the symptom (memory not freed after tests) pointed at the test processes. The memory was actually held by the VS Code watcher and by orphaned builders. Listing processes by RSS found both within minutes; grepping for tests that set `MACHINE_DATA_DIR` missed `security-audit-worker`, which sets it only for a child process.
2. **What would make it easier next time:** the layer-package guard turns a leaking test into a failing one, and the preload makes isolation the default. Checking `ps --sort=-rss` and `.data/layer-repos` growth is the fast first look for memory complaints.
3. **Process/roadmap:** anything a test or the portal spawns must stop when its parent does. The builder now does; other long children (previews, hosts) have not been audited, so that remains a hypothesis to check if memory climbs again. Two tests time out under heavy container load, so gate results on a loaded machine need a rerun of the failures alone before they count.
4. **Questions:** none blocking. Whether `.vscode/settings.json` should be tracked (`.vscode/` is gitignored) is the owner's call.
5. **Applied and tested:** preload, guard, builder parent check and temp sweep, each with the checks above. Not yet proven: that the watcher stays small over days of normal test runs.
