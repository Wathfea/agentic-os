#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_PATH="${REPO_ROOT}/store/agentic.config.json"

read -r -p "Google OAuth client ID: " CLIENT_ID
read -r -s -p "Google OAuth client secret: " CLIENT_SECRET
echo

if [[ -z "${CLIENT_ID}" || -z "${CLIENT_SECRET}" ]]; then
  echo "Client ID and secret are required."
  exit 1
fi

mkdir -p "$(dirname "${CONFIG_PATH}")"

python3 - <<PY
import json
from pathlib import Path

path = Path("${CONFIG_PATH}")
config = {}
if path.exists():
    config = json.loads(path.read_text())
config["googleClientId"] = "${CLIENT_ID}".strip()
config["googleClientSecret"] = "${CLIENT_SECRET}".strip()
path.write_text(json.dumps(config, indent=2) + "\n")
print(f"Wrote credentials to {path}")
PY

echo "Restart the Agentic server, then click CONNECT GOOGLE on the dashboard."
