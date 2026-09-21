---
id: evidence-b-01
kind: implementation-evidence
status: passed-local-scope
updated: 2026-09-20
packet: B-01
---

# B-01 — local portal foundation and knowledge import

## Outcome

The first real application slice is runnable at `http://127.0.0.1:4310` through `./launch-machine`. It uses the owner-approved MD3/Angular foundation for Aludel itself, rather than the synthetic BorrowBox prototype. The portal now has a loopback-only API, SQLite persistence, first-run owner setup, project scope, durable owner requests, source record/revision/link tables, idempotent Markdown import, search, record details, and an import report.

The local-only M0 waiver and implementation boundary are recorded in the [B-01 intake](../design/process/b-01-intake.md). No external account, service, deployment, purchase, worker, tracker, or release was created.

## Observed evidence

| Claim | Check and result |
|---|---|
| Private local access boundary | An unauthenticated `GET /api/overview` returned HTTP 401. Fresh first-run setup accepted an owner-chosen key of 12+ characters, stored a scrypt digest, issued an HttpOnly `SameSite=Strict` session, and did not print or persist the key. Normal login passed after process restart. The server binds to `127.0.0.1`. This is not an internet-facing identity proof. |
| Corpus import | A clean real-corpus import created 67 documents and 67 revisions. The next imports checked the same 67 documents with 0 new revisions and 67 unchanged. At that tested revision, 435 local relationships resolved or pointed to existing repository assets and 0 were missing. Documentation changes after the run may change these counts on the next automatic import. |
| Revision semantics | `npm run test:server` imports two isolated fixtures, repeats the import without duplicates, changes one source, and observes exactly one new immutable revision while retaining the prior revision. Result: 1 test passed, 0 failed. |
| Restart persistence | After stopping and restarting the Node process, the authenticated test setup, 67 source records, import history, and a durable owner-request fixture remained available. |
| UI and access flow | Browser smoke walked first-run setup/login → Overview → Knowledge search → Architecture detail, checked structured metadata/relationships, and repeated normal login after restart. Chromium completed without page errors. |
| Responsive/accessibility | axe returned no WCAG 2 A/AA/2.1 AA violations for the checked record-detail document. The 390×844 Overview had no horizontal overflow. Screenshots are local test output under `apps/portal/test-results/` and are intentionally ignored rather than made durable product artifacts. |
| Component workshop | `npm run build-storybook` built the explicit populated and empty knowledge-list stories under the already accepted docgen-off fallback. No Storybook MCP or automatic doc extraction is claimed. |
| Build integrity | `npm run typecheck`, `npm run build`, and `npm run build-storybook` passed with Angular 22.1.7 / Material 22.1.7 / Storybook 10.6.0 on Node 24.15.0. The production build uses the 6.08 kB project icon subset. The 577 kB application chunk warning remains a later performance/code-splitting task, not a failed local-foundation gate. |

Representative final source digests:

- `src/app.ts`: `bf3be6b141e616b1e764811704c88760f8e0ca5244651839ef20b24cafd926ff`
- `src/app.html`: `c141ee539f116ee3ba5289bc85ba7f4084ebadffb8ce1282a776b77f6b8912c5`
- `server/importer.mjs`: `c8e55eb3875654f905aa5d3239ef4ba37f54fe6c5cd2214e5c1bedafbfd277cd`
- `server/storage.mjs`: `35170591bfcdf8106a75bc52e45b625f8b08205104f871343bce46fa980af7ed`
- `server/server.mjs`: `be59b2f7fb7bbe4e6010c9c4bc1067775bd897dad6cc25a434a1e49861061d9e`

These hashes identify the typechecked, built, and browser-exercised source. The workspace still has no usable Git history.

## Authority and limitations

SQLite is the selected zero-service local adapter, not a reversal of the PostgreSQL hosted direction. Domain storage is isolated behind the server modules and uses relational constraints so a later adapter can retain record identities. Markdown is still authoritative for repository-owned policy/code-adjacent sources. Imported source revisions are evidence; new mutable owner requests are database-authoritative. Normalizing decisions, dependencies, tasks, reviews, and acceptance into their final domain tables remains B-02/B-03 work.

The shell is private only at the approved local boundary. It has no TLS, multi-user identity, remote access, secret store, backup/restore proof, concurrent-writer load proof, or hosted persistence. The absence of unresolved links in this import does not establish semantic normalization of every document section.

## Mandatory retrospective

1. **Avoidable friction observed.** The prototype was useful as a visual/component source but carried synthetic state, obsolete build inputs, and an accidental full 5 MB icon-font reference. The mounted filesystem and Node-version mismatch made cold builds slow. The initial generated-key approach would have exposed a credential in terminal output; the repository safety rule caught that before handoff. A narrow record status also caused horizontal overflow despite the inherited prototype passing at the same viewport.
2. **Applied improvement.** The [intake](../design/process/b-01-intake.md) now fixes the runtime/data/access/import boundary before implementation. The app uses owner-chosen first-run setup with digest-only storage, a 6.08 kB icon subset, an isolated importer test, exact API access checks, restart verification, and an owner-entry browser path. These checks caught the secret-output design, asset regression, and overflow in this task. Broader prevention remains unproven.
3. **Plan impact.** B-01 is complete for the local foundation. Angular Material and explicit Storybook stories move from design trials to adopted portal implementation choices; SQLite proves the local relational boundary while PostgreSQL remains the hosted target. B-02 can now normalize proposals/decisions/dependencies and turn saved requests into versioned records. B-03 retains hosted preview, provider cost, Q-002/Q-005/Q-008, and checklist migration gates.
4. **Questions changed.** The local stack/data/access questions are resolved for this slice. No question about external identity, deployment, provider spend, exact Go authorization, review sufficiency, or ambiguous external effects is resolved.
5. **Process evidence and limits.** A written readiness boundary plus executable acceptance checks prevented the prototype from becoming the database model by accident and exposed integration defects before handoff. It does not prove that the same intake is sufficient for hosted deployment or B-03 external effects.

## Next action

**B-02 — proposals, decisions, and dependencies.** Define its exact schema/migration and UI acceptance from the now-running foundation, then implement versioned records and dependency-specific staleness. Stop before execution/tracker/preview effects reserved for B-03.
