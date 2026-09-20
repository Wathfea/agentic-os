#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

PATH_MARKER="# agentic-os-path"
GRAPHIFY_ONLY=false
PRINT_PROJECTS_GUESS=false
PREPARE_VAULT=""
take_prepare=false

for arg in "$@"; do
  if [ "$take_prepare" = true ]; then
    PREPARE_VAULT="$arg"
    take_prepare=false
    continue
  fi
  case "$arg" in
    --graphify-only) GRAPHIFY_ONLY=true ;;
    --print-projects-guess) PRINT_PROJECTS_GUESS=true ;;
    --prepare-vault) take_prepare=true ;;
  esac
done

if [ "$PRINT_PROJECTS_GUESS" = false ] && [ -z "$PREPARE_VAULT" ]; then
  clear 2>/dev/null || true
  cat "$SCRIPT_DIR/install-banner.txt"
fi

log() { printf '  %s\n' "$*"; }
warn() { printf '  [!] %s\n' "$*" >&2; }
die() { warn "$*"; exit 1; }

ensure_path_now() {
  export PATH="${HOME}/.local/bin:${HOME}/.bun/bin:${PATH:-}"
}

ensure_path_now

detect_os() {
  case "$(uname -s)" in
    Darwin) OS="darwin" ;;
    Linux) OS="linux" ;;
    MINGW*|MSYS*|CYGWIN*) OS="msys" ;;
    *) OS="unknown" ;;
  esac
}

shell_profile() {
  local shell_name
  shell_name="$(basename "${SHELL:-bash}")"
  case "$shell_name" in
    zsh) echo "${HOME}/.zshrc" ;;
    bash)
      if [ "$OS" = "darwin" ]; then
        echo "${HOME}/.bash_profile"
      elif [ -f "${HOME}/.bashrc" ] || [ ! -f "${HOME}/.bash_profile" ]; then
        echo "${HOME}/.bashrc"
      else
        echo "${HOME}/.bash_profile"
      fi
      ;;
    fish) echo "${HOME}/.config/fish/config.fish" ;;
    *) echo "${HOME}/.profile" ;;
  esac
}

extra_shell_profiles() {
  local shell_name primary
  shell_name="$(basename "${SHELL:-}")"
  primary="$(shell_profile)"
  case "$shell_name" in
    zsh)
      if [ "$primary" != "${HOME}/.zprofile" ] && [ -f "${HOME}/.zprofile" ]; then
        echo "${HOME}/.zprofile"
      fi
      ;;
  esac
}

ensure_profile_file() {
  local profile="$1"
  local dir
  dir="$(dirname "$profile")"
  mkdir -p "$dir"
  if [ -f "$profile" ]; then
    return
  fi
  {
    echo "# Shell profile — created by Agentic OS installer"
    echo "# Adds ~/.local/bin and ~/.bun/bin to PATH for graphify and bun"
  } > "$profile"
  log "Created $profile (did not exist)"
}

append_path_to_profile() {
  local profile="$1"
  ensure_profile_file "$profile"
  if grep -qF "$PATH_MARKER" "$profile" 2>/dev/null; then
    return 1
  fi
  {
    echo ""
    echo "$PATH_MARKER"
    case "$profile" in
      *.fish)
        echo 'fish_add_path "$HOME/.local/bin" "$HOME/.bun/bin"'
        ;;
      *)
        echo 'export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"'
        ;;
    esac
  } >> "$profile"
  return 0
}

version_ge() {
  local current="$1" required="$2"
  [ "$(printf '%s\n%s\n' "$required" "$current" | sort -V | head -n1)" = "$required" ]
}

check_toolchain() {
  if command -v cc >/dev/null 2>&1 || command -v cl >/dev/null 2>&1; then
    log "C toolchain found"
    return
  fi
  case "$OS" in
    darwin)
      warn "No C compiler — better-sqlite3 needs Xcode Command Line Tools"
      xcode-select --install 2>/dev/null || true
      log "Finish the Command Line Tools popup if it appears, then re-run install if bun install fails"
      ;;
    linux)
      die "A C toolchain is required. Install: sudo apt install build-essential python3"
      ;;
    *)
      warn "A C toolchain is required for better-sqlite3 (Visual Studio Build Tools on Windows)"
      ;;
  esac
}

