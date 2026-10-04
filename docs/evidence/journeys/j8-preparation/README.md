# J8 local preparation — 2026-10-03

This records Codex's setup assistance, not the owner's trial log or acceptance. Authorization is in the [work record](../../../design/journeys/work-record.md#j8-trial-assistance-authorization-2026-10-03-codex-owner-chat). The owner keeps the walkthrough log and retrospective.

## Observed setup

- Pulled `main` from `80d5bc5` to merged PR #2, `440c2bd`, preserving the owner's `notes.txt` and unrelated untracked checkouts.
- Docker daemon responds (29.2.1); Biome's existing Symphony container is running.
- Code template `82cb9ef` exists locally and its UI typecheck passes.
- Launcher build passed. Initial restart crashed in `seedBuiltInDefinitions`: it compared Biome's accepted older package outputs with the newest catalog pin before update Work could be raised.
- Local repair in `server/layer-registry.mjs` uses the accepted manifest's outputs when seeding definitions and keeps the authority check. Existing definitions and accepted commits are preserved.
- A disposable regression using Biome's actual old template `83ce28a` fails on merged main with the same startup error and passes with the repair.
- Portal responds HTTP 200 at `http://aludel.localhost:4310`; templates and existing Work admission remain enabled.
- Read-only verification: Biome has no remaining string criteria; Work #3 has `note-1`, `note-2`, `note-3`. Code remains installed at `83ce28a57c1de6a579050ebb677aba92f91c35cc`.
- Biome Work #5 (`wrk-7168e573`) is **Update Code to the latest code template**, in review, 12 changed files, no conflicts, branch `template/code-82cb9ef707de`. Exactly one item exists for that destination pin. Pages (#4) and Vision (#6) updates also appeared.
- No owner session credentials were used; no review, sign-off or acceptance action was taken.

## Verification

- Older-template restart regression: failed before repair, passed after repair.
- Code template UI typecheck: passed.
- Launcher frontend build: passed (bundle-size warning).
- Code browser journey: passed on disposable data, including Journeys, Library, Knowledge, accessibility and 390px layout.
- Browser prerequisite repair: the available Playwright package expected Chromium 1243, while the installed browser is 1228. Installed Playwright 1.61.1 under `/tmp/aludel-j8-playwright`, matching the existing browser; rerun passed.
- Standard server suite: **304 passed, 0 failed, 31 skipped**. Templates suite: **326 passed, 0 failed, 9 skipped**. Skips are mode-specific or explicitly gated in the existing tests; the new older-template regression passes in template mode. [Recorded summaries](check-results.txt); full temporary outputs are `/tmp/aludel-j8-server.log` and `/tmp/aludel-j8-templates.log`.

## Owner-reported acceptance blocker

On 2026-10-03 the owner tried to accept Code Work #5 and received “This runnable change needs a review recipe before acceptance.” Its new `.aludel/outputs/journeys.json` contains only `{ "journeys": [] }`. A path-only classifier treated this registry bootstrap as runnable work, making the template update depend on the app-review prerequisite that follows it in J8.

Applied repair: one shared `repositoryAppChanged` classifier serves both displayed run integrations and person/host acceptance. Only an added-file diff proving an empty journey registry is exempt. Edits, deletions, populated or unknown registry content, review recipes, seams, journey tests and app source still require app review. Normal repository validation, freshness, access and owner sign-off gates remain in place.

Evidence: a read-only check of Biome's actual 12-file integration now returns `requiresAppRecipe: false`. A disposable Code host-run integration accepts the empty registry with no app recipe through the normal signing path. Journey/Work tests pass (35/35); templates-mode journey/Work/Code tests pass (41/41). The local portal restarted. Owner retry is pending; no live acceptance was performed by Codex. The disposable repository-review browser journey passes, including runnable candidate build and stale-review checks.

Process outcome: distinguish empty spec bootstrap from substantive review inputs, and test the Code update acceptance path before giving trial instructions. The earlier Pages template-update test used a repository without an app root and did not exercise this gate. This fixes a demonstrated setup dependency; the overall J8 walkthrough remains owner evidence.

## Preparation retrospective

1. **Observed friction:** latest-pin tests and the template merge test did not exercise an existing install's restart; startup failed before the update offer. The browser runner and installed browser also had different versions.
2. **Applied improvement:** added an older-accepted-template restart regression and a restart prerequisite to the handoff checklist. Pin the browser runner to the installed browser for local verification.
3. **Downstream effect:** J8 still starts with reviewed template Work; no automatic template promotion is needed. One `next_action` stays `JOURNEYS-01`.
4. **Resolved/open questions:** the startup blocker is resolved locally. Owner review of Code Work #5, reference-first request behavior and the Specify → Implement walkthrough remain open and block J8 completion.
5. **Evidence versus hypothesis:** the regression's before/after result, successful live restart and raised update item support this preparation improvement. The broader reference-first workflow's usability remains a hypothesis until the owner's walkthrough. No J8 completion or owner acceptance is claimed.
