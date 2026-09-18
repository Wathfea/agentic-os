<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  open: boolean
  projectName: string
  phase: 'starting' | 'running' | 'done' | 'error'
  errorMessage?: string
  logs: string
}>()

const emit = defineEmits<{
  close: []
}>()

const logEl = ref<HTMLElement | null>(null)

function scrollLogs() {
  nextTick(() => {
    if (!logEl.value) return
    logEl.value.scrollTop = logEl.value.scrollHeight
  })
}

watch(() => props.logs, scrollLogs)
watch(() => props.phase, scrollLogs)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.phase !== 'running' && props.phase !== 'starting') {
    emit('close')
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', onKeydown)
      scrollLogs()
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,10,10,0.92)] p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="`Building ${projectName}`"
    >
      <div class="flex max-h-[90vh] w-full max-w-3xl flex-col border border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,10,0.96)]">
        <div class="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
          <p class="text-micro text-[var(--color-dim)]">GRAPH BUILD</p>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-display text-sm font-bold uppercase tracking-widest text-[var(--color-ember)]">
              {{ projectName }}
            </h2>
            <span
              class="font-display text-micro uppercase tracking-wider"
              :class="
                phase === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ember)]'
              "
            >
              {{
                phase === 'starting'
                  ? 'INITIALIZING...'
                  : phase === 'running'
                    ? 'BUILDING...'
                    : phase === 'done'
                      ? 'COMPLETE'
                      : 'FAILED'
              }}
            </span>
          </div>
          <div
            v-if="phase === 'starting' || phase === 'running'"
            class="mt-4 h-1 overflow-hidden bg-[var(--color-muted)]"
          >
            <div class="cybr-build-bar h-full bg-[var(--color-ember)]" />
          </div>
        </div>

        <p
          v-if="phase === 'error' && errorMessage"
          class="border-b border-[var(--color-danger)] bg-[rgba(255,42,42,0.08)] px-6 py-4 text-small text-[var(--color-danger)]"
        >
          {{ errorMessage }}
        </p>

        <div ref="logEl" class="min-h-48 flex-1 overflow-auto px-6 py-4">
          <pre class="cybr-log max-h-none border-0 bg-transparent p-0">{{ logs || (phase === 'starting' ? 'QUEUED...\n' : 'WAITING FOR OUTPUT...\n') }}</pre>
        </div>

        <div class="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <Button
            v-if="phase === 'done' || phase === 'error'"
            size="sm"
            :arrow="false"
            @click="emit('close')"
          >
            {{ phase === 'done' ? 'DONE' : 'CLOSE' }}
          </Button>
          <p v-else class="text-micro text-[var(--color-dim)]">BUILD IN PROGRESS — DO NOT CLOSE</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cybr-build-bar {
  width: 40%;
  animation: cybr-build-slide 1.2s ease-in-out infinite;
}

@keyframes cybr-build-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cybr-build-bar {
    animation: none;
    width: 100%;
  }
}
</style>
