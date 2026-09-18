#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_PATH="${REPO_ROOT}/store/.dashboard-token"
PORT="${AGENTIC_PORT:-3847}"

if [[ ! -f "${TOKEN_PATH}" ]]; then
  echo "Missing ${TOKEN_PATH}"
  exit 1
fi

TOKEN="$(tr -d '[:space:]' < "${TOKEN_PATH}")"

echo "==> Google reconnect for Gmail organize"
echo "    Server: http://127.0.0.1:${PORT}"
echo

if ! curl -sf -o /dev/null "http://127.0.0.1:${PORT}/api/briefing/status" -H "Authorization: Bearer ${TOKEN}"; then
  echo "Agentic server is not reachable. Start it first:"
  echo "  cd ${REPO_ROOT} && bun run dev:server"
  exit 1
fi

RESPONSE="$(curl -sf "http://127.0.0.1:${PORT}/api/briefing/connect" -H "Authorization: Bearer ${TOKEN}")"
AUTH_URL="$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.connect?.authUrl ?? j.authUrl)" "${RESPONSE}")"

if [[ -z "${AUTH_URL}" ]]; then
  echo "Failed to get OAuth URL from server."
  echo "${RESPONSE}"
  exit 1
fi

echo "Add these scopes in Google Cloud Console > Data Access if not done yet:"
echo "  - https://www.googleapis.com/auth/gmail.modify"
echo "  - https://www.googleapis.com/auth/gmail.settings.basic"
echo
echo "Opening browser for re-consent..."
echo "${AUTH_URL}"
echo

if command -v open >/dev/null 2>&1; then
  open "${AUTH_URL}"
fi

echo "After approving in the browser, run:"
echo "  node scripts/organize-gmail.mjs all --apply"
