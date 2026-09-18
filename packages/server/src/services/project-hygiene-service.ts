import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../db/index.js'
import { listProjects } from './project-service.js'
import { ensureGraphifyOutIgnored, installAgenticGitignoreHooks } from './graphify-hooks.js'

export function isProjectBusy(projectId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT id FROM graph_jobs
       WHERE project_id = ? AND status IN ('queued', 'running')
       ORDER BY rowid DESC LIMIT 1`,
    )
    .get(projectId)
  return Boolean(row)
}

export function ensureRegisteredProjectGitignores(): void {
  for (const project of listProjects()) {
    if (project.sourceType !== 'local') continue
    if (!existsSync(join(project.path, '.git'))) continue
    ensureGraphifyOutIgnored(project.path)
    installAgenticGitignoreHooks(project.path)
  }
}
