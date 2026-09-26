---
id: work-agents-01-vision-queue
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# WORK-AGENTS-01: Vision task queue correction

The owner's W-4 “write value prop” in Browser Buddy was ready, assigned to an agent, and had no target. The Work UI and server still rejected `product.brief`. Read-only inspection found a verified OpenAI project connection, a clean project workspace, and no paired Symphony worker. Removing the error message alone would have created a task that could not execute.

`product.brief` now runs in the existing connected-key Work batch. For a targetless item it produces one proposed Brief claim; with one linked Brief claim it proposes a revision. The proposal is stored separately from Brief records and shown in the Work item with section, wording, note, basis, prior wording where applicable, and the Brief revision used to draft it. A Product lead must accept each Work check and the exact proposal. Acceptance checks the Brief/target revision, applies one record revision linked to the Work item in a database transaction, and is idempotent. Send-back retains the Brief unchanged and a new run makes a new proposal. Unsupported actions retain their gate.

The process improvement was to inspect the actual task and available transport before choosing an implementation path, then make the output a reviewable candidate rather than applying model text during drafting. This is a pragmatic connected-key path for W-4. The single Symphony/person-paired session contract across layers remains unfinished.

A provider stand-in exercised targetless and targeted proposals, no pre-review mutation, checklist/lead acceptance, idempotent retry, send-back, and stale Brief rejection. The focused connected-key/Symphony suite passed **16/16** tests; Angular typecheck and production build passed with existing Code optional-chain and bundle-size warnings. The local portal was restarted on `127.0.0.1:4310` and returned HTTP 200; W-4 remained queued and no live agent turn was started. A real model draft and owner browser review remain untested.

The next equivalent action should reuse the candidate/revision-check/review pattern while moving its task context and tools toward the shared manifest. Test that migration before calling the orchestrator unified. The immediate owner flow is to refresh Work, stage W-4, deliberately start its batch, and review the proposed claim.
