---
id: process-operation-001
revision: 4
status: trial
updated: 2026-09-19
---

# From request to the next justified action

Use this procedure with the [artifact guidance](../product-development-workflow.md). It governs work selection; the artifact guidance explains how to do the selected work. Start with the [work record](work-record-template.md). One record may fit in a paragraph for a routine task. Never fill out documents just to satisfy a file count.

## 1. Establish the task and improve the process

Read the current handoff and applicable instructions. State the desired outcome, authorized effects, and what would demonstrate success. Identify the relevant prior failure or process weakness and the smallest useful improvement. If existing practice is adequate, say why and use it. Separate the process outcome from the product/task outcome.

Classify by uncertainty and consequences, not requested medium. “Make a prototype” may be a new-product discovery request; “add a button” may introduce a consequential authorization flow.

| Class | Start with | Usually unnecessary |
|---|---|---|
| New product | Audience, problem evidence, outcome, constraints, actor journeys and competing approaches | Detailed screens before the core workflow is understood |
| New area, cross-page flow, or consequential behavior | Existing product constraints plus affected journeys, dependencies and responsibility boundaries | Redesign of unrelated accepted areas |
| New/changed page or reusable component | Parent journey, page responsibility, existing patterns, states and alternatives | New product-wide research unless assumptions fail |
| Small change using an established pattern | Exact pattern revision, local before/after, affected states and observable acceptance | New shell alternatives or owner approval of unchanged structure |

Missing evidence may raise the class. A narrow request does not establish that its parent pattern is accepted.

## 2. Inventory evidence for the proposed scope

For cross-cutting work, identify shared contracts versus project-specific choices using the [capability framework](../../product-system-framework.md). Aludel uses the same project contract as its managed products; self-development is an explicit service relationship, not an exception. Inspect current coverage and producer/consumer boundaries before assigning tools.

List what the deliverable would force you to decide: affected actors, pages, records, transitions, components, design-system assets or gaps, external effects and exceptional states. For each consequential choice, record evidence, revision, acceptance scope and remaining uncertainty. Read the content, not just its title or status. For UI work, identify the exact product design-system revision and whether each needed pattern/component is stable, incubating, missing or inapplicable.

Use **missing**, **draft**, **checked**, **accepted**, **stale**, **rejected**, or **waived**. Checked means an agent verified stated properties; it is not owner acceptance. Accepted always names reviewer, evidence, revision, scope, and intended next stage. Waivers require the owner and preserve the consequence.

For a new design system or reopened experience, distinguish enduring product intent/domain invariants from presentation choices. Treat existing prototypes as historical evidence unless the owner actually accepted the relevant composition for this stage. Define the system's philosophy and its consequences for hierarchy, grouping and adaptation before assembling components.

A navigation list is not a page system. A story ID attached to a component is not an explanation of why it belongs there. A state inventory is not a defined transition. A screenshot is not observed usability. A prototype test pass is not approval of its structure.

Do not promote lifecycle states to peer feature navigation solely because their records or actions differ. Start from recurring owner jobs and the questions each surface must answer; keep state, history, review and exceptions on the authoritative record unless observed use justifies a separate operational projection. D-03R exposed this failure and D-04 applies the correction through owner-job responsibilities before composition.

When external examples are used to choose a page composition, inspect an actual screen or interaction artifact from the primary source as well as its capability documentation. Record reading order, object granularity, navigation, what to borrow/avoid, and the owner walkthrough it should improve. Distinguish full screens from promotional/toolbar crops and documented behavior from live trial evidence; preserve source URL, access date and screenshot identity. Do not infer layout quality from feature availability. The [D-04R reference study](../project-workspace/v7/work-record.md) applies this after a capability-backed outline remained unclear to the owner.

Use the [interaction-placement procedure](interaction-placement.md) to justify what is always visible, expands, opens a dialog/pane or navigates. Record context/return and draft/focus behavior; check zero, one, many and unknown before accepting a collection composition.

For a new library/workshop trial, verify the supported runtime and adapter maturity before installing. Keep source stories and integrated flows distinct: a passing component render does not prove asynchronous state updates, focus restoration, drafts or navigation in the app. Inspect loaded fonts/icons in the browser as well as accessibility results. Record fallback modes explicitly (including disabled documentation extraction), and bind final evidence to the tested source/build hashes. On mounted filesystems, verify that preview changes actually load before comparing screenshots. These checks caught real D-01F failures; they are not a claim of general process effectiveness.

For generated visual alternatives reviewed from an IDE or other surface that may not render tool outputs, copy the complete set into a versioned workspace review folder before requesting selection. Preserve displayed option order, hashes, prompt/constraint summary and selection scope. Link the local files in the review message. This prevents an inaccessible chat rendering or an older similarly named concept set from becoming the accidental visual target; D-01E first exposed and then exercised this handoff rule.


