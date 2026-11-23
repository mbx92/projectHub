/** Util pohon XML untuk SVG ekspor Penpot (xmldoc). */
import { XmlDocument } from 'xmldoc'
import type { XmlElement } from 'xmldoc'
import { TemplateError } from './types'

export type El = XmlElement

export function parseSvg(svg: string): El {
  let doc: XmlDocument
  try { doc = new XmlDocument(svg) } catch { throw new TemplateError('invalid_svg', 'File bukan SVG yang valid.') }
  if (doc.name !== 'svg') throw new TemplateError('invalid_svg', 'File bukan SVG yang valid.')
  return doc
}

export function serialize(root: El): string {
  return root.toString({ compressed: true, preserveWhitespace: true })
}

export const isEl = (n: any): n is El => !!n && typeof n.name === 'string' && n.attr !== undefined

export const elements = (n: El): El[] => (n.children ?? []).filter(isEl)

export function walk(n: El, fn: (n: El, parent: El | null) => void, parent: El | null = null) {
  fn(n, parent)
  for (const c of elements(n)) walk(c, fn, n)
}

export function parentMap(root: El): Map<El, El | null> {
  const m = new Map<El, El | null>()
  walk(root, (n, p) => m.set(n, p))
  return m
}

/** Teks gabungan semua simpul teks di bawah elemen (menyatukan <tspan>). */
export function textContent(n: El): string {
  return (n.children ?? []).map((c: any) => (isEl(c) ? textContent(c) : (c.text ?? ''))).join('')
}

export const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Ganti seluruh isi elemen dengan satu simpul teks (di-escape saat serialisasi). */
export function setTextContent(n: El, s: string) {
  const holder = new XmlDocument(`<t>${escapeXml(s)}</t>`)
  n.children = holder.children
  n.firstChild = holder.firstChild
  n.lastChild = holder.lastChild
  n.val = s
}

export function makeEl(xml: string): El {
  return new XmlDocument(xml)
}

export function removeEl(n: El, parents: Map<El, El | null>) {
  const p = parents.get(n)
  if (!p) return
  p.children = p.children.filter(c => c !== n)
  p.firstChild = p.children[0] ?? null
  p.lastChild = p.children[p.children.length - 1] ?? null
}

export function appendEl(p: El, c: El) {
  p.children.push(c)
  p.firstChild = p.children[0] ?? null
  p.lastChild = c
}

export const num = (v: string | undefined, d = 0) => (v === undefined || v === '' ? d : Number(v))

/** Kotak <g class="text-container"> terdekat di atas elemen teks. */
export function textBox(t: El, parents: Map<El, El | null>): El | null {
  let p = parents.get(t) ?? null
  while (p) {
    if (p.attr.class === 'text-container') return p
    p = parents.get(p) ?? null
  }
  return null
}

export const isShape = (n: El) => n.name === 'g' && /^shape-/.test(n.attr.id ?? '')
