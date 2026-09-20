---
type: source
tags: [ai-coding, agents, workflows, task-loop, skills]
created: 2026-09-15
updated: 2026-09-15
sources: ["raw/task-loop-skill.md"]
---

# Task loop skill (source summary)

**Summary**: Snapshot of the Cursor `task-loop` skill — the project-agnostic Intent-Act-Verify sequence for any prompted work in a repo. Old name `ticket-loop` is an alias.

## Key points

- A chat prompt is a task. Jira is optional. The loop is the spine for work in any repo (pd and others), not a pd-only ticket ritual. (raw/task-loop-skill.md)
- Run when the user wants something done (implement, fix, refactor, add, wire, review-and-change). Skip factual questions and read-only explanation with no change.
- Sequence: optional branch → resolve project context → Intent → Grill (when domain language is fuzzy) → Triage → Act → Verify → Repair on failure → Review → Compound.
- Triage picks one path: literals in a stack trace, log, config, or path go to Grep/Glob/Read; unknown cross-service flow with a graph goes to symbol-seeded Graphify; domain rules go to the project wiki glossary, gotchas, and subsystems. Never seed Graphify with symptom sentences or ticket keys.
- Act uses the ponytail ladder (smallest reversible diff, root cause once). Verify uses unlazy gates if they exist, else this project's Verify section or inferred test command. Compound files reusable lessons, not every ticket.
- Layers must not be inverted: this skill owns sequence; ponytail owns what to build; unlazy owns when done is allowed; the current project's Verify rules own where tests run.

## My take / why filed

This is the operational loop that sits under [[loop-engineering]]. The Kilo article describes the discipline; this skill is the concrete sequence agents must follow in this vault and in every repo. See [[task-loop]] for the concept page.

## Related

- [[task-loop]] — the concept page
- [[loop-engineering]]
- [[pd/ticket-checklist]]
- [[overview]]

## Source

- Live skill: `task-loop` (Cursor / Claude skills directory)
- Raw snapshot: `raw/task-loop-skill.md` (captured 2026-09-15)
