# J8 owner trial

The owner runs this in the normal portal UI, signed in as themself. Claude prepares and records it, but never takes these actions for the owner. The plan's exit evidence is the owner's actions plus a retrospective that answers the five closing questions.

The owner chose to keep **Biome** (2026-10-04). Biome was forked from an older Code template, so it first takes the new template as reviewed Work.

## Before starting

1. Merge J7 and the template-update work into `main`. Pull, then restart the portal. The restart does two things:
   - **The J4 claims migration runs.** Existing items keep their criteria as `note` claims, and their saved run verdicts are rewritten to match. This was rehearsed on copied data.
   - **Template updates are raised.** Each project layer whose template moved since it was installed gets one *Update … to the latest … template* item. Nothing is applied until you accept. Expect one for Biome's Code, and possibly for other layers and projects.
2. Docker must be running: the review build and the journey step tests use it.

## Trial

1. **Take Biome's Code template update.** Open the update item.
   - **No conflicts:** Aludel has already submitted the branch. Open **Review**, look at Changes and Under the hood, then accept. Biome's `.aludel/` now has the Journeys facet and the one-persona rule.
   - **Conflicts:** the item lists the conflicted files, and its branch keeps conflict markers in them. Check out that branch in Biome's repository, resolve the conflicts, commit, then submit it as your own run.
2. **Create the signup request without writing criteria.** Under **Code › Tasks › Create task**, enter a title and description for a new member signing up and setting up their first world. Set assignee/priority if useful, and save. Journeys and criteria are optional (DEC-064); Create must not interrupt with Specify or invent a charter criterion.
   - Expected at creation: the task saves directly with exactly your selected criteria and references. W-8 is the original trial record; do not replace it automatically.
   - At agent pickup: its first plan assesses affected journeys, preserves any owner attachments and adds uncovered steps with reasons. Multiple personas may require several journeys. No relevant journey is a valid conclusion for other kinds of tasks, with suitable review evidence.
   - For this signup change, missing journey coverage should lead to a Specify proposal; Biome may first need *Make the app reviewable*. A person can also deliberately choose **Attach journey → Specify a new journey**.
   - Measured: ease of creating the request, whether you wanted to add criteria, and whether the agent's journey assessment was correct. Code host/adapter checks demonstrate the contract locally; the real model-driven pickup remains part of this owner trial.
3. **Specify.** Write the journey (one persona) and a characterization test for what Biome does today. Use **Check my branch** to see each step's result, then **Ready for review**. Review it, walk it, and accept it. This raises Implement, claiming only the steps Biome doesn't do yet.
4. **Implement as a journey claim.** This is what Work #3 was for. Do it yourself (with *Check my branch*) or assign it to an agent. Review walks the claimed steps on the built candidate.
5. **Tell Claude in the thread what felt wrong.** Each note becomes a line in the retrospective.

## Afterwards (Claude)

- Run log with the item references and any screenshots you share.
- The five closing questions.
- `docs/status.md` and the handoff.
