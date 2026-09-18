---
name: agentic-os
description: >
  Local Agentic OS control plane: project Graphify graphs, the Second Brain wiki
  vault, and Cursor skills. Use when managing registered projects, building or
  querying graphify graphs, mirroring graphs into the brain, ingesting/querying/
  linting the second brain, or syncing seed skills from the Agentic OS dashboard.
---

# Agentic OS

Local control plane that ties together three knowledge layers:

- **Graphify graphs** - per-project code knowledge graphs (`graphify-out/` in each project).
- **Second Brain** - Karpathy LLM-wiki vault at `~/SecondBrain/Second Brain` (see the `second-brain` skill).
- **Skills** - canonical skills in `seed-skills/`, synced to `~/.cursor/skills/`.

Dashboard: `http://localhost:5173`. API: `http://127.0.0.1:3847/api` (Bearer token in `store/.dashboard-token`).

## Compression layers

These stack - use the right one:

- **graphify** compresses *orientation* - ride the graph instead of re-reading files. Code/architecture questions.
- **second brain** compresses *retrieval* - read `index.md` -> a few pages instead of re-deriving from sources. Knowledge/research/personal questions.
- **ponytail** compresses *implementation* - YAGNI ladder, shortest diff, terse chat during coding. Always-on via `.cursor/rules/ponytail.mdc` in registered repos; `ponytail-review` for diff audits. Never skip validation/security; never compress content written into the brain vault.

## Projects

Register folders under your projects root (`store/agentic.config.json` -> `codeRoot`, chosen at install) to auto-build Graphify graphs. Triage: literals in stack trace or config → grep first; cross-service or structural questions → `graphify explain` / `path` / symbol-seeded `query`; domain rules → brain `wiki/projects/<name>/`. Full dev workflow → `task-loop` skill (`ticket-loop` is an alias).

## Second Brain

The vault holds raw sources, an LLM-maintained wiki, and mirrored project graphs under `projects/<name>/`. Operate it via the `second-brain` skill or the dashboard / `/api/brain` endpoints:

- `GET /api/brain/status` - page/source/orphan counts, last lint
- `POST /api/brain/ingest` - fetch a URL/file into `raw/` and integrate it
- `POST /api/brain/query` - ask the brain (streamed)
- `POST /api/brain/lint` - health-check the wiki
- `POST /api/brain/mirror-projects` - export every registered project's graph into `<vault>/projects/<name>/`
- `POST /api/brain/scaffold-projects` - seed `wiki/projects/<name>/` dev-wiki pages (only if missing)

## Skills

Canonical skills live in `seed-skills/`. Edit there, then sync to `~/.cursor/skills/`:

```bash
curl -s -X POST http://127.0.0.1:3847/api/skills/sync \
  -H "Authorization: Bearer $(cat store/.dashboard-token)"
```

After adding/removing skills, regenerate `~/.cursor/skills/.skill-index.md`.

## MCPs (none required)

This system ships with **zero new MCP servers**. The brain works through plain file reads/writes plus the `/api/brain` endpoints - the cheapest, most reliable path. Add an MCP only if a real bottleneck appears:

- **Full-text search** (e.g. a `qmd`/ripgrep-backed search MCP) - only if `index.md` + wikilink navigation stops scaling to hundreds of pages.
- **Obsidian MCP** - only if you want plugin-aware operations (graph view, canvas) beyond raw markdown.
- **Embeddings/semantic search MCP** - only if keyword + index lookup starts missing relevant notes.

Until then, do not add MCPs: they add latency, surface area, and token overhead for no gain.

## Dev workflow (any registered project)

Use the `task-loop` skill — Intent → Grill → Triage → Act → Verify → Review → Compound for every registered repo. A chat prompt is a task; Jira is optional. `ticket-loop` is an alias.

Per project in the brain: `wiki/projects/<name>/` (overview, glossary, gotchas, subsystems, ticket-checklist) — auto-scaffolded on registration. Glossary is created lazily on first `grill-with-docs` session. Code graph mirror: `projects/<name>/` (auto). Session handoffs: `wiki/handoffs/` via `/handoff` (`conversation-handoff` skill).

API: `POST /api/brain/scaffold-projects` — seed dev-wiki pages for all registered projects (only if missing).

## Cautions

- The vault path contains a space - always quote `"$HOME/SecondBrain/Second Brain"`.
- Shelling into the vault can be slow (Obsidian Sync) - prefer direct file reads/writes over `ls`/`find`.
