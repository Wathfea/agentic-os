<script setup lang="ts">
import { useId } from 'vue'
import { RouterLink } from 'vue-router'
import GraphViewer from '@/components/GraphViewer.vue'
import type { OrbitItem } from '@/lib/orbit'

type GeoShape = { tag: 'ellipse' | 'polygon' | 'line'; attrs: Record<string, string> }

const GEODESIC: GeoShape[] = [
  { tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '46', ry: '46' } },
  { tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '46', ry: '16' } },
  { tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '46', ry: '30' } },
  { tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '16', ry: '46' } },
  { tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '30', ry: '46' } },
  { tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '46', ry: '22', transform: 'rotate(35 50 50)' } },
  { tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '46', ry: '22', transform: 'rotate(-35 50 50)' } },
  { tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '46', ry: '36', transform: 'rotate(70 50 50)' } },
  { tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '22', ry: '46', transform: 'rotate(20 50 50)' } },
  { tag: 'polygon', attrs: { points: '50,4 90,27 90,73 50,96 10,73 10,27' } },
  { tag: 'polygon', attrs: { points: '50,12 78,28 78,72 50,88 22,72 22,28' } },
  { tag: 'line', attrs: { x1: '50', y1: '4', x2: '50', y2: '96' } },
  { tag: 'line', attrs: { x1: '10', y1: '27', x2: '90', y2: '73' } },
  { tag: 'line', attrs: { x1: '10', y1: '73', x2: '90', y2: '27' } },
]

const glowId = `geo-glow-${useId()}`

const props = defineProps<{
  projectId: string
  subtitle: string
  items: OrbitItem[]
}>()

function geoStyle(index: number) {
  return {
    '--i': String(index),
    '--dur': `${(2.5 * (6 + ((index * 3.7) % 5))).toFixed(2)}s`,
  }
}

function orbitStyle(index: number) {
  const total = Math.max(props.items.length, 1)
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  const r = 46.8
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const labDx = dx
  const labDy = dy < -0.7 ? -dy : dy
  return {
    left: `${50 + r * Math.cos(angle)}%`,
    top: `${50 + r * Math.sin(angle)}%`,
    '--sat-dx': String(dx),
    '--sat-dy': String(dy),
    '--lab-dx': String(labDx),
    '--lab-dy': String(labDy),
  }
}
</script>

<template>
  <div class="command-stage">
    <div class="command-brand">
      <RouterLink to="/" class="command-logo">
        <span class="command-logo__mark">⬡</span>
        <span class="command-logo__name">AGENTIC</span>
        <span class="command-logo__os">OS</span>
      </RouterLink>
      <p class="command-brand__sub">{{ subtitle }}</p>
    </div>

    <div class="command-orbit">
      <div class="command-orbit__disc">
        <div class="command-orbit__halo" aria-hidden="true" />
        <div class="command-orbit__spin">
          <div class="command-orbit__breath">
            <svg class="command-geodesic" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <filter :id="glowId" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse">
                  <feGaussianBlur stdDeviation="1.1" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g class="command-geodesic__base">
                <component
                  v-for="(shape, index) in GEODESIC"
                  :key="index"
                  :is="shape.tag"
                  v-bind="shape.attrs"
                  pathLength="1"
                  :style="geoStyle(index)"
                />
              </g>
              <g class="command-geodesic__trace" :filter="`url(#${glowId})`">
                <component
                  v-for="(shape, index) in GEODESIC"
                  :key="index"
                  :is="shape.tag"
                  v-bind="shape.attrs"
                  pathLength="1"
                  :style="geoStyle(index)"
                />
              </g>
            </svg>
            <div class="command-orbit__core">
              <GraphViewer :project-id="projectId" :chrome="false" fill tone="ember" />
            </div>
          </div>
        </div>
        <RouterLink
          v-for="(item, index) in items"
          :key="item.id"
          :to="item.to"
          class="command-sat"
          active-class=""
          exact-active-class="command-sat--on"
          :style="orbitStyle(index)"
          :aria-label="item.label"
        >
          <component :is="item.icon" :size="13" :stroke-width="1.4" />
          <span class="command-sat__label">{{ item.label }}</span>
        </RouterLink>
        <RouterLink to="/brain" class="command-brain-cta">Click to open Second Brain</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.command-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  min-height: 0;
  padding: 20px 16px 16px;
}

