/** PDF dibuat di server (pdfmake): invoice, kuitansi, laporan. */
import { createRequire } from 'node:module'
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'

const require = createRequire(import.meta.url)
let printer: any = null

function getPrinter() {
  if (printer) return printer
  const PdfPrinter = require('pdfmake')
  const vfsMod = require('pdfmake/build/vfs_fonts.js')
  const vfs: Record<string, string> = vfsMod.pdfMake?.vfs ?? vfsMod
  const f = (n: string) => Buffer.from(vfs[n]!, 'base64')
  printer = new PdfPrinter({
    Roboto: { normal: f('Roboto-Regular.ttf'), bold: f('Roboto-Medium.ttf'), italics: f('Roboto-Italic.ttf'), bolditalics: f('Roboto-MediumItalic.ttf') },
  })
  return printer
}

export function renderPdf(doc: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = getPrinter().createPdfKitDocument({
      pageSize: 'A4',
      pageMargins: [40, 48, 40, 56],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: '#101828', lineHeight: 1.25 },
      ...doc,
    })
    const chunks: Buffer[] = []
    pdf.on('data', (c: Buffer) => chunks.push(c))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)
    pdf.end()
  })
}

export const C = { brand: '#0B6E63', ink: '#101828', muted: '#475467', line: '#E4E7EC', soft: '#F9FAFB', danger: '#B42318' }

/** Gambar (logo/QRIS) dari penyimpanan privat sebagai data URL; SVG dikembalikan sebagai teks. */
export async function storedImage(key: string | null | undefined): Promise<{ image?: string, svg?: string } | null> {
  if (!key) return null
  try {
    const buf = await readStoredFile(key)
    if (key.endsWith('.svg')) return { svg: buf.toString('utf8') }
    const mime = key.endsWith('.png') ? 'image/png' : 'image/jpeg'
    if (!/\.(png|jpe?g)$/i.test(key)) return null
    return { image: `data:${mime};base64,${buf.toString('base64')}` }
  } catch { return null }
}

export async function letterhead(business: BusinessProfile, rightTitle: string, rightSub: string): Promise<Content> {
  const logo = await storedImage(business.logoKey)
  const logoNode: Content = logo?.image
    ? { image: logo.image, width: 40, height: 40 }
    : logo?.svg
      ? { svg: logo.svg, width: 40, height: 40 }
      : { table: { widths: [40], heights: [40], body: [[{ text: 'OCN', color: '#fff', bold: true, alignment: 'center', margin: [0, 13, 0, 0], fontSize: 10 }]] }, layout: { fillColor: () => C.brand, hLineWidth: () => 0, vLineWidth: () => 0 } }
  return {
    columns: [
      { width: 48, stack: [logoNode] },
      { width: '*', stack: [
        { text: business.name, bold: true, fontSize: 12 },
        { text: [business.address, business.email, business.whatsapp].filter(Boolean).join(' · ') || ' ', color: C.muted, fontSize: 8.5 },
        business.npwp ? { text: `NPWP ${business.npwp}`, color: C.muted, fontSize: 8.5 } : { text: '' },
      ] },
      { width: 'auto', stack: [
        { text: rightTitle, bold: true, fontSize: 16, color: C.brand, alignment: 'right' },
        { text: rightSub, alignment: 'right', color: C.muted },
      ] },
    ],
    columnGap: 10,
    margin: [0, 0, 0, 20],
  }
}

/** Blok tanda tangan usaha (gambar + nama + jabatan), rata kanan. */
export async function signatureBlock(business: BusinessProfile, place?: string): Promise<Content> {
  const sig = await storedImage(business.signatureKey)
  if (!sig && !business.signerName) return { text: '' }
  const img: Content = sig?.image ? { image: sig.image, height: 56, alignment: 'center' } : sig?.svg ? { svg: sig.svg, height: 56, alignment: 'center' } : { text: ' ', margin: [0, 28, 0, 28] }
  return {
    width: 170,
    unbreakable: true,
    margin: [0, 24, 0, 0],
    stack: [
      ...(place ? [{ text: place, alignment: 'center', color: C.muted, fontSize: 9 } as Content] : [{ text: 'Hormat kami,', alignment: 'center', color: C.muted, fontSize: 9 } as Content]),
      { ...img, margin: [0, 4, 0, 2] } as Content,
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.6, lineColor: C.line }] },
      { text: business.signerName || business.name, bold: true, alignment: 'center', margin: [0, 3, 0, 0] },
      business.signerTitle ? { text: business.signerTitle, alignment: 'center', color: C.muted, fontSize: 9 } : { text: '' },
    ],
  } as unknown as Content
}

