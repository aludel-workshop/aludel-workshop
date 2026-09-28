# LAT-03 shared shell and Home evidence

Date: 2026-09-28. Candidate branch: `feature/layer-app-model`, based on LAT-02 commit `ca2e771`. Scope is the isolated local candidate. Symphony dispatch remained disabled.

## Result

- The rail reads the project’s persisted layer instance list. It renders Home, a divider, visible local layers, a divider, Library and Work. Settings remains a utility route. Built-in output views and their record URLs remain intact.
- An owner can show or hide each local layer in the rail and on Home independently. Preferences persist in `layer_instances` with a forward-only, idempotent column addition. Hiding a navigation card does not hide or delete the layer’s records. A non-owner can read preferences but cannot change them.
- Home offers optional layer cards and keeps its existing milestone, attention, app, recent change and Code summaries. Each local layer has shared Operations and Knowledge URL slots. Operations reads the existing layer routines and Work count. Knowledge honestly reports that layer-owned documents are not configured yet; LAT-04 owns that content and editing. Existing layer output tabs remain in place.

## Checks

- `npm run typecheck` passed; only the two pre-existing optional-chain warnings in `code.ts` appeared. `npm run build` passed. `node --test tests/layer-contract.test.mjs` passed 3/3, including owner/member scope, preference round trip and exact output availability after hiding a card.
- The dedicated candidate launcher rebuilt and started at `http://aludel.layers.localhost:4311/` using its own `.data` and dispatch off. The current portal was not edited or restarted.
- [Browser acceptance](browser.json) used a disposable candidate project and passed: rail order, hide/show persistence after reload, Home cards, existing Pages and Vision sections, shared Operations/Knowledge routes, Library/Work, shell search into a native document, two exact document URLs with Back/Forward/reload, no page errors, and no page-wide overflow at 390px. Axe WCAG 2 A/AA and 2.1 AA checks passed for [Home wide](home-wide.png), [Pages wide](pages-wide.png), [Operations wide](operations-wide.png), and [Home at 390px](home-390.png). The [browser script](../../../apps/portal/tests/lat03-browser.mjs) is replayable against an isolated candidate; it creates disposable data.
- `git diff --check` passed before commit.

## Limits and retrospective

1. **Avoidable friction:** LAT-02’s instance table had no presentation preferences, and shell navigation still used a fixed array. Browser support’s old default Playwright path was absent; the installed cached module had to be passed explicitly. The first browser assertion read decorative icon text as link text and was corrected to inspect labels.
2. **Preparation:** keep the project-scoped instance API as the single visibility source, and use a browser acceptance script that covers its persisted mutation, route history, search and narrow layout together. A stable test-browser path should be set by the runner environment.
3. **Downstream effect:** LAT-04 can fill the shared slots with layer-owned documents and editable Operations without reworking the shell or replacing native Pages views. LAT-05 still owns routine execution and reconciliation; these slots do not imply runnable new routines.
4. **Questions:** owner usefulness and comparison with the current portal remain LAT-09. No external layer, live agent run, current-data migration or promotion was attempted.
5. **Applied and tested:** the preference API and UI share the same instance rows; the focused permission test and authenticated browser hide/reload/restore path both passed. The reusable browser check also caught an asynchronous redraw assertion in the test itself, which was changed to wait for the actual state. Owner preference and long-term adaptability remain hypotheses until owner comparison and later layer additions.
