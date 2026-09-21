---
id: project-workspace-v4-intake
kind: feature-revision-intake
status: proposed-from-owner-feedback
updated: 2026-09-20
supersedes_for_review: project-workspace-v3-design
---

# Work feature revision — from lanes to steering and execution

## Owner feedback and interpretation

The D-03 prototype exposed lifecycle states as sub-features: Plan, Active, Reviews, and History. Owner feedback rejects that organization. Those states are useful filters and summaries, but they are not the main jobs the owner comes to Work to perform.

The revised feature has three operating surfaces and one recurring process:

1. **Work Overview** — what needs owner attention now, what agents are doing, and whether the system is healthy enough to continue.
2. **Development Plan** — what phase the product is in, which outcomes matter now, what work achieves them, progress and dependencies.
3. **Agent Operations** — the dependency/priority-ordered ready queue, current capacity, active runs, progress, questions, failures, and run history.
4. **Intake and triage** — capture comments, requests, ideas, and feedback; periodically deduplicate, group, connect, prioritize, defer, or convert them into plan/work records.

This interpretation is proposed groundwork. It is not yet a portal decision or authorization to prototype.

## Recommended navigation

```text
Work
├── Overview
├── Development plan
├── Agent operations
└── Intake
```

Order may place Intake earlier when a triage session is due. “Agent operations” is a working label; “Execution” or “Runs” may scan better after prototype review. Review is an action/state attached to plan work and surfaced prominently on Overview and Agent Operations. It is not a peer sub-feature. Completed/cancelled work remains in the Development Plan and each work item's history; run history remains in Agent Operations and links back to its work item.

## Work Overview

Primary question: **What needs my attention, and is work moving toward the current outcomes?**

The default view prioritizes actions rather than record categories:

- decisions waiting for the owner, with the outcome/work they unblock;
- artifacts ready for review, linked to their item in the Development Plan;
- agent questions, failures, or reconciliation problems;
- agent capacity and a compact active-work summary;
- current phase/outcomes and material risk/progress signals;
- a triage-due banner when enough unsorted input or elapsed policy warrants an intake session.

Resolved items leave the attention queue but remain in their authoritative records. Counts link to filtered Plan or Agent Operations views. The overview does not become a second editor for the plan or a generic dashboard of decorative metrics.

## Intake and triage

An intake item is a durable raw signal: comment, request, idea, feedback, observation, incident, or imported source. It can remain uncommitted, be linked to another signal, grouped into a theme, merged as a duplicate while preserving authorship, connected to an existing outcome/feature/work item, or become a proposal/new planning item.

Triage is a deliberate recurring event, initially owner-triggered. It shows unsorted and resurfaced items, suggested duplicates/themes, evidence and age. The owner/agent can:

- link or merge without losing original text;
- request clarification;
- defer with a revisit trigger;
- reject/archive with rationale;
- attach to existing product/plan records;
- create or revise an outcome, initiative, feature, or work item;
- order accepted work by value, urgency, dependency, risk, and current capacity.

The system may recommend that triage is due based on count, age, or a configured cadence. Elapsed time never authorizes conversion or execution. Background discovery and automatic clustering remain later capabilities; the first slice should prove manual classification and provenance.

## Development Plan

Primary questions: **What phase are we in? Which outcomes are active? What must happen to achieve them? How far have we progressed, and what blocks the path?**

The plan is a hierarchy plus a dependency graph, not a strict tree and not an execution queue:

```text
Product direction revision
└── Roadmap phase / rollout horizon
    └── Outcome
        └── Initiative / feature cluster
            └── Work item

Work item ──depends on──> Work item
Work item ──supports──> several outcomes/features when justified
```

Containment supplies scope, aggregation, and drill-down. Typed cross-links handle dependencies and many-to-many contribution without duplicating work. A work item has one primary planning home for display and optional secondary contribution links. Aggregate status is calculated from children and dependency/readiness evidence; it never replaces the underlying records.

The default projection should be an outcome-oriented outline: current phase, outcomes, feature/initiative clusters, and work items. It supports collapse/drill-in, progress, blockers, decisions, review state, and next action inline. Items retain stable detail destinations; short actions may use a pane or dialog, while consequential editing/history uses the detail.

