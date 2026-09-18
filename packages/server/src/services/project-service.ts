import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CODE_ROOT, PROJECTS_STORE_DIR, STORE_DIR } from '../config.js'
import { getDb } from '../db/index.js'
import { ProjectDto } from '../dto/project.dto.js'
import { parseGitHubUrl } from './github-clone.js'
import { removeFromGlobalGraph, ensureGraphifyOutIgnored, writeProjectAgentsMd } from './graphify-hooks.js'
import { enqueueGraphJob } from './graph-runner.js'
import { ensureStoredProjectDir, removeStoredProject } from './project-store.js'
import { scaffoldProjectWikiPages } from './brain-service.js'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function isAllowedLocalPath(resolvedPath: string): boolean {
  if (!resolvedPath.startsWith(CODE_ROOT)) return false
  return resolvedPath !== CODE_ROOT
}

function isStoredProjectPath(resolvedPath: string): boolean {
  return resolvedPath.startsWith(`${PROJECTS_STORE_DIR}/`)
}

export function listProjects(): ProjectDto[] {
  const rows = getDb().prepare('SELECT * FROM projects ORDER BY name').all()
  return rows.map((row) => ProjectDto.fromRow(row as Record<string, unknown>))
}

export function getProject(id: string): ProjectDto | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id)
  if (!row) return null
  return ProjectDto.fromRow(row as Record<string, unknown>)
}

export function getProjectByPath(path: string): ProjectDto | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE path = ?').get(path)
  if (!row) return null
  return ProjectDto.fromRow(row as Record<string, unknown>)
}

export function addProject(input: {
  path: string
  name?: string
  alias?: string
}): { project: ProjectDto; jobId: string } {
  const resolvedPath = input.path
  if (!isAllowedLocalPath(resolvedPath) && !isStoredProjectPath(resolvedPath)) {
    throw new Error(`Path must be under ${CODE_ROOT}`)
  }
  if (!existsSync(resolvedPath)) {
    throw new Error('Path does not exist')
  }

  const existing = getProjectByPath(resolvedPath)
  if (existing) {
    throw new Error('Project already registered')
  }

  const folderName = basename(resolvedPath)
  const name = input.name ?? folderName
  let alias = input.alias ?? slugify(folderName)

  const db = getDb()
  let suffix = 0
  while (db.prepare('SELECT id FROM projects WHERE alias = ?').get(alias)) {
    suffix++
    alias = `${slugify(folderName)}-${suffix}`
  }

  const id = randomUUID()
  db.prepare(
    `INSERT INTO projects (id, name, path, alias, graph_status, source_type) VALUES (?, ?, ?, ?, 'pending', 'local')`,
  ).run(id, name, resolvedPath, alias)

  const project = getProject(id)!
  ensureGraphifyOutIgnored(resolvedPath)
  writeProjectAgentsMd(resolvedPath, name)
  try {
    scaffoldProjectWikiPages(name, resolvedPath)
  } catch {
  }
  const job = enqueueGraphJob(id, 'full')
  return { project, jobId: job.id }
}

export function addProjectFromGitHub(input: {
  url: string
  name?: string
  alias?: string
  branch?: string
}): { project: ProjectDto; jobId: string } {
  const { owner, repo } = parseGitHubUrl(input.url)
  const id = randomUUID()
  const storePath = ensureStoredProjectDir(id)
  const name = input.name ?? repo
  let alias = input.alias ?? slugify(`${owner}-${repo}`)

  const db = getDb()
  let suffix = 0
  while (db.prepare('SELECT id FROM projects WHERE alias = ?').get(alias)) {
    suffix++
    alias = `${slugify(`${owner}-${repo}`)}-${suffix}`
  }

  db.prepare(
    `INSERT INTO projects (
      id, name, path, alias, graph_status, source_type, github_url, github_branch,
      auto_rebuild, hooks_installed
    ) VALUES (?, ?, ?, ?, 'pending', 'github', ?, ?, 0, 0)`,
  ).run(id, name, storePath, alias, input.url.trim(), input.branch ?? null)

  const project = getProject(id)!
  ensureGraphifyOutIgnored(storePath)
  writeProjectAgentsMd(storePath, name)
  try {
    scaffoldProjectWikiPages(name, storePath)
  } catch {
  }
  const job = enqueueGraphJob(id, 'full')
  return { project, jobId: job.id }
}

export function removeProject(id: string): void {
  const project = getProject(id)
  if (!project) throw new Error('Project not found')

  void removeFromGlobalGraph(project.alias)
  if (project.sourceType === 'github') {
    removeStoredProject(project.id)
  }
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
}

export function updateProject(
  id: string,
  patch: { autoRebuild?: boolean; name?: string; rebuildIntervalHours?: number | null },
): ProjectDto {
  const project = getProject(id)
  if (!project) throw new Error('Project not found')

  if (patch.autoRebuild !== undefined) {
    if (project.sourceType === 'github' && patch.autoRebuild) {
      throw new Error('GitHub graph projects cannot enable file watch')
    }
    getDb()
      .prepare('UPDATE projects SET auto_rebuild = ? WHERE id = ?')
      .run(patch.autoRebuild ? 1 : 0, id)
  }
  if (patch.name !== undefined) {
    getDb().prepare('UPDATE projects SET name = ? WHERE id = ?').run(patch.name, id)
  }
  if (patch.rebuildIntervalHours !== undefined) {
    getDb()
      .prepare('UPDATE projects SET rebuild_interval_hours = ? WHERE id = ?')
      .run(patch.rebuildIntervalHours, id)
  }

  return getProject(id)!
}

export function getSavingsSummary(): {
  totalTokensSaved: number
  totalTokensUsed: number
  totalCostSavedUsd: number
  totalCostUsedUsd: number
} {
  const row = getDb()
    .prepare(
      `SELECT
        COALESCE(SUM(total_tokens_saved), 0) AS total_tokens_saved,
        COALESCE(SUM(total_tokens_used), 0) AS total_tokens_used,
        COALESCE(SUM(total_cost_saved_usd), 0) AS total_cost_saved_usd,
        COALESCE(SUM(total_cost_used_usd), 0) AS total_cost_used_usd
       FROM projects`,
    )
    .get() as Record<string, number>

  return {
    totalTokensSaved: Number(row.total_tokens_saved ?? 0),
    totalTokensUsed: Number(row.total_tokens_used ?? 0),
    totalCostSavedUsd: Number(row.total_cost_saved_usd ?? 0),
    totalCostUsedUsd: Number(row.total_cost_used_usd ?? 0),
  }
}
