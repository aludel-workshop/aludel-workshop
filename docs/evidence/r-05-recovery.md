---
id: evidence-r-05
kind: feasibility-evidence
status: complete
packet: R-05
tested: 2026-09-19
---

# R-05 durable coordination and recovery spike

## Result

The minimal persisted-job design survived worker termination at the tested
mapping and external-effect boundaries without losing durable intent or
creating a duplicate provider resource. Nine deterministic scenarios passed.
Cancellation and a provider-version conflict stopped before the external
effect. A known provider failure became terminal without an automatic retry.
When a committed effect could no longer be looked up after a crash, recovery
surfaced `reconciliation_required` and did not repeat the write.

This passes R-05 for a single-worker fake-provider experiment. It does not
prove the real Linear, Symphony, Codex, database, or preview integrations.

## Scope and process outcome

The packet's fake-service path was used, so no account, credential, network,
deployment, or production resource was involved. The existing R-05 packet and
architecture supplied adequate scope and prerequisites.

The reusable improvement was to encode every required crash boundary as a real
subprocess failpoint and assert both terminal records and provider resource
counts. The first pass covered eight known outcomes; an evidence review exposed
that provider conflict was not the same as an unknowable side-effect outcome.
The added ninth scenario disables effect lookup after the effect exists and
machine-checks that recovery blocks without replay. Its usefulness is therefore
observed in this packet, although reuse on a second integration remains
unproven.

## Records and ownership exercised

| Record | Fields material to this spike | Recovery responsibility |
|---|---|---|
| Task | ID, input revision, product state | Remains distinct from connector/job state; successful build ends at `awaiting_review` |
| Authorization | task ID/revision, actor, bounded `build-test-preview` scope, state | Exists before dispatch and binds the attempted input revision |
| Connector operation | kind, stable operation key, pending/applied/conflict/reconciliation-required/failed state, provider ID/version | Reconcile by key before any repeated write |
| Job | task and authorization IDs, coordination state, durable cancellation intent | Owns execution eligibility and normalized terminal state |
| Attempt | job ID, ordinal, input revision, running/interrupted/terminal state | Each post-expiry recovery is a new attempt |
| Lease | job/attempt IDs, worker owner, expiry, active/expired/released state | Prevents another worker from acting until active ownership expires |
| Event | job ID, monotonic sequence, type, versionable payload | Preserves the observed lifecycle independently of worker memory |

The portal store and fake-provider store are separate JSON files. Portal writes
use temporary-file plus atomic rename. This models a crash between durability
domains; it is not a concurrency-safe replacement for M1's transactional
database and atomic job claim.

## State and reconciliation rules tested

1. Persist authorization and queued job before worker dispatch.
2. Persist attempt and lease before a provider operation.
3. Give mapping and effect operations stable keys independent of attempts.
4. On lease expiry, mark the prior attempt interrupted and create a new attempt.
5. Look up a pending operation by its stable key before creating anything.
6. Accept only the stored provider ID, version, and named state. A mismatch
   blocks as `connector_conflict`; no last-write-wins rule is used.
7. Honor durable cancellation after mapping and before the effect.
8. A known provider rejection fails the attempt and schedules no retry.
9. If lookup cannot establish whether an effect happened, block as
   `reconciliation_required` and do not issue another create call.

These observations support the state-and-recovery direction in
[architecture.md](../architecture.md), including separate task, connector,
attempt, and lease states. They do not establish universal exactly-once
delivery; safety depends on an idempotency key or authoritative lookup.

## Observed scenarios

Command, from repository root:

```sh
node spikes/r-05/verify.mjs --output=docs/evidence/r-05-scenarios.json
```

Environment: Node.js v18.19.1. Result: **9 passed, 0 failed**.

| Scenario | Observed terminal outcome | Provider resources/calls |
|---|---|---|
| Success | job `completed`; task `awaiting_review` | one mapping, one effect, one create call each |
| Crash before mapping call | expired lease; attempt 1 interrupted; attempt 2 completed | one mapping and one effect |
| Crash after mapping call, before portal persistence | provider mapping found by operation key; attempt 2 completed | mapping create remained one |
| Crash before effect call | persisted mapping retained; attempt 2 completed | effect create remained one |
| Crash after effect call, before portal persistence | existing effect found by operation key; attempt 2 completed | effect create remained one |
| Effect outcome cannot be looked up | job/task/attempt `blocked`; `reconciliation_required` | one existing effect and one create call; no replay |
| Cancellation after mapping | job/task/attempt `cancelled` | one mapping, zero effects |
| External mapping version/state conflict | job/task/attempt `blocked`; `connector_conflict` | one mapping, zero effects |
| Known provider failure | job/task/attempt `failed`; retry false | zero effects; no second attempt |

The complete machine-readable event and count summaries are in
[r-05-scenarios.json](r-05-scenarios.json). The disposable implementation and
reproduction instructions are in [spikes/r-05](../../spikes/r-05/README.md).

## Artifact identity

| Artifact | SHA-256 |
|---|---|
| `spikes/r-05/store.mjs` | `0583a70a7d7ccc3efb5b7baed6b4fdead8ff059fcd5ea94db116ee754c1dffe2` |
| `spikes/r-05/worker.mjs` | `26bd954d7d3d96e86fd7fe1b3fc104041b6af9f35b402cf41619c5825a8dc104` |
| `spikes/r-05/verify.mjs` | `382511ea3051ff5c98d36e7652e09356bc70b828ac80505fa9ff903d51d96aef` |
| `spikes/r-05/README.md` | `71e8ce06cc978e8cf1fc8e49ab78a1bcb655a1ffafbbf35b2bc80e1501ca127b` |
| `docs/evidence/r-05-scenarios.json` | `c51ffcb30cb0ba99736465bca63739b99bed44dbef0bcdf57aa7a820aa75cc43` |

This workspace has no Git metadata, so these hashes identify the tested local
artifacts.

## Limits and implementation consequences

- JSON atomic rename does not test database transactions, concurrent claims,
  isolation, or network partitions. B-03 must use transactional persistence and
  a uniqueness constraint on provider plus operation key.
- The fake provider has authoritative lookup and idempotent keys. R-04B and the
  real Linear/Symphony integration must verify their actual reconciliation
  surfaces rather than inherit this result.
- Cancellation was observed between mapping and effect. Active Codex process
  termination remains governed by R-03's parent-observed process-exit rule.
- Lease time was advanced deterministically rather than by a live heartbeat.
  Production timing, clock skew, lease renewal, and concurrent worker tests
  remain implementation checks.
- A blocked conflict or ambiguous outcome requires an explicit operator
  resolution operation; that UI and audit transition are not implemented here.
- Automatic retries and concurrency above one remain disabled until the real
  adapters preserve these invariants.

## Conclusion

R-05 is complete. The result retains ADR-008: use the portal-owned durable
records around the Symphony/Linear path rather than relying on Symphony's
in-memory scheduler state. The next routed packet is R-04A, the free preview
path comparison. R-04B remains the real-provider proof and requires separate
authorization before any external deployment.

The corrective [R-05 retrospective](r-05-retrospective.md) records avoidable
rework, plan changes, new questions, and the mandatory packet-closeout change.
