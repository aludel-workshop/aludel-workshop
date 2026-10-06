# W-9 action 1: where Aludel's repository knowledge should live

Item: W-9, "evaluate transition to managing aludel within the app" (Aludel Workshop). Started by the owner on 2026-10-06; this is action 1 of phase 1 (Assess). Authorization and scope are the item itself: repository files on `aludel/w-9`, no record changes.

Goal served: from next week the owner manages Aludel only from the portal. This file sorts what the repository holds by where it should go. Action 2 tests each destination; action 3 turns both into the plan.

## What exists (counted 2026-10-06, `aludel/w-9` at `ddc6b5f`)

| Source | Size |
|---|---|
| Markdown under `docs/` | 235 files (11 top-level docs, 1,972 lines) |
| HTML prototypes | 37 (`docs/design/**/v*/`, `prototypes/d-01*`) |
| Images (screenshots, references) | 594 |
| Decisions | DEC-001 to DEC-068 plus open questions (Q-003, Q-005, Q-008) in `docs/decisions.md` |
| Open packets | about 19 named in `docs/status.md`'s ready queue and handoff notes |
| Work records | about 35 `work-record.md`/brief files, each holding scope, evidence, findings (F-lists) and a retrospective |
| Built-in project `the-machine` | about 169 records (DEC-062 rehearsal), including an earlier document import. Not visible from Aludel Workshop's MCP |

What Aludel Workshop holds today: Vision and Pages are empty. Design has the template's 15 components and one "Design direction" doc. Code reads 2,507 units from the repository. Data has no records. Work has W-8 (closed) and W-9.

## Destinations

The four destinations follow the knowledge strategy's ownership table (`docs/knowledge-strategy.md`): mutable product records go to layers; code-adjacent contracts and operating rules stay in the repository, and Code shows them as Knowledge; tracking goes to Work; history stays in git.

- **Record**: a layer record kind exists (Vision `vision_section`, `brief_claim`, `persona`, `story`, `spec`, `research`; Pages `page`, `flow`, `page_map`; Design `design_tokens`, `component`, `brand_asset`, docs; Data `data_object`, `data_operation`, `access_rule`).
- **Code Knowledge**: stays a repository file, read through Code's Knowledge tab. It **must be searchable** from the portal and from agents (it isn't today, see action 2).
- **Work**: becomes a W-item (open packets, open follow-ups, owner questions).
- **Archive**: historical evidence; stays in git and is linked from the record it supports, not migrated.
- **Gap**: no destination exists yet; action 2 confirms and action 3 schedules it.

## Top-level documents

