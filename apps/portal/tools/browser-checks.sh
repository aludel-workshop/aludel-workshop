#!/usr/bin/env bash
# Runs the portal's browser scripts, each against its own fresh portal and empty data directory.
#
#   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs tools/browser-checks.sh            # all scripts
#   PLAYWRIGHT_MODULE=… tools/browser-checks.sh layers product                                      # some scripts
#
# The scripts grew different conventions (MACHINE_PORT vs MACHINE_TEST_URL, an owner key, a data directory for
# fixtures); this sets all of them so no script needs to be run by hand. Build first (npm run build).
set -uo pipefail
cd "$(dirname "$0")/.."
: "${PLAYWRIGHT_MODULE:?Set PLAYWRIGHT_MODULE to a playwright index.mjs (npm i playwright anywhere, then npx playwright install chromium-headless-shell)}"
port="${BROWSER_CHECK_PORT:-4318}"
work="$(mktemp -d "${TMPDIR:-/tmp}/aludel-browser-checks-XXXXXX")"
scripts=("$@")
[ ${#scripts[@]} -eq 0 ] && scripts=(design product brand github workflow browser)
server=""
stop() { [ -n "$server" ] && kill "$server" 2>/dev/null && wait "$server" 2>/dev/null; server=""; }
# Agent keys are checked against a local stand-in, never the real providers (tests/provider-stub.mjs).
stub_port=$((port + 81))
node tests/provider-stub.mjs "$stub_port" > "$work/provider-stub.log" 2>&1 &
stub=$!
trap 'stop; kill "$stub" 2>/dev/null; rm -rf "$work"' EXIT
failed=0
for name in "${scripts[@]}"; do
  file="tests/${name}-browser.mjs"; [ "$name" = browser ] && file="tests/browser.mjs"
  data="$work/$name"; mkdir -p "$data"
  # A script that checks a compiled (pre-template) layer view says so with `// browser-checks: templates off`.
  templates="${MACHINE_LAYER_TEMPLATES_ENABLED-}"; grep -q '^// browser-checks: templates off' "$file" && templates=""
  MACHINE_LAYER_TEMPLATES_ENABLED="$templates" MACHINE_PREVIEW_RUNTIME="${MACHINE_PREVIEW_RUNTIME:-process}" MACHINE_DATA_DIR="$data" MACHINE_PORT="$port" MACHINE_ANTHROPIC_API_URL="http://127.0.0.1:$stub_port" MACHINE_OPENAI_API_URL="http://127.0.0.1:$stub_port" \
    node server/server.mjs > "$work/$name-portal.log" 2>&1 &
  server=$!
  for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$port/api/session" && break; sleep 0.2; done
  if MACHINE_DATA_DIR="$data" MACHINE_PORT="$port" MACHINE_TEST_URL="http://127.0.0.1:$port" MACHINE_TEST_KEY="browser-check-owner-key-$$" \
    PLAYWRIGHT_MODULE="$PLAYWRIGHT_MODULE" node "$file" > "$work/$name.log" 2>&1; then
    echo "pass  $name  $(grep -m1 '^PASS' "$work/$name.log" | cut -c1-120)"
  else
    failed=1; echo "FAIL  $name"; grep -v -e ExperimentalWarning -e '^\s*at ' "$work/$name.log" | head -12 | sed 's/^/      /'
    # The server's own errors (routines log and carry on), which the journey only sees as a missing effect.
    grep -iE 'error|failed|bindings for' "$work/$name-portal.log" | grep -v ExperimentalWarning | tail -8 | sed 's/^/      portal: /'
  fi
  stop
done
exit $failed
