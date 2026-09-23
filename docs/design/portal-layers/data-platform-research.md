---
id: portal-layers-data-platform-research
kind: research
status: proposed
updated: 2026-09-22
depends_on: [portal-layers-model, portal-layers-knowledge-structures]
---

# Data, Platform operations, agents and code traceability

Owner questions (2026-09-22, after LAY-REVIEW):

1. Where do the back-end records live: data models and APIs, "api first … openAPI spec backed … all above implementation", so a different stack could be translated from them?
2. Where do operations live: database health, backups, querying; server health, CI/CD, domains; handoffs to other providers?
3. Where do integrations live? Owner: "under where they are actually used". GitHub under Repository; agents under a new Work › Agents tab with agent "profiles" such as a project manager with its own model and instructions.
4. How is code linked to knowledge? Owner: "is that piece of code still used by anything? … where do i find all the code this feature touches? … change the product vision? that change percolates all the way through … so the agent picking it up knows exactly what to do: remove/modify/create."

The owner approved the direction, the name **Data**, and the two traceability recommendations ("go go both recs"). The decision is DEC-038. The resulting structures are in [knowledge-structures.md](knowledge-structures.md), and [prototype v3](v3/index.html) shows them with Tool Share data.

All sources were accessed 2026-09-22. **Fact** marks what a source states; **Inference** marks our conclusion.

## 1. The Data layer

### A stack-neutral format

