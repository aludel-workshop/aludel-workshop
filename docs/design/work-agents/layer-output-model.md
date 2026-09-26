---
id: work-agents-layer-output-model
kind: design-analysis
status: proposed
updated: 2026-09-25
---

# Layers as output ownership and work

## Owner correction and scope

On 2026-09-25 the owner deferred the LAY-05 manual browser review after a created security-audit item correctly showed that its agent action was not runnable. Before expanding the runner, the owner asked to make explicit what each layer creates, how its work changes those outputs, and how research evidence, decisions and cross-layer links bear on review. This is local conceptual design, not execution authorization or a claim that all actions run.

## Frameworks checked 2026-09-25

- [OMG SPEM 2.0](https://www.omg.org/spec/SPEM/2.0/PDF/) distinguishes role definitions, task definitions, work product definitions and guidance. It explicitly models tasks with input and output work products and roles responsible for work products. Its work-product relationships include composition and impact/dependency. This is the closest vocabulary for Aludel's role/action/artifact contracts, but its full UML metamodel would add machinery we do not need for the first implementation.
- [NIST's IDEF0 explanation](https://pages.nist.gov/circular-economy-manufacturing-models/instructions.html) models each activity using inputs, controls, outputs and mechanisms. Use these four questions as a compact action-contract check, not as a required diagram or a claim that work is linear.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) distinguishes entities, activities and agents and provides relations for use, generation, derivation, attribution and responsibility. Use its semantics to sanity-check revision and evidence links; retain Aludel's simple typed database relations rather than require RDF.

These are documented models, not proof that applying them will make Aludel's Work flow usable. The proposed synthesis below is an Aludel design inference.

## Proposed synthesis

A **layer** owns a portfolio of primary outputs and the domain methods for making and improving them. Its UI is a view into that responsibility, not the definition of the layer. An output can be a revisioned knowledge record, a repository commit, an executable preview, or operational state such as an environment configuration. Home derives a cross-layer view; Work owns task/process records and coordinates activity across the other layers.

A **role** is responsible for quality and judgment over some outputs. An **action** describes a repeatable transformation or assessment: required inputs, controlling decisions/policies, allowed mechanisms/tools, intended outputs, validation and review. A **work item** instantiates one or more output intentions for a concrete situation; its brief and targets select scope. A person or agent profile is a performer. The role/action governs the performer, while the work item supplies intent. A single item may change several artifacts and include process improvement, provided every output and review obligation is explicit.

For each intended output, capture: artifact type and owner layer; existing revision or new identity; proposed operation (create, revise, inspect, publish, run); source inputs and controlling decisions; allowed effect; evidence to attach; validation; reviewer; and acceptance consequence. The primary action chooses coordination and default permissions. Cross-layer outputs require their owning layer's checks and reviewer; merely linking to another layer does not authorize changing it. An item should split only when outputs need separate timing, authorization, or independent acceptance, not because two layers are involved.

Keep distinct link meanings. `derived from` says one artifact revision was produced using another; `supports` or `contradicts` attaches evidence to a claim; `decided by` identifies the binding rationale; `implements` and `tests` describe coverage; `supersedes` links revisions; `blocks` is a work dependency. A generic `related` link cannot drive staleness, context selection, or review reliably. Prefer links to exact consumed revisions for causal claims and use live links for navigation where exact identity is unnecessary.

## First output map to test

| Layer | Primary outputs | Example governing inputs or evidence |
|---|---|---|
| Vision (current Product) | Brief claims, audience/problem framing, stories, acceptance, roadmap and project briefs | Research findings, owner decisions, observed use |
| Design | Tokens, component contracts, patterns, brand guidance | Vision intent, source references, page and accessibility findings |
| Pages | Page map/specifications, flows, page content and review evidence | Stories, Design system revisions, preview observations |
| Data | Object schemas, API operations, access rules | Stories and decisions; implementation feedback from Code |
| Code | Repository revisions, tests, developer docs, build candidates | Acceptance, Pages/Design/Data contracts, audit findings |
| Deploy | Environment and integration configuration, release/deployment records, recovery evidence | Accepted code/build, policy and operational observations |
| Work | Role/action/profile definitions, tasks, batch authorizations, attempts, questions, submissions and reviews | Gaps and requests from every layer; execution and review evidence |

Library sources and findings can support any layer. Home is a read model of these outputs and their state. The map is a starting hypothesis: inspect actual records and owner tasks before turning it into exhaustive schema.

## Security audit as a contract test

An Engineer security audit reads an exact code revision, dependency manifest, relevant Data access rules and security decisions. Its first output is a finding report with severity, location, evidence and recommended action; it may also propose a change to an action/process rule. Passing tests or an agent's statement is not the audit result. If the same item also fixes code, the code candidate is a second declared output with its own path permissions and exact-commit review. A blocking question suspends only this attempt. The review must inspect the report and any code candidate separately before the item can be called done.

The current `platform.security` action has descriptive guidance but no executable output/tool adapter, so the Board's refusal to run it is accurate. WORK-AGENTS-01 should make this audit the first non-code Symphony fixture: it exercises read-only analysis, findings, evidence links, questions and review without granting broad mutation rights. A later code-fix fixture exercises the second output.

## Process test before implementation

For Vision edit, Data contract, Code change and security audit, write one output ledger each: inputs, controls, mechanisms, outputs, revision links and review. Then test whether a manually created item can be compiled from the ledger without inventing permissions, whether two agent profiles and a person can perform it under the same action, and whether the reviewer can determine what changed and why. If the ledger cannot answer those questions, refine the action or artifact definition before adding a runner. This is an applied design check, not runtime evidence.
