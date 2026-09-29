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

## 2026-09-29 packet closeout after Work handoff proof

The initial utility checkpoint above was partial because it had no agent admission/output proof. The later owner-authorized [WORK-AGENTS-01 Pages trial](../work-agents-01-lat-adapter.md#2026-09-28-corrected-one-turn-pages-retry) supplies that missing bounded observation: a reviewed Pages connection created a deduplicated Work suggestion; a person queued, assigned and Go-authorized its single-item batch; one Codex turn submitted a read-only flow proposal; Work held it in Review with zero flows before acceptance. The routine never granted Go. The failed first turn also exposed and led to a tested correction of the final-run route guard. The candidate remained isolated from the current portal.

Together, the utility tests/browser journey above and the live Work handoff satisfy LAT-05's specified receipt, gap, policy, utility closure, authorized agent queue and review-only output boundaries for **one Pages story/flow policy**. The owner said “let's call this action clear” on 2026-09-29 after the subsequent DEC-051 groundwork discussion. This closes the bounded packet and transfers the new layer-owned action inventory, story-free Pages source and role migration to LAT-06–08; it does not accept the disposable one-step flow proposal, validate its usefulness, authorize another provider turn or promote the candidate.

**Closeout retrospective:** the prerequisite was not merely an action adapter's existence; the one-turn host route had to keep the issue available while the final reserved turn ran. The trial also showed that a title-only story yields a structurally valid but shallow proposal. The reusable process check is to join exact-input utility evidence to Go/attempt/review evidence and inspect the output itself before declaring an agent path proved. This was applied in the later live trial; richer-input usefulness and the DEC-051 action migration remain separate LAT-06/09 gates.
