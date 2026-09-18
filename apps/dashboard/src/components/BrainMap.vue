<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import cytoscape, { type Core } from 'cytoscape'
import type { BrainGraph, BrainGraphLayer } from '@/lib/api'
import {
  firstBrainMatch,
  matchBrainNode,
  positionsForBrainView,
  SECTOR_LAYERS,
  type BrainLayoutMode,
} from '@/lib/brain-layout'
import Button from '@/components/ui/Button.vue'
import { createEdgePulses, type EdgePulses } from '@/lib/edge-pulses'

const SCALE = 420
const LABEL_R = 1.05
const LAYER_COLOR: Record<BrainGraphLayer, string> = {
  index: '#f26b1a',
  overview: '#fbbf24',
  sources: '#2dd4bf',
  entities: '#e879f9',
  concepts: '#f472b6',
  projects: '#60a5fa',
}

type ViewMode = 'layers' | 'folders'
const LAYOUTS: BrainLayoutMode[] = ['force', 'circle', 'hex', 'rings']

const props = defineProps<{
  graph: BrainGraph
  selectedId: string | null
  focusId: string | null
  loading: boolean
  error: string
  vaultMissing: boolean
}>()

const emit = defineEmits<{
  select: [id: string | null]
  open: [id: string]
}>()

const container = ref<HTMLElement | null>(null)
const pulseCanvas = ref<HTMLCanvasElement | null>(null)
let pulses: EdgePulses | null = null
let drawing = false
const search = ref('')
const layoutMode = ref<BrainLayoutMode>('rings')
const viewMode = ref<ViewMode>('layers')
const fileNames = ref(false)
const linkSpring = ref(0.42)
const nodeSize = ref(0.59)
const collapsed = ref(false)
let cy: Core | null = null
let ro: ResizeObserver | null = null

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

type SectorPin = { layer: string; left: string; top: string; color: string }

function sectorMid(i: number, count = 4) {
  return -Math.PI / 2 + i * ((Math.PI * 2) / count) + Math.PI / count
}

function fallbackPins(): SectorPin[] {
  return SECTOR_LAYERS.map((layer, i) => {
    const mid = sectorMid(i)
    return {
      layer,
      color: LAYER_COLOR[layer],
      left: `${50 + 38 * Math.cos(mid)}%`,
      top: `${50 + 38 * Math.sin(mid)}%`,
    }
  })
}

const sectorPins = ref<SectorPin[]>(fallbackPins())
const layoutHint = computed(() => {
  if (layoutMode.value === 'force') return 'Physics: linked pages pull together'
  if (layoutMode.value === 'circle') return 'All pages on one ring'
  if (layoutMode.value === 'hex') return 'Honeycomb packing'
  return 'Vault layers in sectors'
})

function updateSectorPins() {
  if (layoutMode.value !== 'rings') {
    sectorPins.value = []
    return
  }
  if (!cy) {
    sectorPins.value = fallbackPins()
    return
  }
  const zoom = cy.zoom()
  const pan = cy.pan()
  const layers = viewMode.value === 'layers' ? [...SECTOR_LAYERS] : []
  if (layers.length === 0) {
    sectorPins.value = []
    return
  }
  sectorPins.value = layers.map((layer, i) => {
    const mid = sectorMid(i, layers.length)
    const x = LABEL_R * Math.cos(mid) * SCALE
    const y = LABEL_R * Math.sin(mid) * SCALE
    return {
      layer,
      color: LAYER_COLOR[layer],
      left: `${x * zoom + pan.x}px`,
      top: `${y * zoom + pan.y}px`,
    }
  })
}

function nodeWidth(layer: string) {
  const base = 4 + nodeSize.value * 16
  if (layer === 'index') return base * 1.85
  if (layer === 'overview') return base * 1.25
  return base
}

function labelPx() {
  if (!cy) return 12
  const z = Math.max(cy.zoom(), 0.2)
  return Math.max(10, Math.min(36, 12 / z))
}

