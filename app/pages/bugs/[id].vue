<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['bug', 'lihat'] })
const id = Number(useRoute().params.id)
const toast = useToast()
const { confirm } = useConfirm()
const { user } = useAuth()
const { data, refresh, error } = await useFetch(`/api/bugs/${id}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: errorMessage(error.value), fatal: true })
useHead({ title: () => `${data.value?.bug.code} — OCN Project Hub` })
const bug = computed(() => data.value!.bug)
const can = computed(() => data.value!.can)
const steps = computed(() => (bug.value.steps ?? '').split('\n').map(s => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean))

async function patch(body: Record<string, unknown>, msg = 'Bug diperbarui') {
  try { await $fetch<unknown>(`/api/bugs/${id}`, { method: 'PATCH', body }); toast.success(msg); await refresh() } catch (e) { toast.error(errorMessage(e)); await refresh() }
}
const statusOpts = computed(() => (Object.keys(BUG_STATUS) as BugStatus[]).map(k => ({ value: k, label: BUG_STATUS[k].label, dot: BUG_STATUS[k].fg, disabled: !can.value.close && k === 'selesai' })))
const sevOpts = (Object.keys(BUG_SEVERITY) as BugSeverity[]).map(k => ({ value: k, label: BUG_SEVERITY[k].label, dot: BUG_SEVERITY[k].fg }))
const assignOpts = computed(() => [{ value: null as number | null, label: 'Belum ditugaskan' }, ...(data.value?.assignable ?? []).map(u => ({ value: u.id as number | null, label: u.name }))])

async function onStatus(s: BugStatus) {
  if (s === 'selesai') {
    const ok = await confirm({ variant: 'info', title: `Tutup ${bug.value.code}?`, message: 'Bug dipindah ke kolom Selesai dan pelapor mendapat notifikasi.', confirmText: 'Tutup bug', action: () => $fetch<unknown>(`/api/bugs/${id}`, { method: 'PATCH', body: { status: s } }) })
    if (ok) toast.success(`${bug.value.code} ditutup`)
    await refresh()
    return
  }
  await patch({ status: s }, `Status → ${BUG_STATUS[s].label}`)
}

const draft = ref('')
const sending = ref(false)
async function sendComment() {
  if (!draft.value.trim()) return
  sending.value = true
  try { await $fetch<unknown>(`/api/bugs/${id}/comments`, { method: 'POST', body: { body: draft.value } }); draft.value = ''; await refresh() } catch (e) { toast.error(errorMessage(e)) } finally { sending.value = false }
}
const { upload, uploading } = useUpload()
async function addFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    const r = await upload(f, 'bug')
    await $fetch<unknown>(`/api/bugs/${id}/attachments`, { method: 'POST', body: { key: r.key, name: r.name, mime: r.mime, size: r.size } })
    await refresh()
  } catch (x) { toast.error(errorMessage(x, (x as Error).message)) }
  (e.target as HTMLInputElement).value = ''
}
async function delFile(aid: number, name: string) {
  const ok = await confirm({ variant: 'danger', title: `Hapus lampiran ${name}?`, confirmText: 'Hapus', action: () => $fetch<unknown>(`/api/attachments/${aid}`, { method: 'DELETE' }) })
  if (ok) await refresh()
}
const isImage = (m: string | null) => !!m && m.startsWith('image/')
</script>

<template>
  <div v-if="data" class="flex flex-col gap-6">
    <UiPageHeader :title="bug.title">
      <template #before>
        <div class="flex items-center gap-2 text-sm"><NuxtLink :to="`/bugs?project=${bug.projectId}`" class="font-semibold">← Bug Tracker</NuxtLink><span class="text-muted">/</span><span class="font-mono text-muted">{{ bug.code }}</span></div>
      </template>
      <template #meta>
        <div class="flex flex-wrap gap-2 mt-1">
          <UiBadge :tone="BUG_SEVERITY[bug.severity]" />
          <UiBadge :tone="BUG_STATUS[bug.status]" />
          <span v-if="bug.module" class="badge bg-soft-2 text-ink-2">{{ bug.module }}</span>
          <span v-if="bug.blocksTerm" class="badge bg-warning-50 text-warning-700">Menghambat termin</span>
        </div>
      </template>
    </UiPageHeader>

    <div class="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
      <div class="flex flex-col gap-6 min-w-0">
        <section class="card-pad flex flex-col gap-5">
          <div v-if="bug.description" class="flex flex-col gap-2"><h2 class="section-title">Deskripsi</h2><p class="m-0 text-sm leading-relaxed whitespace-pre-line">{{ bug.description }}</p></div>
          <div v-if="steps.length" class="flex flex-col gap-2">
            <h2 class="section-title">Langkah reproduksi</h2>
            <ol class="m-0 pl-5 list-decimal flex flex-col gap-1.5 text-sm"><li v-for="(s, i) in steps" :key="i">{{ s }}</li></ol>
          </div>
          <div v-if="bug.expected || bug.actual" class="flex flex-col gap-2">
            <h2 class="section-title">Seharusnya vs kenyataan</h2>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-lg bg-brand-soft border border-brand-100 p-3 text-sm"><strong>Seharusnya:</strong> {{ bug.expected || '—' }}</div>
              <div class="rounded-lg bg-[#FEF3F2] border border-danger-50 p-3 text-sm"><strong>Kenyataan:</strong> {{ bug.actual || '—' }}</div>
            </div>
          </div>
          <div class="flex flex-col gap-3">
            <h2 class="section-title">Lampiran</h2>
            <div class="flex flex-wrap gap-3">
              <div v-for="a in data.attachments" :key="a.id" class="relative w-40 rounded-lg border border-line-2 overflow-hidden bg-soft">
                <a :href="a.url ?? '#'" target="_blank" class="block no-underline">
                  <img v-if="isImage(a.mime)" :src="a.url ?? ''" :alt="a.fileName" class="w-full h-24 object-cover">
                  <div v-else class="h-24 flex items-center justify-center text-xs font-bold text-muted uppercase">{{ a.fileName.split('.').pop() }}</div>
                  <span class="block px-2 py-1.5 text-xs truncate text-ink">{{ a.fileName }}</span>
                </a>
                <button v-if="a.createdBy === user?.id || can.editAll" type="button" class="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 text-danger-700 text-sm" :aria-label="`Hapus ${a.fileName}`" @click="delFile(a.id, a.fileName)">×</button>
              </div>
              <label v-if="can.comment" class="w-40 h-[124px] rounded-lg border-2 border-dashed border-line flex items-center justify-center text-sm font-semibold text-brand-700 cursor-pointer hover:bg-soft">
                {{ uploading ? 'Mengunggah…' : '+ Tambah lampiran' }}
                <input type="file" class="sr-only" accept="image/*,application/pdf,text/plain" @change="addFile">
              </label>
            </div>
          </div>
        </section>

        <section class="card-pad flex flex-col gap-4">
          <h2 class="section-title">Aktivitas &amp; Komentar</h2>
          <ol class="m-0 p-0 list-none flex flex-col gap-4">
            <li v-for="c in data.comments" :key="c.id" class="flex gap-3">
              <UiAvatar :name="c.userName" :color="c.avatarColor" :size="32" />
              <div class="flex flex-col gap-1 min-w-0 flex-1">
                <span class="text-sm"><strong>{{ c.userName ?? 'Sistem' }}</strong> <span class="text-muted">{{ c.kind === 'activity' ? c.body : 'berkomentar' }} · {{ dateTimeId(c.createdAt) }}</span></span>
                <p v-if="c.kind === 'comment'" class="m-0 text-sm bg-soft rounded-lg px-3 py-2 whitespace-pre-line">{{ c.body }}</p>
              </div>
            </li>
          </ol>
          <label v-if="can.comment" class="field">Tulis komentar<textarea v-model="draft" rows="3" class="input" placeholder="Tulis update atau pertanyaan untuk tim…" @keydown.ctrl.enter="sendComment" /></label>
          <div v-if="can.comment" class="flex justify-end"><button type="button" class="btn-primary" :disabled="sending || !draft.trim()" @click="sendComment">Kirim Komentar</button></div>
        </section>
      </div>

      <aside class="flex flex-col gap-6">
        <section class="card-pad flex flex-col gap-4">
          <UiSelect :model-value="bug.status" label="Status" :options="statusOpts" :disabled="!can.changeStatus" @change="v => onStatus(v as BugStatus)" />
          <UiSelect :model-value="bug.assigneeId" label="Ditugaskan ke" :options="assignOpts" :disabled="!can.editAll" @change="v => patch({ assigneeId: v }, 'Penanggung jawab diubah')" />
          <UiSelect :model-value="bug.severity" label="Keparahan" :options="sevOpts" :disabled="!can.editAll" @change="v => patch({ severity: v })" />
          <UiDateTimeInput :model-value="bug.targetDate" label="Target selesai" :disabled="!can.editAll" @update:model-value="v => patch({ targetDate: v })" />
          <label class="flex items-center gap-2 text-sm min-h-11" :class="can.editAll ? 'cursor-pointer' : 'opacity-60'"><input type="checkbox" class="w-[18px] h-[18px] accent-brand-600" :checked="bug.blocksTerm" :disabled="!can.editAll" @change="e => patch({ blocksTerm: (e.target as HTMLInputElement).checked })">Menghambat termin</label>
          <dl class="m-0 flex flex-col gap-2 text-sm border-t border-line-3 pt-4">
            <div class="flex justify-between gap-2"><dt class="text-muted">Proyek</dt><dd class="m-0 text-right"><NuxtLink :to="`/projects/${data.project?.id}`">{{ data.project?.name }}</NuxtLink></dd></div>
            <div class="flex justify-between gap-2"><dt class="text-muted">Dilaporkan oleh</dt><dd class="m-0 font-semibold text-right">{{ bug.reporter ?? '—' }}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-muted">Tanggal lapor</dt><dd class="m-0 font-semibold">{{ dateId(bug.createdAt) }}</dd></div>
            <div v-if="bug.resolvedAt" class="flex justify-between gap-2"><dt class="text-muted">Selesai</dt><dd class="m-0 font-semibold">{{ dateId(bug.resolvedAt) }}</dd></div>
          </dl>
          <p v-if="!can.editAll && can.changeStatus" class="m-0 text-xs text-muted">Pindahkan ke Review bila sudah diperbaiki; pengelola bug yang menandai Selesai.</p>
        </section>
        <section v-if="bug.blocksTerm && data.terms.length" class="rounded-xl border border-warning-50 bg-[#FEF6EE] p-4 flex flex-col gap-2">
          <span class="text-sm font-bold text-[#93370D]">Terkait pembayaran</span>
          <span class="text-sm text-[#93370D]">{{ data.terms[0]!.name }} {{ rupiah(data.terms[0]!.amount) }}<template v-if="data.terms[0]!.dueDate"> (jatuh tempo {{ dateId(data.terms[0]!.dueDate) }})</template> menunggu perbaikan. Bug sebaiknya selesai sebelum serah terima.</span>
          <NuxtLink :to="`/projects/${bug.projectId}?tab=pembayaran`" class="text-sm font-semibold">Lihat termin pembayaran →</NuxtLink>
        </section>
      </aside>
    </div>
  </div>
</template>
