---
type: entity
tags: [project, pd, publishdrive, work]
created: 2026-06-16
updated: 2026-09-15
sources: ["raw/my-work-portfolio.md"]
---

# PublishDrive (pd)

**Summary**: Primary day-to-day codebase — PublishDrive publishing platform monorepo at `/Users/perluszdavid/code/pd`. Work arrives via **Jira** (bugs + features).

## Stack

- **PHP** microservices (Composer, `PublishDrive\` / `publishdrive/*` libs), **Laravel 10**, legacy **Zend**
- **Python** services (Poetry): AI, import, preprocessors, store fetcher
- In-repo **JS**: Bootstrap 5, DaisyUI, Vue components, Chart.js; **Fumadocs** for API docs
- **Docker**, OpenSearch, mixed infrastructure

## Agentic OS

- Alias: `pd`
- Graphify mirror: [projects/pd](../../projects/pd/index.md)
- Dev wiki: [[pd/overview]], [[pd/glossary]], [[pd/distribution-api]], [[pd/gotchas]], [[pd/ticket-checklist]]
- Domain concept: [[book-manager]]

## Related

- [[pd/overview]]
- [[pd/glossary]]
- [[book-manager]]
- [[task-loop]]