| Source | Fact | Inference |
|---|---|---|
| [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) | Describes HTTP operations, parameters and responses. Its schema objects are full [JSON Schema 2020-12](https://json-schema.org/specification) | One contract format covers both objects and operations, and no language is implied |
| [JSON Schema](https://json-schema.org/) | Types, formats (`email`, `date-time`, `uri`), required fields, enums, `$ref` between schemas | Objects are JSON Schema. Relationships are `$ref` plus a small Aludel extension for cardinality and ownership |
| [TypeSpec](https://typespec.io/) (Microsoft, 1.0) | A concise language that compiles to OpenAPI and JSON Schema | A possible authoring syntax later. The stored contract stays OpenAPI and JSON Schema, which every tool reads |
| [DBML](https://dbml.dbdiagram.io/) / [dbdiagram](https://dbdiagram.io/) | A text format for tables, columns and references; diagrams render from it | Proves that a text-first model with a diagram view works. But DBML is relational, so it belongs to the Platform binding, not to Data |

**Inference: the rule.** Nothing above Platform references stack specifics. Product, Design, Pages and Data are written in terms any stack could implement. Platform holds the **binding**: which table, route handler, framework and service realises each object and operation. Changing stacks means rewriting the binding, not the knowledge.

### UI references

| Tool | What it does well (fact) | What we take |
|---|---|---|
| [Scalar](https://scalar.com/) | Three-pane API reference: operation list grouped by tag, description and schema, request examples and a test client | The API tab layout: operations grouped by resource on the left, contract in the middle, example request and response on the right |
| [Redoc](https://github.com/Redocly/redoc) | Readable reference docs with nested, collapsible schemas | Nested fields collapse; the reading view comes first |
| [Stoplight Elements](https://github.com/stoplightio/elements) | Embeddable API docs with a "try it" console | "Try it" only appears in Platform against a running environment. The contract itself has no environment |
| [ChartDB](https://chartdb.io/), [DrawDB](https://drawdb.app/) | Entity-relationship diagrams from a schema; click a table to edit it | The Objects tab: a relationship map with a detail panel |

### Tabs

- **Objects:** each object has fields, relationships, ownership, lifecycle states, and the stories and specs that need it.
- **API:** operations, each with an `operationId`, request and response, errors, the object it acts on, and its stories.
- **Access:** roles × objects × actions, with ownership rules ("only the lender can approve").
- **Events:** later. Things that happen (a request was approved) that notifications and integrations react to.

**Inference:** specs already list "Key entities" in words. An accepted spec proposes Data objects, and a technical-plan work item turns them into contracts. Data sits between Pages and Platform because it is the last stack-free layer.

## 2. Platform operations

| Reference | What it shows (fact, from product documentation) | What we take |
|---|---|---|
| [Railway](https://docs.railway.com/) | Per-project canvas of services and databases; deploy history per service; logs and metrics; custom domains per service | Environments with services, deploy history and health on one screen |
| [Supabase dashboard](https://supabase.com/docs/guides/platform) | Table editor, SQL editor, database reports, backups and point-in-time recovery, migrations | The Database tab: health, backups, migrations, browse data, read-only query |
| [Vercel deployments](https://vercel.com/docs/deployments) | Each commit gets a deployment; promote a preview to production; instant rollback | Releases: build → preview → promote, with rollback. Every release names the stories it ships |
| [Render](https://render.com/docs) | Health checks, custom domains with automatic TLS, environment groups | Domains: DNS records to set, TLS state, verification |

**Inference:** "shipped" is the last derived story status. It needs a release record that names which commits, and therefore which stories through code links, went live. Releases are where the Platform layer feeds back into Product.

### Integrations go where they are used

- **Repository:** GitHub (sign-in identity is per user; the repository link is per project).
- **Work › Agents:** agent provider accounts and agent profiles.
- **Environments:** hosting providers.
- **Domains:** DNS and registrar.
- **Architecture › Services:** runtime providers the app calls (email, payments, file storage), each linked to the stories that need them.
- **Settings:** a single read-only list of every connection, for audit.

## 3. Agent profiles

| Source | Fact | Inference |
|---|---|---|
| [Claude Code subagents](https://docs.claude.com/en/docs/claude-code/sub-agents) | An agent is a file with `name`, `description` (when to use it), `tools` (allow-list), `model`, and a system prompt. Each agent runs in its own context | A profile is a small, versioned record: role, when it's used, model, allowed tools, instructions |
| [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/agents/) | An agent has `instructions`, `model`, `tools`, `handoffs` and guardrails | Handoffs between agents are Aludel work items, not hidden calls, so they stay visible |
| [AGENTS.md](https://agents.md/) | One repository file of instructions that any coding agent reads | Project-wide instructions are layered under role instructions, and they export to `AGENTS.md` in the repository |

**Inference: best practice for Aludel profiles.**

1. **Role-based profiles** (Product, Design, Architect, Coding, Reviewer), each with a model chosen for the job. For example, the Product lead gets a strong reasoning model and the Reviewer gets a different model from the Coding agent.
2. **Layered instructions:**
   - Product principles (the constitution), which every profile reads
   - project instructions
   - role instructions
   - work-type guidance
   Each layer is a revisioned record. A work item records which instruction revisions it ran with.
3. **Least privilege:** each profile lists the layers it may write, and effects outside them need approval. Examples: the Coding agent writes code, not Product records; nobody spends or deploys without the owner.
4. **Accounts are separate from profiles.** An account is a connection to a provider (Codex on this machine, an Anthropic or OpenAI key). A profile names an account and a model, so swapping providers never rewrites instructions.
5. **Budgets:** a per-profile limit, with spending off by default (DEC-004).
6. **Working style assigns work types to profiles.** Dreamer sends definition work to the Product lead profile.

## 4. Linking code to knowledge (traceability)

### Terms

- **Requirements traceability:** links from intent (need, story, spec) to design, code and tests, and back. Forward: "where is this built?" Backward: "why does this exist?"
- **Impact analysis:** following those links to see what a change touches.
- **Suspect link:** a link made against an older revision of its upstream record. It must be reconciled before it counts again. This is a standard term in requirements tools.

### Findings

| Source | Fact | Inference |
|---|---|---|
| [OpenFastTrace](https://github.com/itsallcode/openfasttrace) ([user guide](https://github.com/itsallcode/openfasttrace/blob/develop/doc/user_guide.md)) | Traces requirement → design (`dsn`) → implementation (`impl`) → test (`utest`) through tags in source files, and reports what isn't covered | The chain works, and coverage gaps are computable. Inline tags are its weak point: they depend on discipline and clutter the code |
| [Tessl spec-driven development](https://docs.tessl.io/use/spec-driven-development-with-tessl); [Fowler on Kiro, Spec Kit, Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) | Specs declare their targets (`@generate ./src/index.ts`) and link each capability to a test (`@test`) | The spec, not the code, holds the link, and tests ground it |
| [SCIP](https://scip-code.org/) ([announcement](https://sourcegraph.com/blog/announcing-scip)) | A language-agnostic index of symbols, definitions and references, produced by indexers such as scip-typescript. It powers Sourcegraph's go-to-definition and find-references | Code-to-code links are computed, never hand-written. Symbols, not lines, are the stable unit |
| [Knip](https://knip.dev/) | Finds unused files, exports and dependencies from entry points | Answers "is anything using it?" structurally, but not "does anything still want it?" |
| Test impact analysis ([overview](https://www.testrail.com/blog/test-coverage-traceability/)) | Per-test coverage records which tests execute which code | Running a story's acceptance tests with coverage gives that story's code footprint without any annotations (later) |

### Conclusions (owner-approved)

- **Two kinds of link.**
  - *Declared* links go from knowledge to code (intent). They come from generation manifests, commit trailers and test names.
  - *Derived* links go from code to code (structure). An indexer computes them on each commit.
- **The unit is a named symbol** (component, route, operation handler, table, exported function, test), with the file as a fallback. It is never a line range.
- **No inline tags** in source. Links come from, in order of strength:
  1. the scaffold's generation manifest
  2. commit trailers on closed work (`Aludel-Work: W-12`, `Implements: S4, SPEC-02/FR-001`)
  3. test names that start with the acceptance ID
  4. later, coverage-derived links
- **Change propagation.** Each link stores the revision of the record it was made against. A new revision makes the link suspect. Aludel creates one *Reconcile* work item carrying:
  - the knowledge diff
  - the linked units, with their callers and callees
  - the linked tests

  The agent returns create / modify / remove. Closing the item re-links against the new revision. This is also how LAY-04 verifies closures.
- **Four states for a unit:**
  - *healthy*: reachable and traced
  - *suspect*: its upstream changed
  - *untraced*: reachable but no link (glue, or undocumented work)
  - *dead*: unreachable, with no live trace
- **Where it lives:**
  - a **Code** tab under Platform, because the binding is stack-specific
  - a "Built by" section on stories, pages and Data objects, showing only built, tested and suspect states, so the layers above stay stack-free
  - suspect counts on Home

## 5. What could change these conclusions

- If a second stack preset shows the JSON Schema + OpenAPI contract cannot express something both stacks need (for example, real-time subscriptions), add AsyncAPI for Events, or extend the contract.
- If commit trailers prove unreliable for hand-written code, reconsider inline tags for that code only.
- If the TypeScript compiler API is too slow on real repositories, adopt scip-typescript.
