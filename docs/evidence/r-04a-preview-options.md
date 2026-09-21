---
id: evidence-r-04a
kind: research-evidence
status: complete
packet: R-04A
updated: 2026-09-19
---

# R-04A — Free preview-path comparison

## Outcome

Use **Cloudflare Pages Direct Upload** as the R-04B hosted trial target for the existing static prototype, subject to owner authorization to connect an account and create an external deployment. Use an **identified local-only static server** as the zero-account fallback. Railway remains a later conventional-runtime candidate; Vercel Hobby is disqualified as the default because the portal is intended for client work and Hobby is restricted to personal, non-commercial use.

This is documentation evidence, not a successful deployment. No account was connected, credential inspected, resource created, or cost incurred.

## Scope and method

- Access date: 2026-09-19.
- Sources: current first-party product documentation and terms only.
- Compared: Cloudflare Pages, Railway, Vercel where Hobby use qualifies, and local-only serving.
- Required dimensions: cost/commercial fit, automation, immutable preview identity, access, limits, logs, cleanup, migration, and recovery after uncertain writes.
- “Documented” below means the cited source states the behavior. “Inference” means the source exposes enough fields to attempt a protocol but does not promise the required guarantee.

## Comparison

| Option | Cost and eligibility | Identity, status, logs and cleanup | Private access | Recovery after an interrupted create | Fit |
|---|---|---|---|---|---|
| Cloudflare Pages Direct Upload | The Free plan documents 500 builds/month, one concurrent build, 20-minute build timeout, 20,000 files/site, 25 MiB/file, 100 projects/account and unlimited active previews. Static requests are free; Functions use Workers quotas. No personal/non-commercial-only restriction appears in the reviewed Pages plan documentation. | Create returns a deployment ID, unique URL, aliases, environment, trigger metadata and stage status. The API can list/get/delete deployments and retrieve deployment history logs. Unique hash URLs are atomic; branch aliases move. Wrangler can list and delete, but the latest deployment for a branch cannot be deleted. | Preview URLs are public by default. Pages can put previews behind Cloudflare Access; Zero Trust Free onboarding is documented but requires plan setup and payment details even when not charged. | **No create idempotency key is documented.** Direct Upload accepts branch, `commit_hash`, and `commit_message`; list/get exposes trigger metadata. A client can search for an exact stored build tuple after response loss, but Cloudflare does not document this as an authoritative idempotency guarantee. Zero/duplicate matches remain ambiguous/conflicting and must block replay. | **Hosted trial target.** Best fit for a static artifact, exact deployment URL and zero-incremental-cost objective. Recovery and cleanup limitations must be exercised. |
| Local-only static server | No service charge, account, commercial-plan restriction or provider quota. Uses existing owner hardware. | Bind a read-only artifact directory; record manifest SHA-256, process ID, port, start time and health result. Cleanup is process termination and removal of any disposable copied artifact. Logs are local stdout/stderr. | Loopback is private to the machine by default. LAN binding or tunneling is a separate external-access choice and is not part of the fallback. | There is no external create. On restart, compare the manifest digest and port record, probe health, then resume or start a new process. This is locally reconcilable but unavailable while the machine is off and not remotely reviewable. | **Fallback.** Preserves identified-build review without an account, but does not prove the hosted-preview M0 gate unless the owner explicitly waives it. |
| Railway | Free is $0/month with $1 monthly credit; new accounts receive a one-time $5/30-day trial. Free resources are capped and API calls are limited to 100/hour. It is usage-based runtime hosting, not an unmetered static-preview service. | The GraphQL API documents list/get/latest-active, build/runtime/HTTP logs, deploy, cancel, stop, rollback and remove. Deployments have IDs and statuses. The reviewed docs do not document an immutable public URL per deployment; the service/environment remains the primary address. Removed Free/Trial images are retained for rollback for 24 hours. | Private networking is aimed at service-to-service traffic; the reviewed deployment docs do not establish a free owner-authenticated browser preview equivalent to Pages Access. | Railway explicitly says not to assume exactly-once mutation semantics. Mutations with identical arguments generally converge when resource-keyed, but a deployment trigger is not documented with a client idempotency key or build-identity lookup. An unknown create outcome therefore blocks or requires broad list/log reconciliation. | Not selected for static R-04B. Recheck when a preview needs a conventional server or Pages compatibility fails. |
| Vercel Hobby | Free, but official documentation and terms restrict Hobby to personal, non-commercial use. The intended portal includes client work, so eligibility is not durable. Hobby documents 100 deployments/day, one concurrent build, 45-minute build time and 100 MiB static CLI uploads. | Create returns a deployment ID/state and each deployment has a unique URL. REST supports create/get/list/cancel/delete and build events; list filters by project, branch and SHA. Create supports metadata and performs similarity deduplication unless `forceNew=1`. Build logs are retained; Hobby runtime logs retain one hour. | Vercel Authentication with standard preview/deployment protection is available on Hobby. Password protection is not a free Hobby feature. | Similar-deployment deduplication plus SHA lookup is stronger than an unconditional POST, but the docs do not define this as a caller-supplied idempotency contract. Metadata cannot be used as a documented list filter. Unknown or multiple same-SHA results still require operator reconciliation. | Technically credible only for a clearly personal, non-commercial experiment. **Disqualified as the default** for this product. |

