import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECTS_STORE_DIR } from '../config.js'

export function getStoredProjectPath(projectId: string): string {
  return join(PROJECTS_STORE_DIR, projectId)
}

export function ensureStoredProjectDir(projectId: string): string {
  const path = getStoredProjectPath(projectId)
  mkdirSync(path, { recursive: true })
  return path
}

export function copyGraphifyOut(sourceProjectPath: string, destProjectPath: string): void {
  const source = join(sourceProjectPath, 'graphify-out')
  const dest = join(destProjectPath, 'graphify-out')
  if (!existsSync(source)) {
    throw new Error('Graph build produced no graphify-out directory')
  }
  rmSync(dest, { recursive: true, force: true })
  cpSync(source, dest, { recursive: true })
}

export function removeStoredProject(projectId: string): void {
  rmSync(getStoredProjectPath(projectId), { recursive: true, force: true })
}
