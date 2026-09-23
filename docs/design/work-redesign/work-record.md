---
id: work-ux-01
kind: work-record
status: agent-checked
updated: 2026-09-23
depends_on: [lay-04-work-automation, portal-layers-implementation-plan]
---

# WORK-UX-01: Work layer redesign (items, batches, roles)

## Authorization and scope

- **Owner instruction (chat, 2026-09-23):** "work items … need a serious ui pass", then "before we start changing the code give me a pretty preview with your vision for the redesigned pages." (DEC-029 interim chat authorization.)
- **Authorized now:** a local, static, clickable prototype (`v1/index.html`) and this record. No portal code, data or schema changes until the owner has reviewed the prototype.
- **Excluded:** portal code changes, provider calls, spending, external writes, deployment.
- **Relation to `next_action`:** ROADMAP-01 stays the planning pointer. The owner raised this packet directly in chat. Batches tie into the roadmap in ROADMAP-01, so the batch model here must not close that question off. Per-assignee batches are compatible with either answer.

## Owner brief ledger

This is the process change being trialled (see below). Each distinct ask is numbered, with the owner's final position where the brief changed mid-message. Each row names where the prototype answers it. Review can then accept or reject each ask separately.

| # | Ask (owner's words, condensed) | Final position | Prototype answer |
|---|---|---|---|
| A1 | Items in the regular queue have no detail view; one consistent view for all | Required | Every row on the board opens the same item page, backlog gaps included (the prototype gives them refs) |
| A2 | Item detail is muddy; clear structure "more like a jira item … with deeper context" | Required | Item page: header with status track; main column with Description, Done when, Decision, What changed, Activity; Details side panel |
| A3 | Every knowledge reference is a quick link with a hover card and click-through | Required (Work only for now) | `ref` chips everywhere on the Work pages, with a hover or focus card and a link |
| A4 | Context as its own section or woven into the structure? | Owner undecided | Recommendation: both. References appear inline where they carry meaning, and the side panel collects them as *Changes* and *Reads* |
| A5 | Log entries show touched files and records as chips; modifications get a collapsed diff | Required | Activity entries carry chips plus a `<details>` diff |
| A6 | Version control on knowledge may be a bigger push | Noted, not in scope | Diffs use existing record revisions; no new versioning shown |
| A7 | A clear "here's what changed" section when the agent finishes | Required | "What changed" summary on review/done items |
| A8 | Finished batch items stay in the batch as *ready for review* until the user clears them. No separate Review or In progress sections | Required | Batch lanes keep items with per-item state; board has no Review or In progress lists |
| A9 | A user batch, too. Adding to batch goes to the assignee's batch | Required | One lane per assignee (you, each agent profile) |
| A10 | Done moves to a tab: Queue / Backlog / Done, small underline tabs. Queue action "Add to batch", Backlog action "Queue" | Required | Board sub-tabs as specified |
| A11 | Item cards: role chip, split assignee chip with a dropdown. Changing the assignee of a batched item hops it to (or creates) that assignee's batch | Required | Cards and the item page. The hop is live in the prototype |
| A12 | Three separate things: status, role (profile it's marked for), assignee | Required | Modelled separately in cards, detail and roles |
| A13 | `/work/style` → `/work/roles`: sections by layer, one role per layer, its action types listed below | Required | Roles tab |
| A14 | Per action, the default assignee as the same chip dropdown (any agent profile or a person); agent options disabled with no connected agent | Required (replaced the earlier "switch") | Roles rows. The prototype's "No agent account" control shows the disabled state |
| A15 | Individual preferences and "who takes each kind of work" both driven by this one system | Required | Preferences table and working-style table removed |
| A16 | Agent profiles more flexible: use the default, or create profiles with their own context and settings | Required | Agents tab: Default agent plus custom profiles with attached context |
| A17 | Styles (Dreamer/Planner/Tinkerer) only preset roles at onboarding; never shown again | Required (reversed a mid-brief selector idea) | No style selector anywhere. Rail subtitle and Settings no longer mention style |

## Design choices made in the prototype (open for owner review)

- **Roles belong to layers; profiles are "who".** A role (for example Product lead) owns its layer's actions and role instructions. An agent profile holds a model, an account and extra context. When a profile acts in a role, it reads the project instructions, then the role instructions, then the action guidance, then its own context.
- **Agent work always comes back for review.** The old modes `agent` and `agent-review` merge. Every agent result waits in its batch as *ready for review* until you clear it, which is A8.
- **Backlog gaps become real items.** Today, computed suggestions have no id and no page, which is the cause of A1. Proposed: materialise each gap as a `backlog` item with a ref, and close it automatically when the gap disappears.
- **Statuses:** Backlog → Queued → Batched (waiting or working) → Ready for review / Needs you → Done. A *Needs you* item stays in its batch, like one ready for review.

## Process improvement (trial)

- **Weakness observed:** long owner briefs in chat mix required asks, open questions and reversals ("actually, fuck it … no selector"). Nothing in the procedure forced them to be itemised. A prototype could therefore silently drop or misread an ask, and review would accept or reject it as a whole.
- **Change applied now:** the ledger above, and a matching on-page "Brief" panel in the prototype so the owner can check each ask against what they see. Recorded in [operating procedure §1](../process/operating-procedure.md#1-establish-the-task-and-improve-the-process).
- **How it will be evaluated:** at owner review, count the asks the owner says were missed or misread, and whether per-ask feedback maps onto ledger rows without restating context. Until then this is a hypothesis.

## Owner review of v1 (2026-09-23)

The owner reviewed Roles, then Board, then the item page, and gave feedback by screen, not by ledger row. **Accepted:** Roles "looks pretty good" (A13), and the role-instructions concept is "interesting". **Revised:** A11, A8, A2, A14 and A16, as below. **Not commented on** (still open, not accepted): A3 hover cards, A4, A5, A7, A10 tabs, A15 and A17.

| # | Ask (owner's words, condensed) | Revises | v2 answer |
|---|---|---|---|
| B1 | Remove the "Default for this role" setup: overkill | A14 | Each action has its own assignee; no role default or "use role default" |
| B2 | Instructions per action type, so any agent starting that action has the same knowledge | new | Roles › action setup: action instructions (revisioned), after the role instructions |
| B3 | "May change" on the profile hints at a spec or toolkit that belongs on the action ("an agent writing code can't just change the roadmap") | A16 | Action setup: *May change*, *Tools*, *Asks first* and *Run phases*. The profile keeps model, extra instructions, context and limit |
| B4 | Profile detail: no Open work, no Takes by default; an assignee filter on the stack instead | A16 | Removed from the profile page; the board has an assignee filter, linked from the profile |
| B5 | A different random bot icon per profile, each with a metallic colour, used everywhere a bot shows | new | DiceBear *Bottts* robots (library MIT; style free for commercial use, credit Pablo Stanley) seeded per profile; a 10-tone metal set |
| B6 | Batch items and stack items look exactly the same: card look, no knowledge chips; title, then role·action and assignee; action on the right | A8, A11 | One card component in lanes and in the stack; role and action combined in one chip |
| B7 | The right-side action is Stage, Review or Answer (n). With no primary action, show the status; hover shows a secondary action (owner asked for an opinion) | A10 | As asked. The secondary action replaces the status on hover *and* keyboard focus, and is always visible on touch |
| B8 | A started batch locks items in: no moving them out; hover shows Skip (not grabbed yet) or Stop (grabbed); spinner, then Answer or Review; no separate needs-you chip | A8 | Running lanes lock their items (assignee chips locked, no unstage) |
| B9 | A thin progress bar on the card: the model's current activity; active time and usage or spend on the right | new | Bar under working cards; lane header shows total time, tokens and ≈ spend |
| B10 | Replace the item's status track with the agent's task progress, with milestones or phases | A2 | "Agent run" track: phases come from the action's *Run phases* (B3) |
| B11 | Review scaffold: done criteria are the test checklist; open each criterion's evidence, compare it to the criterion, accept or reject with a note; agents may review too | A2 | Review checklist: criterion with its source, evidence to compare, reviewer-agent suggestion, verdict with note; accept or send back |
| B12 | Gap work is auto-created like any other item | Design choice 4 | Backlog items are ordinary items (no special gap type) |
| B13 | Priority and blocking, as Jira has them; sort stacks by priority; blocked items can't be staged and show "Blocked by" chips | new | Jira's five priorities and "blocks / is blocked by" links; sorted by priority; blocked items can't be staged |

**Ledger trial, first observation:** the owner's feedback did not use row numbers. Mapping it back onto rows still showed which asks were revised and which were never commented on. Without the ledger, the uncommented rows (hover cards, the Changes/Reads split) would have looked accepted. Whether the ledger prevents missed asks is still unproven: no ask was reported as missed in this round.

## Owner review of v2 and build authorization (2026-09-23)

**Accepted:** B1–B13 ("b6-13 great"), and the open A rows ("as all clear as well"). The exact tools and permissions for each action "need more thought in the future; don't need to finalize that now". **Authorization:** "no final preview needed, i back you for these changes. figure out what it will take to build, and get started." This authorizes local portal code, schema and test changes within this record's scope. It does not authorize provider spending (runs still need Go on a connected key), external writes or deployment.

| # | Ask | Build answer |
|---|---|---|
| C1 | Bots use *Bottts Neutral*; no explicit colour names | `@dicebear/bottts-neutral` 9.x (free for commercial use; credit Pablo Stanley). Colours are unnamed swatches |
| C2 | User icons use *Big Smile*, fully customisable, not just randomised | `@dicebear/big-smile` 9.x (CC BY 4.0, credit Ashley Seo with a licence link). An account-page editor for every option |
| C3 | Profile page: picture with an edit icon on hover (colour and regenerate appear beneath). Name and description in a header to the right, with an action bar under it (assigned work, deactivate). Drop the duplicate page header and the Default chip | As asked |
| C4 | Model: choose from the connected provider's models, with a separate effort toggle | Models are listed from the provider (free call with the stored key); effort is low, medium or high, passed to the provider |
| C5 | Replace the "stop the batch" switch with proper usage controls | Per profile: output cap per item, token cap per batch run, monthly token budget; the runner enforces them |

## Build plan (WORK-UX-01 build)

These are ordered by dependency. Each part is agent-checked before the next depends on it.

| Part | Scope | Check |
|---|---|---|
| WX-1 Roles and assignment | `config/roles.json`: one role per layer, with actions (work type, default phases, tools, may-change, asks-first) and onboarding presets. Record kinds `role` and `work_action` (revisioned, pinned per run). Assignees are an id (a user or an agent profile). Work items gain priority (Jira's five levels) and `blocks` links. Layer gaps become backlog items automatically (DEC-041 revises DEC-040's "nothing opened until batched"). Working-style preferences no longer drive anything; onboarding style only seeds action assignees. Existing projects are migrated | Domain tests: presets, migration, priority sort, blocked staging refused, gap items created and closed |
| WX-2 Profiles and avatars | `agent_profile` becomes: name, description, avatar (seed, colour), model, effort, extra instructions, context, usage limits, active. User avatar (Big Smile options) on the account. Provider model list endpoint | Domain tests; stub serves model lists |
| WX-3 Batches and runner | One batch per agent profile, plus person staging. Items stay in the batch until cleared. Batches lock while running. Skip and stop (stop aborts the call). Phase progress, rejection notes fed to the next run, usage limits and effort. Instructions read in this order: project, role, action, profile | Runner tests against the provider stub |
| WX-4 Review and changes | Done criteria become the review checklist; each criterion records its source and a verdict with a note. Send back carries the notes. A "what changed" endpoint returns the item's revision diffs. Log entries carry record refs | Domain tests |
| WX-5 UI | Shared pieces: reference chip with hover card, avatar, assignee chip with menu, priority, role·action chip. Board, item page, Roles, Agents with profile page, account avatar editor. Remove working style from the shell and settings | Typecheck and build; browser script over every Work view; axe; 390px |
| WX-6 Closeout | Browser script and existing tests updated; DEC-041; knowledge-structures and implementation plan; evidence and retrospective; status | All server tests; browser scripts |

**Known limits, to be stated rather than faked:**
- Agents can still run only acceptance, clarification options and data contracts (coding is LAY-05). Other actions assigned to an agent are shown as "agents can't run this yet".
- Usage arrives when a call finishes; a live token ticker needs streaming and is a follow-up. Phases and elapsed time are live.
- An agent reviewer's pre-check needs its own task kind. It is planned for after WX-4 if time allows; otherwise it is a follow-up.
- Code diffs in "what changed" come with LAY-05's commits; record diffs are real now.

## Readiness

- Target stage: owner review of a static clickable prototype.
- Verdict: ready. Inputs are the current Work layer code (`apps/portal/src/layers/work.ts` at `ce83a2a`), the v3 prototype's design tokens and the owner brief.
- Must not begin yet: portal implementation (waits for owner review of v1), removing the `interaction-profiles` preferences, and data migration of batches and profiles.

## Handoff

- Prototypes: [v1](v1/index.html) (reviewed 2026-09-23) and [v2](v2/index.html), both static with sample data from the v3 Tool Share project. The published link shows v2.
- v2 agent checks (Playwright, local file): no script errors; 15 robot avatars rendered; the blocked W-02 offers no Stage; reassigning staged W-15 moves it to Dana's batch; no horizontal overflow at 400px on the board or on W-12.
- Found and fixed while checking: every person's lane was titled "Your batch".
- Implementation notes for the build:
  - Agent run phases and activity need the runner to report its phase and a one-line status, through a `report_progress` tool or inferred from tool calls.
  - Review checks need each done criterion to name its source record revision and the kinds of evidence it expects.
  - Robot avatars should be generated once per profile from a stored seed and metal. DiceBear 9.x is MIT and the Bottts style is free for commercial use; credit Pablo Stanley.
- v2 accepted 2026-09-23; build authorized (see above).
- **Build done and agent-checked 2026-09-23 (WX-1 to WX-6).** Checks, known limits and the retrospective are in the [evidence](../../evidence/work-ux-01-work-redesign.md). Owner review of the built pages is pending.
- Ledger trial, second observation: the owner again gave v2 feedback by screen. The C rows mapped without restating context, and no ask was reported missed. The ledger stays in operating procedure §1; it isn't proven to prevent misses, because nothing was missed to catch.
