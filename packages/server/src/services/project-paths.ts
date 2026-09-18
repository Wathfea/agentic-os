import { join } from 'node:path'
import type { ProjectDto } from '../dto/project.dto.js'

export function getGraphDir(project: Pick<ProjectDto, 'path'>): string {
  return join(project.path, 'graphify-out')
}

export function getGraphJsonPath(project: Pick<ProjectDto, 'path'>): string {
  return join(getGraphDir(project), 'graph.json')
}

export function getGraphReportPath(project: Pick<ProjectDto, 'path'>): string {
  return join(getGraphDir(project), 'GRAPH_REPORT.md')
}

export function getCursorWorkspace(project: ProjectDto): string {
  return project.path
}
