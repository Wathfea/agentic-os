<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { ORBIT_ITEMS } from '@/lib/orbit'

const route = useRoute()

function isOn(to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <header class="command-page-bar">
    <RouterLink to="/" class="command-logo">
      <span class="command-logo__mark">⬡</span>
      <span class="command-logo__name">AGENTIC</span>
      <span class="command-logo__os">OS</span>
    </RouterLink>
    <nav class="command-page-sats" aria-label="Main navigation">
      <RouterLink
        v-for="item in ORBIT_ITEMS"
        :key="item.id"
        :to="item.to"
        class="command-sat command-sat--bar"
        :class="{ 'command-sat--on': isOn(item.to) }"
        :aria-current="isOn(item.to) ? 'page' : undefined"
        :aria-label="item.label"
      >
        <component :is="item.icon" :size="13" :stroke-width="1.4" />
        <span class="command-sat__label command-sat__label--bar">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </header>
</template>
