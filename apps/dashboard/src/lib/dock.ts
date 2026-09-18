export const HEX_TILE_W = 52
export const HEX_TILE_H = 90
export const GRID_X = HEX_TILE_W / 2
export const GRID_Y = HEX_TILE_H / 6

export type PanelId = 'email' | 'skills' | 'routines' | 'calendar'

export type PanelRect = {
  x: number
  y: number
  w: number
  h: number
  open: boolean
  z: number
}

export type DockLayout = Record<PanelId, PanelRect>

export const PANEL_IDS: PanelId[] = ['email', 'skills', 'routines', 'calendar']

export const PANEL_LABELS: Record<PanelId, string> = {
  email: 'Email',
  skills: 'Skills deck',
  routines: 'Routines',
  calendar: 'Calendar',
}

const MIN_W = GRID_X * 8
const MIN_H = GRID_Y * 8

export function snap(n: number, grid: number) {
  return Math.round(n / grid) * grid
}

export function panelLimits(vw: number, vh: number) {
  const corridor = Math.min(Math.max(Math.min(vw, vh) * 0.36, 220), vw * 0.42)
  const maxW = Math.max(MIN_W, snap(Math.min(400, (vw - corridor) / 2), GRID_X))
  const maxH = Math.max(MIN_H, snap(Math.min(vh - GRID_Y * 3, vh * 0.72), GRID_Y))
  return { maxW, maxH }
}

export function snapRect(rect: Pick<PanelRect, 'x' | 'y' | 'w' | 'h'>): Pick<PanelRect, 'x' | 'y' | 'w' | 'h'> {
  return {
    x: snap(rect.x, GRID_X),
    y: snap(rect.y, GRID_Y),
    w: Math.max(MIN_W, snap(rect.w, GRID_X)),
    h: Math.max(MIN_H, snap(rect.h, GRID_Y)),
  }
}

export function clampRect(
  rect: PanelRect,
  vw: number,
  vh: number,
): PanelRect {
  const snapped = snapRect(rect)
  const { maxW, maxH } = panelLimits(vw, vh)
  const w = Math.min(snapped.w, maxW)
  const h = Math.min(snapped.h, maxH)
  const x = snap(Math.min(Math.max(0, snapped.x), Math.max(0, vw - w)), GRID_X)
  const y = snap(Math.min(Math.max(0, snapped.y), Math.max(0, vh - h)), GRID_Y)
  return { ...rect, x, y, w, h }
}

export function snapOpenRect(
  vw: number,
  vh: number,
  spec: { side: 'left' | 'right'; w: number; h: number; z: number; top?: number },
): PanelRect {
  const w = Math.max(MIN_W, snap(spec.w, GRID_X))
  const h = Math.max(MIN_H, snap(spec.h, GRID_Y))
  const y = snap(spec.top ?? GRID_Y * 2, GRID_Y)
  const x =
    spec.side === 'left'
      ? GRID_X * 2
      : snap(Math.max(GRID_X, vw - w - GRID_X * 2), GRID_X)
  return clampRect({ x, y, w, h, open: true, z: spec.z }, vw, vh)
}

export function defaultLayout(vw: number, vh: number): DockLayout {
  const { maxW, maxH } = panelLimits(vw, vh)
  const w = Math.min(maxW, snap(Math.min(320, Math.max(MIN_W, vw * 0.24)), GRID_X))
  const x = snap(Math.max(GRID_X, vw - w - GRID_X * 2), GRID_X)
  const emailH = Math.min(maxH, snap(Math.min(280, vh * 0.34), GRID_Y))
  const skillsH = Math.min(maxH, snap(Math.min(180, vh * 0.22), GRID_Y))
  const routinesH = Math.min(maxH, snap(Math.min(280, vh * 0.34), GRID_Y))
  const y1 = GRID_Y * 2
  const y2 = y1 + emailH + GRID_Y
  const y3 = y2 + skillsH + GRID_Y
  const calW = Math.min(maxW, snap(Math.min(340, Math.max(MIN_W, vw * 0.26)), GRID_X))
  const calH = Math.min(maxH, snap(Math.min(400, vh * 0.48), GRID_Y))
  const calX = GRID_X * 2
  const base = { w, open: true }
  return {
    email: clampRect({ ...base, x, y: y1, h: emailH, z: 1 }, vw, vh),
    skills: clampRect({ ...base, x, y: y2, h: skillsH, z: 2 }, vw, vh),
    routines: clampRect({ ...base, x, y: y3, h: routinesH, z: 3 }, vw, vh),
    calendar: clampRect({ w: calW, open: true, x: calX, y: y1, h: calH, z: 4 }, vw, vh),
  }
}

export function closePanel(layout: DockLayout, id: PanelId): DockLayout {
  return { ...layout, [id]: { ...layout[id], open: false } }
}

export function openPanel(layout: DockLayout, id: PanelId, vw?: number, vh?: number): DockLayout {
  const z = maxZ(layout) + 1
  const current = { ...layout[id], open: true, z }
  if (vw == null || vh == null) return { ...layout, [id]: current }
  return { ...layout, [id]: clampRect(current, vw, vh) }
}

export function raisePanel(layout: DockLayout, id: PanelId): DockLayout {
  const z = maxZ(layout) + 1
  if (layout[id].z === z - 1 && z - 1 > 0) return layout
  return { ...layout, [id]: { ...layout[id], z } }
}

export function movePanel(
  layout: DockLayout,
  id: PanelId,
  x: number,
  y: number,
  vw: number,
  vh: number,
): DockLayout {
  const current = layout[id]
  const next = clampRect({ ...current, x, y }, vw, vh)
  return { ...layout, [id]: next }
}

export function resizePanel(
  layout: DockLayout,
  id: PanelId,
  w: number,
  h: number,
  vw: number,
  vh: number,
): DockLayout {
  const current = layout[id]
  const next = clampRect({ ...current, w, h }, vw, vh)
  return { ...layout, [id]: next }
}

export function closedPanelIds(layout: DockLayout): PanelId[] {
  return PANEL_IDS.filter((id) => !layout[id].open)
}

export function parseLayout(raw: string, vw: number, vh: number): DockLayout {
  const fallback = defaultLayout(vw, vh)
  try {
    const parsed = JSON.parse(raw) as Partial<DockLayout>
    const next = { ...fallback }
    for (const id of PANEL_IDS) {
      const item = parsed[id]
      if (!item || typeof item !== 'object') continue
      next[id] = clampRect(
        {
          x: Number(item.x) || 0,
          y: Number(item.y) || 0,
          w: Number(item.w) || MIN_W,
          h: Number(item.h) || MIN_H,
          open: item.open !== false,
          z: Number(item.z) || 1,
        },
        vw,
        vh,
      )
    }
    return next
  } catch {
    return fallback
  }
}

function maxZ(layout: DockLayout) {
  return Math.max(...PANEL_IDS.map((id) => layout[id].z))
}