For each transition require: starting context → trigger → affected records → visible outcome → destination/return path → failure/stale behavior. For each page require: actor's situation → question answered → owned content/actions → exclusions → entry/exit → primary action by state. Test summaries with zero, one and several records; their destination must match the scope they summarize.

## 3. Turn gaps into ordered work

Create a bounded packet for each independently reviewable uncertainty, combining closely related gaps when useful. Each names inputs, work, output, check, reviewer, dependencies and stop condition. Model dependencies before choosing sequence. If they cycle, identify the unresolved assumption and use a smaller research or concept experiment to break the cycle; do not label the whole cycle ready.

Select the ready packet that removes the most consequential uncertainty. Complete authorized prerequisite work autonomously. Ask the owner only for missing judgment or authorization that materially changes dependent work, after preparing concrete evidence or alternatives. While awaiting a decision, unrelated authorized work may proceed under the repository's one-packet policy.

Do not create a prototype backlog first and retrofit groundwork beneath it. The next output may be a research question, journey, comparison or one corrected contract.

## 4. Execute and check a stage

Stages can be combined for small changes when the record explains which existing evidence covers them. “Not applicable” needs a reason; it does not waive an applicable requirement.

| Stage | Inputs → concrete work → output | Agent quality check | Reviewer / failure route |
|---|---|---|---|
| Frame | Request + constraints → identify actors, outcome, assumptions and unknowns → bounded brief and evidence plan | Success is observable; facts and assumptions separated; effects authorized | Agent checks completeness; owner resolves material intent ambiguity. Return to intake if contradictory |
| Investigate | Prioritized unknowns → inspect existing evidence, research or run bounded experiments → findings and reversal conditions | Source supports claim; observations distinct from predictions; uncertainty narrowed | Agent evaluates evidence; owner decides product tradeoffs. Return to framing if problem premise fails |
| Structure | Brief + findings → map journeys, responsibilities, dependencies and transitions → product/view map and scoped story contracts | Walk happy and exceptional paths; every step has a home; collection/detail and actor boundaries hold | Owner selects material structural direction from inspectable alternatives. Return to research for unknown behavior |
| Compose | Scoped structure + accepted design-system profile/patterns → compare hierarchy/layout alternatives and state behavior → loose compositions, catalog gap decisions and component contracts | Every major component serves a story and page responsibility; reuse/extend/new choices are explicit; semantic navigation matches behavior; narrow layout is specified | Owner selects material composition direction. Return to structure if layout reveals a missing responsibility; route genuine asset gaps through the system change process |
| Prototype | Readiness decision + explicit questions → build cheapest experiment → bounded prototype and review guide | Only approved scope plus explicitly named experimental variables; no incidental invention; checks cover represented states | Owner evaluates named questions. Return to the earliest invalidated stage, not automatically to code |
| Specify/build | Accepted relevant interaction evidence + implementation authorization → define contracts and implement → identified artifact with tests and gaps | Intent-to-change traceability, appropriate behavior checks, allowed effects, immutable input identity | Agent checks implementation; owner accepts product result. Return to design if implementation requires a new product decision |
| Evaluate/learn | Artifact + acceptance examples → review observed outcomes → scoped acceptance/revision and process finding | Evidence actually demonstrates claim; unresolved gaps remain explicit | Owner accepts/revises product; agent records process lesson. Release uses its separate authorization gate |

At every stage, if scope expands or a required assumption changes, revise the work record and reassess readiness before proceeding. Do not allow momentum or sunk prototype effort to substitute for a gate.

## 5. Decide readiness at the boundary

Immediately before constructing an interaction prototype, write a verdict with evidence for:

1. the exact questions it will answer and the cheapest suitable fidelity;
2. actors, stories, pages and transitions included and excluded;
3. valid parent structure and required scoped owner selections;
4. component responsibility and state coverage, including empty, multiple-record, failed and stale outcomes where relevant;
5. the external review frame, tasks, expected observations and simulation boundaries;
6. unresolved assumptions and whether each is the named experiment or an accidental decision.

For an implementation-readiness boundary, also require the exact design-system revision, catalog search result, allowed component-system changes, representative stories/checks and any approved escape from catalog-first assembly.

**Ready** means all applicable requirements are evidenced. **Needs groundwork** names the next ready prerequisite. **Needs owner judgment** links concrete alternatives and states the choice needed. **Needs authorization** names the external effect and authorization source required. Unknown is not ready.

A prototype may explore an unresolved interaction explicitly named in its experiment. It must not silently settle its surrounding product structure. If the experiment is the structure itself, start with maps and loose wireflows; authorize a higher-fidelity experiment only when its added value is explained and any required owner direction is recorded.

These principles apply to other work too: substitute its relevant contracts, evidence and authority boundaries for design-specific requirements.

