---
id: project-workspace-v1-structure
kind: experience-architecture
status: proposed
updated: 2026-09-20
---

# A project workspace that explains the product

## Enduring intent

The owner manages products, not collections of agent chats. A product has a purpose and design that persist while many changes move through planning, execution and review. “What should it be?” and “What changed?” are related but different questions. Keep both discoverable without duplicating the underlying records.

Aludel is an ordinary project in this model. BorrowBox's reservation view and Aludel's Work view use the same record/relationship contracts; their design systems, domain models, integrations, code and runtime remain different. MD3 is Aludel's selected language, not a generated-product default.

## Alternative A — Stable product areas with connected work (recommended)

```text
Projects                                      global context; New project
└── Project                                   selected project always visible
    ├── Overview                              attention + current outcome + latest result
    ├── Product
    │   ├── Direction                         vision, audience, outcomes, constraints
    │   ├── Roadmap                           milestones and prioritized hypotheses
    │   └── Features                          capabilities, stories and domain concepts
    ├── Design
    │   ├── Views & journeys                   screen responsibilities and transitions
    │   ├── System                            principles, patterns, components, tokens
    │   └── Explorations                       concepts and prototype experiments
    ├── Work
    │   ├── Requests & proposals               incoming change and interpretation
    │   ├── Plan                              planned packets and dependencies
    │   ├── Active                            authorized/running/blocked work
    │   └── History                           completed/cancelled work and source history
    └── Reviews                               exact candidate, experiment or design judgment
        └── Result detail                     compare, inspect context, respond

Project utilities: Decisions · Sources · Settings (capabilities, connections, environments)
Contextual actions: New request · Find in project · Why/related context
Later, when real capability exists: Releases · Insights
```

These are information groups, not a demand for every child to become a tab, nor approval to ship empty navigation. Only implemented destinations appear as working links. Existing proposal/decision/work URLs remain resolvable through redirects or aliases when grouping changes.

**Primary benefit:** a durable view, component or outcome has a home after its original task is finished. The owner can revisit product intent directly. **Cost:** cross-area tasks need strong contextual links; poorly implemented navigation could make the owner hunt between areas. Mitigate with a shared compact context trail and backlinks, not by duplicating editors.

## Alternative B — One change workspace, with a product library

```text
Projects → Project
    ├── Overview
    ├── Changes                               request/proposal as organizing unit
    │   └── Change
    │       ├── Brief & decisions
    │       ├── Explore                       designs/prototypes for this change
    │       ├── Plan & execute
    │       └── Review
    ├── Product library                       vision, roadmap, features, views, system
    └── Sources & settings
```

**Primary benefit:** the immediate request → result loop has fewer area switches and a clear beginning/end. **Cost:** a view shared by five changes or a component used by ten features tends to become secondary to the change that last touched it; the product library may become another warehouse. It needs the same underlying typed records as A, so it saves navigation breadth, not domain work.

## Comparison against this request

| Owner task | A | B |
|---|---|---|
| Find all past/planned work | Work provides one collection; history and current execution are explicit | Changes is good for recent intent; imported packets lacking requests need special entries |
| Edit vision or inspect roadmap | Prominent, stable Product home | Library can work, but the long-term product is less visible |
| Browse system/view concepts | Design keeps reusable assets prominent | Explore is convenient for one change; shared concepts need library cross-links |
| Why is this component here? | View/component identity is first-class; changes are related records | Natural from current change; historical cross-change provenance is harder to orient |
| Start another project | Product frame → scoped work; progressive completion | New change is easy, but initial product framing competes with execution |
| Keep a small change quick | Context links can preserve a compact request/detail flow | Strongest option for a single change |

Recommendation is a design inference from the recorded owner jobs, not user-tested superiority. Choose A with change detail retaining a compact intent → decisions → work → result trail. Do not combine both complete navigation trees. Prefer B if the owner consistently thinks in change requests and finds stable Product/Design areas distracting. The review asks that question before implementation.

## Responsibility and action contracts for A