### Migration cost

- **Cloudflare Pages:** low for the static trial because the input is a prebuilt standards-based directory and the manifest remains portal-owned. Migration becomes medium if Pages Functions, Access policies, aliases or provider-specific routing enter the preview contract.
- **Local-only:** lowest for artifact portability; the same static directory can move to another host. The cost is operational rather than code coupling: no remote availability, provider logs or hosted access control.
- **Railway:** medium for this use because a static artifact must be wrapped as a running service and environment/domain lifecycle becomes part of the adapter. It becomes a more natural fit if the candidate needs a conventional server.
- **Vercel:** low for static files and common frameworks, but moving away requires translating protection, alias and deployment-metadata behavior. Commercial eligibility, not technical portability, is the present disqualifier.

These are architectural inferences from the documented deployment models, not measured migrations. A future host switch must preserve the portal-owned artifact digest, operation record and provider-neutral review link rather than treating any provider alias as identity.

## Primary sources and exact claims

### Cloudflare

- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) — Free build, concurrency, timeout, file, project and preview limits.
- [Pages overview](https://developers.cloudflare.com/pages/) and [Functions routing](https://developers.cloudflare.com/pages/functions/routing/) — Direct Upload is supported; Workers is Cloudflare's primary platform for new applications; purely static requests are free and Functions consume Workers quota.
- [Create deployment API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/) — request metadata and returned deployment identity/status fields.
- [Deployments API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/) — list/get/delete/retry/rollback and deployment-history log operations.
- [Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/) — unique versus mutable alias URLs, public-by-default previews, Access integration, `noindex`, and deletion constraint.
- [Zero Trust setup](https://developers.cloudflare.com/cloudflare-one/setup/) — Free plan availability and payment-details onboarding requirement.

### Railway

- [Plans](https://docs.railway.com/pricing/plans) and [Free Trial](https://docs.railway.com/pricing/free-trial) — current Free/Trial credits, resource caps and retention.
- [Public API](https://docs.railway.com/integrations/api) — GraphQL endpoint, Free rate limit and explicit mutation retry/duplicate warning.
- [Manage deployments API](https://docs.railway.com/integrations/api/manage-deployments) and [deployment reference](https://docs.railway.com/deployments/reference) — lifecycle operations, logs, statuses and replacement/removal behavior.

### Vercel

- [Hobby plan](https://vercel.com/docs/plans/hobby) and [Terms §4](https://vercel.com/legal/terms) — non-commercial restriction and included limits.
- [Limits](https://vercel.com/docs/limits) — deployment/build/upload limits and log retention.
- [Create deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment) — ID/state response, metadata, source SHA and default similar-deployment deduplication.
- [List deployments API](https://vercel.com/docs/rest-api/deployments/list-deployments) — project, branch, state and SHA filters.
- [Deployment protection](https://vercel.com/docs/deployment-protection) and [managing deployments](https://vercel.com/docs/deployments/managing-deployments) — Hobby authentication protection and deletion/retention controls.

## R-04B trial contract

The trial must test the weakest important boundary instead of treating a successful URL as sufficient.

1. Build the existing non-sensitive static fixture locally. Produce a sorted file manifest and SHA-256 digest. Record the exact source/prototype revision separately because this workspace currently has no Git metadata.
2. Create and persist a preview operation **before** calling Cloudflare: operation ID, project, artifact digest, expected `preview` environment, a dedicated branch label, request timestamp and state `creating`.
3. Put the operation ID in `commit_message`; put the stable source revision or artifact digest in `commit_hash` only if the live API accepts the chosen value. Persist the exact request tuple.
4. Send one Direct Upload create. Never issue a second create merely because the response timed out or the worker restarted.
5. If the response is received, persist deployment ID and unique URL before polling status. Verify the served artifact includes or returns the expected digest.
6. If the response is lost, list deployments and match the exact project/environment/branch/commit-hash/operation-message tuple. Poll twice with a bounded delay to test visibility:
   - one exact match: attach it to the operation and continue;
   - more than one: mark `conflict`, show all provider IDs, and require an audited owner choice;
   - none after the bounded lookup: mark `unknown`, preserve evidence, and do not replay automatically.
7. Exercise cleanup through the deployment ID. Record whether the latest-branch deletion restriction applies and what remains. Do not hide retained aliases or resources.
8. Record measured cost, quota counters if exposed, access behavior, logs, timestamps and all provider IDs. Do not print tokens.

The safe repeated-operation check is lookup-first using the persisted operation tuple. Because Cloudflare documents no idempotency key, R-04B must not intentionally create a duplicate to prove the point.

## Recommendation and disqualifiers

### Trial target — Cloudflare Pages Direct Upload

Choose it because the first fixture is static, it returns an immutable deployment URL and machine-readable status, supports direct prebuilt uploads, and stays inside the documented free limits for this bounded trial.

Disqualify or reopen the choice if account onboarding requires payment/billing authorization the owner declines, Direct Upload cannot preserve a usable build identity, post-timeout listing cannot find metadata reliably, private review is mandatory but Access cannot be configured within the allowed account boundary, cleanup leaves unacceptable public artifacts, or the fixture requires a runtime Pages cannot support without material coupling. Since Cloudflare now describes Workers as its primary platform for new applications, reassess Workers before using Pages as the long-term portal host; this does not block the static preview trial.

### Fallback — identified local-only server

Use it when no external account/deployment is authorized or Cloudflare is disqualified. It must display and record the artifact digest and availability state. It is disqualified when review must work away from the owner machine, survive that machine being off, or satisfy the hosted-preview gate without an owner waiver.

## Retrospective and process outcome

### Observed friction

- Marketing-level “free preview” comparisons hide the decisive recovery question. Provider docs commonly expose IDs and list APIs without promising idempotent create.
- “Preview URL” is not one concept: Cloudflare distinguishes immutable deployment URLs from mutable branch aliases; Railway centers a running service/environment; local preview is process availability rather than a hosted artifact.
- The existing packet named cleanup but not the provider constraint that a latest branch deployment may remain undeletable.

### Improvement applied and tested

The reusable improvement is a **preview trial contract** that persists intent before the external write and evaluates one/none/many lookup outcomes. It was applied to all four candidates above and changed the recommendation: Cloudflare remains first, but only with lookup-before-replay and explicit ambiguity; Railway is no longer an equivalent static fallback, and local-only is the honest fallback. R-04B below now requires the same protocol and cleanup-residue evidence.

This demonstrates that the revised closeout rule propagated observed research into a downstream packet. It does not prove the protocol against Cloudflare; R-04B is the live test.

### Downstream effects and questions

- R-04B must use Direct Upload and must capture whether list visibility is timely enough to reconcile a lost create response.
- B-03 needs `creating`, `unknown`, `conflict`, `ready`, `cleanup-pending` and `retired` deployment-operation states, not just a URL field.
- Q-008 becomes concrete for previews: attaching one exact provider result is agent-reconcilable; selecting among duplicates, abandoning an unknown operation, or explicitly retrying requires an audited owner action.
- No roadmap or phase-order change is warranted. Hosted proof, actual cost and account eligibility remain unproven.

## Readiness and next action

R-04A is complete. R-04B is technically ready because the D-01B v4 static fixture exists, but it is blocked on owner authorization for Cloudflare account connection and an external deployment. D-01E is the next ready packet and can proceed without that external effect.
