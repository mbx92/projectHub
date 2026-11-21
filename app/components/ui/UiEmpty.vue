<script setup lang="ts">
defineProps<{ title: string, text?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center gap-2 py-10 px-4">
    <span class="w-11 h-11 rounded-full bg-soft-2 flex items-center justify-center text-muted" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
    </span>
    <p class="m-0 text-sm font-semibold">{{ title }}</p>
    <p v-if="text" class="m-0 text-sm text-muted max-w-md">{{ text }}</p>
    <slot />
  </div>
</template>
