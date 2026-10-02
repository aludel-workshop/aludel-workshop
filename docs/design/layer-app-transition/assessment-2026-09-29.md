---
id: LAT-CHAIN-ASSESSMENT-2026-09-29
kind: work-record
status: assessed
updated: 2026-09-29
---

# LAT chain assessment after CUSTOM-LAYER-01

## Authorization, scope, and method

The owner asked in the current chat to assess Claude's layers UX work, locate the whole LAT chain, and identify work needed to align predefined layers with the new layer-app vision. This authorizes local read-only assessment and bounded repository planning records. It does not authorize candidate implementation, a provider turn, external writes, promotion, or acceptance. The current process already requires one packet at a time and exact evidence; this assessment applies that rule to the two isolated candidate branches instead of treating the newer UI as proof that LAT-08 passed.

Sources inspected: the transition [plan](implementation-plan.md), [LAT-08 checkpoint](../../../lat08-candidate/docs/evidence/lat-08/README.md), [CUSTOM-LAYER-01 closeout](custom-markdown-layer.md#packet-closeout--owner-acceptance-2026-09-29), [framework proposal](../layer-framework/work-record.md), DEC-051/053/054, and candidate code at `lat08-candidate` `4dc46af` and `custom-layer-candidate` `6d43ed8`. No retained preview was running on ports 4398, 4401 or 4402. I therefore ran `tools/browser-checks.sh layer-bar` against the accepted custom branch with a fresh disposable local project and inspected its saved screenshots. The browser check passed; it covers the one-bar navigation, built-in and custom routes, Work round trip, axe on selected views and 390px layouts. These screenshots show the current custom-branch shell, not the retained owner project or the integrated LAT-08 candidate. The code/contract findings and the visual findings below have different evidence limits.

## Chain position

| Packet | Current reading | Next proof or dependency |
|---|---|---|
| LAT-01–07 | Local gates passed. LAT-06 runtime grants were deliberately moved to LAT-08 by DEC-053. | Preserve pinned evidence; no re-opening inferred from the new navigation. |
| LAT-08 | Partial. Scoped grants, action migration and sanitized data rehearsal are checked. The shared-space/discovery correction is in the retained LAT-08 branch, while CUSTOM-LAYER-01's accepted shell lives in a later separate branch. | Reconcile branches, fix the Pages flow-review crash, inspect the resulting UX in a current browser, and prove startup on the actual original data without changing it. Retain the owner project and historical pins. |
| LAT-08A | Planned after LAT-08. | Use the accepted Tasks/Knowledge/Manage shell and action shape to build native-tab Previous/Proposed review; prove Markdown person-run review as carried from CUSTOM-LAYER-01. |
| LAT-09 | Owner comparison gate. | Compare all six local built-ins in the integrated candidate, including optional/project-defined graphs and Code-first Pages. Record usefulness separately from technical correctness. |
| LAT-10 | Promotion proposal only. | Requires named LAT-09 owner acceptance, migration parity and recovery rehearsal, then separate release authorization. |

CUSTOM-LAYER-01 is owner-accepted for its bounded scope at `6d43ed8`, but it was not promoted into the original portal or merged into the retained LAT-08 branch. Its passing browser checks belong to that custom candidate revision. A LAT-08 browser check against `4dc46af` would therefore miss the accepted one-bar navigation and Tasks/Knowledge/Manage composition.

## Fresh browser screen assessment

The saved images are from the passing disposable `layer-bar` run on `custom-layer-candidate` `6d43ed8`. The test drove the route and state changes; I inspected each selected screenshot after capture.

| Step | Captured screen | Health and finding |
|---|---|---|
| 1 | [Pages Map](../../evidence/lat-chain-assessment/01-pages-map.png) | **Good:** the heading, one output/shared bar and Map's working area are clear. The empty Map still permits a manual page blank. |
| 2 | [Pages Tasks](../../evidence/lat-chain-assessment/02-pages-tasks.png) | **Mixed:** the shared Work board and layer sidebar are coherent. In an empty Pages project, global batch/capacity controls and Queue/Backlog/Done occupy much of the first screen before any layer-specific task; test whether that helps a designer's first task. |
| 3 | [Pages Actions](../../evidence/lat-chain-assessment/02b-pages-actions.png) | **Good with density risk:** the action shows method, exact reads, proposed write scope and review checks in one place. The expanded setup spans many controls and needs a focused task journey to judge whether owners can find the next action without scanning the whole panel. |
| 4 | [Pages Knowledge](../../evidence/lat-chain-assessment/04-pages-knowledge.png) | **Needs content alignment:** the seeded Charter says Pages consumes Vision and Design, though either neighbor may be absent. Its own method and quality text should state reduced-input behavior. The screen also shows a versioned editable document, which gives that correction a clear home. |
| 5 | [Research activation](../../evidence/lat-chain-assessment/05-research-activate.png) | **Good:** draft status, 0/8 progress, Charter link and action requirement explain why discovery is withheld. This is stronger than exposing a layer on name alone. |
| 6 | [390px Manage](../../evidence/lat-chain-assessment/08-narrow-manage.png) | **Needs mobile review:** the expanded project rail takes roughly the first 320px of vertical space, while Tasks/Knowledge/Manage become icon-only. Axe passed selected views, but this screenshot cannot establish that those icons are understood or that keyboard/screen-reader navigation is clear. Test labels, focus order and a collapsed-rail entry on a real narrow journey. |

The test uses synthetic empty project data, so it does not show a populated built-in layer, a useful connection proposal, a review decision, or the owner’s retained LAT-08 project. Its axe result is a selected automated check, not full accessibility assurance.

## Predefined-layer alignment findings

1. **A shared reader exists, but built-ins are still seeded from fixed code.** `server/layer-contract.mjs` owns a six-entry `declarations` list and `createLayerInstances` uses it as the catalog; `server/layer-registry.mjs` seeds seven-part built-in identities. This preserves existing outputs safely, but there is no editable/versioned base-definition source that can instantiate a built-in-equivalent layer with selected adapters. The CUSTOM-LAYER-01 closeout correctly carries that as a LAYER-FRAMEWORK-01 goal.
2. **The new shell is shared, while output navigation remains hardcoded by adapter/key.** `src/layers/layer-nav.ts` fixes tab sets for each native adapter. `src/layers/shell.ts` still switches on six built-in keys to render outputs, with the Markdown editor as the only generic fallback. This is an adapter implementation choice for now, but the definition does not yet declare its tab/renderer contract. A built-in cannot be reconstructed by changing only a base definition plus adapters.
3. **Built-in identities need a content review, not just a code move.** The seeded charters are concise and useful starting text. They are all active immediately, and their methodology, output conventions, quality bar and collaboration claims have not been judged against each built-in's actual Actions, Routines, Connections and output tabs or against optional-neighbor scenarios. In particular, a predefined relation should remain a reviewed candidate, never an automatic dependency between layers.
4. **The shared Tasks surface is newer than LAT-08's action client contract.** CUSTOM-LAYER-01 notes three partial action types and carries their consolidation to LAT-08. Until the shared action type and branch integration are checked, a built-in Tasks screen can display declaration facts differently from Work creation, cards or Go admission. The accepted custom-layer browser round trip is a useful regression fixture, not proof for all built-ins in the integrated branch.
5. **Two concrete regressions need owners before comparison.** The custom branch's `pages` browser check stops at `recordNewWorkAction` during flow review, assigned to LAT-08. Its `work-item` check reports an 8px overflow at 400px, currently unassigned. Both should be rerun after integration; the latter may be fixed in LAT-08A if the review surface uses that sidebar.

## Recommended packet order and proof

Keep `LAT-08` as `next_action`. Its next bounded slice should integrate the owner-accepted CUSTOM-LAYER-01 commit into the retained candidate without overwriting either preview's data, consolidate the layer-action client shape, fix the Pages flow-review failure, and rerun migration, permission, browser and original-data startup checks on the integrated revision. Owner inspection must use that same revision. This is the process correction exposed by the separate branches: the reviewed UI and migration evidence must meet in one pinned candidate before either is treated as the LAT-08 exit gate.

After LAT-08 and LAT-08A, add a **predefined-layer alignment gate before LAT-09** under LAYER-FRAMEWORK-01. Start with a versioned base-definition/adapter contract and an output ledger for each built-in; compare every charter field with its real output, action, routine and connection behavior. Exercise one non-Pages built-in and one custom instance through the same definition, Tasks, Knowledge and discovery paths. Keep specialized native editors, but make their tab and authority registrations explicit in the adapter contract. Test a changed built-in charter causing a reviewable discovery proposal, a missing neighbor, Code-only Pages, and rejection of a wrong relation. Then decide whether the general contract warrants migrating all six definitions; do not replace accepted editors merely to remove a switch statement.

The LAT-09 comparison should include owner tasks in Vision, Design, Pages, Data, Code and Deploy with the new one-bar shell, plus a project with only one chosen layer and one with a custom neighbor. A passing server suite or old screenshot is insufficient evidence of the owner-facing composition. Capture current wide and 390px screens, keyboard/axe results, and the owner judgment on whether the extra Tasks/Knowledge/Manage structure helps each job.

## Retrospective

The hard part was that evidence is split across two candidates: the LAT-08 migration proof and the later accepted custom-layer shell. The next equivalent review should start with a branch/revision map and require an integrated candidate before a cross-packet UX claim. That process rule was applied here by tracing commits, code contracts and packet gates; it has not yet been tested by an integration run. The new vision changes the LAT-09 prerequisite: built-ins need an explicit base-definition alignment check, but it does not justify moving LAT-08 off `next_action` or claiming LAT-08A complete. Open questions are whether built-in charter edits need an approval flow, whether the tab/renderer adapter declaration can cover all six without a generic record store, and which optional-layer combinations matter most to the owner comparison. Those affect the alignment gate, not the current LAT-08 data and action work.

## Superseded recommendation after owner clarification (DEC-055, 2026-09-29)

The earlier recommendation placed a bounded predefined-layer alignment gate after LAT-08A. The owner clarified a stronger target: every installed layer is an owner-owned fork/copy of a repository template containing charter/Knowledge and implementation, with no privileged built-in layer type. [LAYER-TEMPLATES-01](layer-template-conversion.md) replaces that gate with LAT-T01–T03 **before** LAT-08A, so review renderers also come from the layer package. The screenshot and code findings above remain evidence for the migration ledger.
