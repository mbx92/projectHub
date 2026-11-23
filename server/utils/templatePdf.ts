/** Render PDF dari template SVG Penpot: font Plus Jakarta Sans dibundel, ukur teks, halaman SVG, dan bingkai dokumen. */
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Content } from 'pdfmake/interfaces'
import { fillSinglePage } from './svgTemplate/text'
import { TemplateError } from './svgTemplate/types'
import type { Measure } from './svgTemplate/types'
import { num, parentMap, parseSvg, textBox, textContent, walk } from './svgTemplate/xml'

const require = createRequire(import.meta.url)

const FONT_FILES = {
  'PJS-400': 'PlusJakartaSans-400.woff',
  'PJS-600': 'PlusJakartaSans-600.woff',
  'PJS-700': 'PlusJakartaSans-700.woff',
  'PJS-800': 'PlusJakartaSans-800.woff',
} as const

let buffers: Record<string, Buffer> | null = null
const fontkitCache = new Map<string, any>()
let printer: any = null

async function readFontFile(file: string): Promise<Buffer> {
  // Di server Nitro, aset dibundel lewat penyimpanan 'assets:server'; di luar Nitro (tes) baca dari disk.
  if (typeof useStorage === 'function') {
    const raw = await useStorage('assets:server').getItemRaw(`fonts:${file}`).catch(() => null)
    if (raw) return Buffer.from(raw as Uint8Array)
  }
  return readFile(join(process.cwd(), 'server', 'assets', 'fonts', file))
}

/** Muat font sekali. Wajib dipanggil (await) sebelum pdfMeasure / render. */
export async function ensureTemplateFonts(): Promise<void> {
  if (buffers) return
  const entries = await Promise.all(Object.entries(FONT_FILES).map(async ([k, f]) => [k, await readFontFile(f)] as const))
  buffers = Object.fromEntries(entries)
}

/** Lebar teks (pt) memakai metrik font yang sama dengan yang dicetak. */
export const pdfMeasure: Measure = (text, family, size) => {
  if (!buffers) throw new Error('Font template belum dimuat: panggil ensureTemplateFonts() lebih dulu.')
  const key = family in FONT_FILES ? family : 'PJS-400'
  let font = fontkitCache.get(key)
  if (!font) {
    font = require('@foliojs-fork/fontkit').create(buffers[key]!)
    fontkitCache.set(key, font)
  }
  return (font.layout(text).advanceWidth * size) / font.unitsPerEm
}

function getPrinter() {
  if (printer) return printer
  if (!buffers) throw new Error('Font template belum dimuat: panggil ensureTemplateFonts() lebih dulu.')
  const PdfPrinter = require('pdfmake')
  const vfsMod = require('pdfmake/build/vfs_fonts.js')
  const vfs: Record<string, string> = vfsMod.pdfMake?.vfs ?? vfsMod
  const f = (n: string) => Buffer.from(vfs[n]!, 'base64')
  const fonts: Record<string, Record<string, Buffer>> = {
    Roboto: { normal: f('Roboto-Regular.ttf'), bold: f('Roboto-Medium.ttf'), italics: f('Roboto-Italic.ttf'), bolditalics: f('Roboto-MediumItalic.ttf') },
  }
  for (const k of Object.keys(FONT_FILES)) fonts[k] = { normal: buffers[k]!, bold: buffers[k]!, italics: buffers[k]!, bolditalics: buffers[k]! }
  printer = new PdfPrinter(fonts)
  return printer
}

function toBuffer(def: Record<string, unknown>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = getPrinter().createPdfKitDocument(def)
    const chunks: Buffer[] = []
    pdf.on('data', (c: Buffer) => chunks.push(c))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)
    pdf.end()
  })
}

const PAGE = { width: 595, height: 842 }

/** Satu halaman PDF per SVG (A4, tanpa margin). */
export async function svgPagesToPdf(pages: string[], title: string): Promise<Buffer> {
  await ensureTemplateFonts()
  return toBuffer({
    pageSize: PAGE,
    pageMargins: 0,
    defaultStyle: { font: 'PJS-400', fontSize: 10 },
    content: pages.map((svg, i): Content => ({ svg, width: PAGE.width, ...(i ? { pageBreak: 'before' as const } : {}) })),
    info: { title },
  })
}

/** Margin isi dari kotak teks `{{isi}}` pada bingkai. */
function contentMargins(svg: string): [number, number, number, number] {
  const root = parseSvg(svg)
  const parents = parentMap(root)
  let found: [number, number, number, number] | null = null
  walk(root, (n) => {
    if (found || n.name !== 'text' || !/\{\{\s*isi\s*\}\}/.test(textContent(n))) return
    const box = textBox(n, parents)
    if (!box) return
    const [x, y, w, h] = [num(box.attr.x), num(box.attr.y), num(box.attr.width), num(box.attr.height)]
    found = [x, y, PAGE.width - x - w, PAGE.height - y - h]
  })
  if (!found) throw new TemplateError('missing_placeholder', 'Bingkai dokumen harus memiliki kotak teks {{isi}}.')
  return found
}

export interface FrameOptions { images?: Record<string, string | null> }

/**
 * Dokumen berbingkai: isi (konten pdfmake) mengalir di kotak {{isi}}; SVG bingkai menjadi latar tiap halaman.
 * Dua lintasan: lintasan pertama menghitung jumlah halaman agar {{halaman}} ("Hal. i dari n") benar.
 */
export async function framedDocPdf(frames: { first: string, next?: string }, values: Record<string, string>, body: Content[], title: string, opts: FrameOptions = {}): Promise<Buffer> {
  await ensureTemplateFonts()
  const margins = contentMargins(frames.first)
  const base = { pageSize: PAGE, pageMargins: margins, defaultStyle: { font: 'PJS-400', fontSize: 10 }, content: body, info: { title } }

  let total = 1
  await toBuffer({ ...base, header: (_cp: number, pc: number) => { total = pc; return { text: '' } } })

  const cache = new Map<number, string>()
  const svgFor = (cp: number) => {
    if (!cache.has(cp)) {
      const src = cp === 1 ? frames.first : (frames.next ?? frames.first)
      cache.set(cp, fillSinglePage(src, { values: { ...values, isi: '', halaman: `Hal. ${cp} dari ${total}` }, images: opts.images, measure: pdfMeasure }))
    }
    return cache.get(cp)!
  }
  return toBuffer({ ...base, background: (cp: number) => ({ svg: svgFor(cp), width: PAGE.width, absolutePosition: { x: 0, y: 0 } }) })
}
