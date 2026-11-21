<script setup lang="ts">
/** Form Tambah/Edit Proyek: info dasar, klien, nilai kontrak & termin, tim & skema, milestone. */
interface TermRow { id?: number, name: string, percent: number, conditions: string | null, dueDate: string | null, status?: string }
interface MemberRow { userId: number, roleInProject: string | null, payType: 'bagi_hasil' | 'tetap', fixedFee: number, shareWeight: number }
interface MsRow { id?: number, name: string, targetDate: string | null, status: 'belum' | 'berjalan' | 'selesai' }

const props = defineProps<{ projectId?: number }>()
const toast = useToast()
const { confirm } = useConfirm()
const router = useRouter()

const [{ data: clients, refresh: refreshClients }, { data: users }, { data: schemes }] = await Promise.all([
  useFetch('/api/clients', { default: () => [] }),
  useFetch('/api/users', { default: () => [] }),
  useFetch('/api/schemes', { default: () => [] }),
])
const existing = props.projectId ? (await useFetch(`/api/projects/${props.projectId}`)).data : ref(null)

const defScheme = schemes.value.find(s => s.isDefault) ?? schemes.value[0]
const f = reactive({
  name: '', description: '' as string | null, stack: '' as string | null, status: 'persiapan' as ProjectStatus,
  clientId: null as number | null, contractValue: 0, budget: 0, startDate: todayISO() as string | null, targetDate: null as string | null,
  progress: 0, picId: null as number | null, schemeId: (defScheme?.id ?? null) as number | null,
  capitalPct: defScheme?.capitalPct ?? 40, workerPct: defScheme?.workerPct ?? 40, cashPct: defScheme?.cashPct ?? 20,
  terms: [
    { name: 'DP', percent: 30, conditions: 'Saat kontrak ditandatangani', dueDate: null },
    { name: 'Termin 2', percent: 40, conditions: 'Setelah UAT', dueDate: null },
    { name: 'Pelunasan', percent: 30, conditions: 'Serah terima', dueDate: null },
  ] as TermRow[],
  members: [] as MemberRow[],
  milestones: [] as MsRow[],
})
const newClient = ref<null | { name: string, contactName: string, whatsapp: string, email: string }>(null)

if (existing.value) {
  const e = existing.value as any
  Object.assign(f, {
    name: e.project.name, description: e.project.description, stack: e.project.stack, status: e.project.status,
    clientId: e.project.clientId, contractValue: e.project.contractValue ?? 0, budget: e.project.budget ?? 0,
    startDate: e.project.startDate, targetDate: e.project.targetDate, progress: e.project.progress, picId: e.project.picId,
    schemeId: e.project.schemeId, capitalPct: e.project.capitalPct, workerPct: e.project.workerPct, cashPct: e.project.cashPct,
    terms: (e.finance?.terms ?? []).map((t: any) => ({ id: t.id, name: t.name, percent: Number(t.percent), conditions: t.conditions, dueDate: t.dueDate, status: t.status })),
    members: e.members.map((m: any) => ({ userId: m.userId, roleInProject: m.roleInProject, payType: m.payType, fixedFee: m.fixedFee ?? 0, shareWeight: m.shareWeight })),
    milestones: e.milestones.map((m: any) => ({ id: m.id, name: m.name, targetDate: m.targetDate, status: m.status })),
  })
}

const client = computed(() => clients.value.find(c => c.id === f.clientId))
const clientOpts = computed(() => clients.value.map(c => ({ value: c.id as number | null, label: c.name, desc: [c.contactName, c.whatsapp].filter(Boolean).join(' · ') || undefined })))
const statusOpts = (Object.keys(PROJECT_STATUS) as ProjectStatus[]).map(k => ({ value: k, label: PROJECT_STATUS[k].label, desc: PROJECT_STATUS[k].desc, dot: PROJECT_STATUS[k].dot }))
const staff = computed(() => users.value.filter(u => u.role !== 'investor' && ('status' in u ? u.status !== 'nonaktif' : true)))
const picOpts = computed(() => [{ value: null as number | null, label: 'Belum ditentukan' }, ...staff.value.filter(u => u.role === 'admin' || f.members.some(m => m.userId === u.id)).map(u => ({ value: u.id as number | null, label: u.name }))])
const userName = (id: number) => users.value.find(u => u.id === id)?.name ?? '—'
const userColor = (id: number) => users.value.find(u => u.id === id)?.avatarColor ?? null
const addable = computed(() => staff.value.filter(u => !f.members.some(m => m.userId === u.id)))

