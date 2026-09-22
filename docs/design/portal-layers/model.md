---
id: portal-layers-model
kind: experience-architecture
status: proposed
updated: 2026-09-22
depends_on: [product-001, onboarding-work-record]
supersedes_structure: [experience-foundation#product-structure, project-workspace-v1-delivery-plan]
---

# Portal layers: one project, a team of layers

Owner direction, 2026-09-22, recorded as DEC-036. Each layer of a project is a standing member of the team. Work from every layer flows through one shared bench, where people and agents act the same way. Like an aludel's stacked vessels, each layer refines what it receives and passes it on.

## Layers

| Layer | Team role | Owns | Typical work it generates |
|---|---|---|---|
| **Home** | — (overview) | Current phase and story progress, what needs you, live app and deployment status, recent changes across layers, and later analytics summaries | — |
| **Product** | Founder / product lead | Vision, audience and problems, **features and their stories** (functional description, acceptance), **roadmap phases** | Draft or refine a brief, split a feature into stories, check product drift |
| **Design** | Creative lead | Design system: foundations and tokens, components, patterns, guidelines, sources and changes | Extend the system, propose a component |
| **Pages** | Creative lead, applied | The **page tree**, where each page has concept art, notes, options and a live prototype built from real tokens and components; flows across pages | Design a page for a story, propose layout options |
| **Platform** | Engineering / operations | Stack, repositories, environments, deployment, integrations, agent connections | Configure an environment, connect a provider |
| **Work** | The shared bench | One stack of work items from every layer, **routines** that create work on a schedule, and the **working style** that decides what is automated | — |

Later: an **Insights** layer (usage analytics, feedback, experiments), which feeds observations back to Product.

Navigation is layer-first: Home, Product, Design, Pages, Platform, Work (DEC-037), plus global search, with Settings and an account button at the bottom. The old *Decisions*, *Sources/Knowledge* and *Intake* destinations dissolve into the layers they belong to.

## The unit of progress is the story

A feature is not done once; it grows over phases. Messaging might have "message a lender" in Demo, "reply notifications" in MVP and "group threads" later. So **stories** carry status and a roadmap phase, and a feature shows its stories' progress by phase rather than a single status.

Story status is derived from connected work, never set by hand: **defined** (acceptance agreed) → **designed** (a page realizes it) → **built** (an accepted build implements it) → **shipped** (live in an environment).

## Threads between layers

Records link across layers without duplicating each other. A story in Product shows the pages that realize it (Design), its work items (Work) and where it runs (Platform). A page in Design shows the stories it serves. Every record has the same small *Connected* rail, so following a thread is one click in each direction, but the layer always frames the view.

## Documentation is the output; logs are not

- A question an agent or person raises while doing a work item belongs to that item and blocks only it.
- The **answer lands as a revision of the record it affects, with its rationale**: the Search page uses layout B because…, linked back to the work item that asked. Closing a work item requires naming the records it created or revised. An item that changed nothing documented is flagged.
- Work's own documentation (agent instructions, routine definitions, working-style policy) lives in the Work layer.
- Knowledge is not a separate place: research, references and rationale are anchored to the layer records that needed them, and one global search spans them all.

## Work items

Every layer shows its gaps as quiet placeholders ("Search page: not designed · Start now · Add to queue"). Work shows the same gaps in a low-key *Suggested* section until they are staged.

| State | Meaning |
|---|---|
| Suggested | A gap a layer knows about; not yet queued |
| Ready | Queued and waiting to be picked up |
| Claimed | An agent or a person is on it (the same action for both) |
| Needs input | Blocked on a question attached to this item |
| In review | A draft, design or build awaits a verdict |
| Done | Closed, with its documented outputs named |

A work item carries its source layer, target records, type (define, design, implement, review, research, audit…) and assembled context: links into the layers that a person or an agent reads identically.

**Working style is automation policy, not a task property.** It decides which work types are staged and assigned to agents automatically:
- Dreamer: nearly all, with vision and roadmap asked as a few questions.
- Planner: definition stays with the person; design options and implementation go to agents.
- Tinkerer: nothing is automatic.

Any single item can be reassigned.

**Routines** (security audit, product-drift check, dependency updates) create ordinary work items on a schedule. This is where self-discovered improvement work enters.

## Default path, not navigation

The order of a first pass (define the product → plan phases → design pages → configure the platform → do the work) is how suggestions are sequenced and what onboarding walks through. It is not a navigation hierarchy; layers are revisited continuously.

## Relation to earlier structure

Supersedes the Overview / Work / Decisions / Reviews project navigation and the PW-02 Overview / Product / Work split. Kept: durable revisioned records, provenance, dependency-specific staleness, explicit authorization before execution, and immutable build review. Onboarding becomes the guided first pass through these same layers.

## Knowledge shape

What each layer holds, grounded in story mapping, the Product Vision Board, Opportunity Solution Trees, Shape Up and spec-driven development (Spec Kit, Kiro, BMAD): [knowledge research and proposed model](knowledge-research.md). LAY-01 review adjustments: Design splits into System and Pages; Platform uses tabs; Product gains free-form Docs; the rail gains an account button.

## Path

1. **LAY-01** Clickable structure prototype with Tool Share data ([v1](v1/index.html)); owner judges the structure.
2. **LAY-02** Project scoping: real routes, project-scoped APIs, `the-machine` as an ordinary project.
3. **LAY-03** Layers in the app: onboarding writes into Product, Design and Platform; stories and pages become records; Home dashboard.
4. **LAY-04** Work items, routines, working-style automation, and document agents (product manager first; no code sandbox needed).
5. **LAY-05** Coding agents against stories (absorbs B-03B's isolation, recovery and review).
