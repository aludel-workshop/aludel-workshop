---
id: product-001
kind: product-definition
status: proposed
updated: 2026-09-19
source: ../instructions.md
---

# Product definition

## Purpose

Help an owner work in product intent while people and agents carry that intent through research, design, implementation, delivery, and learning. Every delivered change should have an inspectable explanation of what problem it addresses, what was decided, what changed, and what evidence supports it.

The portal is its own first project. Its roadmap, research, questions, builds, and release history use the same project model as future client products. The portal's development infrastructure is not automatically a feature of the products it builds.

## Global structure and each product

Aludel is one of the products developed within Aludel. Shared capability and record contracts apply equally to it and other projects. Each project supplies its own intent, stories, design system, tools, code and operating configuration. The [coverage framework](product-system-framework.md) represents this relationship and explicit service provision, including self-development, without elevating portal-specific choices into universal defaults.

## Requirements from the brief

- Support the ambition of a demo in a day, testers using an MVP in a week, and a polished, maintainable product in a month. These are targets to measure for bounded projects, not universal delivery guarantees.
- Clarify rough intent through precise language, options, and interactive mockups.
- Connect product features to pages, data, APIs, work, and reviewable builds.
- Keep research and decisions usable by future agents and humans.
- Preserve a product-owned design system for each generated application: absorb supplied systems and brand sources, track deliberate deviations, assemble pages from governed patterns/components, and evolve the system from observed gaps rather than page-local invention.
- Discover improvement opportunities, prioritize them, implement selected work, and evaluate the result.
- Make process design and expert intervention possible; expose technical detail when useful.
- Move development into the live portal early, including server-side agent environments.
- Keep agent, hosting, and integration choices replaceable. Include design, analytics, and go-to-market in the long-term model.

## Owner clarifications (2026-09-18)

The first version serves just the owner, managing several projects. The first valuable milestone is requesting a change and reviewing an agent-built preview. The owner also confirmed low/no incremental budget, a preference for free tiers, existing ChatGPT Plus access, and willingness to prioritize work and authorize execution. The MVP should use a durable task-driven workflow comparable to Linear or Jira and remain structured for greater automation and server execution. Heavy unattended automation is deferred; the task model is not.

## Working assumptions, awaiting owner input

Web applications first; initial concurrency set to one while recovery is proven; an owner-operated local runner using subscription sign-in; a private authenticated portal; production release reviewed by the owner until a policy is agreed. The records and interfaces support multiple workers and higher concurrency. These remain implementation proposals except where accepted in the decision register.

## The main experience

The home view answers: **What needs my judgment? What is being built? What can I try? What did we learn?** A project opens on its current objective, next milestone, and latest working product, with a prominent decision inbox and review queue.

The owner's request becomes a change proposal. The portal shows its interpretation, acceptance examples, assumptions, and the few unresolved choices that materially affect the result. A question offers alternatives, a recommendation, consequences, and any affected work. Answering it updates the proposal and its downstream plan; the answer remains a durable decision.

For visual changes, the owner can try a small executable prototype. The system then proposes linked implementation work and runs the chosen tasks. A review contains the interactive build, relevant screenshots, acceptance checks, code diff, known gaps, and deployment impact. The owner can request changes with annotations or accept that version. A release records the exact reviewed artifact and its observed outcome.

Chat is an input and discussion surface. Decisions, requirements, and work must also exist as navigable records that do not require rereading a conversation.

The [product experience foundation](design/experience-foundation.md) turns this broad experience into an M1 user-story spine, information architecture, reusable interaction patterns, layout rules, and a prototype review contract. Individual screens and prototypes should trace to that foundation rather than introduce navigation or page structure independently.

The [product-development workflow](design/product-development-workflow.md) defines the finer chain from vision and research through feature, view, component, prototype, implementation, and evaluation artifacts. Its proportional policy keeps a small change lightweight while requiring alternatives and explicit rationale for a major page or workflow. The [knowledge strategy](knowledge-strategy.md) defines which of these records belong in the portal database, repository, object storage, and task-specific agent bundles.

## Example: the portal improves its decision inbox

1. Owner: “Show me which unanswered questions are holding up a release.”
2. Proposal: show unresolved decisions linked to release-blocking tasks; distinguish them from optional preferences.
3. Question: should a blocked task stop every task in the project? Recommendation: stop only dependent work.
4. Recorded decision updates acceptance examples: answering the blocking question unblocks that task; unrelated work remains available.
5. An agent builds the change on a branch, produces a preview, and supplies a test of those two behaviors.
6. Owner reviews the preview; the release references that build and decision revision.
7. Later usage measures whether time waiting for decisions fell. A poor outcome reopens the product hypothesis.

