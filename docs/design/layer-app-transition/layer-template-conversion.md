---
id: LAYER-TEMPLATES-01
kind: work-record
status: active
updated: 2026-09-30
depends_on: [CUSTOM-LAYER-01, LAYER-REPOSITORIES-01]
---

# Convert the initial layers into owner-owned template repositories

**Current direction:** DEC-057/059/060 and the T03-DATA closeout at the end of this record supersede the early action-migration and separate-Code-repository assumptions below. T03-G3 and Vision now have local evidence; Design and Code follow. Deploy is deferred. Earlier planning paragraphs are retained as dated rationale.

## Owner instruction, scope, and readiness

The owner clarified in the current chat that the custom-layer setup is the baseline. Vision, Design, Pages, Data, Code and Deploy should be examples of what can be built from that base, not privileged built-in layer types. Each installed layer should be self-contained in its own repository, including its charter, Knowledge, editor tabs and implementation. Adding a template should create an owner-owned fork/copy that the owner can customize. Preserve the initial stack's current capabilities; expand layer Knowledge as needed. This authorizes local architecture assessment and planning records, not runtime code changes, GitHub repository creation, provider turns, deployment, spending or promotion.

**Process finding:** the previous plan counted a project-scoped definition row and shared navigation as layer conversion, while native views, actions and storage remained compiled into portal modules. A source-location inventory and a behavior-preservation ledger must precede extraction. The test of this process change in this planning pass is a trace against the inspected candidate modules and the CUSTOM-LAYER-01 two-instance fixture; no extracted repository has been run yet. **Readiness:** ready to specify and locally prove the package contract after LAT-08 is integrated; not ready to claim portable built-ins or provision GitHub repositories.

## Target contract

An installed layer has one **owner-owned layer repository** and a pinned accepted commit. A catalog template is only the starting commit/source. Installation creates a project-scoped repository from that template, binds its immutable repository identity to a layer instance, validates the manifest and checks, and registers its declared capabilities. The owner can later change its charter, methods, tabs, schemas, actions and routines through reviewed repository revisions. Template updates are proposals against the owner's fork, never silent replacement. A layer can be installed without its usual neighbors; the definition states reduced-input behavior rather than assuming a fixed stack.

A minimal source tree is:

```text
layer.json                 identity, API/SDK version, output and UI registrations, requested capabilities
AGENTS.md                  short layer-specific working map
knowledge/charter.md       purpose, scope, method, quality and neighbor policy
knowledge/                 output specs, methods, routine and connection guidance, examples
ui/                        output tabs, components, styles and review renderers
server/                    output adapters, validators, actions, routines, discovery and migrations
schemas/                   portable output and policy schemas
fixtures/                  empty, populated, missing-neighbor and migration cases
tests/                     contract, behavior, permission and browser checks
```

The file names are a proposed local package convention, not a claim that the current candidate reads them. The manifest describes registrations and capabilities; the layer repository carries their implementation. The host supplies a versioned layer SDK and the common Home/Tasks/Knowledge/Manage shell. It resolves installed layers by project/repository/commit, renders registered tabs, calls scoped adapters, and records accepted version and provenance. It must not contain `product`/`pages`/`platform` key switches or a privileged six-layer catalog. Template identity, instance identity and display name are separate: renaming Screens does not change historical `pages` output IDs or action pins.

**Self-contained means source ownership, not unsandboxed authority.** The layer repo can define behavior through declared, versioned extension points. It cannot grant itself Work Go, read another project, access secrets, write another layer's outputs, publish a release or deploy. The host checks requested capabilities against project grants and exact operation boundaries. Build and validation use isolated workspaces; only a reviewed, pinned package is installed. The portal retains operational state: membership, Work tasks/Go/runs/reviews, grants, connection decisions, repository bindings, acceptance ledger and search indexes. The repo owns layer source. DEC-056 selects one local project SQLite database for structured outputs, strictly scoped by layer instance, with a separately verifiable portable export/restore contract; this does not weaken owner control of layer-specific code. The current typed store is the migration source; the project store becomes accepted authority only after SDK, revision, export and recovery proofs pass. Keep one accepted writer per output. Large assets, live runtime observations and secrets keep their appropriate external/host authority with explicit references from the layer.

The Code layer's repository is its **layer implementation repository**; the managed application's source repository remains a separate bound output source. Deploy's layer repo can define environment models and UI, while live environment state and credentials remain outside Git. An external/Figma layer may own a projection/adapter repository without claiming authorship of external artifacts. Cross-layer references pin layer instance, output ID and accepted revision/commit; a project state is a vector of accepted layer and app revisions.

## Capability-preservation ledger before moving code

For each existing layer, capture (a) output kinds, IDs and revision rules, (b) native tabs and empty/populated journeys, (c) actions, methods, routines, connection policies and Work review, (d) reads, writes and effects, (e) Knowledge documents, (f) import/export and existing data, (g) search and cross-layer links, and (h) current owner acceptance scope. Compare old and extracted behavior on the same fixture. Every item gets `preserved`, `intentionally revised with owner acceptance`, or `unavailable with reason`; an omitted item fails conversion.

