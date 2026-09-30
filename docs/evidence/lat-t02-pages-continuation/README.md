# Pages continuation checkpoint — 2026-09-29

## Scope and revisions

The owner directed Pages-specific data, code, shared design language, same-task agent packet and build-note migration work before moving to other templates, plus a GitHub publication investigation. This remains an isolated local candidate. The Pages source repository is pinned at `f45f3f758f239927e6b257141713c332fa5de917` (prior UX/doc/theme commits in its history). This candidate follows the earlier source extraction `f6adc8e813aead602304080e1f0e18584e84d66d`. No original project data, retained LAT-08 candidate, GitHub account or provider was changed.

The template now also has `docs/source-inventory.md`, a file-level account of remaining Pages-specific portal branches and the order for extracting them.

## Process change applied

The prior extraction check verified the UI and basic Knowledge but did not compare what an agent actually receives for equivalent Work. This pass added a **same saved bundle, two task compilers** check: run the original `f6adc8e` compiler and the template-aware compiler on one real Go-pinned `pages.flows` bundle, then compare target revisions, controls, outputs and capabilities. It also traced owner Pages decisions P1–P10, M1–M11, built evidence, later layer-app corrections and DEC-051/054/055 into an organized template docs ledger. These changes were applied in code/tests and the repository docs; they are not merely proposed procedure.

## Same-task packet result

| Flow proposal context | Previous compiler | Template-aware compiler |
|---|---|---|
| Work identity, title/brief, performer, action, checks | Present | Preserved |
| Go-pinned story target ID/revision, controls, proposal shape and capabilities | Present | Exactly equal in the test |
| Installed Pages repository identity/revision | Absent | Exact accepted commit |
| Pages charter and five task-facing Knowledge documents | Absent | Exact committed content in `layerSource` |
| Resolved `pages.flows` method | Absent from model-facing card (though recorded in saved bundle) | Exact committed `knowledge/flow-method.md` content and method revision |
| Repin while a task is live | No package pin to compare | A changed accepted Pages commit withdraws the old task context |

The real worker test passes using a disposable project and no provider turn. This is **more relevant source context for creating a flow**, with the same host-enforced output/permission shape. It is not proof that a model uses the context well. A second requested example—**modify an existing flow**—exposed an existing functional gap: `pages.flows` accepts at most one Vision-story target and its adapter inserts a new flow; a Work item targeting an existing `flow` is rejected before Go. The test now asserts that rejection. A new layer-owned revise-flow action/adapter and native candidate review are required before claiming packet parity for modification. The template's flow method documents the intended revision practice but does not make that action runnable.

## Data and design-system result

- The Pages repository now holds organized `docs/` with purpose/UX, outputs/data, Work/connections, host SDK and a P/M decision ledger. It distinguishes owner-required behavior, agent-checked build evidence and target architecture. `AGENTS.md` is a short map.
- The template declares `hostSdkVersion: 1`. Host theme variables for selection, status, surface and corners are supplied centrally; Pages' Map/editor CSS now uses them for common chrome and retains specialized canvas geometry. Typecheck/build and disposable Pages/layer-bar browser journeys passed. This is partial visual token adoption; remaining literal statuses and per-project UI bundle isolation need later checks.
- An offline Pages module exports current `page_map`, `page` and `flow` records plus exact history into deterministic JSON and rebuilds ignored `.aludel/state.sqlite` in the layer repo. Its one disposable test passes repeat export, project isolation, revision/Work provenance, an exported deleted-flow tombstone, a new candidate tombstone and hash rejection. The isolated portal candidate now records project/kind/revision metadata before hard-deleting a Knowledge record; the exporter includes these future deletions. It does **not** replace the portal's current SQLite writer. Historical orphaned revisions still lack project/kind, so original-data cutover needs a bounded exception or verified recovery.
- The [GitHub provider plan](../../../../docs/design/layer-app-transition/github-publication.md) names six catalog template repos, project-owned generated repos, per-layer bindings, checked candidate/PR/repin and recovery work. No remote write was authorized or made.

## Checks

- Final affected portal tests (Pages package, Symphony proposals, moved-source Code observation): **20/20** passed. The full server suite passed **168/168** after the deletion-ledger change; the package installation and Pages behavior tests passed **7/7** against the final template pin.
- `npm run typecheck` and `npm run build` passed with the new host tokens/SDK-versioned manifest. Existing Angular optional-chain and bundle-size warnings remain.
- `MACHINE_PAGES_TEMPLATE_ENABLED=1 tools/browser-checks.sh pages layer-bar` passed on disposable projects after the CSS token change: Map, flow, page Spec/content/Built, change request, flow review, 390px Map, shared Tasks/Knowledge/Manage, axe and narrow layer bar.
- Pages repository `node --test tests/portable-store.test.mjs`: **1/1** passed, including current-record round-trip, deleted-flow export, project isolation and tamper rejection.
- `git diff --check` passed on candidate and template source before checkpoint commit.

## Retrospective and handoff

**Observed friction:** the first same-task fixture tried to pin a Page and was rejected by the old `pages.flows` rule; the existing-flow modification check is likewise rejected. The full server run also exposed a self-hosted Code-observation test that still pointed at the old Pages UI file after extraction; it now observes the tracked portal route and keeps the layer source boundary honest. A wrong-path shell call briefly left the candidate on an older pin; the pin was corrected and all affected checks rerun. Browser tooling was available from a local cached Playwright module.

**Reusable change:** compare actual model-facing packets on identical saved bundles and preserve an executable negative fixture for an unsupported owner task. Sweep owner notes into template docs with a source/status ledger, and check extracted UI against a named host theme API. The packet/compiler and browser tests support these changes for Pages; they do not prove general layer SDK isolation, model usefulness, safe server adapters or migration of original data.

**Roadmap effect:** implement a checked per-project UI/server extension boundary, a revise-flow adapter, historical-deletion recovery and same-fixture authority cutover before Pages is called self-contained. GitHub provider binding and template generation follow a reviewable local flow. LAT-08 owner review/original-data gates remain open; this continuation does not close LAT-T01 or LAT-T02.
