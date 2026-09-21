---
id: project-workspace-v1-journeys
kind: journey-specification
status: proposed
updated: 2026-09-20
---

# Six walkthroughs and a creation rehearsal

These are manual design walkthroughs of alternative A, not functioning screens or observed owner usability. The review board makes the same map inspectable. Each journey names an owning record, transition and failure route; [contracts](contracts.md) defines proposed identities.

## J1 — Find completed work and what follows it

```text
Project → Work / History → B-02 (historical packet)
                            ↓ evidence and source assertions
                         B-02 completion + limits
                            ↓ dependent plan
                         B-03 remaining work → scoped task, if prepared
```

Owner sees title, completed-as-recorded date, provenance and evidence confidence, not a fabricated old run. B-02 references its source evidence; no authorization button is attached to historical completion. Work / Plan shows B-03 pending pieces and why they remain; the real r2 strategy work is linked as current execution under its own plan entry. Returning restores the history filter and row.

**Creation/edit:** import review proposes one plan entry per packet, not one per file; owner reviews reconciliation, then confirms apply. Editing the plan changes priority/scope revision, never past events. **Adverse cases:** conflicting completion claims show disputed currency and both sources; a missing evidence file remains a broken reference; cancelled r1 strategy work remains distinguishable from r2. **Passing future check:** B-02 and B-03 are discoverable without Knowledge/raw source, and importing twice changes neither counts nor authorization state.

## J2 — Change the product vision and understand consequences

```text
Project → Product / Direction → Edit draft → Compare → Save revision
                                                        ↓
                                       affected features/plans need reassessment
                                                        ↓
                                             optional new proposal/work
```

The brief presents audience/problem/outcome/constraints as readable sections with a concise current-state summary. The owner changes “one owner” to a hypothetical team requirement in a draft. Save explains which records consume the old constraint; it does not start team-auth implementation. The previous brief remains available for old artifacts. Roadmap is a view of milestone and plan records; edits there do not create a second source of task status.

**Failure/drafts:** concurrent save retains the draft and shows the current revision. Leaving asks to keep/discard unsaved work; no-op save reports no change instead of invalidating consumers. **Passing future check:** the consuming identity plan becomes stale, an unrelated visual correction remains current, and no task becomes authorized. This is a proposed extension of B-02 semantics, not already implemented for vision.

## J3 — Find a concept, its selection and the design system behind it

```text
Design / Views → Task detail → Explorations → option 1 (image revision)
                                               ├── question + alternatives
                                               ├── scoped selection and rationale
                                               └── System / pattern → pinned story
```

An image appears with its view, author/generator provenance when known, digest, question and scope of selection. A conceptual selection does not imply interaction acceptance. The system asset links to philosophy and deliberate deviations, current implementation, maturity and consumers. An unavailable historical workshop URL shows “unavailable” with retained screenshot/source; it never redirects to an unrelated running localhost service.

**Creation/edit:** from a view, create an exploration with question and alternatives, attach/register image/prototype references, then request scoped review. Component contracts and tokens remain repository-authoritative; request changes through linked work instead of editing a duplicate portal token field. **Passing future check:** the owner can distinguish historical v3 catalog, current code and the selected task composition without knowing their directory names.

## J4 — Ask “why is this like that?” in a running result

```text
Review candidate → Inspect context → Select Work view / status component
                                      ↓
           view intent → governing decision → selected concept → work → checks
                                      ↓
                          open any exact referenced revision
                                      ↓ return
                     same candidate, route and selected element
```

Inspect mode is explicit and belongs to the review frame. Keyboard users select the current view then named components from an equivalent list; pointer selection is optional. A component's shared contract and its use in this view are separate links. Current product records can be newer than the candidate: show “built with r3; current r4,” not an unqualified current rationale.

**Missing/renamed:** show “No recorded rationale for this element in this build” and offer a linked request. Never ask an LLM to invent a causal explanation from visual similarity. **Narrow:** context becomes a labelled sheet/destination with Back to preview; retain route/state in the review session. **Passing future check:** two builds of the same view resolve their own consumed decision revisions and cannot accept each other's context messages. Candidate trust/isolation depends on B-03, not on this document.

