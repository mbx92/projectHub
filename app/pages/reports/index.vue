<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['laporan', 'lihat'] })
useHead({ title: 'Laporan — OCN Project Hub' })
const route = useRoute()
const router = useRouter()
const { can } = useAuth()
const showBugs = computed(() => can('bug', 'lihat'))
const today = todayISO()
const y = Number(today.slice(0, 4))
const m = today.slice(5, 7)
const q = Math.ceil(Number(m) / 3)
const prevMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)
const periodOpts = [
  { value: `year:${y}`, label: `Tahun ${y}` },
  { value: `month:${y}-${m}`, label: monthLabel(`${y}-${m}`, true) },
  { value: `month:${prevMonth}`, label: monthLabel(prevMonth, true) },
  { value: `q:${y}-${q}`, label: `Kuartal ${q} ${y}` },
  { value: `year:${y - 1}`, label: `Tahun ${y - 1}` },
  { value: 'all', label: 'Semua waktu' },
]
const period = ref(typeof route.query.period === 'string' ? route.query.period : `year:${y}`)
if (!periodOpts.some(o => o.value === period.value)) periodOpts.push({ value: period.value, label: period.value.startsWith('month:') ? monthLabel(period.value.slice(6), true) : period.value })

const [{ data, pending }, { data: fin, pending: finPending }, { data: settings }] = await Promise.all([
  useFetch('/api/reports', { query: { period }, watch: [period] }),
  useFetch('/api/reports/statements', { query: { period }, watch: [period] }),
  useFetch('/api/settings'),
])
const company = computed(() => settings.value?.business.name ?? 'OCN Development')
const k = computed(() => data.value?.kpis)

type TabKey = 'ringkasan' | 'labarugi' | 'neraca' | 'aruskas' | 'modal' | 'bukukas' | 'proyek' | 'piutang' | 'bug'
const tabs = computed(() => ([
  { key: 'ringkasan', label: 'Ringkasan', show: true, exportType: 'lengkap' },
  { key: 'labarugi', label: 'Laba Rugi', show: true, exportType: 'labarugi' },
  { key: 'neraca', label: 'Neraca', show: true, exportType: 'neraca' },
  { key: 'aruskas', label: 'Arus Kas', show: true, exportType: 'aruskas' },
  { key: 'modal', label: 'Perubahan Ekuitas', show: true, exportType: 'modal' },
  { key: 'bukukas', label: 'Buku Kas', show: !!fin.value?.cashbook, exportType: 'bukukas' },
  { key: 'proyek', label: 'Per Proyek', show: true, exportType: 'proyek' },
  { key: 'piutang', label: 'Piutang', show: true, exportType: 'piutang' },
  { key: 'bug', label: 'Bug', show: showBugs.value, exportType: 'bug' },
] as { key: TabKey, label: string, show: boolean, exportType: string }[]).filter(t => t.show))
const tab = ref<TabKey>(tabs.value.some(t => t.key === route.query.tab) ? route.query.tab as TabKey : 'ringkasan')
watch([tab, period], ([t, p]) => router.replace({ query: { ...route.query, tab: t, period: p } }))
const currentExport = computed(() => tabs.value.find(t => t.key === tab.value)?.exportType ?? 'lengkap')
const url = (type: string, format: 'pdf' | 'xlsx') => `/api/reports/export?type=${type}&format=${format}&period=${encodeURIComponent(period.value)}`

const catMax = computed(() => Math.max(1, ...(data.value?.categories ?? []).map(c => c.total)))
const COLORS = ['#0B6E63', '#2E90FA', '#F79009', '#7A5AF8', '#C11574', '#067647', '#98A2B3']
const distStatus = (p: { profit: number, distributed: number, undistributed: number }) =>
  p.profit <= 0 ? { label: 'Belum ada laba', fg: '#344054', bg: '#F2F4F7' }
    : p.undistributed <= 0 ? { label: 'Sudah dibagi', fg: '#067647', bg: '#DCFAE6' }
      : p.distributed > 0 ? { label: 'Sebagian', fg: '#175CD3', bg: '#E8F0FE' }
        : { label: 'Belum dibagi', fg: '#B54708', bg: '#FEF0C7' }
