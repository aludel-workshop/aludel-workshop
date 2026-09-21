---
id: reference-001
kind: internal-case-study
status: active-reference
updated: 2026-09-18
repositories:
  - Life2LaunchLabs/launch-lms
  - Life2LaunchLabs/launch-lms-infra
---

# Launch LMS and Launch LMS Infra case study

These repositories are active products owned by the project owner and are reference implementations for lessons learned. They are **not architectural templates** for Aludel. The owner describes them as bloated and assembled from several legacy projects. Reuse individual contracts and tested ideas only after checking whether they fit this product's smaller bootstrap.

## Reference locations and snapshots

| Repository | Role | Snapshot inspected | Access |
|---|---|---|---|
| [`Life2LaunchLabs/launch-lms`](https://github.com/Life2LaunchLabs/launch-lms) | Product source, product/agent policy, checks, candidate production | `dev` at `4bcc726e8da1e851645f4dac114d9998b56fcd78` | A local checkout exists at sibling path `../launch-lms`, but it was at older `dev` commit `e2a7ec5f1ce93d2c8b1955da2658148cfe1b1020` during this review. Use Git or GitHub and pin the revision when citing behavior. |
| [`Life2LaunchLabs/launch-lms-infra`](https://github.com/Life2LaunchLabs/launch-lms-infra) | Operations control plane, deployment locks, Symphony runtime, feedback and recovery | `main` at `e1ef1abf09667219276bfa6bfa0e9416328ab998` | No persistent local sibling checkout was present. It was inspected through a temporary shallow clone. |

The commits above make this review reproducible; they are not recommendations to remain on those versions. Recheck moving branches before applying a lesson. Never require these sibling repositories to understand or build this portal: capture adopted contracts here or in this repository's own code.

## What is working and worth studying

### Product policy stays with the product

At the inspected app revision, `AGENTS.md`, `WORKFLOW.md`, `ARCHITECTURE.md`, product records, design guidance, and quality/reliability guidance live with the application. The operations repository registers the project through `projects/launch-lms/project.yaml` but fetches product workflow policy from an exact application commit.

This is a strong boundary for a multi-project portal: the portal can own execution and cross-project views without becoming the only place a product can be understood. A fresh checkout remains useful to a human or another agent.

Candidate files to revisit:

- App: `AGENTS.md`, `WORKFLOW.md`, `ARCHITECTURE.md`, `docs/product/`, `docs/design/`, `docs/quality/`.
- Infra: `projects/launch-lms/project.yaml`, `services/orchestrator/render_workflow.py`.

### Build once, identify exactly, promote deliberately

The current app pipeline builds and smoke-tests architecture-specific images, then publishes a candidate containing the exact source SHA, immutable image digest, architectures, version, migration metadata, and build run ID. The infra repository validates that contract and creates environment locks. Stable release promotion reuses the verified candidate rather than rebuilding an ostensibly equivalent image.

This directly informs our artifact model: a review and later release should bind to immutable source/build identities and their verification evidence. Mutable branch or image tags are navigation aids, not sufficient release identity.

Candidate files to revisit:

- App: `.github/workflows/build-community.yaml`, `.github/workflows/release.yaml`, `scripts/ci/release-contract.py`.
- Infra: `services/deployer/candidate.py`, `release.lock.json`, `.github/workflows/deploy.yaml`.

### Owner approval binds to the reviewed revision

The product workflow distinguishes implementation handoff, owner approval, merge, deployment verification, and final signoff. Symphony prepares evidence and records a reviewed SHA; the owner moves the work into the merge state. A changed PR head invalidates that approval. Merge uses matching-head protection, and successful merge alone is not deployment proof.

This is a useful reference for the portal's review record. The UI can be simpler than Jira, but acceptance should identify the exact artifact and become stale when its inputs change.

Candidate files to revisit:

- App: `WORKFLOW.md`, `AGENTS.md`.
- Infra: `symphony/WORKFLOW.md`, `symphony/review_gate.py`, `tests/test_symphony_review.py`.

### Execution is isolated from live application authority

The Symphony worker is separate from application hosting, has bounded concurrency and resources, and receives no Docker socket, production database, live application volumes, or deployment SSH key. Heavy builds run in CI. An evidence uploader performs a narrower host-side action and validates file paths, types, sizes, checks, and current revision before handing work to the owner.

The principle transfers even though our first worker is local: keep the coding environment distinct from portal/release credentials, and put narrow external effects behind explicit services or adapters.

Candidate files to revisit:

- Infra: `symphony/Dockerfile`, `docker-compose.symphony.yml`, `symphony/README.md`, `symphony/review_gate.py`.

### Pause, cutover, and independent recovery are product behavior

The infra repository treats pause state, persistent workspaces, worker cutover, backups, environment locks, host observation, and deployment rollback as explicit workflows. The proposed control plane is hosted separately from application environments and retains an administration path outside its own UI.

This supports our decision to treat unavailable worker, ambiguous external effects, recovery, and rollback as visible states. Self-development requires a recovery route that does not depend on the portal being healthy.

Candidate files to revisit:

- Infra: `symphony/README.md`, `deploy/control-plane/README.md`, `.github/workflows/cutover-symphony-operations.yaml`, `.github/workflows/rollback-stage-control-plane.yaml`, tests under `tests/`.

### Project registration is data, while secrets remain elsewhere

The infra project manifest records repository, tracker states, required checks, candidate schema, environments, origins, public verification keys, and enabled modules without embedding credentials. Changes to the manifest alter enforcement boundaries and require review.

This is a practical reference for our project connection model: version non-secret capability and policy configuration, scope credentials separately, and make a configuration change reviewable.

## Lessons to carry forward carefully

| Observed lesson | Candidate use here | Evidence required before adoption |
|---|---|---|
| Product-owned agent instructions combined with portal runtime policy | Keep each generated app independently understandable while the portal supplies execution settings | Demonstrate exact-version context bundles in R-03/R-06 without duplicating sources of truth |
| Immutable candidate and environment-lock contracts | Bind preview, review, and release to exact artifacts | A smaller candidate schema proven in R-04B and B-03 |
| Human approval tied to a SHA | Make review invalidation deterministic | D-01 prototype shows stale approval clearly; B-03 enforces it |
| Explicit opt-in execution label/state | Model deliberate Go as a durable authorization event | D-01 defines authorization scope without requiring Jira |
| Separate evidence uploader/external-effect service | Prevent the coding worker from receiving broad credentials | R-03 identifies required events; R-05 proves recovery/idempotency boundary |
| One bounded worker and durable pause | Start serially and make availability visible | R-03 cancellation/resume test and R-05 failure test |
| Product and operations repositories separated | Consider only when independent lifecycle and recovery justify the overhead | M1 experience reveals real ownership/deployment tension; do not split during bootstrap by default |

## Costs and failure modes not to inherit by accident

- The working system spans GitHub Actions, Jira workflows/properties/comments, app and infra repositories, container registries, droplets, Docker Compose, deployment locks, a control plane, feedback services, and Symphony. Our M1 does not need most of this surface.
- Product and operations behavior cross repository boundaries. Exact-commit policy fetching reduces drift, but configuration, permissions, compatible schemas, and rollout order still need coordination.
- Legacy and compatibility entry points coexist with newer manifest boundaries. This is rational during migration but raises cognitive and test cost.
- The Symphony deployment inspected uses a funded OpenAI API key and forces API authentication. It does not demonstrate that a local ChatGPT Plus login will work for our intended adapter; R-03 must prove that separately.
- Jira is both delivery state and human handoff in this implementation. Our portal should own its initial product records and should not require Jira just because this reference does.
- The operations host and production-grade recovery posture have nontrivial infrastructure cost. They are evidence for later evolution, not a free-tier bootstrap design.
- Some runbooks explicitly identify unfinished work, such as off-host Symphony archive retention or restore rehearsal. A written procedure is not evidence of a successful recovery test.
- The older local app checkout contains a simpler build-and-SSH pipeline, while the current remote `dev` revision contains verified candidate and cross-repository dispatch contracts. This is itself a lesson: record revision provenance and do not infer current behavior from a convenient stale checkout.

## How agents should use this reference

Use these repositories for concrete precedent when working on runner reuse, artifact identity, deployment, review gates, recovery, product knowledge, or project registration. Cite an exact repository revision and file. State whether a conclusion is documented, read from code, or observed by executing it.

Do not copy a subsystem because it exists there. Begin with the problem and acceptance evidence in this repository, extract the smallest useful contract, and record why the added complexity is justified. Never read or reproduce repository secrets or live user data. Do not make changes to either reference repository unless the owner explicitly requests work on that product.

## Open questions for later study

- Which painful incidents or failed approaches caused the immutable candidate, exact-head approval, environment locks, and evidence uploader designs?
- Which control-plane functions are actively useful to the owner, versus infrastructure prepared for future use?
- How often do cross-repository changes cause coordination failures or slow delivery?
- What is the smallest subset of the current Symphony workflow that still provides reliable handoff and recovery?
- Which product-map and design-record structures improve agent work, and which mainly reflect legacy breadth?

