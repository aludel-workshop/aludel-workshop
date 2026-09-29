# WORK-AGENTS-01 — layer-owned action groundwork

Date: 2026-09-29. Candidate branch: `feature/layer-app-model`. Owner correction: actions move under their owning layer; Work roles leave the target domain, while Work retains assignment, authorization, runs and review. Existing layer actions are to be reconsidered during LAT conversion.

## Applied process change

The old role catalog combined four separate concerns: layer identity, action definitions, elevated membership and Dreamer/Planner/Tinkerer assignment presets. Deleting roles before separating those concerns would risk losing historical Work references or widening permissions. The groundwork starts with a typed, pure declaration check and a migration ledger, then leaves action inventory and runtime cutover to the layer packets. The [target contract](../../../aludel-workshop/docs/design/work-agents/layer-owned-actions.md) and DEC-051 state the boundary.

## Candidate artifact and checks

`apps/portal/server/layer-action-contract.mjs` compiles stable `<layer>.<action>` IDs from layer declarations without a Work role. It checks output ownership, named reads and effects, safe relative file-scope syntax, exact adapter output and supported performer, elevation, review checks and human/agent seeds for all three styles. It derives the initial assignee only when that performer exists and the exact adapter supports it; a missing adapter leaves the action unavailable. This is a declaration validator and assignment seed, not a runtime permission gate. The old role-backed runtime remains intact so existing work and the submitted Pages proposal are not changed by this groundwork.

`node --test apps/portal/tests/layer-action-contract.test.mjs`: 3/3 pass. Negative fixtures cover foreign outputs, undeclared reads, invented effects, unsafe file path, mismatched adapter, missing agent adapter, incomplete style map, elevated agent default and file writes on a proposal action. `node --check` and `git diff --check` pass. No model turn, external write, promotion or current-portal change occurred.

## Retrospective and handoff

1. **Friction:** action IDs were layer-qualified already, but authority came from a mandatory role parent and a central `roles.json`; work style was stored yet its assignment effect was hidden after onboarding.
2. **Reusable preparation:** separate action ownership, explicit permissions, performer support and initial assignment in one validated declaration before moving a layer's UI or records.
3. **Downstream effect:** LAT-06 redefines Pages/Vision and the Code observation path; LAT-07 handles the other built-ins; LAT-08 migrates old records, permissions and UI. Do not copy old action lists verbatim.
4. **Open questions:** each layer still needs a useful action inventory and real output adapters. Runtime grants, elevated file access, and no-story Pages work require implementation and evidence; the pure compiler does not settle them.
5. **Applied versus predicted:** declaration failures and assignment behavior passed isolated tests. Safety under live Work dispatch, data migration and owner usability remain predictions until those packet gates run.
