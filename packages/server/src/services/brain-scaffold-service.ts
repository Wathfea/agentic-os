import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENTIC_ROOT, BRAIN_DIR } from '../config.js'
import { BrainScaffoldResultDto } from '../dto/brain.dto.js'
import { listProjects } from './project-service.js'

const TEMPLATE_DIR = join(AGENTIC_ROOT, 'templates', 'project-wiki')
const TEMPLATE_FILES = ['README.md', 'overview.md', 'gotchas.md', 'subsystems.md', 'ticket-checklist.md'] as const
const GOTCHAS_EMPTY_SENTINEL = '_No gotchas filed yet'

function slugify(name: string): string {
  return name.replace(/\//g, '-')
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function applyTemplate(content: string, name: string, projectPath: string): string {
  const slug = slugify(name)
  return content
    .replaceAll('{{NAME}}', name)
    .replaceAll('{{SLUG}}', slug)
    .replaceAll('{{PATH}}', projectPath)
    .replaceAll('{{DATE}}', today())
}

function ensureIndexLink(name: string): boolean {
  const indexPath = join(BRAIN_DIR, 'index.md')
  if (!existsSync(indexPath)) {
    return false
  }

  const slug = slugify(name)
  const link = `- [[${slug}/overview]]`
  const content = readFileSync(indexPath, 'utf-8')
  if (content.includes(link) || content.includes(`[[${slug}/`)) {
    return false
  }

  const sectionMarker = '## Projects (dev wiki'
  const sectionIdx = content.indexOf(sectionMarker)
  if (sectionIdx === -1) {
    const appended = `${content.trimEnd()}\n\n## Projects (dev wiki — hand-edited)\n\n${link} - ${name}\n`
    writeFileSync(indexPath, appended, 'utf-8')
    return true
  }

  const nextSection = content.indexOf('\n## ', sectionIdx + 1)
  const before = content.slice(0, nextSection === -1 ? content.length : nextSection).trimEnd()
  const after = nextSection === -1 ? '' : content.slice(nextSection)
  writeFileSync(indexPath, `${before}\n${link} - ${name}\n${after}`, 'utf-8')
  return true
}

export function scaffoldProjectWiki(
  name: string,
  projectPath: string,
): { created: string[]; skipped: string[] } {
  const slug = slugify(name)
  const destDir = join(BRAIN_DIR, 'wiki', 'projects', slug)
  const created: string[] = []
  const skipped: string[] = []

  if (!existsSync(TEMPLATE_DIR)) {
    throw new Error(`Template directory missing: ${TEMPLATE_DIR}`)
  }

  mkdirSync(destDir, { recursive: true })

  for (const file of TEMPLATE_FILES) {
    const destPath = join(destDir, file)
    if (existsSync(destPath)) {
      skipped.push(file)
      continue
    }
    const template = readFileSync(join(TEMPLATE_DIR, file), 'utf-8')
    writeFileSync(destPath, applyTemplate(template, name, projectPath), 'utf-8')
    created.push(file)
  }

  ensureIndexLink(name)
  return { created, skipped }
}

export function scaffoldAllProjectWikis(): BrainScaffoldResultDto {
  const lines: string[] = []
  let projectsScaffolded = 0

  for (const project of listProjects()) {
    const result = scaffoldProjectWiki(project.name, project.path)
    if (result.created.length > 0) {
      projectsScaffolded++
      lines.push(`scaffolded: ${project.name} -> ${result.created.join(', ')}`)
    } else {
      lines.push(`skip: ${project.name} (all pages exist)`)
    }
  }

  return new BrainScaffoldResultDto(projectsScaffolded, lines.join('\n'))
}

export function isGotchasEmpty(projectName: string): boolean {
  const gotchasPath = join(BRAIN_DIR, 'wiki', 'projects', slugify(projectName), 'gotchas.md')
  if (!existsSync(gotchasPath)) {
    return true
  }
  const content = readFileSync(gotchasPath, 'utf-8')
  return content.includes(GOTCHAS_EMPTY_SENTINEL)
}

export function isDevWikiSeeded(projectName: string): boolean {
  const overviewPath = join(BRAIN_DIR, 'wiki', 'projects', slugify(projectName), 'overview.md')
  return existsSync(overviewPath)
}

export function listTemplateFiles(): string[] {
  if (!existsSync(TEMPLATE_DIR)) {
    return []
  }
  return readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.md'))
}
