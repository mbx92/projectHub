/** Ekspor dokumen editor ke PDF atau Word (?format=pdf|docx, ?download=1 untuk mengunduh). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'dokumen', 'lihat')
  const q = getQuery(event)
  const format = q.format === 'docx' ? 'docx' : 'pdf'
  const { doc, projectName, clientName } = await loadDocFor(me, idParam(event))
  if (doc.content == null) throw createError({ statusCode: 400, statusMessage: 'Dokumen ini berupa file, bukan dokumen yang bisa diekspor.' })
  const ctx = await docRenderCtx(doc, projectName, clientName)
  const content = doc.content as unknown as DocNode
  const bytes = format === 'docx' ? await docToDocx(content, ctx) : await docToPdf(content, ctx)
  const safeName = (doc.name.replace(/[^\w .()-]+/g, '_').trim() || 'dokumen').slice(0, 120)
  setResponseHeaders(event, {
    'Content-Type': format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
    'Content-Disposition': `${q.download === '1' || format === 'docx' ? 'attachment' : 'inline'}; filename="${safeName}.${format}"`,
    'Cache-Control': 'no-store',
  })
  return bytes
})
