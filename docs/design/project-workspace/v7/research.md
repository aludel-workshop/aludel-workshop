---
id: project-workspace-v7-reference-study
kind: design-reference-study
status: research-complete-direction-proposed
updated: 2026-09-20
accessed: 2026-09-20
packet: D-04R
---

# Work: references before another composition pass

[Visual reference board](http://127.0.0.1:4310/reviews/project-workspace-v7/index.html). Downloaded source screenshots, URLs, access dates and hashes are in [sources.json](sources.json). These are vendor-published examples inspected visually, plus primary documentation, not live account tests or measured usability studies. They inform interaction and hierarchy; Aludel retains its accepted MD3 foundation.

## Owner corrections retained

- **Overview:** understate the current milestone and design review; summarize milestone progress. Promote clearing the action stack. Remove “Next up.” Put small execution vitals in or below the header, e.g. active agents and queued tasks.
- **Development Plan:** v6 is muddy and its reading/navigation are unclear. Reopen the composition and find examples before selecting another one.
- **Agent Operations:** small dashboard at top for spend policy, connected servers and related vitals; individual work-item cards underneath. Review-ready at top, work agents have claimed next, unstarted below; hide done by default. Distinguish review-ready, in-progress, problem, not-started and not-started/blocked.
- **Intake:** “about fine.” Retain the direction. This is qualified composition feedback, not acceptance of unbuilt behavior.
- Research may suggest functional improvements. No purchase, provider choice, live data change, concurrency increase or runner execution follows from example metrics.

## 1. Overview: understated progress plus an actionable collection

### Linear Project overview and milestones

[Project overview](https://linear.app/docs/project-overview) presents a summary, properties, resources and milestone rows. In the captured screen, milestones occupy a quiet, compact area; no large launch-style call to action competes with content. [Milestone documentation](https://linear.app/docs/project-milestones) connects progress indicators to the underlying issues and supports opening a milestone-filtered issue view. Its progress calculation gives partial credit to started work.

**Borrow:** small milestone summary with a linked breakdown. **Adapt:** use our own explicit completion basis; distinguish completed work from milestone acceptance. **Avoid:** the screenshot's lengthy description block, broad metadata row and partial-progress formula as automatic defaults. **Confidence:** visual and documented; owner comprehension untested. **Reverse if:** the compact summary hides which deliverable or gate prevents milestone completion.

### Linear Inbox

[Inbox](https://linear.app/docs/inbox) uses an attention-oriented collection, priority separation and repeatable title/context rows. It provides navigation, search and snoozing. The screenshot is useful for comparable rows and restrained status placement; it is a notification system.

**Borrow:** one prominent action collection, filterable by type, with stable order and a direct destination per item. **Adapt:** our items are unresolved decisions, reviews and blockers, not unread events. **Avoid:** dismiss/read as resolution or copying notification volume. **Reverse if:** one task creates several indistinguishable action rows; group by work identity and preserve the separate required decisions.

### Proposed transfer to Aludel — design inference

Reading order: title → small execution-vitals strip → compact milestone-progress summary → dominant **Needs you** stack. No Next up. Design review appears as a normal review item in the stack; the milestone summary contains a quiet plan link.

Example content, explicitly synthetic: “M1 · First complete change loop — 8 of 14 scoped work items complete; 2 gate decisions open.” Progress totals name their basis. Clicking the summary opens the same milestone in Plan; selecting an action opens the authoritative review/question and returns to the same stack position.

Example vitals: “4/4 agents active · 12 queued.” Here, the denominator means connected execution slots, and queued means authorized/eligible work waiting for capacity. These are illustrative display semantics, not current portal facts. If data is unavailable, label that fact with its last update.

## 2. Development Plan: choose scope, then read comparable work

### Linear Initiatives

[Initiatives](https://linear.app/docs/initiatives) separates the objective/name from target, health and contributing-project columns. The screenshot's hierarchy has alignment guides and consistent columns. This is clearer for scanning than v6's nested bold text, mixed granularity and permanent detail pane.

**Borrow:** meaningful columns and an explicit difference between outcome and contributing work. **Adapt:** default to one selected milestone and one work level. **Avoid:** copying its enterprise hierarchy or showing every nested level at once. **Reverse if:** narrowing scope hides critical cross-milestone dependencies; add scoped links and a cross-milestone dependency view, not unrestricted nesting by default.

### Linear Timeline

[Timeline](https://linear.app/docs/timeline) deliberately shows projects rather than granular issues. Its captured screen uses horizontal bars, named milestone markers and a time axis. This demonstrates separating planning scale from implementation detail.

**Borrow:** high-level sequencing and named checkpoints. **Avoid:** mixing every task onto the time axis, or inventing dates to fill a chart. **Reverse if:** dates and overlaps become the owner's primary planning question; then a timeline can become the default for that scope.

### GitHub Projects

[Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) supports several saved views over the same underlying work. [Roadmap configuration](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-roadmap-layout) provides date fields, grouping, filtering and slicing. The downloaded roadmap image is only a toolbar crop; it is not evidence of a complete page composition.

**Borrow:** scope-preserving projections, clear column headings, explicit filters. **Avoid:** spreadsheet customization as the first owner task, drag-to-reschedule as implied authorization, or a calendar default when dates are unknown. **Reverse if:** the owner repeatedly needs bulk metadata editing more than guided drill-down.

### Alternatives and recommendation — design inference

| Direction | Reading/navigation | Strength | Risk | Verdict |
|---|---|---|---|---|
| Milestone navigator + scoped work table | Pick milestone → compare outcomes/features → open one feature's tasks → open task | Stable vocabulary and scale, works without dates | Extra step to inspect a deep task | Recommended experiment |
| High-level timeline | Find milestone/date → inspect a workstream → drill down | Shows overlap and commitments | Implies scheduling precision we do not have | Secondary view when real dates exist |
| Full expandable hierarchy | Expand outcome → feature → task with detail pane | All levels accessible in place | Repeats the v6 reading problem | Rejected as default; reconsider only with observed need |

Proposed page anatomy: a compact milestone selector (completed/current/later; not lifecycle lanes), current milestone's outcome/exit criteria, then a table with **Outcome or feature / Progress / State / Depends on**. Within a feature, replace that table with its task list and a breadcrumb. Each level has one kind of row. Show no preselected item pane at entry. A dependency view preserves scope and names the blocking prerequisite. Back restores milestone, filter and scroll.

Naming needs an explicit contract: project phase, milestone, outcome, feature and executable work item are not interchangeable. A milestone is an observable checkpoint; a feature is a deliverable contributing to it. Start the experiment with one selected checkpoint and a small representative mapping of current M1 records, not a silent migration/reclassification of the whole historical plan.

## 3. Agent Operations: compact vitals, then the work itself

### GitHub Agents panel / mission control

The [Agents panel](https://github.blog/news-insights/product-news/agents-panel-launch-copilot-coding-agent-tasks-anywhere-on-github/) screenshot shows task titles, age, explicit status and review-ready work in one stack. Its large task-composer region is unrelated to the requested monitoring priority. The later [mission-control task view](https://github.blog/changelog/2025-10-28-a-mission-control-to-assign-steer-and-track-copilot-coding-agent-tasks/) links task context, activity and changed files.

**Borrow:** task identity before agent identity; recognizable repeated objects; direct route into the produced result. **Adapt:** one bounded card per work item, explicit ready-for-review label, review-first order. **Avoid:** green checkmark ambiguity between review-ready and accepted; auto-start from entering a prompt. **Reverse if:** large card stacks become hard to scan; use a compact density mode while retaining the same fields and status grammar.

### Buildkite Queue details

[Queue metrics](https://buildkite.com/docs/pipelines/insights/queue-metrics) separates connected/in-use agents, runnable work waiting for capacity, input/dependency waits and freshness. Its screenshot has distinct resource/job panels above operational detail. Current direct documentation differs from older search snippets; this study uses the opened page and captured current asset.

**Borrow:** compact capacity/queue counts, freshness, state-based drill-down and a visible reason work cannot start. **Adapt:** a single restrained header strip plus task cards. **Avoid:** large fleet charts, percentile dashboards and treating blocked work as runnable queue demand. **Reverse if:** persistent capacity problems require historical trend analysis; add that as a diagnostic destination.

### Jules Repo view — behavior reference only

[Jules Repo view](https://jules.google/docs/repo/) documents project-scoped tasks, explicit waiting/failed labels and reopening tasks for feedback. It orders running work first. **Borrow:** scoped work list and continuation on the same identity. **Override:** our owner wants review-ready first and done hidden. No useful screenshot was available on this page, so it supports behavior only; no Jules visual comparison or live trial is claimed.

### Proposed stack and state semantics — design inference

Top strip: **Agents active/connected · Queued · Servers healthy/connected · Spend policy/usage · Updated time**. Connected servers do not equal worker slots: one server can host several slots. An unhealthy connection must not count as usable capacity. Bootstrap defaults remain the actual local configuration.

Suggested order: **Ready for review → Problems → In progress → Not started → Blocked**. This preserves owner review-first ordering and promotes stopped attempts just below it. Problems can also contribute to a small header alert. Completed items remain available through Show done; no automatic archival or deletion is implied.

| State | Visual semantics | Card content | Primary action |
|---|---|---|---|
| Ready for review | Review icon + violet accent + literal label | Result summary, preview/artifact identity, checks summary, waiting age | Review result |
| Problem | Warning icon + amber/red accent + cause | Failed or waiting-for-answer subtype, last useful event, what is preserved | Answer question / Inspect failure |
| In progress | Activity icon + blue accent | Agent, current stage, elapsed and last update | Open activity |
| Not started | Neutral outlined state | Eligible/queued or authorization-required qualifier, queue reason | Open work / Review scope |
| Not started · blocked | Lock/dependency icon + muted amber label | Named blocker and linked prerequisite; never just an unexplained status | View blocker |
| Done (hidden by default) | Check icon + subdued treatment | Completion/acceptance evidence and date under the relevant task contract | View result/history |

One card represents a durable work item; attempts are history inside it. Do not create a new top-level card for every retry. Ready for review is not Done. Closing a review resolves that review item; it completes the work only when its actual acceptance contract is satisfied. Completion still does not imply release.

The five visible states are a display projection, not a new domain state machine. A late signal can reopen attention without erasing historical attempts. Stable ordering must not shuffle a card while it has focus; surface an update notice and reconcile after action/refresh.

## 4. Functional findings worth carrying forward

1. **Clear work, not notifications.** Overview counts outstanding owner actions. “Read” does not clear a decision. Provide explicit next-item navigation after resolution, retaining a visible result and return context. Suggested for the prototype now; snooze optional notifications later while leaving unresolved blockers visible.
2. **Make all summary counts inspectable.** A milestone total opens its contributing records; an active/queue count opens that exact scoped list. Distinguish ready, blocked and awaiting-authorization counts. Suggested now; live telemetry remains dependent on the worker adapter.
3. **Show freshness and waiting age.** Old agent data should say when it was last seen. “No update for 8 minutes” differs from “working for 8 minutes.” Suggest fields/states now; automatic stall detection needs a tested threshold and belongs later.
4. **Distinguish budget target from enforcement.** GitHub's [budget controls](https://docs.github.com/en/billing/how-tos/set-up-budgets) distinguish alerts from stopping usage. Our strip should show amount, period, scope and whether enforcement is verified, alert-only or unavailable. Existing policy is no incremental spend without authorization. Do not claim a provider hard cap or $0 actual usage from that policy. Suggest truthful display now; paid-provider control and aggregate accounting remain separate future work.
5. **Separate done-work progress from gate readiness.** “8/14 complete; 2 gates open” explains more than one opaque percentage. Use unique scoped records and a named basis; do not double-count a task contributing to two outcomes. Suggest this read model now; weighting/forecasts can wait.
6. **Preserve the review loop on the card.** Preview, concise checks, request changes and exact-result identity should remain together on the review destination. No accept/merge shortcut in the stack. Candidate transport/immutability stays a B-03 dependency.

These are recommendations, not newly accepted functionality or permission to execute parallel agents. The illustrative 4/4 agents does not alter the repository's one-packet policy or configured concurrency.

## Process finding

The earlier research selected an outline from capability descriptions without demonstrating how the owner would read it. Vendor support for hierarchy is not evidence that our hierarchy is clear. New evidence requirement: inspect the actual example screen, identify reading order and object granularity, map it to an owner walkthrough, and name what would reverse the recommendation. This study exercises that requirement: it rejects full-tree default, rejects GitHub's large composer for Operations, and extracts Buildkite's state meanings without importing its fleet dashboard.

## Next review experiment

Before a full executable pass, compare two small Plan compositions over identical M1 content: milestone-scoped table versus high-level dated/sequenced roadmap. Ask the owner to find the current checkpoint, explain one blocker and open contributing work. The scoped table is the recommendation, not an acceptance. Overview should demonstrate the quiet summary + dominant action stack, and Operations all five distinct task states plus hidden Done. Intake retains v6 direction with its unbuilt behavior checks still required.
