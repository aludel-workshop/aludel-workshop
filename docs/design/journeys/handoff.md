---
id: JOURNEYS-01-HANDOFF
kind: handoff
status: active
updated: 2026-10-02
---

# JOURNEYS-01 handoff: continue at J3

For a fresh agent (Claude in the cloud) picking up JOURNEYS-01. Read this, then [AGENTS.md](../../../AGENTS.md), [status](../../status.md), the [JOURNEYS-01 work record](work-record.md) (plan, authorizations, run log, retrospectives), [DEC-063](../../decisions.md) and the [deferred code-tracing record](../code-tracing/deferred.md).

## Where things stand

| Repository | Commit | What |
|---|---|---|
| `aludel-workshop` `main` | `bdcc7bd` | J0 Codex baseline and cleanup (`d46c3fe`), J1 journey contract (`3d7f082`), J2 Code journeys facet (`3bdc95b`), code tracing removed (`bdcc7bd`) |
| `layer-base` `code` | `aaef4cf` | Journeys facet and tab; tracing removed |
| `layer-base` `pages` / `data` / `vision` | `ceeb9d4` / `d2e11ec` / `a912d44` | Tracing ("Built by", Built status) removed |

All pins are in `apps/portal/config/layer-templates.json`. Last full run, 2026-10-02:
- `npm run test:server`: 283 passed, 0 failed.
- `npm run test:server:templates`: 306 passed, 0 failed.
- Typecheck and build pass.
- Browser journeys `code-layer`, `pages`, `data-layer`, `vision-layer`, `roles` and `bindings` pass.

## Environment prerequisites

1. **`layer-base` must exist at `./layer-base`**, the repository root's sibling of `apps/`, with its branches at the pinned commits. It is git-ignored here and lives in the private repository [aludel-workshop/layer-base](https://github.com/aludel-workshop/layer-base) (pushed 2026-10-02; each branch head matches its pin). Restore it with: `git clone https://github.com/aludel-workshop/layer-base.git layer-base && cd layer-base && for b in main code pages data vision design markdown; do git show-ref -q refs/heads/$b || git branch $b origin/$b; done`. Without it, template mode (the default since DEC-062) can't load layers, and the templates suite fails. Template commits made in later slices are pushed to it as part of the slice; a push needs the owner's say-so.
2. **Node.** Local runs used `v24.14.0`; `package.json` asks for `^24.15.0`. Run `npm ci` in `apps/portal`.
3. **Docker** is needed for `tests/review-previews.test.mjs`, `previews-docker` and the repository-review browser check. Without Docker they skip or fail. Say which.
4. **Playwright** for browser journeys: set `PLAYWRIGHT_MODULE` to a Playwright `index.mjs` whose Chromium headless shell is installed. The local run used Playwright 1.61.1 with `chromium_headless_shell-1228`, and version mismatches fail at launch. Run journeys with `MACHINE_LAYER_TEMPLATES_ENABLED=1 PLAYWRIGHT_MODULE=… tools/browser-checks.sh <names>` from `apps/portal`.

## Checklist for any template or layer change

From AGENTS.md "Current focus", refined during this packet:
1. Commit the template change on its `layer-base` branch.
2. Run `node tools/typecheck-layer-ui.mjs ../../layer-base <commit>`.
3. Pin it in `config/layer-templates.json`.
4. If the indexer or handler changed, add its sha256 to `config/layer-reviewed-sources.json`, keeping the old digests.
5. Run both server suites and the layer's browser journey.

Steps 2 and 4 each caught a real break in this packet that the suites didn't.

## Next: J3, journey proof

**Authorization.**
- The owner authorized J0–J2 and the tracing removal in chat.
- After the removal they said "do that before continuing with our j tasks", then handed off to the cloud.
- Treat J3 as the next slice in the same local scope: local code, tests, template commits and pins, and commits. Record the start in the work record before executing.
- Not authorized: pushes, deployment, spending, live owner data (Biome, the owner's portal), and owner-impersonating actions.
- J6 needs an owner prototype round before building. J8 is the owner's own trial.

**Scope** (plan row J3, with what J1 and J2 settled):
1. **Writable step tests.** Add `journeys/*.spec.mjs` to the package's own writable files in `apps/portal/server/layer-package.mjs` (`ownWritable` / `ownWritablePatterns`). Don't add them to authority: they run against a preview, never on the host.
2. **Recipe v2 in review.** Replace `reviewRecipe` in `apps/portal/server/review-previews.mjs` (v1: `scenarios[].criterion` index, per-scenario `role`) with `validateReviewRecipe` plus `reviewSteps(recipe, journeys)` from `server/journeys.mjs`. Journeys come from the integration commit's `.aludel/outputs/journeys.json`. Step IDs become `<journey>.<step>`.
3. **Setup call.** The host sends `{ journey, step, persona, fixture, session, reset }` to `POST /api/__aludel/review`, and the app no longer reads `.aludel/review.json` at runtime. Update the generated app in `server/scaffold.mjs`:
   - the setup handler;
   - remove the Dockerfile `COPY .aludel/review.json`;
   - emit `review.json` v2 and `.aludel/seams.json`, matching the J1 fixture `generatedSeams`.

   Generating journeys from Pages flows is optional in J3; say so if deferred.
4. **Step runner.** Run step tests black-box against the candidate and record a result and screenshot per step. **Open design point:** today's check containers run with `--network none`, but step tests need to reach the preview. Choose and record the approach, for example a Playwright container on a per-candidate network with only the preview reachable, before building.
5. **Review UI.** Group the Preview step buttons in `src/layers/work-review.ts` by journey step instead of criterion index. Claims-based stepping is J4.
6. **Separability.** Run the static `undeclaredSeams` check during review preparation. The build-without-`.aludel/` half belongs to J3 if cheap; otherwise record it as a follow-up.
7. **Exit evidence** (plan): extend `tests/review-previews.test.mjs` for a failing step, an uncovered step and a missing persona fixture. Biome's live candidate is owner data and out of reach; use disposable fixtures.

## Gotchas

- **Template updates don't reach existing installs.** Existing projects keep their forked template commit. The host SDK therefore keeps inert shims: `@aludel/host/built-by`, `ctx.builtBy()`, and unit `state`/`links`. Don't remove SDK surface older forks import without the same care.
- **The legacy role inventory** (`server/lat07-actions.mjs`) must list every historical action in `config/roles.json`. Retire entries; don't delete them.
- **`tests/layers-browser.mjs` fails before and after this packet**, waiting for a Vision link. It's pre-existing and not investigated.
- **Code view terms.** Units are "used/unused" (`state` `healthy`/`dead`). There are no trace links anywhere. Don't reintroduce story ↔ code links (DEC-063).
- **Owner files.** The working tree may hold the owner's `notes.txt` edit and four untracked `*-candidate/` and `layer-template-pages/` checkouts. Leave them alone.

## Open owner questions

Not blocking J3:
- How existing installs take template updates. This blocks the Biome part of J8.
- Generated apps' root files: move them under `.aludel/` or keep them as declared seams.
- The tracing-era Pages gate is gone: should Pages get an interim "in the running app" signal before the user-journeys binding?
