<script setup lang="ts">
const { toasts, dismiss } = useToast()
const tones = {
  success: 'bg-navy text-white',
  error: 'bg-danger-700 text-white',
  info: 'bg-white text-ink border border-line-2',
}
</script>

<template>
  <div class="fixed z-[120] bottom-4 left-4 right-4 sm:left-auto sm:w-96 flex flex-col gap-2" aria-live="polite" role="status">
    <div v-for="t in toasts" :key="t.id" class="flex items-start gap-3 rounded-xl shadow-lg px-4 py-3 text-sm" :class="tones[t.tone]">
      <span class="flex-1 leading-relaxed">{{ t.text }}</span>
      <button type="button" class="opacity-70 hover:opacity-100 -mr-1" aria-label="Tutup notifikasi" @click="dismiss(t.id)">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  </div>
</template>
