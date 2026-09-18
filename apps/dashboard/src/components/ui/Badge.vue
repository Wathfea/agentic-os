<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  variant?: 'default' | 'success' | 'info' | 'warning' | 'error' | 'muted'
}>()
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center border px-2 py-0.5 font-body text-[0.625rem] uppercase tracking-widest',
        variant === 'success' && 'border-[var(--color-ember)] text-[var(--color-ember)]',
        variant === 'info' && 'border-[rgba(255,255,255,0.18)] text-[var(--color-white)]',
        variant === 'warning' && 'border-[var(--color-dim)] text-[var(--color-subtle)]',
        variant === 'error' && 'border-[var(--color-danger)] text-[var(--color-danger)]',
        variant === 'muted' && 'border-[rgba(255,255,255,0.08)] text-[var(--color-dim)]',
        (!variant || variant === 'default') && 'border-[var(--color-ember)] text-[var(--color-ember)]',
      )
    "
  >
    <slot />
  </span>
</template>
