import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENTIC_ROOT, BRAIN_DIR, BRAIN_DIR_DISPLAY } from '../config.js'
import { runCommand } from './shell.js'

const SYNC_HOOK_MARKER = '# agentic-os-graphify-sync'
const CURSOR_PATH_HINT_MARKER = 'agentic-os-graphify-path'
const CURSOR_CANONICAL_MARKER = 'agentic-os-graphify-canonical'
const CURSOR_PATH_HINT = `
<!-- ${CURSOR_PATH_HINT_MARKER} -->
Before any graphify command, ensure PATH includes ~/.local/bin:
export PATH="$HOME/.local/bin:$PATH"
`

function buildCanonicalGraphifyRule(): string {
  return `---
description: graphify knowledge graph - minimal stub; full workflow in task-loop skill
alwaysApply: true
---

<!-- ${CURSOR_CANONICAL_MARKER} -->

This project has a graphify knowledge graph at \`graphify-out/\`.

**Full dev workflow:** use the \`task-loop\` skill (Intent → Grill → Triage → Act → Verify → Compound). A prompt is a task; \`ticket-loop\` is an alias.

**Triage (grep vs graphify):**
- Literal in stack trace, log, config, or env → Grep/Glob/Read first
- Cross-service or unknown subsystem → extract class/method symbols, then \`graphify explain\` → \`path\` → symbol-seeded \`query\` (never ticket IDs or symptom sentences)
- Domain rule or prior lesson → brain \`wiki/projects/<name>/glossary.md\`, \`gotchas.md\`, and \`subsystems.md\`

If \`graphify-out/wiki/index.md\` exists, navigate it before wide graph queries.
After code edits: \`graphify update .\`

${CURSOR_PATH_HINT.trim()}
`
}

export function writeCanonicalGraphifyRule(
  projectPath: string,
  onLog?: (line: string) => void,
): void {
  const rulesDir = join(projectPath, '.cursor', 'rules')
  const rulePath = join(rulesDir, 'graphify.mdc')
  const content = buildCanonicalGraphifyRule()

  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true })
  }

  if (existsSync(rulePath)) {
    const existing = readFileSync(rulePath, 'utf-8')
    if (existing === content) {
      return
    }
  }

  writeFileSync(rulePath, content, 'utf-8')
  onLog?.('Wrote canonical graphify.mdc stub (defers to task-loop skill)')
}
export const GRAPHIFY_GITIGNORE_MARKER = '# agentic-os-graphify'

export const GRAPHIFY_GITIGNORE_LINES = ['graphify-out/']

const PROJECT_AGENTS_TEMPLATE = join(AGENTIC_ROOT, 'templates', 'project-AGENTS.md')