| Place / arrival question | Owns and primary action | Does not own | Entry → exit and context |
|---|---|---|---|
| Overview: what needs me now? | Outcome summary and deduplicated Decide/Authorize/Review/Recover queue; open highest-priority item | A second record editor; opaque counts | Project switch → identified detail; return to queue and preserve filter |
| Product / Direction: what are we building and why? | Versioned brief, audience, constraints and outcomes; edit draft/save revision | Work authorization or live component code | Overview or project creation → affected features/roadmap; show pending impact |
| Product / Roadmap: what comes next toward this outcome? | Milestones/horizons and ordered plan references; adjust priority with revision | A separate task state machine | Outcome → plan entry in Work; same entry/revision, no duplicate task |
| Product / Features: what can this product do? | Feature/story acceptance, domain links and current coverage; refine feature | Page composition, provider credentials | Roadmap → related views, decisions and work |
| Design / Views: how does a user accomplish it? | Journeys, view intent/state/transition contracts; revise view brief | Assumption that every view equals one feature | Feature or preview element → concepts, components and change history |
| Design / System: what reusable design governs it? | Profile/philosophy, pattern/component contracts, source/story refs, maturity and deviations; propose change | Inline code/token editing with a second authority | View consumer → system asset/story → source-changing work |
| Design / Explorations: what question are we testing? | Hypotheses, alternatives and experiments; create/register exploration | Real candidate acceptance inferred from image selection | View/feature → identified concept/prototype → scoped design review |
| Work: what may happen, and what happened? | Intake, plan, execution and history; primary action depends on state (refine/prepare/authorize/answer/open evidence) | Vision ownership, build acceptance, release | Roadmap/request → task and exact inputs → result; return to filtered collection |
| Reviews: what exactly am I judging? | Artifact identity, brief/checks/gaps, context and scoped response; accept/revise the identified result when implemented | Execution permission, automatic deployment | Work/attention → frozen result → linked follow-up; baseline stays available |
| Decisions: what choices constrain this project? | Project-wide open/history index; same decisions edited contextually | Repeated copied answers in every feature | Any affected object → decision → affected record; return preserves context |
| Sources: what evidence supports our records? | Imports, research citations, unresolved links, original revisions and reconciliation reports | Canonical home for every product job | Record citation or project search → source with backlinks |
| Settings: what services support this project? | Capability coverage, provider/resource mappings, connection health and environment refs | Implicit provider activation/spending | Work dependency → configured/tested evidence or connection setup gate |

## Interaction placement and state policy

Collections use concise comparable rows with title, lifecycle, currency and next useful action; complete scope/rationale belongs at an independently linkable detail. Design asset galleries may use thumbnails, but preserve text identity and selection scope. Stable details are destinations. Short priority/horizon edits may use a dialog; long direction/feature edits use an explicit draft workspace. Provenance is a contextual pane on wide screens and a full-height destination/sheet with a clear return on narrow screens. It is never hover-only.

A preview context trail reads `Project → Feature → View → Component` as applicable. It is a relation path, not a forced tree: a component has multiple consumers and a feature can span views. Unknown/missing edges are named. Related decisions/work link to their own details; returning restores the selected element, build and preview route.

- **Zero:** explain what this place owns and offer its scoped creation action, not fixture content presented as real.
- **One:** still a collection if the route names a collection; no automatic full-detail substitution.
- **Several/many:** stable ordering, filters and count/limit; route preserves selection/filter. Pagination contract before large imports.
- **Loading/unknown:** show unresolved loading/error and retry; never report unknown as zero.
- **Stale/conflict:** keep old revision readable and retain draft; explain current inputs, offer compare/rebase, prevent invalid authorization/acceptance.
- **Missing/unavailable:** retain identity and provenance even if artifact bytes or worker are unavailable; never substitute “latest.”
- **Keyboard/focus:** link semantics for destinations; focus enters the detail heading, returns to the originating row/control when possible; modal focus trap only for a true dialog. Browser Back/Forward matches visible return paths.

Existing MD3 collection, status and form patterns are reusable inputs, not permission to copy an old page layout. First-slice design must check their current implementation contracts, add exact new states to stories, and apply the [navigation regression gate](../../../evidence/b-03a-work-navigation.md).
