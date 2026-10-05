# How this thread worked versus the system it designed (AGENT-WORK-01)

Owner, 2026-10-04: "before we actually hit this plan off, i want a little meta analysis of this agent work thread … how does this process compare to the one we are literally designing? in which ways do the interfaces and knowledge systems improve product quality, and to what extent are we hampering ourselves?"

Evidence is this thread's own record: the [work record](work-record.md), five commits on `claude/agent-work-prototype-7en0jx` (`eb479c1`, `3aff8d3`, `2e6ed64`, `e17c472`, `9c586af`), four prototypes (about 2,500 lines of HTML), and J6's earlier prototype rounds ([journeys work record](../journeys/work-record.md)), which followed the same pattern. Observations are marked **seen**; anything else is **inferred**.

## What actually happened, in the new system's terms

| What we did | The designed equivalent | Fit |
|---|---|---|
| Your root message, "ready to pick up the agent work revamp", with a proposal behind it | A rough Draft, then Go | Same |
| I wrote the scope into the work record and built A0 v1 straight away | **Defining:** questions on the brief, then the item moves to Ready | Different. There was no question stage. The prototype *was* the question, and your richest input (round 1, thirteen points) came after seeing it (seen) |
| A0 v1 → v2 → work ecosystem → Pages review → plan | Actions, with new ones added and approved as the work informs | Same, and it validates the design. The original A0 scope predicted none of the last three (seen). Planning them up front would have been wrong |
| You looked at each prototype and replied in prose | Per-action review | Same idea, but different input. 21 review questions (Q1–Q8, E1–E7, P1–P6) went unanswered in the drawers built for them. Your direction came as prose and "i like it" (seen). J6's rounds ended the same way (inferred from its record) |
| I turned your prose into F1–F13 and G1–G6 tables and changed the plan | The orchestrator turns notes into action changes | Same. This was the most valuable thing the thread did |
| I used an inventory subagent for the plan | Host Explore agent | Same |
| The thread survived a context compaction mid-round and resumed from the summary and the work record | Resume the same session from durable state | Same. The work record carried it (seen) |
| One draft PR carries four prototypes and the plan | Close-out merges the whole changeset once | Similar. The PR is only a carrier; nobody reviews it as code |

## Where the interfaces and knowledge raised quality (seen)

1. **Recorded evidence made the mockups credible.** Biome's recorded screenshots and flow (`docs/evidence/biome-review/`) are why the Pages review mockups look like the app. The A0 frames, built without that evidence, were the "skeletal" ones you flagged (G1).
2. **Accepted designs kept their parts, once someone checked.** Round 1 found that A0 v1 had silently dropped the work item framework. After the parent-structure rule was added, each later round listed what it kept, and nothing else was lost.
3. **Standing rules carried over.** The one-persona rule (memory) shaped every flow without being restated. Pages' four note kinds (PAGES-UX-01) became the review notes.
4. **The walkthrough harness caught real problems.** Each round's browser check and screenshot review found two to four genuine defects before you saw anything (overlap, clipping, scaling, wording).
5. **Durable records allowed a cold resume** after compaction, with no re-asking.

## Where we hampered ourselves

1. **Feedback channels nobody used.** Of 21 review questions, 0 were answered in the drawers (seen). They cost build and check time each round. The designed system's answer, notes pinned on the thing plus questions on the action, is better. The prototypes themselves didn't use it.
2. **Records outweighed the reading.** Each round wrote authorization, process-first, readiness, questions, checks, a five-part retrospective, a status line, a PR body rewrite and a reply. The status line was rewritten six times and the PR body three times (seen). Three of four retrospectives said, in effect, "nothing new." AGENTS.md asks for a retrospective when a *packet* completes. I applied it to every *round*, which is over-application (inferred).
3. **The same facts in up to six places:** the work record, status.md, proposal.md, plan.md, the PR body and the thread. In the designed system the item page is the one source, and the board and status derive from it.
4. **Aludel did not build Aludel.** The prototypes aren't Pages records, the Biome kit is hand-written, and the plan rebuilds A3 in Angular from scratch. Every prototype is throwaway, and its translation into product code is a fresh, lossy step (inferred).
5. **No view of the whole goal.** Each round reset the status checklist. Nothing showed "4 of 5 actions done; the plan waits on your go," which the designed item page would have shown (seen: checklist resets).

## The counterfactual: this thread inside its own framework

- **W-n "Agent work needs to be far more free-form" (Draft).** Go makes Claude read the proposal and the accepted Work pages. It asks one or two questions and drafts action #1: *Pages: the work item page with a live agent*. The item moves to Ready.
- **#1 runs and lands as HTML pages in Aludel's own Pages layer.** You review it in the flow walker, **previous (the accepted item page) beside proposed**. The dropped item framework shows as a red "removed" outline on the first look. That is the round-1 miss, caught structurally instead of by you.
- **Your notes pin to elements.** "Keep the item framework" pins on the run block, and the orchestrator concept becomes a change to the actions. #1 is fixed in the same session.
- **New actions arrive as approve cards.** #2 is the board, routines and projects. #3 is the Pages review action, which reviews itself. #4 is the plan. Each gets one click.
- **A gate before any Code actions.** That is where we are now: waiting on your go.
- **The prototypes become A3's input,** since Pages files are already HTML on a kit, rather than being re-drawn in Angular.

The framework would have removed (2), (3) and (5) by design, and caught round 1's regression automatically.

**What it would have hurt (inferred):**
- **Interaction prototypes don't fit a page spec.** A0's timed agent events, Play/Step and scenarios are behavior, not pages. Pages as designed (static HTML on a kit, with states) could not host our best artifact. Pages needs **scripted scenarios**: timed state changes across pages. Without them, the framework pushes design back to static screens.
- **Layer boundaries could slow a loose design phase** if every idea had to be filed into Pages, Design or Code first. The defining stage has to allow one free-form action whose output is "a prototype", sorted into layers later.

## Proposed streamlining (not applied; your call)

**For the plan:**
1. **Dogfood locally, early.** Move the local work style (A8) ahead of the remote runtime (A2). The order becomes A1 → A3 → A8 → A4. Then this item's own remaining work runs as a real Aludel work item, with Claude Code working locally through the MCP server and reviewed in the new item page.
   - This needs no Anthropic API billing, because the local agent uses an existing subscription. So D1 stops blocking the first milestone.
   - A2 (the remote SDK orchestrator) follows when D1 is settled.
2. **Add scripted scenarios to Pages (A7).** Timed states across pages, so interaction prototypes like these can live in the Pages layer.
3. **Prototype on Aludel's own kit.** Give the portal an HTML kit (A7 applied to Aludel itself), so prototypes are built from it and A3 starts from the prototype's markup.

**For the process now (AGENTS.md and the operating procedure):**
4. **A round gets a three-line note, not a retrospective.** That means what changed, what was checked, and what waits on you. The five-question retrospective stays at packet close.
5. **Ask one or two decisive questions in the reply.** Drop review-question drawers from prototypes; your prose and pinned notes are the real channel.
6. **Keep each fact in one place.** status.md keeps a single pointer line; the PR body points to the work record; the work record is the source.

**Test for these:** the next round should cost visibly fewer record edits. Concretely, one status edit and no PR body rewrite per round, with no loss of resumability. A fresh agent should still be able to reconstruct the state from the work record.
