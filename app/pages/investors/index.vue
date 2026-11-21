<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['investor', 'lihat'] })
useHead({ title: 'Investor & Modal — OCN Project Hub' })
const route = useRoute()
const toast = useToast()
const { confirm } = useConfirm()
const [{ data, refresh }, { data: dists, refresh: rDist }, { data: projects }] = await Promise.all([
  useFetch('/api/investors'),
  useFetch('/api/distributions', { default: () => [] }),
  useFetch('/api/projects'),
])
const refreshAll = () => Promise.all([refresh(), rDist()])
const s = computed(() => data.value?.summary)

// ── Undang investor ──
const inviteOpen = ref(false)
const invite = reactive({ name: '', email: '', plannedCapital: 0 })
async function sendInvite() {
  try {
    const r = await $fetch<{ inviteUrl?: string }>('/api/users', { method: 'POST', body: { ...invite, role: 'investor' } })
    toast.success(`Undangan dikirim ke ${invite.email}`)
    if (r.inviteUrl) console.info('Tautan undangan (dev):', r.inviteUrl)
    Object.assign(invite, { name: '', email: '', plannedCapital: 0 })
    inviteOpen.value = false
    await refresh()
  } catch (e) { toast.error(errorMessage(e)) }
}

// ── Setoran modal ──
const depOpen = ref(route.query.catat === 'modal')
const dep = reactive({ investorId: null as number | null, date: todayISO() as string | null, amount: 0, purpose: '', proofUrl: null as string | null })
const invOpts = computed(() => (data.value?.investors ?? []).map(i => ({ value: i.investorId as number | null, label: i.name, desc: i.status === 'aktif' ? `Aktif · modal ${rupiah(i.capital)}` : 'Calon investor' })))
function openDeposit(investorId?: number) { Object.assign(dep, { investorId: investorId ?? invOpts.value[0]?.value ?? null, date: todayISO(), amount: 0, purpose: '', proofUrl: null }); depOpen.value = true }
async function saveDeposit() {
  try {
    await $fetch('/api/capital-deposits', { method: 'POST', body: { ...dep, purpose: dep.purpose || null } })
    toast.success('Setoran modal dicatat & masuk kas OCN')
    depOpen.value = false
    await refreshAll()
  } catch (e) { toast.error(errorMessage(e)) }
}
async function delDeposit(id: number) {
  const ok = await confirm({ variant: 'danger', title: 'Hapus setoran modal ini?', message: 'Porsi modal investor dan saldo kas dihitung ulang.', confirmText: 'Hapus', action: () => $fetch<unknown>(`/api/capital-deposits/${id}`, { method: 'DELETE' }) })
  if (ok) await refreshAll()
}

// ── Distribusi ──
const distOpen = ref(false)
const dist = reactive({ projectId: null as number | null, date: todayISO() as string | null, amount: null as number | null, notes: '' })
const preview = ref<any>(null)
const previewErr = ref('')
const projOpts = computed(() => (projects.value?.projects ?? []).map(p => ({ value: p.id as number | null, label: p.name, desc: PROJECT_STATUS[p.status as ProjectStatus].label })))
function openDist(pid?: number) { Object.assign(dist, { projectId: pid ?? null, date: todayISO(), amount: null, notes: '' }); preview.value = null; distOpen.value = true }
watch(() => [dist.projectId, dist.amount, distOpen.value] as const, async ([pid, amount, open]) => {
  previewErr.value = ''
  if (!pid || !open) { preview.value = null; return }
  try { preview.value = await $fetch('/api/distributions/preview', { query: { projectId: pid, amount: amount || undefined } }) } catch (e) { preview.value = null; previewErr.value = errorMessage(e) }
})
async function saveDist() {
  const ok = await confirm({
    variant: 'warning', title: 'Simpan distribusi bagi hasil?',
    message: `Laba bersih ${rupiah(preview.value?.netProfit)} dari ${preview.value?.project.name} dibagi sesuai skema. Bagian modal & pekerja (${rupiah((preview.value?.parts.modal ?? 0) + (preview.value?.parts.pekerja ?? 0))}) keluar dari kas OCN.`,
    confirmText: 'Simpan distribusi',
    action: () => $fetch<unknown>('/api/distributions', { method: 'POST', body: { projectId: dist.projectId, date: dist.date, amount: dist.amount || null, notes: dist.notes || null } }),
  })
  if (ok) { toast.success('Distribusi bagi hasil disimpan'); distOpen.value = false; await refreshAll() }
}
async function delDist(id: number) {
  const ok = await confirm({ variant: 'danger', title: 'Batalkan distribusi ini?', message: 'Dana dikembalikan ke kas di mutasi dan laba proyek kembali “belum dibagi”.', confirmText: 'Batalkan distribusi', action: () => $fetch<unknown>(`/api/distributions/${id}`, { method: 'DELETE' }) })
  if (ok) await refreshAll()
}
if (route.query.distribusi) openDist(Number(route.query.distribusi))

