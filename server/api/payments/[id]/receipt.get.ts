import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'lihat')
  const id = idParam(event)
  const [pay] = await useDB().select().from(schema.payments).where(eq(schema.payments.id, id))
  if (!pay) notFound('Pembayaran')
  const data = await loadInvoiceFor(me, pay.invoiceId)
  const pdf = await receiptPdf(data, id)
  setResponseHeaders(event, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Kuitansi-${data.invoice.number}-${id}.pdf"`, 'Cache-Control': 'no-store' })
  return pdf
})
