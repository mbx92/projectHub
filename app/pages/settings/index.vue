<script setup lang="ts">
import type { ActionItem } from '~/components/ui/UiActionMenu.vue'
definePageMeta({ middleware: 'role', access: ['pengaturan', 'kelola'] })
useHead({ title: 'Pengaturan — OCN Project Hub' })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const { user: me, isAdmin } = useAuth()

type Sec = 'profile' | 'skema' | 'users' | 'bank' | 'notif' | 'integrations'
// Pengguna & Hak Akses khusus admin (agar hak akses tidak bisa dinaikkan sendiri).
const SECS = ([['profile', 'Profil Usaha'], ['skema', 'Skema Bagi Hasil'], ['users', 'Pengguna & Hak Akses'], ['bank', 'Rekening & Metode Bayar'], ['notif', 'Notifikasi'], ['integrations', 'Integrasi']] as [Sec, string][])
  .filter(([k]) => k !== 'users' || isAdmin.value)
const sec = ref<Sec>(SECS.some(([k]) => k === route.query.bagian) ? route.query.bagian as Sec : 'profile')
watch(sec, s => router.replace({ query: { bagian: s } }))

const [{ data: settings, refresh: rSet }, { data: schemes, refresh: rSch }, { data: users, refresh: rUsers }, { data: banks, refresh: rBanks }] = await Promise.all([
  useFetch('/api/settings'),
  useFetch('/api/schemes', { default: () => [] }),
  useFetch('/api/users', { default: () => [] as any[], immediate: isAdmin.value }),
  useFetch('/api/bank-accounts', { default: () => [] }),
])

// ── Profil usaha ──
const biz = reactive({ ...(settings.value!.business) })
const inv = reactive({ ...(settings.value!.invoice!), methods: { ...settings.value!.invoice!.methods } })
const logoUrl = ref(settings.value?.business.logoUrl ?? null)
const signatureUrl = ref((settings.value?.business as any).signatureUrl ?? null)
const qrisUrl = ref(settings.value?.invoice?.qrisUrl ?? null)
const numberPreview = computed(() => {
  const today = todayISO()
  const mm = inv.numberFormat.match(/\[NOMOR(?: (\d) DIGIT)?\]/)
  const digits = mm?.[1] ? Number(mm[1]) : 3
  return inv.numberFormat.replace('[TAHUN]', today.slice(0, 4)).replace('[BULAN]', today.slice(5, 7)).replace(/\[NOMOR(?: \d DIGIT)?\]/, '15'.padStart(digits, '0'))
})
async function saveProfile() {
  const { logoUrl: _l, signatureUrl: _s, ...business } = biz as any
  const { qrisUrl: _q, ...invoice } = inv as any
  try { await $fetch('/api/settings', { method: 'PUT', body: { business, invoice } }); toast.success('Pengaturan disimpan'); await rSet() } catch (e) { toast.error(errorMessage(e)) }
}
function onLogo(f: UploadedFile) { logoUrl.value = f.url }
function onSignature(f: UploadedFile) { signatureUrl.value = f.url }
function onQris(f: UploadedFile) { qrisUrl.value = f.url }

// ── Skema ──
const tplId = ref<number | null>(schemes.value[0]?.id ?? null)
const tpl = reactive({ name: '', description: '' as string | null, capitalPct: 40, workerPct: 40, labels: { modal: 'Modal', pekerja: 'Pekerja', kas: 'Kas OCN' } })
function loadTpl(id: number | null) {
  const s = schemes.value.find(x => x.id === id)
  if (s) Object.assign(tpl, { name: s.name, description: s.description, capitalPct: s.capitalPct, workerPct: s.workerPct, labels: { modal: 'Modal', pekerja: 'Pekerja', kas: 'Kas OCN', ...(s.shareLabels ?? {}) } })
  else Object.assign(tpl, { name: 'Template baru', description: '', capitalPct: 0, workerPct: 80, labels: { modal: 'Modal', pekerja: 'Pekerja', kas: 'Kas OCN' } })
}
loadTpl(tplId.value)
watch(tplId, loadTpl)
const kas = computed(() => 100 - tpl.capitalPct - tpl.workerPct)
const SIM = 10_000_000
const simParts = computed(() => splitByWeights(SIM, [tpl.capitalPct, tpl.workerPct, Math.max(0, kas.value)]))
async function saveTpl() {
  if (kas.value < 0) return toast.error('Total melebihi 100% — kurangi salah satu bagian.')
  const body = { name: tpl.name, description: tpl.description, capitalPct: tpl.capitalPct, workerPct: tpl.workerPct, cashPct: kas.value, shareLabels: tpl.labels }
  try {
    if (tplId.value) await $fetch<unknown>(`/api/schemes/${tplId.value}`, { method: 'PUT', body })
    else { const r = await $fetch<{ id: number }>('/api/schemes', { method: 'POST', body }); await rSch(); tplId.value = r.id }
    toast.success('Template disimpan. Proyek dan distribusi lama tidak berubah.')
    await rSch()
  } catch (e) { toast.error(errorMessage(e)) }
}
async function delTpl() {
  if (!tplId.value) return
  const ok = await confirm({ variant: 'danger', title: `Hapus template ${tpl.name}?`, confirmText: 'Hapus', action: () => $fetch<unknown>(`/api/schemes/${tplId.value}`, { method: 'DELETE' }) })
  if (ok) { await rSch(); tplId.value = schemes.value[0]?.id ?? null }
}

