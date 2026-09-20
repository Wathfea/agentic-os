---
type: source
tags: [graphify, knowledge-graph, codebase-intelligence, ai-coding, tokens, privacy, rag, mcp]
created: 2026-06-17
updated: 2026-06-17
sources: ["raw/graphify-knowledge-graph-from-codebase.md"]
url: "https://blog.gopenai.com/graphify-build-a-knowledge-graph-from-your-entire-codebase-without-sending-your-code-to-anyone-1b6924474b50"
---

# Graphify: Build a Knowledge Graph From Your Entire Codebase (source summary)

**Summary**: GoPenAI article (Mustafa Genc) explaining Graphify — a local-first Python tool + Claude Code skill that does expensive codebase analysis once, compresses it into a queryable knowledge graph on disk, and answers later queries by graph traversal instead of re-reading files; covers its three-pass architecture, privacy model, edge-confidence tiers, and the self-reported 71.5× token savings.

## Key points

- **Problem it targets**: re-reading raw files on every agent query is expensive and slow on large/mixed repos; most loaded content is irrelevant to any one question. (raw/graphify-knowledge-graph-from-codebase.md)
- **Approach vs RAG**: instead of embedding files and retrieving top-K by similarity, Graphify builds an explicit graph of entities + relationships and traverses it. Code relationships ("A calls B") are structural, living in the call graph, not the embedding space — so graphs beat vector search for code, while flat RAG can still win for open-ended prose questions.
- **Outputs in `graphify-out/`**: interactive vis.js HTML graph, persistent JSON graph, Markdown report of high-degree nodes + clusters, and optionally an Obsidian vault, Neo4j DB, SVG, GraphML, or an MCP server exposing the graph as LLM tools. Uses Leiden community detection to cluster modules with bridge nodes.
- **Three-pass architecture, three data-residency stories**:
  1. **AST extraction (code)** — tree-sitter, deterministic, no model, no network; code never leaves the machine; 23 languages; relationships tagged `EXTRACTED` (facts).
  2. **Audio/video transcription** — faster-whisper, runs locally, recordings never uploaded; optional `graphifyy[video]`.
  3. **Semantic extraction (docs + images)** — calls *your* configured AI provider (Anthropic/OpenAI) with *your* key, no central relay. Provider sees doc/image content under your API agreement. Can be skipped via code-only mode.
- **Privacy**: SECURITY.md states no network calls during analysis, no telemetry, no analytics, credentials not stored. The only egress is Pass 3 to your own provider.
- **Edge confidence tiers**: `EXTRACTED` (in the source, trustworthy) / `INFERRED` (model-reasoned, maybe coincidental) / `AMBIGUOUS` (flagged uncertain, needs human review). Labelled uncertainty instead of false confidence.
- **Workflow**: `pip install graphifyy` then `graphify install`; commands `/graphify`, `--deep`, `--watch`, `query`, `path A B`, `explain`. SHA256 cache reprocesses only changed files; `--install-hooks` rebuilds the graph on commit/checkout.
- **71.5× token claim**: from the project's own `worked/` examples — architecturally plausible for sparse structural queries, smaller for broad conceptual ones; not independently benchmarked. Treat as directional.
- **Caveats**: single-dev project at v0.4.10; PyPI package is `graphifyy` (double-y, typosquat risk); unquantified Pass-3 accuracy; large first-ingest API cost (one reader reported burning ~20% of a Claude Max weekly quota on an unfinished first scan).

## My take / why filed

Directly relevant — Graphify is used on pd (`graphify-out/` graphs, the `graphify.mdc` rule, `graphify update .` after edits). This article is the conceptual "why" behind that tooling and a good source for [[knowledge-graph]] vs RAG reasoning. The graph-vs-RAG framing complements the [[llm-wiki]] scaling note (this vault uses index-first browsing now, adds search later): for *code* a structural graph beats vectors, for *prose notes* flat reading/RAG is fine — which is exactly why the brain (prose) and graphify (code) are split tools. The first-ingest cost and `INFERRED`/`AMBIGUOUS` caveats are practical reminders for the pd graphify workflow.

## Related

- [[graphify]] — the tool entity page
- [[knowledge-graph]] — the concept page
- [[llm-wiki]] — graph vs RAG vs index-first browsing
- [[loop-engineering]] — graph as cheaper "context" step in the agent loop
- [[overview]]

## Source

- URL: https://blog.gopenai.com/graphify-build-a-knowledge-graph-from-your-entire-codebase-without-sending-your-code-to-anyone-1b6924474b50 — Mustafa Genc, GoPenAI, published 2026-04-14.
- Raw: `raw/graphify-knowledge-graph-from-codebase.md`
- Upstream: https://github.com/safishamsi/graphify
