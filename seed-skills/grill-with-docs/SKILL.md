---
name: grill-with-docs
description: >
  Grilling session that challenges a plan against the existing domain model,
  sharpens terminology, and captures glossary terms and decisions in the Second
  Brain as they crystallise. Use at the start of task-loop when domain language
  is fuzzy, when designing a feature, or when the user wants to stress-test a
  plan against project vocabulary.
---

# Grill with docs (Second Brain)

Interview relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions **one at a time**, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase or brain wiki, explore instead of asking.

**Vault:** `~/SecondBrain/Second Brain` (quote the path).

## Resolve project context

1. Repo path = workspace root or `git rev-parse --show-toplevel`.
2. Project name = Agentic OS registered name if known, else folder basename.
3. Brain dev-wiki: `<vault>/wiki/projects/<name>/` — read `glossary.md`, `gotchas.md`, `subsystems.md`, `overview.md` if they exist.
4. Cross-project concepts: `<vault>/wiki/concepts/` — read relevant pages linked from the project wiki.
5. Code graph: `<repo>/graphify-out/` when terminology must be verified against implementation.

Read `<vault>/AGENTS.md` before writing anything into the vault.

## Where knowledge lives (not CONTEXT.md)

| Content | Second Brain path |
|---------|-------------------|
| Project glossary (domain terms) | `wiki/projects/<name>/glossary.md` |
| Bounded-context map (multi-area repos) | `wiki/projects/<name>/context-map.md` |
| Hard-to-reverse decisions (ADRs) | `wiki/projects/<name>/decisions/NNNN-slug.md` |
| Cross-project domain concepts | `wiki/concepts/<slug>.md` |
| Reusable fix patterns (after work) | `wiki/projects/<name>/gotchas.md` via `compound-fix` |

Create files lazily — only when you have something to write. Never store glossary or ADRs in the repo as `CONTEXT.md` or `docs/adr/`.

## When to run

| Run full grill | Skip or lightweight check |
|----------------|---------------------------|
| New feature or design change | Literal stack trace → known file |
| Ambiguous or overloaded terms in the ticket | Typo / rename / formatting |
| User asks to stress-test the plan | Ticket fully specifies behavior |
| Domain rule unclear from Jira alone | Glossary already covers all terms used |

Lightweight check: read `glossary.md` + relevant concept pages; only open a grilling question if a term conflicts or is missing.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with `wiki/projects/<name>/glossary.md` or a linked concept page, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force precision about boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update the brain inline

When a term is resolved, update the vault **right there**. Do not batch.

1. Append or edit the term in `wiki/projects/<name>/glossary.md` using `references/glossary-format.md`.
2. If the term spans projects or is a first-class domain idea, also create or update `wiki/concepts/<slug>.md` with a wikilink back to the project glossary.
3. Update `index.md` when creating a new page.
4. Append `log.md`: `## [YYYY-MM-DD] grill | <short title>`.

Glossary pages are **domain language only** — no implementation details, no file paths, no API shapes. Implementation belongs in code comments, gotchas, or graphify.

Full prose only in vault files — never compressed/ponytail-style text in vault files.

### Offer ADRs sparingly

Only offer to create a decision record when all three are true:

1. **Hard to reverse** — meaningful cost to change later
2. **Surprising without context** — a future reader will wonder why
3. **Real trade-off** — genuine alternatives existed and one was chosen for specific reasons

If any is missing, skip. Use `references/adr-format.md`. Write to `wiki/projects/<name>/decisions/`.

### Multi-context repos

If the project has distinct bounded areas (e.g. ordering vs billing in one monorepo):

- Maintain `wiki/projects/<name>/context-map.md` listing contexts, brain paths, and relationships.
- Each context can have its own section in `glossary.md` or a dedicated concept page when large.

Infer which context the current topic relates to. If unclear, ask.

## Exit criteria

Stop grilling when:

- All terms used in the success criteria are defined or confirmed against the glossary
- Open design branches are resolved or explicitly deferred with a logged decision
- No contradictions remain between user intent, glossary, and code (or contradictions are acknowledged)

Then hand off to `task-loop` triage (step 2) with a one-line summary of resolved vocabulary.

## Related skills

- `task-loop` — parent workflow; grill is step 1.5 before triage (`ticket-loop` is an alias)
- `second-brain` — vault schema and ingest/query rules
- `compound-fix` — post-fix patterns (not glossary terms)
