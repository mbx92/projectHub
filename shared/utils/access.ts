/**
 * Matriks hak akses per peran. Admin selalu punya akses penuh (tidak bisa diubah, agar tidak terkunci);
 * Investor dan Developer diatur di Pengaturan › Pengguna & Hak Akses. Level diurutkan dari terendah.
 */
export const ACCESS_MODULES = {
  proyek: {
    label: 'Proyek',
    desc: 'Daftar & detail proyek, milestone, progress',
    levels: [
      { value: 'tidak', label: 'Tidak ada' },
      { value: 'lihat', label: 'Lihat' },
      { value: 'kelola', label: 'Kelola' },
    ],
  },
  dokumen: {
    label: 'Tim & Dokumen',
    desc: 'Anggota tim dan dokumen proyek',
    levels: [
      { value: 'tidak', label: 'Tidak ada' },
      { value: 'lihat', label: 'Lihat' },
      { value: 'kelola', label: 'Kelola' },
    ],
  },
  keuangan: {
    label: 'Keuangan',
    desc: 'Termin, invoice, pembayaran, pengeluaran, kas',
    levels: [
      { value: 'tidak', label: 'Tidak ada' },
      { value: 'ringkasan', label: 'Ringkasan proyek' },
      { value: 'lihat', label: 'Lihat semua' },
      { value: 'kelola', label: 'Kelola' },
    ],
  },
  bug: {
    label: 'Bug',
    desc: 'Bug tracker, komentar, lampiran',
    levels: [
      { value: 'tidak', label: 'Tidak ada' },
      { value: 'lihat', label: 'Lihat' },
      { value: 'ditugaskan', label: 'Kelola yang ditugaskan' },
      { value: 'kelola', label: 'Kelola' },
    ],
  },
  investor: {
    label: 'Investor & Modal',
    desc: 'Setoran modal, porsi, distribusi bagi hasil',
    levels: [
      { value: 'tidak', label: 'Tidak ada' },
      { value: 'sendiri', label: 'Data sendiri' },
      { value: 'lihat', label: 'Lihat semua' },
      { value: 'kelola', label: 'Kelola' },
    ],
  },
  laporan: {
    label: 'Dashboard & Laporan',
    desc: 'Dashboard Investor, laporan, ekspor PDF/Excel',
    levels: [
      { value: 'tidak', label: 'Tidak ada' },
      { value: 'lihat', label: 'Lihat' },
    ],
  },
  pengaturan: {
    label: 'Pengaturan',
    desc: 'Profil usaha, skema bagi hasil, rekening (pengguna & hak akses tetap khusus admin)',
    levels: [
      { value: 'tidak', label: 'Tidak ada' },
      { value: 'kelola', label: 'Kelola' },
    ],
  },
} as const

export type AccessModule = keyof typeof ACCESS_MODULES
export type AccessLevel<M extends AccessModule> = (typeof ACCESS_MODULES)[M]['levels'][number]['value']
export type ProjectScope = 'semua' | 'ditugaskan' | 'didanai'

export const PROJECT_SCOPES: { value: ProjectScope, label: string, desc: string }[] = [
  { value: 'semua', label: 'Semua proyek', desc: 'Semua proyek yang tidak diarsipkan' },
  { value: 'ditugaskan', label: 'Yang ditugaskan', desc: 'Proyek tempat ia anggota tim atau penanggung jawab' },
  { value: 'didanai', label: 'Yang didanai', desc: 'Proyek dengan bagian modal investor > 0%' },
]

export type RoleAccess = { [M in AccessModule]: AccessLevel<M> } & { scope: ProjectScope }
export type AccessMatrix = Record<'investor' | 'developer', RoleAccess>

export const FULL_ACCESS: RoleAccess = {
  proyek: 'kelola', dokumen: 'kelola', keuangan: 'kelola', bug: 'kelola', investor: 'kelola', laporan: 'lihat', pengaturan: 'kelola', scope: 'semua',
}

/** Default = hak akses di PRD. */
export const DEFAULT_ACCESS: AccessMatrix = {
  investor: { proyek: 'lihat', dokumen: 'tidak', keuangan: 'ringkasan', bug: 'tidak', investor: 'sendiri', laporan: 'lihat', pengaturan: 'tidak', scope: 'didanai' },
  developer: { proyek: 'lihat', dokumen: 'kelola', keuangan: 'tidak', bug: 'ditugaskan', investor: 'tidak', laporan: 'tidak', pengaturan: 'tidak', scope: 'ditugaskan' },
}

export function accessFor(role: Role, matrix: AccessMatrix | null | undefined): RoleAccess {
  if (role === 'admin') return FULL_ACCESS
  return { ...DEFAULT_ACCESS[role], ...(matrix?.[role] ?? {}) }
}

/** true bila level akses `have` ≥ `need` pada modul tersebut. */
export function hasAccess<M extends AccessModule>(access: RoleAccess | null | undefined, module: M, need: AccessLevel<M>): boolean {
  if (!access) return false
  const levels = ACCESS_MODULES[module].levels.map(l => l.value as string)
  return levels.indexOf(access[module] as string) >= levels.indexOf(need as string)
}

export function accessLabel<M extends AccessModule>(module: M, level: AccessLevel<M>): string {
  return ACCESS_MODULES[module].levels.find(l => l.value === level)?.label ?? String(level)
}

/** Halaman awal sesuai hak akses. */
export function homePathFor(role: Role, access: RoleAccess): string {
  if (role === 'investor' && hasAccess(access, 'laporan', 'lihat')) return '/'
  if (role === 'developer') return '/developer'
  if (hasAccess(access, 'proyek', 'lihat')) return '/projects'
  if (hasAccess(access, 'laporan', 'lihat')) return '/'
  if (hasAccess(access, 'bug', 'lihat')) return '/bugs'
  return '/account'
}
