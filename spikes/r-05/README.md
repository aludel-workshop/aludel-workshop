# R-05 durable coordination spike

This disposable Node.js harness tests the recovery contract without accounts,
credentials, network access, or production resources. It deliberately separates
the portal store from a fake provider store so a worker can die between the two
durability boundaries.

Run:

```sh
node spikes/r-05/verify.mjs
```

The verifier starts real worker subprocesses, terminates them at named
failpoints with exit code 86, advances time beyond the persisted lease, and
starts a new worker. It asserts terminal states, event history, and provider
resource counts. It also disables provider lookup after a committed but
unrecorded effect and verifies that recovery blocks without replaying the write.

## Records represented

- `task`: product state and immutable input revision used by an attempt.
- `authorization`: owner, authorized task revision, and bounded scope.
- `connectorOperation`: stable operation key, provider resource identity,
  observed provider version, and pending/applied/conflict/failed state.
- `job`: coordination state and durable cancellation intent.
- `attempt`: one worker execution, input revision, and terminal outcome.
- `lease`: worker ownership and expiry, distinct from attempt state.
- `event`: job-local monotonic sequence and typed payload.

JSON files are written through a temporary file and atomic rename. That is
adequate for this single-worker crash experiment, not a substitute for the
transactional database and atomic claim required by M1.

## Recovery rule under test

On an expired lease, interrupt the prior attempt, create a new attempt, and
reconcile every pending provider operation by its stable operation key before
issuing a write. A known conflict blocks. A known failure fails. Uncertain or
unreconcilable state must block in a production adapter; this harness does not
pretend to provide universal exactly-once delivery.
