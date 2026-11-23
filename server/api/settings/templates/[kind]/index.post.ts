/** Unggah satu artboard SVG (multipart: page = halaman-1 | halaman-lanjutan, file = .svg) ke draf template. */
export default defineEventHandler(async (event) => {
  const me = requireAccess(event, 'pengaturan', 'kelola')
  const kind = kindParam(event)
  const parts = await readMultipartFormData(event)
  const page = parts?.find(p => p.name === 'page')?.data.toString() as TemplatePageKey | undefined
  const file = parts?.find(p => p.name === 'file' && p.filename)
  if (!page || !PAGE_KEYS.includes(page)) throw createError({ statusCode: 400, statusMessage: 'Artboard harus halaman-1 atau halaman-lanjutan.' })
  if (!file) throw createError({ statusCode: 400, statusMessage: 'File SVG belum dipilih.' })
  if (kind === 'kuitansi' && page === 'halaman-lanjutan') throw createError({ statusCode: 400, statusMessage: 'Kuitansi hanya memakai halaman-1.' })
  try {
    const { ref, validation } = await uploadDraftPage(kind, page, file.data.toString('utf8'), me.id)
    return { draft: ref, validation }
  } catch (e) {
    if (e instanceof TemplateError) throw createError({ statusCode: 422, statusMessage: e.message })
    throw e
  }
})
