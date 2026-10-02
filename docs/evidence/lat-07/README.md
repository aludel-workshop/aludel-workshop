# LAT-07 — remaining built-in local layers

Date: 2026-09-29. Isolated candidate branch `feature/layer-app-model`, starting at `cbe7601`. The owner's current-chat instruction authorized bounded local LAT-07 work; scope is recorded in the workshop [transition work record](../../../../aludel-workshop/docs/design/layer-app-transition/work-record.md#lat-07-authorization-and-readiness-2026-09-29). This is agent-checked local evidence, not owner usefulness acceptance or authorization for another provider turn. The current portal and its data were not changed.

## Process outcome

The action inventory must distinguish **declaration**, **legacy runtime**, and **migrated runtime** before changing admission. A first full-suite run failed because adding unregistered LAT-07 declarations to the worker pin lookup blocked existing role-backed Design, Data, Code and Deploy paths. The correction kept LAT-07 declarations descriptive and left the legacy Work admission path intact for LAT-08 migration. The affected 28 Work tests passed after the correction, followed by the full 145/145 server suite. This tested the process boundary, not the future LAT-08 grant model.

## Task outcome and evidence

| Layer | Native output authority retained | Local evidence | Layer-owned action state |
|---|---|---|---|
| Design | Typed token, component and brand records | `design.test.mjs` exercises token/component revisions and scaffold use; `layer-contract.test.mjs` reads an exact token revision | Token proposal and component audit declared with normal/elevated permissions; adapters unavailable |
| Data | Typed object, operation and access records | `symphony-proposals.test.mjs` proves the existing Data contract proposal applies only after checked acceptance; `layer-contract.test.mjs` reads an exact object revision | Contract, operation, access and audit declared; adapters unavailable |
| Code | Repository projection, trace links, explicit Code release and route observations | `code-layer.test.mjs` exercises pinned releases; `layer-contract.test.mjs` reads Code unit/release projection hashes; LAT-06 retains its observation path | Implement, reconcile, docs, dependencies and security declared; adapters and candidate write grants unavailable |
| Deploy | Runtime projection and explicit release record | `code-layer.test.mjs` covers the legacy Deploy migration path; `symphony-proposals.test.mjs` covers an existing read-only review report; `layer-contract.test.mjs` reads a release projection hash | Local inspection report declared but unavailable; configure, promote and rollback remain blocked without external-effect adapters/authorization |

Every one of the 17 remaining legacy action IDs has an explicit disposition in `lat07LegacyInventory`, checked against `roles.json`. Four review actions retire in favor of Work's signed review. The other legacy actions remain historically present until LAT-08 maps or blocks them. New layer-owned actions expose exact IDs/revisions, typed outputs, declared reads/effects, normal/elevated status and explicit unavailable reasons through the layer descriptor API. They do not grant runtime capability. The Operations view shows that state alongside current layer routines and linked Work; Knowledge shows typed output counts/authority and links back to native editors without inventing revisioned method documents. Vision uses the same shared views. Pages keeps its dedicated application.

A disposable descriptor fixture read real integer revisions for Design and Data and content hashes for Code and Deploy projections; project scoping and optional-layer removal tests still pass. No publish, deploy, provider turn or external write was started by LAT-07. Candidate dispatch remains off.

## Checks and limits

- `node --test apps/portal/tests/lat07-actions.test.mjs apps/portal/tests/layer-contract.test.mjs`: 5/5 passed.
- Affected Work integration suites: 28/28 passed after preserving legacy admission.
- `npm run test:server --prefix apps/portal`: **145/145 passed** after the correction.
- `npm run typecheck --prefix apps/portal`, `npm run build --prefix apps/portal`, `git diff --check`: passed. Typecheck retains three pre-existing optional-chain warnings; build retains the large-chunk warning.
- Browser screenshots, keyboard and axe checks were not rerun: the prior temporary Playwright module and a local browser executable are absent. The UI is built and typechecked, but its layout/usability is not browser-verified in this packet. LAT-09 still owns owner comparison; any UI defects found there need correction before acceptance.

## Retrospective and handoff

1. **Friction observed:** treating a declaration as an admission rule made existing checked legacy Work paths fail. The first full-suite run caught this; focused declaration tests alone did not.
2. **Preparation for equivalent work:** inventory old IDs against source `roles.json`, then test the compiled catalog and the old Go path in the same run before swapping runtime gates. The exhaustive inventory test and affected Work rerun exercised this correction.
3. **Downstream change:** LAT-08 must map open/historical work and replace the old admission checks atomically with scoped grants and checked adapters. The LAT-07 descriptor is input to that migration, not its proof. LAT-08A still owns native-tab review; LAT-09 still owns usefulness comparison.
4. **Questions:** which action adapters should actually become runnable after grant migration, and what approved reviewer/grant applies to each? This blocks LAT-08 completion, not this local inventory. Browser layout evidence is also still needed before owner usefulness acceptance.
5. **Applied versus hypothetical:** the declaration/runtime separation was applied and validated by 28 affected plus 145 full server tests. Claims that the generic Operations/Knowledge views improve owner work, or that future grants are safe, remain unproved.

**Readiness verdict:** LAT-07 meets its local gate with native output revisions, declared permissions and evidence-backed unavailable states. `next_action: LAT-08`. No new provider turn, owner acceptance, release or promotion occurred.