const amountOf = (st: Statement | undefined, kind: StatementRowKind, nth = 0) => st?.rows.filter(r => r.kind === kind)[nth]?.amount ?? 0
const downloads = computed(() => [
  { type: 'keuangan', name: 'Laporan keuangan', meta: 'Laba rugi, neraca, arus kas, perubahan ekuitas' },
  { type: 'investor', name: 'Laporan investor', meta: 'Modal, laba rugi, arus kas, distribusi' },
  ...(fin.value?.cashbook ? [{ type: 'bukukas', name: 'Buku kas', meta: 'Mutasi kas dengan saldo berjalan' }] : []),
  { type: 'proyek', name: 'Laba rugi per proyek', meta: 'Basis kas' },
  { type: 'pengeluaran', name: 'Pengeluaran per kategori', meta: 'Termasuk aset' },
  { type: 'piutang', name: 'Rekap piutang', meta: 'Dengan umur piutang' },
  ...(showBugs.value ? [{ type: 'bug', name: 'Rekap bug', meta: 'Terbuka, kritis, waktu penyelesaian' }] : []),
  { type: 'lengkap', name: 'Laporan lengkap', meta: 'Semua laporan di atas' },
])
const REF_TONE: Record<string, string> = { payment: 'bg-success-50 text-success-700', expense: 'bg-warning-50 text-warning-700', capital_deposit: 'bg-info-50 text-info-700', distribution: 'bg-violet-50 text-[#5925DC]', saldo_awal: 'bg-soft-2 text-ink-2' }
</script>

