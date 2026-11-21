import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'pengaturan', 'kelola')
  const id = idParam(event)
  const db = useDB()
  const [before] = await db.select().from(schema.profitSchemes).where(eq(schema.profitSchemes.id, id))
  if (!before) notFound('Skema')
  const used = await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.schemeId, id)).limit(1)
  if (used.length) throw createError({ statusCode: 409, statusMessage: 'Template masih dipakai proyek, tidak bisa dihapus.' })
  await db.delete(schema.profitSchemes).where(eq(schema.profitSchemes.id, id))
  await logAudit(db, me.id, 'hapus', 'profit_scheme', id, before, null)
  return { ok: true }
})
