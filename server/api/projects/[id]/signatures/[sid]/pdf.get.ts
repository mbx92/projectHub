import { and, eq } from 'drizzle-orm'

/** Unduh PDF bukti persetujuan (hanya yang sudah ditandatangani). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const projectId = idParam(event)
  await assertProjectAccess(me, projectId)
  const sid = idParam(event, 'sid')
  const [row] = await useDB().select().from(schema.signatureRequests)
    .where(and(eq(schema.signatureRequests.id, sid), eq(schema.signatureRequests.projectId, projectId)))
  if (!row) notFound('Permintaan tanda tangan')
  if (row.status !== 'ditandatangani') throw createError({ statusCode: 409, statusMessage: 'Belum ditandatangani klien.' })
  const pdf = await signatureEvidencePdf(row)
  setResponseHeaders(event, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Persetujuan-${row.id}.pdf"`, 'Cache-Control': 'no-store' })
  return pdf
})
