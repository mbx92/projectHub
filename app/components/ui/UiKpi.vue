<script setup lang="ts">
defineProps<{ label: string, value: string | number, sub?: string, color?: string }>()
</script>

<template>
  <div class="kpi">
    <span class="kpi-label">{{ label }}</span>
    <span class="kpi-value" :style="color ? { color } : undefined"><slot>{{ value }}</slot></span>
    <span v-if="sub" class="kpi-sub">{{ sub }}</span>
  </div>
</template>
