# {{NAME}} — Agent context

Primary work: bugs, features, and tasks on {{NAME}}.

## Orientation (code)

Graph: `graphify-out/graph.json`. See `.cursor/rules/graphify.mdc` for **when** to use graphify vs grep.

- **Structural / cross-service** → `graphify query` or `graphify path` with **symbol seeds** (class, service, method names)
- **Literal in log / config / ticket ID** → Grep/Glob first, then Read
- After code edits: `graphify update .` (use `--force` if overwrite refused)

Wiki nav: `graphify-out/wiki/index.md` (prefer over `GRAPH_REPORT.md` for browsing).

## Orientation (knowledge)

Durable notes and patterns live in the **Second Brain** vault, not in this repo:

- Vault: `{{BRAIN_ROOT}}`
- Dev wiki: `wiki/projects/{{SLUG}}/` (overview, glossary, gotchas, ticket checklist)
- Concepts: `wiki/concepts/` (cross-project domain pages)
- Code-graph mirror (read-only, Agentic OS): `projects/{{SLUG}}/`

Read vault `index.md` before answering "what do we know about {{NAME}} …" questions.

## Task workflow

Follow the `task-loop` skill (`ticket-loop` is an alias). A prompt is a task; Jira is optional.

1. Intent from the prompt or ticket. Non-trivial: `unlazy` gates before Act.
2. **Grill** (when domain language is fuzzy): `grill-with-docs` → Second Brain `wiki/projects/{{SLUG}}/glossary.md`. Skip for literal stack traces.
3. **Triage:**
   - Stack trace / error names a file or string → Grep/Glob that literal
   - Cross-service flow, no path → `graphify query "<ServiceClass> <method>"` or `graphify path "A" "B"`
4. Act (ponytail); verify per this project's `wiki/projects/{{SLUG}}/overview.md` **Verify** (or inferred stack).
5. `graphify update .` after code changes.
6. Reusable gotcha → **compound-fix** → `wiki/projects/{{SLUG}}/gotchas.md`. Skip routine one-liners.

## What not to do

- Do not dump every ticket into the brain — file **patterns**, not diffs.
- Do not hand-edit `graphify-out/` or vault `projects/{{SLUG}}/` (mirrors).
- Do not run graphify with ticket IDs or vague symptoms — seeds must be code symbols.
- Do not store domain glossary in repo `CONTEXT.md` — use the brain `glossary.md`.