## J5 — Review a small change within the whole app

```text
View/feature → Exploration or implementation task → baseline identity + change scope
    → candidate build of project app → Review → choose baseline / candidate
    → navigate unchanged neighboring views → check changed scenario → respond
```

“Show only the change” means focus and comparison around a changed region while keeping the real application context. It does not mean shipping only a detached component or executing unbuilt patches in the accepted portal. An experiment imports the current shell/component source where compatible, with isolated fixture adapters and an explicit hypothesis. A component story is enough for a purely local state question; a cross-page question uses the app build. A new brand/composition hypothesis can remain a lo-fi artifact rather than being forced into production code.

The review frame identifies baseline/candidate and altered routes/components. Reset changes only synthetic preview state and preserves review feedback. The accepted service remains independent while a candidate Machine is reviewed. **Failures:** missing baseline disables comparison but retains candidate identity; reset failure is reported; changed inputs stale the review; expired preview keeps metadata and offers rebuild as new work. **Passing future check:** one view changes, the shell is not cloned, the owner can traverse to a neighboring route and back, and comments remain bound to one build after reset.

## J6 — “Let's build another app”

```text
Projects → New project → brief + name + constraints → Save draft project
    → Product / Direction (incomplete items explicit)
    → readiness assessment + capability choices → proposed setup work
    → owner authorizes bounded scaffold → independent repository/local preview
    → identified review result within that project's workspace
```

Draft creation is a database operation; it does not provision a host, connect a provider, copy private product data, buy services or start execution. Progressive framing asks only what blocks the next action. System/profile/stack can be supplied, proposed or unresolved. Shared recipes are explicit opt-ins at a pinned revision; choosing one shows what is inherited and overridden. Connection references are selected by project/purpose, not copied secret values.

For the BorrowBox rehearsal, use its fictional tool-reservation intent, member/volunteer roles, BB-D01 policy, tool-detail view and overlap acceptance examples. Do not inherit Aludel's MD3 or workflow concepts inside BorrowBox's runtime. If no stack is selected, mark setup blocked/proposed rather than silently choosing Angular. User-facing BorrowBox contains no development decisions or required portal login.

**Failures:** duplicate create retries use an operation key; switching projects with a draft offers keep/discard; project A cannot fetch project B records/artifacts by IDs; failed scaffold leaves the draft and visible attempt; retry needs outcome reconciliation and scoped authorization. **Passing future check:** two projects with the same local view key and differing systems stay isolated, and the generated app runs with Aludel stopped. The fictional walkthrough alone does not pass M3; the real second brief remains Q-003.

## Rehearsal of authoring from scratch

The same contracts must support a new project without importing docs:

1. Owner saves a product brief and one outcome; agent proposes a first feature/story set with explicit uncertainties.
2. Owner/agent creates a view brief and transition map for that feature, then records a consequential decision through the shared domain operations.
3. Register a system profile reference or proposed selection; create a concept/experiment and attach evidence. Selection records specify exactly which question/direction is accepted.
4. Create a plan entry; prepare work using frozen relevant revisions; owner authorization creates execution eligibility separately.
5. Record an artifact, checks and trace bindings from the resulting work; review the exact result; keep release as a different gate.

**Desk-check result:** A gives each step one owner/editor and navigable outputs; B also covers the steps, but shared design assets need repeated travel to the Product library. Both require typed records. This supports investigating A, not claiming measured task speed. Drafts, real retrieval, migration correctness and owner comprehension remain implementation/review tests.

## Review prompts

Start with J1 and J4. Can you predict where to find the record without searching? Does the division between Product, Design and Work match your thinking? Would alternative B better match the way you describe changes? Next, inspect J6: identify any mandatory step that would make a rough new-app request feel slower than it needs to be. Record structural selection in the portal; do not treat the walkthrough as approval of page composition.
