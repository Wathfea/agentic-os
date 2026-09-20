---
type: source
tags: [ai-coding, agents, loop-engineering, workflows, kilo]
created: 2026-06-17
updated: 2026-06-17
sources: ["raw/what-is-loop-engineering.md"]
url: "https://kilo.ai/articles/what-is-loop-engineering"
---

# What Is Loop Engineering? (source summary)

**Summary**: Kilo article defining "loop engineering" — designing the plan-act-observe-adjust feedback loops around AI coding agents, contrasting it with prompt engineering, and laying out patterns, risks, and best practices for teams.

## Key points

- **Definition**: Loop engineering is designing, operating, and improving the feedback loops that let an AI coding agent plan, change code, observe results, and revise until a task is done or blocked — treating software work as an iterative system rather than one-shot generation. (raw/what-is-loop-engineering.md)
- **Five-stage loop**: Intent → Context → Action → Observation → Adjustment.
- **Core AI coding loop (6 steps)**: Plan → Search → Modify → Verify → Repair → Summarize. The value is in *closing* the loop: a failing test/type error/review comment is new context, not just an error.
- **Loop vs prompt engineering**: prompt engineering shapes the model's *input* for a better first response; loop engineering shapes the *whole system* (tools, context, validation, stopping rules, human intervention) for a better final outcome.
- **What makes a good loop**: clear objectives, relevant (not excessive) context, small reversible actions, reliable observability, explicit stopping rules.
- **Patterns**: test-driven, compiler-driven, review-driven, runtime debugging, product iteration loops — each needs different feedback signals and stop points.
- **Failure modes**: thrashing (no convergence), overfitting to tests, context drift (stale assumptions), unsafe autonomy (destructive/unreviewed actions). Each maps back to a missing loop component.
- **Team angle**: repository instructions, branch/PR rules, safe defaults, standard prompts, trusted CI, clear ownership — so agent behavior is predictable across people and repos.
- **Best practices**: start narrow, tell the agent how to verify, prefer existing patterns, keep humans in the judgment seat, capture reusable loops.

## My take / why filed

Captured for later processing. Strong vocabulary fit with how agents already run (small diffs, verify-first, stopping rules) — see [[pd/ticket-checklist]]. The failure-mode taxonomy (thrashing, context drift, unsafe autonomy) is directly reusable as a checklist when supervising agents.

## Related

- [[loop-engineering]] — the concept page
- [[task-loop]] — the operational loop used here
- [[pd/ticket-checklist]]
- [[overview]]

## Source

- URL: https://kilo.ai/articles/what-is-loop-engineering — Arkadiy Kondrashov, Kilo, published 2026-06-10.
- Raw: `raw/what-is-loop-engineering.md`
