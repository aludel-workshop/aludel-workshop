---
id: LAYER-FRAMEWORK-01
kind: work-record
status: proposed
updated: 2026-09-27
---

# General layer framework

## Authorization, outcome, and readiness

**Owner instructions (chat, 2026-09-27):** examine Aludel's current layers and develop an application-independent concept of a layer, including optional stacks, incomplete upstream knowledge, new domains, and externally maintained artifacts such as a Figma design system. The owner then extended the concept: each layer should act as a small app that discovers neighbors, learns which outputs matter to its own quality, audits coverage, proposes work, and adapts when sources disappear. Review whether “apps” is a better name. The owner next asked for a concrete conceptual mapping of the built Pages layer, including its UI, into this layer-app model. This authorizes bounded local research, conceptual design, and repository documentation under DEC-029. It does not authorize implementation, external account access or writes, deployment, spending, or changing current packet priority.

**Outcome:** a proposed contract that explains the current portal, exposes gaps in a partial project, and represents an external system without claiming Aludel created or governs its artifacts. This is design, not an accepted architecture or working integration. Conceptual design is ready; runtime schema/UI work needs project trials and owner selection. `WORK-AGENTS-01` remains `next_action`.

## Process finding and applied improvement

The [existing output model](../work-agents/layer-output-model.md) separates outputs, actions, roles, and evidence. The [capability framework](../../product-system-framework.md) establishes one authoritative writer per scoped output and allows manual or external provision. What is missing is a reusable test for *declaring a layer*. Without it, a new domain or connector could become a tab, a second authority, or a misleadingly complete input to an agent.

Use a layer declaration, then test it against three unlike project graphs before adding layer-shaped product code. The scenario checks below catch ownership and missing-input ambiguity in this design. Whether the process helps in real use remains unproved.

## Definition

**DEC-051 update (2026-09-29):** in the LAT target, actions and their output adapters belong to the layer declaration. Work remains the shared authorization/run/review service; a separate Work role per layer is removed. The owner’s [layer-action contract](../work-agents/layer-owned-actions.md) governs future action migration. Earlier references below to roles describe quality responsibility, not a required role record or grant.

A **layer is a bounded domain app responsible for a coherent family of artifacts or state**. It gives outputs stable identities and revisions, defines who or what may create and change them, names the work and checks that produce them, and publishes a usable projection for consumers. It is an **authority, transformation, and adaptation boundary**, not a screen, stage, team, or tool. Outputs belong together when they share authority, quality policy, and change lifecycle; a broad topic alone is insufficient.

```text
Layer = output contract + authority + work policy + input contract + evidence + projection

selected inputs, constraints, observations, gaps
  → authorized activity → candidate output → validation/review → accepted output
                                                           ↓
                                             versioned consumer projection
```

The output contract defines artifact types and revision meaning. Authority names a writer for each scoped output. Work policy names permitted actions, performers, tools, effects, and review. Input contract describes what can be consumed and how absence is handled. Evidence records sources, decisions, checks, and acceptance. Projection makes outputs discoverable through UI/API/export without moving authority to the consumer. Tasks and attempts are activities about outputs; their logs are not substitutes for the outputs.

An artifact can be a claim, component contract, repository revision, environment state, campaign, or observation. Some layer outputs are **snapshots of external state**, not artifacts authored locally.

## Project topology and incomplete knowledge

A project selects layer instances and joins them with **typed handoffs**, forming a graph. The familiar software sequence is one possible graph. An edge identifies the producer output type and revision, consumer input role, validation rule, and change response. Navigation order does not imply dependency. A layer can consume peers, its own previous outputs, or external sources. Feedback cycles happen across revisions: Code observations may inform a later Vision revision, but the later Vision revision cannot be claimed as the original cause of that code.

Each input role has a declared state:

| State | Consumer rule |
|---|---|
| Required | Block the dependent action and ask for the exact missing input. |
| Optional | Proceed in a named reduced mode and record omitted inputs and reduced checks. |
| Substitutable | Name the replacement source, its authority, and why it satisfies this role. |
| Unknown | Inspect or ask before relying on it; preserve uncertainty. |

Absence of a layer is a visible coverage choice or gap, never implicit permission to fabricate its outputs. A shortcut can be valid for a prototype with a different review bar. When a missing layer is added later, compare its new outputs with existing artifacts; do not assign them false historical provenance.

