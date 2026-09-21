---
id: portal-structure-v1
revision: 1
status: accepted-for-prototype
updated: 2026-09-19
packet: D-01D
---

# Places and journeys before screens

This structural contract is accepted as the basis for D-01B direction A. [Input identities](inputs.json) preserve the baseline; [review board](review.html) compares two ways to arrange this contract. BorrowBox is fictional. Acceptance is scoped in the [review record](review-record.md) and does not establish product behavior or implementation readiness.

## Scope and references

One owner returns to several projects, requests bounded changes, answers consequential questions, authorizes a task, follows it, and reviews an identified result. This packet defines the places and transitions for that loop. Production release, automated scheduling, full planning tools, portfolio analytics and connection setup are excluded. A recovery link can lead to future connection settings without inventing that settings page here.

Internal references: [Overview B](../../self-change/v2/review.html) supplies the retained opening hierarchy; [prior contracts](../../self-change/v2/views-and-components.md) supply intent, authorization and immutable-review anatomy, but their navigation is unaccepted. [F-01–F-07](../feedback-2026-09-19.md) provide rejection evidence. The [R-07B benchmark](../../../evidence/r-07b-workflow-benchmark.md) supplies captured references for record context, summary-before-confirmation and evidence-bound review. These are design inputs, not new vendor claims or proof of usability. Alternative A emphasizes project context and was selected; B tests cross-project attention and remains unselected. These A/B labels are independent of the prior alternative also named B.

## Owner journeys

| Story | Arrival and intended outcome | Path and handoff | Observable success |
|---|---|---|---|
| J0 Orient | Returning owner needs to choose a project | Projects → BorrowBox Overview; B additionally offers portfolio Attention | Current project and milestone remain explicit on every subsequent record |
| J1 Request | Owner has the reservation request, no task yet | Overview or Work → scoped request form → saved task detail in refining state | Durable BB-001 exists before execution; failed save retains text and creates no apparent task |
| J2 Decide | Owner sees reservation policy blocking work | Overview decision item → BB-D01 detail → record answer → stay on answered decision → affected Work collection | Answer, impact and next destinations are distinct; no execution starts |
| J3 Authorize | Owner wants one ready task to proceed | Work ready filter → named BB-001 → read intent/criteria/scope → authorize exact revision → same task | Confirmation says authorization recorded, then confirmed queue state; task is not reported complete |
| J4 Follow | Owner returns while work is underway | Work active filter → same BB-001 → progress or exception → contextual recovery | Knows what happened, what is waiting, and whether owner action is needed |
| J5 Review | Owner wants to try the result | Project Reviews or task result → exact candidate A1 → inspect preview/evidence → accept or request revision | Review stores A1 and its inputs; acceptance stays on A1 and does not release it |
| J6 Reassess | Earlier decision or task inputs changed | Stale review → changed-input explanation → task current revision → new authorization when ready | Old candidate remains readable; it cannot complete current work |

## Product map and scope boundary

```text
Owner workspace
  Projects (collection) → project Overview (summary)
  [B only: Attention across projects; filtered links to canonical records]
  Project
    Overview: outcome, consequential decisions, ready work, active work, results
    Work (collection) → Task (one intent + current action + own history)
                         → Request/refinement (form within Work/task context)
    Decisions (collection) → Decision (one choice + affected work)
    Reviews (collection) → Candidate review (one immutable artifact set)
  Utilities: connection/worker recovery destinations, outside drawn scope
```

Both alternatives retain project Overview. Work, Decisions and Reviews are distinct places; an accepted build is not a release. Full Plan and Releases navigation is deferred rather than shown as a working destination. Milestone/proposal context is read on Overview and linked task intent for this slice. These are proposed scope reductions, subject to owner review.

Collection routes preserve project, filter, ordering and return position. Detail routes identify the record independently of the current list. A conceptual path such as Projects / BorrowBox / Work / BB-001 expresses identity, not a chosen URL implementation. A copied detail link has a canonical collection return even without navigation history. Switching projects goes to the destination project's Overview, never reuses the previous project's task selection. Empty projects offer a request; unknown/loading counts never read as zero.

## Page archetype contracts

