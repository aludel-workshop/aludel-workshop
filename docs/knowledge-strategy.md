---
id: knowledge-001
kind: knowledge-strategy
status: applied-local-foundation
updated: 2026-09-20
---

# Knowledge and agent-context strategy

## Decision direction

Markdown alone is no longer adequate for mutable product work, task tracking, design revisions, relationships, reviews, and execution history. M1 should introduce a database earlier than the previous “document import” framing implied. This does not mean putting all knowledge into database text fields.

Use three cooperating layers:

1. **Portal database:** authoritative operational and relational product record.
2. **Project repository:** authoritative code, code-adjacent contracts, portable policies, schemas, and versioned design assets.
3. **Task context bundle:** a generated, immutable working set supplied to an agent or reviewer for one task.

Object storage later holds large immutable artifacts such as screenshots, generated images, recordings, and builds. The database stores identity, metadata, relationships, hashes, access policy, and review state.

## Ownership boundary

| Information | Authority | Reason |
|---|---|---|
| Projects, outcomes, proposals, questions, decisions | Database | Mutable structured records with relationships and queries |
| Tasks, dependencies, authorizations, attempts, events | Database | Transactional coordination and restart recovery |
| Artifact/review/release metadata | Database | Exact identities, lifecycle, permissions, and traceability |
| Code and migrations | Git repository | Native diff, review, branching, and reproducibility |
| Repository operating rules | `AGENTS.md` and scoped policy files | Automatically available to coding agents and reviewed with code |
| Design-system profiles, source/deviation ledgers, DTCG-compatible tokens and implemented component contracts/stories | Repository | Product-owned and code-adjacent; must evolve atomically with UI implementation |
| Feature/view/component specs before implementation | Database records with exportable revisions | Collaborative mutable product record; portable snapshots remain possible |
| Large images, videos, build archives | Object storage | Immutable bytes outside relational rows |
| External research sources | Database metadata plus captured notes/artifacts where lawful | Search, provenance, access date, and expiry |
| Task-specific instructions and selected evidence | Generated context bundle | Small, reproducible input rather than an unbounded corpus crawl |

## Shared structure and project allocation

The [capability catalog](system/capabilities.json) is a reusable versioned contract. Project capability allocations and service bindings are scoped records that refer to that version. Aludel and any managed product use the same record shape; Aludel's code, MD3 profile and provider assignments do not become global defaults. Shared assets are explicitly promoted and consumed by revision.

Bootstrap JSON and generated Markdown maps remain repository evidence. A future portal can import these as project records, preserving capability/project IDs, current-versus-target status, authority, gaps, evidence and deployed-versus-candidate service revisions. Keep implementation source and design-system assets in their owning repository. A task bundle should include only affected allocations and handoffs alongside the selected project-specific system revision.

## Fresh-workspace bootstrap

A newly created coding workspace should not discover the project by reading every document or querying the whole database. It receives a deterministic bootstrap:

```text
AGENTS.md                         durable repository rules; loaded automatically
.machine/context-manifest.json   project/task identity and bundle hashes
.machine/task.md                 intent, scope, acceptance, exclusions, authorization
.machine/decisions.json          only relevant decision revisions
.machine/design/                 selected accepted specs and referenced assets
.machine/links.json              typed IDs/URLs for optional deeper retrieval
```

The worker creates this bundle from committed portal records before dispatch and stores its digest on the attempt. The agent reads `AGENTS.md`, then the manifest and task brief. It retrieves more context through a narrow portal query tool only when the manifest points to it or the task exposes a gap.

Official OpenAI documentation states that Codex discovers layered `AGENTS.md` instructions from the project hierarchy and injects them into context. That makes `AGENTS.md` suitable for stable working rules, but not for volatile project state or a growing knowledge archive: [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md).

## Retrieval model

Begin with explicit typed relations, text search, and task bundle selection. Each record needs a stable ID, type, project, revision, status, provenance, timestamps, related records, and supersession/staleness links. Agents should query by task and relationship before broad semantic similarity.

Add embeddings only after retained retrieval tests show that filters, links, and text search miss needed context. The evaluation set should ask representative questions such as:

- Which accepted decisions constrain this task?
- Which view specification owns this component?
- What evidence caused this requirement?
- Which artifact implemented proposal revision 3?
- What changed since the last accepted review?

Measure whether the returned context is sufficient, current, scoped, and small enough to use. “The answer existed somewhere” is not a passing retrieval result.

## Product implications

The portal is both a user interface and an API for product knowledge. Every meaningful record should support:

- a human-readable view;
- stable machine-readable identity and schema;
- typed links and reverse links;
- immutable revisions for decisions and accepted inputs;
- search/filter access;
- task-bundle inclusion rules;
- portable export without making exported Markdown a second live authority.

The owner can browse and edit rich product records in the portal. Agents operate on the same records through domain APIs and frozen bundles. Repository-local documentation remains small, durable, and close to the code it governs.

## Bootstrap migration

The existing `/docs` corpus remains the seed and audit trail for M0. Before implementation:

1. Define schemas and stable IDs for the knowledge types selected for M1.
2. Import the Markdown corpus as source revisions, preserving paths and links.
3. Produce a reconciliation report; unresolved links and ambiguous duplicates remain visible.
4. After cutover, edits to imported records happen in the database. A changed source file is proposed as a new revision rather than silently overwriting the database.
5. Keep a generated, compact repository handoff for agents and disaster recovery; do not mirror the entire live database as hand-edited Markdown.

B-01 selects SQLite as the zero-service local adapter and preserves PostgreSQL as the hosted direction. The implemented schema stores projects, mutable owner requests, source identities, immutable revisions, parsed metadata, typed link rows, import runs, access configuration, and sessions. B-02 adds versioned proposals and decisions plus explicit consumed-revision dependency bindings; optimistic conflicts and scoped staleness passed in [B-02 evidence](evidence/b-02-product-records.md). Executable task, attempt, artifact, review, and context-bundle schemas remain B-03 work; the local adapter is not evidence of hosted concurrency or PostgreSQL equivalence.


## Supervised local transition — DEC-028

The portal now owns the supervised request/authorization/question cycle. Repository status is a planning handoff, not execution permission. The trusted local operator uses shared transactional work operations with actor separation, exact input/version checks and durable events. See [operator contract](design/process/portal-operator.md). Automatic runner integration, leases/recovery and full immutable candidate acceptance remain B-03B; this bridge does not complete M1.

## D-02 — Domain migration is separate from source import

The [local audit](design/project-workspace/v1/audit.md) confirms that Markdown import preserves documents/links, not native roadmap packets, views, design assets or causal relationships. Knowledge search currently indexes titles/paths. Do not count a searchable file as coverage of its intended product capability.

The proposed [record/reconciliation contract](design/project-workspace/v1/contracts.md) adds project-scoped typed identities, source assertions, explicit authority cutover, reviewable idempotent migration and build-bound provenance. Historical completion stays a source-backed assertion with its original scope; missing requests/authorizations/actors remain missing. Current portal seed summaries require attributed reconciliation, not retroactive fabrication of owner events. These contracts are pending structural review and implementation proof; the database schema has not gained them from this document.