| Template | Capability that must survive extraction | Repository-owned implementation boundary |
|---|---|---|
| Vision | Brief claims/evidence, story map, documents, source links and Vision actions | Typed output schemas, Brief/Story map/Documents tabs, quality rules and methods |
| Design | Tokens/live component preview, components, brand assets, Docs and accepted Design actions | Token/component/brand adapters and tabs; app-repository implemented assets remain linked outputs |
| Pages | Map canvas, page Spec/Built, flows/review, content edits, story/Code observations and reconciliation | Map/Pages/Flows UI, typed page/flow adapters, relation policy and review renderer |
| Data | Objects, API operations, access contracts and scoped Data review | Data schemas/editors/actions and contract checks |
| Code | Overview, Explorer, Tests, Docs, Releases, exact repository reads and change requests | Code projection/UI/actions over a separately bound app repository; no new direct code editor implied |
| Deploy | Environments, variables, integrations, runtime/Data views, Operator checks and explicit effects | Deploy UI/policies/actions over host/provider runtime APIs; secrets remain external |

The Markdown layer is the baseline fixture: two independent instances plus one template-derived native layer must run through the same install, navigation, Knowledge, Tasks, discovery, action and revision APIs. It does not force every output into Markdown files or a generic editor. A template can ship rich code while using the same installation and authority contract.

## Dependency-ordered conversion

1. **LAT-08 integration gate:** bring the accepted CUSTOM-LAYER-01 shell into one pinned candidate with action migration, resolve the Pages flow-review crash, and finish original-data startup proof. Preserve the retained preview and historical identities. This remains `next_action`.
2. **LAT-T01 — package/SDK contract:** compile the source-location ledger, define manifest, immutable installation identity, SDK capabilities, asset loading, build isolation, version pinning and upgrade/rollback semantics. Extract the Markdown baseline into a local repository without changing its behavior. Use two forks/instances in one project and one denied cross-project/effect fixture. A definition cannot pass by pointing to hardcoded portal components.
3. **LAT-T02 — Pages vertical extraction:** move Pages' charter/Knowledge, Map/Pages/Flows code, schemas, output adapters, actions, routines, discovery and review renderer into a template repo. Keep stable IDs and revision mapping while proving a portable output export/restore and database-backed candidate/acceptance path. LAT-T02 cannot close until the output authority, independent recovery and layer-owned code boundary are proved. Check old and new on identical fixtures, including no Vision, Code-only observation, a wrong relation, and an existing project copy. Do not remove old code until behavior and rollback pass.
4. **LAT-T03 — remaining five templates:** convert Vision, Design, Data, Code and Deploy one at a time with the same ledger and acceptance gate. Prove each can be installed as a fork from its template in a new project, renamed, changed locally, removed/readded without output loss, and upgraded without overwriting owner edits. Keep the accepted native UX and specialized adapters, but load them from their layer repos. Code and Deploy explicitly test separate app-repo and runtime authority.
5. **LAT-08A — native review:** complete the layer-owned review work on the template SDK and extracted renderers for representative Design, Pages, Code and Markdown outputs. Work still owns signatures and atomic acceptance. This packet must not recreate privileged built-in review switches.
6. **LAT-09 — comparison:** run the owner journeys on the integrated template-backed candidate, including one-layer and mixed custom/template projects. LAT-10 remains a separate promotion/recovery gate.

This sequence changes the previously proposed optional Pages repository pilot: local repo-backed installation becomes a prerequisite to claiming a template layer is converted. GitHub provisioning, provider PRs and multi-instance sync are later externally authorized proofs; local bare repositories suffice for the first contract/round-trip checks.

## Migration and rollback rule

Use **expand → dual-read comparison → explicit authority cutover → retire old writer** per output family. Export typed records with stable IDs, accepted revision, source/evidence links and deletion markers; restore into a disposable project/layer store and compare counts, hashes, references and representative UI/API results. Keep old accepted records read-only after cutover until recovery is proved. New writes go to one declared authority only. An imported commit is an observation until validated and accepted; a Git merge alone does not make it an accepted layer output. Rollback restores the prior pinned layer package and source snapshot without losing Work history or post-cutover accepted writes; if replay is necessary, reconcile them explicitly. Run repeat import and interrupted cutover fixtures before any real project migration.

## Open design questions and evidence needed

The SDK packaging format, safe UI extension mechanism, repository ownership for local-only projects, and how to review a charter/code change that changes grants or output schemas remain implementation choices. LAT-T01 should compare concrete options and use one local fork before selecting them. The repository is the target authority for definition and implementation; DEC-056 and [the output-authority contract](pages-output-authority.md) select one project SQLite store with strict instance scope and separate portable export. LAT-T02/T03 prove migration and cutover for each output family. Live observations, credentials, large artifacts and shared Work state keep their separate authority. No question here blocks completing LAT-08's current migration and integration gate.

## Retrospective and handoff

The earlier optional-repo plan was useful for identifying canonical stores and cross-repo review, but it understated the owner's portability goal. The correction is to distinguish layer **source portability** from runtime data authority and to require a behavior ledger before moving modules. Applied now: the six-family ledger, source-tree contract and two-instance proof are recorded against actual candidate module seams. Observed proof is limited to code inspection and the prior custom-layer browser/contract evidence; package loading, extraction, migration and fork upgrades remain hypotheses. The next action stays LAT-08, followed by LAT-T01 when its integrated candidate is pinned.

## Pages-first local implementation authorization (owner chat, 2026-09-29)

The owner said “okay go go. pages first makes sense” after selecting the custom-layer setup as the base and the six initial layers as owner-owned template repositories. This authorizes bounded local implementation, isolated Git branches/repositories, code edits, tests and local previews for the Pages-first package proof. It does not authorize GitHub/provider writes, a provider agent turn, spending, public deployment, candidate promotion or accepting a migration on the owner's live data. The implementation begins from accepted custom candidate `6d43ed8` in a new `pages-template-candidate` worktree, leaving `lat08-candidate`, `custom-layer-candidate` and their data intact.

