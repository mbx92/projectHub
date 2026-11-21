/** Detail dokumen yang bisa diedit: isi, serta kop & footer yang berlaku (beku bila Final). */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'dokumen', 'lihat')
  const { doc, projectName, clientName } = await loadDocFor(me, idParam(event))
  if (doc.content == null) throw createError({ statusCode: 400, statusMessage: 'Dokumen ini berupa file, bukan dokumen yang bisa diedit.' })
  const ctx = await docRenderCtx(doc, projectName, clientName)
  const b = ctx.business
  return {
    id: doc.id,
    projectId: doc.projectId,
    projectName,
    name: doc.name,
    type: doc.type,
    status: doc.status,
    docNumber: doc.docNumber,
    content: doc.content,
    updatedAt: doc.updatedAt,
    frozenLayout: doc.status === 'final' && !!doc.layoutSnapshot,
    clientName,
    layout: {
      business: { name: b.name, address: b.address, email: b.email, whatsapp: b.whatsapp, npwp: b.npwp, signerName: b.signerName, signerTitle: b.signerTitle, logoUrl: signedFileUrl(b.logoKey, 'logo', 3600), signatureUrl: signedFileUrl(b.signatureKey, 'ttd', 3600) },
      footer: ctx.footer,
    },
  }
})
