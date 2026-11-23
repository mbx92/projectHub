import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { XmlDocument } from 'xmldoc'
import { capacity, renderTemplatePages, rowInfo } from '../../server/utils/svgTemplate/repeat'
import { TemplateError } from '../../server/utils/svgTemplate/types'

const measure = (t: string, _f: string, s: number) => t.length * s * 0.5
const fixture = readFileSync(new URL('../fixtures/invoice-p1.svg', import.meta.url), 'utf8')
const mkItems = (n: number) => Array.from({ length: n }, (_, i) => ({
  'item.deskripsi': `Item ${i + 1}`, 'item.qty': '1', 'item.harga': 'Rp 1', 'item.jumlah': 'Rp 1',
}))

type N = any
const texts = (s: string): N[] => {
  const out: N[] = []
  const walk = (n: N, anc: N[]) => { for (const c of n.children ?? []) { if (c.name === 'text') out.push({ node: c, anc }); if (c.children) walk(c, [...anc, c]) } }
  walk(new XmlDocument(s), [])
  return out
}
const textOf = (t: N): string => (t.children ?? []).map((c: N) => c.text ?? textOf(c)).join('')
const translateOf = (t: { anc: N[] }) => t.anc.map(a => a.attr?.transform).filter(Boolean).join('|')

describe('rowInfo / capacity', () => {
  it('measures the sample row of the Penpot export', () => {
    const info = rowInfo(fixture)!
    expect(info).toMatchObject({ top: 258, footerTop: 800 })
    expect(info.height).toBeCloseTo(28, 0)
    expect(info.bottomBlock).toBeCloseTo(344, 0)
    expect(capacity(info, true)).toBe(7)
    expect(capacity(info, false)).toBe(19)
  })
  it('returns null when the template has no repeating row', () => {
    expect(rowInfo('<svg xmlns="http://www.w3.org/2000/svg"><g id="shape-a"><rect x="0" y="0" width="1" height="1"/></g></svg>')).toBeNull()
  })
})

describe('renderTemplatePages', () => {
  const base = { values: { total: 'Rp 9', nomor: 'INV-1' }, measure }

  it('repeats row per item and shifts block below', () => {
    const pages = renderTemplatePages({ first: fixture }, { ...base, items: mkItems(5) })
    expect(pages).toHaveLength(1)
    const ts = texts(pages[0]!)
    expect(ts.filter(t => /^Item \d$/.test(textOf(t.node)))).toHaveLength(5)
    const shifts = ts.filter(t => /^Item \d$/.test(textOf(t.node))).map(t => translateOf(t))
    expect(shifts.join(',')).toContain('translate(0 112)')
    const total = ts.find(t => textOf(t.node) === 'Rp 9')!
    expect(translateOf(total)).toBe('translate(0 112)')
    const footer = ts.find(t => textOf(t.node) === 'Hal. 1 dari 1')!
    expect(translateOf(footer)).toBe('')
  })

  it('handles zero items', () => {
    const pages = renderTemplatePages({ first: fixture }, { ...base, items: [] })
    const ts = texts(pages[0]!)
    expect(ts.some(t => /Item|\{\{item/.test(textOf(t.node)))).toBe(false)
    expect(translateOf(ts.find(t => textOf(t.node) === 'Rp 9')!)).toBe('translate(0 -28)')
  })

  it('paginates 120 items', () => {
    const pages = renderTemplatePages({ first: fixture, next: fixture }, { ...base, items: mkItems(120) })
    expect(pages.length).toBeGreaterThan(1)
    const all = pages.map(p => texts(p).map(t => textOf(t.node)))
    expect(all.flat().filter(s => /^Item \d+$/.test(s))).toHaveLength(120)
    expect(all.map(a => a.includes('Rp 9'))).toEqual(pages.map((_, i) => i === pages.length - 1))
    pages.forEach((_, i) => expect(all[i]).toContain(`Hal. ${i + 1} dari ${pages.length}`))
  })

  it('puts total on a final page when items fit only without the bottom block', () => {
    const pages = renderTemplatePages({ first: fixture, next: fixture }, { ...base, items: mkItems(8) })
    expect(pages).toHaveLength(2)
    expect(texts(pages[0]!).some(t => textOf(t.node) === 'Rp 9')).toBe(false)
    expect(texts(pages[1]!).some(t => textOf(t.node) === 'Rp 9')).toBe(true)
  })

  it('does not re-expand placeholders typed inside item text', () => {
    const items = [{ ...mkItems(1)[0]!, 'item.deskripsi': 'tagih {{total}}' }]
    const ts = texts(renderTemplatePages({ first: fixture }, { ...base, items })[0]!)
    expect(ts.some(t => textOf(t.node) === 'tagih {{total}}')).toBe(true)
  })

  it('throws no_capacity when row cannot fit', () => {
    const bad = '<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><g id="shape-root">'
      + '<g id="shape-row"><rect x="0" y="100" width="500" height="50"/><g class="text-container" x="0" y="100" width="100" height="10"><g><text x="0" y="110">{{item.deskripsi}}</text></g></g></g>'
      + '<g id="shape-foot"><rect x="0" y="120" width="500" height="20"/><g class="text-container" x="0" y="120" width="100" height="10"><g><text x="0" y="130">{{halaman}}</text></g></g></g>'
      + '</g></svg>'
    expect(() => renderTemplatePages({ first: bad }, { ...base, items: mkItems(1) })).toThrowError(expect.objectContaining({ code: 'no_capacity' }))
    expect(() => renderTemplatePages({ first: bad }, { ...base, items: mkItems(1) })).toThrowError(TemplateError)
  })

  it('renders a frame without rows as one page with page numbers', () => {
    const frame = '<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><g id="shape-root"><g id="shape-f"><g class="text-container" x="0" y="800" width="100" height="10"><g><text x="0" y="810">{{halaman}}</text></g></g></g></g></svg>'
    expect(texts(renderTemplatePages({ first: frame }, base)[0]!).map(t => textOf(t.node))).toEqual(['Hal. 1 dari 1'])
  })
})
