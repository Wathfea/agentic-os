import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AGENTIC_ROOT } from '../config.js'
import {
  LoopHealthDto,
  LoopHealthProjectDto,
  LoopHealthSummaryDto,
} from '../dto/system.dto.js'
import { isDevWikiSeeded, isGotchasEmpty } from './brain-scaffold-service.js'
import { isGraphifyOutIgnored } from './graphify-hooks.js'
import { parseGraphJson } from './graph-metrics.js'
import { listProjects } from './project-service.js'
import type { ProjectDto } from '../dto/project.dto.js'

function graphAgeHours(project: ProjectDto): number | null {
  const graphPath = join(project.path, 'graphify-out', 'graph.json')
  if (!existsSync(graphPath)) {
    return null
  }
  try {
    const graphStat = statSync(graphPath)
    const gitHead = join(project.path, '.git', 'HEAD')
    const repoStat = statSync(gitHead)
    const deltaMs = repoStat.mtimeMs - graphStat.mtimeMs
    return deltaMs > 0 ? deltaMs / (1000 * 60 * 60) : 0
  } catch {
    return null
  }
}

function isGraphStale(project: ProjectDto): boolean {
  const age = graphAgeHours(project)
  return age != null && age > 0
}

function hasGraphWiki(project: ProjectDto): boolean {
  return existsSync(join(project.path, 'graphify-out', 'wiki', 'index.md'))
}

function brainLintAgeHours(): number | null {
  const path = join(AGENTIC_ROOT, 'store', '.brain-last-lint')
  if (!existsSync(path)) {
    return null
  }
  try {
    const iso = readFileSync(path, 'utf-8').trim()
    const ms = Date.now() - new Date(iso).getTime()
    if (Number.isNaN(ms)) return null
    return ms / (1000 * 60 * 60)
  } catch {
    return null
  }
}

function buildProjectHealth(project: ProjectDto): LoopHealthProjectDto {
  let nodeCount = project.graphNodeCount
  try {
    if (existsSync(join(project.path, 'graphify-out', 'graph.json'))) {
      nodeCount = parseGraphJson(project.path).nodeCount
    }
  } catch {
  }

  return new LoopHealthProjectDto(
    project.id,
    project.name,
    project.alias,
    project.graphStatus,
    nodeCount,
    graphAgeHours(project),
    isGraphStale(project),
    hasGraphWiki(project),
    isDevWikiSeeded(project.name),
    isGotchasEmpty(project.name),
    project.autoRebuild,
    isGraphifyOutIgnored(project.path),
  )
}

export function getLoopHealth(): LoopHealthDto {
  const projects = listProjects().map(buildProjectHealth)
  const staleCount = projects.filter((p) => p.graphStale).length
  const emptyGotchasCount = projects.filter((p) => p.gotchasEmpty).length
  const missingWikiCount = projects.filter((p) => !p.graphWikiPresent).length

  const summary = new LoopHealthSummaryDto(
    projects.length,
    staleCount,
    emptyGotchasCount,
    missingWikiCount,
    brainLintAgeHours(),
  )

  return new LoopHealthDto(summary, projects)
}
