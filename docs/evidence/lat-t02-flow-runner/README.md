# Pages reviewed-source runner proof — 2026-09-30

## Authorization and readiness

The owner asked to continue the Pages-first DEC-056 work. The [root work record](../../../../docs/design/layer-app-transition/layer-template-conversion.md) scopes this to local, disposable runtime and parity proof. The Pages semantic rule and installed repository pin already existed. This pass does not connect the runner to Work Go, review or accepted output writes.

## Observed result

- `apps/portal/server/pages-flow-runner.mjs` loads the exact installed Pages commit and declaration, derives the immutable instance ID from the host database, rejects caller-supplied mismatched project/instance/source pins and checks the committed source against the separately reviewed SHA-256 digest before execution. An unreviewed new commit is rejected, even when the installed binding is changed to name it.
- The reviewed module runs in a separate Node process with the local permission mode, no granted file or subprocess access, a 64 MB V8 heap limit, 2 second timeout, and bounded input/output. Disposable probes confirm file read, file write and subprocess denial. The child receives JSON and returns JSON; it has no database handle. This is a narrow local proof for this reviewed digest. Node's permission mode does not establish network isolation, so arbitrary package server code is still not admitted.
- On a real disposable Pages flow and two current pages, proposal and repeated Previous/Proposed review preserved flow identity and review fields. The returned `after` data exactly matched the current host validator's stored normalized JSON when the test explicitly called the host update. The runner's review made no database write. A stale flow revision, stale page revision, foreign Pages instance, mismatched source pin and tampered candidate were denied. The fixture covers page-backed steps; gap/persona and original owner data parity remain open.
- Focused runner tests passed **2/2** after the final denied-write, source-pin and unreviewed-commit fixtures. The final portal server suite passed **172/172** with those fixtures included; typecheck passed with existing optional-chain warnings. `git diff --check` passed.

## Retrospective and next gate

**Friction:** the host flow validator requires a catalog icon on page fixtures, and the candidate package test setup is distinct from output-scoping setup. The first parity attempt failed at that prerequisite; adding the required icon made the identical fixture pass. A test-path mistake in the first full-suite command prevented the denied-write probe from being added at that moment; the focused rerun included it and passed.

**Process change applied and tested:** allow repository server execution only after a separate host-reviewed source digest, exact installed commit/instance verification and a process limit, then compare the returned data with the current writer on the same fixture. The local tests show this catches a changed committed source and produces compatible page-backed flow data. General server SDK safety, network isolation, gap/persona parity and original-data behavior remain hypotheses; do not infer those from this proof.

**Roadmap effect and questions:** next design the general checked scoped SDK and a real isolation boundary, then expand the Pages semantic rule to current flow shapes and wire a dedicated revise-flow Work action through Go, native review, stale rejection and atomic acceptance. Decide the trusted-source review/repin mechanism before admitting owner-edited source. Per-project SQLite, duplicate Pages instances, export/restore, mixed source/data acceptance and LAT-08's owner browser/original-data gates remain open. No decision in this slice blocks the current local proof; `next_action` remains LAT-08.
