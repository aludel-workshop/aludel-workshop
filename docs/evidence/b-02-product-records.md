---
id: evidence-b-02
kind: implementation-evidence
status: passed-local-scope
updated: 2026-09-20
packet: B-02
---

# B-02 — proposals, decisions, and dependency currency

## Outcome

The authenticated local portal now owns native, versioned change proposals and consequential decisions. Saved owner requests can become proposal revision 1; edits append immutable proposal revisions. Decision answers append immutable revisions and transactionally mark only explicitly linked downstream records stale when their consumed decision revision no longer matches. Reassessment is a separate operation that records the current input revision and never starts execution.

The implementation follows the [B-02 intake](../design/process/b-02-intake.md) and stops before B-03 task authorization, tracker, runner, artifact, preview, review, or release effects.

## Observed evidence

| Claim | Check and result |
|---|---|
| Proposal versioning | Browser flow saved a real owner request, created a linked draft proposal, added an acceptance example, and observed proposal revision 2 while retaining revision 1. Domain test independently confirmed two immutable revisions and source-request status `proposed`. |
| Decision revisioning and conflict safety | Browser flow loaded decision revision 1, created revision 2 through a concurrent authenticated API call, then attempted to save the stale UI draft. HTTP 409 surfaced “changed to revision 2”; the selected answer and rationale remained in the form. After explicit refresh, saving produced revision 3. Expected conflicts no longer emit server error stacks. |
| Dependency-specific staleness | The decision is linked only to `PLAN-B02`. A changed answer made `PLAN-B02` stale with its revision mismatch named. `PLAN-B03` remained current. Both domain and browser checks assert this contrast. |
| Explicit reassessment | Reassessing `PLAN-B02` bound it to decision revision 3, advanced the plan to revision 2, restored currency to current, and stated that no execution started. |
| Restart persistence | After process restart, the test database retained a request-linked proposal at revision 2, the decision at revision 3, `PLAN-B02` current at revision 2, and unrelated `PLAN-B03` current at revision 1. |
| UI behavior | Browser smoke exercised setup/login → request → proposal → proposal revision → decision → conflict/reload/save → stale Work → reassess. No URL/storage injection was used for the owner path. |
| Responsive/accessibility | The 390×844 Overview has no document overflow and uses a legible two-row navigation rather than clipping the sixth destination. axe returned no scoped WCAG 2 A/AA/2.1 AA violations on the checked Work state. |
| Component workshop | Storybook builds populated/empty knowledge states and current/stale dependency states from source stories. Automatic docgen remains disabled under the accepted fallback. |
| Automated checks | `npm run test:server`: 2 files passed, 0 failed. `npm run typecheck`, `npm run build`, and `npm run build-storybook` passed. The app chunk is about 592 kB before gzip; code splitting remains a known performance follow-up. |

Representative final source digests:

- `src/app.ts`: `5de5d9f5d0d0f15788d5ee6d9aecc01dd176cfe0d259ac9f42d82be34b462563`
- `src/app.html`: `1754c04bd38b6c4396fc0494b6bcda3d1958c71cf66253a4f7b0623116e3d653`
- `src/components.ts`: `269efdf7af0fdf7e89725bbf0be54c3d52196d993e05fd1df45059bbb08113de`
- `server/product-records.mjs`: `9cd46a0f36ce4f1fabb8aac6b51fe95518c79a56b13095deec97eb5d24175991`
- `tests/product-records.test.mjs`: `db22d36a13d1b230bab3da599ebd0c7be3cbd4325b15344bfaacac6b1a109305`

The repository source is authoritative; this workspace still has no usable Git history.

## Limitations

- The representative B-02 records are idempotent startup fixtures used to exercise the real domain behavior. They are not an owner answer to Q-002, Q-005, or Q-008.
- Dependencies currently target plan/build records. B-03 must bind executable task revisions, attempts, artifacts, and review acceptance through their own contracts rather than overloading these rows.
- Proposal/decision creation policy is intentionally narrow. There is no deletion, supersession UI, multi-user authorship, generic graph editor, semantic retrieval, or external synchronization.
- Reassessment records currency, not correctness or approval. It does not silently update proposal intent, create a task, or authorize a run.

## Mandatory retrospective

1. **Avoidable friction observed.** B-01 had structured source records but no migration/version convention for native product records, so B-02 could have turned into page-local state. The first narrow navigation treatment clipped the Reviews destination. Expected optimistic-concurrency conflicts also printed noisy server stacks even though they were valid domain outcomes.
2. **Applied improvement.** The intake now requires exact consumed-revision bindings and an unrelated-control record in every staleness test. Domain operations own transactions and conflict checks; the UI consumes them. A current/stale component story, real owner-entry browser path, two-row narrow navigation, and expected-error logging rule were exercised in the final checks.
3. **Plan impact.** B-02 completes the structured proposal/decision/dependency foundation. B-03 can consume exact proposal and decision revisions rather than inventing run-local inputs. It must add migrations suitable for task/attempt/operation constraints instead of extending generic downstream rows indefinitely.
4. **Questions changed.** The mechanics of versioning, conflicts, and dependency-specific staleness are resolved for the local portal. Q-002 now becomes the immediate blocker: the exact effect boundary of one Go action must be chosen before executable task schema/UI. Q-005 and Q-008 remain required before preview/reconciliation acceptance.
5. **Process evidence and limits.** The unrelated-control assertion caught the difference between “the linked plan became stale” and “all work became stale.” Browser conflict injection proved the retained-draft interaction against a real concurrent revision. This supports the process for local product records, not distributed provider conflicts or multi-writer load.

## Next action

**B-03 groundwork:** resolve Q-002 first. Proposed boundary: Go authorizes one named task revision to build, test, and produce a local preview; it stops for consequential input, does not accept the candidate, and never authorizes production release. Then resolve Q-005 and Q-008 before external preview/provider effects.
