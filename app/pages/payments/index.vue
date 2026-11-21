<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['keuangan', 'lihat'] })
useHead({ title: 'Pembayaran — OCN Project Hub' })
const route = useRoute()
const toast = useToast()
const tab = ref<'invoice' | 'pengeluaran' | 'kas'>('invoice')
const [{ data: summary, refresh: rSum }, { data: inv, refresh: rInv }, { data: expenses, refresh: rExp }, { data: ledger, refresh: rLed }, { data: projects }] = await Promise.all([
  useFetch('/api/finance/summary'),
  useFetch('/api/invoices'),
  useFetch('/api/expenses', { default: () => [] }),
  useFetch('/api/ledger'),
  useFetch('/api/projects'),
])
const refreshAll = () => Promise.all([rSum(), rInv(), rExp(), rLed()])
const projectList = computed(() => (projects.value?.projects ?? []).map(p => ({ id: p.id, name: p.name })))

const showPay = ref(route.query.catat === 'bayar')
const showExpense = ref(route.query.catat === 'pengeluaran')
const editExpense = ref<any>(null)
if (route.query.catat === 'pengeluaran') tab.value = 'pengeluaran'
const showOpening = ref(false)
const opening = reactive({ date: todayISO() as string | null, amount: 0, description: 'Saldo awal kas OCN (dari Excel)' })
async function saveOpening() {
  try {
    await $fetch('/api/ledger/opening', { method: 'POST', body: opening })
    toast.success('Saldo awal dicatat')
    showOpening.value = false
    await refreshAll()
  } catch (e) { toast.error(errorMessage(e)) }
}

const invFilter = ref<'semua' | 'belum' | 'terlambat' | 'lunas'>('semua')
const invoices = computed(() => (inv.value?.invoices ?? []).filter((i) => {
  if (invFilter.value === 'belum') return i.status === 'draf' || i.status === 'terkirim'
  if (invFilter.value === 'terlambat') return i.displayStatus === 'terlambat'
  if (invFilter.value === 'lunas') return i.status === 'lunas'
  return true
}))
const agingMax = computed(() => Math.max(1, ...(summary.value?.aging ?? []).map(a => a.amount)))
const expTotal = computed(() => expenses.value.reduce((a, e) => a + e.amount, 0))
const REF_LABEL: Record<string, string> = { payment: 'Pembayaran klien', expense: 'Pengeluaran', capital_deposit: 'Setoran modal', distribution: 'Distribusi bagi hasil', saldo_awal: 'Saldo awal' }
</script>

