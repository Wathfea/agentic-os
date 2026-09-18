---
type: synthesis
tags: [{{SLUG}}, project]
created: {{DATE}}
updated: {{DATE}}
---

# {{NAME}} overview

**Summary**: Dev wiki for {{NAME}} at `{{PATH}}`. Code orientation via Graphify; durable patterns in gotchas and subsystems.

## Repo

- Path: `{{PATH}}`
- Graph: `graphify-out/graph.json`
- Brain mirror: `projects/{{SLUG}}/`

## Verify

_Document how to run tests for this project. Examples: k3d pod + pest for PHP monorepos; `npm test` for JS apps._

## How we work tickets

1. Capture task context (key, summary, repro).
2. **Grill** (when terms are fuzzy): `grill-with-docs` → [[{{SLUG}}/glossary]]; skip for literal stack traces.
3. Triage: literals → grep; structure → graphify with symbol seeds; domain → [[{{SLUG}}/glossary]] + [[{{SLUG}}/gotchas]] + [[{{SLUG}}/subsystems]].
4. Fix + verify per section above.
5. `graphify update .` after code changes.
6. Reusable insight → [[{{SLUG}}/gotchas]] via compound-fix.

## Related

- [[{{SLUG}}/glossary]]
- [[{{SLUG}}/gotchas]]
- [[{{SLUG}}/subsystems]]
- [[{{SLUG}}/ticket-checklist]]
