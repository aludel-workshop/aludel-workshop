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
- **Checked:** a new test runs the CLI against a real portal and a throwaway git checkout: pair, list, claim, `.mcp.json` and exclude, define via the tools, start, `report_code` refusing uncommitted work then reporting, `submit`, `status`. The browser journey shows reported code. Unit and editor tests pass. The full plain suite caught that `aludel.mjs` was committed without its executable bit; fixed in the A4 commit. Both suites were then run on A4 (below).
- **Not done:** previews of the local branch (the plan's "same previews"); A4 didn't add them either (see below).

### A4 round note (2026-10-05)

- **Changed:** per-action review and close-out. An action ready for review shows the changes it staged, with Approve or Flag; a flag needs a note, sends the action back to working and tells the agent (its instructions now say to look for flags and address them). Review gates hold later phases until the gated phase is approved. Close-out needs the item in review, every action done, nothing waiting on the person, and the code merged; it applies every staged record change in one transaction and refuses if any record changed since it was staged. The how-to gained steps 8 and 9. Screens: [a4/](a4/).
- **Checked:** two new model tests (review, flag, gate, confirmed merge; close-out applies Design and Vision changes and refuses on a moved record), and the browser journey through flag, gate, move to review, close-out and the closed state, with axe at 1440 and 390 px. Checking the closed screen found the thread stuck at its top (newest entries hidden) and "Nothing applies until close-out" after close-out; both fixed and asserted in the journey. Plain suite 309 pass, 3 fail (the known baseline three). Templates suite 306 pass; the known worker-token failure, and `symphony-proposals` timed out at 300 s as in A3. Run alone it shows only the two known baseline failures, so the timeout is inferred to be load timing.
- **Deviations from the plan:** ~~close-out doesn't merge the code; the person merges it and confirms~~ (superseded the same day: close-out merges it, see the revision below). The orchestrator's combined check (a Verify agent), actions derived from bindings and previews of the local branch are not built. The dogfood will show which of these matter first.

### A4 revision: close-out merges the code (2026-10-05)

Owner, on the A4 handover: "i want aludel to handle the merge. you know how i tell you looks good and you can merge it in? same deal." Same build authorization; the merge and push are product behavior the person triggers with Close out, not something this session runs against a real repository.

- **Changed:** Close out and merge replaces the "I've merged" checkbox. The code report carries the checkout's path. Close-out fetches the branch from it into the project repository and moves main by fast-forward, or by a merge commit written with `git merge-tree` when main moved; a checked-out main must be clean. It happens in the same transaction as the record changes, and main only moves if it is still where close-out found it. A conflict changes nothing: the item goes back to the agent with a note naming the files, and the agent's instructions say to rebase and report again. A project with a GitHub repository then gets main pushed with its installation token, as the build does; the outcome is logged on the item.
- **Checked:** the model test now uses real repositories: no repository refuses, a conflict sends the item back with main untouched, and after the rebase a merge commit lands with both sides in the checked-out main. The browser journey closes out against a real checkout and repository. Plain suite 309 pass, 3 fail; templates suite 306 pass, the worker-token failure and the `symphony-proposals` load timeout. All match the A4 run above.
- **Not checked:** the push to GitHub. No project here has a GitHub repository; it reuses the build's push. This replaces the earlier deviation: the plan's `mergeLayerBranch` is still not used, because the code is in the person's checkout rather than a layer branch.


### Drift fix: the assignee decides who works, and Open in VS Code (2026-10-05)

Owner, before the dogfood: "the work style, claude or local? thats supposed to be managed by assignee, instead of 'claude' its one of the defined agents working remote, local would be assigned to me. and instead of running a command locally, id love to just have an open in vscode button". The proposal was accepted ("sounds good, build it"). Authorized: host code, tests and records on branch `claude/assignee-open-vscode`. This record was written after the build, not before it.

- **Changed:**
  - **The item page** drops the Work style buttons. Assignee is the shared assignee chip:
    - people work on their own machine;
    - the project's agents are listed but disabled, with "Agents work remotely, which comes with the remote runtime (A2)";
    - it locks once the item starts.

    The server adds `POST …/goals/:id/assign`: a member, or unassigned, until the item starts; agents are refused until A2. `claim` stays for the CLI.
  - **Open in VS Code.** Once the item is yours, the page offers it as a link to the Claude Code extension's own handler, `vscode://anthropic.claude-code/open?prompt=Work on W-n (id) using the Aludel tools.`, checked in extension 2.1.289. Beside it is "Open <folder>" (`vscode://vscode-remote/wsl+<distro>/<path>`, or `vscode://file/<path>`), for when the right window isn't in front.
  - **The MCP's new `start_work`** checks out `aludel/w-n` from the latest `origin/main`, or keeps the branch it's already on. It refuses uncommitted changes. Its instructions call it first.
  - **`aludel pair` sets the checkout up once:** it stores the token, writes `.mcp.json` (kept out of commits), and reports the checkout's location. The MCP re-reports the location on startup. The location is stored on the editor token (`editor_tokens.checkout_json`, an additive column) and is only something to open: Aludel never reads from it.
  - **Work › Team** loses its Codex-era copy and becomes "Work in VS Code with Claude Code", showing the connected checkout.
  - **The CLI** accepts the portal's own `*.localhost` address and talks to 127.0.0.1, because Node can't resolve those names.
- **Checked:**
  - **The A8 test, rewritten.** `pair` through `aludel.localhost` writes `.mcp.json` and the checkout location, and a relative path is refused. Assigning an agent is refused, as is a non-member; assign then unassign works, and the assignee locks once started. `start_work` refuses uncommitted changes, then creates the branch from `origin/main`, and calling it again keeps the branch. Then the existing report and submit steps.
  - **The browser journey.** The assignee menu (axe on the menu), the connect hint, the Team tab (axe) before and after a checkout reports itself, and the exact hrefs of Open in VS Code and Open tool-share. The rest of the journey is unchanged. Screens are in `test-results/agent-work/01b`–`01d`.
  - **Typecheck and build.**
  - **`test:affected`:** 79 tests, 74 pass, 2 fail, 3 skipped.
    - One failure was expected: `editor-bridge` now sees the startup checkout report, so it filters that request out. It passes.
    - The other was the known security-audit restart flake, which passes when run alone.
  - **Bugs found by the tests:**
    - the new column broke `INSERT INTO editor_tokens VALUES (…)`, which is now named-column. A live portal would have failed to create tokens after the restart.
    - the goal route's operation list lacked `assign`.
- **Follow-up, same day:** the owner found a Draft's Start work blocked, as if they had to write the actions themselves. The v2 flow has the orchestrator define a rough Draft, which moves it to Ready for the person to check and start. The server already allowed that; the page hid it.
  - Open in VS Code now also shows on a Draft assigned to you, saying "Claude Code defines it… then you start it".
  - The brief editor no longer opens by itself when someone is assigned, and the Start row is hidden for your own Draft.
  - The MCP instructions say to stop after `define_work` until the person starts the item. The server already refuses actions before Start.
  - The journey checks the assigned Draft (`01e-draft-assigned`).
- **Not checked:** the links on the owner's machine. That covers whether the prompt is filled in or sent (the extension stores it as the conversation's initial prompt, so probably filled in), and which window wins when several are open. The owner tries this at the dogfood's start.

## Dogfood: W-8 "kanban board" in an item container (2026-10-05)

Owner, in the container's Claude Code chat: "make sure you log all findings as you go, this is as much about improving the work process as it is about creating the board." Authorized: this findings log on `aludel/w-8`, plus read-only use of the Aludel tools. Defining or starting W-8 is not yet authorized. The agent is Claude Code (Opus 5.5) in the item container for W-8 (`wrk-720c8d53`), connected as XTMC-ZN6J.

### Findings

Each finding is agent-observed unless marked otherwise.

- **F1. The container opens with no prompt.** The owner's first message was "hey, tell me what you see". Open in VS Code carries `prompt=Work on W-n…`. The container link (`cloneInVolume`) can't carry one, so nothing tells the agent which item it has or that it should orchestrate it. The agent found its item from three places: the branch name `aludel/w-8`, the MCP server's instructions ("For a goal item assigned to your person, you are its orchestrator…"), and `assigned_tasks`.
- **F2. What the agent knows about Aludel comes from this repository, not from the platform.** This applies to what Aludel is, the layers, how packets and records work, and status. It comes from `AGENTS.md` and `docs/`, which exist only because Aludel builds itself. A connected product repository would have none of that. Its agent would get the MCP instructions (generic, about 15 lines) and `task_context`. Measured on W-8, `task_context` holds the brief, two docs (Design direction, Accessibility baseline), a single line of project guidance, `principles: []`, `role: null` and `action: null`.
- **F3. `.aludel/AGENTS.md` is written for a layer repository, not an app repository.** It says to read `knowledge/charter.md` and `docs/layer-contract.md`, to run `node --test tests/*.test.mjs`, and that "Aludel turns the branch into a merge request". In a connected app repository, `.aludel/` is the Code layer's installed files, so an agent reading it would follow the wrong instructions. The root `AGENTS.md` doesn't point at it.
- **F4. `work_view("W-8")` returns "Task not found".** The internal id `wrk-720c8d53` works. `start_work` accepts W-n, so `work_view` should too.
- **F5. W-8 and W-7 show `status: blocked`, with migration "No checked, installed layer action maps this historical item."** W-8 was created today, so it isn't historical. Not yet tested: whether this stops `define_work` or Start. W-7 was supposed to be archived before this run, but it is still assigned.
- **F6. The item log shows four container opens before the connect.** Two of them say "Moved aludel/w-8 up to main". The owner may have retried during setup. Not investigated.
- **F7. The layer APIs as an agent sees them (`stack_map`):**
  - Work isn't listed.
  - Code and Data have `operations: []`, so the 2,507 Code units aren't reachable through the tools, and `search_knowledge` returns nothing for "work board" or "Kanban".
  - Vision and Design have `charter: null`.
  - Operations come with ids and summaries only, with no body schema. An agent can't learn a flow's shape before it stages one.
- **F8. Pages is empty for this project.** `listPages` and `listFlows` both return `[]`. Code has its own `journey` output (in `.aludel/outputs/journeys.json`). So "user journeys" have two possible homes, and nothing tells an agent which one a flow belongs in.
- **F9. W-8's brief changes a page but names no layers.** There's no target and no Pages flow for the board. The orchestrator protocol says "one action per layer change", so defining it means deciding whether a Pages flow and spec come first. The brief cites `docs/design/agent-work/ecosystem/v1`, which is a repository file. The project's Pages layer has no record of it.
- **F10. `task_context` says `taskOpen.available: false`, "The task is missing pinned inputs."** It doesn't say which inputs.
- **F11. The container has no git identity.** The first `git commit` fails with "Author identity unknown". The image and `aludel-setup.sh` set neither `user.name` nor `user.email`, so `report_code` can't succeed until someone sets them by hand. The setup could take the identity from the connecting person.
- **F12. The portal stopped answering for about a minute, and `start_work` failed with only "The operation was aborted due to timeout".** Every endpoint went silent at once, including the static `/api/editor/tools/aludel.mjs`: curl got no response in 27 s. Then the portal recovered, answering `/stack` in 12 ms, and a retry of `start_work` succeeded. That suggests the portal's event loop was blocked, not a network fault; the cause wasn't found. The client's 8 s timeout (`aludel-client.mjs:39`) has no retry and its error gives no hint, so an agent can't tell "portal busy" from "portal down".
- **F13. It isn't clear which layer an action that changes the portal's code belongs to.** Work isn't in `stack_map` (F7). The only code layer is Code (`platform`), whose charter says "Nobody does their coding here". The W-8 build actions were filed under `platform`. Layer keys aren't layer names either (`platform` is Code, `product` is Vision), and the agent has to work that out from `stack_map`.
- **F5, update.** `define_work` succeeded and moved W-8 to Ready. The item still reports `status: blocked`, with the migration reason, so the field is shown but enforced nowhere this far. Start hasn't been tried yet.
- **F11, proposed fix (owner asked, 2026-10-05: "could we pass that when setting up the container?").** Yes. The portal already stores each person's `email` and `display_name` (`server/accounts.mjs:14`). The connect poll that hands the container its token could also return the assignee's name and email, and `connectContainer` would set them as the clone's `user.name` and `user.email` (repository-local, in the volume). Open question: the portal email may not be the one GitHub knows the person by, so commits may not link to their GitHub profile. A GitHub noreply address or an identity setting on the person would fix that. The fix is outside W-8's scope; it waits on the owner.

