import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { XmlDocument } from 'xmldoc'
import { fillSinglePage, placeholdersIn } from '../../server/utils/svgTemplate/text'
import { sanitizeSvg } from '../../server/utils/svgTemplate/sanitize'
import { TemplateError } from '../../server/utils/svgTemplate/types'

const measure = (t: string, _f: string, s: number) => t.length * s * 0.5
const fixture = readFileSync(new URL('../fixtures/invoice-p1.svg', import.meta.url), 'utf8')

/** SVG kecil gaya ekspor Penpot: <g shape><g text-container><g><text>. */
const box = (id: string, x: number, y: number, w: number, h: number, text: string, extra = '') =>
  `<g id="shape-${id}"><g class="text-container" x="${x}" y="${y}" width="${w}" height="${h}"><g><text x="${x}" y="${y + h}" textLength="40" lengthAdjust="spacingAndGlyphs" ${extra}>${text}</text></g></g></g>`
const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842"><g id="shape-root">${inner}</g></svg>`
const texts = (s: string) => {
  const out: XmlDocument[] = []
  const walk = (n: any) => { for (const c of n.children ?? []) { if (c.name === 'text') out.push(c); if (c.children) walk(c) } }
  walk(new XmlDocument(s))
  return out as any[]
}
const textOf = (t: any) => (t.children ?? []).map((c: any) => c.text ?? textOf(c)).join('')

describe('fillSinglePage', () => {
  it('strips textLength and keeps right alignment', () => {
    const out = fillSinglePage(fixture, { values: { total: 'Rp 7.200.000' }, measure })
    expect(out).not.toContain('textLength')
    const t = texts(out).find(x => textOf(x) === 'Rp 7.200.000')!
    expect(t.attr['text-anchor']).toBe('end')
    expect(Number(t.attr.x)).toBeCloseTo(403 + 140, 0)
  })

  it('fills plain placeholders and blanks unknown keys', () => {
    const out = fillSinglePage(svg(box('a', 10, 10, 100, 12, 'Klien {{klien.nama}}{{foo}}')), { values: { 'klien.nama': '54DM Cafe' }, measure })
    expect(textOf(texts(out)[0])).toBe('Klien 54DM Cafe')
  })

  it('escapes xml characters in values', () => {
    const out = fillSinglePage(svg(box('a', 10, 10, 300, 12, '{{klien.nama}}')), { values: { 'klien.nama': 'CV Maju & Jaya <Bali>' }, measure })
    expect(textOf(texts(out)[0])).toBe('CV Maju & Jaya <Bali>')
  })

  it('merges split placeholder spans', () => {
    const s = svg('<g id="shape-a"><g class="text-container" x="10" y="10" width="100" height="12"><g><text x="10" y="22" textLength="50"><tspan>{{to</tspan><tspan>tal}}</tspan></text></g></g></g>')
    const out = fillSinglePage(s, { values: { total: 'Rp 1' }, measure })
    expect(textOf(texts(out)[0])).toBe('Rp 1')
  })

  it('hides smallest board for empty ?placeholder and keeps it when set', () => {
    const board = (inner: string) => `<g id="shape-board"><g class="frame-container-wrapper"><g><rect x="0" y="0" width="100" height="20"/>${inner}</g></g></g>`
    const s = svg(box('keep', 0, 0, 50, 10, 'Tetap') + board(box('lbl', 0, 30, 50, 10, 'Diskon') + box('val', 60, 30, 40, 10, '{{?diskon}}')))
    const hidden = fillSinglePage(s, { values: { diskon: '' }, measure })
    expect(texts(hidden).map(textOf)).toEqual(['Tetap'])
    const shown = fillSinglePage(s, { values: { diskon: 'Rp 1' }, measure })
    expect(texts(shown).map(textOf)).toEqual(['Tetap', 'Diskon', 'Rp 1'])
  })

  it('replaces image box with <image> of the same size', () => {
    const out = fillSinglePage(svg(box('logo', 40, 28, 40, 40, '{{logo}}')), { values: {}, images: { logo: 'data:image/png;base64,AAA' }, measure })
    const doc = new XmlDocument(out)
    const img = (function find(n: any): any { for (const c of n.children ?? []) { if (c.name === 'image') return c; const r = c.children && find(c); if (r) return r } })(doc)
    expect(img.attr).toMatchObject({ href: 'data:image/png;base64,AAA', x: '40', y: '28', width: '40', height: '40' })
    expect(texts(out)).toHaveLength(0)
  })

  it('blanks image box when image missing', () => {
    const out = fillSinglePage(svg(box('logo', 40, 28, 40, 40, '{{logo}}')), { values: {}, images: { logo: null }, measure })
    expect(out).not.toContain('<image')
    expect(texts(out)).toHaveLength(0)
  })
})

describe('placeholdersIn', () => {
  it('lists unique keys with prefixes', () => {
    const s = svg(box('a', 0, 0, 50, 10, '{{nomor}} {{?diskon}}') + box('b', 0, 20, 50, 10, '{{item.qty}} {{nomor}}'))
    expect(placeholdersIn(s).sort()).toEqual(['?diskon', 'item.qty', 'nomor'])
  })
})

describe('sanitizeSvg', () => {
  const wrap = (inner: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="595" height="842" ${attrs}>${inner}</svg>`
  it('removes scripts, event handlers, foreignObject, external hrefs; keeps #id and data:', () => {
    const out = sanitizeSvg(wrap('<script>alert(1)</script><foreignObject><div/></foreignObject><rect onclick="x()" width="1" height="1"/><use href="#a"/><image href="data:image/png;base64,AA"/><image xlink:href="https://evil/x.png"/><style>@font-face{src:url(https://x)}</style>', 'onload="x()"'))
    expect(out).not.toMatch(/script|foreignObject|onclick|onload|evil|font-face/)
    expect(out).toContain('href="#a"')
    expect(out).toContain('data:image/png;base64,AA')
  })
  it('rejects oversize and non-svg input', () => {
    expect(() => sanitizeSvg(wrap('x'.repeat(2 * 1024 * 1024 + 1)))).toThrowError(expect.objectContaining({ code: 'too_large' }))
    expect(() => sanitizeSvg('<html/>')).toThrowError(expect.objectContaining({ code: 'invalid_svg' }))
    expect(() => sanitizeSvg('bukan xml')).toThrowError(TemplateError)
  })
})
