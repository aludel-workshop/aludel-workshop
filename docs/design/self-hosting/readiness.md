# W-9 action 2: can the layers and Knowledge hold Aludel's knowledge?

Item W-9, action 2, 2026-10-06. Tests each destination from [the inventory](inventory.md) against the live API (through the MCP from W-9's item container) and the code on `aludel/w-9`.

**Method and its limit.** Phase 1 promised no record changes, and a staged change would be applied when the item closes. So no samples were staged. Each destination was tested by reading the live layer, its operation schema (`describe_operation`) and the code behind it. "Works" therefore means the schema accepts the shape. A real write is first tested by the first migration item, which is why the plan puts a small sample migration first.

## Results

| # | Destination | Result | Evidence |
|---|---|---|---|
| 1 | Search over everything | **Gap** | `search_knowledge` (`apps/portal/server/editor-bridge.mjs:174`) scans database records of 13 kinds: `brief_claim`, `story`, `spec`, `page`, `doc`, `research`, `source`, `finding`, `insight`, `data_object`, `data_operation`, `component`, `project`. It matches substrings of title, name, label, text, description, body and summary, and returns at most 30. It **does not cover**: repository files (all Code Knowledge, `AGENTS.md`, work records), work items, `vision_section`, `persona`, `flow`, `design_tokens`, `brand_asset`. Live check: "status" and "decision register" return nothing; "Button" finds components |
| 2 | Vision brief, claims, personas, stories | **Works (schema untyped)** | The operations exist (`setVisionSection`, `createBriefClaim`, `createPersona`, `createStory`). `describe_operation` returns only `Input: "A record's fields"` for Vision and Design writes, so an agent can't see the fields before staging and has to work them out by trial |
| 3 | Vision research | **Works (schema untyped)** | `createResearch` exists; same untyped schema |
| 4 | Roadmap milestones and phase gates | **Partial** | Vision `phase` records drive the current milestone (`agent-runs.mjs:157`, `phase.current`), and `project` records carry a milestone. The catalog defaults to `demo`, `mvp` and `later`. M0 to M4 could become `phase` records. Gate criteria and gate evidence have no field. Owner choice: keep M0 to M4 or re-plan as phases |
| 5 | Decisions (DEC-001 to DEC-068) | **Gap** | No `decision` kind anywhere in the server or layer templates. Nothing holds an ID, status, supersession or links |
| 6 | Pages for the portal's screens | **Works** | `createPage`: label (≤30), icon and pageType from catalogs; sections, links, states and 4,000-char notes. The icon catalog lacks layer icons such as `code` and `lightbulb`, so some pages get a near match |
| 7 | HTML prototypes and screenshots on pages | **Gap** | The `Page` schema has no prototype, attachment or URL field. A section `image` is a record ID with no upload path through the API. The 37 prototypes can only be linked as text in `notes`, which points at a repository path the portal doesn't serve |
| 8 | Design direction, tokens, brand | **Works (untyped)** | `setTokens`, `createBrandAsset` and `createComponent` exist; a `doc` "Design direction" record already exists. The template's 15 components describe Angular Material, not this portal (inventory) |
| 9 | Data objects, operations, access | **Gap** | Data's outputs are files in its layer repository (`outputProvider: layer-files`; `outputs/openapi.json` with empty `paths`). It has no API operations, so `stage_change` can't reach it. That layer repository isn't on GitHub (LAYER-GITHUB-01 pending), so an item container can't commit to it either |
| 10 | Code Knowledge (repository docs) | **Partial** | The owner can read repository docs in Code › Knowledge (T03-CODE). Agents read them as files in the checkout. Neither path searches them (row 1) or links them to records |
| 11 | Work: about 19 open packets as items | **Partial** | Agents create items only through `propose_items` from a working action, and the owner creates each one. That is the right control, and about 19 proposals is workable. There is no bulk import that keeps packet IDs (for example AGENT-WORK-01) or the dependency order between items already created |
| 12 | Owner questions (Q-003, Q-005, Q-008, Q-4, Q-5) | **Partial** | An item's `needs` (ask, request_allow) hold a question for one item. A project-wide open question has no home (same gap as decisions) |
| 13 | Records in `the-machine` | **Gap** | The editor token is scoped to one project, so W-9 can't see them. There's no project-to-project copy that keeps IDs. EX-02A C5 deletes them |
| 14 | Status and next action | **Works** | The Work board (columns, priority and order) can replace `docs/status.md`'s ready queue and `next_action`. The prose handoff and evidence links move to the items |

## Gaps, ranked by what they block

1. **Search (row 1).** Blocks the goal outright: if agents and the owner can't find a doc from the portal, managing from the portal fails even when nothing is lost. Index repository Knowledge files, work items and the missing record kinds; search body text.
2. **Decisions (rows 5 and 12).** 68 decisions are cited everywhere, and AGENTS.md makes them gates. Needs a record kind with stable IDs (keep DEC-n), status (confirmed, superseded, waived), links, and open questions.
3. **`the-machine` migration (row 13).** It must be read and moved (or deliberately dropped) before C5 deletes it.
4. **Prototypes and assets on pages (row 7).** Without it, Pages can't show the design history that justifies the current screens.
5. **Data API (row 9).** Data can't be migrated by an item until Data has staged operations or its repository is reachable.
6. **Typed write schemas (rows 2, 3 and 8).** `describe_operation` should give Vision's and Design's fields. Otherwise every migration item works them out by trial.
7. **Milestones and gates (row 4).** Small: an owner choice plus gate fields.

## What this means for the plan

The portal is ready to receive Vision, Pages and Design records and to run the backlog from Work. It isn't ready to replace the docs folders, because nothing outside a few record kinds is findable and decisions have no home. So the plan's order is search and decisions first, then the migrations, with `the-machine` read before any deletion.

## Process findings for the working model

- **P1. Safe probing.** A probe that stages a sample will apply it at close-out. Assessment actions need a scratch stage, or a way to withdraw a staged change, so a readiness test can make a real write without changing the project.
- **P2. Work isn't a layer** (rejected as an action's layer in `define_work`). Actions whose output is items have no layer to name.
- **P3. Untyped schemas** (above) slow every agent write in Vision and Design.
