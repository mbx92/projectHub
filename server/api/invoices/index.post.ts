import { and, eq, ne } from 'drizzle-orm'

/** Buat invoice (draf) dari termin. Termin lunas / yang sudah punya invoice aktif tidak bisa ditagih ulang. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const body = await readBodyWith(event, invoiceInputSchema)
  if (body.dueDate < body.issueDate) throw createError({ statusCode: 422, statusMessage: 'Jatuh tempo tidak boleh sebelum tanggal terbit.' })
  const db = useDB()
  const id = await db.transaction(async (tx) => {
    const [term] = await tx.select().from(schema.terms).where(eq(schema.terms.id, body.termId)).for('update')
    if (!term) notFound('Termin')
    await assertProjectAccess(me, term.projectId)
    if (term.status === 'lunas') throw createError({ statusCode: 422, statusMessage: 'Termin sudah lunas dan tidak bisa ditagih ulang.' })
    const [existing] = await tx.select({ id: schema.invoices.id, number: schema.invoices.number }).from(schema.invoices)
      .where(and(eq(schema.invoices.termId, term.id), ne(schema.invoices.status, 'batal')))
    if (existing) throw createError({ statusCode: 409, statusMessage: `Termin ini sudah punya invoice ${existing.number}. Ubah atau batalkan invoice tersebut.` })

    const totals = invoiceTotals(body.items, body.discount, body.taxPercent)
    const number = await nextInvoiceNumber(tx, body.issueDate)
    const [inv] = await tx.insert(schema.invoices).values({
      number, termId: term.id, projectId: term.projectId, issueDate: body.issueDate, dueDate: body.dueDate,
      subtotal: totals.subtotal, discount: totals.discount, taxPercent: body.taxPercent, taxAmount: totals.tax, total: totals.total,
      notes: body.notes, bankAccountId: body.bankAccountId, showQris: body.showQris, status: 'draf', createdBy: me.id,
    }).returning()
    await writeInvoiceItems(tx, inv!.id, body.items, me.id)
    await tx.update(schema.terms).set({ status: 'draf' }).where(eq(schema.terms.id, term.id))
    await logAudit(tx, me.id, 'buat', 'invoice', inv!.id, null, { ...inv, projectId: term.projectId, name: number })
    return inv!.id
  })
  return { id }
})
