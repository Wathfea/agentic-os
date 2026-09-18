import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  cpSync,
} from 'node:fs'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { GLOBAL_SKILLS_DIR, SEED_SKILLS_DIR } from '../config.js'
import { SkillDto, type SkillSource } from '../dto/skill.dto.js'
import { getDb } from '../db/index.js'

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  let name = ''
  let description = ''
  if (match) {
    for (const line of match[1].split('\n')) {
      const [key, ...rest] = line.split(':')
      const value = rest.join(':').trim().replace(/^["']|["']$/g, '')
      if (key.trim() === 'name') name = value
      if (key.trim() === 'description') description = value
    }
  }
  return { name, description }
}

function skillId(source: SkillSource, name: string, projectName?: string): string {
  const raw = projectName ? `${source}:${projectName}:${name}` : `${source}:${name}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function scanSkillDir(
  baseDir: string,
  source: SkillSource,
  writable: boolean,
  projectName: string | null = null,
): SkillDto[] {
  if (!existsSync(baseDir)) return []

  const skills: SkillDto[] = []
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillPath = join(baseDir, entry.name, 'SKILL.md')
    if (!existsSync(skillPath)) continue

    const content = readFileSync(skillPath, 'utf-8')
    const fm = parseFrontmatter(content)
    skills.push(
      new SkillDto(
        skillId(source, entry.name, projectName ?? undefined),
        fm.name || entry.name,
        source,
        skillPath,
        fm.description,
        projectName,
        writable,
      ),
    )
  }
  return skills
}

export function listSkills(): SkillDto[] {
  const skills: SkillDto[] = [
    ...scanSkillDir(SEED_SKILLS_DIR, 'seed', true),
    ...scanSkillDir(GLOBAL_SKILLS_DIR, 'global', true),
  ]

  const projects = getDb().prepare('SELECT name, path FROM projects').all() as Array<{
    name: string
    path: string
  }>

  for (const project of projects) {
    for (const sub of ['.agents/skills', '.cursor/skills']) {
      skills.push(
        ...scanSkillDir(join(project.path, sub), 'project', false, project.name),
      )
    }
  }

  const seen = new Set<string>()
  return skills.filter((s) => {
    if (seen.has(s.path)) return false
    seen.add(s.path)
    return true
  })
}

export function getSkillById(id: string): SkillDto | null {
  return listSkills().find((s) => s.id === id) ?? null
}

export function readSkillContent(id: string): string {
  const skill = getSkillById(id)
  if (!skill) throw new Error('Skill not found')
  return readFileSync(skill.path, 'utf-8')
}

export function writeSkillContent(id: string, content: string): void {
  const skill = getSkillById(id)
  if (!skill) throw new Error('Skill not found')
  if (!skill.writable) throw new Error('Skill is read-only')
  writeFileSync(skill.path, content, 'utf-8')
}

export function createSkill(name: string, description: string, body: string): SkillDto {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const dir = join(SEED_SKILLS_DIR, slug)
  if (existsSync(dir)) throw new Error('Skill already exists')

  mkdirSync(dir, { recursive: true })
  const content = `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`
  const skillPath = join(dir, 'SKILL.md')
  writeFileSync(skillPath, content, 'utf-8')

  return new SkillDto(skillId('seed', slug), name, 'seed', skillPath, description, null, true)
}

export function deleteSeedSkill(id: string): void {
  const skill = getSkillById(id)
  if (!skill || skill.source !== 'seed') throw new Error('Only seed skills can be deleted')
  const dir = join(SEED_SKILLS_DIR, skill.path.split('/').slice(-2, -1)[0]!)
  rmSync(dir, { recursive: true, force: true })
}

export function syncSeedToGlobal(): number {
  if (!existsSync(GLOBAL_SKILLS_DIR)) {
    mkdirSync(GLOBAL_SKILLS_DIR, { recursive: true })
  }

  let count = 0
  for (const entry of readdirSync(SEED_SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const src = join(SEED_SKILLS_DIR, entry.name)
    const dest = join(GLOBAL_SKILLS_DIR, entry.name)
    cpSync(src, dest, { recursive: true, force: true })
    count++
  }
  return count
}
