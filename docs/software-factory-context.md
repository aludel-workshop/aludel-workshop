---
id: research-002
kind: comparative-research
status: initial-pass
updated: 2026-09-18
---

# Software factories, Symphony, and Cofounder

The owner confirmed this project follows a discussion about software factories, **OpenAI Symphony**, and **cofounder.co**. These are useful architectural and experience references. This comparison is based on public documentation, not hands-on product evaluation.

## What each contributes

| Reference | Documented emphasis | Relevance to this portal |
|---|---|---|
| OpenAI Symphony | Issue-driven agent execution, per-issue workspaces, repository-owned workflow policy, retries, reconciliation, observability | Candidate execution foundation beneath product planning and review |
| Cofounder | Company workspace with scoped agents, departments, shared context, and human review; core product engineering remains outside its scope | Reference for organizing business work and expert knowledge alongside software delivery |
| This proposal | Intent, evidence, decisions, builds, releases, and learning across several products, starting with itself | Connect product formation to execution and operation, with owner-directed starts initially |

Symphony's specification excludes a rich web UI and general-purpose workflow engine. It allows runs to end at a human-review handoff and does not mandate strong sandboxing. Reuse would therefore still need a product model, review experience, artifact lifecycle, and explicit execution controls. It is an orchestration candidate, not a replacement for the whole portal. [Symphony specification](https://github.com/openai/symphony/blob/main/SPEC.md).

Cofounder's current introduction describes work around the product—strategy, design, marketing, sales, and operations—and explicitly excludes building the main application and its hosting/data stack. Borrow the organized context and review experience; evaluate its actual workflow before deciding whether any capability should be integrated or built. [Cofounder introduction](https://docs.cofounder.co/).

## Architectural consequence

Do not make “software factory” synonymous with maximum unattended execution. For this owner, the first factory is a repeatable path from chosen work to a reviewable result. Human prioritization and a Go button fit that path. Automation can later change who starts a task without changing what a task means or how its evidence is retained.

Keep three questions separate:

1. **What should exist, and why?** Product proposals, research, decisions, and acceptance examples.
2. **How does work get executed?** Runner, workspace, workflow policy, tools, and integrations.
3. **Did the result help?** Preview review, release checks, feedback, and outcome measurement.

The initial technical proposal should remain open to adopting Symphony beneath the portal. Compare an adapter to the existing implementation against a small owner-triggered runner. Evaluate task eligibility, tracker integration, manual start, cancellation, supported authentication, event export, workspace controls, and setup burden. Do not force the owner into an external tracker merely to match a runner's defaults. Confirm implementation capabilities and license at a pinned revision before reuse; reading a specification alone does not validate the code.

## Next research task

**R-06: execution reuse decision.** Review a pinned Symphony implementation and run the same tiny task through it and the minimal integration approach when implementation experiments are authorized. Record setup effort, intervention count, result visibility, and recovery behavior. Choose reuse if it reduces total work without making product records or providers difficult to change.

For Cofounder, inspect the task, library, and review interactions against a representative owner workflow. Record which ideas are useful and which gaps remain. No conclusion about its pricing, account eligibility, source export, or extensibility is established in this pass.

## Owner's working reference implementation

The owner's active [`launch-lms`](https://github.com/Life2LaunchLabs/launch-lms) and [`launch-lms-infra`](https://github.com/Life2LaunchLabs/launch-lms-infra) repositories contain a working Symphony and deployment system shaped by legacy projects and operational lessons. They are evidence of what has worked, not preferred starting architecture. The pinned review, transferable patterns, and complexity warnings are recorded in the [Launch LMS case study](references/launch-lms-case-study.md). R-06A must use that evidence alongside the upstream Symphony implementation.
