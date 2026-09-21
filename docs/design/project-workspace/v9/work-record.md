---
id: project-workspace-v9-work-record
kind: design-evidence-retrospective
status: composition-ready-owner-selection-pending
updated: 2026-09-20
packet: D-04R
---

# Reference-led Work composition

## Outcome and evidence

The owner authorized direct adaptation of the v7 references and then suspended portal-only dispatch after the current portal trapped ready work behind changed/open decision inputs. DEC-029 records that process correction. This packet applies the authorization to a reviewable four-page composition; it does not implement product behavior or accept the composition for the owner.

[Review board](http://127.0.0.1:4310/reviews/project-workspace-v9/index.html) contains:

- a quiet Overview with compact execution vitals, current-milestone progress and the owner action stack as its dominant content; “Next up” is removed;
- a recommended milestone-scoped Plan table adapted from Linear Initiatives, with one hierarchy level visible at a time;
- a secondary timeline alternative for cases where dates, dependency overlap and rollout sequence are meaningful;
- Agent Operations with Buildkite-like capacity, queue, server and spend-policy vitals plus a GitHub-like work-item stack ordered ready for review, problem, in progress, queued and blocked; Done is hidden by default;
- the v6 Intake list/detail direction retained with clearer selected-signal context.

The board labels illustrative values as illustrative or policy claims. It does not claim live agent, server, queue or provider-budget telemetry.

[Automated results](board-results.json) verify all review anchors, the removal of “Next up,” the expected stack/card counts, local font loading, a 390 px no-overflow check, zero scoped axe WCAG A/AA violations at desktop and narrow widths, and zero page errors. All five wide views and the narrow Operations view were visually inspected. The first test run found incomplete ARIA table semantics; the second found unfocusable horizontal scroll regions. Both defects were corrected before the passing run. [Source manifest](MANIFEST.sha256) identifies the final files.

## Process outcome

The portal authorization failure exposed a bootstrap deadlock: authorization policy depended on an interface whose recovery design is still being replaced. DEC-029 now permits explicit owner chat instructions to authorize bounded local research, design, repository edits, checks and local previews when the instruction and scope are recorded durably. Spending, external effects, deployment, release, phase transitions and owner acceptance still require explicit authorization. B-03A now requires a tested repair path for stale/open decision inputs before portal-first dispatch can return.

This task tested the interim path: the chat instruction was recorded in v8 intake, scope stayed within a local static composition, evidence was produced, and no portal authorization state was edited or impersonated. The process is therefore adequate for this bounded case; recovery in a future portal remains unproven.

## Retrospective

1. **Friction:** the portal could represent ready work but could not recover it after decision inputs changed. In the composition, links styled as rows initially led to invalid ARIA table ownership, and narrow horizontal regions were not keyboard focusable.
2. **Next equivalent task:** prepare the durable chat-authorized scope before execution, keep the browser check coupled to the exact final source, and include narrow focusability for any intentional horizontal region.
3. **Downstream change:** use the scoped table as the recommended Plan default and reserve the timeline for real schedule/dependency data. PW-01A should implement no connected behavior until the owner selects or revises these compositions. B-03A must prove direct recovery instead of a terminal stale-state message.
4. **Questions:** owner selection of the Plan default and the overall v9 composition remains open. Exact progress denominators, queue eligibility, connected-agent freshness and enforced spend limits still need real record contracts and fixtures.
5. **Applied versus hypothetical:** reference transfer, responsive composition and automated static checks are complete. Faster owner comprehension, efficient stack clearing and successful stale-input recovery remain hypotheses until owner review and connected interaction testing.

## Handoff

Review v9 and either select the recommended scoped-table Plan, select the timeline, or request a bounded revision. Selection closes D-04R; a separately authorized PW-01A can then implement the accepted Overview and Plan behavior. Live Agent Operations remains coupled to B-03.