export function tableLayout() {
  return {
    hLineWidth: (i: number) => (i === 0 ? 0 : 0.6),
    vLineWidth: () => 0,
    hLineColor: () => C.line,
    paddingTop: () => 6, paddingBottom: () => 6, paddingLeft: () => 6, paddingRight: () => 6,
    fillColor: (row: number) => (row === 0 ? C.soft : null),
  }
}

export const th = (text: string, alignment: 'left' | 'right' = 'left'): TableCell => ({ text, bold: true, color: C.muted, fontSize: 8.5, alignment })

export function footer(text: string) {
  return (page: number, pages: number): Content => ({
    columns: [
      { text, color: C.muted, fontSize: 8 },
      { text: `Hal. ${page} dari ${pages}`, alignment: 'right', color: C.muted, fontSize: 8 },
    ],
    margin: [40, 16, 40, 0],
  })
}

/** Invoice: template Penpot bila ada (beku saat terkirim; draf memakai template aktif), selain itu layout bawaan. */
export async function invoicePdf(data: LoadedInvoice): Promise<Buffer> {
  const ref = data.invoice.templateRef ?? (data.invoice.status === 'draf' ? await activeTemplate('invoice') : null)
  if (!ref) return builtinInvoicePdf(data)
  return renderWithFallback(() => renderInvoiceTemplate(data, ref), () => builtinInvoicePdf(data), `invoice ${data.invoice.number}`)
}

async function builtinInvoicePdf(data: LoadedInvoice): Promise<Buffer> {
  const [business, invSettings] = await Promise.all([getSetting('business'), getSetting('invoice')])
  const { invoice: inv, items, client, project, bank } = data
  const qris = inv.showQris ? await storedImage(invSettings.qrisKey) : null
  const content: Content[] = [
    await letterhead(business, 'INVOICE', inv.number),
    {
      columns: [
        { width: '*', stack: [
          { text: 'Ditagihkan ke', color: C.muted, fontSize: 8.5 },
          { text: client?.name ?? '—', bold: true, fontSize: 11 },
          { text: [client?.contactName, client?.whatsapp, client?.email].filter(Boolean).join(' · ') || ' ', color: C.muted },
          { text: `Proyek: ${project.name}`, margin: [0, 4, 0, 0] },
        ] },
        { width: 'auto', stack: [
          { text: [{ text: 'Terbit: ', color: C.muted }, dateId(inv.issueDate)], alignment: 'right' },
          { text: [{ text: 'Jatuh tempo: ', color: C.muted }, { text: dateId(inv.dueDate), bold: true }], alignment: 'right' },
          inv.status === 'lunas' ? { text: 'LUNAS', color: '#067647', bold: true, alignment: 'right', fontSize: 12, margin: [0, 4, 0, 0] } : { text: '' },
        ] },
      ],
      margin: [0, 0, 0, 16],
    },
    {
      table: {
        headerRows: 1,
        widths: ['*', 40, 90, 95],
        body: [
          [th('Deskripsi'), th('Qty', 'right'), th('Harga', 'right'), th('Jumlah', 'right')],
          ...items.map(it => [it.description, { text: numberId(it.qty), alignment: 'right' }, { text: rupiah(it.price), alignment: 'right' }, { text: rupiah(Math.round(it.qty * it.price)), alignment: 'right' }] as TableCell[]),
        ],
      },
      layout: tableLayout(),
    },
    {
      columns: [
        { width: '*', text: '' },
        { width: 230, table: { widths: ['*', 'auto'], body: [
          ['Subtotal', { text: rupiah(inv.subtotal), alignment: 'right' }],
          ...(inv.discount ? [['Diskon', { text: `− ${rupiah(inv.discount)}`, alignment: 'right' }]] : []),
          ...(Number(inv.taxPercent) ? [[`Pajak ${percent(inv.taxPercent)}`, { text: rupiah(inv.taxAmount), alignment: 'right' }]] : []),
          [{ text: 'Total', bold: true, fontSize: 12 }, { text: rupiah(inv.total), bold: true, fontSize: 12, alignment: 'right', color: C.brand }],
          ...(data.paid > 0 && data.outstanding > 0 ? [['Sudah dibayar', { text: rupiah(data.paid), alignment: 'right' }], [{ text: 'Sisa tagihan', bold: true }, { text: rupiah(data.outstanding), alignment: 'right', bold: true }]] : []),
        ] as TableCell[][] }, layout: 'noBorders', margin: [0, 10, 0, 0] },
      ],
    },
    {
      columns: [
        { width: '*', stack: [
          { text: 'Pembayaran', bold: true, margin: [0, 20, 0, 4] },
          bank ? { text: `Transfer ke ${bank.bankName} ${bank.accountNumber}` } : { text: 'Hubungi kami untuk informasi pembayaran.' },
          bank ? { text: `a.n. ${bank.accountName}`, color: C.muted } : { text: '' },
          inv.notes ? { text: inv.notes, margin: [0, 10, 0, 0], color: C.muted } : { text: '' },
          invSettings.footer && invSettings.footer !== inv.notes ? { text: invSettings.footer, margin: [0, 10, 0, 0], color: C.muted, fontSize: 9 } : { text: '' },
        ] },
        qris?.image ? { width: 110, stack: [{ text: 'QRIS', bold: true, alignment: 'center', margin: [0, 20, 0, 4] }, { image: qris.image, width: 100, alignment: 'center' }] }
          : qris?.svg ? { width: 110, stack: [{ text: 'QRIS', bold: true, alignment: 'center', margin: [0, 20, 0, 4] }, { svg: qris.svg, width: 100 }] }
            : { width: 0, text: '' },
      ],
    },
  ]
  content.push({ columns: [{ width: '*', text: '' }, await signatureBlock(business)] })
  return renderPdf({ content, footer: footer(`${business.name} · ${inv.number}`), info: { title: inv.number } })
}

