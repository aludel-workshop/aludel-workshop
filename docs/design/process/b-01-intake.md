---
id: b-01-intake
kind: implementation-readiness
status: accepted-for-local-slice
updated: 2026-09-20
packet: B-01
---

# B-01 local foundation intake

## Scope and readiness

The owner asked to start the app locally using the approved UI and to begin moving the Markdown library into an information system. This explicitly waives the hosted-preview and measured provider-cost gates for the local B-01 slice only. It does not authorize an external account, deployment, purchase, or provider effect. Those gates remain required before external-provider use.

Verdict: **ready for a local foundation slice**. DEC-025/026 supply the design-system and composition baselines. The first implementation must prove a private local shell, project scoping, persistent structured storage, idempotent source import, restart persistence, and an inspectable import report. B-02/B-03 behaviors remain outside this slice.

## Concrete boundary

| Concern | Local B-01 choice | Boundary / reversal |
|---|---|---|
| UI | Angular 22.1.7, Angular Material 22.1.7, accepted MD3 tokens and catalog patterns | Reuse the accepted D-01F/D-01E sources; do not carry synthetic BorrowBox state into production records |
| Workshop | Storybook 10.6 with explicit stories and docgen disabled | Retain the tested fallback; recheck docgen before declaring the workshop stable |
| Runtime | One Node 24 process bound to `127.0.0.1` | Local deployment only; no claim about hosted topology |
| Data | SQLite behind a repository-owned storage module | Zero-service bootstrap and transactional relational proof; keep SQL/domain operations portable to PostgreSQL |
| Access | Generated owner key, scrypt digest at rest, HttpOnly same-site session cookie, loopback binding | Proves a bounded local access check; not an internet-facing identity design |
| Import | Markdown becomes immutable source revisions plus parsed metadata and typed link rows | Database is authoritative for new mutable portal records; changed files import as new revisions, never silent overwrites |
| Large artifacts | Repository paths only in this slice | Object storage remains deferred |

## Acceptance checks

1. An unauthenticated API request is rejected and login establishes a bounded owner session.
2. The app imports the repository Markdown corpus twice without duplicating documents or identical revisions.
3. A changed fixture imports as a new immutable revision in an isolated test database.
4. Records, links, current revisions, import runs, and owner requests survive a server restart.
5. The UI exposes Aludel project, knowledge records, text search, source metadata, resolved/unresolved links, and the latest import report using the accepted visual language.
6. Build, typecheck, source stories, accessibility checks, and an owner-entry browser smoke pass are recorded against exact source hashes.

## Explicit exclusions

- No hosted preview, external database, OAuth provider, Linear/Symphony connection, agent run, release, or spend.
- No claim that imported Markdown sections have all been normalized into final domain entities. The first cut establishes durable source/revision/link identity and makes migration gaps visible.
- No B-02 decision/dependency editing or B-03 candidate review behavior beyond the shared component boundary.

## Stop condition

Stop this slice when the local application and evidence pass the checks above. Any requirement for external access or a materially different identity model returns to a scoped architecture and authorization decision.
