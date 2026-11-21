<script setup lang="ts">
defineProps<{ title: string, subtitle?: string }>()
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div class="flex flex-col gap-1.5 min-w-0">
      <slot name="before" />
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="page-title">{{ title }}</h1>
        <slot name="badge" />
      </div>
      <p v-if="subtitle" class="page-sub">{{ subtitle }}</p>
      <slot name="meta" />
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-3">
      <slot name="actions" />
    </div>
  </header>
</template>