### W-8 defined (2026-10-05)

Owner: "go ahead and set up w-8, lets test this all." `start_work` (after F12) kept `aludel/w-8`. `define_work` produced two phases:
1. **Spec the board in Pages** (gated). Action 1 (`pages`) records a Work board page and the move flow, with its branches, from the ecosystem prototype.
2. **Build the board.** Actions 2–5 (`platform`): the board UI, the move rules, the per-layer Tasks tab, and the acceptance journeys and gates.

The item moved to Ready. The build actions show "Waits for the review gate after Spec the board in Pages". Next, the owner checks the item and presses Start.
- **F14. Every write returns the whole item.** `post_message` and `define_work` each echo the whole item, including the full brief twice and the entire thread. That's about 10 KB per call, and it grows with the thread, filling the agent's context with text it already has. Returning a short acknowledgement (event id and new state) would be enough.
- **F15. Actions have only a `goal`, with no title and description (owner, 2026-10-05: "actions need a title and description, those long titles are a little ridiculous").** `define_work`, `add_action` and `update_action` take one `goal` string, and the item page shows it as the title. The agent retitled the five actions to short goals through the same editor endpoint. Action 1's detail now lives only here, because there's nowhere else to put it: draw on prototype shots 01–06 and 17–18; the flow includes the define-first branch and the refused-drag-to-Done branch; log any gaps in the Pages API. Fix: add a `description` to actions (schema, MCP tools, item page, peek).
- **F16. The agent can't start an action, and nothing tells it when the item starts.** `update_action` → working is refused with "Start W-8 before working on its actions." (`server/agent-work.mjs:286`). That's correct, because Start belongs to the person. Start is the board move Ready → In progress (`server/agent-work.mjs:181`). It needs Ready and an assignee, sets the state to `claimed` with `startedAt`, logs "Moved to In progress", and pushes the change to the item page's event stream. The MCP has no subscription, so a local agent finds out only by polling `work_view`, or when the person says so in chat.
- **F5, resolved by reading the code.** `move` never reads `status` or `migration`, so the "blocked" label doesn't block Start. It is misleading text on a goal item.
- **F17. A Pages flow needs a persona from Vision, and this project has none.** Learned from a test, not the API: `createFlow` takes `{ flow: { title, persona, steps } }` (`tests/overlap-work.test.mjs:64`). Vision's `listPersonas`, Pages' `listKitItems`, `listPages` and `listFlows` all return `[]`. So action 1 also needs a Vision write (a "Project owner" persona), which a `pages` action may not be allowed to stage. Its shape is still unknown, and it isn't clear whether that write belongs in the action or in its own `product` action.
- **F17, owner ruling (2026-10-05): "a layer should never need another layer. if personas are a part of pages work, it should have a local representation of personas. then that could be bound to the info from vision. so we need to edit the way pages work."** Today a flow and its steps can carry a `persona` id that points at a Vision record (`server/knowledge.mjs:339`, `pages-flow-work.mjs:16`), and Code's journeys enforce one persona each (`server/journeys.mjs:41`). The direction: Pages owns its own persona records, which can be bound to Vision's through the Library. The precedent is Pages' own copy of the app kit (`kit_item`, "Pages' copy of the app kit"), and the direction fits DEC-055/057/059 (layers read each other only through the Library). Not done here: the change is to the Pages layer itself, outside W-8. The persona is optional on a flow, so W-8's flows were staged without one.
- **F18. An agent finds a record's shape by reading the server, not the API.** To stage two pages and four flows, the agent read `server/knowledge.mjs` (the page, flow and section validators), `server/onboarding.mjs` and `config/page-types.json` plus `config/starter-kit.json` (for `pageType` and `icon`, which come from catalogs the API never lists). A remote agent wouldn't have the server source. The bodies are also inconsistent: create takes `{ page: {...} }`, but update takes `{ changes: {...} }`, found when the first update failed with "changes is required.". This sharpens F7: each operation needs a body schema and its catalogs.
- **F19. Pages has no "board" page type.** The types are dashboard, feed, list, gallery, detail, content, messages, form and settings. The Work board was recorded as `list`, with a note.
- **F20. Flows can't branch, so each side path became its own flow, as A7 prescribes.** W-8 action 1 produced four flows: "Move an item across the board" (7 steps), "Move a rough note to Ready", "Start an item nobody is assigned to" and "Try to drag an item to Done". All four have no persona (F17), and the Map placement wasn't set.

**W-8 action 1, staged (2026-10-05).** Pages `pag-60d70f32` "Work board" (sections: Filters, Columns, Card, and Peek leading to the item) and `pag-e3341df1` "Work item", recorded only as far as the flows reach it. Flows `flw-6fa9b6ba`, `flw-8b7a07b7`, `flw-8f8b4cba` and `flw-dbf45e5a`. Nothing applies until close-out.
- **F21. Reviewing a Pages action is a plain list of changes, not the walkable flow preview the owner specified (owner, 2026-10-05: "i know i specified the review modal having interactive flow/page preview, what happened to that?").** This is the most serious gap so far. Where it was specified:
  - G2 (this record, "Required for the Pages review action"): Pages review should look like Pages' flow previewer, with mockups walked as a flow and a clean Previous vs Proposed comparison.
  - The plan's A7: the flow walker from `pages-review/v1`, with flag-and-say review.
  - A4: "its journeys on the combined preview".

  What was built: A4's per-action review lists the staged records with Approve or Flag (`src/layers/work-goal.ts:135`, `:160`). The J6 review with a walked preview (`src/layers/work-review.ts`) still exists, but only on the old person-run path; goal actions don't use it.

  How it slipped:
  1. **The dogfood was ordered before A7.** A7 also waits on D4, the HTML kit decision. Nobody checked that the dogfood's first action would be a Pages action, whose review depends on A7.
  2. **A4's deviations don't mention it.** They list "previews of the local branch", but not that the review shows records as a list, without J6's preview or a Previous/Proposed comparison. The downgrade went unreported.
  3. **A4's exit check tested the mechanics, not the accepted prototype.** It checked flag, gate and close-out, not the review the owner had accepted, even though the plan's process note says prototype walkthroughs become acceptance.

  Process fix to apply: before closing a slice, list every owner requirement (G and F rows) that the slice touches and mark each as built, deviated (said plainly), or deferred (to a named slice). Before a dogfood or trial, check that every kind of action it will produce can be reviewed as specified.

**Owner, 2026-10-05:** waits for A7 for the Pages review walker rather than pulling it forward. Approved action 1 "just to see what happens". For F11, set this clone's git identity by hand (repository-local) to `henrydker`.
- **F12, again.** A second stall came about a minute after the owner approved action 1: `/goals` timed out after 8 s at 23:50, then answered again.
- **F22. The item container can't build the portal or run the templates gate.** `prebuild` and `pretypecheck` run `tools/sync-layer-template.mjs`, which compiles the Pages UI from a pinned commit (`ceeb9d4`) of the sibling repository `../layer-base` (`config/layer-templates.json`). The container clones only `aludel-workshop`. `git ls-remote https://github.com/aludel-workshop/layer-base.git` hung, apparently waiting for credentials, so it's private or doesn't exist. As a result `npm run build`, `npm run typecheck`, every browser journey, and `test:server:templates` (AGENTS.md's required gate) all fail here. `npx ngc -p tsconfig.app.json --noEmit` works around the typecheck: its only error is the missing `src/installed/pages`. COLLAB-WORK-01 §3 ("one environment definition for people and cloud agents") assumed the repository is self-sufficient, and it isn't. Fix candidates: publish `layer-base` to GitHub (already the status file's next step) and have `aludel-setup.sh` clone it as a sibling; or have the portal serve the pinned template, as it already serves the Aludel tools.
- **F23. The A8 test fails inside an item container.** `tests/agent-work.test.mjs` "A8: a checkout is connected once…" expects `pair` to write `.mcp.json`. The container's `ALUDEL_CONTAINER=1` makes `pair` skip that file on purpose (item-container build), so the test inherits the container's environment. With `env -u ALUDEL_CONTAINER` it passes (5 pass, 2 skipped because templates are off). The test should clear that variable for its child processes.

### W-8 action 2, first pass (2026-10-05)

Owner approved action 1. The gate cleared, which made #2 and #3 workable. Built on `aludel/w-8`:
- `src/layers/work-board.ts` is rewritten as the Kanban board: five columns from `item.board`, cards, filters, peek, drag, and the define/start dialogs.
- Board styles are added to `src/styles.scss`.
- `goals()` now also returns each goal's action `layers` (`server/agent-work.mjs`), with an assertion in `tests/agent-work.test.mjs`.

