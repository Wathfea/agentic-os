---
name: unlazy
description: >
  Completion discipline for substantial work in any repo: write observable
  acceptance gates before Act, run a CHECK that can fail, report only what
  evidence supports. Use on multi-file work, half-done returns, /unlazy,
  "gates", "tree N", "do not stop until it is done". Skip trivial one-liners.
  Adapted from Leonxlnx/unlazy for task-loop + ponytail.
---

# Unlazy

Make incomplete work visible. Prove outcomes against gates. Do not claim done on confidence.

**Source:** [Leonxlnx/unlazy](https://github.com/Leonxlnx/unlazy) — adapted. Upstream orchestration, `gate-check.mjs`, `.unlazy/` pipelines, and Claude Stop hook are **out**.

Works with `task-loop` in **any** project. Not pd-only. CHECK is whatever proves the outcome **here**.

## When

After task-loop **1 Intent**, before **3 Act**, when **any** of:

- Multi-file, cross-module, or several independently omittable outcomes
- Work returned half-done or “should work”
- User says `/unlazy`, `gates`, `tree N`, `do not stop until it is done`

Skip: typo, rename, comment-only, formatting, factual reply, single obvious guard.

## Coexistence (do not invert)

| Owns | Skill |
|------|--------|
| Sequence | `task-loop` |
| What to build | `ponytail` (YAGNI, smallest diff) |
| Where tests run | **this repo** — wiki `## Verify`, overlay rules, or inferred stack |
| When “done” is allowed | **this skill** |

Ponytail still forbids extra abstractions and polish loops. Unlazy forbids a done report while a required gate is unmet. Upstream four-pass “replace the cheap version” is **forbidden**.

Do **not** assume kubectl, Pest, or a k3d pod unless **this** repo’s rules/wiki say so.

## Write gates before Act

One observable outcome per independently omittable constraint. Session-local (TodoWrite or chat). **Do not** commit `GATES.md` or `.unlazy/`.

```text
G1: <observable outcome>
  CHECK: <command that proves it in THIS repo>
  EXPECT: <success-only token the command actually prints>
  EVIDENCE: pending
```

Runnable gate = `CHECK:` + `EXPECT:`. Manual gate only when no command can decide (review-checklist, visual check).

Resolve CHECK in order:

1. `wiki/projects/<name>/overview.md` **Verify** section
2. Current repo overlay (e.g. pd `skill-k8s-local-dev` → exec in the `local` pod)
3. Inferred stack (`package.json` test script, Xcode test, README)
4. The smallest command **you** would run to know the gate failed

Authoring:

- CHECK reads the artifact named by the outcome
- EXPECT is a success-only marker the command prints after assertions pass — not a copied number as its own proof
- Absence checks need a known positive control
- Cheap failing test before the production change when the target is obvious; else one line why, then Act

## Execute

1. Implement the complete deliverable (ponytail). No placeholders for a required gate.
2. Run each CHECK fresh. Read exit code and output. Record EVIDENCE from this run.
3. Unmet → task-loop **5 Repair**. Re-run the same CHECK.
4. Manual review gate if `review-checklist` exists and code changed.
5. Blocked or out of scope → `ABANDON: <reason>`. Handoff, **not** success. Do not delete the gate.

## Report

Re-read the original request. Report met / unmet / abandoned with ids (`G1`, `G2`). No done report while a required gate is unmet, abandoned, deferred, or waiting on an owner.

## Do not import from upstream

- `node …/gate-check.mjs`, `~/.unlazy/approved`, `--approve`
- `.unlazy/<scope>/` PLAN + leaf ledgers + dispatch waves
- Claude Code Stop hook / `install-hooks.mjs`
- Depth Tree fan-out that multiplies effort per leaf
- Copying another project’s test runner into this one
