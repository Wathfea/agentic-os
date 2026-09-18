import { describe, expect, it } from 'bun:test'
import {
  firstBrainMatch,
  folderForPath,
  layoutBrainGraph,
  layoutCircleGraph,
  layoutHexGraph,
  matchBrainNode,
  SECTOR_LAYERS,
} from './brain-layout'

describe('layoutBrainGraph', () => {
  it('places index at origin and overview north', () => {
    const pos = layoutBrainGraph([
      { id: 'index.md', layer: 'index' },
      { id: 'wiki/overview.md', layer: 'overview' },
    ])
    expect(pos.get('index.md')).toEqual({ x: 0, y: 0 })
    const overview = pos.get('wiki/overview.md')!
    expect(overview.x).toBeCloseTo(0, 5)
    expect(overview.y).toBeLessThan(0)
  })

  it('keeps each vault layer inside its sector', () => {
    const nodes = [
      { id: 'index.md', layer: 'index' as const },
      { id: 's1', layer: 'sources' as const },
      { id: 'e1', layer: 'entities' as const },
      { id: 'c1', layer: 'concepts' as const },
      { id: 'p1', layer: 'projects' as const },
    ]
    const pos = layoutBrainGraph(nodes)
    for (const [i, layer] of SECTOR_LAYERS.entries()) {
      const p = pos.get(nodes[i + 1]!.id)!
      const angle = Math.atan2(p.y, p.x)
      const start = -Math.PI / 2 + i * (Math.PI / 2)
      const end = start + Math.PI / 2
      const wrapped = angle < start - 1e-6 ? angle + Math.PI * 2 : angle
      expect(wrapped).toBeGreaterThanOrEqual(start - 1e-6)
      expect(wrapped).toBeLessThan(end + 1e-6)
    }
  })

  it('splits project folders into different sectors', () => {
    expect(folderForPath('wiki/projects/pd/overview.md')).toBe('pd')
    const pos = layoutBrainGraph(
      [
        { id: 'index.md', layer: 'index', path: 'index.md' },
        { id: 'a', layer: 'projects', path: 'wiki/projects/pd/overview.md' },
        { id: 'b', layer: 'projects', path: 'wiki/projects/vfs/overview.md' },
      ],
      'folder',
    )
    const a = pos.get('a')!
    const b = pos.get('b')!
    const angA = Math.atan2(a.y, a.x)
    const angB = Math.atan2(b.y, b.x)
    const delta = Math.abs(angA - angB)
    expect(Math.min(delta, Math.PI * 2 - delta)).toBeGreaterThan(0.5)
  })
})

describe('brain search', () => {
  it('matches label, id, or path and returns the first hit', () => {
    expect(matchBrainNode('over', 'overview', 'wiki/overview.md', 'wiki/overview.md')).toBe(true)
    expect(matchBrainNode('wiki/overview', 'overview', 'wiki/overview.md')).toBe(true)
    expect(matchBrainNode('nope', 'overview', 'wiki/overview.md')).toBe(false)
    expect(
      firstBrainMatch(
        [
          { id: 'index.md', label: 'index', path: 'index.md' },
          { id: 'wiki/overview.md', label: 'overview', path: 'wiki/overview.md' },
        ],
        'OVERVIEW',
      ),
    ).toBe('wiki/overview.md')
    expect(firstBrainMatch([{ id: 'index.md', label: 'index' }], '   ')).toBe(null)
  })
})

describe('circle vs hex packing', () => {
  it('puts circle satellites on one ring and hex on multiple rings', () => {
    const nodes = [
      { id: 'index.md', layer: 'index' as const },
      ...Array.from({ length: 18 }, (_, i) => ({ id: `n${i}`, layer: 'concepts' as const })),
    ]
    const circle = layoutCircleGraph(nodes)
    const hex = layoutHexGraph(nodes)
    const radii = (map: Map<string, { x: number; y: number }>) =>
      [...map.entries()]
        .filter(([id]) => id !== 'index.md')
        .map(([, p]) => Math.hypot(p.x, p.y))
    const cr = radii(circle)
    const hr = radii(hex)
    expect(Math.max(...cr) - Math.min(...cr)).toBeLessThan(0.01)
    expect(Math.max(...hr) - Math.min(...hr)).toBeGreaterThan(0.1)
    expect(hex.get('index.md')).toEqual({ x: 0, y: 0 })
  })
})
