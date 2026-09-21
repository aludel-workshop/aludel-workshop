---
id: design-experience-001
kind: experience-foundation
status: usable-interaction-baseline-visual-direction-outstanding
updated: 2026-09-19
applies_to: [D-01B, B-01, B-02, B-03]
---

# Product experience foundation

## Current acceptance boundary — DEC-021/022

The owner reopened existing page composition and interaction grouping on 2026-09-19. The historical architecture below records useful intent and scenario learning, not a mandate to preserve the old Overview cards, columns, route boundaries or navigation presentation. Use the current [view-intent map](portal-system/v1/view-intents.md) and [MD3 philosophy profile](portal-system/v1/system-profile.md) to reconsider them. Preserve product invariants such as deliberate authorization, exact artifact review and acceptance/release separation. New compositions need fresh scoped acceptance.

Aludel is one project within itself. The [shared capability framework](../product-system-framework.md) applies to every project; this experience foundation and MD3 profile are Aludel's specific choices.

## Why this exists

The portal needs a coherent experience model before individual screens become implementation references. This document connects the product promise to owner jobs, user stories, information architecture, repeated interaction patterns, and a review method. It is deliberately small enough to revise after using the prototype.

The first D-01B prototype exposed the absence of this layer. It represented domain records and edge states, but it did not orient a reviewer or show where the screen belonged in the wider product. Its embedded scenario controls also made prototype tooling look like product functionality. Version 2 treats those findings as design input.

Owner review of version 3 showed that this foundation was too abstract to guide page composition. D-01D then defined journeys, page responsibilities, collection/detail relationships, transitions and task stories before comparing shells. The owner selected [project-workspace direction A](portal-foundation/v1/review-record.md) on 2026-09-19. The structure below is ready for a bounded interaction experiment; labels, behavior and visual character remain subject to D-01B evidence.

## Experience thesis

The portal is the owner's control room for turning product intent into reviewed evidence. The interface should help the owner answer five questions in order:

1. **Where should I focus?** See projects, milestones, and items needing judgment.
2. **What are we trying to achieve?** Inspect the original request, current interpretation, requirements, and unresolved choices.
3. **What can proceed safely?** Understand dependencies, authorize bounded work, and distinguish a product blocker from an execution problem.
4. **What happened?** Follow useful progress without reading raw agent logs.
5. **Does the result satisfy the intent?** Compare a specific artifact with the approved intent and either accept it or explain the next revision.

This order is the backbone of the experience. A screen may emphasize one question, but it should preserve links to the others.

## Primary user and jobs

The bootstrap has one role: the owner of several products. The role changes hats during a workflow, which is more useful than inventing several personas.

| Owner mode | Job to be done | Needed confidence |
|---|---|---|
| Portfolio owner | Decide where attention and budget go | I can see urgency, progress, and risk across projects |
| Product lead | Turn rough intent into an agreed outcome | The system retained my meaning and exposed consequential ambiguity |
| Work authorizer | Permit a bounded next action | I know what may change, where, and when the work must stop |
| Reviewer | Decide whether a concrete result is good enough | I can compare the result with the intent and evidence used to produce it |
| Steward | Understand history and recover from problems | Decisions, attempts, artifacts, and releases remain traceable |

The system, agents, workers, and integrations are supporting actors. They do not get navigation designed around their internal implementation unless the owner needs to diagnose a problem.

## M1 user-story spine

These stories define the first end-to-end experience. They are ordered by the owner's workflow rather than by technical subsystem.

### Orient and focus

- As an owner, I can see which projects need judgment, have active work, or have something ready to try, so I know where to focus.
- As an owner inside a project, I can see the current outcome, milestone health, blockers, active work, and latest reviewable result without reconstructing them from task history.

### Shape intent

- As a product lead, I can describe an outcome in ordinary language and see the system's structured interpretation before work begins.
- As a product lead, I can compare proposed choices by consequence, answer only decisions that materially affect the work, and see exactly what each decision blocks.
- As a product lead, I can revise an interpretation without rewriting the history used by earlier attempts or artifacts.

### Authorize and follow work

- As an authorizer, I can see the task revision, allowed effects, excluded effects, stop conditions, and execution destination before I authorize work.
- As an owner, I can distinguish product state, execution state, and integration health when that distinction helps me act.
- As an owner, I can cancel, answer a blocking question, reconcile ambiguity, or authorize a retry without creating duplicate work.

### Review and learn

- As a reviewer, I can open a review from an inbox and immediately understand the original intent, what changed, what to try, what passed, and what remains uncertain.
- As a reviewer, I can evaluate each signed-off acceptance example against one immutable artifact, request a revision in context, or accept that artifact.
- As a steward, I can see when changed intent or decisions make an older artifact stale, while retaining the old artifact and its review history.

