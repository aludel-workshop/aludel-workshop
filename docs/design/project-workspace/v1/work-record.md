---
id: project-workspace-v1-work-record
kind: work-record
status: agent-complete-owner-review-pending
updated: 2026-09-20
---

# D-02 — Project workspace strategy

## Intake and authorization

Source: portal request `REQ-53291e13-d7d6-4007-b100-7f2b46f8c897`; proposal `PROP-22d2e9e3-8f0a-4d7e-8b2e-a53d9665c1f8` revision 2; work `WORK-17d6c61a-3b7f-4a58-a382-f67f9e5c6a3b`. Owner authorization recorded 2026-09-20T19:47:44.254Z; claimed by `codex-local`. D-02 is the repository planning/evidence ID for that scope, not a second authorization.

Class: new cross-area workflow/product structure. Desired result: the owner can understand how the portal will become the useful home for the full product lifecycle and choose a bounded next slice. Scope permits inventory, strategy, low-fidelity maps/walkthroughs, contracts and delivery planning. It stops at structural review. Production feature implementation and bulk migration are excluded by this work item's scope.

## Process first

Prior failures: imported text was treated as adequate product knowledge; singleton fixtures hid collection navigation gaps; prototype copies fragmented sources; old proposed documents can sound more current than later accepted evidence. The [Work navigation post-hoc](../../../evidence/b-03a-work-navigation.md) records the owner's immediate example and passing repair checks.

Apply a coverage matrix before choosing navigation: owner job → authoritative object/revision → creation/edit path → consuming feature → evidence and unresolved gap. A document's existence is not feature coverage. Validate recommendations with six concrete journeys and adverse cases, not only a sitemap. Existing design operating guidance is adequate for alternatives/owner selection; add the missing explicit executable collection regression gate and exercise it now.

## Inputs and readiness

- **Accepted constraints:** one owner/multiple projects, portal as its own project, independent generated apps, zero incremental spending, deliberate authorization; DEC-022/025/027/028 and ADR-012.
- **Accepted system:** MD3 foundation v3; inspect `docs/design/portal-system/v3/system-profile.md`, `catalog.json` and `review-record.md` before subsequent composition. New destinations are not accepted by that choice.
- **Checked implementation:** source import, proposal/decision revisioning, scoped dependency staleness and supervised local workflow. Actual code and new navigation browser evidence take precedence over stale allocation prose.
- **Missing:** full product-object model/editing, historical packet reconciliation, design asset registry, build-bound view/component provenance, complete project scoping/setup, immutable candidate reviews.
- **Unaccepted:** new feature grouping, roadmap expansion/prioritization, contextual inspection placement, migration review interaction.

Ready for strategic audit and low-fidelity structure alternatives. Needs owner structural judgment and per-slice design readiness before production implementation. No external vendor choice or fresh integration trial is required to answer this request; this is an audit of local evidence, not a new vendor benchmark.

## Ordered work

1. Inventory actual runtime and representative source corpus; preserve acceptance/provenance distinctions.
2. Map owner jobs and record boundaries; compare two structural alternatives.
3. Walk six journeys including creation from scratch, history and error cases; specify incremental-preview and context contracts.
4. Sequence bounded delivery slices against B-03/M1 and second-project gates.
5. Check request coverage, source links and review accessibility; post evidence and the consequential structural choice in the portal; propagate warranted durable updates.

## Stop condition

Produce reviewable strategy and next-slice scope. Submit evidence; owner selection is not inferred. No new high-fidelity prototype or production feature implementation within D-02.

## Delivered evidence and acceptance check — 2026-09-20

- [Audit and coverage](audit.md): nine source/runtime findings and R1–R11 covering all four paragraphs of the saved request. Each row names evidence, missing object, proposed home/creation path and a future observable check.
- [Structure](structure.md): alternatives A/B, recommendation, responsibilities, primary actions, entry/exit and state/placement policy. New composition selection remains open.
- [Journeys](journeys.md): J1–J6 and an empty-project authoring rehearsal. These are explicitly manual design walkthroughs; no future behavior is claimed as runtime-tested.
- [Contracts](contracts.md): project identity/authority, typed revisioned relations, source assertion/reconciliation, no-op/conflict handling, independent project setup and build-bound preview context with trust boundary.
- [Delivery](delivery-plan.md): dependency graph, inputs/outputs/checks/reviewers/stop conditions, exact PW-01 slice and preserved B-03/M1/M2/M3 gates.
- [Review board](review.html): self-contained low-fidelity comparison and expandable walkthroughs. Verified served copy at `http://127.0.0.1:4310/reviews/project-workspace-v1.html`; canonical source remains here and can be reopened if a later app build removes the preview copy.
- [Board browser evidence](board-validation.json): response bytes match source; six walkthroughs, valid section links, no page errors, 390px no horizontal overflow, axe WCAG A/AA subset passed. [Wide](review-wide.png), [narrow](review-narrow.png); narrow screenshot visually inspected. This tests the board, not proposed product features or owner comprehension.
- `python3 tools/check_product_system.py --write` and subsequent validation: 24 capabilities and two project allocations pass. This checks structure, not live multi-project correctness. Allocation revision 4 corrects stale prerequisite/provision claims using actual evidence.
- Relative document links checked; exact file and build identities are captured in [manifest](manifest.json). No Git repository was available (`git rev-parse` reported not a repository).

