# LAT-04 — optional layer apps and Pages-owned views

Date: 2026-09-28. Candidate branch: `feature/layer-app-model`, based on LAT-03 commit `46bc1cf`. Scope follows the owner's LAT-03 review in `docs/design/layer-app-transition/work-record.md`. This is an isolated local candidate at `http://aludel.layers.localhost:4311/`; the current portal remains separate on port 4310. Candidate Work dispatch remains disabled.

## Process outcome

The LAT-03 navigation checks could not distinguish a hidden built-in from an optional app. LAT-04 added an explicit selection marker to the draft contract and a repeatable zero-layer, Pages-only browser journey. Direct clients that have not used the new catalog retain the legacy seeded setup; explicit selection, including `[]`, creates only chosen layer instances. This distinction was exercised through full server tests and browser account creation. The browser check also caught a false Demo milestone in the Pages-only shell, which was corrected before closeout.

## Task outcome and evidence

- Onboarding now has a six-app local catalog with a valid **start with no layers** choice. Later Look & feel appears only for Design, Pages navigation only for Pages, and Build only for Code or Deploy. The old messaging/account story-pack picker is absent from the candidate flow. The Pages-only browser journey completed with no invented page route.
- Home adds and removes installed layer instances. Removal preserves records and connection documents. The rail shows installed apps; a Pages-only project has no Vision/Design/Data/Code/Deploy rail entries or false milestone. Home, Library and Work remain shared.
- Pages retains the native Map, Pages and Flows surface. Its Operations view has a Pages Work board linked to global Work, editable routine definitions and run history, and owner-reviewed connection documents. Its Knowledge view has a tree of output, method, routine, connection and resource documents, with scoped exact revisions and editable history. Pages alone shows no neighboring source or invented connection.
- A Vision → Pages document was drafted, given mapping instructions, reviewed and activated in the browser. Removing Vision preserved the document and marked its source unavailable. No sync or agent run was triggered.

Checks: `npm run test:server` **128/128**, `npm run typecheck` passed (three optional-chain warnings), `npm run build` passed, `git diff --check` passed. [Browser ledger](browser.json) and captures: [catalog](catalog-wide.png), [empty Home](empty-home-wide.png), [Pages](pages-wide.png), [Operations](operations-board-wide.png), [isolated connections](connections-isolated-wide.png), [Knowledge](knowledge-wide.png), [390px connections](connections-390.png). The browser journey passed wide and 390px axe WCAG 2A/AA/2.1AA checks, with no page errors or page-wide overflow. Existing Pages domain tests cover spec sections, flow review, Map placement, change requests, Work links and generated routes; new contract tests cover exact document history and connection owner/scope rules. Both `4310` and `4311` were verified reachable after restart.

## Retrospective

1. **Avoidable friction:** legacy direct-claim tests assumed all layers and seeded story packs, while the new UI passes an explicit selection. A draft that simply stored `[]` lost the distinction. A stale security-audit test also assumed a worker pool could honor a selected model without advertising that capability; the fixture now does so.
2. **Next equivalent task:** keep selection intent separate from the chosen list, and include empty and one-layer project fixtures in navigation, seeding and ownership checks. Keep the browser journey in `apps/portal/tests/lat04-browser.mjs` for later comparison packets.
3. **Downstream impact:** LAT-05 can use the revisioned Pages docs/routines/connections, but must implement durable receipts, actual run admission, deduplication and reconciliation. LAT-07 still owns equivalent domain-specific views for the other built-ins. LAT-08 owns populated-data migration; no live data was copied here.
4. **Questions:** the six built-ins are the available local catalog; arbitrary app installation and external adapters remain deferred. Whether this composition is useful enough to promote remains an owner comparison question for LAT-09. These do not block LAT-05's local kernel work.
5. **Applied and tested process change:** the explicit-selection marker, compatibility path and zero/one-layer browser checks passed; they prove this candidate's local behavior. The catalog's extensibility and future cross-layer usefulness remain hypotheses until later packets and owner review.
