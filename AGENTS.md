# agentic — Agent context

Primary work: bugs, features, and tasks on agentic.

## Orientation (code)

Graph: `graphify-out/graph.json`. See `.cursor/rules/graphify.mdc` for **when** to use graphify vs grep.

- **Structural / cross-service** → `graphify query` or `graphify path` with **symbol seeds** (class, service, method names)
- **Literal in log / config / ticket ID** → Grep/Glob first, then Read
- After code edits: `graphify update .` (use `--force` if overwrite refused)

Wiki nav: `graphify-out/wiki/index.md` (prefer over `GRAPH_REPORT.md` for browsing).

## Orientation (knowledge)

Durable notes and patterns live in the **Second Brain** vault, not in this repo:

- Vault: `~/SecondBrain/Second Brain`
- Dev wiki: `wiki/projects/agentic/` (overview, glossary, gotchas, ticket checklist)
- Concepts: `wiki/concepts/` (cross-project domain pages)
- Code-graph mirror (read-only, Agentic OS): `projects/agentic/`

Read vault `index.md` before answering "what do we know about agentic …" questions.

## Ticket workflow

1. Paste or fetch task context (key, summary, repro).
2. **Grill** (when domain language is fuzzy): `grill-with-docs` skill → Second Brain `wiki/projects/agentic/glossary.md`. Skip for literal stack traces.
3. **Triage tool:**
   - Stack trace / error names a file or string → Grep/Glob that literal
   - Cross-service flow, no path → `graphify query "<ServiceClass> <method>"` or `graphify path "A" "B"`
4. Read only files graph or grep points to; implement fix; run tests.
5. `graphify update .` after code changes.
6. Reusable gotcha → **compound-fix** → `wiki/projects/agentic/gotchas.md`. Skip routine tickets.

## What not to do

- Do not dump every ticket into the brain — file **patterns**, not diffs.
- Do not hand-edit `graphify-out/` or vault `projects/agentic/` (mirrors).
- Do not run graphify with ticket IDs or vague symptoms — seeds must be code symbols.
- Do not store domain glossary in repo `CONTEXT.md` — use the brain `glossary.md`.
