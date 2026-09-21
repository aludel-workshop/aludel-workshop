---
id: brand-001
kind: work-record
status: complete
updated: 2026-09-21
---

# Aludel project brand

## Intake and authorization

The owner authorized a bounded local rebrand in chat on 2026-09-21: replace the former working title with “Aludel,” add the supplied alchemical workshop concept art, remove old human-facing name mentions, and make project branding replaceable and reusable for future projects. Authorized effects are repository edits, local assets, tests, and local preview checks. Excluded effects are deployment, provider writes, purchases, release, and acceptance on the owner's behalf.

## Readiness and process improvement

This is a cross-cutting project-brand change using the accepted portal shell. The previous name was duplicated across UI templates, seed data, package metadata, and durable documents. The reusable improvement is a project-owned brand record—name, description, tagline, accent color, and optional hero image—served through a project-scoped API. The shell consumes that record, and the same settings surface can update text or upload bounded raster artwork for another project without editing the shell.

Implementation is ready because the owner supplied the name, concept, tagline direction, and artwork. Stable internal IDs and compatibility-oriented environment variables remain unchanged; they are identifiers rather than displayed brand copy. Historical evidence remains valid after terminology updates.

## Acceptance checks

- Aludel appears in the login, shell, overview, metadata, and current durable product language.
- The supplied art is preserved as a repository asset and appears in an accessible, responsive brand hero.
- Project branding is read from project data rather than duplicated display literals.
- An authenticated project-scoped endpoint can update brand copy and accept PNG, JPEG, or WebP artwork with type and size limits.
- Invalid project, image type, color, and oversized content fail without changing the current brand.
- Build, typecheck, server tests, browser accessibility, and narrow layout are checked.

## Current limits

The project keeps `the-machine`, `machine-*`, `MACHINE_*`, and `launch-machine` compatibility identifiers in this revision. Renaming those would create migration and operator breakage without improving the owner-facing brand. Brand editing covers the existing project; a future project-creation flow must call the same contract when it creates additional projects.

## Evidence and post-hoc

Observed checks on Node 24: Angular typecheck passed; production build passed; all five server/domain suites passed, including the new brand persistence/upload suite. A disposable authenticated browser run proved the Aludel hero, Brand settings route, real PNG upload, persisted rendering, zero axe WCAG A/AA findings, and no horizontal overflow at 390 × 844.

The avoidable friction was the name’s duplication in templates and documents, plus a browser harness that requires both the repository’s Node 24 runtime and its extracted Chromium libraries. The applied process improvement was to separate project brand data from shell composition and add a focused end-to-end check for that contract. This test caught three harness assumptions before closeout (an ambiguous Brand link, CSP injection, and a persisted uploaded-asset path), so the improvement was useful in this task rather than merely documented.

The task does not change B-03B readiness, external-effect gates, architecture, or the single `next_action`. The remaining hypothesis is that the same contract will be sufficient during real second-project creation; Q-003 still supplies that future generality test.