**Readiness and one-packet rule:** LAT-08 has an outstanding owner browser and original-data gate, so this is an isolated LAT-T01/T02 groundwork slice, not a declaration that LAT-08 or LAT-T01 passed. The owner has expressly reprioritized local Pages implementation. Work first proves a repo-owned Pages package can supply its manifest, Charter/Knowledge seed and native tab registration while preserving the current Pages UI and typed output adapters. It then uses the capability ledger and a same-fixture comparison to decide the next extraction step. Any package execution or data authority cutover remains gated by a checked SDK and migration proof. The retained candidate is not modified.

**First-slice acceptance:** a local Pages repository has its own commit and declares identity, tabs, Knowledge and adapter/source inventory; the isolated portal reads that pinned package for Pages descriptor/navigation instead of the six-key presentation/tabs source; existing Pages Map/Pages/Flows, Tasks, Knowledge and Manage remain reachable on a fresh project and existing project fixture; a changed manifest is visible only after an explicit new pin/install; invalid or foreign paths are rejected. This is a source/registration slice and cannot close LAT-T02 until UI implementation, server adapters, actions, routines and portable outputs also move and pass parity.

## Pages-first local checkpoint (2026-09-29)

The isolated Pages candidate `f6adc8e813aead602304080e1f0e18584e84d66d` and [Pages evidence](../../../pages-template-candidate/docs/evidence/lat-t01-pages/README.md) records a pinned local template repository, project-specific Git copies, repository-owned Charter/Knowledge/native UI source, generated compile from the accepted commit, and a passed Pages browser journey. Its full server suite passed 167/167. The observed process improvement was the capability ledger plus end-to-end native journey after extraction; that combination found and fixed a null-action crash in the candidate's Work mapping. The result is a source/registration checkpoint only. Pages output authority, server adapters, actions, routines, review, per-project UI bundle loading and owner repin/rollback still need checked boundaries and same-fixture migration proof. LAT-08 retains its owner browser and original-data gates; the one `next_action` remains LAT-08.

The next authorized local slice should first define the checked host SDK and repository revision review/install path, then move the Pages output adapter under one scoped database authority with semantic candidate revisions and an independent export/import comparison. A copied server file in the template is source inventory, not runnable code. Do not switch existing project output authority or retire portal adapters until the old and new fixtures agree on IDs, revisions, links, reviews and rollback.

## Pages continuation authorization (owner chat, 2026-09-29)

The owner directed further Pages work before the other templates: decide the layer data boundary (suggesting SQLite per repository), keep all Pages-specific code in its layer, define how the Aludel host supplies consistent design tokens/components/layouts, compare the agent context for the same flow-change task in the old and template paths, sweep Pages design/build decisions into organized repository docs, and investigate what publishing owner-owned repositories to GitHub requires. This authorizes bounded local research, documentation, candidate code and tests. It does not itself authorize creating or publishing GitHub repositories, moving live data, accepting a schema migration, provider turns or deployment. The new slice starts with a source-and-behavior inventory, then a concrete host SDK/data design and same-task bundle comparison. Findings and unresolved choices will be recorded here and in the template; `next_action` remains LAT-08 until its gate is met.

## GitHub publication path

The [provider readiness plan](github-publication.md) specifies six catalog template repositories, project-owned generated repositories, per-layer provider bindings, checked Work pinning and recovery. GitHub template generation is recommended for independent owner customization; it is a copy with new history, not a literal GitHub fork. The current Pages repository remains local. Provider writes are outside this session's authorized scope and await a concrete, reviewable Pages pilot.

## Pages continuation checkpoint (2026-09-29)

Candidate `1e9bbee3f2120fd86eaae8176964af1062868ced` and [isolated continuation evidence](../../../pages-template-candidate/docs/evidence/lat-t02-pages-continuation/README.md) traces the Pages owner decisions into organized template docs, adds a versioned host theme seam, compares the old and new model-facing packets on the same real Go-pinned flow task, and tests an offline per-repo SQLite/materialized-output design. The new packet preserves the old targets, controls, output shape and capabilities while adding exact Pages charter/Knowledge/method and package pin; a package repin withdraws the old packet. The existing agent adapter **cannot modify a flow**: it rejects a flow target and only inserts a new flow. That is an explicit LAT-T02 capability gap, not a claim of parity. The offline typed-file/per-repo SQLite design remains a tested export primitive; DEC-056 confirms database-authoritative outputs in a per-project local SQLite store, semantic change sets and independent export. The isolated candidate now records project-scoped metadata for future deletions, and the template exporter preserves those tombstones; historical orphaned revisions still need a bounded recovery decision. The next Pages implementation slice must add a checked revise-flow adapter, source-owned server boundary and same-fixture cutover proof.

## Pages output-authority reconsideration — earlier owner signal, superseded by DEC-056

The owner questioned the proposed Git-file authority for rich Pages records: complex page specs, ordered flows and Map placement appear better suited to database records, while the branch/commit/merge *interaction* is still valuable. This authorizes a bounded local architecture comparison and documentation correction, not an output cutover or final storage decision. Revisit Q-011 before carrying the offline JSON-export experiment into runtime. The layer repository still owns the Pages application code, schemas, methods, Knowledge source and migrations; that source-ownership goal does not require each live page, flow or canvas move to be a tracked Git file. The [output-authority comparison](pages-output-authority.md) records the revised proposal and the still-open portability, branch/merge and hosted-sync checks.

