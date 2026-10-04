# J8 owner trial

The owner runs this in the normal portal UI, signed in as themself. Claude prepares and records it, but never takes these actions for the owner. The plan's exit evidence is the owner's actions plus a retrospective that answers the five closing questions.

## Change from the plan (proposed 2026-10-04, owner to confirm)

The plan had two trials: (1) Biome Work #3 as a journey claim and (2) an imported onboarding scenario on a Code-only project. Biome can't hold journeys, because it was forked from an older Code template and existing projects have no way to take a template update. The owner has called Biome a throwaway. So both trials run on **one fresh project**, made from today's template:

- Specify writes the journey and proves it with a **record claim**.
- Accepting the Specify item raises Implement, which carries **journey claims** on the new steps. That is the journey-claim trial Biome would have run.

The template-update path becomes a separate packet.

## Before starting

1. Merge PR #2 (J7) into `main`. Pull `main` locally, then restart the portal.
   - That restart runs the J4 claims migration. Existing items keep their criteria as `note` claims, and their saved run verdicts are rewritten to match. This migration was rehearsed on copied data.
2. Docker must be running: the review build and the journey step tests use it.

## Trial

1. **New project.** Create a project with an app (auth on), using the normal flow. Code installs from the current template, and its generated app already has the review recipe and the preview-only setup route.
2. **Ask for a change without writing criteria.** Under **Code › Tasks**, create a task about a route that has no journey yet, for example "Invite teammates: from /settings, a member invites people by email." Don't type any criteria.
   - Expected: *No journey covers /settings yet* and a **Specify first** offer.
   - Measured: whether you wanted to write free-text criteria anyway. This tests the reference-first rule (J4 retrospective).
3. **Specify.** Take *Specify first*, then assign it to yourself or to an agent.
   - Its claims are the journey record and "every other journey still passes".
   - As a person: commit `.aludel/outputs/journeys.json` (one persona) and a characterization test in `.aludel/journeys/<id>.spec.mjs`. Then use **Check my branch**, then **Ready for review**.
4. **Review the Specify run.** Open **Review**, check the journey's claim and **Walk the journey** in the preview, then accept.
   - Expected: Implement is raised, claiming only the steps the app doesn't do yet.
5. **Implement.** Assign Implement to an agent, or do it yourself with *Check my branch* before submitting.
   - Review walks the journey's claimed steps on the built candidate: step marks, flags with notes, then Finish.
6. **Tell Claude in the thread what felt wrong.** Each note becomes a line in the retrospective.

## What Claude records afterwards

- Run log: what was done, the item references, and screenshots you share.
- Answers to the five closing questions.
- Updates to `docs/status.md` and the handoff.
