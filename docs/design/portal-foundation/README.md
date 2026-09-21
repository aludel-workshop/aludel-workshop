---
id: portal-foundation-001
kind: design-workspace-index
status: selected-for-prototype
updated: 2026-09-19
packet: D-01D
---

# Portal experience architecture

This workspace defines the structural system for Aludel before another interaction prototype is built. It starts from [owner feedback on D-01B version 3](feedback-2026-09-19.md), which accepted the initial decisions-first hierarchy and rejected the unsupported transitions, task page, and surrounding shell assumptions.

## Priority correction — 2026-09-19

R-07C produced a trial operating procedure and three desk exercises. D-01D was its first live application under the [scoped work record](../process/d-01d-work-record.md). Journeys and responsibilities were written before the [v1 static board](v1/review.html). The [structure contract](v1/structure.md) combines the map, journeys, page archetypes, transitions, task story map and component ownership. The owner selected direction A on 2026-09-19; the [review record](v1/review-record.md) preserves its scope. The [assessment](v1/assessment.md) records process evidence and limits, and the [readiness verdict](v1/prototype-readiness.md) bounds D-01B.

## Work sequence and gates

| Step | Artifact | Review question | Must be settled before |
|---|---|---|---|
| 1 | Owner-journey map | What is the owner trying to accomplish at each stage, and what causes movement to another place? | Page inventory |
| 2 | Product map and navigation alternatives | Which stable places exist, what is global versus project-local, and where does each journey enter? | Shell selection |
| 3 | Page archetype contracts | What does each collection, detail, decision, authorization, progress, and review page own and exclude? | Page composition |
| 4 | Transition model | After Decide, Authorize, Cancel, Fail, Revise, or Accept, what remains in context and where does the owner land? | Wireflows |
| 5 | Task-detail story map | Who visits a task in each state, what must they understand, and what is the one primary action? | Task layout |
| 6 | Shell and layout alternatives | How do navigation, context, content, and action regions work on wide and narrow screens? | Direction selection |
| 7 | Low-fidelity wireflows | Can the owner follow Decide → Work → Task → Review without explanation? | D-01B resume |
| 8 | Component responsibility map | Does each major component have one purpose and a home, with no collection/detail leakage? | Prototype specification |

Review gates are sequential. A later artifact may expose a problem in an earlier one; revise the earlier artifact rather than papering over it in layout. No executable interaction is required in D-01D.

## Constraints retained from prior work

- One owner manages several projects.
- The first useful loop is request → deliberate authorization → real agent-built preview → review.
- BorrowBox is the shared generated-application fixture; Aludel is the portal.
- Direction B's initial hierarchy—consequential decisions followed by ready work—is the selected starting direction, not approval of its surrounding page model.
- Collection pages summarize and route; detail pages explain and support action on one record.
- Answering a product decision never silently authorizes execution.
- Provider mechanics appear only when they help the owner act or recover.
- Review stays bound to an immutable artifact and its input revisions.

## Selected direction and remaining assumptions

Direction A establishes a project-first workspace with Overview, Work, Decisions and Reviews; full-page record details; explicit collection returns; and the reviewed decision → affected Work → task → candidate review flow. The earlier Home/Projects/Inbox/Reviews and Overview/Plan/Work/Decisions/Releases sets are superseded for this prototype slice. Full portfolio attention, Plan and Releases remain outside the experiment. Labels, interaction feel, visual character and review evidence threshold remain subject to D-01B evidence. Existing prototype code supplies behavioral evidence but is not a composition template.

## Completion record

D-01D completed on 2026-09-19 with direction A selected. D-01B may proceed within the readiness verdict; this selection does not authorize implementation, external integration, deployment or release.
