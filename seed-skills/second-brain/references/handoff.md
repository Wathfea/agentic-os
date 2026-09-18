# Session handoff into the vault

Vault root: `~/SecondBrain/Second Brain` (quote it).

Use the `conversation-handoff` skill for `/handoff` in Cursor. Do not write to `/tmp`.

## Location

`wiki/handoffs/YYYY-MM-DD-<slug>.md`

## After writing

1. Append `log.md`: `## [YYYY-MM-DD] handoff | Title`
2. Add entry under **Handoffs** in `index.md`
3. Wikilink related project/concept pages when applicable

## vs other persistence

| Mechanism | Where | When |
|-----------|-------|------|
| conversation-handoff | `wiki/handoffs/` | Cursor session switch, context limit |
| compound-fix | `wiki/projects/<name>/gotchas.md` | Reusable dev lesson from a ticket |
| ingest | `raw/` + `wiki/sources/` | Articles, docs, external sources |
| boTyna `handoff` | `HANDOFF.md` / fleet API | Multi-agent fleet only |

Handoffs are **session snapshots** — stale over time. Receiving agent should verify live git/kanban state.
