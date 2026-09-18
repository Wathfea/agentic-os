#!/bin/bash
INSTALL_ENV_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.local/bin:${HOME}/.bun/bin:${PATH:-}"

CONFIG_FILE="${INSTALL_ENV_ROOT}/store/agentic.config.json"
if [ -f "$CONFIG_FILE" ]; then
  _code_root="$(CONFIG_FILE="$CONFIG_FILE" node -e "
    const fs = require('fs');
    try {
      const c = JSON.parse(fs.readFileSync(process.env.CONFIG_FILE, 'utf8'));
      if (c.codeRoot) process.stdout.write(c.codeRoot);
    } catch {}
  " 2>/dev/null || true)"
  _brain_root="$(CONFIG_FILE="$CONFIG_FILE" node -e "
    const fs = require('fs');
    try {
      const c = JSON.parse(fs.readFileSync(process.env.CONFIG_FILE, 'utf8'));
      if (c.brainRoot) process.stdout.write(c.brainRoot);
    } catch {}
  " 2>/dev/null || true)"
  if [ -n "$_code_root" ]; then
    export AGENTIC_CODE_ROOT="$_code_root"
  fi
  if [ -n "$_brain_root" ]; then
    export AGENTIC_BRAIN_DIR="$_brain_root"
  fi
fi