install_node() {
  case "$OS" in
    darwin|linux)
      if command -v brew >/dev/null 2>&1 && brew install node; then
        return 0
      fi
      ;;
    msys)
      if command -v winget >/dev/null 2>&1 && winget install --exact --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements; then
        return 0
      fi
      ;;
  esac
  return 1
}

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    log "Node.js 20+ is required. Installing..."
    if ! install_node || ! command -v node >/dev/null 2>&1; then
      die "Node.js 20+ is required. Install: https://nodejs.org/ or brew install node"
    fi
  fi
  local ver
  ver="$(node -p "process.versions.node")"
  if ! version_ge "$ver" "20.0.0"; then
    die "Node.js 20+ required (found $ver)"
  fi
  log "Node.js $ver"
}

install_bun() {
  if command -v bun >/dev/null 2>&1; then
    log "Bun $(bun --version)"
    return
  fi
  log "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  ensure_path_now
  command -v bun >/dev/null 2>&1 || die "Bun install failed"
  log "Bun $(bun --version)"
}

install_uv() {
  if command -v uv >/dev/null 2>&1; then
    log "uv $(uv --version 2>/dev/null | head -1)"
    return
  fi
  log "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ensure_path_now
  command -v uv >/dev/null 2>&1 || die "uv install failed"
  log "uv installed"
}

check_git() {
  if command -v git >/dev/null 2>&1; then
    log "Git $(git --version)"
    return
  fi
  log "Installing Git..."
  case "$OS" in
    darwin|linux)
      if command -v brew >/dev/null 2>&1 && brew install git; then
        log "Git $(git --version)"
        return
      fi
      ;;
    msys)
      if command -v winget >/dev/null 2>&1 && winget install --exact --id Git.Git --accept-package-agreements --accept-source-agreements; then
        log "Git installed"
        return
      fi
      ;;
  esac
  warn "Git not found — git hooks will be skipped"
}

cursor_present() {
  if command -v cursor >/dev/null 2>&1; then
    return 0
  fi
  if [ -d "/Applications/Cursor.app" ] || [ -d "${HOME}/Applications/Cursor.app" ]; then
    return 0
  fi
  if [ -x "${HOME}/Applications/Cursor.AppImage" ]; then
    return 0
  fi
  return 1
}

claude_present() {
  if command -v claude >/dev/null 2>&1; then
    return 0
  fi
  if [ -x "${HOME}/.local/bin/claude" ]; then
    return 0
  fi
  if [ -x "${HOME}/.claude/local/claude" ]; then
    return 0
  fi
  return 1
}

install_cursor() {
  case "$OS" in
    darwin|linux)
      if command -v brew >/dev/null 2>&1 && brew install --cask cursor; then
        return 0
      fi
      ;;
    msys)
      if command -v winget >/dev/null 2>&1 && winget install --exact --id Anysphere.Cursor --accept-package-agreements --accept-source-agreements; then
        return 0
      fi
      ;;
  esac
  return 1
}

install_claude() {
  case "$OS" in
    darwin)
      if command -v brew >/dev/null 2>&1 && brew install --cask claude-code; then
        ensure_path_now
        return 0
      fi
      if command -v curl >/dev/null 2>&1 && curl -fsSL https://claude.ai/install.sh | bash; then
        ensure_path_now
        return 0
      fi
      ;;
    linux)
      if command -v curl >/dev/null 2>&1 && curl -fsSL https://claude.ai/install.sh | bash; then
        ensure_path_now
        return 0
      fi
      ;;
    msys)
      if command -v winget >/dev/null 2>&1 && winget install --exact --id Anthropic.ClaudeCode --accept-package-agreements --accept-source-agreements; then
        ensure_path_now
        return 0
      fi
      ;;
  esac
  return 1
}

