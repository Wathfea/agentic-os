---
name: task-loop
description: >
  Project-agnostic Intent-Act-Verify loop for any repo and any prompted work —
  not Jira-only. Use when starting a bug, feature, refactor, Jira ticket, or
  when the user simply asks you to do something. Also: ticket-loop, /task-loop,
  /ticket-loop. Skip factual Q&A with no implementation.
---

# Task loop

Spine for work in **any** project (pd, agentic, LittleCoder, …). A chat prompt is a task. Jira is optional.

**Vault:** `~/SecondBrain/Second Brain` (quote the path).

Old name `ticket-loop` is an alias. Follow this file.

## When to run / skip

Run when the user wants something **done** in a workspace: implement, fix, refactor, add, wire, review-and-change.

Skip: factual questions, “what is X”, read-only explanation with no change.

## 0 Optional: branch

| Signal | Action |
|--------|--------|
| Jira key/URL/summary **and** `jira-branch-workflow` skill exists | Run it before step 1 |
| Else | Stay on current branch |

## Resolve project context

1. Repo path = workspace root or `git rev-parse --show-toplevel`.
2. Project name = Agentic OS registered name if known, else folder basename.
3. Brain: `<vault>/wiki/projects/<name>/` — `overview.md`, `glossary.md`, `gotchas.md`, `subsystems.md` if they exist.
4. Graph: `<repo>/graphify-out/` if present — prefer `wiki/index.md`, then `graph.json`.

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Missing wiki or graph: skip that layer. Do not invent a pd-style k8s/Pest flow for a Swift/JS/other repo.

## 1 Intent

Capture what done looks like (ticket fields, or the prompt itself). Observable success criteria **before** acting.

**Non-trivial work:** write gates per `unlazy` before Act. Skip typo/rename/comment-only one-liners.

## 1.5 Grill (domain language)

Invoke `grill-with-docs` when vocabulary is fuzzy or the change is a new behavior / cross-subsystem design.

Skip: literal file/line in a stack trace, obvious one-liner, glossary already covers every term in the success criteria.

## 2 Triage

Pick ONE path:

| Signal | Tool |
|--------|------|
| Literal in stack trace, log, config, env, path | Grep / Glob / Read |
| Cross-service / unknown subsystem **and** graphify-out exists | Extract 1–3 class/method symbols, then `graphify explain` → `path` → `query` |
| Domain rule / prior lesson | Brain `glossary.md` + `gotchas.md` + `subsystems.md` |

No graph → grep. Never seed graphify with symptom sentences or ticket keys.

## 3 Act (ponytail)

Ponytail ladder. Smallest reversible diff. Root cause once in the shared function.

Project conventions still win (DTOs, layering) when the **current** repo’s rules say so. Do not import another repo’s stack.

Cheap failing test first when the project has an obvious unit/service test target; else one line why, then Act. Prefer no new test over a bad test.

## 4 Verify

1. If `unlazy` gates exist, those CHECKs **are** verify.
2. Else read `wiki/projects/<name>/overview.md` **Verify** section.
3. Else infer from **this** repo:

| Hint | Where |
|------|--------|
| Repo has `skill-k8s-local-dev` | k3d pod — never host Pest/pytest |
| `package.json` test script | that script |
| Swift / Xcode | project test target or README |
| Other | README / AGENTS.md |

Trivial one-liners need no test. Still do step 6 if code changed.

## 5 Repair

Failure = new context. Narrow diff. Re-triage if the assumption was wrong. Re-run the same CHECK.

**Stop when:** gates met, blocked, out of scope, or before destructive/unapproved ops.

## 6 Review

Code changed **and** `review-checklist` exists → run it on the **full branch/worktree diff**, not only the last commit.

No checklist skill → read the diff yourself before claiming done.

Skip for non-code work (wiki-only, answers).

## 7 Compound

Reusable insight **and** a project wiki exists → `compound-fix` → `wiki/projects/<name>/gotchas.md`.

Then `graphify update .` if this repo has a graph.

## Layers (do not invert)

| Owns | Skill |
|------|--------|
| Sequence | **this skill** |
| What to build | `ponytail` |
| When “done” is allowed | `unlazy` |
| Jira branch mapping | `jira-branch-workflow` (opt-in, pd-shaped) |
| Where tests run | **this project’s** Verify / overlay rules |

## Related

- `unlazy` — gates for substantial work
- `ticket-loop` — alias; do not fork a per-repo copy of this loop
- `grill-with-docs`, `compound-fix`, `ponytail`, `second-brain`
