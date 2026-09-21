---
id: project-workspace-v1-contracts
kind: domain-contract-proposal
status: proposed
updated: 2026-09-20
---

# Record, migration and preview contracts

These are target contracts for incremental implementation, not new live tables or endpoints. Keep ordinary relational storage and domain operations. A graph is a useful way to describe relationships, not a reason to introduce a graph database or a generic workflow engine.

## Shared envelope and authority

Every meaningful object has `(project_id, type, id)`, current revision pointer, title, lifecycle, author/source attribution, timestamps and optional archived state. Revisions contain immutable content and consumed input references. Links identify source and target identities, relationship type and revision binding; provenance is not an untyped URL field. A project-scoped unique local key makes `view:tool-detail` portable without making it globally unique. APIs enforce the project boundary on reads and writes, regardless of the UI route.

Three dimensions remain separate:

- **Lifecycle:** draft, proposed, active, completed, archived (type-specific state machines).
- **Evidence/acceptance:** unknown, agent-checked, owner-selected for a named scope, rejected, waived with source. “Checked” never becomes “accepted” automatically.
- **Currency:** current, stale, disputed or unknown relative to explicitly consumed inputs.

Code, token/theme source, executable stories and repository policies remain repository-authoritative. The portal stores their identities, hashes, contracts/references, consumers and review context; edits to those sources happen through work. Mutable product briefs, view specs, plans and review metadata become database-authoritative at an explicit cutover. Historical imported bytes stay evidence; do not create two editable authorities.

## Minimum object families and operations

| Family | Key fields beyond envelope | Creation/edit operation and authority | Important relations |
|---|---|---|---|
| Product brief/outcome | Audience/problem, desired change, constraints, success evidence; measure may be qualitative | Create/edit draft; save with expected revision; owner or attributed agent proposal | outcome motivates feature/milestone |
| Milestone/plan entry | Desired result, horizon/priority, dependencies, source packet ID, readiness, historical assertions | Create/reprioritize/revise; migration review/apply; never authorize by moving a row | milestone contains plan; plan supports feature; plan depends_on plan; task realizes plan |
| Feature/story | User situation, capability, acceptance examples, exclusions | Create/revise from intent; scope owner selection where consequential | feature supports outcome; story realized_by views; decision constrains feature |
| View/journey | Stable view key, responsibility, entry/exit, states, actions, route bindings by build | Create/revise product specification; code reference supplied by work | view serves story; view uses component through a usage relation |
| System/component/pattern | System/profile revision, philosophy, maturity, source/deviation refs, source contract, story refs | Register repository revision; propose change through work; portal-owned notes explicitly separate | component belongs_to system; usage consumes component revision; pattern supported_by story |
| Research/decision | Question, evidence, uncertainty; alternatives, recommendation, owner judgment | Existing decision semantics extended to typed affected objects; no invented answers | research supports decision; decision constrains a consumed input |
| Exploration/design asset | Question, alternatives, media/source hash, MIME/type, creator/tool provenance, hypothesis, review scope | Register/upload immutable asset; revise metadata by new revision; review direction separately | exploration tests view/feature; asset illustrates alternative; selection chooses scoped artifact |
| Request/proposal/executable work | Existing real request, proposal revision, exact scope, authorization, attempt/events | Preserve existing domain operations and histories; add plan link incrementally | request originates proposal; work consumes exact revisions; attempt produces artifact |
| Artifact/review | Source/build digest, context digest, baseline, locator/availability, checks/gaps, review dimension | Worker registers identified output; owner judges exact artifact/input revisions | artifact implements views; review evaluates artifact; review produces feedback |
| Capability/connection/environment | Capability catalog revision, required/deferred rationale, provision status, purpose, provider binding, secret reference | Record intention separately from connection/provisioning authorization; secrets outside product records | project consumes service; build targets environment; capability provided_by tested binding |

Do not force one request per historical packet, one feature per view, or one component per feature. A plan can precede any request; an executable task still requires a current scoped proposal and authorization. The `work_items` state machine should not be overloaded to represent roadmap hypotheses or imported history.

## Relationship and revision rules

- `motivates`, `serves`, `illustrates` and citations describe rationale; changing a citation URL does not automatically block execution.
- `consumes`, `depends_on`, `constrained_by` and `implements` have declared impact policy. An authorization uses frozen required inputs; if those change, preparation/claim fails or the active task stops at the next boundary.
- A relation stores source/target revision or an explicitly declared floating discovery link. A build's trace uses fixed revisions, never floating “current.”
- Reverse lookup is part of the contract: a component can list consumers, a decision affected plans/builds, and a source the claims derived from it.
- Updating an input marks only dependent current records as needing assessment. Past build inputs remain immutable. Reassessment has an attributed result (still valid, revise, obsolete), not a button that silently substitutes the latest text.
- Concurrent edits require `expected_revision`; retain client drafts on conflict. A normalized no-op edit creates no revision/event that invalidates consumers; intentional reaffirmation is a separate attributed operation if needed.
- Cross-project links are rejected unless an explicit shared-resource/service binding permits them, identifying the consumed revision and allowed metadata. Merely knowing an ID is not permission.

## Bootstrap reconciliation, not bulk conversion

