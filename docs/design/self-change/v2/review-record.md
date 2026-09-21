---
id: design-borrowbox-review-v2
status: direction-selected
updated: 2026-09-18
---

# Direction review

Open [the review board](review.html) directly in a browser. It needs no installation, build, account, or server. Navigation links scroll the review document; product controls are static drawings. The owner selected **B — Decision queue** on 2026-09-18.

## Comparison against research questions

| Question | A: milestone brief | B: decision queue | Evidence needed |
|---|---|---|---|
| RQ1: orientation | Explains outcome and current situation first | Compact milestone context; prioritizes the queue | Owner can state the objective and next useful action |
| RQ2: scope of blocking | Decision and independent work are adjacent | Affected records visible in selected context; independent work below | Owner distinguishes decision count from affected-task count |
| RQ3: answer versus authorize | Dedicated V2 then V3 | Same V2 then V3; queue only inspects | Owner says answering does not start execution |
| RQ4: acceptance identity | Shared V4; current candidate first | Same shared V4 | Owner identifies A1's inputs and stale consequence |
| RQ5: review orientation | Separate board instructions | Same frame | Owner distinguishes the design board, portal review, and preview inside it |

This is an author assessment of tradeoffs, not a usability result. The initial author recommendation was A; the owner selected B. A/B use the same fixture and downstream views so the main comparison is information hierarchy.

## Owner review script — D-01C

Allow about 5–10 minutes. First examine A and B without reading the recommendation. Ask the owner to identify the outcome, required choice, consequence, and independent task. Then inspect the three downstream sheets and ask what an answer authorizes, what a task authorization covers, and what accepting A1 means. Finally inspect the stale-state note and name the input that changed.

Record actual observations, including hesitation or misinterpretation; do not turn predicted advantages into findings. Ask for A, B, or a concrete revision, plus feedback on the shared flow and proposed product-map placement. A selection does not accept every global navigation label or resolve real Q-002/Q-005.

## Later prototype script — D-01B

After direction selection, prototype the chosen Overview and shared V2–V4 only. Use a separate review guide and scenario selector. Each scenario must be operable, not just shown in text:

1. Start with the blocked trial task; inspect consequence and independent task; record a decision. Confirm the independent task is unchanged and execution did not start.
2. Read task intent and allowed effects; authorize the current revision; observe simulated queue/run/result transitions. Label all simulation.
3. Open A1; try the BorrowBox tool-reservation preview; inspect acceptance examples; request a revision. Confirm A1 feedback remains and a new task revision requires authorization.
4. Choose stale-input scenario; identify the changed decision and why current acceptance is disabled.
5. Choose unavailable-worker, connector ambiguity, input-required, failure, and cancellation-uncertain scenarios; identify safe next steps without reading raw logs.

This review may refine Q-004/Q-005. It cannot prove live connectors, durable recovery, measured cost, or real previews.

## Feedback and selection record

- Owner request, 2026-09-18: “give d-01c a shot.” Authorizes preparation of this packet.
- Alternatives presented: v2 A and v2 B, with shared V2–V4 flow.
- Actual owner observations: v1 confused the portal with the application being created; owner requested an invented demo app across mockups. v2 introduces BorrowBox throughout; owner subsequently stated “I prefer B.” No additional usability observations were supplied.
- Selected direction: **v2 B — Decision queue**, owner statement “I prefer B” on 2026-09-18.
- Required revision from v1: separate portal and generated app — incorporated in v2. No additional revision was requested with selection.
- Selection scope: B as the Overview composition for the BorrowBox project. Shared V2–V4 remains the proposed supporting flow to test; this does not independently accept every navigation label or resolve Q-002/Q-005.
- D-01C completion: **complete**; required fixture revision incorporated and owner direction recorded.
- Historical routing at selection time allowed D-01B to resume. Superseded by DEC-013–015: D-01B is paused pending structural work and scoped readiness; follow [current status](../../../status.md).

## Verification

See [validation.json](validation.json) for browser render/link/overflow checks and capture dimensions. Those checks establish inspectability of this static board, not product behavior or owner acceptance. Screenshot exports are review conveniences; HTML is the editable composition source. Source hashes and board hash are retained in [provenance.json](provenance.json). This workspace has no Git metadata; version folders and hashes provide local identity, not a commit.
