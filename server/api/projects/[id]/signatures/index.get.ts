import { desc, eq } from 'drizzle-orm'

/** Daftar permintaan tanda tangan klien di sebuah proyek (pengelola proyek). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const projectId = idParam(event)
  await assertProjectAccess(me, projectId)
  const rows = await useDB().select().from(schema.signatureRequests)
    .where(eq(schema.signatureRequests.projectId, projectId)).orderBy(desc(schema.signatureRequests.createdAt))
  return rows.map((r) => {
    const status = signatureStatus(r)
    return {
      id: r.id, title: r.title, body: r.body, status, expiresAt: r.expiresAt, sentTo: r.sentTo, createdAt: r.createdAt,
      signedAt: r.signedAt, signerName: r.signerName,
      link: status === 'menunggu' ? signatureLink(r.token) : null,
      signatureUrl: signedFileUrl(r.signatureKey, 'tanda-tangan', 3600),
    }
  })
})
