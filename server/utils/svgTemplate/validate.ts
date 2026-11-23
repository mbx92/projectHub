import type { TemplateKind, TemplatePageKey } from '../../../shared/utils/settings'
import { isiBox } from './box'
import { capacity, rowInfo } from './repeat'
import { placeholdersIn } from './text'
import { TemplateError } from './types'
import { parseSvg, walk } from './xml'
import { parseStyle } from './fonts'

export interface Validation { errors: string[], warnings: string[] }

export const PAGE_W = 595
export const PAGE_H = 842

const COMMON = ['usaha.nama', 'usaha.alamat', 'usaha.kontak', 'usaha.npwp', 'penandatangan.nama', 'penandatangan.jabatan', 'tanggal_cetak', 'halaman', 'logo', 'ttd', 'qris']
const KNOWN: Record<TemplateKind, string[]> = {
  invoice: [...COMMON, 'nomor', 'status', 'terbit', 'jatuh_tempo', 'klien.nama', 'klien.kontak', 'klien.alamat', 'proyek.nama', 'termin.nama', 'subtotal', 'diskon', 'pajak', 'pajak_persen', 'total', 'dibayar', 'sisa', 'bank.nama', 'bank.nomor', 'bank.atas_nama', 'catatan', 'catatan_kaki', 'item.no', 'item.deskripsi', 'item.qty', 'item.harga', 'item.jumlah'],
  kuitansi: [...COMMON, 'nomor', 'invoice.nomor', 'klien.nama', 'nominal', 'terbilang', 'untuk', 'tanggal', 'metode', 'status_invoice', 'tempat_tanggal'],
  dokumen: [...COMMON, 'judul', 'nomor', 'proyek.nama', 'klien.nama', 'tanggal', 'footer', 'isi'],
}
const REQUIRED: Record<TemplateKind, string[]> = {
  invoice: ['nomor', 'total', 'item.deskripsi', 'item.jumlah', 'halaman'],
  kuitansi: ['nomor', 'nominal'],
  dokumen: ['isi'],
}

/** Validasi paket template (murni, tanpa I/O). Error memblokir aktivasi; peringatan tidak. */
export function validateTemplate(kind: TemplateKind, pages: Partial<Record<TemplatePageKey, string>>): Validation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!pages['halaman-1']) errors.push('Artboard halaman-1 belum diunggah.')
  if (kind === 'invoice' && !pages['halaman-lanjutan']) errors.push('Invoice wajib memiliki artboard halaman-lanjutan (untuk invoice dengan banyak item).')

  const keys = new Set<string>()
  const fonts = new Set<string>()
  const parsed: [TemplatePageKey, string][] = []
  for (const [page, svg] of Object.entries(pages) as [TemplatePageKey, string][]) {
    if (!svg) continue
    let root
    try { root = parseSvg(svg) } catch (e) {
      errors.push(`${page}: ${e instanceof TemplateError ? e.message : 'SVG tidak valid.'}`)
      continue
    }
    parsed.push([page, svg])
    const w = Number(root.attr.width), h = Number(root.attr.height)
    if (Math.abs(w - PAGE_W) > 1 || Math.abs(h - PAGE_H) > 1) errors.push(`${page}: ukuran harus ${PAGE_W} × ${PAGE_H} (A4), terbaca ${w || '?'} × ${h || '?'}.`)
    for (const k of placeholdersIn(svg)) keys.add(k.replace(/^\?/, ''))
    walk(root, (n) => {
      if (n.name !== 'text') return
      const fam = (parseStyle(n.attr.style).get('font-family') ?? '').replace(/["']/g, '').trim()
      if (fam && !/plus\s*jakarta\s*sans/i.test(fam)) fonts.add(fam)
    })
  }

  for (const req of REQUIRED[kind]) if (!keys.has(req)) errors.push(`Penanda {{${req}}} tidak ditemukan di template.`)
  for (const k of keys) if (!KNOWN[kind].includes(k)) warnings.push(`Penanda {{${k}}} tidak dikenal dan akan dikosongkan.`)
  for (const f of fonts) warnings.push(`Font "${f}" tidak tersedia di server; dipakai Plus Jakarta Sans.`)

  if (kind === 'invoice') {
    for (const [page, svg] of parsed) {
      const info = rowInfo(svg)
      if (info && capacity(info, false) < 1) errors.push(`${page}: baris item tidak muat di halaman (kapasitas 0) — footer terlalu dekat dengan baris.`)
    }
  }
  if (kind === 'dokumen') {
    const boxes = parsed.map(([page, svg]) => [page, isiBox(parseSvg(svg))] as const)
    for (const [page, b] of boxes) if (!b) errors.push(`${page}: kotak teks {{isi}} tidak ditemukan.`)
    const [a, b] = [boxes.find(x => x[0] === 'halaman-1')?.[1], boxes.find(x => x[0] === 'halaman-lanjutan')?.[1]]
    if (a && b && (['x', 'y', 'width', 'height'] as const).some(k => Math.abs(a[k] - b[k]) > 1)) errors.push('Kotak {{isi}} pada halaman-1 dan halaman-lanjutan harus berukuran dan berposisi sama.')
  }
  return { errors: [...new Set(errors)], warnings }
}