function applyChrome() {
  if (!cy) return
  const q = search.value.trim()
  const font = labelPx()
  cy.batch(() => {
    cy!.nodes().forEach((node) => {
      const layer = String(node.data('layer') ?? '')
      const w = nodeWidth(layer)
      node.style({ width: w, height: w, 'font-size': font })
      const hub = layer === 'index' || layer === 'overview'
      if (collapsed.value && !hub) node.addClass('packed')
      else node.removeClass('packed')
      const hit = matchQuery(node)
      if (q && !hit) node.addClass('unmatched')
      else node.removeClass('unmatched')
      if (fileNames.value) node.addClass('named')
      else node.removeClass('named')
    })
    cy!.edges().forEach((edge) => {
      edge.style({
        opacity: drawing ? 0 : 0.18 + linkSpring.value * 0.7,
        width: 0.5 + linkSpring.value * 2.2,
      })
    })
  })
  syncZoomLabels()
}

function matchQuery(node: { data: (k: string) => unknown; id: () => string }) {
  return matchBrainNode(
    search.value,
    String(node.data('label') ?? ''),
    node.id(),
    String(node.data('path') ?? ''),
  )
}

function applySelection(id: string | null) {
  if (!cy) return
  cy.elements().removeClass('highlighted faded')
  cy.elements().unselect()
  if (!id) {
    pulses?.setSelected(null)
    return
  }
  const node = cy.getElementById(id)
  if (node.empty()) return
  node.select()
  node.addClass('highlighted')
  node.neighborhood().addClass('highlighted')
  cy.elements().difference(node.closedNeighborhood()).addClass('faded')
  pulses?.setSelected(id)
}

function syncZoomLabels() {
  if (!cy) return
  if (fileNames.value || cy.zoom() >= 1.4) cy.nodes().addClass('zoomed')
  else cy.nodes().removeClass('zoomed')
}

function flyTo(id: string | null) {
  if (!cy || !id) return
  const eles = cy.getElementById(id)
  if (eles.empty()) return
  cy.stop(true, true)
  cy.animate({
    zoom: Math.min(2.2, Math.max(1.7, cy.zoom())),
    center: { eles },
    duration: prefersReducedMotion ? 0 : 380,
    easing: 'ease-out',
  })
}

function runSearch() {
  applyChrome()
  const id = firstBrainMatch(
    props.graph.nodes.map((node) => ({ id: node.id, label: node.label, path: node.path })),
    search.value,
  )
  if (!id) return
  emit('select', id)
  flyTo(id)
}

function resetView() {
  layoutMode.value = 'rings'
  viewMode.value = 'layers'
  fileNames.value = false
  linkSpring.value = 0.42
  nodeSize.value = 0.59
  collapsed.value = false
  search.value = ''
}

