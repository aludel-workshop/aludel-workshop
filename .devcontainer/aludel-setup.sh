#!/usr/bin/env bash
# Runs once when an item container is created: fetches the Aludel tools from the portal, connects Claude Code to them,
# connects this container to its item (switching to its branch), then installs the app's dependencies. Claude Code's login is shared by every item
# container (the aludel-claude volume), so it's signed in to once; the item connection is this container's own.
set -euo pipefail
url="${ALUDEL_URL:-http://host.docker.internal:4310}"
tools="$HOME/.aludel/tools"
mkdir -p "$tools"
for file in aludel.mjs aludel-client.mjs editor-mcp.mjs; do
  if ! curl -fsS "$url/api/editor/tools/$file" -o "$tools/$file.next"; then
    echo "Couldn't reach Aludel at $url. Start the portal, then run: bash .devcontainer/aludel-setup.sh" >&2; exit 0
  fi
  mv "$tools/$file.next" "$tools/$file"
done
printf '#!/bin/sh\nexec node "%s/aludel.mjs" "$@"\n' "$tools" > "$tools/aludel"; chmod +x "$tools/aludel"
claude mcp remove --scope user aludel >/dev/null 2>&1 || true
claude mcp add --scope user aludel -- node "$tools/editor-mcp.mjs" >/dev/null
# The clone starts on main. Connecting it from the item's page (press Connect beside the code shown here; up to ten minutes)
# tells it its item, and it switches to the item's branch. `aludel connect` tries again later.
[ -s "${ALUDEL_EDITOR_CONFIG:-$HOME/.aludel/editor.json}" ] || aludel connect || echo "Not connected yet. Run: aludel connect" >&2
# Dependencies for the branch it ends up on.
( cd apps/portal && npm ci --no-audit --no-fund )