open_url() {
  case "$OS" in
    darwin) open "$1" >/dev/null 2>&1 || true ;;
    linux) xdg-open "$1" >/dev/null 2>&1 || true ;;
    msys) cmd.exe /c start "" "$1" >/dev/null 2>&1 || true ;;
  esac
}

ensure_agents() {
  echo ""
  log "Preparing Cursor and Claude Code. Skills are copied for both."
  local have_cursor=0
  local have_claude=0
  if cursor_present; then
    have_cursor=1
    log "Cursor is already installed"
  fi
  if claude_present; then
    have_claude=1
    log "Claude Code is already installed"
  fi
  if [ "$have_cursor" -eq 1 ] || [ "$have_claude" -eq 1 ]; then
    return
  fi
  if [ ! -t 0 ]; then
    warn "No coding agent found (non-interactive). Install Cursor (https://cursor.com/download) or Claude Code (https://code.claude.com/docs/en/overview)"
    return
  fi
  log "Installing Cursor..."
  if install_cursor && cursor_present; then
    have_cursor=1
    log "Cursor installed"
  fi
  log "Installing Claude Code..."
  if install_claude && claude_present; then
    have_claude=1
    log "Claude Code installed"
  fi
  if [ "$have_cursor" -eq 1 ] || [ "$have_claude" -eq 1 ]; then
    return
  fi
  log "Install Cursor from https://cursor.com/download or Claude Code from https://code.claude.com/docs/en/overview"
  open_url "https://cursor.com/download"
  open_url "https://code.claude.com/docs/en/overview"
  read -r -p "  Press Enter when Cursor or Claude Code is installed (or continue without them) "
  if cursor_present; then
    log "Cursor is installed"
  elif claude_present; then
    log "Claude Code is installed"
  else
    warn "No coding agent detected — skills will still be copied to ~/.cursor/skills and ~/.claude/skills"
  fi
}

