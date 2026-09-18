<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import Section from '@/components/ui/Section.vue'
import DataReadout from '@/components/ui/DataReadout.vue'
import Button from '@/components/ui/Button.vue'
import SystemMessage from '@/components/ui/SystemMessage.vue'
import HackTerminal from '@/components/HackTerminal.vue'
import BrainMap from '@/components/BrainMap.vue'
import DockPanel from '@/components/DockPanel.vue'
import { api, streamBrain, BRAIN_QUERY_EXAMPLES, type BrainGraph } from '@/lib/api'
import { clampRect, GRID_Y, snapOpenRect, type PanelRect } from '@/lib/dock'
import { renderWikiMarkdown, resolveWikiTarget } from '@/lib/wiki-markdown'

const EMPTY_GRAPH: BrainGraph = { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 }

const queryClient = useQueryClient()
const status = useQuery({ queryKey: ['brain-status'], queryFn: () => api.brainStatus(), refetchInterval: 30000 })
const graphQuery = useQuery({ queryKey: ['brain-graph'], queryFn: () => api.brainGraph() })

const selectedId = ref<string | null>(null)
const focusId = ref<string | null>(null)
const openPath = ref<string | null>(null)
const drawerOpen = ref(false)
const inspectorRect = ref<PanelRect | null>(null)
const readerRect = ref<PanelRect | null>(null)

const graph = computed(() => graphQuery.data.value?.graph ?? EMPTY_GRAPH)
const selectedNode = computed(() => graph.value.nodes.find((n) => n.id === selectedId.value) ?? null)
const neighbors = computed(() => {
  const data = graph.value
  if (!selectedId.value) return []
  const ids = new Set<string>()
  for (const edge of data.edges) {
    if (edge.source === selectedId.value) ids.add(edge.target)
    if (edge.target === selectedId.value) ids.add(edge.source)
  }
  return data.nodes.filter((n) => ids.has(n.id))
})

const pageQuery = useQuery({
  queryKey: computed(() => ['brain-page', openPath.value]),
  queryFn: () => api.brainPage(openPath.value!),
  enabled: computed(() => !!openPath.value),
})

const vaultMissing = computed(() => status.data.value?.status.exists === false)
const graphError = computed(() => {
  const err = graphQuery.error.value
  return err instanceof Error ? err.message : err ? String(err) : ''
})
const pageError = computed(() => {
  const err = pageQuery.error.value
  return err instanceof Error ? err.message : err ? String(err) : ''
})
const page = computed(() => pageQuery.data.value?.page ?? null)
const pageHtml = computed(() => (page.value ? renderWikiMarkdown(page.value.body).html : ''))

const ingestUrl = ref('')
const ingestNote = ref('')
const question = ref('')

const result = ref('')
const terminalLines = ref<string[]>([])
const terminalActive = ref(false)

function pushLine(line: string) {
  terminalLines.value.push(`> ${line}`)
}

function resetStream() {
  result.value = ''
  terminalLines.value = []
  terminalActive.value = true
}

function handleEvent(event: { type: string; message?: string; delta?: string }) {
  if (event.type === 'boot' && event.message) pushLine(event.message)
  if (event.type === 'log' && event.message) pushLine(event.message)
  if (event.type === 'delta' && event.delta) result.value += event.delta
  if (event.type === 'done' && event.message && !result.value) result.value = event.message
  if (event.type === 'error' && event.message) pushLine(`ERROR: ${event.message}`)
}

const ingestMutation = useMutation({
  mutationFn: () => {
    resetStream()
    return streamBrain('ingest', { url: ingestUrl.value.trim(), note: ingestNote.value.trim() || undefined }, handleEvent)
  },
  onSuccess: () => {
    terminalActive.value = false
    ingestUrl.value = ''
    ingestNote.value = ''
    void queryClient.invalidateQueries({ queryKey: ['brain-status'] })
    void queryClient.invalidateQueries({ queryKey: ['brain-graph'] })
  },
  onError: (e: Error) => {
    terminalActive.value = false
    pushLine(`ERROR: ${e.message}`)
  },
})

