---
id: LAYER-REPOSITORIES-01
kind: work-record
status: superseded-direction
updated: 2026-09-29
depends_on: [LAYER-APP-TRANSITION-01, PLATFORM-PIPELINE-01, LAT-08]
---

# Layer-owned repositories: scouting record

## Authorization and scope

Owner instruction in chat, 2026-09-29: scout the idea of one repository per layer, with layer-specific agent instructions and documentation, Git review for proposed changes, and GitHub project grouping, as the isolated layer-app candidate comes online. This authorizes bounded local research, repository planning records, and read-only provider documentation checks under DEC-029. It does not authorize creating or changing GitHub repositories, Projects, permissions, live Work runs, releases, deployment, or candidate promotion. Per-layer Linear/Jira boards are explicitly deferred.

## Process question

Before choosing repository topology, inventory current artifact authority and review semantics, then test a small end-to-end layer repository contract against the isolated candidate. A repository is a versioned storage and collaboration boundary; it does not by itself define the layer runtime, task authorization, or atomic acceptance across layers.

## Research in progress

The existing [knowledge strategy](../../knowledge-strategy.md) and [candidate plan](../layer-app-transition/implementation-plan.md) put most typed Vision/Pages/Data records in SQLite and Code bytes in Git. This proposal reopens that authority boundary and DEC-047's provisional companion knowledge repository. The current `LAT-08` migration and `LAT-08A` native review gates remain the active path; this scouting does not change `next_action`.

## Findings (local inspection and GitHub docs, 2026-09-29)

The candidate's `knowledge.mjs` keeps typed Vision, Pages, Design and Data records and revisions in SQLite. Code alone projects Git bytes. Work owns Go, attempts, review signatures and acceptance. A repository per layer therefore changes artifact authority and review semantics; repository provisioning alone cannot implement it. This is the reusable process finding: map each artifact's canonical store, reviewer and import path before changing repo topology.

| Layer | Proposed Git authority | Boundary to prove |
|---|---|---|
| Pages, Vision, Data | Portable typed files in their own repos; SQLite as validated index | Deterministic export/import, stable IDs, links, conflicts, history and deletion |
| Design | Source tokens, components, guidance in Design repo | Pin source revision; built assets remain in app repo and need drift checks |
| Code | Existing app repo | Exact repo binding, branch candidate and accepted commit |
| Deploy | App-declared environment files may stay in Code; operational state stays in portal | Never export credentials or live runtime state to Git |
| Home, Library, Work | Shared portal services | Do not fabricate repos for control-plane state or evidence |

**Recommendation:** support an optional repository binding per output-owning layer instance. Start with the existing Code repo and a local Pages pilot. A layer app remains a domain module in one portal process, not a required service or repository. The project holds a registry of repo ID, provider owner, installation, branch, schema, authoritative paths and accepted/observed commits. Each layer repo has a short `AGENTS.md`, focused docs, portable artifact files and checks. The agent receives an exact checkout plus the frozen Work task bundle; repository instructions do not grant authorization. LAT-08's Code read gateway must evolve from one app-repo binding into scoped bindings for all repos, with separate read, write and external-effect checks.

**Review path:** Work pins the task and input commits at Go; a trusted worker makes an isolated branch; checks and native-tab Previous/Proposed review cite exact revisions; an authorized operation publishes a PR; Work stores the review signature and PR/head/check identities; a separately checked merge is imported and validated before the layer's accepted projection advances. A PR by itself is a proposal, and an external merge is an observation until validated. Reuse LAT-08A's native layer review rather than replacing Work review with GitHub comments. For local proof, use a local bare repo and branch without external writes.

**Cross-layer work:** one task has one primary output repo and pins other layers' commits as inputs. Dependent edits become linked tasks/PRs. A project snapshot is a vector of accepted repo commits, not one SHA. No multi-repo atomic merge exists; compatibility must be checked across the vector. Stable cross-layer references use artifact ID, repo ID and commit, not path alone.

**GitHub facts:** A [GitHub Project](https://docs.github.com/en/issues/planning-and-tracking-with-projects/creating-projects/creating-a-project) tracks issues/PRs, including [items from multiple repositories](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-items-in-your-project/adding-items-to-your-project), but does not contain repositories. It can [auto-add per-repo items](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/adding-items-automatically). A Project [linked from a repo](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-your-project/adding-your-project-to-a-repository) must share its owner. The existing vendor GitHub App has a proven personal and organization repo creation/push path (PP-01B), but PR/Project automation needs separately checked [App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app) and installation approval. GitHub's [branch protection documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches) lists private-repo protection on Pro, Team or Enterprise plans; check the actual plan before promising enforced review under the zero-cost preference. PRs remain useful without provider-enforced protection.

**Implementation sequence:** (1) after LAT-08, prove Pages file schema and round-trip on a disposable candidate fixture; test links, conflicts, deletion and restart; (2) add multi-repo bindings and denied cross-project/secret reads; (3) run branch, checks, stale-base rejection, native review and accepted import against a local bare repo; (4) after separate authorization, pilot one private GitHub Pages repo and PR with duplicate/missed-event recovery; (5) expand to Design, Vision and Data after testing their distinct authority edges, then test adoption by a second Aludel instance. Keep LAT-08 as `next_action`. Per-layer Linear/Jira boards remain deferred.

**Readiness:** ready for a local Pages contract spike after LAT-08; not ready to make every layer repository-backed by default. This scouting applied the authority matrix to the candidate plan, schema and GitHub documentation. It caught the SQLite migration, cross-repo acceptance and private protection limits before provisioning. It has not tested export/import, PR behavior, provider permissions or multi-instance sync. The next equivalent task should use this matrix and the local branch/rejection fixture to test whether the process works.

## Owner correction: repository ownership is the target, not optional (DEC-055, 2026-09-29)

The owner selected an owner-owned repository for **every installed layer**, created as a fork/copy of a catalog template. The repository holds the layer's definition, charter/Knowledge, editor tabs and implementation, not merely portable output files. The optional-binding recommendation and Pages-only expansion order above are historical scouting, superseded for the target architecture. Its artifact-authority matrix, local bare-repo proof and separate Work/secret/effect boundaries remain useful. [LAYER-TEMPLATES-01](../layer-app-transition/layer-template-conversion.md) is the conversion plan; LAT-08 remains the single active packet. GitHub repository creation still needs separate authorization.
