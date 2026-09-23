---
id: lay-04-evidence
kind: evidence
status: agent-checked; owner ran real batches (2026-09-23)
updated: 2026-09-23
depends_on: [portal-layers-implementation-plan, lay-07-evidence]
---

# LAY-04: verified work, applied answers, working-style automation, routines

## Authorization and scope

- **Source:** owner in chat, 2026-09-22: "alright, im happy with v3. go ahead and start lay-4". This closes V3-REVIEW, with the built LAY-07 layers accepted, and authorizes starting LAY-04 locally.
- **In scope:**
  - **LAY-04A:** work items verify their outputs. Closing an item checks that each target record has a revision made from that item. An answered question can be applied to its target record with its reason. The interim `/projects/<id>` page is removed.
  - **LAY-04B:** working style decides which work types are staged and handed to an agent profile automatically.
  - **LAY-04C:** routines create work on a schedule.
  - All of it with server, UI, config, tests and docs.
- **Excluded until the owner says so:** the Product agent and anything else that calls a model provider or spends money (DEC-004). Automation assigns work to agent *profiles*; nothing runs them yet. Also excluded: external accounts and deployment.

## What exists (LAY-04A–C, agent-checked 2026-09-23)

| Part | Result |
|---|---|
| **A: verified work** | Closing a `define`, `spec`, `plan`, `design`, `research` or `configure` item checks that every target has a revision whose `work_item_id` is that item; otherwise the close is refused (409) with the names of the unchanged targets. Implement, reconcile, review and audit items are exempt: their outputs are code, links or findings, which LAY-05 verifies. Template items are exempt. The record API accepts `workItemId` for open items only. In the UI, following a target from a work item sets a **Working on W-n** banner; edits to that item's targets then carry its id until it is closed or you press Stop |
| **A: applied answers** | "Apply to S6" writes an answered question into its target as a revision with the question, answer and reason as rationale, linked to the item. For a story or spec, the clarification moves to a new `resolved` list (shown as "Decided" in the story drawer). For a page, it is appended to the notes. Other kinds are edited from the item. Free-text questions are now kept when staged; before, only questions with options survived |
| **A: interim page removed** | `/projects/<id>` redirects to `/p/<slug>`. Its template and five handlers are gone |
| **B: working-style automation** | Suggestions (missing acceptance, open clarifications, undesigned pages and, new, contracts that Demo/MVP stories need) are computed on the server. `config/interaction-profiles.json › automation` gives each work type a preference and a mode per value (`you`, `agent`, `agent-review`), matching the table shown in v2/v3. After any successful layer write, and every ten minutes, working style stages each automated suggestion **once** and assigns it to the routed profile with pinned instructions. It also routes unassigned reconcile and routine items. A gap that already had an item stays a manual suggestion, so closing without fixing never loops. Items stay `ready`: nothing runs an agent. The Working style tab shows each type's mode in this project, its profile and the three styles side by side |
| **C: routines** | New kind `routine` (title, layer, type, cadence `weekly`/`monthly`/`before-release`, documents, enabled) plus a `routine_runs` table. Four defaults are seeded from `config/routines.json`, including for existing projects at start-up. Routines run at start-up, every ten minutes, after each preview build (before-release) or on demand. A routine never opens a second item while its last one is open. The Routines tab shows next run, last item and an on/off switch, has Run now, and lets you add a routine |

## Checks (2026-09-23)

