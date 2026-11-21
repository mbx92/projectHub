import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'bug', 'ditugaskan')
  const id = idParam(event)
  const db = useDB()
  const [a] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, id))
  if (!a) notFound('Lampiran')
  if (a.entityType === 'bug') await loadBugForUser(me, a.entityId)
  if (!can(me, 'bug', 'kelola') && a.createdBy !== me.id) throw createError({ statusCode: 403, statusMessage: 'Hanya pengunggah atau admin yang bisa menghapus lampiran.' })
  await db.delete(schema.attachments).where(eq(schema.attachments.id, id))
  await deleteStoredFile(a.fileKey)
  return { ok: true }
})
