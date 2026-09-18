---
name: compound-fix
description: >
  After a bug fix or feature on a codebase, file reusable patterns into the Second
  Brain — not every ticket. Use when the user says "worth filing", "compound this
  fix", "remember this gotcha", "add to gotchas", "ticket done — file it", or at
  the end of dev/Jira work when something non-obvious was learned on any project.
---

# Compound fix (dev → brain)

File **what you learned**, not what you changed. Skip routine fixes.

**Vault:** `~/SecondBrain/Second Brain` (quote the path).

## When to compound

| Compound | Skip |
|----------|------|
| Domain rule Jira didn't explain | Typo / rename |
| Recurring subsystem bug | Obvious one-liner |
| Dead-end approach (A failed, B worked) | Env-only issue |
| Partner/imprint/format edge case | Fully in code comments |

## Where to write

Resolve project name = folder basename or Agentic OS registered name.

| Content | Path |
|---------|------|
| Project gotcha (default) | `wiki/projects/<name>/gotchas.md` |
| Canonical domain term (grill) | `wiki/projects/<name>/glossary.md` |
| Domain concept | `wiki/concepts/<slug>.md` |
| Cross-project pattern | `wiki/concepts/<slug>.md` |

Also update `index.md` if you create a new page. Append `log.md`: `## [YYYY-MM-DD] compound | <short title>`.

## Entry format (gotchas)

```markdown
### Short title
- **What**: one sentence
- **Why it matters**: when you'll hit it again
- **Where**: file/symbol or subsystem
- **Refs**: PD-XXXX (optional)
```

Full prose only — never compressed text in vault files.

## Procedure

1. Confirm with the user (or infer from "worth filing") that the insight is reusable.
2. Draft the entry; do not paste diffs or line-by-line change logs.
3. Append to `wiki/projects/<name>/gotchas.md` or update the right concept page; wikilink related pages.
4. Update `index.md` + `log.md` if needed.

## Routing

- Code exploration → graphify (repo), not this skill.
- Full article/paper ingest → `second-brain` ingest workflow.
- This skill → **short dev lessons** from tickets.

See `second-brain/references/compound.md` for detail.
