---
name: conversation-handoff
description: Compact the current Cursor chat into a handoff document in the Second Brain vault so a fresh agent or session can continue the work. Use when switching sessions, hitting context limits, handing off to another agent, or when the user says "/handoff", "handoff", or "save context for later".
disable-model-invocation: true
---

# Conversation Handoff (Cursor → Second Brain)

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it in the **Second Brain** vault — not `/tmp`, not the project git tree.

**Vault root:** `~/SecondBrain/Second Brain` (quote the path).

Read vault `AGENTS.md` before writing. Full prose in vault files — never compressed text in handoff pages.

## Where to save

```text
<VAULT>/wiki/handoffs/YYYY-MM-DD-<slug>.md
```

- `<slug>` — kebab-case from the handoff purpose (e.g. `pd-auth-refactor`, `vfs-mobile-login`).
- One file per handoff. Do not overwrite prior handoffs.

Override path only if the user passes one explicitly (still under the vault unless they say otherwise).

## Arguments

User arguments = what the next session should focus on. Example: `/handoff Continue the auth refactor and fix the failing CI checks`.

## Rules

- **Do not duplicate** content already in PRDs, plans, ADRs, issues, commits, diffs, or agent transcripts. Reference by path or URL.
- **Redact** secrets: API keys, passwords, tokens, `.env`, PII.
- Keep it tight — receiving session needs room to work. Prefer path:line refs over pasted blocks.
- **Suggested skills** section — name Cursor skills the next agent should invoke.
- Reference prior chats as `[short title](<transcript-uuid>)` when relevant.
- **Wikilink** related vault pages when obvious (e.g. `[[publishdrive-pd]]`, `[[pd/gotchas]]`).

## Document template

```markdown
---
type: handoff
tags: [handoff, session]
created: {ISO date YYYY-MM-DD}
workspace: {absolute path to Cursor workspace if known}
project: {pd | vfs-mobil | agentic | other — optional}
---

# Handoff: {what the next session should accomplish}

Generated: {ISO timestamp}

## Goal
{2-3 sentences.}

## Current state
{Done / in progress / where things stand.
- Branch, uncommitted changes, open PRs (links)
- Key files as path:line
- Reference plans/issues by path or URL}

## Key decisions & findings
{Decisions, gotchas, dead ends.}

## Next steps
1. {Most specific actionable item}
2. {...}

## Suggested skills
- {skill-name} — {why}

## Related
- [[relevant wiki pages]]
```

## Procedure

1. Infer focus from user arguments or conversation.
2. Pull state: `git status`, `git branch --show-current`, open PRs, key files/decisions from this chat.
3. Fill template; redact secrets.
4. Write to `wiki/handoffs/YYYY-MM-DD-<slug>.md`.
5. Append `log.md`: `## [YYYY-MM-DD] handoff | {short title}`.
6. Add one line to `index.md` under **Handoffs** (link + one-line summary).
7. Report vault path to user.

## Routing

- **This skill** — Cursor session handoff → Second Brain `wiki/handoffs/`.
- **`handoff` skill** — boTyna fleet (kanban, memory API, port 3421) → `HANDOFF.md` in project root or inter-agent message. Do not use both for the same handoff unless user asks.

## Receiving session

Next agent: read `index.md` → open latest handoff under **Handoffs**, or search `log.md` for `handoff |`.
