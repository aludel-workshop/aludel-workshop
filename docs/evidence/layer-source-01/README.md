# Agents edit their layer's repository (LAYER-SOURCE-01) — 2026-09-30

## Authorization and readiness

The owner asked to "set up repo edits" after PAGES-API-01. The scope is recorded in the root [LAYER-SCOPED-WORK-01 record](../../../../docs/design/layer-scoped-work/work-record.md#layer-source-01-agents-edit-their-layers-repository-2026-09-30). It is limited to local work: the candidate and its local instance repositories. No push, provider turn or deployment.

Readiness: DEC-056 already requires layer source changes to be real Git commits, reviewed in Work and advancing the instance pin. Each installed instance has its own local clone, pinned by `layer_package_bindings.accepted_commit`, and the host reads it only at that commit.

## Observed implementation

- **Tool.** `aludel_layer_source` (worker route `attempts/:id/layer-source`) lists, reads, writes and deletes files against the pinned commit plus the run's draft (`layer_source_drafts`).
  - Writable: `knowledge/*.md`, `docs/*.md`, `README.md`, `AGENTS.md`, `fixtures/*`, `api/*.json`, `server/*.mjs`, `ui/*.ts|scss`, `tests/*.test.mjs`, `layer.json`.
  - Refused: `.git`, `..`, absolute paths, files over 200 KB, and more than 40 files per run.
- **Submission.**
  - The host writes one commit with Git plumbing in a temporary index. The checkout and the pin are untouched.
  - The commit's parent is the pinned commit, and it is kept at `refs/aludel/candidates/<attempt>`.
  - The commit must be a valid layer package, and its API document must compile (parse and `ajv`, no code executed).
  - Per-file diffs are stored with the proposal.
- **Review** shows each file as a diff. Prose wraps; files needing owner review are marked "Changes what this layer runs or may do".
- **Acceptance**, in the same transaction as any staged data changes:
  - Data applies first, under the rules it was checked with.
  - Then the source must still sit on the reviewed base, and the candidate ref must match.
  - Changes to `server/`, `ui/`, `api/`, `tests/` or `layer.json` require the **project owner**. Their `server/*.mjs` digests are recorded in `layer_source_reviews`.
  - The new handler and schemas must re-normalize every existing record of the layer. For example, a label limit of 3 is refused, naming the page it would reject.
  - Then the pin moves. After commit, the instance checkout and `refs/aludel/accepted` follow the pin.
- **Handler review is now by source digest**, from the host list or owner acceptance, instead of by commit. A doc-only commit keeps its reviewed API handler and flow rule, and an unreviewed handler never runs.
- The task card explains the tool, the writable paths and the owner rule.

## Checks

- Portal server suite **184/184** (3 new):
  - A Knowledge edit plus a new file: the listing flags, path, size and name refusals, read-back of staged content, submission not moving the pin, the retained ref and parent, the review diff, acceptance by an elevated member moving the pin and checkout, and the API still working.
  - A handler change: the elevated member is refused and the owner accepts, recording the review, after which the new handler runs. A schema change that would reject existing pages is refused and the pin stays.
  - An invalid manifest and a wrong-version API document refused at submit.
- Typecheck, build and `git diff --check` passed.
- Browser journey `tests/layer-scope-browser.mjs` passed. It now also stages a Knowledge edit, shows its diff in review with no owner mark (screenshot inspected; prose wrap added afterwards), and confirms that acceptance moved the pin to a commit containing the edit.
- `tools/browser-checks.sh layer-bar` passed with and without the Pages template.

## Limits

- `aludel_layer_source` is not compiled or run in Symphony (no Elixir toolchain), and no live agent has used it.
- A `ui/` change is pinned but not shown: the candidate portal still builds Pages UI from the template pin. Per-project UI loading remains open.
- Template tests in `tests/` are committed but not run by the host. Running unreviewed tests would execute unreviewed code.
- Accepted commits stay local to the instance repository. Nothing pushes them, and upstream template updates are not merged.
- People cannot yet edit layer repository files from the UI.
- Only owner review records handler digests. There is no revoke.
- Candidate refs accumulate by design (DEC-056 retrievability) and are never pruned.

## Retrospective

1. **Harder than necessary:** handler review was keyed by commit, so any doc edit would have silently disabled the Pages API and flow runner. Keying by digest fixed both. `commit` as a bare SQL alias failed at runtime, not at syntax check.
2. **Easier next time:** the source path, the API path and the data path now share one run lifecycle: stage, submit, review, accept in one transaction. A Code or Deploy conversion can add its staging kind to the same lifecycle.
3. **Roadmap effect:** DEC-056's mixed source-plus-data task now exists for Pages. Per-project UI loading becomes the gate for `ui/` changes to matter. Upstream template updates need a merge story before instances diverge far.
4. **Questions:** Should the owner be able to delegate code review to an elevated person per layer? How should template updates reach instances that have local commits: merge, rebase, or a Work task? Should the host run a layer's own `tests/` after owner acceptance, in the limited runner?
5. **Process change:** the "no unreviewed code runs" rule is now enforced by digest across every host path that executes layer source, and tested by the handler-change test. Whether owners will review diffs of handler code carefully is an assumption about people, not something the system checks.
