import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

export type BrainGraphLayer = 'index' | 'overview' | 'sources' | 'entities' | 'concepts' | 'projects'

export type BrainGraphNodeRecord = {
  id: string
  label: string
  layer: BrainGraphLayer
  path: string
  bytes: number
}

export type BrainGraphEdgeRecord = {
  id: string
  source: string
  target: string
}

export type BrainPageRecord = {
  path: string
  title: string
  layer: BrainGraphLayer
  body: string
  bytes: number
}

export function parseWikilinkTargets(content: string): string[] {
  const out: string[] = []
  for (const match of content.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    let raw = (match[1] ?? '').trim()
    const pipe = raw.indexOf('|')
    if (pipe >= 0) raw = raw.slice(0, pipe).trim()
    const hash = raw.indexOf('#')
    if (hash >= 0) raw = raw.slice(0, hash).trim()
    if (raw) out.push(raw.replaceAll('\\', '/'))
  }
  return out
}

export function layerForPath(rel: string): BrainGraphLayer | null {
  if (rel === 'index.md') return 'index'
  if (rel === 'wiki/overview.md') return 'overview'
  if (rel.startsWith('wiki/sources/')) return 'sources'
  if (rel.startsWith('wiki/entities/')) return 'entities'
  if (rel.startsWith('wiki/concepts/')) return 'concepts'
  if (rel.startsWith('wiki/projects/')) return 'projects'
  return null
}

function toPosix(rel: string): string {
  return rel.split(sep).join('/')
}

function fileLabel(rel: string): string {
  const base = rel.split('/').pop() ?? rel
  return base.replace(/\.md$/, '')
}

function shouldSkipRel(rel: string): boolean {
  const base = rel.split('/').pop() ?? rel
  if (base === 'README.md') return true
  if (base === 'index.md' && rel !== 'index.md') return true
  if (rel.startsWith('wiki/handoffs/')) return true
  return false
}

function resolveRealVaultRoot(vaultRoot: string): string {
  return existsSync(vaultRoot) ? realpathSync(vaultRoot) : resolve(vaultRoot)
}

function isRealPathInsideVault(realVaultRoot: string, fullPath: string): boolean {
  if (!existsSync(fullPath)) return false
  const real = realpathSync(fullPath)
  const rel = toPosix(relative(realVaultRoot, real))
  return !rel.startsWith('../') && rel !== '..'
}

function listCandidateFiles(vaultRoot: string, realVaultRoot: string): string[] {
  const out: string[] = []
  const indexPath = join(vaultRoot, 'index.md')
  if (existsSync(indexPath) && isRealPathInsideVault(realVaultRoot, indexPath)) out.push(indexPath)
  const wikiDir = join(vaultRoot, 'wiki')
  if (!existsSync(wikiDir)) return out
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue
      const full = join(dir, entry.name)
      if (!isRealPathInsideVault(realVaultRoot, full)) continue
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walk(full)
        continue
      }
      if (entry.name.endsWith('.md')) out.push(full)
    }
  }
  walk(wikiDir)
  return out
}

function resolveTarget(
  target: string,
  sourceRel: string,
  byPath: Map<string, BrainGraphNodeRecord>,
): string | null {
  const normalized = target.replace(/\.md$/, '')
  const exact = byPath.get(target) ?? byPath.get(`${normalized}.md`)
  if (exact) return exact.id
  const sourceDir = sourceRel.split('/').slice(0, -1).join('/')
  const nodes = [...byPath.values()]
  const suffixHits = nodes.filter((node) => {
    const noMd = node.path.replace(/\.md$/, '')
    return (
      noMd === normalized ||
      noMd.endsWith(`/${normalized}`) ||
      node.path.endsWith(`/${normalized}.md`)
    )
  })
  if (suffixHits.length === 1) return suffixHits[0]!.id
  if (suffixHits.length > 1) {
    const local = suffixHits.filter((node) => node.path.startsWith(`${sourceDir}/`))
    if (local.length === 1) return local[0]!.id
  }
  const base = normalized.split('/').pop() ?? normalized
  const baseHits = nodes.filter((node) => fileLabel(node.path) === base)
  if (baseHits.length === 1) return baseHits[0]!.id
  if (baseHits.length > 1) {
    const local = baseHits.filter((node) => node.path.startsWith(`${sourceDir}/`))
    if (local.length === 1) return local[0]!.id
  }
  return null
}

export function buildBrainGraph(vaultRoot: string): {
  nodes: BrainGraphNodeRecord[]
  edges: BrainGraphEdgeRecord[]
} {
  if (!existsSync(vaultRoot)) return { nodes: [], edges: [] }
  const realVaultRoot = resolveRealVaultRoot(vaultRoot)
  const nodes: BrainGraphNodeRecord[] = []
  for (const full of listCandidateFiles(vaultRoot, realVaultRoot)) {
    const rel = toPosix(relative(vaultRoot, full))
    if (shouldSkipRel(rel)) continue
    const layer = layerForPath(rel)
    if (!layer) continue
    const stat = statSync(full)
    nodes.push({
      id: rel,
      label: fileLabel(rel),
      layer,
      path: rel,
      bytes: stat.size,
    })
  }
  const byPath = new Map(nodes.map((node) => [node.path, node]))
  const seen = new Set<string>()
  const edges: BrainGraphEdgeRecord[] = []
  for (const node of nodes) {
    const content = readFileSync(join(vaultRoot, node.path), 'utf-8')
    for (const target of parseWikilinkTargets(content)) {
      const resolved = resolveTarget(target, node.path, byPath)
      if (!resolved || resolved === node.id) continue
      const [source, dest] = node.id < resolved ? [node.id, resolved] : [resolved, node.id]
      const id = `${source}-->${dest}`
      if (seen.has(id)) continue
      seen.add(id)
      edges.push({ id, source, target: dest })
    }
  }
  return { nodes, edges }
}

function assertInsideVault(vaultRoot: string, relativePath: string): string {
  if (!relativePath || relativePath.includes('\0')) throw new Error('invalid path')
  const posix = relativePath.replaceAll('\\', '/')
  if (posix.startsWith('/') || posix.split('/').includes('..')) throw new Error('invalid path')
  const resolved = resolve(vaultRoot, posix)
  const rel = toPosix(relative(vaultRoot, resolved))
  if (rel.startsWith('../') || rel === '..') throw new Error('invalid path')
  return rel
}

export function readBrainPage(vaultRoot: string, relativePath: string): BrainPageRecord {
  const rel = assertInsideVault(vaultRoot, relativePath)
  const layer = layerForPath(rel)
  if (!layer || shouldSkipRel(rel)) throw new Error('not allowed')
  const full = join(vaultRoot, rel)
  if (!existsSync(full)) throw new Error('not found')
  const realVaultRoot = resolveRealVaultRoot(vaultRoot)
  const real = realpathSync(full)
  const realRel = toPosix(relative(realVaultRoot, real))
  if (realRel.startsWith('../') || realRel === '..') throw new Error('not allowed')
  if (!layerForPath(realRel) || shouldSkipRel(realRel)) throw new Error('not allowed')
  const stat = statSync(real)
  if (!stat.isFile()) throw new Error('not allowed')
  const body = readFileSync(real, 'utf-8')
  return {
    path: rel,
    title: fileLabel(rel),
    layer,
    body,
    bytes: stat.size,
  }
}
