---
id: roadmap-01
kind: work-record
status: accepted
updated: 2026-09-23
depends_on: [portal-layers-model, portal-layers-knowledge-research, portal-layers-knowledge-structures, work-ux-01]
---

# ROADMAP-01: product definition, evidence and the plan

## Authorization and scope

- **Owner instruction (chat, 2026-09-23):** broaden ROADMAP-01 from "an action-based roadmap" to the whole Product layer and to project management: "just research and propose implementation for now." (DEC-029 interim chat authorization.)
- **Authorized now:** primary-source research, this record, and a proposed record model, navigation and packets.
- **Excluded:** portal code, data or schema changes, prototypes, provider calls, spending and external writes. Nothing here is decided until the owner answers §7.
- **Supersedes, if accepted:** the Product tabs from [knowledge research](../portal-layers/knowledge-research.md) §2 (Vision, Roadmap, Specs, Research, Docs) and the "Research lives in Product" inference there. Story map, story status derivation, story packs and DEC-041's Work model stay as they are.

## Owner brief ledger

| # | Ask (condensed) | Position | Answered in |
|---|---|---|---|
| R1 | Roadmap and specs have no clear shape and may not belong in Product; Product is founder work ("what it's all about") | Owner leaning: they leave Product | §5.1, §6 |
| R2 | A strong, industry-proven, structured approach to defining a web app product | Required | §3.1, §5.1 |
| R3 | The Vision tab lacks rigor | Required | §5.1 (Brief) |
| R4 | Story map: leave it largely as is | Keep | §5.1 |
| R5 | Research is not a tab. Evidence attaches where it's referenced (possibly several places), with links, images, extracted insights and maybe data or charts. Maybe one home for all of it, as a tree? | Required; home is an open question | §5.2 |
| R6 | Docs: what's the point of an untethered document? Everything must exist for a reason | Required | §5.3 |
| R7 | Should the vision itself be a tree with a meaningful taxonomy? | Open question | §5.1 (fixed canvas plus opportunity tree) |
| R8 | Research what tools solve similar problems, their approach, and where this work usually happens | Required | §3 |
| R9 | Project management needs its own role, whether or not it's its own layer | Required | §6.5 |
| R10 | Roles and routines are project management | Owner position | §6.4 |
| R11 | Assigning work to batches or sprints is project management too | Owner position | §6.3 |
| R12 | Would a structure showing what happens when (a Gantt chart?) replace manual batching? | Open question | §6.2, §6.3 |
| R13 | Keep the simpler stack view for Home? | Open question | §6.4 |
| R14 | Do we ever need to batch by hand from an unstructured stack, or is moving between batches and assignees enough? | Open question | §6.3 |
| R15 | Rename "batch" to a project-management term | Open question | §6.3 |
| R16 | Project management belongs under Work, not Product | Owner's final position | §6 |
| R17 | Roadmap covers everything: foundations to get the project running, pages to design before MVP code, and so on. The "bigger structure around work" | Required | §6.1, §6.2 |

## 1. What this task reveals about the process

