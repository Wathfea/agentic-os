import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HEX_TILE_H, HEX_TILE_W } from './dock'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'assets/hex-grid.svg')
const cssPath = join(root, 'assets/main.css')

function centroids(svg: string) {
  const paths = [...svg.matchAll(/d="([^"]+)"/g)].map((m) => m[1])
  return paths.map((d) => {
    const pairs = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
    const pts = pairs.map((p) => ({ x: Number(p[1]), y: Number(p[2]) }))
    const n = pts.length
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / n,
      y: pts.reduce((s, p) => s + p.y, 0) / n,
    }
  })
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe('hex background tile', () => {
  it('uses a 52x90 honeycomb cell', () => {
    const svg = readFileSync(svgPath, 'utf8')
    expect(svg).toContain(`width="${HEX_TILE_W}"`)
    expect(svg).toContain(`height="${HEX_TILE_H}"`)
    const css = readFileSync(cssPath, 'utf8')
    expect(css).toContain(`url('./hex-grid.svg')`)
    expect(css).toContain(`${HEX_TILE_W}px ${HEX_TILE_H}px`)
  })

  it('places neighbor hexes on a honeycomb, not stacked in one column', () => {
    const svg = readFileSync(svgPath, 'utf8')
    const centers = centroids(svg)
    expect(centers.length).toBeGreaterThanOrEqual(3)
    const xs = new Set(centers.map((c) => Math.round(c.x)))
    expect(xs.size).toBeGreaterThan(1)
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        expect(dist(centers[i], centers[j])).toBeCloseTo(HEX_TILE_W, 0)
      }
    }
  })
})
