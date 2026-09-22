---
id: portal-layers-knowledge-structures
kind: domain-model-proposal
status: proposed
updated: 2026-09-22
depends_on: [portal-layers-model, portal-layers-knowledge-research]
---

# Knowledge structures by layer

The record types, their fields, and how they connect, for every project, Aludel included. Grounded in the [knowledge research](knowledge-research.md) and decided in DEC-037. This is the source for the later pass that brings these structures into the portal. The [LAY-02 prototype](v2/index.html) shows them with Tool Share data.

## Navigation

**Home · Product · Design · Pages · Platform · Work** in the rail, then **Settings** and an **account button** (profile, sign out) at the bottom. Each layer uses tabs. Global search spans every record.

## Product: founder and product lead

### Vision (one per project, revisioned by section)

| Section | Content | Source framework |
|---|---|---|
| Vision statement | Why the product exists, in one or two sentences | Product Vision Board |
| Target users | Personas: name, context, goals, frustrations | Vision Board target group; story-map users row |
| Needs and opportunities | Unmet needs, pain points and desires, each linked to research evidence | Opportunity Solution Tree |
| Standout capabilities | The three to five things that make it worth using | Vision Board "product" |
| Outcomes and measures | Business goals and product outcomes (behaviour or sentiment), with how they are measured | Vision Board business goals; OST desired outcome |
| Principles | Non-negotiables that every spec, design and task must respect. **Every work item's context includes them** (the agents' constitution) | Spec Kit constitution |
| No-gos | What the product deliberately does not do | Shape Up |

### Story map

```
Personas row
Activity (backbone, left → right narrative) ─ Activity ─ Activity …
  Step ─ Step           Step ─ Step
    Story                 Story         ← stacked by priority
────── Demo slice (walking skeleton) ──────────────────────────
    Story                 Story
────── MVP slice ───────────────────────────────────────────────
    Story
────── Later ────────────────────────────────────────────────────
```

| Record | Fields |
|---|---|
| Activity | Title, persona(s), narrative order, origin (user or story pack) |
| Step | Title, activity, order |
| **Story** | ID; "Someone can …" statement; persona; why (need or opportunity link); phase (slice); priority within the step; **acceptance** as Given/When/Then scenarios; edge cases ("What happens when …?"); open clarifications; origin (user, agent draft, or story pack); pages that realise it; status (derived) |

- **Status is derived, never set by hand.** Proposed → defined (acceptance accepted) → designed (a page realises it, accepted) → built (an accepted build implements it) → shipped (live in production).
- **Story packs** seed activities, steps and stories. Stories a template can build arrive already **built**, with a completed work item attributed to the template. Pack stories are ordinary stories afterwards; changing them creates ordinary work.

### Roadmap (a view over the map)