<template>
  <UiPageHeader title="Laporan" :subtitle="`Laporan keuangan basis kas dan rekap operasional · ${fin?.period.text ?? ''}`">
    <template #actions>
      <div class="w-56"><UiSelect v-model="period" :options="periodOpts" aria-label="Periode" /></div>
      <a :href="url(currentExport, 'xlsx')" class="btn-secondary">Ekspor Excel</a>
      <a :href="url(currentExport, 'pdf')" class="btn-primary">Ekspor PDF</a>
    </template>
  </UiPageHeader>

  <div role="tablist" aria-label="Jenis laporan" class="tabs">
    <button v-for="t in tabs" :key="t.key" type="button" role="tab" class="tab" :aria-selected="tab === t.key" @click="tab = t.key">{{ t.label }}</button>
  </div>

  <div :aria-busy="pending || finPending" class="flex flex-col gap-6">
    <!-- ═══ RINGKASAN ═══ -->
    <template v-if="tab === 'ringkasan'">
      <section v-if="k && fin" aria-label="Ringkasan" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <UiKpi label="Pendapatan diterima" :value="rupiah(k.revenue)" :sub="data?.period.label" />
        <UiKpi label="Laba bersih" :value="rupiah(amountOf(fin.labaRugi, 'grand'))" :sub="`Margin ${k.revenue ? Math.round(amountOf(fin.labaRugi, 'grand') / k.revenue * 100) : 0}%`" :color="amountOf(fin.labaRugi, 'grand') >= 0 ? '#067647' : '#B42318'" />
        <UiKpi label="Saldo kas akhir" :value="rupiah(amountOf(fin.arusKas, 'grand'))" :sub="`Per ${dateId(fin.period.to)}`" />
        <UiKpi label="Total ekuitas" :value="rupiah(amountOf(fin.neraca, 'grand', 1))" :sub="`Total aset ${rupiah(amountOf(fin.neraca, 'grand', 0))}`" />
        <UiKpi label="Piutang klien" :value="rupiah(k.receivables)" sub="Per hari ini" />
      </section>

      <div class="grid gap-6 lg:grid-cols-2 items-start">
        <section class="card-pad flex flex-col gap-3">
          <h2 class="section-title">Pengeluaran per Kategori</h2>
          <div v-for="(c, i) in data?.categories ?? []" :key="`${c.category}-${c.isAsset}`" class="flex flex-col gap-1.5">
            <div class="flex justify-between text-sm"><span>{{ c.category }}<span v-if="c.isAsset" class="text-xs text-muted"> · aset</span></span><span class="font-semibold tabular-nums">{{ rupiah(c.total) }}</span></div>
            <div class="progress"><div :style="{ width: `${c.total / catMax * 100}%`, background: c.isAsset ? '#7A5AF8' : COLORS[i % COLORS.length] }" /></div>
          </div>
          <p v-if="!data?.categories.length" class="m-0 text-sm text-muted">Belum ada pengeluaran.</p>
          <p v-if="k?.assets" class="m-0 text-xs text-muted">Pembelian aset ({{ rupiah(k.assets) }}) dicatat sebagai aset tetap, tidak mengurangi laba.</p>
        </section>
        <section class="card-pad flex flex-col gap-3">
          <h2 class="section-title">Laporan Siap Unduh</h2>
          <ul class="m-0 p-0 list-none flex flex-col divide-y divide-line-3">
            <li v-for="d in downloads" :key="d.type" class="flex flex-wrap items-center justify-between gap-3 py-3">
              <div class="flex flex-col"><span class="text-sm font-semibold">{{ d.name }}</span><span class="text-xs text-muted">{{ d.meta }} · {{ data?.period.label }}</span></div>
              <div class="flex gap-3 text-sm font-semibold"><a :href="url(d.type, 'pdf')">PDF</a><a :href="url(d.type, 'xlsx')">Excel</a></div>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <!-- ═══ LAPORAN KEUANGAN ═══ -->
    <ReportStatementView v-if="tab === 'labarugi' && fin" :st="fin.labaRugi" :company="company" />
    <ReportStatementView v-if="tab === 'neraca' && fin" :st="fin.neraca" :company="company" />
    <ReportStatementView v-if="tab === 'aruskas' && fin" :st="fin.arusKas" :company="company" />
    <ReportStatementView v-if="tab === 'modal' && fin" :st="fin.perubahanModal" :company="company" />

    <!-- ═══ BUKU KAS ═══ -->
    <section v-if="tab === 'bukukas' && fin?.cashbook" class="card overflow-hidden">
      <div class="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
        <div class="flex flex-col gap-0.5"><h2 class="section-title">Buku Kas OCN</h2><span class="text-sm text-muted">Periode {{ fin.period.text }}</span></div>
        <div class="flex gap-5 text-sm">
          <span>Saldo awal <strong class="tabular-nums">{{ rupiah(fin.cashbook.opening) }}</strong></span>
          <span>Saldo akhir <strong class="tabular-nums">{{ rupiah(fin.cashbook.closing) }}</strong></span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th scope="col">Tanggal</th><th scope="col">Keterangan</th><th scope="col" class="num">Debit (masuk)</th><th scope="col" class="num">Kredit (keluar)</th><th scope="col" class="num">Saldo</th></tr></thead>
          <tbody>
            <tr class="bg-soft"><td class="nowrap">{{ fin.cashbook.from ? dateId(fin.cashbook.from) : '—' }}</td><td class="font-semibold">Saldo awal</td><td /><td /><td class="num font-semibold">{{ rupiahAcc(fin.cashbook.opening) }}</td></tr>
            <tr v-for="l in fin.cashbook.lines" :key="l.id">
              <td class="nowrap">{{ dateId(l.date) }}</td>
              <td><div class="flex flex-col gap-1"><span>{{ l.description }}</span><span class="badge self-start !py-0.5" :class="REF_TONE[l.refType]">{{ CASHBOOK_LABEL[l.refType] ?? l.refType }}</span></div></td>
              <td class="num text-success-700">{{ l.debit ? rupiahAcc(l.debit) : '' }}</td>
              <td class="num text-danger-700">{{ l.credit ? rupiahAcc(l.credit) : '' }}</td>
              <td class="num">{{ rupiahAcc(l.balance) }}</td>
            </tr>
          </tbody>
          <tfoot><tr><td colspan="2">Total mutasi · saldo akhir</td><td class="num">{{ rupiahAcc(fin.cashbook.totalDebit) }}</td><td class="num">{{ rupiahAcc(fin.cashbook.totalCredit) }}</td><td class="num">{{ rupiahAcc(fin.cashbook.closing) }}</td></tr></tfoot>
        </table>
        <UiEmpty v-if="!fin.cashbook.lines.length" title="Tidak ada mutasi kas di periode ini" />
      </div>
    </section>

    <!-- ═══ PER PROYEK ═══ -->
    <section v-if="tab === 'proyek'" class="card overflow-hidden">
      <div class="flex flex-col gap-0.5 px-5 py-4"><h2 class="section-title">Laba Rugi per Proyek</h2><span class="text-sm text-muted">Berdasarkan pembayaran yang sudah diterima (basis kas) · {{ data?.period.label }}</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th scope="col">Proyek</th><th scope="col" class="num">Pendapatan</th><th scope="col" class="num">Beban</th><th scope="col" class="num">Laba Bersih</th><th scope="col">Margin</th><th scope="col">Bagi Hasil</th></tr></thead>
          <tbody>
            <tr v-for="r in data?.pnl ?? []" :key="r.projectId">
              <td><NuxtLink :to="`/projects/${r.projectId}`" class="font-semibold">{{ r.name }}</NuxtLink></td>
              <td class="num">{{ rupiahAcc(r.revenue) }}</td>
              <td class="num">{{ rupiahAcc(r.expenses) }}</td>
              <td class="num font-semibold" :class="r.profit < 0 && 'text-danger-700'">{{ rupiahAcc(r.profit) }}</td>
              <td><div class="flex items-center gap-2"><div class="progress w-12 shrink-0"><div :style="{ width: `${Math.max(0, Math.min(100, r.margin))}%` }" /></div><span class="text-xs font-semibold">{{ r.margin }}%</span></div></td>
              <td><UiBadge :tone="distStatus(r)" /></td>
            </tr>
          </tbody>
          <tfoot v-if="data?.pnl.length"><tr><td>Total</td><td class="num">{{ rupiahAcc(k?.revenue) }}</td><td class="num">{{ rupiahAcc(k?.expenses) }}</td><td class="num">{{ rupiahAcc(k?.profit) }}</td><td>{{ k?.margin }}%</td><td /></tr></tfoot>
        </table>
        <UiEmpty v-if="!data?.pnl.length" title="Belum ada transaksi di periode ini" />
      </div>
      <p v-if="k?.unassignedExpenses" class="m-0 px-5 py-3 text-xs text-muted border-t border-line-3">Beban operasional tanpa proyek ({{ rupiah(k.unassignedExpenses) }}) tidak dibebankan ke proyek; lihat tab Laba Rugi.</p>
    </section>

    <!-- ═══ PIUTANG ═══ -->
    <template v-if="tab === 'piutang'">
      <section class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
        <UiKpi v-for="a in data?.aging ?? []" :key="a.key" :label="a.label" :value="rupiah(a.amount)" :color="a.key !== 'belum_jatuh_tempo' && a.amount ? '#B42318' : undefined" />
      </section>
      <section class="card overflow-hidden">
        <div class="px-5 py-4"><h2 class="section-title">Rekap Piutang</h2></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">Proyek / Termin</th><th scope="col">Invoice</th><th scope="col">Jatuh Tempo</th><th scope="col">Umur</th><th scope="col" class="num">Sisa</th></tr></thead>
            <tbody>
              <tr v-for="r in data?.receivables ?? []" :key="r.termId">
                <td><div class="flex flex-col gap-0.5"><span class="font-semibold">{{ r.projectName }}</span><span class="text-xs text-muted">{{ r.termName }} · {{ r.clientName ?? '—' }}</span></div></td>
                <td>{{ r.number ?? 'belum ditagih' }}</td>
                <td class="nowrap">{{ r.dueDate ? dateId(r.dueDate) : '—' }}</td>
                <td><span class="text-xs font-semibold" :class="r.daysOverdue ? 'text-danger-700' : 'text-muted'">{{ r.daysOverdue ? `${r.daysOverdue} hari` : 'Belum jatuh tempo' }}</span></td>
                <td class="num">{{ rupiahAcc(r.outstanding) }}</td>
              </tr>
            </tbody>
            <tfoot v-if="data?.receivables.length"><tr><td colspan="4">Total piutang</td><td class="num">{{ rupiahAcc(k?.receivables) }}</td></tr></tfoot>
          </table>
          <UiEmpty v-if="!data?.receivables.length" title="Tidak ada piutang" />
        </div>
      </section>
    </template>

    <!-- ═══ BUG ═══ -->
    <section v-if="tab === 'bug' && showBugs" class="card overflow-hidden">
      <div class="px-5 py-4"><h2 class="section-title">Rekap Bug</h2></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th scope="col">Proyek</th><th scope="col" class="num">Terbuka</th><th scope="col" class="num">Kritis</th><th scope="col" class="num">Selesai</th><th scope="col" class="num">Rata-rata hari</th></tr></thead>
          <tbody>
            <tr v-for="b in data?.bugs ?? []" :key="b.projectId">
              <td>{{ b.name }}</td><td class="num">{{ b.open }}</td>
              <td class="num" :class="b.critical ? 'text-danger-700 font-semibold' : ''">{{ b.critical }}<span v-if="b.overdue" class="block text-[11px]">{{ b.overdue }} &gt; 7 hari</span></td>
              <td class="num">{{ b.done }}</td><td class="num">{{ b.avgDays ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
        <UiEmpty v-if="!data?.bugs.length" title="Belum ada bug" />
      </div>
    </section>
  </div>
</template>
