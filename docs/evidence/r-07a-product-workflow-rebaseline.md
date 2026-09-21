---
id: evidence-r-07a
kind: research-evidence
status: complete
updated: 2026-09-18
packet: R-07A
---

# R-07A — Product workflow and knowledge rebaseline

## Trigger

Owner review of D-01B found that the project moved from a task-state brief directly into JavaScript. The prototype lacked an inspectable chain from product vision through user stories, product structure, view/component reasoning, references, composition alternatives, and a usable review plan. The same missing process would affect every product the portal creates. The growing Markdown corpus also showed that filesystem documents cannot serve as the long-term task, relationship, revision, and review database.

## Findings

1. **Prototype fidelity should follow the research question.** GOV.UK guidance distinguishes sketches for exploring basic ideas from code prototypes for realistic interaction research, and warns against treating prototype code as production code. The implication is that code should come after a question and selected direction, not serve as the default design medium. [Making prototypes](https://www.gov.uk/service-manual/design/making-prototypes) (accessed 2026-09-18).
2. **Research needs an explicit plan and feedback path.** GOV.UK recommends defining research questions, using only the rounds needed for the highest-priority questions, and feeding findings into planning and decision practices. The implication is that every portal prototype needs a review contract and every finding needs a path into durable product records. [Plan user research](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service) (accessed 2026-09-18).
3. **Implemented component examples can join documentation and testing.** Storybook documents component stories alongside prose and exposes isolated states; those stories can support render, interaction, accessibility, and visual testing. This is a candidate for the implementation stage, after component intent and states are specified. It is not a substitute for feature or view design. [Component documentation](https://storybook.js.org/docs/writing-docs), [UI testing](https://storybook.js.org/docs/writing-tests) (accessed 2026-09-18).
4. **Stable agent rules and task knowledge require different delivery.** Official OpenAI documentation says Codex automatically discovers layered `AGENTS.md` files and injects them into context. This is efficient for durable repository instructions. Mutable project state should arrive as a generated task bundle and via query tools rather than inflate `AGENTS.md` or require a full `/docs` crawl. [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md) (accessed 2026-09-18).

## Resulting direction

- [Product development workflow](../design/product-development-workflow.md) defines the recursive artifact chain, proportional artifact policy, page/component design process, visual exploration, and distinct review gates.
- [Knowledge strategy](../knowledge-strategy.md) defines database, repository, object-storage, and task-bundle responsibilities plus a fresh-workspace bootstrap.
- D-01B is paused. Its current source is retained as evidence and a disposable experiment, not an interaction direction awaiting polish.
- M0 now needs a benchmark of real product-development and design-review workflows before the portal experience or database schema is narrowed.

## Inferences and uncertainties

The sources support staged research, fit-for-purpose prototypes, reusable component stories, and durable agent instructions. The proposed artifact taxonomy, database boundary, and task-bundle format are project-specific inferences. They could be reversed or simplified by:

- evidence that existing products already cover most of the desired workflow;
- a benchmark showing that the proposed artifact trail creates more friction than useful provenance;
- retrieval trials showing a different context interface is substantially more reliable;
- the second-project brief revealing knowledge types absent from the portal self-change.

## Next research

R-07B should benchmark representative existing products and mature design systems against one substantial portal feature. It should inspect how they move from brief/research to structure, concepts, prototypes, components, implementation handoff, and review. Capture both strong patterns and gaps; do not start another portal screen during this packet.
