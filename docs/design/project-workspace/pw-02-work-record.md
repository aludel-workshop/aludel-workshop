---
id: pw-02-product-workspace
kind: work-record
status: complete
updated: 2026-09-21
packet: PW-02
---

# PW-02 — Product workspace and navigation migration

## Authorization and scope

The owner instructed “go ahead and implement” in the current chat on 2026-09-21 after reviewing the recommendation to continue proposal revision 2 through PW-02. Under DEC-029 this authorizes bounded local repository research, design, implementation, tests and local preview for this packet.

In scope: a project-scoped Product area with Direction, Roadmap and Features; revision-safe local authoring over explicit product records; reuse of the accepted Work shell and MD3 patterns; migration of primary navigation toward the selected project-area structure; compatibility paths to existing proposal, decision, source, review and brand records; responsive, accessibility and regression evidence; and durable closeout updates.

Out of scope: external services or writes, deployment, spending, release, worker/Symphony integration, immutable candidate review, live provider telemetry, a Design registry, contextual preview inspection, multi-project creation and acceptance on the owner's behalf.

## Process improvement applied before construction

Proposal r2 selected responsibilities rather than a cosmetic refresh. Before editing navigation, map each current route to its target responsibility and preserve its record identity:

| Current route | Target responsibility in selected structure | PW-02 treatment |
|---|---|---|
| Overview | Project attention and current outcome | Retain; align navigation only |
| Proposals | Work intake/change detail | Remove as a primary peer; preserve direct route and contextual links |
| Decisions | Project utility and contextual decision detail | Keep as utility; preserve direct route |
| Work | Intake, plan, operations, review/history lifecycle | Retain accepted implementation |
| Knowledge | Sources utility | Relabel primary entry to Sources; preserve `/knowledge` routes |
| Reviews | Work review lifecycle | Remove empty primary peer; preserve route until B-03B supplies real review records |
| Brand | Project settings | Relabel to Settings; preserve route and current brand behavior |
| Product | Direction, Roadmap and Features | Add as the first post-Work project-area slice |
| Design | Views, System and Explorations | Show only when implemented; remains PW-03 |

This matrix is the reusable check for future workspace slices: route labels follow owner jobs, while redirects/aliases preserve durable record URLs. It will be tested through visible navigation and direct legacy-route access.

## Readiness and implementation boundary

Inputs are proposal revision 2, the selected product-area structure, completed PW-01A, the accepted v9 Work composition and the PW-02 contract in the delivery plan. Product page compositions remain a bounded implementation candidate pending owner usability review. The build may reuse established shell, collection/detail, compact table, status, form and exceptional-state patterns; it must not claim that Work's page layout was accepted for unrelated jobs.

Implementation must classify visible values as authoritative, derived, policy or unavailable; support empty and populated records; retain drafts on revision conflict; ensure roadmap priority never authorizes work; and keep repository documents as cited source evidence rather than editable product state.

## Research gate added by owner

Before composing or implementing Product UI, the owner instructed the agent to research comparable products and structures, capture reference images, and borrow proven UX patterns liberally while realizing them through Aludel's accepted design system. No Product UI code had been changed when this instruction arrived.

Required research output:

- current primary-source evidence for product direction/briefs, roadmap or initiative planning, feature hierarchy and record detail;
- a small locally retained, attributed screenshot/reference set with access date and source URL;
- screen reading order, object granularity, navigation and interaction patterns to borrow or avoid;
- a synthesis mapping borrowed patterns to Direction, Roadmap and Features without importing another product's visual identity or authority model;
- reversal conditions and a readiness verdict before composition begins.

Construction pauses until this evidence exists. The result is research input, not automatic acceptance of a page composition.

The research gate passed on 2026-09-21 with [the primary-source synthesis and attributed reference set](pw-02/research.md). It changed the implementation boundary in three concrete ways: roadmap defaults to outcome horizons rather than an invented calendar; Features uses a canonical comparison list with contextual detail rather than a card board; and Direction defaults to reading with an explicit revision-aware edit action. These choices will be tested in the implementation rather than treated as proven by documentation alone.

## Closeout checklist

- Domain/API tests for initial state, no-op save, expected-revision conflict and dependent staleness.
- Browser coverage for all three Product routes, editing, direct legacy routes, wide/narrow layout, keyboard-visible navigation and accessibility.
- Existing Work lifecycle and server suites remain green.
- Record observed friction, applied process change, downstream effects, new questions and evidence-backed limitations before marking complete.

All checks above passed. [Implementation evidence and retained screenshots](../../evidence/pw-02-product-workspace.md) record the observed results.

## Post-hoc retrospective

1. **What made this harder than necessary?** The earlier proposal selected a responsibility model but did not map the flat live routes or distinguish roadmap source-of-truth from roadmap projection. Without the route matrix and research gate, it would have been easy to repaint the existing pages, duplicate Work state, or invent a calendar from tentative roadmap prose. The single-file Angular shell also makes a bounded feature produce unusually dense template and style changes.
2. **What will make the next equivalent task easier?** Keep the route-responsibility matrix and the source → pattern → Aludel mapping as required inputs for the remaining Design slice. A later engineering packet should split route surfaces into focused components, but that refactor was not needed to prove the Product contract and would have expanded this packet.
3. **What changed downstream?** PW-02 is complete and the next pointer returns to B-03B. Product now supplies revisioned direction/outcome/feature inputs that later planning can consume through explicit dependencies. It does not replace the execution plan or unblock automated review by itself.
4. **What questions changed?** Dates, saved audience projections, deeper hierarchy and prioritization formulas remain deferred behind observed usage and the reversal conditions in the research. Owner usability acceptance of this composition remains open; it does not block returning to B-03B.
5. **Which process change was tested?** The new research gate and route migration matrix were applied before UI code. The result changed the actual build—horizons replaced a speculative timeline, Features became list/detail rather than cards, and legacy routes survived the nav change. Browser evidence confirms those choices render and operate; only future owner use can establish whether they remain the right long-term composition.
