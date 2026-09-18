import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { BRAIN_DIR } from '../config.js'
import {
  BrainGraphDto,
  BrainGraphEdgeDto,
  BrainGraphNodeDto,
  BrainIngestRequestDto,
  BrainPageDto,
  BrainQueryRequestDto,
  BrainQueryResultDto,
} from '../dto/brain.dto.js'
import { buildBrainGraph, readBrainPage } from '../services/brain-graph-service.js'
import {
  getBrainStatus,
  ingestToBrain,
  queryBrain,
  lintBrain,
  mirrorProjectsToBrain,
  scaffoldAllProjectWikiPages,
} from '../services/brain-service.js'
import type { CursorAgentEvent } from '../services/cursor-agent-runner.js'

export const brainRoutes = new Hono()

brainRoutes.get('/brain/status', (c) => {
  return c.json({ status: getBrainStatus().toJSON() })
})

brainRoutes.get('/brain/graph', (c) => {
  const built = buildBrainGraph(BRAIN_DIR)
  const graph = new BrainGraphDto(
    built.nodes.map(
      (node) => new BrainGraphNodeDto(node.id, node.label, node.layer, node.path, node.bytes),
    ),
    built.edges.map((edge) => new BrainGraphEdgeDto(edge.id, edge.source, edge.target)),
  )
  return c.json({ graph: graph.toJSON() })
})

brainRoutes.get('/brain/page', (c) => {
  const path = c.req.query('path')?.trim() ?? ''
  if (!path) return c.json({ error: 'Path is required' }, 400)
  try {
    const page = readBrainPage(BRAIN_DIR, path)
    return c.json({
      page: new BrainPageDto(page.path, page.title, page.layer, page.body, page.bytes).toJSON(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to read page'
    if (message === 'invalid path') return c.json({ error: message }, 400)
    if (message === 'not found' || message === 'not allowed') return c.json({ error: message }, 404)
    return c.json({ error: message }, 400)
  }
})

brainRoutes.post('/brain/query', async (c) => {
  const request = BrainQueryRequestDto.fromBody(await c.req.json())
  if (!request.question) {
    return c.json({ error: 'Question is required' }, 400)
  }

  return streamSSE(c, async (stream) => {
    const send = (event: CursorAgentEvent) =>
      stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
    try {
      const answer = await queryBrain(request.question, (e) => void send(e))
      await stream.writeSSE({
        event: 'result',
        data: JSON.stringify(new BrainQueryResultDto(request.question, answer).toJSON()),
      })
    } catch (e) {
      await send({ type: 'error', message: e instanceof Error ? e.message : 'Query failed' })
    }
  })
})

brainRoutes.post('/brain/ingest', async (c) => {
  const request = BrainIngestRequestDto.fromBody(await c.req.json())
  if (!request.url && !request.path) {
    return c.json({ error: 'Provide a url or a path' }, 400)
  }

  return streamSSE(c, async (stream) => {
    const send = (event: CursorAgentEvent) =>
      stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
    try {
      const summary = await ingestToBrain(request, (e) => void send(e))
      await send({ type: 'done', message: summary })
    } catch (e) {
      await send({ type: 'error', message: e instanceof Error ? e.message : 'Ingest failed' })
    }
  })
})

brainRoutes.post('/brain/lint', async (c) => {
  return streamSSE(c, async (stream) => {
    const send = (event: CursorAgentEvent) =>
      stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
    try {
      const report = await lintBrain((e) => void send(e))
      await send({ type: 'done', message: report })
    } catch (e) {
      await send({ type: 'error', message: e instanceof Error ? e.message : 'Lint failed' })
    }
  })
})

brainRoutes.post('/brain/mirror-projects', async (c) => {
  try {
    const result = await mirrorProjectsToBrain()
    return c.json({ result: result.toJSON() })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Mirror failed' }, 400)
  }
})

brainRoutes.post('/brain/scaffold-projects', (c) => {
  try {
    const result = scaffoldAllProjectWikiPages()
    return c.json({ result: result.toJSON() })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Scaffold failed' }, 400)
  }
})
