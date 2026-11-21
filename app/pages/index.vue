<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['laporan', 'lihat'] })
useHead({ title: 'Dashboard Investor — OCN Project Hub' })
const { can } = useAuth()
/** Tanpa akses lihat semua Investor & Modal, angka modal & bagi hasil adalah milik sendiri. */
const isInvestor = computed(() => !can('investor', 'lihat'))
const showBugs = computed(() => can('bug', 'lihat'))
const year = todayISO().slice(0, 4)
const period = ref('6m')
const periodOpts = [
  { value: '6m', label: '6 bulan terakhir' },
  { value: `year:${year}`, label: `Tahun ${year}` },
  { value: 'all', label: 'Semua waktu' },
]
const { data, pending } = await useFetch('/api/dashboard', { query: { period }, watch: [period] })

const flows = computed(() => {
  const list = data.value?.cashflow ?? []
  const max = Math.max(1, ...list.map(m => Math.max(m.income, m.expense)))
  return list.map(m => ({
    ...m, name: monthLabel(m.month).split(' ')[0],
    inH: Math.round(m.income / max * 170), outH: Math.round(m.expense / max * 170),
    net: m.income - m.expense,
  }))
})
const usageTotal = computed(() => (data.value?.usage ?? []).reduce((a, u) => a + u.amount, 0))
const USAGE_COLORS = ['#0B6E63', '#2E90FA', '#F79009', '#7A5AF8', '#C11574']
const usage = computed(() => (data.value?.usage ?? []).map((u, i) => ({
  ...u, color: 'unused' in u && u.unused ? '#D0D5DD' : USAGE_COLORS[i % USAGE_COLORS.length],
  pct: usageTotal.value ? u.amount / usageTotal.value * 100 : 0,
})))
const k = computed(() => data.value?.kpis)
const exportUrl = computed(() => `/api/reports/export?type=investor&format=pdf&period=${encodeURIComponent(period.value)}`)
</script>

