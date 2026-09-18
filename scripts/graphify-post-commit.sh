#!/bin/sh
set -e
ALIAS="$1"
PROJECT_PATH="$2"
export PATH="$HOME/.local/bin:$PATH"
GRAPH_JSON="$PROJECT_PATH/graphify-out/graph.json"
if [ -f "$GRAPH_JSON" ]; then
  (cd "$PROJECT_PATH" && graphify update .) 2>/dev/null || true
fi
AGENTIC_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec sh "$AGENTIC_ROOT/scripts/graphify-sync-global.sh" "$ALIAS" "$PROJECT_PATH"
