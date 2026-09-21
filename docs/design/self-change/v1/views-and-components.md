---
id: design-self-change-contracts-v1
status: proposed-for-owner-review
updated: 2026-09-18
---

# View and component contracts

## View briefs

All views inherit C1, a readable project context and local destination. Exact routes are implementation work. Stable record identity and a return path are required. The [review board](review.html) provides loose compositions; these contracts define behavior to test later, not behavior implemented by those drawings.

| View | Entry and owner need | Ordered content / primary action | Exit and boundary |
|---|---|---|---|
| V1 Overview | From Projects, return visit, or decision return; S1/S2/S4 | Project outcome → blocker consequence → independent work → recent result → request entry. Primary: review the consequential decision in the shown state | V2 answer, V3 ready task/request, V4 result. Summarizes; never answers/starts work inline |
| V2 Decision | From blocker summary or Inbox; S3 | Question → why now → affected work → choices with consequences → save. Primary: Record decision after explicit selection | Return to origin or inspect newly ready task. Does not start execution |
| V3 Work | From request, ready-work link, or Work; S4–S6 | Intent/revision → acceptance/exclusions → readiness → authorization or current progress → result/history. Primary follows state: refine, answer, authorize, inspect result, or recover | V2 if blocked; V4 on result; return Overview. Provider details belong in diagnostics |
| V4 Artifact review | From Reviews, result, or task; S7/S8 | Result purpose and identity → task to try → preview → acceptance evidence/gaps → response. Primary: Accept this build only when current and review-ready | Revision returns to V3 with new task revision. Acceptance retains V4 evidence; no merge/release |

**Responsive behavior:** Below roughly 760px, reading order becomes a single column. A places blocker before independent work; B turns list/detail columns into list followed by selected context, with an explicit back-to-list link in a later prototype. V4 shows intent then preview then evidence then response; no tiny embedded desktop preview. Task authorization and changed-input warnings appear before their action. Sticky action areas must not obscure content or focus; use ordinary document flow initially.

**Keyboard/accessibility contract:** real links for navigation; one h1 per product view; visible focus; fieldset/legend and labeled radios for decisions; distinct submit; error summary plus field errors; status conveyed with text; announce saved/error outcomes without moving focus unexpectedly. Stale-disabled acceptance has a persistent explanation. These are requirements, not verified accessibility claims about a future app.

## Major component responsibilities

Each contract includes a purpose, meaningful inputs, presentation/behavior, and required variants. C1–C10 are design identifiers, not ten mandatory implementation files.

| ID | Purpose and anatomy | Inputs / behavior / states | Rationale |
|---|---|---|---|
| C1 Context header | Project, destination, milestone, record title; local return link | Project and record identity; preserve origin; narrow layout stacks labels | S1; borrowed from Linear context, R-07B V1 |
| C2 Blocking-decision summary | Question, consequence, affected records, textual urgency, detail link | Decision state and explicit blocking relations; deduplicate decisions; partial/none/open/deferred | S1/S2; consequence replaces decorative progress metric |
| C3 Independent-work list | Task title, reason it can proceed, readiness, view link | Dependency result and task revision; ready/awaiting authorization/none/unknown | S2; prevents a blocked project from implying all work must stop |
| C4 Decision form | Context, choices, recommendation rationale, affected work, save/defer | Decision revision; choice starts unselected; save produces new revision; conflict retains draft and requires review | S3; recommendation never equals consent; summary/change pattern from R-07B G1 |
| C5 Input-change notice | Changed input, old/current revisions, consequence, next action | Input comparison; current/stale/unknown; preserve older context; do not offer a silent override | S3/S8; Figma readiness cue extended with actual revision identity |
| C6 Intent brief | Original request, editable interpretation, acceptance, exclusions, source references | Task/proposal revisions; edit creates revision; old authorization cannot carry forward silently | S4; reviewable plan pattern from R-07B Lovable |
| C7 Authorization summary | Exact revision, permitted effect, exclusions, destination, expected return, stop conditions | Readiness and scope; explicit confirmation; save/error/changed inputs; no action while unresolved required choice | S5; GOV.UK summary-and-confirm pattern; this fixture does not resolve real Q-002 |
| C8 Progress/exception notice | Current stage, reason, preserved evidence, safe next step, diagnostic disclosure | Attempt and confirmed connector state; queued/offline/input/failure/cancelling/uncertain | S6; owner action comes before protocol detail |
| C9 Result and acceptance evidence | Preview with identity and task to try; criteria with pass/fail/not-tested; checks and gaps | Artifact availability, build identity, evidence entries; missing/offline/partial/current; missing evidence is not a pass | S7; test apparatus separate from product, R-07B Storybook |
| C10 Review response/history | Feedback field, request revision, accept, earlier results | Artifact and input revisions; acceptance eligibility rechecked on submit; request creates linked revision; retain prior feedback | S7/S8; Chromatic snapshot-specific feedback; no live-head ambiguity |

