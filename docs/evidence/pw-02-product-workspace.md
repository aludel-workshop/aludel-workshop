---
id: pw-02-product-workspace-evidence
kind: implementation-evidence
status: complete
updated: 2026-09-21
packet: PW-02
---

# PW-02 Product workspace implementation evidence

## Outcome

The local portal now has a Product area with Direction, Roadmap and Features over revisioned SQLite records. Primary navigation is reduced to Overview, Product and Work; Decisions, Sources and Settings are utilities. Proposal and other legacy URLs remain directly addressable. Product priority and horizon changes are deliberately separate from Work authorization.

The implementation applies the [primary-source pattern research](../design/project-workspace/pw-02/research.md): a read-first direction overview, a horizon projection over canonical outcomes, and a comparison list with contextual feature detail. It uses the existing Aludel MD3 system rather than copying vendor styling.

## Recorded behavior

- Direction exposes audience, authority, source provenance, desired outcomes, constraints and success evidence, then creates immutable revisions through an explicit edit state.
- Roadmap groups canonical outcome records by Now, Next and Later. It does not expose dates, progress percentages or health that the project cannot support authoritatively.
- Features are product capabilities linked to outcomes, not execution tasks. Wide layout preserves comparison and context; narrow layout stacks the same information without horizontal overflow.
- Seed records are visibly attributed to repository reconciliation and cite `docs/product.md` or `docs/roadmap.md`; later owner revisions retain that provenance while identifying owner authorship.
- Expected-revision conflicts return `409` without overwriting the current record. No-op saves do not create revisions. Only exact registered downstream dependencies become stale after a product revision.
- Product record writes do not call the Work transition API or alter work item state/version.

## Visual evidence

- [Direction, wide](../design/project-workspace/pw-02/evidence/product-direction-wide.png)
- [Roadmap, wide](../design/project-workspace/pw-02/evidence/product-roadmap-wide.png)
- [Features, wide](../design/project-workspace/pw-02/evidence/product-features-wide.png)
- [Features, narrow](../design/project-workspace/pw-02/evidence/product-features-narrow.png)

## Checks observed on 2026-09-21

| Check | Result |
|---|---|
| `npm run typecheck` under repository Node 24 runtime | Pass |
| `npm run build` | Pass; existing Vite chunk-size advisory remains |
| `npm run test:server` | Pass: 6 files, including initial product state, no-op revision, conflict, dependency-specific staleness and unchanged work state |
| `tests/product-browser.mjs` | Pass: three Product routes, real edits/create, legacy Proposals route, axe WCAG A/AA/2.1 AA, wide screenshots, 390px Features with no document overflow |
| `tests/workflow-browser.mjs` | Pass: existing four-route Work cycle from request through submit, plus wide/narrow axe and layout evidence |
| `python3 tools/check_product_system.py` | Pass: 24 capabilities, 2 projects, explicit allocations and handoffs; no operational readiness inferred |

Automated accessibility and screenshot inspection are evidence, not owner acceptance. Empty-state browser coverage is domain-backed but was not separately captured, and concurrent edit recovery currently preserves the draft by leaving form state intact while showing the conflict; there is not yet an in-form comparison/rebase tool.
