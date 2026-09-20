---
type: concept
tags: [ai-coding, agents, loop-engineering, workflows]
aliases: [AI coding feedback loops, plan-act-verify loop, agentic loops]
created: 2026-06-17
updated: 2026-09-15
sources: ["raw/what-is-loop-engineering.md"]
---

# Loop Engineering

**Summary**: The discipline of designing and improving the feedback loops (plan → act → observe → adjust) around AI coding agents, so software work becomes verified iteration rather than one-shot generation.

## What it is

Loop engineering structures AI-assisted development around repeated cycles of action and feedback. The agent does not just answer once; it uses evidence from the codebase and validation tools to improve its next step. (See [[what-is-loop-engineering]].)

A basic loop: **Intent → Context → Action → Observation → Adjustment**.

The core AI coding loop, in practice: **Plan → Search → Modify → Verify → Repair → Summarize**. The value comes from closing the loop — a failing test, type error, or review comment becomes new context for the next action.

## Loop engineering vs prompt engineering

- **Prompt engineering** shapes the model's *input* for a better first response.
- **Loop engineering** shapes the *whole system* around the model (tools, context, validation, stopping rules, human checkpoints) for a better final outcome.

They are complementary: good prompts improve the first plan; loop engineering assumes the first answer may be incomplete and designs the workflow to improve from there.

## Ingredients of a good loop

- **Clear objectives** — observable success criteria, scope, constraints, validation commands.
- **Relevant context** — enough to explain how the project works, not enough to drown the model.
- **Small reversible actions** — smallest coherent diff, easy to verify and repair.
- **Reliable observability** — tests, type/lint checks, builds, logs, screenshots, review comments.
- **Stopping rules** — stop when validation passes, on blockers, before destructive/unapproved actions, or when out of scope.

## Patterns

- **Test-driven loop** — reproduce/encode behavior, confirm failure, smallest fix, rerun.
- **Compiler-driven loop** — use the type checker's errors as a precise repair list (great for migrations/refactors).
- **Review-driven loop** — human comments become the observation source; treat comments as requirements, not blind edits.
- **Runtime debugging loop** — hypothesis → targeted change/inspection → observe logs/traces/screenshots → update.
- **Product iteration loop** — iterate copy, UI states, edge cases, responsive/accessibility checks.

## Failure modes (supervision checklist)

- **Thrashing** — changes without converging → narrow objective, shrink diff, better signal.
- **Overfitting to tests** — tests pass but requirement missed → add requirement/manual review.
- **Context drift** — working from stale assumptions → refresh context after observations.
- **Unsafe autonomy** — destructive/unreviewed actions → permissioning, scoped tools, human approval.

## Relevance to my work

Mirrors how agents already run on [[publishdrive-pd]]: small diffs, verify-first, explicit stop conditions. The failure-mode taxonomy is a ready-made supervision checklist. The operational sequence is [[task-loop]] (alias `ticket-loop`); [[pd/ticket-checklist]] is the pd-shaped checklist that follows that global loop, not a fork of it.

## Related

- [[what-is-loop-engineering]] — source summary
- [[task-loop]] — the operational loop used in every repo
- [[task-loop-skill]] — skill snapshot
- [[pd/ticket-checklist]]
- [[overview]]
