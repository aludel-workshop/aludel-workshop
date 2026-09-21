# B-03A — supervised portal cycle

2026-09-20. Implementation checked; first real owner cycle still pending. [Intake](../design/process/b-03a-intake.md), [operator procedure](../design/process/portal-operator.md), DEC-028.

## Outcome and evidence

Ideas persist in the request inbox; scoped work snapshots its proposal/decision inputs and displays success criteria and effect boundary. Owner-only authorization, answer/resume and cancellation use authenticated API operations. The trusted local CLI prepares/claims work and records progress, questions, failures and evidence without reading owner credentials. Transactional version checks and events preserve the handoff. Changed proposal/decision inputs stop execution; prepare a fresh item rather than silently rebinding authorization.

Observed checks:

- `node --test apps/portal/tests/*.test.mjs`: all three test files passed, including restart persistence, rejected pre-authorization claim, owner/operator separation, stale version/proposal rejection, wrong-attempt rejection, answer remaining paused, cancellation blocking submission, and acknowledgement.
- `npm run typecheck` and `npm run build`: passed. Existing large-bundle advisory remains.
- `tests/workflow-browser.mjs`, disposable database on port 4312: real browser request → operator proposal/preparation → owner authorization → claim → question → owner answer → explicit resume → claim → evidence submission passed. No browser page errors; axe WCAG A/AA checks passed; 390px width had no horizontal overflow.
- Browser artifacts: [wide](../../apps/portal/test-results/workflow-wide.png), [narrow](../../apps/portal/test-results/workflow-narrow.png). Narrow screenshot inspected.
- Updated server started successfully on existing port 4310 with the existing database. Operator inbox read succeeded; real inbox/tasks were empty. No fixture work or owner authorization was inserted in the real database.

Browser reproduction needs the existing Playwright installation and `LD_LIBRARY_PATH=/tmp/app-builder-d01b-browser/libs/usr/lib/x86_64-linux-gnu`. Use a fresh disposable test data directory; the browser fixture expects first-run setup. Listening and Chromium need the environment's process/network approval.

## Limits

This is a trusted local supervised bridge, not a sandbox/security boundary against a collaborator with filesystem access. Cancellation is cooperative. No background watcher, lease expiry, automatic retries, external tracker/runner integration, immutable preview service or artifact acceptance is claimed. Event history and evidence are available in Work; DEC-026 full review-bar migration remains B-03B. The agent must check state before meaningful work segments/effects. Actual Symphony compatibility needs adapter work and recovery verification after owner interface validation.

## Retrospective

1. Observed friction: the old packet combined authorization UX with tracker/runner/preview integration, leaving no operational intermediate cycle. The shell sandbox hid the live process and blocked listening/Chromium; the browser also needed its existing library path.
2. Applied preparation: split B-03A/B, document the operator commands and runtime prerequisites, retain a repeatable isolated browser fixture. Future value beyond this trial is a hypothesis.
3. Plan change: portal state now routes runtime work; Markdown status only routes engineering context. Full B-03 stays incomplete. Runner work follows the first owner cycle.
4. Q-002 is resolved for supervised local scope by DEC-028. Q-005 exact candidate readiness and Q-008 external reconciliation remain open before those effects. Owner usability acceptance of this interface is pending.
5. Tested process improvement: the same domain operations carried an actual browser/operator handoff with rejected unauthorized/stale transitions and persisted answers. This demonstrates bounded protocol behavior, not autonomous-worker recovery or owner acceptance. Updated AGENTS, architecture, knowledge/product notes, decision register and downstream packets now consume the distinction.

## First real owner-cycle finding — 2026-09-20

The real owner cycle exposed missing collection/detail navigation that the single-item fixture did not test. [Correction and post-hoc](b-03a-work-navigation.md) records the cause, two-item regression and scoped limits. The `test-results/workflow-*.png` links above are rolling outputs and now show the correction run, not retained screenshots of the original run. Historical pass claims above describe the original checks; owner usability acceptance is still not inferred.
