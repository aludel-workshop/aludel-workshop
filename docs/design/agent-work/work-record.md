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