| Project graph | Valid work | Required disclosure |
|---|---|---|
| Vision → Code | Use a brief and direct owner instruction to create a scoped commit and preview. | Pages, Design, and Data contracts were not supplied. UI/schema choices are assumptions or proposals; tests and review match their risk. A preview does not prove validated UX. |
| Design + Pages | Define tokens/components and mock page flows without a repository. | Story coverage and product need remain unknown unless independently supplied. Judge the flow against its stated scenario. |
| External Figma → Pages/Code | Expose identified frames, components, styles, and available variables as source-backed inputs. | Figma remains the writer. Show extraction scope, source version/fetch time, inaccessible fields, and local review status. A frame alone does not specify behavior. |

Outside software, a home-automation project might connect Household Rules, Device Inventory, Automation, and Operations. Automation consumes device capabilities and household constraints, produces versioned rules, and uses telemetry as evidence. The contract appears applicable, but that is a conceptual test, not operational proof.

## Minimum layer declaration

| Field | Required answer |
|---|---|
| Identity/scope | Which project instance and why these outputs belong together? |
| Outputs | Artifact types, revisions/states, primary versus derived projections. |
| Authority | Canonical location, writer per scoped output, reviewer/acceptor. |
| Work | Actions, effects, performers/tools, checks, review and publication. |
| Inputs | Required, optional, substitutable, or unknown roles and reduced-mode rules; discovery criteria and connection hypotheses. |
| Evidence | Source, decision, validation, and review links; unverified claims; output-quality and coverage signals. |
| Handoffs | Consumer payloads, version/change signals, validation and reconciliation. |
| Exposure | UI/API/search/context/export views, access and coverage limits. |

