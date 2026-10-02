# Pages flow-shape parity and reviewed repin — 2026-09-30

## Authorization and readiness

The owner continued the Pages-first DEC-056 transition. The [root conversion record](../../../../docs/design/layer-app-transition/layer-template-conversion.md) authorizes a bounded local source/runner parity slice on disposable records. The prior runner proved only a page-backed step. Inspection of the current host validator identified supported zero to forty steps, optional step names, page gaps, step persona references and existing flow activity/persona references. No Work Go or accepted-output path was changed.

## Observed result

- Pages source commit `7b18537648f872f3309b6d1dd2d3fca65d38d8c1` extends the pure semantic rule to those shapes. It pins exact revisions for referenced activity, persona, page and story records, preserves the flow ID and unrelated review data, and rejects stale, foreign, missing or malformed references. Source tests passed **5/5**, including portable export.
- The portal candidate now pins that exact template commit for new installs and maps it to a separately reviewed source digest. The prior accepted commit/digest pair remains allowed for already installed copies. A disposable test confirmed both pins work and a newly committed but unreviewed source is rejected. The source remains restricted to the existing local runner; this does not establish general package isolation.
- A disposable portal fixture used actual Pages pages/flow and Vision persona/activity records. The reviewed candidate covered a page-backed revision, then a no-page gap with a persona and an omitted step name. Each returned `after` object exactly matched the stored JSON after an explicit call to the current host validator. Review itself left the output revision unchanged. Stale flow/page/persona, wrong instance/source and changed source fixtures were denied. The new source alone also passed zero-step and over-forty-step cases.
- Final portal server suite: **172/172 passed**. Typecheck passed with existing optional-chain warnings. Both repositories passed `git diff --check`.

## Retrospective and next gate

**Friction:** extending the source rule changed its digest, while project installs retain their accepted commit. A single digest would have broken the previously reviewed runner for old installs. The explicit commit-to-digest table and legacy-pin fixture resolved that compatibility issue before Work integration. The first source test failure was an obsolete assertion that gaps must be denied; replacing it with positive gap/persona and negative stale-reference cases tested the actual target behavior.

**Process change applied and tested:** derive a parity matrix from the current writer, then advance source commit, host-reviewed digest and new-install pin together while retaining older reviewed pins. Source tests and the disposable host comparison demonstrate the matrix for normalized valid flows with page-backed and gap/persona steps. Malformed legacy inputs and every possible review-note shape were not compared; full original-data parity remains unproven.

**Roadmap effect and questions:** before connecting Work, the host must gather current referenced records and their revisions itself; caller-supplied reference snapshots are only proof inputs today. A dedicated revise-flow action still needs Go pinning, native Previous/Proposed review, stale rejection and an atomic output/Work transaction. General code isolation, source repin/rollback review, per-project SQLite, duplicate Pages instances, export/restore and LAT-08's owner browser/original-data gates remain open. `next_action` stays LAT-08.
