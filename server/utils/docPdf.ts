/** Render dokumen editor (JSON) ke PDF dengan kop, footer, dan blok tanda tangan. */
import type { Content, TableCell } from 'pdfmake/interfaces'
import type { DocNode } from './projectDocs'
import type { DocRenderCtx } from './docLayout'

const HEAD_SIZE: Record<number, number> = { 1: 14, 2: 12, 3: 11 }

function inline(nodes: DocNode[] | undefined): Content[] {
  return (nodes ?? []).map((n): Content => {
    if (n.type === 'hardBreak') return { text: '\n' }
    const marks = (n.marks ?? []).map(m => m.type)
    return { text: n.text ?? '', bold: marks.includes('bold'), italics: marks.includes('italic'), decoration: marks.includes('underline') ? 'underline' : undefined }
  })
}

function blocks(nodes: DocNode[] | undefined): Content[] {
  const out: Content[] = []
  for (const n of nodes ?? []) {
    switch (n.type) {
      case 'paragraph':
        out.push({ text: inline(n.content).length ? inline(n.content) : ' ', margin: [0, 0, 0, 6] })
        break
      case 'heading': {
        const level = Number(n.attrs?.level ?? 2)
        out.push({ text: inline(n.content), bold: true, fontSize: HEAD_SIZE[level] ?? 11, alignment: level === 1 ? 'center' : 'left', margin: [0, level === 1 ? 0 : 12, 0, 6] })
        break
      }
      case 'bulletList':
      case 'orderedList': {
        const items = (n.content ?? []).map((li): Content => ({ stack: blocks(li.content) }))
        out.push(n.type === 'bulletList' ? { ul: items, margin: [0, 0, 0, 6] } : { ol: items, margin: [0, 0, 0, 6] })
        break
      }
      case 'table': {
        const rows = n.content ?? []
        const cols = Math.max(1, ...rows.map(r => r.content?.length ?? 0))
        const headerRows = rows.length && (rows[0]!.content ?? []).every(c => c.type === 'tableHeader') && rows.length > 1 && (rows[1]!.content ?? []).some(c => c.type !== 'tableHeader') ? 1 : 0
        const body = rows.map(r => Array.from({ length: cols }, (_, i): TableCell => {
          const c = r.content?.[i]
          const stack = c ? blocks(c.content) : []
          const head = c?.type === 'tableHeader'
          return { stack: stack.length ? stack : [{ text: ' ' }], bold: head, color: head ? C.muted : undefined, fontSize: head ? 9 : undefined } as TableCell
        }))
        out.push({ table: { headerRows, widths: Array(cols).fill('*'), body }, layout: tableLayout(), margin: [0, 0, 0, 8] })
        break
      }
      default:
        if (n.content) out.push(...blocks(n.content))
    }
  }
  return out
}

export async function docToPdf(content: DocNode, ctx: DocRenderCtx): Promise<Buffer> {
  const business = businessForPdf(ctx.business)
  const head = await letterhead(business, '', ctx.docNumber ?? '')
  const sig = await signatureBlock(business, `Pihak Pertama`)
  const body: Content[] = [
    ...blocks(content.content),
    {
      margin: [0, 24, 0, 0],
      unbreakable: true,
      columns: [
        { width: '*', stack: [sig] },
        { width: '*', stack: [
          { text: 'Pihak Kedua (Klien)', alignment: 'center', color: C.muted, fontSize: 9, margin: [0, 24, 0, 0] },
          { text: ' ', margin: [0, 28, 0, 28] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.6, lineColor: C.line }] },
          { text: ctx.clientName ?? ' ', bold: true, alignment: 'center', margin: [0, 3, 0, 0] },
        ] },
      ],
    } as Content,
  ]
  return renderPdf({
    pageMargins: [40, 110, 40, 56],
    header: { ...(head as object), margin: [40, 24, 40, 0] } as Content,
    content: body,
    footer: footer(ctx.footer),
    info: { title: ctx.title },
  })
}
