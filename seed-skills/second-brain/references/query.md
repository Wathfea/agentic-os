# Query the wiki

Vault root: `~/SecondBrain/Second Brain` (quote it).

## Steps

1. **Read `index.md` first.** It is the catalog - use it to find the 1-3 candidate pages relevant to the question instead of scanning the whole vault.

2. **Read those pages.** Follow `[[wikilinks]]` to neighbors when the answer spans multiple pages. At small scale, reading the whole relevant cluster is fine and more reliable than guessing.

3. **Answer with citations.** Cite the wiki pages and underlying `raw/` sources used. If the wiki lacks the answer, say so plainly - do not fabricate. Offer to ingest a source that would fill the gap.

4. **File good answers back.** If the answer is reusable (a comparison, a synthesis, a discovered connection), write it as a new `wiki/concepts/` or `wiki/sources/` page, update `index.md`, and append `log.md` (`## [YYYY-MM-DD] query | <topic>`). Explorations should compound into the brain, not vanish into chat.

## Output

- Chat answers MAY use ponytail terse style; vault writes stay full prose.
- Anything written back into the vault MUST be full prose.

## Routing reminder

If the question is actually about a codebase, use graphify (`graphify query` on the project graph) or the mirrored `projects/<name>/` wiki rather than hand-searching the brain.
