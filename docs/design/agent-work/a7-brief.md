# A7: review an action in the review modal, with a preview matching what it changed

Status: brief for a work item, 2026-10-06. Written at the owner's request ("we need a7 now, write it up as a task") under [DEC-070](../../decisions.md). The owner creates the item in the portal (Work › Create task) and pastes the brief below. The defining agent shapes the actions from it. Nothing is built yet.

## Brief (paste into the item)

**Title:** Review modal: preview what each action changed (A7)

An action in review opens a review modal, as the accepted prototypes showed, and the preview in it matches what the action changed. Today the review lists the staged records and, since W-25, offers a Preview link that opens in a new tab. The owner said: "i still just see a little accept button instead of the preview modal from our prototypes". By DEC-070 this is not limited to Pages: "if its just code i want to see those files, if it builds ui i want to interact with it".

The plan's sources: F21 and G2/G3 in `docs/design/agent-work/work-record.md`; plan slice A7 in `docs/design/agent-work/plan.md`; the prototypes `docs/design/agent-work/pages-review/v1` (flow walker) and `a0/v2` (Review on a Code action); the J6 walker already built for person runs (`src/layers/work-review.ts`, `server/review-walk.mjs`); W-25's preview handover (`preview` on actions, `npm run preview`). Background and the reasons for the choices below are in `docs/design/agent-work/a7-brief.md`.

Scope:
- **One review modal for every action in review.** It is opened from the action's card and its details. It shows the summary, the preview for the action's kind, notes, Flag and Approve. W-25's link stays as Open in a new tab inside the modal.
- **Records (any layer):** the staged changes, Previous beside Proposed. For Pages, this is the flow walker from pages-review/v1: steps down the side with New, Changed, Same and Removed badges; Previous beside Proposed, on phone or desktop; Highlight changes; walking by clicking inside the pages; pinned notes; round 2 against your last review.
- **Code without UI:** the files the action changed, with their diffs against the item's base, at the reported commit. Pick a file from a tree and read its diff.
- **Code that builds UI:** the live build inside the modal, as in J6. Clicking through it ticks off the action's checklist, which is its journey steps or the agent's "try" steps. Walking a step's page or doing its action marks it walked. The agent hands over the checklist with the preview.
- **How the live build gets to the modal: a preview tunnel.** The agent's container runs the preview, as W-25 does. The container then opens an outbound connection, authenticated with the item's editor token, to the portal it already reaches (`host.docker.internal:4310`). The portal serves the preview at a review subdomain of its app origin, which the portal may already frame, and injects the J6 walk script. This needs no Docker inside the container (F30), no portal build of Aludel's repository (PP-01D), and no forwarded ports. A portal-built preview (`server/review-previews.mjs`) feeds the same modal for apps that declare a review recipe.
- **Design's HTML kit (DEC-070):** Design generates `kit.js` from its own contracts (tokens as CSS variables, components as custom elements) for each Design revision, and its Components tab shows demos from it. Code binds each UI component to the kit element it implements. Pages' page specs become HTML files made of kit elements, with `data-go` links, so a flow can be walked without built code.
- **Kit fidelity spike first:** generate Biome's kit from its contracts and compare it with Biome's recorded screens (the G3 question). If they diverge, say how before building on it.