Manual review of request coverage found no omitted concern: R1/R2 cover bootstrap history and native recreation; R3/R4 feature groups and design discovery; R5/R6 contextual prototypes and element-level rationale; R7–R10 vision/roadmap/integrations/system; R11 independent project setup. No estimate of usability speed or implementation duration is inferred from this desk check.

Readiness: **needs owner judgment** for D-02R, with concrete alternatives now available. D-02's authorized planning outputs are agent-complete and ready for submission; the selected structure, every new composition and subsequent implementation remain unaccepted. Proposed next step is D-02R followed by scoped D-03; neither is automatically authorized by this submission.

## Post-hoc: process outcome versus task outcome

1. **What made this harder? (observed)** The owner was blocked by Work rendering full details at its collection URL. The single-task fixture checked authorization but missed navigation. An unchanged proposal save forced revision replacement. Source documents/capability maps mixed historical proposals with newer decisions; the live object model was much smaller than the source corpus. Strategy review initially hit a stopped local server; restarted it and verified the exact owner-facing board URL. Test startup also exposed an initialization race, corrected by waiting for readiness.
2. **What makes the next equivalent task easier? (applied)** A job→object→authority→creation path→feature→check matrix distinguishes searchable evidence from usable capability before choosing navigation. The operating procedure now explicitly requires two-record collection/detail/reload/return checks before mutation checks. The operator procedure requires exact work detail links and explains the follow-on decision boundary. The [navigation post-hoc](../../../evidence/b-03a-work-navigation.md) retains cause, repair, limitations and independent correction screenshots. Original `test-results` images were rolling outputs and were overwritten by the rerun; keep immutable per-run evidence paths in future.
3. **What changed downstream? (applied)** Added D-02R/D-03/PW-01–05 routing to execution planning, scoped project identity before New project, separated historical plan entries from executable tasks, preserved B-03 artifacts/isolation/runner and M2/M3 gates, updated capability allocation revision 4 and architecture/knowledge/roadmap/tool-registry current notes. This is a proposed delivery sequence, not a phase expansion already accepted by the owner.
4. **What questions remain?** D-02R must select stable product-area structure A, change-centric B, or a revised organization and first priority. This blocks D-03 composition and PW-01 build. Q-003 real second brief blocks real independent-product proof, not structural planning. Q-005 candidate readiness and Q-008 uncertain external effects remain B-03 gates. Git/source identity, catalog-to-current-code reconciliation, project isolation and migration safety are agent evidence tasks before their dependent slices; do not turn them into vague owner questions.
5. **What was actually tested?** The new collection check passed with two independently reachable items plus the existing full supervised lifecycle; the coverage audit exposed hard-coded project context, missing native records and stale allocation claims before strategy feature construction. The board URL/content/responsiveness/accessibility and source links were checked. These observations support the specific applied process changes. Better owner comprehension, lower future rework, correct migration and cross-project/runtime provenance are still hypotheses with named slice tests.

**Task outcome:** reviewable strategy and staged implementation contracts delivered; no new product-area features, new runner or live historical-record migration. The independently requested Work navigation repair is delivered with its own evidence. **Process outcome:** explicit multi-item owner-entry verification and capability/authority coverage applied to a real failure and this strategy; no broad claim that documentation alone prevents recurrence.

## Acceptance / handoff

Reviewer: owner, pending in portal Decisions. Artifact: D-02 workspace strategy v1, manifest-bound sources and local board. Accepted scope: none of the new structure/compositions yet. Existing MD3 foundation/authorization invariants are retained. The planning work can be submitted without marking product acceptance. The follow-on structural question is created only after submission because the current bridge invalidates active snapshots when proposal-linked decisions change. The portal work/event history is authoritative for the exact submission and subsequent owner answer.
