---
id: pp-01r-editor-bridge-evidence
kind: implementation-evidence
status: agent-checked
updated: 2026-09-25
---

# PP-01R: project-scoped Codex editor bridge

The owner authorized the local build in chat on 2026-09-25 and shelved the blank-project feature trial until this connection runs. [Scope and design](../design/platform-pipeline/work-record.md#15-pp-01r-shared-agent-workspace-for-local-co-work-and-server-runs-2026-09-25-designreadiness).

## Built

- Work → Team issues one 30-day editor token per person and project, replaces it on reissue, and revokes it. The UI copies the token only after creation; it is never written to the repository.
- Editor bearer tokens authenticate only the read-only `/api/editor/*` endpoints. Project membership is checked again at every request. The endpoints list a person's assigned tasks, return task context, retrieve a saved context by digest, read a current or pinned project record, search bounded project knowledge, and inspect preview/source status.
- A task context contains the work item, current target records and agent-readable documents, project/role/action guidance, permitted action tools, repository commit, and a labeled preview of the current solo runner profile/capability. Its JSON is saved by SHA-256 digest. Unchanged inputs retain the digest; changed records yield a new bundle while old bundles stay retrievable.
- `tools/editor-mcp.mjs` pairs through a hidden terminal prompt and stores its scoped credential outside the repository with mode 0600. Its stdio MCP tools call only the editor read endpoints. [Operator guide](../guides/co-work-with-codex.md).
- The same local adapter can use an SSH tunnel to a future server's loopback portal. This is the implementation transport; the work record's initial idea of starting the MCP process on the server was changed so Aludel can own token issuance and project authorization in its HTTP API. No SSH host was provisioned or tested.

## Checks observed

- Focused test `node --test tests/editor-bridge.test.mjs`: **2/2 pass**. It uses two users and two projects; tests no token, nonmember, foreign record, unchanged/changed bundle digests, old-bundle retrieval, token rotation/revocation, and a real disposable portal from browser session issuance through CLI pairing and MCP task calls.
- `npm run typecheck`: passes with two existing optional-chain warnings in Code.
- `npm run build`: passes.
- Full `npm run test:server`: **95/96 pass**. The sole failure is the existing Git-mode check for tracked `apps/portal/tools/delete-project.mjs`, which lacks executable mode. The new adapter has no shebang and is invoked with `node`.
- `git diff --check`: passes.
- No live project was paired and no real Codex model call or remote server was used. The running owner portal must restart to load this build. A visual browser check was unavailable because Playwright is not installed in the accessible workspace; the UI passed Angular typecheck and build, and the route was exercised through HTTP.

## Retrospective

1. **Friction:** browser cookies were the only current portal identity. A coding workspace could not safely reuse them. The existing agent context was a draft prompt string, not a replayable task artifact.
2. **Reusable preparation:** a project-scoped read token, a frozen digest-addressed bundle and a small MCP tool list now provide a repeatable bootstrap. The guide states how to pair without putting credentials in the repository.
3. **Downstream effect:** LAY-05 should consume the saved bundle contract for coding attempts and enforce its action tool list. It must still build isolated execution, immutable candidate review and recovery. The existing draft runner has not been migrated to this bundle.
4. **Questions:** a hosted instance still needs its operator-approved SSH or authenticated HTTPS access path. Multi-project Codex configuration and a server-side credential store need a later UX pass. Neither blocks this local one-project pilot.
5. **Process change tested:** comparing immutable bundle digests and membership boundaries in the same two-user, two-project fixture caught a real setup distinction: token authentication cannot be treated as a portal session. The CLI-to-disposable-portal test proves local read connectivity. Human usability and parity with a future solo coding agent remain unobserved.
