<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  label: string
  x: number
  y: number
  w: number
  h: number
  z: number
  fixed?: boolean
}>()

const emit = defineEmits<{
  close: []
  raise: []
  move: [x: number, y: number]
  resize: [w: number, h: number]
}>()

const root = ref<HTMLElement | null>(null)
let drag: { ox: number; oy: number } | null = null
let sizing: { ow: number; oh: number; px: number; py: number } | null = null

function capture(e: PointerEvent) {
  root.value?.setPointerCapture(e.pointerId)
  emit('raise')
}

function onDragStart(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  drag = { ox: e.clientX - props.x, oy: e.clientY - props.y }
  sizing = null
  capture(e)
}

function onResizeStart(e: PointerEvent) {
  e.stopPropagation()
  sizing = { ow: props.w, oh: props.h, px: e.clientX, py: e.clientY }
  drag = null
  capture(e)
}

function onPointerMove(e: PointerEvent) {
  if (drag) {
    emit('move', e.clientX - drag.ox, e.clientY - drag.oy)
    return
  }
  if (sizing) {
    emit('resize', sizing.ow + (e.clientX - sizing.px), sizing.oh + (e.clientY - sizing.py))
  }
}

function onPointerUp() {
  drag = null
  sizing = null
}
</script>

<template>
  <section
    ref="root"
    class="dock-panel"
    :class="{ 'dock-panel--fixed': fixed }"
    :style="{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, zIndex: z }"
    @pointerdown="emit('raise')"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <header class="dock-panel__head" @pointerdown="onDragStart">
      <span>{{ label }}</span>
      <button type="button" class="dock-panel__close" :aria-label="`Close ${label}`" @pointerdown.stop="emit('close')">
        <X :size="12" :stroke-width="2" />
      </button>
    </header>
    <div class="dock-panel__body">
      <slot />
    </div>
    <div class="dock-panel__resize" aria-hidden="true" @pointerdown="onResizeStart" />
  </section>
</template>

<style scoped>
.dock-panel {
  position: absolute;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: rgba(10, 10, 10, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.dock-panel--fixed {
  position: fixed;
}

.dock-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #f4f4f4;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.dock-panel__head span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dock-panel__head:active {
  cursor: grabbing;
}

.dock-panel__close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  background: none;
  color: #7a7a7a;
  cursor: pointer;
}

.dock-panel__close:hover {
  color: var(--color-ember);
}

.dock-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px 16px;
}

@media (max-width: 900px), (max-height: 700px) {
  .dock-panel__head {
    padding: 6px 10px;
    font-size: 0.72rem;
  }

  .dock-panel__body {
    padding: 8px 10px 12px;
  }
}

.dock-panel__resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  touch-action: none;
}

.dock-panel__resize::after {
  content: '';
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 8px;
  height: 8px;
  border-right: 1px solid rgba(255, 255, 255, 0.28);
  border-bottom: 1px solid rgba(255, 255, 255, 0.28);
}
</style>