Each phase record has a goal, outcome, **appetite** (time budget), exit criteria and its stories (from the map's slice). Demo is the walking skeleton.

### Specs (one per increment of related stories)

| Section | Content |
|---|---|
| Stories | The stories this increment covers (usually from one activity and phase) |
| Problem | What this increment solves, and for whom |
| Appetite | Time budget; this constrains the solution |
| Solution sketch | Key elements, in words or a flow |
| Rabbit holes | Risks called out up front |
| No-gos | Excluded from this increment |
| Requirements | Numbered: `FR-001 The system must …`, with `WHEN …` when a requirement is conditional (EARS-style) |
| Key entities | Data the increment touches, with no implementation detail |
| Success criteria | Measurable, technology-agnostic |
| Assumptions | Defaults chosen where the stories were silent |
| Clarifications | `Needs clarification` markers; each becomes a question on the spec's work item and blocks only that work |

Status: draft → in review → accepted → superseded. An accepted spec generates a technical-plan work item.

### Research

Interviews, observations, competitor notes and analytics excerpts. Each links to the needs and stories it supports. Opportunities should come from evidence, not invention.

### Docs

Free-form documents, which vary by organization, with optional templates (PR/FAQ, positioning, pricing, launch plan). A doc can mention any record, and those mentions become links in both directions.

## Design: creative lead, the system

| Tab | Holds |
|---|---|
| Foundations | Design principles; **tokens in DTCG form** (`$value`, `$type`, references, themes and modes): colour roles, type scale, spacing, shape, elevation, motion |
| Components | Catalog: purpose, anatomy, variants, states, accessibility, maturity (proposed → incubating → stable → deprecated), pages that use it |
| Patterns | Interaction rules (placement, disclosure, navigation), layouts and **page types** (the archetypes the page tree and scaffold use) |
| Guidelines | Content and voice, accessibility baseline, free-form guidance |
| Sources & changes | Adopted systems and versions, the deviation ledger, proposed and released changes |

Follows the R-08 [design-system strategy](../design-system-strategy.md) and [profile template](../process/design-system-profile-template.md).

## Pages: applying the system to the product

| Tab | Holds |
|---|---|
| Page tree | Navigation pages and sub-pages, with gaps shown; each page has a type, origin (user or story pack) and order |
| Page | Live prototype built from tokens and components, concept art and inspiration, notes, stories realised, options and versions, state matrix (empty, loading, error…), decision history |
| Flows | Journeys across pages, one per story-map activity |

## Platform: engineering and operations

| Tab | Holds |
|---|---|
| Architecture | Stack preset, system data model (entities and relationships), APIs and contracts, technical decisions (ADR-style) |
| Repository | Repository, branches, commit history |
| Environments | Preview and production, deploys, health |
| Connections | GitHub, agent providers, other integrations, access |

## Work: the bench

A work item has: ID, type (define, spec, plan, design, implement, review, research, audit, configure), source layer, target records, state (suggested → ready → claimed → needs input → in review → done), assignee (agent role, person, or **template**), questions, "will document" outputs, and a log.

Its **context bundle** is compiled like a story file. It contains the goal and story, acceptance, principles, relevant page, tokens and components, technical-context excerpt, decisions, file scope and outputs. Each part cites its source record, and more is retrieved on demand.

Routines create work on a schedule. Working style sets which work types are automated.

## Onboarding against these structures

Revised order: working style → idea → account → GitHub → agent → look & feel → **functionality (story packs)** → **pages** → build.

- **Idea** seeds the Vision statement (personas are added by the person; no placeholder persona is invented).
- **Look & feel** seeds Design Foundations (tokens) and the feel.
- **Story packs** seed the story map and propose pages.
- **Pages** seeds the page tree (pack pages arrive placed, labelled with their pack, and fully editable; deleting one asks which page takes its stories).
- **Stack** seeds Platform Architecture.
- **Build** runs template work items. Anything a template builds is shown as a completed work item; anything that needs judgement becomes a suggested or ready item.

## Story pack catalog (first pass)

Stories are written as "Someone can …". **T** = a template builds it during onboarding; **—** = it becomes a work item. **As built (LAY-03):** the source of truth is `apps/portal/config/story-packs.json`, and only Accounts sign up, sign in and sign out are template-built, because only those are really generated by aludel-web-v1 today. Messaging, notifications and profiles become work until a template actually builds them.

| Pack | Activity › steps | Stories (phase, T) | Proposed pages |
|---|---|---|---|
| Accounts | Join › sign up, sign in, recover; Manage account › profile, sign out | Sign up with email and password (Demo, T) · Sign in (Demo, T) · Sign out (Demo, T) · Reset a forgotten password (MVP, —) · Edit my name and photo (MVP, —) | Sign in (outside nav); Account (menu) |
| Messaging | Talk it over › start, read, reply, stay informed | Start a conversation from a record (Demo, —) · See my conversations with unread counts (Demo, T) · Read and reply in a thread (Demo, T) · Get notified of new messages (MVP, —) · Block someone (Later, —) | Messages (nav) › Conversation |
| Search | Find › search, refine | Search by keyword (Demo, —) · Filter results (MVP, —) · See recent searches (Later, —) | Search field in the header (pattern, not a page) |
| Notifications | Stay informed › see, manage | See what needs my attention (MVP, T) · Choose what I'm notified about (Later, —) | Bell menu; Notification settings |
| Profiles | Know who's who › view, edit | View someone's profile (Demo, T) · Edit my public profile (MVP, —) | Profile |
| Uploads | Share media › upload, manage | Attach a photo (MVP, —) · Remove something I uploaded (MVP, —) | none (a component) |
| Payments | Pay › checkout, history | Pay for something (MVP, —) · See my payment history (Later, —) | Checkout; Billing |
| Admin | Run the app › moderate, configure | See and remove reported content (MVP, —) · Manage users (Later, —) | Admin (separate area) |

Pack stories that need domain knowledge (e.g. "start a conversation *from a tool*") are drafted with a placeholder for the product's own records and asked about in their work item.
