import type { Core, EdgeSingular } from 'cytoscape'

type Pulse = {
  edge: EdgeSingular
  reverse: boolean
  t: number
  speed: number
  len: number
  width: number
}

export type EdgePulses = {
  drawIn(onDone: () => void): void
  burst(nodeId: string): void
  setSelected(nodeId: string | null): void
  destroy(): void
}

const DRAW_IN_MS = 1100
const FADE_MS = 450
const MAX_BURST = 32

function rgba(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const n = Number.parseInt(full, 16)
  if (Number.isNaN(n)) return `rgba(242,107,26,${alpha})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function createEdgePulses(
  canvas: HTMLCanvasElement,
  cy: Core,
  reducedMotion: boolean,
): EdgePulses {
  const ctx = canvas.getContext('2d')
  let raf = 0
  let last = 0
  let width = 0
  let height = 0
  let drawT = -1
  let fadeT = -1
  let onDrawDone: (() => void) | null = null
  let selected: string | null = null
  let pulses: Pulse[] = []
  let lastSpawn = 0
  let destroyed = false

  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas)
  resize()

  function resize() {
    const dpr = window.devicePixelRatio || 1
    width = canvas.clientWidth
    height = canvas.clientHeight
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function ends(edge: EdgeSingular) {
    const s = edge.source().renderedPosition()
    const t = edge.target().renderedPosition()
    return [s.x, s.y, t.x, t.y] as const
  }

  function pool(): EdgeSingular[] {
    const edges = selected ? cy.edges('.highlighted') : cy.edges()
    return edges.filter((edge) => edge.visible()).toArray() as EdgeSingular[]
  }

  function targetCount() {
    const n = cy.edges().length
    if (selected) return Math.min(18, Math.max(3, Math.round(cy.edges('.highlighted').length * 0.6)))
    return Math.min(28, Math.max(6, Math.round(n / 12)))
  }

  function spawn(edge: EdgeSingular, reverse: boolean, boost = 0) {
    pulses.push({
      edge,
      reverse,
      t: -0.02,
      speed: 0.32 + Math.random() * 0.28 + boost,
      len: 0.24 + Math.random() * 0.16,
      width: 1.8 + Math.random() * 0.8,
    })
  }

  function spawnAmbient(now: number) {
    if (now - lastSpawn < 70 || pulses.length >= targetCount()) return
    const candidates = pool()
    if (candidates.length === 0) return
    const edge = candidates[Math.floor(Math.random() * candidates.length)]!
    const reverse = selected ? edge.target().id() === selected : Math.random() < 0.5
    spawn(edge, reverse)
    lastSpawn = now
  }

  function drawPulse(p: Pulse) {
    if (!ctx) return
    const [sx, sy, tx, ty] = ends(p.edge)
    const ax = p.reverse ? tx : sx
    const ay = p.reverse ? ty : sy
    const bx = p.reverse ? sx : tx
    const by = p.reverse ? sy : ty
    const head = Math.min(1, Math.max(0, p.t))
    const tail = Math.min(1, Math.max(0, p.t - p.len))
    if (head <= tail) return
    const color = String(p.edge.data('color') ?? '#f26b1a')
    const hx = ax + (bx - ax) * head
    const hy = ay + (by - ay) * head
    const lx = ax + (bx - ax) * tail
    const ly = ay + (by - ay) * tail
    const life = p.t > 1 ? Math.max(0, 1 - (p.t - 1) / p.len) : 1
    const grad = ctx.createLinearGradient(lx, ly, hx, hy)
    grad.addColorStop(0, rgba(color, 0))
    grad.addColorStop(0.6, rgba(color, 0.55 * life))
    grad.addColorStop(1, rgba(color, life))
    ctx.strokeStyle = grad
    ctx.lineWidth = p.width
    ctx.lineCap = 'round'
    ctx.shadowColor = rgba(color, life)
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(hx, hy)
    ctx.stroke()
    if (p.t <= 1) {
      ctx.fillStyle = rgba('#ffffff', 0.85 * life)
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(hx, hy, p.width * 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  function drawTrace(progress: number, alpha: number) {
    if (!ctx) return
    const edges = cy.edges().filter((edge) => edge.visible()).toArray() as EdgeSingular[]
    const byColor = new Map<string, EdgeSingular[]>()
    edges.forEach((edge) => {
      const color = String(edge.data('color') ?? '#f26b1a')
      const list = byColor.get(color)
      if (list) list.push(edge)
      else byColor.set(color, [edge])
    })
    const total = Math.max(1, edges.length)
    ctx.lineWidth = 1.4
    ctx.lineCap = 'round'
    ctx.shadowBlur = 10
    byColor.forEach((list, color) => {
      ctx.strokeStyle = rgba(color, 0.85 * alpha)
      ctx.shadowColor = rgba(color, 0.8 * alpha)
      ctx.beginPath()
      list.forEach((edge, i) => {
        const stagger = ((i * 7919) % total) / total
        const p = easeOut(Math.min(1, Math.max(0, progress * 1.4 - stagger * 0.4)))
        if (p <= 0) return
        const [sx, sy, tx, ty] = ends(edge)
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx + (tx - sx) * p, sy + (ty - sy) * p)
      })
      ctx.stroke()
    })
    ctx.shadowBlur = 0
  }

  function frame(now: number) {
    if (destroyed || !ctx) return
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
    last = now
    ctx.clearRect(0, 0, width, height)

    if (drawT >= 0) {
      drawT = Math.min(1, drawT + (dt * 1000) / DRAW_IN_MS)
      drawTrace(drawT, 1)
      if (drawT >= 1) {
        drawT = -1
        fadeT = 0
        onDrawDone?.()
        onDrawDone = null
      }
    } else if (fadeT >= 0) {
      fadeT = Math.min(1, fadeT + (dt * 1000) / FADE_MS)
      drawTrace(1, 1 - fadeT)
      if (fadeT >= 1) fadeT = -1
    }

    if (drawT < 0) spawnAmbient(now)
    pulses.forEach((p) => {
      p.t += p.speed * dt
    })
    pulses = pulses.filter((p) => p.t <= 1 + p.len && p.edge.inside())
    pulses.forEach(drawPulse)

    raf = requestAnimationFrame(frame)
  }

  if (!reducedMotion) raf = requestAnimationFrame(frame)

  return {
    drawIn(onDone) {
      if (reducedMotion) {
        onDone()
        return
      }
      drawT = 0
      onDrawDone = onDone
    },
    burst(nodeId) {
      if (reducedMotion) return
      const node = cy.getElementById(nodeId)
      if (node.empty()) return
      const edges = node.connectedEdges().filter((edge) => edge.visible()).toArray() as EdgeSingular[]
      edges.slice(0, MAX_BURST).forEach((edge, i) => {
        spawn(edge, edge.target().id() === nodeId, 0.4 - Math.min(0.3, i * 0.01))
      })
    },
    setSelected(nodeId) {
      selected = nodeId
      if (!nodeId) return
      pulses = pulses.filter((p) => p.edge.hasClass('highlighted'))
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      ctx?.clearRect(0, 0, width, height)
    },
  }
}