async function renderGraph() {
  if (!container.value) return

  await nextTick()

  pulses?.destroy()
  pulses = null
  if (cy) {
    cy.destroy()
    cy = null
  }

  await nextTick()
  if (!container.value) return

  const seedLayout = layoutMode.value === 'force' ? 'rings' : layoutMode.value
  const positions = positionsForBrainView(
    props.graph.nodes.map((node) => ({ id: node.id, layer: node.layer, path: node.path })),
    seedLayout,
    viewMode.value === 'folders' ? 'folder' : 'layer',
  )
  const colorById = new Map(props.graph.nodes.map((node) => [node.id, LAYER_COLOR[node.layer]]))
  const shape = layoutMode.value === 'hex' ? 'hexagon' : 'ellipse'

  cy = cytoscape({
    container: container.value,
    autoungrabify: true,
    elements: [
      ...props.graph.nodes.map((node) => {
        const pos = positions.get(node.id) ?? { x: 0, y: 0 }
        return {
          data: {
            id: node.id,
            label: node.label,
            layer: node.layer,
            path: node.path,
            color: LAYER_COLOR[node.layer],
          },
          position: { x: pos.x * SCALE, y: pos.y * SCALE },
        }
      }),
      ...props.graph.edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          color: colorById.get(edge.source) ?? '#f26b1a',
        },
      })),
    ],
    style: [
      {
        selector: 'node',
        style: {
          shape,
          'background-color': 'data(color)',
          'background-opacity': 1,
          'border-width': 1,
          'border-color': 'data(color)',
          'border-opacity': 0.55,
          label: 'data(label)',
          color: '#f7f7f7',
          'text-background-color': '#050505',
          'text-background-opacity': 0.7,
          'text-background-padding': '2px',
          'text-outline-width': 0,
          'text-halign': 'right',
          'text-valign': 'center',
          'text-margin-x': 8,
          'font-family': 'IBM Plex Mono, monospace',
          'font-size': 12,
          'min-zoomed-font-size': 0,
          'text-opacity': 0,
          width: 7,
          height: 7,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.1,
          'line-color': 'data(color)',
          'target-arrow-shape': 'none',
          'curve-style': 'haystack',
          'haystack-radius': 0.6,
          opacity: 0.45,
        },
      },
      {
        selector: 'node.highlighted',
        style: {
          'border-width': 2,
          'border-opacity': 1,
          'z-index': 10,
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 2.4,
          'border-opacity': 1,
          'text-opacity': 1,
          'z-index': 10,
        },
      },
      {
        selector: 'node.hovered, node.zoomed, node.named',
        style: {
          'text-opacity': 1,
        },
      },
      {
        selector: 'edge:selected, edge.highlighted',
        style: {
          opacity: 0.95,
          width: 2.2,
          'z-index': 9,
        },
      },
      {
        selector: '.faded',
        style: {
          opacity: 0.07,
        },
      },
      {
        selector: 'node.packed',
        style: {
          display: 'none',
        },
      },
      {
        selector: 'node.unmatched',
        style: {
          opacity: 0.12,
        },
      },
    ],
    layout:
      layoutMode.value === 'force'
        ? {
            name: 'cose' as const,
            animate: !prefersReducedMotion,
            animationDuration: prefersReducedMotion ? 0 : 520,
            padding: 56,
            randomize: false,
            nodeRepulsion: 14000,
            idealEdgeLength: 80,
            gravity: 0.35,
            numIter: 900,
            fit: true,
          }
        : {
            name: 'preset' as const,
            fit: true,
            padding: 64,
            animate: !prefersReducedMotion,
            animationDuration: prefersReducedMotion ? 0 : 280,
          },
    minZoom: 0.08,
    maxZoom: 4,
    wheelSensitivity: 0.25,
    boxSelectionEnabled: false,
  })

  cy.on('tap', 'node', (event) => {
    emit('select', event.target.id())
  })

  cy.on('dbltap', 'node', (event) => {
    emit('open', event.target.id())
  })

  cy.on('tap', (event) => {
    if (event.target === cy) emit('select', null)
  })

  cy.on('mouseover', 'node', (event) => {
    event.target.addClass('hovered')
  })

  cy.on('mouseout', 'node', (event) => {
    event.target.removeClass('hovered')
  })

  cy.on('zoom', () => {
    if (fileNames.value && cy) {
      const font = labelPx()
      cy.nodes().style({ 'font-size': font })
    }
    syncZoomLabels()
    updateSectorPins()
  })

  cy.on('pan', () => {
    updateSectorPins()
  })

  if (pulseCanvas.value) pulses = createEdgePulses(pulseCanvas.value, cy, prefersReducedMotion)
  drawing = !prefersReducedMotion && props.graph.edges.length > 0

  cy.ready(() => {
    cy?.resize()
    cy?.fit(undefined, 64)
    applySelection(props.selectedId)
    applyChrome()
    updateSectorPins()
    pulses?.drawIn(() => {
      drawing = false
      applyChrome()
    })
  })

  window.setTimeout(() => {
    cy?.resize()
    cy?.fit(undefined, 64)
    applySelection(props.selectedId)
    applyChrome()
    updateSectorPins()
  }, 120)
}

