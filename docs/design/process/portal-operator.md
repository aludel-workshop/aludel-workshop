# Interim supervised operation

**Interim override — DEC-029, 2026-09-20:** portal-only dispatch is suspended. Explicit owner instructions in the current chat may authorize bounded local research, design, repository edits, checks, and local previews. Record that scope in the repository work record before execution. Portal authorization state is optional evidence and must not block chat-authorized local work. Spending, external accounts or writes, public deployment, release, and acceptance still require their specific owner authorization. The operator remains a trusted local collaborator, not a sandboxed service. Never read session credentials or write authorization rows directly.

The procedure below is retained as historical evidence and as an optional way to exercise the existing bridge. It is not the current dispatch requirement.

## Historical portal-first owner cycle

1. Save an idea using **New request**; tell the agent it is saved.
2. Agent reads the inbox, prepares a proposal and one bounded work item. Lightweight interpretation/preparation is covered by the request; implementation requires the next step.
3. Open **Work**, inspect scope, success criteria, linked proposal revision and allowed effects, then **Authorize work**. Notify the agent.
4. Agent reads the committed record, claims it, executes only that scope and records progress. Read state again before each meaningful work segment or effect. Cancellation is cooperative, not immediate process termination.
5. A worker question pauses only that task. Save the answer in Work; **Resume authorized scope** explicitly permits continuation if scope still applies. A changed scope requires a new proposal/work item and authorization. Existing Decisions continue to own versioned product choices; task questions are execution clarification history, not a replacement for consequential decision revisions.
6. Agent submits evidence into Work. Submission is not acceptance or release. Full immutable candidate review remains B-03B; do not fabricate acceptance in this bridge.

## Operator interface

Use Node 24 (available at `/tmp/machine-md3-runtime/node_modules/node/bin/node`):

```sh
node apps/portal/server/operator.mjs inbox
node apps/portal/server/operator.mjs propose /tmp/proposal-input.json
node apps/portal/server/operator.mjs prepare /tmp/work-input.json
node apps/portal/server/operator.mjs claim /tmp/claim-input.json
```

Input is a JSON file, never a shell-interpolated body. `MACHINE_DATA_DIR` selects a disposable test database; default is the running portal's `.data` directory. Do not copy or print authentication tables.

- `propose`: `requestId`, `title`, `intent`, `acceptance`/`assumptions`/`exclusions` arrays. Read existing proposals before creating; a request has one proposal.
- `ask`: `proposalId`, `question`, `context`, `options` (at least two strings), optional `recommendation`. Creates a consequential question in Decisions before execution. The owner answers there; prepare work against the resulting decision revision.
- `prepare`: `proposalId`, numeric `proposalRevision`, `title`, `scope`, `acceptance` (text). Produces ready work, never authorization.
- `claim`: `id`, numeric `expectedVersion`, `worker` (e.g. `codex-local`). Only authorized and current inputs; returns an attempt ID and input snapshot.
- `progress`, `question`, `submit`, `fail`: `id`, `expectedVersion`, `worker`, `attempt`, `text`. Record concrete checks, artifact paths/digests and limitations in submitted evidence. No secrets.
- `cancelled`: same identity/version fields; only after stopping a cancellation-requested task.

Every operation is transactional and appends an ordered event. Re-read on conflict; never blindly replay. Claims are limited to one running/cancelling task. Interrupted manual work remains visible; no expiry, automatic reclaim or retry. The same operator may continue an inspected attempt; uncertain effects must be resolved before continuing. Cancel and prepare a newly authorized item when a fresh attempt is needed after failure.

## Runner handoff

`workflow.mjs` is the shared domain boundary. Owner operations are authenticated HTTP; worker operations currently use this trusted local CLI. Protocol `supervised-local-v1` carries task identity, proposal/decision snapshot, allowed effects, authorization, version, worker/attempt and ordered events. A future Symphony gateway translates eligible committed tasks to its tracker/worker contract and maps events back through domain operations. It must not scrape the UI or interpret chat “go”.

Before an unattended adapter: add narrow worker authentication/transport, durable lease/heartbeat/fencing and unknown-outcome reconciliation, immutable context/source identity and candidate artifact storage, tracker mapping, cancellation confirmation and recovery tests. Reuse the pinned R-06/R-05 evidence; revalidate actual adapter compatibility. This interface is ready for supervised use, not claimed to be a drop-in Symphony integration. Confirm it through a real owner cycle before automating it.

## Collection handoff and review decisions

Link a prepared item by its detail URL (`/#/the-machine/work/<id>`) as well as naming its proposal revision. Verify the collection remains usable with more than one item; the [first owner-cycle navigation failure](../../evidence/b-03a-work-navigation.md) was missed by a single-item fixture. A no-op proposal save still increments revisions in the current bridge; compare content and prepare against the current revision rather than silently rebinding the original work.

A new proposal-linked decision changes the input snapshot checked by the current bridge. For a completed planning deliverable whose output requires owner selection, submit its evidence first, then create the follow-on structural question. Prepare the next scope only after that decision is answered. Do not add a follow-on question mid-attempt and then bypass input checks to finish. A genuinely blocking mid-task question still pauses through `question`; consequential scope changes require newly prepared work.
