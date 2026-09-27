---
id: work-item-ux-01
kind: work-record
status: agent-checked
updated: 2026-09-26
depends_on: [work-ux-01, work-agents-01]
---

# WORK-ITEM-UX-01: what a work item is, and the item page for review and live runs

## Authorization and scope

- **Owner instruction (chat, 2026-09-26):** after the first live agent run reached review (W-4, B-3), the owner said the `/work/item/:id` page "needs some real work to be useable". For this session they asked to first refine what a work item is, then redesign the item page (all states, including before work starts) for reviewer and live-monitoring flows.
- **Authorized now (DEC-029 interim):** local research, this record, a definition proposal, and later static prototypes. Following the PLATFORM-UX-01 lesson, the concept is discussed in text and agreed before any prototype.
- **Excluded:** portal code, schema or runner changes; provider turns; external writes; spending; acceptance.
- **Relation to `next_action`:** WORK-AGENTS-01 remains the pointer. This pass defines the review boundary and attempt model that WORK-AGENTS-01 step 3 ("typed submissions with multiple review artifacts, send-back and revision-bound acceptance") needs.

## Owner brief ledger

| # | Ask (condensed) | Position |
|---|---|---|
| D1 | Keep the Jira-style Details sidebar and the Activity feed at the bottom | Keep (liked) |
| D2 | Top of page: what the run was tasked with, at a high level; the checklist lives in the review | Required |
| D3 | What happened in the run: who, running objectives, time per objective, files/records modified, stumbling blocks; compressed by default, expandable | Required |
| D4 | Review: see what was added, changed or removed quickly; interact with the end result beside the criteria that define it (read a vision statement against its defining docs; use a UX preview; see named tests green plus the diff) | Required; "harden" the current review |
| D5 | Tabs per run, to see why earlier runs were not applied (a person, then a light agent, then a strong agent) | Required |
| D6 | An active run is its own tab, updating live as it moves through its checklist and makes changes | Required |
| D7 | Run progress steps must be generated, not hard-coded | Required; owner asked whether they are hard-coded today |
| D8 | Review in a dedicated mode stepping through the checklist, instead of every item on the work page? | Owner asked for an opinion |
| D9 | Test-driven: criteria set at the start and the performer develops against them. Given exact claims, or the performer writes its own checklist from detailed goals? | Owner undecided; asked for an opinion |
| D10 | The page serves the item before any work starts, too | Required |

## Observed evidence (2026-09-26, read-only)

- **Phases (D7):** hard-coded. The page shows `run.phases`, falling back to the action's owner-configured *Run phases* (WORK-UX-01 B3/B10) and then to `Read context / Draft / Save draft` ([work-item.ts](../../../apps/portal/src/layers/work-item.ts)). The Symphony worker writes `phase: 1` and a fixed activity string per action ([symphony-worker.mjs](../../../apps/portal/server/symphony-worker.mjs)). W-4 finished with the stored phase still at "Draft".
- **Runs (D5):** W-4 has three `symphony_attempts` rows. B-1 and B-2 were stopped before any worker picked them up (no workspace, zero runs). B-3 ran once and submitted. The item page flattens all of this into one `context.run` and `visionProposal`, which later runs overwrite; earlier attempts survive only as log lines.
- **Run trace (D3, D6):** the Codex session log for B-3 holds 12 tool calls (task_open, knowledge map/search/read over about six records, one shell read, submit), three narrated objectives, 83 s of turn time and about 291k tokens (259k cached). Aludel recorded two events of kinds `started` and `submitted`, so none of the trace reaches the page.
- **Criteria (D9):** W-4 carries one generic action check, "Each claim is one short, checkable statement", with no source and nothing from the owner's brief. The agent's own message says it read the task card as having that single check and worked to it. The performer already develops against whatever criteria it is given, so the quality of those criteria bounds the quality of the review.
- **Review in context (D4):** the proposal's note says it "replaces the broad existing label", but it has no target, so it is stored as *add a new claim*. The current review shows the claim text out of context, so a reviewer cannot see that contradiction without opening the Brief separately.

## Proposed definition (for owner discussion, not accepted)

A work item is a durable request to produce or change named outputs until stated criteria are met. It does not depend on who performs it. It has:

