---
id: portal-layers-knowledge-research
kind: research
status: proposed
updated: 2026-09-22
depends_on: [portal-layers-model, design-system-strategy-001]
---

# What knowledge each layer holds, and in what shape

Question from the owner (2026-09-22): what is an established, non-invented structure for product definition (vision, features and stories, roadmap) that breaks down into the granular documentation work items need? What do agents work best from? Which existing tools are good design references? Also, from the LAY-01 review: Design is too full, Platform should use tabs, Product needs free-form docs, and the rail needs an account button.

All sources were accessed 2026-09-22. **Fact** marks what a source states; **Inference** marks our conclusion.

## 1. Findings

### Vision and product definition

| Framework | What it captures (fact) | What we take (inference) |
|---|---|---|
| [Product Vision Board](https://www.romanpichler.com/blog/the-product-vision-board/) (Pichler) | Vision on top; strategy below as **target group, needs, product (standout features), business goals** | The backbone of the Vision page: short, structured and reviewable |
| [Opportunity Solution Tree](https://www.producttalk.org/opportunity-solution-trees/) (Torres) | **Desired outcome → opportunities** ("an unmet customer need, pain point, or desire") **→ solutions → assumption tests**. Opportunities come from story-based customer interviews, not invention | Needs and outcomes become records with evidence links. Research lives in Product and feeds opportunities, which are what stories answer |
| [Shape Up pitch](https://basecamp.com/shapeup/1.5-chapter-06) (Basecamp) | **Problem, appetite, solution, rabbit holes, no-gos** | The shape of a *spec* for an increment. Appetite and no-gos are what keep agents from over-building |
| [Working Backwards PR/FAQ](https://workingbackwards.com/concepts/working-backwards-pr-faq-process/) (Amazon) | A future-dated press release plus customer and internal FAQs, written before building | An optional doc template in Product's free-form documents, not a required structure |
| [Spec Kit constitution](https://github.com/github/spec-kit/blob/main/spec-driven.md) (GitHub) | "Non-negotiable principles" that govern how specifications become code | Product principles double as the agents' constitution: one record, read by every work item |

### Stories and the story map

- **Fact** ([Patton](https://jpattonassociates.com/the-new-backlog/)): a story map has a **backbone of activities** ("a big thing that people do … doesn't always have a precise workflow") ordered left to right as a narrative, **user tasks/steps** under each activity, and **details/stories** stacked vertically by necessity. The stories placed highest form the **walking skeleton**, "the smallest possible system … that would give you end to end functionality". **Release slices** are horizontal lines across the map.
- **Fact** ([StoriesOnBoard](https://storiesonboard.com/user-story-maps.html), [MCP post](https://storiesonboard.com/blog/prd-to-story-map-ai-agent)): tools implement this as **personas → goals/activities → steps → stories → releases**. Cards carry acceptance criteria, decisions, assumptions and research. StoriesOnBoard exposes the map to agents over MCP as "the single source of truth from strategy to shipping".
- **Inference:** the story map is the Product layer's centre of gravity. Our "phases" are release slices, and Demo is the walking skeleton. What onboarding called functionality (search, messaging) cuts across activities, so it becomes a **capability** tag on stories and an alternate view, not the map's primary axis.

### What agents work best from

| Source | Fact | Inference |
|---|---|---|
| [Spec Kit spec template](https://github.com/github/spec-kit/blob/main/templates/spec-template.md) | Prioritized user stories that are each "INDEPENDENTLY TESTABLE", with Given/When/Then acceptance, edge cases, numbered functional requirements ("System MUST …"), `NEEDS CLARIFICATION` markers, key entities, measurable success criteria and assumptions | Story and spec fields. `NEEDS CLARIFICATION` is exactly our "needs input" question, generated from the document itself |
| [Spec Kit plan](https://github.com/github/spec-kit/blob/main/templates/plan-template.md) and [tasks](https://github.com/github/spec-kit/blob/main/templates/tasks-template.md) templates | The plan holds technical context, a constitution check, data model, contracts and research. Tasks are grouped by phase and **by user story** (`[ID] [P?] [Story]`), with exact file paths and parallel markers | Technical planning is an engineering (Platform) concern attached to a spec. Tasks always trace to a story |
| [Kiro specs](https://kiro.dev/docs/specs/feature-specs/) | requirements.md in **EARS** ("WHEN [condition] THE SYSTEM SHALL [behavior]"), then design.md, then tasks.md, with a human approval gate between phases (or "Quick Spec" with no gates) | Gated versus ungated phases is exactly our working-style policy |
| BMAD Method ([overview](https://github.com/bmad-code-org/BMAD-METHOD), [artifact flow](https://deepwiki.com/bmadcode/BMAD-METHOD/6.7-context-engineering-and-artifact-flow)) | Specialised agents (analyst, PM, architect, scrum master, dev). The PRD is "sharded" into self-contained **story files** carrying dev notes with citations back to the PRD and architecture, acceptance criteria, tasks mapped to criteria, a testing strategy and owned file scope | The work-item context bundle is a compiled story file assembled from the layers, citing its sources rather than copying them |
| [Anthropic, context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | "Smallest possible set of high-signal tokens"; canonical examples over rule lists; just-in-time retrieval through tools; structured notes kept outside the context window | Bundles stay small and link out; agents fetch more through a records API. Agent instructions favour examples |

### Design system

- **Fact**: the [DTCG Design Tokens format](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/) reached its first stable version (2025.10): tokens with `$value`/`$type`, references and theming, read and written by Figma, Penpot, Tokens Studio and Style Dictionary.
- **Fact** (our own R-08 [strategy](../design-system-strategy.md) and [profile template](../process/design-system-profile-template.md)): a design system spans sources and deviations, principles, a token model, patterns (including interaction placement and page archetypes), a component contract and maturity, a change workflow, agent context and governance.
- **Inference:** that depth needs tabs rather than one card each. Tokens are stored in DTCG form so they can move to and from Figma or Penpot without a bespoke converter.

## 2. Proposed knowledge model

The rail shows each layer with its own sub-navigation (as Work already does), and an **account button** sits at the bottom next to Settings.

### Product: the founder and product lead

| Tab | Holds | Grounded in |
|---|---|---|
| **Vision** | Vision statement; target users (personas); needs and opportunities (with evidence); standout capabilities; outcomes and measures; **principles** (the agents' constitution); scope boundaries and no-gos | Vision Board, OST, Spec Kit constitution, Shape Up no-gos |
| **Story map** | Personas → activities (backbone) → steps → stories stacked by priority, sliced into phases (Demo = walking skeleton). A story holds: "someone can …", why, Given/When/Then acceptance, edge cases, open clarifications, capability tags, evidence links | Patton, StoriesOnBoard, Spec Kit stories |
| **Roadmap** | The same slices over time: each phase's goal, outcome, appetite and exit criteria. A view of the map plus phase records, not separate data | Patton release slices, Shape Up appetite |
| **Specs** | One per increment (a group of stories picked up together): problem, appetite, solution sketch, rabbit holes, no-gos, numbered requirements, key entities, success criteria, assumptions, clarifications | Shape Up pitch, Spec Kit spec, Kiro requirements (EARS optional) |
| **Research** | Interviews, observations and competitive notes, each linked to the needs and stories they support | OST |
| **Docs** | Free-form documents per organization (PR/FAQ, pricing, positioning…), with optional templates; they can reference any record | Owner requirement; PR/FAQ as a template |

**Capabilities** (search, messaging…) are a tag and an alternate view across the map, and a status rollup per capability.

### Design: the creative lead, as two destinations

**System**

| Tab | Holds |
|---|---|
| Foundations | Principles, tokens in DTCG form (colour, type, space, shape, elevation, motion), themes and modes |
| Components | Catalog with contract, states, maturity, stories and usage |
| Patterns | Interaction rules, placement, layouts and **page archetypes** (the page types from onboarding) |
| Guidelines | Content and voice, accessibility, free-form guidance |
| Sources & changes | Adopted systems, the deviation ledger, proposals and releases |

**Pages**

| Tab | Holds |
|---|---|
| Page tree | Every page, with gaps shown |
| Page | Live prototype from tokens and components, concept art and inspiration, notes, stories realised, options and versions, state matrix |
| Flows | Journeys across pages, derived from story-map activities |

### Platform: engineering and operations, in tabs

| Tab | Holds |
|---|---|
| Architecture | Stack, system-level data model, APIs and contracts, technical decisions |
| Repository | Repository and branches |
| Environments | Environments and deploys |
| Connections | Integrations, agent providers, access |

The technical plan for an increment is produced by a planning work item attached to its spec and cites Architecture.

### Work: the bench

Unchanged from LAY-01. Queue, Routines and Working style, plus **agent instructions** written as canonical examples.

## 3. From vision to tasks

```
Vision (principles, outcomes) ─► Story map: activity › step › story (acceptance) ─► Spec for an increment
  ─► Technical plan (Platform) ─► Tasks, each traced to a story (Work)
```

Each arrow is a work type with a producer and a gate that the working style sets. For example, a Dreamer's PM agent drafts specs from the map and asks only for blockers; a Planner writes the map and specs themselves and lets agents plan and build.

A work item's **context bundle** is a compiled story file:
- goal and story
- acceptance criteria
- the applicable principles
- the relevant page, tokens and components
- a technical-context excerpt
- decisions already made
- file scope
- what it will document

Every part cites its source record, and the agent retrieves more through a records API. **Inference, deferred:** expose that API as an MCP server, so external agents (Claude Code, Codex) read and write layers the same way Aludel's own agents do.

## 4. Owner answers (DEC-037)

1. Capabilities are not tags: functionality picks seed ordinary stories into the story map (story packs); template-built ones arrive as completed work.
2. Specs combine related stories: yes.
3. Design and Pages are two separate top-level layers.
4. Acceptance format is agent judgement: Given/When/Then in stories; numbered requirements with EARS-style WHEN clauses in specs.

Resulting record structures: [knowledge structures](knowledge-structures.md).

## 4a. Original open questions

1. Capabilities as a tag and alternate view, with activities as the map's backbone. Agree?
2. Specs per increment (several stories) rather than per story?
3. Design as two rail destinations (System, Pages) under one layer heading. Agree?
4. EARS, Given/When/Then, or both for acceptance? Proposed: Given/When/Then for stories; EARS optional in specs.

## 5. What could change these conclusions

- Owner walkthroughs showing the story map is too heavy for Dreamers (then default to a list view and generate the map).
- Agent trials where compiled bundles underperform plain linked documents.
- A second product whose domain does not fit an activity-based map (for example, a data pipeline).