// ── Hak akses (matriks per peran) ──
const { data: accessData, refresh: rAccess } = await useFetch('/api/access', { immediate: isAdmin.value })
const savedMatrix = computed<AccessMatrix>(() => accessData.value?.matrix ?? DEFAULT_ACCESS)
const MODULE_KEYS = Object.keys(ACCESS_MODULES) as AccessModule[]
const accessOf = (role: Role): RoleAccess => accessFor(role, savedMatrix.value)
const scopeLabel = (s: ProjectScope) => PROJECT_SCOPES.find(x => x.value === s)?.label ?? s
/** Ringkasan modul yang aktif untuk kartu peran, mis. "Keuangan: Ringkasan proyek". */
function grants(role: Role) {
  const a = accessOf(role)
  return MODULE_KEYS.filter(m => a[m] !== 'tidak').map(m => ({ module: ACCESS_MODULES[m].label, level: accessLabel(m, a[m]) }))
}
const ROLE_CARDS: { role: Role, desc: string }[] = [
  { role: 'admin', desc: 'Akses penuh ke semua modul. Tidak bisa diubah agar tidak ada yang terkunci.' },
  { role: 'investor', desc: 'Pemodal OCN.' },
  { role: 'developer', desc: 'Freelancer / tim pengembang.' },
]
const roleCount = (r: Role) => users.value.filter(u => u.role === r).length

// Dialog atur hak akses per peran — tiap level berupa toggle bertingkat:
// menyalakan level lebih tinggi otomatis menyalakan level di bawahnya.
const LEVEL_DESC: Record<string, string> = {
  'proyek.lihat': 'Daftar & detail proyek sesuai cakupan',
  'proyek.kelola': 'Tambah, ubah, arsip, hapus proyek',
  'dokumen.lihat': 'Anggota tim dan dokumen proyek',
  'dokumen.kelola': 'Unggah dan ubah status dokumen',
  'keuangan.ringkasan': 'Termin, pengeluaran, laba di detail proyek',
  'keuangan.lihat': 'Halaman Pembayaran, invoice, mutasi kas, bukti',
  'keuangan.kelola': 'Buat invoice, catat pembayaran & pengeluaran',
  'bug.lihat': 'Papan kanban dan detail bug',
  'bug.ditugaskan': 'Lapor bug, komentar, ubah status bug miliknya',
  'bug.kelola': 'Tugaskan, ubah keparahan, tutup bug',
  'investor.sendiri': 'Modal dan bagi hasil milik sendiri',
  'investor.lihat': 'Halaman Investor & Modal (semua investor)',
  'investor.kelola': 'Setoran modal, distribusi, undang investor',
  'laporan.lihat': 'Dashboard Investor, laporan, ekspor',
  'pengaturan.kelola': 'Profil usaha, skema bagi hasil, rekening',
}
const editRole = ref<'investor' | 'developer' | null>(null)
const draft = ref<RoleAccess | null>(null)
const savingAccess = ref(false)
function openAccess(role: 'investor' | 'developer') {
  editRole.value = role
  draft.value = { ...accessOf(role) }
}
function closeAccess() { editRole.value = null; draft.value = null }
const dialogDirty = computed(() => !!draft.value && !!editRole.value && JSON.stringify(draft.value) !== JSON.stringify(accessOf(editRole.value)))
const levelIndex = (m: AccessModule, v: string) => ACCESS_MODULES[m].levels.findIndex(l => l.value === v)
const isOn = (m: AccessModule, idx: number) => !!draft.value && levelIndex(m, draft.value[m]) >= idx
function setLevel(m: AccessModule, idx: number, on: boolean) {
  if (!draft.value) return
  ;(draft.value as Record<string, string>)[m] = ACCESS_MODULES[m].levels[on ? idx : idx - 1]!.value
}
async function saveAccess() {
  if (!draft.value || !editRole.value) return
  savingAccess.value = true
  try {
    await $fetch('/api/access', { method: 'PUT', body: { ...savedMatrix.value, [editRole.value]: draft.value } })
    await rAccess()
    toast.success(`Hak akses ${ROLE_LABEL[editRole.value]} disimpan. Pengguna yang sedang login melihat perubahan menu setelah memuat ulang halaman.`)
    closeAccess()
  } catch (e) { toast.error(errorMessage(e)) } finally { savingAccess.value = false }
}
function resetDraft() { if (editRole.value) draft.value = { ...DEFAULT_ACCESS[editRole.value] } }