Additional projections over the same records should be evaluated rather than made separate authorities:

- **dependency/timeline map:** feature clusters on one axis, phases or horizons on the other, dependency edges, critical blockers, and rollout boundaries;
- **table/list:** high-density filtering, prioritization, bulk comparison, and audit;
- **board:** useful where a team benefits from flow state, but optional rather than the primary mental model;
- **roadmap summary:** outcomes/phases only, suitable for Product and Overview contexts.

Actions live close to the plan item they affect: answer decision, inspect question, authorize ready scope, open active attempt, review result, revise plan, or reconcile conflict. The plan links to these authoritative operations; it does not reimplement their state machines.

## Agent Operations

Primary questions: **What can agents start next? What is running now? Are we using capacity well? Where is execution blocked?**

This view is an operational projection derived from authorized, dependency-ready work and execution records:

- ordered queue with the reason for ordering (dependency, priority, risk/capacity policy);
- configured maximum concurrency and currently active agents/slots;
- each active agent, work item, attempt, stage, elapsed/progress signal, latest meaningful event, and expected next transition;
- blocked questions/failures/reconciliation states with direct links to the work item in the plan;
- artifacts ready for review with a button linking to the plan/review context;
- throughput, wait time, failure/retry and intervention metrics when supported by real data;
- run history by agent/attempt, while product work history remains on the work item in the plan.

Queue order is inspectable and owner-adjustable within policy. “Ready” requires dependencies, current inputs and authorization; priority alone cannot dispatch. Agent state and work-item state remain distinct. Increasing concurrency is bounded by configured capacity, credentials and recovery evidence rather than a UI toggle alone.

## Link to foundational product records

Product defines the enduring direction, outcomes, features and accepted design intent. The Development Plan operationalizes exact revisions of those records.

- A plan phase/horizon references the roadmap/product revision it realizes.
- An outcome shown in Work is a projection/link to the Product outcome, not copied prose.
- Initiatives/features link to their authoritative Product and Design records.
- Work items snapshot the required outcome/feature/design/decision revisions they consume.
- Changing foundational intent marks affected plan nodes/tasks/artifacts for reassessment; it does not rewrite history or automatically cancel work.
- Plan progress can inform Product outcome evidence, but completion of tasks does not by itself prove the user/business outcome.

This boundary prevents Product from becoming a static document library and prevents Work from becoming a second source of product truth.

## Recommended next prototype

Build a bounded interactive prototype with realistic Machine data across three connected views plus intake:

1. **Overview:** owner attention queue, active outcomes, agent capacity, triage-due banner.
2. **Development Plan:** collapsible phase → outcome → feature cluster → work hierarchy; aggregate progress; inline decisions/reviews/questions; stable item detail; switch to a dependency/timeline projection using the same fixture data.
3. **Agent Operations:** dependency/priority queue, two configured agent slots, one active run, one waiting item, question/failure/review transitions, attempt history linking back to plan items.
4. **Intake:** several raw signals, one duplicate group, one link to existing work, and an explicit triage session that converts a signal into a proposed plan change without authorizing execution.

The prototype should answer:

- Can the owner explain the current phase, active outcomes, progress, critical dependency, and next review without reading raw task history?
- Does collapse preserve meaningful aggregate status and owner actions?
- Is hierarchy understandable without hiding cross-cutting dependency relationships?
- Does switching between outline and dependency/timeline views preserve selected objects and use one record set?
- Can the owner distinguish the product plan from the agent queue and distinguish work history from run history?
- Does a raw idea remain traceable through grouping and conversion to planned work?
- Are foundational Product/Design links sufficient to answer why work exists and what revision it implements?

## Process correction

D-03 correctly proved navigation, provenance and safe reconciliation mechanics, but its feature decomposition was wrong. The next review must begin from owner jobs and information relationships before choosing tabs. Lifecycle is modeled within records and projections, not automatically promoted into navigation. Reuse the tested collection/detail, draft, error, accessibility and reconciliation contracts where they still apply; discard the lane-based composition as the target.

