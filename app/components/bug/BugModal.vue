<script setup lang="ts">
/** Laporkan bug baru. */
const props = defineProps<{ open: boolean, projectId?: number | null, projects: { id: number, name: string }[] }>()
const emit = defineEmits<{ close: [], saved: [id: number] }>()
const toast = useToast()
const { can } = useAuth()
const isAdmin = computed(() => can('bug', 'kelola'))
const f = reactive({
  projectId: null as number | null, title: '', description: '', steps: '', expected: '', actual: '', module: '',
  severity: 'sedang' as BugSeverity, assigneeId: null as number | null, reporter: '', targetDate: null as string | null, blocksTerm: false,
})
const files = ref<UploadedFile[]>([])
const err = ref('')
const saving = ref(false)
const { upload, uploading } = useUpload()
const members = ref<{ value: number | null, label: string }[]>([])

watch(() => props.open, (o) => {
  if (!o) return
  err.value = ''
  files.value = []
  Object.assign(f, { projectId: props.projectId ?? props.projects[0]?.id ?? null, title: '', description: '', steps: '', expected: '', actual: '', module: '', severity: 'sedang', assigneeId: null, reporter: '', targetDate: null, blocksTerm: false })
})
watch(() => [f.projectId, props.open] as const, async ([pid, o]) => {
  members.value = [{ value: null, label: 'Belum ditugaskan' }]
  if (!pid || !o || !isAdmin.value) return
  const d = await $fetch<any>(`/api/projects/${pid}`).catch(() => null)
  const users = await $fetch<any[]>('/api/users').catch(() => [])
  const ids = new Set([...(d?.members ?? []).map((m: any) => m.userId), ...users.filter(u => u.role === 'admin').map(u => u.id)])
  members.value = [{ value: null, label: 'Belum ditugaskan' }, ...users.filter(u => ids.has(u.id) && u.status === 'aktif').map(u => ({ value: u.id, label: u.name }))]
}, { immediate: true })

async function addFiles(list: File[]) {
  for (const file of list) {
    try { files.value.push(await upload(file, 'bug')) } catch (x) { toast.error(errorMessage(x, (x as Error).message)) }
  }
}
async function addFile(e: Event) {
  const input = e.target as HTMLInputElement
  await addFiles([...(input.files ?? [])])
  input.value = ''
}
// Ctrl+V gambar (mis. tangkapan layar) saat form terbuka.
usePasteImages(() => props.open, addFiles)
const preview = ref<UploadedFile | null>(null)
const isImage = (m: string | null) => !!m && m.startsWith('image/')
async function save() {
  err.value = ''
  if (!f.projectId) { err.value = 'Pilih proyek.'; return }
  if (f.title.trim().length < 3) { err.value = 'Judul bug minimal 3 karakter.'; return }
  saving.value = true
  try {
    const r = await $fetch<{ id: number, code: string }>('/api/bugs', { method: 'POST', body: { ...f, attachments: files.value.map(x => ({ key: x.key, name: x.name, mime: x.mime, size: x.size })) } })
    toast.success(`${r.code} dilaporkan`)
    emit('saved', r.id)
    emit('close')
  } catch (e) { err.value = errorMessage(e) } finally { saving.value = false }
}
const sevOpts = (Object.keys(BUG_SEVERITY) as BugSeverity[]).map(k => ({ value: k, label: BUG_SEVERITY[k].label, dot: BUG_SEVERITY[k].fg }))
</script>

<template>
  <UiModal :open="open" title="Laporkan Bug" width="680px" @close="emit('close')">
    <p v-if="err" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ err }}</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <UiSearchSelect v-model="f.projectId" label="Proyek" :options="projects.map(p => ({ value: p.id as number | null, label: p.name }))" search-placeholder="Cari proyek…" />
      <UiSelect v-model="f.severity" label="Keparahan" :options="sevOpts" />
    </div>
    <label class="field">Judul<input v-model="f.title" class="input" placeholder="Mis. Saldo jurnal tidak balance setelah retur"></label>
    <label class="field">Deskripsi<textarea v-model="f.description" rows="3" class="input" /></label>
    <label class="field">Langkah reproduksi<textarea v-model="f.steps" rows="3" class="input" placeholder="1. Buka …&#10;2. Klik …&#10;3. …" /><span class="hint">Satu langkah per baris.</span></label>
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="field">Seharusnya<textarea v-model="f.expected" rows="2" class="input" /></label>
      <label class="field">Kenyataan<textarea v-model="f.actual" rows="2" class="input" /></label>
      <label class="field">Modul<input v-model="f.module" class="input" placeholder="Mis. Akunting"></label>
      <label class="field">Pelapor<input v-model="f.reporter" class="input" placeholder="Mis. Klien (nama PIC)"></label>
      <UiSelect v-if="isAdmin" v-model="f.assigneeId" label="Ditugaskan ke" :options="members" />
      <UiDateTimeInput v-model="f.targetDate" label="Target selesai" />
    </div>
    <label class="flex items-start gap-2 text-sm min-h-11 cursor-pointer"><input v-model="f.blocksTerm" type="checkbox" class="w-[18px] h-[18px] mt-0.5 accent-brand-600"><span>Menghambat termin <span class="block text-xs text-muted">Tampil sebagai peringatan di tab Pembayaran proyek sampai bug selesai.</span></span></label>
    <div class="flex flex-col gap-2">
      <span class="text-sm font-semibold text-ink-2">Lampiran</span>
      <ul v-if="files.length" class="m-0 p-0 list-none flex flex-wrap gap-2">
        <li v-for="(x, i) in files" :key="x.key" class="relative w-28">
          <button type="button" class="block w-full text-left rounded-lg border border-line-2 overflow-hidden bg-soft" :aria-label="`Lihat ${x.name}`" @click="preview = x">
            <img v-if="isImage(x.mime) && x.url" :src="x.url" :alt="x.name" class="w-full h-20 object-cover">
            <span v-else class="h-20 flex items-center justify-center text-xs font-bold text-muted uppercase">{{ x.name.split('.').pop() }}</span>
            <span class="block px-2 py-1 text-[11px] truncate">{{ x.name }}</span>
          </button>
          <button type="button" class="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-white text-danger-700 border border-line-2 shadow-sm flex items-center justify-center hover:bg-danger-50" :aria-label="`Hapus ${x.name}`" @click="files.splice(i, 1)"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </li>
      </ul>
      <div class="flex flex-wrap items-center gap-3">
        <label class="btn-secondary btn-sm cursor-pointer">{{ uploading ? 'Mengunggah…' : '+ Tambah lampiran' }}<input type="file" class="sr-only" multiple accept="image/*,application/pdf,text/plain" @change="addFile"></label>
        <span class="text-xs text-muted">atau tempel gambar dengan <kbd class="font-mono">Ctrl</kbd>+<kbd class="font-mono">V</kbd></span>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn-secondary" @click="emit('close')">Batal</button>
      <button type="button" class="btn-primary" :disabled="saving || uploading" @click="save">{{ saving ? 'Menyimpan…' : 'Laporkan Bug' }}</button>
    </template>
    <UiFilePreview :open="!!preview" :url="preview?.url ?? null" :name="preview?.name ?? ''" @close="preview = null" />
  </UiModal>
</template>