## Per-instance repository and project-store confirmation — owner signal, 2026-09-29

The owner confirmed that charter, schemas and all layer-specific implementation belong in **each installed layer instance's repository**. An Aludel project groups such repositories and its data store. The owner accepted the recommendation of database-authoritative outputs and delegated the per-project versus per-layer physical database choice, requiring strict layer-instance scope and no database assumptions about which layers coexist. The owner also confirmed one Git-style Work experience for both data changes and repository changes such as internal documentation. This authorizes local decision/design record updates; it does not authorize moving original data, creating remote repositories, provider writes or deployment. Record the selected target and its testable isolation/source-change contract before implementation.

DEC-056 resolves the storage/source boundary: one owner repo **per installed layer instance**, one project SQLite store keyed by immutable instance ID, and one Work review model for repo commits, database change sets or both. The bootstrap portal currently has one SQLite file across projects; splitting into per-project files and proving Work/output atomicity are implementation tasks, not achieved by this design update. Source code remains per-instance even when outputs live in the project store.

The current isolated Pages candidate still keys its package binding by `(project_id, layer_key)` and its `knowledge_records` by project/kind without an instance ID. DEC-056 therefore adds an explicit migration gate: backfill immutable instance IDs, scope every output/revision/Work target and installed repo binding by them, and verify two same-template instances and denied cross-instance reads/writes. A repository-doc-only task and a mixed repo/data task must pass the same Work review flow as a Pages output task. The current candidate does not yet pass this gate.

## Pages DEC-056 implementation slice (owner chat, 2026-09-29)

The owner asked to start the DEC-056 transition with Pages. This authorizes bounded local changes and tests in the isolated `pages-template-candidate`, plus work-record/evidence updates. It does not authorize moving original portal data, accepting a live migration, GitHub writes, provider turns or deployment. LAT-08 remains the single handoff pointer pending its owner and original-data gates.

**Readiness and process:** begin with an additive identity migration and a checked project/instance lookup. The existing `(project_id, layer_key)` primary key means the first slice can backfill an immutable ID and scope Pages package bindings, but cannot yet prove two Pages instances or per-project physical databases. Test restart stability, project separation, a foreign-instance rejection and legacy binding migration before any output writer changes. Record the exact remaining constraints in evidence; do not mistake an added column for completed DEC-056 isolation.

## Pages DEC-056 identity checkpoint (2026-09-29)

The isolated candidate now assigns immutable layer-instance IDs, migrates legacy Pages package bindings onto them, uses the ID in new repository paths and includes it in Pages descriptors and Go-pinned Work source context. The [candidate evidence and retrospective](../../../pages-template-candidate/docs/evidence/lat-t02-pages-dec056/README.md) records 169/169 server tests, typecheck and the exact remaining DEC-056 gates. This is a migration-safe identity bridge only: duplicate Pages instances, instance-scoped output/Work records, physical project databases, export/restore and mixed source/data acceptance remain open. LAT-08 remains `next_action` pending its separate owner/original-data gate.

## Pages output-scope continuation (owner chat, 2026-09-29)

The owner directed continuation of the Pages transition. The next bounded local slice migrates Pages output/revision/deletion rows to the immutable instance ID in the isolated candidate, makes new Pages writes carry that ID, and adds an exact project/instance read check. The process gate is a before/after ledger over current records and tombstones, including a wrong-instance fixture and idempotent restart. This is an additive shadow-scope step in the current portal SQLite file, not a per-project physical database, duplicate-template installation, authority cutover, owner-data migration, or Work mixed-source/data acceptance. The existing LAT-08 handoff pointer and external-effect limits remain in force.

## Pages output-scope checkpoint (2026-09-29)

Candidate `be5ff6fc5891c7d34c13ebee9d22e2617b393716` and [the scope evidence](../../../pages-template-candidate/docs/evidence/lat-t02-pages-scope/README.md) add an idempotent Pages record/revision/tombstone backfill, instance-tagged new writes and project/instance checks for the current Pages read/write path. The 170/170 server suite and typecheck passed. A foreign instance ID hid a page from reads, blocked its update/delete and caused migration to reject the wrong scope. This validates the additive identity bridge on disposable data, not the per-project database or accepted output cutover. The next slice must reconcile duplicate-template instance identity and Work targets before moving accepted output authority. LAT-08 remains `next_action`.

## Pages Work identity continuation (owner chat, 2026-09-29)

The owner directed the next local Pages transition slice. Extend the additive DEC-056 bridge to Pages-origin Work rows and their existing Pages output targets. Backfill only links with an explicit current-record or tombstone source, preserve historical target IDs/revisions and non-Pages targets, and reject foreign instance IDs before a Work item can be used for Go or review. Test restart stability, a mixed Vision-story/Pages-page target, and a wrong-instance target. This remains isolated candidate code and disposable data; the shared Work review model, accepted output writer and physical SQLite placement are not cut over. LAT-08 remains the one `next_action`.

## Pages Work identity checkpoint (2026-09-29)

