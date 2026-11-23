import { and, eq } from 'drizzle-orm'

/**
 * Hapus item tracker (bug / fitur / tugas) beserta komentar dan lampirannya. Khusus pengelola bug (admin).
 * Komentar ikut terhapus lewat FK cascade; lampiran (tanpa FK) dihapus manual beserta berkasnya.
 */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'bug', 'kelola')
  const bug = await loadBugForUser(me, idParam(event))
  const db = useDB()
  const files = await db.select({ id: schema.attachments.id, fileKey: schema.attachments.fileKey }).from(schema.attachments)
    .where(and(eq(schema.attachments.entityType, 'bug'), eq(schema.attachments.entityId, bug.id)))
  await db.transaction(async (tx) => {
    await tx.delete(schema.attachments).where(and(eq(schema.attachments.entityType, 'bug'), eq(schema.attachments.entityId, bug.id)))
    await tx.delete(schema.bugs).where(eq(schema.bugs.id, bug.id))
  })
  for (const f of files) await deleteStoredFile(f.fileKey).catch(() => {})
  return { ok: true }
})
