<script setup lang="ts">
import type { ActionItem } from '~/components/ui/UiActionMenu.vue'
definePageMeta({ middleware: 'role', access: ['proyek', 'lihat'] })
const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)
const toast = useToast()
const { confirm } = useConfirm()
const { user } = useAuth()
const { data, refresh, error } = await useFetch(`/api/projects/${id}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: errorMessage(error.value), fatal: true })
useHead({ title: () => `${data.value?.project.name ?? 'Proyek'} — OCN Project Hub` })

const p = computed(() => data.value!.project)
const fin = computed(() => data.value?.finance ?? null)
const can = computed(() => data.value!.can)

type TabKey = 'ringkasan' | 'pembayaran' | 'pengeluaran' | 'bug' | 'tim' | 'dokumen'
const tabs = computed(() => ([
  { key: 'ringkasan', label: 'Ringkasan', show: true },
  { key: 'pembayaran', label: 'Pembayaran', show: can.value.money, count: fin.value?.terms.length },
  { key: 'pengeluaran', label: 'Pengeluaran', show: can.value.money, count: fin.value?.expenses.length },
  { key: 'bug', label: 'Bug', show: can.value.bugs, count: data.value?.bugCounts?.open },
  { key: 'tim', label: 'Tim & Bagi Hasil', show: true },
  { key: 'dokumen', label: 'Dokumen', show: can.value.team, count: data.value?.documents.length },
] as { key: TabKey, label: string, show: boolean, count?: number }[]).filter(t => t.show))
const tab = ref<TabKey>((route.query.tab as TabKey) || 'ringkasan')
watch(tab, t => router.replace({ query: { ...route.query, tab: t } }))

const showPay = ref(false)
const payTerm = ref<number | null>(null)
const showExpense = ref(false)
const editExpense = ref<any>(null)
const showBug = ref(false)
const showMember = ref(false)
type MemberRow = NonNullable<typeof data.value>['members'][number]
const editMember = ref<MemberRow | null>(null)
function openAddMember() { editMember.value = null; showMember.value = true }
function openEditMember(m: MemberRow) { editMember.value = m; showMember.value = true }
async function removeMember(m: MemberRow) {
  const active = (data.value?.bugs ?? []).filter(b => b.assigneeId === m.userId && b.status !== 'selesai').length
  const ok = await confirm({
    variant: 'danger', title: `Keluarkan ${m.name} dari tim?`, confirmText: 'Keluarkan',
    message: `${m.name} tidak akan bisa melihat proyek ini lagi.${active ? ` ${active} bug aktif yang ditugaskan kepadanya akan dilepas (tanpa penanggung jawab).` : ''} Riwayat distribusi yang sudah ada tidak berubah.`,
    action: () => $fetch<unknown>(`/api/projects/${id}/members/${m.userId}`, { method: 'DELETE' }),
  })
  if (ok) { toast.success(`${m.name} dikeluarkan dari tim`); await refresh() }
}

const lunasCount = computed(() => fin.value?.terms.filter(t => t.status === 'lunas').length ?? 0)
const paidPct = computed(() => p.value.contractValue ? Math.round((fin.value?.paid ?? 0) / p.value.contractValue * 100) : 0)
/** Sisa tagihan = sama dengan definisi piutang: termin belum lunas (sisa invoice terkirim, atau nominal termin bila belum ditagih). */
const remaining = computed(() => (fin.value?.terms ?? []).reduce((a, t) => a + (t.status === 'lunas' ? 0 : t.invoice && t.invoice.status !== 'draf' ? t.invoice.total - t.paid : t.amount), 0))
const expenseTotal = computed(() => (fin.value?.expenses ?? []).filter(e => !e.isAsset).reduce((a, e) => a + e.amount, 0))
const assetTotal = computed(() => (fin.value?.expenses ?? []).filter(e => e.isAsset).reduce((a, e) => a + e.amount, 0))
const byCategory = computed(() => {
  const m = new Map<string, number>()
  for (const e of fin.value?.expenses ?? []) if (!e.isAsset) m.set(e.category, (m.get(e.category) ?? 0) + e.amount)
  const max = Math.max(1, ...m.values())
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, amount]) => ({ label, amount, pct: amount / max * 100 }))
})
const budgetPct = computed(() => p.value.budget ? Math.round(expenseTotal.value / p.value.budget * 100) : 0)
const blockingBugs = computed(() => (data.value?.bugs ?? []).filter(b => b.blocksTerm && b.status !== 'selesai'))
const openBugs = computed(() => (data.value?.bugs ?? []).filter(b => b.status !== 'selesai').sort((a, b) => BUG_SEVERITY[a.severity].order - BUG_SEVERITY[b.severity].order))
const nextUnpaid = computed(() => fin.value?.terms.find(t => t.status !== 'lunas'))

type TermRow = NonNullable<typeof fin.value>['terms'][number]
/** Menu aksi per termin (…): hanya aksi yang boleh dilakukan pengguna. */
const termItems = (t: TermRow): ActionItem[] => {
  const inv = t.invoice
  return [
    { label: 'Buat invoice', to: `/invoices/new?term=${t.id}`, hidden: !(can.value.moneyManage && !inv) },
    { label: 'Lihat invoice', to: inv ? `/invoices/${inv.id}` : undefined, hidden: !(inv && can.value.moneyDetail) },
    { label: 'Ubah draf invoice', to: inv ? `/invoices/${inv.id}/edit` : undefined, hidden: !(can.value.moneyManage && inv?.status === 'draf') },
    { label: 'Kirim invoice', hidden: !(can.value.moneyManage && inv?.status === 'draf'), onClick: () => sendInvoice(inv!.id, inv!.number) },
    { label: 'Catat pembayaran', hidden: !(can.value.moneyManage && t.status !== 'lunas'), onClick: () => { payTerm.value = t.id; showPay.value = true } },
    ...t.payments.map(py => ({ label: `Kuitansi ${dateId(py.date)}`, href: `/api/payments/${py.id}/receipt?download=1`, external: true, hidden: !can.value.moneyDetail })),
  ]
}

const primary = computed(() => {
  if (tab.value === 'bug') return can.value.manageBugs ? { label: '+ Laporkan Bug', run: () => { showBug.value = true } } : null
  if (!can.value.moneyManage) return null
  if (tab.value === 'pengeluaran') return { label: '+ Catat Pengeluaran', run: () => { editExpense.value = null; showExpense.value = true } }
  return { label: 'Catat Pembayaran', run: () => { payTerm.value = nextUnpaid.value?.id ?? null; showPay.value = true } }
})

// Skema simulasi
const pnl = computed(() => fin.value?.pnl)
const sim = computed(() => {
  const members = (data.value?.members ?? []).filter(m => m.payType === 'bagi_hasil')
  const profit = Math.max(0, pnl.value?.undistributed ?? 0)
  return calcDistribution({ netProfit: profit, capitalPct: p.value.capitalPct, workerPct: p.value.workerPct, cashPct: p.value.cashPct, investors: p.value.capitalPct > 0 ? [{ investorId: 0, userId: 0, name: 'Investor (sesuai porsi modal)', capital: 1 }] : [], workers: members.map(m => ({ userId: m.userId, name: m.name, weight: m.shareWeight })) })
})

async function setMilestone(mid: number, status: 'belum' | 'berjalan' | 'selesai') {
  try { await $fetch<unknown>(`/api/projects/${id}/progress`, { method: 'PATCH', body: { milestone: { id: mid, status } } }); await refresh() } catch (e) { toast.error(errorMessage(e)) }
}
const progressDraft = ref(p.value.progress)
async function saveProgress() {
  try { await $fetch<unknown>(`/api/projects/${id}/progress`, { method: 'PATCH', body: { progress: progressDraft.value } }); await refresh(); toast.success('Progress diperbarui') } catch (e) { toast.error(errorMessage(e)) }
}
const canProgress = computed(() => can.value.progress)

async function sendInvoice(invId: number, number: string) {
  const ok = await confirm({ variant: 'info', title: `Kirim ${number} ke klien?`, message: 'Status menjadi Terkirim, PDF dikirim ke email klien, dan pengingat H-7 & hari H aktif.', confirmText: 'Kirim sekarang', action: async () => {
    const r = await $fetch<{ warning?: string, emailed: boolean }>(`/api/invoices/${invId}/send`, { method: 'POST', body: { email: true, reminders: true } })
    if (r.warning) toast.info(r.warning)
  } })
  if (ok) { toast.success(`${number} ditandai terkirim`); await refresh() }
}
async function deletePayment(pid: number) {
  const ok = await confirm({ variant: 'danger', title: 'Hapus pembayaran ini?', message: 'Status termin dan saldo kas dihitung ulang.', confirmText: 'Hapus', action: () => $fetch<unknown>(`/api/payments/${pid}`, { method: 'DELETE' }) })
  if (ok) { toast.success('Pembayaran dihapus'); await refresh() }
}

// Dokumen
const { upload, uploading } = useUpload()
const docType = ref('Kontrak')
const DOC_TYPES = ['Kontrak', 'Proposal', 'BAST', 'Spesifikasi', 'Desain', 'Laporan UAT', 'Lainnya']
async function addDoc(file: File | undefined) {
  if (!file) return
  try {
    const r = await upload(file, 'dokumen')
    await $fetch<unknown>(`/api/projects/${id}/documents`, { method: 'POST', body: { name: file.name, type: docType.value, status: 'draf', fileKey: r.key } })
    toast.success('Dokumen diunggah')
    await refresh()
  } catch (e) { toast.error(errorMessage(e, (e as Error).message)) }
}
const dragOver = ref(false)
function onDrop(e: DragEvent) { dragOver.value = false; addDoc(e.dataTransfer?.files?.[0]) }
async function setDocStatus(docId: number, status: string) {
  await $fetch<unknown>(`/api/documents/${docId}`, { method: 'PATCH', body: { status } }).catch(e => toast.error(errorMessage(e)))
  await refresh()
}
async function deleteDoc(docId: number, name: string) {
  const ok = await confirm({ variant: 'danger', title: `Hapus ${name}?`, confirmText: 'Hapus', action: () => $fetch<unknown>(`/api/documents/${docId}`, { method: 'DELETE' }) })
  if (ok) await refresh()
}
const REQUIRED_DOCS = ['Kontrak', 'Spesifikasi', 'Laporan UAT', 'BAST']
const DOC_RANK: Record<string, number> = { final: 3, review: 2, draf: 1 }
const docChecklist = computed(() => REQUIRED_DOCS.map((t) => {
  const docs = (data.value?.documents ?? []).filter(d => d.type === t)
  const best = docs.reduce<string | null>((b, d) => (!b || (DOC_RANK[d.status] ?? 0) > (DOC_RANK[b] ?? 0) ? d.status : b), null)
  return { label: t, status: best, done: best === 'final', count: docs.length }
}))
const docDone = computed(() => docChecklist.value.filter(c => c.done).length)
const DOC_STATUS_LABEL: Record<string, string> = { final: 'Final', review: 'Review', draf: 'Draf' }
const docFile = ref<HTMLInputElement | null>(null)
function uploadRequired(type: string) { docType.value = type; docFile.value?.click() }
const preview = ref<{ url: string | null, name: string } | null>(null)
const AUTO_DOCS = ['Kontrak', 'Spesifikasi', 'Laporan UAT', 'BAST']
const generating = ref<string | null>(null)
async function generateDoc(type: string) {
  generating.value = type
  try {
    const r = await $fetch<{ id: number }>(`/api/projects/${id}/documents/generate`, { method: 'POST', body: { type } })
    toast.success(`${type} dibuat sebagai Draf. Silakan periksa dan edit.`)
    await navigateTo(`/projects/${id}/dokumen/${r.id}`)
  } catch (e) { toast.error(errorMessage(e)) } finally { generating.value = null }
}

const activityText = (a: any) => {
  if (a.entity === 'bug') return a.action === 'comment' ? `berkomentar di ${a.label}` : `${a.body} · ${a.label}`
  const map: Record<string, string> = { buat: 'membuat', ubah: 'mengubah', hapus: 'menghapus', kirim: 'mengirim', batal: 'membatalkan', arsip: 'mengarsipkan', pulihkan: 'memulihkan' }
  const ent: Record<string, string> = { project: 'proyek', term: 'termin', invoice: 'invoice', payment: 'pembayaran', expense: 'pengeluaran' }
  return `${map[a.action] ?? a.action} ${ent[a.entity] ?? a.entity}${a.label ? ` ${a.label}` : ''}`
}
const projects = computed(() => [{ id: p.value.id, name: p.value.name }])
</script>

<template>
  <div v-if="data" class="flex flex-col gap-6">
    <header class="card-pad flex flex-col gap-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-col gap-1.5 min-w-0">
          <NuxtLink to="/projects" class="text-sm font-semibold">← Proyek</NuxtLink>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="page-title">{{ p.name }}</h1>
            <UiBadge :tone="PROJECT_STATUS[p.status]" />
            <span v-if="p.archived" class="badge bg-soft-2 text-muted">Diarsipkan</span>
          </div>
          <p class="page-sub">Klien: {{ data.client?.name ?? '—' }}<template v-if="p.stack"> · {{ p.stack }}</template><template v-if="p.startDate"> · Mulai {{ dateId(p.startDate) }}</template></p>
        </div>
        <div v-if="can.edit || primary" class="flex flex-wrap gap-3">
          <NuxtLink v-if="can.edit" :to="`/projects/${id}/edit`" class="btn-secondary">Edit Proyek</NuxtLink>
          <button v-if="primary" type="button" class="btn-primary" @click="primary.run">{{ primary.label }}</button>
        </div>
        <div v-else-if="can.manageBugs && tab === 'bug'"><button type="button" class="btn-primary" @click="showBug = true">+ Laporkan Bug</button></div>
      </div>
      <div class="flex flex-col gap-2">
        <div class="flex justify-between text-sm"><span class="text-muted">Progress pengerjaan</span><span class="font-bold">{{ p.progress }}%</span></div>
        <div class="progress h-2.5"><div :style="{ width: `${p.progress}%` }" /></div>
      </div>
      <div role="tablist" aria-label="Bagian proyek" class="tabs -mb-5 -mx-5 px-5">
        <button v-for="t in tabs" :key="t.key" type="button" role="tab" class="tab" :aria-selected="tab === t.key" @click="tab = t.key">
          {{ t.label }}<span v-if="t.count" class="text-[11px] font-bold bg-soft-2 text-muted rounded-full px-1.5 py-px">{{ t.count }}</span>
        </button>
      </div>
    </header>

    <!-- ═══ RINGKASAN ═══ -->
    <template v-if="tab === 'ringkasan'">
      <section v-if="fin" aria-label="Angka utama" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <UiKpi label="Nilai kontrak" :value="rupiah(p.contractValue)" :sub="`${fin.terms.length} termin`" />
        <UiKpi label="Sudah dibayar klien" :value="rupiah(fin.paid)" :sub="`${paidPct}% · ${lunasCount} termin lunas`" />
        <UiKpi label="Pengeluaran proyek" :value="rupiah(fin.pnl?.expenses)" :sub="p.budget ? `${budgetPct}% dari anggaran` : 'Tanpa anggaran'" />
        <UiKpi label="Laba bersih (kas)" :value="rupiah(fin.pnl?.profit)" :sub="`Belum dibagi ${rupiah(fin.pnl?.undistributed)}`" />
      </section>
      <div class="grid gap-6 lg:grid-cols-[1.3fr_1fr] items-start">
        <section class="card-pad flex flex-col gap-4">
          <h2 class="section-title">Milestone</h2>
          <ol class="m-0 p-0 list-none flex flex-col gap-1">
            <li v-for="m in data.milestones" :key="m.id" class="flex items-center gap-3 py-2">
              <span class="w-6 h-6 rounded-full flex items-center justify-center shrink-0" :class="m.status === 'selesai' ? 'bg-brand-600 text-white' : m.status === 'berjalan' ? 'border-2 border-info-700' : 'border-2 border-line'" aria-hidden="true">
                <svg v-if="m.status === 'selesai'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              </span>
              <span class="flex-1 flex flex-col"><span class="text-sm font-semibold">{{ m.name }}</span><span class="text-xs text-muted">{{ m.targetDate ? `Target ${dateId(m.targetDate)}` : 'Tanpa target' }}</span></span>
              <div v-if="canProgress" class="w-36"><UiSelect :model-value="m.status" size="sm" :aria-label="`Status ${m.name}`" :options="[{ value: 'belum', label: 'Belum' }, { value: 'berjalan', label: 'Berjalan' }, { value: 'selesai', label: 'Selesai' }]" @change="v => setMilestone(m.id, v as any)" /></div>
              <UiBadge v-else :tone="MILESTONE_STATUS[m.status]" />
            </li>
          </ol>
          <p v-if="!data.milestones.length" class="m-0 text-sm text-muted">Belum ada milestone.</p>
          <div v-if="canProgress" class="flex items-end gap-3 border-t border-line-3 pt-4">
            <label class="field flex-1">Progress pengerjaan (%)<input v-model.number="progressDraft" type="range" min="0" max="100" step="5" class="accent-brand-600"></label>
            <span class="font-bold w-12 text-right">{{ progressDraft }}%</span>
            <button type="button" class="btn-secondary btn-sm" :disabled="progressDraft === p.progress" @click="saveProgress">Simpan</button>
          </div>
        </section>
        <div class="flex flex-col gap-6">
          <section class="card-pad flex flex-col gap-3">
            <h2 class="section-title">Informasi Proyek</h2>
            <dl class="m-0 flex flex-col gap-2 text-sm">
              <div v-for="r in [
                { k: 'Klien', v: data.client?.name ?? '—' },
                { k: 'Kontak', v: data.client && 'contactName' in data.client ? [data.client.contactName, data.client.whatsapp].filter(Boolean).join(' · ') || '—' : '—' },
                { k: 'Penanggung jawab', v: data.pic?.name ?? '—' },
                { k: 'Mulai', v: dateId(p.startDate) },
                { k: 'Target selesai', v: dateId(p.targetDate) },
                { k: 'Skema', v: `${data.scheme?.name ?? 'Kustom'} · ${p.capitalPct}/${p.workerPct}/${p.cashPct}` },
              ]" :key="r.k" class="flex justify-between gap-3"><dt class="text-muted">{{ r.k }}</dt><dd class="m-0 font-semibold text-right">{{ r.v }}</dd></div>
            </dl>
            <p v-if="p.description" class="m-0 text-sm text-ink-2 whitespace-pre-line border-t border-line-3 pt-3">{{ p.description }}</p>
          </section>
          <section class="card-pad flex flex-col gap-3">
            <h2 class="section-title">Aktivitas Terbaru</h2>
            <ul class="m-0 p-0 list-none flex flex-col gap-3">
              <li v-for="(a, i) in data.activity" :key="i" class="flex gap-3">
                <UiAvatar :name="a.user_name" :size="28" />
                <div class="flex flex-col gap-0.5 min-w-0"><span class="text-sm"><strong>{{ a.user_name ?? 'Sistem' }}</strong> {{ activityText(a) }}</span><span v-if="a.body && a.action === 'comment'" class="text-xs text-muted line-clamp-2">{{ a.body }}</span><span class="text-xs text-faint">{{ dateTimeId(a.created_at) }}</span></div>
              </li>
            </ul>
            <p v-if="!data.activity.length" class="m-0 text-sm text-muted">Belum ada aktivitas.</p>
          </section>
        </div>
      </div>
    </template>

    <!-- ═══ PEMBAYARAN ═══ -->
    <template v-if="tab === 'pembayaran' && fin">
      <div v-if="blockingBugs.length" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-50 bg-[#FEF6EE] px-4 py-3">
        <span class="text-sm text-[#93370D]"><strong>Termin menunggu perbaikan.</strong> Masih ada {{ blockingBugs.length }} bug yang menghambat termin ({{ blockingBugs.map(b => b.code).join(', ') }}).</span>
        <button type="button" class="btn-secondary btn-sm" @click="tab = 'bug'">Lihat bug</button>
      </div>
      <section aria-label="Ringkasan pembayaran" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <UiKpi label="Nilai kontrak" :value="rupiah(p.contractValue)" />
        <UiKpi label="Sudah dibayar" :value="rupiah(fin.paid)" :sub="`${paidPct}% dari kontrak`" color="#067647" />
        <UiKpi label="Sisa tagihan" :value="rupiah(remaining)" :sub="nextUnpaid ? `Berikutnya: ${nextUnpaid.name}` : 'Semua termin lunas'" />
      </section>
      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div class="flex flex-col gap-0.5"><h2 class="section-title">Termin Pembayaran Klien</h2><span class="text-sm text-muted">{{ fin.terms.length }} termin · {{ lunasCount }} lunas</span></div>
          <NuxtLink v-if="can.moneyManage" :to="`/invoices/new?project=${id}`" class="btn-secondary btn-sm">Buat Invoice</NuxtLink>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">Termin</th><th scope="col" class="num">Nominal</th><th scope="col">Jatuh tempo</th><th scope="col">Invoice &amp; status</th><th v-if="can.moneyManage || can.moneyDetail" scope="col" class="w-14"><span class="sr-only">Aksi</span></th></tr></thead>
            <tbody>
              <tr v-for="t in fin.terms" :key="t.id">
                <td><div class="flex flex-col gap-0.5"><span class="font-semibold">{{ t.name }}</span><span class="text-xs text-muted">{{ percent(t.percent) }} dari kontrak{{ t.conditions ? ` · ${t.conditions}` : '' }}</span></div></td>
                <td class="num">{{ rupiah(t.amount) }}<div v-if="t.paid && t.status !== 'lunas'" class="text-xs text-muted">dibayar {{ rupiah(t.paid) }}</div></td>
                <td><span class="block whitespace-nowrap">{{ dateId(t.invoice?.dueDate ?? t.dueDate) }}</span><span v-if="t.paidOn" class="block text-xs text-muted">Dibayar <span class="whitespace-nowrap">{{ dateId(t.paidOn) }}</span> · {{ t.method }}</span></td>
                <td class="nowrap"><div class="flex flex-col items-start gap-1"><NuxtLink v-if="t.invoice && can.moneyDetail" :to="`/invoices/${t.invoice.id}`" class="text-sm">{{ t.invoice.number }}</NuxtLink><span v-else-if="t.invoice" class="text-sm">{{ t.invoice.number }}</span><UiBadge :tone="TERM_STATUS[t.displayStatus]" /></div></td>
                <td v-if="can.moneyManage || can.moneyDetail" class="text-right"><UiActionMenu :label="`Aksi untuk ${t.name}`" :items="termItems(t)" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section v-if="can.moneyDetail && fin.terms.some(t => t.payments.length)" class="card overflow-hidden">
        <div class="px-5 py-4"><h2 class="section-title">Riwayat Pembayaran Masuk</h2></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">Tanggal</th><th scope="col">Termin</th><th scope="col">Metode</th><th scope="col" class="num">Nominal</th><th scope="col" class="w-14"><span class="sr-only">Aksi</span></th></tr></thead>
            <tbody>
              <template v-for="t in fin.terms" :key="t.id">
                <tr v-for="py in t.payments" :key="py.id">
                  <td class="nowrap">{{ dateId(py.date) }}</td><td>{{ t.name }}</td><td class="nowrap">{{ py.method }}</td><td class="num">{{ rupiah(py.amount) }}</td>
                  <td class="text-right"><UiActionMenu :label="`Aksi pembayaran ${dateId(py.date)}`" :items="[
                    { label: 'Lihat bukti', href: py.proofUrl ?? undefined, external: true, hidden: !py.proofUrl },
                    { label: 'Unduh kuitansi', href: `/api/payments/${py.id}/receipt?download=1`, external: true },
                    { label: 'Hapus pembayaran', danger: true, hidden: !can.moneyManage, onClick: () => deletePayment(py.id) },
                  ]" /></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ═══ PENGELUARAN ═══ -->
    <template v-if="tab === 'pengeluaran' && fin">
      <div class="grid gap-6 xl:grid-cols-[1.6fr_1fr] items-start">
        <section class="card overflow-hidden min-w-0">
          <div class="flex flex-col gap-0.5 px-5 py-4"><h2 class="section-title">Pengeluaran Proyek</h2><span class="text-sm text-muted">{{ fin.expenses.length }} transaksi · {{ rupiah(expenseTotal) }}<template v-if="assetTotal"> · aset {{ rupiah(assetTotal) }}</template></span></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th scope="col">Tanggal</th><th scope="col">Keterangan</th><th scope="col" class="num">Nominal</th><th scope="col" class="w-14"><span class="sr-only">Aksi</span></th></tr></thead>
              <tbody>
                <tr v-for="e in fin.expenses" :key="e.id">
                  <td class="nowrap">{{ dateId(e.date) }}</td>
                  <td>
                    <div class="flex flex-col gap-1">
                      <span class="font-semibold">{{ e.description }}</span>
                      <span class="flex flex-wrap items-center gap-1.5 text-xs text-muted"><span class="badge !py-0.5" :class="e.isAsset ? 'bg-violet-50 text-[#5925DC]' : 'bg-soft-2 text-ink-2'">{{ e.isAsset ? `Aset · ${e.category}` : e.category }}</span>{{ e.source === 'kas_ocn' ? 'Kas OCN' : 'Dibayar pribadi' }}<template v-if="e.createdByName"> · dicatat {{ e.createdByName }}</template></span>
                    </div>
                  </td>
                  <td class="num">{{ rupiah(e.amount) }}</td>
                  <td class="text-right"><UiActionMenu :label="`Aksi untuk ${e.description}`" :items="[
                    { label: 'Ubah pengeluaran', hidden: !can.moneyManage, onClick: () => { editExpense = e; showExpense = true } },
                    { label: 'Lihat bukti', href: e.proofUrl ?? undefined, external: true, hidden: !e.proofUrl },
                  ]" /></td>
                </tr>
              </tbody>
              <tfoot v-if="fin.expenses.length"><tr><td colspan="2">Total biaya proyek</td><td class="num">{{ rupiah(expenseTotal) }}</td><td /></tr></tfoot>
            </table>
            <UiEmpty v-if="!fin.expenses.length" title="Belum ada pengeluaran" />
          </div>
        </section>
        <div class="flex flex-col gap-6">
          <section class="card-pad flex flex-col gap-3">
            <h2 class="section-title">Per Kategori</h2>
            <div v-for="c in byCategory" :key="c.label" class="flex flex-col gap-1.5">
              <div class="flex justify-between text-sm"><span>{{ c.label }}</span><span class="font-semibold tabular-nums">{{ rupiah(c.amount) }}</span></div>
              <div class="progress"><div :style="{ width: `${c.pct}%` }" /></div>
            </div>
            <p v-if="!byCategory.length" class="m-0 text-sm text-muted">—</p>
          </section>
          <section class="card-pad flex flex-col gap-3">
            <h2 class="section-title">Anggaran</h2>
            <div class="flex justify-between text-sm"><span class="text-muted">Anggaran biaya proyek</span><span class="font-semibold">{{ rupiah(p.budget) }}</span></div>
            <div class="flex justify-between text-sm"><span class="text-muted">Terpakai</span><span class="font-semibold">{{ rupiah(expenseTotal) }} ({{ budgetPct }}%)</span></div>
            <div class="progress"><div :style="{ width: `${Math.min(100, budgetPct)}%`, background: budgetPct > 100 ? '#D92D20' : budgetPct > 80 ? '#F79009' : undefined }" /></div>
            <span class="text-sm" :class="(p.budget ?? 0) - expenseTotal < 0 ? 'text-danger-700 font-semibold' : 'text-muted'">{{ (p.budget ?? 0) - expenseTotal < 0 ? `Melebihi anggaran ${rupiah(expenseTotal - (p.budget ?? 0))}` : `Sisa anggaran ${rupiah((p.budget ?? 0) - expenseTotal)}` }}</span>
          </section>
        </div>
      </div>
    </template>

    <!-- ═══ BUG ═══ -->
    <template v-if="tab === 'bug'">
      <section aria-label="Ringkasan bug" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
        <UiKpi label="Terbuka" :value="data.bugCounts?.open ?? 0" />
        <UiKpi label="Kritis terbuka" :value="data.bugCounts?.critical ?? 0" :color="data.bugCounts?.critical ? '#B42318' : undefined" />
        <UiKpi label="Menghambat termin" :value="data.bugCounts?.blocking ?? 0" :color="data.bugCounts?.blocking ? '#B54708' : undefined" />
        <UiKpi label="Selesai" :value="data.bugCounts?.done ?? 0" color="#067647" />
      </section>
      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 class="section-title">Bug Belum Selesai</h2>
          <div class="flex gap-3"><NuxtLink :to="`/bugs?project=${id}`" class="btn-secondary btn-sm">Buka papan kanban</NuxtLink><button v-if="can.manageBugs" type="button" class="btn-primary btn-sm" @click="showBug = true">+ Laporkan Bug</button></div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">Bug</th><th scope="col">Keparahan</th><th scope="col">Status</th><th scope="col">PIC</th></tr></thead>
            <tbody>
              <tr v-for="b in openBugs" :key="b.id">
                <td>
                  <div class="flex flex-col gap-1">
                    <NuxtLink :to="`/bugs/${b.id}`" class="font-semibold">{{ b.title }}</NuxtLink>
                    <span class="flex flex-wrap items-center gap-1.5 text-xs text-muted"><span class="font-mono">{{ b.code }}</span><span v-if="b.module" class="badge bg-soft-2 text-ink-2 !py-0.5">{{ b.module }}</span><span v-if="b.blocksTerm" class="badge bg-warning-50 text-warning-700 !py-0.5">menghambat termin</span>dilaporkan {{ dateId(b.createdAt) }}</span>
                  </div>
                </td>
                <td><UiBadge :tone="BUG_SEVERITY[b.severity]" /></td>
                <td class="nowrap">{{ BUG_STATUS[b.status].label }}</td>
                <td>{{ b.assigneeName ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <UiEmpty v-if="!openBugs.length" title="Tidak ada bug terbuka" />
        </div>
      </section>
    </template>

    <!-- ═══ TIM & BAGI HASIL ═══ -->
    <template v-if="tab === 'tim'">
      <div class="grid gap-6 xl:grid-cols-[1.4fr_1fr] items-start">
        <section v-if="can.team" class="card overflow-hidden min-w-0">
          <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line-3">
            <div class="flex flex-col gap-0.5"><h2 class="section-title">Anggota Tim</h2><span class="text-xs text-muted">{{ data.members.length }} anggota · {{ data.members.filter(m => m.payType === 'bagi_hasil').length }} bagi hasil</span></div>
            <button v-if="can.edit" type="button" class="btn-secondary btn-sm" @click="openAddMember">+ Tambah Anggota</button>
          </div>
          <ul v-if="data.members.length" class="m-0 p-0 list-none divide-y divide-line-3">
            <li v-for="m in data.members" :key="m.userId" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <div class="flex items-center gap-3 flex-1 min-w-48">
                <UiAvatar :name="m.name" :color="m.avatarColor" />
                <span class="flex flex-col min-w-0">
                  <span class="flex items-center gap-2"><span class="font-semibold truncate">{{ m.name }}</span><span v-if="data.pic?.id === m.userId" class="badge bg-brand-50 text-brand-700 !text-[11px]">PIC</span></span>
                  <span class="text-xs text-muted truncate">{{ m.roleInProject || 'Belum ada peran' }}</span>
                </span>
              </div>
              <span class="badge shrink-0" :class="m.payType === 'bagi_hasil' ? 'bg-brand-50 text-brand-700' : 'bg-soft-2 text-ink-2'">{{ m.payType === 'bagi_hasil' ? `Bagi hasil${m.shareWeight !== 1 ? ` · bobot ${m.shareWeight}` : ''}` : `Tetap${m.fixedFee ? ` · ${rupiah(m.fixedFee)}` : ''}` }}</span>
              <span class="flex items-center gap-1.5 text-xs shrink-0">
                <span class="badge bg-warning-50 text-warning-700">{{ data.bugs.filter(b => b.assigneeId === m.userId && b.status !== 'selesai').length }} bug aktif</span>
                <span class="badge bg-success-50 text-success-700">{{ data.bugs.filter(b => b.assigneeId === m.userId && b.status === 'selesai').length }} selesai</span>
              </span>
              <UiActionMenu v-if="can.edit" :label="`Aksi untuk ${m.name}`" :items="[
                { label: 'Ubah', onClick: () => openEditMember(m) },
                { label: 'Keluarkan dari tim', danger: true, onClick: () => removeMember(m) },
              ]" />
            </li>
          </ul>
          <UiEmpty v-else title="Belum ada anggota tim" />
        </section>
        <section v-if="fin" class="card-pad flex flex-col gap-3">
          <h2 class="section-title">Simulasi Bagi Hasil</h2>
          <span class="text-sm text-muted">Skema proyek ini: {{ data.scheme?.name ?? 'Kustom' }} — Modal {{ percent(p.capitalPct) }} · Pekerja {{ percent(p.workerPct) }} · Kas {{ percent(p.cashPct) }}</span>
          <div class="flex justify-between text-sm"><span class="text-muted">Total pembayaran klien</span><span class="font-semibold">{{ rupiah(pnl?.revenue) }}</span></div>
          <div class="flex justify-between text-sm"><span class="text-muted">Pengeluaran proyek</span><span class="font-semibold">− {{ rupiah(pnl?.expenses) }}</span></div>
          <div v-if="pnl?.distributed" class="flex justify-between text-sm"><span class="text-muted">Sudah dibagi</span><span class="font-semibold">− {{ rupiah(pnl?.distributed) }}</span></div>
          <div class="h-px bg-line-2" />
          <div class="flex justify-between text-sm"><span class="font-semibold">Laba belum dibagi</span><span class="font-bold text-brand-700">{{ rupiah(pnl?.undistributed) }}</span></div>
          <ul class="m-0 p-0 list-none flex flex-col gap-2 mt-1">
            <li v-for="(l, i) in sim.lines" :key="i" class="flex items-center gap-3">
              <UiAvatar :name="l.name" :size="28" :color="l.part === 'kas' ? '#98A2B3' : l.part === 'modal' ? '#0B6E63' : null" />
              <span class="flex-1 text-sm">{{ l.name }} <span class="text-muted">· {{ SHARE_PART_LABEL[l.part] }}</span></span>
              <span class="text-sm font-semibold tabular-nums">{{ rupiah(l.amount) }}</span>
            </li>
          </ul>
          <NuxtLink v-if="can.distribute" :to="`/investors?distribusi=${id}`" class="text-sm font-semibold">Buat distribusi bagi hasil →</NuxtLink>
        </section>
      </div>
      <section v-if="fin" class="card-pad flex flex-col gap-3">
        <h2 class="section-title">Riwayat Pencairan</h2>
        <div v-for="d in fin.distributions" :key="d.id" class="flex flex-wrap items-center justify-between gap-3 py-2 border-t border-line-3 first:border-t-0">
          <div class="flex flex-col"><span class="text-sm font-semibold">Distribusi {{ dateId(d.date) }}</span><span class="text-xs text-muted">Laba bersih {{ rupiah(d.netProfit) }} · skema {{ d.schemeSnapshot.schemeName }} ({{ d.schemeSnapshot.capitalPct }}/{{ d.schemeSnapshot.workerPct }}/{{ d.schemeSnapshot.cashPct }})</span></div>
          <div class="flex flex-wrap gap-2"><span v-for="l in d.lines" :key="l.id" class="badge bg-soft-2 text-ink-2">{{ l.name ?? 'Kas OCN' }} · {{ rupiah(l.amount) }}</span></div>
        </div>
        <p v-if="!fin.distributions.length" class="m-0 text-sm text-muted">Bagi hasil laba dicairkan setelah pelunasan diterima.</p>
      </section>
    </template>

    <!-- ═══ DOKUMEN ═══ -->
    <template v-if="tab === 'dokumen'">
      <ProjectSignatureRequests v-if="can.edit" :project-id="id" :project-name="p.name" :client-email="data.client && 'email' in data.client ? data.client.email : null" />
      <div class="grid gap-6 lg:grid-cols-[1.6fr_1fr] items-start">
        <section class="card-pad flex flex-col gap-4 min-w-0">
          <div class="flex items-center justify-between"><h2 class="section-title">Dokumen Proyek</h2><span class="text-sm text-muted">{{ data.documents.length }} file</span></div>
          <ul class="m-0 p-0 list-none flex flex-col divide-y divide-line-3">
            <li v-for="d in data.documents" :key="d.id" class="flex flex-wrap items-center gap-3 py-3">
              <span class="w-10 h-10 rounded-lg bg-soft-2 text-[11px] font-bold text-muted flex items-center justify-center uppercase">{{ d.name.split('.').pop()?.slice(0, 4) }}</span>
              <div class="flex-1 min-w-40 flex flex-col"><NuxtLink v-if="d.hasContent" :to="`/projects/${id}/dokumen/${d.id}`" class="text-sm font-semibold truncate hover:text-brand-700 hover:underline" :title="`Buka ${d.name}`">{{ d.name }}</NuxtLink><button v-else-if="d.fileUrl" type="button" class="text-left text-sm font-semibold truncate hover:text-brand-700 hover:underline" :title="`Pratinjau ${d.name}`" @click="preview = { url: d.fileUrl, name: d.name }">{{ d.name }}</button><span v-else class="text-sm font-semibold truncate">{{ d.name }}</span><span class="text-xs text-muted">{{ d.type }} · {{ dateId(d.createdAt) }}</span></div>
              <div class="w-32"><UiSelect :model-value="d.status" :disabled="!can.manageDocs" size="sm" :aria-label="`Status ${d.name}`" :options="[{ value: 'draf', label: 'Draf' }, { value: 'review', label: 'Review' }, { value: 'final', label: 'Final' }]" @change="v => setDocStatus(d.id, v as string)" /></div>
              <UiActionMenu :label="`Aksi untuk ${d.name}`" :items="[
                { label: can.manageDocs && d.status !== 'final' ? 'Buka & edit' : 'Buka', hidden: !d.hasContent, onClick: () => { navigateTo(`/projects/${id}/dokumen/${d.id}`) } },
                { label: 'Unduh PDF', href: `/api/documents/${d.id}/export?format=pdf&download=1`, external: true, hidden: !d.hasContent },
                { label: 'Unduh Word', href: `/api/documents/${d.id}/export?format=docx&download=1`, external: true, hidden: !d.hasContent },
                { label: 'Pratinjau', hidden: !d.fileUrl, onClick: () => { preview = { url: d.fileUrl, name: d.name } } },
                { label: 'Unduh', href: d.fileUrl ?? undefined, external: true, hidden: !d.fileUrl },
                { label: 'Hapus dokumen', danger: true, hidden: !can.manageDocs, onClick: () => deleteDoc(d.id, d.name) },
              ]" />
            </li>
          </ul>
          <div v-if="can.manageDocs" class="flex flex-wrap items-end gap-3">
            <div class="w-48"><UiSelect v-model="docType" label="Jenis dokumen" :options="DOC_TYPES.map(t => ({ value: t, label: t }))" /></div>
          </div>
          <label
            v-if="can.manageDocs"
            class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer"
            :class="dragOver ? 'border-brand-600 bg-brand-soft' : 'border-line'"
            @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop"
          >
            <span class="text-sm font-semibold">{{ uploading ? 'Mengunggah…' : 'Tarik file ke sini atau pilih file' }}</span>
            <span class="text-xs text-muted">PDF, DOCX, XLSX, gambar · maks 10 MB · disimpan privat</span>
            <span class="btn-secondary btn-sm">Pilih file</span>
            <input type="file" class="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,image/*" @change="e => addDoc((e.target as HTMLInputElement).files?.[0])">
          </label>
        </section>
        <section class="card-pad flex flex-col gap-3">
          <div class="flex items-center justify-between gap-2"><h2 class="section-title">Dokumen Wajib</h2><span class="badge" :class="docDone === docChecklist.length ? 'bg-success-50 text-success-700' : 'bg-soft-2 text-ink-2'">{{ docDone }}/{{ docChecklist.length }} final</span></div>
          <div class="h-1.5 rounded-full bg-soft-2 overflow-hidden" role="progressbar" :aria-valuenow="docDone" aria-valuemin="0" :aria-valuemax="docChecklist.length" aria-label="Kelengkapan dokumen wajib"><div class="h-full bg-brand-600 transition-all" :style="{ width: `${(docDone / docChecklist.length) * 100}%` }" /></div>
          <ul class="m-0 p-0 list-none flex flex-col divide-y divide-line-3">
            <li v-for="c in docChecklist" :key="c.label" class="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <span class="w-5 h-5 shrink-0 rounded-full flex items-center justify-center" :class="c.done ? 'bg-brand-600 text-white' : 'border-2 border-line'" aria-hidden="true"><svg v-if="c.done" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
              <span class="flex-1 flex flex-col min-w-0"><span class="text-sm font-semibold" :class="c.done ? '' : 'text-ink-2'">{{ c.label }}</span><span class="text-xs text-muted">{{ c.status ? `${c.count} file · status tertinggi ${DOC_STATUS_LABEL[c.status] ?? c.status}` : 'Belum ada file' }}</span></span>
              <span v-if="c.status && !c.done" class="badge bg-warning-50 text-warning-700 shrink-0">{{ DOC_STATUS_LABEL[c.status] ?? c.status }}</span>
              <button v-if="can.manageDocs && !c.done && AUTO_DOCS.includes(c.label)" type="button" class="btn-primary btn-sm shrink-0" :disabled="!!generating" :aria-label="`Buat ${c.label} otomatis`" @click="generateDoc(c.label)">{{ generating === c.label ? 'Membuat…' : 'Buat otomatis' }}</button>
              <button v-if="can.manageDocs && !c.done" type="button" class="btn-secondary btn-sm shrink-0" :disabled="uploading" :aria-label="`Unggah ${c.label}`" @click="uploadRequired(c.label)">{{ c.status ? 'Tambah' : 'Unggah' }}</button>
            </li>
          </ul>
          <p class="m-0 text-xs text-muted">Dokumen dihitung lengkap bila berstatus “Final”. Ubah status di daftar dokumen di sebelah kiri.</p>
          <input ref="docFile" type="file" class="sr-only" tabindex="-1" aria-hidden="true" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,image/*" @change="e => { addDoc((e.target as HTMLInputElement).files?.[0]); (e.target as HTMLInputElement).value = '' }">
        </section>
      </div>
    </template>

    <UiFilePreview :open="!!preview" :url="preview?.url ?? null" :name="preview?.name ?? ''" @close="preview = null" />
    <FinancePaymentModal :open="showPay" :project-id="id" :term-id="payTerm" @close="showPay = false" @saved="refresh" />
    <FinanceExpenseModal :open="showExpense" :project-id="id" :expense="editExpense" @close="showExpense = false" @saved="refresh" />
    <BugModal :open="showBug" :project-id="id" :projects="projects" @close="showBug = false" @saved="() => refresh()" />
    <ProjectMemberModal :open="showMember" :editing="editMember" :project-id="id" :existing-ids="data.members.map(m => m.userId)" :can-money="can.editMoney" @close="showMember = false" @saved="() => refresh()" />
  </div>
</template>
