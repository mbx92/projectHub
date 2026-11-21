import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'investor', 'kelola')
  const id = idParam(event)
  const body = await readBodyWith(event, z.object({ status: z.enum(['aktif', 'calon']).optional(), notes: zOptText(1000).optional() }))
  const db = useDB()
  const [before] = await db.select().from(schema.investors).where(eq(schema.investors.id, id))
  if (!before) notFound('Investor')
  await db.update(schema.investors).set(body).where(eq(schema.investors.id, id))
  await logAudit(db, me.id, 'ubah', 'investor', id, before, body)
  return { ok: true }
})