// ── Ubah kata sandi pengguna (admin) ──
const pwdUser = ref<{ id: number, name: string, status: string } | null>(null)
const pwd = reactive({ password: '', confirm: '', logoutAll: true, show: false })
const pwdErr = ref('')
const savingPwd = ref(false)
function openPwd(u: { id: number, name: string, status: string }) {
  pwdUser.value = u
  Object.assign(pwd, { password: '', confirm: '', logoutAll: true, show: false })
  pwdErr.value = ''
}
async function savePwd() {
  pwdErr.value = ''
  if (pwd.password.length < 8) { pwdErr.value = 'Kata sandi minimal 8 karakter.'; return }
  if (pwd.password !== pwd.confirm) { pwdErr.value = 'Konfirmasi kata sandi tidak sama.'; return }
  savingPwd.value = true
  try {
    const r = await $fetch<{ activated: boolean }>(`/api/users/${pwdUser.value!.id}/password`, { method: 'POST', body: { password: pwd.password, logoutAll: pwd.logoutAll } })
    toast.success(`Kata sandi ${pwdUser.value!.name} diubah${r.activated ? ' dan akun diaktifkan' : ''}. Sampaikan sandi baru secara langsung.`)
    pwdUser.value = null
    await rUsers()
  } catch (e) { pwdErr.value = errorMessage(e) } finally { savingPwd.value = false }
}

// ── Pengguna ──
type UserRow = { id: number, name: string, status: string }
/** Menu aksi per pengguna (…). */
const userItems = (u: UserRow): ActionItem[] => [
  u.id === me.value?.id
    ? { label: 'Ubah sandi saya', to: '/account' }
    : { label: 'Ubah sandi', onClick: () => openPwd(u) },
  { label: 'Kirim ulang undangan', hidden: u.status !== 'diundang', onClick: () => resend(u.id) },
  { label: 'Nonaktifkan pengguna', danger: true, hidden: !(u.id !== me.value?.id && u.status === 'aktif'), onClick: () => updateUser(u.id, { status: 'nonaktif' }, 'Pengguna dinonaktifkan') },
  { label: 'Aktifkan pengguna', hidden: u.status !== 'nonaktif', onClick: () => updateUser(u.id, { status: 'aktif' }, 'Pengguna diaktifkan') },
]
const inviteOpen = ref(route.query.undang === '1')
const invite = reactive({ name: '', email: '', role: 'developer' as Role, title: '' })
async function sendInvite() {
  try {
    const r = await $fetch<{ inviteUrl?: string }>('/api/users', { method: 'POST', body: { ...invite, title: invite.title || null } })
    toast.success(`Undangan dikirim ke ${invite.email} (berlaku 7 hari)`)
    if (r.inviteUrl) console.info('Tautan undangan (dev):', r.inviteUrl)
    inviteOpen.value = false
    Object.assign(invite, { name: '', email: '', role: 'developer', title: '' })
    await rUsers()
  } catch (e) { toast.error(errorMessage(e)) }
}
async function updateUser(id: number, body: Record<string, unknown>, msg = 'Pengguna diperbarui') {
  try { await $fetch<unknown>(`/api/users/${id}`, { method: 'PATCH', body }); toast.success(msg); await rUsers() } catch (e) { toast.error(errorMessage(e)); await rUsers() }
}
async function resend(id: number) {
  try { const r = await $fetch<{ inviteUrl?: string }>(`/api/users/${id}/resend`, { method: 'POST' }); toast.success('Undangan dikirim ulang'); if (r.inviteUrl) console.info('Tautan undangan (dev):', r.inviteUrl) } catch (e) { toast.error(errorMessage(e)) }
}
const roleOpts = (Object.keys(ROLE_LABEL) as Role[]).map(r => ({ value: r, label: ROLE_LABEL[r] }))

// ── Rekening ──
const bankOpen = ref(false)
const bankEdit = ref<number | null>(null)
const bank = reactive({ bankName: '', accountNumber: '', accountName: '', isDefault: false, active: true })
function openBank(b?: any) {
  bankEdit.value = b?.id ?? null
  Object.assign(bank, b ? { bankName: b.bankName, accountNumber: b.accountNumber, accountName: b.accountName, isDefault: b.isDefault, active: b.active } : { bankName: '', accountNumber: '', accountName: biz.name, isDefault: !banks.value.length, active: true })
  bankOpen.value = true
}
async function saveBank() {
  try {
    if (bankEdit.value) await $fetch<unknown>(`/api/bank-accounts/${bankEdit.value}`, { method: 'PUT', body: bank })
    else await $fetch('/api/bank-accounts', { method: 'POST', body: bank })
    bankOpen.value = false
    await rBanks()
  } catch (e) { toast.error(errorMessage(e)) }
}
async function delBank() {
  const ok = await confirm({ variant: 'danger', title: 'Hapus rekening ini?', message: 'Rekening yang sudah dipakai invoice hanya dinonaktifkan.', confirmText: 'Hapus', action: () => $fetch<unknown>(`/api/bank-accounts/${bankEdit.value}`, { method: 'DELETE' }) })
  if (ok) { bankOpen.value = false; await rBanks() }
}