watch(
  () => props.graph,
  () => {
    void renderGraph()
  },
  { deep: true },
)

watch([layoutMode, viewMode], () => {
  void renderGraph()
})

watch([fileNames, linkSpring, nodeSize, search, collapsed], () => {
  applyChrome()
})

watch(
  () => props.selectedId,
  (id) => {
    applySelection(id)
    if (id) pulses?.burst(id)
  },
)

watch(
  () => props.focusId,
  (id) => {
    flyTo(id)
  },
)

onMounted(() => {
  void renderGraph()
  if (container.value) {
    ro = new ResizeObserver(() => {
      cy?.resize()
      updateSectorPins()
    })
    ro.observe(container.value)
  }
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  pulses?.destroy()
  pulses = null
  cy?.destroy()
  cy = null
})
</script>

<template>
  <div class="brain-map">
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.06)] px-4 py-2"
    >
      <span class="text-micro text-[var(--color-dim)]">
        BRAIN {{ graph.nodeCount }} NODES · {{ graph.edgeCount }} EDGES
      </span>
      <span v-if="vaultMissing" class="text-micro text-[var(--color-danger)]">VAULT OFFLINE</span>
      <span v-else-if="error" class="text-micro text-[var(--color-danger)]">> {{ error }}</span>
      <span v-else-if="loading" class="text-micro text-[var(--color-subtle)]">LOADING...</span>
      <span v-else class="text-micro text-[var(--color-dim)]">TAP NODE TO SELECT · DOUBLE-TAP TO OPEN</span>
    </div>
    <div class="graph-viewer-shell graph-viewer-shell--fill">
      <div class="brain-map-glow-wrap" aria-hidden="true">
        <div class="brain-map-glow" />
      </div>
      <div class="graph-viewer-grid" aria-hidden="true" />
      <div
        ref="container"
        class="graph-viewer-canvas"
        :class="loading ? 'opacity-40' : 'opacity-100'"
      />
      <canvas ref="pulseCanvas" class="brain-map-pulses" aria-hidden="true" />
      <div class="brain-map-sectors" aria-hidden="true">
        <span
          v-for="pin in sectorPins"
          :key="pin.layer"
          class="brain-map-sector"
          :style="{ left: pin.left, top: pin.top, color: pin.color }"
        >
          {{ pin.layer }}
        </span>
      </div>
      <aside class="brain-view">
        <input
          v-model="search"
          class="cybr-input brain-view__search"
          type="search"
          placeholder="SEARCH"
          enterkeyhint="search"
          @keydown.enter.prevent.stop="runSearch"
          @keyup.enter.prevent.stop="runSearch"
        />
        <div class="brain-view__block">
          <p class="brain-view__label">LAYOUT</p>
          <div class="brain-view__seg">
            <button
              v-for="mode in LAYOUTS"
              :key="mode"
              type="button"
              class="brain-view__chip"
              :class="{ 'brain-view__chip--on': layoutMode === mode }"
              @click="layoutMode = mode"
            >
              {{ mode }}
            </button>
          </div>
          <p class="brain-view__hint">{{ layoutHint }}</p>
        </div>
        <div class="brain-view__block">
          <p class="brain-view__label">VIEW</p>
          <div class="brain-view__seg">
            <button
              type="button"
              class="brain-view__chip"
              :class="{ 'brain-view__chip--on': viewMode === 'layers' }"
              @click="viewMode = 'layers'"
            >
              LAYERS
            </button>
            <button
              type="button"
              class="brain-view__chip"
              :class="{ 'brain-view__chip--on': viewMode === 'folders' }"
              @click="viewMode = 'folders'"
            >
              FOLDERS
            </button>
          </div>
        </div>
        <label class="brain-view__check">
          <input v-model="fileNames" type="checkbox" @change="applyChrome" />
          FILE NAMES
        </label>
        <label class="brain-view__slide">
          <span>LINK SPRINGS</span>
          <input v-model.number="linkSpring" type="range" min="0" max="1" step="0.01" />
          <em>{{ linkSpring.toFixed(2) }}</em>
        </label>
        <label class="brain-view__slide">
          <span>NODE SIZE</span>
          <input v-model.number="nodeSize" type="range" min="0.15" max="1" step="0.01" />
          <em>{{ nodeSize.toFixed(2) }}</em>
        </label>
        <div class="brain-view__row">
          <Button size="sm" variant="outline" :arrow="false" @click="collapsed = false">EXPAND ALL</Button>
          <Button size="sm" variant="outline" :arrow="false" @click="collapsed = true">COLLAPSE ALL</Button>
        </div>
        <Button size="sm" :arrow="false" @click="resetView">RESET VIEW</Button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.brain-map {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: transparent;
}

