<script setup lang="ts">
defineProps<{
  code: string
  title: string
  description?: string
}>()
</script>

<template>
  <header class="command-page-intro">
    <p class="command-page-code">{{ code }}</p>
    <h1 class="command-page-title">{{ title }}</h1>
    <p v-if="description" class="command-page-desc">{{ description }}</p>
  </header>
</template>
