# LAYER-TOOLS-01: the Symphony layer tools, compiled and exercised (2026-09-30)

Owner request (chat, 2026-09-30): "can you handle testing the agent tools? don't worry about existing projects". The scope is recorded in the workspace work record (`docs/design/layer-scoped-work/work-record.md`, LAYER-TOOLS-01).

## What was checked

| Check | Result |
|---|---|
| Overlay (`adapter.ex` plus `profile-turn.patch` and `runtime-block.patch`) at Symphony pin `be10a1b`, `mix compile --warnings-as-errors`, `elixir:1.19` image | Compiled, no warnings |
| Upstream Symphony suite with the overlay applied (`mix test`) | 299 tests, 0 failures, 6 skipped |
| [`integrations/symphony/layer-tools-check/run.sh`](../../../integrations/symphony/layer-tools-check/run.sh), from a clean temporary directory | Passed (see below) |
| Live Codex turn on a layer-scoped task through a Symphony host | Ran once, after the owner authorized it and started the host. Submitted after 1 run (about 2 minutes); accepted. See below. |

What `run.sh` does, with no model turn:
1. Seeds a disposable portal (Tool Library, Pages from its template, two pages, a Go-authorized layer-scoped Pages task) and runs the real server in a container.
2. Runs the real workspace hook (`prepare`, `start-run`). `layer/` is checked out on `work/w-1-<attempt>` at the template commit, with `.aludel/outputs/{page,flow,page_map,catalogs}.json`.
3. Edits `layer/knowledge/flow-method.md` and runs the layer's own tests (11 pass).
4. Calls the compiled `SymphonyElixir.Aludel.Adapter.execute_agent_tool/3` over HTTP, from a container sharing the portal's network namespace:
   - both tools are advertised;
   - `listPages` returns 3;
   - `createFlow` and `updatePage` are staged;
   - `getPage` reads the staged description;
   - a 31-character label is refused with the layer's own message (400);
   - an unknown operation is refused (404);
   - `aludel_layer_commit` returns the branch commit, the file diff and the test results;
   - `aludel_submit_proposal` submits with a follow-up.
5. The owner signs in over HTTP:
   - accepting before the checks are accepted is refused;
   - the checks are accepted, then the run;
   - the flow and the page description are applied (page revision 2);
   - the Pages instance repo's `main` now holds the agent's commit, and the layer's accepted commit equals `main`.

## Live turn (2026-09-30)

The owner authorized the turn and ran the host start command themselves, because this session's permission check refuses to start an agent host. Setup:
- the pinned build plus the candidate overlay;
- Codex 0.157 on the existing login, mounted read-only;
- `local-hosts` container security;
- a disposable portal;
- task W-2 "Map how a neighbour borrows a tool" (Pages, layer-scoped, three criteria).

The host was stopped after the run.

| Observed | Result |
|---|---|
| Hook: checkout, `layer/` work branch, outputs copy | Worked; events `workspace-ready`, then `run-1` started |
| Data changes via `aludel_layer_call` | Staged `createFlow` "Borrow a tool" (Browse tools → Tool detail, with a trigger) and `updatePage` (a one-sentence description). It read both back, and added step review notes that separate what's intended from what's built. |
| Layer repository | Ran the layer tests in `layer/` (passed). It made **no edit and did not call `aludel_layer_commit`**: `knowledge/flow-method.md` already opens "For a new flow, name the person's goal…", so it explained the criterion was already met. I checked the file and agree. |
| Follow-ups | One, with a reason: "Specify borrowing completion and page states" (request, acceptance and handover are unspecified). |
| Submission | `aludel_submit_proposal` with a summary, and notes listing each check it ran and the limits of its review |
| Owner review over HTTP | Checks accepted, then the run: flow created and page at revision 2. Creating the follow-up made suggested item W-9, signed `createdBy` {agent Default agent, layer pages, W-2, attempt, why, acceptedBy}. |

Findings:
- `aludel_layer_commit` is proven only by the scripted check, not by a live agent. A task that needs a genuine layer change (not one already satisfied) would cover it.
- Layer submissions have no structured checks, so the agent wrote its checks as text in `notes`. That's readable, but review can't show pass/fail per criterion for layer tasks the way it does for coding tasks. It's a small gap in the v2 card's submit shape.
- The updated host prompt worked for this task: the agent followed the card's layer method and used no action-specific outputs. That is one run of evidence.

## Changes made

- `integrations/symphony/layer-tools-check/`: `run.sh`, `seed.mjs`, `tools_check.exs` and `accept.mjs`, which together are a repeatable check without a model turn.
- `WORKFLOW.example.md`: the host prompt now routes a layer task (`aludel-task-open-v2`) to its card's method and names the three layer tools. Before this, the prompt described only per-action outputs, so an agent on a layer task had to reconcile a prompt about actions with a card that has none. This change is a prediction; no live turn has tested it.
- `README.md`: removed the stale `aludel_layer_source` description and the "never compiled" note; it now describes the layer checkout and commit flow and what has and has not been verified.

## Retrospective

1. **What made it harder.** Three things, all observed:
   - This machine has no local Elixir toolchain.
   - Upstream's test dependencies fetch a precompiled library from GitHub.
   - Containers can't reach a portal bound to WSL's loopback through Docker Desktop's gateway, so both existing hosts currently fail to connect. Their portal is down, so that failure is not attributable to this.

   Running the portal in a container and letting the adapter share its network namespace avoided the gateway entirely.
2. **What would make the next one easier.** `run.sh` now does all of this in one command, reusing an existing local build's dependencies offline.
3. **What changes downstream.** The tools work; what remains is agent behaviour on a real layer task (does it use the three tools as the card asks, and write useful follow-ups?). That needs one live turn.
4. **Questions.** The live turn is now done. Open: should layer submissions carry structured per-criterion checks? And a live run of `aludel_layer_commit` is still needed on a task that requires a real layer change.
5. **Process change.** The repeatable check was applied and passed twice: once built by hand in the scratchpad, then from a clean start via `run.sh`. The workflow prompt change was tested once, live, and the agent followed the layer method.
