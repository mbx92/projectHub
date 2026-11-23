import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateTemplate } from '../../server/utils/svgTemplate/validate'

const fixture = readFileSync(new URL('../fixtures/invoice-p1.svg', import.meta.url), 'utf8')
const text = (id: string, x: number, y: number, w: number, h: number, body: string, font = '&quot;Plus Jakarta Sans&quot;') =>
  `<g id="shape-${id}"><g class="text-container" x="${x}" y="${y}" width="${w}" height="${h}"><g><text x="${x}" y="${y + h}" textLength="30" style="font-family: ${font}; font-size: 9px">${body}</text></g></g></g>`
const svg = (inner: string, size = 'width="595" height="842"') => `<svg xmlns="http://www.w3.org/2000/svg" ${size}><g id="shape-root">${inner}</g></svg>`

describe('validateTemplate — invoice', () => {
  it('accepts the Penpot fixture used for both pages', () => {
    const r = validateTemplate('invoice', { 'halaman-1': fixture, 'halaman-lanjutan': fixture })
    expect(r.errors).toEqual([])
  })
  it('rejects invoice template without continuation page', () => {
    const r = validateTemplate('invoice', { 'halaman-1': fixture })
    expect(r.errors.join(' ')).toContain('halaman-lanjutan')
  })
  it('rejects wrong size', () => {
    const r = validateTemplate('invoice', { 'halaman-1': svg(text('a', 0, 0, 50, 10, '{{nomor}}'), 'width="600" height="800"'), 'halaman-lanjutan': fixture })
    expect(r.errors.join(' ')).toMatch(/595.*842/)
  })
  it('rejects missing total', () => {
    const noTotal = fixture.replace(/\{\{total\}\}/g, 'TOTAL')
    const r = validateTemplate('invoice', { 'halaman-1': noTotal, 'halaman-lanjutan': noTotal })
    expect(r.errors.join(' ')).toContain('{{total}}')
  })
  it('rejects a row that cannot fit above the footer', () => {
    const bad = svg('<g id="shape-row"><rect x="0" y="100" width="500" height="50"/><g class="text-container" x="0" y="100" width="100" height="10"><g><text x="0" y="110">{{item.deskripsi}} {{item.jumlah}} {{nomor}} {{total}}</text></g></g></g>'
      + '<g id="shape-foot"><rect x="0" y="120" width="500" height="20"/><g class="text-container" x="0" y="120" width="100" height="10"><g><text x="0" y="130">{{halaman}}</text></g></g></g>')
    const r = validateTemplate('invoice', { 'halaman-1': bad, 'halaman-lanjutan': bad })
    expect(r.errors.join(' ')).toMatch(/tidak muat|kapasitas/i)
  })
  it('warns about unknown placeholders and non-Plus-Jakarta fonts', () => {
    const odd = fixture.replace('{{catatan}}', '{{foo}}').replace(/Plus Jakarta Sans/, 'Comic Sans')
    const r = validateTemplate('invoice', { 'halaman-1': odd, 'halaman-lanjutan': fixture })
    expect(r.errors).toEqual([])
    expect(r.warnings.join(' ')).toContain('{{foo}}')
    expect(r.warnings.join(' ')).toContain('Comic Sans')
  })
})