Candidate `3a50b42f184b1753e5ffa753c6d4a845857eb778` and [the Work scope evidence](../../../pages-template-candidate/docs/evidence/lat-t02-pages-work-scope/README.md) backfill Pages-origin Work instance IDs and only those historical Pages targets verified by a current record or tombstone. New Pages Work/target links are pinned, wrong-instance rows are rejected, and a Vision story target retains its original scope. Full server 170/170 and typecheck passed. Missing historical Pages targets remain unresolved instead of receiving a guessed ID. Semantic change sets, mixed source/data review and atomic acceptance, duplicate-template instances and per-project SQLite remain open. The one `next_action` stays LAT-08.

## Pages semantic flow continuation (owner chat, 2026-09-30)

The owner directed continuation of the Pages-first DEC-056 transition. This local slice addresses the known existing-flow modification gap without granting a repository package runtime database authority: put a pure, versioned flow-revision candidate/validation rule in the Pages instance template source, pin it through the candidate manifest, and test exact flow/page revisions, foreign instance denial, changed source commit and repeat review on disposable fixtures. The process gate is to separate source-owned semantic validation from the host's Work signature and transaction before executing package server code. The template's server code remains inventory/checked contract input until an isolated SDK loader and same-fixture runtime review pass. No owner data, provider, GitHub or deployment effect is authorized; `next_action` remains LAT-08.

## Pages semantic flow candidate checkpoint (2026-09-30)

The Pages owner-source repository at `e88409c78e790e8d4fdccc2ef4db043b6d3c39d3` now declares a pure v1 semantic existing-flow revision rule. The isolated portal candidate `2206727ebe3228c682b257c781fdd6217bdaf1d5` pins and validates that committed source without executing it. [Evidence and retrospective](../../../pages-template-candidate/docs/evidence/lat-t02-flow-candidate/README.md) records 4/4 template tests, 170/170 candidate server tests and typecheck, including foreign-instance, stale input/source, no-op and tamper rejection. This removes a source-ownership prerequisite for the flow-edit gap; it does **not** make the current create-only `pages.flows` action capable of revising a flow. A checked server SDK, full validator parity, Go/review wiring and atomic accepted output/Work transaction remain required. `next_action` stays LAT-08.

## Pages semantic runtime proof (owner chat, 2026-09-30)

The owner's continued instruction authorizes the next bounded local Pages slice in the isolated candidate: run only the reviewed, pinned Pages flow rule through a restricted child process on disposable fixtures, check denied filesystem and subprocess effects, and compare its review result with the current host flow validator on the same fixture. Readiness: the accepted source declaration and immutable instance pin exist; this is a local proof of the source-to-host boundary, not a general package server SDK or production isolation claim. The checked source digest, source commit, instance and caller input must be verified before execution. Network isolation is not established by Node's permission mode, so no arbitrary repository source or provider-fed content is admitted. Work Go, signed review, accepted database writes, original owner data, provider writes and deployment remain outside this slice. `next_action` remains LAT-08.

## Pages reviewed-source runner checkpoint (2026-09-30)

The isolated candidate at `45e2480` runs only the separately reviewed Pages flow module digest from its installed Git commit, under derived project/instance/source pins in a limited child process. [Evidence and retrospective](../../../pages-template-candidate/docs/evidence/lat-t02-flow-runner/README.md) records a same-fixture comparison with the current host validator, no runner database write, denied read/write/subprocess probes, changed-commit denial, stale and foreign input checks, 172/172 server tests and typecheck. This tested the process rule of reviewing exact source before local execution. It remains a pilot for one page-backed flow shape: Node permission mode alone does not prove network isolation, and the current Work adapter still cannot revise a flow. General SDK isolation, full flow-shape parity, native Go/review/acceptance, duplicate instances and per-project SQLite remain open. `next_action` remains LAT-08.

## Pages flow-shape parity continuation (owner chat, 2026-09-30)

The owner's continued instruction authorizes another bounded local Pages slice: reconcile the source-owned flow rule with current host-supported gap steps and persona references, compare normalized output on the same disposable records, and advance the template commit, candidate pin and separately reviewed source digest together. Process readiness: the prior runner proved only a page-backed fixture; inspection now shows the host validator permits zero to forty steps, optional step names, no-page gaps and persona references. The parity matrix and an exact source/digest repin precede any Work connection. Keep the source module pure and the runner's no-write boundary. This scope does not authorize Work Go/acceptance, original-data migration, GitHub/provider effects or deployment. `next_action` remains LAT-08.

## Pages flow-shape parity checkpoint (2026-09-30)

The Pages source repository at `7b18537648f872f3309b6d1dd2d3fca65d38d8c1` now covers gap steps, persona/activity references, optional names and zero to forty steps while pinning referenced revisions. The isolated candidate at `c328f72` advances the new-install commit and reviewed digest together and retains the old reviewed pair for existing installs. [Evidence and retrospective](../../../pages-template-candidate/docs/evidence/lat-t02-flow-shapes/README.md) records 5/5 source tests, 172/172 portal server tests, typecheck and two same-record host-validator comparisons (page-backed, then gap/persona). The applied process improvement is a host-validator parity matrix plus explicit legacy pin compatibility before Work wiring. The runner still accepts caller-supplied reference snapshots for this proof; production Work must derive them from current scoped records, then bind Go/review and atomic acceptance. General isolation, original-data parity and per-project SQLite remain open. `next_action` stays LAT-08.

## Pages revise-existing Work continuation (owner chat, 2026-09-30)

