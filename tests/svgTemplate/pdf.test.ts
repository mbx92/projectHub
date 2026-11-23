import { beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { assertGlyphs, ensureTemplateFonts, framedDocPdf, pdfMeasure, renderWithFallback, svgPagesToPdf } from '../../server/utils/templatePdf'
import { renderTemplatePages } from '../../server/utils/svgTemplate/repeat'
import { TemplateError } from '../../server/utils/svgTemplate/types'

const fixture = readFileSync(new URL('../fixtures/invoice-p1.svg', import.meta.url), 'utf8')
const pageCount = (buf: Buffer) => (buf.toString('latin1').match(/\/Type \/Page(?![s\w])/g) ?? []).length

beforeAll(async () => { await ensureTemplateFonts() })

describe('pdfMeasure', () => {
  it('measures heavier weights wider', () => {
    expect(pdfMeasure('Rp 7.200.000', 'PJS-800', 12)).toBeGreaterThan(pdfMeasure('Rp 7.200.000', 'PJS-400', 12))
  })
  it('scales linearly with size', () => {
    expect(pdfMeasure('Halo', 'PJS-400', 20)).toBeCloseTo(pdfMeasure('Halo', 'PJS-400', 10) * 2, 5)
  })
})

describe('svgPagesToPdf', () => {
  it('renders one A4 page per svg', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ 'item.deskripsi': `Item ${i + 1}`, 'item.qty': '1', 'item.harga': 'Rp 1', 'item.jumlah': 'Rp 1' }))
    const svgs = renderTemplatePages({ first: fixture, next: fixture }, { values: { total: 'Rp 30', nomor: 'INV-1' }, items, measure: pdfMeasure })
    expect(svgs.length).toBeGreaterThan(1)
    const pdf = await svgPagesToPdf(svgs, 'uji')
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(pageCount(pdf)).toBe(svgs.length)
  })
})

describe('framedDocPdf', () => {
  const frame = (isi: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><g id="shape-root"><g id="shape-bg"><rect x="0" y="0" width="595" height="96" style="fill: rgb(15, 27, 45)"/></g>${isi}`
    + '<g id="shape-f"><g class="text-container" x="40" y="808" width="100" height="10"><g><text x="40" y="818" textLength="50" style="font-family: &quot;Plus Jakarta Sans&quot;; font-size: 8px;">{{halaman}}</text></g></g></g></g></svg>'
  const isi = '<g id="shape-isi"><g class="text-container" x="40" y="110" width="515" height="650"><g><text x="40" y="120" textLength="20">{{isi}}</text></g></g></g>'
  const para = (i: number) => ({ text: `Paragraf ${i}. ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(4)}`, margin: [0, 0, 0, 6] as [number, number, number, number] })

  it('flows long content across several framed pages', async () => {
    const body = Array.from({ length: 60 }, (_, i) => para(i + 1))
    const pdf = await framedDocPdf({ first: frame(isi), next: frame(isi) }, { judul: 'Kontrak' }, body, 'uji')
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(pageCount(pdf)).toBeGreaterThan(1)
  })

  it('rejects a frame without the {{isi}} box', async () => {
    await expect(framedDocPdf({ first: frame('') }, {}, [para(1)], 'uji')).rejects.toBeInstanceOf(TemplateError)
  })
})

describe('renderWithFallback', () => {
  it('falls back to built-in layout when the template throws, and logs it', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await renderWithFallback(async () => { throw new Error('boom') }, async () => 'bawaan', 'invoice INV-1')
    expect(out).toBe('bawaan')
    expect(err).toHaveBeenCalledWith(expect.stringContaining('invoice INV-1'), expect.any(Error))
    err.mockRestore()
  })
  it('returns the template result without touching the fallback when it succeeds', async () => {
    let called = false
    const out = await renderWithFallback(async () => 'template', async () => { called = true; return 'bawaan' }, 'x')
    expect(out).toBe('template')
    expect(called).toBe(false)
  })
})

describe('framedDocPdf — bold content', () => {
  const frame = '<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><g id="shape-root"><g id="shape-i"><g class="text-container" x="40" y="100" width="515" height="650"><g><text x="40" y="110" textLength="20">{{isi}}</text></g></g></g></g></svg>'
  const fontNames = (b: Buffer) => [...b.toString('latin1').matchAll(/\/BaseFont \/[A-Z]{6}\+([\w-]+)/g)].map(m => m[1]!)

  it('embeds the bold weight when content is bold', async () => {
    const plain = await framedDocPdf({ first: frame }, {}, [{ text: 'Judul' }], 'uji')
    const bold = await framedDocPdf({ first: frame }, {}, [{ text: 'Judul', bold: true }], 'uji')
    expect(new Set(fontNames(plain)).size).toBe(new Set(fontNames(bold)).size)
    expect(fontNames(bold).join(' ')).not.toBe(fontNames(plain).join(' '))
  })
})

describe('glyph guard (bundled font is Latin only)', () => {
  const page = (txt: string) => '<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><text x="0" y="10" style="font-family: PJS-400; font-size: 9px">' + txt + '</text></svg>'
  it('accepts Indonesian text, money and the punctuation the templates use', () => {
    expect(() => assertGlyphs(['Halo — Rp 1.000.000 · − Rp 5 … "kutip" (ok) 100%'])).not.toThrow()
  })
  it('rejects characters the font cannot draw so the caller falls back to the built-in layout', () => {
    expect(() => assertGlyphs(['Syarat ≥ 3 hari'])).toThrowError(expect.objectContaining({ code: 'unsupported_glyph' }))
  })
  it('svgPagesToPdf refuses pages with unsupported characters', async () => {
    await expect(svgPagesToPdf([page('Žofia')], 'uji')).rejects.toBeInstanceOf(TemplateError)
  })
  it('framedDocPdf refuses document bodies with unsupported characters', async () => {
    const frame = '<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><g id="shape-root"><g id="shape-i"><g class="text-container" x="40" y="100" width="515" height="650"><g><text x="40" y="110" textLength="20">{{isi}}</text></g></g></g></g></svg>'
    await expect(framedDocPdf({ first: frame }, {}, [{ text: 'Waktu ≥ 3 hari' }], 'uji')).rejects.toBeInstanceOf(TemplateError)
  })
})
