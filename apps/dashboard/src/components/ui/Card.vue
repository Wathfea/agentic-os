<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('border border-[var(--color-border)] bg-[var(--color-dark)]', $props.class)">
    <slot />
  </div>
</template>
