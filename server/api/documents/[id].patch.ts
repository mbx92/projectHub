import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'dokumen', 'kelola')
  const id = idParam(event)
  const db = useDB()
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id))
  if (!doc) notFound('Dokumen')
  await assertProjectAccess(me, doc.projectId)
  const body = await readBodyWith(event, z.object({ status: z.string().trim().max(40).optional(), type: z.string().trim().max(60).optional(), name: z.string().trim().min(1).max(200).optional() }))
  await db.update(schema.documents).set(body).where(eq(schema.documents.id, id))
  return { ok: true }
})
