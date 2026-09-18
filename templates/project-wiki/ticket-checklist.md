---
type: synthesis
tags: [{{SLUG}}, workflow]
created: {{DATE}}
updated: {{DATE}}
---

# {{NAME}} ticket checklist

**Summary**: Copy-paste workflow for tasks on {{NAME}}.

## Per ticket

- [ ] Task key + summary + repro in chat
- [ ] **Grill** if domain language is ambiguous → [[{{SLUG}}/glossary]] (`grill-with-docs`); else skim glossary for term conflicts
- [ ] Triage: literal in stack trace → grep; else extract 1–3 class/method symbols → `graphify explain` / `path` / seeded `query`; no symptom sentences as graph seeds
- [ ] Read brain `glossary.md` + `gotchas.md` + `subsystems.md` when no symbol anchor
- [ ] Fix + verify (see [[{{SLUG}}/overview#Verify]])
- [ ] `graphify update .`
- [ ] **Worth filing?** → [[{{SLUG}}/gotchas]] via compound-fix; else skip

## Worth filing when

- Domain rule the task did not explain
- Same area broke before
- Dead-end approach (A failed, B worked)
- Non-obvious edge case

## Skip filing when

- Typo, rename, formatting
- Fully described in ticket + obvious code change
- One-off env/local config

## Related

- [[{{SLUG}}/overview]]
- [[{{SLUG}}/glossary]]
- [[{{SLUG}}/gotchas]]
