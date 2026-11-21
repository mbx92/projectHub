import { eq } from 'drizzle-orm'

/** Hanya invoice draf yang bisa diubah. Termin tidak bisa dipindah. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const id = idParam(event)
  const body = await readBodyWith(event, invoiceInputSchema)
  if (body.dueDate < body.issueDate) throw createError({ statusCode: 422, statusMessage: 'Jatuh tempo tidak boleh sebelum tanggal terbit.' })
  const db = useDB()
  await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, id)).for('update')
    if (!inv) notFound('Invoice')
    await assertProjectAccess(me, inv.projectId)
    if (inv.status !== 'draf') throw createError({ statusCode: 422, statusMessage: 'Invoice yang sudah dikirim tidak bisa diubah. Batalkan lalu buat ulang bila perlu.' })
    if (inv.termId !== body.termId) throw createError({ statusCode: 422, statusMessage: 'Termin invoice tidak bisa diganti.' })
    const totals = invoiceTotals(body.items, body.discount, body.taxPercent)
    const patch = {
      issueDate: body.issueDate, dueDate: body.dueDate, subtotal: totals.subtotal, discount: totals.discount, taxPercent: body.taxPercent,
      taxAmount: totals.tax, total: totals.total, notes: body.notes, bankAccountId: body.bankAccountId, showQris: body.showQris,
    }
    await tx.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id))
    await writeInvoiceItems(tx, id, body.items, me.id)
    await logAudit(tx, me.id, 'ubah', 'invoice', id, inv, { ...inv, ...patch, name: inv.number })
  })
  return { id }
})
