# Choosing where an interaction belongs

Shared design procedure, revision 1, 2026-09-19. The rule to make and justify this choice is global; the resulting interaction design belongs to each project. A component library offers mechanisms, not the decision about which mechanism serves the user's task.

Before implementing an action or disclosure, record: user intent; information needed before acting; placement and reason; whether it changes data; identity/deep-link needs; URL/back behavior; draft preservation; keyboard/focus behavior; failure/stale behavior; narrow-screen adaptation. Include cardinality and expected reading/interaction length. A screenshot does not supply this contract.

| Placement | Use when | Required treatment / reason to choose another placement |
|---|---|---|
| Directly visible | Information is needed to orient, compare, judge consequence or choose the next action | Keep the minimum sufficient identity, status and consequence visible. Do not hide blocking information or permission scope behind hover/expansion. |
| Inline expansion | Optional supporting detail serves the same object and task without taking over the page | Explicit labelled toggle and expanded state; stable reading/focus order; preserve expansion where useful. Move to a destination if it becomes a long independent workflow. |
| Contextual pane or sheet | Persistent supporting material is needed alongside the primary task | Define whether it is nonmodal support or modal focus, and whether a record deserves a URL. On narrow screens preserve identity and a clear return; do not merely squeeze columns. |
| Modal dialog | A short, bounded subtask or consequential confirmation needs temporary focused attention while preserving the parent context | Give it a label, deliberate focus entry/return, cancellation and save/error behavior. Avoid long forms, nested dialogs and irreplaceable navigation. Confirmation must explain the actual consequence. |
| Separate destination | Work is substantial, independently meaningful, linkable, revisitable, or needs history, alternatives and evidence | Canonical record identity, browser back, source filter/scroll return, unsaved-draft treatment and direct-entry behavior. A wide screen may present the destination in a pane without abandoning these contracts. |

Do not require every mechanism on every page. Navigation is not mutation. Selection is not commit. A small screen changes presentation without silently changing permission or record identity. Tooltips may explain a control but cannot be the only home for required content.

## Collection cardinality

Design zero, one, several, many and unknown/error states before promoting an Overview pattern. Explicitly state ordering, displayed limit, total, overflow destination and what happens after an item is resolved. Count decisions separately from affected tasks; deduplicate relationships before showing impact totals. Do not make one example record dictate a singleton layout.

## Application and evidence

The [portal v2 placement contract](../portal-system/v2/interaction-contract.md) applies this to Overview, decisions, requests and work links. Owner feedback identified a single-decision design despite a multi-item job. The contract now names cardinality and placement before construction. Its walkthrough is design reasoning; actual keyboard, route, dialog and draft behavior must be checked in the executable trial.