.graph-viewer-shell {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  background: #05030a;
  overflow: hidden;
}

.graph-viewer-shell--fill {
  height: 100%;
  container-type: size;
}

.brain-map-glow-wrap {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.brain-map-glow {
  width: 78cqmin;
  height: 78cqmin;
  pointer-events: none;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 50%, rgba(242, 107, 26, 0.22) 0 8%, transparent 18%),
    radial-gradient(circle at 50% 50%, transparent 18%, rgba(244, 114, 182, 0.12) 28%, transparent 38%),
    radial-gradient(circle at 50% 50%, transparent 38%, rgba(96, 165, 250, 0.12) 48%, transparent 58%),
    radial-gradient(circle at 50% 50%, transparent 58%, rgba(251, 191, 36, 0.1) 70%, transparent 82%);
  box-shadow:
    inset 0 0 0 1px rgba(242, 107, 26, 0.18),
    inset 0 0 80px rgba(232, 121, 249, 0.12);
  animation: brain-halo 28s linear infinite;
}

.graph-viewer-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 50% 50%, transparent 0 32%, rgba(242, 107, 26, 0.05) 32% 33%, transparent 34%),
    linear-gradient(to right, rgba(40, 24, 12, 0.55) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(40, 24, 12, 0.55) 1px, transparent 1px);
  background-size: auto, 24px 24px, 24px 24px;
  opacity: 0.55;
}

.graph-viewer-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.brain-map-pulses {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.brain-map-sectors {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.brain-map-sector {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-shadow: 0 0 12px currentColor;
}

.brain-view {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 16;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(268px, calc(100% - 24px));
  padding: 14px;
  background: rgba(8, 8, 12, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.brain-view__search {
  padding: 8px 10px;
  font-size: var(--text-small);
}

.brain-view__block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brain-view__label {
  margin: 0;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  color: var(--color-dim);
}

.brain-view__hint {
  margin: 0;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  color: var(--color-subtle);
  text-transform: none;
}

.brain-view__seg {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}

.brain-view__chip {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-subtle);
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 6px 4px;
  cursor: pointer;
}

.brain-view__chip--on {
  border-color: var(--color-ember);
  color: var(--color-ember);
  box-shadow: 0 0 10px rgba(242, 107, 26, 0.35);
}

.brain-view__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: var(--color-subtle);
}

.brain-view__check input {
  appearance: none;
  width: 14px;
  height: 14px;
  margin: 0;
  border: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
}

.brain-view__check input:checked {
  background: var(--color-ember);
  border-color: var(--color-ember);
  box-shadow: inset 0 0 0 2px #050505;
}

.brain-view__slide {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 8px;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: var(--color-dim);
}

.brain-view__slide input[type='range'] {
  grid-column: 1 / -1;
  width: 100%;
  accent-color: var(--color-ember);
}

.brain-view__slide em {
  font-style: normal;
  color: var(--color-ember);
}

.brain-view__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

@keyframes brain-halo {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .brain-map-glow {
    animation: none;
  }
}
</style>
