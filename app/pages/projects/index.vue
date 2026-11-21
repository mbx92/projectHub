<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['proyek', 'lihat'] })
useHead({ title: 'Proyek — OCN Project Hub' })
const { can, user } = useAuth()
const showMoney = computed(() => can('keuangan', 'ringkasan'))
const showBugs = computed(() => can('bug', 'lihat'))
const canManage = computed(() => can('proyek', 'kelola'))
const canCreate = computed(() => can('proyek', 'kelola') && can('keuangan', 'kelola'))
const moneyManage = computed(() => can('keuangan', 'kelola'))
const tab = ref<'Semua' | 'Berjalan' | 'Tertunda' | 'Selesai' | 'Arsip'>('Semua')
const search = ref('')
const debounced = ref('')
let t: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => { clearTimeout(t); t = setTimeout(() => { debounced.value = v }, 250) })
const archived = computed(() => (tab.value === 'Arsip' ? '1' : '0'))
const { data, pending } = await useFetch('/api/projects', { query: { q: debounced, archived }, watch: [debounced, archived] })

const groups = {
  Semua: () => true,
  Berjalan: (s: ProjectStatus) => s === 'berjalan' || s === 'persiapan',
  Tertunda: (s: ProjectStatus) => s === 'tertunda',
  Selesai: (s: ProjectStatus) => s === 'selesai',
} as const
const tabs = computed(() => [
  ...(Object.keys(groups) as (keyof typeof groups)[]).map(label => ({ label, count: tab.value === 'Arsip' ? null : (data.value?.projects ?? []).filter(p => groups[label](p.status)).length })),
  ...(canManage.value ? [{ label: 'Arsip' as const, count: null }] : []),
])
const rows = computed(() => {
  const list = data.value?.projects ?? []
  return tab.value === 'Arsip' ? list : list.filter(p => groups[tab.value as keyof typeof groups](p.status))
})
const s = computed(() => data.value?.summary)
const today = todayISO()
function dueTone(d: string) {
  const n = daysBetween(today, d)
  return n < 0 ? { fg: '#B42318', bg: '#FEE4E2' } : n <= 10 ? { fg: '#B54708', bg: '#FEF0C7' } : { fg: '#344054', bg: '#F2F4F7' }
}
</script>

