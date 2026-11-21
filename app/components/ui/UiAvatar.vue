<script setup lang="ts">
const props = withDefaults(defineProps<{ name: string | null | undefined, color?: string | null, size?: number, ring?: boolean }>(), { size: 32 })
const bg = computed(() => avatarColor(props.name, props.color))
</script>

<template>
  <span
    :title="name ?? ''"
    class="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0"
    :class="ring && 'border-2 border-white -mr-1.5'"
    :style="{ width: `${size}px`, height: `${size}px`, background: bg, fontSize: `${Math.round(size * 0.36)}px` }"
  >
    <span aria-hidden="true">{{ initials(name) }}</span>
    <span class="sr-only">{{ name }}</span>
  </span>
</template>