Stories about automated release, broad unattended work, team collaboration, and workflow construction are intentionally outside M1.

## Product structure

### Workspace entry

Direction A begins with **Projects**, then keeps the owner inside the selected project. It does not add a cross-project Inbox or Reviews destination in this slice. Cross-project attention remains a deferred alternative to revisit if use shows that returning to Projects is too slow. Connections, workers, policies and account settings belong under a utility area and are outside the prototype.

### Project navigation

A project is the main context boundary. Its navigation uses stable nouns:

| Area | Responsibility |
|---|---|
| Overview | Current outcome, milestone, attention summary, active work, latest product |
| Work | Tasks and their readiness, authorization, and execution status |
| Decisions | Open and historical product decisions with affected records |
| Reviews | Immutable candidate artifacts, evidence, feedback and acceptance history |

The prototype exercises **Overview**, a filtered **Work** collection and task detail, one **Decision**, and one **Review**. Plan and Releases stay outside the slice instead of appearing as fake destinations.

### Record hierarchy and cross-links

The owner moves through a small hierarchy:

```text
Portfolio
└── Project
    ├── Outcome / milestone
    │   ├── Proposal and requirements
    │   ├── Decisions
    │   └── Tasks
    │       ├── Authorizations and attempts
    │       └── Artifacts and reviews
    └── Accepted candidates; later releases and observations
```

Records should link across this hierarchy without duplicating their content. A task links to the proposal revision it implements. A review links back to both. Breadcrumbs provide place; tabs or local navigation provide sibling areas; contextual links provide causality.

## Reusable interface patterns

### 1. Product shell

Every product screen uses a global navigation, current-project switcher/context, page title, and one primary content purpose. The shell should establish location before exposing task mechanics.

### 2. Attention queue

Home and project overview summarize actionable items as **Decide**, **Review**, **Recover**, or **Authorize**. Each item says why it needs attention and what becomes possible after action. Counts are navigation aids, not dashboard decoration.

### 3. Context header

Task, decision, and review pages begin with a compact chain from outcome to current record, plus status and the next useful action. IDs and provider details are secondary metadata.

### 4. Intent panel

The original request, current interpretation, signed-off acceptance examples, exclusions, assumptions, and revision history form one recognizable pattern. Review pages reuse it in a condensed form so the reviewer never has to remember the originating brief.

### 5. Decision card

A consequential question contains context, options, recommendation, consequences, affected work, and decision state. Selecting an option and recording the decision are distinct actions. Deferral shows its effect.

### 6. Authorization summary

Authorization is a checkpoint, not a generic button. It names the exact input revision, permitted effects, excluded effects, destination, stop conditions, and expected return artifact.

### 7. Progress summary

The default view explains the current stage, elapsed/waiting reason, and next expected transition. Attempts, connector versions, heartbeats, and raw events live in progressive disclosure unless they require owner action.

### 8. Review workspace

Review is a dedicated destination with three coordinated regions:

- **Brief:** original intent, approved scope, and acceptance examples.
- **Result:** interactive preview or other artifact, with a clear task to try.
- **Evidence and response:** change summary, acceptance results, checks, gaps, identity, feedback, and accept/revise actions.

The first view should answer “what am I reviewing and what should I do?” Detailed provenance remains available without dominating the evaluation.

### 9. Exceptional-state notice

Failure, stale input, offline worker, blocked input, and connector ambiguity use a consistent pattern: what happened, its consequence, preserved evidence, whether an action is safe, and the next action. Internal component names appear only where they aid recovery.

### 10. History and staleness

Revisions and artifacts remain selectable. The UI names the changed input that caused staleness and prevents accidental current acceptance. History is inspectable without pretending it is current.

## Layout and disclosure rules

- Lead with the owner's task and decision, then show system mechanics.
- Give each page one primary action. Secondary actions should not compete visually.
- Use overview pages for summaries and attention; use record pages for investigation and action; use review pages for evaluation.
- Keep ordinary product language in the main path. Put provider names, IDs, logs, and protocol detail under evidence or diagnostics.
- Keep the original intent and acceptance criteria visible at moments of authorization and review.
- Use progressive disclosure for history, raw events, source identities, and integration metadata.
- Never place prototype scenario controls inside the proposed product shell. The review harness frames the product and is visually distinct.
- Do not imply that unimplemented navigation destinations work. Label the bounded prototype slice.

## From intent to shipped learning

The product-design pipeline is iterative, with explicit evidence at each handoff:

