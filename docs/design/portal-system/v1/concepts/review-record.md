# Overview composition review — v1

Status: owner feedback received; option 2 preferred for Overview, with revisions. Inputs: [view intents](../view-intents.md), [MD3 profile](../system-profile.md), the rejected v4 Overview used for content/failure reference only. [Manifest](manifest.json) binds prompts, images, actual dimensions and hashes. Generated with built-in Image Gen on 2026-09-19; no component implementation or production fidelity is claimed.

## Displayed order

The images appeared in this order in the main conversation: 1 — `attention-workspace.png`; 2 — `outcome-briefing.png`; 3 — `focus-and-context.png`. Selection must resolve against that observed order. An acceptance here concerns an Overview hierarchy/interaction hypothesis, not the shell, all pages or implementation readiness.

## Agent inspection

All three show the BorrowBox objective, a consequential policy decision, two affected tasks, independent catalog-description work and no current preview. All avoid the old stack of three unrelated section cards and expose an explicit Open decision action rather than saving/authorizing directly. These are visual observations, not tests of interactive behavior or owner comprehension.

| Artifact | Intent/principle expressed | Known issue to correct before implementation |
|---|---|---|
| attention-workspace | V02, MP1/MP3: selection and context form a list-detail relationship | Duplicate New request; invented Settings/Help destinations; bottom copy suggests validation can proceed after the answer without retaining its implementation dependency. Remove the extras and correct the consequence. Detail pane is dense for one question. |
| outcome-briefing | V02, MP1/MP2: outcome and causal obstacle lead to the next action; work uses comparable rows | Duplicate New request; “Proposed outcome preview” is awkward internal phrasing; ready-work checkmark can imply completed work. Retain one request entry and explicit Ready semantics. |
| focus-and-context | V02, MP2/MP3: one action supported by project/work context | Primary surface has excessive unused height; ready checkmark can imply completion; preview copy should say an identified candidate will appear when available, not imply successful completion alone guarantees one. |

The generated type, icons, logo marks, button geometry and surfaces are exploratory. They must be translated through actual selected library components and supported MD3 patterns, not copied as a parallel CSS system. Do not interpret the images as proof of Material conformance. The navigation shell remains a shared experimental convenience. Actual dimensions differ from the requested 1440×1024 and are recorded without resizing.

## Owner tasks and judgment

1. Identify what BorrowBox is trying to achieve and what is preventing reservation work.
2. Locate the next action and explain whether catalog-description work can proceed independently.
3. Select/refine the organization that makes those answers clearest for daily use.

Selection does not waive the recorded corrections. Later prototype checks must cover zero/multiple attention items, a reviewable candidate, stale/missing evidence, keyboard navigation, direct links, narrow layouts and response actions. No question about the real execution policy is answered by this fixture.

## Next step

Apply the recorded feedback through the v2 queue and placement contract, inspect the revised visual target and confirm component coverage before constructing the selected workshop slice. D-01F remains open; the full system and D-01E composition baseline remain unaccepted.

## Owner feedback — 2026-09-19

Owner describes the options as “categorically easy on the eyes and make much more sense,” except option 3's odd layout. Option 2 best conveys Overview. Option 1's list-detail may fit object exploration but is explicitly not approved across Work/Decisions/Reviews. Left navigation is preferred as a minor personal preference. The key-decision section must accommodate a stack of decisions. The owner also requires deliberate choices about directly visible content, expansions, modals and navigation as part of design philosophy.

Accepted scope: relative Overview hierarchy and visual improvement, with option 2 as the refinement basis. Not accepted: single-decision hero, universal list-detail, detailed navigation/behavior, component library or implementation readiness. [V2](../../v2/interaction-contract.md) applies the feedback and records a reusable placement procedure. Historical images remain unchanged.
