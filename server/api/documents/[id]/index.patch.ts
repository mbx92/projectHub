import { eq } from 'drizzle-orm'

const MAX_CONTENT_BYTES = 400_000

const contentSchema = z.object({ type: z.literal('doc'), content: z.array(z.any()).optional() }).passthrough()

export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'dokumen', 'kelola')
  const id = idParam(event)
  const db = useDB()
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id))
  if (!doc) notFound('Dokumen')
  await assertProjectAccess(me, doc.projectId)
  const body = await readBodyWith(event, z.object({
    status: z.string().trim().max(40).optional(),
    type: z.string().trim().max(60).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    content: contentSchema.optional(),
  }))
  if (body.content) {
    if (doc.content == null) throw createError({ statusCode: 400, statusMessage: 'Dokumen ini berupa file dan tidak bisa diedit di aplikasi.' })
    if (doc.status === 'final') throw createError({ statusCode: 409, statusMessage: 'Dokumen Final tidak bisa diubah. Buka kembali sebagai Draf untuk merevisi.' })
    if (JSON.stringify(body.content).length > MAX_CONTENT_BYTES) throw createError({ statusCode: 413, statusMessage: 'Isi dokumen terlalu besar.' })
  }
  const next: Partial<typeof schema.documents.$inferInsert> = { ...body, content: body.content as Record<string, unknown> | undefined }
  // Dokumen Final membekukan kop & footer saat itu; dibuka kembali ke Draf, kop & footer mengikuti Pengaturan lagi.
  if (body.status && doc.content != null) {
    if (body.status === 'final' && doc.status !== 'final') next.layoutSnapshot = await liveLayout()
    if (body.status !== 'final' && doc.status === 'final') next.layoutSnapshot = null
  }
  await db.update(schema.documents).set(next).where(eq(schema.documents.id, id))
  return { ok: true }
})
