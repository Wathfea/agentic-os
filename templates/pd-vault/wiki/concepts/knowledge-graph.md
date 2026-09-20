---
type: concept
tags: [knowledge-graph, codebase-intelligence, rag, retrieval, ai-coding, graph-traversal]
aliases: [knowledge graph, code graph, codebase graph, graph traversal retrieval]
created: 2026-06-17
updated: 2026-06-17
sources: ["raw/graphify-knowledge-graph-from-codebase.md"]
---

# Knowledge Graph (for codebases)

**Summary**: An explicit graph of entities (functions, classes, concepts, document sections) and their relationships (calls, imports, references, inferred dependencies) that an AI agent traverses to answer questions — an alternative to embedding-based RAG that better matches the structural nature of code.

## The idea

Build the expensive analysis once and store it as a graph on disk; answer later queries by walking the graph instead of re-reading raw source. This mirrors how a senior engineer navigates an unfamiliar system: build a mental model and traverse it, rather than fuzzy-searching the text. (See [[graphify]], raw/graphify-knowledge-graph-from-codebase.md)

## Graph traversal vs RAG (vector search)

- **RAG** embeds files and retrieves the top-K most *semantically similar* chunks. Strong for prose, where similarity is a reliable retrieval signal.
- **Graph traversal** follows explicit edges. Strong for code, where the link between a function and its callers is *structural*, not semantic — "process_payment calls validate_card" lives in the call graph, not the embedding space.
- **Rule of thumb**: structural/sparse queries over code → graph wins (large token savings); broad open-ended questions over prose → flat RAG often wins.

## Confidence in edges

A practical refinement is labelling each edge's trustworthiness rather than presenting all relationships with equal (false) confidence: `EXTRACTED` (parsed from source, factual), `INFERRED` (model-reasoned, possibly coincidental), `AMBIGUOUS` (flagged for human review). See [[graphify]].

## Why it matters to me

This is the conceptual foundation of [[graphify]], which runs on the pd repo. It also clarifies the deliberate split in this setup:

- **Code / architecture** → a knowledge graph ([[graphify]]) — structural traversal.
- **Prose notes / research** → an [[llm-wiki]] (this vault) — index-first reading, add RAG only at scale.

Both avoid loading everything into context on every query; they just use the right retrieval structure for their data type.

## Related

- [[graphify]] — concrete tool implementing this
- [[graphify-knowledge-graph-from-codebase]] — source
- [[llm-wiki]] — prose counterpart (index-first / optional RAG)
- [[loop-engineering]] — cheaper context step inside the agent loop
