import { Hono } from 'hono'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanCodeDirectory } from '../services/code-scanner.js'
import {
  addProject,
  addProjectFromGitHub,
  getProject,
  listProjects,
  removeProject,
  updateProject,
} from '../services/project-service.js'
import { enqueueGraphJob, markProjectFresh } from '../services/graph-runner.js'
import { enqueueRebuildAllProjects } from '../services/rebuild-service.js'
import { parseGraphJson } from '../services/graph-metrics.js'
import { syncGlobalGraph } from '../services/graphify-hooks.js'

export const projectsRoutes = new Hono()

projectsRoutes.get('/code/scan', (c) => {
  const candidates = scanCodeDirectory().map((dto) => dto.toJSON())
  return c.json({ candidates })
})

projectsRoutes.get('/projects', (c) => {
  const projects = listProjects().map((p) => p.toJSON())
  return c.json({ projects })
})

projectsRoutes.post('/projects', async (c) => {
  const body = await c.req.json<{ path: string; name?: string; alias?: string }>()
  try {
    const result = addProject(body)
    return c.json({
      project: result.project.toJSON(),
      jobId: result.jobId,
    })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Add project failed' }, 400)
  }
})

projectsRoutes.post('/projects/clone', async (c) => {
  const body = await c.req.json<{ url: string; name?: string; alias?: string; branch?: string }>()
  if (!body.url?.trim()) {
    return c.json({ error: 'GitHub URL is required' }, 400)
  }
  try {
    const result = addProjectFromGitHub(body)
    return c.json({
      project: result.project.toJSON(),
      jobId: result.jobId,
    })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Clone failed' }, 400)
  }
})

projectsRoutes.get('/projects/:id', (c) => {
  const project = getProject(c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)
  return c.json({ project: project.toJSON() })
})

projectsRoutes.patch('/projects/:id', async (c) => {
  const body = await c.req.json<{
    autoRebuild?: boolean
    name?: string
    rebuildIntervalHours?: number | null
  }>()
  try {
    const project = updateProject(c.req.param('id'), body)
    return c.json({ project: project.toJSON() })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 400)
  }
})

projectsRoutes.delete('/projects/:id', (c) => {
  try {
    removeProject(c.req.param('id'))
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 400)
  }
})

projectsRoutes.post('/projects/:id/graph', async (c) => {
  const body = await c.req.json<{ mode?: 'full' | 'update' }>()
  const project = getProject(c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)

  const kind =
    project.sourceType === 'github'
      ? 'full'
      : body.mode === 'update'
        ? 'update'
        : 'full'
  const job = enqueueGraphJob(project.id, kind)
  return c.json({ job: job.toJSON() })
})

projectsRoutes.post('/projects/graph/rebuild-all', async (c) => {
  const body = (await c.req.json<{ mode?: 'full' | 'update' }>().catch(() => ({
    mode: undefined,
  }))) as { mode?: 'full' | 'update' }
  const mode = body.mode === 'update' ? 'update' : 'full'
  const result = enqueueRebuildAllProjects(mode)
  return c.json({
    queued: result.queued.map((job) => job.toJSON()),
    skipped: result.skipped,
    queuedCount: result.queuedCount,
    skippedCount: result.skippedCount,
  })
})

projectsRoutes.get('/projects/:id/graph/json', (c) => {
  const project = getProject(c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)

  const graphPath = join(project.path, 'graphify-out', 'graph.json')
  if (!existsSync(graphPath)) {
    return c.json({ error: 'Graph not built yet' }, 404)
  }

  try {
    const graph = parseGraphJson(project.path)
    return c.json({ graph: graph.toJSON() })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Invalid graph data' }, 500)
  }
})

projectsRoutes.get('/projects/:id/graph/report', (c) => {
  const project = getProject(c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)

  const reportPath = join(project.path, 'graphify-out', 'GRAPH_REPORT.md')
  if (!existsSync(reportPath)) {
    return c.json({ error: 'Report not found' }, 404)
  }
  return c.json({ content: readFileSync(reportPath, 'utf-8') })
})

projectsRoutes.get('/projects/:id/graph/html', (c) => {
  const project = getProject(c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)

  const htmlPath = join(project.path, 'graphify-out', 'graph.html')
  if (!existsSync(htmlPath)) {
    return c.json({ error: 'Graph HTML not found' }, 404)
  }

  return new Response(readFileSync(htmlPath), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})

projectsRoutes.post('/projects/:id/graph/hook-callback', async (c) => {
  const project = getProject(c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)

  try {
    await syncGlobalGraph(project.path, project.alias)
    markProjectFresh(project.id)
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 500)
  }
})