Choices for the owner to check at definition (unanswered P1–P6 default to the prototype's choices):
- P3: Approve waits until every changed step has been walked. In the prototype it does; a reason can stand in for a step that can't be walked.
- The tunnel serves previews to signed-in members only (Q-1 in COLLAB-WORK-01), on a separate subdomain, with no portal cookies forwarded.

Not in scope: Scripted flows with scenarios and branches (A7's third bullet in the plan) are proposed as a follow-up. Previews that restart on their own after a machine restart (W25-F1) are also out of scope. The tunnel shows "unreachable" until the agent runs the preview again.

Done when:
- The spike result is recorded.
- The modal, tunnel, file view, walker and kit are built, with server tests, the browser journeys and axe at 1440 and 390 px, and the templates gate.
- The owner has reviewed three real actions in the modal on this item:
  - a Code action without UI, by reading its files;
  - a UI action, clicked through live until its checklist was ticked;
  - a Pages action, walked Previous beside Proposed.

## Background for the defining agent

### Accepted prototype interactions this item must deliver

From pages-review/v1 and a0/v2. Each one has a place in the brief; none is deferred without saying so. At close-out, mark each row built, deviated or deferred ([operating procedure](../process/operating-procedure.md), slice close).

| Interaction (prototype) | Where in the brief |
|---|---|
| Steps with badges New, Changed, Same, Removed (pages-review/v1) | Records: Pages walker |
| Previous (accepted) beside Proposed; phone or desktop (pages-review/v1) | Records: Pages walker |
| Highlight changes, with the step's change list flashing each one (pages-review/v1) | Records: Pages walker |
| Walk by clicking inside the pages; fields can be typed in (pages-review/v1) | Records: Pages walker |
| Approve after walking every changed step (pages-review/v1, P3) | Owner check, prototype default |
| Pinned notes in Pages' note kinds; Request changes; round 2 against your last review (pages-review/v1) | Records: Pages walker; Flag carries the notes |
| View source and the kit drawer (pages-review/v1, P6) | Design's HTML kit; P6 open, so prototype default (shown) |
| Built view beside Mockup once Code builds the pages (pages-review/v1, disabled there) | Code that builds UI: the same modal |
| Review on a Code action walks its journeys on the preview build (a0/v2) | Code that builds UI |

### Why a tunnel (the owner's question: "is there some way we can pass something back")

Where previews broke so far:
- The portal can't build Aludel's own branch. Server-built review previews need the app's `Dockerfile` and `.aludel/review.json`, and Aludel's repository has neither ([connect-repository.md](../existing-projects/connect-repository.md), PP-01D).
- The item container has no Docker (F30), and giving it the host's socket is root-equivalent.
- The container can build and run the portal (F22 fixed for attempt 2), so W-25 has the agent run the preview there. But the link is a port only VS Code forwards to one machine.
- That link also can't be framed: the portal's CSP allows frames only from its own app origin (`server/server.mjs`, `frame-src`).
- The J6 walk script that ticks the checklist is injected only into previews the portal serves.

Options:
1. **Frame the forwarded port** (W-25's link, embedded). It's blocked by `frame-src`, gets no walk script, and works only on the machine that forwards the port. Rejected.
2. **Portal builds the branch** (`review-previews.mjs`). It's durable and already walks journeys. It needs a build declaration for Aludel (PP-01D) and Docker on the portal's host. It stays the path for apps with a recipe, and Aludel joins it once PP-01D lands.
3. **Agent passes back screenshots or a recording.** It's cheap but not interactive, so it fails "i want to interact with it". It stays as evidence only.
4. **Tunnel from the container to the portal (chosen).** The container already reaches the portal, and the portal already serves previews on its app origin with the walk script. So the agent's running preview is relayed through the portal: the container dials out, and the portal proxies requests for `review-<id>` to that connection. It works the same for a server-hosted Aludel and remote agents (COLLAB-WORK-01), because nothing has to reach into the container.

*Inferred, unverified:* the portal's existing preview subdomain proxy can relay over a long-lived connection without changing how it handles HTTP or WebSocket upgrades. The spike or the first tunnel action should prove one request, one WebSocket and the walk script end to end before the modal depends on it.

### Security notes

- The tunnel is opened only with the item's editor token. A preview is bound to the item and action that handed it over, and it closes when the item closes.
- The preview origin is a separate subdomain. Portal cookies and credentials never pass through to it, as with review previews today.
- Agent-written code runs only in the agent's container. The portal relays bytes and never runs it.

### Suggested shape (the defining agent decides)

1. Spec, gated:
   - Pages: the review modal and its three preview kinds on the Work item page, and the flows "Review a UI action by walking it" and "Review a code action's files".
   - Design: the kit's contract and the binding to Code components.
2. Kit spike and kit:
   - Biome's kit vs its screens (recorded).
   - Design generates `kit.js`, and the Components tab uses it.
3. Tunnel and checklist:
   - The container side (an `npm run preview` option and an editor API route), the portal relay and the walk script.
   - The checklist on the action, recorded per walk.
4. Modal:
   - Files view, live build with the checklist, and Pages walker (Pages specs as kit HTML, migrated from `page` records).
5. Proof on this item: the owner's three reviews.

This is the plan's size L. If the definition runs past about eight actions, propose splitting into two items: modal, files and tunnel first; kit and Pages walker second. Splitting is fine, but the owner should see the modal on a code action as early as possible.
