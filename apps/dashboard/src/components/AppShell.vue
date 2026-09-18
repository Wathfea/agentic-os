<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import CommandNav from '@/components/CommandNav.vue'

const route = useRoute()
const isHome = computed(() => route.path === '/')
const isMap = computed(() => route.path === '/brain')
const hexCursor = ref({ x: 0, y: 0, show: false, down: false })

function moveHexCursor(event: PointerEvent) {
  hexCursor.value.x = event.clientX
  hexCursor.value.y = event.clientY
  hexCursor.value.show = true
}

function hexCursorDown() {
  hexCursor.value.down = true
}

function hexCursorUp() {
  hexCursor.value.down = false
}

onMounted(() => {
  window.addEventListener('pointerup', hexCursorUp)
})

onUnmounted(() => {
  window.removeEventListener('pointerup', hexCursorUp)
})
</script>

<template>
  <div
    class="command-app"
    :class="isHome ? '' : 'command-app--page'"
    @pointermove="moveHexCursor"
    @pointerdown="hexCursorDown"
    @pointerleave="hexCursor.show = false"
  >
    <svg
      v-show="hexCursor.show"
      class="hex-cursor"
      :class="{ 'hex-cursor--solid': hexCursor.down }"
      :style="{ left: `${hexCursor.x}px`, top: `${hexCursor.y}px` }"
      viewBox="0 0 18 20"
      width="18"
      height="20"
      aria-hidden="true"
    >
      <polygon points="9,1.2 16.6,5.4 16.6,14.6 9,18.8 1.4,14.6 1.4,5.4" />
    </svg>
    <CommandNav v-if="!isHome" />
    <main
      :class="isHome ? 'command-app__main' : isMap ? 'command-app__page command-app__page--map' : 'command-app__page'"
    >
      <RouterView v-slot="{ Component }">
        <component
          :is="Component"
          :class="isHome ? '' : isMap ? 'h-full w-full min-h-0' : 'cybr-page-enter w-full'"
        />
      </RouterView>
    </main>
  </div>
</template>
