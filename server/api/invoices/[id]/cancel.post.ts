import { eq } from 'drizzle-orm'

/** Batalkan invoice yang belum dibayar; termin kembali Terjadwal sehingga bisa ditagih lagi. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const id = idParam(event)
  const data = await loadInvoiceFor(me, id)
  if (data.payments.length) throw createError({ statusCode: 422, statusMessage: 'Invoice yang sudah ada pembayarannya tidak bisa dibatalkan. Hapus pembayaran terlebih dahulu.' })
  const db = useDB()
  await db.transaction(async (tx) => {
    await tx.update(schema.invoices).set({ status: 'batal' }).where(eq(schema.invoices.id, id))
    if (data.invoice.termId) await tx.update(schema.terms).set({ status: 'terjadwal' }).where(eq(schema.terms.id, data.invoice.termId))
    await logAudit(tx, me.id, 'batal', 'invoice', id, { status: data.invoice.status }, { status: 'batal', projectId: data.project.id, name: data.invoice.number })
  })
  return { ok: true }
})
