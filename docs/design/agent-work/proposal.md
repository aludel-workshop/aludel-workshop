# Open agent work (AGENT-WORK-01): proposal

Status: proposal for the owner. No code changes.

## Authorization

- **2026-10-04, owner project thread:** "the agent work process needs to be opened up, and defining that is our next high priority task after wrapping this up. i want it to be heavily modeled on the way claude code projects work … except making the most of this multi-layer documentation we are building. can you read into the claude code agent workflow and propose how we can pull inspiration here? i think setting up for sub-agents makes sense as well."
- Authorized: this proposal. Not authorized: building any of it.

## The problem, from J8

The owner wants to give an agent a goal like "create the sign up flow" and have it work across the stack: "first modify x and y in pages, that binding updates z in codes journeys, then we can follow through and create the code to implement, add tests, showcase results for review."

Today an agent run cannot do that:
- **One run is one layer.** Go pins a bundle with the task, one layer's API and its charter. The worker brief says "Change *layer* data only with aludel_layer_call … Do not change other project records or the project repository" (`server/symphony-readiness.mjs`). Any other layer is out of reach, except as a follow-up suggestion. A suggestion becomes a new task, which needs a new Go and a new run.
- **J8 showed the cost.** W-9 was asked for signup. It reported that the Pages spec was too thin, proposed a Pages task (W-10) and built nothing (Codex's [J8 push handoff](../journeys/handoff.md)). Every cross-layer goal turns into a chain of single-layer runs, each with its own Go and review.
- **What works, and stays:**
  - Nothing is applied until review.
  - Journeys and claims are the proof.
  - The J6 walk review.
  - Check my branch.
  - Elevated reviewers per layer.
  - Owner review of a layer's own code.

## What Claude Code does that we want

| Claude Code | What it gives | Aludel equivalent |
|---|---|---|
| One session per goal, across the whole repository | The agent explores, plans, edits anywhere, tests and iterates. A person reviews the branch or PR at the end | **A run works across every layer.** The unit of review is the run's changeset |
| `CLAUDE.md`, user to project to subdirectory, with nested files loaded when work reaches that folder | Context the agent always has, plus detail where it's working | **The layers' own docs are the context.** A stack map is always loaded; a layer's Knowledge loads when work touches that layer |
| Skills: the description is always in context, the body loads on use | Lots of know-how for a small context cost | **Layer templates ship skills**, such as "write a page spec" (Pages) and "write a journey and its characterization test" (Code) |
| Plan mode | Read freely, propose a plan, then act once it's approved | **A cross-layer plan first.** Approving it authorizes the work it names |
| Permission modes, and allow/ask/deny rules per tool and path | Autonomy is a setting, not a code path | **A mode per layer:** stage freely, ask first, or read-only |
| Subagents (`.claude/agents/*.md`: name, description, tools, model; own context; return a summary; run in parallel; can be isolated in a worktree) | Specialists that keep the main context small | **Layer agents**, shipped by each layer template, plus host agents for exploring and verifying |
| Hooks (PreToolUse, PostToolUse, Stop, SubagentStop …) | Deterministic checks the model can't skip | **Host checks** around staging and submitting: layer API validation, package tests, combined build and journey tests |
| Todo list, AskUserQuestion, resume | Progress shows; the agent asks instead of stopping; feedback continues the same session | **The plan is the checklist.** Questions are answered in the thread, and *Send back* resumes the same run |
| Claude Agent SDK | The same harness, run programmatically: subagents, skills, hooks, `canUseTool`, MCP tools, sessions | **A possible runtime** for runs (decision 1) |

Source: Claude Code docs (code.claude.com/docs). Details may move; check them before building.

## Proposal

### 1. A goal, not a layer task
A task can belong to the project instead of one layer, for example "Create the sign-up flow." The layer becomes an optional hint.
- One run is one agent session across the stack.
- The run builds one **changeset**, keyed by the run:
  - for each layer it touches, a work branch in that layer's repository, plus staged record changes through that layer's API;
  - it is integrated and reviewed as one.
- Nothing is applied until review, as now.

### 2. The layer docs are the agent's `CLAUDE.md`
- **Always loaded:**
  - the project brief (Vision);
  - a generated **stack map**: each installed layer's name, what it owns, its charter in a paragraph, and its bindings (who follows whom).
- **Loaded when needed:** a layer's Knowledge (charter, `knowledge/*.md`), its API spec and its current records, through read tools. This works like a nested `CLAUDE.md`.
- **Skills** ship with the layer templates in `layer-base`, so every project gets them and a template update improves them.
- **Read anywhere:** every layer is readable by default.

### 3. Plan first
The agent's first output is a **plan across the layers**: ordered steps, each naming the layer, the change and why, plus the claims it will prove. For example:
1. Pages: add the sign-up and first-world pages to the onboarding flow.
2. Binding: Code's "sign up" journey follows that flow. The host derives this.
3. Code: implement the routes, with step tests.
4. Prove: the journey passes on the combined build.

The owner approves the plan in the thread, and approval authorizes the layers it names. A per-project mode can approve small plans automatically. The plan then becomes the run's checklist (today's `aludel_task_plan` and `aludel_task_progress`).