<template>
  <UiPageHeader title="Dashboard Investor" subtitle="Ringkasan modal, arus kas, bagi hasil, dan kesehatan proyek yang didanai.">
    <template #actions>
      <div class="w-56"><UiSelect v-model="period" :options="periodOpts" aria-label="Periode" /></div>
      <a :href="exportUrl" class="btn-primary">Unduh Laporan PDF</a>
    </template>
  </UiPageHeader>

  <section v-if="k" aria-label="Ringkasan" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]" :aria-busy="pending">
    <UiKpi :label="isInvestor ? 'Modal Ditanam' : 'Modal Investor Disetor'" :value="rupiah(k.capital)" :sub="k.capitalSince ? `Sejak ${monthLabel(k.capitalSince.slice(0, 7))} · ${k.capitalCount} tahap setoran` : 'Belum ada setoran'" />
    <UiKpi label="Nilai Kontrak Aktif" :value="rupiahShort(k.activeContract)" :sub="`${k.activeCount} proyek berjalan`" />
    <UiKpi label="Kas Operasional Tersisa" :value="rupiah(k.cash)" :sub="k.totalCapital ? `${k.cashPctOfCapital}% dari modal` : 'Saldo kas OCN'" :color="k.cash < 0 ? '#B42318' : undefined" />
    <UiKpi label="Bagi Hasil Diterima" :value="rupiah(k.payouts)" :sub="`${k.payoutCount} distribusi · ${k.payoutPctOfCapital}% dari modal`" />
  </section>

  <div class="grid gap-6 lg:grid-cols-[1.6fr_1fr] items-start">
    <section class="card-pad flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="section-title">Arus Kas Bulanan</h2>
        <div class="flex gap-4 text-xs text-muted">
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-brand-600" />Pemasukan (termin klien)</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-warning-500" />Pengeluaran</span>
        </div>
      </div>
      <div v-if="flows.length" role="img" :aria-label="`Grafik batang pemasukan dan pengeluaran ${flows.map(f => `${f.name}: masuk ${rupiah(f.income)}, keluar ${rupiah(f.expense)}`).join('; ')}`" class="flex items-end justify-around gap-2 h-[240px] pt-4 overflow-x-auto">
        <div v-for="m in flows" :key="m.month" class="flex flex-col items-center gap-2 min-w-14">
          <div class="flex items-end gap-1 h-[170px]">
            <div class="w-[18px] bg-brand-600 rounded-t" :style="{ height: `${m.inH}px` }" />
            <div class="w-[18px] bg-warning-500 rounded-t" :style="{ height: `${m.outH}px` }" />
          </div>
          <span class="text-xs font-semibold">{{ m.name }}</span>
          <span class="text-[11px] whitespace-nowrap" :class="m.net >= 0 ? 'text-success-700' : 'text-danger-700'">Net {{ m.net >= 0 ? '+' : '' }}{{ rupiahShort(m.net).replace('Rp ', '') }}</span>
        </div>
      </div>
      <UiEmpty v-else title="Belum ada arus kas di periode ini" text="Pembayaran klien dan pengeluaran yang dicatat akan tampil di sini." />
    </section>

    <section class="card-pad flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="section-title">Penggunaan Modal</h2>
        <span class="text-sm text-muted">Dari total modal {{ rupiah(k?.totalCapital) }}</span>
      </div>
      <div class="flex h-3 rounded-full overflow-hidden bg-soft-2" aria-hidden="true">
        <div v-for="u in usage" :key="u.label" :style="{ width: `${u.pct}%`, background: u.color }" />
      </div>
      <ul class="m-0 p-0 list-none flex flex-col gap-2.5">
        <li v-for="u in usage" :key="u.label" class="flex items-center justify-between gap-3 text-sm">
          <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-[3px]" :style="{ background: u.color }" />{{ u.label }}</span>
          <span class="font-semibold tabular-nums">{{ rupiah(u.amount) }} <span class="font-normal text-muted">· {{ Math.round(u.pct) }}%</span></span>
        </li>
      </ul>
      <NuxtLink to="/reports" class="text-sm font-semibold">Lihat rincian pengeluaran →</NuxtLink>
    </section>
  </div>

  <section class="card overflow-hidden">
    <div class="flex items-center justify-between gap-3 px-5 py-4">
      <h2 class="section-title">Proyek yang Didanai</h2>
      <NuxtLink to="/projects" class="text-sm font-semibold">Semua proyek →</NuxtLink>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th scope="col">Proyek</th><th scope="col">Progress</th><th scope="col" class="num">Dibayar Klien</th><th v-if="showBugs" scope="col">Bug Terbuka</th><th scope="col">Status</th></tr></thead>
        <tbody>
          <tr v-for="p in data?.projects ?? []" :key="p.id">
            <td><div class="flex flex-col gap-0.5"><NuxtLink :to="`/projects/${p.id}`" class="font-semibold">{{ p.name }}</NuxtLink><span class="text-xs text-muted">{{ p.client ?? '—' }}</span></div></td>
            <td class="nowrap"><div class="flex items-center gap-2"><div class="progress w-14"><div :style="{ width: `${p.progress}%` }" /></div><span class="text-xs font-semibold">{{ p.progress }}%</span></div></td>
            <td class="num"><div class="flex flex-col items-end gap-0.5"><span class="font-semibold">{{ rupiah(p.paid) }}</span><span class="text-xs text-muted">dari {{ rupiah(p.contractValue) }}</span></div></td>
            <td v-if="showBugs" class="nowrap"><NuxtLink :to="`/bugs?project=${p.id}`">{{ p.openBugs ? `${p.openBugs} terbuka` : '0' }}</NuxtLink></td>
            <td><UiBadge :tone="PROJECT_STATUS[p.status]" /></td>
          </tr>
        </tbody>
      </table>
      <UiEmpty v-if="!data?.projects.length" title="Belum ada proyek yang didanai" text="Proyek dengan skema bagi hasil yang memiliki bagian modal akan tampil di sini." />
    </div>
  </section>

  <div class="grid gap-6 lg:grid-cols-2 items-start">
    <section class="card-pad flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="section-title">Skema Bagi Hasil</h2>
        <span class="text-sm text-muted">Laba bersih proyek = pembayaran klien − pengeluaran proyek</span>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div v-for="s in [
          { pct: data?.scheme?.capitalPct ?? 40, label: 'Bagian Modal', sub: 'Investor, sesuai porsi modal', c: '#0B6E63' },
          { pct: data?.scheme?.workerPct ?? 40, label: 'Bagian Pekerja', sub: 'Tim yang mengerjakan', c: '#2E90FA' },
          { pct: data?.scheme?.cashPct ?? 20, label: 'Kas OCN', sub: 'Operasional & cadangan', c: '#98A2B3' },
        ]" :key="s.label" class="rounded-xl border border-line-2 p-4 flex flex-col gap-1">
          <span class="text-2xl font-bold" :style="{ color: s.c }">{{ percent(s.pct) }}</span>
          <span class="text-sm font-semibold">{{ s.label }}</span>
          <span class="text-xs text-muted">{{ s.sub }}</span>
        </div>
      </div>
      <p class="m-0 text-xs text-muted">Persentase diatur per proyek sesuai perjanjian; setiap distribusi menyimpan salinan skema pada saat itu.</p>
    </section>

    <section class="card-pad flex flex-col gap-4">
      <h2 class="section-title">Distribusi Bagi Hasil Terakhir</h2>
      <ul class="m-0 p-0 list-none flex flex-col divide-y divide-line-3">
        <li v-for="d in data?.distributions ?? []" :key="d.id" class="flex items-center justify-between gap-3 py-3">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-semibold">{{ d.project }}</span>
            <span class="text-xs text-muted">Laba bersih {{ rupiah(d.netProfit) }} · {{ dateId(d.date) }}</span>
          </div>
          <div class="flex flex-col items-end gap-0.5">
            <span class="text-sm font-bold text-success-700">+ {{ rupiah(d.share) }}</span>
            <span class="text-xs text-muted">{{ isInvestor ? 'Bagian Anda' : 'Bagian modal' }}</span>
          </div>
        </li>
      </ul>
      <UiEmpty v-if="!data?.distributions.length" title="Belum ada distribusi" text="Bagi hasil laba dicairkan setelah pelunasan klien diterima." />
      <div v-if="data?.next" class="rounded-lg bg-soft px-4 py-3 flex flex-col gap-0.5">
        <span class="text-sm font-semibold">Distribusi berikutnya: {{ data.next.project }}</span>
        <span class="text-xs text-muted">{{ data.next.undistributed > 0 ? `Laba belum dibagi ${rupiah(data.next.undistributed)}` : `Setelah pelunasan klien (sisa ${rupiah(data.next.remaining)})` }}</span>
      </div>
    </section>
  </div>
</template>
