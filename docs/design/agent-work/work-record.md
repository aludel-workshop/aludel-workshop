# Open agent work (AGENT-WORK-01): work record

The plan and the owner's decisions so far are in the [proposal](proposal.md). This record holds authorizations, slice records, evidence and retrospectives.

## Authorization

- **2026-10-04, owner project thread (A0 prototype, cloud session):** "ready to pick up the agent work revamp", relayed by the project's coordinator session as the go-ahead for the proposal's first slice. Authorized: slice **A0** only: this record, a static clickable prototype under `docs/design/agent-work/a0/v1/` with illustrative data, its walkthrough and screenshots, a shared prototype-check helper under `tools/`, the status update, and commits plus a push to this session's branch (`claude/agent-work-prototype-7en0jx`, from `main` at `095f01a`) with a draft PR. Not authorized: building any of it in the portal (A1 onward each need the owner's go), `layer-base` changes, pushes to `main`, deployment, spending, live owner data. Recorded before execution.

## A0 prototype round (2026-10-04, Claude, cloud session)

**Process first.**
- *What the task revealed.* (1) Every prototype round so far copied the J6 walkthrough's setup by hand: the Playwright import, the proxy-aware font route (J6's fix for icons rendering as their names and the false contrast failure it caused), the icon-font retry, axe injection, and the 390 px overflow and clipping checks. (2) This session had no axe-core installed; J6's script takes `AXE_PATH` and would have crashed rather than said "axe didn't run". Both are friction a next prototype pays again.
- *Change applied now.* `tools/prototype-check.mjs`: one helper that a prototype's walkthrough imports for the browser, font route, icon check, screenshots, axe and the narrow-width checks. It finds Playwright in the cloud image, and when axe-core can't be found it records an error instead of silently skipping, so a run without axe can't report "no findings". **Tested by** this round's walkthrough (below). Whether it saves time on the *next* prototype is a hypothesis until one uses it.
- *Memory check.* The starting memory said the proposal might only be on `claude/j6-prototype-ptl3we`; `main` carries it (`095f01a`) and `tools/branch-handoffs.sh` reports no branch ahead of `main`. A0 starts from `main`.
- *References.* The compositions borrow from Claude Code's own surfaces, named from prior knowledge and **not captured** in this session: plan mode's plan-then-approve prompt, the todo list that updates as work proceeds, subagent (Task) rows that collapse to a one-line summary, and AskUserQuestion's options with a recommended pick. The review borrows the J6 walk review the owner accepted (v2 and the build).
- *Purpose test* on A0's new parts: the **plan** is produced by the coordinator agent, consumed by the owner's approval (which authorizes the layers it names) and then by the run as its checklist; anchored to the run. The **checklist** is derived (plan steps plus progress). **Step summaries** are produced by layer agents and consumed by the coordinator and the reviewer; anchored to the plan step. The **changeset** is derived (each layer's staged changes and branch, keyed by run). **Derived steps** are produced by the host from a binding and consumed as plan steps. The **question** is produced by the agent and consumed by the owner's answer; anchored to the run, as `aludel_task_ask` today. **Layer modes** are a project setting, read at plan approval. No container is attached to nothing.

**Owner brief ledger.** The brief is the proposal's A0 row ("the plan card, the run's live checklist with layer agents, and the changeset review"), the leftovers moved here (agent-side check, prerequisite continuation, status for runs that fail before they start), and "build that first slice … show it to Henry".

| # | Ask | Where in v1 | Borrowed or invented |
|---|---|---|---|
| A1 | A goal, not a layer task | The item is a project goal (*Create the sign-up flow*) with no layer; layers appear only in the plan | Proposal §1 |
| A2 | Plan card, approved before work | Ordered steps by layer: change, why, which agent, the layer's mode; claims it will prove; what the agent read (stack map, Vision brief, Knowledge, skills). *Approve plan* / *Request changes*, and per-step comments | Borrowed: Claude Code plan mode (not captured) |
| A3 | Approval authorizes the layers it names | The approve bar lists the layers that will change and those read only. Layers in *Ask first* mode show that each change waits for you | Proposal §3–4 |
| A4 | Live checklist with layer agents | The plan becomes the checklist; each step runs in its agent (Pages, Code, Verify, Showcase), independent steps side by side, a done step collapses to the agent's summary and what it staged | Borrowed: Claude Code's todo list and subagent rows (not captured) |
| A5 | Bindings carry follow-through | Finishing the Pages flow adds *Code: the sign-up journey follows the flow* to the plan, marked *Added by binding*, inside the same run | Proposal §6 |
| A6 | Host checks can't be skipped | Each staged change shows its checks (layer API validation, package tests); submit waits on the combined build and journeys | Proposal §7 |
| A7 | The agent-side check (J7 leftover) | The Verify agent runs Check my branch on the combined changeset; in the default story one journey step fails, the Code agent fixes it and Verify passes, before the owner sees anything | Proposal §5 host agents |
| A8 | Ask instead of stopping (prerequisite continuation) | A mid-run question with options and a recommendation; steps that don't depend on it keep going; the answer continues the same run | Borrowed: AskUserQuestion; today's run question |
| A9 | Runs that fail before they start | A scenario: the run stops at *Workspace* with the reason, no agent turn used, and *Try again* on the same plan | Invented, from J8's W-9 hook failure |
| A10 | One review across the changeset | The J6 v2 review, with claims grouped by layer in plan order: a Pages record claim (Previous/Proposed flow), two journey claims (one persona each) walked in the preview, the regression claim; Finish names each layer part and who signs it | J6 v2 (owner accepted) |
| A11 | Send back resumes the same run | Send back returns the flags to the same run, which shows a round 2 on the same checklist, keeping what it already did | Borrowed: replying in a Claude Code session |

**Readiness verdict (procedure §5), before construction: ready for a prototype.**
1. *Questions:* Q1–Q7 below. Fidelity: static clickable HTML, illustrative data (Biome, *Create the sign-up flow*, the goal W-9 couldn't do as one layer). The run's events play on a timer, with a *Step* mode in the prototype strip for reviewing one event at a time.
2. *Included:* the owner starting a goal, approving its plan, following the run, answering a question, reviewing and accepting or sending back. *Excluded:* how a goal is created (J8's composer stays; the layer becomes optional), layer mode settings UI (shown read-only in the plan), elevated reviewers other than the owner (a scenario shows the state, no second person is modeled), the MCP server and runtime (A1/A2).
3. *Parent structure:* the Work item page and the J6 review stay; v1 changes the run block (plan, checklist) and groups the review's claims by layer.
4. *States:* planning, plan ready, plan with changes requested, running with parallel steps, waiting on an answer, a binding adding a step, Verify failing then passing, ready for review, sent back and resumed, accepted, failed before start, a layer part gone stale.
5. *Review frame:* the owner opens the page, presses Go, approves, follows the run to review, signs off, then uses *Scenarios* and answers *Review questions* (kept in the browser; *Copy answers*).
6. *Named experimental variables:* plan granularity and where it shows (Q1), approval scope (Q2), the checklist's agent rows (Q3), binding steps appearing mid-run (Q4), questions not stopping other steps (Q5), grouping the review by layer (Q6), Send back as round 2 (Q7). Not settled: visual polish beyond the portal's tokens.

**Prototype v1:** [a0/v1/index.html](a0/v1/index.html) (open the file in a browser) · [walkthrough](a0/v1/walkthrough.mjs) · [screenshots](a0/v1/shots/). The run plays itself (*Play*); *Step* and *Next event* in the prototype strip advance it one event at a time. *Scenarios* jumps to the plan, a mid-run question or the review, and turns on the exceptional states.

**What it shows, in order.** Go → Explore reads the stack (read only) → the plan card (Request changes needs a note and produces plan 2; Approve) → Pages and Data agents start side by side → Data, in *Ask first*, waits for your OK on its one change → the Pages agent asks how a new member confirms their email, and keeps writing the page that doesn't depend on the answer → answering finishes the Pages step, and the binding adds the Code journeys step (*Added by binding*) → the Code agent builds routes and step tests → Verify fails one journey step and hands it back; the Code agent fixes it; Verify passes → Showcase collects screenshots → *Ready for review* → the J6 review with claims grouped Pages, Data, Code → Finish: Send back resumes the same run as round 2 (approved claims stay approved, the flagged ones reopen marked *Changed in round 2*), or Accept merges every part.

**Review questions.**
- **Q1** The plan card: steps by layer, each with its agent, why and the layer's mode, plus what you'll review and what the agent read. Right level of detail to approve from?
- **Q2** Approving authorizes the layers the plan names; Data in *Ask first* still asks per change. Right split, or should approval cover everything?
- **Q3** The checklist: each step runs in its layer agent, side by side when independent, collapsing to a summary when done. Enough to trust what happened without reading logs?
- **Q4** The binding adds a Code step mid-run instead of a follow-up task. Clear?
- **Q5** A question doesn't stop the run, and Verify's failure goes back to the Code agent before you see anything. Right behaviour?
- **Q6** The review is J6's, grouped by layer in plan order, with one Finish for every part. Does one review for the whole changeset work?
- **Q7** Send back resumes the same run as round 2 on the same checklist, keeping approved claims. Right, or should each round be its own run?
- **Open (not asked):** proposal decisions 2 (auto-approving small plans) and 3 (who signs which part) are shown at their recommended defaults only: every plan waits for the owner, and the owner signs every part.

**Checks (agent-checked, not owner-accepted).** The walkthrough uses only visible controls in *Step* mode: Go, planning, a refused empty plan note, plan 2, approval, the Data OK, the question, the binding step, Verify's failure and fix, the review walk through the preview's own buttons, a refused empty flag, sign-off hidden once a step is flagged, Send back, round 2 keeping the Pages approval, Accept; then the failed-before-start, Verify-stuck and stale-main scenarios, review answers surviving Reset, and the plan, question and walk at 390 px. axe ran on 14 states.

| Run | Result |
|---|---|
| First runs | The script stalled on Playwright's 30 s default wait for a control that wasn't there (now 5 s in the helper, reported as an error); ticks were counted by hand and drifted from the event order (now *tick until the text appears*) |
| Findings fixed | 3 axe issues (evidence card headings before the panel's `h2`; a progress bar with `aria-label` and no role); *Jump to review* showed the review while the run was stuck; flag counts mixed step flags with claim flags (Finish now counts flagged claims); checklist titles wrapped under their layer chip; the review frame didn't fill the screen |
| Final | **NO ERRORS · 26 screenshots · 14 axe audits**, no horizontal scroll or clipped buttons at 390 px |
| Helper guard | With `AXE_PATH` pointing nowhere, the helper prints "axe-core not found … accessibility was NOT checked" and exits non-zero |

**Retrospective (prototype round).**
1. *Harder than necessary (observed):* axe-core was missing from the session and had to be installed into the scratchpad; the first walkthrough runs hung on missing controls for 30 s each; counting run events by hand broke as soon as two events could fire in either order.
2. *Would help next time:* `tools/prototype-check.mjs` now carries the font route, icon check, axe lookup with a loud failure, 5 s waits and the narrow checks. For a prototype with timed events, drive it with "advance until visible" rather than fixed counts.
3. *What it revealed:* the plan needs to say which steps a binding will add before they exist, otherwise approval doesn't cover them. v1 shows the expected step dashed in the plan and fills it in when the binding fires; A3 needs the host to predict derived steps at plan time, not only compute them after staging. Also, *Ask first* creates a second kind of pause besides questions; the run's status has to name both ("Needs you: a question and a Data change to allow").
4. *Questions created:* Q1–Q7. Agent-resolvable for A1: whether an expected binding step that turns out larger than planned needs re-approval.
5. *Process change:* the shared helper, applied and tested here (the walkthrough and the missing-axe check). Whether it saves the next prototype time is a hypothesis until one uses it.

**Status:** prototype round open, waiting on the owner's answers. A1 is not authorized.

#### Round 1 feedback and prototype v2 (2026-10-04)

**Owner feedback on v1** (project thread, one message, condensed per ask; the owner called it "a rather loose train of thought, but the gist: we need a clearer overall structure").

| # | Ask | Position | Where in v2 |
|---|---|---|---|
| F1 | Keep the work item framework: tasks that could be imported from Jira or Linear. Clicking in should make it quick to see what the item is about | Required | A top bar with the item's fields (status column, priority, assignee and work style, layers, source, links) and its brief; the existing item page's facts, kept |
| F2 | Maybe drop batches for a plain kanban board | Proposed ("maybe") | A small board (Draft, Ready, In progress, In review, Done) that the item moves across. Batches aren't shown. Q-level decision, not settled |
| F3 | Work style stays open: as easy to send to a remote agent as to claim and work locally with your CLI agent, with the same knowledge, resources and previews | Required | The work style picker on the item: *Send to Claude* or *Claim for local CLI*. Local shows the claim command; the sidebar becomes your local session's thread; actions, needs and reviews are the same |
| F4 | A half-baked idea plus Go: the remote agent checks it over, asks questions, helps define the task and moves it to Ready; then layer work starts | Required | Go on a Draft item starts *defining*: questions stack on the brief card, the agent rewrites the brief and drafts the actions, the item moves to Ready, and *Start work* begins it |
| F5 | Agent work and chat live in a right sidebar, not drifting through the main area; when an agent is on the item, that's the most important thing to see | Required | The right sidebar is the orchestrator's thread, with a composer to steer it |
| F6 | Keep the plan; the actions are like Jira subtasks | Required | The main area is the action list: each action has a layer, goal, agent, dependencies and state |
| F7 | Things needing you were in two places (a question at the top, a Data change in the checklist). Keep them consistent, always under the action itself; several questions stack on the card | Required | Every need (question, change to allow, new action to approve, review) sits on its action's card. The top bar only counts them and jumps to the first |
| F8 | An overall orchestrator was missing: something checking what comes out of the subagents and whether it works together | Required | The orchestrator owns the thread, checks each finished action against the others (said in the thread), and owns the final *Check everything together* action |
| F9 | Actions always open to change: add new ones, change their goals as the work informs | Required | *Add action* in each phase; *Edit goal* on actions not yet done; the orchestrator replies in the thread |
| F10 | Review gates: review the flows before code is built. Phases with dividers; nothing below starts until reviews above are done, while dependencies still allow concurrent subagents | Required | Phases separated by review gates; within a phase, *after #n* dependencies, independent actions run side by side |
| F11 | Review at the action level: when the flows are done, click Review on that action. Approve-and-run happens at the orchestrator level to close out | Required | *Review* on each action with a review; one *Approve and merge* in the orchestrator's thread once everything is reviewed and checked together |
| F12 | Predicting binding steps at plan time sounds fragile. New actions get an Approve button, the orchestrator tells you about them, and approving opens the action's details | Required (replaces v1's expected step) | A binding-added action arrives as *New: needs your approval* with the orchestrator's note; *Review and approve* opens the action in the sidebar with its details. Approval is per action, not predicted |
| F13 | How do you get to an action's details, and steer it? Maybe combined with the thread viewer | Proposed | Clicking an action opens it in the sidebar: details, its needs, its log and a composer to steer that action's agent; *Back to orchestrator* returns |

**Process first (this round).**
- *What it revealed.* v1 answered the proposal's slice row but skipped the procedure's parent-structure check: it replaced the run block without asking which parts of the accepted work item (WORK-ITEM-UX-01) were enduring. F1 and F3 are exactly those parts. **Applied now:** the v2 brief starts from the current item page (`work-item.ts`: eyebrow, facts row, Links and Planning, Activity) and keeps its fields; and the operating procedure's §5 readiness list gets one line: a prototype that changes a page's main area names which parts of the accepted page it keeps, before building.
- *Model change from F12.* The proposal's §3 said plan approval authorizes what it names, and v1 tried to predict binding steps. v2 makes approval per action: the starting plan is approved by *Start work*, and every action added later carries its own approval. This removes A3's prediction problem rather than solving it.

**Readiness (v2).** Same frame as v1. Fidelity unchanged; data is the same Biome goal, now starting as a half-baked Draft. New named variables: the board columns (F2), the sidebar as action viewer (F13), gates as phase dividers (F10), which actions need review (shown per action). Still excluded: importing from Jira (only shown as a source field), multi-person review, the local CLI itself (only its claim command and thread).

**Prototype v2:** [a0/v2/index.html](a0/v2/index.html) · [walkthrough](a0/v2/walkthrough.mjs) · [screenshots](a0/v2/shots/). Same playback controls as v1. *Scenarios* jumps to the defined item, the two needs, the new action at the gate, the code review or the close-out, and turns on #4 failing twice.

**What it shows, in order.** A rough Draft (*sign up flow?? …*) with no actions → Go → two questions stack on the brief → the orchestrator rewrites the brief, drafts 4 actions in 3 phases and the item moves to Ready → you edit #3's goal → *Start work* (In progress) → #1 and #2 run side by side, #1's question and #2's change to allow each on their own card → #1 is ready for review and the orchestrator says it checked #1 against #2 → the binding proposes #5 (*New: needs your approval*), and #3 now waits on it → the gate holds phase 2 until you review #1 and #2 → you flag #1 once and it comes back, then approve both → *Review and approve* on #5 opens it in the sidebar → you add #6 → #3 builds, #4 (the orchestrator's combined check) fails and sends it back, then passes → you walk both journeys to approve #3 → the orchestrator's *Approve and merge* → Done on the board. *Work locally* shows `aludel claim W-11`, and the sidebar becomes your local session's thread.

**Questions for round 2.**
- **Q1** The item page keeps the Jira-style top bar and the brief. Quick enough to see what the item is about?
- **Q2** Go on a rough Draft: Claude asks its questions on the brief, rewrites the brief and drafts the actions, then the item moves to Ready; *Start work* begins. Right split between defining and doing?
- **Q3** The sidebar is the orchestrator's thread; clicking an action shows its details, needs and log there, with its own steer box. Does that work as the one place for details and steering?
- **Q4** Everything that needs you sits on its action, and the top bar only counts them. Consistent enough?
- **Q5** Phases with review gates, plus *after #n* within a phase. Does that show the dependencies, and should you be able to move gates yourself?
- **Q6** Review per action (some are only checked by the orchestrator), then one *Approve and merge* from the orchestrator. Right?
- **Q7** Work style: *Send to Claude* or *Work locally*, with the same actions, needs and reviews. Is that the parity you want?
- **Q8** A plain kanban board instead of batches. Keep going that way?

**Checks (agent-checked).** The walkthrough drives everything above with visible controls in *Step* mode. It asserts that phase 2 doesn't start before both reviews, that an empty flag is refused, that #3 can't be approved before both journeys are walked, that the item lands in Done on the board, that local style shows the claim command and the local thread, that the twice-failed check puts its decision on #4, and that review answers survive Reset. It also checks the draft, the needs and the walk at 390 px. **Result: NO ERRORS · 19 screenshots · 15 axe audits.** Before that, the runs found four prototype defects, all fixed. #6 reused #5's number. *Next event* was disabled for actions you add. A working action hid its last log line while it waited on you. The sidebar sat below the top bar, which hid the orchestrator when you first click in; it now runs the full height. The walkthrough also matched a thread message instead of the card it meant, so its waits now target unique text.

**Retrospective (round 2 build).**
1. *Harder than necessary (observed):* text checks matched the orchestrator's thread when they meant an action card, because the thread repeats what cards say. Next time, scope assertions to the region (`.acard`, `.side`), not the whole view.
2. *Would help next time:* the shared helper worked unchanged for a second prototype (font route, axe, narrow checks). That is the first evidence it saves set-up; the walkthrough was written against it from the start.
3. *What it revealed:* per-action approval (F12) removes the proposal's plan-time prediction of binding steps. The proposal's §3 and §6 need that change before A1. Also, an orchestrator that "checks what comes out" needs a concrete contract: in v2 it checks each finished action against its neighbours (#1 against #2, #5 against #1) and owns the combined check (#4). A1/A2 have to define what those checks are, not only show them as messages.
4. *Questions created:* Q1–Q8. Newly important: who may move a review gate (Q5), and whether a local session can act as the orchestrator for the remote agents (F3's parity, untested here).
5. *Process change:* the procedure §5 line about naming the parts of an accepted page a prototype keeps; applied in this round's brief (F1 kept the item's fields). Whether it prevents the next miss is a hypothesis.

**Status:** prototype round 2 open, waiting on the owner's answers. A1 is not authorized.

#### Round 2 feedback (2026-10-04)

**Owner, on v2:** "alright, i like the work flow." The workflow in v2 (item framework, Draft → Ready by defining, actions in gated phases, needs on their action, orchestrator sidebar, per-action review, close-out) is accepted as the direction. Owner acceptance is of the interaction, from the prototype; nothing is built.

| # | Ask | Position | Where it goes |
|---|---|---|---|
| G1 | The previews were skeletal; don't lose the quality of the real code previews | Clarification | The prototypes stub the app on purpose. The built review keeps J6's live preview of the real build; A4 reuses it, not the mock |
| G2 | Page prototypes matter, not only the flow. Pages review actions should be like Pages' flow previewer (mockups, walked as a flow) with a clean Previous vs Proposed comparison. The interactive prototypes are essentially that kind of review | Required for the Pages review action | Proposal below; a prototype of the Pages review action is the next round |
| G3 | Could page mockups be HTML? Could Design's component demos be interactive HTML without built code, and Pages consume them? | Question | Proposal below |
| G4 | Mock the board: drop batches and Queue/Backlog for kanban columns; show it synced with Linear | Required | Work ecosystem prototype v1 |
| G5 | Routines: a formula that runs a kind of work item on a trigger | Required | Same prototype |
| G6 | Project management in the new setup | Required | Same prototype |

**Proposal for G2/G3 (not built).** Today Design's component previews and Pages' Spec view both draw through the portal's Angular renderer (`app-kit/kit-render.ts`), which uses the stack's real components. That ties every mockup to the portal's build, so nothing outside the portal can show one, and an agent can't hand one over as a file.
1. **Design publishes an HTML kit.** For each Design revision, the Design template generates one framework-free bundle: the tokens as CSS variables, and each component contract as a custom element (`<biome-button variant="filled">`) with its states. It is interactive (focus, hover, inputs, open/close) without the app's code. The Components tab renders demos from the same bundle. *Inferred, unverified:* Material Web (`@material/web`) implements the same Material 3 components as web components and could back the kit for Material stacks; its maintenance status needs checking before relying on it.
2. **Pages page specs become HTML documents** composed from that kit: a page is a file in Pages' repository (`pages/sign-up.html`) pinned to a Design kit revision, and its links and buttons carry `data-go="<page>"`. A flow is then a walkable prototype with no built code, which is what the prototypes in this record already are.
3. **The Pages review action is the flow walker:** steps down the side, the page in the middle as phone or desktop, and Previous (r3) beside Proposed (r4), each walked on its own as in J6. The same files show in the portal, an Artifact, or an agent's tools.
4. **Code review keeps the real build.** Once Code builds the pages, the journeys are walked on the preview build (J6), and a page's HTML mockup becomes the reference that review compares against.

Open: whether Design's kit is generated from contracts only, or can be extracted from the built app's components when they exist (EXISTING-PROJECTS-01's case).

### Work ecosystem prototype round (2026-10-04, Claude, cloud session)

Authorization: the owner's round-2 message ("maybe one more prototype, the broader work ecosystem focusing on board, routines, project management in this new setup"), within the A0 scope recorded above: a static prototype under `docs/design/agent-work/ecosystem/v1/`, its walkthrough and screenshots, records, commits and pushes to this branch and PR #4. Recorded before execution.

**Process first.** The parent-structure line added in round 1 applies directly here. *Kept from the accepted Work board* (`work-board.ts`, `layer-routines.ts`): one board for every layer's items, also shown filtered as a layer's Tasks tab; Create task; routines that stage an ordinary task and never open a second while the last is open; the built-in *Discover neighboring layers* routine; per-layer routines. *Replaced, at the owner's word:* batches, Next and the Queue/Backlog split (G4). *Purpose test:* columns are derived from item status; a routine is produced by a person, consumed by its trigger, anchored to the layer or project; a project is produced by a person (or synced), consumed by the board's filter and the project page, anchored to the workspace; sync settings are produced by the owner and consumed by the sync job. No unanchored container.

**References.** Named from prior knowledge and **not captured** in this session: Linear's board (workflow states typed backlog/unstarted/started/completed/canceled; issues with sub-issues, projects with milestones; agents can be delegated issues), Jira's board and automation rules (*When / If / Then*), GitHub Actions' trigger list. The routine editor borrows the *When / If / Then* formula shape.

**Readiness verdict: ready for a prototype.** Questions E1–E7 below. Included: the board with Linear sync, moving items between columns (and what each move does with an agent), a quick peek at an item, routines as formulas with runs, projects with milestones and planning with Claude. Excluded: the item page (v2 covers it), Jira (Linear stands for both), real two-way sync semantics beyond the visible rules, cycles/sprints, people other than the owner.

**Prototype:** [ecosystem/v1](ecosystem/v1/index.html), walkthrough [`ecosystem/v1/walkthrough.mjs`](ecosystem/v1/walkthrough.mjs), screenshots in `ecosystem/v1/shots/`.
- *Board:* five columns (Draft, Ready, In progress, In review, Done), each labeled with the Linear states it maps to; cards show the Linear id, priority, layers, assignee (Claude remote or Henry local), action progress, project, needs-you count, a live dot, and routine or Linear origin. Filters: Needs you, project, layer, assignee. A card opens a peek on the right (fields, actions with states, Move to, Open item).
- *Moves are the deliberate act:* a rough Draft to Ready asks to define it with Claude or mark it ready as is; an unassigned item to In progress asks Send to Claude or I'll work locally (`aludel claim`); Claude's item to In progress confirms Start; Claude's items can't be dragged to In review or Done (they get there through reviews and the orchestrator's close-out). Drag, the card's move menu and the peek's Move to do the same.
- *Linear:* a sync pill and a settings drawer (status mapping, field directions, actions as sub-issues, orchestrator thread and reviews stay in Aludel with a link back, latest edit wins per field). Events show a Linear-created issue landing in Draft and a Linear priority change shown on the item.
- *Routines:* a list (trigger, last run, on/off) and a formula editor (When, If, Create, Assign, Go as far as, one open at a time) that reads itself back as a sentence; Run now creates an item on the board; runs link to their items. New routines start off.
- *Projects:* cards with progress and target; a project page with milestones and items; Plan the rest with Claude proposes Draft items to add or drop; See it on the board filters by project.

**Questions for the owner (E1–E7, also in the prototype's Review questions):**
- E1 Are the five columns right, or should Triage or Canceled be their own?
- E2 Are the move rules right (define on Ready, confirm on Start, no dragging Claude's items to Done)?
- E3 Is the card carrying too much or too little?
- E4 Is the Linear split right (fields both ways, actions as sub-issues, the thread and reviews in Aludel)?
- E5 Is the When / If / Create / Assign / Go as far as formula clear enough to write one yourself?
- E6 Is "Go as far as" the right control for how much a routine does without you?
- E7 Are projects with milestones and Plan with Claude useful, or should projects stay plain?

**Checks (agent-checked, 2026-10-04).** `node docs/design/agent-work/ecosystem/v1/walkthrough.mjs`: NO ERRORS, 19 shots, 12 axe audits, at 1440×1000 and 390×844 with narrow overflow checks. First run: axe flagged `role="listitem"` on column sections and an `aria-label` on the live dot without a role, and the 390 px board clipped cards in a horizontally scrolled row; fixed by dropping the list roles, giving the dot `role="img"`, and stacking columns on phones. Screenshot review: the routine sentence lowercased "Claude" and the column header wrapped beside the peek; both fixed. Not checked: any Linear behavior (illustrative only), owner acceptance.

**Retrospective (this round).**
1. *Harder than necessary:* nothing new; the shared harness and v2's base CSS made this a build-and-check round. One class collision (`.proj` in the rail) cost a rename.
2. *What would help next time:* keep the base shell CSS as its own file the prototypes import, instead of copying lines from the last prototype by line number. Hypothesis; not done, because published Artifacts need the CSS inline.
3. *Roadmap:* routines and projects become part of AGENT-WORK-01's surface; Linear sync is a new integration (an external write) that needs its own packet and the owner's go before any real connection.
4. *Questions:* E1–E7 created; G2/G3's HTML kit question is open and blocks nothing in A1, but shapes the Pages review action (A4).
5. *Process change:* none new. The round-1 parent-structure line was applied (kept versus replaced parts named above) and held: nothing from the accepted board was dropped without the owner's word.

Status: waiting on the owner's answers to Q1–Q8 (v2) and E1–E7 (ecosystem v1).

### Pages review action prototype round (2026-10-04, Claude, cloud session)

Authorization: the owner's message "prototype pages." after the offer to prototype the Pages review action (G2, with G3's HTML kit), within the A0 scope recorded above: a static prototype under `docs/design/agent-work/pages-review/v1/`, its walkthrough and screenshots, records, commits and pushes to this branch and PR #4. Recorded before execution.

**Process first.** G1 showed that the A0 prototypes' skeletal app frames were read as the intended review quality. Applied now: [the operating procedure](../process/operating-procedure.md) §5 item 1 says that when the owner will judge an app's own pages in a prototype, they are drawn from the app's recorded look and the source is named, and stand-in mocks are labeled. Tested by this round: the mockups are drawn from Biome's recorded screens ([initial setup](../../evidence/biome-review/initial-setup.png), [populated world](../../evidence/biome-review/populated-biome.png)) and Biome's recorded flow (marketing → signup → initial setup → world). *Kept from Pages' accepted Flows view* ([PAGES-UX-01 M11/P9](../../evidence/pages-ux-01-pages-layer.md)): steps with thumbnails down the left, the page in the middle with phone or desktop, notes on the right, and its four note kinds (looks right, content fix, change request, question). *Changed:* the review is an action's review inside a work item (v2), so it adds Previous beside Proposed and Approve or Request changes on the action.

**Readiness verdict: ready for a prototype.** Questions P1–P6 below. Included: one persona's flow (New visitor joins), r3 beside r4 with step badges (new, changed, same, removed), highlight changes, walking by clicking inside the mockups, pinned notes, approve after walking the changed steps, request changes and one revision round, View source of a page, and the kit's live component demos. The mockups are HTML pages built from a separate `biome-kit.js` (custom elements, no app build) to test G3 in practice. Excluded: the Built view (it needs #4's build; shown disabled), editing pages, desktop and phone differences beyond layout, other personas' flows.

**Prototype:** [pages-review/v1](pages-review/v1/index.html), walkthrough [`pages-review/v1/walkthrough.mjs`](pages-review/v1/walkthrough.mjs), screenshots in `pages-review/v1/shots/`. The pages are [`pages.js`](pages-review/v1/pages.js) (one HTML string per page file and revision) made only of tags from [`biome-kit.js`](pages-review/v1/biome-kit.js) (tokens and nine custom elements, about 90 lines, no framework).
- *Compare:* Previous (r3, accepted) beside Proposed (r4), or either alone; phone or desktop (desktop stacks the two frames); Mockup, with Built disabled until #4. Steps carry New, Changed, Same or Removed (Log in is no longer a step for a new visitor), and a new page shows "Not in r3" on the previous side.
- *What changed:* Highlight changes outlines new (green), changed (amber) and removed (red, on the previous side) elements, and the step's change list flashes each one.
- *Walk:* buttons inside the mockups follow the flow; fields can be typed in. Approve waits until every new or changed step has been seen.
- *Notes:* Add a note, click the part of the page, pick the kind (Pages' content fix, change request, question; Looks right is its own button). Request changes sends them to #1; Claude's revision r5 opens round 2, compared by default against r4 (your last review) with r3 one click away, the changed step marked "Changed since your notes", and the note showing Claude's reply.
- *G3 in practice:* View source shows the page file as kit tags; the Kit drawer shows the same elements as live component demos, which is what Design's Components tab would render.

**Questions for the owner (P1–P6, also in the prototype's Review questions):** P1 side by side with step badges, or flip or overlay? P2 is Highlight changes enough to see what changed? P3 should Approve wait for every changed step to be seen? P4 do pinned notes and round 2 against your last review work? P5 are kit-built HTML mockups close enough to the real app to approve flows before code? P6 should View source and the kit be visible in review?

**Checks (agent-checked, 2026-10-04).** `node docs/design/agent-work/pages-review/v1/walkthrough.mjs`: NO ERRORS, 12 shots, 9 axe audits, at 1440×1000 and 390×844 with narrow overflow checks. First run: two walkthrough mistakes (expected a card on Marketing, which is a hero; clicked Kit under the open Source drawer), fixed in the walkthrough. Screenshot review: desktop side by side scaled pages to a quarter (now stacked), the note marker covered the first words (now at the element's top-right corner), and the removed step read "–. Log in"; all fixed. Not checked: owner acceptance; whether a generated kit can match a real app's components (the kit here is hand-drawn from Biome's screenshots).

**Retrospective (this round).**
1. *Harder than necessary:* nothing blocked; reading Biome's recorded screenshots first was what made the mockups look like the app, not effort spent on CSS.
2. *What would help next time:* the new §5 item 1 line. Applied and tested once here (the mockups match the [recorded setup screen](../../evidence/biome-review/initial-setup.png)); whether it prevents skeletal mocks in other hands is a hypothesis.
3. *Roadmap:* if the owner accepts P5, the HTML kit is a Design-layer deliverable and the page file a Pages-layer output; that changes Pages' Spec view (currently Angular-rendered) and belongs in its own packet before A4.
4. *Questions:* P1–P6 created. The open G3 question (generate the kit from contracts, or extract it from built components) is now more important, because the review's credibility rests on the kit matching the app.
5. *Process change:* operating procedure §5 item 1 (real look for the owner's own pages, stand-ins labeled), applied and checked by screenshot comparison in this round.

Status: waiting on the owner's answers to Q1–Q8 (v2), E1–E7 (ecosystem v1) and P1–P6 (Pages review v1).

### Implementation plan (2026-10-04, Claude, cloud session)

Owner, after the Pages review prototype: "alright, i like it. whats it going to take to make this all happen? plan it out, big shift from current modality". Authorized: the plan only. Written as [plan.md](plan.md) from an inventory of today's code (work items, batches and Go, Symphony runs, review, person runs, routines, layers, rendering, integrations, tests). The prototypes' interaction is accepted as the direction ("i like it"); answers to Q, E and P questions are still welcome but no longer block planning. Process: the plan lists what stays (parent-structure rule) and makes each prototype's walkthrough the acceptance journey for its slice. Next: the owner's go on A1 and decision D1 (API spending) before A2.

### Meta-analysis (2026-10-04)

Owner asked how this thread compares with the system it designs. [meta-analysis.md](meta-analysis.md): six streamlining proposals (local dogfood before the remote runtime, scripted scenarios in Pages, Aludel's own kit, lighter round notes, questions in the reply, one source per fact), none applied until the owner chooses.

**Owner, on the meta-analysis (2026-10-04):** chose *Local first* on the decision card; "love that dogfooding. yeah, pages, the flows, we want the same kind of scripting we have here. do journeys branch if something goes wrong, e.g.? the main problem with the question panels is they were too leading … when reviewing page and flow prototypes, etc, just being able to flag and say i want something different is enough." Applied: [plan.md](plan.md) reordered (A1 → A3 → A8 → A4 → dogfood, then A2 and A5); A7 gains scripted scenarios and branching flows (each path its own same-persona journey) and flag-and-say review; [operating procedure](../process/operating-procedure.md) §5 item 5 drops confirm-what-was-built question panels. Journeys today are one straight path per persona; failures exist only as page states (inferred from the journeys and PAGES-UX-01 records; no branch construct found). The other two proposals (three-line round notes, one source per fact) wait on the owner.

### Build authorization (2026-10-04)

Owner: "yep, go ahead and build." (answering whether to adopt the two remaining process changes, after the local-first decision). Authorized: (1) the process changes, applied in AGENTS.md (three-line round notes, full retrospective at packet or slice close; one source per fact, status.md one pointer line); (2) building the plan's local-first critical path, slice by slice: A1 work model and Aludel MCP server, A3 item page, A8 local CLI, A4 per-action review, as host code, tests, records, commits and pushes to `claude/agent-work-prototype-7en0jx` and PR #4. Not authorized: spending or an Anthropic API key (D1, A2), Linear or other external writes, pushes to `main` or `layer-base` template branches, deployment, live owner data. Recorded before execution.

### A1 round note (2026-10-04)

- **Changed:** goal work items (`server/agent-work.mjs`): phases with review gates, actions on layers, needs (questions, allow requests, approvals of new actions) on their action, one thread, one changeset staged across layers through each layer's API. Portal routes `/api/projects/:id/goals…` with a live stream (server-sent events); the editor token now carries one write authority: its person's local agent working a goal item that person claimed. `tools/editor-mcp.mjs` gains twelve work tools (`work_list` … `changeset`). Fixed `stageOperation`'s sequence query to name its project (it failed for any key without a Symphony attempt).
- **Checked:** `tests/agent-work.test.mjs` (model, gates, needs, approvals, moves, stream; Design and Product staged into one changeset and read back with templates on; the real portal driven by a person and the stdio tools). `npm run test:server` 307 pass (baseline 304) and `test:server:templates` 333 pass (baseline 329); the same three tests fail before and after (layer merge, template update, worker token scope), unrelated to this change.
- **Differs from the plan's A1 exit:** the changeset holds layer records; Code files stay in the local checkout the agent edits (A8), and Check on the changeset moves to A4 with close-out. MCP over HTTP waits for A2. Nothing waits on the owner.

### A3 round note (2026-10-05)

- **Changed:** goal items open on a new page (`src/layers/work-goal.ts`), laid out like the a0/v2 prototype: brief and work style on top, actions in phases with review-gate notes, questions, allow requests and new-action approvals answered on their action, the changeset staged so far grouped by layer, and the thread beside it (narrowed to one action by Details and log) with a steer box. It refetches on each notice from the live stream. The Work composer gains "Goal across layers". Until A4: a person marks a ready action done or sends it back; "Send to Claude" is disabled until A2.
- **Checked:** typecheck and build; `tests/agent-work-browser.mjs` drives the page while a scripted local agent (no model) works the item through the editor API: create, define, claim locally, agent phases it, start, a live question and approval, answer, a staged change in Design and Vision, steer, send back, gate held then cleared, move to review; axe clean and no sideways scroll at 1440 and 390 px. Screens in [a3/](a3/). A3 changes no server code. `test:server` 307 pass with the same three known failures. `test:server:templates` in the full run: `symphony-proposals.test.mjs` hit the 300 s file timeout and `security-audit-worker.test.mjs` failed one test ("portal restarted after report submission"); rerun alone, both files match the baseline exactly (36 pass, the two known failures). Seen on this restarted machine only; a timing problem under full-suite load is inferred, not shown.
- **Waits on the owner:** nothing; flag anything on the screens you want different.

### A8 round note (2026-10-05)

Owner, before handing over: "if you want to implement here then we switch once finished is probably cleanest". Same authorization; A8 and A4 are built here, then the dogfood moves to the owner's local Claude Code.

- **Changed:** `tools/aludel.mjs` (`pair`, `list`, `claim`, `status`, `submit`). `claim` assigns the item to you and adds the Aludel server to the checkout's `.mcp.json` (kept out of commits). `submit` reports the branch's committed code. The MCP adapter gains `report_code`, which reads branch, commit and changed files from git in the checkout, and its instructions now give the orchestrator's working rules. The shared connection code moved to `tools/aludel-client.mjs`. Server: editor tokens can claim (the person's own CLI; the agent's tools don't offer it), list claimable items, and report code. Only names and hashes are stored. The page shows the reported branch and files beside the staged records. How to: [local-work.md](local-work.md).
- **Checked:** a new test runs the CLI against a real portal and a throwaway git checkout: pair, list, claim, `.mcp.json` and exclude, define via the tools, start, `report_code` refusing uncommitted work then reporting, `submit`, `status`. The browser journey shows reported code. Unit and editor tests pass; both suites: see the commit.
- **Not done:** previews of the local branch (the plan's "same previews") wait for A4's review, which builds the branch.
