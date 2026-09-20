---
type: entity
tags: [tooling, graphify, knowledge-graph, codebase-intelligence, local-first, mcp]
aliases: [graphify, graphifyy]
created: 2026-06-17
updated: 2026-06-17
sources: ["raw/graphify-knowledge-graph-from-codebase.md"]
---

# Graphify

**Summary**: Local-first Python tool + Claude Code skill (by Safi Shamsi, independent, v0.4.10) that analyses a codebase once and compresses it into an on-disk queryable knowledge graph, so AI agents answer later queries by graph traversal instead of re-reading raw files.

## What it is

A CLI/skill that turns any folder into a [[knowledge-graph]] under `graphify-out/` (interactive HTML, JSON graph, Markdown report, optional Obsidian/Neo4j/SVG/GraphML/MCP export). Nodes are entities (functions, classes, concepts, doc sections); edges are relationships (calls, imports, references, inferred dependencies). Uses Leiden community detection to cluster modules. (raw/graphify-knowledge-graph-from-codebase.md)

## Three-pass architecture

1. **AST extraction (code)** — tree-sitter, deterministic, no model, no network; 23 languages; edges tagged `EXTRACTED`. Code never leaves the machine.
2. **Audio/video transcription** — faster-whisper, runs locally; optional `graphifyy[video]`.
3. **Semantic extraction (docs + images)** — calls *your* configured AI provider (Anthropic/OpenAI) with *your* key, no relay server. Only egress point; skippable in code-only mode.

## Edge confidence tiers

- `EXTRACTED` — explicitly in the source, trustworthy.
- `INFERRED` — model-reasoned from context, may be coincidental.
- `AMBIGUOUS` — flagged uncertain, needs human review.

## Usage

- Install: `pip install graphifyy` then `graphify install` (note: PyPI package is `graphifyy`, double-y).
- Commands: `/graphify`, `--deep`, `--watch`, `graphify query "..."`, `graphify path A B`, `graphify explain X`.
- SHA256 cache → only changed files reprocessed; `--install-hooks` rebuilds on commit/checkout.

## Caveats

- Single-developer project; long-term maintenance unknown.
- First-ingest Pass-3 API cost can be very large (a reader reported ~20% of a Claude Max weekly quota on an unfinished first scan).
- Self-reported 71.5× token savings is directional, not independently benchmarked.

## How I use it

Used on the pd repo: graphs under `graphify-out/`, the `graphify.mdc` Cursor rule that decides graphify-vs-grep, and `graphify update .` after code edits. See [[pd/ticket-checklist]] for the seed-with-symbols workflow.

## Related

- [[graphify-knowledge-graph-from-codebase]] — source summary
- [[knowledge-graph]] — the underlying concept
- [[llm-wiki]] — contrasting prose-vault tooling