1. **Intent:** title, the requester's brief in their own words, and the role and action.
2. **Outputs:** what will be created, revised or removed, and where. These may be "to be determined by the performer" when the brief is open.
3. **Acceptance criteria:** fixed at Go. Each criterion has a claim, a source (action rule, item-specific, or requester), and a verification method (*inspect* against a source, *interact* with a preview, *test* by named tests run independently, or *scope* to confirm nothing else changed).
4. **Runs (attempts):** each run records its performer, its pinned manifest, and a trace: the performer's own plan and objectives with timings, reads, changes, questions and failures. It also records a submission of exact artifacts with evidence for each criterion, and an outcome (applied, sent back with notes, stopped, or failed).
5. **Links and activity** as today.

The performer owns its plan (generated progress). The item owns the criteria (the test). The performer may propose extra criteria or flag a bad one through a question, but cannot remove or weaken criteria during a run.

## Owner agreement (2026-09-26)

The owner replied "looks good" to the text proposal. Four choices are now agreed:

| # | Choice | Agreed position |
|---|---|---|
| E1 | Criteria and plan | The item owns the criteria, which are fixed at Go. The performer owns its plan. The performer may add a criterion or flag one with a question, but may not remove or weaken one |
| E2 | Run progress | The agent's generated plan replaces the configured *Run phases*. This revises the accepted WORK-UX-01 B3/B10 |
| E3 | Review | A full-page review route that steps through the criteria, not a modal |
| E4 | Run tabs | Only runs that actually started get a tab. Runs stopped before a worker picked them up stay in Activity |

This authorizes reference research and a static prototype round. It does not authorize portal code.

## Reference study (accessed 2026-09-26)

Captured with `tools/capture-refs.mjs` into [refs/](refs/manifest.json). Every image was viewed before it was cited.

