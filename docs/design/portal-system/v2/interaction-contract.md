---
id: portal-overview-interaction-v2
status: proposed-after-scoped-owner-feedback
updated: 2026-09-19
packet: D-01F
---

# Outcome Overview with a decision queue

## Accepted direction and boundaries

Owner feedback on the v1 concepts: they are categorically easier on the eyes and make more sense; option 2 communicates Overview best; option 3's layout is odd. Option 1's list-detail pattern may suit object-exploration destinations, but the owner explicitly did **not** approve it for Work, Decisions or Reviews. The left navigation is a preference, not evidence that top navigation fails. Use option 2's overview hierarchy with a left-nav refinement and an actual decision queue.

Accepted: direction and relative hierarchy, qualified visual improvement, preference for left nav. Open: revised queue composition, prioritization, detailed behavior, narrow layout, library fidelity, other destinations and system acceptance. See [v1 feedback](../v1/concepts/review-record.md) and DEC-023. This contract applies the [shared placement procedure](../../process/interaction-placement.md), without exporting these choices to other projects.

## Philosophy amendment — MP9: place interactions deliberately

This extends the [v1 philosophy profile](../v1/system-profile.md). Before selecting an interaction container, explain what the user must see, what can wait, whether the work has its own identity, and how the user returns with context and drafts intact. Choose inline content, disclosure, pane, dialog or destination for those reasons. Evaluate collection scale before allowing a single fixture to dictate the layout. This principle is part of Aludel's design philosophy; the shared process requires every project's profile to make its own explicit placement decisions.

## Placement decisions

| Interaction | Placement and reason | Transition, persistence and failure |
|---|---|---|
| Project outcome, decision title/status/consequence | Directly visible: the owner must orient and compare before opening anything | Display freshness/unknown explicitly; do not render a failed count as zero |
| Decision queue on Overview | At most three concise rows; two-line question/consequence where possible; blocking items before optional in this trial | Show open count and blocking/optional breakdown. For more than three, show “Showing 3 of N” and View all N decisions; with three or fewer, Review decisions opens the same scoped queue. Stable ordering within groups by creation order for deterministic fixtures, not a production priority algorithm |
| Open a named decision | Navigate to a linkable decision destination; context, alternatives, consequences and history merit a full task | Preserve Overview return and scroll. Direct link has canonical project Decisions return. Do not infer list-detail layout for that destination |
| Review decisions | Navigate to project Decisions filtered to open items | No answer, authorization or automatic advance occurs. Preserve selected filter and queue position through return; rendering of that destination remains to be designed |
| Supporting rationale and affected-work detail | Expand within decision context when short; essentials remain visible before commit | Accessible labelled disclosure; expansion is not a write. Large affected-work set uses a scoped collection link. Never hide the fact that checks also await implementation |
| Answer a decision | Explicit commit within its decision destination | Save new decision revision; explain assessed impact, preserve remaining blockers, stay on answer with an explicit next-item link. Failed/conflicting save retains draft. An answer does not start a run |
| New request | Navigate to a focused request/interpretation destination; potentially substantial writing and refinement need room and resumability | Preserve entered text through failed save; establish deliberate unsaved-exit behavior before implementation. This is a hypothesis, not blanket adoption of the old request page |
| Open work summary | Named task goes to its own identity; View work goes to the scoped collection | Keep return/filter context; no authorization on Overview. Collection presentation is unselected |
| Confirmation | Use a dialog only for a concrete short confirmation, such as discarding an unsaved draft | Label consequence, Cancel safe default, explicit focus restoration; no generic “are you sure” before every navigation. No dialog is needed for simply opening a decision |
| Project navigation | Labelled left nav for the revised desktop concept | No added destinations. Narrow adaptation remains to be proven; preserve project identity and route state rather than shrinking a desktop rail |

No inline full decision form, modal decision workflow or automatic carousel is required on the Overview. The page summarizes and routes; it does not claim to be the complete decision-processing workspace.

## Multi-item synthetic fixture

This extends the prior BorrowBox scenario only for this exploration; it does not alter real decisions or authorize work.

- BB-D01: instant confirmation versus volunteer approval; blocks BB-001 reservation implementation and BB-003 checks. BB-003 also needs implementation evidence.
- BB-D04: which pickup windows to show; blocks newly scoped BB-004 pickup instructions. It does not add a dependency to BB-001 implicitly.
- BB-D03: category wording; optional and nonblocking, as in the existing fixture.
- BB-002 catalog descriptions remains ready independently; no candidate exists yet.

Counts: three open decisions, two blocking decisions, one optional decision; four work items. Two affected tasks on BB-D01 is not two decisions. All data is synthetic. Production ranking and question urgency remain Q-006, not answered by this illustrative ordering.

## Cardinality walkthrough — agent reasoning, not runtime tests

| Case | Expected design result |
|---|---|
| Zero open | Say no open decisions; no dead Review decisions button. Work/review context remains; do not imply project completion |
| One open | Same queue row grammar with singular count; no expanded hero special case |
| Three open | Show all three comparable questions and their different effects, with one collection action |
| Twenty open | Show three with accurate total/overflow; use collection for the full queue, not twenty stacked cards or a giant modal |
| Unknown/failed | Show unavailable count and recovery affordance, retain known stale rows with currency; never claim zero |
| Answer saved | Recompute affected readiness, including other dependencies; show next remaining decision explicitly rather than auto-opening or auto-answering it |
| Answer conflicts | Keep draft and current server revision for resolution; queue stays tied to known state |
| Narrow / direct link | Show readable rows; decision remains addressable; Back/return retains the right project and queue scope |

## Evidence required for construction

The revised image can support hierarchy review. Before building, specify the chosen destination contracts only for the represented slice, then prove actual routes/back behavior, keyboard/focus, zero/many/unknown states, draft preservation and save-conflict handling. The shared rule is deliberate placement; this project's queue and navigation remain scoped hypotheses until inspected in use.

## Retrospective

Observed friction: the first image set used a singleton decision example and left collection scale to a later test, allowing a prominent one-off section to shape the Overview. Improvement applied now: a reusable placement procedure plus an explicit multi-item fixture and eight scenario walks before construction. The walks expose a count-versus-impact distinction and preserve independent work; they do not prove behavior. D-01F now consumes this contract; D-01E must apply the same reasoning to each view without inheriting list-detail universally. Option 2 resolves the broad Overview direction; queue behavior and remaining views still need evidence.
