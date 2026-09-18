import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { STORE_DIR } from '../config.js'
import { getDb } from '../db/index.js'
import { enqueueGraphJob } from './graph-runner.js'
import { lintBrain } from './brain-service.js'
import { ensureRegisteredProjectGitignores, isProjectBusy } from './project-hygiene-service.js'
import { tickMorningMix } from './mix-runner.js'
import { listProjects } from './project-service.js'
import { checkStaleProjects } from './stale-checker.js'

const BRAIN_LINT_MARKER = join(STORE_DIR, '.brain-last-lint')
const BRAIN_LINT_INTERVAL_HOURS = 24

function checkBrainLint(): void {
  if (process.env.AGENTIC_BRAIN_LINT !== '1') return

  if (existsSync(BRAIN_LINT_MARKER)) {
    const last = hoursSince(readFileSync(BRAIN_LINT_MARKER, 'utf-8').trim())
    if (last != null && last < BRAIN_LINT_INTERVAL_HOURS) return
  }

  writeFileSync(BRAIN_LINT_MARKER, new Date().toISOString())
  void lintBrain(() => {}).catch(() => {})
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  return ms / (1000 * 60 * 60)
}

export function runSchedulerTasks(): void {
  checkStaleProjects()
  checkBrainLint()
  ensureRegisteredProjectGitignores()
  tickMorningMix()

  const db = getDb()
  for (const project of listProjects()) {
    if (isProjectBusy(project.id)) continue

    if (project.autoRebuild && project.sourceType === 'local' && project.graphStatus === 'stale') {
      enqueueGraphJob(project.id, 'update')
      db.prepare("UPDATE projects SET last_scheduled_at = datetime('now') WHERE id = ?").run(project.id)
      continue
    }

    if (!project.rebuildIntervalHours || project.rebuildIntervalHours <= 0) continue
    if (project.graphStatus === 'building' || project.graphStatus === 'pending') continue
    if (project.sourceType === 'github' && !project.githubUrl) continue

    const anchor = project.lastScheduledAt ?? project.lastBuiltAt ?? project.createdAt
    const elapsed = hoursSince(anchor)
    if (elapsed == null || elapsed < project.rebuildIntervalHours) continue

    enqueueGraphJob(project.id, project.sourceType === 'github' ? 'full' : 'update')
    db.prepare("UPDATE projects SET last_scheduled_at = datetime('now') WHERE id = ?").run(project.id)
  }
}

export function startScheduler(intervalMs = 60_000): NodeJS.Timeout {
  runSchedulerTasks()
  return setInterval(() => runSchedulerTasks(), intervalMs)
}
