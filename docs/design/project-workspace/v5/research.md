---
id: project-workspace-v5-pattern-research
kind: current-pattern-comparison
status: agent-checked
updated: 2026-09-20
accessed: 2026-09-20
---

# Current planning, triage, dependency, and agent patterns

This bounded comparison uses vendor primary documentation to identify useful interaction patterns. It does not select a vendor, create an account, or prove that a documented capability works in this environment.

| Source | Documented pattern | Borrow | Avoid / boundary |
|---|---|---|---|
| [Linear conceptual model](https://linear.app/docs/conceptual-model) | Issues are the unit of work; projects group issues around an outcome; milestones organize project work; initiatives connect projects to broader goals; views are projections of the same work | Separate stable records from views; outcomes above work items; milestones/phase checkpoints; one record set with several projections | Copying Linear's team/cycle hierarchy into a single-owner product without evidence |
| [Linear initiatives](https://linear.app/docs/initiatives) | Strategic objectives group projects, with progress/health rolled up from contributing work and flexible labels for cross-cutting themes | Outcome-oriented aggregation and explicit health; cross-cutting tags rather than forcing every relation into a tree | Treating task completion as proof of product outcome; enterprise-only saved initiative tabs as a dependency |
| [Linear timeline](https://linear.app/docs/timeline) and [project dependencies](https://linear.app/docs/project-dependencies) | Timeline intentionally separates high-level projects from granular issues, supports milestones and project dependencies | Keep the default plan readable at outcome/initiative level; expose detail on drill-in; dependency/timeline as a synchronized projection | Putting every granular work item on the default timeline; automatic date movement before policy is proven |
| [Linear triage](https://linear.app/docs/triage) | Incoming work is reviewed before workflow entry; rules can suggest/reroute; related/duplicate intelligence assists review | Durable intake distinct from planned work; deliberate classify/link/merge/defer/convert event; surface likely duplicates as proposals | Automatic conversion or prioritization; triage elapsed time as permission |
| [Jira Plans dependencies](https://support.atlassian.com/jira-software-cloud/docs/view-and-manage-dependencies-in-advanced-roadmaps/) and [dependency view](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-dependencies-report-in-advanced-roadmaps/) | Plans provide timeline/list/summary projections and a dependency map; dependency arrows can signal off-track relationships | Dedicated dependency projection filtered to meaningful edges; warnings as derived evidence, not a second state authority | Premium product complexity, full scheduling engine, and dense dependency diagrams as the default owner view |
| [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) and [roadmap layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-roadmap-layout) | One project can be viewed as table, board, or roadmap; grouping can aggregate numeric fields | Several saved projections over one record set; board remains optional; grouped aggregate values | Making repository issue metadata the portal's product authority |
| [Linear agent interaction](https://linear.app/developers/agent-interaction) and [coding sessions](https://linear.app/docs/coding-sessions) | Agent sessions have visible pending/active/error/awaiting-input/complete/stale states, activities, external links, and issue context; completed changes move into review | Separate work item and attempt/session lifecycle; show meaningful activity, waiting/error, and direct review/context links | Equating an agent with a human assignee, starting from mere priority, or adopting paid managed sessions during the zero-cost bootstrap |

## Recommendation

Use an outcome-oriented outline as the Development Plan default because it answers why, progress, and drill-down with the least visual machinery. Add a dependency/timeline projection over the same nodes for sequencing and rollout analysis. Keep a board as a later optional view when repeated flow management demonstrates value. Agent Operations is a separate operational projection because capacity, attempts, leases, waiting input, and run metrics are not plan hierarchy fields.

The v5 prototype tests this recommendation. Evidence that would reverse it: the owner cannot find critical dependencies without the map as default; aggregate outline state hides material work; or plan/agent separation creates repeated navigation with no comprehension benefit.