| Check | Result |
|---|---|
| `npm run test:server` | 51/51, 7 new in `tests/lay-04.test.mjs`: verification (including refusing an unrelated edit and an edit to a done item), applying answers to a story and a page, server suggestions and the Tinkerer's empty automation, Planner and Dreamer staging with no re-staging, preference overrides, routines (due dates, open-item guard, release trigger, monthly, disabled, manual, validation), and routing of reconcile items |
| `npm run typecheck`, `npm run build` | Pass (no new warnings) |
| `tools/browser-checks.sh` | layers, onboarding, product, brand, github and workflow pass; `tests/browser.mjs` fails at its known pre-existing step. The layers script now also covers: a queued Architect item handed over by working style; a clarification answered and applied, then closed; a close refused until the story is edited from the item (banner, drawer, back, done); routines (the build's security audit, Run now, a refused second run, turning one off); the working-style table; and the `/projects/<id>` redirect. axe and 390px as before |

## Not built: LAY-04D (Product agent)

Running any agent means calling a provider. That needs the owner's OK (DEC-004, and the scope above). Everything up to that point exists: items are queued for the right profile, with the instructions pinned and the context compiled.

## Retrospective (LAY-04A–C)

1. **Harder than necessary (observed).**
   - The first automation design mapped every planning type to one preference. That contradicted the working-style table in prototypes v2/v3, which exists only as static UI text and was never written into the structures doc. I caught it by rereading `work.ts` before the tests, not from the docs.
   - The existing browser flow closed an acceptance item without editing the story. That was valid before this packet and invalid after it, so the test needed a realistic path.
2. **What would make it easier next time.** Behaviour rules shown in a prototype (tables of who does what) should be written into the structures doc when the prototype is approved. Applied now: the automation mapping lives in config, and the structures doc points to it.
3. **Roadmap and process.**
   - LAY-05 can rely on queued, profile-assigned items with pinned instructions and verification hooks.
   - LAY-04D and LAY-05 both depend on one owner decision about how agents run.
4. **Questions.** Created and blocking LAY-04D: which account the Product agent may use, and whether it may spend. The page-reconcile noise question from LAY-07 is still unanswered; the owner accepted v3 without raising it, so current behaviour stays.
5. **Process change tested.** `tools/browser-checks.sh` from LAY-07 was used unchanged: all seven scripts ran from one command, with none of the environment trial and error it was built to prevent. That is evidence it works. The "write prototype rules into the structures doc" change is still a hypothesis.

## LAY-04D scope decision: pasted API keys (2026-09-23)

- **Owner:** "hosting is what i care about here … if manual api key is where its at, make sure we have good documentation provided alongside." Then, on OpenRouter: "not a fan of the third party. lets go paste in a key for now." [Research](../design/portal-layers/agent-connection-research.md).
- **Authorized now:**
  - A guided connection for Anthropic and OpenAI API keys: steps, links to the provider pages, recommended name, expiration and spend limit.
  - A check that calls the provider's model list, which spends nothing, before saving.
  - Encrypted storage, as today, and "check again".
  - A user guide.
  - "Codex on this machine" is no longer offered. Existing connections keep working.
- **Still excluded:** running agents on the key, which spends money and needs the owner's OK; OpenRouter or any other intermediary; hosting.

## LAY-04D part 1: connecting a pasted key (built 2026-09-23, DEC-039)

| Area | Result |
|---|---|
| Providers | `config/agent-providers.json`: Anthropic and OpenAI, each with a key pattern, admin-key refusal, key page, limits page, docs link, numbered steps and spend-limit advice (URLs checked against the providers' docs on 2026-09-23). "Codex on this machine" is retired: new connections are refused, an existing one shows why and keeps working |
| Check before saving | `agentKeyChecker` calls `GET /v1/models` (Anthropic: `x-api-key` and `anthropic-version`; OpenAI: bearer). That call spends nothing. The key goes only to the provider. A rejected key saves nothing and replaces nothing. Unreachable and error responses get their own messages. **Check again** (`POST …/connections/agent`) re-checks the stored key and marks it verified, rejected or unchecked. `MACHINE_ANTHROPIC_API_URL` and `MACHINE_OPENAI_API_URL` point the check at a proxy or a test stand-in |
| UI | The shared connection component (onboarding step and Work › Agents › Accounts) shows provider choice, the provider's steps with the project name filled in, a direct link to its key page, spend-limit advice, a paste field and **Check and save**. Connected, it shows the provider, the key's last four characters and its status, with Check again, Replace, Disconnect and "Manage this key at the provider" |
| Documentation | [docs/guides/connect-an-agent.md](../guides/connect-an-agent.md), written for Aludel users: choosing a provider, step-by-step key creation and spend limits for each, what Aludel does with the key, rotating and removing, and troubleshooting. `tests/agent-keys.test.mjs` fails if the guide stops linking the pages the app links |
| Checks | Server 54/54 (3 new key tests; the connection test now covers verified status, a rejected key replacing nothing, retired Codex and OpenAI for Aludel itself). Typecheck and build pass. `tools/browser-checks.sh` starts a provider stand-in (`tests/provider-stub.mjs`): onboarding covers no Codex option, Anthropic steps with the project name, the key-page link, admin key refused, rejected key, a working key saved, "key ending good · checked, works" and Check again. All scripts pass except the known `browser.mjs` step |

**Retrospective:**
- Observed: three runs were lost to process mistakes, not code.
  - A scratch portal was left on the shared test port.
  - A cleanup command matched its own shell and killed it.
  - An accessibility failure appeared only while Material's button colour was mid-transition.
- Fixes applied now: the onboarding script waits for animations before running axe, and stray portals are stopped by exact process name.
- Not applied: making `tools/browser-checks.sh` refuse to start when its port is already taken. That is a small follow-up, so it stays a hypothesis.

**Still open (needs owner OK, DEC-004):** actually running the Product agent on a connected key. That spends the user's money on every run.

## LAY-04D part 2 scope: agent batches and the runner (authorized 2026-09-23, DEC-040)

- **Authorized:**
  - An agent pool with priority order, draft batches (add, remove, fill the next N) and Go/Stop.
  - A sequential runner calling the project's connected provider: OpenAI Responses API or Anthropic Messages API, with structured JSON output.
  - Task handlers for acceptance drafting (define), clarification options (define with a question) and data contracts (plan).
  - Review and accept/return, and recovery after a restart.
  - Tests against a provider stand-in, and docs.
- **Spending:** only when the owner presses Go on a batch. At most 25 items per batch, 10 by default. Token usage is recorded per item.
- **Excluded:**
  - running agents from tests or by the agent (the owner presses Go);
  - design, implementation and code agents (LAY-05);
  - changing the roadmap (ROADMAP-01).

## LAY-04D part 2: agent batches and the runner (built 2026-09-23, DEC-040)

| Area | Result |
|---|---|
| Pool, not items | Working style marks gaps as **available for agents** (`agentPool`), ordered by priority: current phase first, then define/clarify, plan, spec, design, then story order. It no longer opens items. On start-up, items that LAY-04B staged and nobody touched return to the pool (checked on a copy of the real database: Ranked Choice Fun's 22 and Mariachi Madness's 8 went back, and a hand-assigned item stayed) |
| Batches | `server/agent-runs.mjs`, `agent_batches`. One draft batch per project, 10 by default, at most 25. **Add to batch** from the pool, **Give to an agent** on any agent-capable suggestion (even ones working style keeps for you), **Fill with the next N** (re-reads the pool after each addition), **Take out**. **Go** (the owner's authorization to spend) locks the items as claimed and snapshots the list. **Stop after this item**. A restart stops running batches and returns their items to the pool. When a batch finishes, its items leave it, so a draft sent back can be batched again |
| Runner | One item at a time on the project's key. **OpenAI:** Responses API with strict `json_schema`; default model `gpt-6-astra` (the starting recommendation on OpenAI's models page, 2026-09-23). **Anthropic:** official SDK, `output_config.format` json_schema; default `claude-opus-5` with server-side fallbacks. A profile's model field overrides the default. The system prompt layers principles, project instructions, role and guidance, and says that project text is data. **Tasks:** acceptance (Given/When/Then, edges and questions merged into the story), clarification options (2–4 answers plus a recommendation, set to "Needs you"; the owner still answers), data contracts (fields merged, contract left proposed). Drafts are revisions made from the item. Items go to **In review**, or to done where working style says no review (a Planner's plans). Usage is recorded per item and per batch. A 401/403 marks the key rejected and stops the batch; a 429 (rate or spend limit) stops it; other failures return that item to the pool and the batch continues |
| UI | Queue: the batch panel (draft list, Fill, Go, running progress polled every 3 seconds, Stop, earlier batches with tokens), "Available for agents", and "Give to an agent" on suggestions. Work item: a review panel (open the target, Accept, Send back with a note) and the agent's recommendation on clarifications. Design and implementation work is not agent-capable yet (LAY-05) |
| Checks | Server 60/60 (6 new in `tests/agent-runs.test.mjs`, against `tests/provider-stub.mjs`, which now answers model calls in both providers' shapes; the two LAY-04B staging tests were rewritten for DEC-040). Typecheck and build pass. `layers-browser.mjs` covers the pool, adding by hand, Fill, Go, a finished batch with token counts, "Give to an agent", review and Accept. All browser scripts pass except the known `browser.mjs` step. **No real provider was called; the owner presses Go** |

**Retrospective:**
- **Found by reasoning through the flow, not by tests (observed):**
  - A batch's items stayed tagged after it finished, which would have trapped drafts that were sent back.
  - Adding by hand was limited to working style's pool.
  - "Fill" used a stale list.
  - Now fixed and covered by tests.
- **Process:** the owner's product feedback (22 open items) exposed that automatic staging was the wrong default. The rule that follows: automation that creates owner-visible work needs an explicit owner action before it acts at scale. This is recorded in DEC-040.
- **Open:**
  - The ROADMAP-01 design, which ties batches to an action-based roadmap.
  - Real-provider quality: the first real batch will be the first evidence of how good the drafts are.

## Owner use (2026-09-23)

Owner: "alright, i ran a couple tasks. seemed to work." The project database (read-only, Ranked Choice Fun, OpenAI key) shows:

| Batch | Item | Result |
|---|---|---|
| B-1 | Write the Profile contract (plan, Architect) | Done without review (the Planner policy), `gpt-6-astra`, 903 tokens |
| B-2 | Write acceptance for "Someone can change their name and password" (define, Product lead) | In review, `gpt-6-astra`, 1,413 tokens |

This is the first real-provider evidence: the OpenAI Responses path, structured output and revision write-back work end to end. Not yet shown with real use: draft quality across many items, the Anthropic path with a real key, and the stop-on-limit behaviour against a real provider.

## Found at closeout: project creation committed Aludel's own repository (fixed 2026-09-23)

- **What happened (observed):**
  - Project workspaces live in Aludel's repository under the ignored `apps/portal/.data/workspaces/<id>`. `inspectGitRepository` asked git whether the folder was *inside* a work tree. For a new workspace with no `.git`, git answered yes, meaning the parent. So `commitWorkspace` skipped `git init` and ran `git add -A` in Aludel's repository.
  - Starting or building a project therefore committed all of Aludel's pending work under the project's name: `6bc8081` "chore: start Browser Buddy with Aludel", `9084929` "feat: generate Browser Buddy skeleton …", `1eed185` "chore: start WheresTheBest with Aludel", and `061ace5` "chore: start Ranked Choice Fun! with Aludel" (the LAY-07 work).
  - The generated apps' own files were never committed anywhere, because `.data` is ignored, so no project workspace has its own repository yet.
  - "Publish to GitHub" for a project would have pushed Aludel's repository. It never ran: `repository_bindings` is empty, and Aludel's only remote is its own.
- **Fix:** a folder counts as a repository only if it is the top of its own (`git rev-parse --show-toplevel`, compared by real path). `commitWorkspace` and `pushWorkspace` refuse to act on a parent repository.
- **Tests:** a regression test in `tests/lay-07.test.mjs` builds a parent repository with uncommitted work and a nested workspace, and asserts that the workspace gets its own repository and the parent gains no commit. The same scenario against the previous `git-repository.mjs` reproduces the bug (the parent gains "chore: start a project"). Server tests pass 61/61.
- **Left as is:** the four mislabeled commits. Three are already on GitHub, and history is not rewritten without the owner. Existing projects get their own repository on their next build.
- **Why earlier checks missed it:** every domain and browser test used a temporary data directory *outside* any repository, so the nesting never occurred. Only the real layout (`MACHINE_DATA_DIR` inside the repository) triggers it. The regression test now covers that layout.