function slugifyProjectName(name: string): string {
  return name.replace(/\//g, '-')
}

function applyProjectTemplate(content: string, name: string): string {
  const slug = slugifyProjectName(name)
  return content
    .replaceAll('{{NAME}}', name)
    .replaceAll('{{SLUG}}', slug)
    .replaceAll('{{BRAIN_ROOT}}', BRAIN_DIR_DISPLAY)
}

export function writeProjectAgentsMd(
  projectPath: string,
  name: string,
  onLog?: (line: string) => void,
): void {
  const agentsPath = join(projectPath, 'AGENTS.md')
  if (existsSync(agentsPath) || !existsSync(PROJECT_AGENTS_TEMPLATE)) {
    return
  }

  const template = readFileSync(PROJECT_AGENTS_TEMPLATE, 'utf-8')
  writeFileSync(agentsPath, applyProjectTemplate(template, name), 'utf-8')
  onLog?.('Wrote AGENTS.md (task-loop + grill-with-docs workflow)')
}

export const GITIGNORE_HOOK_MARKER = '# agentic-os-graphify-gitignore'

function lineIgnoresEntry(line: string, entry: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return false
  if (entry.endsWith('/')) {
    const normalized = trimmed.replace(/^\//, '').replace(/\/$/, '')
    const entryNormalized = entry.replace(/^\//, '').replace(/\/$/, '')
    return (
      normalized === entryNormalized ||
      trimmed === entry ||
      trimmed.endsWith(`/${entryNormalized}/`) ||
      trimmed.endsWith(`/${entryNormalized}`)
    )
  }
  const normalized = trimmed.replace(/^\//, '')
  const entryNormalized = entry.replace(/^\//, '')
  return normalized === entryNormalized
}

function hasGitignoreEntry(lines: string[], entry: string): boolean {
  return lines.some((line) => lineIgnoresEntry(line, entry))
}

function hasAllAgenticGitignoreEntries(lines: string[]): boolean {
  return GRAPHIFY_GITIGNORE_LINES.every((entry) => hasGitignoreEntry(lines, entry))
}

export function ensureGraphifyOutIgnored(projectPath: string): boolean {
  const gitignorePath = join(projectPath, '.gitignore')
  const block = [GRAPHIFY_GITIGNORE_MARKER, ...GRAPHIFY_GITIGNORE_LINES].join('\n')

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${block}\n`, 'utf-8')
    return true
  }

  const content = readFileSync(gitignorePath, 'utf-8')
  const lines = content.split('\n')
  const hasMarker = content.includes(GRAPHIFY_GITIGNORE_MARKER)
  const missing = GRAPHIFY_GITIGNORE_LINES.filter((entry) => !hasGitignoreEntry(lines, entry))

  if (missing.length === 0 && hasMarker) {
    return false
  }

  const toAppend: string[] = []
  if (!hasMarker) {
    toAppend.push(GRAPHIFY_GITIGNORE_MARKER)
  }
  toAppend.push(...missing)

  if (toAppend.length === 0) {
    return false
  }

  const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n'
  appendFileSync(gitignorePath, `${separator}${toAppend.join('\n')}\n`, 'utf-8')
  return true
}

export function isGraphifyOutIgnored(projectPath: string): boolean {
  const gitignorePath = join(projectPath, '.gitignore')
  if (!existsSync(gitignorePath)) {
    return false
  }
  const content = readFileSync(gitignorePath, 'utf-8')
  return hasAllAgenticGitignoreEntries(content.split('\n'))
}

function gitignoreHookSnippet(projectPath: string, hookName: 'post-checkout' | 'post-merge'): string {
  const script = join(AGENTIC_ROOT, 'scripts', 'ensure-graphify-gitignore.sh')
  if (hookName === 'post-checkout') {
    return `\n${GITIGNORE_HOOK_MARKER}\n[ "$3" = "1" ] && "${script}" "${projectPath}"\n`
  }
  return `\n${GITIGNORE_HOOK_MARKER}\n"${script}" "${projectPath}"\n`
}

export function installAgenticGitignoreHooks(
  projectPath: string,
  onLog?: (line: string) => void,
): void {
  if (!existsSync(join(projectPath, '.git'))) {
    return
  }

  for (const hookName of ['post-checkout', 'post-merge'] as const) {
    const hookPath = join(projectPath, '.git', 'hooks', hookName)
    const snippet = gitignoreHookSnippet(projectPath, hookName)

    if (!existsSync(hookPath)) {
      writeFileSync(hookPath, `#!/bin/sh\n${snippet}`, { mode: 0o755 })
      onLog?.(`Installed ${hookName} gitignore hook`)
      continue
    }

    const content = readFileSync(hookPath, 'utf-8')
    if (!content.includes(GITIGNORE_HOOK_MARKER)) {
      appendFileSync(hookPath, snippet)
      onLog?.(`Appended gitignore guard to ${hookName} hook`)
    }
  }
}

export async function installAgenticHookWrapper(
  projectPath: string,
  alias: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const hookPath = join(projectPath, '.git', 'hooks', 'post-commit')
  const syncScript = join(AGENTIC_ROOT, 'scripts', 'graphify-post-commit.sh')
  const snippet = `\n${SYNC_HOOK_MARKER}\n"${syncScript}" "${alias}" "${projectPath}"\n`

  if (!existsSync(hookPath)) {
    onLog?.('No post-commit hook found; graphify hook install should create one first')
    return
  }

  const content = readFileSync(hookPath, 'utf-8')
  if (!content.includes(SYNC_HOOK_MARKER)) {
    appendFileSync(hookPath, snippet)
    onLog?.('Appended Agentic OS global sync to post-commit hook')
  }
}

export async function syncGlobalGraph(
  projectPath: string,
  alias: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const graphPath = join(projectPath, 'graphify-out', 'graph.json')
  if (!existsSync(graphPath)) {
    throw new Error(`Graph not found at ${graphPath}`)
  }
  await runCommand(
    'graphify',
    ['global', 'add', graphPath, alias],
    projectPath,
    onLog,
  )
}

export async function removeFromGlobalGraph(alias: string): Promise<void> {
  try {
    await runCommand('graphify', ['global', 'remove', alias], process.cwd())
  } catch {
  }
}

export async function writeGraphifyPython(
  projectPath: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const graphPath = join(projectPath, 'graphify-out', 'graph.json')
  if (!existsSync(graphPath)) {
    return
  }

  const script = `
import sys
from pathlib import Path
out = Path('graphify-out')
out.mkdir(parents=True, exist_ok=True)
out.joinpath('.graphify_python').write_text(sys.executable, encoding='utf-8')
print('Wrote graphify-out/.graphify_python')
`

  try {
    await runCommand('python3', ['-c', script], projectPath, onLog)
  } catch {
    try {
      await runCommand('uv', ['tool', 'run', 'graphifyy', 'python', '-c', script], projectPath, onLog)
    } catch {
      onLog?.('Could not write graphify-out/.graphify_python')
    }
  }
}

export function augmentGraphifyCursorRule(projectPath: string, onLog?: (line: string) => void): void {
  writeCanonicalGraphifyRule(projectPath, onLog)
}

export async function hardenGraphifyProject(
  projectPath: string,
  onLog?: (line: string) => void,
  projectName?: string,
): Promise<void> {
  if (ensureGraphifyOutIgnored(projectPath)) {
    onLog?.('Ensured graphify-out/ is listed in .gitignore')
  }
  if (projectName) {
    writeProjectAgentsMd(projectPath, projectName, onLog)
  }
  await writeGraphifyPython(projectPath, onLog)
  writeCanonicalGraphifyRule(projectPath, onLog)
}

export async function mirrorProjectToBrain(
  name: string,
  projectPath: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const script = join(AGENTIC_ROOT, 'scripts', 'brain-mirror.sh')
  if (!existsSync(script)) {
    return
  }
  try {
    await runCommand(
      'sh',
      [script, name, projectPath],
      projectPath,
      onLog,
      { AGENTIC_BRAIN_DIR: BRAIN_DIR },
    )
  } catch (e) {
    onLog?.(`Brain mirror skipped: ${e instanceof Error ? e.message : String(e)}`)
  }
}
