---
type: synthesis
tags: [pd, project]
created: 2026-06-16
updated: 2026-09-15
sources: ["raw/my-work-portfolio.md"]
---

# pd overview

**Summary**: [[publishdrive-pd]] — publishing platform monorepo; day-to-day work is Jira tickets (bugs + features). Code orientation via Graphify; durable patterns live here.

## Repo

- Path: `/Users/perluszdavid/code/pd`
- Entity page: [[publishdrive-pd]]
- Agent rules: `AGENTS.md` and `.cursor/rules/graphify.mdc` in the repo

## Stack (high level)

- PHP microservices + Laravel 10 + legacy Zend (`publishdrive/*` Composer libs)
- Python services (Poetry): AI, import, preprocessors
- In-repo JS: Bootstrap 5, DaisyUI, Vue (TinyMCE), Chart.js
- Docker, OpenSearch, mixed infra

## Verify

Run pest/pytest/composer inside the k3d service pod (namespace `local`), not on the host. See repo `.cursor/rules/skill-k8s-local-dev.mdc`.

## How we work

Follow the global [[task-loop]] skill (`ticket-loop` is an alias). A prompt is a task; Jira is optional. Do not keep a pd fork of the loop.

1. **Branch** (Jira only): `jira-branch-workflow` — hotfix from `master`, feature from `develop`. Skip if the user just prompted work.
2. Intent from ticket or prompt. Non-trivial: `unlazy` gates (CHECK = Pest/pytest in k3d).
3. **Grill** (when terms are fuzzy): `grill-with-docs` → [[pd/glossary]]; skip for literal stack traces.
4. Triage: literals → grep; structure → graphify with symbol seeds; domain → [[pd/glossary]] + [[pd/gotchas]] + [[pd/subsystems]].
5. Fix (ponytail); verify with **Pest/pytest in k3d pod** per section above.
6. **Review** — `review-checklist` on full branch diff when code changed.
7. If reusable: append to [[pd/gotchas]]; `graphify update .` — see [[pd/ticket-checklist]].

Naming: see [[pd/conventions]] (`*Service` + `*ServiceInterface`, not `*Resolver` for domain logic).

## Subsystems (bootstrap — verify with graphify)

See [[pd/subsystems]] for entry symbols. Quick hints:

| Area | Hint path |
|------|-----------|
| Book manager | `apps/book_service/src/Domain/Service/BookManagerService.php` |
| Validation rules | `apps/book_service/src/Domain/Rules/BookManagerRules.yaml` |
| DTOs | `apps/book_service/src/Domain/DTO/` |
| Distribution API | [[pd/distribution-api]] — public `/v2/distribution`; withdraw = unpublish |

## Related

- [[book-manager]]
- [[pd/distribution-api]]
- [[pd/gotchas]]
- [[pd/glossary]]
- [[pd/conventions]]
- [[pd/ticket-checklist]]
- [[task-loop]]
