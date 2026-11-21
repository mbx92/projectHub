import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'dokumen', 'kelola')
  const id = idParam(event)
  const db = useDB()
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id))
  if (!doc) notFound('Dokumen')
  await assertProjectAccess(me, doc.projectId)
  await db.delete(schema.documents).where(eq(schema.documents.id, id))
  await deleteStoredFile(doc.fileUrl)
  await logAudit(db, me.id, 'hapus', 'document', id, doc, null)
  return { ok: true }
})
