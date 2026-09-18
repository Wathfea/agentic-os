#!/bin/sh
set -e
ALIAS="$1"
PROJECT_PATH="$2"
export PATH="$HOME/.local/bin:$PATH"
GRAPH_JSON="$PROJECT_PATH/graphify-out/graph.json"
if [ ! -f "$GRAPH_JSON" ]; then
  exit 0
fi
graphify global add "$GRAPH_JSON" "$ALIAS" 2>/dev/null || true
AGENTIC_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="$AGENTIC_ROOT/store/.dashboard-token"
if [ -f "$TOKEN_FILE" ]; then
  TOKEN=$(cat "$TOKEN_FILE")
  PROJECT_ID=$(
    AGENTIC_ROOT="$AGENTIC_ROOT" ALIAS="$ALIAS" node -e '
      const { createRequire } = require("module");
      const path = require("path");
      const root = process.env.AGENTIC_ROOT;
      try {
        const req = createRequire(path.join(root, "packages/server/package.json"));
        const Database = req("better-sqlite3");
        const db = new Database(path.join(root, "store/agentic.db"), { readonly: true });
        const row = db.prepare("SELECT id FROM projects WHERE alias = ? LIMIT 1").get(process.env.ALIAS);
        if (row) process.stdout.write(String(row.id));
      } catch {}
    ' 2>/dev/null || true
  )
  if [ -n "$PROJECT_ID" ]; then
    curl -s -X POST "http://127.0.0.1:3847/api/projects/$PROJECT_ID/graph/hook-callback" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" >/dev/null 2>&1 || true
  fi
fi
