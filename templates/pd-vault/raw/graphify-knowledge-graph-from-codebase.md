---
source_url: https://blog.gopenai.com/graphify-build-a-knowledge-graph-from-your-entire-codebase-without-sending-your-code-to-anyone-1b6924474b50
author: Mustafa Genc
publication: GoPenAI
published: 2026-04-14
retrieved: 2026-06-17
---

# Graphify: Build a Knowledge Graph From Your Entire Codebase — Without Sending Your Code to Anyone

By Mustafa Genc, GoPenAI, Apr 14, 2026.

Every time you ask your AI assistant "how does the auth flow work?" it reads the relevant files from scratch. On a small project that's fine. On a 50-file, mixed-language repo with PDFs, architecture docs, and a few recorded design meetings, it either hits a context limit or burns through hundreds of thousands of tokens — every single query.

Graphify is a Python tool and Claude Code skill that solves this by doing the expensive analysis once, upfront, and compressing everything into a queryable knowledge graph. The graph stays on disk. Subsequent queries traverse the graph instead of re-reading raw files. The claim is 71.5× fewer tokens per query on mixed corpora. That number is self-reported and worth scrutinising. But the underlying idea is architecturally sound, and the way Graphify handles data privacy is more nuanced than most tools of this type.

## The Token Tax on Large Codebases

Context windows have grown dramatically — Claude Sonnet 4.6 supports 200K tokens, GPT-5.4 up to 1M — but the problem is not just size. It is cost and latency. Feeding a 200-file repository into every query is expensive in API costs and slow in wall-clock time. Most of the information in those 200 files is irrelevant to any given question. You are paying to load the entire library to find one paragraph.

The standard answer is RAG: embed your files, store them in a vector database, retrieve the top-K chunks at query time. RAG works well for prose documents where semantic similarity is a reliable retrieval signal. It works less well for code, where the relationship between a function and its callers is structural, not semantic — "process_payment calls validate_card" does not live in the embedding space; it lives in the call graph.

Graphify takes a different approach. Instead of embedding files and retrieving by similarity, it builds an explicit graph of entities and relationships, then answers queries by traversing that graph. This is structurally closer to how a senior engineer navigates an unfamiliar codebase: they build a mental model of the system and traverse it, rather than doing a fuzzy search over the source text.

## What Graphify Produces

Running `/graphify` on a directory produces several outputs in a `graphify-out/` folder:

- An interactive HTML graph rendered with vis.js — nodes are entities (functions, classes, concepts, document sections), edges are relationships (calls, imports, references, inferred dependencies)
- A persistent JSON graph for programmatic queries
- A Markdown report identifying high-degree nodes and community clusters
- Optionally: an Obsidian vault, a Neo4j database, an SVG, a GraphML file, or an MCP server that exposes the graph as LLM-accessible tools

The graph uses Leiden community detection to cluster nodes into thematic groups. If you have a monorepo with auth, billing, and infra modules, the graph will automatically surface those as distinct clusters with explicit bridge nodes between them.

## Three Passes, Three Different Philosophies About Your Data

The tool does not treat all file types the same way. It runs three distinct passes, and each one has a completely different data residency story.

### Pass 1: Deterministic AST Extraction (Your Code Never Leaves)

For every source code file, Graphify calls tree-sitter — a deterministic, rule-based parser. It reads the file, applies a formal grammar, and outputs a structured syntax tree. No language model is involved. No network call is made. Your source code does not leave your machine.

tree-sitter supports 23 languages: Python, TypeScript, JavaScript, Go, Rust, Java, C, C++, Ruby, C#, Kotlin, Scala, PHP, and more. The output is a set of node/edge dicts encoding every function, class, import, and call relationship explicitly visible in the source text.

This matters for two reasons. First, it is free (no API cost). Second, it is precise — AST-extracted relationships carry the `EXTRACTED` confidence tag, meaning they are facts, not guesses.

### Pass 2: Local Audio Transcription (Your Recordings Never Leave Either)

If you point Graphify at a directory containing audio or video files, it transcribes them using faster-whisper, which runs entirely on your own machine. The audio is never uploaded anywhere. This pass is optional and requires the `graphifyy[video]` dependency group:

```
pip install "graphifyy[video]"
```

faster-whisper is a CTranslate2-accelerated implementation of OpenAI's Whisper model. On a modern laptop it transcribes an hour of meeting audio in a few minutes. The transcript is then fed into the graph as a document node, same as any other text.

### Pass 3: Semantic Extraction (Documents and Images Go to Your AI API)

Documents (Markdown, PDFs, RST), and images (PNG, JPG, WebP, GIF) cannot be parsed with a grammar. Their structure is semantic, not syntactic. To extract entities and relationships from a whiteboard photo or a research PDF, Graphify calls your configured AI platform — Anthropic, OpenAI, or whichever you have set up.

The critical word is *your*. Graphify uses the credentials already configured in your AI platform environment. It has no central relay server. The traffic goes directly from your machine to Anthropic (or OpenAI, etc.) using the same API key you already use for coding assistance.

Graphify itself collects nothing. SECURITY.md is explicit: "makes no network calls during graph analysis." The project also states there is no telemetry, no usage tracking, and no analytics of any kind. Credentials are not stored by Graphify.

The nuance: your AI provider (Anthropic, OpenAI) does see your document and image content, under your API agreement with them. If your documents contain sensitive information, review your provider's data handling policy before running Pass 3. You can also restrict Graphify to code-only mode to avoid Pass 3 entirely.

## The Confidence System: Knowing What the Graph Knows

Every edge in the graph carries one of three confidence tags.