expand_user_path() {
  local input="$1"
  case "$input" in
    "~") printf '%s' "${HOME}" ;;
    ~/*) printf '%s' "${HOME}/${input#~/}" ;;
    *) printf '%s' "$input" ;;
  esac
}

ensure_dir() {
  local input="$1"
  local label="$2"
  if [ ! -d "$input" ]; then
    read -r -p "  Directory does not exist. Create it? [Y/n] " create_reply
    create_reply="${create_reply:-Y}"
    if [[ "$create_reply" =~ ^[Yy]$ ]]; then
      mkdir -p "$input"
    else
      die "$label must exist: $input"
    fi
  fi
}

guess_projects_root() {
  if [ -n "${AGENTIC_CODE_ROOT:-}" ]; then
    expand_user_path "$AGENTIC_CODE_ROOT"
    return
  fi
  local d
  for d in "${HOME}/Projects" "${HOME}/Developer" "${HOME}/dev" "${HOME}/src" "${HOME}/code"; do
    if [ -d "$d" ]; then
      printf '%s' "$d"
      return
    fi
  done
}

prompt_code_root() {
  local guessed input
  echo ""
  log "Projects root is the folder that contains your git repos — not this Agentic OS clone."
  if [ -n "${AGENTIC_CODE_ROOT:-}" ]; then
    input="$(expand_user_path "$AGENTIC_CODE_ROOT")"
    ensure_dir "$input" "Projects directory"
    CODE_ROOT="$(cd "$input" && pwd)"
    log "Projects root: $CODE_ROOT (AGENTIC_CODE_ROOT)"
    return
  fi
  guessed="$(guess_projects_root)"
  if [ -n "$guessed" ]; then
    read -r -p "  Where are your local projects? [${guessed}] " input
    input="$(expand_user_path "${input:-$guessed}")"
  else
    if [ ! -t 0 ]; then
      die "Set AGENTIC_CODE_ROOT to the folder that contains your git repos."
    fi
    read -r -p "  Where are your local projects? " input
    input="$(expand_user_path "$input")"
    if [ -z "$input" ]; then
      die "Projects directory is required"
    fi
  fi
  ensure_dir "$input" "Projects directory"
  CODE_ROOT="$(cd "$input" && pwd)"
  log "Projects root: $CODE_ROOT"
}

default_brain_root() {
  if [ -n "${AGENTIC_BRAIN_DIR:-}" ]; then
    expand_user_path "$AGENTIC_BRAIN_DIR"
  else
    printf '%s' "${HOME}/SecondBrain/Second Brain"
  fi
}

create_obsidian_vault() {
  local vault="$1"
  if [ -z "$vault" ]; then
    die "Vault path is required"
  fi
  mkdir -p "${vault}/.obsidian"
}

obsidian_present() {
  if command -v obsidian >/dev/null 2>&1; then
    return 0
  fi
  if [ -d "/Applications/Obsidian.app" ] || [ -d "${HOME}/Applications/Obsidian.app" ]; then
    return 0
  fi
  if [ -x "${HOME}/Applications/Obsidian.AppImage" ]; then
    return 0
  fi
  if command -v flatpak >/dev/null 2>&1; then
    if flatpak info md.obsidian.Obsidian >/dev/null 2>&1; then
      return 0
    fi
    if flatpak info --user md.obsidian.Obsidian >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

obsidian_install_available() {
  case "$OS" in
    darwin)
      command -v brew >/dev/null 2>&1
      ;;
    linux)
      command -v brew >/dev/null 2>&1 || command -v flatpak >/dev/null 2>&1
      ;;
    msys)
      command -v winget >/dev/null 2>&1
      ;;
    *)
      return 1
      ;;
  esac
}

install_obsidian() {
  case "$OS" in
    darwin)
      if command -v brew >/dev/null 2>&1 && brew install --cask obsidian; then
        return 0
      fi
      ;;
    linux)
      if command -v brew >/dev/null 2>&1 && brew install --cask obsidian; then
        return 0
      fi
      if command -v flatpak >/dev/null 2>&1; then
        flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo >/dev/null 2>&1 || true
        if flatpak install --user -y flathub md.obsidian.Obsidian; then
          return 0
        fi
      fi
      ;;
    msys)
      if command -v winget >/dev/null 2>&1 && winget install --exact --id Obsidian.Obsidian --accept-package-agreements --accept-source-agreements; then
        return 0
      fi
      ;;
  esac
  return 1
}

print_obsidian_howto() {
  local location="${HOME}/SecondBrain"
  echo ""
  log "Install Obsidian from https://obsidian.md/download"
  log "Create a vault (a folder of markdown files):"
  log "  1. Open Obsidian"
  log "  2. Create new vault"
  log "     Name: Second Brain"
  log "     Location: ${location}"
  log "  Or: vault icon -> Manage vaults... -> Open folder as vault"
  log "     and pick the folder this installer creates."
}

open_obsidian_download() {
  case "$OS" in
    darwin) open "https://obsidian.md/download" >/dev/null 2>&1 || true ;;
    linux) xdg-open "https://obsidian.md/download" >/dev/null 2>&1 || true ;;
    msys) cmd.exe /c start "" "https://obsidian.md/download" >/dev/null 2>&1 || true ;;
  esac
}

ensure_obsidian() {
  echo ""
  log "Obsidian is the app that opens your Second Brain vault."
  if obsidian_present; then
    log "Obsidian is already installed"
    return
  fi
  if [ ! -t 0 ]; then
    if obsidian_install_available && install_obsidian && obsidian_present; then
      log "Obsidian installed"
      return
    fi
    warn "Obsidian not found (non-interactive). Install from https://obsidian.md/download"
    return
  fi
  if obsidian_install_available; then
    log "Installing Obsidian..."
    if install_obsidian && obsidian_present; then
      log "Obsidian installed"
      return
    fi
    warn "Obsidian install did not finish — follow the steps below"
  fi
  print_obsidian_howto
  open_obsidian_download
  read -r -p "  Press Enter when Obsidian is installed (or continue without it) "
  if obsidian_present; then
    log "Obsidian is installed"
  else
    warn "Obsidian not detected — the vault folder will still work as markdown"
  fi
}

prepare_brain_vault() {
  local vault
  vault="$(default_brain_root)"
  echo ""
  log "A vault is a folder Obsidian opens. Preparing:"
  log "  $vault"
  create_obsidian_vault "$vault"
  log "Vault folder ready."
  log "In Obsidian: vault icon -> Manage vaults... -> Open folder as vault"
  log "  and choose that folder if it is not already listed."
}

prompt_brain_root() {
  local default input
  default="$(default_brain_root)"
  echo ""
  if [ -n "${AGENTIC_BRAIN_DIR:-}" ]; then
    input="$(expand_user_path "$AGENTIC_BRAIN_DIR")"
    ensure_dir "$input" "Vault directory"
    create_obsidian_vault "$input"
    BRAIN_ROOT="$(cd "$input" && pwd)"
    log "Vault: $BRAIN_ROOT (AGENTIC_BRAIN_DIR)"
    return
  fi
  read -r -p "  Where is your Second Brain vault? [${default}] " input
  input="$(expand_user_path "${input:-$default}")"
  ensure_dir "$input" "Vault directory"
  create_obsidian_vault "$input"
  BRAIN_ROOT="$(cd "$input" && pwd)"
  log "Vault: $BRAIN_ROOT"
}

seed_brain_and_skills() {
  log "Seeding Second Brain vault and syncing Cursor and Claude Code skills..."
  node "$ROOT/scripts/install-bootstrap.mjs" --vault "$BRAIN_ROOT"
}

open_obsidian_vault() {
  if ! obsidian_present; then
    return
  fi
  local encoded
  encoded="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$BRAIN_ROOT")"
  local uri="obsidian://open?path=${encoded}"
  case "$OS" in
    darwin) open "$uri" >/dev/null 2>&1 || open -a Obsidian "$BRAIN_ROOT" >/dev/null 2>&1 || true ;;
    linux)
      if command -v flatpak >/dev/null 2>&1 && flatpak info --user md.obsidian.Obsidian >/dev/null 2>&1; then
        flatpak run md.obsidian.Obsidian "$uri" >/dev/null 2>&1 || true
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$uri" >/dev/null 2>&1 || true
      elif command -v obsidian >/dev/null 2>&1; then
        obsidian "$uri" >/dev/null 2>&1 || true
      fi
      ;;
    msys) cmd.exe /c start "" "$uri" >/dev/null 2>&1 || true ;;
  esac
  log "Opened vault in Obsidian (Manage vaults -> Open folder as vault if it did not appear)"
}

update_graphify_repo() {
  echo ""
  log "Building the Graphify graph for this Agentic OS clone..."
  if graphify update .; then
    log "Graphify graph ready"
  else
    warn "graphify update failed — run it later from this repo"
  fi
}

write_agentic_config() {
  mkdir -p "$ROOT/store"
  local graphify_ver=""
  if command -v graphify >/dev/null 2>&1; then
    graphify_ver="$(graphify --version 2>/dev/null || true)"
  fi
  AGENTIC_CONFIG_ROOT="$ROOT" AGENTIC_CODE_ROOT_VALUE="$CODE_ROOT" AGENTIC_BRAIN_ROOT_VALUE="$BRAIN_ROOT" AGENTIC_GRAPHIFY_VERSION="$graphify_ver" node -e "
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.env.AGENTIC_CONFIG_ROOT, 'store', 'agentic.config.json');
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
    const next = {
      ...existing,
      codeRoot: process.env.AGENTIC_CODE_ROOT_VALUE,
      brainRoot: process.env.AGENTIC_BRAIN_ROOT_VALUE,
      installedAt: new Date().toISOString(),
      graphifyVersion: process.env.AGENTIC_GRAPHIFY_VERSION || existing.graphifyVersion || null,
    };
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n');
  "
}

persist_path() {
  local profile extra
  profile="$(shell_profile)"
  if append_path_to_profile "$profile"; then
    log "Added tool paths to $profile"
  else
    log "PATH already configured in $profile"
  fi
  extra="$(extra_shell_profiles)"
  if [ -n "$extra" ]; then
    if append_path_to_profile "$extra"; then
      log "Added tool paths to $extra"
    fi
  fi
}

install_js_deps() {
  log "Installing JavaScript dependencies..."
  if command -v bun >/dev/null 2>&1; then
    bun install
  else
    npm install
  fi
}

install_graphify() {
  log "Installing Graphify..."
  uv tool install --upgrade graphifyy
  ensure_path_now
  command -v graphify >/dev/null 2>&1 || die "graphify not found after uv tool install"
  graphify install --platform cursor || true
  graphify install --platform claude || true
  graphify install --project --platform cursor || true
  graphify install --project --platform claude || true
  log "Graphify $(graphify --version)"
}

bootstrap_store() {
  mkdir -p "$ROOT/store/projects"
  if [ ! -f "$ROOT/store/.dashboard-token" ]; then
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -hex 32 > "$ROOT/store/.dashboard-token"
    else
      node -e "require('crypto').randomBytes(32).toString('hex')" > "$ROOT/store/.dashboard-token"
    fi
  fi
}

telegram_cli() {
  local tsx_bin="$ROOT/node_modules/.bin/tsx"
  if [ ! -x "$tsx_bin" ]; then
    tsx_bin="$ROOT/packages/server/node_modules/.bin/tsx"
  fi
  if [ ! -x "$tsx_bin" ]; then
    die "tsx not found — JavaScript dependencies must be installed first"
  fi
  "$tsx_bin" "$ROOT/packages/server/src/cli/telegram-setup.ts" "$@"
}

save_telegram() {
  local token="$1" chat_id="$2"
  AGENTIC_TELEGRAM_BOT_TOKEN="$token" AGENTIC_TELEGRAM_CHAT_ID="$chat_id" telegram_cli save
}

prompt_telegram() {
  local status reply token chat_id replace_reply
  echo ""
  log "Telegram delivery"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    save_telegram "$TELEGRAM_BOT_TOKEN" "$TELEGRAM_CHAT_ID"
    log "Telegram connection saved from environment"
    return
  fi
  if [ ! -t 0 ]; then
    log "Telegram skipped (non-interactive). Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, or use the dashboard Routines panel."
    return
  fi
  telegram_cli howto
  echo ""
  status="$(telegram_cli status)"
  if [[ "$status" == connected* ]]; then
    log "Already ${status}"
    read -r -p "  Replace Telegram connection? [y/N] " replace_reply
    replace_reply="${replace_reply:-N}"
    if [[ ! "$replace_reply" =~ ^[Yy]$ ]]; then
      log "Keeping existing Telegram connection"
      return
    fi
  else
    read -r -p "  Set up Telegram now? [y/N] " reply
    reply="${reply:-N}"
    if [[ ! "$reply" =~ ^[Yy]$ ]]; then
      log "Telegram skipped — set it up later in the dashboard Routines panel"
      return
    fi
  fi
  read -r -s -p "  Bot token: " token
  echo ""
  read -r -p "  Chat id: " chat_id
  token="${token#"${token%%[![:space:]]*}"}"
  token="${token%"${token##*[![:space:]]}"}"
  chat_id="${chat_id#"${chat_id%%[![:space:]]*}"}"
  chat_id="${chat_id%"${chat_id##*[![:space:]]}"}"
  if [ -z "$token" ] || [ -z "$chat_id" ]; then
    warn "Bot token and chat id are required — skipping Telegram. Use the dashboard Routines panel later."
    return
  fi
  save_telegram "$token" "$chat_id"
  log "Telegram connection saved ($(telegram_cli status))"
}

write_graphify_python() {
  local graphify_out="$ROOT/graphify-out"
  mkdir -p "$graphify_out"
  local python=""
  local graphify_bin
  graphify_bin="$(command -v graphify 2>/dev/null || true)"
  if [ -n "$graphify_bin" ]; then
    local shebang
    shebang="$(head -1 "$graphify_bin" | tr -d '#!')"
    case "$shebang" in
      *[!a-zA-Z0-9/_.-]*) ;;
      *)
        if "$shebang" -c "import graphify" 2>/dev/null; then
          python="$shebang"
        fi
        ;;
    esac
  fi
  if [ -z "$python" ] && command -v uv >/dev/null 2>&1; then
    local uv_py
    uv_py="$(uv tool run graphifyy python -c "import sys; print(sys.executable)" 2>/dev/null || true)"
    if [ -n "$uv_py" ]; then
      python="$uv_py"
    fi
  fi
  if [ -z "$python" ]; then
    python="python3"
  fi
  "$python" -c "import sys; open('${graphify_out}/.graphify_python', 'w', encoding='utf-8').write(sys.executable)" 2>/dev/null || true
}

augment_cursor_rule() {
  local rule="$ROOT/.cursor/rules/graphify.mdc"
  local hint_marker="agentic-os-graphify-path"
  if [ ! -f "$rule" ]; then
    return
  fi
  if grep -qF "$hint_marker" "$rule" 2>/dev/null; then
    return
  fi
  {
    echo ""
    echo "<!-- $hint_marker -->"
    echo 'Before any graphify command, ensure PATH includes ~/.local/bin:'
    echo 'export PATH="$HOME/.local/bin:$PATH"'
  } >> "$rule"
}

print_success() {
  local telegram_status="skipped"
  if telegram_status="$(telegram_cli status 2>/dev/null)"; then
    :
  else
    telegram_status="skipped"
  fi
  echo ""
  echo "─────────────────────────────────────────────────────────"
  echo "  Agentic OS is ready."
  echo " ─────────────────────────────────────────────────────────"
  echo ""
  echo "  Dashboard:  http://localhost:5173"
  echo "  API:        http://127.0.0.1:3847"
  echo "  Token:      store/.dashboard-token"
  echo "  Telegram:   ${telegram_status}"
  echo "  Projects:   ${CODE_ROOT:-$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('store/agentic.config.json','utf8')).codeRoot)}catch{}")}"
  echo "  Vault:      ${BRAIN_ROOT:-$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('store/agentic.config.json','utf8')).brainRoot)}catch{}")}"
  echo "  Skills:     ${HOME}/.cursor/skills"
  echo "              ${HOME}/.claude/skills"
  echo ""
  echo "  1. bun run dev"
  echo "  2. Open this repo in Cursor (fully restart) or run: claude"
  echo "  3. Paste the dashboard token when the UI asks."
  echo "  4. Add git repos under Projects in the dashboard."
  echo ""
}

health_check() {
  ensure_path_now
  if command -v graphify >/dev/null 2>&1; then
    log "graphify: $(graphify --version 2>/dev/null || echo ok)"
  else
    warn "graphify not on PATH — open a new terminal or restart Cursor / Claude Code"
  fi
}

detect_os

if [ -n "$PREPARE_VAULT" ]; then
  vault="$(expand_user_path "$PREPARE_VAULT")"
  create_obsidian_vault "$vault"
  vault="$(cd "$vault" && pwd)"
  log "VAULT_READY $vault"
  exit 0
fi

if [ "$PRINT_PROJECTS_GUESS" = true ]; then
  guess_projects_root
  printf '\n'
  exit 0
fi

if [ "$GRAPHIFY_ONLY" = true ]; then
  install_uv
  install_graphify
  write_graphify_python
  augment_cursor_rule
  health_check
  exit 0
fi

log "Detecting environment ($OS)..."
check_toolchain
check_git
check_node
install_bun
install_uv
ensure_agents
prompt_code_root
ensure_obsidian
prepare_brain_vault
prompt_brain_root
seed_brain_and_skills
install_js_deps
install_graphify
persist_path
write_agentic_config
bootstrap_store
update_graphify_repo
prompt_telegram
write_graphify_python
augment_cursor_rule
open_obsidian_vault
health_check
print_success