/** Kuitansi: template Penpot yang dibekukan saat pembayaran dicatat, selain itu layout bawaan. */
export async function receiptPdf(data: LoadedInvoice, paymentId: number): Promise<Buffer> {
  const ref = data.payments.find(p => p.id === paymentId)?.templateRef
  if (!ref) return builtinReceiptPdf(data, paymentId)
  return renderWithFallback(() => renderReceiptTemplate(data, paymentId, ref), () => builtinReceiptPdf(data, paymentId), `kuitansi ${data.invoice.number}#${paymentId}`)
}

async function builtinReceiptPdf(data: LoadedInvoice, paymentId: number): Promise<Buffer> {
  const business = await getSetting('business')
  const pay = data.payments.find(p => p.id === paymentId)
  if (!pay) notFound('Pembayaran')
  const no = `KW-${data.invoice.number.replace(/^INV-?/i, '')}-${pay.id}`
  const content: Content[] = [
    await letterhead(business, 'KUITANSI', no),
    { table: { widths: [140, '*'], body: [
      [{ text: 'Telah terima dari', color: C.muted }, { text: data.client?.name ?? '—', bold: true }],
      [{ text: 'Sejumlah', color: C.muted }, { text: rupiah(pay.amount), bold: true, fontSize: 14, color: C.brand }],
      [{ text: 'Terbilang', color: C.muted }, { text: `${terbilang(pay.amount)} rupiah`, italics: true }],
      [{ text: 'Untuk pembayaran', color: C.muted }, `${data.term?.name ?? 'Tagihan'} · ${data.project.name} (${data.invoice.number})`],
      [{ text: 'Tanggal', color: C.muted }, dateLongId(pay.date)],
      [{ text: 'Metode', color: C.muted }, pay.method],
      [{ text: 'Status invoice', color: C.muted }, data.outstanding > 0 ? `Sisa tagihan ${rupiah(data.outstanding)}` : 'Lunas'],
    ] }, layout: { hLineWidth: () => 0.6, vLineWidth: () => 0, hLineColor: () => C.line, paddingTop: () => 8, paddingBottom: () => 8 } },
    { columns: [{ width: '*', text: '' }, await signatureBlock(business, `${business.address ? business.address.split('\n')[0] + ', ' : ''}${dateLongId(pay.date)}`)] },
  ]
  return renderPdf({ content, footer: footer(`${business.name} · ${no}`), info: { title: no } })
}
