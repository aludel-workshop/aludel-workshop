# Biome review setup

Current setup uses promoted `main` (`e8e7874`) and the real portal at **http://aludel.localhost:4310**. [Work record and correction](../../design/biome-review/work-record.md). The standalone :4355 trial was rejected as the owner entry point and stopped. Its evidence below is historical app/fixture proof only.

## Current owner entry point

[Biome Work #3](http://aludel.localhost:4310/p/biome/work/item/wrk-892f00cb) is a real layer-scoped item, still ready. The host now supports genuine person repository submissions and the established review sidebar, Changes/Preview/Tests tabs and criterion-specific scenario buttons. Pending-review work appears in Done while acceptance remains a separate transition.

Automatic approval review rejected creating an owner login ticket and using it to take/start/submit this live item as prohibited impersonation, despite the explicit chat authorization. The rejected command did not execute; no live person run or review was fabricated. These actions remain for the owner through normal signed-in controls:

1. Open Work #3; change its assignee to **You**.
2. **Stage in your batch**, then **I'm working**.
3. **Ready for review**. Enter Local branch `review/biome-guided-trial` and Exact commit `6cdd684553d17cfb25384cc1a24a98b15e52b0f8`.
4. Summary: “Biome signup, first-world setup and guided review preview.” Evidence for the three criteria: signup without an existing account; initial setup as a new member; populated world as the demo owner.
5. **Submit for review**, then **Review** (also available from Done). Each criterion has its own demo-step button; it prepares a real synthetic session and opens the requested page inside Preview.

Restarting the promoted Code layer added its ordinary starter documentation, so the accepted base is now `d5700e16ecb2821889075a9c12430c7164e3dabd`. The prepared candidate merges that documentation and descends from this current base.

The candidate remains on its local branch. `biome.localhost:4310` names the accepted app; this submission's preview has its own isolated host and demo data. No accepted app deployment, main merge or remote push has occurred.

Read-only admission checks pass for the final 24-file candidate: writable paths, package validity and all three recipe destinations. Current app tests pass (2/2), including normal SameSite=Lax sessions and preview-only Secure/Partitioned cookies needed inside the iframe. The real shared review browser check passed embedded author/viewer destinations, exact builds, stale-generation rejection and serial integration. The [expanded browser result](person-browser.log) passes the genuine person stage/start/submission/Done/embedded roles/acceptance journey on a disposable Browser Buddy project; [inspected screenshot](person-repository-review.png). The [person restart test](person-restart.log) passes 1/1 and [editor startup rerun](editor-startup.log) passes 2/2. Full templates-off regressions pass 276, with 31 expected skips and no failures. The complete [templates-on rerun](template-regressions.log) passes 300, with seven expected skips and no failures; [templates-off results](server-regressions.log) pass 276, with 31 expected skips. Final portal typecheck and production build pass with existing optional-chain and bundle-size warnings. These are implementation checks, not a live Biome submission.

## Historical standalone diagnostic

### Historical source and build identity

- Biome project `p-469ba80496`; bound repo `apps/portal/.data/workspaces/p-469ba80496`.
- Local branch `review/biome-guided-trial`, candidate `14e49a5151f50ec3e2ec0fa12bf53169c22056da`, also checked out at `apps/portal/.data/biome-review/candidate`.
- Accepted `main` and binding remain `d26c647ba26fc4e11e64dd92dfe2524f4cd25889`. Bound working tree is clean; no remote push or acceptance occurred.
- Runtime image `sha256:8114783bed478e7a74abf341f8673cd8c0f1e1b1829a76584e6fe2ba00eaacf1`.
- Check image `sha256:34763eac9e7ec635ad1b196368f9f753acc3b3536d19dd3698be4e2740f13864`.
- Inputs: signup `pag-21c02e38@3`, setup `pag-b822ca10@3`, landing `pag-e0221087@3`, marketing `pag-e3331a43@4`, login `pag-437f1264@2`, flow `flw-18ee16dc@6`. The empty sixth page is not implemented.
- App uses the declared Angular/Vite, Node and SQLite stack. `server/demo.mjs` and `.aludel/review.json` version the fixtures and scenarios. This is a starter landscape with panning and species markers; ecosystem simulation is not implemented.

### Historical observed checks

- Local `npm test`: 2 passed, 0 failed. Real signup/session persistence, per-account biome ownership, normal setup disabled, token required in preview, synthetic role reset isolation.
- Local `npm run build`: passed. Local Node 24.14 emits dependency engine warnings; the container installs/builds successfully with its Node 24 image.
- Shared review manager: exact candidate Docker build/health and both app tests passed. Checks run without network, with a read-only filesystem and bounded resources.
- [Browser result](browser-result.json): 9 checks passed. Direct scenario destinations and Page IDs; real demo sessions; initial setup creates a world; signup completes setup; map panning; browser setup API denied; scenario reset; 390px document width; no browser runtime errors. No portal credentials were read or reused.
- Browser screenshots were inspected: [review steps](review-steps.png), [initial setup](initial-setup.png), [populated biome](populated-biome.png), [narrow setup](initial-setup-narrow.png), [narrow biome](populated-biome-narrow.png).
- Launcher and evidence script syntax checks and `git diff --check`: passed.
- Required portal regressions: `npm run test:server -- --test-concurrency=4` completed with 275 passed, 31 skips, 0 failed; `npm run test:server:templates -- --test-concurrency=2` completed with 299 passed, 7 skips, 0 failed. The concurrent runs took approximately 8.3 and 9.4 minutes. Their slow worker HTTP portion eventually passed; no timeout or failure was recorded. Skips match the prior review implementation's template-mode exclusions.

The first browser attempt exposed a launcher bug: `no-referrer` caused the POST form Origin to be unavailable and the launcher's own Origin check rejected it. The control document now uses `same-origin`; the full browser journey then passed. One public-image build failed on the Windows Docker credential helper; retrying with an empty temporary Docker configuration passed. No saved registry credentials were used.

## Historical diagnostic restart (removed)

The standalone launcher `apps/portal/tools/local-review-trial.mjs` was removed in JOURNEYS-01 J0 (2026-10-02) because the owner rejected the standalone page as an entry point; it is preserved in git history before that commit. Branch source remains in both local repositories.

With Playwright and Chromium available, rerun the saved [browser check](check-browser.mjs):

```sh
PLAYWRIGHT_MODULE=/tmp/aludel-review-browser/node_modules/playwright/index.mjs \
CHROMIUM_EXECUTABLE=/home/henry/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome \
node docs/evidence/biome-review/check-browser.mjs
```

## Limitation

The historical standalone diagnostic did not prove the live Work lifecycle. The current candidate can be submitted through the normal person-run branch contract; agent Go still bundles the accepted base and does not automatically import this unmerged branch. T03-CODE remains the overall next action. Owner usability and Biome app acceptance remain open.
