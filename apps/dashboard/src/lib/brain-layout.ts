export type BrainLayoutLayer = 'index' | 'overview' | 'sources' | 'entities' | 'concepts' | 'projects'

export type BrainLayoutMode = 'force' | 'circle' | 'hex' | 'rings'

export const SECTOR_LAYERS = ['sources', 'entities', 'concepts', 'projects'] as const

export function folderForPath(path: string): string {
  if (path === 'index.md') return 'index'
  if (path === 'wiki/overview.md') return 'overview'
  const parts = path.split('/')
  if (parts[0] === 'wiki' && parts[1] === 'projects' && parts[2]) return parts[2]
  if (parts[0] === 'wiki' && parts[1]) return parts[1]
  return path
}

function packSector(
  ids: string[],
  start: number,
  span: number,
  positions: Map<string, { x: number; y: number }>,
) {
  const n = ids.length
  for (const [j, id] of ids.entries()) {
    const t = n === 1 ? 0.5 : (j + 0.5) / n
    const angle = start + span * t
    const ring = n === 1 ? 0.72 : 0.48 + (0.42 * (j % 4)) / 3
    positions.set(id, { x: ring * Math.cos(angle), y: ring * Math.sin(angle) })
  }
}

export function layoutBrainGraph(
  nodes: Array<{ id: string; layer: BrainLayoutLayer; path?: string }>,
  groupBy: 'layer' | 'folder' = 'layer',
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  if (groupBy === 'folder') {
    const byFolder = new Map<string, string[]>()
    for (const node of nodes) {
      const folder = folderForPath(node.path ?? node.id)
      const list = byFolder.get(folder) ?? []
      list.push(node.id)
      byFolder.set(folder, list)
    }
    for (const id of byFolder.get('index') ?? []) positions.set(id, { x: 0, y: 0 })
    const overviewA = -Math.PI / 2
    for (const id of byFolder.get('overview') ?? []) {
      positions.set(id, { x: 0.28 * Math.cos(overviewA), y: 0.28 * Math.sin(overviewA) })
    }
    const folders = [...byFolder.keys()].filter((name) => name !== 'index' && name !== 'overview')
    const count = Math.max(folders.length, 1)
    const span = (Math.PI * 2) / count
    folders.forEach((folder, i) => {
      packSector(byFolder.get(folder) ?? [], -Math.PI / 2 + i * span, span, positions)
    })
    return positions
  }
  const byLayer = new Map<BrainLayoutLayer, string[]>()
  for (const node of nodes) {
    const list = byLayer.get(node.layer) ?? []
    list.push(node.id)
    byLayer.set(node.layer, list)
  }
  for (const id of byLayer.get('index') ?? []) positions.set(id, { x: 0, y: 0 })
  const overviewR = 0.28
  const overviewA = -Math.PI / 2
  for (const id of byLayer.get('overview') ?? []) {
    positions.set(id, { x: overviewR * Math.cos(overviewA), y: overviewR * Math.sin(overviewA) })
  }
  for (const [i, layer] of SECTOR_LAYERS.entries()) {
    const start = -Math.PI / 2 + i * (Math.PI / 2)
    packSector(byLayer.get(layer) ?? [], start, Math.PI / 2, positions)
  }
  return positions
}

export function matchBrainNode(query: string, label: string, id: string, path = ''): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  return `${label} ${id} ${path}`.toLowerCase().includes(q)
}

export function firstBrainMatch(
  nodes: Array<{ id: string; label: string; path?: string }>,
  query: string,
): string | null {
  for (const node of nodes) {
    if (matchBrainNode(query, node.label, node.id, node.path ?? '')) return node.id
  }
  return null
}

export function layoutCircleGraph(
  nodes: Array<{ id: string; layer: BrainLayoutLayer }>,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const hubs = nodes.filter((node) => node.layer === 'index')
  const rest = nodes.filter((node) => node.layer !== 'index')
  for (const node of hubs) positions.set(node.id, { x: 0, y: 0 })
  const ring = rest.length > 0 ? rest : nodes
  const n = Math.max(ring.length, 1)
  ring.forEach((node, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / n
    positions.set(node.id, { x: 0.82 * Math.cos(angle), y: 0.82 * Math.sin(angle) })
  })
  return positions
}

function hexSpiral(count: number): Array<{ q: number; r: number }> {
  const cells: Array<{ q: number; r: number }> = []
  if (count <= 0) return cells
  cells.push({ q: 0, r: 0 })
  const dirs: Array<[number, number]> = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ]
  let ring = 1
  while (cells.length < count) {
    let q = -ring
    let r = ring
    for (let d = 0; d < 6; d++) {
      for (let s = 0; s < ring; s++) {
        cells.push({ q, r })
        if (cells.length >= count) return cells
        q += dirs[d][0]
        r += dirs[d][1]
      }
    }
    ring += 1
  }
  return cells
}

export function layoutHexGraph(
  nodes: Array<{ id: string; layer: BrainLayoutLayer }>,
): Map<string, { x: number; y: number }> {
  const ordered = [
    ...nodes.filter((node) => node.layer === 'index'),
    ...nodes.filter((node) => node.layer !== 'index'),
  ]
  const cells = hexSpiral(ordered.length)
  const size = 0.14
  const positions = new Map<string, { x: number; y: number }>()
  ordered.forEach((node, i) => {
    const cell = cells[i]!
    positions.set(node.id, {
      x: size * (Math.sqrt(3) * cell.q + (Math.sqrt(3) / 2) * cell.r),
      y: size * (1.5 * cell.r),
    })
  })
  return positions
}

export function positionsForBrainView(
  nodes: Array<{ id: string; layer: BrainLayoutLayer; path?: string }>,
  layout: BrainLayoutMode,
  groupBy: 'layer' | 'folder' = 'layer',
): Map<string, { x: number; y: number }> {
  if (layout === 'hex') return layoutHexGraph(nodes)
  if (layout === 'circle') return layoutCircleGraph(nodes)
  return layoutBrainGraph(nodes, groupBy)
}