| Stage | Question | Durable output | Review method |
|---|---|---|---|
| Frame | Whose problem and outcome matter? | Outcome, constraints, success signal | Owner confirms framing |
| Model | Which stories, records, and dependencies support it? | Story spine, domain relations, risk assumptions | Scenario walkthrough |
| Structure | Where does each job live and how is it found? | Information architecture, navigation, page responsibilities | Findability walkthrough |
| Pattern | How should repeated decisions/actions behave? | Interaction patterns and state rules | Low-fidelity interaction prototype |
| Specify | What must this change do? | Versioned proposal, acceptance examples, exclusions | Owner signs off consequential choices |
| Build | Can a bounded implementation satisfy it? | Task, authorization, attempts, artifact | Checks and traceability |
| Evaluate | Does this artifact meet the intent? | Review tied to exact inputs/build | Guided product review |
| Release and learn | Did it work in use? | Release and observation | Outcomes, feedback, recovery evidence |

D-01B covers Structure, Pattern, and the review method for one vertical slice. It does not validate visual polish, live integrations, or implementation feasibility already assigned to other packets.

## Prototype review contract

Every future prototype should open with a review guide outside the proposed product UI. It must state:

1. **Original intent:** the owner statement and approved interpretation being represented.
2. **What this explores:** the bounded user stories, product areas, and risky assumptions.
3. **What is fake or absent:** simulation boundaries and excluded destinations.
4. **Paths to try:** no more than three short tasks with a clear starting point and expected observation.
5. **Evaluation criteria:** explicit questions tied to the original intent, not “do you like it?”
6. **Feedback capture:** accept, revise, or reject each material design hypothesis; do not treat clicks in a fixture as owner approval.

The reviewer should be able to evaluate a prototype in five to ten minutes without first reading repository documentation.

## D-01B hypotheses to test

The next bounded prototype should test these propositions:

- The selected project-first shell keeps the current project, destination and collection return understandable on wide and narrow screens.
- Project overview can separate **needs judgment**, **active work**, **ready work**, and **latest result** without becoming an operations dashboard.
- A task page can keep intent and next action prominent while moving connector/runner mechanics into diagnostics.
- A dedicated review workspace makes the original intent, test instructions, acceptance criteria, result, and response available in one review loop.
- Explicit authorization can be trustworthy without making routine execution feel heavy.

Visual style is intentionally provisional. We are testing hierarchy, language, navigation, disclosure, and reviewability first.

## Selected structure and next judgments

D-01D selected Projects as the workspace entry and Overview / Work / Decisions / Reviews as the project destinations for this slice. It also selected separate task shaping/execution and candidate-review responsibilities, plus explicit decision → affected collection → task transitions. This acceptance permits D-01B; it does not freeze labels or visual styling.

D-01B now asks the owner to accept, revise or reject the interaction behavior: destination predictability, task-state actions, authorization trust, exceptional-state recovery, narrow-screen use, and the Brief / Result / Evidence review workspace. Those observations inform Q-004 and Q-005 before B-01 through B-03.

## Mockup context

Use [BorrowBox](demo-app/borrowbox.md) for active mockups: Aludel is the portal, BorrowBox is the managed project, and the tool-reservation UI is the app inside its preview. Keep development records out of that app. This owner-requested fixture is intended to grow into a future creation test. Historical self-referential mockups remain labeled evidence only.

## V4 owner outcome — 2026-09-19

DEC-017 provides qualified overall usability/clarity acceptance of the project workspace interaction, with explicit negative visual feedback. That feedback remains historical evidence; DEC-021 later reopens composition and interaction grouping while preserving enduring product semantics. DEC-019 then shelved the page-level visual concepts: D-01F must establish the portal's design-system foundation before D-01E composes representative states through it. V4 CSS and generated imagery are not production-system evidence. Q-004 is partially informed, while authorization policy, review-evidence sufficiency and per-scenario owner comprehension remain unconfirmed. See the [D-01 retrospective](../evidence/d-01-design-retrospective.md) and [design-system strategy](design-system-strategy.md). Earlier statements about pending D-01B review describe the pre-review hypotheses.


D-01F closeout (2026-09-19, DEC-025): the owner selected the [v3 foundation](portal-system/v3/review-record.md) for continued design work. D-01E now consumes its [accepted inputs](portal-system/v3/d-01e-handoff.md). Overview is the accepted reference; other view compositions remain open. Angular Material and explicit Storybook stories are the design-stage realization; production architecture and docgen support remain B-01 readiness work. This supersedes earlier pending-foundation-selection wording, without advancing M0.
