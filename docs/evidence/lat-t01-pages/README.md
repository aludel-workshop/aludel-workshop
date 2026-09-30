# LAT-T01/T02 Pages-first local checkpoint — 2026-09-29

## Scope and source

Owner chat authorized bounded local implementation and preview of a Pages-first layer template. This is an isolated candidate based on accepted CUSTOM-LAYER-01 revision `6d43ed8f1cd0bd00be86fb1b2eb9ae28f3ce2b12`; it does not change the retained LAT-08 candidate or live portal data. The separate local Pages template repository is pinned at `ca4b7d0e27a8de96b0da5d25f49d2aa2820b0abb`. No external repository or provider was changed.

The template repository owns `layer.json`, Charter, five Knowledge documents, the Map/Pages/Flows Angular UI source, Pages SCSS and a server-source inventory. The portal candidate installs a distinct Git copy for each project and reads the exact accepted commit for the descriptor, native tab labels, Charter and seeded Knowledge. The build copies UI blobs from that exact commit into ignored generated source, with explicit host SDK aliases. The original Pages UI modules and their style block were removed from portal source. Package scripts are not executed during installation. The feature flag keeps the existing path available for comparison.

## Evidence

- `npm run typecheck` and `npm run build` passed after UI extraction; existing Angular optional-chain and bundle-size warnings remain.
- Full `npm run test:server` passed **167/167** after the generic loader and flow-review regression fix. The package test proves two projects get separate repository copies, the same exact commit, declared tabs/Knowledge, idempotent installation and immunity to an uncommitted charter edit. Focused migration tests include a new unmapped Pages Work item and pass **13/13** with layer contract and Pages documents tests.
- The `layer-bar` browser check passed for shared navigation, Tasks/Knowledge/Manage, accessibility and 390px width. The Pages browser check passed through Map, map-to-flow, page spec, content edit, Built preview, flow review and 390px Map. Representative captures: [map and flow](map-flow.png), [flow review](flows-review.png), [phone Map](map-phone.png). These use disposable project data.
- The first Pages browser attempt failed at flow review because `recordNewWorkAction` read `humanRunnable` from a null mapping. The candidate now records an unmapped action as blocked; its regression test and complete browser path pass. This fix is in the isolated candidate only.

## Capability ledger and gaps

| Capability | Checkpoint | Remaining gate |
|---|---|---|
| Charter, Knowledge, identity, outputs, native tabs | Read from project-bound exact commit | Reviewed owner fork/repin and upgrade flow |
| Map/Pages/Flows UI and SCSS | Source moved to template repo; typecheck/build/browser parity passed | Build is pinned globally; project-specific fork UI changes cannot load yet |
| Page/flow records, stable IDs and revision rules | Existing host-backed adapters kept; browser flow preserved | Portable output schema, export/import and repository authority cutover |
| Actions, routines, discovery, review | Existing portal adapters retained; full server/browser regression passed | Extract behind checked SDK and compare permission/review semantics |
| Server source | Copied into template as inventory | Do not execute until isolated capabilities and host API are defined |
| Optional Vision / Code observation | Existing behavior retained; dedicated prior tests still pass in full suite | Same-fixture extracted adapter proof |

This is a **source and registration checkpoint**, not a completed LAT-T01 or LAT-T02 packet. The host still has Pages-specific action/output routing; output authority is still SQLite. The candidate depends on a sibling local template checkout. Per-project code customization, safe repin/rollback, portable output import and original-data migration remain unproved. LAT-08 owner browser and original-data startup gates remain open.

## Retrospective

The earlier process treated a package manifest and generic tab list as enough to call a layer portable. Moving actual UI code exposed the need for a pinned compile path and a small host SDK seam; the browser check then exposed an unrelated null-action migration crash. The process improvement applied now is to keep a capability ledger that names the source of each behavior, pair source extraction with the full native journey, and test discovered failures as regressions. The observed UI journey and 167 server tests support this first source slice. They do not prove per-project UI bundles, safe server extension execution or data authority cutover. Next work should define those boundaries and run same-fixture migration and fork customization checks before retiring host Pages adapters.