| Document | Destination | Notes |
|---|---|---|
| `instructions.md` (original brief) | Vision: `brief_claim`s with this file as evidence | Keep the file; claims cite it |
| `docs/product.md` | Vision: `vision_section`s (vision, target group, needs, product, goals), `brief_claim`s, `persona`s (owner with several projects; collaborator from COLLAB-WORK-01) | "Main experience" and "improvement loop" become stories |
| `docs/roadmap.md` | **Gap**: milestones M0 to M4 with gates. Vision's `phase` is a story-map phase, not a delivery milestone | Candidate homes: Work milestones/goals, or Vision `phase` reused. Action 2 decides |
| `docs/execution-plan.md` | Mostly **Archive** (M0 packets done). Phase gates are the same gap as the roadmap. "Packet closure and retrospective" rules go to Code Knowledge (operating rules) | |
| `docs/status.md` | **Work** (the ready queue becomes items; "next action" becomes the board's order). The prose handoffs become Archive. Retire the file at cutover | The biggest behavior change: agents read the board, not this file |
| `docs/decisions.md` | **Gap**: no decision record kind. 68 decisions are cited by ID everywhere | Needs a home that keeps IDs (DEC-n) and supersession. Open questions become Work needs or items |
| `docs/research.md`, `docs/evidence/r-0*`, `docs/software-factory-context.md`, `docs/tool-ecosystem.md` | Vision: `research` records (with access dates kept) | Large evidence files stay Archive and are linked |
| `docs/architecture.md`, `docs/knowledge-strategy.md`, `docs/product-system-framework.md` | Code Knowledge | Code-adjacent; data-model parts also feed Data (see below) |
| `docs/system/*.json/md` (capability catalog, allocations) | Code Knowledge now; Data later | `the-machine.json` names the old project; update when it retires |
| `docs/guides/*`, `docs/references/launch-lms-case-study.md` | Code Knowledge | |
| `AGENTS.md` | Stays in the repository (Code Knowledge) and is **rewritten at cutover**: read the item and the layers through the MCP, not `docs/status.md` | |
| `notes.txt` | Owner's file; ask | 2 lines |

## Design folders

**Open packets** become **Work** items. Each gets a short brief linking its work record, which stays in the repository as Code Knowledge until the packet closes. Then it moves to Archive.

| Folder | Packet | Destination |
|---|---|---|
| `agent-work/` | AGENT-WORK-01 (dogfood attempt 2 pending) | Work. Findings F1, F3 and F15 (future) become items |
| `collaborator-work/` | COLLAB-WORK-01 (CW-2 to CW-6) | Work |
| `deploy-hosting/` | DEPLOY-HOST-01 | Work (DH-6 needs owner questions Q-4 and Q-5) |
| `existing-projects/` | EX-02A C5, EXISTING-PROJECTS-01 | Work. **C5 deletes `the-machine`: it must follow the migration of its records** |
| `layer-app-transition/` | T03-CODE follow-through, LAT-08A, LAYER-GITHUB-01 (`github-publication.md`) | Work. Completed briefs become Archive |
| `layer-bindings/` | step 4 (F10) and follow-ups F4 to F8 | Work |
| `platform-pipeline/` | PLATFORM-PIPELINE-01 | Work |
| `lay-05/`, `work-agents/` | LAY-05, B-03B, WORK-AGENTS-01 | Work. Likely partly superseded by AGENT-WORK-01; action 3 checks before making items |
| `journeys/` | JOURNEYS-01 J8 live journey and retrospective | Work (one item) |
| `biome-review/` | Biome Work #3 | Work, or dismiss (old project) |
| `layer-framework/`, `portal-layers/` (proposed docs) | LAYER-FRAMEWORK-01, knowledge research | Code Knowledge (design rationale); items only where a next step is named |
| `pages-layer/`, `platform-layer/`, `design-layer/` | PAGES-UX-01, PLATFORM-UX-01 owner reviews | Work (owner-review items) |

**Product design of the portal itself** goes to **Pages** and **Design**:

| Source | Destination |
|---|---|
| Current portal UI (Home, the eight layers, item page, board, Knowledge, onboarding, connect repository) | Pages: one `page` per real screen, `flow`s for the journeys in `.aludel/outputs/journeys.json`, `page_map` |
| 37 HTML prototypes (`*/v*/index.html`, `prototypes/`) | Pages: attached to the page each one explores, as a viewable prototype. **Gap**: whether a page can carry or serve an HTML prototype (action 2) |
| Accepted compositions (`work-item`, `work-redesign`, `layer-knowledge`, `existing-projects`, `agent-work/a0`) | The matching page's current design, with the prototype version linked |
| Superseded prototypes (`project-workspace/v1–v9`, `portal-system`, `portal-foundation`, `self-change`, `layer-app-trial`) | Archive, linked from the page they led to |
| `experience-foundation.md`, `design-system-strategy.md`, `portal-visual/`, `process/aludel-brand-work-record.md` | Design: the Design direction doc, `design_tokens` (the portal's real MD3 tokens, not the template's), `brand_asset`s |
| Portal's own components (`apps/portal/src`) | Design `component`s. The 15 template components describe an Angular Material app, not this portal; replace or re-bind them |
| Screenshots (`*/shots`, `*/refs`, 594 images) | Archive. Only images a record cites are attached (asset storage is a gap to check) |

**Data**:

| Source | Destination |
|---|---|
| `product.md` "Product information model", `architecture.md` data sections, `portal-layers/knowledge-structures.md`, the portal's SQLite schema | Data `data_object`s, `data_operation`s, `access_rule`s. **Gap**: Data offers no API operations, so nothing can be staged there yet |

**Process** (`docs/design/process/`, `product-development-workflow.md`):

| Source | Destination |
|---|---|
| `operating-procedure.md`, `work-record-template.md`, `interaction-placement.md`, `test-project-rotation.md`, `design-system-profile-template.md` | Code Knowledge (operating rules). The work-record template has to change: the item replaces the work record for new work |
| `portal-operator.md` (DEC-029 interim) | Retire at cutover; the item flow replaces it |
| Intakes and dry runs (`b-0*-intake`, `d-01*`, `r-07c-dry-runs`, GitHub setup records) | Archive |

**Archive outright** (closed, kept in git): `docs/evidence/**` (56 folders), `demo-app/borrowbox.md` (fixture: keep as Code Knowledge if tests use it), `layer-repositories/`, `layer-scoped-work/`, `code-tracing/` (deferred), `project-workspace/`, `portal-foundation/`, `portal-system/`, `self-change*`, `product-and-plan/` (accepted; its claims feed Vision), `spikes/`, `integrations/symphony` (code, stays).

## The built-in project

`the-machine` holds the portal's earlier Vision, Pages and Work records and a document import. Some of the Vision and Pages content above may already exist there as records. Copying them, with IDs and history, beats re-entering them from Markdown. Two consequences:

1. Action 2 needs a read of `the-machine` (the owner's portal, or a backup copy) to see what is there.
2. EX-02A C5 (delete `the-machine`) must be sequenced **after** the migration, not before.

## Gaps found (confirmed or ruled out by action 2)

1. Repository docs are not searchable through `search_knowledge` (already observed: "status" and "decision register" return nothing).
2. No decision record (IDs, status, supersession, links).
3. No milestone or phase-gate record for the roadmap.
4. Pages may not carry or serve an HTML prototype or images.
5. Data has no API operations.
6. Work items can't be created by an agent except as proposals from an action (the expected owner control, but bulk migration of about 19 packets needs a batch path).
7. `the-machine`'s records can't be read from Aludel Workshop, and there is no project-to-project copy.
8. Actions have no description field (known, F15). Item briefs and work records duplicate each other.