.command-brand {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.command-logo {
  display: flex;
  align-items: baseline;
  gap: 8px;
  text-decoration: none;
  color: inherit;
}

.command-logo__mark {
  color: var(--color-ember);
  font-size: 1.15rem;
}

.command-logo__name {
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-ember);
}

.command-logo__os {
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: #f3f3f3;
}

.command-brand__sub {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #8a8a8a;
}

.command-orbit {
  position: relative;
  flex: 1;
  align-self: stretch;
  min-height: 0;
  width: 100%;
  display: grid;
  place-items: center;
  container-type: size;
}

.command-orbit__disc {
  position: relative;
  width: min(100cqw, 100cqh);
  height: min(100cqw, 100cqh);
}

.command-orbit__halo {
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  animation: command-breath 5.6s ease-in-out infinite;
}

.command-orbit__spin {
  position: absolute;
  inset: 0;
  animation: command-spin 96s linear infinite;
}

.command-orbit__breath {
  position: absolute;
  inset: 0;
  animation: command-breath 5.6s ease-in-out infinite;
}

.command-geodesic {
  position: absolute;
  inset: 16%;
  fill: none;
  stroke: rgba(220, 220, 220, 0.22);
  stroke-width: 0.35;
  pointer-events: none;
  z-index: 2;
  overflow: visible;
}

.command-geodesic__base > * {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: geo-draw 1.6s cubic-bezier(0.35, 0.75, 0.3, 1) calc(var(--i) * 70ms) forwards;
}

.command-geodesic__trace > * {
  stroke: var(--color-ember);
  stroke-width: 0.45;
  stroke-linecap: round;
  stroke-dasharray: 0.07 2.43;
  stroke-dashoffset: 2.5;
  opacity: 0;
  animation:
    geo-comet var(--dur) linear calc(1.7s + var(--i) * 0.53s) infinite,
    geo-comet-in 0.6s ease-out calc(1.7s + var(--i) * 0.53s) forwards;
}

.command-orbit__core {
  position: absolute;
  inset: 20%;
  border-radius: 50%;
  overflow: hidden;
  z-index: 1;
  pointer-events: none;
}

.command-sat {
  position: absolute;
  z-index: 4;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  margin: -19px 0 0 -19px;
  color: #d7d7d7;
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  text-decoration: none;
  box-shadow: 0 0 0 4px #070707;
}

.command-sat:hover,
.command-sat--on {
  color: var(--color-ember);
  border-color: var(--color-ember);
}

.command-sat__label {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%)
    translate(calc(var(--lab-dx) * 30px), calc(var(--lab-dy) * 30px))
    translate(calc(var(--lab-dx) * 50%), calc(var(--lab-dy) * 50%));
  font-family: var(--font-display);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #cfcfcf;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  padding: 2px 6px;
  background: rgba(7, 7, 7, 0.82);
  text-shadow: 0 0 10px #070707, 0 1px 2px #070707;
  transition: opacity 0.12s ease;
}

.command-orbit:has(.command-sat:hover) .command-sat__label,
.command-sat:focus-visible .command-sat__label {
  opacity: 1;
}

.command-sat:hover .command-sat__label,
.command-sat:focus-visible .command-sat__label {
  color: var(--color-ember);
}

.command-brain-cta {
  position: absolute;
  left: 50%;
  bottom: 10px;
  z-index: 4;
  transform: translateX(-50%);
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--color-ember);
}

@keyframes command-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes command-breath {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}

@keyframes geo-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes geo-comet {
  from {
    stroke-dashoffset: 2.5;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes geo-comet-in {
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .command-orbit__spin,
  .command-orbit__breath,
  .command-orbit__halo,
  .command-geodesic__base > * {
    animation: none;
  }

  .command-geodesic__base > * {
    stroke-dashoffset: 0;
  }

  .command-geodesic__trace {
    display: none;
  }
}

@media (max-width: 900px), (max-height: 700px) {
  .command-stage {
    padding: 12px 8px 8px;
  }

  .command-brand {
    margin-bottom: 0;
    gap: 2px;
  }

  .command-logo__name,
  .command-logo__os {
    font-size: 1.25rem;
  }

  .command-sat {
    width: 32px;
    height: 32px;
    margin: -16px 0 0 -16px;
  }
}
</style>
