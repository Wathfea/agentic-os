---
type: concept
tags: [ai-coding, agents, workflows, task-loop, skills]
aliases: [ticket-loop, Intent-Act-Verify loop, /task-loop, /ticket-loop]
created: 2026-09-15
updated: 2026-09-15
sources: ["raw/task-loop-skill.md"]
---

# Task loop

**Summary**: Project-agnostic Intent-Act-Verify spine for any prompted work in a repo. A chat prompt is a task; Jira is optional. Old name `ticket-loop` is an alias — do not keep a per-repo fork of the loop.

## What it is

The task loop is the sequence an agent follows when the user wants something **done** in a workspace: implement, fix, refactor, add, wire, or review-and-change. It is not Jira-only. The live definition lives in the Cursor skill `task-loop`; this page is the wiki node. (See [[task-loop-skill]].)

It is the concrete workflow that implements [[loop-engineering]] in this setup: close the loop with evidence (tests, review, graph update, filed gotchas) rather than one-shot generation.

Skip the loop for factual questions, “what is X”, or read-only explanation with no change.

## Resolve project context first

Before Intent, identify the repo and which knowledge layers exist:

1. Repo path = workspace root or `git rev-parse --show-toplevel`.
2. Project name = Agentic OS registered name if known, else the folder basename.
3. Brain: `wiki/projects/<name>/` — `overview.md`, `glossary.md`, `gotchas.md`, `subsystems.md` if they exist.
4. Graph: `<repo>/graphify-out/` if present — prefer `wiki/index.md`, then `graph.json`. Put `~/.local/bin` on `PATH` before any Graphify command.

Missing wiki or graph: skip that layer. Do not invent another repo’s verify stack (for example pd k3d/Pest) for a Swift or JS repo.

## The sequence

### 0 Optional: branch

If the prompt includes a Jira key, URL, or summary **and** the `jira-branch-workflow` skill exists, run that skill before Intent. Otherwise stay on the current branch.

### 1 Intent

Capture what done looks like from the ticket fields or from the prompt itself. Write observable success criteria **before** acting.

For non-trivial work, write unlazy gates before Act. Skip gates for typo, rename, and comment-only one-liners.

### 1.5 Grill (domain language)

Invoke `grill-with-docs` when vocabulary is fuzzy, or when the change is a new behavior or a cross-subsystem design. Canonical terms land in `wiki/projects/<name>/glossary.md`.

Skip Grill when the stack trace names a file or line, the change is an obvious one-liner, or the glossary already covers every term in the success criteria.

### 2 Triage

Pick **one** path:

| Signal | Tool |
|--------|------|
| Literal in a stack trace, log, config, env, or path | Grep / Glob / Read |
| Cross-service or unknown subsystem **and** `graphify-out` exists | Extract 1–3 class/method symbols, then `graphify explain` → `path` → `query` |
| Domain rule or prior lesson | Brain `glossary.md` + `gotchas.md` + `subsystems.md` |

No graph → grep. Never seed Graphify with symptom sentences or ticket keys.

### 3 Act (ponytail)

Climb the ponytail ladder. Ship the smallest reversible diff. Fix the root cause once in the shared function, not a guard per caller.

The **current** repo’s conventions still win (DTOs, layering). Do not import another repo’s stack.

Prefer a cheap failing test first when the project has an obvious unit or service test target; otherwise one line why, then Act. Prefer no new test over a bad test.

### 4 Verify

1. If unlazy gates exist, those CHECKs **are** verify.
2. Else read `wiki/projects/<name>/overview.md` **Verify** section.
3. Else infer from this repo: k3d pod when `skill-k8s-local-dev` exists; `package.json` test script; Swift/Xcode test target; otherwise README / `AGENTS.md`.

Trivial one-liners need no test. Still Review if code changed.

### 5 Repair

A failed CHECK is new context, not a cue to widen the diff. Narrow the change. Re-triage if the assumption was wrong. Re-run the same CHECK.

**Stop when:** gates are met, the work is blocked, the request is out of scope, or the next step would be destructive or unapproved.

### 6 Review

If code changed and `review-checklist` exists, run it on the **full branch or worktree diff**, not only the last commit. If there is no checklist skill, read the diff yourself before claiming done.

Skip Review for non-code work (wiki-only pages, answers).

### 7 Compound

If the work produced a reusable insight **and** a project wiki exists, run `compound-fix` into `wiki/projects/<name>/gotchas.md`. File patterns, not diffs. Then `graphify update .` if this repo has a graph.

## Layers (do not invert)

| Owns | Skill |
|------|--------|
| Sequence | this loop (`task-loop`) |
| What to build | `ponytail` |
| When “done” is allowed | `unlazy` |
| Jira branch mapping | `jira-branch-workflow` (opt-in, pd-shaped) |
| Where tests run | **this project’s** Verify section / overlay rules |

## Relevance to my work

pd’s [[pd/overview]] and [[pd/ticket-checklist]] follow this global loop rather than a pd fork. The same sequence applies in other repos, each with their own Verify rules. [[loop-engineering]] is the broader discipline; this page is the operational checklist.

## Related

- [[task-loop-skill]] — source snapshot of the Cursor skill
- [[loop-engineering]] — the discipline this loop implements
- [[llm-wiki]] — where Grill and Compound write
- [[knowledge-graph]] — Graphify triage path
- [[pd/ticket-checklist]]
- [[pd/overview]]
- [[overview]]
