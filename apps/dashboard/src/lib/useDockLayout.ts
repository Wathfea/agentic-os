import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  type DockLayout,
  type PanelId,
  PANEL_LABELS,
  closedPanelIds,
  closePanel,
  defaultLayout,
  movePanel,
  openPanel,
  parseLayout,
  raisePanel,
  resizePanel,
} from './dock'

const STORAGE_KEY = 'agentic.command-dock.v2'

export function useDockLayout() {
  const layout = ref<DockLayout>(defaultLayout(1440, 900))
  const labels = PANEL_LABELS
  const hidden = computed(() => closedPanelIds(layout.value))

  function viewport() {
    return { vw: window.innerWidth, vh: window.innerHeight }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout.value))
  }

  function apply(next: DockLayout) {
    layout.value = next
    persist()
  }

  function onResize() {
    const { vw, vh } = viewport()
    layout.value = parseLayout(JSON.stringify(layout.value), vw, vh)
  }

  onMounted(() => {
    const { vw, vh } = viewport()
    const raw = localStorage.getItem(STORAGE_KEY)
    layout.value = raw ? parseLayout(raw, vw, vh) : defaultLayout(vw, vh)
    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
  })

  return {
    layout,
    hidden,
    labels,
    close(id: PanelId) {
      apply(closePanel(layout.value, id))
    },
    open(id: PanelId) {
      const { vw, vh } = viewport()
      apply(openPanel(layout.value, id, vw, vh))
    },
    raise(id: PanelId) {
      apply(raisePanel(layout.value, id))
    },
    move(id: PanelId, x: number, y: number) {
      const { vw, vh } = viewport()
      apply(movePanel(layout.value, id, x, y, vw, vh))
    },
    resize(id: PanelId, w: number, h: number) {
      const { vw, vh } = viewport()
      apply(resizePanel(layout.value, id, w, h, vw, vh))
    },
  }
}
