import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const id = idParam(event)
  await assertProjectAccess(me, id)
  const { archived } = await readBodyWith(event, z.object({ archived: z.boolean() }))
  const db = useDB()
  const [row] = await db.update(schema.projects).set({ archived, archivedAt: archived ? new Date() : null }).where(eq(schema.projects.id, id)).returning()
  if (!row) notFound('Proyek')
  await logAudit(db, me.id, archived ? 'arsip' : 'pulihkan', 'project', id, null, { name: row.name, archived })
  return { ok: true }
})
