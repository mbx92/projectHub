import { describe, expect, it, vi } from 'vitest'
import { XmlDocument } from 'xmldoc'
import { fillSinglePage } from '../../server/utils/svgTemplate/text'
import { fontKey } from '../../server/utils/svgTemplate/fonts'

const measure = (t: string, _f: string, s: number) => t.length * s * 0.5
const STYLE = (size: number, weight = 400, family = '&quot;Plus Jakarta Sans&quot;') => `font-family: ${family}; font-weight: ${weight}; font-size: ${size}px; fill: rgb(0, 0, 0);`
const one = (x: number, y: number, w: number, h: number, textX: number, tl: number, style: string, body = '{{v}}') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><g id="shape-root"><g id="shape-a"><g class="text-container" x="${x}" y="${y}" width="${w}" height="${h}"><g><text x="${textX}" y="${y + h}" textLength="${tl}" lengthAdjust="spacingAndGlyphs" style="${style}">${body}</text></g></g></g></g></svg>`
const textEl = (s: string): any => {
  let found: any
  const walk = (n: any) => { for (const c of n.children ?? []) { if (c.name === 'text') found = c; if (c.children) walk(c) } }
  walk(new XmlDocument(s))
  return found
}
const lines = (t: any): string[] => (t.children ?? []).filter((c: any) => c.name === 'tspan').map((c: any) => c.children.map((k: any) => k.text).join(''))

describe('wrapping', () => {
  const long = 'kata kata kata kata kata kata kata kata kata kata kata'

  it('wraps left text within box height and ends the last line with an ellipsis', () => {
    const s = one(10, 10, 100, 30, 10, 40, STYLE(9))
    const t = textEl(fillSinglePage(s, { values: { v: long }, measure }))
    const ls = lines(t)
    expect(ls).toHaveLength(2) // floor(30 / (9 * 1.25)) = 2
    expect(ls[1]!.endsWith('…')).toBe(true)
    ls.forEach(l => expect(measure(l, 'PJS-400', 9)).toBeLessThanOrEqual(100))
    const ys = t.children.filter((c: any) => c.name === 'tspan').map((c: any) => Number(c.attr.y))
    expect(ys[1]! - ys[0]!).toBeCloseTo(11.25, 2)
  })

  it('keeps every character when wrapping (words with s, hard-broken long words)', () => {
    const text = 'saat setelah sistem sesuai sangat sekali sesudah sss'
    const s = one(10, 10, 100, 60, 10, 40, STYLE(9))
    const t = textEl(fillSinglePage(s, { values: { v: text }, measure }))
    expect(lines(t).join(' ')).toBe(text)
    const long = 'supercalifragilisticexpialidocioussssss'
    const t2 = textEl(fillSinglePage(s, { values: { v: long }, measure }))
    expect(lines(t2).join('')).toBe(long)
  })

  it('does not wrap auto-width boxes (box as wide as the placeholder text)', () => {
    const s = one(10, 10, 40, 12, 10, 40, STYLE(9))
    const t = textEl(fillSinglePage(s, { values: { v: long }, measure }))
    expect(lines(t)).toHaveLength(0)
  })

  it('never adds textLength', () => {
    expect(fillSinglePage(one(10, 10, 100, 30, 10, 40, STYLE(9)), { values: { v: long }, measure })).not.toContain('textLength')
  })
})

describe('numeric shrink', () => {
  const right = (style: string) => one(100, 10, 60, 12, 130, 30, style)
  const fontSize = (s: string) => Number(/font-size: ([\d.]+)px/.exec(textEl(s).attr.style)![1])

  it('shrinks right-aligned text that is slightly too wide, never below 80%', () => {
    const out = fillSinglePage(right(STYLE(10)), { values: { v: 'x'.repeat(13) }, measure })
    const size = fontSize(out)
    expect(size).toBeGreaterThanOrEqual(8)
    expect(size).toBeLessThan(10)
    expect(measure('x'.repeat(13), 'PJS-400', size)).toBeLessThanOrEqual(60.01)
  })

  it('clamps at 80% and warns when far too wide', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = fillSinglePage(right(STYLE(10)), { values: { v: 'x'.repeat(30) }, measure })
    expect(fontSize(out)).toBeCloseTo(8, 5)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('font mapping', () => {
  it('maps family and weight to the bundled PJS families', () => {
    const out = textEl(fillSinglePage(one(10, 10, 100, 12, 10, 40, STYLE(9, 800)), { values: { v: 'a' }, measure }))
    expect(out.attr.style).toContain('font-family: PJS-800')
    expect(out.attr.style).not.toContain('font-weight')
    const inter = textEl(fillSinglePage(one(10, 10, 100, 12, 10, 40, STYLE(9, 500, 'Inter')), { values: { v: 'a' }, measure }))
    expect(inter.attr.style).toContain('font-family: PJS-400')
  })
  it('fontKey rounds weights', () => {
    expect(fontKey('Plus Jakarta Sans', 700)).toBe('PJS-700')
    expect(fontKey('Plus Jakarta Sans', 600)).toBe('PJS-600')
    expect(fontKey('Plus Jakarta Sans', 900)).toBe('PJS-800')
    expect(fontKey('Plus Jakarta Sans', 300)).toBe('PJS-400')
    expect(fontKey('Inter', 500)).toBe('PJS-400')
  })
})
