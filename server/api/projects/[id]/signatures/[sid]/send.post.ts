import { and, eq } from 'drizzle-orm'

/** Kirim (ulang) tautan permintaan tanda tangan ke email klien. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const projectId = idParam(event)
  await assertProjectAccess(me, projectId)
  const sid = idParam(event, 'sid')
  const { email } = await readBodyWith(event, z.object({ email: z.string().trim().toLowerCase().email('email tidak valid').max(190) }))
  const db = useDB()
  const [row] = await db.select().from(schema.signatureRequests)
    .where(and(eq(schema.signatureRequests.id, sid), eq(schema.signatureRequests.projectId, projectId)))
  if (!row) notFound('Permintaan tanda tangan')
  if (signatureStatus(row) !== 'menunggu') throw createError({ statusCode: 409, statusMessage: 'Permintaan ini sudah tidak aktif.' })
  const [project] = await db.select({ name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, projectId))
  await db.update(schema.signatureRequests).set({ sentTo: email }).where(eq(schema.signatureRequests.id, sid))
  const r = await sendSignatureMail({ ...row, sentTo: email }, project?.name ?? '', email, me.name).catch(() => ({ sent: false }))
  return { emailSent: r.sent }
})
