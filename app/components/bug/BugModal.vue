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

async function addFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try { files.value.push(await upload(file, 'bug')) } catch (x) { toast.error(errorMessage(x, (x as Error).message)) }
  (e.target as HTMLInputElement).value = ''
}
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
        <li v-for="(x, i) in files" :key="x.key" class="flex items-center gap-2 text-xs bg-soft-2 rounded-md px-2 py-1">{{ x.name }}<button type="button" class="text-danger-700" :aria-label="`Hapus ${x.name}`" @click="files.splice(i, 1)">×</button></li>
      </ul>
      <label class="btn-secondary btn-sm self-start cursor-pointer">{{ uploading ? 'Mengunggah…' : '+ Tambah lampiran' }}<input type="file" class="sr-only" accept="image/*,application/pdf,text/plain" @change="addFile"></label>
    </div>
    <template #footer>
      <button type="button" class="btn-secondary" @click="emit('close')">Batal</button>
      <button type="button" class="btn-primary" :disabled="saving || uploading" @click="save">{{ saving ? 'Menyimpan…' : 'Laporkan Bug' }}</button>
    </template>
  </UiModal>
</template>