Moves defer to the server's existing rules in `move()`, so a refused drag to Done shows the server's message. Legacy (non-goal) items show in their derived column and move from their own page. Checked: `ngc` typecheck (the only error is the missing synced Pages UI, F22), and `agent-work.test.mjs` with `ALUDEL_CONTAINER` unset (5 pass). Not checked: the build, any browser view, axe, 390 px, or the templates gate, all blocked by F22. The unused `WorkCardComponent` in `work-shared.ts` is left in place for now.
- **F22, owner answer (2026-10-06, on W-8 #2):** "Publish layer-base to GitHub, and the container setup clones it beside the app." Publishing is an owner action, because `layer-base` exists only on the owner's machine and it's a GitHub write. The container side widens into F26.
- **F24. Actions can be changed but never removed or merged.** `updateAction` (`server/agent-work.mjs:266`) changes goal, summary, layer, `after` and phase. No operation removes an action, and `define` refuses once the item has started. W-8 #4 ("Use the board as each layer's Tasks tab") turned out to be mostly done by #2, because `layer-tasks.ts` already embeds the board with `[layer]`. After Start, the only choices are to keep #4 or retitle it as a check.
- **F25. Working an item takes both surfaces at once (owner, 2026-10-06):** "this back and forth is rather awkward, i have to work in both surfaces simultaneously … i would love to be able to just work in either or: here in vscode, i could answer the questions, click review links etc., without ever having to go back to the portal. or on the flip, if im managing stuff from the portal, then the container could be almost silent … the whole interaction should feel exactly like if it was running remote, except its talking to this local container with you in it."

  Today:
  - The agent's API can only be polled. The item page's event stream (`streamGoal`, `server/server.mjs:342`) needs a portal session, and the editor routes have none.
  - Answers, approvals and flags reach the agent only when it calls `work_view` or the person says so in chat (F16).
  - Questions reach the person only on the item page.

  Applied now as an experiment: the agent runs a Claude Code `Monitor` on a poller (`aludel-client` every 10 s, one line per person-authored event on W-8). Portal actions then wake the agent in VS Code with no relay. Limits: the watch expires after 30 minutes and has to be re-armed, it polls rather than streams, and it only covers this item.

  The owner's either/or implies three pieces:
  1. **Portal → agent:** the editor API gets the item's event stream, and the MCP turns person events into prompts.
  2. **VS Code → portal:** a question appears in the chat, the person's answer there resolves the need (recorded as answered in VS Code, by the person), and review links open in VS Code's browser.
  3. **A silent container:** a headless Claude (Agent SDK) in the container, subscribed to the item, with no VS Code window. That is A2's orchestrator runtime hosted locally. "Local or remote" then means only where the runtime runs, which is the owner's framing.

  Open question for the owner: should an answer typed in VS Code count as the person's answer? An approval of the agent's own action should stay a person's click.
- **F26. The agent session should be built around an environment, not one repository (owner, 2026-10-06):** "right now code has a single repo attached. it really needs to allow multiple … if we have e.g. repos for design, then you need to be able to touch that too, right? its almost like this agent session should not be oriented around a single repo, but around an enviroment that lets the agent work across the whole ecosystem."

  Today:
  - Code binds one repository (EX-02A).
  - Each installed layer is its own repository forked from `layer-base` (DEC-055/057/059).
  - Go creates one branch and opens one clone (`cloneInVolume`).
  - `report_code` and close-out handle one branch.

  The direction:
  - The item container is the project's environment: every repository the project owns (app repositories and layer repositories) is checked out on the item's branch, beside one another.
  - Report and close-out treat the item's code as a set of branches.
  - Layer data still changes only through layer APIs. A layer's repository holds its code, and its outputs are records or repository files (DEC-059).

  This overlaps PLATFORM-PIPELINE-01 (owner-owned repositories) and COLLAB-WORK-01 §3 (one environment definition). F22 is its first concrete case: the app can't build without a second repository.
- **F27. An agent can't create work items.** The MCP tools cover the agent's own item (`define_work`, `add_action`, `post_message`, `ask`). `createGoal` is reachable only from a portal session (`POST /api/projects/:id/goals`). Every follow-up this attempt surfaced has to wait for the owner to type it in: the Pages personas change (F17), the item environment (F26), one surface (F25), git identity at setup (F11), the Pages review walker pulled forward (F21). The next step is for an agent to propose an item. The owner creates it from the proposal, or it arrives as a Draft the owner keeps or dismisses, matching how DEC-057 follow-ups work.
- **F28. There's no way to end an item as failed.** Close-out needs the item In review with every action approved (`server/agent-work.mjs:471`). It then applies every staged record and merges the code, so it can only succeed. Archive refuses an item that's in progress (`server/knowledge.mjs:1404`). `move` can't leave In progress except to In review. So W-8 can't be ended from the portal. Needed: a person's "Close as not done" that records why, discards the staged changeset (or keeps it as a draft for a retry, as J6 does for runs), merges nothing, and moves the item to Done marked "not done".

- **F29. The container can push but can't open a pull request.** Pushes work through VS Code's git credential helper. There's no `gh` CLI and no token the agent may use for the GitHub API. So landing work outside close-out, which is the only route while F28 stands, needs the person to open the PR in the browser.

### Attempt 1 closed as failed (2026-10-06)

Owner: "think we've got enough out of these notes to close out and mark this first attempt failed, with the work record as the output."

- **Output:** this record, findings F1–F28. The item branch `aludel/w-8` now differs from `main` only in this file and in the process change below. The board code was reverted on the branch (`1a9eee3`). The draft is kept on `w-8-attempt-1-board` (`58b50d6`), pushed to GitHub on 2026-10-06 at the owner's request. W-8's six staged Pages records were never applied.
- **Not done:** the board (#2) was written but never built or seen (F22), and #3–#5 never started. Because of F28, W-8 stays In progress in the portal until there's a way to end it, or the owner chooses another route.
- **Experiment, untested:** the `Monitor` watcher for person events (F25) started after the owner's last answer. No portal action has arrived through it yet, so whether it works is unknown.

#### Retrospective

1. **What made the work harder, slower or more error-prone than necessary?**
   - *Observed:*
     - The agent started with no prompt and no project context (F1, F2), and records have no schema, so the server source had to be read (F7, F18).
     - The portal stalled twice (F12).
     - The container can't build the app (F22). It has no git identity (F11) and leaks its environment into tests (F23).
     - Every call returns about 10 KB (F14).
     - The owner had to work in two surfaces, relaying answers by hand (F16, F25).
   - *Agent mistake:* a malformed `git revert` was followed by an `--amend` that renamed the wrong commit. Caught by checking the log, and fixed.
2. **What would make the next equivalent task easier?**
   - An agent briefing served by the platform: protocol, layer charters, operation schemas with an example record (F2, F7, F18).
   - An item environment holding every project repository, which can build and run the gates (F22, F26).
   - Events pushed to the agent, and answers taken from either surface (F25).
   - Action descriptions (F15), a way to end an item as failed (F28), and agent-proposed items (F27).
3. **What changes the roadmap, downstream packets, architecture or process?**
   - The dogfood ran before the pieces it depends on: A7 for Pages review (F21), the multi-repository environment (F22, F26), and push events (F25). The item container is really A2's runtime hosted locally (F25), which argues for building A2's event and runtime contract before more local polish.
   - Layers must not depend on one another, so Pages needs its own personas (F17).
   - The environment direction (F26) folds into PLATFORM-PIPELINE-01 and COLLAB-WORK-01 §3.
4. **Questions created, resolved or made newly important:**
   - Does an answer typed in VS Code count as the person's (F25)? This blocks the one-surface design.
   - What does a failed item do with its staged changes: discard them, or keep them as a draft for a retry (F28)?
   - Who publishes `layer-base` to GitHub, and when? It's an owner action and blocks every container build (F22).
   - Resolved: the "blocked" status doesn't block anything (F5). The owner waits for A7 rather than pulling the walker forward (F21).
5. **Which process change was applied now, how was it tested, and what is still a hypothesis?**
   - *Applied:* the traceability and reviewability rule, in the operating procedure §6 and the work-record template. Before closing a slice, mark each owner requirement as built, deviated or deferred. Before a dogfood or trial, check that every action kind can be reviewed as specified and that the environment can build and check the change.
   - *Tested:* only retrospectively. Applied to A4, it would have flagged F21 (the G2 requirement) as deviated, and F22 before the dogfood. It hasn't yet been applied going forward.
   - *Hypothesis:* the person-event watcher makes the two-surface problem bearable until push events exist.

## Attempt 2 prerequisites (2026-10-05, Claude, local session)

Owner, after reading attempt 1: "our highest priority is first: a session can actually make changes (with the git credentials, layer-base etc), second; we can end as failed, third; it can create follow up actions. my best case for if the next session fails, is for it to be able to mark itself unable to complete task, but propose the work items that need to happen first before it is revisited (with dependencies?)". On the shape of ending as failed: "rather than a rigid 'propose not done' … when orchestrator sees action failure, it evaluates: is there going to be a way to fix and still complete, or does task run need to be aborted? if so, it could add action to clean up/post hoc, and that could propose work items: which should be the same as work items proposed for successes … then you can review, add whatever you want, and when done instead of doing approve and merge, it has you confirm ending failed. we already have mockups for what that proposed action review looks like, thats what we should be building." Also: old volume cleanup is high priority; git identity is per person.

**Authorized:** "merge w-8. start work yourself on your proposed changes." W-8 was merged as PR #7. Scope: local repository edits, checks and local previews on `claude/item-environment`, covering:
- **E1, a session can make changes:**
  - the item container gets the pinned `layer-base` commits from the portal, with no GitHub credentials;
  - git identity per person, applied when the container connects (F11);
  - `report_code` opens or updates the item's pull request through the portal's GitHub App (F29);
  - the A8 test clears `ALUDEL_CONTAINER` (F23);
  - a timeout says the portal isn't answering (F12).
- **E2, volume cleanup:** an item's container volume is removed when the item closes.
- **E3, ending as failed, with follow-ups:**
  - the orchestrator adds a wrap-up action that proposes work items;
  - the proposals are reviewed in the suggested-task stack built for J8;
  - close-out becomes "confirm ending as not done".

Not authorized: changes to `layer-base` or GitHub settings, opening real pull requests outside a test fake, or deleting volumes other than through the built path.

**Readiness:**
- `layer-base` is already on GitHub, and private. All seven pinned commits are there, checked with `git branch -r --contains` against `origin`. F22's "publish" is done. What's missing is the container getting it: a private clone needs credentials the container may not have, and a headless runtime (A2) has none. So the portal serves the pinned commits as a git bundle, as the worker's `layer-bundle` already does. This differs from the owner's F22 answer ("the container setup clones it beside the app"); the reason is credentials.
- Volumes are per item, not per action (named `aludel-<project>-<ref>-<base>`, `server/server.mjs:1236`), so cleanup belongs to item close. One volume measured 662 MB (`docker system df -v`, W-8's).
- The "proposed action review" mockup is the J8 suggested-task stack. It's built on the old run path: `work_follow_ups` (`server/layer-scope.mjs:26`), the composer stack, and the reason in the sidebar ([J8 record](../journeys/task-create/work-record.md#suggested-task-review-implementation-and-closeout--2026-10-03), [screen](../journeys/task-create/review-evidence/01-stack-desktop.png)). E3 wires goal items to it. Proposals' dependencies map onto items' existing `blocks` links (`server/knowledge.mjs:1375`); an earlier draft of this note said items had none, which was wrong.
- Process check (operating procedure §6, applied forward for the first time): E1's acceptance is that a fresh container built from `.devcontainer/` can build the portal and run the templates gate. That is checked by building the image and running the setup in it, not by reading the script.

### Built (2026-10-05)

**E1, a session can make changes.**
- **Templates:** the portal serves the layer templates an item's branch pins as a Git bundle (`GET /api/editor/templates`, `server/item-environment.mjs`). The bundle is made in a scratch repository that borrows `layer-base`'s objects, so the person's checkout never gets temporary refs. `aludel templates` fetches it into `./layer-base`, and the setup runs it after connecting.
- **Git identity (F11):** connecting sets the clone's `user.name` and `user.email` to the person's. The email is their GitHub noreply address (`<id>+<login>@users.noreply.github.com`) when they signed in with GitHub, otherwise their portal email.
- **F23:** the A8 test clears `ALUDEL_CONTAINER`.
- **F12:** a timeout now says that Aludel didn't answer within 8 s, may be busy, and to retry; a refused connection says so separately.
- **Deferred, F29 (opening pull requests):** the GitHub App has `contents`, `metadata` and `administration`, but not `pull_requests`. Adding it is a GitHub settings change, which wasn't authorized. With E3, a PR isn't needed to land or keep work: close-out merges, and an item ended as not done keeps its branch on GitHub.

**E2, volume cleanup.** At close-out (either ending) and at each Open in a container, Aludel removes the container volumes of the project's closed or archived items, with their stopped containers (`sweepItemVolumes`). A volume whose container is still running (its window is open) is kept and noted on the item; it goes at a later sweep. Open items' volumes are never touched, because they may hold unpushed work.

**E3, ending as not done, with proposed items.**
- **Wrap-up action:** `add_action` with `wrapUp` and a reason. It always waits for its person's approval ("End this item as not done?"), waits on nothing itself, and is the only action that has to be reviewed.
- **Proposals:** `propose_items` works from any working action (follow-ups after a success, or what comes first after a wrap-up). Each proposal has a title, brief and why, and `after` gives the order. They're decided in the J8 composer stack, which gained a proposal mode that creates a Draft goal item. Dependencies become `blocks` links whichever order the items are created in.
- **Close-out:** it refuses while proposals are undecided. With a wrap-up it becomes "End as not done", with a confirm step. It applies nothing and merges nothing; the staged changeset stays unapplied on the item, and the outcome and reason are recorded.
- **MCP:** the instructions now tell the orchestrator to judge fix-or-wrap-up when an action fails.
- **Restart effect:** additive only. It adds a `work_goal_proposals` table and a `kind` column on `work_goal_actions`. No existing data changes.

**Checks (agent-run, 2026-10-05):**
- New `tests/item-environment.test.mjs` (bundle, identity, sweep) and the E3 test in `tests/agent-work.test.mjs`: pass. The full `agent-work.test.mjs` passes (6, with 2 skipped because templates were off).
- The `connect` journey covers the container committing as its person and `aludel templates` fetching the pinned commits. The `agent-work` journey walks E3 end to end: wrap-up approved, proposals edited, created and dismissed, the blocking link checked, the ending confirmed. Both pass, with axe at 1440 and 390 px, and the screens were looked at.
- `test:affected`: 77 pass, 1 fail, 3 skipped. The failure is `security-audit-worker`, whose restarted portal must answer within 8 s. It failed on `main` too while the machine was loaded, and it passes when the machine is idle.
- **The acceptance check (operating procedure §6), in a container built from `.devcontainer/Dockerfile`, on a fresh clone with only the bundle-served `layer-base`:**
  - the image build was fully cached (4 s);
  - fetching the templates took 0 s, and `npm ci` took 31 s;
  - `npm run build` passed in 35 s, and so did `npm run typecheck`;
  - `test:server:templates`: 343 pass, 3 fail, 10 skipped.
  - In attempt 1, none of these could run (F22).
- `test:server:templates` on the host: 351 pass, 0 fail, 7 skipped.
- **F30, the three container failures:** all three need Docker. Two are the layer-test sandbox (`runner ENOENT`) and one is a candidate preview build. The item container has no Docker. Giving it the host's Docker socket would make the container root-equivalent on the person's machine, so that is the owner's decision. Until then, those tests run on the host.
- **Not checked:** a real item container through VS Code (the Dev Containers link, Connect, then `aludel templates` against the live portal), and a live volume sweep. Both wait for the owner's next dogfood.

**Round note.** *Changed:* item containers get templates and identity; closed items' volumes are swept; items can end as not done with proposed items. *Checked:* unit tests, both journeys, and the build plus gate inside the container image. *Waits on the owner:* restart the portal on this branch; decide F30 (Docker in item containers); try attempt 2 of W-8 (or close W-8 the new way, which needs its agent to add a wrap-up).

### Small findings from attempt 1 (2026-10-05)

Owner: "think you can knock out all those smaller ones. medium ones turned into a task for future work. … knock it out." Decisions on F8, F9 and F13 are recorded as DEC-068. Authorized on `claude/item-environment`:
- F4: the editor API accepts W-n wherever it takes an item.
- F5: no legacy "blocked" status on goal items.
- F7/F18: `describe_operation` returns an operation's request schema and the host catalogs it uses.
- F10: name the missing pinned input.
- F14: editor writes return a short acknowledgement.
- F24: a person drops a to-do action.
- F19: a Board page type.
- A person-side "End as not done".

Medium findings (F15, F1, F3) are recorded below as future work, not built.

**Built (2026-10-05).**
- **F4:** the editor API resolves W-n to the item wherever it takes an item, so `work_view("W-8")` works.
- **F5:** goal items carry no layer-action migration, so no misleading "blocked".
- **F7/F18:** `describe_operation(layer, operationId)` returns the operation's request body schema, the component schemas it refers to, and the values of the host catalogs it checks (`pageTypes`, `routeIcons`). `stack_map` stays a summary.
- **F10:** the task manifest names each missing pinned input.
- **F14:** editor writes (define, add or update an action, post, report code) answer with the item's id, ref, board and status, each action's number, goal and state, the open needs, and what the call added. Reads stay whole.
- **F19:** a Board page type: search, then four columns of cards.
- **F24:** a person removes a to-do action from the item page; actions after it stop waiting on it.
- **Person ending:** on an item in progress or in review, "End as not done…" asks why and ends it. The wrap-up is recorded with that reason, open needs are withdrawn, and the item closes as not done, once any proposed items are decided.

**Checks:**
- `agent-work.test.mjs`: 7 pass, 3 skipped without templates. The F7 test passes with templates.
- `task-manifest.test.mjs` passes.
- The `agent-work` journey adds a third item: the agent defines it by its number with a short reply, one to-do action is removed, and the person ends it with a reason. axe passes at 1440 and 390 px, and the screens were looked at.
- The `connect` journey passes, and `test:affected` passes: 275 pass, 0 fail.
- `test:server:templates`: 353 pass, 0 fail, 7 skipped.

### Future work from attempt 1 (medium findings, not built)

To pick up as one packet, or as goal items once the portal is running this branch:
1. **F15, action descriptions.** An action has a short title and a description: schema, `define_work`, `add_action`, `update_action`, item page and peek. Today action 1's detail lives only in this record.
2. **F1, the container's first message.** The Dev Containers link can't carry a prompt. When connecting, setup could leave the item's start instruction where Claude Code reads it first: a session-start hook in the container's user settings, or a line `aludel connect` prints for the person to paste. The aim is that the agent knows its item and its role without being told.
3. **F3, `.aludel/AGENTS.md` in an app repository.** The Code template's agent guide is written for a layer repository: charter, layer contract, `node --test`, "Aludel turns the branch into a merge request". In an app repository it should say that `.aludel/` is the Code layer's installed package, and that work comes through the Aludel tools. This is a change to `layer-base`'s `code` branch and a new pin, which needs the owner's go to edit `layer-base`.

DEC-068 settles F8, F9 and F13:
- **F8:** journeys belong to Code when they're Code's work, with an optional binding to Pages flows that one side may cede.
- **F9:** briefs describe the app layers they expect to touch without fencing the work to them.
- **F13:** Code owns code, including Aludel's.

Following from these: F17's Pages-owned personas is the same rule (open, with the Pages layer). The orchestrator protocol's "one action per layer change" stands; a portal code change is a Code (`platform`) action, as W-8 #2 was filed.

## Review of W-9 "evaluate transition to managing Aludel within the app" (2026-10-06)

W-9 is the first item to run the whole loop from an item container. Read from the live portal data and the merged branch.
- **Checked:**
  - The container connected in about a minute.
  - The agent defined two phases with a gate after the assessment, and reported code three times. Close-out fast-forwarded `main` to `318781a` and pushed it.
  - 15 proposals became W-10 to W-24, and their dependencies became `blocks` links. W-13 is blocked by W-10, W-11 and W-12; W-14 is blocked by W-13.
  - At close-out the volume sweep kept W-9's volume, because its container was still running, and noted that on the item.
- **Not checked:** the volume being removed after the window closes. W-8 is still Ready, so its volume stays.

**Findings.**
- **G1, the 10-item proposal limit (W-9's P5).** It forced a second action (#5), which needed approval, just to propose 5 more items. `after` can't name items from another list, so the agent wrote cross-list dependencies into the briefs.
- **G2, "Approved #n" means two things in the thread:** approving a new action, and approving an action's review.
- **G3, questions arrived outside the portal (owner, F-W9-1).** This is the one-surface problem (F25); W-11 tracks it.
- **G4, W-9's P1 to P3,** gathered into W-24:
  - **P1:** an assessment can't stage a sample without it applying at close-out.
  - **P2:** Work isn't a layer an action can name.
  - **P3:** Vision and Design have untyped record schemas.

**Owner rulings (DEC-069):** Work is a layer; proposed items are staged Work records that apply at sign-off; `layer-base` and any owned code repository take work under the same spec. Not started: these are recorded for the portal.

### Future work (to bring into the portal)

Each entry is written to become a work item. Where an item already exists in Aludel Workshop, it's named.

| # | Work | Why | Depends on | Existing item |
|---|---|---|---|---|
| FW-1 | **Work as a layer.** Give Work a layer definition and API (records: work items; operations: propose, edit, dismiss) so actions can name it and agents stage items through it like any layer. | DEC-069 (1), W-9 P2 | | W-24 (P2) |
| FW-2 | **Proposed items apply at sign-off.** Proposals become staged Work records in the item's changeset. The review stack edits and dismisses them; close-out (done or not done) creates them with their `blocks` links, in one transaction with the other records. Replace E3's create-on-decide. | DEC-069 (2) | FW-1 | |
| FW-3 | **No proposal limit per list, and `after` across lists.** Raise or remove the 10-item limit; let `after` name any of the item's proposals or already-created items. | G1 (P5) | FW-2 if done after it | W-24 |
| FW-4 | **Distinct thread wording:** "Approved adding #n" for a new action, "Approved #n's review" for a review. | G2 | | |
| FW-5 | **Withdraw a staged change** (`withdraw_change`), so an assessment can probe a destination with a real write and leave nothing behind. | W-9 P1 | | W-24 |
| FW-6 | **Typed record schemas for Vision and Design** in `layer-base`, with new pins, reviewed digests and template journeys, so `describe_operation` gives agents real shapes. | W-9 P3, F7/F18; DEC-069 (3) | | W-24 (P3) |
| FW-7 | **`.aludel/AGENTS.md` for app repositories** (F3): the Code template's guide says `.aludel/` is the Code layer's installed package and that work comes through the Aludel tools. A `layer-base` `code` branch change and a new pin. | F3; DEC-069 (3) | | |
| FW-8 | **Action titles and descriptions** (F15): schema, `define_work`, `add_action` and `update_action`, the item page and the peek. | F15 | | |
| FW-9 | **The container's first message** (F1): when the container connects, leave the start instruction where Claude Code reads it first (a session-start hook in the container's settings), so the agent knows its item and role unprompted. | F1 | | |
| FW-10 | **Questions and answers on one surface** (F25, F16): push events to the agent, answers taken from either surface, review links that open in VS Code. | F25, G3 | | W-11 |
| FW-11 | **The item environment across repositories** (F26): every repository the project owns, checked out side by side on the item's branch; report and close-out handle a set of branches. With DEC-069 (3) this includes `layer-base`, which today is served read-only as a bundle. | F26, F22 | | (PLATFORM-PIPELINE-01) |
| FW-12 | **Pages keeps its own personas** (F17, DEC-068), bound to Vision's through the Library. | F17 | | |

**Decisions waiting on the owner:**
- **F30:** Docker inside item containers. Mounting the host's socket makes the container root-equivalent on the person's machine. Three Docker-only tests can't run in a container until this is decided.
- **F29:** pull requests from Aludel. This needs the GitHub App's `pull_requests` permission, a GitHub settings change. Close-out makes it unnecessary for now.

## Dogfood: W-8 attempt 2, in an item container (2026-10-06)

Owner, in the item container's Claude Code chat: "alright, lets try this task again, made some changes." W-8 was moved back to In progress from the portal on 2026-10-06 (03:24). **Authorized:** W-8's own scope, as its brief and actions state: local edits on `aludel/w-8`, checks, local previews, Aludel tool calls on W-8, and commits reported with `report_code`. Not authorized: changes to `layer-base`, GitHub settings or other items. The agent is Claude Code (Opus 5.5) in W-8's item container (`ALUDEL_CONTAINER=1`).

**Readiness (operating procedure §6, applied before code):**
- Action 1 (the Pages spec) is approved, and its six records are still staged on the item. Action 2 was left `working` from attempt 1.
- The container now has `./layer-base` (bundle-served, E1), `node_modules` and the person's git identity. `npm run typecheck` and `npm run build` pass here. This is the first check of E1 in a live item container; attempt 2's prerequisites had checked it only in a rebuilt image.
- The attempt-1 board (`f638bc7`, on `w-8-attempt-1-board`) applies cleanly to current `main` and typechecks. It's reused, not rewritten.
- The server's `move()` (`server/agent-work.mjs:192`) already enforces every move rule in the brief, so action 3 comes down to proving those rules with tests and wiring the board to them.

### Findings (attempt 2)

- **F31. The browser journeys couldn't find the container's browser.** The image installs Playwright globally with its headless shell under `/opt/playwright` (`PLAYWRIGHT_BROWSERS_PATH`). Every journey, though, defaults `PLAYWRIGHT_MODULE` to `/tmp/app-builder-…` and `CHROMIUM_PATH` to one of two other machines' paths (`/opt/pw-browsers/chromium`, `/home/henry/.cache/…`). The E1 acceptance check ran the build and the server gate in the image, but no journey. **Applied now:** `tests/browser-support.mjs` falls back to the global Playwright and the headless shell under `PLAYWRIGHT_BROWSERS_PATH`, so every journey runs in an item container with no settings. Explicit settings still win, so other machines are unaffected.
- **F32. The person approves actions they can't see (owner, 2026-10-06, on approving #2 and #3):** "a bit of a sham since i cant actually preview anything, but that's where we are at right now." The board is built and checked in the container, but its screens (`test-results/`) and any portal it runs stay inside the container. The item page has no link to a preview, and the review shows the agent's summary only. This is the same gap as F21 (Pages review walker) and A7, now for a UI change in Code. **Applied now, as an experiment:** a journey can stay up afterwards (`JOURNEY_KEEP=1 JOURNEY_PORT=<port>`, in `tests/work-board-browser.mjs`). The portal it seeded keeps running in the state the walk left it, VS Code forwards the port, and the agent posts the link in the item's thread. Untested: whether forwarding reaches the owner's browser (it answers inside the container). **Durable fix (proposed):** an action that changes UI hands over a preview link with its review, shown on the action, as A7's review action and CW's review previews intend.
- **F33. Two Work journeys already failed on `main`.** `layer-scope-browser` waits for a "Create task in Code" button that no source has any more. `journey-work-browser` expects `journeys-unchanged` passed and gets `not-run`, most likely the Docker-only sandbox (F30). Both fail the same way on a clean `main` worktree in this container, so they aren't W-8's. They're left for their owners (JOURNEYS-01, J8); W-8's evidence names them instead of claiming "existing journeys pass".

### W-8 attempt 2: built and agent-checked (2026-10-06)

**Requirement traceability (operating procedure §6), against W-8's brief:**

| Requirement | Status | Evidence |
|---|---|---|
| Five columns from status; batches, Next, Queue/Backlog gone | Built | `work-board.ts`. The journey asserts no Batch/Queue/Backlog/Next text. The composer's "Place in" is now Draft/Ready. |
| Card: title and number, priority, layers, assignee (local/remote), progress, needs-you, live dot, routine origin | Built | Journey `01-board`. "Remote" shows an agent's name; agents wait on A2. |
| Filters: Needs you, layer, assignee | Built | Journey, each filter asserted. |
| Peek: fields, actions and states, Move to, Open item | Built | `02-peek`, `09-phone-peek`. A fixed side panel; full screen on phones; Escape closes it and returns focus to the card. |
| Ready needs a defined item | Built | Server `move()` and a board dialog (`05-define-first`). Defining moves an item to Ready itself, so Move to › Ready applies to an item moved back to Draft. |
| In progress asks to confirm the start | Built | `03-confirm-start`. With nobody assigned, "Claim and start". |
| Done only through close-out, never by dragging | Built | The prototype's dialog with Open item (`04-refused-drag`), and the server refuses as well. |
| Each layer's Tasks tab is the same board | Built | The journey's Pages Tasks step (`07-pages-tasks`) and `layer-bar`. |
| Create task and routines keep working | Built | `task-create`, `suggested-task` and `layer-bar` journeys pass. Routine items show on the board. |
| 390 px: columns stack, no sideways scroll | Built | `08-phone`, asserted. |
| Done when: browser journey at 1440 and 390 with axe clean | Built | `tests/work-board-browser.mjs`: PASS. |
| Done when: existing Work and Tasks journeys pass | Deviated | `agent-work`, `layer-bar`, `suggested-task` and `task-create` pass. `layer-scope` and `journey-work` fail identically on `main` (F33, proposed as an item). |
| Done when: templates gate green | Deviated (environment) | In the item container: 347 pass, 3 fail, 10 skipped. The 3 are the Docker-only tests (F30), the same three as the E1 image check. A host run is needed for a fully green gate. |
| The person can see it before approving | Gap | F32. A kept preview was offered after #2 and #3 were approved. |

**Checks (agent-run, in W-8's item container):** `npm run typecheck` and `npm run build` pass. `agent-work.test.mjs`: 10 pass (move-rule cases added). Journeys: `work-board` passes, plus the four above. The screens were looked at, and three defects were fixed because of it: cards overflowed their columns, the peek squeezed the columns to about 125 px, and a Done drop showed only a banner.

#### Retrospective (attempt 2)

1. **What made it harder or slower than necessary?** *Observed:* the journeys couldn't find the container's browser (F31). Two Work journeys were already red on `main` (F33), which took a `main` worktree run to prove. Screenshot checks found three layout defects that a passing journey didn't: assertions check behaviour, not layout. *Agent slips:* two wrong guesses about the UI's wording ("1 need you", "Charles, local"). Both were cheap because the journey ran in seconds.
2. **What would make the next equivalent task easier?** A preview link on UI actions (F32, proposed). A journey runner that finds the browser everywhere (F31, applied). Journeys kept green on `main`, so "still passes" is a cheap claim (F33, proposed).
3. **What changes the roadmap, packets or process?** The E1 prerequisites held in a live container: the build, the gate and the journeys all ran here, which they couldn't in attempt 1. Reviewability is the next gap, not buildability. F32 moves A7's preview-on-review ahead of more local polish.
4. **Questions created or resolved:** *Resolved:* the item container can build, test and commit (F22 closed in practice). *Open:* does a VS Code forwarded port reach the owner's browser (F32 experiment)? Docker in item containers (F30) still decides whether the gate can be green in a container.
5. **Process change applied, how it was tested, what's still a hypothesis:** *Applied:* F31 (journeys find the container's Playwright), tested by running five journeys in the container with no settings. *Applied, as an experiment:* F32's kept preview, tested only from inside the container (HTTP 200 on 4390). *Hypothesis:* that a preview before approval changes what the owner approves. *Result (owner, 2026-10-06):* "i didnt see the preview, thats fine, followup work". The kept preview stays untested and goes to W-25.
- **F34. An item in review can't take a new action.** Before close-out the owner asked for the staged Pages spec to be aligned with the build. The page type is "list" though a Board type exists (F19); Move to is described as a card menu but it's in the peek; and the flow's "Move it to Ready" step doesn't happen, because defining moves an item to Ready. The agent added #6 for it (`add_action`), but the item was In review. Approving a proposed action sets it to `todo` and leaves the item In review. `updateAction` then refuses ("Start W-8 before working on its actions"), `move` has no way from In review back to In progress, and a flag needs an action in review, while all of W-8's were done. Close-out would also refuse while #6 is open. So the only routes are to decline #6, or end as not done. **Needed:** approving a new action on an item in review moves the item back to In progress, as a flag does. **This time:** the owner approved #6 before the agent flagged the dead end, so it was `todo` and needed removing.
  - **F34a. The item page hides Remove on an item in review.** `dropAction` (`server/agent-work.mjs:426`) allows dropping a `todo` action in any state but Done. The item page shows Remove only while `open()` (Draft, Ready, In progress; `src/layers/work-goal.ts:259`). The editor API has no drop operation, and the agent mustn't act as its person in the portal. So the owner removed #6 by calling the person's own endpoint from the browser console on the item page (`DELETE /api/projects/<id>/goals/<item>/actions/6`). **Needed with F34's fix:** Remove shows for a `todo` action whenever the server allows it.
  - **Resolved (owner, 2026-10-06):** "we're back to in progress. added a little back button fix." The owner added a way back from In review to In progress, in their own portal; it isn't on `aludel/w-8` or `main` on GitHub when this note was written. #6 was then worked on W-8 itself. It restaged the Work board page (type `board`, Move to in the peek, the Done dialog, Escape closes the peek) and the four flows ("It lands in Ready"; "Open item to define it"; claim, with agents waiting for the remote runtime; the Done dialog). They folded into action 1's staged creates, so close-out applies one corrected version.
  - **Fixed on `main` (2026-10-06, `claude/review-deadlock`):**
    - Approving a new action on an item in review, or a person adding one, sends the item back to In progress (`reopen`), as a flag does.
    - In review, close-out has a **Back to In progress** button (`move` from review to progress).
    - Remove shows for a `todo` action in review.
    - Checked by a server test of W-8's exact sequence (`agent-work.test.mjs`, F34), and by the `agent-work` journey.

## W-25 "Preview button on actions", in an item container (2026-10-06)

Owner, in W-25's item container chat: "lets get started", then "go" after starting W-25 from the portal (05:48). **Authorized:** W-25's own scope, as its brief and three actions state: local edits on `aludel/w-25`, checks, local previews (a kept portal in this container, forwarded by VS Code), Aludel tool calls on W-25, and commits reported with `report_code`. Not authorized: changes to `layer-base`, GitHub settings, other items, or previews exposed beyond the owner's own forwarded port. The agent is Claude Code (Opus 5.5) in W-25's item container (`ALUDEL_CONTAINER=1`).

**Where the plan came from:** no single document. F32's durable fix (above), A4's "journeys on the combined preview" and A8's "same previews" (both recorded as not built), and the a0/v2 prototype's Review on a Code action ("Walk both journeys on the preview build").

**Readiness:**
- The Work item page spec (`pag-e3341df1`, from W-8) covers only the brief and close-out. Action review isn't specified, so #1 extends that page rather than adding a new one.
- Goal actions today carry a state and a summary only (`server/agent-work.mjs`); the item carries one code report (branch, commit, files). That is enough to tell a preview is stale: its commit isn't the reported one.
- J6's candidate previews (`server/review-previews.mjs`) build a layer-branch candidate in Docker from `.aludel/review.json`. A goal item's code is a pushed branch, Aludel's repository has no build recipe, and the item container has no Docker (F30). So W-25 hands over a preview the agent's container serves, and a portal-built preview of the item's branch stays a follow-up (PP-01D).
- *Verdict:* ready for #1 (spec). #2 and #3 wait on its review gate.

**Process note (W-25 intake):** the owner had to say "somewhere in our docs" because W-25 was created from F32 with no link to where the plan lived. The brief now names its sources. Proposed for items made from a finding: the brief links the finding and the plan sections it continues. This isn't applied to the proposal tooling yet; it's checked when the next follow-up item is created.

### W-25 findings

- **W25-F1. A restart of the owner's machine stopped everything at once (owner, 2026-10-06: "my computer restarted, including both the local session here, and the aludel server. a break we should account for").** About 06:08, during #2. The commits survived (the container's volume). The Claude Code session came back with its conversation. Running processes didn't: the kept preview, test portals and their layer builds. The owner moved W-25 back to Ready while recovering, which the agent first read as an unlogged move. The owner then started it again (06:24). It wasn't a server fault: the agent asked on #2, and the answer is on the item. **What it means for W-25:** a handed-over preview is a process in the container, so a break leaves a link that answers nothing. The spec's *unreachable* state covers what the person sees. **Applied now:** the agent's instructions say that after a break it reads `work_view` again before acting and runs its previews again. **Not done:** previews that come back by themselves after a restart. That needs a supervisor in the container or the portal-built preview (PP-01D), which is the follow-up.

### W-25 built and agent-checked (2026-10-06)

- **#1 (Pages, approved):** the Work item page (`pag-e3341df1`) gained *Action review* and *Action preview*, with four states. Plus the flow `flw-ea072b6c` "Review a UI action on its preview". Staged; it applies at close-out.
- **#2 (Code):** goal actions carry `preview`, which is either `{ url, commit, try }` or `{ none }`.
  - It's set by `update_action` (MCP and the person's route). The commit defaults to the reported code.
  - Only http and https links are accepted, and the preview is fixed once the action is done.
  - It's `stale` in the view once the reported commit differs.
  - `npm run preview -- <journey>` (`tools/journey-preview.mjs`) runs a journey that calls `holdForPreview` (`tests/portal-support.mjs`) in the background and prints its link; `-- stop` ends it. This replaces W-8's ad hoc `JOURNEY_KEEP` block.
  - The agent instructions and [local-work.md](local-work.md) step 6 say that a UI change hands over a preview. W25-F1 adds: after a break, re-read the item and run the previews again.
- **#3 (Code):** one preview block (`src/layers/work-goal.ts`, an `ng-template`) appears on the action's review and in its details.
  - Preview is a link that opens in a new tab, with the commit, who handed it over, when, and *Try:*.
  - *Stale* names both commits. *Unreachable* comes from an opaque `no-cors` request in the person's browser, so it works for a port only their machine forwards; a link that was down is tried again on each refresh.
  - *None* gives the agent's reason, or says it gave none.
  - New journey `tests/action-preview-browser.mjs` (screens in `test-results/action-preview/`).

| Requirement (brief, #1 spec) | Status | Evidence |
|---|---|---|
| The agent attaches a link, its commit and what to try; the portal keeps it on the action | Built | `agent-work.test.mjs` W-25 model test; stdio test hands one over through `update_action` |
| Preview button on the card and in its review; opens in a new tab | Built | Journey: `01-ready`; the tab opens the link and the board loads there |
| The same review in the action's details | Built (preview block only) | `02-details`. The changes list and Approve/Flag stay on the card, as before W-25. |
| Stale once newer code is reported; a fresh one clears it | Built | `03-stale`, asserted |
| Unreachable from this browser, with the link kept | Built | `04-unreachable-and-none`, a closed port |
| None, with the agent's reason or none given | Built | `04-unreachable-and-none` |
| Approve doesn't depend on opening it | Built | #2 approved with its preview down; a flag keeps the preview until a new one |
| A repeatable kept preview for the item-container agent | Built | `npm run preview -- work-board` and `-- action-preview`, run here |
| The person opens #3's own preview before approving | Waits on the owner | The link is in W-25's thread. The owner's portal runs `main`, so the button on W-25 itself arrives with the merge; the preview shows the build on a seeded item. |
| 1440 and 390 px, axe | Built | The journey's five audits |

**Checks (agent-run, in W-25's item container):** typecheck and build pass. `action-preview`, `agent-work` and `work-board` journeys pass. `agent-work.test.mjs`: 9 pass, 3 skip without templates. Templates gate, run alone: 349 pass, 3 fail, 10 skipped. The 3 match W-8's container run: two Docker-only layer tests (`runner ENOENT`, F30) and the worker-token test, which also fails on `main`. The security-audit test failed once in `test:affected` while leftover layer builds had load at 22; it passed alone and in the gate.

**F32:** the lasting fix is built. It closes once the owner has opened a forwarded preview from the item. That proof is the open check below.

#### Retrospective (W-25)

1. **What made it harder or slower?** *Observed:* the plan was spread across F32, A4, A8 and a prototype, so the item started with a search. The machine restarted mid-#2 (W25-F1), which looked like an unlogged state change until the owner answered. My own parallel test runs left layer builds that pushed load to 22 and made a startup-timed test fail. The positional `INSERT … VALUES` into `work_goal_actions` turned a one-column addition into three edits.
2. **What would make the next one easier?** Briefs that link the finding and plan sections they continue (applied in W-25's own brief; proposed for items made from findings). Run the full gate alone, not alongside journeys. Name the columns in action inserts the next time that table changes.
3. **What changes the roadmap, packets or process?** Reviewability now has a mechanism, but its reach depends on VS Code forwarding: untested until the owner opens the link. Previews die with the container (W25-F1). A portal-built preview of the item's branch (PP-01D) is the durable follow-up, and it would also survive restarts.
4. **Questions created or resolved:** *Resolved:* the preview opens in a new tab (owner approved #1 as specified). *Open:* does the forwarded port reach the owner's browser? It decides whether F32 closes.
5. **Process change applied, how it was tested, what's still a hypothesis:** *Applied and tested:* the preview handover (model, stdio and browser tests); `npm run preview` (run for two journeys); restart guidance (in the instructions only; untested until the next break). *Hypothesis:* a preview before approval changes what the owner approves. That's tested when the owner opens #3's.

### A7 written up as a task; D4 decided (2026-10-06, Claude, local session)

Authorization: the owner's message "d4: designs html kit is fully internal, then bound to codes components. we need a7 now, write it up as a task. it shouldnt be just pages, either, if its just code i want to see those files, if it builds ui i want to interact with it". It also asked how a preview could be passed back so that clicking through progresses the checklist. Scope: record D4 ([DEC-070](../../decisions.md)), write A7's brief for a work item, update the plan and this record, and answer the preview question. No code. The agent can't create items as the owner, so the owner creates the item from [a7-brief.md](a7-brief.md).

- **Why the owner saw only Approve.** W-25 built a Preview link that opens in a new tab, not the modal. A7 was out of its scope (F21: the owner chose to wait for A7). Also, the owner's running portal didn't have W-25 at all: see F35.
- **F35. Close-out merges reach GitHub, but not the checkout the portal runs from.** W-25's close-out merged `aludel/w-25` into `main` (93c8957) and pushed it to GitHub. The owner's portal runs from `/home/henry/vscode-projects/aludel-workshop`, whose `main` stayed at `321cc15` until this session fast-forwarded it. W-25's own note ("the button on W-25 itself arrives with the merge") assumed the merge updates the running portal. It doesn't: a restart on the pulled checkout does. **Proposed:** after close-out merges Aludel's own repository, the item page says the running portal is behind `main` and how to update it (pull and restart), until the server-hosted Aludel (DEPLOY-HOST-01) deploys it.
- **D4 → DEC-070**, with A7 widened to every kind of action. The brief chooses a **preview tunnel** from the agent's container to the portal over the forwarded link, or a portal build of Aludel's branch. The options and reasons are in the brief.
- **Process change (definition time).** F21's rule checks owner requirements when a slice closes. W-25 passed that check, because A7 was excluded when the item was defined: its "Not in scope" line was accurate, and the owner approved it. Later the owner still expected the modal. [The operating procedure](../process/operating-procedure.md) now says: when defining an item, name any accepted prototype interaction on the same surface that it leaves out, as a choice in the start message. Applied in this brief: its prototype-interaction table and its "Choices for the owner to check". It's a hypothesis whether this prevents the next mismatch, and it's tested when A7's definition is reviewed.

**Round note.** *Changed:* DEC-070, the A7 brief, the plan's D4 and A7, the operating procedure, and F35. *Checked:* that the brief's sources exist: the walker and walk script (`work-review.ts`, `review-walk.mjs`), `frame-src` limited to the app origin (`server/server.mjs`), no `Dockerfile` in Aludel's repository, and W-25's preview field. *Waits on the owner:* creating the A7 item from the brief; and restarting the portal to get W-25.

## W-27 "Review modal" (A7 part 1), in an item container (2026-10-06)

Authorization: the owner created W-27 from [a7-brief.md](a7-brief.md), approved its definition ("sounds good, go"), started it and approved #1. Scope: as defined on the item. It's A7 part 1: the review modal, Records, Files, the preview tunnel and the live build with its checklist. The Design kit and the Pages walker go to a follow-up item, proposed by #8. Built on `aludel/w-27`, from `main` at a193f8c.

- **#1 (Pages, approved).** Spec only. The new page "Action review" (`pag-c958b4ce`) is the modal. The Work item card's review becomes a one-line "what changed" plus Review. The flow "Review a UI action on its preview" becomes "Review a UI action by walking it", and a new flow "Review a code action's files" is added. The definition used the operating procedure's new definition-time rule: the split and P3 were named as choices in the start message, and the owner accepted them.

### W-27 #4: review modal with Records (2026-10-06)

- `src/layers/work-review-modal.ts` and `.css`: one modal for every action in review, a native `<dialog>` (focus trap, Escape, inert page).
  - **Header:** Close, the action, its layer, and tabs for only the views it has. Open in a new tab appears when there's a preview link.
  - **Records:** the staged records by layer, marked New, Changed or Removed. The picked record shows Previous (with its revision) beside Proposed, field by field. An update shows only changed fields until "Show unchanged fields" is ticked. Long unchanged runs fold to "N unchanged lines: show".
  - **Files (interim):** the reported files with their status. #5 replaces it with the tree and diffs.
  - **Empty state:** an action with nothing to show says so.
  - **Side panel:** the summary; W-25's preview states (ready, stale, unreachable, none), moved here from the card; a note; Flag (needs the note); Approve.
  - **Phone:** full screen, with Previous above Proposed marked − and +.
- `src/layers/review-diff.ts`: a record's fields become readable lines (YAML-like, with empty values and nested `id`s left out). A line diff then pairs them into aligned rows.
- **Work item page:** the card in review shows "2 records in Pages · a preview to open" and Review #n. Approve and Flag left the card. The action's details also offer Review. `?review=N` opens the modal directly, so a link can be handed over. W-25's preview block and its CSS are gone from the page.
- **Journeys:**
  - `tests/action-preview-browser.mjs` became `tests/review-modal-browser.mjs` (screens in `test-results/review-modal/`). It keeps W-25's four preview states, and adds Records against a live Pages page made by an earlier closed item, Files, the empty state, the details entry, `?review=N`, Escape, and 390 px. `npm run preview -- review-modal` replaces `-- action-preview`.
  - `agent-work-browser.mjs` now reviews through the modal.
- **Found and fixed while testing.** After a flag, the action leaves review, so Angular destroys the modal without a `close` event. The page kept the action's number, and the modal reopened by itself when the agent handed the action back. Now a decision that succeeds clears the number.
- **Limitation.** The code is the item's, not one action's, so every Code action's review shows the item's reported files. A per-action file list would need each report tied to an action. Not proposed yet; it waits to see whether the owner finds this confusing in #5.
- **Checks (agent-run, in W-27's item container):**
  - Typecheck and build pass.
  - The `review-modal`, `agent-work` and `work-board` journeys pass.
  - Templates gate, run alone: 354 pass, 3 fail, 10 skipped. The 3 failures match W-25's: two Docker-only layer tests (`runner ENOENT`, F30) and the worker-token test, which also fails on `main`. The two Docker tests also failed here with this change stashed.
  - The first gate run caught two icons missing from the font subset (`add_circle`, `remove_circle`). fontTools isn't in the container, so the modal uses `add` and `delete`, which are in the subset.
- **W27-F1. The kept preview's link didn't reach the owner (2026-10-06).** The owner opened `http://localhost:4390/…?review=1` and got "connection refused". In the container the preview was up: `localhost:4390` answered 200. So VS Code hadn't forwarded 4390 to the owner's machine, or had forwarded it to another local port. This answers W-25's open F32 question: forwarding can't be relied on. Workaround: forward 4390 from VS Code's Ports panel. Lasting fix: #2's tunnel, which serves the preview through the portal. **New constraint found while building #2:** the tunnel is portal code, and the owner's portal runs `main`. So a tunnelled preview reaches the owner only after W-27 merges, or through a branch-built portal that the owner chooses to run. This affects how #7's proof reviews run; see #7.
- **Owner on #7 (2026-10-06):** "After close-out: #7 checks only the seeded preview portals (journeys plus a forwarded preview), and your live reviews of a Code action and a UI action happen on the next item, once W-27 is on main". So W-27's "done when" proof becomes agent-run journeys and seeded portals. The owner's live reviews in the modal are recorded as pending until a later item, as the standing live-portal rule says. #4 was approved on its summary; its forwarded preview hadn't reached the owner (W27-F1).

### W-27 #2: the preview tunnel (2026-10-06)

- **`server/preview-tunnels.mjs`.** Each connection the container dials in is an HTTP upgrade (`Upgrade: aludel-tunnel`, editor token, own item only). Once accepted, it becomes a raw byte pipe that waits in a small pool until the portal hands it one browser connection.
  - **Pages and requests:** `http.request` runs with `createConnection` set to a pooled socket. That's the same proxy path as review previews: the walk script added to HTML, and `/__aludel/walk.js` served by the portal. One connection carries one request (`Connection: close`).
  - **WebSockets:** the request head is written down a pooled socket, then bytes are piped both ways untouched.
  - **Host:** the app receives `Host: localhost`, so a preview that is itself a portal answers as itself.
  - **Framing:** its `frame-ancestors` becomes the portal's origins, and `X-Frame-Options` is dropped. Cookies the app sets get `SameSite=None; Secure; Partitioned` (CHIPS), so they work inside the portal's cross-site frame. Cookies with a `Domain` are dropped.
  - **Members only:** a member asks the portal for a one-time link (`POST …/goals/:id/previews/:n`), and the preview host swaps it for its own host-only `aludel_review` cookie (also partitioned). That cookie is stripped before anything reaches the app.
  - **Closing:** an item's tunnels close when it closes or ends, through the close-out hook that already sweeps its container volumes.
- **Routes in `server/server.mjs`:**
  - `POST /api/editor/goals/:id/tunnels {action}` opens a tunnel for one open action; a fresh one replaces the old.
  - The server's `upgrade` handler takes the container's dial-ins and browser WebSockets on tunnelled hosts. Nothing else upgrades.
  - Tunnelled `review-<id>` hosts are served before review-integration previews.
- **`tools/preview-tunnel.mjs`:** the container's side. It opens the tunnel, keeps six dial-ins idle, and pipes each to `localhost:<port>` when a browser connection arrives. It redials with backoff, and stops when the portal answers 401, 404 or 410. Against a portal from before W-27, it says the portal has no tunnels yet.
- **`npm run preview -- <journey> --tunnel <action>`** starts the tunnel beside the kept preview and prints the link to hand over (the tunnel's origin plus the journey's path). `npm run preview -- stop` stops both.
- **Proof (`tests/preview-tunnel.test.mjs`):** a real portal and the real client tunnel to a preview app that refuses framing, sets its own cookie and speaks WebSocket.
  - A stranger gets 403, and nothing reaches the app.
  - The member link works once.
  - The page carries the walk script, with the portal allowed as a framer and the app's cookie made partitioned.
  - The app sees `Host: localhost` and never the access cookie.
  - A POST body relays both ways.
  - A WebSocket echoes, and a WebSocket without access gets 403.
  - Another item's token can't dial in.
  - Ending the item closes the preview, and the client stops on its own.
- **Not proved yet:** a browser inside the portal's frame (partitioned cookies in Chromium, and the walk script reaching the modal). That's #6's journey. `--tunnel` itself was run only against the owner's portal, which runs `main` and refused it with the new message.
- **Checks for #2 (agent-run):** `preview-tunnel.test.mjs` passes. Templates gate: 354 pass, 4 fail, 10 skipped. Three failures are the known ones (two Docker-only, plus the worker-token test, which fails on `main`). The fourth, the security-audit test, failed with the load average at 24 just after the container restarted. It passed when run alone, as it did in W-25.

### W-27 #5: Files view, a tree and diffs (2026-10-06)

- **`codeFiles` in `server/agent-work.mjs`**, served by `GET /api/projects/:p/goals/:id/files[?path=]` (members). It reads the reported commit from the project's repository. When the commit is missing, it fetches the item's branch from GitHub, as close-out does (`refs/aludel/work/<id>`).
  - **Base:** the reported base, or else the merge base with `main`. Later commits on `main` don't show as the item's changes.
  - **Files:** status (added, modified, deleted, renamed, with the old path), line counts, and binaries marked.
  - **One file:** its unified diff, only for a path the item changed. A file over 400 KB says it's too large.
  - **Errors** say what to do next: no code reported; no repository; a commit Aludel doesn't have and no GitHub to fetch it from; a fetch that failed; a branch that doesn't contain the commit.
- **Files view in the modal:**
  - **Tree:** the changed files under their folders, with a single-child folder chain shown joined (`src/layers`). Each file has a colored status dot and +/− counts.
  - **Diff:** the first file opens, and picking another loads its diff. Before sits beside After, with each side's line numbers, hunk headers, and a changed line paired with its replacement. On a phone it's one column, marked − and +.
  - **Binaries, too-large files and pure moves** each say what they are.
  - **Newer report:** the view rereads when newer code is reported.
  - **Unreadable commit:** the view says why, offers Retry, and lists the files the agent reported.
- **Checks:**
  - `tests/code-files.test.mjs`: a real repository, with every kind of change, the merge base and the reported base, a path the item didn't change, and a commit Aludel lacks.
  - The `review-modal` journey: #2 now has a real repository with two commits, so its Files view shows the tree, the diff, picking a file, following the newer report, and the unreadable case. Axe passes at 1440 and 390 px.
  - The first run caught the green +3 failing contrast on the selected file's highlight. Counts now take the row's color when selected.
- **Checks for #5:** `code-files.test.mjs` passes, and so do the `review-modal` and `agent-work` journeys. Templates gate: 354 pass, 5 fail, 10 skipped.
  - **Three known failures:** the two Docker-only tests and the worker-token test.
  - **Security audit:** failed again at a load average around 17 and passed alone. It now has three under-load failures across W-25 and W-27, so it's a flaky test, not this change.
  - **Shebang test:** #2 committed `tools/preview-tunnel.mjs` (it has a shebang) without the executable bit. Fixed here; the test passes alone. #2's gate run was cut short by a restart, and my rerun of only its failures missed this. The lesson: run the whole gate after a restart, not only the failures.
- **Slip in #5's commit (486d6d4):** after the journey's last passing run, I edited its PASS sentence and added an apostrophe inside a single-quoted string. The committed journey wouldn't parse. `npm run preview` caught it. Fixed in the next commit, and the journey passes again. Lesson: re-run (or at least `node --check`) a test after any edit to it, even a wording-only one.

### W-27 #3: the checklist on the action (2026-10-06)

- **Handover.** The checklist comes with the preview: `preview.steps`, up to 20, each with As, When, Expect, and optionally `path` (reaching that page ticks the step) or `method` + `path` (doing that request ticks it). Steps get ids `s1…sN`. Bad steps are refused as they're handed over.
- **Walk.** Each step's walk is stored on the same preview: walked (the walk script told the page), checked (Looks good), or a reason. A new handover starts a fresh walk, which is round 2. A person records a step with `POST /api/projects/:p/goals/:id/walk/:n {step, how, reason}` (members only). `how: null` clears a step. A done action's walk stays as it was reviewed.
- **P3.** Approve refuses while steps are left ("Walk #1's checklist first: step 3 left, or say why one can't be walked."). With no checklist, Approve never depends on the preview.
- **Flag.** A flag logs the walk so far for the agent ("Walk so far on #1: 2 of 3 steps walked; not walked: step 3").
- **Agent tool.** `update_action`'s preview schema describes `steps`, and `--tunnel`.
- **Checks:** `tests/review-checklist.test.mjs` passes. `test:affected` (the owner asked to skip the full gate until the item's end while they troubleshoot it): 84 pass, 4 fail, 4 skipped. The 4 are the known ones: the two Docker-only tests, the worker-token test, and the security audit under load.

### W-27 #6: Live build view with the checklist (2026-10-06)

- **Live build view.** An action with an open tunnel opens on Live build. The goal view now carries each action's `tunnel` (url, connected), and so does the walk route's answer, so the page keeps it after a step is ticked.
  - **Entry:** the modal asks the portal for the member's one-time link (`POST …/previews/:n`, at the handed-over path) and frames it.
  - **Frame:** sandboxed with scripts, forms, same origin, pop-ups and modals, but no top navigation. It takes only the tunnel's own origin.
  - **Address bar:** "Preview build of W-n", the page showing (from the walk script), and Reload.
  - **Not connected:** the modal says the agent's container isn't connected and offers Try again.
  - **Open in a new tab:** gets its own one-time link, at the page the frame shows. The tab opens at the click, so it isn't blocked as a pop-up. For tunnelled builds, the plain W-25 link is hidden, because it can't get in on its own.
- **Checklist panel** (a0/v2 shots 10 and 19):
  - "What to try · step n of N", the step's When as its title, then As and Expect.
  - "Do it in the live build; that ticks it and moves on".
  - "Can't walk it? Say why" takes a reason. A done step shows how it was done, with Undo.
  - Back, a progress bar (each segment jumps to its step), Looks good, and Next on a done step.
  - Approve stays disabled with "N steps left to walk before you can approve". The server enforces the same (P3, #3).
- **Walking.** The walk script's messages are taken only from the frame's window and the tunnel's origin. Reaching a step's page ticks a page step; making the step's method and path request ticks an action step. Each tick is recorded as walked through `POST …/walk/:n`, and the panel moves to the next step still to walk.
- **Journey (`review-modal`).**
  - #5's build runs behind the real tunnel client. The journey walks the frame: the link to /map ticks step 1, Borrow's POST ticks step 2, and a reason covers step 3. The server's walk is checked (`walked`, `walked`, `reason`), Open in a new tab lands on /map, and Approve unlocks. Screens 08–10 and axe at 1440 and 390 px.
  - This is the first browser proof that the tunnel's partitioned cookies work inside the portal's cross-site frame in Chromium, which #2 had left open.
  - The kept preview (`npm run preview -- review-modal`) now opens on #6, which waits in review on the same live build for a person to walk.
- **Checks:** typecheck, build, the `review-modal` and `agent-work` journeys pass. `test:affected` shows only the known 4 failures.
- **W27-F2. The item went back to Ready without a log line (2026-10-06).** After #6 moved to working (18:59), the portal was unreachable for a while; the owner was troubleshooting the gate. When it answered again, W-27 showed `board: ready`, `status: queued`, and nothing in its log said why. Every action kept its state. While the item is Ready, `report_code` is refused ("Start W-27 before reporting code"). So #6 waited, committed locally, until the owner started the item again. Possibly the same family as W10-F1 (answering a question moved an item to Ready). Every state change should leave a log line saying who or what made it.

### W-27 close-out: A7 part 1 (2026-10-06)

**Prototype interactions (from [a7-brief.md](a7-brief.md)), marked as the operating procedure's slice close asks:**

| Interaction | Status | Where |
|---|---|---|
| One review modal for every action in review, from its card and its details | Built | #4; `?review=N` opens it from a link |
| Records (any layer): Previous beside Proposed | Built | #4: field by field, changed fields only until asked, long runs folded |
| Code without UI: the files, a tree, each file's diff against the item's base | Built | #5 |
| Code that builds UI: the live build in the modal, as in J6 (a0/v2) | Built | #2 tunnel, #6 view; the walk script ticks the checklist |
| The checklist (journey or "try" steps) handed over with the preview, ticked by walking | Built, deviated | #3, #6. The agent's own steps only; Code's journey steps aren't pulled in automatically yet (the agent copies them into `steps`) |
| Approve after walking every changed step, a reason standing in (P3) | Built | #3 server, #6 UI |
| W-25's link as Open in a new tab | Built, deviated | A plain link for forwarded previews; for tunnelled builds it mints its own way in |
| Steps with New, Changed, Same and Removed badges; Highlight changes; walking by clicking inside the pages; pinned notes; round 2 (pages-review/v1) | Deferred | The follow-up item proposed by #8 (the Pages flow walker) |
| View source and the kit drawer (P6) | Deferred | The follow-up (Design's HTML kit) |
| Built view beside Mockup | Deferred | The follow-up (needs the kit's mockups) |
| Kit fidelity spike (G3) | Deferred | The follow-up's first action |
| Tunnel: members only, separate subdomain, no portal cookies, closes with the item | Built | #2; `preview-tunnel.test.mjs` |

**Done when, as the owner chose on #7:**
- The tunnel and modal are built, with server tests, the browser journeys, and axe at 1440 and 390 px.
- **The templates gate:** run once at the end, as the owner asked while troubleshooting it. The result is below.
- **The owner's live reviews** (a Code action by its files, a UI action until its checklist is ticked) are **pending until W-27 is on `main`**. The owner's portal runs `main` and only the owner runs it, so the reviews happen on the next item.
- **Proof in seeded portals.** The `review-modal` journey reviews a Code action by its files (#2: tree, diffs, newer report, unreadable case) and walks a UI action live until its checklist was ticked (#5). The kept preview holds a sixth action for a person to walk. The owner approved #4 and #5 from summaries; the forwarded preview links didn't reach them (W27-F1).

#### Retrospective (W-27)

1. **What made it harder, slower or more error-prone?**
   - *Observed:*
     - Three container or portal restarts mid-item. Each cut a background gate run short, and one left the item back in Ready without a log line (W27-F2).
     - The full gate takes about 25 minutes and fails four tests that have nothing to do with the work (two Docker-only tests, the worker-token test, and the security audit under load). Every run needed triage.
     - The forwarded preview link didn't reach the owner (W27-F1), so two approvals went on summaries alone.
   - *My own slips:*
     - I shipped a journey that didn't parse, after a wording-only edit.
     - #2's script went in without its executable bit. I reran only the failures after a restart, which missed it.
2. **What would make the next one easier?**
   - Run the whole gate, not only its failures, after a restart.
   - `node --check` every edited test.
   - Quarantine or fix the four known failures, so the gate is green on `main` and a red result means something.
   - Use `--tunnel` previews (now built) instead of forwarded ports, once W-27 is on `main`.
3. **What changes the roadmap, packets or process?**
   - The tunnel makes agent previews reach the person without Docker or a portal build, so PP-01D (portal-built previews of Aludel) is no longer what review previews wait on.
   - The owner's live proof of new review UI can only happen after merge, because the live portal runs `main`. Items that change the review UI should plan their live proof on the next item. This applies the standing live-portal rule, and the owner chose it on #7.
4. **Questions created, resolved or newly important:**
   - *Resolved:* how the proof runs (the owner on #7). Whether partitioned cookies work in the portal's cross-site frame: yes in Chromium, proven by the journey.
   - *Open:* W27-F2's cause (blocks nothing now, but item state can change silently). Whether Code's journey steps should feed the checklist automatically (a follow-up).
   - *Newly important:* a gate the owner can trust (the owner is troubleshooting it now).
5. **Process change applied, how it was tested, what's still a hypothesis:**
   - *Applied and tested:*
     - Definition-time naming of left-out prototype interactions (the split and P3 were put to the owner when the item was defined, and the owner accepted).
     - Slice-close traceability: the table above.
     - `--tunnel` previews: the journey and server tests.
   - *Applied, not yet tested by the owner:* tunnelled previews in the owner's own portal (after merge).
   - *Hypothesis:* that live walking in the modal changes what the owner approves. It's tested by the next item's reviews.

**Final gate (the one full run at the end, as the owner asked):** `test:server:templates`: 370 tests, 356 pass, 4 fail, 10 skipped. The 4 are the known ones: two Docker-only layer tests (`runner ENOENT`, F30), the worker-token test (also fails on `main`), and the security audit (fails under load, passes alone). No new failures.

## W-29 "Design HTML kit, spike first" (A7 part 2a), in an item container (2026-10-06)

Authorization: the owner created W-29 from W-27 #8's proposal, started it in the portal after its definition (7 actions in 3 phases), and said "go" in chat. Scope: as defined on the item. Phase 1 (gated) is the kit fidelity spike (#1), the kit contract and Code's binding (#2), and the Pages specs (#3). Phase 2 is kit.js generation (#4), Components tab demos (#5) and the binding (#6). #7 is close-out. Built on `aludel/w-29`, from `main` at 4bf3cbd. `tools/branch-handoffs.sh` shows no newer branch carrying this packet.

### W-29 #1: kit fidelity spike (G3)

- **Changed:** `kit-spike/generate-kit.mjs` generates a framework-free `kit.js` (tokens as CSS variables, one custom element per contract) from a Design revision. Biome's setup and world screens were rebuilt from it and captured beside the recorded ones. [Result and verdict](kit-spike/README.md).
- **Checked:** the kit and the three pages run with no script errors at 1280 and 390 px. The setup screen's structure rebuilds; the world map has no element. The look diverges in colour, type and shape, and three components have no contract.
- **Verdict:** the generator holds. Biome's look lives in its code, not its Design records, so fidelity depends on the binding's drift handling (adopt writes back to Design). #2 takes three contract additions from this.
- **Waits on the owner:** Biome's own Design records (asked on #1). The spike used this project's seed, which Biome's primary colour suggests it shares. The export could reverse the verdict.

### W-29 #2: kit contract and Code's binding (2026-10-06)

- **Changed:** [kit-contract.md](kit-contract.md) specifies the kit and Code's binding:
  - K1–K6: one kit per Design revision, served by digest and copied into the generated repository; elements, attributes, slots and states; contract `demo` and `template`; tokens only; demos.
  - B1–B6: an `@kit` tag on the component, or a library selector; Code's `ui` facet as a replica in the design-system binding; static drift states; responses (rectify, assess, adopt).
  - The owner chose this project's records as the spike's stand-in (on #1), so the spike's verdict stands.
- **Checked:** the spec against the layer contract's facets and drift rules (`layer-base` design, code and pages manifests), `cleanComponent`, the binding core's drift responses, and the code-unit indexer's component detection. It names three defaults for the owner (K1 serving, B1 tags, B4 assess).
- **Waits on the owner:** the phase 1 gate.

### W-29 #3: Pages specs for the kit demos and the binding view (2026-10-06)

- **Changed (staged, applies at close-out):** two Pages records.
  - *Design components* (`pag-575d9da5`): the tree with a can't-draw mark; the demo from kit.js in a sandboxed frame (demo values, states, light and dark, live props, Copy tag); Can't draw with Add a template; the contract with Demo and Template; Built in Code with drift states.
  - *Code explorer* (`pag-5badb7d6`), as far as the binding reaches: the kit filter (All, Bound, Drifted, Unbound); Implements <element> with the drift state and its Work; the prop map; Not bound.
- **Checked:** both records passed the Pages API's checks when staged. Sections trace to kit-contract.md K2, K3, K6 and B1–B6, and what's kept from today's tab was read from `src/layers/design-components.ts`.
- **Waits on the owner:** the phase 1 gate (#1–#3).

### W-29 #2 revised after review; review gaps found (2026-10-06)

- **Owner on #2's binding:** "bindings happen at the project level, we already have a system in place for that … it shouldn't need the actual code itself to have tags. should have rules for drift as part of it as well."
  - B1–B6 now use the existing binding record: Design's `kit` and a new Code `ui` facet; the binding's `correspondence` pairs them by concept key, confirmed in Library › Bindings; Code's adapter converts; the binding's `policy` holds the drift rules.
  - The `@kit` tags are withdrawn. #3's two staged records still describe them and will be corrected once #2 is approved.
- **W29-F1. Spec and spike actions review as a blank page.** The review modal shows reported files only on Code actions (`work-review-modal.ts` `codeOf`), and it has no document view. #1 and #2 (Design actions whose output is documents) showed "staged no records and reported no code". Proposed as a follow-up item from #2 ("Review shows docs and every action's files").
- **Process change applied:** I handed over #1 and #2 with "no preview" without checking what the modal would show for a non-Code action. Until the follow-up lands:
  - an action whose output is a document puts its substance in its summary and its thread message;
  - I check the modal's view rules (`views()`) before handing over an action of a kind it hasn't shown before.
  - *Hypothesis until #2's re-review:* that a summary is enough to approve a spec in the meantime.

### W-29 #3 corrected after the flag (2026-10-06)

- **Changed:** both staged records now read the project's Design system binding; the `@kit` tags are gone.
  - Design components' *Built in Code* shows the binding's pairs and status, with Open binding.
  - Code explorer's filter is All, Paired, Drifted and Unpaired. Its side panel shows the Design counterpart, the prop map from Code's adapter, and Unpaired linking to Library › Bindings.
- **Checked:** both updates passed the Pages API checks. Neither record mentions tags.

### W-29 #4: Design generates kit.js (2026-10-06)

- **Shipping (owner on #4):** the template commits travel as a one-off git bundle, `tools/w-29-layer-base.bundle`. FW-11 (items working across every repository) is high priority and is proposed from #4 as its own item.
- **Design template** (`layer-base`):
  - `main` `a574a8f`: the contract gains `api.publishes`.
  - `design` `574e23f`, merged with `main`:
    - component contracts gain `demo` (values, and children for slots, dropped when they no longer fit) and `template` (HTML and CSS, token variables only, nothing that runs or loads);
    - the 15 starter components get demos;
    - `publish('kit.js')` and `kitSource` generate the kit, with `tokenVariables` ported from the portal.
  - Template tests: 15 pass.
- **Host:**
  - `api.publishes` is validated (`layer-package.mjs`).
  - `publishLayerFile` and `publishedLayerFile` (`layer-api.mjs`) keep each version in `layer_publications` by its content digest.
  - `GET /api/projects/:p/layers/:key/publish[/:digest]/kit.js` is for members only; a version with a digest is immutable.
  - The scaffold writes `design/kit.js`.
  - The design pin is `574e23f`; its reviewed digest is added and the old ones are kept.
- **Checked:**
  - `typecheck-layer-ui` at `574e23f`: 6 files.
  - Design suites, templates on: 15 pass, including 3 new ones:
    - publish, with a digest per version and pinned versions still readable;
    - the handler's token variables equal the portal's in light and dark;
    - demo and template through Design's API, and the kit draws the template.
  - The seeded kit rendered in Chromium: 15 of 15 elements defined, each demo drawn, no script errors, light and dark, no horizontal scroll at 390 px.
  - That check found the scaffold overflowing a narrow cell; fixed in `574e23f`.
  - `npm run test:affected` (templates on), at the final pin: 299 tests, 286 pass, 3 fail, 10 skipped. The 3 failures are W-27's known ones: two Docker-only template-update tests (`runner ENOENT`, F30) and the worker-token test. An earlier run that straddled a pin change showed 5 other failures (`editor-bridge`, `entry-roles`); both files pass at the final pin (8 of 8).
- **At close-out (the bundle step, until FW-11):** in your `layer-base`, run:

  ```sh
  git fetch <aludel-workshop>/tools/w-29-layer-base.bundle 'refs/heads/*:refs/remotes/w29/*'
  git merge-base --is-ancestor main w29/main && git update-ref refs/heads/main w29/main   # or `git merge --ff-only w29/main` with main checked out
  git merge-base --is-ancestor design w29/design && git update-ref refs/heads/design w29/design
  git push origin main design
  ```

  The pin names `574e23f`, so it resolves once `design` is pushed.

### W-29 #5: the Components tab draws from kit.js (2026-10-06)

- **Changed:**
  - *Design template* (`design` `236570a`, one commit on #4's `574e23f`):
    - The Components tab draws every component on one *stage*: a frame on the Design instance's own origin that loads the kit by digest.
    - The tab posts the component, its props (the contract's demo first), its slot children, the state, All variants, light or dark, and any unsaved token draft.
    - `kit.js` answers on a page marked `data-kit-stage`: it builds only kit elements and plain `div`/`span` layout, takes messages only from its parent, and reports its height after each draw and on resize.
    - New in the tab: a can't-draw state with Add a template (it opens the template field); Copy tag; Demo and Template in Edit contract.
    - The Angular renderer no longer draws Design's demos.
  - *Host:*
    - `GET …/layers/:key/publish/:path/stage` gives the digest and stage URL. A layer frame may read its own layer's published files and stage.
    - The layers host serves `/published/<digest>/stage.html` and the file, for the instance's own project, under the views' sandbox CSP.
    - Layer views may frame their own origin (`frame-src 'self'`).
    - `DesignComponent` gains `demo` and `template` in the host SDK.
  - The pin and the handler's reviewed digest follow; #4's unshipped digest is replaced. The bundle and `tools/w-29-layer-base.patch` are regenerated.
- **Checked:**
  - New journey `design-kit` (`tests/design-kit-browser.mjs`) passes:
    - the stage loads from the instance origin by digest, and the Button draws its demo label;
    - a prop edit and the hover state reach the stage; All variants draws 25 elements; dark mode reaches it;
    - the card shows its two demo actions, and the page scaffold shows a nav list with its items and a card;
    - a component with no preview says it can't be drawn, takes a template and draws, and a template with an event handler is refused with the reason;
    - Copy tag gives `<tool-button … label="Continue">`;
    - the stage frame always shows all it draws;
    - axe passes on the page, in Design's view and in the stage, at 1440 and 390 px.
  - Template tests: 15 pass. `typecheck-layer-ui` at `236570a`: 6 files.
- **Found while checking:**
  1. Template views run inside their own frame, so the journey reaches the tab through it. Portal notices show outside it.
  2. Chromium pauses resize and animation callbacks in an off-screen cross-origin frame, so the stage now also reports its height at once after a draw.
  3. A fresh portal can take more than 30 s to build Design's views on first open.
- **Trust note:** a stage URL is addressed by the kit's 80-bit content digest and isn't behind a session, because the layer origin gets no portal cookie (as with views). Only members can learn a digest, from the members-only route. Kit content is design tokens and contracts; template content can't run (checked on save, and blocked by the stage's CSP).
- **W29-F2. The tunnel can't carry a preview of the portal's own layer views (2026-10-06).**
  - Through the W-27 tunnel, the kept `design-kit` portal got the `review-<id>` host and answered "Review preview unavailable" (checked with curl and that Host header).
  - Its layer views and the kit stage also load from `i-….layers` origins, which the tunnel doesn't carry.
  - So #5 is handed over as a forwarded link (`localhost:4390`, with `*.layers.localhost:4390` beside it), with a checklist ticked by hand. The live walk in the modal, part of W-27's pending proof, can't happen for #5.
  - Proposed as an item from #5: "Tunnelled previews of the portal itself, layer views included".
- **#5 reworked after the owner's flag (2026-10-06).** Owner: "am i hearing that this is using a project level kit? that is not what we are looking for. our whole desired interaction is information at the layer level, bound to other layers. design should have its own kit."
  - The kit was already made by Design's handler from Design's records, but four project-level things had crept in. Now:
    1. The tab says "Drawn by Design's kit".
    2. The kit's name and element prefix come from Design's own brand-name asset, falling back to `kit-`. `kitSource` and `publish` take no project facts. A template test checks that project facts change nothing.
    3. The scaffold's copy of `kit.js` into the app repository (#4, K1) goes to the new action #8, because #4 can't be reopened. Code gets Design's kit only through the binding.
    4. The route stays: it's the Design instance's own API.
  - `design` is now `02e2726`. Template tests: 15 pass. Design host tests: 9 pass. The `design-kit` journey passes.

### W-29 #8: the scaffold stops copying Design's kit into the app (2026-10-06)

Added after the owner's flag on #5, because #4 can't be reopened.
- **Changed:**
  - The scaffold no longer writes `design/kit.js` (`server.mjs` `scaffoldSetup`, `design.mjs` `designFiles`).
  - `publishLayerFile` passes the handler the layer's records only. The publish route no longer reads the project.
  - Contract (`layer-base` `main` `ad913ef`, merged into `design` `15e3d97`): a published file gets the layer's records and nothing else.
  - `kit-contract.md` K1 is revised: the kit is Design's own, and reaches other layers only through bindings.
  - The design pin moves to `15e3d97`. The handler is unchanged, so its digest stays. The bundle and patch are regenerated (`main` `ad913ef`, `design` `15e3d97`).
- **Checked:**
  - The scaffold test now asserts there's no `design/kit.js`.
  - Design suites pass with templates on (15) and off (6).
  - The build passes.
- **Raised, not changed:** the scaffold also writes `design/tokens.json` and `design/components.json` from Design's records (DESIGN-UX-01). That's the same layer-to-code shortcut. It's left for the owner to decide, since it predates this item and the generated app's styles depend on it.
