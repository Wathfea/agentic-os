---
type: source
tags: [llm-wiki, knowledge-base, markdown, note-taking, personal-knowledge-management, karpathy]
created: 2026-06-17
updated: 2026-06-17
sources: ["raw/karpathy-llm-wiki.md"]
url: "https://www.mindstudio.ai/blog/andrej-karpathy-llm-wiki-knowledge-base-claude-code"
---

# Andrej Karpathy's LLM Wiki (source summary)

**Summary**: MindStudio article explaining Karpathy's "LLM wiki" pattern — keeping personal knowledge as structured plain-markdown files so an LLM/coding agent can read, reason over, and maintain it directly. (Claude Code setup steps and MindStudio product pitch are intentionally omitted; only the portable knowledge-base knowledge is captured here.)

## Key points

- **The core idea**: instead of scattering knowledge across Notion, Google Docs, bookmarks, and sticky notes, keep everything as structured markdown files, then point a capable LLM agent at the folder and ask questions. The model reads your files and gives grounded answers from your own knowledge, not the general internet. (raw/karpathy-llm-wiki.md)
- **It's a workflow pattern, not a product** — attributed to Andrej Karpathy as a "deceptively simple" idea.
- **Optimized for the model, not the human**: traditional notes apps are built for manual browsing/search; an LLM wiki is built for a model to read on your behalf, which changes how you structure information.
- **Why markdown**: portable and future-proof (plain text opens anywhere, forever), read natively by LLMs (trained on README/docs/forum markdown), forces clarity (headers and lists nudge organization), and has no lock-in (git, VS Code, Obsidian, GitHub, terminal).
- **Minimal architecture, three parts**: (1) a folder of markdown files, (2) a consistent internal structure per file — title, one-line summary, tags, then content, (3) an LLM agent as the query interface. No database, no vector embeddings required, no server.
- **Front-end**: Obsidian is recommended (local-first markdown editor, `[[wiki links]]`, graph view, backlinks) but not required — any text editor works because it's just a folder of `.md` files.
- **Suggested folder layout**: broad top-level folders like `projects/`, `research/`, `reference/`, `meetings/`, plus an `inbox/` for rough, un-triaged capture; a `_templates/` note template for consistency. Don't over-engineer.
- **Best practices**: write a one-line summary on every note (the model reads it to judge relevance), use consistent terminology (add alias lines for synonyms), link notes with `[[wikilinks]]` to give the model a richer graph, keep notes focused (ten focused 1,000-word notes beat one 10,000-word catch-all), and use an `inbox/` capture pattern triaged later.
- **Scaling**: direct file-reading works for up to a few hundred focused notes; beyond that, add a semantic-search/RAG layer (e.g. a vector index) or package the query logic as a reusable agent skill that pre-filters and summarizes. For most people this is overkill — add it only when the agent struggles to find things you know are there.

## My take / why filed

This is the conceptual blueprint for the very vault these notes live in — my Second Brain is a Karpathy-style LLM wiki. Captured the durable pattern (markdown, per-note summaries, focused linked pages, inbox capture, scale-only-when-needed) and deliberately dropped the Claude Code install walkthrough and MindStudio marketing per request. The best-practice list maps directly onto this vault's own [[AGENTS]] schema.

## Related

- [[llm-wiki]] — the concept page
- [[andrej-karpathy]] — originator of the pattern
- [[overview]]

## Source

- URL: https://www.mindstudio.ai/blog/andrej-karpathy-llm-wiki-knowledge-base-claude-code — MindStudio Team, published 2026-04-06 (last updated 2026-05-11).
- Raw: `raw/karpathy-llm-wiki.md`
