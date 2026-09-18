import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { JobKind } from '../dto/graph-job.dto.js'
import { GraphDataDto } from '../dto/graph-job.dto.js'

const COST_PER_TOKEN = 0.000003

export function estimateBaselineTokens(nodeCount: number): number {
  return Math.max(5000, nodeCount * 80)
}

export function parseTokensFromLog(log: string): number {
  let tokensUsed = 0
  for (const match of log.matchAll(/(\d[\d,]*)\s*tokens?/gi)) {
    tokensUsed = Math.max(tokensUsed, Number(match[1]!.replace(/,/g, '')))
  }
  return tokensUsed
}

export function computeJobMetrics(input: {
  kind: JobKind
  log: string
  nodeCount: number
  usedLlm: boolean
}): {
  llmUsed: boolean
  tokensUsed: number
  tokensSaved: number
  costUsd: number
  costSavedUsd: number
} {
  const baseline = estimateBaselineTokens(input.nodeCount)
  let tokensUsed = parseTokensFromLog(input.log)
  const llmUsed = input.usedLlm && input.kind === 'full'

  if (llmUsed && tokensUsed === 0) {
    tokensUsed = Math.round(baseline * 0.6)
  }

  let tokensSaved = 0
  if (input.kind === 'update') {
    tokensSaved = baseline
  } else if (input.kind === 'full' && !input.usedLlm) {
    tokensSaved = baseline
  }

  return {
    llmUsed,
    tokensUsed,
    tokensSaved,
    costUsd: Number((tokensUsed * COST_PER_TOKEN).toFixed(6)),
    costSavedUsd: Number((tokensSaved * COST_PER_TOKEN).toFixed(6)),
  }
}

type RawNode = Record<string, unknown>
type RawEdge = Record<string, unknown>

function nodeId(node: RawNode, index: number): string {
  const id = node.id ?? node.name ?? node.label
  return id != null ? String(id) : `node-${index}`
}

function nodeLabel(node: RawNode, id: string): string {
  const label = node.label ?? node.name ?? node.title ?? node.id
  return label != null ? String(label) : id
}

function edgeEndpoint(edge: RawEdge, key: 'source' | 'target'): string | null {
  const value = edge[key] ?? edge[key === 'source' ? 'from' : 'to']
  if (value == null) return null
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return String(obj.id ?? obj.name ?? obj.label ?? '')
  }
  return String(value)
}

function rawLinks(raw: Record<string, unknown>): RawEdge[] {
  if (Array.isArray(raw.links)) return raw.links as RawEdge[]
  if (Array.isArray(raw.edges)) return raw.edges as RawEdge[]
  return []
}

function selectNodesByDegree(rawNodes: RawNode[], rawEdges: RawEdge[], maxNodes: number) {
  if (rawNodes.length <= maxNodes) {
    return rawNodes.map((node, index) => ({
      id: nodeId(node, index),
      label: nodeLabel(node, nodeId(node, index)),
      type: node.type ? String(node.type) : undefined,
    }))
  }

  const degree = new Map<string, number>()
  for (const edge of rawEdges) {
    const source = edgeEndpoint(edge, 'source')
    const target = edgeEndpoint(edge, 'target')
    if (source) degree.set(source, (degree.get(source) ?? 0) + 1)
    if (target) degree.set(target, (degree.get(target) ?? 0) + 1)
  }

  const ranked = rawNodes
    .map((node, index) => {
      const id = nodeId(node, index)
      return {
        id,
        label: nodeLabel(node, id),
        type: node.type ? String(node.type) : undefined,
        score: degree.get(id) ?? 0,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxNodes)

  return ranked.map(({ id, label, type }) => ({ id, label, type }))
}

export function parseGraphJson(projectPath: string): GraphDataDto {
  const graphPath = join(projectPath, 'graphify-out', 'graph.json')
  const raw = JSON.parse(readFileSync(graphPath, 'utf-8')) as Record<string, unknown>

  const rawNodes = Array.isArray(raw.nodes) ? (raw.nodes as RawNode[]) : []
  const rawEdges = rawLinks(raw)
  const nodes = selectNodesByDegree(rawNodes, rawEdges, 400)
  const nodeIds = new Set(nodes.map((node) => node.id))

  const edges = rawEdges
    .slice(0, 2000)
    .map((edge, index) => {
      const source = edgeEndpoint(edge, 'source')
      const target = edgeEndpoint(edge, 'target')
      if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) {
        return null
      }
      const relation = edge.relation ? String(edge.relation) : edge.label ? String(edge.label) : edge.type ? String(edge.type) : undefined
      return {
        id: edge.id ? String(edge.id) : `edge-${index}`,
        source,
        target,
        label: relation,
      }
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null)

  return new GraphDataDto(nodes, edges, rawNodes.length, rawEdges.length)
}
