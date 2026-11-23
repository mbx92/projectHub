/** Pratinjau PDF dengan data terbaru. ?aktif=1 memakai template aktif, selain itu draf (jika ada). ?contoh=N menambah N item contoh. Tidak menulis apa pun. */
export default defineEventHandler(async (event) => {
  requireAccess(event, 'pengaturan', 'kelola')
  const kind = kindParam(event)
  const q = getQuery(event)
  const t = await getTemplates()
  const ref = q.aktif === '1' ? t.active[kind] : (t.draft[kind] ?? t.active[kind])
  if (!ref) throw createError({ statusCode: 404, statusMessage: 'Belum ada template untuk dipratinjau.' })
  const extra = Math.min(Math.max(Number(q.contoh) || 0, 0), 200)
  try {
    const pdf = await renderPreview(kind, ref, extra)
    setHeader(event, 'content-type', 'application/pdf')
    setHeader(event, 'content-disposition', 'inline; filename="pratinjau.pdf"')
    return pdf
  } catch (e) {
    if (e instanceof TemplateError) throw createError({ statusCode: 422, statusMessage: e.message })
    throw e
  }
})