async function toggleStatus(i: { investorId: number, status: string }) {
  try { await $fetch<unknown>(`/api/investors/${i.investorId}`, { method: 'PATCH', body: { status: i.status === 'aktif' ? 'calon' : 'aktif' } }); await refresh() } catch (e) { toast.error(errorMessage(e)) }
}
</script>

<template>
  <UiPageHeader title="Investor &amp; Modal" subtitle="Kelola pemodal, setoran modal, porsi kepemilikan, dan distribusi bagi hasil.">
    <template #actions>
      <button type="button" class="btn-secondary" :disabled="!invOpts.length" @click="openDeposit()">Catat Setoran Modal</button>
      <button type="button" class="btn-primary" :aria-expanded="inviteOpen" @click="inviteOpen = !inviteOpen">+ Undang Investor</button>
    </template>
  </UiPageHeader>

  <form v-if="inviteOpen" aria-label="Undang investor" class="card-pad flex flex-col gap-4 border-brand-100" @submit.prevent="sendInvite">
    <h2 class="section-title">Undang Investor Baru</h2>
    <div class="grid gap-4 sm:grid-cols-3">
      <label class="field">Nama<input v-model="invite.name" class="input" placeholder="Nama lengkap" required></label>
      <label class="field">Email<input v-model="invite.email" type="email" class="input" placeholder="nama@email.com" required></label>
      <UiMoneyInput v-model="invite.plannedCapital" label="Rencana modal" />
    </div>
    <span class="text-sm text-muted">Investor mendapat akses baca ke Dashboard Investor dan laporan bulanan. Undangan berlaku 7 hari.</span>
    <div class="flex justify-end gap-2"><button type="button" class="btn-secondary" @click="inviteOpen = false">Batal</button><button type="submit" class="btn-primary">Kirim Undangan</button></div>
  </form>

  <section v-if="s" aria-label="Ringkasan modal" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
    <UiKpi label="Total modal disetor" :value="rupiah(s.totalCapital)" :sub="`${s.activeInvestors} investor aktif · ${s.prospects} calon`" />
    <UiKpi label="Kas OCN tersedia" :value="rupiah(s.cash)" sub="Termasuk pembayaran klien" />
    <UiKpi label="Bagi hasil dibayarkan" :value="rupiah(s.totalPayout)" sub="Bagian modal, semua distribusi" />
    <UiKpi label="Distribusi" :value="dists.length" sub="Total distribusi tersimpan" />
  </section>

  <section class="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
    <article v-for="i in data?.investors ?? []" :key="i.investorId" class="card-pad flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <UiAvatar :name="i.name" :color="i.avatarColor" :size="44" />
        <div class="flex flex-col flex-1 min-w-0"><span class="font-bold truncate">{{ i.name }}</span><span class="text-xs text-muted truncate">{{ i.email }}{{ i.userStatus === 'diundang' ? ' · undangan belum diterima' : '' }}</span></div>
        <button type="button" class="badge" :class="i.status === 'aktif' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'" :title="'Klik untuk ubah status'" @click="toggleStatus(i)">{{ i.status === 'aktif' ? 'Aktif' : 'Calon' }}</button>
      </div>
      <dl class="m-0 grid grid-cols-2 gap-3 text-sm">
        <div class="flex flex-col"><dt class="text-xs text-muted">Modal disetor</dt><dd class="m-0 font-bold">{{ rupiah(i.capital) }}</dd></div>
        <div class="flex flex-col"><dt class="text-xs text-muted">Porsi modal</dt><dd class="m-0 font-bold">{{ percent(i.portion) }}</dd></div>
        <div class="flex flex-col"><dt class="text-xs text-muted">Bagi hasil diterima</dt><dd class="m-0 font-bold text-success-700">{{ rupiah(i.payout) }}</dd></div>
        <div class="flex flex-col"><dt class="text-xs text-muted">Distribusi</dt><dd class="m-0 font-bold">{{ i.payoutCount }}×</dd></div>
      </dl>
      <div class="progress"><div :style="{ width: `${i.portion}%`, background: i.avatarColor ?? undefined }" /></div>
      <span v-if="i.notes" class="text-xs text-muted">{{ i.notes }}</span>
      <button type="button" class="btn-secondary btn-sm w-full mt-auto" @click="openDeposit(i.investorId)">+ Setoran</button>
    </article>
    <UiEmpty v-if="!data?.investors.length" class="col-span-full card" title="Belum ada investor" text="Undang investor; setelah setoran modal pertama dicatat, statusnya menjadi Aktif." />
  </section>

  <section class="card overflow-hidden">
    <div class="px-5 py-4"><h2 class="section-title">Riwayat Setoran Modal</h2></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th scope="col">Tanggal</th><th scope="col">Investor</th><th scope="col" class="num">Nominal</th><th scope="col">Peruntukan</th><th scope="col" class="w-14"><span class="sr-only">Aksi</span></th></tr></thead>
        <tbody>
          <tr v-for="d in data?.deposits ?? []" :key="d.id">
            <td class="nowrap">{{ dateId(d.date) }}</td><td>{{ d.name }}</td><td class="num">{{ rupiah(d.amount) }}</td><td class="whitespace-normal">{{ d.purpose ?? '—' }}</td>
            <td class="text-right"><UiActionMenu :label="`Aksi setoran ${d.name} ${dateId(d.date)}`" :items="[
              { label: 'Lihat bukti', href: d.proofUrl ?? undefined, external: true, hidden: !d.proofUrl },
              { label: 'Hapus setoran', danger: true, onClick: () => delDeposit(d.id) },
            ]" /></td>
          </tr>
        </tbody>
      </table>
      <UiEmpty v-if="!data?.deposits.length" title="Belum ada setoran modal" />
    </div>
  </section>

  <section class="card overflow-hidden">
    <div class="flex items-center justify-between gap-3 px-5 py-4">
      <h2 class="section-title">Distribusi Bagi Hasil</h2>
      <button type="button" class="btn-primary btn-sm" @click="openDist()">+ Distribusi Baru</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th scope="col">Proyek &amp; skema</th><th scope="col">Laba &amp; pembagian</th><th scope="col">Penerima</th><th scope="col" class="w-14"><span class="sr-only">Aksi</span></th></tr></thead>
        <tbody>
          <tr v-for="d in dists" :key="d.id">
            <td><div class="flex flex-col gap-0.5"><NuxtLink :to="`/projects/${d.projectId}?tab=tim`" class="font-semibold">{{ d.projectName }}</NuxtLink><span class="text-xs text-muted">{{ dateId(d.date) }} · {{ d.snapshot.schemeName }} {{ d.snapshot.capitalPct }}/{{ d.snapshot.workerPct }}/{{ d.snapshot.cashPct }}</span></div></td>
            <td><dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 text-xs [&>dd]:whitespace-nowrap"><dt class="font-semibold text-ink">Laba bersih</dt><dd class="m-0 text-right tabular-nums font-semibold">{{ rupiah(d.netProfit) }}</dd><dt class="text-muted">Modal</dt><dd class="m-0 text-right tabular-nums">{{ rupiah(d.totals.modal) }}</dd><dt class="text-muted">Pekerja</dt><dd class="m-0 text-right tabular-nums">{{ rupiah(d.totals.pekerja) }}</dd><dt class="text-muted">Kas</dt><dd class="m-0 text-right tabular-nums">{{ rupiah(d.totals.kas) }}</dd></dl></td>
            <td><div class="flex flex-wrap gap-1"><span v-for="(l, k) in d.lines" :key="k" class="badge bg-soft-2 text-ink-2 !py-0.5">{{ l.name ?? 'Kas' }} {{ rupiahShort(l.amount) }}</span></div></td>
            <td class="text-right"><UiActionMenu :label="`Aksi distribusi ${d.projectName}`" :items="[
              { label: 'Lihat proyek', to: `/projects/${d.projectId}?tab=tim` },
              { label: 'Batalkan distribusi', danger: true, onClick: () => delDist(d.id) },
            ]" /></td>
          </tr>
        </tbody>
      </table>
      <UiEmpty v-if="!dists.length" title="Belum ada distribusi" text="Laba bersih dihitung dan dibagi setelah pelunasan diterima." />
    </div>
  </section>

  <UiModal :open="depOpen" title="Catat Setoran Modal" description="Setoran masuk ke kas OCN untuk operasional proyek." width="520px" @close="depOpen = false">
    <UiSelect v-model="dep.investorId" label="Investor" :options="invOpts" />
    <div class="grid gap-4 sm:grid-cols-2">
      <UiMoneyInput v-model="dep.amount" label="Nominal" />
      <UiDateTimeInput v-model="dep.date" label="Tanggal" :clearable="false" />
    </div>
    <label class="field">Peruntukan<input v-model="dep.purpose" class="input" placeholder="Mis. Kas operasional proyek Q4"></label>
    <div class="flex flex-col gap-1.5"><span class="text-sm font-semibold text-ink-2">Bukti transfer</span><UiFileButton v-model="dep.proofUrl" folder="bukti" /></div>
    <template #footer>
      <button type="button" class="btn-secondary" @click="depOpen = false">Batal</button>
      <button type="button" class="btn-primary" :disabled="!dep.investorId || !dep.amount" @click="saveDeposit">Simpan Setoran</button>
    </template>
  </UiModal>

  <UiModal :open="distOpen" title="Distribusi Bagi Hasil" description="Laba bersih × persentase skema proyek; bagian modal dibagi sesuai porsi modal investor aktif." width="640px" @close="distOpen = false">
    <div class="grid gap-4 sm:grid-cols-2">
      <UiSearchSelect v-model="dist.projectId" label="Proyek" :options="projOpts" search-placeholder="Cari proyek…" />
      <UiDateTimeInput v-model="dist.date" label="Tanggal pencairan" :clearable="false" />
    </div>
    <p v-if="previewErr" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ previewErr }}</p>
    <template v-if="preview">
      <dl class="m-0 grid gap-2 sm:grid-cols-3 rounded-lg bg-soft p-4 text-sm">
        <div><dt class="text-xs text-muted">Pendapatan diterima</dt><dd class="m-0 font-semibold">{{ rupiah(preview.pnl?.revenue) }}</dd></div>
        <div><dt class="text-xs text-muted">Pengeluaran proyek</dt><dd class="m-0 font-semibold">{{ rupiah(preview.pnl?.expenses) }}</dd></div>
        <div><dt class="text-xs text-muted">Laba belum dibagi</dt><dd class="m-0 font-bold text-brand-700">{{ rupiah(preview.available) }}</dd></div>
      </dl>
      <UiMoneyInput v-model="dist.amount" label="Laba yang dibagi" :hint="`Kosongkan untuk membagi seluruh ${rupiah(preview.available)}`" />
      <div class="flex flex-col gap-2">
        <span class="text-sm font-semibold">Rincian — skema {{ preview.snapshot.schemeName }} ({{ preview.snapshot.capitalPct }}/{{ preview.snapshot.workerPct }}/{{ preview.snapshot.cashPct }})</span>
        <div class="table-wrap rounded-lg border border-line-2">
          <table class="data-table">
            <thead><tr><th scope="col">Penerima</th><th scope="col">Bagian</th><th scope="col" class="num">Porsi</th><th scope="col" class="num">Nominal</th></tr></thead>
            <tbody>
              <tr v-for="(l, i) in preview.lines" :key="i"><td>{{ l.name }}</td><td>{{ SHARE_PART_LABEL[l.part as 'modal' | 'pekerja' | 'kas'] }}</td><td class="num">{{ percent(l.basisPct) }}</td><td class="num">{{ rupiah(l.amount) }}</td></tr>
            </tbody>
            <tfoot><tr><td colspan="3">Total</td><td class="num">{{ rupiah(preview.netProfit) }}</td></tr></tfoot>
          </table>
        </div>
        <span class="text-xs text-muted">Saldo kas OCN saat ini {{ rupiah(preview.cash) }}. Angka laba, skema, dan rincian ini disimpan sebagai snapshot.</span>
      </div>
      <label class="field">Catatan<input v-model="dist.notes" class="input" placeholder="Opsional"></label>
    </template>
    <template #footer>
      <button type="button" class="btn-secondary" @click="distOpen = false">Batal</button>
      <button type="button" class="btn-primary" :disabled="!preview || preview.netProfit <= 0" @click="saveDist">Simpan Distribusi</button>
    </template>
  </UiModal>
</template>
