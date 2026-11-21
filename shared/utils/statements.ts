/** Baris laporan keuangan (dipakai bersama oleh halaman Laporan, PDF, dan Excel). */
export type StatementRowKind = 'section' | 'line' | 'subtotal' | 'total' | 'grand' | 'note' | 'spacer'

export interface StatementRow {
  label: string
  amount?: number | null
  kind: StatementRowKind
  /** Level indentasi 0–3. */
  indent?: number
}

export interface Statement {
  key: string
  title: string
  subtitle: string
  rows: StatementRow[]
  /** Catatan di bawah laporan (mis. dasar penyusunan). */
  notes?: string[]
  /** Pemeriksaan keseimbangan (Neraca / Arus Kas). */
  check?: { ok: boolean, label: string, diff: number }
}

export const CASHBOOK_LABEL: Record<string, string> = {
  payment: 'Pembayaran klien', expense: 'Pengeluaran', capital_deposit: 'Setoran modal', distribution: 'Distribusi bagi hasil', saldo_awal: 'Saldo awal',
}

/** Format akuntansi: negatif dalam kurung, nol sebagai "–". */
export function rupiahAcc(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  const v = Math.round(n)
  if (v === 0) return '–'
  const s = `Rp ${numberId(Math.abs(v))}`
  return v < 0 ? `(${s})` : s
}