const amounts = computed(() => termAmounts(f.contractValue, f.terms.map(t => Number(t.percent) || 0)))
const pctSum = computed(() => percentTotal(f.terms.map(t => Number(t.percent) || 0)))
const pctOk = computed(() => Math.abs(pctSum.value - 100) < 0.001)
const billed = (t: TermRow) => !!t.status && t.status !== 'terjadwal'
const kasAuto = computed(() => Math.round((100 - f.capitalPct - f.workerPct) * 100) / 100)
watch(kasAuto, (v) => { f.cashPct = v }, { immediate: true })
const schemeName = computed(() => schemes.value.find(s => s.id === f.schemeId)?.name ?? 'Kustom')

function pickScheme(id: number) {
  const s = schemes.value.find(x => x.id === id)
  if (!s) return
  f.schemeId = id
  f.capitalPct = s.capitalPct
  f.workerPct = s.workerPct
}
function addTerm() { f.terms.push({ name: `Termin ${f.terms.length + 1}`, percent: Math.max(0, Math.round((100 - pctSum.value) * 100) / 100), conditions: null, dueDate: null }) }
function addMember(id: number) { f.members.push({ userId: id, roleInProject: null, payType: 'bagi_hasil', fixedFee: 0, shareWeight: 1 }) }
function addMilestone() { f.milestones.push({ name: '', targetDate: null, status: 'belum' }) }
function onClientFooter(q: string) {
  newClient.value = { name: q, contactName: '', whatsapp: '', email: '' }
  f.clientId = null
}

