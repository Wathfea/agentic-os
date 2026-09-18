#!/bin/sh
set -e

AGENTIC_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="$AGENTIC_ROOT/store/agentic.db"
BRAIN_DIR="${AGENTIC_BRAIN_DIR:-$HOME/SecondBrain/Second Brain}"
TEMPLATE_DIR="$AGENTIC_ROOT/templates/project-wiki"
TODAY=$(date +%Y-%m-%d)
GOTCHAS_SENTINEL="_No gotchas filed yet"

safe_name() {
  printf '%s' "$1" | tr '/' '-'
}

apply_template() {
  FILE="$1"
  NAME="$2"
  PROJECT_PATH="$3"
  SLUG="$(safe_name "$NAME")"
  sed \
    -e "s|{{NAME}}|$NAME|g" \
    -e "s|{{SLUG}}|$SLUG|g" \
    -e "s|{{PATH}}|$PROJECT_PATH|g" \
    -e "s|{{DATE}}|$TODAY|g" \
    "$TEMPLATE_DIR/$FILE"
}

scaffold_one() {
  NAME="$1"
  PROJECT_PATH="$2"
  SLUG="$(safe_name "$NAME")"
  DEST="$BRAIN_DIR/wiki/projects/$SLUG"
  mkdir -p "$DEST"

  CREATED=0
  for FILE in README.md overview.md gotchas.md subsystems.md ticket-checklist.md; do
    if [ ! -f "$DEST/$FILE" ]; then
      apply_template "$FILE" "$NAME" "$PROJECT_PATH" > "$DEST/$FILE"
      CREATED=1
    fi
  done

  INDEX="$BRAIN_DIR/index.md"
  LINK="- [[${SLUG}/overview]] - $NAME"
  if [ -f "$INDEX" ] && ! grep -qF "[[${SLUG}/" "$INDEX" 2>/dev/null; then
    if grep -q '## Projects (dev wiki' "$INDEX" 2>/dev/null; then
      awk -v link="$LINK" '
        /## Projects \(dev wiki/ { print; getline; print link; next }
        { print }
      ' "$INDEX" > "$INDEX.tmp" && mv "$INDEX.tmp" "$INDEX"
    else
      printf '\n## Projects (dev wiki — hand-edited)\n\n%s\n' "$LINK" >> "$INDEX"
    fi
  fi

  if [ "$CREATED" -eq 1 ]; then
    echo "scaffolded: $NAME -> $DEST"
  else
    echo "skip: $NAME (all pages exist)"
  fi
}

if [ -n "$1" ] && [ -n "$2" ]; then
  scaffold_one "$1" "$2"
  exit 0
fi

if [ ! -f "$DB" ]; then
  echo "no project db at $DB"
  exit 0
fi

sqlite3 "$DB" "SELECT name || '|' || path FROM projects;" 2>/dev/null | while IFS='|' read -r NAME PROJECT_PATH; do
  [ -n "$NAME" ] || continue
  scaffold_one "$NAME" "$PROJECT_PATH"
done

echo "brain scaffold complete -> $BRAIN_DIR/wiki/projects/"
