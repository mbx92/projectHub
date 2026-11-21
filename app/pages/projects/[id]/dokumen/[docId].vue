<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['dokumen', 'lihat'] })
const route = useRoute()
const projectId = Number(route.params.id)
const docId = Number(route.params.docId)
const toast = useToast()
const { confirm } = useConfirm()
const { can } = useAuth()

const { data, refresh, error } = await useFetch(`/api/documents/${docId}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: errorMessage(error.value), fatal: true })
useHead({ title: () => `${data.value?.name ?? 'Dokumen'} — OCN Project Hub` })

const doc = computed(() => data.value!)
const isFinal = computed(() => doc.value.status === 'final')
const canEdit = computed(() => can('dokumen', 'kelola') && !isFinal.value)
const canManage = computed(() => can('dokumen', 'kelola'))

const name = ref(doc.value.name)
const content = ref<Record<string, unknown>>(doc.value.content as Record<string, unknown>)
const dirty = ref(false)
const saving = ref(false)
watch(name, (v) => { if (v !== doc.value.name) dirty.value = true })
function onContent(v: Record<string, unknown>) { content.value = v; dirty.value = true }

async function save(silent = false) {
  if (!canEdit.value || saving.value) return true
  saving.value = true
  try {
    await $fetch(`/api/documents/${docId}`, { method: 'PATCH', body: { name: name.value.trim() || doc.value.name, content: content.value } })
    dirty.value = false
    if (!silent) toast.success('Dokumen disimpan')
    await refresh()
    return true
  } catch (e) { toast.error(errorMessage(e)); return false } finally { saving.value = false }
}

async function setStatus(status: 'draf' | 'final') {
  if (status === 'final') {
    const ok = await confirm({
      variant: 'info', title: 'Tandai sebagai Final?',
      message: 'Isi dokumen terkunci dan kop & footer dibekukan seperti sekarang; perubahan Pengaturan tidak akan mengubahnya. Anda bisa membukanya kembali sebagai Draf.',
      confirmText: 'Tandai Final',
      action: async () => { if (dirty.value && !(await save(true))) throw new Error('Gagal menyimpan'); await $fetch(`/api/documents/${docId}`, { method: 'PATCH', body: { status: 'final' } }) },
    })
    if (ok) { toast.success('Dokumen ditandai Final'); await refresh() }
  } else {
    const ok = await confirm({
      variant: 'warning', title: 'Buka kembali sebagai Draf?', message: 'Dokumen bisa diedit lagi dan kop & footer kembali mengikuti Pengaturan terkini.', confirmText: 'Buka kembali',
      action: () => $fetch<unknown>(`/api/documents/${docId}`, { method: 'PATCH', body: { status: 'draf' } }),
    })
    if (ok) { toast.success('Dokumen dibuka sebagai Draf'); await refresh() }
  }
}

// Peringatkan bila ada perubahan yang belum disimpan.
onBeforeRouteLeave(() => (dirty.value ? window.confirm('Ada perubahan yang belum disimpan. Tinggalkan halaman ini?') : true))
function warnUnload(e: BeforeUnloadEvent) { if (dirty.value) e.preventDefault() }
onMounted(() => window.addEventListener('beforeunload', warnUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnUnload))

const exportUrl = (f: 'pdf' | 'docx') => `/api/documents/${docId}/export?format=${f}&download=1`
const biz = computed(() => doc.value.layout.business)
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader :title="doc.name" :subtitle="`${doc.type} · ${doc.projectName}${doc.docNumber ? ` · ${doc.docNumber}` : ''}`">
      <template #before><NuxtLink :to="`/projects/${projectId}?tab=dokumen`" class="text-sm font-semibold">← {{ doc.projectName }}</NuxtLink></template>
      <template #badge><span class="badge" :class="isFinal ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'">{{ isFinal ? 'Final' : doc.status === 'review' ? 'Review' : 'Draf' }}</span></template>
      <template #actions>
        <a :href="exportUrl('pdf')" class="btn-secondary">Unduh PDF</a>
        <a :href="exportUrl('docx')" class="btn-secondary">Unduh Word</a>
        <button v-if="canManage && isFinal" type="button" class="btn-secondary" @click="setStatus('draf')">Buka kembali sebagai Draf</button>
        <button v-if="canEdit" type="button" class="btn-secondary" @click="setStatus('final')">Tandai Final</button>
        <button v-if="canEdit" type="button" class="btn-primary" :disabled="saving || !dirty" @click="save()">{{ saving ? 'Menyimpan…' : dirty ? 'Simpan' : 'Tersimpan' }}</button>
      </template>
    </UiPageHeader>

    <p v-if="isFinal" role="status" class="m-0 text-sm text-success-700 bg-success-50 rounded-lg px-3 py-2.5">Dokumen Final: isi terkunci dan kop & footer dibekukan. Buka kembali sebagai Draf untuk merevisi.</p>
    <p v-else-if="!canEdit" role="status" class="m-0 text-sm text-muted bg-soft-2 rounded-lg px-3 py-2.5">Anda hanya bisa melihat dokumen ini.</p>

    <label v-if="canEdit" class="field max-w-xl">Nama dokumen<input v-model="name" class="input" maxlength="200"></label>

    <article class="card mx-auto w-full max-w-[820px] p-5 sm:p-10 flex flex-col gap-5 shadow-sm bg-white" :aria-label="`Dokumen ${doc.name}`">
      <!-- Kop (otomatis dari Pengaturan, tidak diedit di sini) -->
      <header class="flex flex-wrap items-start justify-between gap-3 pb-4 border-b-2 border-brand-600">
        <div class="flex items-start gap-3 min-w-0">
          <img v-if="biz.logoUrl" :src="biz.logoUrl" alt="" class="w-10 h-10 rounded-lg object-contain shrink-0">
          <div v-else class="w-10 h-10 rounded-lg bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">OCN</div>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="font-bold text-sm">{{ biz.name }}</span>
            <span class="text-xs text-muted whitespace-pre-line">{{ biz.address || '[Alamat usaha]' }}</span>
            <span v-if="biz.email || biz.whatsapp" class="text-xs text-muted">{{ [biz.email, biz.whatsapp].filter(Boolean).join(' · ') }}</span>
            <span v-if="biz.npwp" class="text-xs text-muted">NPWP {{ biz.npwp }}</span>
          </div>
        </div>
        <span v-if="doc.docNumber" class="text-xs text-muted">{{ doc.docNumber }}</span>
      </header>

      <ClientOnly>
        <DocEditor :model-value="content" :editable="canEdit" @update:model-value="onContent" />
        <template #fallback><p class="m-0 text-sm text-muted">Memuat editor…</p></template>
      </ClientOnly>

      <!-- Tanda tangan (otomatis) -->
      <div class="grid grid-cols-2 gap-6 pt-4">
        <div class="flex flex-col items-center gap-1 text-center">
          <span class="text-xs text-muted">Pihak Pertama</span>
          <img v-if="biz.signatureUrl" :src="biz.signatureUrl" alt="Tanda tangan usaha" class="h-14 object-contain">
          <span v-else class="h-14" />
          <span class="w-full border-t border-line-2 pt-1 text-sm font-semibold">{{ biz.signerName || biz.name }}</span>
          <span v-if="biz.signerTitle" class="text-xs text-muted">{{ biz.signerTitle }}</span>
        </div>
        <div class="flex flex-col items-center gap-1 text-center">
          <span class="text-xs text-muted">Pihak Kedua (Klien)</span>
          <span class="h-14" />
          <span class="w-full border-t border-line-2 pt-1 text-sm font-semibold">{{ doc.clientName || ' ' }}</span>
        </div>
      </div>

      <!-- Footer (otomatis) -->
      <footer class="flex justify-between gap-3 pt-3 border-t border-line-3 text-[11px] text-muted"><span>{{ doc.layout.footer }}</span><span>Nomor halaman otomatis</span></footer>
    </article>
  </div>
</template>
