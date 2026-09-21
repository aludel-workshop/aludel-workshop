# Aludel

A portal for turning product intent into reviewed, deployed products, beginning with its own development.

This workspace is now in **M1 implementation**. A private local foundation is running with the accepted MD3 interface, structured SQLite records, owner access, and idempotent import of the Markdown seed corpus. No external project, hosted deployment, paid service, tracker, or agent runner has been created.

## Run the local portal

```sh
./launch-machine
```

Open <http://127.0.0.1:4310>, choose an owner access key on first run, and keep it in your password manager. See the [portal README](apps/portal/README.md) and [B-01 evidence](docs/evidence/b-01-local-foundation.md).

To connect the portal to GitHub and create its repository, follow the [step-by-step GitHub App setup walkthrough](apps/portal/README.md#github-app-setup). It covers app registration, permissions, credentials, local configuration, the in-portal owner flow, verification, and recovery.

## Start here

For an agent receiving “go,” begin with [AGENTS.md](AGENTS.md), then [current status](docs/status.md) and [the execution plan](docs/execution-plan.md).

1. [Current status](docs/status.md): current phase, blockers, completed evidence, and exactly what happens next.
2. [Execution plan](docs/execution-plan.md): bounded work packets and phase gates.
3. [Product definition](docs/product.md): experience, product model, and what makes this useful.
4. [Research findings](docs/research.md): dated primary sources, alternatives, implications, and gaps.
5. [Architecture proposal](docs/architecture.md): replaceable integrations, execution, knowledge, and self-development.
6. [Milestones and validation](docs/roadmap.md): the smallest complete loop and how to prove it works.
7. [Decision inbox](docs/decisions.md): questions for the owner, assumptions, and next research tasks.
8. [Software-factory context](docs/software-factory-context.md): Symphony reuse and Cofounder's role in the comparison.
9. [Launch LMS case study](docs/references/launch-lms-case-study.md): working deployment, Symphony, review, and recovery patterns, with explicit cautions against copying its accumulated complexity.
10. [Product-development workflow](docs/design/product-development-workflow.md): the traceable path from product intent through research, page/component design, prototypes, implementation, and review.
11. [Knowledge strategy](docs/knowledge-strategy.md): database, repository, artifact, and fresh-agent context responsibilities.

**Confirmed first milestone:** a private portal for one owner managing several projects, where you can request a change and review an agent-built preview. Start with a change to the portal itself. Use free tiers where feasible and the existing ChatGPT Plus coding allowance, with owner-selected work and a Go button. A local worker is the proposed low-cost bridge to later server execution. Live release and recovery follow; a second simple product tests generality.

These Markdown records use stable IDs and metadata so the future portal can import them. They are the initial knowledge corpus, not a substitute for the eventual in-app experience. Read [the decision inbox](docs/decisions.md) before treating any implementation choice as settled.
