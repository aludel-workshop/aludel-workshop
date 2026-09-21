---
id: process-trial-d01d-v1-assessment
status: complete-with-trial-limitations
updated: 2026-09-19
---

# Live application evidence

## Process outcome

Applied procedure revision 1 to a new cross-page design packet. No procedure amendment was needed: its transition tuples, page exclusions, cardinality walks and scoped acceptance rules directly covered the known failure modes. The reusable improvement in this application is an explicit worked example linking journey → responsibility → transition → composition → scoped judgment, rather than another checklist. Reuse [the contracts](structure.md) and [acceptance ledger](review-record.md) as examples, not required file counts.

The [input manifest](inputs.json) was captured before changes. All 15 files in R-07C's frozen baseline matched their hashes at intake; no stale-baseline repair was needed. This workspace has no Git metadata, so hashes establish local identity only.

## Gaps resolved before composition

| Gap found during D-01D.1 | Resolution before board construction | Evidence and limit |
|---|---|---|
| “Affected” and “ready” scopes can differ after one decision | Added a second affected fixture task with another prerequisite; affected Work includes blocked rows, Overview ready filter includes independent work | BB-001/002/003 example, T1–T2 and frames 02–03; reasoned coverage, not runtime dependency test |
| Request-to-task arrival could disappear while focusing on the four named modes | Added J1, P2-owned request form, T0 and E4 | Request saves into durable refining task before authorization; no full composer design claimed |
| Reviews and Releases were conflated in old navigation | Candidate review has its own collection; acceptance remains on candidate and says not released | P5/T8 and frame 06; release design deliberately deferred |
| Return path depends on direct link, collection filter or project switch | Defined preserved return context and canonical fallback; unsaved draft handling | T11; interaction behavior not implemented |
| Portfolio need could force extra global areas without a story | Compared project-first A against cross-project Attention B | J0 and shell alternatives; owner selected A |

These are observed additions to the written design during this session, not proof that every omission has been found. No interaction prototype was built. The owner selected A after reviewing the board, but supplied no narrated task observations; the packet therefore claims direction acceptance, not a usability test or independent replication.

## Manual contract walkthroughs

Method: follow each starting premise through the written transition tuple and board; compare destination scope, record mutations and state language. Performed by the same agent that authored the artifacts on 2026-09-19. “Pass” means the proposed contract supplies a consistent answer, not a functioning application.

| Case | Observed contract result | Verdict |
|---|---|---|
| Answer policy with two dependent tasks, one still blocked | T1 stays on answered decision; T2 shows both affected tasks; independent BB-002 unchanged | Pass |
| Zero / one / many affected tasks | Explicit no-linked-work result / scoped collection / all affected rows; named detail link distinguished from summary | Pass |
| Ready count before/after answer | Before: BB-002 only; after: BB-001 and BB-002; affected filter retains BB-003 | Pass |
| Authorize while connector result unknown | Same task shows authorization recorded, not queued; reconciliation blocks duplicate dispatch | Pass |
| Offline worker, failed attempt, uncertain cancellation | Task state/action map supplies waiting/cancel, safe-retry scope, or reconciliation; evidence retained | Pass |
| Agent question during run | Task → decision → task continuation scope; answer does not resume | Pass |
| Save request fails or task entered from copied link | Draft retained / canonical Work return available | Pass |
| A1 accepted / revision requested | Stay on exact accepted A1 / move to r2 with old review preserved; no release or automatic run | Pass |
| A1 stale, preview missing or evidence incomplete | Retain identity; show cause and recovery; no substitute candidate or implied pass | Pass |

## Historical feedback coverage

| Finding | Concrete response | Remaining evidence |
|---|---|---|
| F-01 ambiguous post-decision card | Answered decision stays visible; specific readiness impact; T1/frame 02 | Test comprehension in D-01B |
| F-02 summary jumps to arbitrary task | P2 collection and T2; frame 03 | Test destination prediction in D-01B |
| F-03 task lacks spine | State-specific story map, P4 and frames 04–05 | Test task purpose/next action in D-01B |
| F-04 faux tabs | One document, real destination links, disclosures for history | Later prototype semantics/focus checks |
| F-05 unrelated work on detail | P4 exclusion and C2/C3 ownership; BB-002 appears only in collection context | Later component checks |
| F-06 unsupported shell | Two explicit shell alternatives and responsive rules | A selected by owner for prototyping |
| F-07 skipped stages | Contracts written before static board; ledger refuses inferred approval; no prototype edits | Subsequent handoff compliance remains unproven |

## Readiness and cost of the process

**D-01D.1/.2:** agent-checked. **D-01D.3:** complete; owner selected A and asked to continue. **D-01D.4:** complete with the limitations below. **D-01B:** [ready for the bounded interaction experiment](prototype-readiness.md). Q-004/Q-005 remain experiment questions; fictional authorization does not resolve Q-002.

One combined contract and one board cover the artifact families instead of separate documents for every page/component. The repeated wireflow made both complete directions inspectable; the owner selected A without requesting clarification, but no time or burden measurement exists. No owner-discovered omission was reported. Independent handoff success and operational comprehension remain unmeasured.

The board deliberately uses no behavior scripts. [Validation](validation.json) records desktop/narrow render checks; those checks prove inspectability only. Input/output hashes and local-link checks are mechanical integrity evidence. No product behavior tests were appropriate for a static structural packet.

**Process result:** the procedure caught five structural gaps before composition, preserved the limited prior acceptance, and produced a concrete gate the owner could resolve. It did not prove usability, completeness, future compliance or efficiency, so revision 1 remains a trial rather than a mature process.

**Task result:** project-workspace direction A is selected for D-01B, with page ownership, transitions, task stories and component responsibilities defined. **One next action:** D-01B, build the bounded local interaction experiment described in the readiness verdict.
