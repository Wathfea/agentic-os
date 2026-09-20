# Second Brain - Wiki Librarian Schema

This vault is a Karpathy-style LLM wiki: an incrementally built, interlinked markdown knowledge base that sits between you (the human) and your raw sources. You curate sources and ask questions. The agent does all the bookkeeping: summarizing, cross-referencing, filing, and keeping the wiki consistent.

Obsidian is the IDE. The agent is the programmer. The wiki is the codebase.

## Layers

1. **`raw/`** - immutable source documents (articles, papers, transcripts, notes). The agent reads from here but NEVER edits these files. Source of truth. Images live in `raw/assets/`.
2. **`wiki/`** - agent-owned markdown. Summaries, entity pages, concept pages, an overview, syntheses. The agent creates and maintains everything here.
3. **Schema** - this file. Conventions + workflows. Co-evolves over time.

## Directory layout

- `raw/` - immutable sources (`raw/assets/` for images)
- `wiki/sources/` - one summary page per ingested source
- `wiki/entities/` - people, orgs, tools, products
- `wiki/concepts/` - ideas, methods, topics
- `wiki/projects/<name>/` - hand-edited per-repo dev knowledge (glossary, gotchas, workflows, decisions); distinct from Graphify mirrors
- `wiki/handoffs/` - Cursor session handoff documents (`conversation-handoff` skill)
- `wiki/overview.md` - the evolving top-level synthesis
- `projects/<name>/` - mirrored Graphify code-graph wikis (managed by Agentic OS, not hand-edited)
- `inbox/` - quick capture, triaged later
- `index.md` - content catalog (read FIRST on every query)
- `log.md` - append-only chronological record
- `_templates/note.md` - Obsidian note template

## Page conventions

Every wiki page starts with YAML frontmatter, then a one-line summary, then content:

```markdown
---
type: source | entity | concept | synthesis
tags: [topic1, topic2]
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: ["raw/some-article.md"]
---

# Page Title

**Summary**: One sentence the agent reads to decide relevance.

## Content

...

## Related

- [[Other Page]]
```

Rules:
- Use `[[wikilinks]]` to connect pages. A well-linked graph beats a flat folder.
- Keep pages focused. Split a page covering multiple distinct topics.
- Use consistent terminology. Add an alias line if a concept has multiple names.
- Every claim drawn from a source cites that source (path under `raw/` or a URL).

## Operations

### Ingest

When a new source is added to `raw/` (or via `/api/brain/ingest`):
1. Read the source.
2. Discuss key takeaways with the user (unless batch mode).
3. Write a summary page in `wiki/sources/`.
4. Update or create relevant `wiki/entities/` and `wiki/concepts/` pages - integrate, do not just file. Flag where new data contradicts existing claims.
5. Update `index.md`.
6. Append one line to `log.md`: `## [YYYY-MM-DD] ingest | Title`.

A single source typically touches 10-15 pages.

### Query

1. Read `index.md` first to locate candidate pages.
2. Read those pages; follow `[[wikilinks]]`.
3. Answer with citations to the pages/sources used.
4. **File good answers back** as new wiki pages when they are reusable (a comparison, an analysis, a discovered connection). Explorations should compound, not vanish into chat.

### Compound (dev fixes)

After non-obvious bug fixes or features, file reusable patterns — not every ticket. See `compound-fix` skill. Default target: `wiki/projects/<name>/gotchas.md`.

### Grill (domain language)

Before triage on fuzzy tickets, use the `grill-with-docs` skill. Canonical terms go in `wiki/projects/<name>/glossary.md`; hard-to-reverse choices in `wiki/projects/<name>/decisions/`. Not in repo `CONTEXT.md`.

### Handoff (session transfer)

When the user says `/handoff` or asks to save session context for a fresh Cursor chat, use the `conversation-handoff` skill. Write to `wiki/handoffs/YYYY-MM-DD-<slug>.md` with YAML frontmatter (`type: handoff`). Update `index.md` (Handoffs section) and append `log.md` (`## [DATE] handoff | Title`). Do not use `/tmp` or project `HANDOFF.md` unless the user explicitly requests project-root output.

### Lint

Periodically health-check the wiki:
- Contradictions between pages
- Stale claims superseded by newer sources
- Orphan pages (no inbound links)
- Important concepts mentioned but lacking their own page
- Missing cross-references

## index.md and log.md

- `index.md` is **content-oriented**: a catalog of every page with a link and one-line summary, grouped by category. Updated on every ingest. Read it first when answering.
- `log.md` is **chronological**: append-only. Keep the `## [YYYY-MM-DD] type | Title` prefix so `grep '^## \[' log.md | tail -5` works.

## Hard rules

- NEVER fabricate. If a fact is missing, say so or leave a `_` placeholder - do not invent.
- NEVER edit files under `raw/`. They are immutable.
- NEVER hand-edit `projects/` - it is regenerated from Graphify graphs.
- Cite sources for every non-obvious claim.
- Compressed output is for chat answers ONLY. Everything written INTO this vault (`wiki` pages, `index.md`, `log.md`, summaries) must be full, human-readable prose.

## Routing (for the agent)

- Knowledge / research / personal / "what do I know about X" -> this wiki.
- Code / architecture / "how does this codebase work" -> Graphify (`graphify query` against the project graph, or `projects/<name>/` here).
