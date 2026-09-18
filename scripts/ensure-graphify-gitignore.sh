#!/bin/sh
set -e
PROJECT_PATH="$1"
if [ -z "$PROJECT_PATH" ]; then
  exit 0
fi
AGENTIC_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$AGENTIC_ROOT/packages/server/dist/scripts/ensure-gitignore.js"
if [ -f "$SCRIPT" ]; then
  node "$SCRIPT" "$PROJECT_PATH" 2>/dev/null || true
fi
exit 0