**Content limits:** Summary C2 uses a short question and one consequence sentence, followed by named affected records; full rationale lives in V2. C3 explains independence, not just a green badge. C8 must say whether the next action will retry, resume, or reconcile. C9 labels synthetic checks in the prototype. Source/build hashes are secondary but available before acceptance; concise candidate labels never replace immutable stored identity.

## State inventory and prototype acceptance examples

| State / trigger | Visible response / action | Invariant and later test |
|---|---|---|
| Loading records | Loading milestone information; no zero count | No false all-clear; C2/C3 |
| Partial or failed impact lookup | Impact unavailable; retry/read known records | Unknown cannot authorize dependent work |
| Empty milestone | No milestone selected; choose milestone | Different from no blockers |
| No blocking decisions | No blocking decisions; ready work remains | Other milestone gates may remain incomplete |
| Open required question | Consequence and affected work; review decision | Q-002 counted once despite two task links |
| Optional preference | Separate optional section | Q-VIS not counted as blocking |
| Deferred required decision | Deferred; affected work still blocked | Deferral is not resolution |
| Save failed/conflicted | Preserve selected answer; explain conflict; reload comparison | Do not overwrite a concurrent revision or imply saved |
| Answer recorded | Confirmation + inspect ready task | No automatic execution; T-COPY unchanged |
| Task revision changed | Authorization needs renewal | Previous scope cannot authorize new inputs |
| Ready, unauthorized | Review scope then authorize | Readiness is not queue membership |
| Authorization persisted, queue unknown | Queue confirmation pending; reconciliation if ambiguous | Do not claim queued or create duplicate task |
| Queued, worker offline | Waiting for worker; last seen; cancel | Task survives unavailable local worker |
| Running | Useful stage and attempt; cancel | Raw logs optional |
| Agent requires input | Question and consequence; answer then continue authorization | Answer does not silently restart |
| Cancellation requested | Cancelling until confirmed; uncertain if either boundary unknown | Do not report terminal success prematurely |
| Attempt failed | Failed stage, preserved evidence, retry assessment | Retry creates a new attempt when safe |
| Preview missing/offline | Artifact identified; cannot open preview; retry availability | No unrelated/latest preview substitution |
| Evidence partial | Not tested / missing check named | Review policy unresolved in Q-005; prototype uses conservative no-accept for missing required evidence |
| Current reviewable A1 | Intent, result, checks, gaps; accept/revise | Accept binds A1 and its frozen inputs, not release |
| Decision r2 supersedes input r1 | A1 stale; changed input shown; acceptance unavailable | Historical evidence remains inspectable |
| Feedback submitted | Feedback retained on A1; r2 draft task created | A2 must be a distinct artifact from new authorization |
| Accepted result | Accepted build identity + history | No production deployment implied |
| Project access denied | Explain unavailable project; return to allowed scope | Never leak other project records |

## Loose shared composition rationale

The shared flow sheet on the board details V2–V4 after either Overview alternative. V2 uses a dedicated record page because consequences and revision conflicts need space; an inline answer control is rejected for this first trial. V3 reveals authorization below the intent, then substitutes progress after authorization. V4 gives the preview most space on desktop, with a compact intent header and evidence/response column. A fully side-by-side old/new preview is deferred: inspect the candidate first, reveal historical comparison when requested.

These choices are proposed and may change with owner feedback. Later D-01B should build only the selected overview and necessary shared flow, using a small scenario selector outside the product. Do not implement every state during D-01C.