The owner explicitly authorized work on revise-existing-flow. This bounded local implementation in `pages-template-candidate` extends the current `pages.flows` Work action with an explicit flow-target mode while retaining its existing create mode. It must pin the flow and existing references at Go, derive new reference revisions from scoped host records, submit the source-owned semantic candidate without output writes, show native Previous/Proposed review, and apply the exact revision plus Work acceptance in one disposable project transaction. Test stale flow/page/persona/source, foreign instance, no-write before acceptance, one accepted revision and restart/idempotence. This is implementation of an isolated candidate, not original-data cutover, external provider use, repository publication or deployment. LAT-08 retains its owner/original-data gate and sole `next_action`. Readiness: the reviewed source and parity fixtures exist; the current create-only action, host source fetch and Work transaction are the remaining local prerequisites.

## LAT-T03 plan: the remaining five templates (owner chat, 2026-09-30)

The owner asked for a plan to port Vision, Design, Data, Code and Deploy onto `layer-base`, the same way Markdown and Pages were ported. This authorizes planning only; each conversion below needs its own go-ahead.

**Starting point (inspected 2026-09-30):**
- `layer-base` has `main`, `markdown` and `pages`.
- The candidate (`pages-template-candidate` at `a41c8b3`) forks instances on add, routes writes through each layer's OpenAPI handler, runs agent work as sandbox branches, and serves `ui/` in a per-instance frame.
- The other five are still compiled into the portal:
  - `server/layer-contract.mjs` holds a fixed six-key catalog, with keys `product` (Vision) and `platform` (Code).
  - `config/layer-templates.json` maps only `pages` as a built-in template.
  - `server/layer-ui.mjs:92` still allows three Pages-only frame calls.

**Process finding:** Pages took about fifteen checkpoints because it built the generic path while porting. The remaining layers can reuse that path, but they have three dependencies the path doesn't cover yet. They need contract work, not per-layer workarounds:

1. **Reading neighbors.** A handler can only see its own instance's records (`x-aludel-context`) and host catalogs. Pages flows already pin Vision stories, personas and activities, but only because host code (`server/pages-flow-work.mjs`) resolves them. Vision records are read in 15 portal files, and Data and Design records in about 10 each.
2. **Design as a host provider.** The Pages template imports `design-tokens`, `design-state` and `design-components` through `@aludel/host/*`. Tokens also drive the host theme and the generated app (`scaffold.mjs`, `code-layer.mjs` `starterDocs`). Once Design is a fork, these become reads of a Design instance's accepted records, and each layer needs defined behavior when no Design instance exists.
3. **Projections and effects.** Code (`code_projection`) and Deploy (`runtime_projection`) mostly observe a bound app repository and runtime rather than storing records. The contract has stored outputs only. Code does own `trace_link`s as data, and Deploy's effects stay unavailable.

### Shared groundwork (T03-0)

Do this once, before or alongside the first layer:
- **Catalog from templates.** Replace the fixed declarations and the `builtIn` map with template-branch pins. Keep existing instance keys (`product`, `platform`) as stable IDs; template names (`vision`, `code`) stay separate.
- **Adoption.** Generalize the B4 Markdown adoption: an existing built-in instance gets a repository at the template commit, and its records, IDs and revisions stay unchanged.
- **Generic frame calls.** Replace the Pages-only allowlist line with frame calls declared in the manifest.
- **Neighbor reads.** Add `x-aludel-neighbors` (proposed name): a layer declares the neighbor kinds it reads. The host passes current accepted records, with their instance and revision, and pins them in Work. With no neighbor installed, the host passes an empty list and the layer shows its reduced state. Pages' persona/story/activity pins then move from `pages-flow-work.mjs` into this contract. That migration is the test.

### Per-layer recipe

This is the Pages path, compressed:
1. **Ledger.** List owner decisions and behavior from the layer's design record and evidence, plus a source inventory. Mark every item preserved, revised with owner acceptance, or unavailable with a reason.
2. **Template branch.** Add the template branch on `layer-base` `main` with:
   - `layer.json`, charter and Knowledge;
   - `api/openapi.json` plus a pure handler, with the existing validators moved in (e.g. `cleanTokens`, `cleanComponent`, `cleanBrandAsset` from `design.mjs`);
   - a contract test;
   - a parity test that runs the host validator on the same fixtures.
3. **Views.** Move the views into `ui/`, running in the frame, and add their host SDK needs to the manifest.
4. **Host.** Pin the template in the catalog, fork on add, adopt existing instances, and handle agent Work through the layer API with elevated review. Keep the compiled module behind the templates-off switch.
5. **Checks.** Server suite; the layer's browser journey in the frame at wide and 390 px widths, with axe; and one agent Work run on the generic path.
6. **Closeout.** Evidence and retrospective.

### Order

| # | Template (instance key) | Outputs | UI source | Why this position | Specific risk |
|---|---|---|---|---|---|
| 1 | `data` (`data`) | data_object, data_operation, access_rule | `data.ts` (306 lines) | Plain stored records with no host provider role. This is the cheapest second native layer and confirms the recipe. | Code links and scaffold read Data objects. The first user of neighbor reads from Code's side. |
| 2 | `vision` (`product`) | vision_section, brief_claim, persona, phase, activity, step, story, spec, research, project | `product.ts`, `evidence.ts` | Upstream of everything. Moving it forces the neighbor-read contract to be finished and the Pages pins to move onto it. | The widest host coupling: onboarding seeds, agent runs, the Symphony packet, Pages reconciliation. Keep the Vision → Pages coverage utility working. |
| 3 | `design` (`design`) | design_tokens, component, brand_asset | `design*.ts` (about 1,250 lines) | Needs neighbor reads plus the host-provider split: host theme and frame SDK read the accepted tokens. | Pages' `@aludel/host/design-*` imports; generated-app tokens; brand templates config. Design needs a no-Design fallback theme. |
| 4 | `code` (`platform`) | code_unit, trace_link, code_release, code_route_observation | `code.ts` (509 lines) | Needs the projection contract: host gateway reads of the bound app repository declared in the manifest; implement/docs candidates stay host effect adapters. | Two repositories (layer repo vs app repo) must stay distinct (DEC-055); GitHub-bound repos. |
| 5 | `deploy` (`deploy`) | release | `deploy.ts` (229 lines) | Smallest UI. Reads Code releases and runtime state; every effect is still unavailable. | PLATFORM-PIPELINE-01 environments will reshape it. Port the current shape only. |

