# Glossary format (Second Brain)

Target: `wiki/projects/<name>/glossary.md`

Adapted from mattpocock/grill-with-docs CONTEXT format — stored in the vault, not in the repo.

## Page frontmatter

```markdown
---
type: synthesis
tags: [<name>, glossary]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# <name> glossary

**Summary**: Canonical domain language for <project>. Implementation-free — terms only.

## Language

**Order**:
A one or two sentence description of the term.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

## Related

- [[<name>/overview]]
- [[<name>/subsystems]]
- [[relevant-concept]]
```

## Rules

- **Be opinionated.** Pick one canonical term; list alternatives under `_Avoid_`.
- **Keep definitions tight.** One or two sentences. Define what it IS, not what it does.
- **Project-specific only.** General programming concepts (timeouts, DTOs, retries) do not belong unless the project gives them a special meaning.
- **Group under subheadings** when natural clusters emerge (e.g. `## Publishing`, `## Finance`).
- **No implementation.** No file paths, class names, or API fields — those live in gotchas, subsystems, or graphify.
- **Wikilink** related concept pages and `[[<name>/gotchas]]` where a term has known pitfalls.

## Context map (optional)

For repos with multiple bounded contexts, add `wiki/projects/<name>/context-map.md`:

```markdown
# <name> context map

## Contexts

- [[book-manager]] — validation and metadata for titles
- Finance — invoicing and transactions (see [[pd/glossary#Finance]])

## Relationships

- Book manager → file_service: presigned URLs for uploads
- plan_service → book_service: distribution channel eligibility
```

## Single vs multi-context

- **Single context:** one `glossary.md` per project wiki.
- **Multiple contexts:** `context-map.md` + glossary sections or dedicated `wiki/concepts/` pages per large context.
