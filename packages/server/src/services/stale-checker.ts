import { statSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../db/index.js'
import { listProjects } from './project-service.js'

export function checkStaleProjects(): void {
  const db = getDb()
  for (const project of listProjects()) {
    if (project.sourceType === 'github') continue
    const graphPath = join(project.path, 'graphify-out', 'graph.json')
    try {
      const graphStat = statSync(graphPath)
      const gitHead = join(project.path, '.git', 'HEAD')
      const repoStat = statSync(gitHead)
      if (repoStat.mtimeMs > graphStat.mtimeMs && project.graphStatus === 'ready') {
        db.prepare("UPDATE projects SET graph_status = 'stale' WHERE id = ?").run(project.id)
      }
    } catch {
      // ignore missing files
    }
  }
}

export function startStaleChecker(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => checkStaleProjects(), intervalMs)
}
