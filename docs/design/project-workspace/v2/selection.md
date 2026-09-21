---
id: project-workspace-v2-selection
kind: scoped-review-record
status: selected-with-design-refinement
updated: 2026-09-20
---

# D-02R — Structural selection and next-slice preparation

## Authoritative owner signal

Portal decision `QUESTION-c7d97a79-dc0b-4de0-9665-63e157f5efa2`, answered revision 2, recorded at 2026-09-21T01:30:15.133Z (2026-09-20 local). Proposal `PROP-22d2e9e3-8f0a-4d7e-8b2e-a53d9665c1f8` remains revision 2.

Answer: **A: product areas; planning/history first**.

Owner rationale: “go a, makes the most sense. my question would be - don't reviews belong in the work feature, as last step of the request -> build pipeline?”

Accepted scope: product-area structure A and planning/history first, for detailed design. This does not accept every page composition, authorize PW-01 implementation, or retroactively accept a build. The original [v1 strategy](../v1/structure.md) and its manifest remain historical review inputs, unchanged.

## Design refinement carried into D-03

Agent response: yes, Reviews belongs under Work in navigation. Product and Design describe the enduring product; Work owns the change lifecycle through review. A review remains an independently linkable record/detail because it has an exact artifact, input revisions, evidence and scoped owner judgment. Navigation grouping does not require merging its domain lifecycle with execution. Acceptance does not implicitly release an artifact.

```text
Project
├── Overview
├── Product: Direction · Roadmap · Features
├── Design: Views & journeys · System · Explorations
└── Work: Requests & proposals · Plan · Active · Reviews · History

Utilities: Decisions · Sources · Settings
Contextual entries: Overview attention → work review
                    Design exploration → work review of that artifact
```

This is the agent's resolution of the owner's placement question, to be made concrete in D-03. Do not mislabel the question as blanket owner approval of a new review composition. Collection/detail identity, browser return behavior and direct entry from Design must be specified. Existing review URLs should remain resolvable when a future implementation changes navigation.

## D-03 preparation and readiness

Prepare one scoped item against proposal r2 and decision r2: Work Plan/History collection/detail and native plan editing design, plus bounded migration/reconciliation proof on disposable data. Include Work/Reviews placement in the parent map, but do not expand the packet into implementation of the full review engine. Inputs: selected A, this refinement, v1 audit/contracts/delivery plan, accepted MD3 foundation and the Work navigation post-hoc.

Output: inspectable first-slice interaction design, realistic historical/live/planned records, explicit source-to-plan mappings and conflicts, transactional replay/stale-input/failure/restore evidence from a disposable rehearsal, and a readiness verdict for PW-01. Production feature implementation and live migration remain excluded. Missing/failed evidence returns to groundwork; consequential design forks are surfaced in the portal.

Verdict: ready to authorize D-03 groundwork. No active work item was authorized when the decision was read; the previous strategy item is submitted and its predecessor cancelled. The new ready item does not authorize itself.

## Post-hoc / handoff

- **Observed friction:** v1 grouped Reviews as a peer navigation area because review has distinct artifact/acceptance semantics. The owner questioned that placement within the actual change journey. Domain separation alone did not justify top-level navigation.
- **Applied improvement:** distinguish record authority/lifecycle from navigation ownership; assign review a home in Work while preserving contextual entry and exact artifact identity. Carry this explicitly in D-03 scope instead of silently changing the frozen v1 artifacts or reopening the whole strategy.
- **Evidence/limits:** saved decision r2 demonstrates A/priority selection and the placement question. The revised map resolves responsibility on paper; comprehension and interaction remain D-03 review checks.
- **Downstream effect:** D-02R complete; next pointer D-03. PW-01 still requires scoped design readiness and implementation authorization. B-03 owns immutable candidate review, isolation and recovery; its semantics are unchanged.
- **Question disposition:** no further owner answer is necessary to prepare this refinement. Detailed Work/Reviews composition remains future design work, not an accepted page. New external effects, phase transitions or spending are not authorized.

Prepared item: `WORK-7a16bfe6-4a20-4e0c-bc04-3d9d9cd038f1`, version 1, state ready, snapshots proposal r2 and answered decision r2. [Open D-03 in Work](http://127.0.0.1:4310/#/the-machine/work/WORK-7a16bfe6-4a20-4e0c-bc04-3d9d9cd038f1).
