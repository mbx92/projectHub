/** Label & warna status yang dipakai bersama di UI dan PDF. */
export type Role = 'admin' | 'investor' | 'developer'
export type ProjectStatus = 'persiapan' | 'berjalan' | 'tertunda' | 'selesai'
export type TermStatus = 'terjadwal' | 'draf' | 'terkirim' | 'lunas'
export type TermDisplayStatus = TermStatus | 'terlambat'
export type BugSeverity = 'kritis' | 'tinggi' | 'sedang' | 'rendah'
export type BugStatus = 'open' | 'dikerjakan' | 'review' | 'selesai'

export interface Tone { label: string, fg: string, bg: string }

export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', investor: 'Investor', developer: 'Developer' }

export const PROJECT_STATUS: Record<ProjectStatus, Tone & { desc: string, dot: string }> = {
  persiapan: { label: 'Persiapan', fg: '#B54708', bg: '#FEF0C7', dot: '#B54708', desc: 'Belum mulai dikerjakan' },
  berjalan: { label: 'Berjalan', fg: '#175CD3', bg: '#E8F0FE', dot: '#175CD3', desc: 'Sedang dikerjakan tim' },
  tertunda: { label: 'Tertunda', fg: '#B42318', bg: '#FEE4E2', dot: '#B42318', desc: 'Menunggu klien' },
  selesai: { label: 'Selesai', fg: '#067647', bg: '#DCFAE6', dot: '#0B6E63', desc: 'Sudah serah terima' },
}

export const TERM_STATUS: Record<TermDisplayStatus, Tone> = {
  terjadwal: { label: 'Terjadwal', fg: '#344054', bg: '#F2F4F7' },
  draf: { label: 'Draf invoice', fg: '#5925DC', bg: '#F4F3FF' },
  terkirim: { label: 'Terkirim', fg: '#175CD3', bg: '#E8F0FE' },
  lunas: { label: 'Lunas', fg: '#067647', bg: '#DCFAE6' },
  terlambat: { label: 'Terlambat', fg: '#B42318', bg: '#FEE4E2' },
}

export const INVOICE_STATUS: Record<'draf' | 'terkirim' | 'lunas' | 'batal' | 'terlambat', Tone> = {
  draf: { label: 'Draf', fg: '#5925DC', bg: '#F4F3FF' },
  terkirim: { label: 'Terkirim', fg: '#175CD3', bg: '#E8F0FE' },
  lunas: { label: 'Lunas', fg: '#067647', bg: '#DCFAE6' },
  batal: { label: 'Batal', fg: '#475467', bg: '#F2F4F7' },
  terlambat: { label: 'Terlambat', fg: '#B42318', bg: '#FEE4E2' },
}

export const BUG_SEVERITY: Record<BugSeverity, Tone & { order: number }> = {
  kritis: { label: 'Kritis', fg: '#B42318', bg: '#FEE4E2', order: 0 },
  tinggi: { label: 'Tinggi', fg: '#B54708', bg: '#FEF0C7', order: 1 },
  sedang: { label: 'Sedang', fg: '#175CD3', bg: '#E8F0FE', order: 2 },
  rendah: { label: 'Rendah', fg: '#344054', bg: '#F2F4F7', order: 3 },
}

export const BUG_STATUS: Record<BugStatus, Tone> = {
  open: { label: 'Open', fg: '#B42318', bg: '#FEE4E2' },
  dikerjakan: { label: 'Dikerjakan', fg: '#175CD3', bg: '#E8F0FE' },
  review: { label: 'Review', fg: '#B54708', bg: '#FEF0C7' },
  selesai: { label: 'Selesai', fg: '#067647', bg: '#DCFAE6' },
}

export const MILESTONE_STATUS: Record<'belum' | 'berjalan' | 'selesai', Tone> = {
  belum: { label: 'Belum', fg: '#344054', bg: '#F2F4F7' },
  berjalan: { label: 'Berjalan', fg: '#175CD3', bg: '#E8F0FE' },
  selesai: { label: 'Selesai', fg: '#067647', bg: '#DCFAE6' },
}

export const PAYMENT_METHODS = ['Transfer bank', 'QRIS', 'Tunai'] as const

export const SHARE_PART_LABEL: Record<'modal' | 'pekerja' | 'kas', string> = { modal: 'Modal', pekerja: 'Pekerja', kas: 'Kas OCN' }

/** Status termin yang ditampilkan: termin terkirim yang lewat jatuh tempo = Terlambat. */
export function termDisplayStatus(status: TermStatus, dueDate: string | null, today: string): TermDisplayStatus {
  if (status === 'terkirim' && dueDate && dueDate < today) return 'terlambat'
  return status
}
