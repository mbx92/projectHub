import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'keuangan', 'kelola')
  const id = idParam(event)
  const db = useDB()
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(schema.expenses).where(eq(schema.expenses.id, id))
    if (!before) notFound('Pengeluaran')
    await assertProjectOrGlobal(me, before.projectId)
    await tx.delete(schema.expenses).where(eq(schema.expenses.id, id))
    await removeLedger(tx, 'expense', id)
    await logAudit(tx, me.id, 'hapus', 'expense', id, before, { projectId: before.projectId, name: `${before.description} dihapus` })
  })
  return { ok: true }
})
