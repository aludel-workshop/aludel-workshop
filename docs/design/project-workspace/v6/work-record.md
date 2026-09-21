---
id: project-workspace-v6-review
kind: design-review-preparation
status: composition-study-prepared
updated: 2026-09-20
packet: D-04R
---

# D-04R: four-page audit and replacement composition study

## Outcome and authority

Owner feedback in chat: the v5 prototype “at least loosely follows the authorized work” but “the ui is far from our standards”; evaluate all four pages using the established process and give another take. This reopens their composition and visual quality. It does not establish acceptance of any replacement.

Inspected the portal inbox through `operator.mjs`: D-04 is submitted, version 5; there is no authorized revision task. This output is read-only evaluation and bounded review/proposal preparation under the existing saved workspace request and proposal r2. The static board is a Compose-stage artifact, not a working prototype. Product controls are noninteractive labels. Review anchors work. A separate prepared task governs the executable follow-up; no owner decision, authorization or acceptance has been impersonated.

## Inputs and readiness

- Accepted: DEC-025, D-01F foundation revision 3, MP1–MP9, project-owned visual roles, Angular Material and explicit Storybook realization. Components remain incubating.
- Accepted structure input: four owner jobs in v4; continued use here does not imply acceptance of v5 layouts.
- Reopened: all four v5 page compositions and their visual hierarchy.
- Checked historical evidence: v5 source, existing browser script/results, plus fresh four-route screenshots and targeted browser probes below.
- Product invariants: plan, proposal, authorized task, attempt, review, acceptance and release remain distinct. No priority, grouping or selection starts work.
- Scope class: changed cross-page composition with interaction deficiencies. Ready for a static composition study; executable prototype needs current portal authorization and an explicit interaction/state contract. PW-01 implementation remains gated.

Catalog search: reuse the revision-3 outcome briefing, comparable attention rows, status semantics and work-summary contract. Extend the attention collection to typed owner interventions. Plan hierarchy/selection and Intake triage require new composed patterns; Operations is a product-owned composition. No catalog asset is promoted or new system-wide component invented here. The board reuses visual roles and local Roboto files (license included); it does not claim to instantiate Angular Material widgets.

## Audit: observation → standard → replacement

| Surface | Observed issue | Standard | Replacement hypothesis |
|---|---|---|---|
| Overview | Oversized generic slogan; intake banner leads the actual blocking decision; capacity occupies a peer panel; outcome copy wraps into very narrow labels beside long progress bars | MP1–3: owner outcome and consequence determine emphasis; grouping follows relationships | Lead with milestone and next decision. Comparable attention rows below. Execution and Intake become supporting summaries |
| Plan | Giant milestone header, heavily nested bold rows, always-visible metadata pane; disabled Board looks like an available mode; action is inert; narrow CSS hides selected title | MP2/3/4/9: legible hierarchy, deliberate detail placement, identity across viewports | Compact outcome/feature/work outline; context pane focuses on the blocker and next action; sources/history disclosed; narrow selection becomes a destination in follow-up |
| Operations | Empty slot consumes a large card above interventions; blocked work is labelled Ready queue; run progress is hardcoded at 72%; history links include identities absent from the item model | MP1/5/8: useful intervention, truthful readiness, inspectable identities | Interventions first, compact active-attempt progress in words, eligible versus waiting queues, history secondary |
| Intake | Fixed three-selection summary, fixed group action, unrelated checkbox changes ignored; other actions are text; grouping immediately displays a proposed plan change | MP3/5/9: selection must control consequence; read source before disposition | Signal list/detail; inspect group membership; group commit and propose-change commit are separate; original signals retained |
| All four | Custom CSS approximates MD3 while Roboto is only named, not loaded; same panel grammar dominates; product UI explains internal record mechanics; no external task-oriented review guide | Foundation r3 and MP1–9; review framing contract | Loaded fonts, accepted palette and purposeful hierarchy; external composition rationale and review tasks |

Source-backed observations are distinct from visual judgment. The latter is agent assessment, consistent with the owner's rejection, not a measured owner-usability result.

### Fresh executable evidence

[audit-v5.mjs](audit-v5.mjs), [audit-results.json](audit-results.json), and `before-*.png` capture the actual served v5:

- All four advertised routes rendered.
- Unchecked every Intake checkbox: zero selected, summary still says three. Group still succeeds.
- Clicking Plan's “Open fixture action” leaves content unchanged. Source contains no handler.
- At 390 px, `.detail h2` has `display: none` because the navigation breakpoint targets all `aside h2` elements.

