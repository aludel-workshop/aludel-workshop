---
id: evidence-b03a-work-navigation
kind: evidence-retrospective
status: agent-checked
updated: 2026-09-20
---

# Work collection/navigation correction

## Observed failure and cause

The owner reported that `/#/the-machine/work` looked stuck in one work item's detail, with no route back even after hard refresh. Inspection of `apps/portal/src/app.html` showed that the collection URL rendered every task as a full `product-detail` article. There was no selection state or separate detail route. Long scope and acceptance text made the newest item occupy the whole viewport; more items were below it. This was a missing collection/detail interaction, not a cache problem.

The original B-03A browser fixture used one work item and immediately clicked Authorize. It verified transaction behavior while failing to test finding and choosing among items. Earlier process guidance already required collection cardinality and return paths: the requirement existed but was not applied to this bridge. Prior screenshots/axe checks did not establish navigational usability.

An unchanged proposal save also created revision 2, invalidating work bound to revision 1. That is expected revision checking, but avoidable authoring friction. The replacement was prepared against verified identical content; the owner cancelled the old item and authorized the replacement. Preventing no-op saves and making stale-item replacement clearer are follow-ups, not silently implemented in this correction.

## Change and evidence

- `apps/portal/src/app.ts`: route-derived work identity and selected task; no browser-local sticky selection.
- `apps/portal/src/app.html`: compact collection using the existing product-row pattern, per-item URLs, explicit Back to Work, and missing-item state. Authorization remains inside the chosen detail.
- `apps/portal/tests/workflow-browser.mjs`: two tasks; collection has no authorization button; opening, detail reload, returning, choosing another task and collection reload preserve identity. Existing authorize → question → answer → resume → submit path still passes.
- Node 24 `npm run typecheck` and `npm run build`: passed. Build reports the existing large-chunk advisory.
- Isolated test server on port 4315 and fresh `/tmp/machine-work-nav.*` database: browser test passed, no page errors, axe WCAG A/AA checks passed, 390px viewport has no horizontal overflow. Screenshots retained for this correction: [wide](b-03a-work-navigation/wide.png), [narrow](b-03a-work-navigation/narrow.png). The test-results paths are rolling outputs; this run replaced their older fixture screenshots, so those paths are not immutable original-run evidence.
- First test startup raced server initialization and hit SQLite locking. The fixture now waits for `/api/session` readiness before opening its test database; rerun passed. This is a harness correction, not evidence of production concurrency support.
- The live local server serves the rebuilt `dist` files. No owner credentials or authorization records were edited to test the fix. Owner subsequently reported authorizing the work; this does not imply acceptance of the broader portal UX.

## Post-hoc

1. **Friction:** the owner had to diagnose a route failure before authorizing work; our single-record fixture missed it. No-op proposal revisioning added another round trip.
2. **Better preparation:** collection tests must start with at least two distinct records and exercise visible selection, reload and return before testing mutations. A transaction test cannot stand in for an owner journey.
3. **Downstream impact:** apply the collection/detail gate to the project-workspace redesign. Keep historical plans separate from executable authorization. Include no-op proposal editing in the next scoped work-management improvement.
4. **Questions:** navigation cause resolved. Broader feature organization remains the authorized strategy task; multi-project correctness remains unproven.
5. **Applied process:** add an explicit collection-route regression check to the operating procedure; the two-item browser run demonstrates this case works. General prevention across all collections, browser-history/filter restoration and large-list behavior remain future checks, not proven by this run.

This is a bounded owner-reported repair alongside B-03A, not completion of B-03B or acceptance/release of a candidate.