const queryMutation = useMutation({
  mutationFn: () => {
    resetStream()
    return streamBrain('query', { question: question.value.trim() }, handleEvent)
  },
  onSuccess: (answer) => {
    terminalActive.value = false
    if (!result.value) result.value = answer
  },
  onError: (e: Error) => {
    terminalActive.value = false
    pushLine(`ERROR: ${e.message}`)
  },
})

const lintMutation = useMutation({
  mutationFn: () => {
    resetStream()
    return streamBrain('lint', {}, handleEvent)
  },
  onSuccess: () => {
    terminalActive.value = false
    void queryClient.invalidateQueries({ queryKey: ['brain-status'] })
    void queryClient.invalidateQueries({ queryKey: ['brain-graph'] })
  },
  onError: (e: Error) => {
    terminalActive.value = false
    pushLine(`ERROR: ${e.message}`)
  },
})

const mirrorMutation = useMutation({
  mutationFn: () => api.mirrorProjects(),
  onSuccess: (data) => {
    pushLine(`MIRRORED ${data.result.mirrored} PROJECT(S)`)
    void queryClient.invalidateQueries({ queryKey: ['brain-status'] })
    void queryClient.invalidateQueries({ queryKey: ['brain-graph'] })
  },
  onError: (e: Error) => pushLine(`ERROR: ${e.message}`),
})

const busy = () =>
  ingestMutation.isPending.value ||
  queryMutation.isPending.value ||
  lintMutation.isPending.value

function applyExample(example: string) {
  question.value = example
}

function viewport() {
  return { vw: window.innerWidth, vh: window.innerHeight }
}

function gridTop() {
  const bar = document.querySelector('.command-page-bar')
  const bottom = bar instanceof HTMLElement ? bar.getBoundingClientRect().bottom : GRID_Y * 8
  return bottom + GRID_Y
}

function nextZ() {
  return Math.max(8, inspectorRect.value?.z ?? 0, readerRect.value?.z ?? 0) + 1
}

function placeWindow(side: 'left' | 'right', current: PanelRect | null, size: { w: number; h: number }) {
  if (current) return { ...current, z: nextZ() }
  const { vw, vh } = viewport()
  const rect = snapOpenRect(vw, vh, { side, w: size.w, h: size.h, z: nextZ(), top: gridTop() })
  if (side === 'right') {
    return clampRect({ ...rect, x: vw - rect.w - 292 }, vw, vh)
  }
  return rect
}

function moveWindow(current: PanelRect | null, x: number, y: number) {
  if (!current) return current
  const { vw, vh } = viewport()
  return clampRect({ ...current, x, y }, vw, vh)
}

function resizeWindow(current: PanelRect | null, w: number, h: number) {
  if (!current) return current
  const { vw, vh } = viewport()
  return clampRect({ ...current, w, h }, vw, vh)
}

function onSelect(id: string | null) {
  selectedId.value = id
}

function onOpen(id: string) {
  selectedId.value = id
  openPath.value = id
  readerRect.value = placeWindow('right', readerRect.value, { w: Math.min(416, window.innerWidth * 0.34), h: Math.min(window.innerHeight * 0.78, 720) })
}

async function flyTo(id: string) {
  focusId.value = null
  await nextTick()
  focusId.value = id
}

function openSelected() {
  if (!selectedNode.value) return
  onOpen(selectedNode.value.path)
}

function closeInspector() {
  selectedId.value = null
  inspectorRect.value = null
}

function closeReader() {
  openPath.value = null
  readerRect.value = null
}

function onWikiClick(event: MouseEvent) {
  const el = (event.target as HTMLElement | null)?.closest('a[data-wiki]')
  if (!el) return
  event.preventDefault()
  const target = el.getAttribute('data-wiki')
  if (!target) return
  const id = resolveWikiTarget(target, graph.value.nodes)
  if (!id) return
  onOpen(id)
  void flyTo(id)
}

watch(selectedId, (id) => {
  if (!id) return
  inspectorRect.value = placeWindow('left', inspectorRect.value, {
    w: Math.min(312, window.innerWidth * 0.24),
    h: Math.min(window.innerHeight * 0.62, 480),
  })
})

