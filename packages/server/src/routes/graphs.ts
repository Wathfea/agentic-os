import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { existsSync } from 'node:fs'
import { GLOBAL_GRAPH_PATH } from '../config.js'
import { GraphQueryResultDto, GlobalGraphEntryDto } from '../dto/system.dto.js'
import { runCursorAgentAsk } from '../services/cursor-agent-runner.js'
import { getProject } from '../services/project-service.js'
import { getCursorWorkspace, getGraphJsonPath } from '../services/project-paths.js'
import { runCommandSafe } from '../services/shell.js'

export const graphsRoutes = new Hono()

async function resolveGraphQuery(input: {
  question: string
  scope?: 'project' | 'global'
  projectId?: string
}): Promise<{ output: string; scopeLabel: string; workspace: string }> {
  let graphArg: string[] = []
  let cwd = process.cwd()
  let scopeLabel = 'global'
  let workspace = process.cwd()

  if (input.scope === 'project' && input.projectId) {
    const project = getProject(input.projectId)
    if (!project) throw new Error('Project not found')
    const graphPath = getGraphJsonPath(project)
    if (!existsSync(graphPath)) {
      throw new Error('Project graph not built yet')
    }
    graphArg = ['--graph', graphPath]
    cwd = project.path
    scopeLabel = project.alias
    workspace = getCursorWorkspace(project)
  } else if (existsSync(GLOBAL_GRAPH_PATH)) {
    graphArg = ['--graph', GLOBAL_GRAPH_PATH]
  }

  const output = await runCommandSafe(
    'graphify',
    ['query', input.question, ...graphArg],
    cwd,
  )

  return { output, scopeLabel, workspace }
}

graphsRoutes.post('/graph/query', async (c) => {
  const body = await c.req.json<{
    question: string
    scope?: 'project' | 'global'
    projectId?: string
  }>()

  if (!body.question?.trim()) {
    return c.json({ error: 'Question is required' }, 400)
  }

  try {
    const { output, scopeLabel } = await resolveGraphQuery(body)
    const dto = new GraphQueryResultDto(body.question, scopeLabel, output)
    return c.json({ result: dto.toJSON() })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Query failed' }, 400)
  }
})

graphsRoutes.post('/graph/cursor-ask', async (c) => {
  const body = await c.req.json<{
    question: string
    scope?: 'project' | 'global'
    projectId?: string
  }>()

  if (!body.question?.trim()) {
    return c.json({ error: 'Question is required' }, 400)
  }

  if (body.scope === 'project' && !body.projectId) {
    return c.json({ error: 'Project is required for Cursor ask' }, 400)
  }

  return streamSSE(c, async (stream) => {
    const send = async (event: Record<string, unknown>) => {
      await stream.writeSSE({
        event: String(event.type ?? 'log'),
        data: JSON.stringify(event),
      })
    }

    try {
      await send({ type: 'boot', message: 'LINKING GRAPH MEMORY...' })
      const { output, workspace } = await resolveGraphQuery(body)
      await send({ type: 'graph', message: output.slice(0, 4000) })

      let answer = ''
      answer = await runCursorAgentAsk({
        question: body.question,
        workspace,
        graphContext: output,
        onEvent: async (event) => {
          await send(event)
        },
      })

      await send({ type: 'done', message: answer })
    } catch (e) {
      await send({ type: 'error', message: e instanceof Error ? e.message : 'Cursor ask failed' })
    }
  })
})

graphsRoutes.get('/graph/global', async (c) => {
  const output = await runCommandSafe('graphify', ['global', 'list'], process.cwd())
  const entries: GlobalGraphEntryDto[] = []

  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('No ')) continue
    const match = trimmed.match(/^(\S+)\s+(\d+)\s+nodes?\s+(\d+)\s+edges?/i)
    if (match) {
      entries.push(
        new GlobalGraphEntryDto(match[1]!, Number(match[2]), Number(match[3])),
      )
      continue
    }
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 1) {
      entries.push(new GlobalGraphEntryDto(parts[0]!, 0, 0))
    }
  }

  return c.json({ entries: entries.map((e) => e.toJSON()), raw: output })
})