const saving = ref(false)
const errors = ref<string | null>(null)
async function save() {
  errors.value = null
  if (!f.name.trim()) { errors.value = 'Nama proyek wajib diisi.'; return }
  if (!pctOk.value) { errors.value = `Total persen termin harus 100% (sekarang ${percent(pctSum.value)}).`; return }
  if (f.cashPct < 0) { errors.value = 'Total bagian modal + pekerja melebihi 100%.'; return }
  saving.value = true
  try {
    const body = { ...f, newClient: newClient.value?.name ? newClient.value : null, milestones: f.milestones.filter(m => m.name.trim()) }
    const r = props.projectId
      ? await $fetch<{ id: number }>(`/api/projects/${props.projectId}`, { method: 'PUT', body })
      : await $fetch<{ id: number }>('/api/projects', { method: 'POST', body })
    toast.success(props.projectId ? 'Perubahan proyek disimpan' : 'Proyek dibuat')
    await refreshClients()
    await router.push(`/projects/${r.id}`)
  } catch (e) {
    errors.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

async function archive() {
  const archived = !(existing.value as any)?.project.archived
  const ok = await confirm({
    variant: 'warning', title: archived ? 'Arsipkan proyek ini?' : 'Pulihkan proyek dari arsip?',
    message: archived ? 'Proyek disembunyikan dari daftar dan dashboard tanpa menghapus data.' : 'Proyek akan tampil lagi di daftar.',
    confirmText: archived ? 'Arsipkan' : 'Pulihkan',
    action: () => $fetch<unknown>(`/api/projects/${props.projectId}/archive`, { method: 'POST', body: { archived } }),
  })
  if (ok) {
    toast.success(archived ? 'Proyek diarsipkan' : 'Proyek dipulihkan')
    await router.push('/projects')
  }
}
async function remove() {
  const e = existing.value as any
  const ok = await confirm({
    variant: 'danger', title: 'Hapus proyek ini?',
    message: `${e.finance?.terms.length ?? 0} termin, ${e.finance?.expenses.length ?? 0} pengeluaran, ${e.bugs.length} bug, dan ${e.documents.length} dokumen ikut terhapus. Tindakan ini tidak bisa dibatalkan.`,
    confirmText: 'Hapus proyek', requireText: e.project.name,
    action: () => $fetch<unknown>(`/api/projects/${props.projectId}`, { method: 'DELETE', body: { confirmName: e.project.name } }),
  })
  if (ok) { toast.success('Proyek dihapus'); router.push('/projects') }
}
</script>

<template>
  <UiPageHeader :title="projectId ? 'Edit Proyek' : 'Tambah Proyek'" :subtitle="projectId ? f.name : 'Isi data proyek; termin otomatis menjadi jadwal tagihan & invoice.'">
    <template #actions>
      <NuxtLink :to="projectId ? `/projects/${projectId}` : '/projects'" class="btn-secondary">Batal</NuxtLink>
      <button type="button" class="btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan…' : projectId ? 'Simpan Perubahan' : 'Simpan Proyek' }}</button>
    </template>
  </UiPageHeader>
  <p v-if="errors" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-4 py-3">{{ errors }}</p>

  <div class="grid gap-6 xl:grid-cols-[1fr_300px] items-start">
    <form class="flex flex-col gap-6 min-w-0" novalidate @submit.prevent="save">
      <!-- Informasi dasar -->
      <section class="card-pad flex flex-col gap-4">
        <div class="flex flex-col gap-1"><h2 class="section-title">Informasi Dasar</h2><span class="text-sm text-muted">Nama, klien, dan jadwal proyek.</span></div>
        <label class="field">
          <span>Nama proyek <span class="text-xs font-medium text-danger-700">wajib</span></span>
          <input v-model="f.name" type="text" class="input" placeholder="Mis. Sistem Kasir Toko [Nama]" required>
        </label>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiSearchSelect v-if="!newClient" v-model="f.clientId" label="Klien" :options="clientOpts" placeholder="Pilih klien…" search-placeholder="Cari klien…" footer="+ Tambah klien baru" clearable @footer="onClientFooter" />
          <div v-else class="sm:col-span-2 rounded-xl border border-brand-100 bg-brand-soft p-4 grid gap-3 sm:grid-cols-2">
            <div class="sm:col-span-2 flex items-center justify-between"><span class="text-sm font-bold">Klien baru</span><button type="button" class="text-sm font-semibold text-brand-700" @click="newClient = null">Pilih klien yang ada</button></div>
            <label class="field">Nama klien<input v-model="newClient.name" class="input" required></label>
            <label class="field">Nama kontak (PIC)<input v-model="newClient.contactName" class="input"></label>
            <label class="field">WhatsApp<input v-model="newClient.whatsapp" type="tel" class="input" placeholder="+62 …"></label>
            <label class="field">Email (untuk kirim invoice)<input v-model="newClient.email" type="email" class="input"></label>
          </div>
          <div v-if="!newClient" class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold text-ink-2">Kontak klien</span>
            <div class="min-h-11 px-3 flex items-center rounded-lg bg-soft text-sm text-muted">{{ client ? [client.contactName, client.whatsapp, client.email].filter(Boolean).join(' · ') || 'Belum ada kontak' : '—' }}</div>
          </div>
          <UiSelect v-model="f.status" label="Status" :options="statusOpts" />
          <UiSelect v-model="f.picId" label="Penanggung jawab" :options="picOpts" />
          <UiDateTimeInput v-model="f.startDate" label="Tanggal mulai" />
          <UiDateTimeInput v-model="f.targetDate" label="Target selesai" />
        </div>
        <label class="field">Deskripsi &amp; ruang lingkup
          <textarea v-model="f.description" rows="3" class="input" placeholder="Modul yang dikerjakan, platform, batasan…" />
        </label>
        <div class="grid gap-4 sm:grid-cols-[1fr_200px]">
          <label class="field">Stack / teknologi<input v-model="f.stack" type="text" class="input" placeholder="Mis. Nuxt, PostgreSQL, Flutter"></label>
          <label class="field">Progress (%)<input v-model.number="f.progress" type="number" min="0" max="100" class="input"></label>
        </div>
      </section>

      <!-- Nilai & termin -->
      <section class="card-pad flex flex-col gap-4">
        <div class="flex flex-col gap-1"><h2 class="section-title">Nilai Kontrak &amp; Termin</h2><span class="text-sm text-muted">Termin otomatis menjadi jadwal tagihan &amp; invoice. Termin yang sudah ditagih dikunci.</span></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiMoneyInput v-model="f.contractValue" label="Nilai kontrak" />
          <UiMoneyInput v-model="f.budget" label="Anggaran biaya" hint="Batas biaya proyek untuk dipantau di tab Pengeluaran." />
        </div>
        <div class="flex flex-col gap-3">
          <div v-for="(t, i) in f.terms" :key="t.id ?? `n${i}`" class="rounded-xl border p-4 grid gap-3 sm:grid-cols-[1.2fr_100px_1fr] items-end" :class="billed(t) ? 'bg-soft border-line-2' : 'border-line-2'">
            <label class="field">Termin<input v-model="t.name" type="text" class="input"></label>
            <label class="field">Persen (%)<input v-model.number="t.percent" type="number" min="0" max="100" step="0.01" class="input" :disabled="billed(t)"></label>
            <div class="flex flex-col gap-1.5"><span class="text-sm font-semibold text-ink-2">Nominal</span><span class="min-h-11 flex items-center text-sm font-bold tabular-nums">{{ rupiah(amounts[i]) }}</span></div>
            <label class="field sm:col-span-1">Syarat penagihan<input v-model="t.conditions" type="text" class="input" placeholder="Mis. setelah UAT"></label>
            <UiDateTimeInput v-model="t.dueDate" label="Jatuh tempo" />
            <div class="flex items-center justify-end gap-2 min-h-11">
              <UiBadge v-if="billed(t)" :tone="TERM_STATUS[(t.status as TermStatus)]" />
              <button v-else type="button" class="btn-ghost !min-h-10 !px-2.5 text-danger-700" aria-label="Hapus termin" :disabled="f.terms.length <= 1" @click="f.terms.splice(i, 1)">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
                Hapus
              </button>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button type="button" class="btn-secondary btn-sm" @click="addTerm">+ Tambah termin</button>
          <span role="status" class="text-sm font-semibold" :class="pctOk ? 'text-success-700' : 'text-danger-700'">Total {{ percent(pctSum) }}{{ pctOk ? ' ✓' : ' — harus 100%' }}</span>
        </div>
      </section>

      <!-- Tim & skema -->
      <section class="card-pad flex flex-col gap-4">
        <div class="flex flex-col gap-1"><h2 class="section-title">Tim &amp; Skema Bagi Hasil</h2><span class="text-sm text-muted">Pilih template dari Pengaturan, lalu sesuaikan bila perlu.</span></div>
        <div role="radiogroup" aria-label="Skema bagi hasil" class="grid gap-3 sm:grid-cols-3">
          <button v-for="s in schemes" :key="s.id" type="button" role="radio" :aria-checked="f.schemeId === s.id" class="text-left rounded-xl border p-4 flex flex-col gap-1 min-h-11" :class="f.schemeId === s.id ? 'border-brand-600 bg-brand-soft ring-2 ring-brand-50' : 'border-line-2 bg-white hover:bg-soft'" @click="pickScheme(s.id)">
            <span class="text-sm font-bold">{{ s.name }}</span>
            <span class="text-xs text-muted">Modal {{ percent(s.capitalPct) }} · Pekerja {{ percent(s.workerPct) }} · Kas {{ percent(s.cashPct) }}</span>
          </button>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="field">Bagian modal (%)<input v-model.number="f.capitalPct" type="number" min="0" max="100" class="input"><span class="hint">Untuk investor, sesuai porsi modal. Isi 0 bila tidak didanai investor.</span></label>
          <label class="field">Bagian pekerja (%)<input v-model.number="f.workerPct" type="number" min="0" max="100" class="input"><span class="hint">Dibagi ke anggota tim “bagi hasil”.</span></label>
          <div class="field">Kas OCN (sisa otomatis)<div class="min-h-11 flex items-center px-3 rounded-lg bg-soft font-bold" :class="f.cashPct < 0 && 'text-danger-700'">{{ percent(f.cashPct) }}</div></div>
        </div>

        <div class="flex flex-col gap-2">
          <div v-for="(m, i) in f.members" :key="m.userId" class="rounded-xl border border-line-2 p-3 grid gap-3 sm:grid-cols-[180px_1fr_200px_auto] items-center">
            <div class="flex items-center gap-2"><UiAvatar :name="userName(m.userId)" :color="userColor(m.userId)" /><span class="text-sm font-semibold">{{ userName(m.userId) }}</span></div>
            <input v-model="m.roleInProject" type="text" class="input input-sm" aria-label="Peran di proyek" placeholder="Peran di proyek">
            <UiSelect v-model="m.payType" size="sm" aria-label="Cara pembayaran" :options="[{ value: 'bagi_hasil', label: 'Bagi hasil' }, { value: 'tetap', label: 'Dibayar tetap (biaya proyek)' }]" />
            <button type="button" class="btn-ghost !min-h-9 !px-2" :aria-label="`Keluarkan ${userName(m.userId)} dari tim`" @click="f.members.splice(i, 1)">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div v-if="m.payType === 'tetap'" class="sm:col-span-4"><UiMoneyInput v-model="m.fixedFee" size="sm" label="Honor tetap" hint="Catat pembayaran honor sebagai pengeluaran proyek (kategori Honor freelancer)." /></div>
            <label v-else class="sm:col-span-4 flex items-center gap-2 text-xs text-muted">Bobot bagian pekerja <input v-model.number="m.shareWeight" type="number" min="0" max="100" class="input input-sm !w-20"> <span>(sama rata bila semua 1)</span></label>
          </div>
          <div class="flex flex-wrap gap-2">
            <button v-for="u in addable" :key="u.id" type="button" class="btn-secondary btn-sm" @click="addMember(u.id)">+ {{ u.name }}</button>
            <span v-if="!addable.length" class="text-xs text-muted">Semua pengguna sudah masuk tim. Undang developer di Pengaturan › Pengguna.</span>
          </div>
        </div>
      </section>

      <!-- Milestone -->
      <section class="card-pad flex flex-col gap-4">
        <div class="flex flex-col gap-1"><h2 class="section-title">Milestone</h2><span class="text-sm text-muted">Tahapan pekerjaan yang tampil di tab Ringkasan.</span></div>
        <div v-for="(m, i) in f.milestones" :key="m.id ?? `m${i}`" class="grid gap-3 sm:grid-cols-[32px_1fr_190px_150px_auto] items-center">
          <span class="w-8 h-8 rounded-full bg-soft-2 text-xs font-bold flex items-center justify-center">{{ i + 1 }}</span>
          <input v-model="m.name" type="text" class="input" aria-label="Nama milestone" placeholder="Nama tahapan">
          <UiDateTimeInput v-model="m.targetDate" aria-label="Target milestone" />
          <UiSelect v-model="m.status" aria-label="Status milestone" :options="[{ value: 'belum', label: 'Belum' }, { value: 'berjalan', label: 'Berjalan' }, { value: 'selesai', label: 'Selesai' }]" />
          <button type="button" class="btn-ghost !min-h-10 !px-2" aria-label="Hapus milestone" @click="f.milestones.splice(i, 1)">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div><button type="button" class="btn-secondary btn-sm" @click="addMilestone">+ Tambah milestone</button></div>
      </section>

      <section v-if="projectId" class="card-pad flex flex-col gap-4 !border-danger-50">
        <div class="flex flex-col gap-1"><h2 class="section-title !text-danger-700">Zona Berbahaya</h2><span class="text-sm text-muted">Arsipkan untuk menyembunyikan proyek tanpa menghapus data. Hapus permanen akan menghapus termin, invoice, pengeluaran, bug, dan dokumen.</span></div>
        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn-secondary" @click="archive">{{ (existing as any)?.project.archived ? 'Pulihkan dari arsip' : 'Arsipkan' }}</button>
          <button type="button" class="btn-danger" @click="remove">Hapus proyek</button>
        </div>
      </section>
    </form>

    <aside class="card-pad flex flex-col gap-3 xl:sticky xl:top-24">
      <h2 class="section-title">Ringkasan</h2>
      <dl class="m-0 flex flex-col gap-2 text-sm">
        <div class="flex justify-between gap-2"><dt class="text-muted">Nilai kontrak</dt><dd class="m-0 font-semibold tabular-nums">{{ rupiah(f.contractValue) }}</dd></div>
        <div class="flex justify-between gap-2"><dt class="text-muted">Jumlah termin</dt><dd class="m-0 font-semibold">{{ f.terms.length }}</dd></div>
        <div class="flex justify-between gap-2"><dt class="text-muted">Total persen termin</dt><dd class="m-0 font-semibold" :class="pctOk ? 'text-success-700' : 'text-danger-700'">{{ percent(pctSum) }}</dd></div>
        <div class="flex justify-between gap-2"><dt class="text-muted">Anggota tim</dt><dd class="m-0 font-semibold">{{ f.members.length }} orang</dd></div>
        <div class="flex justify-between gap-2"><dt class="text-muted">Skema</dt><dd class="m-0 font-semibold text-right">{{ schemeName }}<br><span class="text-xs text-muted font-normal">{{ f.capitalPct }} / {{ f.workerPct }} / {{ f.cashPct }}</span></dd></div>
        <div class="flex justify-between gap-2"><dt class="text-muted">Milestone</dt><dd class="m-0 font-semibold">{{ f.milestones.length }}</dd></div>
      </dl>
      <div class="rounded-lg bg-soft p-3 flex flex-col gap-1.5 text-xs text-muted">
        <span class="font-semibold text-ink-2">Setelah disimpan</span>
        <span>• Termin dibuat sebagai jadwal tagihan</span>
        <span>• Invoice DP bisa langsung diterbitkan</span>
        <span>• Anggota tim mendapat akses proyek &amp; bug</span>
      </div>
      <button type="button" class="btn-primary w-full" :disabled="saving" @click="save">{{ saving ? 'Menyimpan…' : 'Simpan' }}</button>
    </aside>
  </div>
</template>
