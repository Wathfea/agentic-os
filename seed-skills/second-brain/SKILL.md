---
name: second-brain
description: >
  Personal knowledge base (Karpathy LLM-wiki) living in the Obsidian vault at
  "~/SecondBrain/Second Brain". Use whenever the user wants to
  recall, save, or build up knowledge: "what do I know about X", "add this to my
  brain/second brain/vault", "remember this", "ingest this article/paper/note",
  "save this", "what have I read about", "summarize my notes on", "file this",
  "triage my inbox", or any research/personal-knowledge question that is NOT about
  a specific codebase. For code/architecture questions use graphify instead.
---

# Second Brain (LLM Wiki)

An incrementally built, interlinked markdown knowledge base. The user curates sources and asks questions; the agent does all bookkeeping (summarize, cross-reference, file, keep consistent). Obsidian is the IDE, the agent is the programmer, the wiki is the codebase.

**Vault root:** `~/SecondBrain/Second Brain` (path has a space - always quote it).

The vault's own `AGENTS.md` is the authoritative schema. Read `<vault>/AGENTS.md` before operating, then follow it. This skill is the global router + quick reference.

## When to use

- Recall: "what do I know about...", "what have I read on...", "summarize my notes on..."
- Capture: "remember this", "add to my brain", "save this", "ingest this article"
- Maintain: "triage my inbox", "lint my wiki", "is anything contradictory"
- Session handoff: "/handoff", "save context for later" -> `conversation-handoff` skill
- After pd/Jira fixes: "worth filing?", "compound this gotcha", "add to gotchas"
- Before dev work: stress-test domain language -> `grill-with-docs` skill (glossary + decisions in project wiki)
- Research/personal questions that are not about a specific codebase

## Routing

- Knowledge / research / personal -> this wiki (the vault).
- Code / architecture / "how does this repo work" -> triage first: literal in log/config -> grep; structural/cross-service -> graphify (`explain` / `path` / symbol-seeded `query` on the project graph, or read `<vault>/projects/<name>/`); domain rule -> `wiki/projects/<name>/glossary.md` + `gotchas.md` + `subsystems.md`.
- Dev work on any repo (prompt or Jira) -> `task-loop` skill (`ticket-loop` alias; grill uses `grill-with-docs`; reads `wiki/projects/<name>/` + repo `graphify-out/`).
- If unsure, check `<vault>/index.md` first - it is cheap and tells you what the brain contains.

## Three layers (see vault AGENTS.md for detail)

1. `raw/` - immutable sources (never edit). Images in `raw/assets/`.
2. `wiki/` - agent-owned pages: `sources/`, `entities/`, `concepts/`, `overview.md`.
3. `index.md` (catalog, read first) + `log.md` (append-only, `## [YYYY-MM-DD] type | Title`).

## Operations (quick reference)

- **Ingest** a source -> `references/ingest.md`
- **Query** the wiki -> `references/query.md`
- **Compound** a dev fix -> `references/compound.md` (or `compound-fix` skill)
- **Grill** domain language before coding -> `grill-with-docs` skill (`wiki/projects/<name>/glossary.md`, `decisions/`)
- **Handoff** a Cursor session -> `references/handoff.md` (or `conversation-handoff` skill)
- **Lint** the wiki -> `references/lint.md`

Always read `index.md` first on a query. Always update `index.md` + append `log.md` on an ingest. File good query answers back as new pages so explorations compound.

## Hard rules

- NEVER fabricate. Missing fact -> say so or leave a `_` placeholder.
- NEVER edit `raw/` or hand-edit `projects/`.
- Cite the source (path under `raw/` or URL) for every non-obvious claim.
- Use `[[wikilinks]]` and YAML frontmatter on every wiki page.
- **Ponytail terse chat is for answers only.** Everything written INTO the vault (wiki pages, `index.md`, `log.md`) must be full, human-readable prose. Never write compressed text into the vault.

## Scale note

Pure-context (read index.md -> pages) is correct and reliable below ~100k tokens / a few hundred pages. Do not add RAG/vector search before then. If the brain outgrows index-first browsing, add a markdown search tool (e.g. qmd) - not a vector DB.
