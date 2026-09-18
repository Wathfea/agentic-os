<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import cytoscape, { type Core } from 'cytoscape'
import { api } from '@/lib/api'

const props = withDefaults(
  defineProps<{
    projectId: string
    embedded?: boolean
    chrome?: boolean
    fill?: boolean
    tone?: 'acid' | 'ember'
  }>(),
  {
    chrome: true,
    fill: false,
    tone: 'ember',
  },
)

const container = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref('')
const stats = ref({ nodes: 0, edges: 0, totalNodes: 0, totalEdges: 0 })
let cy: Core | null = null
let ro: ResizeObserver | null = null

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const EMBER = ['#2dd4bf', '#f472b6', '#fbbf24', '#34d399', '#fb923c', '#60a5fa', '#e879f9', '#f43f5e', '#a3e635', '#38bdf8']

function colorFor(id: string, type: string) {
  if (props.tone !== 'ember') return '#111111'
  const s = `${type}:${id}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0
  return EMBER[Math.abs(h) % EMBER.length]
}

function nodeStyle(): cytoscape.Css.Node {
  if (props.tone === 'ember') {
    return {
      'background-color': 'data(color)',
      'background-opacity': 0.95,
      'border-width': 0,
      label: 'data(label)',
      color: '#f0f0f0',
      'font-family': 'IBM Plex Mono, monospace',
      'font-size': 8,
      'text-opacity': 0,
      width: 5,
      height: 5,
    }
  }
  return {
    'background-color': '#111111',
    'background-opacity': 1,
    'border-color': '#3d3d3d',
    'border-width': 1,
    label: 'data(label)',
    color: '#c8ff00',
    'font-family': 'IBM Plex Mono, monospace',
    'font-size': 9,
    'text-opacity': 0,
    'text-wrap': 'wrap',
    'text-max-width': '96px',
    'text-valign': 'bottom',
    'text-halign': 'center',
    'text-margin-y': 6,
    width: 10,
    height: 10,
  }
}

async function renderGraph() {
  if (!container.value) return
  if (!props.projectId) {
    loading.value = false
    error.value = ''
    cy?.destroy()
    cy = null
    return
  }
  loading.value = true
  error.value = ''

  await nextTick()

  try {
    const data = await api.getGraphJson(props.projectId)
    stats.value = {
      nodes: data.graph.nodes.length,
      edges: data.graph.edges.length,
      totalNodes: data.graph.nodeCount,
      totalEdges: data.graph.edgeCount,
    }

    if (cy) {
      cy.destroy()
      cy = null
    }

    await nextTick()

    const ember = props.tone === 'ember'
    const accent = ember ? '#f26b1a' : '#c8ff00'

    cy = cytoscape({
      container: container.value,
      elements: [
        ...data.graph.nodes.map((node) => ({
          data: {
            id: node.id,
            label: node.label,
            type: node.type ?? 'node',
            color: colorFor(node.id, node.type ?? 'node'),
          },
        })),
        ...data.graph.edges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label ?? '',
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: nodeStyle(),
        },
        {
          selector: 'edge',
          style: {
            width: ember ? 0.6 : 1,
            'line-color': ember ? 'rgba(255,255,255,0.12)' : '#3d3d3d',
            'target-arrow-color': ember ? 'rgba(255,255,255,0.12)' : '#3d3d3d',
            'target-arrow-shape': ember ? 'none' : 'triangle',
            'arrow-scale': 0.6,
            'curve-style': 'bezier',
            opacity: ember ? 0.35 : 0.45,
          },
        },
        {
          selector: 'node:selected, node.highlighted',
          style: {
            'border-color': accent,
            'border-width': 2,
            'background-color': ember ? accent : '#1a1a1a',
            width: ember ? 9 : 14,
            height: ember ? 9 : 14,
            'text-opacity': ember ? 0 : 1,
            'z-index': 10,
          },
        },
        {
          selector: 'edge:selected, edge.highlighted',
          style: {
            'line-color': accent,
            'target-arrow-color': accent,
            opacity: 0.9,
            width: ember ? 1 : 1.5,
            'z-index': 9,
          },
        },
        {
          selector: '.faded',
          style: {
            opacity: 0.08,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: !prefersReducedMotion,
        animationDuration: prefersReducedMotion ? 0 : 350,
        padding: ember ? 72 : 32,
        nodeRepulsion: ember ? 2800 : 6000,
        idealEdgeLength: ember ? 42 : 90,
        numIter: 500,
      },
      minZoom: 0.08,
      maxZoom: 4,
      wheelSensitivity: 0.25,
      boxSelectionEnabled: false,
    })

    cy.on('tap', 'node', (event) => {
      const node = event.target
      cy!.elements().removeClass('highlighted faded')
      node.addClass('highlighted')
      node.neighborhood().addClass('highlighted')
      cy!.elements().difference(node.closedNeighborhood()).addClass('faded')
    })

    cy.on('tap', (event) => {
      if (event.target === cy) {
        cy!.elements().removeClass('highlighted faded')
      }
    })

    cy.ready(() => {
      cy?.resize()
      cy?.fit(undefined, ember ? 64 : 48)
    })

    window.setTimeout(() => {
      cy?.resize()
      cy?.fit(undefined, ember ? 64 : 48)
    }, 120)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load graph'
  } finally {
    loading.value = false
  }
}

function fit() {
  cy?.resize()
  cy?.fit(undefined, props.tone === 'ember' ? 64 : 48)
}

watch(
  () => [props.projectId, props.tone],
  () => {
    void renderGraph()
  },
)

onMounted(() => {
  void renderGraph()
  if (container.value) {
    ro = new ResizeObserver(() => fit())
    ro.observe(container.value)
  }
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  cy?.destroy()
  cy = null
})
</script>

<template>
  <div
    :class="[
      'w-full bg-transparent',
      fill ? 'h-full' : '',
      chrome ? (embedded ? 'border-t border-[rgba(255,255,255,0.08)] bg-transparent' : 'border border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,10,0.9)]') : '',
    ]"
  >
    <div
      v-if="chrome"
      class="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.06)] px-4 py-2"
    >
      <span class="text-micro text-[var(--color-dim)]">
        RENDER {{ stats.nodes }}/{{ stats.totalNodes }} NODES · {{ stats.edges }}/{{ stats.totalEdges }} EDGES
      </span>
      <span v-if="loading" class="text-micro text-[var(--color-subtle)]">LOADING...</span>
      <span v-else class="text-micro text-[var(--color-dim)]">TAP NODE TO HIGHLIGHT</span>
    </div>
    <div v-if="error && chrome" class="px-4 py-6 text-small text-[var(--color-danger)]">> {{ error }}</div>
    <div class="graph-viewer-shell" :class="fill ? 'graph-viewer-shell--fill' : ''">
      <div v-if="chrome" class="graph-viewer-grid" aria-hidden="true" />
      <div
        ref="container"
        class="graph-viewer-canvas"
        :class="loading ? 'opacity-40' : 'opacity-100'"
      />
    </div>
  </div>
</template>

<style scoped>
.graph-viewer-shell {
  position: relative;
  width: 100%;
  height: 480px;
  background: transparent;
  overflow: hidden;
}

.graph-viewer-shell--fill {
  height: 100%;
  background: transparent;
}

.graph-viewer-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(26, 26, 26, 0.9) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(26, 26, 26, 0.9) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.35;
}

.graph-viewer-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
