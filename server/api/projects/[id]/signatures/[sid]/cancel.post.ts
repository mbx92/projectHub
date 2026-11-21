import { and, eq } from 'drizzle-orm'

/** Batalkan permintaan yang masih menunggu (tautan klien langsung tidak berlaku). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'proyek', 'kelola')
  const projectId = idParam(event)
  await assertProjectAccess(me, projectId)
  const sid = idParam(event, 'sid')
  const rows = await useDB().update(schema.signatureRequests).set({ status: 'dibatalkan' })
    .where(and(eq(schema.signatureRequests.id, sid), eq(schema.signatureRequests.projectId, projectId), eq(schema.signatureRequests.status, 'menunggu')))
    .returning({ id: schema.signatureRequests.id })
  if (!rows.length) throw createError({ statusCode: 409, statusMessage: 'Hanya permintaan yang masih menunggu yang bisa dibatalkan.' })
  await logAudit(useDB(), me.id, 'ubah', 'signature_request', sid, { status: 'menunggu' }, { status: 'dibatalkan' })
  return { ok: true }
})
