import { describe, expect, it } from 'bun:test'
import {
  GRID_X,
  GRID_Y,
  closePanel,
  closedPanelIds,
  defaultLayout,
  movePanel,
  openPanel,
  parseLayout,
  resizePanel,
  snap,
  snapOpenRect,
  snapRect,
} from './dock'

describe('snap to hex grid', () => {
  it('rounds to 26x15 lattice', () => {
    expect(snap(13, GRID_X)).toBe(26)
    expect(snap(12, GRID_X)).toBe(0)
    expect(snap(22, GRID_Y)).toBe(15)
    expect(snap(23, GRID_Y)).toBe(30)
  })

  it('snaps panel rects onto the lattice', () => {
    expect(snapRect({ x: 40, y: 22, w: 200, h: 130 })).toEqual({
      x: 52,
      y: 15,
      w: 208,
      h: 135,
    })
  })

  it('opens a new window on the hex lattice', () => {
    const right = snapOpenRect(1440, 900, { side: 'right', w: 413, h: 701, z: 8, top: 97 })
    expect(right.x % GRID_X).toBe(0)
    expect(right.y % GRID_Y).toBe(0)
    expect(right.w % GRID_X).toBe(0)
    expect(right.h % GRID_Y).toBe(0)
    expect(right.open).toBe(true)
    expect(right.y).toBe(90)
    expect(right.x + right.w).toBeLessThanOrEqual(1440)
    const left = snapOpenRect(1440, 900, { side: 'left', w: 311, h: 404, z: 7, top: 97 })
    expect(left.x).toBe(GRID_X * 2)
    expect(left.x).toBeLessThan(right.x)
    expect(left.y).toBe(90)
  })
})

describe('small viewports', () => {
  it('leaves a center corridor for the sphere', () => {
    const layout = defaultLayout(1024, 700)
    const gap = layout.email.x - (layout.calendar.x + layout.calendar.w)
    expect(gap).toBeGreaterThanOrEqual(240)
    expect(layout.email.w).toBeLessThanOrEqual(340)
    expect(layout.calendar.w).toBeLessThanOrEqual(340)
  })

  it('shrinks oversized saved panels instead of filling the window', () => {
    const saved = defaultLayout(1440, 900)
    saved.email = { ...saved.email, x: 0, y: 0, w: 880, h: 680, open: true }
    saved.calendar = { ...saved.calendar, x: 0, y: 0, w: 880, h: 680, open: true }
    const parsed = parseLayout(JSON.stringify(saved), 900, 640)
    expect(parsed.email.w).toBeLessThan(900 * 0.42)
    expect(parsed.calendar.w).toBeLessThan(900 * 0.42)
    expect(parsed.email.w + parsed.calendar.w).toBeLessThan(900)
    expect(parsed.email.x + parsed.email.w).toBeLessThanOrEqual(900)
  })
})

describe('dock panels', () => {
  it('closes a panel and lists it for restore', () => {
    const layout = closePanel(defaultLayout(1440, 900), 'skills')
    expect(layout.skills.open).toBe(false)
    expect(closedPanelIds(layout)).toEqual(['skills'])
  })

  it('opens calendar on the left by default', () => {
    const layout = defaultLayout(1440, 900)
    expect(layout.calendar.open).toBe(true)
    expect(layout.calendar.x).toBeLessThan(layout.email.x)
    expect(layout.calendar.w).toBeGreaterThan(0)
    expect(closedPanelIds(closePanel(layout, 'calendar'))).toEqual(['calendar'])
  })

  it('adds a closed panel back and raises it', () => {
    const closed = closePanel(defaultLayout(1440, 900), 'email')
    const opened = openPanel(closed, 'email')
    expect(opened.email.open).toBe(true)
    expect(opened.email.z).toBeGreaterThan(closed.email.z)
    expect(closedPanelIds(opened)).toEqual([])
  })

  it('moves and resizes onto the grid inside the viewport', () => {
    const start = defaultLayout(1440, 900)
    const moved = movePanel(start, 'routines', 33, 41, 1440, 900)
    expect(moved.routines.x % GRID_X).toBe(0)
    expect(moved.routines.y % GRID_Y).toBe(0)
    const resized = resizePanel(moved, 'routines', 277, 188, 1440, 900)
    expect(resized.routines.w % GRID_X).toBe(0)
    expect(resized.routines.h % GRID_Y).toBe(0)
    expect(resized.routines.x + resized.routines.w).toBeLessThanOrEqual(1440)
    expect(resized.routines.y + resized.routines.h).toBeLessThanOrEqual(900)
  })

  it('restores a saved layout and rejects junk', () => {
    const saved = closePanel(defaultLayout(1440, 900), 'routines')
    saved.email.x = 40
    const parsed = parseLayout(JSON.stringify(saved), 1440, 900)
    expect(parsed.routines.open).toBe(false)
    expect(parsed.email.x % GRID_X).toBe(0)
    expect(parseLayout('not-json', 1440, 900).email.open).toBe(true)
  })
})