// ── Notifikasi (akun sendiri) ──
const prefs = ref<Record<string, NotifPref>>({ ...(settings.value?.notif ?? {}) })
async function savePrefs() {
  try { await $fetch('/api/settings', { method: 'PUT', body: { notif: prefs.value } }); toast.success('Preferensi notifikasi disimpan') } catch (e) { toast.error(errorMessage(e)) }
}
const INTEGRATIONS = [
  { name: 'WhatsApp', desc: 'Pengingat termin otomatis ke klien', bg: '#DCFAE6', fg: '#067647' },
  { name: 'Telegram', desc: 'Notifikasi tim & ringkasan harian', bg: '#E8F0FE', fg: '#175CD3' },
  { name: 'Google Drive', desc: 'Simpan dokumen proyek ke Drive', bg: '#FEF0C7', fg: '#B54708' },
  { name: 'API & Webhook', desc: 'Hubungkan sistem lain, mis. bot internal', bg: '#F4F3FF', fg: '#5925DC' },
]
</script>

<template>
  <UiPageHeader title="Pengaturan" subtitle="Skema bagi hasil, pengguna dan hak akses, serta data usaha." />
  <div class="grid gap-6 lg:grid-cols-[220px_1fr] items-start">
    <nav aria-label="Bagian pengaturan" class="card p-2 flex lg:flex-col gap-1 overflow-x-auto">
      <button v-for="[k, label] in SECS" :key="k" type="button" :aria-current="sec === k ? 'page' : undefined" class="text-left min-h-11 px-3 rounded-lg text-sm whitespace-nowrap" :class="sec === k ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-2 hover:bg-soft'" @click="sec = k">{{ label }}</button>
    </nav>

    <div class="flex flex-col gap-6 min-w-0">
      <!-- Profil usaha -->
      <section v-if="sec === 'profile'" class="card-pad flex flex-col gap-5">
        <div class="flex flex-col gap-1"><h2 class="section-title">Profil Usaha</h2><span class="text-sm text-muted">Dipakai di kop invoice, kuitansi, dan laporan investor.</span></div>
        <div class="flex flex-wrap items-center gap-4">
          <img v-if="logoUrl" :src="logoUrl" alt="Logo usaha" class="w-16 h-16 rounded-xl object-contain border border-line-2">
          <div v-else class="w-16 h-16 rounded-xl bg-brand-600 text-white font-bold flex items-center justify-center">OCN</div>
          <div class="flex flex-col gap-1.5"><UiFileButton v-model="biz.logoKey" folder="logo" label="Ganti logo" accept="image/png,image/jpeg,image/svg+xml" @uploaded="onLogo" /><span class="text-xs text-muted">PNG/JPG/SVG persegi, minimal 256×256 px</span></div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="field">Nama usaha<input v-model="biz.name" class="input"></label>
          <UiSelect v-model="biz.legalForm" label="Bentuk usaha" :options="['Perorangan / UMKM', 'CV', 'PT'].map(v => ({ value: v, label: v }))" />
          <label class="field">NPWP<input v-model="biz.npwp" class="input" placeholder="Nomor NPWP"></label>
          <label class="field">Email usaha<input v-model="biz.email" type="email" class="input"></label>
          <label class="field">WhatsApp<input v-model="biz.whatsapp" type="tel" class="input" placeholder="+62 …"></label>
          <UiSelect v-model="biz.timezone" label="Zona waktu" :options="[{ value: 'Asia/Makassar', label: 'WITA (UTC+8) — Bali' }, { value: 'Asia/Jakarta', label: 'WIB (UTC+7)' }, { value: 'Asia/Jayapura', label: 'WIT (UTC+9)' }]" />
        </div>
        <label class="field">Alamat<textarea v-model="biz.address" rows="3" class="input" /></label>
        <div class="flex flex-col gap-3 rounded-xl border border-line-2 p-4">
          <div class="flex flex-col gap-1"><h3 class="m-0 text-sm font-bold">Tanda tangan usaha</h3><span class="text-xs text-muted">Tercetak di bagian bawah invoice dan kuitansi pembayaran.</span></div>
          <div class="flex flex-wrap items-center gap-4">
            <img v-if="signatureUrl" :src="signatureUrl" alt="Tanda tangan usaha" class="h-16 max-w-48 object-contain border border-line-2 rounded-lg bg-white p-1">
            <div v-else class="h-16 w-40 rounded-lg border border-dashed border-line-2 text-xs text-muted flex items-center justify-center">Belum ada</div>
            <div class="flex flex-col gap-1.5">
              <UiFileButton v-model="biz.signatureKey" folder="logo" label="Unggah tanda tangan" accept="image/png,image/jpeg" @uploaded="onSignature" />
              <span class="text-xs text-muted">PNG/JPG, sebaiknya latar transparan atau putih</span>
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="field">Nama penandatangan<input v-model="biz.signerName" class="input" placeholder="Mis. Pande"></label>
            <label class="field">Jabatan<input v-model="biz.signerTitle" class="input" placeholder="Mis. Pendiri"></label>
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="field">Format nomor invoice<input v-model="inv.numberFormat" class="input"><span class="hint">Token: [TAHUN] [BULAN] [NOMOR 3 DIGIT] · Contoh: {{ numberPreview }}</span></label>
          <UiSelect model-value="IDR" label="Mata uang" :options="[{ value: 'IDR', label: 'Rupiah (IDR)' }]" />
        </div>
        <div class="flex justify-end"><button type="button" class="btn-primary" @click="saveProfile">Simpan Perubahan</button></div>
      </section>

      <!-- Skema -->
      <section v-if="sec === 'skema'" class="card-pad flex flex-col gap-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1"><h2 class="section-title">Skema Bagi Hasil</h2><span class="text-sm text-muted">Template dipilih saat membuat proyek; tiap proyek bisa diubah sesuai perjanjian. Mengubah template tidak mengubah proyek & distribusi yang sudah ada.</span></div>
          <button type="button" class="btn-secondary btn-sm" @click="tplId = null">+ Template Baru</button>
        </div>
        <div role="radiogroup" aria-label="Template skema" class="grid gap-3 sm:grid-cols-3">
          <button v-for="t in schemes" :key="t.id" type="button" role="radio" :aria-checked="tplId === t.id" class="text-left rounded-xl border p-4 flex flex-col gap-1" :class="tplId === t.id ? 'border-brand-600 bg-brand-soft' : 'border-line-2 hover:bg-soft'" @click="tplId = t.id">
            <span class="text-sm font-bold">{{ t.name }}</span><span class="text-xs text-muted">{{ t.description || `${t.capitalPct}/${t.workerPct}/${t.cashPct}` }}</span>
          </button>
        </div>
        <div class="grid gap-6 lg:grid-cols-2">
          <div class="flex flex-col gap-4">
            <label class="field">Nama template<input v-model="tpl.name" class="input"></label>
            <label class="field">Deskripsi<input v-model="tpl.description" class="input"></label>
            <label class="flex flex-col gap-2"><span class="flex justify-between text-sm font-semibold"><span>Bagian {{ tpl.labels.modal.toLowerCase() }} (investor)</span><span>{{ tpl.capitalPct }}%</span></span><input v-model.number="tpl.capitalPct" type="range" min="0" max="100" step="5" class="accent-brand-600"></label>
            <label class="flex flex-col gap-2"><span class="flex justify-between text-sm font-semibold"><span>Bagian {{ tpl.labels.pekerja.toLowerCase() }}</span><span>{{ tpl.workerPct }}%</span></span><input v-model.number="tpl.workerPct" type="range" min="0" max="100" step="5" class="accent-brand-600"></label>
            <div class="flex justify-between text-sm"><span class="font-semibold">{{ tpl.labels.kas }} (sisa otomatis)</span><span class="font-bold" :class="kas < 0 && 'text-danger-700'">{{ Math.max(0, kas) }}%</span></div>
            <span v-if="kas < 0" role="alert" class="text-sm text-danger-700">Total melebihi 100% — kurangi salah satu bagian.</span>
            <div class="grid grid-cols-3 gap-2">
              <label class="field text-xs">Label modal<input v-model="tpl.labels.modal" class="input input-sm"></label>
              <label class="field text-xs">Label pekerja<input v-model="tpl.labels.pekerja" class="input input-sm"></label>
              <label class="field text-xs">Label kas<input v-model="tpl.labels.kas" class="input input-sm"></label>
            </div>
          </div>
          <div class="rounded-xl bg-soft p-4 flex flex-col gap-3">
            <span class="text-sm">Simulasi dengan laba bersih <strong>{{ rupiah(SIM) }}</strong></span>
            <div class="flex h-3 rounded-full overflow-hidden" aria-hidden="true">
              <div :style="{ width: `${tpl.capitalPct}%`, background: '#0B6E63' }" /><div :style="{ width: `${tpl.workerPct}%`, background: '#2E90FA' }" /><div :style="{ width: `${Math.max(0, kas)}%`, background: '#98A2B3' }" />
            </div>
            <div v-for="(row, i) in [[tpl.labels.modal, '#0B6E63'], [tpl.labels.pekerja, '#2E90FA'], [tpl.labels.kas, '#98A2B3']]" :key="i" class="flex justify-between text-sm"><span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-sm" :style="{ background: row[1] }" />{{ row[0] }}</span><span class="font-semibold tabular-nums">{{ rupiah(simParts[i]) }}</span></div>
            <span class="text-xs text-muted">Bagian modal dibagi lagi antar investor sesuai porsi modal masing-masing.</span>
          </div>
        </div>
        <div class="flex justify-between gap-2">
          <button v-if="tplId" type="button" class="btn-ghost text-danger-700" @click="delTpl">Hapus template</button><span v-else />
          <div class="flex gap-2"><button type="button" class="btn-secondary" @click="loadTpl(tplId)">Batalkan</button><button type="button" class="btn-primary" :disabled="kas < 0" @click="saveTpl">Simpan Template</button></div>
        </div>
      </section>

      <!-- Hak akses per peran -->
      <section v-if="sec === 'users'" class="card-pad flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h2 class="section-title">Hak Akses per Peran</h2>
          <span class="text-sm text-muted">Setiap pengguna mengikuti hak akses perannya. Pengguna &amp; Hak Akses tetap khusus admin, dan semua aturan juga diperiksa di server.</span>
        </div>
        <div class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          <article v-for="c in ROLE_CARDS" :key="c.role" class="rounded-xl border border-line-2 p-4 flex flex-col gap-3 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="font-bold">{{ ROLE_LABEL[c.role] }}</span>
                <span class="text-xs text-muted">{{ roleCount(c.role) }} pengguna · {{ c.desc }}</span>
              </div>
              <span v-if="c.role === 'admin'" class="badge bg-brand-50 text-brand-700 shrink-0">Penuh</span>
            </div>
            <ul class="m-0 p-0 list-none flex flex-wrap gap-1.5">
              <li v-for="g in grants(c.role)" :key="g.module" class="text-[11px] font-medium bg-soft-2 text-ink-2 rounded-md px-2 py-1">{{ g.module }}: <span class="font-semibold">{{ g.level }}</span></li>
              <li class="text-[11px] font-medium bg-info-50 text-info-700 rounded-md px-2 py-1">{{ scopeLabel(accessOf(c.role).scope) }}</li>
            </ul>
            <button v-if="c.role !== 'admin'" type="button" class="btn-secondary btn-sm self-start mt-auto" @click="openAccess(c.role as 'investor' | 'developer')">Atur hak akses</button>
          </article>
        </div>
      </section>

      <!-- Pengguna -->
      <section v-if="sec === 'users'" class="card-pad flex flex-col gap-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1"><h2 class="section-title">Pengguna</h2><span class="text-sm text-muted">{{ users.length }} pengguna · undangan berlaku 7 hari</span></div>
          <button type="button" class="btn-primary btn-sm" :aria-expanded="inviteOpen" @click="inviteOpen = !inviteOpen">+ Tambah Pengguna</button>
        </div>
        <form v-if="inviteOpen" class="rounded-xl border border-brand-100 bg-brand-soft p-4 grid gap-3 sm:grid-cols-2" @submit.prevent="sendInvite">
          <label class="field">Nama<input v-model="invite.name" class="input" required></label>
          <label class="field">Email<input v-model="invite.email" type="email" class="input" required></label>
          <UiSelect v-model="invite.role" label="Peran" :options="roleOpts" />
          <label class="field">Jabatan (opsional)<input v-model="invite.title" class="input" placeholder="Mis. Pendiri, Freelancer"></label>
          <div class="sm:col-span-2 flex justify-end gap-2"><button type="button" class="btn-secondary" @click="inviteOpen = false">Batal</button><button type="submit" class="btn-primary">Kirim Undangan</button></div>
        </form>
        <ul class="m-0 p-0 list-none grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          <li v-for="u in users" :key="u.id" class="rounded-xl border border-line-2 p-3 flex flex-col gap-3 min-w-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <UiAvatar :name="u.name" :color="u.avatarColor" :size="36" />
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-sm font-semibold truncate">{{ u.name }}<span v-if="u.id === me?.id" class="font-normal text-muted"> (Anda)</span></span>
                <span class="text-xs text-muted truncate">{{ u.email }}</span>
              </div>
              <span class="badge shrink-0 !px-2 !py-0.5" :class="u.status === 'aktif' ? 'bg-success-50 text-success-700' : u.status === 'diundang' ? 'bg-warning-50 text-warning-700' : 'bg-soft-2 text-muted'">{{ u.status === 'aktif' ? 'Aktif' : u.status === 'diundang' ? 'Diundang' : 'Nonaktif' }}</span>
              <UiActionMenu :label="`Aksi untuk ${u.name}`" :items="userItems(u)" />
            </div>
            <UiSelect :model-value="u.role" size="sm" :aria-label="`Peran ${u.name}`" :options="roleOpts" :disabled="u.id === me?.id" @change="v => updateUser(u.id, { role: v }, 'Peran diubah')" />
          </li>
        </ul>
      </section>

      <!-- Rekening -->
      <template v-if="sec === 'bank'">
        <section class="card-pad flex flex-col gap-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex flex-col gap-1"><h2 class="section-title">Rekening Penerimaan</h2><span class="text-sm text-muted">Rekening utama tercetak di invoice dan pengingat pembayaran.</span></div>
            <button type="button" class="btn-secondary btn-sm" @click="openBank()">+ Tambah Rekening</button>
          </div>
          <div v-for="b in banks" :key="b.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" :class="b.isDefault ? 'bg-brand-soft border-brand-100' : 'border-line-2'" :style="!b.active ? { opacity: 0.6 } : undefined">
            <div class="flex flex-col"><span class="font-semibold">{{ b.bankName }}</span><span class="text-sm text-muted">{{ b.accountNumber }} · a.n. {{ b.accountName }}{{ b.active ? '' : ' · nonaktif' }}</span></div>
            <div class="flex items-center gap-3"><span v-if="b.isDefault" class="badge bg-brand-600 text-white">Utama</span><button type="button" class="btn-secondary btn-sm" @click="openBank(b)">Ubah</button></div>
          </div>
          <p v-if="!banks.length" class="m-0 text-sm text-muted">Belum ada rekening. Tambahkan agar tercetak di invoice.</p>
        </section>
        <section class="card-pad flex flex-col gap-4">
          <h2 class="section-title">Metode Pembayaran &amp; Invoice</h2>
          <label v-for="m in [{ k: 'transfer', name: 'Transfer bank', desc: 'Klien transfer ke rekening utama, admin konfirmasi manual' }, { k: 'qris', name: 'QRIS', desc: 'Kode QR statis dicetak di invoice' }, { k: 'tunai', name: 'Tunai', desc: 'Dicatat manual dengan kuitansi' }]" :key="m.k" class="flex items-center justify-between gap-3 min-h-11 cursor-pointer">
            <span class="flex flex-col"><span class="text-sm font-semibold">{{ m.name }}</span><span class="text-xs text-muted">{{ m.desc }}</span></span>
            <input v-model="(inv.methods as any)[m.k]" type="checkbox" class="w-5 h-5 accent-brand-600">
          </label>
          <div v-if="inv.methods.qris" class="flex flex-wrap items-center gap-4 rounded-lg bg-soft p-3">
            <img v-if="qrisUrl" :src="qrisUrl" alt="QRIS" class="w-20 h-20 object-contain bg-white rounded">
            <div class="flex flex-col gap-1"><span class="text-sm font-semibold">Gambar QRIS</span><UiFileButton v-model="inv.qrisKey" folder="logo" label="Unggah QRIS" accept="image/png,image/jpeg" @uploaded="onQris" /></div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UiSelect v-model="inv.defaultDueDays" label="Jatuh tempo default" :options="[7, 14, 30].map(d => ({ value: d, label: `${d} hari setelah invoice` }))" />
            <UiSelect :model-value="inv.showTax ? 'ya' : 'tidak'" label="Pajak di invoice" :options="[{ value: 'tidak', label: 'Tidak ditampilkan' }, { value: 'ya', label: 'Tampilkan PPN' }]" @change="v => inv.showTax = v === 'ya'" />
            <label v-if="inv.showTax" class="field">Tarif pajak default (%)<input v-model.number="inv.defaultTaxPercent" type="number" min="0" max="100" class="input"></label>
          </div>
          <label class="field">Catatan kaki invoice<textarea v-model="inv.footer" rows="2" class="input" /></label>
          <div class="flex justify-end"><button type="button" class="btn-primary" @click="saveProfile">Simpan</button></div>
        </section>
      </template>

      <!-- Notifikasi -->
      <section v-if="sec === 'notif'" class="card-pad flex flex-col gap-4">
        <div class="flex flex-col gap-1"><h2 class="section-title">Notifikasi</h2><span class="text-sm text-muted">Pilih kejadian dan saluran pemberitahuan untuk akun Anda. Setiap pengguna mengatur sendiri di menu Akun.</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">Kejadian</th><th scope="col">Di aplikasi</th><th scope="col">Email</th><th scope="col">WhatsApp</th></tr></thead>
            <tbody>
              <tr v-for="n in NOTIF_EVENTS" :key="n.key">
                <td><div class="flex flex-col gap-0.5 whitespace-normal"><span class="font-semibold">{{ n.name }}</span><span class="text-xs text-muted">{{ n.desc }}</span></div></td>
                <td><input v-if="prefs[n.key]" v-model="prefs[n.key]!.app" type="checkbox" class="w-5 h-5 accent-brand-600" :aria-label="`${n.name} di aplikasi`"></td>
                <td><input v-if="prefs[n.key]" v-model="prefs[n.key]!.email" type="checkbox" class="w-5 h-5 accent-brand-600" :aria-label="`${n.name} lewat email`"></td>
                <td><input type="checkbox" disabled class="w-5 h-5" :aria-label="`${n.name} lewat WhatsApp (fase 2)`" title="Fase 2"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex justify-end"><button type="button" class="btn-primary" @click="savePrefs">Simpan</button></div>
      </section>

      <!-- Integrasi -->
      <section v-if="sec === 'integrations'" class="card-pad flex flex-col gap-4">
        <div class="flex flex-col gap-1"><h2 class="section-title">Integrasi</h2><span class="text-sm text-muted">Hubungkan layanan untuk pengingat, penyimpanan dokumen, dan notifikasi. Tersedia di fase 2.</span></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <article v-for="g in INTEGRATIONS" :key="g.name" class="rounded-xl border border-line-2 p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between"><span class="w-11 h-11 rounded-[10px] flex items-center justify-center font-bold" :style="{ background: g.bg, color: g.fg }">{{ g.name[0] }}</span><span class="badge bg-soft-2 text-muted">Fase 2</span></div>
            <div class="flex flex-col gap-0.5"><span class="font-semibold">{{ g.name }}</span><span class="text-sm text-muted">{{ g.desc }}</span></div>
            <button type="button" class="btn-secondary btn-sm self-start" disabled>Segera hadir</button>
          </article>
        </div>
      </section>
    </div>
  </div>

  <UiModal :open="bankOpen" :title="bankEdit ? 'Ubah Rekening' : 'Tambah Rekening'" width="480px" @close="bankOpen = false">
    <label class="field">Bank<input v-model="bank.bankName" class="input" placeholder="Mis. BCA"></label>
    <label class="field">Nomor rekening<input v-model="bank.accountNumber" class="input" inputmode="numeric"></label>
    <label class="field">Atas nama<input v-model="bank.accountName" class="input"></label>
    <label class="flex items-center gap-2 text-sm min-h-11"><input v-model="bank.isDefault" type="checkbox" class="w-[18px] h-[18px] accent-brand-600">Jadikan rekening utama</label>
    <label class="flex items-center gap-2 text-sm min-h-11"><input v-model="bank.active" type="checkbox" class="w-[18px] h-[18px] accent-brand-600">Aktif</label>
    <template #footer>
      <button v-if="bankEdit" type="button" class="btn-ghost text-danger-700 mr-auto" @click="delBank">Hapus</button>
      <button type="button" class="btn-secondary" @click="bankOpen = false">Batal</button>
      <button type="button" class="btn-primary" @click="saveBank">Simpan</button>
    </template>
  </UiModal>
  <UiModal :open="!!editRole && !!draft" :title="editRole ? `Hak Akses ${ROLE_LABEL[editRole]}` : ''" description="Nyalakan level yang diizinkan. Level lebih tinggi otomatis menyalakan level di bawahnya." width="760px" @close="closeAccess">
    <template v-if="draft && editRole">
      <div class="flex flex-col gap-2">
        <span id="scope-label" class="text-sm font-semibold text-ink-2">Cakupan proyek</span>
        <div role="radiogroup" aria-labelledby="scope-label" class="pill-tabs self-start">
          <button v-for="s in PROJECT_SCOPES" :key="s.value" type="button" role="radio" class="pill-tab" :aria-checked="draft.scope === s.value" :aria-pressed="draft.scope === s.value" :title="s.desc" @click="draft.scope = s.value">{{ s.label }}</button>
        </div>
        <span class="text-xs text-muted">{{ PROJECT_SCOPES.find(s => s.value === draft!.scope)?.desc }} — berlaku untuk semua modul.</span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <fieldset v-for="m in MODULE_KEYS" :key="m" class="m-0 rounded-xl border border-line-2 px-4 py-3 flex flex-col">
          <legend class="sr-only">{{ ACCESS_MODULES[m].label }}</legend>
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-sm font-bold">{{ ACCESS_MODULES[m].label }}</span>
            <span class="text-[11px] font-semibold rounded-md px-2 py-0.5" :class="draft[m] === 'tidak' ? 'bg-soft-2 text-muted' : 'bg-brand-50 text-brand-700'">{{ accessLabel(m, draft[m]) }}</span>
          </div>
          <template v-for="(lv, idx) in ACCESS_MODULES[m].levels" :key="lv.value">
            <UiToggle v-if="idx > 0" :model-value="isOn(m, idx)" :label="lv.label" :desc="LEVEL_DESC[`${m}.${lv.value}`]" @update:model-value="v => setLevel(m, idx, v)" />
          </template>
        </fieldset>
      </div>
      <p v-if="draft.pengaturan === 'kelola'" role="alert" class="m-0 text-sm text-warning-700 bg-warning-50 rounded-lg px-3 py-2">Peran ini bisa mengubah profil usaha, skema bagi hasil, dan rekening untuk semua proyek.</p>
    </template>
    <template #footer>
      <button type="button" class="btn-ghost mr-auto" @click="resetDraft">Kembalikan ke default PRD</button>
      <button type="button" class="btn-secondary" @click="closeAccess">Batal</button>
      <button type="button" class="btn-primary" :disabled="!dialogDirty || savingAccess" @click="saveAccess">{{ savingAccess ? 'Menyimpan…' : 'Simpan' }}</button>
    </template>
  </UiModal>
  <UiModal :open="!!pwdUser" :title="`Ubah Kata Sandi ${pwdUser?.name ?? ''}`" description="Atur kata sandi baru untuk pengguna ini, lalu sampaikan secara langsung (bukan lewat chat grup)." width="460px" @close="pwdUser = null">
    <p v-if="pwdErr" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ pwdErr }}</p>
    <label class="field">Kata sandi baru
      <input v-model="pwd.password" :type="pwd.show ? 'text' : 'password'" class="input" autocomplete="new-password" minlength="8">
      <span class="hint">Minimal 8 karakter.</span>
    </label>
    <label class="field">Ulangi kata sandi baru
      <input v-model="pwd.confirm" :type="pwd.show ? 'text' : 'password'" class="input" autocomplete="new-password" @keydown.enter="savePwd">
    </label>
    <label class="flex items-center gap-2 text-sm min-h-11 cursor-pointer"><input v-model="pwd.show" type="checkbox" class="w-[18px] h-[18px] accent-brand-600">Tampilkan kata sandi</label>
    <UiToggle v-model="pwd.logoutAll" label="Keluarkan dari semua perangkat" desc="Sesi yang sedang login harus masuk ulang dengan sandi baru." />
    <p v-if="pwdUser?.status === 'diundang'" class="m-0 text-xs text-muted">Pengguna ini belum menerima undangan; menyimpan sandi akan langsung mengaktifkan akunnya.</p>
    <template #footer>
      <button type="button" class="btn-secondary" @click="pwdUser = null">Batal</button>
      <button type="button" class="btn-primary" :disabled="savingPwd" @click="savePwd">{{ savingPwd ? 'Menyimpan…' : 'Simpan Kata Sandi' }}</button>
    </template>
  </UiModal>
</template>
