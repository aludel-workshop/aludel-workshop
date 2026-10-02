---
id: LAT-08A-REVIEW
kind: design-brief
status: proposed
updated: 2026-09-29
depends_on: [LAT-07, LAT-08, LAT-T01, LAT-T02, LAT-T03, DEC-050, DEC-054, DEC-055]
---

# LAT-08A — review changed layer views

## Owner intent and boundary

The owner wants the layer that created a Work item to own its review experience. Work remains the shared ledger for task criteria, Go, runs, performer evidence, reviewer signature and atomic acceptance. The originating layer supplies the review composition and reviewer policy; each changed output is validated by its own layer before atomic acceptance. If a Pages relation to a Code observation creates the task, Pages owns its review; Code supplies the pinned source evidence. Record the origin layer at item creation and pin it for the run. A cross-layer task may show evidence from other layers, but it does not transfer review ownership or grant another layer authority over the resulting output.

The reviewer's main question is “what would this layer look like if I accepted this run?” Show the affected native layer tabs with proposed changes highlighted. The review render reads a retained candidate snapshot or typed proposal at a pinned revision. It never changes accepted records or asks a live current tab to display unapplied changes. A **Previous / Proposed** switch shows both states using the same tab and stable viewport/selection where possible; changed objects are marked and linked to criterion evidence. The review shell also retains a concise change list for orientation, flags and navigation. No universal standalone Preview tab is required. If a change has no native renderer, show an honest typed before/after view and name the missing layer surface.

| Origin and output | Review view | Evidence that stays distinct |
|---|---|---|
| Design tokens/components | Design's affected Tokens or Components tab, with changed values and contextual examples; a sequence of examples can read like a slide deck inside Tokens | Token/component validation and visual checks tied to the candidate revision |
| Pages pages/flows | A focused slice of Map, Pages or Flows with changed nodes, paths and states highlighted | Source story or Code observation remains linked evidence, not proof of intended flow |
| Code candidate | Code Explorer shows changed files/units and diffs; Code Tests shows **results of the candidate's actual runs**, with status, logs and revision | Code's **Local app** opens an isolated runnable candidate for clicking through with synthetic data; it is a normal Code tab as well as a review view |

The Code Local app tab is useful outside Work review for the current development copy. In review it selects the retained candidate build; Previous selects a separately identified baseline build if available. Show source commit, build identity, data fixture, availability and failure reason. Keep synthetic data and its session outside the trusted portal origin. A non-web project or failed build shows an unavailable state and its checks; no fake preview is rendered. This extends Code's existing reference role without turning Code into an editor.

## Simple repository-read default

Code owns the project repository as a versioned output and is the gateway for reading it. An authorized project Work actor/action may read the **full bound project repository** through Code by default; LAT-08 does not need per-action path allowlists for reads. Code checks project/repository binding, membership or explicit action grant, and source revision; the request cannot reach another project's repository or host files. Existing credential/secret exclusions still apply, including ignored or untracked local secrets. Repository writes, candidate commits and external effects remain separately authorized and checked. A receiving layer cites Code's file/revision identity rather than taking ownership of repository bytes. This revises DEC-051/053's proposed per-path read detail, not their project boundary or explicit write/effect gates.

## Packet contract and checks

**Prerequisites:** LAT-07 supplies the native Design, Pages and Code tabs and action inventory; LAT-08 supplies the origin/action migration, project grants and Code read gateway. Reuse DEC-050's run/review signature and retained candidate snapshot contracts. Do not start from visual tab names alone; map each affected output kind to its authoritative renderer and apply validator.

**Build:** record pinned origin layer and affected output/tab references in the run; define a layer review renderer interface for accepted and candidate revisions; compose only affected tabs in the shared Work review shell; add Previous / Proposed, change focus, criterion evidence and unavailable/stale states. Adapt Design, Pages and Code, including Code test results and the Local app development copy. Preserve atomic accept/reject and historical run snapshots.

**Acceptance evidence:** with disposable isolated data, review one Design token change, one Pages flow change and one Code change. For each, switch Previous / Proposed without mutating the accepted output, navigate the changed native tab and check its revision/criterion link. Code Tests must show a real candidate test result, and Code Local app must run with synthetic data both from Code and from Work review. Reject one run and confirm nothing applies; accept a separate current run through the owning layer validator and verify one atomic change. Change the source/action or candidate revision and verify stale review blocks acceptance. Test a missing renderer, failed build and non-web project as explicit unavailable states. Check owner/member access and wide/390px keyboard/a11y behavior. The owner then judges whether the reused tabs make review clearer in LAT-09; agent checks alone do not establish usefulness.

**Stop condition:** no candidate snapshot, origin layer, revision or authoritative validator means no Accept. A missing Local app does not block a non-web action when other required criteria are met; it must remain visible as unavailable evidence rather than a fabricated preview.

## Process note

This packet avoids inventing a separate preview vocabulary for every layer. The idea is ready for a bounded implementation task, not a selected composition: current Work review and Code tab evidence establish the overlap, while the Previous / Proposed behavior and owner usefulness still need a prototype or build review. If the native tab cannot render a candidate revision, that concrete gap routes to its owning layer before the Work shell gains a substitute view.

## Carried from CUSTOM-LAYER-01 (2026-09-29)

- Layer Tasks now renders Work's own board, cards, create form and a Roles-style Actions view (see the [closeout](custom-markdown-layer.md#packet-closeout--owner-acceptance-2026-09-29)). Build layer-owned review from those components, not from a parallel surface.
- The browser-driven person run that reviews Markdown file changes is server-tested only. Prove it here.

## DEC-055 packaging prerequisite (2026-09-29)

The review renderer, changed-output validator and affected-tab registration come from the installed layer repository at the pinned package commit. The host owns the Work shell, snapshot isolation and acceptance transaction. LAT-T01–T03 must establish that extension boundary before this packet's representative Design/Pages/Code/Markdown reviews can close. A hardcoded six-layer review switch would fail the owner-selected template model.