<template>
  <UiPageHeader title="Proyek" :subtitle="user?.access.scope === 'ditugaskan' ? 'Proyek tempat Anda ditugaskan.' : user?.access.scope === 'didanai' ? 'Proyek yang didanai modal investor.' : 'Kelola proyek, termin pembayaran klien, dan bug dalam satu tempat.'">
    <template v-if="canCreate" #actions>
      <NuxtLink to="/projects/new" class="btn-primary">+ Proyek Baru</NuxtLink>
    </template>
  </UiPageHeader>

  <section v-if="s" aria-label="Ringkasan proyek" class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
    <UiKpi label="Proyek berjalan" :value="s.running"><template #default>{{ s.running }} <span class="text-[13px] text-muted font-medium">dari {{ s.total }}</span></template></UiKpi>
    <UiKpi v-if="s.receivables !== null" label="Piutang klien" :value="rupiah(s.receivables)" />
    <UiKpi v-if="showMoney" label="Jatuh tempo 14 hari" :value="`${s.dueSoon} termin`" :color="s.dueSoon ? '#B54708' : undefined" />
    <UiKpi v-if="s.criticalBugs !== null" label="Bug kritis terbuka" :value="s.criticalBugs" :color="s.criticalBugs ? '#B42318' : undefined" />
  </section>

  <div class="grid gap-6 items-start" :class="showMoney && 'xl:grid-cols-[1fr_300px]'">
    <section class="card overflow-hidden min-w-0">
      <div class="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-line-3">
        <div role="tablist" aria-label="Filter status" class="pill-tabs">
          <button v-for="x in tabs" :key="x.label" type="button" role="tab" class="pill-tab" :aria-selected="tab === x.label" @click="tab = x.label">{{ x.label }}<template v-if="x.count !== null"> · {{ x.count }}</template></button>
        </div>
        <label class="flex items-center gap-2 min-h-11 px-3 border border-line rounded-lg bg-white flex-[0_1_280px] min-w-48">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475467" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <span class="sr-only">Cari proyek</span>
          <input v-model="search" type="search" placeholder="Cari proyek atau klien" class="border-0 outline-none text-sm w-full bg-transparent">
        </label>
      </div>
      <div class="table-wrap" :aria-busy="pending">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Proyek / Klien</th><th scope="col">Progress</th>
              <th v-if="showMoney" scope="col" class="num">Pembayaran</th>
              <th v-if="showBugs" scope="col">Bug</th>
              <th scope="col">Status &amp; tenggat</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in rows" :key="p.id">
              <td>
                <div class="flex flex-col gap-1">
                  <NuxtLink :to="`/projects/${p.id}`" class="font-semibold">{{ p.name }}</NuxtLink>
                  <span class="text-xs text-muted">{{ p.clientName ?? '—' }}</span>
                  <div v-if="p.team.length" class="flex pl-0.5" :aria-label="`Tim: ${p.team.map(m => m.name).join(', ')}`"><UiAvatar v-for="m in p.team" :key="m.id" :name="m.name" :color="m.avatarColor" :size="24" ring /></div>
                </div>
              </td>
              <td class="nowrap"><div class="flex items-center gap-2"><div class="progress w-14"><div :style="{ width: `${p.progress}%` }" /></div><span class="text-xs font-semibold">{{ p.progress }}%</span></div></td>
              <td v-if="showMoney" class="num"><div class="flex flex-col items-end gap-0.5"><span class="font-semibold">{{ rupiah(p.paid) }}</span><span class="text-xs text-muted">dari {{ rupiah(p.contractValue) }}</span></div></td>
              <td v-if="showBugs" class="nowrap"><NuxtLink :to="`/bugs?project=${p.id}`" :class="p.criticalBugs ? '!text-danger-700 font-semibold' : ''">{{ p.openBugs ? `${p.openBugs} terbuka` : '0' }}</NuxtLink></td>
              <td class="nowrap"><div class="flex flex-col items-start gap-1"><UiBadge :tone="PROJECT_STATUS[p.status]" /><span class="text-xs text-muted">{{ p.status === 'selesai' ? 'Selesai' : p.targetDate ? `Target ${dateId(p.targetDate)}` : 'Tanpa target' }}</span></div></td>
            </tr>
          </tbody>
        </table>
        <UiEmpty v-if="!rows.length && !pending" :title="search ? `Tidak ada proyek untuk “${search}”` : tab === 'Arsip' ? 'Belum ada proyek yang diarsipkan' : 'Belum ada proyek'" :text="canCreate && !search && tab !== 'Arsip' ? 'Mulai dengan menambahkan proyek berjalan dari file Excel Anda.' : undefined">
          <NuxtLink v-if="canCreate && !search && tab !== 'Arsip'" to="/projects/new" class="btn-primary mt-2">+ Proyek Baru</NuxtLink>
        </UiEmpty>
      </div>
    </section>

    <aside v-if="showMoney" aria-label="Termin jatuh tempo" class="card-pad flex flex-col gap-3">
      <h2 class="section-title">Termin Jatuh Tempo</h2>
      <div v-for="d in data?.dues ?? []" :key="d.termId" class="flex flex-col gap-1.5 py-3 border-t border-line-3 first:border-t-0 first:pt-0">
        <div class="flex items-start justify-between gap-2">
          <span class="text-sm font-semibold">{{ d.project }}</span>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" :style="{ color: dueTone(d.dueDate).fg, background: dueTone(d.dueDate).bg }">{{ relativeDue(d.dueDate) }}</span>
        </div>
        <span class="text-xs text-muted">{{ d.term }} · jatuh tempo {{ dateId(d.dueDate) }}</span>
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-bold tabular-nums">{{ rupiah(d.amount) }}</span>
          <template v-if="moneyManage">
            <NuxtLink v-if="d.invoiceId" :to="`/invoices/${d.invoiceId}`" class="text-xs font-semibold">Lihat invoice</NuxtLink>
            <NuxtLink v-else :to="`/invoices/new?term=${d.termId}`" class="text-xs font-semibold">Buat invoice</NuxtLink>
          </template>
        </div>
      </div>
      <p v-if="!data?.dues.length" class="m-0 text-sm text-muted">Tidak ada termin yang jatuh tempo dalam 30 hari.</p>
    </aside>
  </div>
</template>