### 4. A mode per layer
This is a project setting, modeled on permission rules:
- **Stage freely:** the agent may stage changes in this layer once the plan is approved.
- **Ask first:** each change needs its own approval.
- **Read-only.**

A layer's own code (authority files) always gets owner review, and elevated reviewers still sign their layer's part.

### 5. Subagents
- **Layer agents.** Each layer template ships `agents/<layer>.md`, in the same shape as Claude Code's agent files. It carries a description (when to delegate), the layer's tools (its API and its files), the Knowledge to preload and a model.
  - The coordinator delegates a plan step, such as "update the onboarding flow per step 1", to the Pages agent.
  - That agent works in its own context, stages changes in its layer, and returns a summary plus the changes.
  - Independent steps run in parallel. Steps linked by a binding wait for each other.
- **Host agents.**
  - *Explore:* read-only, across all layers.
  - *Verify:* runs Check my branch on the combined changeset, meaning the build and every journey step test. This is also the agent-side check J7 left out.
  - *Showcase:* collects screenshots and walk results for review.

### 6. Bindings carry the follow-through
When a staged change has a binding (a Pages flow drives a Code journey), the host computes the derived change inside the same changeset and adds it to the plan as a step. Today it would become a follow-up task. Suggestions remain for work outside the goal.

### 7. Host checks as hooks
These are host-owned and can't be skipped:
- the layer API validates each staged change;
- layer code runs its package tests;
- the combined build and journey tests run before submit;
- an unproven claim needs a stated reason before submit.

Projects don't configure these yet.

### 8. One review per run, then resume
- The J6 review covers the whole changeset: grouped by layer in plan order, with claims from the plan and journeys walked on the combined build.
- **Send back** resumes the same session with the review notes, as replying in a Claude Code session does. It does not start a fresh run that has to rediscover everything.
- Accepting merges each layer's part. Each part must stay current, as today.

### 9. Ask instead of stopping
When intent is genuinely missing (W-9's case), the agent asks in the thread and keeps working once answered (`aludel_task_ask`, applied across the stack). It doesn't end with notes and a suggestion.

## Decisions for the owner

1. **Runtime.**
   - **A. Claude Agent SDK** as the run runtime, recommended. Subagents, skills, hooks, permission callbacks and sessions exist there. Aludel's tools become one MCP server. The Elixir adapter stops being where tools are added, which also removes the toolchain gap that blocked J7's agent check.
   - **B.** Keep Symphony and Codex, and build the coordinator and subagent plumbing into the adapter.
   - Either way, Aludel's tools become one MCP server, so the runtime can change later.
2. **Plan approval.** Every plan waits for the owner (recommended to start), or small plans auto-approve.
3. **Review.** One reviewer signs the whole changeset, with elevated layers needing their own reviewer (recommended), or each layer is signed separately.

## Slices (each needs the owner's go)

| Slice | Scope | Exit evidence |
|---|---|---|
| **A0 Prototype** | The plan card, the run's live checklist with layer agents, and the changeset review. A clickable prototype, as for J6 | Owner accepts the interaction |
| **A1 Aludel MCP server** | Read any layer (stack map, Knowledge, API, records, repository), stage per layer into a run changeset, run Check | Server tests; one stack-wide changeset staged and checked |
| **A2 Coordinator and layer agents** | The runtime from decision 1 in the existing bounded sandbox; agent files and skills for Pages and Code in `layer-base` | "Create the sign-up flow" on a disposable project produces a Pages change, the derived journey, code and passing step tests |
| **A3 Bindings in the changeset** | Derived changes become plan steps | Pages flow → Code journey within one run |
| **A4 Review and resume** | Changeset review; Send back resumes the session | A browser journey: review, send back, the same run fixes it, accept |
| **A5 Owner trial** | The owner gives Biome "create the sign up flow" | Owner actions only, plus a retrospective |

## Wrapping up J8 first
- Codex's branch `codex/j8-trial-task-review-fixes` (the task composer, J8 repairs and their evidence) still needs review and merging.
- J8 closes with the owner's trial notes. W-9's outcome is this packet's motivating evidence; its live journey is A5.
- The remaining JOURNEYS-01 items move here:
  - the agent check (A1/A2);
  - prerequisite and continuation handling (§9);
  - clearer task status when a run fails before it starts.