Existing v5 checks mostly assert visibility of labels and a hardcoded confirmation. They do not prove selection-dependent grouping, model-backed backlinks, source-driven progress aggregation, exact foundational revision behavior, or authorization rejection on staleness. `collapseAggregation` only verifies existing “67%” text after collapse. The stale check verifies warning text. The accessibility run covers narrow Intake, not all four pages. These limitations supersede the broad interpretation of the v5 work record; its historical results are retained.

## Another take and alternative considered

[Composition board](http://127.0.0.1:4310/reviews/project-workspace-v6/index.html#plan) · [source](index.html).

Recommended: preserve four responsibilities, change hierarchy by job. Alternative considered: retain v5 layouts and replace controls/palette. Rejected as insufficient because this would preserve oversized headers, capacity-before-intervention, panel duplication and unexplained actions. This is one coherent direction with four inspectable compositions, not a claim of owner selection.

Overview, Plan and Intake use representative bootstrap content; Operations deliberately shows a separately labelled future connected-worker scenario. These are static sketches, not a coherent running model or live operational report. Plan dependencies projection, actual record destinations, group review, drafts, exceptional states and transitions belong in the follow-up. The dependency projection is retained in scope even though this board illustrates the outline only. Stage gates cannot be satisfied by screenshots.

Placement contract: Overview summarizes and routes; Plan selection gets a supporting pane on wide screens and a linkable detail destination on narrow screens; Operations offers named question/failure destinations with return context; Intake uses list-detail for sustained triage, followed by explicit group and proposal commits. Detail history is disclosed, not a peer navigation feature. Preserve selection, filter, scroll and draft on return. Zero selection disables grouping; unknown counts never become zero; stale input blocks consequential commits; failed writes retain drafts. These are requirements for the next experiment, not passing checks in this board.

## Board evidence and limits

[check-board.mjs](check-board.mjs), [board-results.json](board-results.json), and all `*-wide.png` / `*-narrow.png` images. Chromium checked review anchors, local Roboto loading, all four page titles, 390 px horizontal overflow, desktop/narrow axe WCAG A/AA tags and page errors. Agent inspected all four wide renders. No product-action buttons exist in the static document. Automated accessibility checks passing do not establish keyboard interaction or assistive-technology usability of the future product.

Reproduction uses Node 24 at `/tmp/machine-md3-runtime/node_modules/node/bin/node`, the existing Playwright package imported by the script, and `LD_LIBRARY_PATH=/tmp/app-builder-d01b-browser/libs/usr/lib/x86_64-linux-gnu`. Chromium needs sandbox process/network approval. Start the existing local portal first. Source HTML/CSS/fonts are copied to `apps/portal/dist/reviews/project-workspace-v6/`; the source folder is authoritative because dist is disposable.

## Retrospective and durable process outcome

1. **Friction observed:** D-04 treated visual quality as later polish despite accepted composition principles. Presence-only assertions were reported as semantic behavior. Initial audit launch also lacked the documented browser library path; the board capture script required URL decoding for workspace paths with spaces.
2. **Improvement applied:** operating procedure now requires all-page visual comparison against the selected foundation and evidence claims tied to observable transitions. Source-backed claims, runtime behavior, agent visual assessment and owner acceptance are separate. Reproduction prerequisites are recorded here.
3. **Test of the improvement:** applying those checks caught three concrete v5 failures and the visual review caught a missing plus glyph in the new board; corrected before handoff. The board passed its bounded static checks. Whether the replacement improves owner usability remains a hypothesis.
4. **Downstream effect:** return D-04R to Compose/interaction revision. PW-01A cannot consume v5 as an accepted composition or its broad evidence summary as interaction proof. Existing staged PW-01A/PW-01B/B-03 boundaries remain useful and unchanged; no new roadmap phase or runtime architecture change is justified.
5. **Questions:** owner evaluation of the replacement hierarchy remains open. Full prototype execution requires a newly authorized work item. No additional product-wide discovery or vendor research is needed for this corrective scope.

Next action remains **D-04R**: review the static compositions and the prepared revision scope in Work. The audit and preparation are complete; the executable revision and owner acceptance are not.

Prepared portal item: [WORK-ef2752ba](http://127.0.0.1:4310/#/the-machine/work/WORK-ef2752ba-8cdd-4379-acf7-1b6c00bb1b3c), proposal r2, version 1, ready and unauthorised. No claim or execution event was created. The existing D-04 review decision remains owner-controlled.
