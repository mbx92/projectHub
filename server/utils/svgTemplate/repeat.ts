import type { FillInput } from './types'
import type { El } from './xml'
import { TemplateError } from './types'
import { fillSinglePage } from './text'
import { elements, isShape, makeEl, num, parentMap, parseSvg, removeEl, serialize, textContent, walk } from './xml'

const ITEM = /\{\{\s*item\./
const HALAMAN = /\{\{\s*halaman\s*\}\}/

export interface RowInfo { top: number, height: number, bottomBlock: number, footerTop: number }

const textsIn = (n: El): El[] => {
  const out: El[] = []
  walk(n, (x) => { if (x.name === 'text') out.push(x) })
  return out
}
const hasText = (n: El, re: RegExp) => textsIn(n).some(t => re.test(textContent(t)))

/** Tepi atas/bawah sebuah shape: rect latar pertama, atau gabungan kotak teksnya. */
function bounds(shape: El): { top: number, bottom: number } {
  let rect: El | null = null
  walk(shape, (x) => { if (!rect && x.name === 'rect' && x.attr.y !== undefined) rect = x })
  if (rect) {
    const r = rect as El
    return { top: num(r.attr.y), bottom: num(r.attr.y) + num(r.attr.height) }
  }
  let top = Infinity, bottom = -Infinity
  walk(shape, (x) => {
    if (x.attr.class === 'text-container') { top = Math.min(top, num(x.attr.y)); bottom = Math.max(bottom, num(x.attr.y) + num(x.attr.height)) }
  })
  return { top, bottom }
}

/** Shape terdalam yang memuat semua teks `{{item.*}}`. */
function findRow(root: El): El | null {
  const all = textsIn(root).filter(t => ITEM.test(textContent(t))).length
  if (!all) return null
  let row: El | null = null
  walk(root, (n) => {
    if (isShape(n) && textsIn(n).filter(t => ITEM.test(textContent(t))).length === all) row = n
  })
  return row
}

function belowShapes(holder: El, row: El, rowBottom: number): El[] {
  // Shape tanpa rect/kotak teks (path, ikon, garis) tidak punya batas yang bisa diukur: biarkan di tempatnya.
  return elements(holder).filter(s => s !== row && !hasText(s, HALAMAN) && Number.isFinite(bounds(s).top) && bounds(s).top >= rowBottom - 0.5)
}

function measureRow(root: El, row: El, parents: Map<El, El | null>): RowInfo {
  const holder = parents.get(row)!
  const { top, bottom } = bounds(row)
  const below = belowShapes(holder, row, bottom)
  const lowest = below.length ? Math.max(...below.map(b => bounds(b).bottom)) : bottom
  const footer = elements(holder).find(s => hasText(s, HALAMAN))
  let footerTop = footer ? bounds(footer).top : NaN
  if (!Number.isFinite(footerTop)) footerTop = num(root.attr.height, 842)
  return { top, height: bottom - top, bottomBlock: lowest - bottom, footerTop }
}

/** Ukuran baris contoh (null bila template tidak punya baris berulang). */
export function rowInfo(svg: string): RowInfo | null {
  const root = parseSvg(svg)
  const row = findRow(root)
  return row ? measureRow(root, row, parentMap(root)) : null
}

/** Banyak baris yang muat pada satu halaman. Halaman terakhir memuat blok bawah (total, tanda tangan). */
export function capacity(info: RowInfo, isLast: boolean): number {
  return Math.floor((info.footerTop - (isLast ? info.bottomBlock : 0) - info.top) / info.height)
}

const fmt = (n: number) => String(Number(n.toFixed(2)))

function wrapShift(holder: El, child: El, dy: number) {
  const g = makeEl(`<g transform="translate(0 ${fmt(dy)})"/>`)
  g.children = [child]
  g.firstChild = child
  g.lastChild = child
  holder.children[holder.children.indexOf(child)] = g
}

function renderPage(svg: string, rows: Record<string, string>[], isLast: boolean, label: string, input: FillInput): string {
  const base = { ...input, values: { ...input.values, halaman: label } }
  const root = parseSvg(svg)
  const row = findRow(root)
  if (!row) {
    if (rows.length) throw new TemplateError('missing_placeholder', 'Halaman template tidak memiliki baris item ({{item.*}}) padahal item harus ditampilkan di halaman ini.')
    return fillSinglePage(svg, base)
  }
  const parents = parentMap(root)
  const holder = parents.get(row)!
  const info = measureRow(root, row, parents)
  const below = belowShapes(holder, row, info.top + info.height)

  if (!isLast) below.forEach(b => removeEl(b, parents))
  else {
    const dy = (rows.length - 1) * info.height
    if (Math.abs(dy) > 0.001) below.forEach(b => wrapShift(holder, b, dy))
  }

  const rowSvg = `<svg xmlns="http://www.w3.org/2000/svg">${serialize(row)}</svg>`
  const filledRows = rows.map((r, i) => {
    const doc = parseSvg(fillSinglePage(rowSvg, { ...base, values: { ...base.values, ...r } }))
    const shape = elements(doc)[0]!
    if (i === 0) return shape
    const g = makeEl(`<g transform="translate(0 ${fmt(i * info.height)})"/>`)
    g.children = [shape]; g.firstChild = shape; g.lastChild = shape
    return g
  })

  holder.children[holder.children.indexOf(row)] = makeEl('<g id="__rows"/>')
  const page = parseSvg(fillSinglePage(serialize(root), base))
  walk(page, (n) => {
    if (n.name === 'g' && n.attr.id === '__rows') {
      delete n.attr.id
      n.children = filledRows
      n.firstChild = filledRows[0] ?? null
      n.lastChild = filledRows[filledRows.length - 1] ?? null
    }
  })
  return serialize(page)
}

/**
 * Render halaman-halaman template. Tanpa baris berulang → satu halaman (bingkai).
 * Dengan baris berulang → baris item dibagi ke halaman; blok bawah hanya di halaman terakhir.
 */
export function renderTemplatePages(pages: { first: string, next?: string }, input: FillInput): string[] {
  const items = input.items ?? []
  const info1 = rowInfo(pages.first)
  if (!info1) return [renderPage(pages.first, [], true, 'Hal. 1 dari 1', input)]
  const nextSvg = pages.next ?? pages.first
  const infoN = rowInfo(nextSvg) ?? info1

  const plan: { rows: Record<string, string>[], last: boolean, svg: string }[] = []
  let remaining = items
  for (let k = 0; ; k++) {
    const info = k === 0 ? info1 : infoN
    const svg = k === 0 ? pages.first : nextSvg
    const mid = capacity(info, false)
    if (mid < 1) throw new TemplateError('no_capacity', 'Baris item tidak muat di halaman template (footer terlalu dekat dengan baris).')
    if (remaining.length <= Math.max(capacity(info, true), 0)) { plan.push({ rows: remaining, last: true, svg }); break }
    plan.push({ rows: remaining.slice(0, mid), last: false, svg })
    remaining = remaining.slice(mid)
  }
  return plan.map((p, i) => renderPage(p.svg, p.rows, p.last, `Hal. ${i + 1} dari ${plan.length}`, input))
}