describe('validateTemplate — kuitansi & dokumen', () => {
  it('kuitansi needs nomor and nominal', () => {
    const ok = svg(text('a', 0, 0, 50, 10, '{{nomor}}') + text('b', 0, 20, 50, 10, '{{nominal}}'))
    expect(validateTemplate('kuitansi', { 'halaman-1': ok }).errors).toEqual([])
    const bad = svg(text('a', 0, 0, 50, 10, '{{nomor}}'))
    expect(validateTemplate('kuitansi', { 'halaman-1': bad }).errors.join(' ')).toContain('{{nominal}}')
  })
  it('dokumen needs the {{isi}} box and equal boxes on both pages', () => {
    const p1 = svg(text('i', 40, 110, 515, 650, '{{isi}}'))
    const same = svg(text('i', 40, 110, 515, 650, '{{isi}}'))
    const shifted = svg(text('i', 40, 140, 515, 620, '{{isi}}'))
    expect(validateTemplate('dokumen', { 'halaman-1': p1, 'halaman-lanjutan': same }).errors).toEqual([])
    expect(validateTemplate('dokumen', { 'halaman-1': svg(text('a', 0, 0, 50, 10, 'x')) }).errors.join(' ')).toContain('{{isi}}')
    expect(validateTemplate('dokumen', { 'halaman-1': p1, 'halaman-lanjutan': shifted }).errors.join(' ')).toMatch(/kotak.*isi|{{isi}}/)
  })
  it('reports invalid svg instead of throwing', () => {
    const r = validateTemplate('kuitansi', { 'halaman-1': 'bukan svg' })
    expect(r.errors.length).toBeGreaterThan(0)
  })
})

describe('validateTemplate — review fixes', () => {
  const row = '<g id="shape-row"><rect x="0" y="100" width="500" height="28"/><g class="text-container" x="0" y="100" width="100" height="10"><g><text x="0" y="110">{{item.deskripsi}} {{item.jumlah}}</text></g></g></g>'
  const foot = '<g id="shape-foot"><rect x="0" y="800" width="500" height="20"/><g class="text-container" x="0" y="800" width="100" height="10"><g><text x="0" y="810">{{halaman}}</text></g></g></g>'
  const tot = '<g id="shape-tot"><rect x="0" y="140" width="500" height="40"/><g class="text-container" x="0" y="140" width="100" height="10"><g><text x="0" y="150">{{total}} {{nomor}}</text></g></g></g>'

  it('requires the row, total and {{halaman}} on EVERY invoice page, not just in the union', () => {
    const good = svg(row + tot + foot)
    const noRow = svg(tot + foot)
    const noTotal = svg(row + foot)
    const noFooter = svg(row + tot)
    expect(validateTemplate('invoice', { 'halaman-1': good, 'halaman-lanjutan': good }).errors).toEqual([])
    expect(validateTemplate('invoice', { 'halaman-1': good, 'halaman-lanjutan': noRow }).errors.join(' ')).toMatch(/halaman-lanjutan.*item/)
    expect(validateTemplate('invoice', { 'halaman-1': good, 'halaman-lanjutan': noTotal }).errors.join(' ')).toMatch(/halaman-lanjutan.*total/)
    expect(validateTemplate('invoice', { 'halaman-1': good, 'halaman-lanjutan': noFooter }).errors.join(' ')).toMatch(/halaman-lanjutan.*halaman/)
  })

  it('rejects a page whose total block leaves no room for a single row on the last page', () => {
    const bigBottom = svg(row + '<g id="shape-tot"><rect x="0" y="140" width="500" height="680"/><g class="text-container" x="0" y="140" width="100" height="10"><g><text x="0" y="150">{{total}} {{nomor}}</text></g></g></g>' + foot)
    const r = validateTemplate('invoice', { 'halaman-1': bigBottom, 'halaman-lanjutan': bigBottom })
    expect(r.errors.join(' ')).toMatch(/halaman terakhir|blok bawah/i)
  })

  it('errors on split or incomplete placeholders instead of printing them raw', () => {
    const split = svg(text('a', 0, 0, 80, 10, '{{klien.') + text('b', 0, 20, 80, 10, 'nama}}') + text('c', 0, 40, 80, 10, '{{nominal}}') + text('d', 0, 60, 80, 10, '{{nomor}}'))
    const r = validateTemplate('kuitansi', { 'halaman-1': split })
    expect(r.errors.join(' ')).toMatch(/terpecah|tidak lengkap/)
    const spaced = svg(text('a', 0, 0, 80, 10, '{ {total} }') + text('c', 0, 40, 80, 10, '{{nominal}}') + text('d', 0, 60, 80, 10, '{{nomor}}'))
    expect(validateTemplate('kuitansi', { 'halaman-1': spaced }).errors.join(' ')).toMatch(/terpecah|tidak lengkap/)
  })
})
