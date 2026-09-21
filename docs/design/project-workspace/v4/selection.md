---
id: project-workspace-v4-selection
kind: scoped-review-record
status: revision-requested
updated: 2026-09-20
---

# D-03R — Work interaction revision requested

Portal decision `QUESTION-0b429660-5753-4cc3-9092-0d878c1fb14e` revision 2 records the owner answer **“Revise Work lanes or details.”** The rationale points to [the revised intake](intake.md) as the preferred structure.

The D-03 lane prototype remains agent-checked evidence for collection/detail routing, draft retention, error states, accessibility, provenance, and safe reconciliation. Its Plan/Active/Reviews/History decomposition is rejected as the PW-01 feature structure. Do not implement it as the navigation model.

The replacement direction organizes Work around owner and execution jobs:

- Work Overview for owner attention and current movement;
- Development Plan for phases, outcomes, feature/initiative groupings, work, progress, dependencies, and contextual actions;
- Agent Operations for ready queue, capacity, active attempts, progress, interventions, metrics, and run history;
- Intake for durable signals and recurring triage/group/prioritize/convert work.

History and review remain properties, filters, details, and contextual actions on authoritative records. They are not peer feature areas. The Development Plan is a hierarchy plus typed dependency graph with several projections, not a strict tree or a second task authority. Foundational Product and Design records remain authoritative; the plan consumes exact revisions and reports progress without claiming that task completion proves product outcomes.

Next: prepare a bounded D-04 feature revision and executable prototype. It must compare credible plan representations, test the four connected surfaces with realistic Machine data, and finish with a scoped owner review before any PW-01 implementation. D-03's reconciliation contracts can be reused where they remain valid; live migration remains excluded.