## Product information model

| Record | What it means | Important links |
|---|---|---|
| Project | Product, ownership, goals, constraints | Repositories, environments, connections |
| Outcome | Desired user or business change | Evidence, metrics, features |
| Feature / change proposal | A bounded capability or modification | Outcomes, acceptance examples, designs |
| Research record | Question, evidence, synthesis, confidence | Sources, affected decisions, expiry |
| Decision | A choice and its rationale | Options, owner, blocked work, superseded decision |
| System component | Page, service, API, data entity, or external dependency | Features, code locations, contracts |
| Work item | Implementable or investigative task | Dependencies, proposal revision, evidence |
| Run | A particular execution attempt | Agent, inputs, environment, events, costs |
| Artifact | Versioned deliverable | Build, mockup, document, screenshot, evaluation |
| Release | What became live and where | Artifact digest, review, migrations, rollback |
| Observation | Feedback or measured behavior | Release, outcome, proposed improvement |

Use typed relations and ordinary database tables initially. A feature can involve several components; a task can support several features. Avoid forcing a rigid tree or creating a separate graph database before queries justify it.

## Design and knowledge as reusable assets

Keep design intent, component examples, tokens, prototype source, screenshots, and owner annotations linked to a feature revision. Version executable prototypes in Git; store large media as immutable artifacts with provenance. Generated images are useful for exploration and assets; implemented components become the authority for interactive behavior.

Accepted designs can seed regression comparisons, but visual resemblance alone does not prove usability or correctness. Preserve exploratory alternatives as superseded references. Retire redundant mockups when the live component and its examples express the design, retaining the original decision history.

Research, client interviews, operational incidents, marketing experiments, and expert process advice share provenance and revision concepts, but retain their own types. Cross-project reuse starts with explicit promotion into a shared library; private client context stays scoped to its project.

## Development quality objective

Produce reviewable changes with clear journeys and page responsibilities, dependable interactions, and an explicitly selected visual direction. Treat these as separate evidence dimensions: a technically functioning prototype may still fail usability; a usable flow may still fail visual quality. Preserve enduring product semantics; reassess presentation and interaction grouping when owner feedback reopens them. DEC-021 treats the existing pages as wireframe evidence and requires intent/story/system-philosophy-led redesign. Prototype code and styling are not automatically implementation specifications.

The [D-01 retrospective](evidence/d-01-design-retrospective.md) supplies the initial evidence: v4 is owner-described as usable and fairly clear, but its appearance remains rejected. This refines delivery quality rather than expanding the first valuable milestone. Judge process improvement by earlier gap detection and reduced repeated rework when observed, not by artifact count; no efficiency gain has yet been measured.

## Improvement loop

Observe → deduplicate → propose → prioritize → implement → evaluate → retain or revert.

Start with CI failures and explicit tester feedback. Each candidate needs evidence, an expected benefit, estimated effort, and an uncertainty statement. Prioritize failures and milestone blockers before speculative refactors. Permit owner overrides and show the reason for priority. Bound background work by budget, concurrency, and retry limits; stop repetitive failures for diagnosis.

Changing prompts, agent choice, evaluation criteria, or workflow is itself a versioned change with before/after evidence. “Self-improvement” means measurable improvement to the product or delivery process, not an agent claiming its own changes are improvements.

## Experience principles

Show concrete progress and working artifacts. Make uncertainty visible without turning every small implementation choice into a question. Keep human editing, agent execution, and expert review equally legitimate. Allow the owner to inspect code and logs from the same record that explains the product benefit.

## Demo application for design and testing

Owner direction (2026-09-18): use an invented independent app in mockups to separate the portal from the products it creates. [BorrowBox](design/demo-app/borrowbox.md) is the canonical tool-library fixture: Aludel manages its decisions and tasks; the resulting app handles tool reservations. Its deterministic examples can later become an end-to-end creation test. This does not replace the portal as the first real project or authorize building/deploying BorrowBox now.


## Supervised local transition — DEC-028

The portal now owns the supervised request/authorization/question cycle. Repository status is a planning handoff, not execution permission. The trusted local operator uses shared transactional work operations with actor separation, exact input/version checks and durable events. See [operator contract](design/process/portal-operator.md). Automatic runner integration, leases/recovery and full immutable candidate acceptance remain B-03B; this bridge does not complete M1.
