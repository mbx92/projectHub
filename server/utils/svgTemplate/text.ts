import type { FillInput } from './types'
import type { El } from './xml'
import { fontKey, parseStyle, styleToString } from './fonts'
import { appendEl, elements, escapeXml, isShape, makeEl, num, parentMap, parseSvg, removeEl, serialize, setTextContent, textBox, textContent, walk } from './xml'

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

  // 4) isi, perataan, font, bungkus / perkecil
  parents = parentMap(root)
  for (const t of texts) {
    if (t.attr.__gone) continue
    if (!isAttached(t, root, parents)) continue
    const box = textBox(t, parents)
    const { align, left, width } = alignOf(t, box)
    const fixedBox = !!box && width - num(t.attr.textLength) > 1.5
    const boxH = box ? num(box.attr.height) : 0
    const text = fillText(textContent(t), input.values)
    delete t.attr.textLength
    delete t.attr.lengthAdjust

    const style = parseStyle(t.attr.style)
    let size = parseFloat(style.get('font-size') ?? '12') || 12
    const key = fontKey((style.get('font-family') ?? '').replace(/["']/g, ''), Number(style.get('font-weight') ?? 400))
    style.set('font-family', key)
    style.delete('font-weight')

    const w = input.measure(text, key, size)
    // Kotak berlebar tetap: batas = lebar kotak. Kotak auto-width (Penpot mengepaskannya ke penanda): batas = tepi kanan halaman dikurangi margin 40.
    const bound = fixedBox ? width : num(root.attr.width, 595) - 40 - num(t.attr.x)
    const x0 = num(t.attr.x), y0 = num(t.attr.y)
    if (align === 'end' || align === 'middle') {
      if (w > width) {
        const scale = Math.max(0.8, width / w)
        if (width / w < 0.8) console.warn('[template] teks terlalu lebar untuk kotaknya, diperkecil 80%:', text.slice(0, 40))
        size = Number((size * scale).toFixed(2))
      }
      t.attr.x = String(align === 'end' ? left + width : left + width / 2)
      t.attr['text-anchor'] = align
      setTextContent(t, text)
    } else if (w > bound) {
      const maxLines = Math.max(1, Math.floor(boxH / (size * 1.25)))
      const ls = wrapLines(text, bound, maxLines, (s) => input.measure(s, key, size))
      t.children = []
      t.firstChild = null
      t.lastChild = null
      ls.forEach((l, i) => appendEl(t, makeEl(`<tspan x="${x0}" y="${Number((y0 + i * size * 1.25).toFixed(2))}">${escapeXml(l)}</tspan>`)))
    } else {
      setTextContent(t, text)
    }
    style.set('font-size', `${size}px`)
    t.attr.style = styleToString(style)
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

/** Bungkus per kata; kata terlalu panjang dipecah per huruf; baris terakhir yang tak muat diakhiri "…". */
function wrapLines(text: string, maxW: number, maxLines: number, width: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  const pushHard = (word: string) => {
    let chunk = ''
    for (const ch of word) {
      if (width(chunk + ch) > maxW && chunk) { lines.push(chunk); chunk = ch } else chunk += ch
    }
    cur = chunk
  }
  for (const word of words) {
    const tryLine = cur ? `${cur} ${word}` : word
    if (width(tryLine) <= maxW) { cur = tryLine; continue }
    if (cur) lines.push(cur)
    cur = ''
    if (width(word) > maxW) pushHard(word)
    else cur = word
  }
  if (cur) lines.push(cur)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]!
  while (last && width(last + '…') > maxW) last = last.slice(0, -1).trimEnd()
  kept[maxLines - 1] = last + '…'
  return kept
}
