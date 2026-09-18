<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  variant?: 'elevated' | 'recessed'
  label?: string
  count?: number
}>()
</script>

<template>
  <div
    :class="
      cn(
        'cybr-panel',
        variant === 'recessed' ? 'cybr-panel-recessed' : 'cybr-panel-elevated',
      )
    "
  >
    <div v-if="label" class="cybr-panel-header">
      <span>{{ label }}</span>
      <span v-if="count !== undefined" class="text-[var(--color-dim)]">{{ count }}</span>
    </div>
    <div :class="label ? 'cybr-panel-body' : 'cybr-panel-body cybr-panel-body-standalone'">
      <slot />
    </div>
  </div>
</template>
