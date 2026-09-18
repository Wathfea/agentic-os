<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  progress?: number
}>()
</script>

<template>
  <div class="border-b border-[rgba(255,255,255,0.06)] pb-4 last:border-b-0 last:pb-0">
    <div class="flex items-end justify-between gap-4">
      <span class="text-micro text-[var(--color-dim)]">{{ label }}</span>
      <span class="font-display text-[1.35rem] font-bold leading-none text-[#f6f6f6]">{{ value }}</span>
    </div>
    <div v-if="progress !== undefined" class="mt-3 h-1 bg-[var(--color-muted)]">
      <div
        class="h-full bg-[var(--color-ember)] transition-[width] duration-200"
        :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }"
      />
    </div>
  </div>
</template>
