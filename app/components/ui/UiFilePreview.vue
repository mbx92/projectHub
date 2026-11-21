<script setup lang="ts">
/** Pratinjau file (PDF dan gambar) di dalam aplikasi; jenis lain ditawarkan untuk diunduh. */
const props = defineProps<{ open: boolean, url: string | null, name: string }>()
const emit = defineEmits<{ close: [] }>()
const ext = computed(() => props.name.split('.').pop()?.toLowerCase() ?? '')
const kind = computed<'pdf' | 'image' | 'other'>(() => ext.value === 'pdf' ? 'pdf' : /^(png|jpe?g|webp|gif|svg)$/.test(ext.value) ? 'image' : 'other')
</script>

<template>
  <UiModal :open="open" :title="name" width="960px" @close="emit('close')">
    <div v-if="url && kind === 'pdf'" class="rounded-xl border border-line-2 overflow-hidden bg-soft-2">
      <iframe :src="url" :title="`Pratinjau ${name}`" class="block w-full h-[70vh] border-0" />
    </div>
    <div v-else-if="url && kind === 'image'" class="rounded-xl border border-line-2 bg-soft-2 p-2 flex justify-center">
      <img :src="url" :alt="name" class="max-h-[70vh] max-w-full object-contain">
    </div>
    <div v-else class="rounded-xl border border-dashed border-line-2 p-8 text-center flex flex-col items-center gap-3">
      <p class="m-0 text-sm text-muted">Jenis file ini tidak bisa ditampilkan di aplikasi. Unduh untuk membukanya.</p>
      <a v-if="url" :href="url" class="btn-primary" download>Unduh file</a>
    </div>
    <template #footer>
      <a v-if="url" :href="url" target="_blank" rel="noopener" class="btn-secondary">Buka di tab baru</a>
      <button type="button" class="btn-primary" @click="emit('close')">Tutup</button>
    </template>
  </UiModal>
</template>