| Page | Arrival / question | Owns, in reading order | Excludes | Entry → exit / primary action |
|---|---|---|---|---|
| P0 Projects | J0: where should I focus? | Project identity, objective, attention summary | Task actions, detailed evidence | Workspace entry → Overview; open named project; empty → create-project flow outside this experiment |
| P1 Overview | J0/J2: what needs me in this project? | Milestone context, consequential decisions, ready summary, active summary, results, request entry | Inline authorization, full task history, claim of milestone completion from zero decisions | Projects → decision, filtered Work, named review or request; primary follows priority: blocking decision, review, ready work, request |
| P2 Collection | J2/J3/J4/J5: which record should I open? | Title/scope/filter, count, rows with identity and consequence; Work also owns request entry | One record's full action form, silent selection of first row | Overview/nav → selected detail; primary open named row; empty clear filter or new request as appropriate |
| P3 Decision | J2: what choice matters, with what effect? | Question/context, options, recommendation, affected tasks, explicit save, answer/history | Execution authority, task-completion celebration | Overview/Decisions/task → same page after save; affected Work or return to origin; primary record answer; answered → view affected work |
| P4 Task | J1/J3/J4: what is this task for and what should happen next? | Identity/status, intent/criteria, current-action region, dependencies, current attempt/result, own history | Other ready work, decision queue for whole project, full artifact review form | Work/request/deep link → decision/review/Work; state-dependent action below |
| P5 Candidate review | J5/J6: does this exact result meet intent? | Candidate identity/currency, brief and things to try, preview, evidence/gaps, response, history | Unrelated tasks, automatically replacing preview with latest build, release controls | Task/Reviews → stay after accept; task new revision after revision request; primary accept eligible build or address missing/stale evidence |

Decision and task use one document with headings and disclosure for history/diagnostics. No tab-shaped anchor links. Work/Decisions/Reviews navigation changes destinations. A review is a full workspace; it can use two content columns on wide screens, one ordered document on narrow screens.

## Task-detail story map

Stable reading spine: **why this task → what success means → what happens next → evidence/history**. In a return visit the concise state/action region remains visible near the title; intent and criteria remain readable before authorization. This is one task across its lifecycle, not a dashboard of unrelated work.

| State / story | Owner needs to understand | Dominant action and consequence | Secondary evidence |
|---|---|---|---|
| Refining / J1 | Did the interpretation preserve my request? | Save interpretation → immutable revision and dependency check | Original request; exclusions |
| Blocked / J2 | Which required answer prevents progress? | Open named decision; several blockers listed, none silently picked | Causal dependency links; optional choices separate |
| Ready / J3 | What exactly am I permitting? | Authorize this revision after scope is visible | Criteria, allowed effects, source inputs, stop conditions, expected artifact |
| Authorized / J4 | Was intent persisted; has the queue confirmed it? | Inspect queue problem when actionable; otherwise no forced primary button | Authorization identity and reconciliation state |
| Queued/running / J4 | What is it doing or waiting for? | No mandatory action; Cancel secondary | Stage, last update, attempt; worker availability only when consequential |
| Awaiting input / J2/J4 | What decision stopped this attempt? | Answer decision, then separately authorize continuation | Retained attempt, new inputs, scope of continuation |
| Failed / J4 | Can another attempt run safely? | Review retry scope when safe; reconcile when unknown | Failed boundary, partial evidence and previous attempt |
| Cancelling/uncertain / J4 | Has work actually stopped? | Reconcile uncertainty; no retry while outcome unknown | Worker and connector confirmations |
| Cancelled / J3 | What remains and can I restart? | Review restart scope; a new authorization is required | Prior attempt and partial artifacts |
| Awaiting review / J5 | What can I try? | Open candidate A1 | Concise result, checks summary and currency |
| Revision requested/stale / J6 | What changed and what must run again? | Refine/reassess current revision, then authorize when ready | Prior candidate/feedback preserved |
| Accepted / J5 | Which result did I accept? | View accepted candidate | Acceptance identity; explicitly not released |

## Transitions and failure behavior

Every row names starting context, trigger, records, visible outcome, destination/return and failure. It is a proposed contract for later tests, not observed runtime behavior.

