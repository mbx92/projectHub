import { TemplateError } from './types'
import { elements, parentMap, parseSvg, removeEl, serialize, walk } from './xml'

export const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024

const BANNED = new Set(['script', 'foreignObject', 'style', 'pattern'])

/**
 * Bersihkan SVG unggahan: hapus skrip, foreignObject, CSS (@font-face), pola teks,
 * atribut on*, dan href/xlink:href selain `#id` dan `data:`.
 */
export function sanitizeSvg(svg: string): string {
  if (Buffer.byteLength(svg, 'utf8') > MAX_TEMPLATE_BYTES) throw new TemplateError('too_large', 'Ukuran SVG maksimal 2 MB.')
  const root = parseSvg(svg)
  const parents = parentMap(root)
  const doomed: any[] = []
  walk(root, (n) => {
    if (BANNED.has(n.name)) { doomed.push(n); return }
    for (const k of Object.keys(n.attr)) {
      if (/^on/i.test(k)) delete n.attr[k]
      else if (k === 'href' || k === 'xlink:href') {
        const v = (n.attr[k] ?? '').trim()
        if (!(v.startsWith('#') || /^data:/i.test(v))) delete n.attr[k]
      }
    }
  })
  for (const d of doomed) removeEl(d, parents)
  // buang <defs> yang menjadi kosong
  const p2 = parentMap(root)
  walk(root, (n) => { if (n.name === 'defs' && elements(n).length === 0) removeEl(n, p2) })
  return serialize(root)
}
