<script setup lang="ts">
/** Tombol unggah file privat → v-model berisi kunci file (dan nama). */
const props = withDefaults(defineProps<{ modelValue: string | null, folder: 'bukti' | 'bug' | 'dokumen' | 'logo', label?: string, accept?: string, fileName?: string | null }>(), { label: 'Lampirkan bukti', accept: 'image/*,application/pdf' })
const emit = defineEmits<{ 'update:modelValue': [string | null], 'uploaded': [UploadedFile] }>()
const { upload, uploading } = useUpload()
const toast = useToast()
const input = ref<HTMLInputElement | null>(null)
const name = ref<string | null>(props.fileName ?? null)

async function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    const r = await upload(f, props.folder)
    name.value = r.name
    emit('update:modelValue', r.key)
    emit('uploaded', r)
  } catch (err) {
    toast.error(errorMessage(err, (err as Error).message))
  } finally {
    if (input.value) input.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <input ref="input" type="file" class="sr-only" :accept="accept" tabindex="-1" aria-hidden="true" @change="onPick">
    <button type="button" class="btn-secondary btn-sm" :disabled="uploading" @click="input?.click()">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" /></svg>
      {{ uploading ? 'Mengunggah…' : modelValue ? 'Ganti file' : label }}
    </button>
    <span v-if="modelValue" class="text-xs text-muted truncate max-w-56">{{ name ?? 'File terlampir' }}</span>
    <button v-if="modelValue" type="button" class="text-xs text-danger-700 underline" @click="emit('update:modelValue', null); name = null">Hapus</button>
  </div>
</template>