This declaration is project-configured and versioned. A shared catalog can provide common contracts; each project chooses instances, tools, quality bars, and edges. The existing [capability allocation](../../product-system-framework.md#per-project-allocation-contract) remains the finer coverage view. A layer groups related outputs and work; it does not replace capability IDs or the [Work action manifest](../work-agents/session-contract.md). Identity, provenance, permissions, revisioning, and review may be shared infrastructure without becoming project navigation layers.

## Adaptive layer apps: discover, learn, reconcile

The owner's neuron analogy adds an active responsibility. A layer app maintains its output quality in a changing neighborhood. It discovers available knowledge, proposes connections that might improve its outputs, tests and revises its *local* policy, measures gaps, and stages work through the shared Work system. The project graph is therefore **learned and revised**, rather than entirely configured at project creation. The fixed part is the contract for identity, provenance, effects, and review; the variable part is what this layer considers relevant and how it judges coverage.

A useful analogy is a controller loop: observe current state, compare it with a desired state, and request a correction. [Kubernetes controllers](https://kubernetes.io/docs/concepts/architecture/controller/) and [operators](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/) demonstrate this pattern for infrastructure. Aludel's inference is to apply it to knowledge and artifact quality. Unlike a cluster controller, “desired coverage” here is often uncertain and value-laden; it must be a versioned, reviewable *hypothesis*, not an objective fact or an automatic command to create artifacts. Kubernetes is an architectural reference, not proof this design works for product knowledge. Sources checked 2026-09-27.

```text
Discover available outputs → propose relation/coverage policy → resolve uncertainty
          ↑                                      ↓
  observe outcome/changes ← audit output quality ← reconcile gaps → stage Work
```

| Responsibility | Local layer-app behavior | Shared platform boundary |
|---|---|---|
| Discover | Search capability descriptors and output summaries; inspect exact revisions as needed. | Project access, identity, typed search, scoped read APIs, change events. |
| Interpret | Propose whether a source type can inform an output type and what correspondence means. | Store proposal, source evidence, confidence, policy revision, reviewer. |
| Reconcile | Compare observed inputs and existing output/link coverage under an accepted policy. | Idempotent scan scheduling, gap identities, deduplication and stale-input handling. |
| Work | Propose questions or work items for missing, changed, conflicting, or low-quality outputs. | Work owns authorization, attempts, questions, reviewer decisions, budgets and effects. |
| Learn | Inspect accepted/rejected links and output reviews; propose a policy change. | Preserve policy history, test candidate against fixtures, require appropriate review before activation. |
| Expose | Publish artifacts, coverage, quality evidence, uncertainty, and dependency health. | Common discovery, provenance, permissions and context bundle contracts. |

The **local policy** has several distinct parts: discovery queries or semantic hints; candidate input/output relations; applicability predicates (which stories warrant flows?); correspondence/coverage tests; evidence thresholds; questions to ask; work templates; quality checks; and behavior on source change or disappearance. These are versioned rules and examples, not just prompt text. A model can propose or interpret them, but a validator must check their shape and effect scope. Policy revisions are themselves layer outputs, with provenance and review. A layer can refine its own method without gaining permission to broaden reads, writes, spending, or dispatch. The platform policy and owner authorization remain outside its self-editable surface.

### Two walkthroughs

**New Vision stories, existing Pages flows.** Pages discovers that Vision publishes stories and asks whether they can serve as flow inputs. Its policy may initially say “an accepted user journey with a UI interaction is a candidate for a flow”; that rule is a hypothesis to validate on the actual project. A discovery audit samples stories and current flow links, proposes a relation, and asks a focused question if “every story needs a flow” would overreach. After the relation policy is reviewed, a reconciliation run identifies uncovered applicable story revisions. It stages one deduplicated Pages work item per coherent gap, with exact story revisions, why a flow is expected, and a review check. The item does not start merely because it was staged. A later story edit rechecks affected gaps; rejected links and intentional exceptions remain visible so the app does not repeatedly ask the same question.

**Existing Code, empty Pages.** Pages discovers a Code output describing routes, rendered screens, or observed navigation. Those observations support *candidate* page and flow records; they do not prove intended journeys. Pages can stage a reconstruction item and ask the owner whether a route represents a user flow, an internal tool, or obsolete behavior. Its output may be an observed-flow map with explicit uncertainty, followed by a proposed intended flow after review. A missing Pages record is a knowledge gap, not evidence that the code is wrong. Code can separately detect missing design/page links and suggest its own reconciliation work without writing Pages policy.

In both cases, discovery can proceed while source semantics are uncertain. The uncertainty is resolved at the smallest consequential decision: whether to adopt a relation policy, whether an individual candidate maps to an output, or whether to create a specific artifact. A question suspends its dependent run; it need not freeze unrelated discovery. A response changes a new policy or work revision, never the manifest of an already authorized attempt.

### Connections that change or disappear

A connection has a lifecycle: `candidate → active → degraded/disconnected → reconnected or retired`, with source identity, last observed revision/time, coverage, policy revision, and affected outputs. On disappearance, the app retains pinned evidence and previously accepted artifacts. It marks live assumptions stale or unverified, runs a bounded impact audit, and considers a substitute through a *new* relation proposal. It does not erase outputs or silently treat the substitute as equivalent. On reconnection, it compares versions and reconciles, rather than replaying all old work. A scan uses stable gap keys, cooldown/exception records, and exact input revisions to prevent duplicate tasks and feedback loops. A layer's own output should not become independent evidence for the source claim it derived from.

### Quality objective and limits

“Optimize quality” needs explicit criteria for each output family: coverage of applicable inputs, correctness against evidence, usability in its declared context, freshness, reviewer findings, and observed downstream failures. These measures can conflict; maximizing link count would manufacture meaningless flows. Report measured coverage separately from judgments about value. The app may propose better criteria when reviews reveal blind spots, but a criterion change cannot retroactively certify old outputs. The owner or responsible role accepts policy changes with a before/after explanation and a fixture showing which gaps/tasks would change.

The active loop should initially **propose**, not self-execute, work. Shared Work decides prioritization, Go authorization, resource use and review. A routine may observe and stage idempotent suggestions within its granted scope; it cannot write another layer's outputs or authorize its own agent runs. This matches the current [Work action boundary](../work-agents/session-contract.md) and the existing-project evidence ledger. It leaves room for later autonomy where a particular low-risk operation has explicitly earned it.

### Name

**Layer app** is the useful architectural term: a domain-owned micro app with outputs, APIs, policy, and a reconciliation loop. **Layer** can remain the owner-facing navigation metaphor while the concept is tested. Calling everything an “app” now would collide with the *managed application* (the software Aludel builds) and with external apps such as Figma. If trials show projects naturally compose and install these units independently, “apps” may become the clearer product term. The name should follow that observed boundary, not decide it in advance.

## Internal, external, and mixed authority

**Internal layer:** Aludel governs at least one primary output's proposal, review, and acceptance. External tools may still create evidence/candidates. Vision, Pages, and Data broadly fit. For Code, canonical bytes live in Git, while Aludel governs tasks, candidates, review, and the accepted transition.

**External source layer:** another system authors the primary output. Aludel owns a versioned observation/projection, local annotations, links, questions, and reconciliation work. It does not own source creation policy or treat a source edit as locally accepted. Partial extraction is valid when coverage is explicit. An external system can supply one artifact family rather than a whole named layer.

**Mixed layer:** authority is partitioned by artifact or operation. Figma may own reference components; the repository may own implemented tokens and behavior; Aludel may own a reviewed design contract linking them. If two systems claim the same field/revision, surface a conflict and select or split authority. “Sync” describes transport, not ownership.

An external adapter declares source identity and access, available types and revision/fetch semantics, mapping to local IDs, coverage limits, refresh/disconnect behavior, and any separately authorized write operations. It can start read-only. Source changes create new observations and affected-consumer review; they do not rewrite accepted Design or Code. On outage, retain the last observation with visible age/access state. Source content never grants task authorization.

### Figma test case

Figma's [REST documentation](https://developers.figma.com/docs/rest-api/) describes file/node inspection, components/styles, versions, variables, and webhooks. [Published component metadata](https://developers.figma.com/docs/rest-api/component-types/) differs from local/subscribed components available through file data. [Published variable reads](https://developers.figma.com/docs/rest-api/variables-endpoints/) require a qualifying plan and scope and omit modes. [Webhooks](https://developers.figma.com/docs/rest-api/webhooks/) can signal change but are a refresh hint, not artifact payload or acceptance. These provider capabilities were checked 2026-09-27; they do not prove availability for this account.

First trial: bind one selected file/library read-only; store source asset identity, source version where available, fetch time, raw reference, extracted fields, and coverage/errors. Show a browsable Design projection and link one component and one frame to Pages or Code at exact observed revisions. Re-fetch after a change and show a reviewable diff. Do not promise token, behavior, or variant fidelity before measuring a real file. Check actual [scopes](https://developers.figma.com/docs/rest-api/scopes/) and [rate limits](https://developers.figma.com/docs/rest-api/rate-limits/) at connection time.

## Pages as the first concrete layer app

**Applied trial (2026-09-27):** the [Pages-first local app](../layer-app-trial/work-record.md) exercises blank Pages, Library and Work, then adds Vision and closes one story-flow gap. It checks the mechanics of this proposed framework in a browser, not owner utility or general runtime architecture.


This is a conceptual conversion of the **built** Pages layer, not a request to redesign or implement it. [PAGES-UX-01](../pages-layer/work-record.md) and its [implementation evidence](../../evidence/pages-ux-01-pages-layer.md) establish the current Map, Pages and Flows surfaces. The current server has typed `page`, `page_map` and `flow` records; Flows are seeded once from story-map activities. Its general `suggestions()` rule currently catches a page linked to stories that is not designed, then `syncBacklog()` creates a suggested Work item. That is a useful precursor, but it is a fixed rule, not a Pages app discovering or revising its own relationships.

| Proto-layer component | Pages specialization | Existing asset or gap |
|---|---|---|
| Output contract | Page map and links; page blanks, specs, sections, content and states; ordered flows, steps and reviews; source-backed observed-page candidates. | First three exist. Observed versus intended page/flow needs an explicit distinction for code-first intake. |
| Authority | Pages owns plans/specs/flow judgments. The running app/Git owns built behavior; Design owns component contracts; Vision owns stories. | Current Spec/Built split is a strong boundary. Exact source revisions and origin need to travel through it. |
| Discovery | Look for published Vision journeys/stories, Code routes/screens, Design components, Data operations, and preview observations according to project access. | Today inputs are largely known by fixed record kinds and links. Add a shared discovery API plus Pages-owned candidate relation policy. |
| Local policy | Decide which source instances warrant pages or flows, how to match them, what counts as covered, which exceptions are legitimate, and when to ask. | Seed from current story-map/page rules as **proposals**; do not assert that every story requires a page or every route is an intended journey. |
| Quality audit | Check missing steps/pages, invalid links, unreviewed flows, spec/build drift, inaccessible or stale source, and accepted exceptions. | Missing steps and limited bridge drift exist. Visual/behavioral divergence still needs review; coverage metrics cannot substitute for it. |
| Reconciliation | Compare accepted policy and exact observed input revisions with current Pages outputs, then stage `pages.design`, `pages.flows` or `pages.review` suggestions; use `platform.implement` for a built-page change and a Vision question when intent is missing. | Existing Work actions and gap-key deduplication give a starting path; policy/source revisions and intentional exceptions must join the gap identity. |
| Publication | Offer page/flow identities, revisions, navigation, intended behavior, states, and uncertainty to Code, Design, Data and other consumers. | Existing record views and links partly do this; a formal output descriptor is missing. |

**Operating example: Vision adds a story.** Pages sees a new accepted story revision through discovery. Its active relation policy checks whether the story has a user-facing interaction, whether an existing flow already covers that interaction, and whether a reviewed exception applies. If applicability is uncertain, it proposes a focused question. If it is applicable and uncovered, it stages a Pages flow-planning item with the story revision, policy revision and expected review evidence. A person starts it through Work; a reviewed flow becomes a Pages output. The next audit checks whether the gap closed. A rejected work suggestion becomes feedback on either the individual correspondence or the policy; it is not re-created every scan.

**Operating example: Code exists, Pages is empty.** Code's published route/screen observations become candidates in Pages. The Map can show an **Observed** structure separately from **Planned/Specified** pages. Pages asks which observed paths are current user journeys, then proposes page and flow records with source links. An unreviewed candidate stays an observation. This is the same loop as a new Vision story, with a different candidate relation; no separate import-mode engine is needed. If Code disconnects, Pages retains the last pinned observation, shows its age, and stops claiming current build coverage.

### UI consequence

Keep **Map / Pages / Flows** as the main workspaces because each already serves a distinct owner job. The layer-app machinery appears where it helps those jobs:

- **Map** shows the graph Pages currently believes: planned/spec/built pages and flows, plus clearly distinct discovered candidates and missing coverage. Each suggested blank says *why* it exists (for example, an accepted story revision or observed route) and can be accepted, dismissed with reason, or opened as Work. A source disappearing dims its observation and explains which plans depend on it; it does not remove the nodes.
- **Pages** keeps the Spec/Built comparison and editing canvas. Its inspector adds a compact “Informed by” view with exact source revisions, confidence/acceptance, and any conflict. An observed route can be inspected without becoming an editable intended page spec until reviewed. A spec/build mismatch remains a review finding or Engineer request, as today.
- **Flows** keeps the preview-centered walkthrough. The list can distinguish accepted flows, proposed flows, uncovered applicable journeys, and exceptions. A flow review judges the actual journey; it can correct the policy's idea of coverage as well as the flow artifact.
- **Layer health and connections** are a compact cross-cutting status/inspector, not automatically a fourth peer tab. They show what Pages discovered, active/degraded sources, last audit, open questions, exceptions and the current relation-policy revision. Editing the policy is a reviewed advanced action. The ordinary designer need not configure API fallback chains to draw a page.

The UI must keep an owner able to plan a page manually even if discovery finds nothing. It must also expose *why* an item is suggested and whether it is an observation, proposal, accepted Pages output, or built behavior. Counts such as “12/14 stories linked” are useful only with the active applicability rule and known extraction coverage beside them.

### Minimal conversion sequence and proof

1. **Describe today's Pages as one layer-app manifest**: existing output kinds, authorities, actions, API projection and three UI jobs. Preserve current storage and tabs. Check that the manifest can explain an existing page, flow and work item without inventing an authority.
2. **Move one fixed rule into versioned Pages policy**: use the current story/flow relationship as a fixture, test a story that needs no page, a story covered by an existing flow, and an uncovered interactive story. Produce a reviewable relation proposal and stable gap IDs before general discovery.
3. **Add observed Code input** for one pinned route/screen slice under EX-03. Show observed candidates on Map, ask one ambiguous-intent question, and reject one wrong mapping without losing evidence. This tests the reverse direction.
4. **Close the loop**: accept or reject a proposed flow, re-run the audit, prove useful gaps close, exceptions prevent repeated suggestions, and a disconnected source degrades coverage without deleting Pages records. Verify the Map, Pages and Flows explanations with an owner; document evidence before claiming the general kernel works.

The architecture can share discovery, provenance, scheduler, policy revision and Work staging services. Pages still supplies its artifact types, correspondence judgment, quality checks, actions and renderer. A separately deployed service per layer is not required for this contract; modular responsibility is the point being tested.

## Fit with current Aludel

| Surface | Framework reading |
|---|---|
| Vision, Design, Pages, Data, Code, Deploy | Different output domains; tabs are projections, not definitions. |
| Library | Cross-layer source/evidence service, even if visible as a destination. |
| Work | Coordination and control plane for tasks, actions, attempts, questions, reviews. It owns process records but is not a mandatory sequential stage of conceptual production. |
| Home | Cross-layer read model and attention surface, not artifact authority. |
| Existing-project import | Revisioned observations and proposed records; observed behavior remains distinct from inferred intent. See [EXISTING-PROJECTS-01](../existing-projects/work-record.md). |

Current code has fixed navigation and a record-kind whitelist. Arbitrary user-defined layers would need schema, permission, search, bundle, rendering, adapter, and migration/export work. This framework does not justify an unrestricted generic entity store. Prove one missing-layer path and one external observation path first.

## Checks, reversals, and next work

The synthesis extends the existing [output/action analysis](../work-agents/layer-output-model.md), [knowledge ownership](../../knowledge-strategy.md), [capability authority](../../product-system-framework.md), and [existing-project reconciliation plan](../existing-projects/work-record.md). The output analysis already compares SPEM, IDEF0, and PROV primary sources; their full metamodels are not required here.

1. Write declarations for current Code, Design + Pages without Vision, and read-only Figma; include discovery/reconciliation policy and a candidate policy revision. Compile an output ledger for each. Reject any fixture where a consumer invents authority, missing inputs, or review.
2. Apply declarations to one pinned Aludel and one Launch LMS slice under EX-01/EX-03. A wrong inference must remain rejectable without losing source evidence.
3. If account access is authorized, try one real Figma file/library and measure extraction coverage, stable IDs, change detection, disconnect behavior, and whether the review view explains differences.
4. Then decide whether project-defined layer instances, a typed adapter registry, and configurable navigation are justified.

**Reversal evidence:** split a layer if outputs repeatedly need separate authorities/reviews; make an optional input required for an action if its absence repeatedly blocks meaningful review; show an external source as a link if revision identity or useful coverage cannot be preserved; narrow generic lifecycle claims if non-software fixtures require different work semantics.

## Retrospective and handoff

1. **Harder than necessary:** the output model did not declare reduced-input rules, and fixed navigation can appear to mandate a stack.
2. **Next equivalent task:** use the declaration and scenario fixtures before naming a layer or connector.
3. **Downstream change:** WORK-AGENTS-01 can consume declarations through output ledgers; EX-01 supplies imported observations; platform source authority needs explicit handoffs. No current packet is displaced.
4. **Questions:** who may configure a project-defined layer; which types can be declared without code; minimum useful Figma fidelity; how Home shows partial coverage. These affect implementation, not this proposal.
5. **Applied and tested:** three different graphs exposed missing upstream inputs, external writer identity, and source coverage/version limits. That is a design coherence check only; real project trials and owner evaluation remain.

**Next action for this proposal:** owner review of the Pages mapping, then a Pages discovery/reconciliation fixture alongside declarations in the existing WORK-AGENTS-01 / EX-01 dependency order. Project-wide `next_action` stays `WORK-AGENTS-01`.

## Carried from CUSTOM-LAYER-01 (2026-09-29)

The project-scoped definition reader, draft/active lifecycle and charter-as-Knowledge are built and owner-reviewed in the isolated candidate ([closeout](../layer-app-transition/custom-markdown-layer.md#packet-closeout--owner-acceptance-2026-09-29)). Still open here: recreating a built-in from a base definition plus adapters; action methods read from Knowledge; per-layer charter templates; a "Draft with an agent" definition Work type and a suggestion routine.

## Owner-selected template boundary (DEC-055, 2026-09-29)

The custom Markdown layer's definition and shared setup are now the baseline. The six initial software layers are forkable template repositories, not privileged built-in types. Their specialized editors, validators and actions belong in their own source repositories behind a checked host SDK, with portable charters and method Knowledge beside the code. The project owner owns an installed fork/copy and may customize it. The portal remains the shared Work/permission/runtime host and keeps operational records; an external source's data and Deploy secrets do not move into a template repo merely because its adapter does. The earlier recommendation to decide later whether project-defined instances justify a typed registry is superseded by this owner direction. [Conversion contract and capability ledger](../layer-app-transition/layer-template-conversion.md).
