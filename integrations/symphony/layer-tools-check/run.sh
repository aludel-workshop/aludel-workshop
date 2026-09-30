#!/usr/bin/env bash
# LAYER-TOOLS-01: check the Symphony layer tools end to end without a model turn.
# Compiles the overlay at the pin, seeds a disposable portal, runs the real workspace hook, calls aludel_layer_call and
# aludel_layer_commit through the compiled adapter, submits, and has the owner accept over HTTP (data applied, branch merged).
# Needs Docker, the elixir:1.19 image and one existing local Symphony build (for its fetched dependencies), e.g. one made by
# ../local-hosts. Point SYMPHONY_BUILD at it, or the newest under MACHINE_DATA_DIR/symphony-host/builds is used.
# Nothing leaves this machine; the portal and adapter run in two containers sharing one network namespace.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
integration="$(dirname "$here")"
portal="$(cd "$integration/../../apps/portal" && pwd)"
data_root="${MACHINE_DATA_DIR:-$portal/.data}"
build="${SYMPHONY_BUILD:-$(ls -dt "$data_root"/symphony-host/builds/*/ 2>/dev/null | head -1)}"
[[ -d "$build/elixir/deps" ]] || { echo "No local Symphony build with dependencies; run ../local-hosts once or set SYMPHONY_BUILD." >&2; exit 1; }
mix_home="$(cd "$build/../.." && pwd)/mix"
node_prefix="$(cd "$(dirname "$(command -v node)")/.." && pwd)"
repo_root="$(cd "$integration/../.." && pwd)"
templates="$(cd "$repo_root" && node -e 'const {resolve}=require("node:path");console.log(resolve(require("./apps/portal/config/layer-templates.json").repo))')"
modules="$(readlink -f "$portal/node_modules")"
port="${LAYER_TOOLS_PORT:-4393}"
work="$(mktemp -d "${TMPDIR:-/tmp}/aludel-layer-tools-XXXXXX")"
name="aludel-layer-tools-$$"
cleanup() { status=$?; [[ $status == 0 ]] || docker logs --tail 20 "$name" 2>&1 | sed "s/^/portal: /" >&2; docker rm -f "$name" >/dev/null 2>&1 || true; [[ "${KEEP:-}" == 1 ]] || rm -rf "$work"; }
trap cleanup EXIT

echo "1. compile the overlay at the pin"
cp -a "$build" "$work/symphony"
git -C "$work/symphony" checkout -q -- . && git -C "$work/symphony" clean -qfd elixir/lib
mkdir -p "$work/symphony/elixir/lib/symphony_elixir/aludel"
cp "$integration/elixir/lib/symphony_elixir/aludel/adapter.ex" "$work/symphony/elixir/lib/symphony_elixir/aludel/adapter.ex"
git -C "$work/symphony" apply "$integration/profile-turn.patch" "$integration/runtime-block.patch"
elixir=(docker run --rm --user "$(id -u):$(id -g)" -e HOME="$work" -e MIX_HOME="$mix_home" -v "$work:$work" -v "$here:$here:ro" -v "$mix_home:$mix_home:ro" -w "$work/symphony/elixir")
"${elixir[@]}" --network none elixir:1.19 mix compile --warnings-as-errors >/dev/null

echo "2. seed a disposable portal and start it"
mkdir -p "$work/data/symphony-workspaces"; openssl rand -hex 12 > "$work/pw"
(cd "$portal" && MACHINE_DATA_DIR="$work/data" MACHINE_SYMPHONY_WORKSPACE_ROOT="$work/data/symphony-workspaces" MACHINE_PAGES_TEMPLATE_ENABLED=1 \
  SEED_PASSWORD="$(cat "$work/pw")" node --no-warnings "$here/seed.mjs") > "$work/seed.json"
project="$(node -p 'require(process.argv[1]).projectId' "$work/seed.json")"
docker run -d --name "$name" --user "$(id -u):$(id -g)" -p "127.0.0.1:$port:$port" -e HOME="$work" -e MACHINE_DATA_DIR="$work/data" -e MACHINE_HOST=0.0.0.0 \
  -e MACHINE_PORT="$port" -e MACHINE_SYMPHONY_WORKSPACE_ROOT="$work/data/symphony-workspaces" -e MACHINE_SYMPHONY_DISPATCH=1 -e MACHINE_PAGES_TEMPLATE_ENABLED=1 \
  -e PATH="$node_prefix/bin:/usr/local/bin:/usr/bin:/bin" -v "$repo_root:$repo_root:ro" -v "$templates:$templates:ro" -v "$modules:$modules:ro" -v "$work:$work" -v "$node_prefix:$node_prefix:ro" \
  -w "$portal" elixir:1.19 node server/server.mjs >/dev/null
export ALUDEL_WORKER_TOKEN_FILE="$work/data/symphony/$project/worker-token" ALUDEL_SOURCE_REPOSITORY="$work/data/workspaces/$project" \
  ALUDEL_WORKER_URL="http://127.0.0.1:$port/api/worker" ALUDEL_HOST_ID=layer-tools-check
for _ in $(seq 1 40); do [[ -f "$ALUDEL_WORKER_TOKEN_FILE" ]] && curl -sf -o /dev/null "$ALUDEL_WORKER_URL/issues" -H "authorization: Bearer $(cat "$ALUDEL_WORKER_TOKEN_FILE")" && break; sleep 0.5; done

echo "3. the workspace hook prepares the run (project checkout, layer/ on its work branch, outputs copy)"
issue="$(curl -sf "$ALUDEL_WORKER_URL/issues?states=Ready" -H "authorization: Bearer $(cat "$ALUDEL_WORKER_TOKEN_FILE")" | node -e 'const b=JSON.parse(require("fs").readFileSync(0));const i=b.issues.find(v=>v.title==="Scripted adapter check");console.log(i.identifier+" "+i.native_ref.attempt_id)')"
workspace="$work/data/symphony-workspaces/${issue% *}"; attempt="${issue#* }"
mkdir -p "$workspace"; (cd "$workspace" && node "$integration/workspace-hook.mjs" prepare && node "$integration/workspace-hook.mjs" start-run)
[[ -f "$workspace/layer/.aludel/outputs/page.json" && "$(git -C "$workspace/layer" branch --show-current)" == work/* ]]

echo "4. the agent's side: edit and test the layer, then call both tools through the compiled adapter"
printf '\nName the goal before the first step.\n' >> "$workspace/layer/knowledge/flow-method.md"
tests="$(cd "$workspace/layer" && node --test tests/*.test.mjs 2>&1 | grep -E '^ℹ (pass|fail) ' | tr '\n' ' ')"
[[ "$tests" == *"fail 0"* ]] || { echo "layer tests failed: $tests" >&2; exit 1; }
"${elixir[@]}" --network "container:$name" -e ALUDEL_WORKER_TOKEN_FILE -e ALUDEL_WORKER_URL -e ATTEMPT="$attempt" -e TESTS="$tests" \
  -e PAGES="$(node -p 'const s=require(process.argv[1]);s.pages.browse+","+s.pages.detail' "$work/seed.json")" \
  elixir:1.19 mix run --no-start "$here/tools_check.exs"

echo "5. the owner reviews and accepts"
node --no-warnings "$here/accept.mjs" "$work/data" "$port" "$work/seed.json" "$work/pw"
echo "layer tools check: passed"
