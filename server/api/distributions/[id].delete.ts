import { eq } from 'drizzle-orm'

/** Batalkan distribusi yang salah catat (dana dikembalikan ke kas di mutasi). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'investor', 'kelola')
  const id = idParam(event)
  const db = useDB()
  await db.transaction(async (tx) => {
    const [d] = await tx.select().from(schema.distributions).where(eq(schema.distributions.id, id))
    if (!d) notFound('Distribusi')
    await tx.delete(schema.distributions).where(eq(schema.distributions.id, id))
    await removeLedger(tx, 'distribution', id)
    await logAudit(tx, me.id, 'hapus', 'distribution', id, d, null)
  })
  return { ok: true }
})
