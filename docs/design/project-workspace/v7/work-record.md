---
id: project-workspace-v7-work-record
kind: research-evidence-retrospective
status: research-complete-composition-selection-pending
updated: 2026-09-20
packet: D-04R
---

# Reference study closeout

## Scope and evidence

The owner requested specific revisions to Overview and Agent Operations, rejected Plan clarity, retained Intake's direction, and asked for examples/case studies and functional suggestions before another take. This turn completes that research and preparation; it does not execute the previously prepared prototype task. The portal inbox showed the v6 revision item ready, version 1, with no authorization.

Read the current handoff, v6 audit, previous v5 research and placement procedure. Reused accepted D-01F revision 3 principles as the design constraint. Reopened the Plan default and Overview emphasis based on the actual owner feedback, not a new inferred preference.

Outputs:

- [Research](research.md): feedback, nine primary-source visual examples/supporting assets, documented behavior references, borrow/avoid analysis, alternative comparison, functional recommendations and reversal conditions.
- [Visual board](http://127.0.0.1:4310/reviews/project-workspace-v7/index.html): actual vendor screenshots with attribution and proposed transfer diagrams. This is a research artifact, not another product prototype.
- [Source manifest](sources.json): original page and image URLs, access dates, image hashes, evidence type. Vendor screenshots remain reference material, not product assets or live-account proof. GitHub's roadmap crop is explicitly only a toolbar reference; Jules supplies behavior evidence only.
- [Browser evidence](board-results.json): four review anchors, seven embedded images load, keyboard disclosure, local Roboto, 390 px no overflow, zero scoped axe violations at desktop/narrow widths and zero page errors. [Wide capture](study-wide.png), [narrow capture](study-narrow.png). Every downloaded reference image was inspected visually; the board's wide and narrow captures were also inspected.
- [MANIFEST.sha256](MANIFEST.sha256): hashes of final study files. Served source/reference files matched the repository copies.

No live vendor account, external message, purchase, account connection, billing configuration or application runtime feature changed. `4/4 agents`, `12 queued` and progress examples are synthetic semantics, not observations of Aludel. The no-incremental-spend policy remains; no provider-enforced cap is claimed.

## Process improvement and application

Observed process gap: v5's capability comparison recommended an outline without proving its reading order or navigation. V6 made the outline tidier but the owner still found it muddy. Capability support and visual fit are different evidence.

Applied now: inspect actual primary-source screen artifacts, record their object granularity and reading order, explain transfer through an owner walkthrough, and distinguish vendor behavior from proposed adaptation. Added this requirement to the operating procedure. Its application here rejected the full tree as default, rejected a large task composer in Operations, and retained compact resource semantics without importing a fleet dashboard. These are observed design-analysis results, not proof of improved usability.

## Retrospective

1. **Friction:** search results included an older Buildkite description inconsistent with the opened page; checked the actual current page and captured asset. Some web image links failed, while direct public downloads succeeded. Image auto-format returned AVIF; original PNG URLs made inspection reliable. No login was needed.
2. **Next equivalent task:** collect primary screen, behavior documentation, dated provenance and borrow/avoid notes together. Check whether an image is a complete screen or a promotional crop before treating it as layout evidence. Use the known Chromium/library path, URL-safe filesystem paths and public PNG sources where available.
3. **Downstream change:** abandon v6 hero/next-up and full-outline default. Move Plan back to a small composition comparison. Carry review-first task cards and truthful vitals into Operations. Preserve Intake direction. PW-01 implementation remains blocked; existing phase and worker boundaries remain adequate.
4. **Questions:** which Plan composition best supports owner navigation remains a scoped design judgment. Progress denominator, queue eligibility, stage semantics and budget enforcement are explicit proposed contracts requiring fixture/live evidence at the relevant stage, not extra broad owner questions now.
5. **Applied versus hypothetical:** screenshot-backed analysis and bounded research-board checks are complete. Better owner comprehension, faster review-stack clearing and a usable five-state stack remain hypotheses for the next composition review and interaction trial.

## Ready next step

Research task complete. D-04R next prepares/reviews the new compositions; it is not a phase transition. The scope is concrete in [WORK-d1d62f3c](http://127.0.0.1:4310/#/the-machine/work/WORK-d1d62f3c-a7e1-4399-99e9-aae8117ad548), proposal r2, version 1, ready and not authorized. It replaces the intent of `WORK-ef2752ba` (v6-based scope); that earlier record remains unchanged in the app for history and must not be claimed as the current revision. No owner cancellation or authorization was impersonated.

New scope ends at Plan composition selection before a connected prototype. Avoid copying the research board's diagrams into production as if they were accepted layouts. The owner has not selected the new Plan or accepted Operations/Overview compositions; Intake's “about fine” is qualified composition feedback only.

Reproduce the board check using `LD_LIBRARY_PATH=/tmp/app-builder-d01b-browser/libs/usr/lib/x86_64-linux-gnu /tmp/machine-md3-runtime/node_modules/node/bin/node docs/design/project-workspace/v7/check-board.mjs` with the existing local portal running and Chromium process/network permission. This checks the board only.
