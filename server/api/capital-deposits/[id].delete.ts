import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'investor', 'kelola')
  const id = idParam(event)
  const db = useDB()
  await db.transaction(async (tx) => {
    const [d] = await tx.select().from(schema.capitalDeposits).where(eq(schema.capitalDeposits.id, id))
    if (!d) notFound('Setoran')
    await tx.delete(schema.capitalDeposits).where(eq(schema.capitalDeposits.id, id))
    await removeLedger(tx, 'capital_deposit', id)
    await logAudit(tx, me.id, 'hapus', 'capital_deposit', id, d, null)
  })
  return { ok: true }
})
