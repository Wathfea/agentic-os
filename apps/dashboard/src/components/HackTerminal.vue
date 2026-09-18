<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  active: boolean
  lines: string[]
}>()

const container = ref<HTMLElement | null>(null)
const animatedLines = ref<string[]>([])

const pool = [
  '> MOUNTING GRAPH MEMORY...',
  '> PARSING NODE CLUSTER 0xAF21...',
  '> TRACING DEPENDENCY EDGES...',
  '> SCANNING graphify-out/graph.json...',
  '> DECOMPILING MODULE GRAPH...',
  '> LINKING SEMANTIC NODES...',
  '> RUNNING BFS TRAVERSAL...',
  '> RESOLVING ALIAS MAP...',
  '> CURSOR AGENT HANDSHAKE...',
  '> READING GRAPH_REPORT.md...',
  '> INJECTING CONTEXT VECTORS...',
  '> COMPILING ANSWER PATH...',
]

let timer: ReturnType<typeof setInterval> | undefined

function scrollToBottom() {
  if (!container.value) return
  container.value.scrollTop = container.value.scrollHeight
}

watch(
  () => props.lines,
  () => {
    scrollToBottom()
  },
  { deep: true },
)

watch(
  () => props.active,
  (active) => {
    if (active && !timer) {
      timer = setInterval(() => {
        const next = pool[Math.floor(Math.random() * pool.length)]!
        animatedLines.value = [...animatedLines.value.slice(-8), next]
        scrollToBottom()
      }, 900)
    }
    if (!active && timer) {
      clearInterval(timer)
      timer = undefined
    }
  },
  { immediate: true },
)

onMounted(() => scrollToBottom())

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="border border-[var(--color-border)] bg-[var(--color-black)]">
    <div class="border-b border-[var(--color-border)] px-4 py-2 text-micro text-[var(--color-dim)]">
      // AGENT TERMINAL
    </div>
    <div
      ref="container"
      class="h-64 overflow-auto px-4 py-3 font-body text-small"
      style="background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 2px, transparent 2px, transparent 4px)"
    >
      <div v-for="(line, index) in animatedLines" :key="`a-${index}`" class="text-[var(--color-dim)]">
        {{ line }}
      </div>
      <div
        v-for="(line, index) in lines"
        :key="`l-${index}`"
        class="text-[var(--color-subtle)]"
        :class="line.startsWith('ERROR') || line.includes('error') ? 'text-[var(--color-danger)]' : ''"
      >
        {{ line }}
      </div>
      <div v-if="active" class="mt-2 text-[var(--color-ember)]">
        <span>_</span>
      </div>
    </div>
  </div>
</template>
