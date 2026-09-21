---
id: research-001
kind: research-synthesis
status: initial-pass
updated: 2026-09-18
---

# Initial research

Primary documentation reviewed on 2026-09-18. This is a focused feasibility and architecture pass, not a benchmark or exhaustive vendor review. Recommendations below are engineering judgments derived from the brief and documented capabilities. Account access, deployment suitability, costs, and failure behavior still require validation.

## Agent integration: reuse execution capability

**Evidence:** OpenAI documents programmatic Codex threads through its SDK and points custom interactive clients toward App Server. Non-interactive execution can emit JSONL events. [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk), [non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode).

**Implication:** begin by evaluating a Codex adapter for bounded implementation jobs. Use portal-owned run IDs and records; preserve native session IDs only as provider references. Investigate App Server if interactive approvals and steering are essential to the first experience. SDK availability does not establish suitability for every hosted or multiuser authentication arrangement.

**Alternatives:** Claude Agent SDK offers an agent loop and tools in Python and TypeScript; OpenHands exposes Python and REST interfaces for software agents. Both merit a later adapter spike. [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview), [OpenHands SDK](https://docs.openhands.dev/sdk).

**Recommendation:** do not build a coding-agent loop initially. Select the first provider by a small representative task trial, not a model leaderboard. Evaluate output quality, review burden, event visibility, cancellation, isolation, cost, and authentication. Portability means a fresh provider can execute a new run using durable project context; it does not promise migration of a live native conversation.

**Budget update:** the owner has ChatGPT Plus and wants low/no incremental spend. Prefer subscription-authenticated local Codex for the first trial; do not assume API credits or hosted integration access. See the budget-specific findings below.

## Workflow coordination: separate agent reasoning from durable work

**Evidence:** Temporal persists workflow history and resumes execution after failure; its replay model imposes deterministic workflow constraints. LangGraph distinguishes thread checkpoints from cross-thread stores. [Temporal executions](https://docs.temporal.io/workflow-execution), [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence).

**Implication:** agent memory and the product's durable record solve different problems. The portal must recover tasks and decisions after worker restarts regardless of an agent's native session state.

| Approach | Why consider it | Tradeoff / recommendation |
|---|---|---|
| PostgreSQL work queue plus explicit state transitions | Small bootstrap footprint and inspectable state | Application owns leases, retries, deduplication, reconciliation; evaluate for a serial MVP |
| Temporal | Durable coordination for long waits and multiple external effects | Additional service and workflow versioning knowledge; strongest candidate if recovery spike makes custom coordination costly |
| LangGraph | Useful when agent reasoning needs explicit graphs and checkpoints | Evaluate inside an agent adapter; do not make graph memory the only project record |

Do not combine all three initially. Before choosing, kill a worker around an external side effect and test recovery. No orchestration framework makes external writes inherently exactly-once; application-level idempotency and reconciliation remain requirements.

## Hosting: distinguish the portal from build environments

**Evidence:** DigitalOcean App Platform deploys repositories or container images, exposes deployment logs, and offers rollback. Rollback does not restore database data. Its local filesystem is ephemeral and it does not support volumes. [Deployment management](https://docs.digitalocean.com/products/app-platform/how-to/manage-deployments/), [limits](https://docs.digitalocean.com/products/app-platform/details/limits/).

**Implication:** it is a plausible host for the portal service, with database and artifacts stored externally. It is not yet validated as a general coding workspace. Builds must not depend on persistent local files there. A separate disposable runner environment is a distinct selection problem.

**Alternative:** Cloud Run offers container services and jobs that run to completion. This is a credible managed-compute alternative; browser support, build tooling, networking, task duration, identity, and costs need a concrete trial. [Cloud Run overview](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run).

**Recommendation:** shortlist managed portal hosting plus separately isolated execution. With the clarified budget, defer dedicated paid compute. Keep DigitalOcean and Cloud Run as later candidates for autonomous execution; first evaluate a free hosted portal with a local worker. A VM provides more control but makes patching and runner lifecycle our responsibility. Keep final selection open until free-tier compatibility and execution requirements are validated.

## Version control and integrations

**Evidence:** GitHub Apps support repository-scoped installation, granular permissions, and webhooks. [GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps).

**Recommendation:** use Git and pull-request review rather than inventing source control. Investigate a GitHub App for the hosted integration. The portal owns product proposals and decisions; Git owns code history. Start with links to external issues, including Jira, rather than bidirectional task synchronization. Add sync only when an actual workflow needs it, with explicit field ownership and conflict handling.

## Application and storage foundation

**Evidence:** Next.js supports Node and Docker deployment; PostgreSQL provides structured relational storage alongside JSON types. [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [PostgreSQL JSON types](https://www.postgresql.org/docs/current/datatype-json.html).

**Recommendation after budget clarification:** evaluate a static React/TypeScript portal with a small API and PostgreSQL, plus a local worker. A full Next.js server remains an alternative if its hosting cost and complexity are justified. Containers reduce deployment coupling; keep domain operations outside UI handlers. Typed tables hold identities and relations, while versioned JSON payloads accommodate artifact-specific metadata. This does not prove superiority over a React frontend with a Python backend; choose that alternative if the agent or workflow spike materially favors Python. Do not build a universal application schema or no-code runtime initially.

## Observability

**Evidence:** OpenTelemetry defines signals including traces, metrics, and logs. [OpenTelemetry signals](https://opentelemetry.io/docs/concepts/signals/).

**Recommendation:** correlate those signals with project, work item, run, and release IDs. Keep an independent product audit trail for user decisions and external effects. Logs explain execution; they are not the only durable record of what was accepted.

## Build versus adopt

Build the intent-to-evidence record, decision inbox, review experience, and cross-project improvement loop. Adopt code hosting, agent execution, database, identity, and deployment infrastructure. Existing coding SDKs establish that code execution is reusable; they do not establish that the owner's entire desired workflow is solved.

A broader comparison of existing end-to-end app builders remains open. Before major implementation, walk a real client brief through two credible existing products and this proposed workflow. Evaluate retained research, decision provenance, source export, self-development, provider substitution, preview review, and deployment recovery. A substantial overlap should reduce what we build.

## Budget-specific recommendation after owner clarification

The owner accepts local execution and prefers free deployments. Target **zero incremental service spend** initially, using the already-paid subscription and existing hardware; this is a design target, not a guarantee of unlimited free usage.

**Coding:** official documentation lists Codex CLI access with Plus and distinguishes ChatGPT sign-in from metered API-key access. Usage allowances are limited and shared across local/cloud use. Use supported local sign-in; do not assume Plus supplies general API credits. Verify the chosen CLI/SDK path with one owner-triggered task before building around it. [Codex pricing](https://learn.chatgpt.com/docs/pricing), [authentication](https://learn.chatgpt.com/docs/auth).

| Candidate | Verified free offering / restriction | Judgment for this bootstrap |
|---|---|---|
| Railway | Free plan includes $1 monthly credit; initial trial grants $5 for up to 30 days | Conventional-runtime candidate, not the static-preview fallback; meter usage before any ongoing use |
| Vercel Hobby | Free plan restricted to personal, non-commercial use | Disqualified as the default for a portal intended to support client work; only a clearly personal experiment can qualify |
| Cloudflare Pages | Free plan includes 500 builds/month, one concurrent build and preview deployments; functions consume Workers quotas | R-04A trial target for static previews; create has no documented idempotency key, so lookup-before-replay and ambiguity blocking are mandatory |
| Supabase Free | 500 MB database, 1 GB storage; two active projects; pauses after a week of inactivity | Preferred candidate for portal PostgreSQL/auth/storage, with quota monitoring and independent exports |

Sources: [Railway plans](https://docs.railway.com/pricing/plans), [Railway trial](https://docs.railway.com/pricing/free-trial), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Supabase pricing](https://supabase.com/pricing). Preview candidates were rechecked 2026-09-19 in [R-04A](evidence/r-04a-preview-options.md); Supabase was last checked 2026-09-18. Account eligibility and actual usage have not been tested.

**Proposed first deployment shape:** React/TypeScript static portal on a Cloudflare-hosted surface; a small authenticated API using compatible functions; Supabase for project records and identity; local Codex worker for owner-started tasks. R-04A selected Pages Direct Upload only for the static preview trial. Cloudflare now calls Workers its primary platform for new applications, so recompare Pages and Workers before fixing the long-term portal host. Keep service keys out of the browser and coding workspace. The backend authenticates the worker separately and scopes its job/artifact access. [Cloudflare Pages overview](https://developers.cloudflare.com/pages/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

A portal project is an application record, not a Supabase infrastructure project. Several development projects can share the portal database with explicit scoping; each generated application's runtime database remains a separate deployment concern. Do not promise unlimited independently hosted client apps from two free infrastructure projects.

If this combination adds more integration work than it saves, keep the entire first loop local, then publish the portal shell and data service. Railway is the next candidate when a conventional server simplifies a concrete requirement. Retain standard web assets, SQL migrations, and exportable artifacts so that changing hosts is manageable.

No paid fallbacks, automatic credit purchases, scheduled agents, or always-on paid workers in the proposed bootstrap. At quota exhaustion, preserve state and display the limitation. Prefer manual starts, small context bundles, one run at a time, and bounded preview retention. Free-tier pauses and machine availability should appear as product states, not unexplained failures.

## Research maintenance

### Product-development tool ecosystem

The maintained [tool ecosystem registry](tool-ecosystem.md) tracks capabilities, authority, agent/human surfaces, cost/auth boundaries, adoption state and recheck triggers. [R-09](evidence/r-09-ui-toolchain-ecosystem.md) selects Storybook for a bounded component-workshop trial, keeps Playwright at the integrated-app boundary, treats Style Dictionary as a token-transform candidate, and defers Chromatic/Figma Code Connect until their external account and workflow value are justified. Documentation is candidate evidence; only a local representative trial can establish adoption.

Each future research record needs a question, source URLs, access date, concise claims, confidence, implications, linked decisions, and a recheck trigger. Revalidate provider/authentication/pricing claims before committing money or implementation. Revisit findings when a source changes, an experiment contradicts them, or a dependent decision is reopened. Preserve superseded conclusions instead of silently overwriting them.