## 6. Preserve acceptance and hand off

For an executable demo, verify the exact owner-facing review URL from clean fixture state before handoff. Smoke-check every advertised top-level route before running deeper assertions, so a stopped server or route-parser failure is distinguished from an interaction failure. Walk the primary task using visible controls, without query editing, injected storage, or direct-route shortcuts. Use visible scenario controls for exceptional states. Verify reset preserves actual reviewer notes. Declare excluded transitions. When copying a prototype, mark inherited evidence and replace its output paths before checks. Update status at partial handoffs too. D-01E's [review-harness retrospective](../portal-visual/v1/review-harness-retrospective.md) records the owner-entry failure; D-04's [work record](../project-workspace/v5/work-record.md) records the route smoke-check application.

For any new or changed collection/detail flow, the executable owner-entry check must contain at least two distinct records. Enter through the collection URL, choose each record using visible controls, reload the detail, return using a visible collection link, and reload the collection. Verify identity and that collection URLs do not render full details by default. Include empty/missing records and browser Back/Forward, filter/scroll and draft restoration when those behaviors are in scope. Do this before mutation/authorization checks; a single-item transaction fixture cannot prove navigation. The [B-03A navigation post-hoc](../../evidence/b-03a-work-navigation.md) records the missed requirement and its first two-item regression application.

Before handing off a multi-page UI, inspect every advertised page at wide and narrow widths against the exact selected design-system foundation. Record hierarchy, component/pattern reuse or deviation, loaded typography/icons, selected-record identity, and the next owner action separately from automated accessibility. Do not defer composition or foundation compliance as “visual polish” when they are required inputs. Tie each behavior claim to an observable transition and affected record: seeing a label, warning, progress number or confirmation alone does not prove aggregation, selection-dependent mutation, preserved backlinks, staleness enforcement or authorization safety. Static composition studies must label drawn controls and cannot inherit interaction evidence from a prior prototype. The [D-04R audit](../project-workspace/v6/work-record.md) applied this check and exposed selection, inert-action and narrow-identity failures missed by D-04's presence assertions.

Record acceptance per scope, never just per document or packet. Separate structural clarity, interaction behavior, visual quality and technical correctness. Preserve qualified feedback in the owner’s terms: “usable” does not approve appearance or every scenario. If a prototype deliberately defers a quality dimension and the owner rejects it, name the follow-up before adopting that prototype as an implementation baseline. “B looks better” can select B's composition; it does not accept navigation, downstream pages or implementation readiness. Quote or accurately summarize the actual feedback and list what remains open.

When inputs change, trace their consumers. Mark affected acceptance and readiness stale pending impact assessment; retain unaffected accepted scope with a written reason. A copy edit need not reopen the whole product. A changed actor or authorization model may invalidate several downstream journeys. Preserve past evidence and issue a new revision; never overwrite historical approval with current meaning.

End each packet with a post-hoc: avoidable friction; what would make equivalent work easier; process change and evidence; task outcome; effects on downstream work and phase gates; questions created or resolved; exact current input revisions; unresolved gaps; one next action; and the stop condition. Apply justified routing, packet and question changes before marking the packet complete. A fresh agent should reach the same permissible next action from that record without reconstructing chat. In this bootstrap, status routes and linked work records supply detail. Future portal records and immutable context bundles should carry the same fields; this procedure does not implement that engine.

## Trial and improvement

For the first live application, record whether a missing foundation is detected before construction, whether owner feedback exposes another omission, and how much unnecessary work the procedure adds. Revise the procedure based on these observations. Retrospective dry runs only demonstrate that the rules can classify supplied cases; they cannot establish future compliance or usability.

### Revision 2 evidence

The [D-01 retrospective](../../evidence/d-01-design-retrospective.md) applies this separation to v4: overall usability received qualified acceptance while appearance was rejected. D-01E carries the visual follow-up before B-01, and R-05 remains the next feasibility task. This amendment is exercised in the current acceptance ledger and routing; the future visual outcome and independent reuse are unproven.

### Revision 3 evidence

The [R-05 retrospective](../../evidence/r-05-retrospective.md) exposed that a brief process-outcome paragraph did not force downstream plan and question updates. Revision 3 makes post-hoc propagation part of packet closure. It is applied to R-04A, R-04B, B-03, Q-008 and the current handoff; whether it reliably prevents missed learning must be evaluated at R-04A closeout.

### Revision 4 evidence

The [D-01F groundwork record](../portal-system/v1/work-record.md) applies the acceptance reset and shared-versus-project model after owner correction. The same 24-capability schema describes Aludel and fictional BorrowBox, and seven deliberately invalid records are rejected. This demonstrates structural checks and earlier identification of scope assumptions; UI quality, independent handoff and live tool integration remain unproven.
