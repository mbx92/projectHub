/** Render dokumen dari template SVG (invoice, kuitansi, bingkai dokumen) + pratinjau. Dipakai pdf.ts dan endpoint Pengaturan. */
import { desc } from 'drizzle-orm'
import type { Content } from 'pdfmake/interfaces'
import type { BusinessProfile, TemplateKind, TemplateRef } from '../../shared/utils/settings'
import { renderTemplatePages } from './svgTemplate/repeat'
import { docFrameValues, invoiceValues, receiptValues } from './templateData'
import { ensureTemplateFonts, framedDocPdf, pdfMeasure, svgPagesToPdf } from './templatePdf'
import { loadTemplatePages } from './docTemplates'
import type { LoadedInvoice } from './invoices'
import { storedImage } from './pdf'

/** Gambar usaha sebagai data URL. Logo/tanda tangan SVG belum didukung di template → dikosongkan. */
export async function templateImages(business: Pick<BusinessProfile, 'logoKey' | 'signatureKey'>, qrisKey?: string | null): Promise<Record<string, string | null>> {
  const [logo, ttd, qris] = await Promise.all([storedImage(business.logoKey), storedImage(business.signatureKey), storedImage(qrisKey)])
  return { logo: logo?.image ?? null, ttd: ttd?.image ?? null, qris: qris?.image ?? null }
}

export async function renderInvoiceTemplate(data: LoadedInvoice, ref: TemplateRef, opts: { extraItems?: number } = {}): Promise<Buffer> {
  await ensureTemplateFonts()
  const [business, invSettings] = await Promise.all([getSetting('business'), getSetting('invoice')])
  const { values, items } = invoiceValues(data, business, invSettings)
  const last = items[items.length - 1]
  for (let i = 0; last && i < (opts.extraItems ?? 0); i++) items.push({ ...last, 'item.no': String(items.length + 1), 'item.deskripsi': `${last['item.deskripsi']} (contoh ${i + 1})` })
  const images = await templateImages(business, data.invoice.showQris ? invSettings.qrisKey : null)
  const pages = renderTemplatePages(await loadTemplatePages(ref), { values, items, images, measure: pdfMeasure })
  return svgPagesToPdf(pages, data.invoice.number)
}

export async function renderReceiptTemplate(data: LoadedInvoice, paymentId: number, ref: TemplateRef): Promise<Buffer> {
  await ensureTemplateFonts()
  const business = await getSetting('business')
  const values = receiptValues(data, paymentId, business)
  const images = await templateImages(business)
  const pages = renderTemplatePages(await loadTemplatePages(ref), { values, images, measure: pdfMeasure })
  return svgPagesToPdf(pages, values.nomor!)
}

/** Dokumen proyek berbingkai: `body` = konten pdfmake dari isi editor. */
export async function renderDocTemplate(ref: TemplateRef, ctx: Parameters<typeof docFrameValues>[0], projectName: string, body: Content[], logoSig?: Pick<BusinessProfile, 'logoKey' | 'signatureKey'>): Promise<Buffer> {
  const frames = await loadTemplatePages(ref)
  const images = await templateImages(logoSig ?? ctx.business)
  return framedDocPdf(frames, docFrameValues(ctx, projectName), body, ctx.title, { images })
}

const SAMPLE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pihak Pertama dan Pihak Kedua sepakat untuk melaksanakan pekerjaan sebagaimana diuraikan dalam dokumen ini. '

/** Pratinjau PDF memakai data terbaru; tidak menulis apa pun ke database. */
export async function renderPreview(kind: TemplateKind, ref: TemplateRef, extraItems = 0): Promise<Buffer> {
  const db = useDB()
  if (kind === 'invoice') {
    const [row] = await db.select({ id: schema.invoices.id }).from(schema.invoices).orderBy(desc(schema.invoices.id)).limit(1)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Belum ada invoice untuk dijadikan contoh pratinjau.' })
    return renderInvoiceTemplate(await loadInvoice(row.id), ref, { extraItems })
  }
  if (kind === 'kuitansi') {
    const [pay] = await db.select({ id: schema.payments.id, invoiceId: schema.payments.invoiceId }).from(schema.payments).orderBy(desc(schema.payments.id)).limit(1)
    if (!pay) throw createError({ statusCode: 404, statusMessage: 'Belum ada pembayaran untuk dijadikan contoh pratinjau.' })
    return renderReceiptTemplate(await loadInvoice(pay.invoiceId), pay.id, ref)
  }
  const business = await getSetting('business')
  const ctx = { business, footer: `${business.name} · DOK-001`, docNumber: 'DOK-001', title: 'Contoh Dokumen', clientName: 'Klien Contoh' }
  const body: Content[] = [{ text: 'Contoh Dokumen', bold: true, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 8] }, ...Array.from({ length: 24 }, (_, i): Content => ({ text: `${i + 1}. ${SAMPLE.repeat(3)}`, margin: [0, 0, 0, 6] }))]
  return renderDocTemplate(ref, ctx, 'Proyek Contoh', body)
}
