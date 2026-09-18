<script setup lang="ts">
defineProps<{
  id?: string
  label: string
}>()
</script>

<template>
  <section class="cybr-section">
    <div class="cybr-section-header">
      <span v-if="id" class="cybr-section-id">{{ id }}</span>
      <span class="cybr-section-label">{{ label }}</span>
    </div>
    <div class="cybr-section-body">
      <slot />
    </div>
  </section>
</template>
