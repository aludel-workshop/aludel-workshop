---
id: roadmap-01-evidence
kind: evidence
status: accepted
updated: 2026-09-24
depends_on: [roadmap-01]
---

# ROADMAP-01: Vision, evidence, Library and the plan: build evidence and retrospective

The owner accepted prototype v3 with final tweaks and authorized the build (DEC-043). The design, research and review history are in [the work record](../design/product-and-plan/work-record.md). This file records what was built, how it was checked, and what the work taught.

## What was built

| Packet | Built |
|---|---|
| RB-1 Colour, nav, chips | One colour per layer in a rainbow down the rail: Home red, Vision orange, Design amber, Pages green, Data teal, Platform blue, Work violet, Library purple, Settings grey (each at least 4.5:1 on its tint and on white). Tile nav (a tinted tile per layer; the active row takes the tint and the tile goes solid). Page eyebrow and tab underline in the layer's colour. Tabs carry their records' icons. Product shows as **Vision** at `/vision/…` (the internal layer key stays `product`, so stored items and actions don't migrate; old `/product/…` links redirect). The existing reference chip and quick view now cover claims, insights, findings, sources, projects, milestones, activities, personas and documents. A compact chip shows a handle (S6, P-7, "Problem") with the full name as its accessible name |
| RB-2 Brief | `brief_claim` records in Lean Canvas order; add, edit and delete inline in every section; personas under Customers; an optional Business model section; riskiest assumptions (unproven or contradicted claims in Problem, Customers, Diagnosis and Value, contradicted first); **Draft** and **Test this** create backlog items for the Vision role's actions. Older vision sections migrate once into claims. New projects start the Brief from the pitch. Principles for agents come from the Brief |
| RB-3 Evidence and Library | `source`, `finding` (quote, fact or data), `insight` (strength, tags, findings, comments) and `evidence_link` (supports or contradicts) records. One evidence chip everywhere (icon, label, a number when more than one; a split chip with icons and numbers when both ways) and one evidence panel to attach and detach. A story's evidence includes its problem claim's ("through its problem"). Library: insights with keyword, layer, tag and sort filters; an insight page (title, strength, tags, findings, comments, where it's used); sources; a source page where selecting a passage makes a finding, plus a form for typed findings and data tables (bar chart with a table). Research records migrate once into sources, findings and evidence. Deleting cleans up: evidence on a deleted record goes; a deleted finding leaves its insights; a deleted source takes its findings |
| RB-4 Documents | `doc` gains `form` (written or generated), `generator`, `briefRevision` and `agents`. A PR/FAQ or one-pager is composed from Brief claims, citing each claim as a chip. It shows "N Brief changes since" and can be regenerated (the earlier version stays as a revision). Written documents are edited in Markdown. Documents marked "Agents read this" join every run's context |
| RB-5 Plan | Milestones (phases gain a target date; goal, done-when, target and current are edited under Work › Projects). `project` records: brief (problem, solution, rabbit holes, no-gos, requirements), stories, lead, status, health, optional dates, dependencies with no cycles, token budget with spend from runs, checkpoints. The plan is seeded once: specs become projects, the playbook adds foundations (`config/playbooks.json`), and the story map gives one project per activity and milestone. Items carry a plan project and checkpoint (`plan_project_id`; see "found during the build"). **Items**: a Linear-style list, grouped and filtered, where a row opens a side panel. **Projects**: a Linear-style timeline (projects only; names above neutral bars; today on the axis; milestone targets; checkpoints; red dashes past target; optional dependency lines; drag to move or resize, saving on release; keyboard route via the date fields) and a list; a project page after Linear's. **Next** split chip on each batch |
| RB-6 Roles and Team | Actions gain `elevated` (a shield toggle on Roles). Every role has a review action; the Work role is now Project lead (shape projects, dates and budgets, milestone check, final project review). Roles record their people as members or leads; the owner leads every role by default. Accepting review on an elevated item needs a lead of its role or the owner. Elevated actions default to a person, whatever the working-style preset. Team = People (access, role chips in layer colour, shield for a lead) + the Agents section unchanged |

## How it was checked

All checks are agent-run. Owner acceptance of the built layers is pending.

- **Server:** `npm run test:server` passes 69/69, including six new tests in `tests/roadmap-01.test.mjs`:
  - Brief migration and principles for agents;
  - evidence integrity and clean-up;
  - generated documents going stale;
  - plan seeding (once, idempotent, no duplicate names), dependency cycles and date order;
  - the Next rule (priority, then age; skips blocked items, backlog items and later milestones);
  - elevated permission (a non-lead is refused with 403; a lead may accept).
- Two existing tests changed for intended changes: a fifth default routine (milestone check), and the pitch now starts the Brief rather than a vision section.
- **Types and build:** typecheck clean; `npm run build` passes.
- **Browser:** `tests/layers-browser.mjs` now also drives:
  - Brief claims, editing and personas;
  - a Library source, a typed finding making a new insight, a keyword search, a tag and a comment;
  - attaching an insight that contradicts a claim, so its chip turns Contradicted;
  - a story's why linked to a Brief claim;
  - a PR/FAQ generated, marked for agents, going out of date after a Brief edit, then regenerated;
  - the old `/product/specs` link landing on "This moved";
  - the shield toggle;
  - project dates and a story added to a project's brief;
  - the Items side panel;
  - Next with a count of 1;
  - Team.
- Axe is clean on every checked page, and no page overflows at 390px across 18 paths, including `/vision`, `/library`, `/work/items`, `/work/projects` and `/work/team`.
- `onboarding`, `product`, `brand`, `github` and `workflow` pass. `tests/browser.mjs` fails at its known decision-conflict step, as it did before this work.
- **Looked at, not only tested:** screenshots of every new page with realistic data (Brief, story panel, documents, Library, insight, source, evidence panel with chart, Items and panel, Projects timeline and list, project page, Roles, Team, Board). This caught issues the scripts didn't:
  - the missing template-outlet import (the Brief would have rendered empty);
  - selects bound with `[value]`, which showed the first option instead of the saved one;
  - a chart with no bar heights;
  - findings squeezed one word per line;
  - an icon missing from the font subset;
  - three class collisions (`lay-seg`, `lay-ev`, `lay-comment`) found with `tools/css-collisions.mjs`;
  - duplicate project names.
- **Timeline drag in the real app:** a bar dragged 84px at month zoom moved 7 days, saved, and did not navigate.
- **Migration on a copy of real data** (`.data/machine.sqlite` with its WAL), by running the start-up steps against the copy:
  - repeatable (a second run changes nothing);
  - every open item lands in a plan project;
  - all 50 items keep the Aludel project that owns them;
  - every project loads.

## Found during the build (and fixed)

- **Column name clash:** `layer_work_items.project_id` already means the Aludel project that owns an item. The first version of the plan column reused the name, so assigning an item to a plan project would have moved it to another Aludel project. The new domain test caught it before any real data was touched. The column is `plan_project_id`, and every update is also scoped by the owning project.
- **Record-kind clash:** every record already has `kind`. A source's kind and a document's kind would have overwritten it, so they are `type` and `form`.
- **Pre-existing crash:** stories saved before `services` existed made `view()` throw, so the "Mariachi Madness" project could not load. This was found by the migration trial on real data, and `view()` now treats a missing list as empty. The same code was in the last commit.

## Limits

- Sources take links and pasted text. Uploading screenshots and files comes later.
- Generated documents are composed from templates, not drafted by an agent.
- Permissions matter only with more than one person. Inviting people is not built; Team says so.
- Dragging bars and highlighting passages need a mouse. The keyboard routes are the project date fields and the typed-finding form.
- A project started from onboarding is planned the first time its layers open. If the server restarts mid-onboarding, before story packs are chosen, it is planned with the playbook only; later activities need projects added by hand.
- The internal layer key is still `product`: stored items, actions (`product.define`) and the role say "Product lead".

## Retrospective

1. **What made the work harder, slower or more error-prone than necessary?**
   - *Observed:* two naming collisions in stored data (`project_id`, `kind`) and three CSS class collisions.
   - The first was dangerous: nothing in the knowledge module says which column names are taken, and the SQL `INSERT` silently accepted a repeated column.
   - Angular's `strictTemplates` did not flag a missing `NgTemplateOutlet` import, and `[value]` on selects looked right in code but not on screen. Only the screenshot pass found them.
   - A broad `pkill -f` during testing matched its own shell. It stopped nothing else, but it could have stopped the owner's portal.
2. **What would make the next equivalent task easier?**
   - A short "reserved names" note at the top of the knowledge module (record fields `id`, `kind`, `parentId`, `revision`; work columns `project_id`, `number`).
   - A test that inserts every kind and checks `kind` survives.
   - Running `tools/css-collisions.mjs` before the first screenshot, not after.
   - Stopping test servers by recorded PID only.
3. **What does it change downstream?**
   - LAY-05 (coding agents) can now pick "what next" from projects, and should enforce elevated actions for agents. Today they are enforced at review, which is enough while agents only draft.
   - LAY-06 (Aludel inside itself) can map `docs/` onto Vision documents and Library sources.
   - Specs remain as records only so migrated projects can point back to them.
4. **Questions created or resolved.**
   - Resolved: where specs live (project briefs), what a document is for (anchored to Vision, optionally read by agents), and how permissions scope (member or lead per role, the shield per action).
   - Open, for the owner's review of the build: is claim confidence useful day to day, and does "Next" remove hand-staging in practice?
5. **Process change applied now, how tested, what remains a hypothesis.**
   - The purpose test (with its overlap question) and "borrowed or invented" were applied through v3 and this build, in the operating procedure. The v3 review had no "what's the point of this?" feedback, and the Linear-based screens were accepted ("better, we can work with that").
   - Still a hypothesis: that these checks prevent the same misses on a different kind of task.
   - **Applied now:** the implementation plan's pre-handoff checklist gains the reserved-names check and PID-only server stops. It is untested beyond this task.

## Owner acceptance (2026-09-24)

Owner, after using the build: "alright, i like it. mark done." (DEC-044.) Accepted for this stage. Later UX passes may still refine these screens.
