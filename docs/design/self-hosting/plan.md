# W-9 action 3: plan for managing Aludel from inside the portal

Item W-9, action 3, 2026-10-06. Built from [the inventory](inventory.md) (where each source should go) and [the readiness probe](readiness.md) (what the portal can hold today). The owner reviews this at the Assess gate; action 4 then proposes the items below.

## Target

From **Monday 2026-10-12**, the owner manages Aludel only from the portal for one week:

- every new piece of work is a W-item;
- every question to the owner is a need on an item;
- every record of intent, design or decision is read and changed in a layer;
- no one edits `docs/status.md` or `docs/decisions.md`.

The repository keeps code, code-adjacent docs and history. The portal is where that knowledge is found.

**Cutover criteria** (checked at the end of the trial week):
1. The owner kept a fallback log. Every time they or an agent had to open a repository doc folder to find something the portal should have shown, it's a line. Pass: no line blocked work, and each line has a follow-up item.
2. Agents found what they needed through `search_knowledge` and `read_record`: decisions by ID, the open backlog, product intent and the operating rules. Checked by asking a fresh agent the five retrieval questions from `docs/knowledge-strategy.md` and recording the answers.
3. `docs/status.md` and `docs/decisions.md` have no commits during the week.
4. Nothing was lost. Every inventory row is either migrated, readable as Code Knowledge, or archived with a link.

## Order

Before the cutover, the work is what makes the portal **findable** and the backlog **runnable**. Prototype hosting, Data and the design-system records can follow the cutover, because their sources stay readable in Code Knowledge meanwhile (the fallback log will show whether that's true).

```
 I1 Search ───────────┬──> I4 Vision ──┐
 I2 Decisions ────────┤                ├──> I6 Cutover ──> I7 Trial week + retro
 I3 the-machine ──────┼──> I5 Backlog ─┘
                      │
 after cutover:  I8 Prototypes on pages ─> I9 Pages migration
                 I10 Design records    I11 Data API ─> I12 Data migration
                 I13 Working-model fixes (typed schemas, scratch stage, Work as a layer)
```

## Items

| # | Item | Layer | Before cutover | Depends on | Done when |
|---|---|---|---|---|---|
| I1 | Search all project knowledge | Code | yes | none | `search_knowledge` covers repository Knowledge files, work items and every record kind, and searches body text. Live checks: "status", "DEC-062" and "operating procedure" each return the right result |
| I2 | Decision records | Vision (proposal; owner choice Q1) | yes | none (I1 indexes it) | A `decision` kind with ID (keeps DEC-n), status (confirmed, superseded, waived, open), supersedes, links, and open questions as `open`. All 68 decisions and Q-003, Q-005 and Q-008 migrated. `docs/decisions.md` becomes a pointer |
| I3 | Move the-machine's records | Code + all layers | yes | none | The owner (or an agent with a scoped read) lists the-machine's records. Owner choice per group: migrate with IDs, or drop. A copy path keeps IDs. EX-02A C5 is re-ordered after this item |
| I4 | Vision from the product docs | Vision | yes | I2, I3 | Vision sections, brief claims (with `instructions.md` as evidence), personas, research records (with access dates), and phases from the roadmap (owner choice Q2) |
| I5 | Backlog into Work | Work | yes | I3 | One item per open packet from the inventory, with dependencies, linking its work record. Superseded packets (LAY-05, WORK-AGENTS-01, B-03B against AGENT-WORK-01) are confirmed by the owner, not migrated blindly |
| I6 | Cutover | Code | yes | I1, I2, I4, I5 | `AGENTS.md` rewritten: start from the item and the layers through the MCP; record work on the item, not in a work record; fold the status-writing rules into the board. `docs/status.md` becomes a one-line pointer. The work-record template is used only for packets that predate the cutover. The DEC-029 interim procedure is retired (a decision record) |
| I7 | Portal-only trial week | Work | (the trial) | I6 | Criteria 1 to 4 above, recorded, with a retrospective. Owner accepts or names what's missing |
| I8 | Prototypes on pages | Pages | after | none | A page can carry prototype versions (HTML and images) that the portal serves, with one marked current |
| I9 | Portal's pages into Pages | Pages | after | I8 | A page per real portal screen, flows from `.aludel/outputs/journeys.json`, the page map, and accepted prototypes attached. Superseded ones are linked as history |
| I10 | Portal's design system into Design | Design | after | none | The portal's real tokens, brand and components replace the template's 15 Angular Material components; the design direction doc is written from `experience-foundation.md` |
| I11 | Data operations reachable from items | Data | after | LAYER-GITHUB-01 or a Data API | An item can stage Data objects, operations and access rules |
| I12 | Portal's information model into Data | Data | after | I11 | Objects and operations from `product.md`, `architecture.md` and the server schema |
| I13 | Working-model fixes found by W-9 | Code | after | none | `describe_operation` gives Vision's and Design's fields (P3); a probe can stage and withdraw (P1); actions can name Work (P2) |

## Existing packets this changes

- **EX-02A C5** (delete `the-machine`): moves after I3. This is the only re-ordering that protects data.
- **AGENT-WORK-01 dogfood attempt 2** and **COLLAB-WORK-01**: unchanged. They become W-items in I5 and run in the portal like everything else.
- **LAYER-GITHUB-01**: also unblocks I11.

## Questions for the owner (at this gate)

- **Q1. Where do decisions live?** Proposal: a `decision` record in Vision (the Plan layer). The alternative is a project-level record outside any layer. This changes which template gets the new kind.
- **Q2. Roadmap milestones.** Keep M0 to M4 as Vision phases (with gate criteria as notes), or re-plan the remaining work as `demo`, `mvp` and `later`?
- **Q3. Is the target date Monday 2026-10-12?** I1 to I6 are about a week of agent work if each lands first time. If the date is fixed, the fallback log makes the gaps visible rather than delaying the start.

## Process

- **Process change already applied.** Assessment ran as an item with a gate: inventory, then probe, then plan, with the owner reviewing before any items exist. This is the operating procedure's readiness verdict, carried by the item instead of a separate work record. Evidence: these three files and the item thread. Whether it saves time over a work record is unproven until W-9 closes.
- **Process change proposed (I6).** The item replaces the work record for new work. Until I13, the brief has to carry the detail actions can't (F15).
- **Hypothesis.** The fallback log (criterion 1) is a dependable measure of "managing from the portal". It's tested in I7.

## Readiness verdict

Ready to propose items I1 to I13 once the owner has answered Q1 to Q3 or accepted the proposals. Nothing in I1 to I7 needs spending, external accounts or public deployment. I3 needs the owner (or a scoped read the owner grants) to see `the-machine`.
