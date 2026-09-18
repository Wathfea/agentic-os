<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md'
  disabled?: boolean
  type?: 'button' | 'submit'
  arrow?: boolean
}>()
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled"
    :class="
      cn(
        'inline-flex items-center justify-center gap-2 font-display font-medium uppercase tracking-wider transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-30',
        size === 'sm' ? 'px-3 py-2 text-[0.6875rem]' : 'px-6 py-3 text-[0.75rem]',
        variant === 'outline' &&
          'border border-[var(--color-border)] bg-transparent text-[var(--color-white)] hover:border-[var(--color-ember)] hover:text-[var(--color-ember)]',
        variant === 'ghost' &&
          'border border-[var(--color-border)] bg-transparent text-[var(--color-subtle)] hover:border-[var(--color-white)] hover:text-[var(--color-white)]',
        variant === 'destructive' &&
          'border border-[var(--color-danger)] bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-[var(--color-black)]',
        (!variant || variant === 'default') &&
          'border border-[var(--color-ember)] bg-[var(--color-ember)] text-[var(--color-black)] hover:bg-[var(--color-black)] hover:text-[var(--color-ember)]',
      )
    "
  >
    <slot />
    <span v-if="(!variant || variant === 'default') && arrow !== false" aria-hidden="true">↗</span>
  </button>
</template>
