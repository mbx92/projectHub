import { eq } from 'drizzle-orm'

/** Hapus pembayaran yang salah catat; status invoice/termin dan saldo kas dihitung ulang. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const id = idParam(event)
  const db = useDB()
  await db.transaction(async (tx) => {
    const [pay] = await tx.select().from(schema.payments).where(eq(schema.payments.id, id))
    if (!pay) notFound('Pembayaran')
    const [own] = await tx.select({ projectId: schema.invoices.projectId }).from(schema.invoices).where(eq(schema.invoices.id, pay.invoiceId))
    if (own) await assertProjectAccess(me, own.projectId)
    const [inv] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, pay.invoiceId))
    await tx.delete(schema.payments).where(eq(schema.payments.id, id))
    await removeLedger(tx, 'payment', id)
    await syncPaidStatus(tx, pay.invoiceId)
    await logAudit(tx, me.id, 'hapus', 'payment', id, { ...pay, projectId: inv?.projectId }, { projectId: inv?.projectId, name: `${inv?.number} dihapus` })
  })
  return { ok: true }
})
