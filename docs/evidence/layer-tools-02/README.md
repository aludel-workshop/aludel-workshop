# LAYER-TOOLS-02: layer submissions as review items, proven with live agent turns (2026-09-30)

The owner's direction in chat on 2026-09-30 was: "i want layer submissions as review items. run again with a task requiring a real (but minimal) change." The owner authorized the live turns and started each host with the prepared script. Scope is in the workspace work record (`docs/design/layer-scoped-work/work-record.md`).

## Changes

- **Review items** (`9e90a61`).
  - The layer task card asks for evidence for each criterion, and the adapter's submit tool describes a layer submission.
  - Review resolves evidence against what the run produced: a staged record by ID or title, a committed layer file by path, or a test by the name reported to `aludel_layer_commit`, with its result.
  - Anything the run didn't produce is shown as missing.
  - Covered by the proposal tests and the layer-scope browser journey.
- **Layer task brief** (`a4f42d3`). The issue description told every non-coding task "Submit a review proposal; do not change project records or files", including layer tasks. Layer tasks now get a brief that says to make the requested changes with the layer tools, pinned by a test.
- **Task card wording.** The card now calls the project repository read-only and says the layer is writable in `layer/`.

## Live turns (task "Name flow steps with verbs", three criteria)

| Run | Code | Outcome |
|---|---|---|
| 1 | before `a4f42d3` | The agent wrote a read-only proposal: its notes described the method change and the description, and it made no layer calls or commit. Its evidence honestly marked each criterion unmet. Its Codex transcript shows it adopted "do not change project records or files" from the issue description in its first message, before opening the card. Left unaccepted. |
| 2 | `a4f42d3` + per-project database (`614de3a`), fresh disposable portal | One run. See below for what it did. |

What run 2 did:
1. Staged the Tool detail description through `aludel_layer_call`.
2. Edited `knowledge/flow-method.md` in `layer/`, adding "a short name that starts with a verb, for example 'Choose a tool'" (+1 −1).
3. Ran the layer tests (4 files passed).
4. Called `aludel_layer_commit`, making commit `56a08ed` on `work/w-3-ec9f9b86`.
5. Submitted evidence for all three criteria. Every item resolved ([screenshot of criterion 3](live-review-criterion-3.png)).

The owner accepted over HTTP, checks first. That applied the description in the project's own database and fast-forwarded the Pages instance's `main` to `56a08ed`. The pin equals `main`.

With this, `aludel_layer_commit` has been exercised by a real agent, not just the scripted check.

## Retrospective

1. **What made it harder.** Two sources gave the agent conflicting instructions: the portal-generated issue text and the task card. The first live run (LAYER-TOOLS-01) succeeded despite that, which hid the conflict. A task whose data change was already satisfied would not have surfaced it either.
2. **What would make the next one easier.**
   - Read the agent's own transcript (`codex-home/sessions/*.jsonl`) to find where a decision came from. Here it pointed at a single line within minutes.
   - The live task should require a real change on each tool it is meant to prove.
3. **What changes downstream.** Every generated agent-facing string (issue description, workflow prompt, tool descriptions, card) must agree for a task type. A test now pins the layer brief. The workflow prompt's action-specific paragraphs are still there for action tasks.
4. **Questions.** Should Aludel re-run the layer's tests itself on the committed branch before review? Today they show as "Reported by the agent; not re-run". The host could run `node --test` in a sandbox at merge time.
5. **Process change.** Live turns now use a task that forces each tool, and the evidence is read from the review, not only from the database. This was applied in run 2.
