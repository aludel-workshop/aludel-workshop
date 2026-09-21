---
id: process-dry-runs-001
revision: 1
status: observed-manual-replay
updated: 2026-09-19
---

# Three manual applications of procedure revision 1

These are author-run desk exercises, not independent agent trials or user research. No fictional approval below is an actual owner decision. The source manifest in the [evidence report](../../evidence/r-07c-process-validation.md) identifies inputs. Each case was assessed using the operating procedure's six steps. Results below are the actual routing decisions produced in this session.

## A — Existing portal flow

**Outcome:** determine whether the scope proposed for D-01B v3 was ready for interaction construction. **Class:** cross-page workflow. **Process issue:** a selected Overview composition was used to advance a larger provisional flow. **Permitted effects:** analysis only.

| Required evidence | Input / inspection | Verdict |
|---|---|---|
| Purpose and actors | Product definition; v2 feature S1–S8 | Present as working baseline |
| Overview composition selection | v2 review record, actual “I prefer B”; explicitly limited to Overview | Accepted for that scope |
| Surrounding structure | v2 feature says product map is unaccepted; V3 labels detail “Work,” with no distinct collection contract | Draft / insufficient |
| Post-decision transition | V2 allows return to origin or newly ready task; state row says confirmation + inspect ready task | Ambiguous destination and multi-task semantics |
| Task stories | S4–S6 plus V3 content list exist; no arrival/state story map resolving page dominance | Partial; story labels do not settle composition |
| Component boundaries | C3 independent-work list traced to V1; task layout later included unrelated work per F-05 | Existing responsibility rule was not enforced |
| Review scope | Actual selection excludes broader navigation and shared flow approval | Cannot promote the whole packet into readiness |
| Behavior checks | D-01B report records model/browser passes | Execution evidence; does not repair structural gaps |

**Generated sequence:** A1 audit and scoped readiness record (this exercise) → A2 owner journeys and page/transition contracts → A3 loose shell/page alternatives → A4 owner structural selection → A5 scoped prototype readiness assessment → A6 interaction experiment and owner review. A2/A3 belong to D-01D, executed in that order; A5/A6 belong to D-01B. A3 must return to A2 if it introduces a new responsibility.

**Stopping point:** needs groundwork. Next permissible live action is D-01D's journey and responsibility work, not another prototype. Its starting questions are what the owner needs after recording a decision, how they select among several ready tasks, and what task detail owns by state. Owner selection is needed after alternatives exist, not before authorized groundwork.

**Adversarial replay:** remove the feedback report and inspect only the pre-prototype v2 evidence. The unaccepted product map, missing collection contract and incomplete scoped acceptance still produce “needs groundwork.” If B's selection is entered as approval of V1–V4, the review-scope check rejects that interpretation against the actual review record. This supports earlier detection without relying solely on known defects; it remains a retrospective author judgment.

**Revision check:** if Overview wording changes without altering its hierarchy, reassess that wording only. If “answer saved” begins automatically authorizing work, invalidate the affected decision/task/review contracts and return to structure and authorization review.

## B — Unfamiliar fictional product: BenchShare

**Synthetic request:** “Make a prototype where a community workshop coordinator assigns members to supervised equipment sessions and fills cancellations.” No prior product artifacts supplied. **Success of this exercise:** produce a justified first work sequence without inventing policy in screens. **Class:** new product. **Permitted effects:** desk exercise only; no real users, scheduling, messages or implementation.

**Intake result:** coordinator is named; member and supervisor roles are implied but unconfirmed. Unknowns include whether members request places, how qualification is established, session capacity, who approves reassignment, and whether cancellation should trigger notification or automatic allocation. A scheduling calendar is a possible representation, not an established requirement. Proposed outcome for discovery: reduce coordinator effort while keeping allocations understandable; measurement remains to be agreed.

| Evidence gap | Work generated | Dependency / check |
|---|---|---|
| Actual problem and actors | B1 discovery brief: actor responsibilities, present scheduling approach, success measure and assumptions; prepare a compact owner question | No prerequisite. Check facts versus assumptions |
| Allocation policy | B2 compare manual assignment and member requests with coordinator confirmation; consequences and exceptional cases | B1. Owner selects consequential policy from concrete comparison |
| Workflow and information structure | B3 map request/assignment/cancellation journeys and responsibilities, including full sessions and missing supervisor | B2 choice; all transitions have owner, record and outcome |
| Representation | B4 compare calendar-led and allocation-queue compositions using the same scenarios | B3; owner selects structural direction |
| Interaction experiment | B5 prototype only assignment comprehension and cancellation handling, with explicit fake records | B4 plus readiness record; guide tests named questions |

**Actual first output:** an assumptions inventory above and this decision prompt for a future real brief: “Who should initiate an allocation: the coordinator assigning members, or members requesting places for coordinator approval?” It materially changes B2/B3. This is a recorded exercise prompt, not a question sent to this repository owner or an assertion about a real workshop.

**Stopping point:** B1 can proceed with hypothetical alternatives, but B2 cannot be settled and B3–B5 cannot start from the sparse brief. No accepted workflow or shell exists. “Make a prototype” does not supply the missing evidence.

**Adversarial replay:** add a polished calendar screenshot as the sole extra input. The verdict is unchanged: it supplies a representation reference, not actor or allocation policy evidence. Add a fictional approval of calendar appearance only: B2/B3 still remain unresolved. This prevents superficial visual evidence from granting downstream readiness.

## C — Small change to an established pattern

**Synthetic baseline C0/r1:** an already accepted search-results page uses a heading, an empty-results sentence and a “Clear filters” action. It shows this state only after a successful query with zero matches. Loading and failed queries have separate states. The task is to replace “Nothing here” with “No tools match these filters.” The baseline acceptance is an explicit fixture premise, not an owner approval of any current portal screen.

**Class:** local content change; no behavior or layout change. **Process improvement:** verify the inherited state boundary before treating copy as routine. **Acceptance:** after a successful zero-result query, show the new sentence; retain the action; preserve loading/error messages and nonempty results.

**Generated sequence and output:** C1 verify scope against C0/r1 → C2 make the text substitution → C3 inspect the four affected contexts. In this desk exercise, C2 is represented by the before/after text above; no application file was changed. C3's static comparison finds only the successful empty-state text changes. Runtime behavior is not tested.

**Readiness verdict:** ready for a bounded copy edit under that fixture premise. No shell alternatives, new product discovery or additional owner direction is needed. A real task would cite the actual accepted baseline and run an appropriate local check before reporting implementation complete.

**Adversarial replay:** delete the baseline's loading/error distinction. The task becomes “needs groundwork” for a targeted state inspection, not a whole-product redesign. Change the proposed action to “Automatically remove filters”: that adds behavior and requires state/interaction assessment before implementation.

## Handoff reproduction

Using only each case's intake, evidence table and dependency sequence yields A → D-01D groundwork; B → B1 discovery with unresolved allocation policy; C → bounded copy edit when C0/r1 holds. This is a same-author handoff rehearsal. An independent fresh-session application is still needed to test whether the guidance is sufficiently clear and consistently followed.
