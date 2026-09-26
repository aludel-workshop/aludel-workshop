# Work with Codex on an Aludel project

This is the local PP-01R pilot. It gives Codex read-only access to your assigned work and this project's live Aludel knowledge. Code stays in the project's Git repository. Changing Aludel records, running agent batches, pushing code and deploying remain separate actions.

## Connect on this machine

1. Sign in to Aludel. Open the project, then **Work → Team → Work with Codex in VS Code**. Create an editor token and copy it. Creating another token for the same project revokes the old one.
2. In a terminal in the Aludel checkout, run:

   ```sh
   node apps/portal/tools/editor-mcp.mjs pair http://127.0.0.1:4310
   ```

   Paste the token at the hidden prompt. The command checks the connection and writes it with mode 0600 under `~/.config/aludel/editor.json` (or `$XDG_CONFIG_HOME/aludel/editor.json`). Never put this file or the token in a repository.
3. Register the adapter with Codex, using the absolute path to this checkout:

   ```sh
   codex mcp add aludel -- node /absolute/path/to/aludel-workshop/apps/portal/tools/editor-mcp.mjs
   codex mcp list
   ```

   Restart the Codex IDE extension. Open the project's own checkout in VS Code and ask Codex to call `assigned_tasks`, then `task_context` for a chosen work item. It can follow record IDs with `read_record` and `search_knowledge`. `saved_context` reopens a bundle by digest after live records change.

For a second project, set `ALUDEL_EDITOR_CONFIG` to a separate file path for both `pair` and the MCP adapter, and give its Codex server a distinct name. The environment variable contains a path, never the credential itself.

## When Aludel is on a server

Open an SSH tunnel from your development machine to the server's loopback-bound portal, then pair against the forwarded loopback port. Use the server's existing SSH identity; do not copy the portal database, browser cookie or GitHub App key into the checkout. The same MCP adapter makes HTTP requests through the tunnel and Aludel still checks the editor token's user and project scope. An authenticated HTTPS endpoint could later replace the tunnel without changing the tool contract.

## What the bundle proves

`task_context` returns the work item, its source records with revisions, project and role guidance, action tool permissions, repository commit and a SHA-256 digest. An unchanged input produces the same digest. A later edit produces a new bundle; `saved_context` retains the earlier one. The current draft-only agent runner still has its own prompt construction, and LAY-05 has not built the solo coding runner or candidate review. This pilot proves the read path and establishes the bundle contract; it does not yet prove an end-to-end coding run.

Revoke the token from Work → Team when the connection is no longer needed. A revoked or replaced token cannot read Aludel.
