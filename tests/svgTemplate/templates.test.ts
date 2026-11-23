import { beforeAll, describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { XmlDocument } from 'xmldoc'
import { renderTemplatePages } from '../../server/utils/svgTemplate/repeat'
import { validateTemplate } from '../../server/utils/svgTemplate/validate'
import { ensureTemplateFonts, pdfMeasure, svgPagesToPdf } from '../../server/utils/templatePdf'

/** Template contoh hasil ekspor Penpot di docs/templates — harus selalu valid dan bisa dirender. */
const read = (f: string) => readFileSync(new URL(`../../docs/templates/${f}`, import.meta.url), 'utf8')
const texts = (s: string): string[] => {
  const out: string[] = []
  const textOf = (n: any): string => (n.children ?? []).map((c: any) => c.text ?? textOf(c)).join('')
  const walk = (n: any) => { for (const c of n.children ?? []) { if (c.name === 'text') out.push(textOf(c)); if (c.children) walk(c) } }
  walk(new XmlDocument(s))
  return out
}
const item = (i: number) => ({ 'item.no': String(i), 'item.deskripsi': `Item ${i}`, 'item.qty': '1', 'item.harga': 'Rp 1', 'item.jumlah': 'Rp 1' })

beforeAll(async () => { await ensureTemplateFonts() })

describe('docs/templates — invoice', () => {
  const pages = { first: read('invoice-halaman-1.svg'), next: read('invoice-lanjutan.svg') }

  it('is a valid invoice template without warnings', () => {
    expect(validateTemplate('invoice', { 'halaman-1': pages.first, 'halaman-lanjutan': pages.next })).toEqual({ errors: [], warnings: [] })
  })

  it('hides empty discount/tax/paid blocks and keeps total', () => {
    const [p] = renderTemplatePages(pages, { values: { total: 'Rp 5', diskon: '', pajak: '', dibayar: '', sisa: 'Rp 5' }, items: [item(1)], measure: pdfMeasure })
    const t = texts(p!)
    expect(t).not.toContain('Diskon')
    expect(t).not.toContain('Pajak')
    expect(t).not.toContain('Sudah dibayar')
    expect(t).not.toContain('Sisa tagihan')
    expect(t).toContain('Rp 5')
  })

  it('shows discount, tax and paid blocks when they have values', () => {
    const [p] = renderTemplatePages(pages, { values: { total: 'Rp 5', diskon: '− Rp 1', pajak: 'Rp 2', dibayar: 'Rp 3', sisa: 'Rp 4' }, items: [item(1)], measure: pdfMeasure })
    const t = texts(p!)
    for (const s of ['Diskon', '− Rp 1', 'Pajak', 'Rp 2', 'Sudah dibayar', 'Rp 3', 'Sisa tagihan', 'Rp 4']) expect(t).toContain(s)
  })

  it('paginates 120 items; the total block only appears on the last page', async () => {
    const out = renderTemplatePages(pages, { values: { total: 'Rp TOTAL', nomor: 'INV-1' }, items: Array.from({ length: 120 }, (_, i) => item(i + 1)), measure: pdfMeasure })
    expect(out.length).toBeGreaterThan(2)
    const all = out.map(texts)
    expect(all.flat().filter(s => /^Item \d+$/.test(s))).toHaveLength(120)
    expect(all.map(a => a.includes('Rp TOTAL'))).toEqual(out.map((_, i) => i === out.length - 1))
    const pdf = await svgPagesToPdf(out, 'uji')
    expect((pdf.toString('latin1').match(/\/Type \/Page(?![s\w])/g) ?? []).length).toBe(out.length)
  })

  it('keeps long item descriptions on one line with an ellipsis and never loses characters elsewhere', () => {
    const long = 'Deskripsi sangat panjang sekali untuk menguji pemotongan dengan elipsis pada kolom deskripsi invoice yang lebar tetap'
    const [p] = renderTemplatePages(pages, { values: { total: 'Rp 5', catatan: 'Mohon cantumkan nomor invoice saat transfer.' }, items: [{ ...item(1), 'item.deskripsi': long }], measure: pdfMeasure })
    const t = texts(p!)
    const cut = t.find(s => s.startsWith('Deskripsi sangat'))!
    expect(cut.endsWith('…')).toBe(true)
    expect(long.startsWith(cut.slice(0, -1).trimEnd())).toBe(true)
    expect(t.join('').replace(/\s+/g, '')).toContain('Mohoncantumkannomorinvoicesaattransfer.')
  })
})

describe.runIf(existsSync(new URL('../../docs/templates/kuitansi.svg', import.meta.url)))('docs/templates — kuitansi', () => {
  it('is valid and fills every field', () => {
    const svg = read('kuitansi.svg')
    expect(validateTemplate('kuitansi', { 'halaman-1': svg })).toEqual({ errors: [], warnings: [] })
    const [p] = renderTemplatePages({ first: svg }, { values: { nomor: 'KW-1', nominal: 'Rp 6.000.000', terbilang: 'Enam juta rupiah', 'klien.nama': 'CV Maju & Jaya' }, measure: pdfMeasure })
    const t = texts(p!)
    for (const s of ['KW-1', 'Rp 6.000.000', 'Enam juta rupiah', 'CV Maju & Jaya']) expect(t).toContain(s)
  })
})

describe.runIf(existsSync(new URL('../../docs/templates/dokumen-halaman-1.svg', import.meta.url)))('docs/templates — dokumen', () => {
  it('is a valid frame with equal {{isi}} boxes', () => {
    expect(validateTemplate('dokumen', { 'halaman-1': read('dokumen-halaman-1.svg'), 'halaman-lanjutan': read('dokumen-lanjutan.svg') })).toEqual({ errors: [], warnings: [] })
  })
})
