# LAT-05 — Pages utility reconciliation checkpoint

Date: 2026-09-28. Isolated candidate branch: `feature/layer-app-model`. Authorization and readiness are recorded in the original checkout's `docs/design/layer-app-transition/work-record.md`. This checkpoint covers the local utility path; LAT-05 remains open for compatible Work agent admission and output adapters from WORK-AGENTS-01. Candidate dispatch stayed disabled, and no provider turn, current-portal write, external effect, or promotion occurred.

## Process outcome

LAT-04 stored reviewed connections and routine definitions but had no execution proof. The new check uses a persistent receipt for each exact policy, story and flow revision set, plus a stable gap key for each story. A reordered input yields the same receipt; an unchanged retry creates no second Work item. The gap ledger keeps exception and rejection decisions separate from ordinary Work state. This was applied to a disposable real knowledge/Work project and a browser path, rather than inferred from a static prototype. The agent path remains a prerequisite, not an assumed capability.

## Task outcome

- An active, reviewed Vision → Pages `flow-candidate` connection enables a deterministic story-to-flow coverage utility. It reads current story and flow revisions; a flow step counts only when it has both a story and a real page. A missing story stages one `pages.flows` Work suggestion. The suggestion pins source and policy revisions.
- Receipts, gap observations and run inputs persist in SQLite. An actionable run links to Work; a no-op scan retains its receipt without inventing a Work run. Repeated, reordered, restarted and changed inputs are handled idempotently.
- A real page/flow edit closes an untouched suggestion and retains its Work history. A touched or otherwise active item becomes `pending-review`. Owner-recorded `exception` and `rejected` decisions close only untouched suggestions with the recorded reason and keep an intentional gap quiet until reopened. A touched item must be resolved in Work first. Removing or deactivating the source degrades coverage without deleting outputs or Work. No utility action grants Go or starts an agent.
- Pages Operations shows coverage, exact revisions, Work links, an owner-only check control and reviewed gap decisions. The candidate remains separate from the running portal.

## Evidence

- `node --test apps/portal/tests/pages-reconciliation.test.mjs`: **4/4 passed**. Includes a real candidate knowledge/Work fixture as well as receipt and decision cases.
- `npm run test:server --prefix apps/portal`: **130/130 passed** before the final run-link tightening; the affected focused suite passed again after it.
- `npm run typecheck --prefix apps/portal`: passed with the same three optional-chain warnings present in LAT-04.
- `npm run build --prefix apps/portal`: passed with the existing large-chunk warning.
- `PLAYWRIGHT_MODULE=/home/henry/vscode-projects/launch-lms/apps/web/node_modules/playwright/index.mjs node apps/portal/tests/lat05-browser.mjs`: passed against a new disposable candidate server at `aludel.lat05.localhost:4312`. [Browser ledger](browser.json), [wide view](connection-wide.png), [390px view](connection-390.png). No page errors, page-wide overflow, or axe WCAG 2A/AA/2.1AA violations.
- The current portal on 4310 and existing candidate on 4311 were left running. An automatic approval review rejected a request to stop the 4311 PID, saying it might be the current portal. Read-only `/proc` checks showed PID 126772's cwd under `aludel-layer-model` and PID 5342's under `aludel-workshop`; the rejected action was not retried. A separate disposable port supplied browser evidence without disturbing either server.

## Retrospective

1. **Friction:** existing `syncBacklog` removes untouched suggestions and has no durable policy/gap identity. It could not safely stand in for a reviewed connection routine. Browser support's default Playwright path was absent after `/tmp` cleanup; the already installed read-only module was used explicitly.
2. **Next equivalent task:** retain a policy/input receipt and stable gap key before creating Work, and test against real domain records. Keep the Playwright module path configurable as the shared browser helper already allows.
3. **Downstream impact:** LAT-06 may use this policy and gap ledger for Vision → Pages discovery, but must review one wrong relation and pin its Work inputs. The WORK-AGENTS-01 adapter remains required before an agent routine can execute. LAT-09 still owns owner comparison and promotion evidence.
4. **Questions:** which action-neutral output adapter will carry a Pages candidate flow through exact Work review remains open under WORK-AGENTS-01. It blocks LAT-05 completion, not the checked utility path. No new owner decision is needed for the utility behavior.
5. **Applied and tested process change:** the receipt/gap lifecycle and real-domain test caught a run-history hole: no-op scans had been written as routine runs without Work. The implementation now records those as receipts only and links actionable runs to Work. The focused suite passed after that change and after the quiet-decision Work closure check (4/4). Owner usefulness and real agent admission remain unproved.
