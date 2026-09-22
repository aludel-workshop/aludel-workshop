---
id: pw-02-product-pattern-research
kind: design-research
status: complete
updated: 2026-09-21
packet: PW-02
---

# Product workspace pattern research

## Question and method

What established interaction patterns should Aludel borrow for a project-scoped Product area covering Direction, Roadmap and Features?

This review used current first-party product documentation and product-owned screenshots from Linear, Productboard and Jira Product Discovery, accessed 2026-09-21. The local captures below are research evidence only: their visual identity, sample data and trademarks are not Aludel assets. The synthesis separates documented behavior from our product inference.

## Reference set

| Source | What the product documents | Local visual evidence | Useful pattern |
|---|---|---|---|
| [Linear Initiatives](https://linear.app/docs/initiatives), [project overview](https://linear.app/docs/project-overview), and [Timeline](https://linear.app/docs/timeline) | Initiatives group projects around objectives; overview pages combine a short summary, properties, resources and a longer brief; the timeline intentionally operates at project rather than issue granularity. | [initiative hierarchy](references/linear-initiative-list.png), [team initiative columns](references/linear-team-initiatives.png), [project overview](references/linear-project-overview.png), [timeline](references/linear-timeline.png) | Lead with named outcomes, retain descriptions in the scan path, expose a compact property strip, and keep roadmap objects coarser than execution tasks. |
| [Productboard Timeline boards](https://support.productboard.com/hc/en-us/articles/25194944993939-Timeline-boards-Flexible-time-based-roadmaps) and [roadmap quick start](https://support.productboard.com/hc/en-us/articles/29983922254739-Quick-start-guide-Roadmaps) | Roadmaps are filtered/grouped projections over the same underlying product data; grids are the stronger editing/comparison surface. Boards can use objectives, initiatives, features or releases as the main item. | [projection controls](references/productboard-roadmap-controls.png), [feature planning](references/productboard-feature-plan.png) | Treat roadmap as a projection, not another source of truth; make the canonical list the dependable editing surface; choose one explicit item grain. |
| [Jira Product Discovery views](https://www.atlassian.com/software/jira/product-discovery/guides/views/overview) and [tree view](https://support.atlassian.com/jira-product-discovery/docs/create-and-navigate-tree-view/) | List, matrix, board and timeline answer different questions over the same ideas. Tree view represents goal/opportunity/solution/project relationships and opens item detail without losing context. | [canonical list](references/jira-product-discovery-list.png), [Now/Next/Later board](references/jira-product-discovery-board.png), [time projection](references/jira-product-discovery-timeline.png) | Use a dense list for comparison, a small number of deliberate projections, explicit parent relationships and contextual detail. |

Additional captures in `references/` were retained to make the retrieval set auditable, but are not implementation references where they are marketing crops, duplicates or unsupported-format variants. SHA-256 identities are recorded in [reference-manifest.sha256](reference-manifest.sha256).

## What we will borrow

### Direction

Borrow Linear's overview reading order: purpose and audience first; a compact property/source strip second; structured outcomes, constraints and success evidence after it. Reading is the default state. Editing is an explicit action with a revision-aware save, not a page full of permanently live controls. Source links remain provenance and are not silently rewritten when the record changes.

### Roadmap

Borrow the hierarchy-first initiative list from Linear and the shared-data projection model from Productboard and Jira Product Discovery. Aludel's canonical objects are **outcomes**, grouped into Now, Next and Later horizons with their short description, state, linked feature count and provenance visible in the scan path. This first slice uses horizons rather than a calendar: the repository does not contain sufficiently authoritative dates, and drawing bars would imply commitments that do not exist.

### Features

Borrow Jira Product Discovery's compact comparison list and contextual detail pattern. The canonical objects are **product capabilities**, not tasks. Rows show the feature, linked outcome, lifecycle state and evidence/source currency. Selection keeps the collection visible beside a stable detail/editor region on wide screens and stacks it on narrow screens.

### Navigation and authority

Borrow the object-model clarity, not each vendor's configurable navigation. Product gets three stable local destinations—Direction, Roadmap and Features—inside Aludel's accepted project shell. One record set supplies each projection. Changing priority or horizon never starts or authorizes work; Work remains the only execution lifecycle.

## What we will not borrow

- A generic view builder, arbitrary fields or deep user-defined hierarchy in this packet.
- RICE/impact formula theatre before Aludel has trustworthy inputs and a decision that calls for it.
- Calendar bars, percentage progress or health rollups without authoritative dates and denominators.
- A card board as the canonical editor; it hides comparison detail and encourages status theatre.
- Dense decorative color, permanent inline editing or vendor-specific chrome.
- Issue/task granularity in Product, which would duplicate the Work plan.

## Reversal conditions

Revisit these choices if observed owner use shows that: exact dates are authoritative enough for planning; several audiences need materially different saved projections; feature volume makes the list/detail arrangement too slow; or product records require a deeper goal/opportunity/solution hierarchy. Those conditions justify a timeline, saved views, stronger search/filtering or a tree respectively. They do not justify adding those controls speculatively now.

## Readiness verdict

**Ready for bounded implementation.** The sources converge on a small reusable rule: keep one canonical, comparison-friendly record set and provide job-specific projections at the right level of granularity. The Product composition can now be built through Aludel's MD3 shell with explicit provenance and authority boundaries. Owner acceptance of the resulting composition still requires local preview evidence; this research does not grant it automatically.
