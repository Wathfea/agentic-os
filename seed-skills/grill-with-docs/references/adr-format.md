# Decision record format (Second Brain)

Target: `wiki/projects/<name>/decisions/NNNN-slug.md`

ADRs live in the brain, not in `docs/adr/` inside the repo.

## Frontmatter

```markdown
---
type: synthesis
tags: [<name>, decision]
status: proposed | accepted | deprecated | superseded
created: YYYY-MM-DD
updated: YYYY-MM-DD
supersedes: ""
superseded_by: ""
---

# Short title of the decision

One to three sentences: context, what was decided, and why.
```

That is enough for most records. Optional sections only when they add value:

- **Considered options** — when rejected alternatives are worth remembering
- **Consequences** — non-obvious downstream effects

## Numbering

Scan `wiki/projects/<name>/decisions/` for the highest `NNNN` prefix and increment by one.

## After writing

1. Update `index.md` (Decisions section for the project).
2. Append `log.md`: `## [YYYY-MM-DD] decision | <title>`.
3. Wikilink from `glossary.md` or `overview.md` if the decision defines a term or boundary.

## When to offer

All three must be true:

1. Hard to reverse
2. Surprising without context
3. Result of a real trade-off

Skip easy-to-reverse, obvious, or no-alternative choices.
