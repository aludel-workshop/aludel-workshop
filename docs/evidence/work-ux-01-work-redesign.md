---
id: work-ux-01-evidence
kind: evidence
status: agent-checked
updated: 2026-09-23
depends_on: [work-ux-01]
---

# WORK-UX-01: the Work layer redesign (built)

## Authorization and scope

- The owner reviewed prototypes v1 and v2 and authorized the build in chat on 2026-09-23: "no final preview needed, i back you for these changes. figure out what it will take to build, and get started."
- Scope, the asks (A1–A17, B1–B13, C1–C5) and the build plan (WX-1 to WX-6) are in the [work record](../design/work-redesign/work-record.md).
- No provider was called with a real key and nothing was spent. Every run went against the local provider stand-in (`tests/provider-stub.mjs`).
- Recorded as DEC-041 in the [decision register](../decisions.md).

## What exists

| Part | Built |
|---|---|
| Roles and actions | `config/roles.json`: six roles (one per layer) with 19 actions. Revisioned `role` and `work_action` records hold each action's assignee, instructions, what it always reads, what it may change, tools, what it asks first, run phases and checks. The onboarding style only presets assignees. The Roles page edits all of it |
| Work items | Action, assignee by id, Jira priority, `blocks` links (no cycles; "is blocked by" is derived), and checks with verdicts. Statuses: backlog, queued, staged, working, needs you, review, done. Layer gaps become backlog items automatically and close when filled another way |
| Profiles and avatars | Profile: robot (DiceBear Bottts Neutral, unnamed metal tones), a model listed from the connected key, effort, its own instructions and context, usage limits, and active or not. People get a Big Smile avatar they build part by part on the account page. `licenses/DiceBear-LICENSE` |
| Batches and runner | One batch per agent profile, plus each person's list. Go locks a batch's items: a waiting item can be skipped and the working one stopped (its provider call is cancelled). Results wait in the batch until cleared. The runner reports phases and activity, and enforces output per item, tokens per run and tokens per month. Effort goes to the provider, and instructions are layered and pinned. Send-back notes reach the next run |
| Review and changes | A review checklist per item: each check has its source record and revision, the evidence (that record's diff from the item), and a verdict with a note. Accept needs every check accepted; send back needs a rejected check with a note. A "What changed" endpoint returns revision diffs. Log entries carry record refs and who wrote them |
| UI | One work card in batch lanes and in the Queue, Backlog and Done tabs (sorted by priority, filtered by assignee). The item page has the agent-run phases, review, question, what to do, done when, what changed, activity, details, links, linked knowledge and runs-with. Also Roles, Agents with the profile page, the account avatar editor, reference chips with hover cards, and the split assignee chip with its menu. Working style no longer appears in the rail, Settings or Work |
| Migration | At start-up, for existing projects: roles and actions are seeded; the DEC-038 profiles are deactivated and any instructions the owner edited move to their role; open work on missing or deactivated profiles goes to the Default agent; items get actions, priorities and checks; leftover "claimed" items return to ready; old batches take a profile |

## Checks (2026-09-23)

- **Server:** `npm run test:server` passes 63/63 (61 at baseline). New or rewritten tests:
  - `lay-04.test.mjs`: backlog from gaps, presets, priority and blocking, answers that apply themselves, routines by action, reconcile routing.
  - `agent-runs.test.mjs`, 8 tests: staging, locking, model, effort and output limit sent to the provider, review and send-back with notes, clarify through Anthropic, spend-limit stop, usage limits, skip and stop, model listing, restart.
  - `lay-07.test.mjs`: profiles and the legacy migration.
  - `onboarding.test.mjs`.
- **Typecheck and build:** pass with no errors. The only warnings are the three that already existed in `pages.ts`.
- **Browser:** `tools/browser-checks.sh layers onboarding` passes.
  - The layers script's Work section was rewritten. It covers the template item in Done; the backlog routed by action; answering a clarification; queue, stage and verified closing with editing from the item; a blocking link and priority; routines; agent staging, Go, review with evidence, and accept; reassigning between batches and sending back with a note; Roles assignment and action setup; the agent profile (model, effort, limits, robot); the account avatar; and reconcile.
  - axe is clean on every checked view, and no path overflows at 390px, including `/work/roles`, `/work/agents` and an item page.
  - The full `browser-checks.sh` passes except `tests/browser.mjs`, the known failure at its decision-conflict step that also fails on the baseline commit.
- **Real data:** start-up migration was run against a **copy** of the owner's `.data/machine.sqlite`, with no change to the original:
  - four projects, 19 actions each;
  - five legacy profiles deactivated, one Default agent;
  - every open item has an action and a live profile;
  - the three old batches have a profile.

  This run found three gaps, fixed and re-checked: batches with no profile, leftover claimed items, and an item assigned to a pre-profile "Product agent" label.

## Known limits (stated, not faked)

- Agents still run only three actions: write acceptance, draft answers to open questions, and write object contracts. Any other action assigned to an agent says so, and its Stage button explains why (coding agents arrive with LAY-05). The Dreamer preset assigns most actions to the Default agent, so some queued items wait on that.
- Token usage arrives when a call finishes. Phases, activity and elapsed time are live, but there is no live token ticker (that needs streaming).
- The runner does not enforce an action's "may change" and tools. The prompt states them, and today's three tasks can only write their own target kinds; LAY-05 must enforce them for code.
- The owner asked for the agent reviewer's pre-check, but it is not built (it needs its own task). Evidence is currently the record's revision diff from the item; tests, screenshots and code diffs arrive with LAY-05.
- Effort is sent only to model families that accept it. The pattern for that is a heuristic in `agent-runs.mjs`.

## Retrospective

1. **What made this harder or slower than necessary?** *Observed:*
   - Five CSS class collisions inside the `lay-` namespace (`lay-activity`, `lay-checks`, `lay-block`, `lay-fields`, `lay-swatch`). The prefix convention only guards against the workspace stylesheet, not against earlier layers.
   - Six grid overflows at 390px from grids without a `minmax(0, 1fr)` column.
   - A bug in the test stand-in: its slow key never answered in current Node, which the unit tests hid.
   - Twice, `pkill -f` matched my own shell.

   All were found by looking at real screenshots and by the narrow browser checks, not by unit tests.
2. **What would make the next equivalent task easier?**
   - Check for class collisions after writing a stylesheet section: `node tools/css-collisions.mjs "<section marker>"` (added now; the six it still lists for WORK-UX-01 are intended extensions such as `.lay-button.danger`).
   - Default any list grid to `grid-template-columns: minmax(0, 1fr)`.
   - Run start-up migrations against a copy of the owner's database before handing off.
3. **What changes the roadmap, downstream packets or architecture?**
   - LAY-05 now plugs into actions: `runnableActions` in `agent-runs.mjs`, action phases, and "may change" and tools, which it must enforce for code.
   - ROADMAP-01 can rank or draw batches from backlog items, which now exist as records with priorities and blocking links.
   - The DEC-040 pool and fill are gone.
4. **Questions created or made important**, all for the owner, none blocking:
   - Should an action whose default is an agent that can't run it yet keep that default? It is the owner's preset, so it stays for now.
   - Is the agent reviewer's pre-check the next step for review (B11)?
   - What exactly may each action change? The owner deferred this.
5. **Process changes.**
   - *Applied and tested:*
     - The owner brief ledger. Both review rounds mapped onto rows without restating context, and no ask was reported missed. Evidence: the ledger sections in the work record.
     - Checking the start-up migration against a copy of real data. Evidence: it found three real gaps before handoff.
   - *Recorded, not yet tested:* the CSS collision check and the grid default. Their effect is a hypothesis until the next UI packet.

## One next action

Owner use of the rebuilt Work layer: restart the portal (`./launch-machine`) and review against the ledger. Then ROADMAP-01.