1. **Snapshot:** hash selected sources and capture immutable bytes/known source IDs. Extract sections/rows with anchors, not just whole-file titles. Initial scope is execution/status/evidence for selected packets, not the entire archive.
2. **Propose:** produce a dry-run manifest with logical object key, source assertion, target type/fields, confidence, conflicts, existing match and proposed action. Example `(the-machine, plan, B-02)` reconciles execution-plan and status references; their files do not create separate B-02 objects.
3. **Resolve:** show current claim and historical evidence side by side. Explicit owner decision records outrank an older proposal only for the scope they actually settle. Dates aid review but do not automatically confer authority. Contradictory unresolved assertions remain disputed; do not mark ready.
4. **Review/apply:** owner confirms the displayed manifest; transactional domain operation checks source hashes and expected target revisions. Changed sources/targets invalidate the preview. Store batch identity and mapping from source assertion to target revision.
5. **Replay/correction:** idempotency on batch digest plus logical source-object key; identical reapply creates nothing. A changed source produces a new proposal/diff, never an overwrite of portal-owned content. A failed batch commits neither partial records nor an “applied” success. Backup/restore and rollback are demonstrated on disposable data before live migration. Undo after dependent edits is a new reconciliation, not destructive deletion.
6. **Cutover:** record authority per object. Repository status remains the compact engineering handoff; future roadmap/product changes use portal revisions and exported snapshots. Source files remain immutable historical evidence and code-adjacent contracts, not competing operational editors.

Historical completion is `recorded-complete` with source/date/scope/evidence confidence, not a simulated successful run. Absent original requests, actors, timestamps or authorization stay absent. Imported review assertions preserve quotations/source references and can require confirmation; they never call the owner acceptance API. B-02 seed records are explicitly classified as bootstrap summaries and reconciled without rewriting their existing event history.

Minimum migration cases: duplicate B-02 in two files; already-existing B-02 mapping; unchanged reimport; revised source after preview; conflicting completion; broken evidence; no original request; existing portal edit; cross-project collision; mid-batch failure. Canonical IDs, unresolved cases and every applied field have a source/reviewer.

## Concrete provenance example

```text
Project the-machine
  Product brief revision P
    → Feature: supervised work revision F
      → View: work-detail revision V
        → Usage: work-detail/status-label uses component status revision C

Owner navigation report → correction work/evidence
  → source snapshot S + built artifact digest A
    → trace manifest for A:
       route /the-machine/work/:id → view work-detail@V
       element work-state → usage work-detail/status-label@U → status@C
       produced_by correction work; checked_by navigation evidence
       constrained_by DEC-028; design basis MD3 v3 (scoped)
```

P/F/V/C/U are target records, not claims that these identities already exist in the portal. Initial migration must leave missing mappings explicit. The current source hash and navigation evidence can be attached without inventing the rest. BorrowBox can independently define `view:tool-detail` and `component:status` under its own project; no accidental relation to Machine status follows from the name.

## A preview is a build plus a review session

Use one project source tree for implemented views/components and its component stories. A candidate is a changed revision/snapshot of that tree, built separately with a baseline identity and a list of changed features/views/components. Branch/worktree source workflow depends on the unresolved Git prerequisite; until it exists, exact source manifests may support explicitly limited local snapshots. Do not claim PR review or reproducibility from a mutable folder path.

A design experiment records `kind=experiment`, question, experimental variables and simulation boundaries. When the hypothesis concerns a local component state, reuse its story. When it concerns a user journey, build the app with a fixture adapter at the data boundary and enter through visible scenario controls. A divergent low-fidelity concept remains separate evidence; it need not clone the application. Reuse is source-level/imported where feasible, not a promise that all experiments share one runtime.

The review session records project, baseline/candidate digests, preview URL + availability, active route/scenario, annotations and evaluation dimension. Resetting fixture state never deletes review notes. Visual selection, behavior acceptance and release are distinct records. An expired URL does not change artifact identity; rebuilt output receives new identity/checks.

### Context inspection boundary

A build manifest binds stable view/component-usage keys to exact source and product revisions. For instrumented previews, explicit data attributes or a small build-time registry may expose those keys. The review frame requests/selects a key and resolves rationale through its own authorized project API. A static alternative is a view/component list from the manifest; “why” must remain accessible without DOM picking.

If `postMessage` is used, validate allowed origin, source window, session nonce, project and build digest and schema/size. A preview can request context display but cannot authorize work, accept itself or receive owner cookies/tokens. Cross-origin candidates have isolated fixture data; the trusted portal owns record lookup and actions. Unknown/unmapped keys show missing evidence. Build-time validation checks every declared binding resolves and no foreign-project record leaks. B-03 owns the actual transport/isolation implementation and adversarial tests; PW-04 consumes it rather than creating a competing protocol.

## Project creation and service boundaries

`create_project_draft` is idempotent and only saves intent/constraints/context. A capability assessment proposes required/deferred/inapplicable provision with reasons; it does not demand all 24 capabilities be configured first. A setup plan offers stack/system/repository/runtime choices and the next ready bounded task. Only authorized work scaffolds an independent app or performs external effects.

Explicit reusable recipes/assets have project/provider identity, version, license/access, what is copied vs referenced, overrides and recheck triggers. Aludel's current code/design is not an implicit template. Each generated application can run independently of the portal; service bindings identify the accepted Machine revision used for development. A self-candidate is never its sole review/recovery host.
