---
id: portal-layers-knowledge-structures
kind: domain-model-proposal
status: proposed
updated: 2026-09-22
depends_on: [portal-layers-model, portal-layers-knowledge-research, portal-layers-data-platform-research]
---

# Knowledge structures by layer

The record types, their fields, and how they connect, for every project, Aludel included. Grounded in the [knowledge research](knowledge-research.md) (DEC-037) and the [data, platform and traceability research](data-platform-research.md) (DEC-038). [Prototype v2](v2/index.html) shows Product, Design, Pages and Work; [prototype v3](v3/index.html) adds Data, the Platform operations tabs, Work › Agents and code links, all with Tool Share data.

**Stack rule (DEC-038):** nothing above Platform references stack specifics. Product, Design, Pages and Data are written so any stack could implement them; Platform holds the binding.

## Navigation

**Home · Product · Design · Pages · Data · Platform · Work** in the rail, then **Settings** and an **account button** (profile, sign out) at the bottom. Each layer uses tabs. Global search spans every record.

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

## Data: objects and contracts (stack-neutral)

| Tab | Holds |
|---|---|
| Objects | Relationship map, plus one record per object: description; fields as **JSON Schema 2020-12** (type, format, required, enum, description); relationships (`$ref`, cardinality, ownership: "a Tool belongs to one lender"); lifecycle states and transitions; example; stories and specs that need it; "Built by" |
| API | Operations grouped by object, in **OpenAPI 3.1** shape: `operationId`, summary, method and path, parameters, request and response schemas (referencing Objects), errors, the roles allowed, stories and specs, "Built by". Exportable as one `openapi.json` |
| Access | Roles × objects × actions (read, create, update, delete, plus named transitions), each cell either allowed, owner-only, or denied, with a rule sentence ("Only the lender can approve a request") |
| Events | Later: named domain events (`BorrowRequest.approved`) with payload schemas, for notifications and integrations |

- An accepted spec's "Key entities" propose objects. A technical-plan work item writes the contracts, and its answers land as revisions with a rationale.
- Object and operation status is derived like story status: **proposed** (named in a spec) → **contracted** (schema accepted) → **built** (linked code) → **shipped**.
- Story packs bring their objects and operations (the Accounts pack brings `User`, `Session` and the sign-in operations).
- **As built (LAY-07A):**
  - Kinds are `data_object` (JSON Schema, relations by object id, states, stories, specs, `contract: proposed|accepted`), `data_operation` (OpenAPI-shaped; `$ref` holds an object id and becomes `#/components/schemas/<Name>` on export) and `access_rule` (role, object, action, `allow|owner|deny`, sentence).
  - Validation is structural only.
  - The Accounts object is called `Account {email, name}`, matching what aludel-web-v1 stores. Its operations are `getSession`, `signUp`, `signIn`, `signOut` and `health`.
  - Events are not built.
  - Evidence: [LAY-07](../../evidence/lay-07-data-platform-agents.md).

## Platform: engineering and operations (the stack binding)

| Tab | Holds |
|---|---|
| Overview | Health at a glance: environments, last release, database, backups, domains, suspect code links |
| Architecture | Stack preset; **binding** from Data to the stack (object → table, operation → handler); runtime **Services** the app calls (email, payments, storage), each linked to the stories that need it; technical decisions (ADR-style) |
| Code | **Code links** (below): coverage matrix of stories × built/tested/suspect; code units with why they exist, references in and out, tests and state |
| Repository | Repository and branches, commits with their work-item trailers, **GitHub** connection |
| Releases | CI/CD: each build's checks, preview, promotion to production and rollback. A release names its commits and therefore the stories it ships (the **shipped** status) |
| Environments | Preview and production: services, deploy history, health and logs, hosting provider |
| Database | Per environment: health (size, connections, slow queries), backups and restore points, migrations (applied and pending, each linked to the object revision it realises), browse data, read-only query |
| Domains | Addresses per environment, DNS records to set, verification and TLS state |

Integrations sit where they are used (DEC-038): GitHub in Repository, hosting in Environments, DNS in Domains, runtime services in Architecture, agent accounts in Work › Agents. Settings keeps a read-only list of every connection for audit.

### Code links

| Record | Fields |
|---|---|
| Code unit | Path, symbol (component, route, operation handler, table, migration, exported function, test), kind, content hash, last commit; reachable (from the structure index) |
| Trace link | From a knowledge record **at a revision** (story, page, object, operation, spec requirement) to a code unit; kind (generated, implements, tests); source (manifest, commit trailer, test name, later coverage); state (current or suspect) |

- **Declared links come from three sources, never inline tags:**
  - the scaffold's generation manifest
  - commit trailers on closed work (`Aludel-Work: W-12`, `Implements: S4, SPEC-02/FR-001`)
  - test names that start with an acceptance ID (`S4 · Given …`)
