---
id: d01b-prototype-readiness-v1
status: ready
updated: 2026-09-19
depends_on: [portal-structure-v1, portal-structure-review-v1]
---

# D-01B interaction prototype readiness

## Verdict

**Ready for one bounded local interaction prototype using selected direction A.** D-01D establishes the parent structure required by D-01B. Readiness applies only to the experiment below; it is not implementation approval and does not resolve Q-002, Q-004 or Q-005.

## Questions and fidelity

Use a local browser prototype because the remaining questions concern navigation, state transitions, progressive disclosure and response actions. Static frames have already answered the structural-direction question. Production framework, live integrations, hosted preview and visual polish would add no evidence needed here.

The prototype should answer:

1. Can the owner predict and follow decision → affected Work collection → named task without mistaking a recorded answer for execution?
2. Does one task page keep intent and its state-dependent action clear across Ready, Running, Awaiting input, Failed and Awaiting review?
3. Does the authorization checkpoint feel sufficiently bounded and trustworthy without slowing the path unnecessarily? Its scope remains fictional and does not answer Q-002.
4. Can the owner review one immutable candidate, understand currency and missing evidence, and choose revision or acceptance? Owner feedback refines Q-005.
5. Does selected shell A preserve project and return context on wide and narrow screens? Owner feedback informs Q-004.

## Included experiment

- BorrowBox only; selected project workspace A.
- Overview, filtered Work collection, BB-D01 detail, BB-001 task detail and A1 candidate review.
- Happy path: answer → inspect affected work → authorize BB-001 → follow simulated progress → review A1.
- Revision, stale artifact, worker unavailable, connector ambiguity, failed attempt, blocked agent input and cancellation-uncertain states from the accepted transition contract.
- Zero/one/many affected-work fixtures sufficient to verify collection routing.
- External review guide with at most three tasks and explicit simulated boundaries.

Excluded: portfolio Attention alternative B, full project planning or releases, production data, real Linear/Symphony/Codex behavior, external deployment, real source changes, merge/release controls, final visual system, and unrelated BorrowBox application work.

## Required contracts and checks

Use [structure revision 1](structure.md), the [accepted review record](review-record.md), D-01C Overview B's retained hierarchy, the BorrowBox fixture and the D-01A lifecycle states. Every major product region must trace to C1–C10 in the structure contract. Scenario controls and review instructions stay outside the product shell.

Before owner review, verify route identity and back paths, no arbitrary first-task jump, separate decision and authorization mutations, current/stale acceptance rules, narrow layout without horizontal overflow, keyboard navigation and visible focus, labeled controls, retained state after refresh where the prototype claims durability, and clear simulated-data labels. Automated checks establish fixture behavior and inspectability; they do not establish usability.

## Review and return path

Ask the owner to complete no more than three tasks: resolve and trace a decision, authorize/follow BB-001 through one exceptional state, and review current then stale A1. Record observations and acceptance separately for navigation, task interaction, authorization, and review evidence. Return to D-01D if a page responsibility or transition fails; otherwise revise the prototype interaction within D-01B.
