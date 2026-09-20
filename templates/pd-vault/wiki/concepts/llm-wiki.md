---
type: concept
tags: [llm-wiki, knowledge-base, markdown, note-taking, personal-knowledge-management]
aliases: [LLM wiki, Karpathy LLM wiki, LLM-readable knowledge base, markdown knowledge base, second brain]
created: 2026-06-17
updated: 2026-06-17
sources: ["raw/karpathy-llm-wiki.md"]
---

# LLM Wiki

**Summary**: A personal knowledge base kept as structured plain-markdown files, designed to be read and reasoned over by an LLM agent rather than browsed manually — a workflow pattern popularized by [[andrej-karpathy]].

## What it is

An LLM wiki is a folder of markdown notes optimized for a model to read on your behalf. You describe what you need in plain language and the agent finds and synthesizes the answer across your whole knowledge base, citing which files it drew from. Knowledge stays in files you control, so answers are grounded in *your* notes rather than the general internet or a proprietary system. (See [[karpathy-llm-wiki]].)

It is a workflow pattern, not a product: no database, no vector embeddings (optional, later), no server — just files and a capable model.

## How it differs from a normal notes app

- **Traditional notes app**: built for humans — you remember where something is and navigate to it via folders, tags, and search.
- **LLM wiki**: built for a model — you describe what you need and the agent locates and synthesizes it. The model ignores folder hierarchy and tags; it reads text, so plain markdown is the ideal format.

## Why markdown is the foundation

- **Portable and future-proof** — a `.md` file is plain text that opens in any editor on any OS, indefinitely; no dependence on a vendor or app staying alive.
- **Read natively by LLMs** — models are trained on huge amounts of markdown (READMEs, docs, forums), so headers, lists, code blocks, and bold are interpreted as structure, not noise.
- **Forces clarity** — headers require naming sections, lists require separating items; the format nudges you toward organized notes.
- **No lock-in** — works with git, VS Code, Obsidian, a private GitHub repo, or a terminal. The knowledge is literally yours.

## Architecture (three components)

1. **A folder of markdown files** — the knowledge base: research notes, meeting summaries, project docs, book notes, reference material, code snippets with explanations.
2. **A consistent internal structure per file** — a title, a one-line summary, tagged topics, then the content. The structure lets the model locate relevant information faster.
3. **An LLM agent as the query interface** — reads the files it needs, synthesizes an answer, and can create or update notes on request.

A common note template: title, a one-sentence **Summary**, **Tags**, created/updated dates, a `## Content` section, and `## Related` links. You needn't follow it exactly — the essentials are a summary line and tags on every note.

A common folder layout: broad top-level folders (`projects/`, `research/`, `reference/`, `meetings/`) plus an `inbox/` for rough captures and a `_templates/` for the note template. Don't over-engineer the hierarchy.

## Best practices for a queryable knowledge base

- **Write summaries, not just content** — the one-line summary at the top lets the model decide relevance without reading the whole file. Ten seconds of effort saves wasted reads.
- **Use consistent terminology** — pick one term (e.g. "RAG" vs "retrieval augmented generation") and add an alias line when a concept has multiple names.
- **Link notes to each other** — `[[wikilinks]]` give the model a graph to reason over; a well-linked wiki outperforms a flat folder of isolated files.
- **Keep notes focused** — ten focused 1,000-word notes are easier to query than one 10,000-word catch-all. Split notes that cover multiple distinct topics.
- **Use an `inbox/` capture pattern** — dump rough notes in fast, then periodically ask the agent to suggest where each should be filed and tagged.

## Scaling: when to add semantic search

Direct file-reading scales further than expected — typically fine up to a few hundred focused notes. Beyond that, add a semantic-search/RAG layer (a vector index over the markdown, e.g. via a tool like LlamaIndex) so the agent narrows candidates before reading full files, or package the query logic as a reusable agent skill that pre-filters and summarizes to cut token cost. Add this only when you notice the agent struggling to find things you know are in the wiki — for most personal wikis it is overkill.

## Prose wiki vs code knowledge graph

This is the prose half of a deliberate split: prose notes are retrieved index-first (and RAG later), whereas *code* is better retrieved by traversing a [[knowledge-graph]] (e.g. [[graphify]]) because code relationships are structural, not semantic. Same goal — don't reload everything into context per query — different retrieval structure per data type.

## Relevance to my work

This vault is itself a Karpathy-style LLM wiki — the [[AGENTS]] schema here (per-page YAML frontmatter, one-line summaries, `[[wikilinks]]`, `raw/` immutable sources, `index.md` read first, `inbox/` capture, "don't add RAG before ~a few hundred pages") is a concrete implementation of this exact pattern. The model-also-reads framing reinforces why the vault's hard rule is full human-readable prose in pages but compressed output only in chat.

## Related

- [[karpathy-llm-wiki]] — source summary
- [[andrej-karpathy]] — originator of the pattern
- [[overview]]
