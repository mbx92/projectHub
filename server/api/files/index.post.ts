/**
 * Unggah file (multipart, field "file"). Mengembalikan kunci file privat + URL bertanda tangan.
 * Folder: bukti | bug | dokumen | logo
 */
export default defineEventHandler(async (event) => {
  const me = requireUser(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  const folder = parts?.find(p => p.name === 'folder')?.data.toString() || 'bukti'
  if (!file) throw createError({ statusCode: 400, statusMessage: 'File belum dipilih.' })
  if (!['bukti', 'bug', 'dokumen', 'logo'].includes(folder)) throw createError({ statusCode: 400, statusMessage: 'Folder tidak valid.' })
  const allowed = {
    bukti: can(me, 'keuangan', 'kelola') || can(me, 'investor', 'kelola'),
    bug: can(me, 'bug', 'ditugaskan'),
    dokumen: can(me, 'dokumen', 'kelola'),
    logo: can(me, 'pengaturan', 'kelola'),
  }[folder as 'bukti' | 'bug' | 'dokumen' | 'logo']
  if (!allowed) throw createError({ statusCode: 403, statusMessage: 'Anda tidak punya akses untuk mengunggah file ini.' })
  const mime = file.type || MIME_BY_EXT[(file.filename!.match(/\.\w+$/)?.[0] || '').toLowerCase()]
  const key = await saveFile(folder, file.filename!, file.data, mime)
  return { key, name: file.filename, size: file.data.length, mime: mime ?? null, url: signedFileUrl(key, file.filename) }
})
