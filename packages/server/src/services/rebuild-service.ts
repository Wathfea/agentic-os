import type { GraphJobDto } from '../dto/graph-job.dto.js'
import { enqueueGraphJob } from './graph-runner.js'
import { isProjectBusy } from './project-hygiene-service.js'
import { listProjects } from './project-service.js'

export type RebuildAllSkipped = {
  projectId: string
  name: string
  reason: 'busy'
}

export function enqueueRebuildAllProjects(mode: 'full' | 'update' = 'full'): {
  queued: GraphJobDto[]
  skipped: RebuildAllSkipped[]
  queuedCount: number
  skippedCount: number
} {
  const queued: GraphJobDto[] = []
  const skipped: RebuildAllSkipped[] = []

  for (const project of listProjects()) {
    if (isProjectBusy(project.id)) {
      skipped.push({ projectId: project.id, name: project.name, reason: 'busy' })
      continue
    }

    const kind =
      project.sourceType === 'github' ? 'full' : mode === 'update' ? 'update' : 'full'
    queued.push(enqueueGraphJob(project.id, kind))
  }

  return {
    queued,
    skipped,
    queuedCount: queued.length,
    skippedCount: skipped.length,
  }
}