| ID / context and trigger | Affected records and visible outcome | Destination / return | Failure or stale behavior |
|---|---|---|---|
| T0 Overview/Work: submit request | Save request/task r1; show interpretation pending or ready for refinement | New task; back to source collection/Overview | Preserve unsaved text; retry reconciles original submission before another task |
| T1 Decision: record answer | New decision revision; recompute impacted readiness; show “Reservation policy saved. 2 affected tasks assessed; 1 ready, 1 still waiting.” | Stay on answered decision, with affected Work link and explicit return; never auto-advance | Failed/conflicting save retains draft; unknown impact says checking/unavailable and does not assert ready |
| T2 Overview ready summary / decision affected summary: open collection | No record mutation; scoped count and filter | Work ready or Work affected-by-BB-D01; named row opens detail | Zero keeps empty collection; one still uses collection; many show all; failed count shows unknown |
| T3 Ready task: authorize revision | Durable authorization/job; show “Authorization recorded; queue confirmation pending,” then queued only on confirmation | Same task, same return filter | Changed inputs invalidate submission; connector ambiguity requires reconciliation, not duplicate dispatch |
| T4 Running: consequential input arrives | Persist question, stop eligibility; show awaiting decision | Task → decision → task continuation scope | Answer alone never resumes; changed inputs remain explicit |
| T5 Queued/running: cancel | Record cancellation intent; show cancelling until both boundaries reconcile | Same task; Work return unchanged | Unknown worker/connector result means cancellation uncertain; no false terminal success |
| T6 Failed: retry/restart authorized | New linked attempt with reviewed current inputs; retain prior attempt | Same task | Unknown external effect blocks retry; safe retry reuses mapping |
| T7 Result reconciled: open candidate | No mutation; candidate A1 and inputs locked in review identity | Candidate review; back to task or Reviews | Missing preview stays A1 with unavailable notice; no latest-build substitution |
| T8 Current review: accept | Acceptance references exact artifact and inputs; task completed for that revision; show accepted, not released | Stay on review; explicit back to Reviews/task | Recheck currency on submit; stale or missing required evidence blocks current acceptance; Q-005 threshold remains proposed |
| T9 Review: request revision | Feedback on A1, task r2, dependency reassessment, old authorization invalid for r2 | Task r2 with saved-feedback notice; backlink to A1 | Save failure stays on A1 with draft; no new run without authorization |
| T10 Decision/intent changes after build | Mark affected candidate stale; keep old evidence; name changed inputs | Review stays historical; link current task | Reassessment unknown blocks current acceptance; unrelated tasks/candidates unaffected |
| T11 Switch project or return | No mutation; named destination and preserved valid list filter | Project switch → target Overview; detail back → originating collection | Warn about unsaved form draft before abandoning; missing origin uses canonical collection |

### Cardinality and scope examples

BB-D01 affects BB-001 reservation implementation and **BB-003 reservation checks** (a v1 fixture extension). BB-003 also waits on implementation evidence, so answering policy alone does not make it ready. BB-002 catalog descriptions stays independent. With instant-confirmation policy recorded: Overview shows 2 ready tasks (BB-001/002); affected Work shows BB-001 ready and BB-003 waiting. The board's counts use these exact premises.

Zero affected records: say “Answer saved; no linked work,” retain decision context and return; no “ready task” shortcut. One affected record: summary still opens the filtered collection; an explicitly named BB-001 link may open detail. Several affected records: summary opens all affected work, including remaining blockers. Zero ready tasks does not mean project complete. A stale decision during save produces a comparison, never a misleading all-clear.

## Component ownership and rationale

These are responsibility contracts, not implementation component files. All major regions in the board map here.

| ID / region | Story and page owner | Why it belongs / input and states |
|---|---|---|
| C1 Shell and breadcrumb | J0; all pages | Establish project and place; project name, destination, record; full/compact shell; switching returns to Overview |
| C2 Decision/ready summaries | J2/J3; P1 only | Prioritize judgment, route by scope; counts from explicit dependencies; zero/one/many/unknown |
| C3 Collection filter and row | J0/J2–J5; P0/P2 | Choose among records without hiding multiplicity; named identity, state, consequence; empty/loading/partial/error |
| C4 Decision form + saved impact | J2; P3 | Record one choice then explain its effects; draft/saving/conflict/answered/deferred; never imply task completion |
| C5 Task brief | J1/J3; P4, condensed in P5 | Keep request, interpretation, criteria and exclusions reviewable; draft/current/historical |
| C6 Current-action region | J2–J4/J6; P4 | One task's next justified action from story map; authorization names revision/effects/stops; pending/error/stale disables unsafe submission |
| C7 Progress and exception | J4; P4 | Explain stage or recovery, with diagnostics subordinate; waiting/running/input/failed/uncertain/cancelled |
| C8 Result link/history | J5/J6; P4 | Route to a named artifact; current/missing/stale/historical; own task only |
| C9 Brief/preview/evidence | J5/J6; P5 | Evaluate one candidate against intent; unavailable preview/missing checks/current/stale; never inferred pass |
| C10 Review response | J5/J6; P5 | Feedback or acceptance tied to identity; draft/saving/error/accepted/revision requested; revalidate currency |
| C11 Request entry/form | J1; P1/P2 entry, Work context form | Capture intent before execution; empty/draft/save error/saved; task context owns subsequent editing |

Focus order follows document order. Navigation uses links; mutations use labeled controls in a later prototype. Notices use text rather than color alone. Narrow review order is identity/currency → brief → preview → evidence → response; no fixed action bar obscures content. Task history/diagnostics use explicit disclosure, not faux tabs. These accessibility behaviors remain specifications until interaction work exists.
