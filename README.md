# Agentic OS

Local control plane for Graphify knowledge graphs and Cursor / Claude Code skills.

License: MIT. Clone this repo anywhere — it does not have to live next to your other projects.

## Requirements

- Node.js 20+
- A C toolchain so `better-sqlite3` can compile:
  - macOS: `xcode-select --install`
  - Linux: `sudo apt install build-essential python3` (or the equivalent on your distro)
  - Windows: Visual Studio Build Tools with the Desktop C++ workload, plus Git for Windows (`git` and `sh` for graphify hooks)
- Cursor or Claude Code (the installer asks which you use, then locates or installs that one)
- Obsidian (the installer can install it, or walk you through creating a vault)

The installer can install Node.js, Git, Bun, uv, Graphify, Obsidian, and the coding agent you choose (Cursor or Claude Code) when a package manager is available (Homebrew, winget, or Flatpak). It seeds an empty Second Brain vault, copies `seed-skills/` to `~/.cursor/skills` and `~/.claude/skills`, writes a Claude project overlay (`CLAUDE.md`, `.claude/rules`), and builds the Graphify graph for this clone.

A coworker should be able to clone and run the installer, then `bun run dev` plus a Cursor restart or `claude` in this folder.

## Install

macOS / Linux:

```bash
git clone https://github.com/Wathfea/agentic-os.git
cd agentic-os
bash scripts/install.sh
```

Windows (PowerShell):

```powershell
git clone https://github.com/Wathfea/agentic-os.git
cd agentic-os
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

Or from the repo folder on any OS: `bun run install:agentic`.

pd overlay (skills + current pd wiki into the Second Brain), after Agentic OS is installed:

```bash
bun run install:pd
```

The script asks where the pd repo is, whether to install for Cursor or Claude Code, and where the Second Brain vault lives. Non-interactive: `node scripts/install-pd.mjs --yes --pd /path/to/pd --brain "/path/to/Second Brain" --agent cursor`.

The installer:

1. Checks a C toolchain (Xcode CLT / build-essential / VS Build Tools) and installs missing Node.js 20+, Git, Bun, and uv
2. Asks whether you use Cursor or Claude Code, then locates that app and installs it if missing
3. Asks where your git projects live (not this clone)
4. Installs Obsidian if needed, creates a Second Brain vault (default `~/SecondBrain/Second Brain`), writes `AGENTS.md` / `index.md` / wiki folders, copies skills to `~/.cursor/skills` and `~/.claude/skills`, and writes `CLAUDE.md` plus `.claude/rules`
5. Installs JavaScript dependencies and Graphify, then runs `graphify update .` on this clone
6. Optionally opens the vault in Obsidian and asks about Telegram delivery (skippable)

If `AGENTIC_CODE_ROOT`, `AGENTIC_BRAIN_DIR`, or `AGENTIC_AGENT` (`cursor` or `claude`) is set, those values are used and the matching prompt is skipped. Same for `bash scripts/install.sh --agent claude`. Google OAuth is configured later in the dashboard. The pd overlay is a separate step (`bun run install:pd`).

It also adds tool paths to your shell profile, mints `store/.dashboard-token`, and can save a Telegram connection for Morning mix delivery.

Copy `store/agentic.config.example.json` only if you need to set paths by hand. Google OAuth client secrets belong in `store/agentic.config.json`, which is gitignored.

## Start

```bash
bun run dev
```

Works on macOS, Linux, and Windows (no Bash required). Open http://localhost:5173 — paste the dashboard token from `store/.dashboard-token` when prompted.

## Features

- **Projects** — register folders under the projects root you chose at install (`store/agentic.config.json` → `codeRoot`)
- **Graph explorer** — query project or global merged graphs
- **Second Brain** — LLM wiki vault (`brainRoot` in config, default `~/SecondBrain/Second Brain` if you accept that prompt); ingest, query, lint, mirror project graphs
- **Skills** — manage `seed-skills/`, sync to `~/.cursor/skills/` and `~/.claude/skills/`

## Workflow

1. Open this repo in Cursor (`AGENTS.md`, `.cursor/rules/graphify.mdc`) or run `claude` here (`CLAUDE.md`, `.claude/rules/graphify.md`).
2. Per task: follow the `task-loop` skill (`ticket-loop` is an alias). Graphify query → fix → `graphify update .` (post-commit hook runs update + global sync).
3. Reusable insight? Say **"worth filing"** or **"compound this"** — the agent uses `compound-fix` → `wiki/projects/<name>/gotchas.md` in the vault.

Brain vault API: `GET/POST /api/brain/*` (see `seed-skills/agentic-os/SKILL.md`).

## API

- Base URL: `http://127.0.0.1:3847/api`
- Auth: `Authorization: Bearer <token>` (see `store/.dashboard-token`)

## Troubleshooting

**`command not found: graphify` in Cursor or Claude Code**

Graphify installs to `~/.local/bin` (or `%USERPROFILE%\.local\bin` on Windows). The installer creates your shell profile if missing and adds tool paths there. If agents still cannot find it:

1. Confirm `graphify` works in a new terminal
2. Fully restart Cursor, or start a new `claude` session
3. Re-run the installer to repair PATH markers

**`better-sqlite3` failed to compile**

Install the C toolchain listed under Requirements, then re-run the installer.

Override paths without re-installing:

```bash
export AGENTIC_CODE_ROOT=/path/to/your/projects
export AGENTIC_BRAIN_DIR=/path/to/your/vault
```
