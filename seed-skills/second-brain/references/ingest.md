# Ingest a source

Goal: integrate a new source into the wiki so knowledge compounds - not just file it.

Vault root: `~/SecondBrain/Second Brain` (quote it).

## Steps

1. **Locate the source.** It should be in `raw/`. If the user gave a URL, fetch it to markdown into `raw/` first (Obsidian Web Clipper, or `graphify add <url>` which writes to `./raw`, or fetch + write). Download referenced images to `raw/assets/` when useful. Never edit a source after it lands in `raw/`.

2. **Read it fully.** For sources with important images, read the text first, then view the images separately (LLMs can't read inline-image markdown in one pass).

3. **Discuss takeaways** with the user (skip in batch mode). Confirm what to emphasize.

4. **Write a source summary page** in `wiki/sources/<slug>.md` with frontmatter (`type: source`, tags, created/updated, `sources: ["raw/<file>"]`), a one-line `**Summary**`, key points, and `## Related` wikilinks.

5. **Integrate across the wiki.** Create or update relevant `wiki/entities/` and `wiki/concepts/` pages. Integrate the new information into existing pages - revise summaries, add cross-references, and FLAG where the new source contradicts an existing claim (note both and the sources). A single source typically touches 10-15 pages.

6. **Update `index.md`** - add the new pages under the right category with one-line summaries.

7. **Update `wiki/overview.md`** if the source shifts the top-level synthesis.

8. **Append `log.md`**: `## [YYYY-MM-DD] ingest | <Title>`.

## Rules

- Cite `raw/<file>` (or URL) for every claim taken from the source.
- Full prose only - never compressed text in vault files.
- Prefer many focused pages over one catch-all page.
- Use consistent terminology; add an alias line when a concept has multiple names.