<template>
  <UiPageHeader title="Pembayaran" subtitle="Invoice klien, pengeluaran, dan mutasi kas OCN di semua proyek.">
    <template #actions>
      <button type="button" class="btn-secondary" @click="editExpense = null; showExpense = true">Catat Pengeluaran</button>
      <button type="button" class="btn-secondary" @click="showPay = true">Catat Pembayaran</button>
      <NuxtLink to="/invoices/new" class="btn-primary">+ Buat Invoice</NuxtLink>
    </template>
  </UiPageHeader>

  <section v-if="summary" aria-label="Ringkasan keuangan" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
    <UiKpi label="Piutang klien" :value="rupiah(summary.receivables)" :sub="`${inv?.unbilled.length ?? 0} termin belum ditagih`" />
    <UiKpi label="Lewat jatuh tempo" :value="rupiah(summary.overdue)" :sub="`${summary.overdueCount} invoice`" :color="summary.overdue ? '#B42318' : undefined" />
    <UiKpi label="Pemasukan diterima" :value="rupiah(summary.revenue)" sub="Semua waktu · basis kas" />
    <UiKpi label="Saldo kas OCN" :value="rupiah(summary.balance)" :sub="`Pengeluaran ${rupiah(summary.expenses)}`" :color="summary.balance < 0 ? '#B42318' : undefined" />
  </section>

  <div class="grid gap-6 xl:grid-cols-[1fr_300px] items-start">
    <section class="card overflow-hidden min-w-0">
      <div role="tablist" aria-label="Jenis transaksi" class="tabs px-4 pt-2">
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'invoice'" @click="tab = 'invoice'">Invoice &amp; Termin</button>
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'pengeluaran'" @click="tab = 'pengeluaran'">Pengeluaran</button>
        <button type="button" role="tab" class="tab" :aria-selected="tab === 'kas'" @click="tab = 'kas'">Mutasi Kas OCN</button>
      </div>

      <template v-if="tab === 'invoice'">
        <div class="p-4 flex flex-wrap gap-3 items-center justify-between">
          <div class="pill-tabs" role="group" aria-label="Filter invoice">
            <button v-for="x in [['semua', 'Semua'], ['belum', 'Belum lunas'], ['terlambat', 'Terlambat'], ['lunas', 'Lunas']]" :key="x[0]" type="button" class="pill-tab" :aria-pressed="invFilter === x[0]" @click="invFilter = x[0] as any">{{ x[1] }}</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">No. Invoice</th><th scope="col">Proyek / Termin</th><th scope="col" class="num">Nominal</th><th scope="col">Jatuh Tempo</th><th scope="col">Status</th><th scope="col" class="w-14"><span class="sr-only">Aksi</span></th></tr></thead>
            <tbody>
              <tr v-for="i in invoices" :key="i.id">
                <td><NuxtLink :to="`/invoices/${i.id}`" class="font-semibold">{{ i.number }}</NuxtLink></td>
                <td><div class="flex flex-col gap-0.5"><NuxtLink :to="`/projects/${i.projectId}?tab=pembayaran`">{{ i.projectName }}</NuxtLink><span class="text-xs text-muted">{{ i.termName ?? '—' }} · {{ i.clientName ?? '—' }}</span></div></td>
                <td class="num">{{ rupiah(i.total) }}<div v-if="i.paid && i.status !== 'lunas'" class="text-xs text-muted">dibayar {{ rupiah(i.paid) }}</div></td>
                <td class="nowrap">{{ dateId(i.dueDate) }}<div v-if="i.status === 'terkirim'" class="text-xs" :class="i.displayStatus === 'terlambat' ? 'text-danger-700' : 'text-muted'">{{ relativeDue(i.dueDate) }}</div></td>
                <td><UiBadge :tone="INVOICE_STATUS[i.displayStatus as keyof typeof INVOICE_STATUS]" /></td>
                <td class="text-right"><UiActionMenu :label="`Aksi untuk ${i.number}`" :items="[
                  { label: 'Lihat invoice', to: `/invoices/${i.id}` },
                  { label: 'Kirim invoice', to: `/invoices/${i.id}`, hidden: i.status !== 'draf' },
                  { label: 'Catat pembayaran', to: `/invoices/${i.id}`, hidden: i.status !== 'terkirim' },
                  { label: 'Unduh PDF', href: `/api/invoices/${i.id}/pdf?download=1`, external: true },
                  { label: 'Lihat proyek', to: `/projects/${i.projectId}?tab=pembayaran` },
                ]" /></td>
              </tr>
            </tbody>
          </table>
          <UiEmpty v-if="!invoices.length" title="Belum ada invoice" text="Buat invoice dari termin proyek." />
        </div>
        <div v-if="inv?.unbilled.length" class="border-t border-line-2">
          <h3 class="m-0 px-5 pt-4 pb-2 text-sm font-bold">Termin belum ditagih</h3>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th scope="col">Proyek / Termin</th><th scope="col" class="num">Nominal</th><th scope="col">Jatuh Tempo</th><th scope="col" class="w-14"><span class="sr-only">Aksi</span></th></tr></thead>
              <tbody>
                <tr v-for="t in inv.unbilled" :key="t.termId">
                  <td><div class="flex flex-col gap-0.5"><span class="font-semibold">{{ t.projectName }}</span><span class="text-xs text-muted">{{ t.termName }} · {{ percent(t.percent) }}</span></div></td>
                  <td class="num">{{ rupiah(t.amount) }}</td>
                  <td class="nowrap">{{ dateId(t.dueDate) }}<div v-if="t.dueDate" class="text-xs text-muted">{{ relativeDue(t.dueDate) }}</div></td>
                  <td class="text-right"><UiActionMenu :label="`Aksi untuk ${t.termName}`" :items="[
                    { label: 'Buat invoice', to: `/invoices/new?term=${t.termId}` },
                    { label: 'Lihat proyek', to: `/projects/${t.projectId}?tab=pembayaran` },
                  ]" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <template v-if="tab === 'pengeluaran'">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">Tanggal</th><th scope="col">Keterangan</th><th scope="col" class="num">Nominal</th><th scope="col" class="w-14"><span class="sr-only">Aksi</span></th></tr></thead>
            <tbody>
              <tr v-for="e in expenses" :key="e.id">
                <td class="nowrap">{{ dateId(e.date) }}</td>
                <td>
                  <div class="flex flex-col gap-1">
                    <span class="font-semibold">{{ e.description }}</span>
                    <span class="flex flex-wrap items-center gap-1.5 text-xs text-muted"><span class="badge !py-0.5" :class="e.isAsset ? 'bg-violet-50 text-[#5925DC]' : 'bg-soft-2 text-ink-2'">{{ e.isAsset ? `Aset · ${e.category}` : e.category }}</span>{{ e.projectName ?? 'Operasional OCN' }}<template v-if="e.source !== 'kas_ocn'"> · dibayar pribadi</template></span>
                  </div>
                </td>
                <td class="num">{{ rupiah(e.amount) }}</td>
                <td class="text-right"><UiActionMenu :label="`Aksi untuk ${e.description}`" :items="[
                  { label: 'Ubah pengeluaran', onClick: () => { editExpense = e; showExpense = true } },
                  { label: 'Lihat bukti', href: e.proofUrl ?? undefined, external: true, hidden: !e.proofUrl },
                ]" /></td>
              </tr>
            </tbody>
            <tfoot v-if="expenses.length"><tr><td colspan="2">Total</td><td class="num">{{ rupiah(expTotal) }}</td><td /></tr></tfoot>
          </table>
          <UiEmpty v-if="!expenses.length" title="Belum ada pengeluaran" />
        </div>
      </template>

      <template v-if="tab === 'kas'">
        <div class="flex flex-wrap items-center justify-between gap-3 p-4">
          <span class="text-sm">Saldo saat ini <strong class="tabular-nums">{{ rupiah(ledger?.balance) }}</strong></span>
          <button type="button" class="btn-secondary btn-sm" @click="showOpening = true">+ Saldo awal (impor Excel)</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">Tanggal</th><th scope="col">Keterangan</th><th scope="col" class="num">Masuk</th><th scope="col" class="num">Keluar</th><th scope="col" class="num">Saldo Kas OCN</th></tr></thead>
            <tbody>
              <tr v-for="c in ledger?.rows ?? []" :key="c.id">
                <td class="nowrap">{{ dateId(c.date) }}</td>
                <td><div class="flex flex-col gap-0.5"><span>{{ c.description ?? REF_LABEL[c.refType] }}</span><span class="text-xs text-muted">{{ REF_LABEL[c.refType] ?? c.refType }}</span></div></td>
                <td class="num text-success-700">{{ c.type === 'masuk' ? rupiah(c.amount) : '' }}</td>
                <td class="num text-danger-700">{{ c.type === 'keluar' ? rupiah(c.amount) : '' }}</td>
                <td class="num font-semibold">{{ rupiah(c.balance) }}</td>
              </tr>
            </tbody>
          </table>
          <UiEmpty v-if="!ledger?.rows.length" title="Belum ada mutasi kas" />
        </div>
      </template>
    </section>

    <aside class="flex flex-col gap-6">
      <section aria-label="Umur piutang" class="card-pad flex flex-col gap-3">
        <h2 class="section-title">Umur Piutang</h2>
        <div v-for="a in summary?.aging ?? []" :key="a.key" class="flex flex-col gap-1.5">
          <div class="flex justify-between text-sm"><span>{{ a.label }}</span><span class="font-semibold tabular-nums">{{ rupiah(a.amount) }}</span></div>
          <div class="progress"><div :style="{ width: `${a.amount / agingMax * 100}%`, background: a.key === 'belum_jatuh_tempo' ? '#0B6E63' : a.key === '1_30' ? '#F79009' : '#D92D20' }" /></div>
        </div>
        <p class="m-0 text-xs text-muted">Termin yang sudah dijadwalkan tapi invoicenya belum dikirim dihitung sebagai belum jatuh tempo.</p>
      </section>
      <section class="card-pad flex flex-col gap-2">
        <h2 class="section-title">Pengingat Otomatis</h2>
        <p class="m-0 text-sm text-muted leading-relaxed">Untuk setiap invoice terkirim: notifikasi ke admin dan email ke klien <strong class="text-ink">H-7</strong> dan <strong class="text-ink">saat jatuh tempo</strong>, serta peringatan bila terlambat. Termin yang belum ditagih juga diingatkan.</p>
        <p class="m-0 text-xs text-muted">WhatsApp & Telegram tersedia di fase 2.</p>
      </section>
    </aside>
  </div>

  <FinancePaymentModal :open="showPay" @close="showPay = false" @saved="refreshAll" />
  <FinanceExpenseModal :open="showExpense" :expense="editExpense" :projects="projectList" @close="showExpense = false" @saved="refreshAll" />
  <UiModal :open="showOpening" title="Saldo Awal Kas OCN" description="Dipakai saat memindahkan data dari Excel. Isi negatif bila kas defisit." width="460px" @close="showOpening = false">
    <UiDateTimeInput v-model="opening.date" label="Per tanggal" :clearable="false" />
    <UiMoneyInput v-model="opening.amount" label="Saldo" allow-negative />
    <label class="field">Keterangan<input v-model="opening.description" class="input"></label>
    <template #footer>
      <button type="button" class="btn-secondary" @click="showOpening = false">Batal</button>
      <button type="button" class="btn-primary" @click="saveOpening">Simpan</button>
    </template>
  </UiModal>
</template>