- **Weakness observed:** LAY-01 added Product tabs by mapping frameworks to containers (Research ← OST, Docs ← owner request, Specs ← Spec Kit, Roadmap ← Patton). No tab was checked for **who produces it, who consumes it, and what record it hangs from**. Two of the six tabs (Research, Docs) now fail that question in the owner's own words. Specs failed it more quietly: nothing says at what level a spec is used, so the owner "is not sure what the specs are".
- **Change applied now:** a *purpose test* for any new tab, record kind or container, added to [operating procedure §2](../process/operating-procedure.md#2-inventory-evidence-for-the-proposed-scope). It must name its producer (a role action), its consumer (an action or view that reads it) and its anchor (the record it belongs to), or be a derived view. §4 applies it to today's Product tabs, and the proposal is built from that result.
- **How it will be evaluated:** at owner review, see whether the proposal's containers survive without "what's the point of this?" feedback. Also check whether LAY-05's first agent runs actually read what the test says they consume. Until then this is a hypothesis.

## 2. Where this work usually happens (the landscape)

| Where | Typical tools | Shape |
|---|---|---|
| Strategy and definition | Lean Canvas, Product Vision Board, Notion or Google Docs, Miro | One page or canvas, rarely linked to anything downstream |
| Discovery and evidence | Dovetail, Condens, Glean.ly, Productboard insights, Jira Product Discovery | Raw sources → highlights → insights, **linked to ideas or features** |
| Opportunity structure | Vistaly, ProductPlan, Miro (OST and impact-map templates) | Trees from outcome to solution |
| Planning | Linear, Jira Plans, GitHub Projects, Shape Up (Basecamp) | Initiatives → projects → milestones → issues, with a timeline and dependencies; cycles for the near term |
| Agent specs | GitHub Spec Kit, Kiro, BMAD | Spec per feature → plan → tasks traced to stories |

**Inference:** no mainstream tool joins these. Founders stitch a canvas in one place, evidence in another, and a Linear board in a third. Aludel's advantage is that every layer's records already link, so evidence and plans can attach to the real records instead of to copies.

## 3. Findings

All sources accessed 2026-09-23. **Fact** marks what a source states; **Inference** marks our conclusion.

### 3.1 Structured product definition

| Framework | Fact | Inference for Aludel |
|---|---|---|
| [Lean Canvas](https://gonogo.team/lean-startup-canvas) (Maurya, 2010) | Nine boxes: Problem, Customer Segments, Unique Value Proposition, Solution, Channels, Revenue Streams, Cost Structure, Key Metrics, Unfair Advantage. It is "a hypothesis log": rank assumptions by risk and test the riskiest first. The fill order starts with Problem and Customer Segments together | The best-proven one-page structure for **early-stage web products**, which is Aludel's audience. Its rigor comes from treating each box as an assumption with a risk, not from more fields |
| [Rumelt's kernel](https://www.alexmurrell.co.uk/summaries/richard-rumelt-good-strategy-bad-strategy) | Diagnosis, guiding policy ("an approach that rules things out"), coherent actions. "Without diagnosis there is no strategy" | Our Vision has no diagnosis (why now, what's in the way) and no policy that rules things out. No-gos half-cover it |
| [Product Strategy Stack](https://www.lennyspodcast.com/blog/summary-how-to-build-your-product-strategy-stack-ravi-mehta-tinder-facebook-tripadvisor-outpa/) (Mehta) | Mission → strategy → product strategy → roadmap → goals. It "unbundles" goals, roadmap and strategy, and works top-down to define and bottom-up to debug | Supports R1: the roadmap is a *different kind* of thing from strategy. It sits downstream and should cite strategy, not live beside it |
| [Opportunity Solution Tree](https://www.producttalk.org/opportunity-solution-trees/) (Torres) | Outcome (a *product* outcome: customer behaviour) → opportunities, nested parent/child from interview stories → solutions → assumption tests | The genuine **tree** in product definition (R7). It turns "why it matters" on a story from free text into a link to a need that has evidence |
| [Impact mapping](https://www.impactmapping.org/about.html) (Adzic) | Why (goal) → Who (actors) → How (behaviour change) → What (deliverables). It makes assumptions visible "on two levels" and doubles as a roadmap tool | The same tree seen from goals. Our personas are the Who. Stories are the What |

### 3.2 Evidence and research

| Source | Fact | Inference |
|---|---|---|
| [Atomic research](https://maze.co/collections/user-research/atomic-research/) (Pidcock) | Four atoms: **experiments** (the source: "even just something you heard on the bus"), **facts** (no opinion), **insights** (interpretation) and **recommendations**. Findings can "support or refute each other" | The right unit (R5): evidence is small, reusable pieces, not documents. One fact can back many records |
| [Productboard insights](https://support.productboard.com/hc/en-us/articles/360056354514-Link-feedback-to-feature-ideas-via-insights) | A highlight in a note, linked to any hierarchy level, *is* an insight. Problem-level insights go on higher items, solution-level ones on lower items | Evidence attaches at any level. Here that means a Brief claim, an opportunity, a story, a page, a component or a data object |
| [Jira Product Discovery insights](https://support.atlassian.com/jira-product-discovery/docs/what-are-insights/) | An insight has a description, an optional link and an **impact rating**. Kinds include quotes, tickets, analytics dashboards and articles | Each attachment carries a weight and a direction (supports or contradicts). That's what lets a Brief claim show "assumed" versus "evidenced" |
| [Dovetail](https://docs.dovetail.com/help/highlights) | Raw sources are highlighted and tagged; insights embed highlights to "connect findings back to the raw data" | Keep the raw source (link, file, screenshot) as the root, so any insight traces back to it |

### 3.3 Planning and project management

| Source | Fact | Inference |
|---|---|---|
| [Linear's model](https://linear.app/docs/conceptual-model) | Initiatives ("broader strategic efforts") → **projects** ("group issues together around a shared outcome") → **milestones** inside a project → issues. **Cycles** are "a team's repeating planning period" | A proven, lightweight hierarchy. We need the project level, which we lack today. Cycles assume teams with a cadence; our agents have none |
| [Linear timeline and dependencies](https://linear.app/docs/project-dependencies) | Projects on a timeline with end→start dependencies; violated dependencies turn red | A dependency timeline answers R12 without a full Gantt chart |
| [Shape Up](https://basecamp.com/shapeup/2.2-chapter-08) | A **pitch** (problem, appetite, solution, rabbit holes, no-gos) is bet at a betting table. "There's no 'grooming' or backlog to organize. Just a few good options to consider." A circuit breaker stops a project that runs past its appetite | The pitch is exactly our Spec template, so **a spec is the brief of a project**. This answers "at what level" (R1). The betting table is the owner's Go on a project |
| [Now-Next-Later](https://www.prodpad.com/glossary/now-next-later-roadmap/) (Bastow) | Organises by confidence, not dates. Timeline roadmaps "create false precision" | Agent throughput is measured in runs and review time, not weeks. Order and confidence matter; calendar dates mostly don't |
| [Spec Kit tasks](https://github.com/github/spec-kit/blob/main/templates/tasks-template.md) (from DEC-037 research) | Tasks are grouped by phase and by story, with parallel markers | Items inside a project order by layer dependency (define → design → contract → build) with parallel work where no link exists |

## 4. The purpose test applied to today's Product tabs

| Tab | Producer | Consumer | Anchor | Verdict |
|---|---|---|---|---|
| Vision | Owner (onboarding idea) | Every work item (principles only) | Project | **Rework.** Only principles have a consumer. The other sections are unchecked prose with no evidence state |
| Story map | Owner, Product lead, story packs | Pages, Data, Engineer, Reviewer | Personas and activities | **Keep** (R4) |
| Roadmap | Seeded phases | Home ("current phase") | Nothing | **Move** to Work › Plan as milestones |
| Specs | Product lead "Write specs" | Nothing reads a spec yet | A loose set of stories | **Move**: a spec becomes a project's brief |
| Research | Product lead "Research" | Nobody; `supports` links stories only | One story at most | **Dissolve** into attached evidence |
| Docs | Owner | Nobody | Nothing | **Retire** as a container (§5.3) |

## 5. Proposal, part 1: Product is the definition

**Product tabs: Brief · Opportunities · Story map.** Product answers *what we're building, for whom, why, and how we'll know*. Nothing in it is about when or by whom.

### 5.1 Brief (replaces Vision)

One page in Lean Canvas fill order, extended with the strategy pieces our agents actually use. Each section holds short **claims**, not prose.

| Section | Holds | From |
|---|---|---|
| Problem | Top one to three problems; the existing alternatives people use today | Lean Canvas |
| Customers | Personas, with the early adopters marked | Lean Canvas, Vision Board |
| Diagnosis | Why now, and the crux: what currently stops people | Rumelt |
| Value proposition | One sentence, plus a "X for Y" concept | Lean Canvas |
| Approach | The guiding policy: what we'll do and **what that rules out** (absorbs no-gos) | Rumelt, Shape Up |
| Standout capabilities | Three to five | Vision Board, Lean Canvas "Solution" |
| Outcomes and measures | One product outcome (customer behaviour) and its measure, plus supporting metrics | OST, Lean Canvas Key Metrics |
| Principles | Unchanged: every work item reads them | Spec Kit constitution |
| Business model (optional) | Channels, revenue, costs, unfair advantage. Collapsed for hobby projects | Lean Canvas |

What makes it rigorous is not more sections:

- **Every claim has a confidence:** *assumed*, *evidenced* (it has supporting evidence), *validated* (a test passed) or *contradicted*. It's shown as a quiet marker. Confidence is derived from attached evidence, just as story status is derived.
- **Riskiest assumptions** are a ranked list on the Brief: unvalidated claims in Problem, Customers and Value proposition float to the top, which is Maurya's order. Each can become a research or test item with one click.
- **Completeness is gentle:** an empty section shows its prompt and a "Draft with the Product lead" action. It's never a blocking form.

### Opportunities (the tree, R7)

Outcome → opportunities (needs, pain points and desires, nested parent/child) → capabilities → activities and stories on the map. This is an Opportunity Solution Tree. Its first level comes from the Brief's outcome and customers.

- A story's "Why it matters" becomes a link to an opportunity (free text stays for legacy data).
- Opportunities are where evidence mostly accumulates.
- Is the whole Brief a free tree? **No.** A fixed taxonomy at the top keeps the Brief comparable and complete. Free nesting is used only where the domain really is hierarchical, which is the opportunity space.

### Story map

Unchanged, except that its horizontal bands become **milestones** owned by Work › Plan (§6.1). Product still decides which slice a story is in by dragging it between bands. That is a product decision recorded on the story; the milestone record itself lives in Work.

### 5.2 Evidence: attached everywhere, with one home

A new cross-layer record set, following atomic research:

| Record | Fields | Example |
|---|---|---|
| **Source** | Kind (interview, observation, link, article, competitor, analytics, file, note), title, URL or uploaded file or image, date, who | "Interview with Dana, 2026-09-20", or a competitor's pricing page screenshot |
| **Finding** | Source, one fact (a quote, a highlight or crop of an image, a data point, or a small table with a chart type), no opinion | "Dana: 'I lend my drill and never see it again.'" |
| **Insight** | Statement (an interpretation), the findings behind it, strength | "Lenders fear loss more than they want a return" |
| **Evidence link** | Insight or finding → any record (a claim, opportunity, story, page, component, data object or project), with direction (*supports* or *contradicts*) and weight | Supports opportunity O-3; contradicts the claim "people want to earn money" |

- **Where it appears:** every record gets a small evidence marker ("3 · 1 against") in its Connected rail. It opens a side panel with the insights, their findings and a link to each source. It is subtle, and absent when there's nothing.
- **The home (R5):** a **Library** utility destination beside Search and Settings in the rail, not a layer tab. It holds every source, finding and insight, browsed by source kind or by the layer tree of what it supports. So the tree is **derived from the layer taxonomy**, not a hand-kept folder tree, and nothing needs to be filed twice.
- **Who researches:** every role gets a "Research" action (today only the Product lead has one). A Design lead's competitor screenshots attach to components; an Engineer's benchmark attaches to an Architecture decision.
- **Charts:** a data finding stores its rows and a chart kind (bar, line or table) and renders with the portal's chart styles. This is the last sub-packet and optional.
- **Agents:** a work item's context bundle includes the insights attached to its target records, cited, never the raw sources.

### 5.3 Docs: retire the untethered container (R6)

- Everything a document used to hold has a better home. PR/FAQ, positioning and pricing become **generated narratives** of the Brief: a read-only view and an export that an agent drafts from the structured record. Pasted notes, articles and meeting notes become Library **sources**. Reasoning becomes a record's revision rationale, which already exists.
- **Migration:** each existing `doc` becomes a Library source of kind *note*, with its body kept.
- **What could reverse this:** an owner need for long-form writing that is about nothing in particular, such as a launch plan. That is a project brief (§6.1).

## 6. Proposal, part 2: Work is the plan (R16)

**Work tabs: Plan · Board · Team · Routines.** Team holds Roles and Agents (R10). Work is the only place that spans every layer, so the plan belongs here without breaking the layer order: layers define *what*, Work decides *when and who*.

### 6.1 The hierarchy

| Level | What it is | Replaces | Proven in |
|---|---|---|---|
| **Milestone** | A project-wide checkpoint with a goal, exit criteria and an appetite, such as Demo, MVP or Launch | Product phases (migrated one to one) | Linear milestones, Patton release slices |
| **Project** | A bounded outcome within one milestone that spans layers. Its **brief** is today's spec: problem, appetite, solution sketch, rabbit holes, no-gos, and numbered requirements where it has stories. Projects have dependencies, a lead role and a state (*shaping → ready → in progress → done*, or *stopped*) | Specs (migrated), plus the missing level between "phase" and "item" | Linear projects, Shape Up pitch |
| **Item** | Unchanged (DEC-041), plus an optional project | — | — |

Projects are not only features. A milestone's plan includes the foundations (R17). Examples for Demo:

- "Product brief and first map" (Product)
- "Design foundations" (Design)
- "Core-flow pages" (Pages)
- "Accounts and the borrow request contract" (Data)
- "Preview environment" (Platform)
- "Walking skeleton build"

**Playbooks** seed these projects per milestone, the same way story packs seed stories. Onboarding applies the default playbook, so a new project starts with an **action-based roadmap**, which is the owner's original ROADMAP-01 ask.

### 6.2 How items come from the plan (the action-based roadmap)

- A project's scope is its records across layers: stories, pages, objects and platform tasks. The gap finder we already have (`syncBacklog`) creates its backlog items **inside the project**, one per missing action. Examples: acceptance for S-12, a design for the Borrow page, the `BorrowRequest` contract, a build for S-12.
- Inside a project, items are ordered by the **layer dependency** that is already implicit: define → design → contract → build → review. That order becomes automatic *blocks* links, so a build item is blocked until its story's acceptance and page exist. Items without such a link can run in parallel.
- Across projects, the owner sets end→start dependencies (Linear's model). For example, Walking skeleton is blocked by Preview environment.
- **Views:**
  - **Roadmap** (default): milestones as bands; the projects in each, with progress by layer.
  - **Timeline:** projects in dependency order along an axis, with violated dependencies in red. Target dates are **optional**. Where there are none, the axis is sequence, not calendar.
- **Why not a full Gantt chart (R12):** dates on agent work are false precision, because throughput depends on review time and runs, not days. Sequence plus confidence is what decides "what next". Dates can be added per project when the owner has a real deadline.

### 6.3 Runs replace hand-picked batches (R11, R14, R15)

- **Rename:** "batch" becomes **run**. A *sprint* or *cycle* implies a fixed time box and a team cadence, which neither agents nor a solo owner have. What the owner starts with Go is literally a run. People keep a **list**. Board lanes read "Scout · run R-7" and "Your list".
- **Filling a run comes from the plan:** "Fill" pulls the next ready items for that assignee. Ready means unblocked, in an in-progress project, in the current milestone, ordered by project sequence and then priority. The owner's Go on a project (the betting table) marks it in progress. This replaces DEC-040's "next 10 by priority" over a flat pool.
- **Is manual batching from a flat stack still needed?** Rarely. What stays: moving an item between runs or assignees, skipping one, and "do this next" on any item as an escape hatch (for example an urgent routine finding). Picking items one by one from an unstructured stack stops being the main path.
- **The queue and backlog** stay as Board sub-tabs, now groupable by project.

### 6.4 Home and Team (R10, R13)

- **Home** gets the simple stack view: the current milestone's progress, what's running now (live runs), and Needs you. It links into Plan and Board and has no controls beyond Go and review.
- **Team** holds Roles and Agents (who does what, and how). Routines keep their own tab because they create items on a schedule.

### 6.5 A project manager role (R9)

A second Work role, the **Project lead**, beside the Reviewer. This needs DEC-041's "one role per layer" relaxed for Work only. Its actions:

- **Shape a project:** draft the brief (the spec work moves here from the Product lead).
- **Sequence the plan:** propose dependencies and the order within a milestone. The owner accepts.
- **Fill runs** from the plan (it proposes; Go remains the owner's).
- **Milestone check** (a routine): exit criteria against built status, and what's slipping.
- **Stop at appetite:** flag a project past its appetite (Shape Up's circuit breaker); the owner decides.

The Product lead keeps the Brief, opportunities, stories and acceptance, and gains "Test an assumption".

## 7. Questions for the owner

1. **Dates:** milestones and projects without calendar dates by default, with an optional target date per project. Agree? This decides whether the Timeline is a sequence view or a dated Gantt chart.
2. **Naming:** batch → *run* for agents, *list* for people; phase → *milestone*; spec → *project brief*. Agree, or would you rather have *sprint* or *cycle*?
3. **Business model section** of the Brief: optional and collapsed, or left out entirely for now?
4. **Library** as a rail utility (beside Search and Settings) rather than a layer. Agree?

### Owner answers (2026-09-23, DEC-042)

1. Dates: optional target dates, yes. "timelines get a little weird with agentic development scaling."
2. Naming: keep **batch**; phase → **milestone**, spec → **project brief**. §6.3's "run" rename is withdrawn.
3. Business: optional for now; "an important future layer".
4. Library: in the rail beside Search and Settings.

Then: "go ahead and prototype, i like where you're headed." This authorizes ROADMAP-01P: a local static prototype only, with no portal code, data or schema changes.

## 8. Packets (proposed order)

| Packet | Depends on | Work and output | Check |
|---|---|---|---|
| **ROADMAP-01P** Prototype | Owner answers to §7 | Clickable static prototype with Tool Share data: the Brief with claim confidence and riskiest assumptions; the Opportunities tree; the evidence panel on a story and a page; the Library; Work › Plan (roadmap and timeline); a project page with its brief and items by layer; runs filled from the plan; Home's stack | Owner review per ledger row |
| **PLAN-01** Milestones and projects | 01P accepted | `milestone` and `project` kinds (phases and specs migrated), project dependencies, `projectId` on items, `syncBacklog` grouped by project with layer-order blocks, Work › Plan views, playbooks and onboarding seeding | Migration on a copy of real data; domain tests; layers browser flow; axe and 390px |
| **PLAN-02** Runs from the plan | PLAN-01 | Rename batch → run; Fill from the plan; the Project lead role; Team tab; Home stack | Server tests on fill order and blocked items; browser flow |
| **PROD-01** Brief and opportunities | 01P accepted | `brief_claim` (section, confidence) and `opportunity` (tree) kinds; Vision sections migrated; story "why" links to an opportunity; the Brief and Opportunities tabs; riskiest-assumption actions | Migration; domain tests; browser |
| **EVID-01** Evidence and Library | PROD-01 | `source`, `finding`, `insight` and `evidence_link` kinds with uploads; the evidence panel on every record; the Library utility; Research actions for every role; research and doc records migrated; insights in context bundles. Charts come last | Domain tests; browser, including evidence on records in three layers |

**Recommended order:** 01P, then PLAN-01 and PLAN-02 (the owner's current pain, and it unblocks LAY-05's "what does the coding agent do next"), then PROD-01, then EVID-01. PROD-01 and EVID-01 could go first if product definition matters more right now. That choice changes nothing structural.

## ROADMAP-01P: prototype v1 for owner review (2026-09-23)

[Prototype v1](v1/index.html) (sha256 `f03a4b4af695…`). It is static and clickable, with illustrative Tool Share data (not real research). The shell and tokens are reused from WORK-UX-01 v2. The "Your brief, item by item" button maps R1–R17 to the screen that answers each one.

**What to try:**
- **Product › Brief:** click a confidence marker. "Lenders are motivated by earning rent" is contradicted. Attach an insight to "Trust is the crux" and watch it turn *Evidenced*.
- **Opportunities:** the tree.
- **Story map:** click S-3 to see its "why" link and its evidence.
- **Library:** the three views; open the poll source to see the data finding and chart.
- **Work › Plan:** the Roadmap and Timeline views; P-4 shows an early start.
- **P-5:** the project brief, and scope in layer order with automatic blocks.
- **Board:** press Fill from plan, then start P-5 and fill again.
- **Team:** the Project lead.
- **Home:** the simple view.

**New in the prototype and not in the proposal, so please judge them separately:**
- **Appetite for agent work** is measured in items, tokens and review sittings, not weeks. This follows from the owner's point that timelines get weird with agentic scaling.
- **Timeline** steps are ordered within each milestone, and milestones run in order. The first render ordered across milestones and needed 8 columns to read.
- **Fill from plan** explains each skipped item, for example "P-5 isn't started yet".
- **"Draft with Product lead"** appears on each Brief section, and **"Test this"** on each risky assumption.

**Agent-checked** (not owner acceptance):
- A Playwright (Chromium) script visited 11 routes at 1400px light, 390px light and 1400px dark:
  - no page or console errors;
  - no horizontal overflow;
  - axe-core 4.11.1 clean on every light route at both widths.
- It also checked three interactions: the timeline draws its dependency lines; attaching evidence updates a claim's confidence; after starting P-5, Fill adds exactly three items.
- Screenshots were reviewed by eye.
- The checks found and fixed:
  - a missing `lang` attribute;
  - unlabelled landmarks;
  - an `aria-label` on a role-less element;
  - a skipped heading level;
  - 390px overflow from grid tracks without `minmax(0, 1fr)`, the same trap the implementation plan warns about;
  - "Where things went" links breaking their sentences;
  - the 8-column timeline.
- The check script lives in the session scratchpad, not the repository.

**Review questions for the owner:**
1. Does claim confidence read as useful rigor, or as bureaucracy?
2. Is the Library's "by what it supports" tree the home you meant?
3. Does Fill from plan remove the need to hand-pick?
4. Should appetite be measured in items, tokens and review time?

## Owner review of v1 (2026-09-23)

The owner reviewed v1 and wrote: "im always impressed with your work. just need to get it in line with whats needed in practice." The V-rows condense the review; v2 answers each one.

| # | Feedback (condensed) | Final position | v2 answer |
|---|---|---|---|
| V1 | The Brief "looks awesome … makes a lot of sense" (R2, R3) | **Accepted** | Kept |
| V2 | Users create and change claims in every section without going through the Product lead | Required | Add, edit and delete inline in every section, personas included; the Product lead is an optional draft button |
| V3 | Evidence is "great" (R5). Merge the confidence marker and the evidence count into one chip | Required | One chip: confidence icon and word, then the count, for example "Contradicted · 1 against" |
| V4 | R1 and R4 are "both there, fine" | **Accepted** | Kept |
| V5 | Library: "love the source-insight setup" (R5, R6). "Insights" and "By what it supports" become one insight list with filters and sort. Cut the extra copy to a title and one line | Required | Library has two tabs, Insights (filter by layer, record, direction and source; sort by most used, newest or strength) and Sources |
| V6 | Sources look like lists of findings. Interviews especially need the full text, where you highlight passages to turn them into findings and insights | Required | The source page shows the full transcript. Select text, then "Make finding", then attach it to a new or existing insight. Existing findings are highlighted in place |
| V7 | We still need a document hub: where does the generated PR/FAQ live? And a one-pager or manifesto that doesn't fit the Brief but belongs with the vision knowledge | Required (reverses §5.3) | A **Documents** tab in Vision (§10.1) |
| V8 | The opportunity tree seems redundant with the story map, mapping nearly 1:1 onto its backbone. Put evidence on stories instead, unless there's a reason to keep both | Owner leaning: drop it | **Dropped** (§10.2). Stories and activities carry evidence; a story's "why" links to a Problem claim |
| V9 | Keep Agents separate from Team. Keep the name **Roles** (as it was, with the new roles and actions). **Team** lists the people on the project, their roles, and the agents section as before | Required | Work tabs: Board · Items · Projects · Roles · Team · Agents · Routines (§10.4) |
| V10 | People and permissions: maybe the same rules as agents, scoped by action within a role, with some actions lead-only. Asked for advice | Open, advice requested | §10.3; shown on Roles and Team |
| V11 | Home (R13) is "good enough for now" | **Accepted for now** | Unchanged |
| V12 | The timeline (R12) will be unreadable with a hundred tasks in a milestone. Lean hard on Linear, so the plan ports easily to Linear or Jira and back (it may later live there). Don't be married to the roadmap view. Agents are limited by spend rate, but design and testing often have real timeframes | Required | Linear's model and timeline (§10.5): projects only, on a calendar, with optional start and target dates, a token budget for spend, and an Items list for the hundreds |
| V13 | Keep batching as it is. Drop "Fill from plan": "proposes" sounds agent-driven, and this must be procedural. Batch from a project, or a **Next N** button: the next N items for that assignee in the milestone and cleared to start, by priority | Required | "Next N" on each batch, scoped to the current milestone or one project; the rule is printed on the button's panel (§10.6) |
| V14 | Rename Product to Vision or something more descriptive? | Owner suggestion | Recommend **Vision** (§10.7), and shown that way in v2 |

## 10. Revised proposal after the v1 review

### 10.1 Documents (V7)

The purpose test (§1) found that Docs had no consumer and no anchor. v2 gives documents both:

- **Anchor:** the Vision layer. A document may mention any record, and each mention links in both directions.
- **Consumer:** people reading the product story, and agents when a document is marked **"Agents read this"**. Agent context then includes it, the way principles are included today.
- **Two kinds:**
  - *Generated* documents (PR/FAQ, one-pager) are built from the Brief. They record which Brief revision they came from, show "N claims changed since" when stale, and offer Regenerate.
  - *Written* documents (manifesto, launch letter) are ordinary revisioned records.
- Library **notes** stay as sources: raw material, not vision knowledge.

§5.3's retirement is withdrawn. What was wrong was the missing anchor and consumer, not documents themselves.

### 10.2 Why the opportunity tree goes (V8)

- **Fact:** Torres places opportunities in the *problem* space, discovered from interviews, before solutions ([OST](https://www.producttalk.org/opportunity-solution-trees/)). Patton's backbone is what people *do* ([story map](https://jpattonassociates.com/the-new-backlog/)).
- **Inference:** the two differ in principle. One need can span several activities, and some needs have no story yet. In practice, for a solo founder's web app, the needs worth tracking are few and already appear as Problem claims in the Brief. The v1 data itself showed the tree mirroring the backbone.
- **Resolution:**
  - Drop the tab.
  - A story's "why" links to a Brief claim, usually in Problem.
  - Evidence attaches to stories and activities directly.
  - Unmet needs with no story show on the Brief as claims with no linked stories.
- **What could reverse this:** products with many distinct user types, where needs genuinely cross-cut activities.

### 10.3 People, roles and permissions (V10)

**Evidence** (accessed 2026-09-23):
- Linear's team owners choose, for each capability, whether "either any team member or only team owners" may do it ([Linear changelog](https://linear.app/changelog/2025-12-17-team-owners), [members and roles](https://linear.app/docs/members-roles)).
- Jira grants each permission to project roles, and membership is per project ([Jira project permissions](https://confluence.atlassian.com/adminjiraserver/managing-project-permissions-938847145.html)).
- GitHub uses ordered repository roles from Read to Admin ([GitHub repository roles](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization)).

**Recommendation** (the owner's idea, which Linear confirms):
- **Project level:** Owner (everything, including billing, keys and deleting) and Member. Later, Guest (can read and comment, nothing else).
- **Role membership has two levels:** member and lead. A person can hold several roles.
- **Each action** in Roles says who may **do** it (any member, or lead only) and who may **accept** its review (lead by default).
  - For example, in Vision: *Write acceptance* is any member; *Change a Brief claim* and *Move a story between milestones* are lead only.
  - The existing "asks first" field becomes: "a member's result needs a lead's acceptance".
- **Agents** use the same rules. A profile joins a role as a **member**, never a lead, so an agent's result on a lead-only action always waits for a human lead.
  - This matches DEC-041's rule that agent work always comes back for review, and it adds no new mechanism.
- Nothing is enforced for other humans until multi-user projects exist. Until then the model shapes the Roles and Team screens and the stored fields.

### 10.4 Work tabs (V9)

**Board · Items · Projects · Roles · Team · Agents · Routines.** Items is Linear's issue list: one filterable, groupable list for hundreds of items. Projects has List and Timeline views.

### 10.5 Planning on Linear's model (V12)

Linear's timeline "is specifically designed to only surface projects to keep project planning work cleanly separated from granular issue implementation". It zooms by week, month, quarter or year, and shows project milestones as in-project checkpoints ([timeline](https://linear.app/docs/timeline), [project milestones](https://linear.app/docs/project-milestones)). That answers the hundred-items problem: the timeline never shows items.

| Aludel | Linear | Jira (Cloud 2025+) | Notes |
|---|---|---|---|
| Milestone (Demo, MVP) | Initiative (target date, owner; status Proposed, Planned, Active, Completed or Canceled) | Release (fix version), or an initiative in Plans | Owner chose "milestone" (DEC-042). Linear's *project* milestones are a different thing (below) |
| Project | Project (lead, members, start and target date, status Backlog, Planned, In progress, Completed or Canceled; health on track, at risk or off track) | Epic | The brief is the project description |
| Project checkpoint | Project milestone (inside one project, optional date, progress %) | — | Optional; v2 shows one on P-5 |
| Work item | Issue | Work item (renamed from "issue" in 2025; the API still says issue) | Keep "item" |
| Status: Backlog / Queued / Batched or working / Ready for review / Done | Status categories Backlog / Unstarted / Started / Started ("In Review") / Completed | To Do / In Progress / Done | Linear's categories are fixed in order; names are custom |
| Priority: Highest to Lowest (DEC-041) | Urgent / High / Medium / Low / No priority | Highest to Lowest | Highest→Urgent; Lowest→Low |
| Blocks / blocked by | Blocks / blocked by | Blocks / is blocked by | Direct mapping |
| Layer | Label | Label or component | |
| Batch | — (cycles are team time boxes) | Sprint (closest) | Aludel-only execution; not exported |
| Budget (tokens) | — | — | Aludel-only. Dates handle time-bound work; budget handles agent spend |

Sources: [Linear workflows](https://linear.app/docs/configuring-workflows), [Linear initiatives](https://linear.app/docs/initiatives), [Linear project status](https://linear.app/docs/project-status), [Jira's rename to work items](https://community.developer.atlassian.com/t/work-is-the-new-collective-term-for-items-tracked-in-jira/88552).

**Inference:** matching Linear's status categories, priorities, relations and project fields makes a future sync a field mapping rather than a model change. The one open naming conflict: Linear's *project milestones* are checkpoints inside a project, while ours are project-wide stages. v2 labels in-project checkpoints as **checkpoints** to avoid the clash.

### 10.6 Next N (V13)

Each batch has a **Next N** button. It adds the next N items that meet a fixed rule, and does no ranking or proposing:
- the item is assigned to that batch's assignee;
- its project is in the current milestone, or it is in the chosen project;
- its status is not Backlog;
- nothing blocks it.

Items are taken in priority order, then oldest first. The rule is printed in the panel, and the same inputs always give the same items. "Add to batch" on any single item stays.

### 10.7 Product → Vision (V14)

**Recommend "Vision".** The layer now holds the Brief, the Story map and Documents: what we're building, for whom and why. "Product" is ambiguous in a tool where everything is the product. It also leaves room for the owner's future **Business** layer as a sibling. The role stays **Product lead**, just as Design has a Design lead.

### 10.8 Process change from this review

- **The purpose test gains an overlap question:** does this duplicate an existing structure? The opportunity tree would have failed it. Added to [operating procedure §2](../process/operating-procedure.md#2-inventory-evidence-for-the-proposed-scope).
- **Borrowed or invented:** the v1 timeline was invented, although §2 already asks prototypes to borrow from real reference screens. v2 labels each new composition as *borrowed* (with its source) or *invented*. Invented ones are called out for review.
- **Wording:** a deterministic action is described by its rule. "Propose" and "suggest" are reserved for agent output (V13).

## ROADMAP-01P v2 for owner review (2026-09-23)

[Prototype v2](v2/index.html) (sha256 `0e297b743b71…`). "Your feedback, item by item" maps V2–V14 to screens and lists each composition as borrowed or invented.

**What to try:**
- **Vision › Brief:** add, edit and delete a claim; see the one chip.
- **Documents:** the PR/FAQ goes out of date after a Brief edit; press Regenerate.
- **Library:** filter the insights; open Dana's interview, select a sentence, then Make finding.
- **Work › Projects › Timeline:** drag or resize a bar; change the zoom.
- **P-5:** Overview and Items.
- **Board:** press Next N on Scout.
- **Roles:** change who may do an action.
- **Team** and **Agents.**

**Agent-checked** (not owner acceptance). A Playwright (Chromium) script visited 16 routes at 1400px light, 390px light and 1400px dark:
- no page or console errors, and no horizontal overflow;
- axe-core 4.11.1 clean on every light route at both widths;
- scripted interactions passed:
  - Brief add, edit and delete;
  - the chip text;
  - a generated document going stale, then regenerating;
  - the insight filter;
  - selecting transcript text, making a finding and a new insight, and seeing the new highlight;
  - dragging a timeline bar (it moved and did not navigate);
  - dependency lines drawn;
  - zoom;
  - Next N preview (W-41 and W-43 match; blocked W-32 doesn't) and adding;
  - changing a role's permission.

Screenshots were reviewed by eye. Fixed along the way:
- low contrast on the "In progress" text;
- timeline labels clipped inside short bars (now drawn beside the bar);
- sample dates that falsely flagged every dependency;
- clipped "No dates" buttons;
- misaligned Roles columns.

**Limits:**
- Timeline dragging is pointer-only. The keyboard alternative is the date fields on the project page.
- Text selection for findings is mouse-driven.
- The Linear comparison uses documentation text, not live Linear screens.

## Owner review of v2 (2026-09-23)

The owner said "v2, nice" and asked for one more prototype.

| # | Feedback (condensed) | Final position | v3 answer |
|---|---|---|---|
| W1 | The evidence chip should be simpler: an icon, a label (Supported or Contradicted) and an optional number. With both directions, a split chip with icons and numbers only | Required | Done. A number shows only when it's above 1 |
| W2 | Insight list: show the insight first, with one meta line (findings, times used, strength). The detail view needs create and edit: tags, adding findings, comments. Remove the Source filter (Sources has its own tab) and the Show filter; add a keyword search. Insights as the commentary layer over findings are liked | Required | List rows; `#/library/insight/…` with an editable title, strength, tags, findings you can add or remove, comments, and Used in. New insight button |
| W3 | V6 (highlighting) is "amazing"; V7 and V8 fine. A story's "why" wasn't clearly a Brief problem, and the evidence repeated: "Supported" beside the why, then "no evidence yet" below | Required | The why chip names its section ("C-2 Problem"). Tabs carry the same icons as their records' chips. A story's evidence is one list: *through its problem*, then *on this story*. Its chip counts both, without double-counting |
| W4 | Agents go under the Team tab. Human roles use the real role colours. Reviewer folds into Project lead. An alternative to the star for leads | Required | Work tabs: Board · Items · Projects · Roles · Team · Routines. Role chips use layer colours: **solid with a shield = lead, tinted = member**. Each role reviews its own work; Project lead has the final project review |
| W5 | Agents take the role of the action they're assigned (low-level design acts as a Design member; high-concept experience work acts as an Experience lead). The profile needs no roles of its own, "unless you recommend otherwise" | Owner proposal | Adopted, with one safeguard: an agent on an elevated action acts as a lead, but its result always waits for a human lead's review. That's already DEC-041's rule, so no new mechanism |
| W6 | Roles keeps the WORK-UX-01 functions (description line, default assignee, setup), plus an icon toggle for elevated privilege instead of a dropdown. Each role gets an action to review its own tasks, which can be elevated like any other | Required | Done: a shield toggle, and a "Review … work" action per role |
| W7 | Next N as a split chip: "Next" plus a number you click to edit. Active milestone only; clicking Next adds straight to the batch, with no panel | Required | Done |
| W8 | Work structure is better but not grade A. Look at real screenshots (Linear, else Jira). The list view is liked, but clicking a row is unintuitive. The timeline could be cleaner and simpler | Required | Studied Linear's own product images (below). The timeline, project page and item panel are rebuilt from them |
| W9 | Standardise colour per layer across the portal, including the nav. Owner's idea: a coloured icon when inactive, a solid layer background when active. Or something like Confluence spaces? | Open; two options to compare | Both built. **A (tiles):** each layer has a Confluence-style coloured tile. **B (solid):** the owner's idea. Switch between them in the prototype bar. Recommendation: A |
| W10 | Every reference to a record is a chip: hover for a quick view, click to go there | Required | One `ref()` chip for every kind of record, in its layer's colour, with a hover (or focus) quick view modelled on Linear's peek |

### Reference study for W8 (accessed 2026-09-23)

These are Linear's own product images from their docs, looked at directly, not just described.

| Source | What was seen | Borrowed | Avoided |
|---|---|---|---|
| [Timeline](https://linear.app/docs/timeline) (hero image) | No name column. The project icon, name, health, lead and status sit **above** the bar where it starts. Bars are thin and neutral. Milestone diamonds sit on the bar with labels underneath. Today is a pill on the axis. An overrun shows as a red, dashed, fading extension | All of these | Coloured bars and a fixed name column (both v2) |
| [Peek preview](https://linear.app/docs/peek) | A hover card with ID, title, project and milestone, status, priority, assignee, labels and a description line. List rows end with label pills and a split "project │ milestone" pill | The quick view on every chip; the split project │ milestone pill on item rows | — |
| [Project overview](https://linear.app/docs/project-overview) and [Plan](https://linear.app/plan) | An icon tile, the title, a one-line summary, a Properties row (status, priority, lead, dates with an arrow), Blocked by, Resources as chips, the description, then milestones as "date · N issues · %" | The project page layout | — |
| Jira list view (known behaviour; the screenshot wasn't usable) | Clicking a row opens a detail panel at the side | Clicking a row opens a side panel with "Open full page" | A toast (v2) |

## ROADMAP-01P v3 for owner review (2026-09-23)

[Prototype v3](v3/index.html) (sha256 `907a237df713…`). The prototype bar has a **Nav** switch (A tiles, B solid) and the feedback ledger.

**Agent-checked** (not owner acceptance). A Playwright (Chromium) script visited 18 routes at 1400px light, 390px light and 1400px dark:
- no page or console errors, and no horizontal overflow;
- axe-core 4.11.1 clean on every light route at both widths;
- scripted interactions passed:
  - the split chip and the single chip;
  - a quick view appearing on hover;
  - a story's two evidence groups;
  - the keyword filter;
  - on an insight: adding a tag, a comment and a finding;
  - clicking an item row opens the side panel;
  - Next, including editing N;
  - the elevated toggle and Setup;
  - dependency lines;
  - dragging a bar (it moves, keeps its checkpoints, and doesn't navigate);
  - both nav styles.

Screenshots were reviewed by eye. Fixed along the way:
- timeline bars with no width;
- overlapping checkpoint labels;
- story cards that were links containing buttons (invalid HTML);
- a contrast fix lost between file versions;
- a missing heading on the insight page;
- a link nested inside a group header's expand/collapse control;
- three grid tracks without `minmax(0, 1fr)`.

**Limits:**
- Dragging and highlighting are pointer-only; the date fields are the keyboard route.
- The Jira screenshot wasn't usable.

**Process note:** the "borrowed or invented" rule from §10.8 worked this time. The timeline and project page came from real Linear screens rather than being invented, and the reasons are recorded in the table above.

## Owner acceptance of v3 and build brief (2026-09-23)

Owner: "w1, good, w2 good … w6,7, great. w8, better. we can work with that. w9, i like the tile version … looks good, no final prototype, you can go ahead and build." (DEC-043.)

| # | Final tweak | Build answer |
|---|---|---|
| X1 | A story's why section is too cluttered: just "Why", then the chip. "C-2 Problem" is enough. Did it lose its colour? | Yes, it had: a CSS ordering bug made `.ref`'s default colour override the layer colour. The build keeps one label and one chip, in Vision colour |
| X2 | Only the small shield marks elevated; chips are otherwise all the same. "auth elevated, that will work throughout." Liked on Roles | Lead role chips are ordinary chips plus a shield; the elevated toggle uses the same shield |
| X3 | Agent profiles on Team don't list roles, anywhere. Leave them as before | Team = People (new) + the existing Agents section, unchanged |
| X4 | The tile nav is chosen. Colours form a clean rainbow top to bottom | Home red → Vision orange → Design amber → Pages green → Data teal → Platform blue → Work violet → Library purple; Settings neutral |

### Build plan (one packet at a time; tests after each)

| Packet | Scope | Check |
|---|---|---|
| **RB-1** Colour, nav, chips | Rainbow layer tokens; tile nav; tab icons that match record kinds; Product becomes **Vision** in labels and URLs (the internal layer key stays `product`, so stored items and actions don't migrate; `/product/…` URLs redirect); one ref chip with a quick view for every record kind | Typecheck, build, layers browser, axe |
| **RB-2** Brief | `brief_claim` records (section, text, note), migrated once from the vision sections; personas under Customers; add, edit and delete inline; principles feed agent pins; riskiest assumptions; "Test this" creates a research item | Domain tests: migration and pins; browser |
| **RB-3** Evidence and Library | `source`, `finding`, `insight` (tags, comments) and `evidence_link` records; evidence chip and panel on claims, stories, activities, pages, objects and projects; a story's evidence includes its problem's; Library (insights with keyword, layer, tag and sort filters; insight page; sources; highlight a passage to make a finding); research records migrate to sources | Domain tests; browser |
| **RB-4** Documents | `doc` gains written or generated, agents-read and Brief revision; a generated PR/FAQ or one-pager is composed from Brief claims deterministically (agent-drafted versions later); out of date when claims change since; agents read flagged documents | Domain tests; browser |
| **RB-5** Plan | Milestones (phases gain a target date); `project` records (specs migrate: brief, stories, lead, status, health, dates, dependencies, budget, checkpoints); `project_id` and checkpoint on items; backlog items join their story's project; Items list with grouping, filters and a side panel; Projects list and a Linear-style timeline with drag; project page; **Next** split chip (a fixed rule: queued, unblocked, active milestone, by priority then age) | Domain tests: migration and the Next rule; browser, including the drag |
| **RB-6** Roles and Team | Actions gain `elevated` (a shield toggle); each role has a review action; the Work role becomes Project lead; role membership with lead, stored on the role; Team = people with role chips (shield for lead) + the existing Agents section; accepting an elevated item's review needs a lead of its role (or the owner) | Domain tests: permission; browser |

**Known limits, accepted up front:**
- Source files and images: v1 supports links and pasted text; uploading screenshots comes later.
- Generated documents are composed from templates, not drafted by an agent.
- Enforcing permissions matters only once multi-user projects exist.

## 9. What could change these conclusions

- Owner use showing the Brief's claim confidence reads as bureaucracy for a Dreamer. Then hide confidence until evidence exists.
- Agent trials where project-grouped context performs no better than story-grouped context.
- A real deadline, such as a launch date, making dated timelines necessary.
- A second product type, such as an internal tool with no market, where Lean Canvas sections don't apply. The optional business-model section partly covers this.

## Closeout (research stage)

- **Process outcome:** the purpose test (§1) was added to the operating procedure and applied to six tabs in §4. It is not yet proven: the evidence will be the owner's review and LAY-05's use of the consumers it names.
- **Task outcome:** research and proposal are done. The owner answered §7 (DEC-042), and prototype v1 is built and agent-checked, waiting for owner review. No portal code has changed.

## Closeout (build, 2026-09-24)

- **Task outcome:** built and agent-checked. 69/69 server tests, the updated layers browser script (axe and 390px), the other browser scripts (except the known `browser.mjs` step), a real-app timeline drag, and a start-up migration trial on a copy of real data. Owner review of the built layers is next. [Evidence and retrospective](../../evidence/roadmap-01-product-and-plan.md).
- **Process outcome:** the purpose test and "borrowed or invented" held through v3 and the build. The build added a reserved-names note, PID-only server stops, and "look at every screen" with the two Angular traps to the [implementation plan](../portal-layers/implementation-plan.md#how-to-run-and-check). These are untested beyond this task.

## Owner acceptance (2026-09-24)

Owner, after using the build: "alright, i like it. mark done." (DEC-044.) Accepted for this stage. Later UX passes may still refine these screens.
