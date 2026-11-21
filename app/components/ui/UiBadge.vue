<script setup lang="ts">
defineProps<{ tone: Tone | { label: string, fg: string, bg: string } | undefined, label?: string }>()
</script>

<template>
  <span v-if="tone" class="badge" :style="{ color: tone.fg, background: tone.bg }"><slot>{{ label ?? tone.label }}</slot></span>
</template>
