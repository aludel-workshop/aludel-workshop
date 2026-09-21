---
id: retrospective-r-05
kind: packet-retrospective
status: complete
packet: R-05
date: 2026-09-19
---

# R-05 retrospective

## Verdict

The technical packet passed, but its original closeout was incomplete. It
included a short process-outcome section and updated architecture/status, yet
did not perform the owner's required post-hoc: it did not explicitly identify
avoidable friction, change downstream work packets, or add the questions the
result made important. R-05 remains technically complete; this retrospective
corrects its process closure.

## What made the work harder than necessary

1. The packet listed scenarios but the work did not begin with a claim-to-test
   matrix. The first harness passed eight scenarios before review revealed that
   a provider conflict and an unknowable external-effect outcome are different.
   A ninth ambiguity scenario was then added. The correction improved the
   result, but the rework was avoidable.
2. “Record the process outcome” existed in guidance, but it behaved as a report
   field rather than a completion gate. That allowed the task evidence to be
   finished before its implications were propagated.
3. The fake provider made safe reconciliation easy. Without an explicit
   fake-versus-real assumption check, it would be easy for R-04B or B-03 to
   inherit idempotency and lookup behavior that a real provider does not offer.
4. The verifier initially checked scenario outcomes but not all cross-cutting
   invariants. A final pass added monotonic event sequences, unique operation
   keys, authorization/revision binding, released terminal leases, and
   no-redispatch checks. Those assertions should have been derived before
   implementation from the protocol claims.

The absence of Git metadata added manual artifact hashing, but did not materially
block the spike. A new manifest tool is not justified from this one occurrence.

## What would make equivalent work easier

Before implementing any workflow with an external effect, create a compact
boundary matrix with these columns:

| Question | Required evidence |
|---|---|
| What durable state exists before the call? | Record and committed revision/authorization |
| What identifies the intended effect across attempts? | Stable operation/idempotency key |
| Can the provider find the result after a lost response? | Documented or observed lookup behavior |
| What happens before call, after call, and after local persistence? | Named failpoints and expected transitions |
| What proves no duplicate occurred? | Provider resource count/identity plus call history |
| What if lookup is unavailable or contradictory? | Visible blocked state and no automatic replay |
| Where can cancellation still prevent the effect? | Tested cancellation boundary |
| What requires owner judgment? | Explicit resolution choices and evidence, not a generic retry |

Then derive machine assertions for both positive outcomes and prohibited
outcomes. This is now encoded in the universal packet closeout and expanded
work-record prompts; the external-effect questions are carried into R-04A and
R-04B.

## What R-05 changes in the overall plan

- **R-04A:** provider comparison now includes idempotency, lookup after an
  interrupted create, unknown outcomes, conflicts, and orphan cleanup. A cheap
  preview host that cannot be reconciled safely may be a fallback but should
  not silently become the automated path.
- **R-04B:** the real preview proof must exercise the safest available repeated
  or interrupted operation and show whether it finds the same deployment. If a
  safe test is impossible, it must block the ambiguity rather than risk a
  duplicate external resource.
- **B-03:** implementation must use transactional claim/operation constraints
  and include an owner-visible, audited reconciliation path. R-05's JSON atomic
  rename is evidence for record semantics only.
- **M0 gate:** R-05 still passes the recovery-model gate, but it does not pass
  the real preview-provider recovery or database-concurrency checks. Those stay
  with R-04B and B-03 respectively.
- **ADR-008/ADR-006:** the results support portal-owned durable state and
  deferring a heavier workflow engine at concurrency one. Recheck after real
  Linear/preview integration or concurrent claim evidence; the fake harness is
  not grounds for a stronger architecture commitment.

## Questions we should now ask

### For every external-effect integration

1. Does the provider accept our stable key, expose its own stable resource ID,
   or support authoritative lookup by build/client identity?
2. Which response-loss windows can be reconciled automatically, and which are
   genuinely ambiguous?
3. What evidence distinguishes “nothing happened,” “the effect exists,” and
   “the provider cannot currently tell us”?
4. What named state should the owner see, and which new work must stop while it
   remains unresolved?
5. Are attach-existing, abandon, cancel, clean up, and retry distinct audited
   operations? Which require fresh authorization?
6. What proves that cancellation prevented the effect rather than merely
   stopping local observation?
7. How are orphaned external resources discovered and bounded under free-tier
   quotas?

### Owner question created

Q-008 is added to the decision register: when an external effect conflicts or
cannot be determined, which resolution actions may the owner take and what
evidence must each require? The proposed starting point is to show provider
evidence and make attach-existing, abandon, or explicit retry separate audited
operations. This blocks the detailed B-03 reconciliation interaction, not
R-04A research.

## Process change and proof status

Applied now:

- `AGENTS.md` makes retrospective evidence and downstream propagation a packet
  completion condition.
- The execution plan adds a universal closeout rule and carries R-05 learning
  into R-04A, R-04B and B-03.
- The work-record template asks explicitly about friction, ease, plan changes,
  questions and proof status.
- The operating procedure distinguishes an applied improvement from a future
  validation claim.

Observed proof: the post-hoc found one missed conceptual distinction in the
original technical pass and four downstream plan/question changes that the
initial closeout omitted. That demonstrates value for R-05 correction.

Still hypothetical: the new completion gate has not yet guided a packet from
start to finish. R-04A is the next live trial. Its closeout must show whether
the retrospective was performed before completion, whether it changed R-04B,
and whether the extra discipline remained proportional.