function onStageResize() {
  const { vw, vh } = viewport()
  if (inspectorRect.value) inspectorRect.value = clampRect(inspectorRect.value, vw, vh)
  if (readerRect.value) readerRect.value = clampRect(readerRect.value, vw, vh)
}

onMounted(() => {
  window.addEventListener('resize', onStageResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onStageResize)
})

function selectNeighbor(id: string) {
  selectedId.value = id
  void flyTo(id)
}
</script>

<template>
  <div class="brain-stage">
    <BrainMap
      :graph="graph"
      :selected-id="selectedId"
      :focus-id="focusId"
      :loading="graphQuery.isPending.value"
      :error="graphError"
      :vault-missing="vaultMissing"
      @select="onSelect"
      @open="onOpen"
    />

    <DockPanel
      v-if="selectedNode && inspectorRect"
      :label="selectedNode.label"
      :x="inspectorRect.x"
      :y="inspectorRect.y"
      :w="inspectorRect.w"
      :h="inspectorRect.h"
      :z="inspectorRect.z"
      fixed
      @close="closeInspector"
      @raise="inspectorRect = placeWindow('left', inspectorRect, { w: inspectorRect.w, h: inspectorRect.h })"
      @move="(x, y) => (inspectorRect = moveWindow(inspectorRect, x, y))"
      @resize="(w, h) => (inspectorRect = resizeWindow(inspectorRect, w, h))"
    >
      <div class="space-y-3">
        <dl class="brain-meta">
          <div>
            <dt class="text-micro text-[var(--color-dim)]">LAYER</dt>
            <dd>{{ selectedNode.layer }}</dd>
          </div>
          <div>
            <dt class="text-micro text-[var(--color-dim)]">PATH</dt>
            <dd>{{ selectedNode.path }}</dd>
          </div>
          <div>
            <dt class="text-micro text-[var(--color-dim)]">BYTES</dt>
            <dd>{{ selectedNode.bytes }}</dd>
          </div>
        </dl>
        <div class="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" :arrow="false" @click="flyTo(selectedNode.id)">FLY TO</Button>
          <Button size="sm" @click="openSelected">OPEN</Button>
        </div>
        <div>
          <p class="text-micro text-[var(--color-dim)]">NEIGHBORS {{ neighbors.length }}</p>
          <ul v-if="neighbors.length" class="mt-2 space-y-1">
            <li v-for="node in neighbors" :key="node.id">
              <button type="button" class="cybr-list-item w-full text-left" @click="selectNeighbor(node.id)">
                <span class="cybr-content-title">{{ node.label }}</span>
                <span class="text-micro text-[var(--color-dim)]">{{ node.layer }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="mt-2 text-micro text-[var(--color-dim)]">NONE</p>
        </div>
      </div>
    </DockPanel>

    <DockPanel
      v-if="openPath && readerRect"
      :label="page?.title ?? openPath"
      :x="readerRect.x"
      :y="readerRect.y"
      :w="readerRect.w"
      :h="readerRect.h"
      :z="readerRect.z"
      fixed
      @close="closeReader"
      @raise="readerRect = placeWindow('right', readerRect, { w: readerRect.w, h: readerRect.h })"
      @move="(x, y) => (readerRect = moveWindow(readerRect, x, y))"
      @resize="(w, h) => (readerRect = resizeWindow(readerRect, w, h))"
    >
      <p v-if="pageQuery.isPending.value" class="text-micro text-[var(--color-subtle)]">LOADING...</p>
      <SystemMessage v-else-if="pageError" variant="error">{{ pageError }}</SystemMessage>
      <div v-else-if="page" class="wiki-prose" @click="onWikiClick" v-html="pageHtml" />
    </DockPanel>

    <div class="brain-ops-toggle">
      <Button size="sm" variant="outline" :arrow="false" @click="drawerOpen = !drawerOpen">
        {{ drawerOpen ? 'CLOSE OPS' : 'OPS' }}
      </Button>
    </div>

    <aside v-if="drawerOpen" class="brain-ops-drawer">
      <Section id="/01" label="VAULT READOUT">
        <div class="grid gap-6 md:grid-cols-2">
          <DataReadout label="WIKI PAGES" :value="status.data.value?.status.wikiPages ?? '—'" />
          <DataReadout label="SOURCES" :value="status.data.value?.status.sourcePages ?? '—'" />
          <DataReadout label="ENTITIES" :value="status.data.value?.status.entityPages ?? '—'" />
          <DataReadout label="CONCEPTS" :value="status.data.value?.status.conceptPages ?? '—'" />
          <DataReadout label="RAW SOURCES" :value="status.data.value?.status.rawSources ?? '—'" />
          <DataReadout label="ORPHAN PAGES" :value="status.data.value?.status.orphanPages ?? '—'" />
          <DataReadout label="MIRRORED PROJECTS" :value="status.data.value?.status.mirroredProjects ?? '—'" />
          <DataReadout label="VAULT" :value="status.data.value?.status.exists ? 'ONLINE' : 'MISSING'" />
        </div>
        <SystemMessage variant="default" class="text-micro">
          LAST INGEST: {{ status.data.value?.status.lastIngest ?? 'NONE' }} // LAST LINT:
          {{ status.data.value?.status.lastLint ?? 'NONE' }}
        </SystemMessage>
      </Section>

      <Section id="/02" label="INGEST SOURCE">
        <div class="space-y-4">
          <input v-model="ingestUrl" placeholder="SOURCE URL (https://...)" class="cybr-input" />
          <input v-model="ingestNote" placeholder="OPTIONAL NOTE / WHY THIS MATTERS" class="cybr-input" />
          <Button :disabled="!ingestUrl.trim() || busy()" @click="ingestMutation.mutate()">
            INGEST INTO BRAIN
          </Button>
        </div>
      </Section>

      <Section id="/03" label="QUERY BRAIN">
        <div class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="example in BRAIN_QUERY_EXAMPLES"
              :key="example"
              size="sm"
              variant="outline"
              :arrow="false"
              @click="applyExample(example)"
            >
              {{ example.length > 42 ? `${example.slice(0, 42)}…` : example }}
            </Button>
          </div>
          <input
            v-model="question"
            placeholder="ASK YOUR SECOND BRAIN"
            class="cybr-input"
            @keydown.enter="question.trim() && !busy() && queryMutation.mutate()"
          />
          <Button :disabled="!question.trim() || busy()" @click="queryMutation.mutate()">
            QUERY BRAIN
          </Button>
        </div>
      </Section>

      <Section id="/04" label="MAINTENANCE">
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" :disabled="busy()" @click="lintMutation.mutate()">
            LINT VAULT
          </Button>
          <Button
            variant="outline"
            :disabled="mirrorMutation.isPending.value"
            @click="mirrorMutation.mutate()"
          >
            {{ mirrorMutation.isPending.value ? 'MIRRORING...' : 'MIRROR PROJECT GRAPHS' }}
          </Button>
        </div>
      </Section>

      <Section v-if="terminalActive || terminalLines.length" label="AGENT TERMINAL">
        <HackTerminal :active="terminalActive" :lines="terminalLines" />
      </Section>

      <Section v-if="result" label="OUTPUT">
        <pre class="cybr-log max-h-none">{{ result }}</pre>
      </Section>
    </aside>
  </div>
</template>

<style scoped>
.brain-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.brain-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
}

.brain-meta dd {
  margin: 4px 0 0;
  font-size: var(--text-small);
  color: var(--color-white);
  word-break: break-all;
}

.brain-ops-toggle {
  position: absolute;
  right: 292px;
  bottom: 12px;
  z-index: 22;
}

.brain-ops-drawer {
  position: absolute;
  right: 292px;
  bottom: 56px;
  z-index: 21;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(560px, calc(100% - 24px));
  max-height: min(70vh, calc(100% - 72px));
  overflow: auto;
  padding: 12px;
  background: rgba(10, 10, 10, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
