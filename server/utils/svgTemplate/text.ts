import type { FillInput } from './types'
import type { El } from './xml'
import { appendEl, elements, isShape, makeEl, num, parentMap, parseSvg, removeEl, serialize, setTextContent, textBox, textContent, walk } from './xml'

const PH = /\{\{\s*(\??[\w.]+)\s*\}\}/g
const IMAGE_KEYS = new Set(['logo', 'ttd', 'qris'])

const allTexts = (root: El): El[] => {
  const out: El[] = []
  walk(root, n => { if (n.name === 'text') out.push(n) })
  return out
}

/** Kunci penanda unik apa adanya (termasuk awalan `?`), mis. ['nomor', '?diskon', 'item.qty']. */
export function placeholdersIn(svg: string): string[] {
  const keys = new Set<string>()
  for (const t of allTexts(parseSvg(svg))) for (const m of textContent(t).matchAll(PH)) keys.add(m[1]!)
  return [...keys]
}

type Align = 'start' | 'middle' | 'end'

/** Perataan disimpulkan dari posisi teks di dalam kotaknya (sebelum textLength dibuang). */
function alignOf(t: El, box: El | null): { align: Align, left: number, width: number } {
  if (!box) return { align: 'start', left: num(t.attr.x), width: 0 }
  const bx = num(box.attr.x), bw = num(box.attr.width), tx = num(t.attr.x), tl = num(t.attr.textLength)
  if (!tl) return { align: 'start', left: bx, width: bw }
  const left = tx - bx, right = bx + bw - (tx + tl)
  if (left > 1.5 && right < 1.5) return { align: 'end', left: bx, width: bw }
  if (left > 1.5 && Math.abs(left - right) < 1.5) return { align: 'middle', left: bx, width: bw }
  return { align: 'start', left: bx, width: bw }
}

const fillText = (s: string, values: Record<string, string>) => s.replace(PH, (_, k: string) => values[k.replace(/^\?/, '')] ?? '')

/** Isi satu halaman SVG: penanda, gambar, `{{?}}`, perataan. Baris berulang ditangani di repeat.ts. */
export function fillSinglePage(svg: string, input: FillInput): string {
  const root = parseSvg(svg)
  let parents = parentMap(root)
  const texts = allTexts(root)

  // 1) satukan <tspan> → satu teks
  for (const t of texts) if (elements(t).length) setTextContent(t, textContent(t))

  // 2) gambar
  for (const t of texts) {
    const m = textContent(t).trim().match(/^\{\{\s*(\w+)\s*\}\}$/)
    if (!m || !IMAGE_KEYS.has(m[1]!)) continue
    const box = textBox(t, parents)
    const data = input.images?.[m[1]!] ?? null
    const host = (box && parents.get(box)) || parents.get(t)!
    if (box && data) {
      const [x, y, w, h] = [box.attr.x, box.attr.y, box.attr.width, box.attr.height]
      appendEl(host, makeEl(`<image href="${data.replace(/"/g, '&quot;')}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`))
    }
    removeEl(box ?? t, parents)
    t.attr.__gone = '1'
  }

  // 3) {{?kunci}} kosong → sembunyikan board terkecil
  parents = parentMap(root)
  for (const t of texts) {
    if (t.attr.__gone) continue
    const empties = [...textContent(t).matchAll(PH)].filter(m => m[1]!.startsWith('?') && !input.values[m[1]!.slice(1)])
    if (!empties.length) continue
    const shapes: El[] = []
    for (let p = parents.get(t) ?? null; p; p = parents.get(p) ?? null) if (isShape(p)) shapes.push(p)
    const top = shapes[shapes.length - 1]
    const board = shapes[1] && shapes[1] !== top ? shapes[1] : shapes[0]
    if (board) { removeEl(board, parents); t.attr.__gone = '1' }
  }

  // 4) isi + perataan
  parents = parentMap(root)
  for (const t of texts) {
    if (t.attr.__gone) continue
    if (!parents.has(t) || !isAttached(t, root, parents)) continue
    const { align, left, width } = alignOf(t, textBox(t, parents))
    setTextContent(t, fillText(textContent(t), input.values))
    delete t.attr.textLength
    delete t.attr.lengthAdjust
    if (align === 'end') { t.attr.x = String(left + width); t.attr['text-anchor'] = 'end' }
    else if (align === 'middle') { t.attr.x = String(left + width / 2); t.attr['text-anchor'] = 'middle' }
  }
  for (const t of texts) delete t.attr.__gone
  return serialize(root)
}

/** Apakah elemen masih terpasang di pohon (belum dilepas oleh removeEl). */
function isAttached(n: El, root: El, parents: Map<El, El | null>): boolean {
  for (let p: El | null = n; p; p = parents.get(p) ?? null) {
    const up: El | null = parents.get(p) ?? null
    if (!up) return p === root
    if (!up.children.includes(p)) return false
  }
  return false
}