Contract work for Code and Deploy (T03-P) is a separate slice before item 4. A manifest declares projection outputs and the host gateways it reads through (repository, runtime). The host owns credentials, effects and the effect adapters. The layer owns views, relation judgment and Knowledge.

**Done for LAT-T03 means:**
- All six install as forks in a new project, can be renamed and changed locally, and can be removed and re-added without losing outputs.
- The original project adopts them with identical IDs and revisions.
- The six-key catalog and the compiled layer modules are retired together after the last layer passes, not one at a time. Template updates to existing forks stay deferred.

**Open owner choices:**
- Is Data-first acceptable, or should Vision go first?
- Should the neighbor-read and projection extensions be accepted as contract additions?
- Should compiled modules stay as a fallback until all six pass?

`next_action` is unchanged.

## LAT-T03 revision and authorization (owner chat, 2026-09-30, DEC-059)

The owner reviewed the plan and replaced its cross-layer design:
- **Library, not neighbor reads.** The Library pools every layer instance's accepted outputs and Knowledge into one searchable place, and layers read each other only there.
- **Design kit is app output only.** It is not the portal's theme.
- **Two output modes: records or repository files.**
- **Code's repository is the app repository.** This reverses part of DEC-055, and connecting an existing repository must be supported.
- **Deploy is deferred.**
- **Previews have levels.** Design and Pages start with a placeholder-level spec preview that is to be made polished later.
- **No early layer depends on a later one.** Earlier-stage layers should not depend on later-stage outputs.

The owner said "fire away". That authorizes bounded local implementation in `pages-template-candidate` and on `layer-base` branches: code, tests, local previews and evidence. It does not authorize GitHub or provider writes, provider turns, deployment, spending, or migrating the owner's live data.

**Packets, one at a time, each closed with evidence and a retrospective:**

1. **T03-G1 Library index.**
   - Every enabled instance publishes accepted records (records mode) and Knowledge into a Library index keyed by instance, kind, ID and revision.
   - Search and read API for people, agents and layer frames.
   - The handler reference check resolves against the Library across instances.
   - Pages' Vision pins move onto it.
2. **T03-G2 Repository-mode outputs.**
   - Manifest outputs declare `mode: records | repository`.
   - Repository outputs name files in the layer repo, are published to the Library at the accepted `main` commit, and change by commit (person) or reviewed branch (agent).
3. **T03-G3 Catalog from templates and adoption.**
   - The template pins replace the fixed six-key declarations, keeping existing instance keys.
   - Existing built-in instances get repositories at the template commit with records unchanged.
4. **T03-DATA.** OpenAPI 3.1 file with `x-aludel-id`, `x-aludel-owner`, `x-aludel-states`, `x-aludel-stories` and access rules. Migration generates the file from existing records and keeps IDs.
5. **T03-VISION.** Records mode.
6. **T03-DESIGN.** Records or files decided in the packet, with a placeholder spec preview, reading nothing from later layers.
7. **T03-CODE.** The app repository is the layer repository, and connecting an existing repository is supported.

Deploy stays compiled in until the owner decides its shape. `next_action` is unchanged.

## T03-DATA continuation authorization (owner chat, 2026-09-30)

The owner directed completion of the in-progress Data layer conversion and its loose ends. The owner also clarified that LAT-08's old action migration no longer describes the chosen layer-scoped Work model. This authorizes bounded local edits, tests, previews, evidence and handoff updates in `pages-template-candidate`, `layer-base` and this workspace. It does not authorize owner-data migration, provider turns, GitHub writes, spending, deployment or promotion.

**Readiness and process check:** T03-G1 and G2 have committed local evidence. A Data template branch and unfinished candidate integration exist; T03-G3's catalog/adoption requirement must be checked against that integration before claiming Data complete. Preserve existing Data IDs/revisions and run Data API, Library, Work and browser journeys on disposable projects. Retire the stale LAT-08 pointer only after checking the current layer-scoped boundaries and recording what remains genuinely open. This is ready for local completion, not owner acceptance or release.

## T03-DATA local closeout and next step (2026-09-30)

The Data template at `12d08eb` now owns its OpenAPI output/indexer/normalizer, Knowledge, and Objects/API/Access view source and styles. The candidate pins that commit. [T03-DATA evidence and retrospective](../../../pages-template-candidate/docs/evidence/t03-data/README.md) records the same-fixture adoption, revision, branch-merge and browser checks. The portal's compiled Data screen remains a templates-off fallback while other layers convert.

