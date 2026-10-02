#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 -m http.server 8767 --bind 127.0.0.1 --directory "$script_dir"
