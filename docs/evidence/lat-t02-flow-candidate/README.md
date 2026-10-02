# Pages semantic flow candidate — 2026-09-30

## Authorization and process

The owner asked to continue the Pages-first DEC-056 transition. The root [conversion work record](../../../../docs/design/layer-app-transition/layer-template-conversion.md) scopes this to local source, candidate validation and tests. Earlier work showed the `pages.flows` Work adapter rejects an existing-flow target and inserts only new flows. This pass establishes the source-owned semantic rule before package server execution or data cutover.

## Observed result

- The Pages source repository at `e88409c78e790e8d4fdccc2ef4db043b6d3c39d3` declares `server/flow-change.mjs` as a versioned pure flow-revision candidate in `layer.json`. It hashes a semantic candidate against project, installed instance, Work ID, Pages source commit, flow ID/base revision and exact referenced page/story revisions. The hash detects changed candidate content; the host still needs to persist and pin the exact digest before review.
- The pure review returns Previous/Proposed data while preserving the flow ID and unrelated review fields. It rejects changed flow/page/story revisions, changed source commit, a foreign same-template instance, tampering, no-op edits and unsupported v1 steps. Version 1 covers existing-page steps; missing-page gaps and persona-specific steps remain a later schema/adapter task.
- The isolated portal candidate pins that commit for fresh Pages installs. Package loading checks the declared server source path, committed existence and size without importing or executing it. Existing installed project copies retain their accepted commit until a reviewed repin.
- Pages repository tests: **4/4 passed** (three semantic cases and portable export). Portal server suite: **170/170 passed**. Portal `npm run typecheck`: passed with existing optional-chain warnings. Both repositories passed `git diff --check`.

## Retrospective and next gate

**Friction:** the first candidate step shape omitted fields that the current typed flow validator normalizes. Matching those fields exposed a narrower honest v1 boundary: page-backed steps work; gap/persona steps need an expanded source-owned schema and same-fixture check. The package loader previously validated only Knowledge/UI paths, so this pass added a committed server-source declaration check without giving it runtime authority.

**Process change tested:** define a source-owned, pure semantic candidate and negative conflict fixtures before connecting it to Work or executing repository server code. The tests establish deterministic proposal/review behavior and package pin validation. They do not establish validator parity on original data, safe server SDK execution, native review, signed acceptance or a per-project SQLite transaction.

**Roadmap effect:** next build a checked, isolated package server adapter with the host's scoped output SDK; compare it with the current Pages validator on identical flows, including gaps/personas. Then wire a dedicated revise-flow Work action through Go, native Previous/Proposed review, stale rejection and atomic accepted revision/Work verdict. The current `pages.flows` adapter remains create-only. Source-only documentation and mixed source/data tasks, duplicate-template installs, portable project database restore and LAT-08's owner/original-data gates remain open.
