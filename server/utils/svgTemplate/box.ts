import type { El } from './xml'
import { num, parentMap, textBox, textContent, walk } from './xml'

export interface Box { x: number, y: number, width: number, height: number }

/** Kotak teks `{{isi}}` (area isi dokumen) pada sebuah SVG, atau null bila tidak ada. */
export function isiBox(root: El): Box | null {
  const parents = parentMap(root)
  let found: Box | null = null
  walk(root, (n) => {
    if (found || n.name !== 'text' || !/\{\{\s*isi\s*\}\}/.test(textContent(n))) return
    const box = textBox(n, parents)
    if (box) found = { x: num(box.attr.x), y: num(box.attr.y), width: num(box.attr.width), height: num(box.attr.height) }
  })
  return found
}
