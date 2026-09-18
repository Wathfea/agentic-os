# Lint the wiki

Periodic health-check. Vault root: `~/SecondBrain/Second Brain` (quote it).

## Checks

1. **Contradictions** - pages making conflicting claims about the same entity/fact. Report both, with sources. Do NOT auto-resolve a decision reversal; surface it for the user.
2. **Stale claims** - statements superseded by a newer source. Supersede (note what replaced what + when), do not silently delete.
3. **Orphans** - pages with no inbound `[[wikilinks]]`. Suggest where to link them.
4. **Missing pages** - concepts/entities mentioned across pages but lacking their own page.
5. **Missing cross-references** - related pages that should link to each other.
6. **Index drift** - pages not listed in `index.md`, or index entries pointing at moved/deleted pages.
7. **Gaps** - important questions the corpus raises but doesn't answer; suggest sources to ingest.

## Output

Produce a report grouped by check, each item with the page path and a suggested fix. Apply fixes only after the user approves (or in an explicitly authorized batch). Append a `## [YYYY-MM-DD] lint | <summary>` line to `log.md`.

## Rules

- Prefer stable identity (the source citation) over textual proximity when detecting duplicates/contradictions.
- Never fabricate to "fill" a gap - flag it instead.
- Full prose only in any page you touch.