- **Derived links** (callers and callees, reachability) are computed from the code on each commit (TypeScript compiler API first; SCIP for other stacks; Knip-style reachability).
- **Unit state:**
  - *healthy*: reachable and traced
  - *suspect*: its upstream record has a newer revision
  - *untraced*: reachable with no link
  - *dead*: unreachable, with no live trace
- **Propagation:** a new revision of a linked record makes its links suspect and creates one **Reconcile** work item. The item's context holds the revision diff, the linked units with their callers and callees, and the linked tests. Its plan classifies each unit as create, modify or remove. Closing it re-links against the new revision.
- Layers above Platform show only the "Built by" summary: count of units, tests passing and suspect state.
- **As built (LAY-07B/D):**
  - Tables are `code_units` and `trace_links`, and each link also records the `work_ref` from its trailer.
  - Only content changes suspect links; moving a record does not.
  - Page links are *derived*: a rebuild regenerates the page from its record, relinks it and closes its Reconcile item.
  - Trailer links anchor at the record's revision when the commit was made.
  - The extractor knows aludel-web-v1 shapes. Other stacks need their own extractor.
  - Tests pass/fail is not yet recorded (the count is of linked tests).
  - Database: the preview's schema is read live, since the preset creates tables at start-up and has no numbered migrations yet. Backups go to `<data>/backups/<project>/`, outside the repository.
  - Settings' read-only list of connections is not built.

## Work: the bench

A work item has: ID, type (define, spec, plan, design, implement, review, research, audit, configure), source layer, target records, state (suggested → ready → claimed → needs input → in review → done), assignee (agent role, person, or **template**), questions, "will document" outputs, and a log.

Its **context bundle** is compiled like a story file. It contains the goal and story, acceptance, principles, relevant page, tokens and components, technical-context excerpt, decisions, file scope and outputs. Each part cites its source record, and more is retrieved on demand.

Routines create work on a schedule. Working style sets which work types are automated.

**As built (LAY-04):**

- Each work type has one governing preference and a mode per value (`you`, `agent`, `agent-review`) in `apps/portal/config/interaction-profiles.json › automation`. The modes match the v2/v3 table: a Planner writes stories and acceptance, and agents draft specs and designs for review.
- Automated suggestions are staged once and routed to their profile. Nothing runs until provider use is authorized.
- Closing record-changing work needs a revision made from it.
- Answers are applied as revisions: a story's or spec's clarification moves to `resolved`.
- Routines (`routine` records, `routine_runs`) are weekly, monthly or before-release, with one open item per routine.
- [Evidence](../../evidence/lay-04-work-automation.md).

| Tab | Holds |
|---|---|
| Queue | Work items by state, with suggestions |
| Agents | **Accounts** (provider connections: Codex on this machine, an Anthropic or OpenAI key) and **profiles** |
| Routines | Scheduled work |
| Working style | Which work types go to which profile automatically |

An **agent profile** has:

- name and role, and when it's used (work types)
- account and model
- instructions (revisioned)
- layers it may write
- effects that need approval
- a budget (off by default, DEC-004)

Instructions are layered:

1. Product principles (every profile)
2. project instructions (exported to `AGENTS.md` in the repository)
3. role instructions
4. work-type guidance

A work item records the profile and instruction revisions it ran with. Default profiles: Product lead, Design lead, Architect, Coding agent, Reviewer.

**As built (LAY-07C):**

- Kinds are `agent_profile` and `project_instructions`, seeded from `apps/portal/config/agent-profiles.json`.
- Each work type, including the new `reconcile`, goes to exactly one profile. Working style moves a type as a revision of both profiles.
- Every profile uses the project's single agent connection (DEC-034).
- Assignment pins the revisions of the principles, project instructions and role, plus the work-type guidance key. LAY-04 re-pins when a run actually starts.

## Onboarding against these structures

Revised order: working style → idea → account → GitHub → agent → look & feel → **functionality (story packs)** → **pages** → build.

- **Idea** seeds the Vision statement (personas are added by the person; no placeholder persona is invented).
- **Look & feel** seeds Design Foundations (tokens) and the feel.
- **Story packs** seed the story map and propose pages.
- **Pages** seeds the page tree (pack pages arrive placed, labelled with their pack, and fully editable; deleting one asks which page takes its stories).
- **Stack** seeds Platform Architecture.
- **Agent** connects an account in Work › Agents; default profiles use it.
- **Story packs** also seed their Data objects and operations (Accounts: `User`, `Session`, sign-up, sign-in and sign-out).
- **Build** runs template work items. Anything a template builds is shown as a completed work item; anything that needs judgement becomes a suggested or ready item. The build writes the generation manifest, so template-built stories have code links from the start.

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
