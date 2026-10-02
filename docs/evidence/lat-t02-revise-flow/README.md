# Pages revise-existing flow through Work — 2026-09-30

## Authorization and readiness

The owner explicitly asked to work up revise-existing and confirmed that a Vision story must not be required. The [root conversion record](../../../../docs/design/layer-app-transition/layer-template-conversion.md) authorized this isolated local implementation. Before editing, the create-only `pages.flows` action rejected a flow target and inserted a new flow. The Pages source already had a reviewed semantic flow rule and a page/gap/persona parity fixture. This work extended the existing action with an explicit flow-target mode; create mode remains available with no story target.

## Observed implementation

- The Work composer offers existing flows as targets and treats an agent's `pages.flows` request as runnable with either no target, one optional story, or one flow. Flow-only staging requires an installed reviewed Pages package. A Vision story is not required at Go, proposal, review or acceptance.
- At Go, the host reads the exact flow and its current page, persona, activity and story references under project/instance scope. It pins their revisions and the accepted Pages source commit into the task bundle. Newly proposed references are read from current scoped host records at submission. The agent must cite the target flow and every referenced record revision in `usedInputs`; it does not supply trusted record bodies or revision authority.
- Submission runs the reviewed source-owned rule in the limited child runner. It stores its digest-bound semantic change and Previous/Proposed review in the Work proposal without changing Pages output. The existing native review surface shows both complete flow states and the expected revision. A reviewer can sign the same run; no provider turn was used in tests.
- Acceptance rechecks current target, used inputs, source pin, source-owned change digest and recomputed review, then updates the existing flow ID and its revision, proposal state and Work state in one SQLite transaction. The knowledge revision cites the Work item. A new worker over the same database returns the already accepted proposal without adding another revision. The existing Work signature is recorded immediately after the acceptance handler by the shared review path; it is not part of that SQLite transaction.
- Disposable fixtures cover the story-free path with Vision disabled, no output write before sign-off, one accepted revision, repeated acceptance, missing input citations, changed source pin, foreign instance, stale page and stale persona. Rejected acceptance leaves the flow revision unchanged, proposal submitted and Work in review. The unchanged create-flow cases continue to pass.

## Checks and limits

- Pages source repository tests: **5/5 passed** at `ae93312c96299c3b855024911f33362ab5cfecb9`.
- Focused Work proposal tests: **22/22 passed**. Full portal server suite: **176/176 passed on final rerun**. Typecheck and production build passed with the existing optional-chain/chunk-size warnings. `git diff --check` passed.
- One earlier full-suite run had an intermittent `work-runs.test.mjs` relaunch failure (`issue` undefined). That same file passed **10/10** alone, and the complete suite passed **176/176** on rerun. The failure was not reproduced or assigned a cause; no claim of permanent flake resolution is made.
- The acceptance transaction still uses the shared portal SQLite file. It proves local atomic output revision, proposal state and Work state for this path, not DEC-056's per-project database authority. The shared review path writes its signature after that transaction, so crash recovery across that gap remains to be proved. General package server isolation, original owner-data migration, duplicate same-template instances, independent export/restore and live browser review remain open.

## Retrospective and next gate

**Friction:** the agent action, Go bundle, worker submission, acceptance, Work review projection and Work composer each encoded a piece of the create-only assumption. A server-only change would have left the flow impossible to select and the reviewer without a before/after view. Diff review also caught and removed an accidental change to the unrelated report-input validator before the full suite.

**Process change applied and tested:** trace the action across composer → stage → Go → proposal → native review → signed acceptance, with one story-free success fixture and negative stale/source/instance fixtures before closeout. The test caught the missing package preflight and confirmed the create path remained intact. The full suite, typecheck and build exercised that change; a browser screenshot and original-data journey have not yet tested the visual layout or migration.

**Roadmap effect and questions:** this removes the existing-flow capability gap locally, but Pages-specific Work branches remain compiled into the host. A general layer adapter/SDK still needs to register semantic commands and derive current references without `pages` switches. Before production cutover, decide how to make the shared reviewer signature durable with the accepted output transaction, prove per-project SQLite restore, and run the original-data and browser gates. LAT-08 remains the one `next_action` pending its separate owner/original-data review.
