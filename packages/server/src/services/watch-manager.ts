import { spawn, type ChildProcess } from 'node:child_process'
import { PATH_WITH_TOOLS } from '../config.js'
import { listProjects } from './project-service.js'

const watchers = new Map<string, ChildProcess>()

export function syncWatchers(): void {
  const projects = listProjects().filter((p) => p.autoRebuild && p.sourceType === 'local')

  for (const [projectId, child] of watchers) {
    if (!projects.some((p) => p.id === projectId)) {
      child.kill()
      watchers.delete(projectId)
    }
  }

  for (const project of projects) {
    if (watchers.has(project.id)) continue
    const child = spawn('graphify', ['watch', '.'], {
      cwd: project.path,
      env: { ...process.env, PATH: PATH_WITH_TOOLS },
      stdio: 'ignore',
      detached: false,
    })
    child.on('exit', () => watchers.delete(project.id))
    watchers.set(project.id, child)
  }
}

export function startWatchManager(intervalMs = 30_000): NodeJS.Timeout {
  syncWatchers()
  return setInterval(() => syncWatchers(), intervalMs)
}

export function stopAllWatchers(): void {
  for (const child of watchers.values()) {
    child.kill()
  }
  watchers.clear()
}
