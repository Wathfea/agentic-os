# Agentic OS

Local control plane for Graphify knowledge graphs and Cursor skills.

License: MIT. Clone this repo anywhere — it does not have to live next to your other projects.

## Requirements

- Node.js 20+
- A C toolchain so `better-sqlite3` can compile:
  - macOS: `xcode-select --install`
  - Linux: `sudo apt install build-essential python3` (or the equivalent on your distro)
  - Windows: Visual Studio Build Tools with the Desktop C++ workload, plus Git for Windows (`git` and `sh` for graphify hooks)
- Cursor (for skills and graphify-in-agent)

The installer can install Bun, uv, and Graphify if they are missing.

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

The installer asks **where your git projects already live** (Documents, Developer, `~/work`, …). That folder is not this clone. If `AGENTIC_CODE_ROOT` or `AGENTIC_BRAIN_DIR` is set, those values are used and the matching prompt is skipped.

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
- **Skills** — manage `seed-skills/`, sync to `~/.cursor/skills/`

## Workflow

1. Open this repo in Cursor — `AGENTS.md` and `.cursor/rules/graphify.mdc` steer graphify-first exploration.
2. Per task: follow the `task-loop` skill (`ticket-loop` is an alias). Graphify query → fix → `graphify update .` (post-commit hook runs update + global sync).
3. Reusable insight? Say **"worth filing"** or **"compound this"** — the agent uses `compound-fix` → `wiki/projects/<name>/gotchas.md` in the vault.

Brain vault API: `GET/POST /api/brain/*` (see `seed-skills/agentic-os/SKILL.md`).

## API

- Base URL: `http://127.0.0.1:3847/api`
- Auth: `Authorization: Bearer <token>` (see `store/.dashboard-token`)

## Troubleshooting

**`command not found: graphify` in Cursor**

Graphify installs to `~/.local/bin` (or `%USERPROFILE%\.local\bin` on Windows). The installer creates your shell profile if missing and adds tool paths there. If agents still cannot find it:

1. Confirm `graphify` works in a new terminal
2. Fully restart Cursor (quit and reopen)
3. Re-run the installer to repair PATH markers

**`better-sqlite3` failed to compile**

Install the C toolchain listed under Requirements, then re-run the installer.

Override paths without re-installing:

```bash
export AGENTIC_CODE_ROOT=/path/to/your/projects
export AGENTIC_BRAIN_DIR=/path/to/your/vault
```