The plan's T03-G3 dependency was too broad for a one-layer test: Data's fork and record adoption passed, but the fixed six-key catalog still exists for the unconverted layers. T03-G3 is therefore the one next action: derive the installable catalog from reviewed template pins while preserving historical instance keys and templates-off compatibility. Then convert Vision, Design and Code. Deploy remains deferred by DEC-059. LAT-08's action migration is retired by DEC-060; original-owner-data cutover moves to LAT-10, not this local checkpoint.

## T03-VISION continuation scope (owner chat, 2026-09-30)

The owner asked to pick up Vision in the catalog transfer. This authorizes bounded local repository and candidate edits, disposable checks, preview and evidence for the Vision conversion, including the still-open T03-G3 catalog prerequisite. It does not authorize provider writes, owner-data cutover, deployment, spending or promotion. Work remains sequential: finish the shared catalog prerequisite before claiming Vision complete.

Readiness: Data proved per-instance fork/adoption but left the fixed six-key install list. Vision's records are already typed and indexed by the shared Library; the native Brief, Story map and Documents view still lives in portal code. Preserve its record IDs/revisions and accepted behavior while sourcing its manifest, Knowledge and native view from a pinned `vision` branch. Check new and existing disposable projects, templates-off fallback, a Vision-only project, Library and Pages story pins, and browser behavior before closing the packet. The general process gap is that a per-layer adoption check did not detect a fixed catalog; add a catalog-source assertion that fails if a converted template is absent from the installable list or its pinned manifest drifts.

## T03-G3 and T03-VISION local closeout (2026-09-30)

The reviewed template pins now supply declarations and install presentation for converted layers; compiled Design, Code and Deploy remain visible until converted, and templates-off keeps the historical stack. Candidate `7ceebd7` pins the `vision` branch at `ac96e2f`, which owns Vision's manifest, Knowledge and native view in records mode. Disposable new/existing adoption, stable IDs/revisions, Library, frame build, browser journey and accessibility checks passed. [Evidence and retrospective](../../../pages-template-candidate/docs/evidence/t03-vision/README.md). This is agent-checked local work, not owner acceptance or promotion. `T03-DESIGN` is next; Code follows, Deploy remains deferred.

## T03-VISION completion and contract additions (2026-09-30)

On review, Codex's Vision checkpoint had moved the views and Knowledge but not the rules. Candidate `ab021b0` and `vision` `eac6132` finish the job and add these to the layer contract:

- **`x-aludel-parent`:** an operation names the request field that holds a record's parent. Writes carry `parentId` as a checked reference. The host applies a person's ordering (`position`).
- **`hostCalls`:** a manifest requests named host features. The host fixes each feature's routes. Older forks keep their template's features until template updates reach them.
- **Instance backfill:** a layer that starts publishing an API takes over its untagged records.
- **Process:** `test:server:templates` is now part of every conversion's checks, alongside the browser journey run several times when it is flaky.

[Evidence](../../../pages-template-candidate/docs/evidence/t03-vision-rules/README.md).

## T03-DESIGN local closeout (2026-09-30)

The owner approved the [T03-DESIGN plan](t03-design-brief.md) in chat on 2026-09-30. Candidate `f2fb8be` pins `design` `bc36f24`, which owns:
- Design's manifest, charter and methods;
- the Tokens, Components, Brand and Docs views, including the live token draft;
- its rules and a 9-operation API, in **records mode**.

Pages (`e693c19`) now reads the app kit from the Library. [Evidence and retrospective](../../../pages-template-candidate/docs/evidence/t03-design/README.md). This is agent-checked local work, not owner acceptance or promotion.

These additions apply to every later conversion:
- **Shared rendering lives in the host SDK and takes data as input.** `@aludel/host/app-kit` draws the app kit whichever layer publishes it. A layer that previews another layer's output reads that output from the Library, never imports its code.
- **Library `data=1`:** a reader can take a whole kind with its content in one call.
- **Host features:** `uploads`, `brandTemplates`, and `libraryRecords` (writing the Library's own `doc` and `evidence_link` records from a layer view).
- **Process:** `tools/typecheck-layer-ui.mjs` type-checks a template's views at a commit. Run it for every pin; the frame build exits 0 with type errors in them.
- **Limit carried forward:** each handler call is one sandboxed child process (about 22 ms). A batched call is a candidate before more layers seed many records.

T03-CODE is next and starts with its own brief and owner plan approval. Its scaffold should read the kit from the Library. Deploy stays deferred.

## T03-DESIGN-SEED and T03-ADAPT local closeout (2026-10-01)

Owner direction (chat, 2026-09-30): Design's starter belongs in its template. A source never has to adopt "the Aludel way": each consuming layer owns an adapter from what a source publishes to its own representation. Build only that boundary for now.

- **Layer seeds:** `api.seeds` and `seed(event, context)` give a layer its own starter content and Look & feel sync. The host supplies the project facts and checks the writes like an operation's. Design (`64e916f`) uses them. The host's compiled kit seeding remains only for kinds no template seeds.
- **Consumer-owned adapters:** Pages (`96194a1`) reads the kit through `ui/pages-kit-adapter.ts`, picks its source from the Library, and links to the source's own path or Library entries. The host app kit only renders. Design reads no later layer.
- **Base contract** (`2449ff8`) documents both.

[Evidence and retrospective](../../../pages-template-candidate/docs/evidence/t03-design-seed-adapt/README.md).

Not built, by agreement:
- connection records choosing the source;
- routines proposing adapter changes;
- a second (for example Figma) adapter.

T03-CODE is next: its own adapter, and its starters in its template.
