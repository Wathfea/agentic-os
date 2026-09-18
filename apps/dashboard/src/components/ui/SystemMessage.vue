<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  variant?: 'default' | 'action' | 'error' | 'success'
}>()
</script>

<template>
  <p
    :class="
      cn(
        'cybr-prompt text-small',
        variant === 'action' && 'cybr-prompt-action',
        variant === 'error' && 'cybr-prompt-error',
        variant === 'success' && 'cybr-prompt-success',
        (!variant || variant === 'default') && 'cybr-prompt-default',
      )
    "
  >
    <slot />
  </p>
</template>
