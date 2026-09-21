---
id: demo-borrowbox-001
status: fictional-fixture
updated: 2026-09-18
---

# BorrowBox — shared demo application

BorrowBox is a fictional neighborhood tool library. Members browse tools, choose pickup and return dates, and reserve available equipment. A volunteer manages the catalog and sees upcoming pickups. It is an independent application created through Aludel, not another name for the portal.

## Three distinct layers

1. **Aludel:** the portal being designed. Its project overview, decisions, tasks, authorizations, and artifact reviews manage software development.
2. **BorrowBox project:** the product intent and delivery records displayed inside that portal.
3. **BorrowBox application:** the catalog and reservation interface inside an identified preview. It never displays agent attempts, software milestones, or development decisions.

Use this fixture for all active mockups and future examples unless a scenario requires a different app. Retain older mockups as labeled historical evidence. Synthetic data and identifiers never resolve real project decisions or authorize external effects.

## Product and common change

**Audience:** a neighborhood member borrowing a tool; a volunteer maintaining the library.

**Milestone BB-M1:** members can reserve a tool for pickup.

**Request BB-001:** “Let members reserve an available tool for their pickup and return dates. Show unavailable dates and prevent overlapping reservations.”

**BB-D01 — reservation policy:** instantly confirm available reservations (recommended for the demo), or require volunteer approval. This blocks the reservation implementation and its acceptance checks. Deferral leaves those tasks blocked.

**BB-D02 — execution scope:** build a preview, prepare a change only, or plan only. This is a separate portal authorization-policy fixture used by the older lifecycle prototype; it is not a BorrowBox setting. Neither decision is the real repository Q-002.

**Independent BB-002:** improve catalog descriptions. **Optional BB-D03:** choose category wording; no dependency on reservation behavior. One decision may affect two tasks but counts once in the portal summary.

## App map and data

Catalog → tool detail → choose dates → confirm reservation → reservation receipt / My reservations. Volunteer catalog management is a later slice. Development tracking stays in Aludel.

| Stable fixture ID | Record |
|---|---|
| TOOL-001 | Cordless drill, one available unit |
| TOOL-002 | Folding ladder, one available unit |
| TOOL-003 | Orbital sander, temporarily unavailable |
| MEMBER-001 | Alex, fictional member; no real contact details |
| RES-001 | Existing drill reservation, 2026-10-10 through 2026-10-12 inclusive |

Dates are fixed test data, not today's availability. Demo rule: whole-day inclusive date ranges, one unit per tool. Payment, real member data, email/SMS, deposits, delivery, and production deployment are outside the fixture.

## Future executable acceptance contract

These are intended tests, not passing evidence or authorization to build the app now.

- Reserve TOOL-001 for 2026-10-15 through 2026-10-16; under instant confirmation show a receipt and retain it after reload.
- Reject TOOL-001 for 2026-10-11 through 2026-10-13 because RES-001 overlaps; preserve entered dates and offer another selection.
- Allow TOOL-002 for those dates; availability is tool-specific.
- Reject a return date earlier than pickup and an unavailable tool.
- Two competing submissions cannot create overlapping confirmed reservations.
- Catalog-description edits do not alter reservation availability.
- If BB-D01 changes, Aludel marks previews using the prior policy stale; this is a portal test, not an app feature.

Start with deterministic fixtures and a resettable local datastore when implementation is authorized. A later end-to-end test can submit BB-001 through Aludel, deliberately authorize it, build an independent BorrowBox workspace, run these checks, and review its identified artifact. Keep app behavior checks separate from portal orchestration/recovery checks. Choose the test stack and deployment path later.

## Mockup use

Current D-01C: [v2 review board](../self-change/v2/review.html). The older [D-01B lifecycle prototype](../../../prototypes/d-01b/index.html) uses BB-D02 to preserve its existing authorization-state exercise. It remains an unaccepted layout experiment. Do not infer that BB-D01 or BB-D02 is a real answered owner question.
