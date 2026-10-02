# Layer-scoped Pages Work, elevated access and follow-ups (DEC-057) — 2026-09-30

## Authorization and readiness

The owner judged DEC-051's per-action declarations too complicated for current models. They asked to scope Work to the layer, keep an elevated (administrator) level per layer, and make agent follow-ups part of review ("I love the simpler overall implementation. Make it happen."). The authorization and scope are recorded in the root [LAYER-SCOPED-WORK-01 record](../../../../docs/design/layer-scoped-work/work-record.md) and DEC-057. The scope is this isolated candidate and the local Pages template repository only. No provider turn, owner data, GitHub write or deployment is authorized.

Readiness: the Pages flow create and revise validators already existed independently of the action model, so authority could be re-keyed on *layer + output kind* without new validation logic. Other layers stay on their legacy actions until LAT-T03 converts them.

## Observed implementation

- **Opt-in and bound.** Pages template `07e2c74` declares `work: { scope: 'layer', changes: ['flow'] }` in `layer.json`. The host (`server/layer-scope.mjs`) intersects it with its registered change adapters: today only `pages.flow` with create and revise. Package text cannot add a change kind. `packageAt` rejects a malformed declaration or a change kind that is not a declared output.
- **Items name a layer.** A new Pages item has no action and a durable `work_scope = 'layer'`. The startup `migrateWork` and LAT-08 action migration never back-fill an action or a blocked ledger row onto it. Checks default to one charter-fit criterion. The assignee defaults to the layer's single default assignee. Without an opted-in package the legacy action path is unchanged, and a test covers that.
- **Go and task card.** A layer-scoped bundle pins the layer source commit, change scope, targets (a targeted flow adds its page, persona, activity and story revisions), policy or Code-observation origin, installed follow-up layers, and the repository HEAD. It carries no role, action or action method. The v2 task card gives the charter and Knowledge as the method. Reads are project-wide, and writes are limited to the listed change kinds.
- **Submission.** A change set is `changes[0..10]` (flow create/revise), optional `notes`, `followUps[0..5]` `{layer, title, brief, why}` for installed layers, and `usedInputs`. The host rejects:
  - kinds outside the layer's adapters, and uninstalled follow-up layers;
  - any cited record missing from `usedInputs` at its current revision;
  - a pinned flow that changed since Go, a duplicate revise, and a changed layer source.
  
  Revisions run the reviewed Pages rule in the limited child runner. Nothing is written before review.
- **Review and acceptance.** Review shows one change row per change (New flow, Previous/Proposed, Notes) and a **Follow-ups** tab. Accepting, signing, sending back and deciding follow-ups need elevated access to the item's layer. The owner always has it, a member needs an explicit grant, and agents never do. Acceptance re-checks inputs, layer source, policy and observation, then applies every change, the proposal state and the Work state in one SQLite transaction.
- **Follow-ups.** Each follow-up is decided independently of the main change, even after send-back. *Create* adds a `suggested`, layer-scoped item in the target layer. Its `context.createdBy` holds the agent profile, source layer, source item and ref, attempt, proposal and reason. Its first log line reads "Created by <agent> from the <layer> layer as a follow-up to W-n; accepted by <reviewer>". A decided follow-up stays decided.
- **Access.** Pages › Tasks shows **Access** instead of Actions: what an agent may change, the layer default assignee (elevated to change), and the per-person elevated toggle (owner only). Existing layer-wide elevated grants carry forward. Action-specific grants are **not** widened to the layer.

## Checks

- Portal server suite: **180/180 passed** (176 baseline + 4 new). The new tests cover the full owner/member elevated path with a created flow, a revised flow, notes and a signed follow-up; stale input, changed source and a dismissed follow-up after send-back; grant migration without widening, default-assignee seeding and no action back-fill; and the legacy path without the package.
- Pages template tests **5/5** at `07e2c74`. The flow rule digest is unchanged (`51524ef9…`) and registered for the new commit.
- Typecheck and production build passed with only the warnings that were already present. `git diff --check` passed.
- New browser journey `tests/layer-scope-browser.mjs` **passed** against a real portal on a seeded agent run. It checked Access (axe clean), create without an action picker (axe clean), the Follow-ups tab (axe clean), creating and dismissing follow-ups, the created item's agent/layer signature, *Sign and accept* applying the flow, and no horizontal scroll at 390px. The screenshots were inspected; that inspection found and fixed a missing space in Access and icons missing from the committed subset.
- `tools/browser-checks.sh layer-bar` passed. `layers` **failed** at a Vision nav-link wait. The untouched base commit `0a92186` fails at the same step, so the failure predates this change and was not investigated here.

## Limits

- Only Pages flows have a change adapter. Page and Map edits are manual until adapters exist. Vision, Design, Data, Code and Deploy still use actions until LAT-T03.
- A follow-up aimed at an unconverted layer creates an action-less item that a person can do but an agent cannot run.
- The signature and acceptance ordering from the revise-flow slice is unchanged: the signature is written after the acceptance transaction.
- This change does not address per-project SQLite, owner original data, duplicate instances or the owner browser review.
- Also observed, not caused by this work: the Work item page overflows horizontally at 1440px because of the Links form (1493px), on the base commit too.

## Retrospective

1. **Harder than necessary:** action IDs were the dispatch key in about ten places (stage, pin, issue projection, manifest, submit, accept, close guards, reserve, run projection, UI). Removing actions meant finding each branch. Two hidden back-fill paths (`migrateWork`, LAT-08 ledger) would have silently re-attached an action or blocked the item. An accidental server import during checking also created a fresh, ignored `.data` store; it was confirmed new and removed.
2. **Would make it easier next time:** a single `workScope(item)` gate that every Work stage consults. This slice added `item.scope` and `layerWorkScope`. The next layer conversion only registers its adapters and declares `work` in `layer.json`. Run code by importing modules in a test, never by importing `server.mjs`.
3. **Roadmap effect:** LAT-08 no longer needs per-action installation, method revisions, per-action grants or per-style seeding for converted layers. Its remaining permission gate becomes per-layer elevated grants plus historical item readability. LAT-T03 should convert each layer by declaring `work` and registering change adapters, not by recreating actions.
4. **Questions:** Should agents ever start follow-ups themselves? For now, no: follow-ups are decided in review. Should a follow-up item inherit the source item's project or milestone? This is not decided; it currently uses the default derivation.
5. **Process change:** the authority-versus-guidance rule was added to the root operating procedure. It was applied here, and the tests show the authority part (adapters, elevated gate, instance scope) is fully enforced without any guidance record. Whether dropping per-action guidance changes agent output quality is only a hypothesis until a live provider turn is authorized and compared.
