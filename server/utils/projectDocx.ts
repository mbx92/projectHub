/** Render dokumen editor (JSON) ke Word (.docx) dengan kop, footer bernomor halaman, dan blok tanda tangan. */
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun, Header, Footer, PageNumber, HeadingLevel, LevelFormat } from 'docx'
import type { DocNode } from './projectDocs'
import type { DocRenderCtx } from './docLayout'

const CONTENT_W = 9638 // A4 dengan margin 2 cm, satuan DXA
const BRAND = '0B6E63'
const MUTED = '475467'
const LINE = 'E4E7EC'
const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE }
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

function runs(nodes: DocNode[] | undefined, extra: { bold?: boolean, color?: string, size?: number } = {}): (TextRun)[] {
  return (nodes ?? []).map((n) => {
    if (n.type === 'hardBreak') return new TextRun({ break: 1 })
    const marks = (n.marks ?? []).map(m => m.type)
    return new TextRun({ text: n.text ?? '', bold: extra.bold || marks.includes('bold'), italics: marks.includes('italic'), underline: marks.includes('underline') ? {} : undefined, color: extra.color, size: extra.size })
  })
}

let olInstance = 0

function blocks(nodes: DocNode[] | undefined, level = 0, cellText?: { bold?: boolean, color?: string, size?: number }): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []
  for (const n of nodes ?? []) {
    switch (n.type) {
      case 'paragraph':
        out.push(new Paragraph({ spacing: { after: cellText ? 0 : 120 }, children: runs(n.content, cellText) }))
        break
      case 'heading': {
        const lv = Number(n.attrs?.level ?? 2)
        out.push(new Paragraph({
          heading: lv === 1 ? HeadingLevel.HEADING_1 : lv === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          alignment: lv === 1 ? AlignmentType.CENTER : undefined,
          spacing: { before: lv === 1 ? 0 : 240, after: 120 },
          children: runs(n.content, { bold: true, size: lv === 1 ? 28 : lv === 2 ? 24 : 22, color: '101828' }),
        }))
        break
      }
      case 'bulletList':
      case 'orderedList': {
        const ordered = n.type === 'orderedList'
        const instance = ordered ? ++olInstance : 0
        for (const li of n.content ?? []) {
          for (const child of li.content ?? []) {
            if (child.type === 'bulletList' || child.type === 'orderedList') out.push(...blocks([child], level + 1))
            else out.push(new Paragraph({ spacing: { after: 60 }, ...(ordered ? { numbering: { reference: 'ol', level: Math.min(level, 2), instance } } : { bullet: { level: Math.min(level, 2) } }), children: runs(child.content) }))
          }
        }
        break
      }
      case 'table': {
        const rows = n.content ?? []
        const cols = Math.max(1, ...rows.map(r => r.content?.length ?? 0))
        const w = Math.floor(CONTENT_W / cols)
        out.push(new Table({
          width: { size: w * cols, type: WidthType.DXA },
          columnWidths: Array(cols).fill(w),
          rows: rows.map(r => new TableRow({
            children: Array.from({ length: cols }, (_, i) => {
              const c = r.content?.[i]
              const head = c?.type === 'tableHeader'
              const inner = c ? blocks(c.content, 0, head ? { bold: true, color: MUTED, size: 18 } : {}) : []
              return new TableCell({
                width: { size: w, type: WidthType.DXA },
                margins: { top: 70, bottom: 70, left: 100, right: 100 },
                borders: { top: thin, bottom: thin, left: none, right: none },
                shading: head ? { type: ShadingType.CLEAR, fill: 'F9FAFB', color: 'auto' } : undefined,
                children: inner.length ? inner : [new Paragraph({ children: [] })],
              })
            }),
          })),
        }))
        out.push(new Paragraph({ spacing: { after: 120 }, children: [] }))
        break
      }
      default:
        if (n.content) out.push(...blocks(n.content, level, cellText))
    }
  }
  return out
}

async function signatureImage(key: string | null | undefined) {
  if (!key || !/\.(png|jpe?g)$/i.test(key)) return null
  try {
    const data = await readStoredFile(key)
    return new ImageRun({ type: key.toLowerCase().endsWith('.png') ? 'png' : 'jpg', data, transformation: { width: 120, height: 56 } })
  } catch { return null }
}

const centered = (text: string, o: { bold?: boolean, color?: string, size?: number, before?: number, after?: number } = {}) =>
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: o.before ?? 0, after: o.after ?? 40 }, children: [new TextRun({ text, bold: o.bold, color: o.color, size: o.size })] })

async function signatureTable(ctx: DocRenderCtx) {
  const b = ctx.business
  const img = await signatureImage(b.signatureKey)
  const half = CONTENT_W / 2
  const noBorder = { top: none, bottom: none, left: none, right: none }
  const left = [
    centered('Pihak Pertama', { color: MUTED, size: 18 }),
    img ? new Paragraph({ alignment: AlignmentType.CENTER, children: [img] }) : centered(' ', { before: 600, after: 600 }),
    centered(b.signerName || b.name, { bold: true }),
    centered(b.signerTitle || ' ', { color: MUTED, size: 18 }),
  ]
  const right = [
    centered('Pihak Kedua (Klien)', { color: MUTED, size: 18 }),
    centered(' ', { before: 600, after: 600 }),
    centered(ctx.clientName || ' ', { bold: true }),
    centered(' ', { size: 18 }),
  ]
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [half, half],
    rows: [new TableRow({ cantSplit: true, children: [left, right].map(children => new TableCell({ width: { size: half, type: WidthType.DXA }, borders: noBorder, children })) })],
  })
}

export async function docToDocx(content: DocNode, ctx: DocRenderCtx): Promise<Buffer> {
  const b = ctx.business
  const header = new Header({
    children: [
      new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: b.name, bold: true, size: 28, color: BRAND }), ...(ctx.docNumber ? [new TextRun({ text: `\t${ctx.docNumber}`, color: MUTED, size: 18 })] : [])], tabStops: [{ type: 'right', position: CONTENT_W }] }),
      new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: [b.address, b.email, b.whatsapp].filter(Boolean).join(' · ') || ' ', color: MUTED, size: 18 })] }),
      ...(b.npwp ? [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: `NPWP ${b.npwp}`, color: MUTED, size: 18 })] })] : []),
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND, space: 4 } }, spacing: { after: 120 }, children: [] }),
    ],
  })
  const footer = new Footer({
    children: [new Paragraph({
      tabStops: [{ type: 'right', position: CONTENT_W }],
      children: [
        new TextRun({ text: ctx.footer, color: MUTED, size: 16 }),
        new TextRun({ children: ['\tHal. ', PageNumber.CURRENT, ' dari ', PageNumber.TOTAL_PAGES], color: MUTED, size: 16 }),
      ],
    })],
  })
  olInstance = 0
  const doc = new Document({
    title: ctx.title,
    creator: 'OCN Project Hub',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: [{ reference: 'ol', levels: [0, 1, 2].map(level => ({ level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } } })) }],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1900, bottom: 1134, left: 1134, right: 1134, header: 567, footer: 567 } } },
      headers: { default: header },
      footers: { default: footer },
      children: [...blocks(content.content), new Paragraph({ spacing: { before: 360 }, children: [] }), await signatureTable(ctx)],
    }],
  })
  return Packer.toBuffer(doc)
}