| Reference | What it shows | Used for |
|---|---|---|
| [GitHub Copilot PR timeline](refs/gh-copilot-pr-timeline.png) (microsoft/CCF#8448) | Each agent session appears as "started work / finished work" with *View session*, and a human comment sits between runs | Runs as separate, reviewable attempts with the send-back note between them (D5) |
| [GitHub PR checks](refs/gh-pr-checks.png) and [files](refs/gh-pr-files.png) (angular#70953) | Named checks with results; a diff grouped per file | The Tests and Changes panes in code review (D4) |
| [Devin session](refs/devin-session.png) | "Worked for 14m 18s · +1511 −122 · Created 7 Tasks", collapsed under the agent's message | Collapsed run summary with expandable objectives (D3) |
| [Linear coding sessions](refs/linear-coding-sessions.png) | An agent session inside the issue, with a collapsed *Investigation* and a "Changed 1 file" row | Keeping the run inside the item page, compressed by default (D3) |
| [Jules plan review](refs/jules-review-plan.png) and [watching work](refs/jules-watching.png) | The agent writes a step-by-step plan before coding; an activity feed as each step completes; a final summary of files, runtime and lines | The agent-generated plan and live feed (D6, D7) |
| [Jira issue](refs/jira-issue.png) (KAFKA-17000) | Details, People and Dates in grouped side panels | Kept the Details sidebar (D1) |
| Chromatic UI Review ([text only](refs/chromatic-ui-checklist2.png)) | A review passes only when the changeset is approved and every checklist item is resolved | The decision step is blocked until every criterion has a verdict (D8). Its screenshots are lazy-loaded and captured blank, so no Chromatic image is cited |

Failed captures are recorded in the manifest: GitHub Actions run and job pages (sign-in wall); Jules planning, code-review and Copilot review docs URLs (404, retried under their current paths); and Chromatic's visual-tests page (404).

## Prototype v1

[v1/index.html](v1/index.html) is static and clickable. [Published link](https://claude.ai/artifact/MLPzWo2oh1gthXwythyh1M). It has five screens:

1. **Before work (W-4):** the Task block (request, produces, done when) is editable. A criterion suggested from the request can be kept or dismissed. The page says the criteria become fixed at Go, and the run area explains that runs will appear as tabs.
2. **Ready for review (W-4):** run tabs for *Run 1 · Sent back* (the real trace, with the add-vs-revise scope flag) and *Run 2 · Ready for review* (illustrative). Each tab shows a summary strip, a reason banner, what changed as an inline diff, the performer's reported criteria, and the objectives as collapsed rows. Stumbles stay visible while collapsed.
3. **Review of a Vision claim:** the Brief is rendered with the change marked in place, alongside field changes and the original request. The stepper shows each criterion's source text and its evidence. Evidence Aludel checked is distinguished from the agent's own claims. There is accept/reject with a note, A/R/J/K keys, and a decision step that stays blocked until every criterion has a verdict.
4. **Live run (W-9, illustrative):** tabs for a person's handed-off run, a failed light-agent run and a live strong-agent run. The live tab shows the agent's own plan, the current objective, a live event feed, and each criterion's test state updating as the run progresses.
5. **Review of code:** an interactive preview (the pet follows the cursor, with a reduced-motion toggle and the 24 px margin shown), tests that Aludel re-ran, each mapped to its criterion, and diffs per file.

An on-page *Your asks D1–D10* panel maps each ask to where it is answered.

**Agent checks (Playwright, local file, 2026-09-26):** all five screens load with no script errors. At 1440 px each was screenshotted and viewed. At 400 px no screen scrolls sideways. The first check found and fixed three defects: the run banner's `review` class collided with the review-mode layout and stretched it to full height; the floating ledger button covered the review footer; and the single-column grid used `1fr`, which let content widen the page at 400 px. A fourth fix labels Read and Scope criteria "Passing" instead of "Test green". Not checked: keyboard-only walkthrough, axe, and dark mode.

## Owner review of v1 (2026-09-27)

The owner gave feedback by screen and asked whether it is enough for another prototype. **Kept:** the review-mode layout ("quite ambitious"), dynamic viewer tabs, run tabs, and Activity outside the runs.

| # | Ask (condensed) | v2 answer |
|---|---|---|
| F1 | The task belongs to a run: each run must show exactly what it received, since the task can change between runs | Each run tab shows its own snapshot of the request and criteria; changed criteria are marked "New in run n" |
| F2 | Task above a started run is too busy and repeats the criteria. Use one card under the tabs | One card under the tabs. No Task block above the tabs and no sidebar |
| F3 | The run status comes first: a compact, slightly emphasized bar with the agent (model in a hover card), a progress bar through the objectives above the current objective, total time, tokens, and board-style status. It expands to all objectives (no per-objective bars), with a small text button for the extended agent log | Run status bar with a segmented objective bar, a hover card, expanding objectives and an *Agent log* link |
| F4 | When finished, the active area becomes the reviewer's primary action and info. Questions appear there. A failure shows the reason and a logs/error report button. Expanded objectives stay below the action | State-specific action rows (see the run actions table); objectives remain below |
| F5 | Sections styled alike as an accordion with summaries: Task (open), Criteria and Changes (closed) | Three accordion sections with summary text when collapsed |
| F6 | Drop *Produces*; the criteria say what must happen to an item, without over-prescribing the agent | Removed; criteria name the required effect on an item |
| F7 | Changes as a compact stack: object, created/modified/removed, size. Hovering a row offers a flag with a note beneath it. Flags make Reject prominent, and accepting with flags asks for confirmation | Change rows with a hover flag and inline note; Reject shows the flag count; sign-off warns about flags |
| F8 | Decide when Accept, Reject and Review are available and what happens on error. Closing a run should feel like a final reviewer signature with an optional overall comment | Run actions table below; every close goes through a sign-off with a comment |
| F9 | For an underspecified task, reopen it: a tab on the right, shown whenever the task is open (including before any work), editable until the run starts | *Next run* draft tab with editable request and criteria, plus what carries over from the last run |
| F10 | Activity stays below the card, outside any run | As asked |
| F11 | A rejected run applies nothing, but its proposed changes and reviewer notes stay in its tab and go to the next run as context | Closed tabs keep their changes and flags; the Next run tab lists what carries over |
| F12 | Too much repetition between the header and the sidebar. Put the details in a compact header: title with assignee and action on the right; priority, status, role and created below; the run count to the right of the tab bar | As asked |
| F13 | Tabs start scrolled right, with the current run open and older runs to its left | The tab strip scrolls to its end on load |
| F14 | Review tabs must be intentional. *Your request* is context in the criterion panel, not something under review. *In the Brief* is too bespoke and repeats the changes; use a friendlier card for text changes instead | Viewer tabs are only what the run produced: Changes (text-change cards and file diffs), Preview and Tests |
| F15 | Evidence: how does the agent generate it? Identify each item clearly by type: try it in the preview, a passed test, or a code/file/record change | Typed evidence contract below |
| F16 | Move Accept and Reject to the bottom bar: Back, then Reject and Accept, with a small ghost Skip under Accept | As asked |

### Run actions (decided for v2; open to owner change)

| Run state | Primary | Also | Can accept? |
|---|---|---|---|
| Working | — | Stop | No |
| Needs an answer | Answer | Stop | No |
| Ready for review: the agent reports every criterion met | Review | Accept, Reject | Yes. The sign-off warns about flags and criteria you did not check |
| Incomplete: the agent submitted but reports unmet criteria | Close run | Review, to inspect | No |
| Failed or stopped: error, turn limit or you stopped it | Close run | Error report, Agent log | No |
| Closed: accepted, sent back or failed | — | Read-only, with the signature shown | — |

Every close is a signature (outcome, flags, optional comment). Accepting applies the run's changes and marks the item done. Any other close reopens the task as a *Next run* tab. A run is accepted or rejected as a whole; changes are never partly applied.

### Evidence contract (proposed)

The agent's submission names evidence for each criterion. It may only point at artifacts the run actually produced, and Aludel validates each reference at submit (`invalid-output` otherwise):

- **Change:** a record or file change in this submission; opens in Changes.
- **Test:** a named test in the submission. Aludel re-runs it on the candidate and shows Aludel's result, not the agent's.
- **Try it:** a preview route and a one-line instruction; it needs a built preview.
- **Aludel check:** added by Aludel, never by the agent. Examples: the scope check and "only one value claim".

The agent's free-text reasoning is shown as a note under an item, never as evidence by itself. The criterion's source and the request appear as context, which is not reviewed.

## Prototype v2 (2026-09-27)

[v2/index.html](v2/index.html) is published to the same link as v1 (version 2). It applies F1–F16, and its *Your feedback* panel maps each row to a screen and shows the run actions table. It has five screens:

1. **Before work:** only a *Next run · Draft* tab, with "No runs yet" beside the tabs.
2. **Ready for review:** W-4 run 2. The run status bar offers Review, Accept and Reject. Changes can be flagged, and Accept and Reject go through the sign-off. Sending back adds a Next run tab that carries the flags and comment in.
3. **Review of a Vision claim:** a Changes tab only, with a was/now text card.
4. **W-9 run 3:** a prototype-only switch between working (the live log ticks), asking a question, and failed (with an error report and Close run).
5. **Review of code:** Preview, Tests and Changes, with typed evidence. Accept and Reject are in the bottom bar, with Skip beneath Accept.

**Agent checks (Playwright, local file):** all screens were viewed at 1440 px, and none scroll sideways at 400 px. A scripted flow ran through expanding the run status, opening the agent log, flagging a change, opening the Accept sign-off (it showed the flag and unchecked-criteria warning), reviewing with the A and R keys, Skip and a flag note, then signing a send-back (a Next run tab appeared carrying the change flag), then the W-9 question and failure states. No script errors occurred. Fixes found while checking: the hover card was clipped by the run bar; the "checked n of m" count included cleared verdicts; the live-run criteria said "agent reports met"; the report toggle's label; and signing now adds an Activity line. Not checked: keyboard-only use of the accordions and hover card, axe, and dark mode.

**Open for owner review:** the run actions table; whether a reviewer may accept an *Incomplete* run (v2 says no); Skip overriding an earlier Reject on the same criterion; whether answering a question should be allowed to amend the criteria (v2 adds the answer to the run's task as a decision); and the typed evidence contract.

## Owner review of v2 and build authorization (2026-09-27)

**Accepted:** v2 with the changes below. **Authorization:** "no need for another prototype, just create an implementation plan for this then start in." This authorizes local portal code, schema, tests, the checked-in Symphony overlay (adding agent plan and progress tools), rebuilding and restarting the local portal and hosts, and disposable checks. It does not authorize a live model turn, external writes, spending, deployment or owner acceptance. Real batches still start only from an owner's Go.

| # | Ask | Build answer |
|---|---|---|
| G1 | Before work: keep the agent row that mimics the in-progress section, but make it the assignee dropdown. The header keeps only the Stage button | The Next run status row holds the assignee menu; the header has no assignee chip |
| G2 | Sections in every state: full width, no outline, lines between sections | Task, Criteria and Changes are separated by rules, with no card borders |
| G3 | Run status order: first the call to action (status as the title, e.g. "Run complete"; action buttons on the right; the review comment); then the actor row; then one progress bar over the current-objective subtitle, with the objectives dropdown to the right of the current objective and the run's time and tokens to the right of the bar | As asked |
| G4 | Bring back the sidebar for relationships (blocked by / blocks), wider context such as milestone and dates, and linked knowledge. The linked knowledge goes to agents as context, so humans need to see it too | Sidebar with Links, Planning (project, checkpoint, dates) and Linked knowledge (what the agent receives) |
| G5 | No more prototypes: write the implementation plan and start | The plan below |

## Implementation plan (WORK-ITEM-UX-01 build)

Each part is ordered by dependency and is agent-checked before the next part depends on it.

| Part | Scope | Check |
|---|---|---|
| WI-1 Run records | A read model of an item's runs. It uses Symphony attempts that actually started, each with the task snapshot from its Go bundle (request and criteria), the performer, times, outputs (Vision proposal, Work proposal, audit report, code candidate) and review state. New table `work_run_reviews`: verdicts, change flags, outcome, comment, signer. `GET /work/:id/runs` | Domain tests: snapshot per run, not-started attempts excluded, outputs attributed to the right run |
| WI-2 Item page | Rework of the item page: header with title and Stage only; facts row; sidebar (Links, Planning, Linked knowledge). A tab bar of runs plus *Next run*, scrolled to the newest, with the run count on the right. The run card has the status block (G3) and ruled sections: Task, Criteria, Changes (compact rows with flags). *Next run* has an editable request and criteria, and the assignee in its status row (G1) | Typecheck, build, browser script over the states |
| WI-3 Review and sign-off | Save verdicts and change flags per run. Sign with an outcome and comment: *accept* runs the existing action-specific acceptance, *reject* sends the run back with its flags and comment as the next run's context, and *close* ends a failed, stopped or incomplete run. Criteria and request edits are allowed until a worker starts the run | Domain tests for each outcome and the refusal rules |
| WI-4 Review route | `/work/items/:id/review/:run`. Viewer tabs come from the run's outputs: Changes (text cards for record proposals, file diffs for candidates, findings for audits), Preview (candidate preview) and Tests (candidate checks). A criterion stepper with Back, Reject, Accept and Skip, ending in the sign-off | Browser script |
| WI-5 Agent plan and progress | Symphony tools `aludel_task_plan` and `aludel_task_progress` with worker endpoints, stored as attempt events. The run status shows the agent's objectives, current step, durations and the agent log. The configured phases and the hard-coded `Read context / Draft / Save draft` fallback are removed (this revises WORK-UX-01 B3/B10) | Worker endpoint tests; Elixir compile in the pinned Docker image; hosts rebuilt |
| WI-6 Criteria metadata and evidence | Each criterion gets an origin (action rule, request, reviewer, send-back) and a verify method (read, try, test, check). Submissions name typed evidence per criterion, and Aludel validates every reference and adds its own scope check | Domain tests with negative cases |
| WI-7 Closeout | Browser flow over every state, evidence and retrospective, and status | — |

**Known limits, stated rather than faked:** runs are agent attempts only. Person work does not appear as a run tab until person runs are captured. Existing runs have no generated objectives and fall back to their stored phase history. Aludel re-runs tests only where the code candidate path already runs checks.

## Implementation implications (for WORK-AGENTS-01 step 3; not started)

- **Runs** become the item's attempt records (`symphony_attempts`, plus person runs), each with its own submission, verdicts and outcome. Today, `context.run`, the proposal and the check verdicts are overwritten.
- **Criteria** gain a source, a verify method (`read | try | test | scope`), an origin (action, item, requester, performer-added, send-back) and a Go-time pin.
- **Traces:** ingest the Codex/Symphony trace into attempt events, and add agent tools for its plan and progress notes. Durations and stumbles are derived from those events, not from configured phases.
- **Scope check:** compare the submission with its *Produces* rows, and flag mismatches such as "the note says replaces, but the change adds".
- **Review:** a review route with per-output-type viewers: Vision in context, record field diff, code preview/tests/diff, and audit findings.

## Readiness

- Target stage: owner review of the built pages ([evidence and retrospective](../../evidence/work-item-ux-01-build.md)).
- Verdict: **built, restarted and agent-checked** on 2026-09-27 (WI-1 to WI-7, then the owner-authorized continuation below). Owner review of the built pages and the first live run that uses the plan, progress and evidence tools are still pending.

## Owner continuation and hardening authorization (2026-09-27)

The owner asked Codex to take over the uncommitted build, compare it with this record and v2, harden it, finish it, and verify it locally. This authorizes bounded repository edits, schema and fixture changes, local builds/tests, disposable browser checks, and restarting the local portal/agent hosts when needed. It does not authorize a live model turn, external writes, spending, deployment, release, or owner acceptance.

Two product decisions extend the accepted build:

1. An agent's answer flow may amend the editable criteria; questions are the agent's primary way to propose a task-scope change. The current run keeps its Go-pinned criteria unchanged. Any accepted amendment applies to the task/Next run and must retain the question and answer in history.
2. Person work is a first-class run. A person can mark that they are working on an item and later submit it for review through the same run/review/signature model as an agent. The submission UI should create the smallest valid review packet from the person's summary, changed-object references, and criterion evidence; it must not fabricate agent logs, token use, or automated evidence.

The packet is reopened for these additions and the previously unverified accessibility, code-review, and regression checks. The completion verdict above remains historical evidence for WI-1–WI-7, not completion of this continuation.

### Continuation result

- Agent answers can submit an explicit next-run criteria amendment. The question, answer and amendment stay in Activity; the interrupted run keeps its pinned snapshot and closes, while the next Go bundle receives the amended criteria.
- `work_person_runs` and `work_person_run_reviews` make person work first-class. The assigned person can start, submit a summary plus criterion evidence and linked revisions, receive the same review/signature, and begin a later run after send-back. Person runs contain no invented model, token, objective or agent-log telemetry.
- The obsolete *Run phases* editor was removed from Roles. Stored phases remain read-only compatibility data for historical runs.
- The browser proof now includes keyboard operation of the hover card, accordions and criterion review; an axe A/AA scan; a person run from start through acceptance; and a real code candidate whose isolated Docker preview, tests, patch and exact fast-forward acceptance all pass.
- That code proof found that candidate inspection returned only `git diff --stat`. It now returns the immutable no-color patch, with a focused regression assertion.
- `./launch-machine` rebuilt the portal, restarted both configured one-slot Symphony hosts, and started the new server at `http://aludel.localhost:4310`. No batch or live model turn was started.

The continuation is **agent-checked**. No live model turn was authorized or used, so useful plan/progress/evidence tool use remains a hypothesis for the next owner-started Go.

## Owner live-run correction (2026-09-27)

The owner ran Browser Buddy W-3 and authorized a bounded follow-up to diagnose and harden the observed failure semantics. The run could not inspect the pinned repository because its command sandbox failed to create a namespace on three attempts, marked every substantive objective stuck, and nevertheless submitted a report that the portal presented as *Run complete* with Accept available. The owner requires a blocking objective failure to end the run early, a failed run to be unmistakable and impossible to accept, and its actions to center on diagnosis while retaining read-only review of the report.

The follow-up may change the local run-state contract, Symphony workflow/tool guidance, work-item and review UI, tests, evidence and status; rebuild/restart the local portal and agent hosts; and use disposable local checks. It does not authorize another live model turn, external writes, spending, deployment, release or owner acceptance.

The same trace also establishes an action-selection finding: W-3's Go bundle contained its title (`hello world`), request and criterion, but pinned the `platform.security` / *Security audit* action. The generic audit objectives therefore came from an action/task mismatch rather than missing task context. This pass will make that provenance visible in the run and strengthen task-specific planning guidance; broader action-selection UX remains separate unless a bounded defect is found.

### Context-budget safeguard

This follow-up exposed an operator failure: broad, repeated source and database reads consumed a disproportionate model-usage window. For the rest of this packet and equivalent diagnostics, use identifier-scoped database queries and line-bounded source reads; cap routine command output at 5,000 tokens; do not reread a file already summarized unless a named line or changed hunk is needed; run focused checks before suites; and stop for owner confirmation before any single diagnostic expansion expected to exceed 10,000 tokens. A compacted handoff is the working context after a large trace, not another full-corpus read. Effectiveness is tested here by completing the remaining patch and verification without another broad read.

### Live-run correction result

- `stuck` now means a terminal blocking objective. Reporting it records the root cause, ends the attempt, settles the batch and prevents later objectives or submission. Recoverable obstacles remain `active` with a note.
- Historical submitted runs with an unresolved stuck objective are derived as *Failed*, retain their diagnostic output for read-only review, and cannot be accepted. Browser Buddy W-3 now reports the original namespace failure rather than the later downstream symptom.
- Failed and stopped cards lead with *Review diagnosis* / *Review run* and keep *Close run* secondary. The review route explicitly says a failed run cannot be accepted. The pinned action name and description now appear beside the request, making action/task mismatches visible.
- Symphony guidance now requires task-specific objectives anchored in the request and criteria, and tells agents to stop immediately after reporting `stuck`.
- Focused work-run tests pass 9/9; typecheck and production build pass with the two existing `code.ts` optional-chain warnings; `git diff --check` passes. The restarted production read model returns W-3 as `failed`, names the first sandbox failure as its reason and retains its report. No new model run was started.
- The context-budget safeguard was applied after compaction: subsequent inspection used only identifier-scoped queries and bounded output, and verification used the focused suite rather than another full-suite run. The launcher itself emitted an unavoidable one-time dependency build/audit stream while rebuilding the changed Symphony overlay; subsequent polling was capped.

## Worker sandbox repair authorization (2026-09-27)

The owner asked to address W-3's underlying host failure: Codex could not create its command-sandbox namespace inside the Browser Buddy Symphony container. This authorizes bounded inspection and local changes to the checked-in Symphony host/runtime configuration, focused reproduction and verification inside disposable or existing local worker containers, rebuilding/restarting those local hosts, and updating evidence/status. It does not authorize another task Go or model turn, external deployment, spending, release or acceptance.

### Worker sandbox repair result

- Reproduced without a model: the existing non-root worker denied both `unshare -Ur` and Bubblewrap namespace creation.
- Disposable comparison proved `seccomp=unconfined` is sufficient; `SYS_ADMIN` alone was insufficient. The selected boundary uses `seccomp=unconfined` with `no-new-privileges`, no privileged mode and no added capabilities. Existing source, token and Codex-auth mounts remain read-only.
- `integrations/symphony/local-hosts` includes the security boundary in its reconciliation hash and runs a no-model Bubblewrap smoke test before reporting each worker started. A future incompatible Docker/kernel change now fails host startup rather than wasting an authorized model run.
- Both project workers were recreated and passed the smoke test and fresh-heartbeat check. A repository-backed check inside Browser Buddy's repaired Bubblewrap sandbox read exact commit `f0f3af365ea0d5886e386774da459115aee0485e`, confirmed a clean tree and listed tracked files.
- W-3's terminal workspace had already been removed by Symphony, so its failed report is not upgraded. Infrastructure readiness is proven; security assurance still requires a new owner-authorized audit run. For the original “add hello world code” intent, the next implementation run must use `platform.implement`; a security audit is a separate follow-up after code exists.

**Retrospective:** the host preflight checked authentication and heartbeats but not the first operation every agent needed—creating its command sandbox. Adding that executable prerequisite check is the durable process correction. The focused no-model reproduction and exact-commit read prove it works in this environment; only agent behavior and the actual audit remain unproved until a new Go.

## Task archival authorization (2026-09-27)

The owner identified that the failed, wrongly scoped Browser Buddy hello-world task cannot be removed from normal Work views. This authorizes a recoverable local archive lifecycle: preserve the item, runs and activity in storage; hide archived work from normal project snapshots and planning/blocking views; expose an explicit Archive task action; prevent archival of active or genuinely reviewable work; add focused regression/browser coverage; and rebuild/restart the local portal. It does not authorize hard deletion, another task Go, or a model turn.

### Task archival result

- Work items now retain `archived_at` and `archived_by`. Archived rows, attempts, reports, reviews and activity remain stored, while normal Work snapshots and blocker calculations exclude the item.
- The item header offers *Archive task* in its secondary menu after run state loads. A confirmation explains that history is preserved and the item leaves normal Work views; success returns to Work › Items.
- The server refuses archival while an item is claimed, needs an answer, belongs to an active non-terminal batch, or has a genuinely successful submission awaiting review. Failed/stopped runs may be archived directly, including the legacy submitted-plus-stuck shape exposed by W-3.
- Focused lifecycle tests pass 10/10, including archive preservation and refusal cases. Typecheck/build pass with the two existing `code.ts` warnings, `git diff --check` passes, and the restarted portal returns 200 with both archive columns active. The live W-3 run is now closed and eligible; it was not archived by the agent.

**Retrospective:** failed experimental work needs a disposal state distinct from acceptance, rejection and hard deletion. The durable rule is to preserve execution evidence while removing archived work from operational queues and dependency calculations. A future Archived view/restore control may improve self-service recovery, but is not required to remove noise safely now.
