<script setup lang="ts">
/** Teks biasa, atau blok kode rapi bila isinya JSON (otomatis di-pretty-print, bisa digulir & disalin). */
const props = defineProps<{ text: string | null | undefined }>()
const json = computed(() => {
  const t = (props.text ?? '').trim()
  if (!/^[{[]/.test(t)) return null
  try { return JSON.stringify(JSON.parse(t), null, 2) } catch { return null }
})
</script>

<template>
  <pre v-if="json" class="m-0 mt-1 max-w-full overflow-x-auto rounded-lg bg-soft-2 border border-line-3 p-3 font-mono text-xs leading-relaxed text-ink whitespace-pre"><code>{{ json }}</code></pre>
  <span v-else class="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{{ text || '—' }}</span>
</template>