- **EXTRACTED** means the relationship is explicitly present in the source. `validate_card` is called by `process_payment` — that is in the AST. You can trust it.
- **INFERRED** means the relationship was reasoned by the model from context. The semantic extractor noticed that `PaymentService` and `FraudDetector` are always referenced together in documentation and inferred a dependency. This might be right. It might also be a coincidence.
- **AMBIGUOUS** means the model flagged the connection as uncertain. These edges exist in the graph but should not be acted on without human review.

Think of EXTRACTED as a citation with a page number, INFERRED as a footnote that says "see also", and AMBIGUOUS as a sticky note that says "double-check this." The graph gives you all three, labelled, rather than presenting everything with false confidence.

## Getting Started

Prerequisites: Python 3.10+, a Claude Code installation (or another supported platform).

```
# Install the package
pip install graphifyy
# Register the skill with your AI platform
graphify install
```

The `graphify install` step detects your configured platform and injects the skill definition into the appropriate config file (e.g. `~/.claude/CLAUDE.md` for Claude Code).

Optional dependencies — install only what you need:

```
# Local audio/video transcription
pip install "graphifyy[video]"
# Microsoft Office file support (.docx, .xlsx)
pip install "graphifyy[office]"
# MCP server (expose graph as LLM tools)
pip install "graphifyy[mcp]"
# Everything at once
pip install "graphifyy[all]"
```

Running Graphify:

```
# Standard analysis of current directory (inside your AI assistant)
/graphify
# Deep mode: more aggressive relationship inference
/graphify --deep
# Process a specific subdirectory
/graphify ./src/auth
# Watch mode: rebuild graph as files change
/graphify --watch
# Query the existing graph
/graphify query "how does user authentication flow through the system?"
# Find the shortest path between two entities
/graphify path "UserService" "DatabasePool"
# Get a natural-language explanation of an entity
/graphify explain "PaymentProcessor"
```

On subsequent runs, SHA256 hashes are checked against the cache. Only files that changed since the last run are reprocessed. The initial ingest is the expensive one; repeat queries are fast.

Git hook integration — rebuild the graph automatically on every commit:

```
# Inside your repo, Graphify can install its own git hooks
/graphify --install-hooks
```

After this, a `git commit` or `git checkout` triggers an incremental graph update automatically. Your AI assistant always sees a graph that reflects the current branch state.

## The 71.5× Claim: What It Means and What to Verify

The README claims Graphify reduces token usage by 71.5× on mixed corpora compared to reading raw files. This number comes from the project's own `worked/` directory — example runs on curated datasets.

The claim is architecturally plausible. If you have a 10,000-function codebase and you ask "what calls process_payment?", graph traversal returns a handful of node identifiers. Reading raw files to answer the same question means loading every file that might contain the answer. The ratio depends entirely on the size of the corpus and the specificity of the query — sparse, structural queries see large gains; broad conceptual queries see smaller ones.

What has not been independently reproduced: any external benchmark comparing Graphify's graph queries against a raw-file or RAG baseline on a common test set. Until that exists, treat 71.5× as a directional indicator, not a specification.

## When Graphify Makes Sense

Good fit:

- Mixed-media projects with code, architecture documents, design PDFs, and recorded meetings in the same repository
- Repeated queries over a stable codebase — the caching benefit compounds over time
- Teams using Claude Code as a coding assistant who want to reduce per-session API costs
- Projects with complex call graphs where semantic search struggles (deep inheritance chains, heavily callback-based architectures)

Poor fit:

- Greenfield projects with fewer than ~20 files — the graph overhead is not worth it
- Repositories where all content is prose documentation — flat RAG will likely outperform graph traversal for open-ended semantic questions
- Environments where your AI provider's data handling policy prohibits sending document content to their API (Pass 3 cannot be circumvented for documents/images)
- Projects requiring verified, reproducible analysis — INFERRED and AMBIGUOUS edges can mislead if taken at face value

## Limitations Worth Knowing

- **Single-developer project.** Graphify is an independent open-source tool at v0.4.10 with no published institutional backing. Actively developed but long-term maintenance is unknown.
- **Package name friction.** The tool is called `graphify` but the PyPI package is `graphifyy` (double-y). The README acknowledges this is temporary. Always confirm the canonical package name before installing — typosquatting on popular developer tools is common.
- **Unquantified semantic extraction accuracy.** The quality of Pass 3 output depends on the underlying model and has no published precision/recall benchmarks. The INFERRED confidence tier exists precisely because this is not always reliable.
- **API cost on first ingest.** For a large project with hundreds of PDFs and images, the initial Pass 3 run can generate substantial API bills. The cache makes subsequent runs cheap, but the first run is not.

## What to Watch Next

The MCP server integration is worth watching. As MCP adoption grows across AI coding assistants, Graphify's ability to expose a codebase graph as a set of LLM-callable tools becomes a building block for autonomous agents that need structured codebase understanding rather than just file search.

## Reader-reported warning (from the comments)

One reader reported that running the tool on a regular backend/frontend cloud app consumed ~20% of their Claude Max weekly quota and hit the 5-hour quota in 20 minutes during the first scan — and the scan didn't even finish. A reminder that the first-ingest Pass 3 cost can be very large and runs in the background.

## Sources

- GitHub repository: https://github.com/safishamsi/graphify
- PyPI package page: https://pypi.org/project/graphifyy/
- SECURITY.md (upstream): https://github.com/safishamsi/graphify/blob/main/SECURITY.md
- ARCHITECTURE.md (upstream): https://github.com/safishamsi/graphify/blob/main/ARCHITECTURE.md
